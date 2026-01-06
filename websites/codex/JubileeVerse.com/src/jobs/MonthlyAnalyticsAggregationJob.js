/**
 * Monthly Analytics Aggregation Job
 * Scheduled job to aggregate user conversation analytics
 *
 * Daily: Recalculate current month for all active users
 * Monthly (1st of month): Finalize previous month (make immutable)
 *
 * Privacy Enforcement:
 * - Only aggregates non-private conversations (is_private = FALSE)
 * - Only processes users with analytics_consent = TRUE
 * - Users who revoke consent have their analytics purged
 */

const UserMonthlyAnalytics = require('../models/UserMonthlyAnalytics');
const database = require('../database');
const logger = require('../utils/logger');

/**
 * Default aggregation interval (24 hours in milliseconds)
 */
const DEFAULT_AGGREGATION_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * Job state
 */
let aggregationInterval = null;
let isRunning = false;
let lastRunAt = null;
let lastRunResult = null;

/**
 * Get current year-month string (YYYY-MM)
 */
function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get previous year-month string (YYYY-MM)
 */
function getPreviousYearMonth() {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check if today is the first of the month
 */
function isFirstOfMonth() {
  return new Date().getDate() === 1;
}

/**
 * Purge analytics for users who have revoked consent
 * This ensures compliance with privacy requirements
 */
async function purgeRevokedConsentAnalytics() {
  const results = {
    analysisRowsPurged: 0,
    monthlyRowsPurged: 0,
    usersAffected: 0
  };

  try {
    // Find users who have analytics data but have revoked consent
    const usersToClean = await database.query(`
      SELECT DISTINCT u.id
      FROM users u
      WHERE u.analytics_consent = FALSE
        AND (
          EXISTS (SELECT 1 FROM conversation_analysis ca WHERE ca.user_id = u.id)
          OR EXISTS (SELECT 1 FROM user_monthly_analytics uma WHERE uma.user_id = u.id)
        )
    `);

    results.usersAffected = usersToClean.rows.length;

    if (results.usersAffected === 0) {
      return results;
    }

    const userIds = usersToClean.rows.map(r => r.id);

    // Purge conversation_analysis for these users
    const analysisResult = await database.query(`
      DELETE FROM conversation_analysis
      WHERE user_id = ANY($1)
    `, [userIds]);
    results.analysisRowsPurged = analysisResult.rowCount;

    // Purge user_monthly_analytics for these users
    const monthlyResult = await database.query(`
      DELETE FROM user_monthly_analytics
      WHERE user_id = ANY($1)
    `, [userIds]);
    results.monthlyRowsPurged = monthlyResult.rowCount;

    logger.info('Purged analytics for users who revoked consent', results);

    return results;

  } catch (error) {
    logger.error('Failed to purge revoked consent analytics', { error: error.message });
    throw error;
  }
}

/**
 * Purge analysis for conversations marked private
 * This ensures private conversations have NO analytics stored
 */
async function purgePrivateConversationAnalytics() {
  const results = {
    rowsPurged: 0,
    conversationsAffected: 0
  };

  try {
    // Find and delete analysis for private conversations
    const result = await database.query(`
      DELETE FROM conversation_analysis ca
      USING conversations c
      WHERE ca.conversation_id = c.id
        AND c.is_private = TRUE
      RETURNING ca.conversation_id
    `);

    results.rowsPurged = result.rowCount;
    results.conversationsAffected = new Set(result.rows.map(r => r.conversation_id)).size;

    if (results.rowsPurged > 0) {
      logger.info('Purged analytics for private conversations', results);
    }

    return results;

  } catch (error) {
    logger.error('Failed to purge private conversation analytics', { error: error.message });
    throw error;
  }
}

/**
 * Run the aggregation job
 */
async function runAggregation() {
  if (isRunning) {
    logger.warn('Analytics aggregation job is already running, skipping');
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  const startTime = Date.now();
  logger.info('Starting analytics aggregation job');

  try {
    const currentYearMonth = getCurrentYearMonth();
    const results = {
      yearMonth: currentYearMonth,
      usersProcessed: 0,
      usersSucceeded: 0,
      usersFailed: 0,
      previousMonthFinalized: false,
      privacyEnforcement: {
        revokedConsentPurge: null,
        privateConversationPurge: null
      },
      errors: []
    };

    // === PRIVACY ENFORCEMENT ===
    // Step 1: Purge analytics for users who have revoked consent
    try {
      const revokedPurge = await purgeRevokedConsentAnalytics();
      results.privacyEnforcement.revokedConsentPurge = revokedPurge;
      if (revokedPurge.usersAffected > 0) {
        logger.info('Consent revocation cleanup completed', revokedPurge);
      }
    } catch (purgeError) {
      logger.error('Failed consent revocation cleanup', { error: purgeError.message });
      results.errors.push({
        type: 'consent_purge_error',
        error: purgeError.message
      });
    }

    // Step 2: Purge analytics for conversations marked private
    try {
      const privatePurge = await purgePrivateConversationAnalytics();
      results.privacyEnforcement.privateConversationPurge = privatePurge;
      if (privatePurge.rowsPurged > 0) {
        logger.info('Private conversation cleanup completed', privatePurge);
      }
    } catch (purgeError) {
      logger.error('Failed private conversation cleanup', { error: purgeError.message });
      results.errors.push({
        type: 'private_purge_error',
        error: purgeError.message
      });
    }

    // On the first of the month, finalize previous month
    if (isFirstOfMonth()) {
      const previousYearMonth = getPreviousYearMonth();
      logger.info('First of month - finalizing previous month analytics', { previousYearMonth });

      try {
        const finalizeResult = await UserMonthlyAnalytics.finalizeMonth(previousYearMonth);
        results.previousMonthFinalized = true;
        results.previousMonth = previousYearMonth;
        results.finalizedCount = finalizeResult.count;
        logger.info('Previous month finalized', { previousYearMonth, count: finalizeResult.count });
      } catch (finalizeError) {
        logger.error('Failed to finalize previous month', {
          previousYearMonth,
          error: finalizeError.message
        });
        results.errors.push({
          type: 'finalize_error',
          yearMonth: previousYearMonth,
          error: finalizeError.message
        });
      }
    }

    // Get all users with analytics data in the current month
    const usersWithData = await UserMonthlyAnalytics.getUsersForMonth(currentYearMonth);
    results.usersProcessed = usersWithData.length;

    logger.info('Processing user analytics', {
      yearMonth: currentYearMonth,
      userCount: usersWithData.length
    });

    // Process each user
    for (const userId of usersWithData) {
      try {
        await UserMonthlyAnalytics.calculateAndUpsert(userId, currentYearMonth);
        results.usersSucceeded++;
      } catch (userError) {
        results.usersFailed++;
        results.errors.push({
          type: 'user_aggregation_error',
          userId,
          error: userError.message
        });
        logger.error('Failed to aggregate user analytics', {
          userId,
          yearMonth: currentYearMonth,
          error: userError.message
        });
      }
    }

    const processingTimeMs = Date.now() - startTime;
    results.processingTimeMs = processingTimeMs;

    lastRunAt = new Date();
    lastRunResult = {
      success: true,
      ...results
    };

    logger.info('Analytics aggregation job completed', {
      yearMonth: currentYearMonth,
      usersProcessed: results.usersProcessed,
      usersSucceeded: results.usersSucceeded,
      usersFailed: results.usersFailed,
      processingTimeMs
    });

    return results;

  } catch (error) {
    logger.error('Analytics aggregation job failed', { error: error.message });

    lastRunAt = new Date();
    lastRunResult = {
      success: false,
      error: error.message
    };

    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled aggregation job
 * @param {number} intervalMs - Interval in milliseconds (default: 24 hours)
 */
function start(intervalMs = DEFAULT_AGGREGATION_INTERVAL) {
  if (aggregationInterval) {
    logger.warn('Analytics aggregation job already started');
    return;
  }

  logger.info('Starting analytics aggregation job scheduler', { intervalMs });

  // Run on start if it's past midnight (typical cron-like behavior)
  const now = new Date();
  const hourOfDay = now.getHours();

  // Run immediately if it's between 2 AM and 4 AM (typical quiet hours)
  if (hourOfDay >= 2 && hourOfDay <= 4) {
    runAggregation().catch(err => {
      logger.error('Initial aggregation failed', { error: err.message });
    });
  }

  // Schedule periodic runs
  aggregationInterval = setInterval(() => {
    // Only run during the scheduled window (2-4 AM local time)
    const currentHour = new Date().getHours();
    if (currentHour >= 2 && currentHour <= 4) {
      runAggregation().catch(err => {
        logger.error('Scheduled aggregation failed', { error: err.message });
      });
    }
  }, intervalMs);

  return {
    intervalMs,
    message: 'Analytics aggregation job started'
  };
}

/**
 * Stop the scheduled aggregation job
 */
function stop() {
  if (aggregationInterval) {
    clearInterval(aggregationInterval);
    aggregationInterval = null;
    logger.info('Analytics aggregation job stopped');
  }
  return { stopped: true };
}

/**
 * Get job status
 */
function getStatus() {
  return {
    isScheduled: !!aggregationInterval,
    isRunning,
    lastRunAt,
    lastRunResult,
    currentYearMonth: getCurrentYearMonth()
  };
}

/**
 * Manually trigger an aggregation run
 * @param {string} yearMonth - Optional specific year-month to aggregate (YYYY-MM)
 */
async function triggerAggregation(yearMonth = null) {
  const targetMonth = yearMonth || getCurrentYearMonth();

  logger.info('Manual aggregation triggered', { yearMonth: targetMonth });

  if (yearMonth && yearMonth !== getCurrentYearMonth()) {
    // Aggregate a specific month
    return await aggregateMonth(targetMonth);
  }

  return await runAggregation();
}

/**
 * Aggregate a specific month for all users with data
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 */
async function aggregateMonth(yearMonth) {
  const startTime = Date.now();

  logger.info('Aggregating specific month', { yearMonth });

  const results = {
    yearMonth,
    usersProcessed: 0,
    usersSucceeded: 0,
    usersFailed: 0,
    errors: []
  };

  try {
    const usersWithData = await UserMonthlyAnalytics.getUsersForMonth(yearMonth);
    results.usersProcessed = usersWithData.length;

    for (const userId of usersWithData) {
      try {
        await UserMonthlyAnalytics.calculateAndUpsert(userId, yearMonth);
        results.usersSucceeded++;
      } catch (userError) {
        results.usersFailed++;
        results.errors.push({
          userId,
          error: userError.message
        });
      }
    }

    results.processingTimeMs = Date.now() - startTime;

    logger.info('Month aggregation completed', results);

    return results;
  } catch (error) {
    logger.error('Month aggregation failed', { yearMonth, error: error.message });
    throw error;
  }
}

/**
 * Manually finalize a specific month
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 */
async function finalizeMonth(yearMonth) {
  logger.info('Manual finalization triggered', { yearMonth });

  const result = await UserMonthlyAnalytics.finalizeMonth(yearMonth);

  logger.info('Month finalized', { yearMonth, count: result.count });

  return result;
}

module.exports = {
  start,
  stop,
  getStatus,
  triggerAggregation,
  runAggregation,
  aggregateMonth,
  finalizeMonth,
  purgeRevokedConsentAnalytics,
  purgePrivateConversationAnalytics,
  DEFAULT_AGGREGATION_INTERVAL
};
