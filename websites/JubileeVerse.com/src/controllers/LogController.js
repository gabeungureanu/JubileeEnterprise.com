/**
 * Log Controller
 * Provides API endpoints for viewing and managing system logs
 */

const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get logs from in-memory store
 * GET /api/logs
 */
const getLogs = asyncHandler(async (req, res) => {
  const { limit = 100, level, search } = req.query;

  const logs = logger.getLogs({
    limit: parseInt(limit) || 100,
    level: level || null,
    search: search || null
  });

  res.json({
    success: true,
    logs,
    total: logs.length
  });
});

/**
 * Clear all logs from store
 * POST /api/logs/clear
 */
const clearLogs = asyncHandler(async (req, res) => {
  logger.clearLogs();
  logger.info('Logs cleared by user');

  res.json({
    success: true,
    message: 'Logs cleared successfully'
  });
});

/**
 * Render logs page
 * GET /logs
 */
const logsPage = asyncHandler(async (req, res) => {
  res.sendFile('logs.html', { root: './views/pages' });
});

module.exports = {
  getLogs,
  clearLogs,
  logsPage
};
