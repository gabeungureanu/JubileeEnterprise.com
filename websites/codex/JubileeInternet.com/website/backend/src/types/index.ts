// =============================================================================
// Worldwide Bible Web Domain Registry Types
// =============================================================================

export interface JubileeTLD {
  id: string;
  tld: string;
  displayName: string;
  description: string;
  isRestricted: boolean;
  requiresVerification: boolean;
  eligibilityRules: string | null;
  pricePerYear: number; // in cents
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JubileeDomain {
  id: string;
  name: string; // e.g., "myministry"
  tldId: string;
  fullDomain: string; // e.g., "myministry.church"
  ownerId: string; // Jubilee user ID
  status: DomainStatus;
  registeredAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
  metadata: DomainMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type DomainStatus =
  | 'active'
  | 'expired'
  | 'suspended'
  | 'pending_verification'
  | 'pending_payment'
  | 'reserved'
  | 'deleted';

export interface DomainMetadata {
  description?: string;
  category?: string;
  linkedServices?: string[];
  customData?: Record<string, unknown>;
}

export interface ReservedDomain {
  id: string;
  name: string;
  tldId: string | null; // null = reserved across all TLDs
  fullDomain: string | null;
  reason: ReservationReason;
  reservedBy: string | null;
  reservedAt: Date;
}

export type ReservationReason =
  | 'system'
  | 'offensive'
  | 'trademark'
  | 'official'
  | 'future_use';

export interface DomainRegistration {
  id: string;
  domainId: string;
  userId: string;
  transactionId: string | null;
  amount: number;
  currency: string;
  years: number;
  registrationType: 'new' | 'renewal' | 'transfer';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt: Date | null;
}

export interface DomainSearchResult {
  name: string;
  tld: string;
  fullDomain: string;
  available: boolean;
  status: 'available' | 'registered' | 'reserved' | 'restricted';
  pricePerYear: number;
  requiresVerification: boolean;
}

export interface DomainSuggestion {
  fullDomain: string;
  name: string;
  tld: string;
  pricePerYear: number;
  reason: 'alternative_tld' | 'variation' | 'synonym';
}

export interface UserDomainSummary {
  totalDomains: number;
  activeDomains: number;
  expiringSoon: number; // within 30 days
  domains: JubileeDomain[];
}

// API Request/Response Types
export interface DomainAvailabilityRequest {
  name: string;
  tlds?: string[]; // specific TLDs to check, or all if empty
}

export interface DomainAvailabilityResponse {
  query: string;
  results: DomainSearchResult[];
  suggestions: DomainSuggestion[];
}

export interface DomainRegistrationRequest {
  name: string;
  tld: string;
  years?: number; // default 1
  autoRenew?: boolean;
}

export interface DomainRegistrationResponse {
  success: boolean;
  domain?: JubileeDomain;
  paymentRequired?: boolean;
  paymentUrl?: string;
  error?: string;
}

// Session/Auth Types (from SSO)
export interface JubileeUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
}

export interface AuthenticatedContext {
  user: JubileeUser;
  accessToken: string;
  scopes: string[];
}
