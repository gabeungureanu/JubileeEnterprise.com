/**
 * Hospitality Model
 * Handles all hospitality-related database operations including:
 * - User state tracking (engagement scores, funnel stages)
 * - Event logging (page views, interactions, etc.)
 * - Action management (popups, notifications)
 * - Rule configuration and cooldowns
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ============================================
// Row Conversion Functions
// ============================================

/**
 * Convert database row to UserState object
 */
function rowToUserState(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    pageViews: row.page_views,
    sessionCount: row.session_count,
    totalTimeOnSiteSeconds: row.total_time_on_site_seconds,
    currentSessionStart: row.current_session_start,
    lastActivityAt: row.last_activity_at,
    engagementScore: row.engagement_score,
    funnelStage: row.funnel_stage,
    lastPageUrl: row.last_page_url,
    lastPersonaId: row.last_persona_id,
    popupsShownToday: row.popups_shown_today,
    popupsDismissedToday: row.popups_dismissed_today,
    lastPopupShownAt: row.last_popup_shown_at,
    lastPopupType: row.last_popup_type,
    globalCooldownUntil: row.global_cooldown_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Convert database row to Event object
 */
function rowToEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    eventSource: row.event_source,
    eventContext: row.event_context,
    pageUrl: row.page_url,
    pageTitle: row.page_title,
    personaId: row.persona_id,
    metricValue: row.metric_value,
    userAgent: row.user_agent,
    ipHash: row.ip_hash,
    referrer: row.referrer,
    createdAt: row.created_at
  };
}

/**
 * Convert database row to Action object
 */
function rowToAction(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    ruleId: row.rule_id,
    actionType: row.action_type,
    actionSubtype: row.action_subtype,
    personaId: row.persona_id,
    actionContent: row.action_content,
    outcome: row.outcome,
    outcomeAt: row.outcome_at,
    triggerEventId: row.trigger_event_id,
    pageUrl: row.page_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Include rule info if joined
    ruleName: row.rule_name,
    ruleSlug: row.rule_slug
  };
}

/**
 * Convert database row to Rule object
 */
function rowToRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    category_id: row.category_id,
    rule_number: row.rule_number,
    target_audience: row.target_audience,
    targetAudience: row.target_audience,
    targetFunnelStages: row.target_funnel_stages,
    trigger_conditions: row.trigger_conditions,
    triggerConditions: row.trigger_conditions,
    action_type: row.action_type,
    actionType: row.action_type,
    actionConfig: row.action_config,
    message_template: row.message_template,
    button_config: row.button_config,
    personalization_config: row.personalization_config,
    is_active: row.is_active,
    isActive: row.is_active,
    priority: row.priority,
    startDate: row.start_date,
    endDate: row.end_date,
    max_per_session: row.max_per_session,
    maxPerSession: row.max_per_session,
    max_per_day: row.max_per_day,
    maxPerDay: row.max_per_day,
    cooldown_seconds: row.cooldown_seconds,
    cooldownSeconds: row.cooldown_seconds,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Convert database row to Cooldown object
 */
function rowToCooldown(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    ruleId: row.rule_id,
    timesTriggeredSession: row.times_triggered_session,
    timesTriggeredToday: row.times_triggered_today,
    lastTriggeredAt: row.last_triggered_at,
    cooldownUntil: row.cooldown_until,
    lastDailyReset: row.last_daily_reset,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ============================================
// User State Operations
// ============================================

/**
 * Find user state by user ID
 */
async function findUserStateByUserId(userId) {
  const result = await database.query(
    'SELECT * FROM hospitality_user_state WHERE user_id = $1',
    [userId]
  );
  return rowToUserState(result.rows[0]);
}

/**
 * Find user state by session ID
 */
async function findUserStateBySessionId(sessionId) {
  const result = await database.query(
    'SELECT * FROM hospitality_user_state WHERE session_id = $1',
    [sessionId]
  );
  return rowToUserState(result.rows[0]);
}

/**
 * Get or create user state
 */
async function getOrCreateUserState(identifier) {
  const { userId, sessionId } = identifier;

  // Try to find existing state
  let state = userId
    ? await findUserStateByUserId(userId)
    : await findUserStateBySessionId(sessionId);

  if (state) return state;

  // Create new state
  const id = uuidv4();
  const result = await database.query(
    `INSERT INTO hospitality_user_state (id, user_id, session_id, current_session_start)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [id, userId || null, sessionId || null]
  );

  return rowToUserState(result.rows[0]);
}

/**
 * Update user state with dynamic fields
 */
async function updateUserState(identifier, updates) {
  const { userId, sessionId } = identifier;

  const fieldMap = {
    pageViews: 'page_views',
    sessionCount: 'session_count',
    totalTimeOnSiteSeconds: 'total_time_on_site_seconds',
    currentSessionStart: 'current_session_start',
    lastActivityAt: 'last_activity_at',
    engagementScore: 'engagement_score',
    funnelStage: 'funnel_stage',
    lastPageUrl: 'last_page_url',
    lastPersonaId: 'last_persona_id',
    popupsShownToday: 'popups_shown_today',
    popupsDismissedToday: 'popups_dismissed_today',
    lastPopupShownAt: 'last_popup_shown_at',
    lastPopupType: 'last_popup_type',
    globalCooldownUntil: 'global_cooldown_until'
  };

  const dbUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (dbField) {
      dbUpdates[dbField] = value;
    }
  }

  const fields = Object.keys(dbUpdates);
  const values = Object.values(dbUpdates);

  if (fields.length === 0) {
    return userId ? await findUserStateByUserId(userId) : await findUserStateBySessionId(sessionId);
  }

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const whereClause = userId ? 'user_id = $1' : 'session_id = $1';
  const whereValue = userId || sessionId;

  const result = await database.query(
    `UPDATE hospitality_user_state
     SET ${setClause}, updated_at = NOW()
     WHERE ${whereClause}
     RETURNING *`,
    [whereValue, ...values]
  );

  return rowToUserState(result.rows[0]);
}

/**
 * Increment user state counters
 */
async function incrementUserStateCounters(identifier, counters) {
  const { userId, sessionId } = identifier;

  const increments = [];
  const params = [userId || sessionId];
  let paramIndex = 2;

  if (counters.pageViews) {
    increments.push(`page_views = page_views + $${paramIndex}`);
    params.push(counters.pageViews);
    paramIndex++;
  }
  if (counters.totalTimeOnSiteSeconds) {
    increments.push(`total_time_on_site_seconds = total_time_on_site_seconds + $${paramIndex}`);
    params.push(counters.totalTimeOnSiteSeconds);
    paramIndex++;
  }
  if (counters.popupsShownToday) {
    increments.push(`popups_shown_today = popups_shown_today + $${paramIndex}`);
    params.push(counters.popupsShownToday);
    paramIndex++;
  }
  if (counters.popupsDismissedToday) {
    increments.push(`popups_dismissed_today = popups_dismissed_today + $${paramIndex}`);
    params.push(counters.popupsDismissedToday);
    paramIndex++;
  }

  if (increments.length === 0) return null;

  const whereClause = userId ? 'user_id = $1' : 'session_id = $1';

  const result = await database.query(
    `UPDATE hospitality_user_state
     SET ${increments.join(', ')}, last_activity_at = NOW(), updated_at = NOW()
     WHERE ${whereClause}
     RETURNING *`,
    params
  );

  return rowToUserState(result.rows[0]);
}

// ============================================
// Events Operations
// ============================================

/**
 * Create a new hospitality event
 */
async function createEvent(eventData) {
  const id = uuidv4();

  const result = await database.query(
    `INSERT INTO hospitality_events
     (id, user_id, session_id, event_type, event_source, event_context,
      page_url, page_title, persona_id, metric_value, user_agent, ip_hash, referrer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      id,
      eventData.userId || null,
      eventData.sessionId || null,
      eventData.eventType,
      eventData.eventSource || null,
      JSON.stringify(eventData.eventContext || {}),
      eventData.pageUrl || null,
      eventData.pageTitle || null,
      eventData.personaId || null,
      eventData.metricValue || null,
      eventData.userAgent || null,
      eventData.ipHash || null,
      eventData.referrer || null
    ]
  );

  return rowToEvent(result.rows[0]);
}

/**
 * Get recent events for a user/session
 */
async function getRecentEvents(identifier, options = {}) {
  const { userId, sessionId } = identifier;
  const { limit = 50, eventType = null } = options;

  const whereClause = userId ? 'user_id = $1' : 'session_id = $1';
  const whereValue = userId || sessionId;

  let query = `SELECT * FROM hospitality_events WHERE ${whereClause}`;
  const params = [whereValue];

  if (eventType) {
    query += ` AND event_type = $${params.length + 1}`;
    params.push(eventType);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await database.query(query, params);
  return result.rows.map(rowToEvent);
}

/**
 * Count events by type for a user/session
 */
async function countEventsByType(identifier, eventType, since = null) {
  const { userId, sessionId } = identifier;
  const whereClause = userId ? 'user_id = $1' : 'session_id = $1';
  const whereValue = userId || sessionId;

  let query = `SELECT COUNT(*) as count FROM hospitality_events
               WHERE ${whereClause} AND event_type = $2`;
  const params = [whereValue, eventType];

  if (since) {
    query += ` AND created_at >= $3`;
    params.push(since);
  }

  const result = await database.query(query, params);
  return parseInt(result.rows[0].count, 10);
}

// ============================================
// Actions Operations
// ============================================

/**
 * Create a new hospitality action
 */
async function createAction(actionData) {
  const id = uuidv4();

  const result = await database.query(
    `INSERT INTO hospitality_actions
     (id, user_id, session_id, rule_id, action_type, action_subtype,
      persona_id, action_content, trigger_event_id, page_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      id,
      actionData.userId || null,
      actionData.sessionId || null,
      actionData.ruleId || null,
      actionData.actionType,
      actionData.actionSubtype || null,
      actionData.personaId || null,
      JSON.stringify(actionData.actionContent || {}),
      actionData.triggerEventId || null,
      actionData.pageUrl || null
    ]
  );

  return rowToAction(result.rows[0]);
}

/**
 * Update action outcome
 */
async function updateActionOutcome(actionId, outcome) {
  const result = await database.query(
    `UPDATE hospitality_actions
     SET outcome = $2, outcome_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [actionId, outcome]
  );
  return rowToAction(result.rows[0]);
}

/**
 * Get pending actions for a user/session
 */
async function getPendingActions(identifier, limit = 5) {
  const { userId, sessionId } = identifier;
  const whereClause = userId ? 'user_id = $1' : 'session_id = $1';
  const whereValue = userId || sessionId;

  const result = await database.query(
    `SELECT ha.*, hr.name as rule_name, hr.slug as rule_slug
     FROM hospitality_actions ha
     LEFT JOIN hospitality_rules hr ON ha.rule_id = hr.id
     WHERE ha.${whereClause.split(' ')[0]} = $1 AND ha.outcome = 'pending'
     ORDER BY ha.created_at DESC
     LIMIT $2`,
    [whereValue, limit]
  );

  return result.rows.map(rowToAction);
}

/**
 * Get recent actions for admin view
 */
async function getRecentActions(options = {}) {
  const { limit = 100, offset = 0, outcome = null } = options;

  let query = `SELECT ha.*, hr.name as rule_name, hr.slug as rule_slug,
               u.display_name as user_display_name, u.email as user_email
               FROM hospitality_actions ha
               LEFT JOIN hospitality_rules hr ON ha.rule_id = hr.id
               LEFT JOIN users u ON ha.user_id = u.id`;
  const params = [];

  if (outcome) {
    query += ` WHERE ha.outcome = $1`;
    params.push(outcome);
  }

  query += ` ORDER BY ha.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToAction);
}

// ============================================
// Rules Operations
// ============================================

/**
 * Find all active rules (sorted by priority)
 */
async function findAllActiveRules() {
  const result = await database.query(
    `SELECT * FROM hospitality_rules
     WHERE is_active = TRUE
     AND (start_date IS NULL OR start_date <= NOW())
     AND (end_date IS NULL OR end_date >= NOW())
     ORDER BY priority ASC`
  );
  return result.rows.map(rowToRule);
}

/**
 * Find all rules (including inactive)
 */
async function findAllRules(options = {}) {
  const { includeInactive = true } = options;

  let query = 'SELECT * FROM hospitality_rules';
  if (!includeInactive) {
    query += ' WHERE is_active = TRUE';
  }
  query += ' ORDER BY priority ASC, created_at DESC';

  const result = await database.query(query);
  return result.rows.map(rowToRule);
}

/**
 * Find rule by ID
 */
async function findRuleById(ruleId) {
  const result = await database.query(
    'SELECT * FROM hospitality_rules WHERE id = $1',
    [ruleId]
  );
  return rowToRule(result.rows[0]);
}

/**
 * Find rule by slug
 */
async function findRuleBySlug(slug) {
  const result = await database.query(
    'SELECT * FROM hospitality_rules WHERE slug = $1',
    [slug]
  );
  return rowToRule(result.rows[0]);
}

/**
 * Create a new rule
 */
async function createRule(ruleData) {
  const id = uuidv4();

  const result = await database.query(
    `INSERT INTO hospitality_rules
     (id, name, slug, description, target_audience, target_funnel_stages,
      trigger_conditions, action_type, action_config, is_active, priority,
      start_date, end_date, max_per_session, max_per_day, cooldown_seconds, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      id,
      ruleData.name,
      ruleData.slug,
      ruleData.description || null,
      ruleData.targetAudience || 'all',
      ruleData.targetFunnelStages || null,
      JSON.stringify(ruleData.triggerConditions || {}),
      ruleData.actionType,
      JSON.stringify(ruleData.actionConfig || {}),
      ruleData.isActive !== false,
      ruleData.priority || 100,
      ruleData.startDate || null,
      ruleData.endDate || null,
      ruleData.maxPerSession || 1,
      ruleData.maxPerDay || 3,
      ruleData.cooldownSeconds || 300,
      ruleData.createdBy || null
    ]
  );

  return rowToRule(result.rows[0]);
}

/**
 * Update a rule
 */
async function updateRule(ruleId, updates) {
  const fieldMap = {
    name: 'name',
    description: 'description',
    targetAudience: 'target_audience',
    targetFunnelStages: 'target_funnel_stages',
    triggerConditions: 'trigger_conditions',
    actionType: 'action_type',
    actionConfig: 'action_config',
    isActive: 'is_active',
    priority: 'priority',
    startDate: 'start_date',
    endDate: 'end_date',
    maxPerSession: 'max_per_session',
    maxPerDay: 'max_per_day',
    cooldownSeconds: 'cooldown_seconds'
  };

  const dbUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (dbField) {
      // Handle JSONB fields
      if (key === 'triggerConditions' || key === 'actionConfig') {
        dbUpdates[dbField] = JSON.stringify(value);
      } else {
        dbUpdates[dbField] = value;
      }
    }
  }

  const fields = Object.keys(dbUpdates);
  const values = Object.values(dbUpdates);

  if (fields.length === 0) {
    return await findRuleById(ruleId);
  }

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

  const result = await database.query(
    `UPDATE hospitality_rules
     SET ${setClause}, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [ruleId, ...values]
  );

  return rowToRule(result.rows[0]);
}

/**
 * Delete (deactivate) a rule
 */
async function deactivateRule(ruleId) {
  return await updateRule(ruleId, { isActive: false });
}

// ============================================
// Cooldown Operations
// ============================================

/**
 * Get cooldown for a user/session and rule
 */
async function getCooldown(identifier, ruleId) {
  const { userId, sessionId } = identifier;
  const whereClause = userId ? 'user_id = $1' : 'session_id = $1';
  const whereValue = userId || sessionId;

  const result = await database.query(
    `SELECT * FROM hospitality_rule_cooldowns
     WHERE ${whereClause} AND rule_id = $2`,
    [whereValue, ruleId]
  );

  return rowToCooldown(result.rows[0]);
}

/**
 * Update or create cooldown after rule trigger
 */
async function updateCooldown(identifier, ruleId, cooldownSeconds) {
  const { userId, sessionId } = identifier;
  const id = uuidv4();
  const cooldownUntil = new Date(Date.now() + cooldownSeconds * 1000);

  const result = await database.query(
    `INSERT INTO hospitality_rule_cooldowns
     (id, user_id, session_id, rule_id, times_triggered_session, times_triggered_today,
      last_triggered_at, cooldown_until)
     VALUES ($1, $2, $3, $4, 1, 1, NOW(), $5)
     ON CONFLICT (user_id, rule_id) DO UPDATE SET
       times_triggered_session = hospitality_rule_cooldowns.times_triggered_session + 1,
       times_triggered_today = CASE
         WHEN hospitality_rule_cooldowns.last_daily_reset < CURRENT_DATE
         THEN 1
         ELSE hospitality_rule_cooldowns.times_triggered_today + 1
       END,
       last_triggered_at = NOW(),
       cooldown_until = $5,
       last_daily_reset = CASE
         WHEN hospitality_rule_cooldowns.last_daily_reset < CURRENT_DATE
         THEN CURRENT_DATE
         ELSE hospitality_rule_cooldowns.last_daily_reset
       END,
       updated_at = NOW()
     RETURNING *`,
    [id, userId || null, sessionId || null, ruleId, cooldownUntil]
  );

  return rowToCooldown(result.rows[0]);
}

/**
 * Check if user/session is on cooldown for a rule
 */
async function isOnCooldown(identifier, rule) {
  const cooldown = await getCooldown(identifier, rule.id);

  if (!cooldown) return false;

  // Check time-based cooldown
  if (cooldown.cooldownUntil && new Date(cooldown.cooldownUntil) > new Date()) {
    return true;
  }

  // Check session limit
  if (cooldown.timesTriggeredSession >= rule.maxPerSession) {
    return true;
  }

  // Check daily limit (reset if new day)
  const today = new Date().toISOString().split('T')[0];
  const lastReset = cooldown.lastDailyReset ? cooldown.lastDailyReset.toISOString().split('T')[0] : null;

  if (lastReset === today && cooldown.timesTriggeredToday >= rule.maxPerDay) {
    return true;
  }

  return false;
}

// ============================================
// Admin Statistics
// ============================================

/**
 * Get visitor hospitality statistics
 */
async function getVisitorStats(options = {}) {
  const { limit = 50, offset = 0, sortBy = 'lastActivityAt' } = options;

  // Map sortBy to database column
  const sortColumn = {
    lastActivityAt: 'last_activity_at',
    engagementScore: 'engagement_score',
    pageViews: 'page_views'
  }[sortBy] || 'last_activity_at';

  // Get aggregate stats
  const aggregateResult = await database.query(`
    SELECT
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE funnel_stage = 'visitor') as visitor_count,
      COUNT(*) FILTER (WHERE funnel_stage = 'interested') as interested_count,
      COUNT(*) FILTER (WHERE funnel_stage = 'engaged') as engaged_count,
      AVG(engagement_score) as avg_engagement_score,
      AVG(page_views) as avg_page_views,
      AVG(session_count) as avg_session_count
    FROM hospitality_user_state
    WHERE user_id IS NULL
  `);

  // Get recent visitor states with persona name
  const statesResult = await database.query(`
    SELECT hus.*,
           p.name as last_persona_name,
           p.slug as last_persona_slug,
           (SELECT COUNT(*) FROM hospitality_events he WHERE he.session_id = hus.session_id) as event_count,
           (SELECT COUNT(*) FROM hospitality_actions ha WHERE ha.session_id = hus.session_id) as action_count
    FROM hospitality_user_state hus
    LEFT JOIN personas p ON hus.last_persona_id = p.id
    WHERE hus.user_id IS NULL
    ORDER BY hus.${sortColumn} DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  // Get funnel breakdown
  const funnelResult = await database.query(`
    SELECT funnel_stage, COUNT(*) as count
    FROM hospitality_user_state
    WHERE user_id IS NULL
    GROUP BY funnel_stage
  `);

  // Transform visitors with additional data
  const visitors = statesResult.rows.map(row => ({
    ...rowToUserState(row),
    lastPersonaName: row.last_persona_name,
    lastPersonaSlug: row.last_persona_slug,
    eventCount: parseInt(row.event_count, 10),
    actionCount: parseInt(row.action_count, 10)
  }));

  return {
    summary: aggregateResult.rows[0],
    visitors,
    total: parseInt(aggregateResult.rows[0].total_count, 10),
    funnelBreakdown: funnelResult.rows,
    pagination: { limit, offset }
  };
}

/**
 * Get subscriber hospitality statistics
 */
async function getSubscriberStats(options = {}) {
  const { limit = 50, offset = 0, sortBy = 'engagementScore' } = options;

  // Map sortBy to database column
  const sortColumn = {
    engagementScore: 'engagement_score',
    lastActivityAt: 'last_activity_at',
    displayName: 'display_name'
  }[sortBy] || 'engagement_score';

  // Get aggregate stats for subscribers with engagement distribution
  const aggregateResult = await database.query(`
    SELECT
      COUNT(*) as subscriber_count,
      COUNT(*) FILTER (WHERE funnel_stage = 'subscriber') as active_subscribers,
      COUNT(*) FILTER (WHERE funnel_stage = 'advocate') as advocates,
      AVG(engagement_score) as avg_engagement_score,
      AVG(page_views) as avg_page_views,
      AVG(total_time_on_site_seconds) as avg_time_on_site,
      COUNT(*) FILTER (WHERE engagement_score >= 60) as high_engagement,
      COUNT(*) FILTER (WHERE engagement_score >= 30 AND engagement_score < 60) as medium_engagement,
      COUNT(*) FILTER (WHERE engagement_score < 30) as low_engagement
    FROM hospitality_user_state hus
    WHERE hus.user_id IN (
      SELECT user_id FROM user_subscriptions WHERE status = 'active'
    )
  `);

  // Get subscriber states with user info and subscription tier
  const statesResult = await database.query(`
    SELECT hus.*, u.display_name, u.email, u.avatar_url,
           us.plan_id,
           p.name as last_persona_name,
           (SELECT COUNT(*) FROM hospitality_events he WHERE he.user_id = hus.user_id) as event_count,
           (SELECT COUNT(*) FROM hospitality_actions ha WHERE ha.user_id = hus.user_id AND ha.outcome = 'clicked') as engaged_actions
    FROM hospitality_user_state hus
    JOIN users u ON hus.user_id = u.id
    LEFT JOIN user_subscriptions us ON hus.user_id = us.user_id AND us.status = 'active'
    LEFT JOIN personas p ON hus.last_persona_id = p.id
    WHERE hus.user_id IN (
      SELECT user_id FROM user_subscriptions WHERE status = 'active'
    )
    ORDER BY hus.${sortColumn} DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  // Map plan IDs to tier names
  const getTierName = (planId) => {
    if (!planId) return 'standard';
    const id = planId.toLowerCase();
    if (id.includes('business')) return 'business';
    if (id.includes('ministry')) return 'ministry';
    return 'standard';
  };

  return {
    summary: aggregateResult.rows[0],
    distribution: {
      high: parseInt(aggregateResult.rows[0].high_engagement, 10) || 0,
      medium: parseInt(aggregateResult.rows[0].medium_engagement, 10) || 0,
      low: parseInt(aggregateResult.rows[0].low_engagement, 10) || 0
    },
    subscribers: statesResult.rows.map(row => ({
      ...rowToUserState(row),
      displayName: row.display_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      subscriptionTier: getTierName(row.plan_id),
      lastPersonaName: row.last_persona_name,
      eventCount: parseInt(row.event_count, 10),
      engagedActions: parseInt(row.engaged_actions, 10)
    })),
    total: parseInt(aggregateResult.rows[0].subscriber_count, 10),
    pagination: { limit, offset }
  };
}

/**
 * Get rule performance statistics
 */
async function getRuleStats() {
  const result = await database.query(`
    SELECT
      hr.id, hr.name, hr.slug, hr.is_active, hr.priority,
      COUNT(ha.id) as total_triggers,
      COUNT(ha.id) FILTER (WHERE ha.outcome = 'shown') as times_shown,
      COUNT(ha.id) FILTER (WHERE ha.outcome = 'clicked') as times_clicked,
      COUNT(ha.id) FILTER (WHERE ha.outcome = 'dismissed') as times_dismissed,
      COUNT(ha.id) FILTER (WHERE ha.outcome = 'converted') as times_converted,
      ROUND(
        COUNT(ha.id) FILTER (WHERE ha.outcome = 'clicked')::numeric /
        NULLIF(COUNT(ha.id) FILTER (WHERE ha.outcome = 'shown'), 0) * 100, 2
      ) as click_rate
    FROM hospitality_rules hr
    LEFT JOIN hospitality_actions ha ON hr.id = ha.rule_id
    GROUP BY hr.id, hr.name, hr.slug, hr.is_active, hr.priority
    ORDER BY hr.priority ASC
  `);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    priority: row.priority,
    totalTriggers: parseInt(row.total_triggers, 10),
    timesShown: parseInt(row.times_shown, 10),
    timesClicked: parseInt(row.times_clicked, 10),
    timesDismissed: parseInt(row.times_dismissed, 10),
    timesConverted: parseInt(row.times_converted, 10),
    clickRate: parseFloat(row.click_rate) || 0
  }));
}

// ============================================
// Module Exports
// ============================================

module.exports = {
  // User State
  findUserStateByUserId,
  findUserStateBySessionId,
  getOrCreateUserState,
  updateUserState,
  incrementUserStateCounters,

  // Events
  createEvent,
  getRecentEvents,
  countEventsByType,

  // Actions
  createAction,
  updateActionOutcome,
  getPendingActions,
  getRecentActions,

  // Rules
  findAllActiveRules,
  findAllRules,
  findRuleById,
  findRuleBySlug,
  createRule,
  updateRule,
  deactivateRule,

  // Cooldowns
  getCooldown,
  updateCooldown,
  isOnCooldown,

  // Admin Stats
  getVisitorStats,
  getSubscriberStats,
  getRuleStats
};
