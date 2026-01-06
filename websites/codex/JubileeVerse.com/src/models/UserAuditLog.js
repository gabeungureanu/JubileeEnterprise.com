/**
 * UserAuditLog Model
 * Tracks access to sensitive user data for compliance and accountability
 *
 * Key concepts:
 * - Records all access to sensitive data (demographics, analytics, alerts)
 * - Immutable log (no updates or deletes via application)
 * - Tracks accessor, target, action, and context
 * - Supports compliance reviews and misuse detection
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

// Valid audit action types
const AUDIT_ACTIONS = {
  VIEW_USER_PROFILE: 'view_user_profile',
  VIEW_USER_DEMOGRAPHICS: 'view_user_demographics',
  VIEW_USER_ANALYTICS: 'view_user_analytics',
  VIEW_ASSOCIATED_ACCOUNTS: 'view_associated_accounts',
  VIEW_PLAN_MEMBERS: 'view_plan_members',
  VIEW_SAFETY_FLAGS: 'view_safety_flags',
  VIEW_ADMIN_ALERTS: 'view_admin_alerts',
  EXPORT_USER_DATA: 'export_user_data',
  MODIFY_USER_DATA: 'modify_user_data',
  ACCESS_CONVERSATION_CONTENT: 'access_conversation_content',
  QUERY_SENSITIVE_REPORT: 'query_sensitive_report'
};

// Valid target types
const TARGET_TYPES = {
  USER: 'user',
  COMMUNITY: 'community',
  PLAN: 'plan',
  CONVERSATION: 'conversation',
  SAFETY_FLAG: 'safety_flag',
  ADMIN_ALERT: 'admin_alert',
  ANALYTICS: 'analytics',
  REPORT: 'report'
};

/**
 * Convert database row to audit log object
 */
function rowToAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    accessorUserId: row.accessor_user_id,
    accessorRole: row.accessor_role,
    accessorIpAddress: row.accessor_ip_address,
    accessorUserAgent: row.accessor_user_agent,
    actionType: row.action_type,
    targetType: row.target_type,
    targetId: row.target_id,
    targetUserId: row.target_user_id,
    targetCommunityId: row.target_community_id,
    accessContext: row.access_context,
    queryParameters: row.query_parameters,
    resultCount: row.result_count,
    accessGranted: row.access_granted,
    denialReason: row.denial_reason,
    createdAt: row.created_at,
    // Joined fields
    accessorEmail: row.accessor_email,
    accessorDisplayName: row.accessor_display_name,
    targetEmail: row.target_email,
    targetDisplayName: row.target_display_name
  };
}

/**
 * Log an access event
 */
async function logAccess(logData) {
  const id = uuidv4();

  const result = await database.query(`
    INSERT INTO sensitive_data_audit_log (
      id, accessor_user_id, accessor_role, accessor_ip_address, accessor_user_agent,
      action_type, target_type, target_id, target_user_id, target_community_id,
      access_context, query_parameters, result_count, access_granted, denial_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `, [
    id,
    logData.accessorUserId,
    logData.accessorRole || 'unknown',
    logData.accessorIpAddress || null,
    logData.accessorUserAgent || null,
    logData.actionType,
    logData.targetType,
    logData.targetId || null,
    logData.targetUserId || null,
    logData.targetCommunityId || null,
    logData.accessContext || null,
    logData.queryParameters ? JSON.stringify(logData.queryParameters) : null,
    logData.resultCount || null,
    logData.accessGranted !== false, // Default to true
    logData.denialReason || null
  ]);

  return rowToAuditLog(result.rows[0]);
}

/**
 * Log access granted
 */
async function logGrantedAccess(accessorUserId, accessorRole, actionType, targetType, options = {}) {
  return logAccess({
    accessorUserId,
    accessorRole,
    actionType,
    targetType,
    accessGranted: true,
    ...options
  });
}

/**
 * Log access denied
 */
async function logDeniedAccess(accessorUserId, accessorRole, actionType, targetType, denialReason, options = {}) {
  return logAccess({
    accessorUserId,
    accessorRole,
    actionType,
    targetType,
    accessGranted: false,
    denialReason,
    ...options
  });
}

/**
 * Find audit logs by accessor
 */
async function findByAccessor(accessorUserId, options = {}) {
  const { limit = 100, offset = 0, startDate = null, endDate = null, actionType = null } = options;

  let query = `
    SELECT sal.*,
           tu.email as target_email, tu.display_name as target_display_name
    FROM sensitive_data_audit_log sal
    LEFT JOIN users tu ON sal.target_user_id = tu.id
    WHERE sal.accessor_user_id = $1
  `;
  const params = [accessorUserId];
  let paramIndex = 2;

  if (startDate) {
    query += ` AND sal.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND sal.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  if (actionType) {
    query += ` AND sal.action_type = $${paramIndex++}`;
    params.push(actionType);
  }

  query += ` ORDER BY sal.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToAuditLog);
}

/**
 * Find audit logs for a target user
 */
async function findByTargetUser(targetUserId, options = {}) {
  const { limit = 100, offset = 0, startDate = null, endDate = null } = options;

  let query = `
    SELECT sal.*,
           au.email as accessor_email, au.display_name as accessor_display_name
    FROM sensitive_data_audit_log sal
    JOIN users au ON sal.accessor_user_id = au.id
    WHERE sal.target_user_id = $1
  `;
  const params = [targetUserId];
  let paramIndex = 2;

  if (startDate) {
    query += ` AND sal.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND sal.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  query += ` ORDER BY sal.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToAuditLog);
}

/**
 * Find denied access attempts
 */
async function findDeniedAccess(options = {}) {
  const { limit = 100, offset = 0, startDate = null, endDate = null } = options;

  let query = `
    SELECT sal.*,
           au.email as accessor_email, au.display_name as accessor_display_name,
           tu.email as target_email, tu.display_name as target_display_name
    FROM sensitive_data_audit_log sal
    JOIN users au ON sal.accessor_user_id = au.id
    LEFT JOIN users tu ON sal.target_user_id = tu.id
    WHERE sal.access_granted = FALSE
  `;
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND sal.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND sal.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  query += ` ORDER BY sal.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToAuditLog);
}

/**
 * Find audit logs by action type
 */
async function findByActionType(actionType, options = {}) {
  const { limit = 100, offset = 0, startDate = null, endDate = null } = options;

  let query = `
    SELECT sal.*,
           au.email as accessor_email, au.display_name as accessor_display_name,
           tu.email as target_email, tu.display_name as target_display_name
    FROM sensitive_data_audit_log sal
    JOIN users au ON sal.accessor_user_id = au.id
    LEFT JOIN users tu ON sal.target_user_id = tu.id
    WHERE sal.action_type = $1
  `;
  const params = [actionType];
  let paramIndex = 2;

  if (startDate) {
    query += ` AND sal.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND sal.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  query += ` ORDER BY sal.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToAuditLog);
}

/**
 * Get audit statistics
 */
async function getStatistics(options = {}) {
  const { startDate = null, endDate = null } = options;

  let dateFilter = '';
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    dateFilter += ` AND created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += ` AND created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  const result = await database.query(`
    SELECT
      action_type,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE access_granted = TRUE) as granted_count,
      COUNT(*) FILTER (WHERE access_granted = FALSE) as denied_count,
      COUNT(DISTINCT accessor_user_id) as unique_accessors,
      COUNT(DISTINCT target_user_id) as unique_targets
    FROM sensitive_data_audit_log
    WHERE 1=1 ${dateFilter}
    GROUP BY action_type
    ORDER BY total_count DESC
  `, params);

  return result.rows;
}

/**
 * Get accessor statistics (who is accessing what)
 */
async function getAccessorStats(options = {}) {
  const { startDate = null, endDate = null, limit = 20 } = options;

  let dateFilter = '';
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    dateFilter += ` AND sal.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += ` AND sal.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  params.push(limit);

  const result = await database.query(`
    SELECT
      sal.accessor_user_id,
      sal.accessor_role,
      u.email as accessor_email,
      u.display_name as accessor_name,
      COUNT(*) as access_count,
      COUNT(*) FILTER (WHERE sal.access_granted = FALSE) as denied_count,
      COUNT(DISTINCT sal.target_user_id) as unique_targets_accessed,
      MAX(sal.created_at) as last_access
    FROM sensitive_data_audit_log sal
    JOIN users u ON sal.accessor_user_id = u.id
    WHERE 1=1 ${dateFilter}
    GROUP BY sal.accessor_user_id, sal.accessor_role, u.email, u.display_name
    ORDER BY access_count DESC
    LIMIT $${paramIndex}
  `, params);

  return result.rows;
}

/**
 * Detect unusual access patterns
 */
async function detectUnusualPatterns(options = {}) {
  const { hoursBack = 24, accessThreshold = 50 } = options;

  const result = await database.query(`
    SELECT
      accessor_user_id,
      accessor_role,
      COUNT(*) as access_count,
      COUNT(DISTINCT target_user_id) as unique_targets,
      COUNT(*) FILTER (WHERE access_granted = FALSE) as denied_count,
      array_agg(DISTINCT action_type) as action_types
    FROM sensitive_data_audit_log
    WHERE created_at >= NOW() - INTERVAL '${hoursBack} hours'
    GROUP BY accessor_user_id, accessor_role
    HAVING COUNT(*) >= $1
       OR COUNT(*) FILTER (WHERE access_granted = FALSE) >= 5
       OR COUNT(DISTINCT target_user_id) >= 20
    ORDER BY access_count DESC
  `, [accessThreshold]);

  return result.rows;
}

/**
 * Log terms acceptance for compliance
 */
async function logTermsAcceptance(userId, termsType, termsVersion, options = {}) {
  const result = await database.query(`
    INSERT INTO terms_acceptance_log (
      user_id, terms_type, terms_version, terms_text_hash,
      ip_address, user_agent, age_attestation_text, min_age_requirement
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    userId,
    termsType,
    termsVersion,
    options.termsTextHash || null,
    options.ipAddress || null,
    options.userAgent || null,
    options.ageAttestationText || null,
    options.minAgeRequirement || 13
  ]);

  return result.rows[0];
}

/**
 * Get terms acceptance history for user
 */
async function getTermsHistory(userId) {
  const result = await database.query(`
    SELECT * FROM terms_acceptance_log
    WHERE user_id = $1
    ORDER BY accepted_at DESC
  `, [userId]);

  return result.rows;
}

module.exports = {
  // Constants
  AUDIT_ACTIONS,
  TARGET_TYPES,

  // Logging
  logAccess,
  logGrantedAccess,
  logDeniedAccess,

  // Queries
  findByAccessor,
  findByTargetUser,
  findDeniedAccess,
  findByActionType,

  // Analytics
  getStatistics,
  getAccessorStats,
  detectUnusualPatterns,

  // Terms compliance
  logTermsAcceptance,
  getTermsHistory
};
