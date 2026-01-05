#!/usr/bin/env node
/**
 * Hospitality Rules Generation Job
 *
 * This job iterates through every Hospitality Rules category and subcategory,
 * ensuring each has a complete set of 10 high-quality hospitality rules.
 *
 * Features:
 * - Deterministic ordering for repeatable results
 * - ML-inspired rule generation with faith-based context
 * - Idempotent execution with advisory locks
 * - Rich metadata for auditing and dashboards
 *
 * Usage:
 *   node scripts/jobs/generateHospitalityRules.js [--force] [--dry-run] [--category-id UUID]
 *
 * Options:
 *   --force       Regenerate rules even if category already has 10+ rules
 *   --dry-run     Preview what would be generated without inserting
 *   --category-id Process only a specific category (for testing)
 */

const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

// Configuration
const RULES_PER_CATEGORY = 10;
const GENERATION_VERSION = '1.0.0';

// Parse command line arguments
const args = process.argv.slice(2);
const FORCE_REGENERATE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_CATEGORY = args.find(a => a.startsWith('--category-id='))?.split('=')[1];

// ============================================
// Faith-Based Hospitality Rule Templates
// ============================================

/**
 * Sentiment categories for balanced rule generation
 */
const SENTIMENTS = {
  WELCOMING: 'welcoming',
  ENCOURAGING: 'encouraging',
  SUPPORTIVE: 'supportive',
  CELEBRATORY: 'celebratory',
  NURTURING: 'nurturing',
  GUIDING: 'guiding',
  AFFIRMING: 'affirming',
  CONNECTING: 'connecting',
  INSPIRING: 'inspiring',
  GRATEFUL: 'grateful'
};

/**
 * Rule archetypes that ensure diversity in generated rules
 */
const RULE_ARCHETYPES = [
  {
    archetype: 'first_impression',
    sentiment: SENTIMENTS.WELCOMING,
    titleTemplate: 'Welcome {visitor} to {category}',
    contentTemplate: 'Greet new visitors warmly when they first explore {category} content, offering a friendly introduction without being intrusive.',
    descriptionTemplate: 'This rule triggers a warm welcome message when a visitor first engages with {category}. The system displays a non-blocking notification that acknowledges their presence and invites them to explore further. Visitors feel immediately welcomed and valued, setting a positive tone for their spiritual journey.'
  },
  {
    archetype: 'deep_engagement',
    sentiment: SENTIMENTS.ENCOURAGING,
    titleTemplate: 'Celebrate Deep Engagement in {category}',
    contentTemplate: 'Recognize and encourage visitors who spend meaningful time exploring {category}, affirming their dedication to spiritual growth.',
    descriptionTemplate: 'When a visitor demonstrates sustained engagement with {category} content (extended time, multiple interactions), this rule triggers an encouraging message. The system acknowledges their commitment to learning and growth, reinforcing positive behavior without being overbearing.'
  },
  {
    archetype: 'return_visitor',
    sentiment: SENTIMENTS.AFFIRMING,
    titleTemplate: 'Welcome Back to {category}',
    contentTemplate: 'Warmly acknowledge returning visitors to {category}, showing that their continued journey matters and is remembered.',
    descriptionTemplate: 'This rule identifies returning visitors to {category} and provides a personalized welcome-back experience. The system remembers their previous engagement and offers continuity, making visitors feel like valued members of the community rather than anonymous users.'
  },
  {
    archetype: 'milestone_celebration',
    sentiment: SENTIMENTS.CELEBRATORY,
    titleTemplate: '{category} Journey Milestone',
    contentTemplate: 'Celebrate meaningful milestones in the visitor\'s {category} journey, marking progress with joy and encouragement.',
    descriptionTemplate: 'When visitors reach significant milestones in {category} (completing studies, consistent engagement, etc.), this rule triggers a celebratory acknowledgment. The system marks their achievement with a warm message, creating moments of joy and reinforcing their spiritual progress.'
  },
  {
    archetype: 'gentle_guidance',
    sentiment: SENTIMENTS.GUIDING,
    titleTemplate: 'Gentle Guide for {category} Discovery',
    contentTemplate: 'Offer helpful guidance to visitors exploring {category} for the first time, pointing them toward valuable resources without overwhelming.',
    descriptionTemplate: 'This rule provides soft navigation assistance to new {category} explorers. When the system detects uncertainty or wandering behavior, it offers gentle suggestions for next steps. Visitors receive helpful direction while maintaining autonomy over their journey.'
  },
  {
    archetype: 'community_connection',
    sentiment: SENTIMENTS.CONNECTING,
    titleTemplate: 'Connect Through {category}',
    contentTemplate: 'Invite engaged visitors to connect with others in the {category} community, fostering fellowship and shared growth.',
    descriptionTemplate: 'After demonstrating genuine interest in {category}, this rule invites visitors to join community features. The system suggests discussion boards, prayer groups, or study partners. Visitors gain opportunities for meaningful connection while respecting their readiness for community engagement.'
  },
  {
    archetype: 'encouragement_boost',
    sentiment: SENTIMENTS.SUPPORTIVE,
    titleTemplate: 'Encouragement for Your {category} Walk',
    contentTemplate: 'Provide uplifting encouragement to visitors engaging with {category}, offering spiritual support during their journey.',
    descriptionTemplate: 'This rule delivers timely words of encouragement to {category} participants. The system shares relevant scripture, inspiring quotes, or affirming messages. Visitors receive spiritual nourishment that strengthens their faith journey without feeling preached at.'
  },
  {
    archetype: 'inspiration_spark',
    sentiment: SENTIMENTS.INSPIRING,
    titleTemplate: 'Inspiration Awaits in {category}',
    contentTemplate: 'Spark curiosity and inspiration for visitors browsing {category}, highlighting compelling content they might explore.',
    descriptionTemplate: 'When visitors show interest but haven\'t deeply engaged with {category}, this rule surfaces inspiring content recommendations. The system highlights testimonies, powerful teachings, or moving resources that might resonate. Visitors discover content that sparks their spiritual curiosity.'
  },
  {
    archetype: 'gratitude_expression',
    sentiment: SENTIMENTS.GRATEFUL,
    titleTemplate: 'Thank You for Exploring {category}',
    contentTemplate: 'Express genuine gratitude to visitors who engage with {category}, acknowledging their presence as a blessing.',
    descriptionTemplate: 'This rule conveys heartfelt appreciation to {category} participants. The system thanks visitors for being part of the community and contributing to its spiritual richness. Visitors feel valued and recognized, deepening their sense of belonging.'
  },
  {
    archetype: 'nurturing_care',
    sentiment: SENTIMENTS.NURTURING,
    titleTemplate: 'Care for Your {category} Journey',
    contentTemplate: 'Show pastoral care for visitors in {category}, offering support resources and prayer when appropriate.',
    descriptionTemplate: 'This rule provides nurturing support to {category} visitors who may benefit from additional care. The system offers prayer request options, pastoral resources, or support community links. Visitors experiencing challenges find compassionate pathways to help and healing.'
  }
];

/**
 * Category-specific context generators for personalized rules
 */
const CATEGORY_CONTEXTS = {
  // Prayer-related categories
  prayer: {
    keywords: ['prayer', 'intercession', 'supplication', 'petition'],
    visitorType: 'prayer warrior',
    actionVerbs: ['pray', 'intercede', 'lift up', 'seek'],
    benefits: ['spiritual intimacy', 'divine connection', 'answered prayers', 'peace']
  },
  // Bible study categories
  bible: {
    keywords: ['bible', 'scripture', 'study', 'word', 'teaching'],
    visitorType: 'student of the Word',
    actionVerbs: ['study', 'meditate', 'learn', 'discover'],
    benefits: ['biblical understanding', 'spiritual wisdom', 'life application', 'truth']
  },
  // Family & kids categories
  family: {
    keywords: ['family', 'kids', 'children', 'parenting', 'youth'],
    visitorType: 'family member',
    actionVerbs: ['nurture', 'teach', 'grow together', 'build'],
    benefits: ['family unity', 'spiritual heritage', 'faith foundations', 'togetherness']
  },
  // Care & coaching categories
  care: {
    keywords: ['care', 'coaching', 'counseling', 'support', 'help'],
    visitorType: 'seeker of support',
    actionVerbs: ['support', 'encourage', 'guide', 'walk alongside'],
    benefits: ['emotional healing', 'personal growth', 'practical help', 'hope']
  },
  // Outreach & missions categories
  outreach: {
    keywords: ['outreach', 'mission', 'evangelism', 'service', 'community'],
    visitorType: 'kingdom builder',
    actionVerbs: ['serve', 'reach', 'share', 'impact'],
    benefits: ['eternal impact', 'community transformation', 'fulfilled purpose', 'joy of service']
  },
  // Worship categories
  worship: {
    keywords: ['worship', 'praise', 'music', 'song', 'adoration'],
    visitorType: 'worshiper',
    actionVerbs: ['worship', 'praise', 'adore', 'exalt'],
    benefits: ['divine presence', 'spiritual refreshing', 'heart transformation', 'joy']
  },
  // Fellowship categories
  fellowship: {
    keywords: ['fellowship', 'community', 'group', 'connect', 'gathering'],
    visitorType: 'community member',
    actionVerbs: ['connect', 'fellowship', 'gather', 'share'],
    benefits: ['belonging', 'friendship', 'mutual encouragement', 'unity']
  },
  // AI & Digital categories
  digital: {
    keywords: ['ai', 'digital', 'technology', 'online', 'virtual'],
    visitorType: 'digital explorer',
    actionVerbs: ['explore', 'discover', 'engage', 'experience'],
    benefits: ['innovative ministry', 'accessible faith', 'modern connection', 'tech-enabled growth']
  },
  // Default context for unmatched categories
  default: {
    keywords: [],
    visitorType: 'visitor',
    actionVerbs: ['explore', 'engage', 'discover', 'grow'],
    benefits: ['spiritual growth', 'meaningful experience', 'faith journey', 'blessing']
  }
};

// ============================================
// Rule Generation Engine
// ============================================

/**
 * Determine the category context based on name and hierarchy
 */
function determineCategoryContext(category) {
  const searchText = `${category.name} ${category.parent_name || ''} ${category.description || ''}`.toLowerCase();

  for (const [key, context] of Object.entries(CATEGORY_CONTEXTS)) {
    if (key === 'default') continue;
    if (context.keywords.some(kw => searchText.includes(kw))) {
      return { key, ...context };
    }
  }

  return { key: 'default', ...CATEGORY_CONTEXTS.default };
}

/**
 * Generate a unique slug for a rule
 */
function generateSlug(categorySlug, archetype, index) {
  return `${categorySlug}-${archetype}-${index}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * Generate a compelling rule title
 */
function generateRuleTitle(archetype, category, context) {
  const title = archetype.titleTemplate
    .replace(/{category}/g, category.name)
    .replace(/{visitor}/g, context.visitorType);

  return title;
}

/**
 * Generate the rule content (the actionable hospitality rule)
 */
function generateRuleContent(archetype, category, context) {
  let content = archetype.contentTemplate
    .replace(/{category}/g, category.name)
    .replace(/{visitor}/g, context.visitorType);

  // Add context-specific action verbs
  if (context.actionVerbs.length > 0) {
    const verb = context.actionVerbs[Math.floor(category.name.charCodeAt(0) % context.actionVerbs.length)];
    content = content.replace(/engage with/g, verb + ' through');
  }

  return content;
}

/**
 * Generate a rich description for the rule
 */
function generateRuleDescription(archetype, category, context) {
  let description = archetype.descriptionTemplate
    .replace(/{category}/g, category.name)
    .replace(/{visitor}/g, context.visitorType);

  // Add benefit statement
  if (context.benefits.length > 0) {
    const benefit = context.benefits[Math.floor(category.name.length % context.benefits.length)];
    description += ` The ultimate benefit is ${benefit}.`;
  }

  return description;
}

/**
 * Generate trigger conditions based on archetype
 */
function generateTriggerConditions(archetype) {
  const conditions = {};

  switch (archetype.archetype) {
    case 'first_impression':
      conditions.is_first_visit = true;
      conditions.time_on_site_gte = 10;
      break;
    case 'deep_engagement':
      conditions.time_on_site_gte = 180;
      conditions.page_views_gte = 5;
      break;
    case 'return_visitor':
      conditions.is_return_visit = true;
      conditions.session_count_gte = 2;
      break;
    case 'milestone_celebration':
      conditions.engagement_score_gte = 75;
      conditions.session_count_gte = 5;
      break;
    case 'gentle_guidance':
      conditions.is_first_visit = true;
      conditions.idle_seconds_gte = 30;
      break;
    case 'community_connection':
      conditions.engagement_score_gte = 50;
      conditions.time_on_site_gte = 120;
      break;
    case 'encouragement_boost':
      conditions.time_on_site_gte = 60;
      conditions.scroll_depth_gte = 50;
      break;
    case 'inspiration_spark':
      conditions.page_views_gte = 2;
      conditions.time_on_site_lte = 60;
      break;
    case 'gratitude_expression':
      conditions.session_count_gte = 3;
      conditions.engagement_score_gte = 40;
      break;
    case 'nurturing_care':
      conditions.time_on_site_gte = 300;
      conditions.engagement_score_gte = 30;
      break;
  }

  return conditions;
}

/**
 * Generate action configuration based on archetype and context
 */
function generateActionConfig(archetype, category, context) {
  return {
    persona_id: 'jubilee',
    title: generateRuleTitle(archetype, category, context),
    sentiment: archetype.sentiment,
    urgency: archetype.archetype === 'milestone_celebration' ? 'medium' : 'low',
    category_context: context.key,
    dismissible: true
  };
}

/**
 * Generate a complete rule for a category
 */
function generateRule(category, archetype, index, context) {
  const slug = generateSlug(category.slug, archetype.archetype, index);
  const title = generateRuleTitle(archetype, category, context);
  const content = generateRuleContent(archetype, category, context);
  const description = generateRuleDescription(archetype, category, context);

  return {
    name: title,
    slug: slug,
    description: description,
    category_id: category.id,
    rule_number: String(index + 1).padStart(4, '0'),
    target_audience: 'all',
    trigger_conditions: generateTriggerConditions(archetype),
    action_type: 'popup',
    action_config: generateActionConfig(archetype, category, context),
    message_template: content,
    personalization_config: {
      adaptToLanguage: true,
      useVisitorName: true,
      contextAware: true,
      categorySpecific: true
    },
    is_active: true,
    priority: 100 + (index * 10),
    max_per_session: archetype.archetype === 'first_impression' ? 1 : 2,
    max_per_day: 3,
    cooldown_seconds: 300
  };
}

/**
 * Generate all rules for a category
 */
function generateRulesForCategory(category, existingCount) {
  const context = determineCategoryContext(category);
  const needed = RULES_PER_CATEGORY - existingCount;
  const rules = [];

  // Start from the archetype after existing rules
  for (let i = existingCount; i < RULES_PER_CATEGORY; i++) {
    const archetype = RULE_ARCHETYPES[i % RULE_ARCHETYPES.length];
    rules.push(generateRule(category, archetype, i, context));
  }

  return rules;
}

// ============================================
// Database Operations
// ============================================

/**
 * Get all categories in deterministic order (depth-first, alphabetical)
 */
async function getAllCategories() {
  const query = `
    WITH RECURSIVE category_tree AS (
      -- Base case: root categories
      SELECT
        ec.id,
        ec.slug,
        ec.name,
        ec.description,
        ec.parent_id,
        NULL::text as parent_name,
        NULL::text as parent_slug,
        0 as depth,
        ARRAY[ec.name::text] as path
      FROM engagement_categories ec
      WHERE ec.parent_id IS NULL
        AND ec.is_deleted = FALSE

      UNION ALL

      -- Recursive case: child categories
      SELECT
        ec.id,
        ec.slug,
        ec.name,
        ec.description,
        ec.parent_id,
        ct.name::text as parent_name,
        ct.slug::text as parent_slug,
        ct.depth + 1 as depth,
        ct.path || ec.name::text
      FROM engagement_categories ec
      JOIN category_tree ct ON ec.parent_id = ct.id
      WHERE ec.is_deleted = FALSE
    )
    SELECT * FROM category_tree
    ORDER BY path;
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get existing rule count for a category
 */
async function getExistingRuleCount(categoryId) {
  const query = `
    SELECT COUNT(*) as count
    FROM hospitality_rules
    WHERE category_id = $1
  `;

  const result = await pool.query(query, [categoryId]);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get existing rule slugs for a category (to avoid duplicates)
 */
async function getExistingSlugs(categoryId) {
  const query = `
    SELECT slug FROM hospitality_rules WHERE category_id = $1
  `;

  const result = await pool.query(query, [categoryId]);
  return new Set(result.rows.map(r => r.slug));
}

/**
 * Insert a rule into the database
 */
async function insertRule(client, rule) {
  const query = `
    INSERT INTO hospitality_rules (
      name, slug, description, category_id, rule_number,
      target_audience, trigger_conditions, action_type, action_config,
      message_template, personalization_config,
      is_active, priority, max_per_session, max_per_day, cooldown_seconds
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
  `;

  const values = [
    rule.name,
    rule.slug,
    rule.description,
    rule.category_id,
    rule.rule_number,
    rule.target_audience,
    JSON.stringify(rule.trigger_conditions),
    rule.action_type,
    JSON.stringify(rule.action_config),
    rule.message_template,
    JSON.stringify(rule.personalization_config),
    rule.is_active,
    rule.priority,
    rule.max_per_session,
    rule.max_per_day,
    rule.cooldown_seconds
  ];

  const result = await client.query(query, values);
  return result.rows[0]?.id || null;
}

/**
 * Process a single category with advisory lock
 */
async function processCategory(category) {
  const client = await pool.connect();

  try {
    // Acquire advisory lock using category ID hash
    const lockKey = Buffer.from(category.id.replace(/-/g, ''), 'hex').readUInt32BE(0);
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);

    try {
      // Check existing rule count
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM hospitality_rules WHERE category_id = $1',
        [category.id]
      );
      const existingCount = parseInt(countResult.rows[0].count, 10);

      // Skip if already has enough rules (unless force mode)
      if (existingCount >= RULES_PER_CATEGORY && !FORCE_REGENERATE) {
        console.log(`  ✓ Category "${category.name}" already has ${existingCount} rules, skipping`);
        return { skipped: true, existing: existingCount, generated: 0 };
      }

      // Get existing slugs to avoid duplicates
      const slugResult = await client.query(
        'SELECT slug FROM hospitality_rules WHERE category_id = $1',
        [category.id]
      );
      const existingSlugs = new Set(slugResult.rows.map(r => r.slug));

      // Generate needed rules
      const rulesToGenerate = generateRulesForCategory(category, FORCE_REGENERATE ? 0 : existingCount);

      // Filter out rules with existing slugs
      const newRules = rulesToGenerate.filter(r => !existingSlugs.has(r.slug));

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would generate ${newRules.length} rules for "${category.name}"`);
        newRules.forEach(r => console.log(`    - ${r.name}`));
        return { skipped: false, existing: existingCount, generated: newRules.length, dryRun: true };
      }

      if (newRules.length === 0) {
        console.log(`  ✓ Category "${category.name}": ${existingCount} existing, no new rules needed`);
        return { skipped: true, existing: existingCount, generated: 0 };
      }

      // Begin transaction
      await client.query('BEGIN');

      let insertedCount = 0;
      for (const rule of newRules) {
        try {
          const result = await client.query(`
            INSERT INTO hospitality_rules (
              name, slug, description, category_id, rule_number,
              target_audience, trigger_conditions, action_type, action_config,
              message_template, personalization_config,
              is_active, priority, max_per_session, max_per_day, cooldown_seconds
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
          `, [
            rule.name,
            rule.slug,
            rule.description,
            rule.category_id,
            rule.rule_number,
            rule.target_audience,
            JSON.stringify(rule.trigger_conditions),
            rule.action_type,
            JSON.stringify(rule.action_config),
            rule.message_template,
            JSON.stringify(rule.personalization_config),
            rule.is_active,
            rule.priority,
            rule.max_per_session,
            rule.max_per_day,
            rule.cooldown_seconds
          ]);

          if (result.rows[0]?.id) {
            insertedCount++;
            console.log(`    + Created: "${rule.name}"`);
          }
        } catch (insertError) {
          console.log(`    ! Skipped (duplicate): "${rule.name}"`);
        }
      }

      await client.query('COMMIT');

      console.log(`  ✓ Category "${category.name}": ${existingCount} existing, ${insertedCount} generated`);
      return { skipped: false, existing: existingCount, generated: insertedCount };

    } catch (innerError) {
      await client.query('ROLLBACK').catch(() => {});
      throw innerError;
    } finally {
      // Release advisory lock
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]).catch(() => {});
    }

  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// Main Job Runner
// ============================================

async function runJob() {
  console.log('='.repeat(60));
  console.log('Hospitality Rules Generation Job');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Force regenerate: ${FORCE_REGENERATE ? 'YES' : 'NO'}`);
  console.log(`Target: ${SPECIFIC_CATEGORY ? `Category ${SPECIFIC_CATEGORY}` : 'All categories'}`);
  console.log('-'.repeat(60));

  const startTime = Date.now();
  const stats = {
    totalCategories: 0,
    processedCategories: 0,
    skippedCategories: 0,
    totalRulesGenerated: 0,
    errors: []
  };

  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✓ Database connection established\n');

    // Get all categories
    let categories = await getAllCategories();
    stats.totalCategories = categories.length;

    console.log(`Found ${categories.length} categories to process\n`);

    // Filter to specific category if requested
    if (SPECIFIC_CATEGORY) {
      categories = categories.filter(c => c.id === SPECIFIC_CATEGORY);
      if (categories.length === 0) {
        console.error(`Category ${SPECIFIC_CATEGORY} not found`);
        process.exit(1);
      }
    }

    // Process each category
    for (const category of categories) {
      const indent = '  '.repeat(category.depth);
      console.log(`${indent}[${category.depth}] Processing: ${category.name}`);

      try {
        const result = await processCategory(category);

        if (result.skipped) {
          stats.skippedCategories++;
        } else {
          stats.processedCategories++;
          stats.totalRulesGenerated += result.generated;
        }

      } catch (error) {
        console.error(`${indent}  ✗ Error: ${error.message}`);
        stats.errors.push({ category: category.name, error: error.message });
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(60));
  console.log('Job Complete');
  console.log('='.repeat(60));
  console.log(`Duration: ${duration} seconds`);
  console.log(`Total categories: ${stats.totalCategories}`);
  console.log(`Processed: ${stats.processedCategories}`);
  console.log(`Skipped (already complete): ${stats.skippedCategories}`);
  console.log(`Rules generated: ${stats.totalRulesGenerated}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  - ${e.category}: ${e.error}`));
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run the job
runJob().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
