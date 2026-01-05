/**
 * Community Controller
 * Handles community membership and selection endpoints
 */

const { CommunityService } = require('../services');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// ============================================
// COMMUNITY ENDPOINTS
// ============================================

const getCommunities = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const communities = await CommunityService.getUserCommunities(req.session.userId);

  res.json({
    success: true,
    communities
  });
});

const getCommunity = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const community = await CommunityService.getCommunityById(id);

  if (!community) {
    throw new AppError('Community not found', 404);
  }

  const membership = await CommunityService.getMembership(id, req.session.userId);
  if (!membership) {
    throw new AppError('Access denied', 403);
  }

  res.json({
    success: true,
    community: {
      ...community,
      userRole: membership.role
    }
  });
});

const createCommunity = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { name, description, imageUrl } = req.body;

  if (!name || name.trim().length === 0) {
    throw new AppError('Community name is required', 400);
  }

  const community = await CommunityService.createCommunity({
    name: name.trim(),
    description: description?.trim() || null,
    imageUrl: imageUrl || null,
    ownerId: req.session.userId
  });

  res.json({
    success: true,
    message: 'Community created',
    community
  });
});

const updateCommunity = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { name, description, imageUrl } = req.body;

  const membership = await CommunityService.getMembership(id, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can update the community', 403);
  }

  const community = await CommunityService.updateCommunity(id, {
    name: name?.trim(),
    description: description?.trim(),
    imageUrl
  });

  res.json({
    success: true,
    message: 'Community updated',
    community
  });
});

const deleteCommunity = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const community = await CommunityService.getCommunityById(id);

  if (!community) {
    throw new AppError('Community not found', 404);
  }

  if (community.isGlobal) {
    throw new AppError('Cannot delete the global community', 403);
  }

  const membership = await CommunityService.getMembership(id, req.session.userId);
  if (!membership || membership.role !== 'owner') {
    throw new AppError('Only community owners can delete the community', 403);
  }

  await CommunityService.deleteCommunity(id);

  res.json({
    success: true,
    message: 'Community deleted'
  });
});

const getCommunityMembers = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const membership = await CommunityService.getMembership(id, req.session.userId);

  if (!membership) {
    throw new AppError('Access denied', 403);
  }

  const members = await CommunityService.getCommunityMembers(id);

  res.json({
    success: true,
    members
  });
});

const removeCommunityMember = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id, userId } = req.params;
  const membership = await CommunityService.getMembership(id, req.session.userId);

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can remove members', 403);
  }

  // Cannot remove the owner
  const targetMembership = await CommunityService.getMembership(id, userId);
  if (targetMembership?.role === 'owner') {
    throw new AppError('Cannot remove the community owner', 403);
  }

  await CommunityService.removeMember(id, userId);

  res.json({
    success: true,
    message: 'Member removed'
  });
});

// ============================================
// TEAM ENDPOINTS
// ============================================

const getTeams = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const membership = await CommunityService.getMembership(id, req.session.userId);

  if (!membership) {
    throw new AppError('Access denied', 403);
  }

  const teams = await CommunityService.getTeams(id);

  res.json({
    success: true,
    teams
  });
});

const getTeam = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { teamId } = req.params;
  const team = await CommunityService.getTeamById(teamId);

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const membership = await CommunityService.getMembership(team.communityId, req.session.userId);
  if (!membership) {
    throw new AppError('Access denied', 403);
  }

  const members = await CommunityService.getTeamMembers(teamId);

  res.json({
    success: true,
    team,
    members
  });
});

const createTeam = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { name, description, icon, color } = req.body;

  if (!name || name.trim().length === 0) {
    throw new AppError('Team name is required', 400);
  }

  const membership = await CommunityService.getMembership(id, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can create teams', 403);
  }

  const team = await CommunityService.createTeam({
    communityId: id,
    name: name.trim(),
    description: description?.trim() || null,
    icon: icon || 'team',
    color: color || '#4a90a4',
    createdBy: req.session.userId
  });

  res.json({
    success: true,
    message: 'Team created',
    team
  });
});

const updateTeam = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { teamId } = req.params;
  const { name, description, icon, color } = req.body;

  const team = await CommunityService.getTeamById(teamId);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const membership = await CommunityService.getMembership(team.communityId, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can update teams', 403);
  }

  const updatedTeam = await CommunityService.updateTeam(teamId, {
    name: name?.trim(),
    description: description?.trim(),
    icon,
    color
  });

  res.json({
    success: true,
    message: 'Team updated',
    team: updatedTeam
  });
});

const deleteTeam = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { teamId } = req.params;
  const team = await CommunityService.getTeamById(teamId);

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const membership = await CommunityService.getMembership(team.communityId, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can delete teams', 403);
  }

  await CommunityService.deleteTeam(teamId);

  res.json({
    success: true,
    message: 'Team deleted'
  });
});

const getTeamMembers = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { teamId } = req.params;
  const team = await CommunityService.getTeamById(teamId);

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const membership = await CommunityService.getMembership(team.communityId, req.session.userId);
  if (!membership) {
    throw new AppError('Access denied', 403);
  }

  const members = await CommunityService.getTeamMembers(teamId);

  res.json({
    success: true,
    members
  });
});

const addTeamMember = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { teamId } = req.params;
  const { userId, role } = req.body;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const team = await CommunityService.getTeamById(teamId);
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const membership = await CommunityService.getMembership(team.communityId, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can add team members', 403);
  }

  // Verify the user is a member of the community
  const userMembership = await CommunityService.getMembership(team.communityId, userId);
  if (!userMembership) {
    throw new AppError('User must be a community member first', 400);
  }

  await CommunityService.addTeamMember(teamId, userId, role || 'member', req.session.userId);

  res.json({
    success: true,
    message: 'Team member added'
  });
});

const removeTeamMember = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { teamId, userId } = req.params;
  const team = await CommunityService.getTeamById(teamId);

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const membership = await CommunityService.getMembership(team.communityId, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can remove team members', 403);
  }

  await CommunityService.removeTeamMember(teamId, userId);

  res.json({
    success: true,
    message: 'Team member removed'
  });
});

// ============================================
// INVITATION ENDPOINTS
// ============================================

const createInvitation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { email, message, role } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const membership = await CommunityService.getMembership(id, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can send invitations', 403);
  }

  const invitation = await CommunityService.createInvitation({
    communityId: id,
    inviterId: req.session.userId,
    inviteeEmail: email.trim().toLowerCase(),
    message: message?.trim() || null,
    role: role || 'member'
  });

  res.json({
    success: true,
    message: 'Invitation sent',
    invitation
  });
});

const getCommunityInvitations = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { status } = req.query;

  const membership = await CommunityService.getMembership(id, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can view invitations', 403);
  }

  const invitations = await CommunityService.getCommunityInvitations(id, status || null);

  res.json({
    success: true,
    invitations
  });
});

const getMyInvitations = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const invitations = await CommunityService.getPendingInvitationsForUser(req.session.userId);

  res.json({
    success: true,
    invitations
  });
});

const getInvitationByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const invitation = await CommunityService.getInvitationByToken(token);

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  res.json({
    success: true,
    invitation
  });
});

const acceptInvitation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const result = await CommunityService.acceptInvitation(id, req.session.userId);

  if (!result.success) {
    throw new AppError(result.message, 400);
  }

  res.json({
    success: true,
    message: result.message || 'Invitation accepted',
    communityId: result.communityId,
    communityName: result.communityName
  });
});

const declineInvitation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;

  // Verify the invitation belongs to this user
  const invitation = await CommunityService.getInvitationById(id);
  if (!invitation || invitation.inviteeUserId !== req.session.userId) {
    throw new AppError('Invitation not found', 404);
  }

  await CommunityService.declineInvitation(id);

  res.json({
    success: true,
    message: 'Invitation declined'
  });
});

const cancelInvitation = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const invitation = await CommunityService.getInvitationById(id);

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  const membership = await CommunityService.getMembership(invitation.communityId, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can cancel invitations', 403);
  }

  await CommunityService.cancelInvitation(id);

  res.json({
    success: true,
    message: 'Invitation cancelled'
  });
});

// Legacy endpoint (keeping for backward compatibility)
const inviteMember = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const membership = await CommunityService.getMembership(id, req.session.userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new AppError('Only community owners or admins can invite members', 403);
  }

  const invitedUser = await CommunityService.addMemberByEmail(id, email);
  if (!invitedUser) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'Member added',
    user: {
      id: invitedUser.id,
      email: invitedUser.email,
      displayName: invitedUser.displayName
    }
  });
});

module.exports = {
  // Community endpoints
  getCommunities,
  getCommunity,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  getCommunityMembers,
  removeCommunityMember,

  // Team endpoints
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,

  // Invitation endpoints
  createInvitation,
  getCommunityInvitations,
  getMyInvitations,
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,

  // Legacy
  inviteMember
};
