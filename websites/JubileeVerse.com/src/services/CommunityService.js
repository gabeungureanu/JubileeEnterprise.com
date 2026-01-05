/**
 * Community Service
 * Handles community initialization and membership workflows
 */

const { Community, User } = require('../models');
const { getFirstNameFromUser } = require('../utils/name');

function buildPersonalCommunitySlug(userId) {
  return `personal-${userId}`;
}

async function ensureGlobalCommunity() {
  let community = await Community.getGlobalCommunity();
  if (!community) {
    community = await Community.createCommunity({
      name: 'Jubilee Community',
      slug: Community.getGlobalCommunitySlug(),
      isGlobal: true
    });
  }
  return community;
}

async function ensurePersonalCommunity(user) {
  const slug = buildPersonalCommunitySlug(user.id);
  let community = await Community.findBySlug(slug);
  if (!community) {
    const firstName = getFirstNameFromUser(user);
    const name = firstName
      ? `${firstName}'s Community`
      : `Community of ${user.email}`;
    community = await Community.createCommunity({
      name,
      slug,
      ownerId: user.id,
      isGlobal: false
    });
  }
  return community;
}

async function ensureDefaultCommunitiesForUser(user) {
  const globalCommunity = await ensureGlobalCommunity();
  const personalCommunity = await ensurePersonalCommunity(user);

  await Community.addMember(globalCommunity.id, user.id, 'member');
  await Community.addMember(personalCommunity.id, user.id, 'owner');

  return { globalCommunity, personalCommunity };
}

async function getUserCommunities(userId) {
  return Community.getUserCommunities(userId);
}

async function getCommunityById(communityId) {
  return Community.findById(communityId);
}

async function createCommunity({ name, description, imageUrl, ownerId }) {
  // Generate a unique slug
  const baseSlug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

  const community = await Community.createCommunity({
    name,
    slug: uniqueSlug,
    description,
    imageUrl,
    ownerId,
    isGlobal: false
  });

  // Add creator as owner
  await Community.addMember(community.id, ownerId, 'owner');

  return community;
}

async function updateCommunity(communityId, { name, description, imageUrl }) {
  return Community.updateCommunity(communityId, { name, description, imageUrl });
}

async function deleteCommunity(communityId) {
  return Community.deleteCommunity(communityId);
}

async function getCommunityMembers(communityId) {
  return Community.getCommunityMembers(communityId);
}

async function getMembership(communityId, userId) {
  return Community.getMembership(communityId, userId);
}

async function addMemberByEmail(communityId, email) {
  const user = await User.findByEmail(email);
  if (!user) {
    return null;
  }
  await Community.addMember(communityId, user.id, 'member');
  return user;
}

async function removeMember(communityId, userId) {
  return Community.removeMember(communityId, userId);
}

async function resolveCommunityByIdOrSlug(value) {
  if (!value) {
    return null;
  }
  const isUuid = /^[0-9a-fA-F-]{36}$/.test(value);
  if (isUuid) {
    return Community.findById(value);
  }
  return Community.findBySlug(value);
}

// ============================================
// TEAM FUNCTIONS
// ============================================

async function getTeams(communityId) {
  return Community.getTeams(communityId);
}

async function getTeamById(teamId) {
  return Community.getTeamById(teamId);
}

async function createTeam({ communityId, name, description, icon, color, createdBy }) {
  return Community.createTeam({ communityId, name, description, icon, color, createdBy });
}

async function updateTeam(teamId, { name, description, icon, color }) {
  return Community.updateTeam(teamId, { name, description, icon, color });
}

async function deleteTeam(teamId) {
  return Community.deleteTeam(teamId);
}

async function getTeamMembers(teamId) {
  return Community.getTeamMembers(teamId);
}

async function addTeamMember(teamId, userId, role, addedBy) {
  return Community.addTeamMember(teamId, userId, role, addedBy);
}

async function removeTeamMember(teamId, userId) {
  return Community.removeTeamMember(teamId, userId);
}

async function getTeamMembership(teamId, userId) {
  return Community.getTeamMembership(teamId, userId);
}

async function getUserTeams(userId, communityId) {
  return Community.getUserTeams(userId, communityId);
}

// ============================================
// INVITATION FUNCTIONS
// ============================================

async function createInvitation({ communityId, inviterId, inviteeEmail, message, role }) {
  return Community.createInvitation({ communityId, inviterId, inviteeEmail, message, role });
}

async function getInvitationByToken(token) {
  return Community.getInvitationByToken(token);
}

async function getInvitationById(invitationId) {
  return Community.getInvitationById(invitationId);
}

async function getPendingInvitationsForUser(userId) {
  return Community.getPendingInvitationsForUser(userId);
}

async function getPendingInvitationsForEmail(email) {
  return Community.getPendingInvitationsForEmail(email);
}

async function getCommunityInvitations(communityId, status) {
  return Community.getCommunityInvitations(communityId, status);
}

async function acceptInvitation(invitationId, userId) {
  return Community.acceptInvitation(invitationId, userId);
}

async function declineInvitation(invitationId) {
  return Community.declineInvitation(invitationId);
}

async function cancelInvitation(invitationId) {
  return Community.cancelInvitation(invitationId);
}

module.exports = {
  // Community functions
  ensureGlobalCommunity,
  ensurePersonalCommunity,
  ensureDefaultCommunitiesForUser,
  getUserCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  getCommunityMembers,
  getMembership,
  addMemberByEmail,
  removeMember,
  resolveCommunityByIdOrSlug,

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
