/**
 * PlanManagementController
 * HTTP endpoints for multi-user plan management
 *
 * Endpoints:
 * - Plan info and token balance
 * - Invitation management
 * - Member management
 * - Token purchases
 */

const logger = require('../utils/logger');
const PlanManagementService = require('../services/PlanManagementService');
const SharedTokenPool = require('../models/SharedTokenPool');
const PlanMembership = require('../models/PlanMembership');
const PlanInvitation = require('../models/PlanInvitation');
const UserAuditLog = require('../models/UserAuditLog');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Get current user's plan details
 * GET /api/plan
 */
const getPlan = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const details = await PlanManagementService.getPlanDetails(userId);

  if (!details) {
    return res.json({
      success: true,
      hasPlan: false,
      planType: 'visitor'
    });
  }

  res.json({
    success: true,
    hasPlan: true,
    plan: {
      id: details.pool.id,
      planType: details.pool.planType,
      isPrimary: details.pool.primaryUserId === userId,
      balance: details.balance,
      limits: details.limits,
      capacity: details.capacity
    },
    members: details.members.map(m => ({
      id: m.id,
      userId: m.userId,
      email: m.userEmail,
      displayName: m.userDisplayName,
      role: m.role,
      status: m.status,
      tokensUsed: m.tokensUsedThisPeriod,
      lastActive: m.lastActiveAt
    })),
    pendingInvitations: details.pendingInvitations.length
  });
});

/**
 * Get token balance
 * GET /api/plan/balance
 */
const getBalance = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const balance = await PlanManagementService.getTokenBalance(userId);

  if (!balance) {
    return res.json({
      success: true,
      hasPlan: false,
      balance: null
    });
  }

  res.json({
    success: true,
    hasPlan: true,
    balance
  });
});

/**
 * Get plan members
 * GET /api/plan/members
 */
const getMembers = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const pool = await SharedTokenPool.findByUserId(userId);

  if (!pool) {
    throw new AppError('No active plan found', 404);
  }

  const membership = await PlanMembership.findByPoolAndUser(pool.id, userId);

  // Only primary/admin can see full member list
  if (!membership || !['primary', 'admin'].includes(membership.role)) {
    throw new AppError('Only plan owner can view members', 403);
  }

  const members = await PlanMembership.findByPoolId(pool.id, {
    includeInactive: req.query.includeInactive === 'true'
  });

  // Log audit
  await UserAuditLog.logAccess({
    accessorUserId: userId,
    accessorRole: membership.role,
    actionType: UserAuditLog.AUDIT_ACTIONS.VIEW_PLAN_MEMBERS,
    targetType: UserAuditLog.TARGET_TYPES.PLAN,
    targetId: pool.id,
    resultCount: members.length,
    accessorIpAddress: req.ip,
    accessorUserAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    members: members.map(m => ({
      id: m.id,
      userId: m.userId,
      email: m.userEmail,
      displayName: m.userDisplayName,
      role: m.role,
      status: m.status,
      ageVerified: m.ageVerified,
      termsAccepted: m.termsAccepted,
      tokensUsed: m.tokensUsedThisPeriod,
      lastActive: m.lastActiveAt,
      invitedBy: m.invitedBy,
      joinedAt: m.invitationAcceptedAt || m.createdAt
    }))
  });
});

/**
 * Invite a user to the plan
 * POST /api/plan/invite
 *
 * Body: {
 *   email: string (required),
 *   ageAttestation: boolean (required - must be true),
 *   personalMessage: string (optional)
 * }
 */
const inviteUser = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { email, ageAttestation, personalMessage } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  if (ageAttestation !== true) {
    throw new AppError('You must confirm the invitee is at least 13 years old', 400);
  }

  const pool = await SharedTokenPool.findByUserId(userId);

  if (!pool) {
    throw new AppError('No active plan found', 404);
  }

  const invitation = await PlanManagementService.inviteUser(
    pool.id,
    userId,
    email,
    { personalMessage, ageAttestation }
  );

  res.json({
    success: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      invitationToken: invitation.invitationToken // For testing; in production, send via email
    },
    message: `Invitation sent to ${email}`
  });
});

/**
 * Get pending invitations
 * GET /api/plan/invitations
 */
const getInvitations = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const pool = await SharedTokenPool.findByUserId(userId);

  if (!pool) {
    throw new AppError('No active plan found', 404);
  }

  const membership = await PlanMembership.findByPoolAndUser(pool.id, userId);

  if (!membership || !['primary', 'admin'].includes(membership.role)) {
    throw new AppError('Only plan owner can view invitations', 403);
  }

  const invitations = await PlanInvitation.findByPoolId(pool.id, {
    status: req.query.status || null,
    includeExpired: req.query.includeExpired === 'true'
  });

  res.json({
    success: true,
    invitations: invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      status: inv.status,
      invitedBy: inv.inviterName,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      acceptedAt: inv.acceptedAt,
      declinedAt: inv.declinedAt
    }))
  });
});

/**
 * Revoke an invitation
 * DELETE /api/plan/invitations/:invitationId
 */
const revokeInvitation = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { invitationId } = req.params;

  const invitation = await PlanInvitation.findById(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  // Verify user owns the pool
  const pool = await SharedTokenPool.findById(invitation.poolId);
  const membership = await PlanMembership.findByPoolAndUser(pool.id, userId);

  if (!membership || !['primary', 'admin'].includes(membership.role)) {
    throw new AppError('Only plan owner can revoke invitations', 403);
  }

  await PlanInvitation.revoke(invitationId);

  res.json({
    success: true,
    message: 'Invitation revoked'
  });
});

/**
 * Get invitation details by token (for accepting)
 * GET /api/plan/invitation/:token
 */
const getInvitationByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const invitation = await PlanInvitation.findByToken(token);

  if (!invitation) {
    throw new AppError('Invalid invitation', 404);
  }

  if (invitation.status !== 'pending') {
    throw new AppError(`Invitation has already been ${invitation.status}`, 400);
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    throw new AppError('Invitation has expired', 400);
  }

  res.json({
    success: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      inviterName: invitation.inviterName,
      planType: invitation.planType,
      personalMessage: invitation.personalMessage,
      expiresAt: invitation.expiresAt
    }
  });
});

/**
 * Accept an invitation
 * POST /api/plan/invitation/:token/accept
 *
 * Body: {
 *   acceptTerms: boolean (required - must be true),
 *   ageVerified: boolean (required - must be true)
 * }
 */
const acceptInvitation = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { token } = req.params;
  const { acceptTerms, ageVerified } = req.body;

  if (acceptTerms !== true) {
    throw new AppError('You must accept the terms of service', 400);
  }

  if (ageVerified !== true) {
    throw new AppError('You must confirm you are at least 13 years old', 400);
  }

  const membership = await PlanManagementService.acceptInvitation(token, userId, {
    acceptTerms,
    ageVerified,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status
    },
    message: 'You have joined the plan!'
  });
});

/**
 * Decline an invitation
 * POST /api/plan/invitation/:token/decline
 */
const declineInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const invitation = await PlanInvitation.findByToken(token);

  if (!invitation) {
    throw new AppError('Invalid invitation', 404);
  }

  await PlanInvitation.decline(invitation.id);

  res.json({
    success: true,
    message: 'Invitation declined'
  });
});

/**
 * Remove a member from the plan
 * DELETE /api/plan/members/:userId
 */
const removeMember = asyncHandler(async (req, res) => {
  const requesterId = req.session?.userId;

  if (!requesterId) {
    throw new AppError('Authentication required', 401);
  }

  const { userId: targetUserId } = req.params;

  const pool = await SharedTokenPool.findByUserId(requesterId);

  if (!pool) {
    throw new AppError('No active plan found', 404);
  }

  await PlanManagementService.removeUser(pool.id, requesterId, targetUserId);

  res.json({
    success: true,
    message: 'Member removed from plan'
  });
});

/**
 * Get token usage history
 * GET /api/plan/usage
 */
const getUsageHistory = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const pool = await SharedTokenPool.findByUserId(userId);

  if (!pool) {
    throw new AppError('No active plan found', 404);
  }

  const membership = await PlanMembership.findByPoolAndUser(pool.id, userId);

  // Primary/admin can see all usage; others only see their own
  const filterUserId = ['primary', 'admin'].includes(membership?.role) ? null : userId;

  const usage = await SharedTokenPool.getUsageHistory(pool.id, {
    userId: filterUserId,
    limit: parseInt(req.query.limit) || 100,
    offset: parseInt(req.query.offset) || 0
  });

  const usageByUser = ['primary', 'admin'].includes(membership?.role)
    ? await SharedTokenPool.getUsageByUser(pool.id)
    : null;

  res.json({
    success: true,
    usage,
    usageByUser
  });
});

/**
 * Get purchase history
 * GET /api/plan/purchases
 */
const getPurchaseHistory = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const pool = await SharedTokenPool.findByUserId(userId);

  if (!pool) {
    throw new AppError('No active plan found', 404);
  }

  const membership = await PlanMembership.findByPoolAndUser(pool.id, userId);

  // Only primary can see purchases
  if (!membership || membership.role !== 'primary') {
    throw new AppError('Only plan owner can view purchase history', 403);
  }

  const purchases = await SharedTokenPool.getPurchaseHistory(pool.id, {
    limit: parseInt(req.query.limit) || 50,
    offset: parseInt(req.query.offset) || 0
  });

  res.json({
    success: true,
    purchases
  });
});

/**
 * Purchase additional tokens
 * POST /api/plan/purchase-tokens
 *
 * Body: {
 *   tokens: number (required),
 *   paymentMethodId: string (optional)
 * }
 */
const purchaseTokens = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const { tokens, paymentMethodId } = req.body;

  if (!tokens || tokens <= 0) {
    throw new AppError('Valid token amount is required', 400);
  }

  // Calculate price (example: $10 per 10,000 tokens)
  const pricePerToken = 0.001; // $0.001 per token
  const amountCents = Math.ceil(tokens * pricePerToken * 100);

  const result = await PlanManagementService.purchaseTokens(userId, tokens, amountCents, {
    paymentMethodId
    // In production: process Stripe payment first
  });

  res.json({
    success: true,
    purchase: {
      id: result.purchaseId,
      tokensAdded: result.tokensAdded,
      amountCharged: amountCents / 100,
      newBalance: result.newBalance
    }
  });
});

/**
 * Get plan capacity info
 * GET /api/plan/capacity
 */
const getCapacity = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const pool = await SharedTokenPool.findByUserId(userId);

  if (!pool) {
    throw new AppError('No active plan found', 404);
  }

  const capacity = await PlanMembership.getPoolCapacity(pool.id);

  res.json({
    success: true,
    capacity
  });
});

/**
 * Get my pending invitations (as invitee)
 * GET /api/plan/my-invitations
 */
const getMyPendingInvitations = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const user = await require('../models/User').findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const invitations = await PlanInvitation.findPendingByEmail(user.email);

  res.json({
    success: true,
    invitations: invitations.map(inv => ({
      id: inv.id,
      token: inv.invitationToken,
      inviterName: inv.inviterName,
      planType: inv.planType,
      personalMessage: inv.personalMessage,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt
    }))
  });
});

module.exports = {
  getPlan,
  getBalance,
  getMembers,
  inviteUser,
  getInvitations,
  revokeInvitation,
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
  removeMember,
  getUsageHistory,
  getPurchaseHistory,
  purchaseTokens,
  getCapacity,
  getMyPendingInvitations
};
