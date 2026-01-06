import { nanoid } from 'nanoid';
import { getDatabase } from '../db/database.js';
import { getConfig } from '../config/index.js';
import type {
  JubileeTLD,
  JubileeDomain,
  DomainSearchResult,
  DomainSuggestion,
  DomainAvailabilityResponse,
  DomainMetadata,
} from '../types/index.js';

// =============================================================================
// TLD Operations
// =============================================================================

export async function getAllTLDs(includeRestricted = false): Promise<JubileeTLD[]> {
  const db = getDatabase();

  if (includeRestricted) {
    return db<JubileeTLD[]>`
      SELECT
        id, tld, display_name as "displayName", description,
        is_restricted as "isRestricted", requires_verification as "requiresVerification",
        eligibility_rules as "eligibilityRules", price_per_year as "pricePerYear",
        is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM jubilee_tlds
      WHERE is_active = true
      ORDER BY is_restricted ASC, tld ASC
    `;
  }

  return db<JubileeTLD[]>`
    SELECT
      id, tld, display_name as "displayName", description,
      is_restricted as "isRestricted", requires_verification as "requiresVerification",
      eligibility_rules as "eligibilityRules", price_per_year as "pricePerYear",
      is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
    FROM jubilee_tlds
    WHERE is_active = true AND is_restricted = false
    ORDER BY tld ASC
  `;
}

export async function getTLDByName(tld: string): Promise<JubileeTLD | null> {
  const db = getDatabase();

  const [result] = await db<JubileeTLD[]>`
    SELECT
      id, tld, display_name as "displayName", description,
      is_restricted as "isRestricted", requires_verification as "requiresVerification",
      eligibility_rules as "eligibilityRules", price_per_year as "pricePerYear",
      is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
    FROM jubilee_tlds
    WHERE tld = ${tld.toLowerCase()} AND is_active = true
  `;

  return result ?? null;
}

// =============================================================================
// Domain Availability
// =============================================================================

export function normalizeDomainName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63);
}

export function isValidDomainName(name: string): boolean {
  const normalized = normalizeDomainName(name);
  if (normalized.length < 1 || normalized.length > 63) {
    return false;
  }
  // Must start and end with alphanumeric
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    return false;
  }
  // No consecutive hyphens
  if (/--/.test(normalized)) {
    return false;
  }
  return true;
}

export async function isNameReserved(name: string, tldId: string | null = null): Promise<boolean> {
  const db = getDatabase();
  const normalized = normalizeDomainName(name);

  const [result] = await db<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM reserved_domains
    WHERE name = ${normalized}
      AND (tld_id IS NULL OR tld_id = ${tldId})
  `;

  return (result?.count ?? 0) > 0;
}

export async function isDomainRegistered(name: string, tldId: string): Promise<boolean> {
  const db = getDatabase();
  const normalized = normalizeDomainName(name);

  const [result] = await db<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM jubilee_domains
    WHERE name = ${normalized}
      AND tld_id = ${tldId}
      AND status NOT IN ('deleted', 'expired')
  `;

  return (result?.count ?? 0) > 0;
}

export async function checkDomainAvailability(
  name: string,
  tlds?: string[]
): Promise<DomainAvailabilityResponse> {
  const normalized = normalizeDomainName(name);

  if (!isValidDomainName(normalized)) {
    return {
      query: name,
      results: [],
      suggestions: [],
    };
  }

  const allTLDs = await getAllTLDs(true);
  const targetTLDs = tlds && tlds.length > 0
    ? allTLDs.filter((t) => tlds.includes(t.tld))
    : allTLDs;

  const results: DomainSearchResult[] = [];

  for (const tld of targetTLDs) {
    const isReserved = await isNameReserved(normalized, tld.id);
    const isRegistered = await isDomainRegistered(normalized, tld.id);

    let status: DomainSearchResult['status'];
    let available: boolean;

    if (tld.isRestricted) {
      status = 'restricted';
      available = false;
    } else if (isReserved) {
      status = 'reserved';
      available = false;
    } else if (isRegistered) {
      status = 'registered';
      available = false;
    } else {
      status = 'available';
      available = true;
    }

    results.push({
      name: normalized,
      tld: tld.tld,
      fullDomain: `${normalized}.${tld.tld}`,
      available,
      status,
      pricePerYear: tld.pricePerYear,
      requiresVerification: tld.requiresVerification,
    });
  }

  // Generate suggestions if primary options unavailable
  const suggestions = await generateSuggestions(normalized, results, allTLDs);

  return {
    query: name,
    results,
    suggestions,
  };
}

async function generateSuggestions(
  name: string,
  currentResults: DomainSearchResult[],
  allTLDs: JubileeTLD[]
): Promise<DomainSuggestion[]> {
  const suggestions: DomainSuggestion[] = [];
  const hasAvailable = currentResults.some((r) => r.available);

  if (hasAvailable) {
    return suggestions; // No suggestions needed
  }

  // Try alternative TLDs
  const openTLDs = allTLDs.filter((t) => !t.isRestricted);
  for (const tld of openTLDs) {
    const isReserved = await isNameReserved(name, tld.id);
    const isRegistered = await isDomainRegistered(name, tld.id);

    if (!isReserved && !isRegistered) {
      suggestions.push({
        fullDomain: `${name}.${tld.tld}`,
        name,
        tld: tld.tld,
        pricePerYear: tld.pricePerYear,
        reason: 'alternative_tld',
      });

      if (suggestions.length >= 3) break;
    }
  }

  // Try name variations
  const variations = generateNameVariations(name);
  for (const variation of variations) {
    if (suggestions.length >= 6) break;

    for (const tld of openTLDs.slice(0, 3)) {
      const isReserved = await isNameReserved(variation, tld.id);
      const isRegistered = await isDomainRegistered(variation, tld.id);

      if (!isReserved && !isRegistered) {
        suggestions.push({
          fullDomain: `${variation}.${tld.tld}`,
          name: variation,
          tld: tld.tld,
          pricePerYear: tld.pricePerYear,
          reason: 'variation',
        });
        break;
      }
    }
  }

  return suggestions.slice(0, 6);
}

function generateNameVariations(name: string): string[] {
  const variations: string[] = [];

  // Add common prefixes
  const prefixes = ['my', 'the', 'our'];
  for (const prefix of prefixes) {
    const variation = `${prefix}${name}`;
    if (isValidDomainName(variation)) {
      variations.push(variation);
    }
  }

  // Add common suffixes
  const suffixes = ['online', 'hub', 'now', 'life'];
  for (const suffix of suffixes) {
    const variation = `${name}${suffix}`;
    if (isValidDomainName(variation)) {
      variations.push(variation);
    }
  }

  // Add numbers
  for (let i = 1; i <= 3; i++) {
    const variation = `${name}${i}`;
    if (isValidDomainName(variation)) {
      variations.push(variation);
    }
  }

  return variations;
}

// =============================================================================
// Domain Registration
// =============================================================================

export interface RegisterDomainInput {
  name: string;
  tldId: string;
  ownerId: string;
  years?: number;
  autoRenew?: boolean;
  metadata?: DomainMetadata;
}

export async function registerDomain(input: RegisterDomainInput): Promise<JubileeDomain> {
  const db = getDatabase();
  const config = getConfig();

  const normalized = normalizeDomainName(input.name);

  // Get TLD info
  const [tld] = await db<JubileeTLD[]>`
    SELECT id, tld, is_restricted as "isRestricted", requires_verification as "requiresVerification"
    FROM jubilee_tlds
    WHERE id = ${input.tldId} AND is_active = true
  `;

  if (tld === undefined) {
    throw new Error('Invalid TLD');
  }

  if (tld.isRestricted) {
    throw new Error('This TLD is restricted and requires special authorization');
  }

  // Check availability
  const isReserved = await isNameReserved(normalized, tld.id);
  if (isReserved) {
    throw new Error('This domain name is reserved');
  }

  const isRegistered = await isDomainRegistered(normalized, tld.id);
  if (isRegistered) {
    throw new Error('This domain is already registered');
  }

  const id = nanoid();
  const fullDomain = `${normalized}.${tld.tld}`;
  const years = input.years ?? config.DOMAIN_REGISTRATION_YEARS_DEFAULT;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + years);

  const status = tld.requiresVerification ? 'pending_verification' : 'pending_payment';

  const [domain] = await db<JubileeDomain[]>`
    INSERT INTO jubilee_domains (
      id, name, tld_id, full_domain, owner_id, status,
      registered_at, expires_at, auto_renew, metadata
    )
    VALUES (
      ${id}, ${normalized}, ${input.tldId}, ${fullDomain}, ${input.ownerId},
      ${status}, ${status === 'pending_payment' ? null : now},
      ${status === 'pending_payment' ? null : expiresAt},
      ${input.autoRenew ?? true}, ${JSON.stringify(input.metadata ?? {})}
    )
    RETURNING
      id, name, tld_id as "tldId", full_domain as "fullDomain", owner_id as "ownerId",
      status, registered_at as "registeredAt", expires_at as "expiresAt",
      auto_renew as "autoRenew", metadata, created_at as "createdAt", updated_at as "updatedAt"
  `;

  if (domain === undefined) {
    throw new Error('Failed to register domain');
  }

  return domain;
}

export async function activateDomain(domainId: string, years: number = 1): Promise<JubileeDomain> {
  const db = getDatabase();

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + years);

  const [domain] = await db<JubileeDomain[]>`
    UPDATE jubilee_domains
    SET
      status = 'active',
      registered_at = COALESCE(registered_at, ${now}),
      expires_at = ${expiresAt},
      updated_at = NOW()
    WHERE id = ${domainId}
    RETURNING
      id, name, tld_id as "tldId", full_domain as "fullDomain", owner_id as "ownerId",
      status, registered_at as "registeredAt", expires_at as "expiresAt",
      auto_renew as "autoRenew", metadata, created_at as "createdAt", updated_at as "updatedAt"
  `;

  if (domain === undefined) {
    throw new Error('Domain not found');
  }

  return domain;
}

// =============================================================================
// Domain Management
// =============================================================================

export async function getDomainById(id: string): Promise<JubileeDomain | null> {
  const db = getDatabase();

  const [domain] = await db<JubileeDomain[]>`
    SELECT
      id, name, tld_id as "tldId", full_domain as "fullDomain", owner_id as "ownerId",
      status, registered_at as "registeredAt", expires_at as "expiresAt",
      auto_renew as "autoRenew", metadata, created_at as "createdAt", updated_at as "updatedAt"
    FROM jubilee_domains
    WHERE id = ${id}
  `;

  return domain ?? null;
}

export async function getDomainByFullName(fullDomain: string): Promise<JubileeDomain | null> {
  const db = getDatabase();

  const [domain] = await db<JubileeDomain[]>`
    SELECT
      id, name, tld_id as "tldId", full_domain as "fullDomain", owner_id as "ownerId",
      status, registered_at as "registeredAt", expires_at as "expiresAt",
      auto_renew as "autoRenew", metadata, created_at as "createdAt", updated_at as "updatedAt"
    FROM jubilee_domains
    WHERE full_domain = ${fullDomain.toLowerCase()}
  `;

  return domain ?? null;
}

export async function getUserDomains(userId: string): Promise<JubileeDomain[]> {
  const db = getDatabase();

  return db<JubileeDomain[]>`
    SELECT
      d.id, d.name, d.tld_id as "tldId", d.full_domain as "fullDomain", d.owner_id as "ownerId",
      d.status, d.registered_at as "registeredAt", d.expires_at as "expiresAt",
      d.auto_renew as "autoRenew", d.metadata, d.created_at as "createdAt", d.updated_at as "updatedAt"
    FROM jubilee_domains d
    WHERE d.owner_id = ${userId}
      AND d.status NOT IN ('deleted')
    ORDER BY d.created_at DESC
  `;
}

export async function renewDomain(domainId: string, years: number = 1): Promise<JubileeDomain> {
  const db = getDatabase();

  const domain = await getDomainById(domainId);
  if (domain === null) {
    throw new Error('Domain not found');
  }

  const currentExpiry = domain.expiresAt ?? new Date();
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
  const newExpiresAt = new Date(baseDate);
  newExpiresAt.setFullYear(newExpiresAt.getFullYear() + years);

  const [updated] = await db<JubileeDomain[]>`
    UPDATE jubilee_domains
    SET
      status = 'active',
      expires_at = ${newExpiresAt},
      updated_at = NOW()
    WHERE id = ${domainId}
    RETURNING
      id, name, tld_id as "tldId", full_domain as "fullDomain", owner_id as "ownerId",
      status, registered_at as "registeredAt", expires_at as "expiresAt",
      auto_renew as "autoRenew", metadata, created_at as "createdAt", updated_at as "updatedAt"
  `;

  if (updated === undefined) {
    throw new Error('Failed to renew domain');
  }

  return updated;
}

export async function updateDomainSettings(
  domainId: string,
  updates: { autoRenew?: boolean; metadata?: DomainMetadata }
): Promise<JubileeDomain> {
  const db = getDatabase();

  const [domain] = await db<JubileeDomain[]>`
    UPDATE jubilee_domains
    SET
      auto_renew = COALESCE(${updates.autoRenew ?? null}, auto_renew),
      metadata = COALESCE(${updates.metadata !== undefined ? JSON.stringify(updates.metadata) : null}::jsonb, metadata),
      updated_at = NOW()
    WHERE id = ${domainId}
    RETURNING
      id, name, tld_id as "tldId", full_domain as "fullDomain", owner_id as "ownerId",
      status, registered_at as "registeredAt", expires_at as "expiresAt",
      auto_renew as "autoRenew", metadata, created_at as "createdAt", updated_at as "updatedAt"
  `;

  if (domain === undefined) {
    throw new Error('Domain not found');
  }

  return domain;
}
