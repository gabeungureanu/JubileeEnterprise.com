#!/usr/bin/env node
/**
 * Insert tasks for Analytics and Safeguard infrastructure work
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function main() {
  // Tasks from this conversation - all completed
  const tasks = [
    {
      task_number: 133,
      title: 'User Analytics Intelligence System - Database Schema',
      description: 'Create database migration 054 for user analytics intelligence system including conversation_analysis table with sentiment scoring, emotion tracking (10 dimensions), Five-Fold ministry gifts, MBTI indicators, and user_monthly_analytics aggregation table.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Database',
      notes: 'Migration 054_user_analytics_intelligence.sql created and executed successfully.'
    },
    {
      task_number: 134,
      title: 'User Analytics Intelligence System - Models',
      description: 'Create ConversationAnalysis and UserMonthlyAnalytics models with full CRUD operations, aggregation functions, and privacy-aware queries.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'Models created: src/models/ConversationAnalysis.js, src/models/UserMonthlyAnalytics.js'
    },
    {
      task_number: 135,
      title: 'User Analytics Intelligence System - Service Layer',
      description: 'Create ConversationAnalysisService with AI-powered analysis pipeline that extracts sentiment, emotions, spiritual gifts, MBTI indicators, needs, challenges, and topics from conversations.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'Service created: src/services/ConversationAnalysisService.js with full AI integration.'
    },
    {
      task_number: 136,
      title: 'User Analytics Intelligence System - Controller & Routes',
      description: 'Create ConversationAnalysisController with endpoints for conversation analysis, user analytics retrieval, monthly analytics, and analytics consent management.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'Controller and routes added to api.js: POST /conversation/analyze, GET /user/analytics, GET /user/analytics/:yearMonth, PUT /user/analytics-consent'
    },
    {
      task_number: 137,
      title: 'Extended User Analytics - Spiritual Demographics',
      description: 'Create migration 055 extending analytics with spiritual demographics including Five-Fold ministry scoring, worldview indicators, and spiritual journey tracking.',
      task_type: 'development',
      priority: 'medium',
      status: 'completed',
      component: 'Database',
      notes: 'Migration 055_extended_user_analytics.sql created and executed.'
    },
    {
      task_number: 138,
      title: 'Privacy Controls - Conversation Privacy & Self-Declared Demographics',
      description: 'Create migration 056 adding is_private flag to conversations, self-declared demographics fields to users (sex, language, church background, age range, marital status, etc.), and privacy enforcement.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Database',
      notes: 'Migration 056_spiritual_demographics_privacy.sql created and executed. Added privacy controls to ConversationAnalysisController.'
    },
    {
      task_number: 139,
      title: 'Safeguard Infrastructure - Database Schema',
      description: 'Create migration 057 with comprehensive safeguard tables: safety_flags for tracking high-risk events, admin_alerts for administrator notifications, admin_alert_access_log for RBAC auditing, persona_performance for behavior metrics, persona_engagement_metrics for trend analysis, and safeguard_thresholds for configurable alerting.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Database',
      notes: 'Migration 057_safeguard_infrastructure.sql created with database triggers for privacy enforcement.'
    },
    {
      task_number: 140,
      title: 'Safeguard Infrastructure - Safety Detection Service',
      description: 'Create SafeguardService with AI-powered safety detection for self-harm, threats, sexual advances, grooming, manipulation, and boundary violations. Includes three-layer privacy enforcement and persona performance analysis.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Backend',
      notes: 'Service created: src/services/SafeguardService.js with SAFETY_ANALYSIS_PROMPT and PERSONA_PERFORMANCE_PROMPT.'
    },
    {
      task_number: 141,
      title: 'Safeguard Infrastructure - Models',
      description: 'Create SafeguardFlag, AdminAlert, and PersonaPerformance models with privacy-aware queries, authorization checking, access logging, and engagement metrics tracking.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Backend',
      notes: 'Models created: src/models/SafeguardFlag.js, src/models/AdminAlert.js, src/models/PersonaPerformance.js'
    },
    {
      task_number: 142,
      title: 'Safeguard Infrastructure - Admin Controller & Routes',
      description: 'Create SafeguardController with 18 admin endpoints for alert management, safety flag review, persona metrics, and statistics. Includes requireSafeguardAccess middleware for role-based access control.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Backend',
      notes: 'Controller created: src/controllers/SafeguardController.js. Routes added to api.js under /api/admin/safeguard/*'
    },
    {
      task_number: 143,
      title: 'Safeguard Infrastructure - Integration with Analysis Pipeline',
      description: 'Integrate SafeguardService into ConversationAnalysisService so safeguard analysis runs automatically after conversation analysis (non-blocking). Update ConversationAnalysis model with safeguard tracking fields.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'ConversationAnalysisService.js updated with SafeguardService integration. ConversationAnalysis.js updated with updateSafeguardInfo function.'
    }
  ];

  console.log('Inserting analytics and safeguard tasks...\n');

  for (const task of tasks) {
    try {
      const result = await pool.query(`
        INSERT INTO admin_tasks (
          task_number, title, description, task_type, priority, status, component, notes,
          workflow_status, created_at, updated_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', NOW(), NOW(), NOW())
        RETURNING task_number
      `, [
        task.task_number,
        task.title,
        task.description,
        task.task_type,
        task.priority,
        task.status,
        task.component,
        task.notes
      ]);
      console.log(`✅ Task ${task.task_number}: ${task.title.substring(0, 50)}...`);
    } catch (err) {
      console.error(`❌ Error with task ${task.task_number}:`, err.message);
    }
  }

  // Verify tasks were inserted
  const countResult = await pool.query(
    'SELECT COUNT(*) as count FROM admin_tasks WHERE task_number >= 133 AND task_number <= 143'
  );
  console.log(`\n✅ Total tasks in range 133-143: ${countResult.rows[0].count}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
