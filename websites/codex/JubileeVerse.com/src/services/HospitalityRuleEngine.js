/**
 * Hospitality Rule Engine
 * Evaluates engagement rules against user state and events,
 * and triggers appropriate hospitality actions.
 */

const logger = require('../utils/logger');
const { Hospitality } = require('../models');

// ============================================
// Rules Cache
// ============================================

let rulesCache = [];
let lastRulesRefresh = 0;
const RULES_CACHE_TTL = 60000; // 1 minute

/**
 * Refresh the rules cache
 */
async function refreshRulesCache(force = false) {
  const now = Date.now();

  if (!force && now - lastRulesRefresh < RULES_CACHE_TTL && rulesCache.length > 0) {
    return rulesCache;
  }

  try {
    rulesCache = await Hospitality.findAllActiveRules();
    lastRulesRefresh = now;
    logger.debug('Refreshed hospitality rules cache', { ruleCount: rulesCache.length });
  } catch (error) {
    logger.error('Failed to refresh rules cache', { error: error.message });
    // Keep using existing cache on error
  }

  return rulesCache;
}

/**
 * Invalidate the rules cache (call after rule updates)
 */
function invalidateRulesCache() {
  lastRulesRefresh = 0;
  rulesCache = [];
  logger.debug('Invalidated hospitality rules cache');
}

// ============================================
// Rule Evaluation
// ============================================

/**
 * Evaluate all rules for a given event
 * @param {Object} event - The hospitality event that was logged
 * @returns {Object|null} The triggered action, if any
 */
async function evaluateRulesForEvent(event) {
  try {
    const rules = await refreshRulesCache();

    if (rules.length === 0) {
      return null;
    }

    const identifier = {
      userId: event.userId || null,
      sessionId: event.sessionId || null
    };

    // Get current user state
    const state = event.userId
      ? await Hospitality.findUserStateByUserId(event.userId)
      : await Hospitality.findUserStateBySessionId(event.sessionId);

    if (!state) {
      return null;
    }

    // Evaluate rules in priority order (lower priority number = higher priority)
    for (const rule of rules) {
      try {
        // Check if rule applies to this user type
        if (!matchesTargetAudience(rule, state)) {
          continue;
        }

        // Check if event matches trigger conditions
        if (!evaluateTriggerConditions(rule.triggerConditions, event, state)) {
          continue;
        }

        // Check cooldowns
        const onCooldown = await Hospitality.isOnCooldown(identifier, rule);
        if (onCooldown) {
          logger.debug('Rule on cooldown', { ruleId: rule.id, ruleName: rule.name });
          continue;
        }

        // Rule matched - trigger action
        const action = await triggerAction(rule, event, identifier, state);

        // Update cooldown
        await Hospitality.updateCooldown(identifier, rule.id, rule.cooldownSeconds);

        logger.info('Hospitality rule triggered', {
          ruleId: rule.id,
          ruleName: rule.name,
          actionId: action.id,
          userId: event.userId,
          sessionId: event.sessionId
        });

        // Only trigger one rule per event (first matching by priority)
        return action;

      } catch (error) {
        logger.error('Error evaluating rule', {
          ruleId: rule.id,
          error: error.message
        });
        // Continue to next rule on error
      }
    }

    return null;
  } catch (error) {
    logger.error('Failed to evaluate rules for event', {
      error: error.message,
      eventId: event.id
    });
    return null;
  }
}

/**
 * Check if user matches rule's target audience
 */
function matchesTargetAudience(rule, state) {
  const audience = rule.targetAudience;
  const funnelStage = state?.funnelStage || 'visitor';

  // 'all' matches everyone
  if (audience === 'all') {
    return true;
  }

  // Match by audience type
  if (audience === 'visitor') {
    return funnelStage === 'visitor' || funnelStage === 'interested';
  }

  if (audience === 'subscriber') {
    return funnelStage === 'subscriber' || funnelStage === 'advocate' || funnelStage === 'engaged';
  }

  // Check specific funnel stages if defined
  if (rule.targetFunnelStages) {
    const stages = rule.targetFunnelStages.split(',').map(s => s.trim().toLowerCase());
    return stages.includes(funnelStage.toLowerCase());
  }

  return false;
}

/**
 * Evaluate trigger conditions against event and state
 * @param {Object} conditions - JSONB trigger conditions from rule
 * @param {Object} event - The current event
 * @param {Object} state - Current user state
 * @returns {boolean} Whether conditions are met
 */
function evaluateTriggerConditions(conditions, event, state) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // No conditions = always match
  }

  // Event type match
  if (conditions.event_type) {
    if (conditions.event_type !== event.eventType) {
      return false;
    }
  }

  // Page view count threshold
  if (conditions.page_count_gte !== undefined) {
    const pageViews = state?.pageViews || 0;
    if (pageViews < conditions.page_count_gte) {
      return false;
    }
  }

  // Time on site threshold (seconds)
  if (conditions.time_on_site_gte !== undefined) {
    const timeOnSite = state?.totalTimeOnSiteSeconds || 0;
    if (timeOnSite < conditions.time_on_site_gte) {
      return false;
    }
  }

  // Engagement score threshold
  if (conditions.engagement_score_gte !== undefined) {
    const score = state?.engagementScore || 0;
    if (score < conditions.engagement_score_gte) {
      return false;
    }
  }

  // Engagement score upper limit
  if (conditions.engagement_score_lt !== undefined) {
    const score = state?.engagementScore || 0;
    if (score >= conditions.engagement_score_lt) {
      return false;
    }
  }

  // Session count threshold
  if (conditions.session_count_gte !== undefined) {
    const sessions = state?.sessionCount || 1;
    if (sessions < conditions.session_count_gte) {
      return false;
    }
  }

  // Page URL pattern (contains)
  if (conditions.page_url_contains) {
    const pageUrl = event.pageUrl || '';
    if (!pageUrl.toLowerCase().includes(conditions.page_url_contains.toLowerCase())) {
      return false;
    }
  }

  // Page URL exact match
  if (conditions.page_url_equals) {
    const pageUrl = event.pageUrl || '';
    if (pageUrl.toLowerCase() !== conditions.page_url_equals.toLowerCase()) {
      return false;
    }
  }

  // Persona context
  if (conditions.persona_id) {
    if (event.personaId !== conditions.persona_id) {
      return false;
    }
  }

  // Metric value threshold (for scroll depth, time, etc.)
  if (conditions.metric_value_gte !== undefined) {
    const metricValue = event.metricValue || 0;
    if (metricValue < conditions.metric_value_gte) {
      return false;
    }
  }

  // Popups shown today limit
  if (conditions.popups_shown_today_lt !== undefined) {
    const popupsShown = state?.popupsShownToday || 0;
    if (popupsShown >= conditions.popups_shown_today_lt) {
      return false;
    }
  }

  // All conditions passed
  return true;
}

/**
 * Trigger an action for a matched rule
 */
async function triggerAction(rule, event, identifier, state) {
  const actionConfig = rule.actionConfig || {};

  // Determine persona to use
  let personaId = actionConfig.persona_id || null;

  // If no specific persona, could use last interacted persona or default
  if (!personaId && state?.lastPersonaId) {
    personaId = state.lastPersonaId;
  }

  // Create the action record
  const action = await Hospitality.createAction({
    userId: identifier.userId,
    sessionId: identifier.sessionId,
    ruleId: rule.id,
    actionType: rule.actionType,
    actionSubtype: actionConfig.subtype || null,
    personaId,
    actionContent: actionConfig,
    triggerEventId: event.id,
    pageUrl: event.pageUrl
  });

  return action;
}

// ============================================
// Pending Action Management
// ============================================

/**
 * Get the next pending action for a user/session
 */
async function getNextPendingAction(identifier) {
  try {
    const pendingActions = await Hospitality.getPendingActions(identifier, 1);

    if (pendingActions.length === 0) {
      return null;
    }

    const action = pendingActions[0];

    // Enrich with rule config if needed
    if (action.ruleId) {
      const rule = await Hospitality.findRuleById(action.ruleId);
      if (rule) {
        action.config = {
          ...action.actionContent,
          ...rule.actionConfig
        };
      }
    }

    return action;
  } catch (error) {
    logger.error('Failed to get next pending action', { error: error.message });
    return null;
  }
}

/**
 * Expire old pending actions
 * Should be called periodically via scheduled job
 */
async function expireOldPendingActions(maxAgeMinutes = 30) {
  try {
    // This would be a database update - for now, log intention
    logger.debug('Would expire pending actions older than', { maxAgeMinutes });
    // Implementation would update actions where:
    // outcome = 'pending' AND created_at < NOW() - interval 'X minutes'
    // SET outcome = 'expired'
  } catch (error) {
    logger.error('Failed to expire old pending actions', { error: error.message });
  }
}

// ============================================
// Rule Management (Admin Operations)
// ============================================

/**
 * Get all rules for admin view
 */
async function getAllRules(options = {}) {
  return await Hospitality.findAllRules(options);
}

/**
 * Get rule by ID
 */
async function getRuleById(ruleId) {
  return await Hospitality.findRuleById(ruleId);
}

/**
 * Create a new rule
 */
async function createRule(ruleData) {
  const rule = await Hospitality.createRule(ruleData);
  invalidateRulesCache();
  logger.info('Created hospitality rule', { ruleId: rule.id, ruleName: rule.name });
  return rule;
}

/**
 * Update a rule
 */
async function updateRule(ruleId, updates) {
  const rule = await Hospitality.updateRule(ruleId, updates);
  invalidateRulesCache();
  logger.info('Updated hospitality rule', { ruleId, updates: Object.keys(updates) });
  return rule;
}

/**
 * Deactivate a rule
 */
async function deactivateRule(ruleId) {
  const rule = await Hospitality.deactivateRule(ruleId);
  invalidateRulesCache();
  logger.info('Deactivated hospitality rule', { ruleId });
  return rule;
}

/**
 * Validate rule trigger conditions
 * Returns array of validation errors, empty if valid
 */
function validateTriggerConditions(conditions) {
  const errors = [];
  const validKeys = [
    'event_type',
    'page_count_gte',
    'time_on_site_gte',
    'engagement_score_gte',
    'engagement_score_lt',
    'session_count_gte',
    'page_url_contains',
    'page_url_equals',
    'persona_id',
    'metric_value_gte',
    'popups_shown_today_lt'
  ];

  for (const key of Object.keys(conditions)) {
    if (!validKeys.includes(key)) {
      errors.push(`Unknown trigger condition: ${key}`);
    }
  }

  // Validate numeric values
  const numericKeys = [
    'page_count_gte',
    'time_on_site_gte',
    'engagement_score_gte',
    'engagement_score_lt',
    'session_count_gte',
    'metric_value_gte',
    'popups_shown_today_lt'
  ];

  for (const key of numericKeys) {
    if (conditions[key] !== undefined && typeof conditions[key] !== 'number') {
      errors.push(`${key} must be a number`);
    }
  }

  return errors;
}

/**
 * Validate rule action config
 */
function validateActionConfig(actionType, actionConfig) {
  const errors = [];

  if (actionType === 'popup') {
    if (!actionConfig.title) {
      errors.push('Popup action requires a title');
    }
    if (!actionConfig.message) {
      errors.push('Popup action requires a message');
    }
  }

  if (actionType === 'redirect') {
    if (!actionConfig.url) {
      errors.push('Redirect action requires a URL');
    }
  }

  return errors;
}

// ============================================
// Module Exports
// ============================================

// ============================================
// Category Rules with Auto-Generation
// ============================================

const MINIMUM_RULES_PER_CATEGORY = 10;
const PERSONAS = ['jubilee', 'solomon', 'lydia', 'barnabas', 'deborah', 'gideon', 'ruth', 'elijah'];

/**
 * ML-inspired rule templates for auto-generation
 * Each template produces a different type of engagement rule
 */
const RULE_TEMPLATES = [
  {
    suffix: 'first-visit',
    nameTemplate: '{category} - First Visit Welcome',
    descTemplate: 'Warmly welcomes first-time visitors exploring {category} content',
    sentiment: 'warm_inviting',
    targetAudience: 'visitor',
    triggerConditions: { event_type: 'page_view', is_first_visit: true, time_on_page_gte: 10 },
    actionType: 'persona_message',
    priority: 100
  },
  {
    suffix: 'deep-engagement',
    nameTemplate: '{category} - Deep Engagement',
    descTemplate: 'Recognizes users spending quality time with {category} content',
    sentiment: 'encouraging',
    targetAudience: 'all',
    triggerConditions: { event_type: 'page_engagement', time_on_site_gte: 300, page_count_gte: 5 },
    actionType: 'persona_message',
    priority: 150
  },
  {
    suffix: 'return-visitor',
    nameTemplate: '{category} - Return Visitor',
    descTemplate: 'Welcomes back returning visitors with personalized recommendations',
    sentiment: 'familiar_warm',
    targetAudience: 'subscriber',
    triggerConditions: { event_type: 'session_start', return_visit: true, days_since_last_visit_gte: 3 },
    actionType: 'persona_message',
    priority: 80
  },
  {
    suffix: 'milestone',
    nameTemplate: '{category} - Milestone Reached',
    descTemplate: 'Celebrates user milestones in {category} journey',
    sentiment: 'celebratory',
    targetAudience: 'subscriber',
    triggerConditions: { event_type: 'milestone', completion_percentage_gte: 50 },
    actionType: 'popup',
    priority: 50
  },
  {
    suffix: 'gentle-reengagement',
    nameTemplate: '{category} - Gentle Re-engagement',
    descTemplate: 'Gently re-engages users who pause during exploration',
    sentiment: 'gentle_caring',
    targetAudience: 'all',
    triggerConditions: { event_type: 'inactivity', idle_seconds_gte: 120 },
    actionType: 'persona_message',
    priority: 200
  },
  {
    suffix: 'community-invite',
    nameTemplate: '{category} - Community Connection',
    descTemplate: 'Invites engaged users to join the community',
    sentiment: 'friendly_inclusive',
    targetAudience: 'subscriber',
    triggerConditions: { event_type: 'engagement_threshold', engagement_score_gte: 70 },
    actionType: 'persona_message',
    priority: 120
  },
  {
    suffix: 'smart-recommendation',
    nameTemplate: '{category} - Smart Recommendation',
    descTemplate: 'AI-powered content recommendations based on browsing patterns',
    sentiment: 'helpful_insightful',
    targetAudience: 'all',
    triggerConditions: { event_type: 'content_completion', completed_items_gte: 3 },
    actionType: 'notification',
    priority: 130
  },
  {
    suffix: 'learning-path',
    nameTemplate: '{category} - Learning Path',
    descTemplate: 'Suggests structured learning journey through {category}',
    sentiment: 'guiding',
    targetAudience: 'subscriber',
    triggerConditions: { event_type: 'browse_pattern', random_navigation: true },
    actionType: 'persona_message',
    priority: 140
  },
  {
    suffix: 'feedback-request',
    nameTemplate: '{category} - Feedback Request',
    descTemplate: 'Requests feedback from engaged users about {category} content',
    sentiment: 'appreciative',
    targetAudience: 'subscriber',
    triggerConditions: { event_type: 'session_end', session_duration_gte: 600 },
    actionType: 'popup',
    priority: 180
  },
  {
    suffix: 'quick-tip',
    nameTemplate: '{category} - Quick Tip',
    descTemplate: 'Provides contextual tips for navigating {category}',
    sentiment: 'helpful',
    targetAudience: 'all',
    triggerConditions: { event_type: 'help_signal', confusion_detected: true },
    actionType: 'notification',
    priority: 90
  }
];

/**
 * Get rules for a category, auto-generating if needed to reach minimum
 * Uses advisory lock for concurrency safety
 * @param {string} categoryId - UUID of the category
 * @returns {Object} - { rules: [], generated: number }
 */
async function getRulesForCategory(categoryId) {
  const db = require('../database');

  // Use advisory lock keyed by category ID to prevent concurrent generation
  const lockKey = Buffer.from(categoryId.replace(/-/g, ''), 'hex').readUInt32BE(0);

  try {
    // Acquire advisory lock
    await db.query('SELECT pg_advisory_lock($1)', [lockKey]);

    // Get category info for context
    const categoryResult = await db.query(`
      SELECT ec.id, ec.name, ec.slug, ec.description,
             parent.name as parent_name, parent.slug as parent_slug
      FROM engagement_categories ec
      LEFT JOIN engagement_categories parent ON ec.parent_id = parent.id
      WHERE ec.id = $1 AND ec.is_deleted = FALSE
    `, [categoryId]);

    if (categoryResult.rows.length === 0) {
      await db.query('SELECT pg_advisory_unlock($1)', [lockKey]);
      return { rules: [], generated: 0, error: 'Category not found' };
    }

    const category = categoryResult.rows[0];

    // Count existing rules for this category (including descendants)
    const countResult = await db.query(`
      WITH RECURSIVE descendants AS (
        SELECT id FROM engagement_categories WHERE id = $1
        UNION ALL
        SELECT ec.id FROM engagement_categories ec
        JOIN descendants d ON ec.parent_id = d.id
        WHERE ec.is_deleted = FALSE
      )
      SELECT COUNT(*) as count FROM hospitality_rules hr
      WHERE hr.category_id IN (SELECT id FROM descendants)
    `, [categoryId]);

    const existingCount = parseInt(countResult.rows[0].count) || 0;
    let generatedCount = 0;

    // Generate missing rules if needed
    if (existingCount < MINIMUM_RULES_PER_CATEGORY) {
      const needed = MINIMUM_RULES_PER_CATEGORY - existingCount;

      // Get existing rule slugs to avoid duplicates
      const existingSlugsResult = await db.query(`
        SELECT slug FROM hospitality_rules WHERE category_id = $1
      `, [categoryId]);
      const existingSlugs = new Set(existingSlugsResult.rows.map(r => r.slug));

      // Get next rule number
      const ruleNumResult = await db.query(`
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(rule_number, '[^0-9]', '', 'g') AS INT)), 0) as max_num
        FROM hospitality_rules WHERE rule_number ~ '^[0-9]+$'
      `);
      let nextRuleNum = (parseInt(ruleNumResult.rows[0].max_num) || 0) + 1;

      // Generate rules from templates
      for (let i = 0; i < RULE_TEMPLATES.length && generatedCount < needed; i++) {
        const template = RULE_TEMPLATES[i];
        const slug = `${category.slug}-${template.suffix}`;

        // Skip if rule already exists
        if (existingSlugs.has(slug)) continue;

        const personaIndex = (i + category.name.charCodeAt(0)) % PERSONAS.length;
        const persona = PERSONAS[personaIndex];

        const ruleName = template.nameTemplate.replace(/{category}/g, category.name);
        const ruleDesc = template.descTemplate.replace(/{category}/g, category.name);

        // Build message template based on sentiment
        const messageTemplate = generateMessageTemplate(template.sentiment, category.name, persona);

        try {
          await db.query(`
            INSERT INTO hospitality_rules (
              name, slug, description, category_id, rule_number,
              target_audience, trigger_conditions, action_type, action_config,
              message_template, personalization_config,
              is_active, priority, max_per_session, max_per_day, cooldown_seconds
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (slug) DO NOTHING
          `, [
            ruleName,
            slug,
            ruleDesc,
            categoryId,
            nextRuleNum.toString().padStart(4, '0'),
            template.targetAudience,
            JSON.stringify(template.triggerConditions),
            template.actionType,
            JSON.stringify({
              persona_id: persona,
              title: ruleName,
              sentiment: template.sentiment,
              urgency: 'low'
            }),
            messageTemplate,
            JSON.stringify({
              adaptToLanguage: true,
              adaptToSentiment: true,
              adaptToHistory: true,
              generationVersion: '1.0'
            }),
            true,
            template.priority,
            1,
            2,
            1800
          ]);

          generatedCount++;
          nextRuleNum++;
          existingSlugs.add(slug);
        } catch (insertError) {
          // Ignore duplicate key errors (race condition protection)
          if (insertError.code !== '23505') {
            logger.error('Failed to insert generated rule', { error: insertError.message, slug });
          }
        }
      }

      if (generatedCount > 0) {
        invalidateRulesCache();
        logger.info('Auto-generated rules for category', {
          categoryId,
          categoryName: category.name,
          generated: generatedCount
        });
      }
    }

    // Fetch all rules for this category and descendants
    const rulesResult = await db.query(`
      WITH RECURSIVE descendants AS (
        SELECT id FROM engagement_categories WHERE id = $1
        UNION ALL
        SELECT ec.id FROM engagement_categories ec
        JOIN descendants d ON ec.parent_id = d.id
        WHERE ec.is_deleted = FALSE
      )
      SELECT hr.*, ec.name as category_name, ec.slug as category_slug
      FROM hospitality_rules hr
      LEFT JOIN engagement_categories ec ON hr.category_id = ec.id
      WHERE hr.category_id IN (SELECT id FROM descendants)
      ORDER BY hr.priority ASC, hr.created_at ASC
    `, [categoryId]);

    // Release advisory lock
    await db.query('SELECT pg_advisory_unlock($1)', [lockKey]);

    return {
      rules: rulesResult.rows.map(rowToRuleExtended),
      generated: generatedCount,
      total: rulesResult.rows.length
    };

  } catch (error) {
    // Ensure lock is released on error
    try {
      await db.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } catch (unlockError) {
      logger.error('Failed to release advisory lock', { error: unlockError.message });
    }
    throw error;
  }
}

/**
 * Generate sentiment-aware message template
 */
function generateMessageTemplate(sentiment, categoryName, persona) {
  const templates = {
    warm_inviting: `Hello and welcome! I noticed you're exploring our ${categoryName} resources. I'm here to help you find exactly what you need. What brings you here today?`,
    encouraging: `I can see you're really diving deep into ${categoryName}! Your dedication to growth is inspiring. Would you like me to suggest some advanced resources?`,
    familiar_warm: `Welcome back! It's wonderful to see you again. Since you last visited, we've added some new ${categoryName} content you might enjoy.`,
    celebratory: `Congratulations! You've made amazing progress in your ${categoryName} journey! Your commitment is truly commendable.`,
    gentle_caring: `I noticed you paused for a moment. Sometimes we all need time to reflect. If you have any questions about ${categoryName}, I'm here whenever you're ready.`,
    friendly_inclusive: `You seem to really connect with ${categoryName} content! There's a wonderful community of like-minded people who share this passion.`,
    helpful_insightful: `Based on your journey through ${categoryName}, I think you'd really appreciate some personalized recommendations.`,
    guiding: `I notice you might benefit from a more structured path through ${categoryName}. Would you like me to suggest a learning journey?`,
    appreciative: `Thank you for spending time with our ${categoryName} content! Your feedback helps us improve. Would you share your thoughts?`,
    helpful: `Here's a quick tip for navigating ${categoryName} more effectively.`
  };

  return templates[sentiment] || templates.helpful;
}

/**
 * Convert extended rule row to object
 * Includes both camelCase and snake_case versions for frontend compatibility
 */
function rowToRuleExtended(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    category_id: row.category_id,
    category_name: row.category_name,
    category_slug: row.category_slug,
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
    messageTemplate: row.message_template,
    button_config: row.button_config,
    personalization_config: row.personalization_config,
    personalizationConfig: row.personalization_config,
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

module.exports = {
  // Rule evaluation
  evaluateRulesForEvent,
  matchesTargetAudience,
  evaluateTriggerConditions,

  // Cache management
  refreshRulesCache,
  invalidateRulesCache,

  // Pending actions
  getNextPendingAction,
  expireOldPendingActions,

  // Rule management
  getAllRules,
  getRuleById,
  createRule,
  updateRule,
  deactivateRule,

  // Category rules with auto-generation
  getRulesForCategory,

  // Validation
  validateTriggerConditions,
  validateActionConfig
};
