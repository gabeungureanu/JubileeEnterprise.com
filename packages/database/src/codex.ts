/**
 * Codex Database Functions
 *
 * Database operations for the Codex (Identity & SSO) database.
 * Includes user management, roles, permissions, personas, and email preferences.
 */

import { getCodexPool } from './index';

// ============================================================================
// USER FUNCTIONS
// ============================================================================

export async function getUserById(id: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function getUserByEmail(email: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

export async function createUser(data: {
  email: string;
  passwordHash?: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  const pool = getCodexPool();
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.email.toLowerCase(), data.passwordHash, data.displayName, data.avatarUrl]
  );
  return result.rows[0];
}

// ============================================================================
// ROLE & PERMISSION FUNCTIONS
// ============================================================================

export async function getUserRoles(userId: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    `SELECT r.* FROM roles r
     JOIN user_roles ur ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return result.rows;
}

export async function getUserPermissions(userId: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    `SELECT DISTINCT p.* FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return result.rows;
}

export async function userHasPermission(userId: string, permissionName: string): Promise<boolean> {
  const pool = getCodexPool();
  const result = await pool.query(
    `SELECT 1 FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1 AND p.name = $2
     LIMIT 1`,
    [userId, permissionName]
  );
  return result.rows.length > 0;
}

export async function getRoles() {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM roles ORDER BY hierarchy_level');
  return result.rows;
}

export async function assignRoleToUser(
  userId: string,
  roleId: string,
  assignedBy?: string,
  resourceScope?: string
) {
  const pool = getCodexPool();
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id, assigned_by, resource_scope)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId, assignedBy, resourceScope]
  );
}

// ============================================================================
// PERSONA FUNCTIONS
// ============================================================================

export async function getPersonas(options: {
  categoryId?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  limit: number;
  offset: number;
}) {
  const pool = getCodexPool();
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.categoryId) {
    conditions.push(`category_id = $${paramIndex++}`);
    params.push(options.categoryId);
  }
  if (options.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    params.push(options.isActive);
  }
  if (options.isFeatured !== undefined) {
    conditions.push(`is_featured = $${paramIndex++}`);
    params.push(options.isFeatured);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(options.limit, options.offset);
  const result = await pool.query(
    `SELECT * FROM personas ${whereClause}
     ORDER BY display_order, name
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );
  return result.rows;
}

export async function getPersonaById(id: string) {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM personas WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getPersonaBySlug(slug: string) {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM personas WHERE slug = $1', [slug]);
  return result.rows[0] || null;
}

export async function createPersona(data: any) {
  const pool = getCodexPool();
  const result = await pool.query(
    `INSERT INTO personas (slug, name, category_id, system_prompt, personality_traits)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.slug, data.name, data.categoryId, data.systemPrompt, data.personalityTraits]
  );
  return result.rows[0];
}

export async function getPersonaCategories() {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM persona_categories ORDER BY name');
  return result.rows;
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export async function getFeatureFlags() {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM feature_flags ORDER BY name');
  return result.rows;
}

export async function getFeatureFlag(name: string) {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM feature_flags WHERE name = $1', [name]);
  return result.rows[0] || null;
}

export async function isFeatureEnabled(
  name: string,
  context?: { userId?: string; role?: string; environment?: string }
): Promise<boolean> {
  const pool = getCodexPool();
  const result = await pool.query('SELECT is_enabled, context_rules FROM feature_flags WHERE name = $1', [name]);

  if (!result.rows[0]) return false;

  const { is_enabled, context_rules } = result.rows[0];
  if (!is_enabled) return false;
  if (!context_rules || !context) return is_enabled;

  // TODO: Implement context rule evaluation
  return is_enabled;
}

// ============================================================================
// PLATFORM SETTINGS
// ============================================================================

export async function getPublicPlatformSettings() {
  const pool = getCodexPool();
  const result = await pool.query(
    'SELECT key, value FROM platform_settings WHERE is_public = true'
  );
  return result.rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as Record<string, any>);
}

export async function getPlatformSetting(key: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    'SELECT value FROM platform_settings WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value ?? null;
}

// ============================================================================
// BIBLE REFERENCES
// ============================================================================

export async function getBibleBooks() {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM bible_books ORDER BY book_order');
  return result.rows;
}

export async function getBibleBookByCode(code: string) {
  const pool = getCodexPool();
  const result = await pool.query('SELECT * FROM bible_books WHERE code = $1', [code.toUpperCase()]);
  return result.rows[0] || null;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function createAuditLog(data: {
  eventType: string;
  eventCategory: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  outcome: string;
  metadata?: Record<string, any>;
}) {
  const pool = getCodexPool();
  await pool.query(
    `INSERT INTO audit_logs (event_type, event_category, user_id, resource_type, resource_id, outcome, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      data.eventType,
      data.eventCategory,
      data.userId,
      data.resourceType,
      data.resourceId,
      data.outcome,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );
}

export async function getAuditLogs(options: {
  userId?: string;
  eventType?: string;
  eventCategory?: string;
  limit: number;
  offset: number;
}) {
  const pool = getCodexPool();
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(options.userId);
  }
  if (options.eventType) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(options.eventType);
  }
  if (options.eventCategory) {
    conditions.push(`event_category = $${paramIndex++}`);
    params.push(options.eventCategory);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(options.limit, options.offset);
  const result = await pool.query(
    `SELECT * FROM audit_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );
  return result.rows;
}

// ============================================================================
// USER CONTACTS (JubileeOutlook People Module)
// ============================================================================

/**
 * Get contacts for a user with pagination
 */
export async function getContacts(userId: string, page: number = 1, pageSize: number = 100) {
  const pool = getCodexPool();
  const offset = (page - 1) * pageSize;

  const countResult = await pool.query(
    'SELECT COUNT(*) FROM user_contacts WHERE user_id = $1 AND is_deleted = FALSE',
    [userId]
  );
  const totalCount = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT * FROM user_contacts
     WHERE user_id = $1 AND is_deleted = FALSE
     ORDER BY is_favorite DESC, display_name ASC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );

  return { contacts: result.rows, totalCount, page, pageSize };
}

/**
 * Get a single contact by ID
 */
export async function getContactById(contactId: string, includeDeleted: boolean = false) {
  const pool = getCodexPool();
  const query = includeDeleted
    ? 'SELECT * FROM user_contacts WHERE id = $1'
    : 'SELECT * FROM user_contacts WHERE id = $1 AND is_deleted = FALSE';
  const result = await pool.query(query, [contactId]);
  return result.rows[0] || null;
}

/**
 * Create a new contact
 */
export async function createContact(data: {
  userId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  middleName?: string;
  suffix?: string;
  nickname?: string;
  emailAddresses?: string[];
  phoneNumbers?: string[];
  mobilePhone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  office?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  photoUrl?: string;
  birthday?: string;
  anniversary?: string;
  spouse?: string;
  website?: string;
  isFavorite?: boolean;
  category?: string;
}) {
  const pool = getCodexPool();
  const result = await pool.query(
    `INSERT INTO user_contacts (
      user_id, display_name, first_name, last_name, title, middle_name, suffix, nickname,
      email_addresses, phone_numbers, mobile_phone, company, job_title, department, office,
      address, city, state, postal_code, country, notes, photo_url,
      birthday, anniversary, spouse, website, is_favorite, category
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22,
      $23, $24, $25, $26, $27, $28
    ) RETURNING *`,
    [
      data.userId, data.displayName, data.firstName, data.lastName,
      data.title, data.middleName, data.suffix, data.nickname,
      JSON.stringify(data.emailAddresses || []),
      JSON.stringify(data.phoneNumbers || []),
      data.mobilePhone, data.company, data.jobTitle, data.department, data.office,
      data.address, data.city, data.state, data.postalCode, data.country,
      data.notes, data.photoUrl,
      data.birthday || null, data.anniversary || null,
      data.spouse, data.website, data.isFavorite || false, data.category,
    ]
  );
  return result.rows[0];
}

/**
 * Update an existing contact
 */
export async function updateContact(contactId: string, data: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  middleName?: string;
  suffix?: string;
  nickname?: string;
  emailAddresses?: string[];
  phoneNumbers?: string[];
  mobilePhone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  office?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  photoUrl?: string;
  birthday?: string;
  anniversary?: string;
  spouse?: string;
  website?: string;
  isFavorite?: boolean;
  category?: string;
}) {
  const pool = getCodexPool();
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  const fieldMap: Record<string, string> = {
    displayName: 'display_name',
    firstName: 'first_name',
    lastName: 'last_name',
    title: 'title',
    middleName: 'middle_name',
    suffix: 'suffix',
    nickname: 'nickname',
    emailAddresses: 'email_addresses',
    phoneNumbers: 'phone_numbers',
    mobilePhone: 'mobile_phone',
    company: 'company',
    jobTitle: 'job_title',
    department: 'department',
    office: 'office',
    address: 'address',
    city: 'city',
    state: 'state',
    postalCode: 'postal_code',
    country: 'country',
    notes: 'notes',
    photoUrl: 'photo_url',
    birthday: 'birthday',
    anniversary: 'anniversary',
    spouse: 'spouse',
    website: 'website',
    isFavorite: 'is_favorite',
    category: 'category',
  };

  const arrayFields = new Set(['emailAddresses', 'phoneNumbers']);

  for (const [key, column] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      if (arrayFields.has(key)) {
        fields.push(`${column} = $${paramIndex++}::jsonb`);
        params.push(JSON.stringify((data as any)[key]));
      } else {
        fields.push(`${column} = $${paramIndex++}`);
        params.push((data as any)[key]);
      }
    }
  }

  if (fields.length === 0) {
    return getContactById(contactId);
  }

  params.push(contactId);
  const result = await pool.query(
    `UPDATE user_contacts SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

/**
 * Hard delete a contact
 */
export async function deleteContact(contactId: string): Promise<boolean> {
  const pool = getCodexPool();
  const result = await pool.query(
    'DELETE FROM user_contacts WHERE id = $1',
    [contactId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Soft delete a contact
 */
export async function softDeleteContact(contactId: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    `UPDATE user_contacts SET is_deleted = TRUE, deleted_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [contactId]
  );
  return result.rows[0] || null;
}

/**
 * Restore a soft-deleted contact
 */
export async function restoreContact(contactId: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    `UPDATE user_contacts SET is_deleted = FALSE, deleted_at = NULL
     WHERE id = $1
     RETURNING *`,
    [contactId]
  );
  return result.rows[0] || null;
}

/**
 * Toggle favorite status for a contact
 */
export async function toggleContactFavorite(contactId: string, isFavorite: boolean) {
  const pool = getCodexPool();
  const result = await pool.query(
    `UPDATE user_contacts SET is_favorite = $1
     WHERE id = $2
     RETURNING *`,
    [isFavorite, contactId]
  );
  return result.rows[0] || null;
}

/**
 * Search contacts by name, email, company, etc.
 */
export async function searchContacts(userId: string, query: string, page: number = 1, pageSize: number = 50) {
  const pool = getCodexPool();
  const offset = (page - 1) * pageSize;
  const searchPattern = `%${query}%`;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM user_contacts
     WHERE user_id = $1 AND is_deleted = FALSE
     AND (
       display_name ILIKE $2
       OR first_name ILIKE $2
       OR last_name ILIKE $2
       OR company ILIKE $2
       OR job_title ILIKE $2
       OR notes ILIKE $2
       OR email_addresses::text ILIKE $2
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(email_addresses) e WHERE e ILIKE $2)
     )`,
    [userId, searchPattern]
  );
  const totalCount = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT * FROM user_contacts
     WHERE user_id = $1 AND is_deleted = FALSE
     AND (
       display_name ILIKE $2
       OR first_name ILIKE $2
       OR last_name ILIKE $2
       OR company ILIKE $2
       OR job_title ILIKE $2
       OR notes ILIKE $2
       OR email_addresses::text ILIKE $2
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(email_addresses) e WHERE e ILIKE $2)
     )
     ORDER BY is_favorite DESC, display_name ASC
     LIMIT $3 OFFSET $4`,
    [userId, searchPattern, pageSize, offset]
  );

  return { contacts: result.rows, totalCount, page, pageSize };
}

// ============================================================================
// USER EMAIL PREFERENCES (JubileeOutlook)
// ============================================================================

/**
 * Get all blocked email senders for a user
 */
export async function getBlockedSenders(userId: string): Promise<string[]> {
  const pool = getCodexPool();
  const result = await pool.query(
    'SELECT email_address FROM user_blocked_senders WHERE user_id = $1 ORDER BY blocked_at DESC',
    [userId]
  );
  return result.rows.map(row => row.email_address);
}

/**
 * Add a blocked email sender for a user
 */
export async function addBlockedSender(userId: string, emailAddress: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    `INSERT INTO user_blocked_senders (user_id, email_address)
     VALUES ($1, $2)
     RETURNING id, email_address, blocked_at`,
    [userId, emailAddress.toLowerCase().trim()]
  );
  return result.rows[0];
}

/**
 * Remove a blocked email sender for a user
 */
export async function removeBlockedSender(userId: string, emailAddress: string): Promise<boolean> {
  const pool = getCodexPool();
  const result = await pool.query(
    'DELETE FROM user_blocked_senders WHERE user_id = $1 AND email_address = $2',
    [userId, emailAddress.toLowerCase().trim()]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get all ignored conversation IDs for a user
 */
export async function getIgnoredConversations(userId: string): Promise<string[]> {
  const pool = getCodexPool();
  const result = await pool.query(
    'SELECT conversation_id FROM user_ignored_conversations WHERE user_id = $1 ORDER BY ignored_at DESC',
    [userId]
  );
  return result.rows.map(row => row.conversation_id);
}

/**
 * Add an ignored conversation for a user
 */
export async function addIgnoredConversation(userId: string, conversationId: string) {
  const pool = getCodexPool();
  const result = await pool.query(
    `INSERT INTO user_ignored_conversations (user_id, conversation_id)
     VALUES ($1, $2)
     RETURNING id, conversation_id, ignored_at`,
    [userId, conversationId]
  );
  return result.rows[0];
}

/**
 * Remove an ignored conversation for a user
 */
export async function removeIgnoredConversation(userId: string, conversationId: string): Promise<boolean> {
  const pool = getCodexPool();
  const result = await pool.query(
    'DELETE FROM user_ignored_conversations WHERE user_id = $1 AND conversation_id = $2',
    [userId, conversationId]
  );
  return (result.rowCount ?? 0) > 0;
}
