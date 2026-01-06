/**
 * Hospitality Service
 * Handles engagement tracking, event processing, state management,
 * and coordination with the rule engine for hospitality actions.
 */

const logger = require('../utils/logger');
const { Hospitality } = require('../models');

// ============================================
// Engagement Score Constants
// High weight for chat interactions as per requirements
// ============================================
const SCORE_WEIGHTS = {
  PAGE_VIEW: 5,          // +5 per page view (max 25)
  PAGE_VIEW_MAX: 25,
  TIME_ON_SITE: 1,       // +1 per 30 seconds (max 25)
  TIME_ON_SITE_MAX: 25,
  SESSION_COUNT: 10,     // +10 per session (max 30)
  SESSION_COUNT_MAX: 30,
  CHAT_START: 20,        // +20 for starting a chat (high weight)
  CHAT_MESSAGE: 5,       // +5 per message
  PRAYER_REQUEST: 15,    // +15 for prayer requests
  STUDY_INTERACTION: 10, // +10 for Bible study interactions
  SCROLL_DEPTH_BONUS: 5  // +5 for deep scrolling (>75%)
};

const FUNNEL_THRESHOLDS = {
  INTERESTED: 20,  // Score to move from visitor to interested
  ENGAGED: 40,     // Score to move to engaged
  SUBSCRIBER: 60,  // Score after subscribing
  ADVOCATE: 80     // High engagement after subscription
};

// ============================================
// Event Tracking
// ============================================

/**
 * Track a user engagement event
 * @param {Object} eventData - Event data from client
 * @returns {Object} Created event
 */
async function trackEvent(eventData) {
  logger.debug('Tracking hospitality event', {
    type: eventData.eventType,
    userId: eventData.userId,
    sessionId: eventData.sessionId
  });

  try {
    // Ensure user state exists
    const identifier = {
      userId: eventData.userId || null,
      sessionId: eventData.sessionId || null
    };

    await Hospitality.getOrCreateUserState(identifier);

    // Create event record
    const event = await Hospitality.createEvent(eventData);

    // Update user state based on event
    await updateUserStateFromEvent(identifier, eventData);

    // Return event for rule engine processing
    return event;
  } catch (error) {
    logger.error('Failed to track hospitality event', {
      error: error.message,
      eventType: eventData.eventType
    });
    throw error;
  }
}

/**
 * Update user state based on incoming event
 */
async function updateUserStateFromEvent(identifier, eventData) {
  const state = await Hospitality.getOrCreateUserState(identifier);

  const updates = {
    lastActivityAt: new Date(),
    lastPageUrl: eventData.pageUrl || state.lastPageUrl
  };

  // Track persona context
  if (eventData.personaId) {
    updates.lastPersonaId = eventData.personaId;
  }

  // Handle different event types
  switch (eventData.eventType) {
    case 'page_view':
      await Hospitality.incrementUserStateCounters(identifier, { pageViews: 1 });
      break;

    case 'time_on_page':
      if (eventData.metricValue) {
        await Hospitality.incrementUserStateCounters(identifier, {
          totalTimeOnSiteSeconds: eventData.metricValue
        });
      }
      break;

    case 'session_start':
      updates.sessionCount = (state.sessionCount || 0) + 1;
      updates.currentSessionStart = new Date();
      break;
  }

  // Calculate new engagement score
  const newScore = await calculateEngagementScore(identifier, state, eventData);
  updates.engagementScore = newScore;

  // Update funnel stage based on score
  updates.funnelStage = determineFunnelStage(newScore, state.funnelStage);

  // Apply updates
  await Hospitality.updateUserState(identifier, updates);
}

/**
 * Calculate engagement score based on user activity
 * Uses high weight for chat interactions
 */
async function calculateEngagementScore(identifier, state, latestEvent) {
  let score = 0;

  // Get current state values
  const pageViews = state?.pageViews || 0;
  const timeOnSite = state?.totalTimeOnSiteSeconds || 0;
  const sessions = state?.sessionCount || 1;

  // Page views contribution (max 25 points)
  score += Math.min(pageViews * SCORE_WEIGHTS.PAGE_VIEW, SCORE_WEIGHTS.PAGE_VIEW_MAX);

  // Time on site contribution (max 25 points)
  const timeScore = Math.floor(timeOnSite / 30) * SCORE_WEIGHTS.TIME_ON_SITE;
  score += Math.min(timeScore, SCORE_WEIGHTS.TIME_ON_SITE_MAX);

  // Session count contribution (max 30 points)
  score += Math.min(sessions * SCORE_WEIGHTS.SESSION_COUNT, SCORE_WEIGHTS.SESSION_COUNT_MAX);

  // Event-specific bonuses (high weight for chat)
  if (latestEvent) {
    switch (latestEvent.eventType) {
      case 'chat_start':
        score += SCORE_WEIGHTS.CHAT_START;
        break;
      case 'chat_message':
        score += SCORE_WEIGHTS.CHAT_MESSAGE;
        break;
      case 'prayer_request':
        score += SCORE_WEIGHTS.PRAYER_REQUEST;
        break;
      case 'study_interaction':
        score += SCORE_WEIGHTS.STUDY_INTERACTION;
        break;
      case 'scroll_depth':
        if (latestEvent.metricValue >= 75) {
          score += SCORE_WEIGHTS.SCROLL_DEPTH_BONUS;
        }
        break;
    }
  }

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Determine funnel stage based on engagement score
 */
function determineFunnelStage(score, currentStage) {
  // Don't downgrade from subscriber/advocate stages
  if (currentStage === 'subscriber' || currentStage === 'advocate') {
    if (score >= FUNNEL_THRESHOLDS.ADVOCATE) {
      return 'advocate';
    }
    return currentStage;
  }

  if (score >= FUNNEL_THRESHOLDS.ENGAGED) {
    return 'engaged';
  } else if (score >= FUNNEL_THRESHOLDS.INTERESTED) {
    return 'interested';
  }

  return 'visitor';
}

// ============================================
// User State Management
// ============================================

/**
 * Get user's current hospitality state
 */
async function getUserState(identifier) {
  if (identifier.userId) {
    return await Hospitality.findUserStateByUserId(identifier.userId);
  }
  return await Hospitality.findUserStateBySessionId(identifier.sessionId);
}

/**
 * Migrate anonymous session state to authenticated user
 * Called when a visitor logs in or registers
 */
async function migrateSessionToUser(sessionId, userId) {
  try {
    const sessionState = await Hospitality.findUserStateBySessionId(sessionId);
    if (!sessionState) return null;

    const userState = await Hospitality.findUserStateByUserId(userId);

    if (userState) {
      // Merge states - take the higher values
      const updates = {
        pageViews: Math.max(userState.pageViews, sessionState.pageViews),
        sessionCount: userState.sessionCount + sessionState.sessionCount,
        totalTimeOnSiteSeconds: userState.totalTimeOnSiteSeconds + sessionState.totalTimeOnSiteSeconds,
        engagementScore: Math.max(userState.engagementScore, sessionState.engagementScore),
        lastActivityAt: new Date()
      };

      await Hospitality.updateUserState({ userId }, updates);
    } else {
      // Transfer session state to user
      await Hospitality.updateUserState({ sessionId }, {
        userId,
        sessionId: null
      });
    }

    logger.info('Migrated hospitality session to user', { sessionId, userId });
    return await Hospitality.findUserStateByUserId(userId);
  } catch (error) {
    logger.error('Failed to migrate hospitality session', {
      error: error.message,
      sessionId,
      userId
    });
    return null;
  }
}

/**
 * Upgrade user funnel stage to subscriber
 * Called when user completes subscription
 */
async function upgradeToSubscriber(userId) {
  try {
    await Hospitality.updateUserState({ userId }, {
      funnelStage: 'subscriber'
    });
    logger.info('Upgraded user to subscriber funnel stage', { userId });
  } catch (error) {
    logger.error('Failed to upgrade user to subscriber', {
      error: error.message,
      userId
    });
  }
}

// ============================================
// Popup/Action Recording
// ============================================

/**
 * Record that a popup was shown
 */
async function recordPopupShown(identifier, popupType, actionId) {
  try {
    await Hospitality.incrementUserStateCounters(identifier, {
      popupsShownToday: 1
    });

    await Hospitality.updateUserState(identifier, {
      lastPopupShownAt: new Date(),
      lastPopupType: popupType
    });

    if (actionId) {
      await Hospitality.updateActionOutcome(actionId, 'shown');
    }

    logger.debug('Recorded popup shown', { identifier, popupType, actionId });
  } catch (error) {
    logger.error('Failed to record popup shown', { error: error.message });
  }
}

/**
 * Record popup dismissal
 */
async function recordPopupDismissed(identifier, actionId) {
  try {
    await Hospitality.incrementUserStateCounters(identifier, {
      popupsDismissedToday: 1
    });

    if (actionId) {
      await Hospitality.updateActionOutcome(actionId, 'dismissed');
    }

    logger.debug('Recorded popup dismissed', { identifier, actionId });
  } catch (error) {
    logger.error('Failed to record popup dismissed', { error: error.message });
  }
}

/**
 * Record popup click/conversion
 */
async function recordPopupClicked(identifier, actionId) {
  try {
    if (actionId) {
      await Hospitality.updateActionOutcome(actionId, 'clicked');
    }

    logger.debug('Recorded popup clicked', { identifier, actionId });
  } catch (error) {
    logger.error('Failed to record popup clicked', { error: error.message });
  }
}

/**
 * Record conversion from hospitality action
 */
async function recordConversion(identifier, actionId) {
  try {
    if (actionId) {
      await Hospitality.updateActionOutcome(actionId, 'converted');
    }

    logger.info('Recorded hospitality conversion', { identifier, actionId });
  } catch (error) {
    logger.error('Failed to record conversion', { error: error.message });
  }
}

// ============================================
// Pending Action Checks
// ============================================

/**
 * Check if user should see a hospitality popup
 * Returns the next pending action if available and allowed
 */
async function checkForPendingAction(identifier) {
  try {
    const state = await getUserState(identifier);

    if (!state) return null;

    // Check global cooldown
    if (state.globalCooldownUntil && new Date(state.globalCooldownUntil) > new Date()) {
      return null;
    }

    // Check daily popup limit (max 5 per day)
    if (state.popupsShownToday >= 5) {
      return null;
    }

    // Get pending actions
    const pendingActions = await Hospitality.getPendingActions(identifier, 1);

    if (pendingActions.length === 0) return null;

    return pendingActions[0];
  } catch (error) {
    logger.error('Failed to check for pending action', { error: error.message });
    return null;
  }
}

/**
 * Set global cooldown for a user (e.g., after multiple dismissals)
 */
async function setGlobalCooldown(identifier, seconds = 3600) {
  const cooldownUntil = new Date(Date.now() + seconds * 1000);

  await Hospitality.updateUserState(identifier, {
    globalCooldownUntil: cooldownUntil
  });

  logger.debug('Set global hospitality cooldown', { identifier, seconds });
}

// ============================================
// Admin Dashboard Data
// ============================================

/**
 * Get visitor hospitality dashboard data
 */
async function getVisitorDashboard(options = {}) {
  return await Hospitality.getVisitorStats(options);
}

/**
 * Get subscriber hospitality dashboard data
 */
async function getSubscriberDashboard(options = {}) {
  return await Hospitality.getSubscriberStats(options);
}

/**
 * Get rule performance statistics
 */
async function getRulePerformance() {
  return await Hospitality.getRuleStats();
}

/**
 * Get hospitality system health metrics
 */
async function getSystemHealth() {
  try {
    // Get counts of various entities
    const result = await Promise.all([
      Hospitality.findAllActiveRules(),
      Hospitality.getRecentActions({ limit: 1 })
    ]);

    return {
      activeRules: result[0].length,
      recentActionCount: result[1].length,
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get hospitality system health', { error: error.message });
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================
// Module Exports
// ============================================

module.exports = {
  // Event tracking
  trackEvent,

  // User state
  getUserState,
  migrateSessionToUser,
  upgradeToSubscriber,

  // Popup/action recording
  recordPopupShown,
  recordPopupDismissed,
  recordPopupClicked,
  recordConversion,

  // Pending action checks
  checkForPendingAction,
  setGlobalCooldown,

  // Admin dashboards
  getVisitorDashboard,
  getSubscriberDashboard,
  getRulePerformance,
  getSystemHealth,

  // Constants (exported for testing)
  SCORE_WEIGHTS,
  FUNNEL_THRESHOLDS
};
