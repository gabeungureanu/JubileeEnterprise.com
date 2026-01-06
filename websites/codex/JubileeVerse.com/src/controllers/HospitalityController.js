/**
 * Hospitality Controller
 * Handles hospitality-related HTTP requests including:
 * - Event tracking (public/session-based)
 * - Popup/action management
 * - Admin dashboard endpoints
 * - Rule CRUD operations
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { HospitalityService, HospitalityRuleEngine, HospitalityCockpitService } = require('../services');
const { Hospitality, HospitalityCockpit, EngagementCategory } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// ============================================
// Helper Functions
// ============================================

/**
 * Hash IP address for privacy-conscious storage
 */
function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * Get identifier from request (user ID or session ID)
 */
function getIdentifier(req) {
  return {
    userId: req.session?.userId || null,
    sessionId: req.sessionID || null
  };
}

// ============================================
// Event Tracking Endpoints (Public/Session-Based)
// ============================================

/**
 * Track an engagement event
 * POST /api/hospitality/events
 */
const trackEvent = asyncHandler(async (req, res) => {
  const {
    eventType,
    eventSource,
    eventContext,
    pageUrl,
    pageTitle,
    personaId,
    metricValue
  } = req.body;

  if (!eventType) {
    throw new AppError('Event type is required', 400);
  }

  const identifier = getIdentifier(req);

  if (!identifier.userId && !identifier.sessionId) {
    throw new AppError('No session available', 400);
  }

  const eventData = {
    userId: identifier.userId,
    sessionId: identifier.sessionId,
    eventType,
    eventSource: eventSource || 'page',
    eventContext: eventContext || {},
    pageUrl: pageUrl || req.headers.referer,
    pageTitle: pageTitle || null,
    personaId: personaId || null,
    metricValue: metricValue || null,
    userAgent: req.headers['user-agent'],
    ipHash: hashIp(req.ip),
    referrer: req.headers.referer || null
  };

  // Track event and update user state
  const event = await HospitalityService.trackEvent(eventData);

  // Evaluate rules asynchronously (don't block response)
  setImmediate(async () => {
    try {
      await HospitalityRuleEngine.evaluateRulesForEvent(event);
    } catch (error) {
      logger.error('Rule evaluation failed', { error: error.message, eventId: event.id });
    }
  });

  res.json({
    success: true,
    eventId: event.id
  });
});

/**
 * Check for pending hospitality action
 * GET /api/hospitality/check
 */
const checkForAction = asyncHandler(async (req, res) => {
  const identifier = getIdentifier(req);

  if (!identifier.userId && !identifier.sessionId) {
    return res.json({
      success: true,
      hasAction: false,
      action: null
    });
  }

  const action = await HospitalityService.checkForPendingAction(identifier);

  if (!action) {
    return res.json({
      success: true,
      hasAction: false,
      action: null
    });
  }

  // Format action for frontend
  res.json({
    success: true,
    hasAction: true,
    action: {
      id: action.id,
      actionType: action.actionType,
      actionSubtype: action.actionSubtype,
      config: action.actionContent || action.config,
      personaId: action.personaId,
      ruleId: action.ruleId,
      ruleName: action.ruleName
    }
  });
});

/**
 * Record that a popup was shown
 * POST /api/hospitality/shown
 */
const recordShown = asyncHandler(async (req, res) => {
  const { actionId, popupType } = req.body;
  const identifier = getIdentifier(req);

  if (!identifier.userId && !identifier.sessionId) {
    throw new AppError('No session available', 400);
  }

  await HospitalityService.recordPopupShown(identifier, popupType, actionId);

  res.json({
    success: true
  });
});

/**
 * Dismiss a popup
 * POST /api/hospitality/dismiss
 */
const dismissAction = asyncHandler(async (req, res) => {
  const { actionId, outcome } = req.body;
  const identifier = getIdentifier(req);

  if (!identifier.userId && !identifier.sessionId) {
    throw new AppError('No session available', 400);
  }

  // Record dismissal
  await HospitalityService.recordPopupDismissed(identifier, actionId);

  // Check if user has dismissed multiple times - set global cooldown
  const state = await HospitalityService.getUserState(identifier);
  if (state && state.popupsDismissedToday >= 3) {
    // Set 1-hour global cooldown after 3 dismissals
    await HospitalityService.setGlobalCooldown(identifier, 3600);
  }

  res.json({
    success: true
  });
});

/**
 * Record popup click
 * POST /api/hospitality/clicked
 */
const recordClicked = asyncHandler(async (req, res) => {
  const { actionId } = req.body;
  const identifier = getIdentifier(req);

  if (!identifier.userId && !identifier.sessionId) {
    throw new AppError('No session available', 400);
  }

  await HospitalityService.recordPopupClicked(identifier, actionId);

  res.json({
    success: true
  });
});

/**
 * Get user's hospitality state (for debugging/admin)
 * GET /api/hospitality/state
 */
const getUserState = asyncHandler(async (req, res) => {
  const identifier = getIdentifier(req);

  if (!identifier.userId && !identifier.sessionId) {
    return res.json({
      success: true,
      state: null
    });
  }

  const state = await HospitalityService.getUserState(identifier);

  res.json({
    success: true,
    state
  });
});

// ============================================
// Admin Endpoints
// ============================================

/**
 * Get visitor hospitality dashboard
 * GET /api/hospitality/admin/visitors
 */
const getVisitorDashboard = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { page = 1, limit = 50, sortBy = 'lastActivityAt' } = req.query;

  const data = await HospitalityService.getVisitorDashboard({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    sortBy
  });

  res.json({
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get subscriber hospitality dashboard
 * GET /api/hospitality/admin/subscribers
 */
const getSubscriberDashboard = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { page = 1, limit = 50, sortBy = 'engagementScore' } = req.query;

  const data = await HospitalityService.getSubscriberDashboard({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    sortBy
  });

  res.json({
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get hospitality system health
 * GET /api/hospitality/admin/health
 */
const getSystemHealth = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const health = await HospitalityService.getSystemHealth();

  res.json({
    success: true,
    health
  });
});

/**
 * Get rule performance statistics
 * GET /api/hospitality/admin/performance
 */
const getRulePerformance = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const performance = await HospitalityService.getRulePerformance();

  res.json({
    success: true,
    rules: performance,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get recent hospitality actions (for admin monitoring)
 * GET /api/hospitality/admin/actions
 */
const getRecentActions = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { limit = 100, offset = 0, outcome = null } = req.query;

  const actions = await Hospitality.getRecentActions({
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    outcome: outcome || null
  });

  res.json({
    success: true,
    actions,
    pagination: {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    }
  });
});

// ============================================
// Rule Management Endpoints (Admin Only)
// ============================================

/**
 * Get all hospitality rules
 * GET /api/hospitality/admin/rules
 */
const getRules = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { includeInactive = 'true' } = req.query;

  const rules = await HospitalityRuleEngine.getAllRules({
    includeInactive: includeInactive === 'true'
  });

  res.json({
    success: true,
    rules,
    count: rules.length
  });
});

/**
 * Get a single rule by ID
 * GET /api/hospitality/admin/rules/:id
 */
const getRuleById = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;

  const rule = await HospitalityRuleEngine.getRuleById(id);

  if (!rule) {
    throw new AppError('Rule not found', 404);
  }

  res.json({
    success: true,
    rule
  });
});

/**
 * Create a hospitality rule
 * POST /api/hospitality/admin/rules
 */
const createRule = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const {
    name,
    slug,
    description,
    targetAudience,
    targetFunnelStages,
    triggerConditions,
    actionType,
    actionConfig,
    isActive,
    priority,
    startDate,
    endDate,
    maxPerSession,
    maxPerDay,
    cooldownSeconds
  } = req.body;

  // Validate required fields
  if (!name || !slug || !actionType) {
    throw new AppError('Name, slug, and actionType are required', 400);
  }

  // Validate trigger conditions
  if (triggerConditions) {
    const conditionErrors = HospitalityRuleEngine.validateTriggerConditions(triggerConditions);
    if (conditionErrors.length > 0) {
      throw new AppError(`Invalid trigger conditions: ${conditionErrors.join(', ')}`, 400);
    }
  }

  // Validate action config
  if (actionConfig) {
    const configErrors = HospitalityRuleEngine.validateActionConfig(actionType, actionConfig);
    if (configErrors.length > 0) {
      throw new AppError(`Invalid action config: ${configErrors.join(', ')}`, 400);
    }
  }

  const ruleData = {
    name,
    slug,
    description,
    targetAudience: targetAudience || 'all',
    targetFunnelStages,
    triggerConditions: triggerConditions || {},
    actionType,
    actionConfig: actionConfig || {},
    isActive: isActive !== false,
    priority: priority || 100,
    startDate,
    endDate,
    maxPerSession: maxPerSession || 1,
    maxPerDay: maxPerDay || 3,
    cooldownSeconds: cooldownSeconds || 300,
    createdBy: req.session.userId
  };

  const rule = await HospitalityRuleEngine.createRule(ruleData);

  logger.info('Hospitality rule created by admin', {
    ruleId: rule.id,
    ruleName: rule.name,
    adminId: req.session.userId
  });

  res.status(201).json({
    success: true,
    rule
  });
});

/**
 * Update a hospitality rule
 * PUT /api/hospitality/admin/rules/:id
 */
const updateRule = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;
  const updates = req.body;

  // Don't allow changing slug (could break references)
  delete updates.slug;
  delete updates.id;
  delete updates.createdBy;
  delete updates.createdAt;

  // Validate trigger conditions if provided
  if (updates.triggerConditions) {
    const conditionErrors = HospitalityRuleEngine.validateTriggerConditions(updates.triggerConditions);
    if (conditionErrors.length > 0) {
      throw new AppError(`Invalid trigger conditions: ${conditionErrors.join(', ')}`, 400);
    }
  }

  // Validate action config if provided
  if (updates.actionConfig && updates.actionType) {
    const configErrors = HospitalityRuleEngine.validateActionConfig(updates.actionType, updates.actionConfig);
    if (configErrors.length > 0) {
      throw new AppError(`Invalid action config: ${configErrors.join(', ')}`, 400);
    }
  }

  const rule = await HospitalityRuleEngine.updateRule(id, updates);

  if (!rule) {
    throw new AppError('Rule not found', 404);
  }

  logger.info('Hospitality rule updated by admin', {
    ruleId: id,
    updates: Object.keys(updates),
    adminId: req.session.userId
  });

  res.json({
    success: true,
    rule
  });
});

/**
 * Delete (deactivate) a hospitality rule
 * DELETE /api/hospitality/admin/rules/:id
 */
const deleteRule = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;

  // Soft delete by deactivating
  const rule = await HospitalityRuleEngine.deactivateRule(id);

  if (!rule) {
    throw new AppError('Rule not found', 404);
  }

  logger.info('Hospitality rule deactivated by admin', {
    ruleId: id,
    adminId: req.session.userId
  });

  res.json({
    success: true,
    message: 'Rule deactivated successfully'
  });
});

/**
 * Toggle rule active status
 * POST /api/hospitality/admin/rules/:id/toggle
 */
const toggleRule = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;

  const existingRule = await HospitalityRuleEngine.getRuleById(id);

  if (!existingRule) {
    throw new AppError('Rule not found', 404);
  }

  const rule = await HospitalityRuleEngine.updateRule(id, {
    isActive: !existingRule.isActive
  });

  logger.info('Hospitality rule toggled by admin', {
    ruleId: id,
    isActive: rule.isActive,
    adminId: req.session.userId
  });

  res.json({
    success: true,
    rule
  });
});

// ============================================
// Hospitality Cockpit Endpoints (Admin Only)
// ============================================

/**
 * Get current cockpit state with all gauge values
 * GET /api/hospitality/admin/cockpit
 */
const getCockpitState = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  // Try to get cached/recent state first
  let cockpitState = await HospitalityCockpitService.getCockpitState();

  // If no data for today, calculate fresh metrics
  if (!cockpitState || !cockpitState.metrics) {
    await HospitalityCockpitService.calculateAndUpdateMetrics();
    cockpitState = await HospitalityCockpitService.getCockpitState();
  }

  res.json({
    success: true,
    ...cockpitState,
    timestamp: new Date().toISOString()
  });
});

/**
 * Force recalculation of cockpit metrics
 * POST /api/hospitality/admin/cockpit/refresh
 */
const refreshCockpitMetrics = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  await HospitalityCockpitService.calculateAndUpdateMetrics();
  const cockpitState = await HospitalityCockpitService.getCockpitState();

  logger.info('Hospitality cockpit metrics refreshed by admin', {
    adminId: req.session.userId
  });

  res.json({
    success: true,
    ...cockpitState,
    refreshedAt: new Date().toISOString()
  });
});

/**
 * Get cockpit metrics history
 * GET /api/hospitality/admin/cockpit/history
 */
const getCockpitHistory = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { days = 7 } = req.query;
  const daysNum = Math.min(parseInt(days, 10) || 7, 90);

  const history = await HospitalityCockpit.getLastDays(daysNum);

  res.json({
    success: true,
    history,
    days: daysNum
  });
});

/**
 * Get active cockpit alerts
 * GET /api/hospitality/admin/cockpit/alerts
 */
const getCockpitAlerts = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const alerts = await HospitalityCockpit.getActiveAlerts();

  res.json({
    success: true,
    alerts,
    count: alerts.length
  });
});

/**
 * Acknowledge a cockpit alert
 * POST /api/hospitality/admin/cockpit/alerts/:id/acknowledge
 */
const acknowledgeCockpitAlert = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;
  const userId = req.session.userId;

  await HospitalityCockpit.acknowledgeAlert(id, userId);

  logger.info('Hospitality cockpit alert acknowledged', {
    alertId: id,
    adminId: userId
  });

  res.json({
    success: true,
    message: 'Alert acknowledged'
  });
});

/**
 * Resolve a cockpit alert
 * POST /api/hospitality/admin/cockpit/alerts/:id/resolve
 */
const resolveCockpitAlert = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;

  await HospitalityCockpit.resolveAlert(id);

  logger.info('Hospitality cockpit alert resolved', {
    alertId: id,
    adminId: req.session.userId
  });

  res.json({
    success: true,
    message: 'Alert resolved'
  });
});

/**
 * Get cockpit configuration
 * GET /api/hospitality/admin/cockpit/config
 */
const getCockpitConfig = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const config = await HospitalityCockpit.getConfig();

  res.json({
    success: true,
    config
  });
});

/**
 * Update cockpit configuration
 * PUT /api/hospitality/admin/cockpit/config/:key
 */
const updateCockpitConfig = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { key } = req.params;
  const { value, description } = req.body;

  if (!value) {
    throw new AppError('Value is required', 400);
  }

  await HospitalityCockpit.updateConfig(key, value, description, req.session.userId);

  logger.info('Hospitality cockpit config updated', {
    key,
    adminId: req.session.userId
  });

  res.json({
    success: true,
    message: 'Configuration updated'
  });
});

// ============================================
// Engagement Categories Endpoints
// ============================================

/**
 * Get full category tree
 * GET /api/hospitality/admin/categories
 */
const getCategoryTree = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const flatCategories = await EngagementCategory.getFullTree(includeInactive);

  // Build nested tree structure from flat list
  const categoryMap = new Map();
  const rootCategories = [];

  // First pass: create map of all categories with empty children arrays
  flatCategories.forEach(cat => {
    categoryMap.set(cat.id, {
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      description: cat.description,
      parentId: cat.parentId,
      depth: cat.depth,
      sortOrder: cat.sortOrder,
      icon: cat.icon,
      color: cat.color,
      isActive: cat.isActive,
      ruleCount: cat.ruleCount || 0,
      childCount: cat.childCount || 0,
      children: []
    });
  });

  // Second pass: build tree by adding children to parents
  flatCategories.forEach(cat => {
    const categoryNode = categoryMap.get(cat.id);
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId).children.push(categoryNode);
    } else if (!cat.parentId) {
      rootCategories.push(categoryNode);
    }
  });

  // Sort children at each level by sortOrder, then by name
  const sortChildren = (categories) => {
    categories.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
    categories.forEach(cat => {
      if (cat.children && cat.children.length > 0) {
        sortChildren(cat.children);
      }
    });
  };
  sortChildren(rootCategories);

  res.json({
    success: true,
    categories: rootCategories
  });
});

/**
 * Get root categories only
 * GET /api/hospitality/admin/categories/roots
 */
const getCategoryRoots = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const categories = await EngagementCategory.findRoots(includeInactive);

  res.json({
    success: true,
    categories
  });
});

/**
 * Search categories by name
 * GET /api/hospitality/admin/categories/search?q=...
 */
const searchCategories = asyncHandler(async (req, res) => {
  const { q, limit = 20 } = req.query;

  if (!q || q.length < 2) {
    return res.json({ success: true, categories: [] });
  }

  const categories = await EngagementCategory.search(q, parseInt(limit, 10));

  res.json({
    success: true,
    categories
  });
});

/**
 * Get category statistics
 * GET /api/hospitality/admin/categories/stats
 */
const getCategoryStats = asyncHandler(async (req, res) => {
  const stats = await EngagementCategory.getStats();
  const topCategories = await EngagementCategory.getTopCategories(10);

  res.json({
    success: true,
    stats,
    topCategories
  });
});

/**
 * Get children of a category (for lazy loading)
 * GET /api/hospitality/admin/categories/:id/children
 */
const getCategoryChildren = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const includeInactive = req.query.includeInactive === 'true';
  const children = await EngagementCategory.findChildren(id, includeInactive);

  res.json({
    success: true,
    children
  });
});

/**
 * Get ancestors of a category (breadcrumb path)
 * GET /api/hospitality/admin/categories/:id/ancestors
 */
const getCategoryAncestors = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ancestors = await EngagementCategory.getAncestors(id);

  res.json({
    success: true,
    ancestors
  });
});

/**
 * Get single category by ID
 * GET /api/hospitality/admin/categories/:id
 */
const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await EngagementCategory.findById(id);

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  res.json({
    success: true,
    category
  });
});

/**
 * Get rules for a category with auto-generation
 * Ensures minimum rules exist per category using ML-inspired templates
 * GET /api/hospitality/admin/categories/:id/rules
 */
const getCategoryRules = asyncHandler(async (req, res) => {
  if (req.session?.user?.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new AppError('Invalid category ID format', 400);
  }

  const result = await HospitalityRuleEngine.getRulesForCategory(id);

  if (result.error) {
    throw new AppError(result.error, 404);
  }

  logger.info('Category rules retrieved', {
    categoryId: id,
    ruleCount: result.rules.length,
    generatedCount: result.generated,
    adminId: req.session.userId
  });

  res.json({
    success: true,
    rules: result.rules,
    generated: result.generated,
    count: result.rules.length
  });
});

/**
 * Create new category
 * POST /api/hospitality/admin/categories
 */
const createCategory = asyncHandler(async (req, res) => {
  const { slug, name, description, parentId, sortOrder, icon, color, isActive } = req.body;

  if (!slug || !name) {
    throw new AppError('Slug and name are required', 400);
  }

  const category = await EngagementCategory.create({
    slug,
    name,
    description,
    parentId,
    sortOrder,
    icon,
    color,
    isActive,
    createdBy: req.session?.userId
  });

  logger.info('Category created', { categoryId: category.id, slug, createdBy: req.session?.userId });

  res.status(201).json({
    success: true,
    category,
    message: 'Category created successfully'
  });
});

/**
 * Update existing category
 * PUT /api/hospitality/admin/categories/:id
 */
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { slug, name, description, parentId, sortOrder, icon, color, isActive } = req.body;

  const updates = {};
  if (slug !== undefined) updates.slug = slug;
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (parentId !== undefined) updates.parentId = parentId;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (icon !== undefined) updates.icon = icon;
  if (color !== undefined) updates.color = color;
  if (isActive !== undefined) updates.isActive = isActive;

  const category = await EngagementCategory.update(id, updates, req.session?.userId);

  logger.info('Category updated', { categoryId: id, updates: Object.keys(updates), updatedBy: req.session?.userId });

  res.json({
    success: true,
    category,
    message: 'Category updated successfully'
  });
});

/**
 * Delete category with safe deletion mode
 * DELETE /api/hospitality/admin/categories/:id?mode=reassign|cascade|block
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mode = 'reassign' } = req.query;

  if (!['reassign', 'cascade', 'block'].includes(mode)) {
    throw new AppError('Invalid deletion mode. Use: reassign, cascade, or block', 400);
  }

  const result = await EngagementCategory.safeDelete(id, mode, req.session?.userId);

  if (!result.success) {
    throw new AppError(result.message, 400);
  }

  logger.info('Category deleted', {
    categoryId: id,
    mode,
    affectedRules: result.affectedRules,
    affectedChildren: result.affectedChildren,
    deletedBy: req.session?.userId
  });

  res.json({
    success: true,
    message: result.message,
    affectedRules: result.affectedRules,
    affectedChildren: result.affectedChildren
  });
});

/**
 * Reorder categories within a parent
 * POST /api/hospitality/admin/categories/reorder
 */
const reorderCategories = asyncHandler(async (req, res) => {
  const { parentId, orderedIds } = req.body;

  if (!orderedIds || !Array.isArray(orderedIds)) {
    throw new AppError('orderedIds array is required', 400);
  }

  await EngagementCategory.reorder(parentId, orderedIds);

  logger.info('Categories reordered', { parentId, count: orderedIds.length, reorderedBy: req.session?.userId });

  res.json({
    success: true,
    message: 'Categories reordered successfully'
  });
});

/**
 * Restore soft-deleted category
 * POST /api/hospitality/admin/categories/:id/restore
 */
const restoreCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await EngagementCategory.restore(id, req.session?.userId);

  logger.info('Category restored', { categoryId: id, restoredBy: req.session?.userId });

  res.json({
    success: true,
    category,
    message: 'Category restored successfully'
  });
});

// ============================================
// AI-Assisted Content Generation
// ============================================

/**
 * Process AI instruction to update rule content
 * POST /api/hospitality/admin/ai/process-instruction
 */
const processAiInstruction = asyncHandler(async (req, res) => {
  const { instruction, currentContent, context } = req.body;

  if (!instruction) {
    throw new AppError('Instruction is required', 400);
  }

  logger.info('Processing AI instruction for rule content', {
    userId: req.session?.userId,
    instruction: instruction.substring(0, 100),
    contentLength: currentContent?.length || 0
  });

  try {
    // Get AI Service
    const AIService = require('../services/AIService');

    // Build the prompt for content editing
    const systemPrompt = `You are Jubilee, a helpful AI assistant for JubileeVerse, a Christian spiritual community platform.
You are helping an administrator edit hospitality rule content.
Your task is to modify the provided text based on the user's instruction.
Keep the tone warm, welcoming, and spiritually supportive.
Only return the updated text, nothing else - no explanations, no quotes, just the revised content.`;

    const messages = [
      {
        role: 'user',
        content: `Current content:
"""
${currentContent || '(empty)'}
"""

Context about this rule:
- Rule Name: ${context?.ruleName || 'Unknown'}
- Category: ${context?.ruleCategory || 'General'}
- Type: ${context?.ruleType || 'popup'}

Instruction: ${instruction}

Please provide the updated content based on the instruction above.`
      }
    ];

    const response = await AIService.generateResponse({
      provider: 'openai',
      systemPrompt,
      messages,
      maxTokens: 500,
      temperature: 0.7
    });

    const updatedContent = response.content || response.text || response;

    logger.info('AI instruction processed successfully', {
      userId: req.session?.userId,
      originalLength: currentContent?.length || 0,
      updatedLength: updatedContent?.length || 0
    });

    res.json({
      success: true,
      updatedContent: typeof updatedContent === 'string' ? updatedContent.trim() : String(updatedContent).trim()
    });

  } catch (error) {
    logger.error('AI instruction processing failed', {
      error: error.message,
      userId: req.session?.userId
    });

    // Return a graceful fallback
    throw new AppError('Failed to process AI instruction: ' + error.message, 500);
  }
});

// ============================================
// Module Exports
// ============================================

module.exports = {
  // Event tracking (public)
  trackEvent,
  checkForAction,
  recordShown,
  dismissAction,
  recordClicked,
  getUserState,

  // Admin - Dashboards
  getVisitorDashboard,
  getSubscriberDashboard,
  getSystemHealth,
  getRulePerformance,
  getRecentActions,

  // Admin - Rule Management
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,

  // Admin - Hospitality Cockpit
  getCockpitState,
  refreshCockpitMetrics,
  getCockpitHistory,
  getCockpitAlerts,
  acknowledgeCockpitAlert,
  resolveCockpitAlert,
  getCockpitConfig,
  updateCockpitConfig,

  // Admin - Engagement Categories
  getCategoryTree,
  getCategoryRoots,
  searchCategories,
  getCategoryStats,
  getCategoryChildren,
  getCategoryAncestors,
  getCategoryById,
  getCategoryRules,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  restoreCategory,

  // Admin - AI-Assisted Content
  processAiInstruction
};
