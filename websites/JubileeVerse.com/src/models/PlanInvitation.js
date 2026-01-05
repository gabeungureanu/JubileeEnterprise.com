/**
 * PlanInvitation Model
 * Manages invitations to join shared plans
 *
 * Key concepts:
 * - Primary subscriber invites users by email
 * - Age attestation required from inviter
 * - Invitations expire after 7 days
 * - Unique tokens for secure acceptance
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Generate secure invitation token
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Convert database row to invitation object
 */
function rowToInvitation(row) {
  if (!row) return null;
  return {
    id: row.id,
    poolId: row.pool_id,
    email: row.email,
    invitationToken: row.invitation_token,
    invitedBy: row.invited_by,
    status: row.status,
    inviterAgeAttestation: row.inviter_age_attestation,
    inviterAgeAttestationText: row.inviter_age_attestation_text,
    inviterAgeAttestationAt: row.inviter_age_attestation_at,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    expiresAt: row.expires_at,
    personalMessage: row.personal_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    inviterName: row.inviter_name,
    inviterEmail: row.inviter_email,
    planType: row.plan_type,
    poolPrimaryName: row.pool_primary_name
  };
}

// Standard age attestation text
const AGE_ATTESTATION_TEXT = 'I confirm that the person I am inviting is at least 13 years of age. I understand that JubileeVerse does not provide AI services to users aged 13 or younger, and I accept responsibility for ensuring this requirement is met.';

/**
 * Create a new invitation
 */
async function create(invitationData) {
  const id = uuidv4();
  const token = generateInvitationToken();

  // Validate age attestation is provided
  if (!invitationData.inviterAgeAttestation) {
    throw new Error('Age attestation is required to invite users');
  }

  const result = await database.query(`
    INSERT INTO plan_invitations (
      id, pool_id, email, invitation_token, invited_by, status,
      inviter_age_attestation, inviter_age_attestation_text, inviter_age_attestation_at,
      personal_message, expires_at
    ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NOW(), $8, $9)
    RETURNING *
  `, [
    id,
    invitationData.poolId,
    invitationData.email.toLowerCase().trim(),
    token,
    invitationData.invitedBy,
    invitationData.inviterAgeAttestation,
    AGE_ATTESTATION_TEXT,
    invitationData.personalMessage || null,
    invitationData.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  ]);

  return rowToInvitation(result.rows[0]);
}

/**
 * Find invitation by ID
 */
async function findById(invitationId) {
  const result = await database.query(`
    SELECT pi.*, u.display_name as inviter_name, u.email as inviter_email,
           stp.plan_type, pu.display_name as pool_primary_name
    FROM plan_invitations pi
    JOIN users u ON pi.invited_by = u.id
    JOIN shared_token_pools stp ON pi.pool_id = stp.id
    JOIN users pu ON stp.primary_user_id = pu.id
    WHERE pi.id = $1
  `, [invitationId]);

  return rowToInvitation(result.rows[0]);
}

/**
 * Find invitation by token
 */
async function findByToken(token) {
  const result = await database.query(`
    SELECT pi.*, u.display_name as inviter_name, u.email as inviter_email,
           stp.plan_type, pu.display_name as pool_primary_name
    FROM plan_invitations pi
    JOIN users u ON pi.invited_by = u.id
    JOIN shared_token_pools stp ON pi.pool_id = stp.id
    JOIN users pu ON stp.primary_user_id = pu.id
    WHERE pi.invitation_token = $1
  `, [token]);

  return rowToInvitation(result.rows[0]);
}

/**
 * Find pending invitation for email
 */
async function findPendingByEmail(email) {
  const result = await database.query(`
    SELECT pi.*, u.display_name as inviter_name, u.email as inviter_email,
           stp.plan_type, pu.display_name as pool_primary_name
    FROM plan_invitations pi
    JOIN users u ON pi.invited_by = u.id
    JOIN shared_token_pools stp ON pi.pool_id = stp.id
    JOIN users pu ON stp.primary_user_id = pu.id
    WHERE LOWER(pi.email) = LOWER($1)
      AND pi.status = 'pending'
      AND pi.expires_at > NOW()
    ORDER BY pi.created_at DESC
  `, [email.toLowerCase().trim()]);

  return result.rows.map(rowToInvitation);
}

/**
 * Find all invitations for a pool
 */
async function findByPoolId(poolId, options = {}) {
  const { status = null, includeExpired = false, limit = 50, offset = 0 } = options;

  let query = `
    SELECT pi.*, u.display_name as inviter_name, u.email as inviter_email,
           stp.plan_type
    FROM plan_invitations pi
    JOIN users u ON pi.invited_by = u.id
    JOIN shared_token_pools stp ON pi.pool_id = stp.id
    WHERE pi.pool_id = $1
  `;
  const params = [poolId];
  let paramIndex = 2;

  if (status) {
    query += ` AND pi.status = $${paramIndex++}`;
    params.push(status);
  }

  if (!includeExpired) {
    query += ` AND (pi.status != 'pending' OR pi.expires_at > NOW())`;
  }

  query += ` ORDER BY pi.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToInvitation);
}

/**
 * Get pending invitations count for pool
 */
async function countPending(poolId) {
  const result = await database.query(`
    SELECT COUNT(*) as count
    FROM plan_invitations
    WHERE pool_id = $1 AND status = 'pending' AND expires_at > NOW()
  `, [poolId]);

  return parseInt(result.rows[0].count);
}

/**
 * Accept an invitation
 */
async function accept(invitationId, acceptedByUserId) {
  const result = await database.query(`
    UPDATE plan_invitations
    SET status = 'accepted',
        accepted_by = $2,
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = $1 AND status = 'pending' AND expires_at > NOW()
    RETURNING *
  `, [invitationId, acceptedByUserId]);

  return rowToInvitation(result.rows[0]);
}

/**
 * Decline an invitation
 */
async function decline(invitationId) {
  const result = await database.query(`
    UPDATE plan_invitations
    SET status = 'declined',
        declined_at = NOW(),
        updated_at = NOW()
    WHERE id = $1 AND status = 'pending'
    RETURNING *
  `, [invitationId]);

  return rowToInvitation(result.rows[0]);
}

/**
 * Revoke an invitation (by inviter)
 */
async function revoke(invitationId) {
  const result = await database.query(`
    UPDATE plan_invitations
    SET status = 'revoked',
        updated_at = NOW()
    WHERE id = $1 AND status = 'pending'
    RETURNING *
  `, [invitationId]);

  return rowToInvitation(result.rows[0]);
}

/**
 * Mark expired invitations
 */
async function markExpired() {
  const result = await database.query(`
    UPDATE plan_invitations
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'pending' AND expires_at <= NOW()
    RETURNING id
  `);

  return result.rowCount;
}

/**
 * Check if email already has pending invitation to pool
 */
async function hasPendingInvitation(poolId, email) {
  const result = await database.query(`
    SELECT EXISTS (
      SELECT 1 FROM plan_invitations
      WHERE pool_id = $1
        AND LOWER(email) = LOWER($2)
        AND status = 'pending'
        AND expires_at > NOW()
    ) as exists
  `, [poolId, email.toLowerCase().trim()]);

  return result.rows[0].exists;
}

/**
 * Check if user is already a member of pool
 */
async function isAlreadyMember(poolId, email) {
  const result = await database.query(`
    SELECT EXISTS (
      SELECT 1 FROM plan_memberships pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.pool_id = $1
        AND LOWER(u.email) = LOWER($2)
        AND pm.status IN ('active', 'pending')
    ) as exists
  `, [poolId, email.toLowerCase().trim()]);

  return result.rows[0].exists;
}

/**
 * Get invitation statistics for pool
 */
async function getPoolStats(poolId) {
  const result = await database.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > NOW()) as pending_count,
      COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
      COUNT(*) FILTER (WHERE status = 'declined') as declined_count,
      COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'pending' AND expires_at <= NOW())) as expired_count,
      COUNT(*) FILTER (WHERE status = 'revoked') as revoked_count
    FROM plan_invitations
    WHERE pool_id = $1
  `, [poolId]);

  return result.rows[0];
}

/**
 * Resend invitation (creates new token, resets expiry)
 */
async function resend(invitationId) {
  const newToken = generateInvitationToken();

  const result = await database.query(`
    UPDATE plan_invitations
    SET invitation_token = $2,
        expires_at = NOW() + INTERVAL '7 days',
        updated_at = NOW()
    WHERE id = $1 AND status = 'pending'
    RETURNING *
  `, [invitationId, newToken]);

  return rowToInvitation(result.rows[0]);
}

module.exports = {
  create,
  findById,
  findByToken,
  findPendingByEmail,
  findByPoolId,
  countPending,
  accept,
  decline,
  revoke,
  markExpired,
  hasPendingInvitation,
  isAlreadyMember,
  getPoolStats,
  resend,
  AGE_ATTESTATION_TEXT
};
