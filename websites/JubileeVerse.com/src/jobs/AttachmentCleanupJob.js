/**
 * Attachment Cleanup Job
 * Scheduled job to clean up expired attachments based on retention policy
 */

const { AttachmentService } = require('../services');
const logger = require('../utils/logger');

/**
 * Default cleanup interval (24 hours in milliseconds)
 */
const DEFAULT_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * Job state
 */
let cleanupInterval = null;
let isRunning = false;
let lastRunAt = null;
let lastRunResult = null;

/**
 * Run the cleanup job
 */
async function runCleanup() {
  if (isRunning) {
    logger.warn('Attachment cleanup job is already running, skipping');
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  logger.info('Starting attachment cleanup job');

  try {
    const result = await AttachmentService.cleanupExpiredAttachments();

    lastRunAt = new Date();
    lastRunResult = {
      success: true,
      ...result
    };

    logger.info('Attachment cleanup job completed', result);

    return result;
  } catch (error) {
    logger.error('Attachment cleanup job failed', { error: error.message });

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
 * Start the scheduled cleanup job
 */
function start(intervalMs = DEFAULT_CLEANUP_INTERVAL) {
  if (cleanupInterval) {
    logger.warn('Attachment cleanup job already started');
    return;
  }

  logger.info('Starting attachment cleanup job scheduler', { intervalMs });

  // Run immediately on start
  runCleanup().catch(err => {
    logger.error('Initial cleanup failed', { error: err.message });
  });

  // Schedule periodic runs
  cleanupInterval = setInterval(() => {
    runCleanup().catch(err => {
      logger.error('Scheduled cleanup failed', { error: err.message });
    });
  }, intervalMs);

  return {
    intervalMs,
    message: 'Cleanup job started'
  };
}

/**
 * Stop the scheduled cleanup job
 */
function stop() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Attachment cleanup job stopped');
  }
  return { stopped: true };
}

/**
 * Get job status
 */
function getStatus() {
  return {
    isScheduled: !!cleanupInterval,
    isRunning,
    lastRunAt,
    lastRunResult
  };
}

/**
 * Manually trigger a cleanup run
 */
async function triggerCleanup() {
  logger.info('Manual cleanup triggered');
  return await runCleanup();
}

module.exports = {
  start,
  stop,
  getStatus,
  triggerCleanup,
  runCleanup,
  DEFAULT_CLEANUP_INTERVAL
};
