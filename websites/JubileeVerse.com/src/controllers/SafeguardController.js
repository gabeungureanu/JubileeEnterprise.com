/**
 * SafeguardController
 * Admin endpoints for safety review, alerting, and persona performance
 *
 * ACCESS CONTROL:
 * - All endpoints require authentication
 * - Most endpoints require safety_reviewer, admin, or superadmin role
 * - Detail access is logged for audit
 *
 * PURPOSE:
 * - Review and accountability tooling (NOT punitive enforcement)
 * - Protect users and ensure responsible platform operation
 * - Enable continuous improvement of safety policies
 */

const logger = require('../utils/logger');
const SafeguardService = require('../services/SafeguardService');
const SafeguardFlag = require('../models/SafeguardFlag');
const AdminAlert = require('../models/AdminAlert');
const PersonaPerformance = require('../models/PersonaPerformance');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Roles that can access safeguard features
const SAFEGUARD_ROLES = ['safety_reviewer', 'counselor', 'admin', 'superadmin', 'moderator'];

/**
 * Middleware to check safeguard access
 */
function requireSafeguardAccess(req, res, next) {
  const userRole = req.session?.user?.role || 'user';
  if (!SAFEGUARD_ROLES.includes(userRole)) {
    throw new AppError('Insufficient permissions for safeguard access', 403);
  }
  next();
}

// ============================================
// ALERT MANAGEMENT
// ============================================

/**
 * Get active alerts with filters
 * GET /api/admin/safeguard/alerts
 *
 * Query:
 *   status: string[] (optional - filter by status)
 *   severity: string[] (optional - filter by severity)
 *   category: string (optional - filter by category)
 *   limit: number (default 50)
 *   offset: number (default 0)
 */
const getAlerts = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const {
    status,
    severity,
    category,
    limit = 50,
    offset = 0
  } = req.query;

  const alerts = await AdminAlert.findActive({
    status: status ? status.split(',') : null,
    severity: severity ? severity.split(',') : null,
    category,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  const counts = await AdminAlert.countActive();

  res.json({
    success: true,
    alerts,
    counts,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: alerts.length === parseInt(limit)
    }
  });
});

/**
 * Get urgent alerts requiring immediate attention
 * GET /api/admin/safeguard/alerts/urgent
 */
const getUrgentAlerts = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const alerts = await AdminAlert.getUrgent();

  res.json({
    success: true,
    alerts,
    count: alerts.length
  });
});

/**
 * Get alert details
 * GET /api/admin/safeguard/alerts/:alertId
 */
const getAlertDetails = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { alertId } = req.params;

  const alert = await AdminAlert.findById(alertId);
  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  // Mark as viewed
  await AdminAlert.markViewed(alertId, userId);

  // Log access
  await AdminAlert.logDetailAccess(
    alertId,
    userId,
    'view_summary',
    true,
    null,
    req.ip,
    req.get('User-Agent')
  );

  res.json({
    success: true,
    alert
  });
});

/**
 * Request detail access for an alert (requires authorization check)
 * POST /api/admin/safeguard/alerts/:alertId/request-detail
 */
const requestAlertDetailAccess = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { alertId } = req.params;

  const authCheck = await AdminAlert.checkAuthorization(alertId, userId);

  // Log the access attempt
  await AdminAlert.logDetailAccess(
    alertId,
    userId,
    'view_detail',
    authCheck.authorized,
    authCheck.reason || null,
    req.ip,
    req.get('User-Agent')
  );

  if (!authCheck.authorized) {
    throw new AppError(
      `Insufficient authorization: ${authCheck.reason}. Required: ${authCheck.required}, Current: ${authCheck.current}`,
      403
    );
  }

  // Get safety flag details if authorized
  const alert = await AdminAlert.findById(alertId);
  let safetyFlag = null;
  if (alert?.safetyFlagId) {
    safetyFlag = await SafeguardFlag.findById(alert.safetyFlagId);
  }

  res.json({
    success: true,
    authorized: true,
    alert,
    safetyFlag,
    // Note: Still no raw conversation text - that requires separate secure review
    note: 'Full conversation review requires secure review mode'
  });
});

/**
 * Acknowledge an alert
 * POST /api/admin/safeguard/alerts/:alertId/acknowledge
 */
const acknowledgeAlert = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { alertId } = req.params;

  const alert = await AdminAlert.acknowledge(alertId, userId);
  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  // Log action
  await AdminAlert.logDetailAccess(alertId, userId, 'acknowledge', true, null, req.ip, req.get('User-Agent'));

  logger.info('Alert acknowledged', { alertId, acknowledgedBy: userId });

  res.json({
    success: true,
    alert
  });
});

/**
 * Resolve an alert
 * POST /api/admin/safeguard/alerts/:alertId/resolve
 *
 * Body:
 *   resolutionNotes: string (optional)
 */
const resolveAlert = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { alertId } = req.params;
  const { resolutionNotes } = req.body;

  const alert = await AdminAlert.resolve(alertId, userId, resolutionNotes);
  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  // Log action
  await AdminAlert.logDetailAccess(alertId, userId, 'resolve', true, null, req.ip, req.get('User-Agent'));

  logger.info('Alert resolved', { alertId, resolvedBy: userId });

  res.json({
    success: true,
    alert
  });
});

/**
 * Escalate an alert
 * POST /api/admin/safeguard/alerts/:alertId/escalate
 */
const escalateAlert = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { alertId } = req.params;

  const alert = await AdminAlert.escalate(alertId, userId);
  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  // Log action
  await AdminAlert.logDetailAccess(alertId, userId, 'escalate', true, null, req.ip, req.get('User-Agent'));

  logger.info('Alert escalated', { alertId, escalatedBy: userId });

  res.json({
    success: true,
    alert
  });
});

/**
 * Dismiss an alert
 * POST /api/admin/safeguard/alerts/:alertId/dismiss
 *
 * Body:
 *   reason: string (optional)
 */
const dismissAlert = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { alertId } = req.params;
  const { reason } = req.body;

  const alert = await AdminAlert.dismiss(alertId, userId, reason);
  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  // Log action
  await AdminAlert.logDetailAccess(alertId, userId, 'dismiss', true, null, req.ip, req.get('User-Agent'));

  logger.info('Alert dismissed', { alertId, dismissedBy: userId, reason });

  res.json({
    success: true,
    alert
  });
});

/**
 * Get alert access log
 * GET /api/admin/safeguard/alerts/:alertId/access-log
 */
const getAlertAccessLog = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { alertId } = req.params;

  const accessLog = await AdminAlert.getAccessLog(alertId);

  res.json({
    success: true,
    accessLog
  });
});

// ============================================
// SAFETY FLAGS
// ============================================

/**
 * Get safety flags with filters
 * GET /api/admin/safeguard/flags
 */
const getSafetyFlags = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const {
    category,
    severity,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = req.query;

  // Note: This gets flags across all users (admin view)
  const stats = await SafeguardFlag.getAggregatedStats({
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null
  });

  res.json({
    success: true,
    stats,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  });
});

/**
 * Get flags for a specific user
 * GET /api/admin/safeguard/flags/user/:userId
 */
const getUserSafetyFlags = asyncHandler(async (req, res) => {
  const adminId = req.session?.userId;
  if (!adminId) throw new AppError('Authentication required', 401);

  const { userId } = req.params;
  const { category, severity, limit = 50, offset = 0 } = req.query;

  const flags = await SafeguardFlag.findByUserId(userId, {
    category,
    severity,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    flags,
    userId,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: flags.length === parseInt(limit)
    }
  });
});

/**
 * Get flags for a specific persona
 * GET /api/admin/safeguard/flags/persona/:personaId
 */
const getPersonaSafetyFlags = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { personaId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const flags = await SafeguardFlag.findByPersonaId(personaId, {
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    flags,
    personaId,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: flags.length === parseInt(limit)
    }
  });
});

// ============================================
// PERSONA PERFORMANCE
// ============================================

/**
 * Get persona engagement metrics
 * GET /api/admin/safeguard/personas/:personaId/metrics
 */
const getPersonaMetrics = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { personaId } = req.params;
  const { yearMonth, months = 12 } = req.query;

  let metrics;
  if (yearMonth) {
    metrics = await PersonaPerformance.getEngagementMetrics(personaId, yearMonth);
  } else {
    metrics = await PersonaPerformance.getEngagementHistory(personaId, parseInt(months));
  }

  res.json({
    success: true,
    personaId,
    metrics
  });
});

/**
 * Get personas flagged for review
 * GET /api/admin/safeguard/personas/flagged
 */
const getFlaggedPersonas = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const flaggedPersonas = await PersonaPerformance.getFlaggedPersonas();

  res.json({
    success: true,
    personas: flaggedPersonas,
    count: flaggedPersonas.length
  });
});

/**
 * Get personas by boundary testing ratio
 * GET /api/admin/safeguard/personas/boundary-testing
 */
const getPersonasByBoundaryTesting = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { yearMonth, threshold = 1.5 } = req.query;

  // Default to current month if not specified
  const ym = yearMonth || new Date().toISOString().slice(0, 7);

  const personas = await PersonaPerformance.getPersonasByBoundaryTesting(ym, parseFloat(threshold));

  res.json({
    success: true,
    yearMonth: ym,
    threshold: parseFloat(threshold),
    personas,
    count: personas.length
  });
});

/**
 * Get improvement recommendations for a persona
 * GET /api/admin/safeguard/personas/:personaId/recommendations
 */
const getPersonaRecommendations = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { personaId } = req.params;

  const recommendations = await PersonaPerformance.getImprovementRecommendations(personaId);
  const comparison = await PersonaPerformance.compareToAverage(
    personaId,
    new Date().toISOString().slice(0, 7)
  );

  res.json({
    success: true,
    personaId,
    recommendations,
    comparison
  });
});

/**
 * Get boundary tests for a persona
 * GET /api/admin/safeguard/personas/:personaId/boundary-tests
 */
const getPersonaBoundaryTests = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { personaId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const tests = await PersonaPerformance.getBoundaryTests(personaId, {
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    personaId,
    boundaryTests: tests,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: tests.length === parseInt(limit)
    }
  });
});

// ============================================
// DASHBOARD & STATISTICS
// ============================================

/**
 * Get safeguard dashboard summary
 * GET /api/admin/safeguard/dashboard
 */
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  // Get various stats in parallel
  const [urgentAlerts, alertCounts, alertStats, flaggedPersonas] = await Promise.all([
    AdminAlert.getUrgent(),
    AdminAlert.countActive(),
    AdminAlert.getStatistics({ startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }),
    PersonaPerformance.getFlaggedPersonas()
  ]);

  res.json({
    success: true,
    dashboard: {
      urgentAlerts: {
        count: urgentAlerts.length,
        items: urgentAlerts.slice(0, 5) // Top 5
      },
      alertCounts,
      last30Days: alertStats,
      flaggedPersonas: {
        count: flaggedPersonas.length,
        items: flaggedPersonas.slice(0, 5) // Top 5
      }
    }
  });
});

/**
 * Get alert statistics
 * GET /api/admin/safeguard/stats/alerts
 */
const getAlertStatistics = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { startDate, endDate } = req.query;

  const stats = await AdminAlert.getStatistics({
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null
  });

  res.json({
    success: true,
    stats
  });
});

/**
 * Get category breakdown
 * GET /api/admin/safeguard/stats/categories
 */
const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new AppError('Authentication required', 401);

  const { startDate, endDate, personaId } = req.query;

  const breakdown = await SafeguardFlag.countByCategory({
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    personaId: personaId || null
  });

  res.json({
    success: true,
    breakdown
  });
});

module.exports = {
  // Middleware
  requireSafeguardAccess,

  // Alerts
  getAlerts,
  getUrgentAlerts,
  getAlertDetails,
  requestAlertDetailAccess,
  acknowledgeAlert,
  resolveAlert,
  escalateAlert,
  dismissAlert,
  getAlertAccessLog,

  // Safety flags
  getSafetyFlags,
  getUserSafetyFlags,
  getPersonaSafetyFlags,

  // Persona performance
  getPersonaMetrics,
  getFlaggedPersonas,
  getPersonasByBoundaryTesting,
  getPersonaRecommendations,
  getPersonaBoundaryTests,

  // Dashboard & stats
  getDashboard,
  getAlertStatistics,
  getCategoryBreakdown
};
