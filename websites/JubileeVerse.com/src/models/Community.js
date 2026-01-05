/**
 * Community Model
 * Handles community persistence and membership management
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

const GLOBAL_COMMUNITY_SLUG = 'jubilee-community';

function rowToCommunity(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    ownerId: row.owner_id,
    isGlobal: row.is_global,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userRole: row.user_role,
    memberCount: row.member_count
  };
}

function rowToTeam(row) {
  if (!row) return null;
  return {
    id: row.id,
    communityId: row.community_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount: row.member_count
  };
}

function rowToInvitation(row) {
  if (!row) return null;
  return {
    id: row.id,
    communityId: row.community_id,
    communityName: row.community_name,
    inviterId: row.inviter_id,
    inviterName: row.inviter_name,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    inviteeUserId: row.invitee_user_id,
    message: row.message,
    role: row.role,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at
  };
}

async function findById(communityId) {
  const result = await database.query(
    `SELECT * FROM communities WHERE id = $1`,
    [communityId]
  );
  return rowToCommunity(result.rows[0]);
}

async function findBySlug(slug) {
  const result = await database.query(
    `SELECT * FROM communities WHERE slug = $1`,
    [slug]
  );
  return rowToCommunity(result.rows[0]);
}

async function getGlobalCommunity() {
  return findBySlug(GLOBAL_COMMUNITY_SLUG);
}

async function createCommunity({ name, slug, description, imageUrl, ownerId, isGlobal = false }) {
  const id = uuidv4();
  const result = await database.query(
    `INSERT INTO communities (id, name, slug, description, image_url, owner_id, is_global)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, name, slug, description || null, imageUrl || null, ownerId || null, isGlobal]
  );
  return rowToCommunity(result.rows[0]);
}

async function updateCommunity(communityId, { name, description, imageUrl }) {
  const result = await database.query(
    `UPDATE communities
     SET name = COALESCE($2, name),
         description = COALESCE($3, description),
         image_url = COALESCE($4, image_url),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [communityId, name, description, imageUrl]
  );
  return rowToCommunity(result.rows[0]);
}

async function deleteCommunity(communityId) {
  await database.query(`DELETE FROM communities WHERE id = $1`, [communityId]);
  return true;
}

async function addMember(communityId, userId, role = 'member') {
  const result = await database.query(
    `INSERT INTO community_memberships (community_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (community_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [communityId, userId, role]
  );
  return result.rows[0];
}

async function removeMember(communityId, userId) {
  await database.query(
    `DELETE FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
    [communityId, userId]
  );
  return true;
}

async function getMembership(communityId, userId) {
  const result = await database.query(
    `SELECT id, role FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
    [communityId, userId]
  );
  return result.rows[0] || null;
}

async function getUserCommunities(userId) {
  const result = await database.query(
    `SELECT c.*, cm.role as user_role,
            (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id) as member_count
     FROM communities c
     JOIN community_memberships cm ON cm.community_id = c.id
     WHERE cm.user_id = $1
     ORDER BY c.is_global DESC, c.created_at ASC`,
    [userId]
  );

  return result.rows.map(rowToCommunity);
}

async function getCommunityMembers(communityId) {
  const result = await database.query(
    `SELECT u.id, u.display_name, u.email, u.avatar_url, cm.role, cm.joined_at
     FROM community_memberships cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.community_id = $1
     ORDER BY cm.role ASC, u.display_name ASC`,
    [communityId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.display_name || row.email,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at
  }));
}

function getGlobalCommunitySlug() {
  return GLOBAL_COMMUNITY_SLUG;
}

// ============================================
// TEAM FUNCTIONS
// ============================================

async function getTeams(communityId) {
  const result = await database.query(
    `SELECT ct.*,
            (SELECT COUNT(*) FROM team_members WHERE team_id = ct.id) as member_count
     FROM community_teams ct
     WHERE ct.community_id = $1
     ORDER BY ct.sort_order ASC, ct.created_at ASC`,
    [communityId]
  );
  return result.rows.map(rowToTeam);
}

async function getTeamById(teamId) {
  const result = await database.query(
    `SELECT ct.*,
            (SELECT COUNT(*) FROM team_members WHERE team_id = ct.id) as member_count
     FROM community_teams ct
     WHERE ct.id = $1`,
    [teamId]
  );
  return rowToTeam(result.rows[0]);
}

async function createTeam({ communityId, name, description, icon, color, createdBy }) {
  const id = uuidv4();
  // Get the max sort order for this community
  const sortResult = await database.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_sort FROM community_teams WHERE community_id = $1`,
    [communityId]
  );
  const sortOrder = sortResult.rows[0].next_sort;

  const result = await database.query(
    `INSERT INTO community_teams (id, community_id, name, description, icon, color, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, communityId, name, description || null, icon || 'team', color || '#4a90a4', sortOrder, createdBy]
  );
  return rowToTeam(result.rows[0]);
}

async function updateTeam(teamId, { name, description, icon, color }) {
  const result = await database.query(
    `UPDATE community_teams
     SET name = COALESCE($2, name),
         description = COALESCE($3, description),
         icon = COALESCE($4, icon),
         color = COALESCE($5, color),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [teamId, name, description, icon, color]
  );
  return rowToTeam(result.rows[0]);
}

async function deleteTeam(teamId) {
  await database.query(`DELETE FROM community_teams WHERE id = $1`, [teamId]);
  return true;
}

async function getTeamMembers(teamId) {
  const result = await database.query(
    `SELECT u.id, u.display_name, u.email, u.avatar_url, tm.role, tm.joined_at
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.role ASC, u.display_name ASC`,
    [teamId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.display_name || row.email,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at
  }));
}

async function addTeamMember(teamId, userId, role = 'member', addedBy = null) {
  const result = await database.query(
    `INSERT INTO team_members (team_id, user_id, role, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [teamId, userId, role, addedBy]
  );
  return result.rows[0];
}

async function removeTeamMember(teamId, userId) {
  await database.query(
    `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );
  return true;
}

async function getTeamMembership(teamId, userId) {
  const result = await database.query(
    `SELECT id, role FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );
  return result.rows[0] || null;
}

async function getUserTeams(userId, communityId = null) {
  let query = `
    SELECT ct.*, tm.role as user_role,
           (SELECT COUNT(*) FROM team_members WHERE team_id = ct.id) as member_count
    FROM community_teams ct
    JOIN team_members tm ON tm.team_id = ct.id
    WHERE tm.user_id = $1
  `;
  const params = [userId];

  if (communityId) {
    query += ` AND ct.community_id = $2`;
    params.push(communityId);
  }

  query += ` ORDER BY ct.sort_order ASC, ct.created_at ASC`;

  const result = await database.query(query, params);
  return result.rows.map((row) => ({
    ...rowToTeam(row),
    userRole: row.user_role
  }));
}

// ============================================
// INVITATION FUNCTIONS
// ============================================

function generateInvitationToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

async function createInvitation({ communityId, inviterId, inviteeEmail, message, role = 'member' }) {
  const id = uuidv4();
  const token = generateInvitationToken();

  // Check if invitee already has an account
  const userResult = await database.query(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
    [inviteeEmail]
  );
  const inviteeUserId = userResult.rows[0]?.id || null;

  // Check if there's already a pending invitation
  const existingResult = await database.query(
    `SELECT id FROM community_invitations
     WHERE community_id = $1 AND LOWER(invitee_email) = LOWER($2) AND status = 'pending'`,
    [communityId, inviteeEmail]
  );

  if (existingResult.rows.length > 0) {
    // Update existing invitation
    const result = await database.query(
      `UPDATE community_invitations
       SET inviter_id = $2, message = $3, role = $4, token = $5,
           created_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $1
       RETURNING *`,
      [existingResult.rows[0].id, inviterId, message, role, token]
    );
    return rowToInvitation(result.rows[0]);
  }

  const result = await database.query(
    `INSERT INTO community_invitations
     (id, community_id, inviter_id, invitee_email, invitee_user_id, message, role, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, communityId, inviterId, inviteeEmail, inviteeUserId, message || null, role, token]
  );
  return rowToInvitation(result.rows[0]);
}

async function getInvitationByToken(token) {
  const result = await database.query(
    `SELECT ci.*,
            c.name as community_name,
            u.display_name as inviter_name,
            u.email as inviter_email
     FROM community_invitations ci
     JOIN communities c ON c.id = ci.community_id
     JOIN users u ON u.id = ci.inviter_id
     WHERE ci.token = $1`,
    [token]
  );
  return rowToInvitation(result.rows[0]);
}

async function getInvitationById(invitationId) {
  const result = await database.query(
    `SELECT ci.*,
            c.name as community_name,
            u.display_name as inviter_name,
            u.email as inviter_email
     FROM community_invitations ci
     JOIN communities c ON c.id = ci.community_id
     JOIN users u ON u.id = ci.inviter_id
     WHERE ci.id = $1`,
    [invitationId]
  );
  return rowToInvitation(result.rows[0]);
}

async function getPendingInvitationsForUser(userId) {
  const result = await database.query(
    `SELECT ci.*,
            c.name as community_name,
            u.display_name as inviter_name,
            u.email as inviter_email
     FROM community_invitations ci
     JOIN communities c ON c.id = ci.community_id
     JOIN users u ON u.id = ci.inviter_id
     WHERE ci.invitee_user_id = $1 AND ci.status = 'pending' AND ci.expires_at > NOW()
     ORDER BY ci.created_at DESC`,
    [userId]
  );
  return result.rows.map(rowToInvitation);
}

async function getPendingInvitationsForEmail(email) {
  const result = await database.query(
    `SELECT ci.*,
            c.name as community_name,
            u.display_name as inviter_name,
            u.email as inviter_email
     FROM community_invitations ci
     JOIN communities c ON c.id = ci.community_id
     JOIN users u ON u.id = ci.inviter_id
     WHERE LOWER(ci.invitee_email) = LOWER($1) AND ci.status = 'pending' AND ci.expires_at > NOW()
     ORDER BY ci.created_at DESC`,
    [email]
  );
  return result.rows.map(rowToInvitation);
}

async function getCommunityInvitations(communityId, status = null) {
  let query = `
    SELECT ci.*,
           c.name as community_name,
           u.display_name as inviter_name,
           u.email as inviter_email
    FROM community_invitations ci
    JOIN communities c ON c.id = ci.community_id
    JOIN users u ON u.id = ci.inviter_id
    WHERE ci.community_id = $1
  `;
  const params = [communityId];

  if (status) {
    query += ` AND ci.status = $2`;
    params.push(status);
  }

  query += ` ORDER BY ci.created_at DESC`;

  const result = await database.query(query, params);
  return result.rows.map(rowToInvitation);
}

async function acceptInvitation(invitationId, userId) {
  const invitation = await getInvitationById(invitationId);
  if (!invitation) {
    return { success: false, message: 'Invitation not found' };
  }
  if (invitation.status !== 'pending') {
    return { success: false, message: `Invitation has already been ${invitation.status}` };
  }
  if (new Date(invitation.expiresAt) < new Date()) {
    await database.query(
      `UPDATE community_invitations SET status = 'expired' WHERE id = $1`,
      [invitationId]
    );
    return { success: false, message: 'Invitation has expired' };
  }

  // Add user to community
  await addMember(invitation.communityId, userId, invitation.role);

  // Mark invitation as accepted
  await database.query(
    `UPDATE community_invitations SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
    [invitationId]
  );

  return { success: true, communityId: invitation.communityId, communityName: invitation.communityName };
}

async function declineInvitation(invitationId) {
  await database.query(
    `UPDATE community_invitations SET status = 'declined', responded_at = NOW() WHERE id = $1`,
    [invitationId]
  );
  return true;
}

async function cancelInvitation(invitationId) {
  await database.query(
    `UPDATE community_invitations SET status = 'cancelled', responded_at = NOW() WHERE id = $1`,
    [invitationId]
  );
  return true;
}

module.exports = {
  // Community functions
  findById,
  findBySlug,
  getGlobalCommunity,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  addMember,
  removeMember,
  getMembership,
  getUserCommunities,
  getCommunityMembers,
  getGlobalCommunitySlug,

  // Team functions
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  getTeamMembership,
  getUserTeams,

  // Invitation functions
  createInvitation,
  getInvitationByToken,
  getInvitationById,
  getPendingInvitationsForUser,
  getPendingInvitationsForEmail,
  getCommunityInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation
};
