/**
 * PlanManagementService
 * Orchestrates multi-user plan operations
 *
 * Key operations:
 * - Create and manage shared token pools
 * - Invite and manage associated users
 * - Enforce plan limits and age verification
 * - Handle token usage and purchases
 * - Create and manage default communities
 */

const logger = require('../utils/logger');
const SharedTokenPool = require('../models/SharedTokenPool');
const PlanMembership = require('../models/PlanMembership');
const PlanInvitation = require('../models/PlanInvitation');
const UserAuditLog = require('../models/UserAuditLog');
const User = require('../models/User');
const Community = require('../models/Community');
const database = require('../database');
const { v4: uuidv4 } = require('uuid');

// Current terms version
const CURRENT_TERMS_VERSION = '2024.1';

// Age compliance text
const AGE_COMPLIANCE_TEXT = 'I confirm that I am at least 13 years of age, and I understand that JubileeVerse does not provide AI services to users aged 13 or younger.';
const SUBSCRIBER_AGE_RESPONSIBILITY_TEXT = 'As a plan subscriber, I accept responsibility for ensuring that all users I invite to my plan are at least 13 years of age.';

/**
 * Initialize a new plan for a subscriber
 */
async function initializePlan(userId, planType, options = {}) {
  const { acceptTerms = true, ageVerified = true, ipAddress = null, userAgent = null } = options;

  try {
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has a pool
    const existingPool = await SharedTokenPool.findByPrimaryUser(userId);
    if (existingPool) {
      throw new Error('User already has an active plan');
    }

    // Create token pool
    const pool = await SharedTokenPool.create({
      primaryUserId: userId,
      planType
    });

    // Create primary membership
    await PlanMembership.create({
      poolId: pool.id,
      userId,
      role: 'primary',
      status: 'active',
      ageVerified,
      ageVerifiedAt: ageVerified ? new Date() : null,
      termsAccepted: acceptTerms,
      termsAcceptedAt: acceptTerms ? new Date() : null,
      termsVersion: CURRENT_TERMS_VERSION
    });

    // Update user record
    await User.update(userId, {
      planType,
      isPlanPrimary: true,
      primaryPoolId: pool.id,
      termsAcceptedAt: acceptTerms ? new Date() : null,
      termsVersion: CURRENT_TERMS_VERSION,
      ageVerified,
      ageVerifiedAt: ageVerified ? new Date() : null,
      minAgeAcknowledged: true,
      minAgeAcknowledgedAt: new Date()
    });

    // Log terms acceptance
    if (acceptTerms) {
      await UserAuditLog.logTermsAcceptance(userId, 'plan_subscriber', CURRENT_TERMS_VERSION, {
        ipAddress,
        userAgent,
        ageAttestationText: AGE_COMPLIANCE_TEXT
      });

      // For ministry/business plans, also log age responsibility
      if (['ministry', 'business', 'enterprise'].includes(planType)) {
        await UserAuditLog.logTermsAcceptance(userId, 'age_compliance', CURRENT_TERMS_VERSION, {
          ipAddress,
          userAgent,
          ageAttestationText: SUBSCRIBER_AGE_RESPONSIBILITY_TEXT
        });
      }
    }

    // Create default community for multi-user plans
    let defaultCommunity = null;
    if (['ministry', 'business', 'enterprise'].includes(planType)) {
      defaultCommunity = await createDefaultCommunity(pool.id, userId, planType);
    }

    logger.info('Plan initialized', {
      userId,
      poolId: pool.id,
      planType,
      communityId: defaultCommunity?.id
    });

    return {
      pool,
      defaultCommunity
    };

  } catch (error) {
    logger.error('Failed to initialize plan', { userId, planType, error: error.message });
    throw error;
  }
}

/**
 * Create default community for a plan
 */
async function createDefaultCommunity(poolId, primaryUserId, planType) {
  const user = await User.findById(primaryUserId);

  // Create community
  const community = await Community.create({
    name: `${user.displayName || user.email}'s ${planType} Community`,
    description: `Default community for ${planType} plan members`,
    ownerId: primaryUserId,
    visibility: 'private',
    membershipType: 'invite_only'
  });

  // Link to pool
  await database.query(`
    INSERT INTO plan_default_communities (pool_id, community_id)
    VALUES ($1, $2)
  `, [poolId, community.id]);

  // Add primary user as owner
  await Community.addMember(community.id, primaryUserId, 'owner');

  return community;
}

/**
 * Invite a user to join a plan
 */
async function inviteUser(poolId, inviterUserId, inviteeEmail, options = {}) {
  const { personalMessage = null, ageAttestation = false } = options;

  try {
    // Verify inviter is primary or admin
    const inviterMembership = await PlanMembership.findByPoolAndUser(poolId, inviterUserId);
    if (!inviterMembership || !['primary', 'admin'].includes(inviterMembership.role)) {
      throw new Error('Only plan owner or admin can invite users');
    }

    // Check age attestation
    if (!ageAttestation) {
      throw new Error('Age attestation is required to invite users');
    }

    // Check pool capacity
    const canAdd = await PlanMembership.canAddUser(poolId);
    if (!canAdd) {
      throw new Error('Plan has reached maximum user capacity');
    }

    // Check if email already has pending invitation
    const hasPending = await PlanInvitation.hasPendingInvitation(poolId, inviteeEmail);
    if (hasPending) {
      throw new Error('User already has a pending invitation');
    }

    // Check if user is already a member
    const isAlreadyMember = await PlanInvitation.isAlreadyMember(poolId, inviteeEmail);
    if (isAlreadyMember) {
      throw new Error('User is already a member of this plan');
    }

    // Create invitation
    const invitation = await PlanInvitation.create({
      poolId,
      email: inviteeEmail,
      invitedBy: inviterUserId,
      inviterAgeAttestation: ageAttestation,
      personalMessage
    });

    // Log audit
    await UserAuditLog.logAccess({
      accessorUserId: inviterUserId,
      accessorRole: inviterMembership.role,
      actionType: UserAuditLog.AUDIT_ACTIONS.VIEW_PLAN_MEMBERS,
      targetType: UserAuditLog.TARGET_TYPES.PLAN,
      targetId: poolId,
      accessContext: `Invited ${inviteeEmail} to plan`
    });

    logger.info('Plan invitation created', {
      poolId,
      inviterUserId,
      inviteeEmail,
      invitationId: invitation.id
    });

    return invitation;

  } catch (error) {
    logger.error('Failed to create invitation', {
      poolId,
      inviterUserId,
      inviteeEmail,
      error: error.message
    });
    throw error;
  }
}

/**
 * Accept an invitation and join a plan
 */
async function acceptInvitation(invitationToken, userId, options = {}) {
  const { acceptTerms = true, ageVerified = true, ipAddress = null, userAgent = null } = options;

  try {
    // Find invitation
    const invitation = await PlanInvitation.findByToken(invitationToken);
    if (!invitation) {
      throw new Error('Invalid invitation');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation has already been ${invitation.status}`);
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Verify user email matches invitation
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('Invitation email does not match your account');
    }

    // Verify age and terms
    if (!ageVerified) {
      throw new Error('Age verification is required');
    }

    if (!acceptTerms) {
      throw new Error('Terms acceptance is required');
    }

    // Check pool still has capacity
    const canAdd = await PlanMembership.canAddUser(invitation.poolId);
    if (!canAdd) {
      throw new Error('Plan has reached maximum user capacity');
    }

    // Accept invitation
    await PlanInvitation.accept(invitation.id, userId);

    // Create membership
    const pool = await SharedTokenPool.findById(invitation.poolId);
    const membership = await PlanMembership.create({
      poolId: invitation.poolId,
      userId,
      role: 'associated',
      status: 'active', // Will be validated by trigger
      ageVerified: true,
      ageVerifiedAt: new Date(),
      ageVerifiedBy: invitation.invitedBy, // Inviter attested
      ageVerificationMethod: 'subscriber_attestation',
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.createdAt,
      invitationAcceptedAt: new Date()
    });

    // Update user record
    await User.update(userId, {
      planType: pool.planType,
      isPlanPrimary: false,
      primaryPoolId: invitation.poolId,
      termsAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
      ageVerified: true,
      ageVerifiedAt: new Date(),
      minAgeAcknowledged: true,
      minAgeAcknowledgedAt: new Date()
    });

    // Log terms acceptance
    await UserAuditLog.logTermsAcceptance(userId, 'associated_user', CURRENT_TERMS_VERSION, {
      ipAddress,
      userAgent,
      ageAttestationText: AGE_COMPLIANCE_TEXT
    });

    // Add to default community if exists
    const communityResult = await database.query(
      'SELECT community_id FROM plan_default_communities WHERE pool_id = $1',
      [invitation.poolId]
    );

    if (communityResult.rows.length > 0) {
      await Community.addMember(communityResult.rows[0].community_id, userId, 'member');
    }

    logger.info('Invitation accepted', {
      invitationId: invitation.id,
      userId,
      poolId: invitation.poolId
    });

    return membership;

  } catch (error) {
    logger.error('Failed to accept invitation', {
      invitationToken: invitationToken.substring(0, 8) + '...',
      userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Remove a user from a plan
 */
async function removeUser(poolId, removerUserId, targetUserId) {
  try {
    // Verify remover is primary or admin
    const removerMembership = await PlanMembership.findByPoolAndUser(poolId, removerUserId);
    if (!removerMembership || !['primary', 'admin'].includes(removerMembership.role)) {
      throw new Error('Only plan owner or admin can remove users');
    }

    // Get target membership
    const targetMembership = await PlanMembership.findByPoolAndUser(poolId, targetUserId);
    if (!targetMembership) {
      throw new Error('User is not a member of this plan');
    }

    // Cannot remove primary owner
    if (targetMembership.role === 'primary') {
      throw new Error('Cannot remove the primary plan owner');
    }

    // Remove membership
    await PlanMembership.remove(targetMembership.id);

    // Remove from default community
    const communityResult = await database.query(
      'SELECT community_id FROM plan_default_communities WHERE pool_id = $1',
      [poolId]
    );

    if (communityResult.rows.length > 0) {
      await Community.removeMember(communityResult.rows[0].community_id, targetUserId);
    }

    // Update user record
    await User.update(targetUserId, {
      planType: 'visitor',
      isPlanPrimary: false,
      primaryPoolId: null
    });

    // Log audit
    await UserAuditLog.logAccess({
      accessorUserId: removerUserId,
      accessorRole: removerMembership.role,
      actionType: UserAuditLog.AUDIT_ACTIONS.MODIFY_USER_DATA,
      targetType: UserAuditLog.TARGET_TYPES.USER,
      targetUserId,
      accessContext: 'Removed user from plan'
    });

    logger.info('User removed from plan', { poolId, removerUserId, targetUserId });

    return true;

  } catch (error) {
    logger.error('Failed to remove user', {
      poolId,
      removerUserId,
      targetUserId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Use tokens from the shared pool
 */
async function useTokens(userId, tokens, usageType = 'chat', conversationId = null, messageId = null) {
  try {
    // Find user's pool
    const pool = await SharedTokenPool.findByUserId(userId);
    if (!pool) {
      // User doesn't have a plan - check if visitor with limited tokens
      return { success: false, reason: 'no_plan' };
    }

    // Check if pool is active
    if (!pool.isActive) {
      return { success: false, reason: 'plan_inactive' };
    }

    // Deduct tokens
    const success = await SharedTokenPool.deductTokens(
      pool.id,
      userId,
      tokens,
      usageType,
      conversationId,
      messageId
    );

    if (!success) {
      return { success: false, reason: 'insufficient_tokens' };
    }

    return {
      success: true,
      poolId: pool.id,
      remainingBalance: pool.currentBalance - tokens
    };

  } catch (error) {
    logger.error('Failed to use tokens', { userId, tokens, error: error.message });
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Purchase additional tokens
 */
async function purchaseTokens(userId, tokens, amountCents, paymentInfo = {}) {
  try {
    // Find user's pool
    const pool = await SharedTokenPool.findByUserId(userId);
    if (!pool) {
      throw new Error('User does not have an active plan');
    }

    // Verify user can purchase
    const canPurchase = await SharedTokenPool.canUserPurchaseTokens(pool.id, userId);
    if (!canPurchase) {
      throw new Error('Only the plan owner can purchase additional tokens');
    }

    // Add tokens
    const purchaseId = await SharedTokenPool.addPurchasedTokens(
      pool.id,
      userId,
      tokens,
      amountCents,
      paymentInfo.paymentMethodId,
      paymentInfo.stripePaymentIntentId
    );

    logger.info('Tokens purchased', {
      poolId: pool.id,
      userId,
      tokens,
      amountCents,
      purchaseId
    });

    return {
      success: true,
      purchaseId,
      tokensAdded: tokens,
      newBalance: pool.currentBalance + tokens
    };

  } catch (error) {
    logger.error('Failed to purchase tokens', {
      userId,
      tokens,
      amountCents,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get plan details for a user
 */
async function getPlanDetails(userId, requesterId = null) {
  try {
    const pool = await SharedTokenPool.findByUserId(userId);
    if (!pool) {
      return null;
    }

    const summary = await SharedTokenPool.getPoolSummary(pool.id);
    const members = await PlanMembership.findByPoolId(pool.id);
    const pendingInvitations = await PlanInvitation.findByPoolId(pool.id, { status: 'pending' });
    const capacity = await PlanMembership.getPoolCapacity(pool.id);

    // Log audit if different user is viewing
    if (requesterId && requesterId !== userId) {
      const requester = await User.findById(requesterId);
      await UserAuditLog.logAccess({
        accessorUserId: requesterId,
        accessorRole: requester?.role || 'unknown',
        actionType: UserAuditLog.AUDIT_ACTIONS.VIEW_PLAN_MEMBERS,
        targetType: UserAuditLog.TARGET_TYPES.PLAN,
        targetId: pool.id,
        targetUserId: userId,
        resultCount: members.length
      });
    }

    return {
      pool: summary.pool,
      balance: summary.balance,
      limits: summary.limits,
      members,
      pendingInvitations,
      capacity,
      usageByUser: summary.usageByUser
    };

  } catch (error) {
    logger.error('Failed to get plan details', { userId, error: error.message });
    throw error;
  }
}

/**
 * Upgrade or downgrade plan
 */
async function changePlanType(userId, newPlanType) {
  try {
    const pool = await SharedTokenPool.findByPrimaryUser(userId);
    if (!pool) {
      throw new Error('User does not own a plan');
    }

    const currentMemberCount = await PlanMembership.countByPoolId(pool.id, ['active', 'pending']);

    // Get new limits
    const limitsResult = await database.query(
      'SELECT max_users FROM plan_type_limits WHERE plan_type = $1',
      [newPlanType]
    );

    if (!limitsResult.rows[0]) {
      throw new Error('Invalid plan type');
    }

    const newMaxUsers = limitsResult.rows[0].max_users;

    // Check if downgrade would exceed new limits
    if (currentMemberCount > newMaxUsers) {
      throw new Error(`Cannot downgrade: plan has ${currentMemberCount} members but ${newPlanType} only allows ${newMaxUsers}`);
    }

    // Update pool
    await SharedTokenPool.updatePlanType(pool.id, newPlanType);

    // Update primary user
    await User.update(userId, { planType: newPlanType });

    // Update all member users
    const members = await PlanMembership.findByPoolId(pool.id);
    for (const member of members) {
      await User.update(member.userId, { planType: newPlanType });
    }

    // Handle default community
    const communityResult = await database.query(
      'SELECT community_id FROM plan_default_communities WHERE pool_id = $1',
      [pool.id]
    );

    if (['ministry', 'business', 'enterprise'].includes(newPlanType)) {
      // Need a default community
      if (communityResult.rows.length === 0) {
        await createDefaultCommunity(pool.id, userId, newPlanType);
      }
    } else {
      // Single-user plan - remove default community link (community itself remains)
      if (communityResult.rows.length > 0) {
        await database.query('DELETE FROM plan_default_communities WHERE pool_id = $1', [pool.id]);
      }
    }

    logger.info('Plan type changed', {
      poolId: pool.id,
      userId,
      oldType: pool.planType,
      newType: newPlanType
    });

    return await SharedTokenPool.findById(pool.id);

  } catch (error) {
    logger.error('Failed to change plan type', {
      userId,
      newPlanType,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get user's current token balance
 */
async function getTokenBalance(userId) {
  const pool = await SharedTokenPool.findByUserId(userId);
  if (!pool) {
    return null;
  }

  return await SharedTokenPool.getBalance(pool.id);
}

/**
 * Check if user has sufficient tokens
 */
async function hasTokens(userId, tokensNeeded) {
  const pool = await SharedTokenPool.findByUserId(userId);
  if (!pool) {
    return false;
  }

  return await SharedTokenPool.hasSufficientTokens(pool.id, tokensNeeded);
}

module.exports = {
  // Constants
  CURRENT_TERMS_VERSION,
  AGE_COMPLIANCE_TEXT,
  SUBSCRIBER_AGE_RESPONSIBILITY_TEXT,

  // Plan lifecycle
  initializePlan,
  changePlanType,

  // User management
  inviteUser,
  acceptInvitation,
  removeUser,

  // Token operations
  useTokens,
  purchaseTokens,
  getTokenBalance,
  hasTokens,

  // Plan info
  getPlanDetails
};
