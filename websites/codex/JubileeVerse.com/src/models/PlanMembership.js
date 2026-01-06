/**
 * PlanMembership Model
 * Manages user membership in shared token pools
 *
 * Key concepts:
 * - Primary user owns the plan and can invite others
 * - Associated users share tokens but have independent accounts
 * - Age verification required before activation
 * - Terms acceptance tracked for compliance
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to membership object
 */
function rowToMembership(row) {
  if (!row) return null;
  return {
    id: row.id,
    poolId: row.pool_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    ageVerified: row.age_verified,
    ageVerifiedAt: row.age_verified_at,
    ageVerifiedBy: row.age_verified_by,
    ageVerificationMethod: row.age_verification_method,
    termsAccepted: row.terms_accepted,
    termsAcceptedAt: row.terms_accepted_at,
    termsVersion: row.terms_version,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    invitationAcceptedAt: row.invitation_accepted_at,
    tokensUsedThisPeriod: row.tokens_used_this_period,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    userEmail: row.user_email,
    userDisplayName: row.user_display_name,
    poolPlanType: row.pool_plan_type,
    inviterName: row.inviter_name
  };
}

/**
 * Create a new plan membership
 */
async function create(membershipData) {
  const id = uuidv4();

  const result = await database.query(`
    INSERT INTO plan_memberships (
      id, pool_id, user_id, role, status,
      age_verified, age_verified_at, age_verified_by, age_verification_method,
      terms_accepted, terms_accepted_at, terms_version,
      invited_by, invited_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `, [
    id,
    membershipData.poolId,
    membershipData.userId,
    membershipData.role || 'associated',
    membershipData.status || 'pending',
    membershipData.ageVerified || false,
    membershipData.ageVerifiedAt || null,
    membershipData.ageVerifiedBy || null,
    membershipData.ageVerificationMethod || null,
    membershipData.termsAccepted || false,
    membershipData.termsAcceptedAt || null,
    membershipData.termsVersion || null,
    membershipData.invitedBy || null,
    membershipData.invitedAt || new Date()
  ]);

  return rowToMembership(result.rows[0]);
}

/**
 * Find membership by ID
 */
async function findById(membershipId) {
  const result = await database.query(`
    SELECT pm.*, u.email as user_email, u.display_name as user_display_name,
           stp.plan_type as pool_plan_type, inv.display_name as inviter_name
    FROM plan_memberships pm
    JOIN users u ON pm.user_id = u.id
    JOIN shared_token_pools stp ON pm.pool_id = stp.id
    LEFT JOIN users inv ON pm.invited_by = inv.id
    WHERE pm.id = $1
  `, [membershipId]);

  return rowToMembership(result.rows[0]);
}

/**
 * Find membership by pool and user
 */
async function findByPoolAndUser(poolId, userId) {
  const result = await database.query(`
    SELECT pm.*, u.email as user_email, u.display_name as user_display_name,
           stp.plan_type as pool_plan_type
    FROM plan_memberships pm
    JOIN users u ON pm.user_id = u.id
    JOIN shared_token_pools stp ON pm.pool_id = stp.id
    WHERE pm.pool_id = $1 AND pm.user_id = $2
  `, [poolId, userId]);

  return rowToMembership(result.rows[0]);
}

/**
 * Find all memberships for a user
 */
async function findByUserId(userId) {
  const result = await database.query(`
    SELECT pm.*, u.email as user_email, u.display_name as user_display_name,
           stp.plan_type as pool_plan_type
    FROM plan_memberships pm
    JOIN users u ON pm.user_id = u.id
    JOIN shared_token_pools stp ON pm.pool_id = stp.id
    WHERE pm.user_id = $1
    ORDER BY pm.created_at DESC
  `, [userId]);

  return result.rows.map(rowToMembership);
}

/**
 * Find active membership for a user
 */
async function findActiveByUserId(userId) {
  const result = await database.query(`
    SELECT pm.*, u.email as user_email, u.display_name as user_display_name,
           stp.plan_type as pool_plan_type
    FROM plan_memberships pm
    JOIN users u ON pm.user_id = u.id
    JOIN shared_token_pools stp ON pm.pool_id = stp.id
    WHERE pm.user_id = $1 AND pm.status = 'active' AND stp.is_active = TRUE
    ORDER BY pm.role = 'primary' DESC, pm.created_at DESC
    LIMIT 1
  `, [userId]);

  return rowToMembership(result.rows[0]);
}

/**
 * Find all members of a pool
 */
async function findByPoolId(poolId, options = {}) {
  const { includeInactive = false, limit = 100, offset = 0 } = options;

  let query = `
    SELECT pm.*, u.email as user_email, u.display_name as user_display_name,
           stp.plan_type as pool_plan_type, inv.display_name as inviter_name
    FROM plan_memberships pm
    JOIN users u ON pm.user_id = u.id
    JOIN shared_token_pools stp ON pm.pool_id = stp.id
    LEFT JOIN users inv ON pm.invited_by = inv.id
    WHERE pm.pool_id = $1
  `;

  if (!includeInactive) {
    query += ` AND pm.status IN ('active', 'pending')`;
  }

  query += ` ORDER BY pm.role = 'primary' DESC, pm.created_at ASC LIMIT $2 OFFSET $3`;

  const result = await database.query(query, [poolId, limit, offset]);
  return result.rows.map(rowToMembership);
}

/**
 * Count members in a pool
 */
async function countByPoolId(poolId, statusFilter = null) {
  let query = 'SELECT COUNT(*) as count FROM plan_memberships WHERE pool_id = $1';
  const params = [poolId];

  if (statusFilter) {
    if (Array.isArray(statusFilter)) {
      query += ' AND status = ANY($2)';
      params.push(statusFilter);
    } else {
      query += ' AND status = $2';
      params.push(statusFilter);
    }
  }

  const result = await database.query(query, params);
  return parseInt(result.rows[0].count);
}

/**
 * Verify age for a membership
 */
async function verifyAge(membershipId, verifiedBy, method = 'subscriber_attestation') {
  const result = await database.query(`
    UPDATE plan_memberships
    SET age_verified = TRUE,
        age_verified_at = NOW(),
        age_verified_by = $2,
        age_verification_method = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [membershipId, verifiedBy, method]);

  return rowToMembership(result.rows[0]);
}

/**
 * Accept terms for a membership
 */
async function acceptTerms(membershipId, termsVersion) {
  const result = await database.query(`
    UPDATE plan_memberships
    SET terms_accepted = TRUE,
        terms_accepted_at = NOW(),
        terms_version = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [membershipId, termsVersion]);

  return rowToMembership(result.rows[0]);
}

/**
 * Activate a membership (requires age verification for associated users)
 */
async function activate(membershipId) {
  const result = await database.query(`
    UPDATE plan_memberships
    SET status = 'active',
        invitation_accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [membershipId]);

  return rowToMembership(result.rows[0]);
}

/**
 * Suspend a membership
 */
async function suspend(membershipId) {
  const result = await database.query(`
    UPDATE plan_memberships
    SET status = 'suspended',
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [membershipId]);

  return rowToMembership(result.rows[0]);
}

/**
 * Remove a membership
 */
async function remove(membershipId) {
  const result = await database.query(`
    UPDATE plan_memberships
    SET status = 'removed',
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [membershipId]);

  return rowToMembership(result.rows[0]);
}

/**
 * Update last active timestamp
 */
async function updateLastActive(membershipId) {
  await database.query(`
    UPDATE plan_memberships
    SET last_active_at = NOW(), updated_at = NOW()
    WHERE id = $1
  `, [membershipId]);
}

/**
 * Get pool capacity info
 */
async function getPoolCapacity(poolId) {
  const result = await database.query(`
    SELECT
      stp.plan_type,
      ptl.max_users,
      ptl.max_associated_users,
      COUNT(pm.id) FILTER (WHERE pm.status IN ('active', 'pending')) as current_count,
      COUNT(pm.id) FILTER (WHERE pm.status = 'active') as active_count,
      COUNT(pm.id) FILTER (WHERE pm.status = 'pending') as pending_count
    FROM shared_token_pools stp
    JOIN plan_type_limits ptl ON stp.plan_type = ptl.plan_type
    LEFT JOIN plan_memberships pm ON stp.id = pm.pool_id
    WHERE stp.id = $1
    GROUP BY stp.plan_type, ptl.max_users, ptl.max_associated_users
  `, [poolId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    planType: row.plan_type,
    maxUsers: parseInt(row.max_users),
    maxAssociatedUsers: parseInt(row.max_associated_users),
    currentCount: parseInt(row.current_count),
    activeCount: parseInt(row.active_count),
    pendingCount: parseInt(row.pending_count),
    hasCapacity: parseInt(row.current_count) < parseInt(row.max_users),
    remainingSlots: parseInt(row.max_users) - parseInt(row.current_count)
  };
}

/**
 * Check if user can be added to pool
 */
async function canAddUser(poolId) {
  const capacity = await getPoolCapacity(poolId);
  return capacity && capacity.hasCapacity;
}

/**
 * Get membership statistics for a pool
 */
async function getPoolStats(poolId) {
  const result = await database.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') as active_members,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_members,
      COUNT(*) FILTER (WHERE status = 'suspended') as suspended_members,
      COUNT(*) FILTER (WHERE role = 'primary') as primary_count,
      COUNT(*) FILTER (WHERE role = 'associated') as associated_count,
      SUM(tokens_used_this_period) as total_tokens_used,
      MAX(last_active_at) as last_activity
    FROM plan_memberships
    WHERE pool_id = $1
  `, [poolId]);

  return result.rows[0];
}

module.exports = {
  create,
  findById,
  findByPoolAndUser,
  findByUserId,
  findActiveByUserId,
  findByPoolId,
  countByPoolId,
  verifyAge,
  acceptTerms,
  activate,
  suspend,
  remove,
  updateLastActive,
  getPoolCapacity,
  canAddUser,
  getPoolStats
};
