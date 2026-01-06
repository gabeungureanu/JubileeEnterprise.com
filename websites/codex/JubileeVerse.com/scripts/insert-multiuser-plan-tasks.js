#!/usr/bin/env node
/**
 * Insert tasks for Multi-User Plan Infrastructure work
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
  // Tasks for multi-user plan infrastructure - all completed
  const tasks = [
    {
      task_number: 144,
      title: 'Multi-User Plan Infrastructure - Database Schema',
      description: 'Create migration 058 with comprehensive multi-user plan tables: shared_token_pools for plan-level token management, plan_memberships for user associations, plan_invitations for invitation workflow, plan_type_limits for plan configuration, sensitive_data_audit_log for compliance tracking, terms_acceptance_log for legal compliance, and plan_default_communities for community scoping.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Database',
      notes: 'Migration 058_multi_user_plans.sql created with database functions for token management (deduct_pool_tokens, add_purchased_tokens, reset_pool_period) and triggers for capacity/age verification enforcement.'
    },
    {
      task_number: 145,
      title: 'Multi-User Plan Infrastructure - SharedTokenPool Model',
      description: 'Create SharedTokenPool model for managing shared token allocation across plan members. Includes functions for token deduction, balance checking, purchase tracking, usage history by user, and pool summary.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Backend',
      notes: 'Model created: src/models/SharedTokenPool.js with atomic token operations.'
    },
    {
      task_number: 146,
      title: 'Multi-User Plan Infrastructure - PlanMembership Model',
      description: 'Create PlanMembership model for tracking user membership in shared plans. Supports primary vs associated roles, age verification status, terms acceptance, and per-user usage tracking within the pool.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Backend',
      notes: 'Model created: src/models/PlanMembership.js with capacity checking and membership management.'
    },
    {
      task_number: 147,
      title: 'Multi-User Plan Infrastructure - PlanInvitation Model',
      description: 'Create PlanInvitation model for managing invitations to join shared plans. Includes secure token generation, age attestation tracking, expiration handling, and invitation lifecycle management.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'Model created: src/models/PlanInvitation.js with 7-day expiration and required age attestation.'
    },
    {
      task_number: 148,
      title: 'Multi-User Plan Infrastructure - UserAuditLog Model',
      description: 'Create UserAuditLog model for tracking access to sensitive user data. Records accessor, target, action type, context, and result. Immutable log for compliance and accountability reviews.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'Model created: src/models/UserAuditLog.js with AUDIT_ACTIONS enum and unusual pattern detection.'
    },
    {
      task_number: 149,
      title: 'Multi-User Plan Infrastructure - PlanManagementService',
      description: 'Create PlanManagementService orchestrating all multi-user plan operations: plan initialization, user invitation, invitation acceptance, member removal, token usage, token purchases, plan upgrades/downgrades, and default community management.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Backend',
      notes: 'Service created: src/services/PlanManagementService.js with full lifecycle support and terms/age compliance.'
    },
    {
      task_number: 150,
      title: 'Multi-User Plan Infrastructure - Controller & Routes',
      description: 'Create PlanManagementController with 15 endpoints for plan management: plan info, balance, capacity, member listing, invitation CRUD, invitation acceptance/decline, usage history, purchase history, and token purchasing.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'Controller created: src/controllers/PlanManagementController.js. Routes added to api.js under /api/plan/*'
    },
    {
      task_number: 151,
      title: 'Multi-User Plan Infrastructure - Plan Limits Configuration',
      description: 'Configure plan type limits for visitor (1 user, 1K tokens), standard (1 user, 50K tokens), ministry (5 users, 200K tokens), business (10 users, 500K tokens), and enterprise (100 users, 2M tokens) with token purchase and community features.',
      task_type: 'development',
      priority: 'medium',
      status: 'completed',
      component: 'Database',
      notes: 'Plan limits inserted into plan_type_limits table with default communities for ministry/business/enterprise.'
    },
    {
      task_number: 152,
      title: 'Multi-User Plan Infrastructure - Age Compliance Enforcement',
      description: 'Implement age compliance at multiple layers: inviter must attest invitee is 13+, database trigger prevents activation without age verification, terms acceptance logged for audit, and standard attestation text recorded.',
      task_type: 'development',
      priority: 'critical',
      status: 'completed',
      component: 'Backend',
      notes: 'Age compliance enforced via trg_enforce_age_verification trigger and PlanInvitation.AGE_ATTESTATION_TEXT constant.'
    },
    {
      task_number: 153,
      title: 'Multi-User Plan Infrastructure - Audit Logging Integration',
      description: 'Integrate sensitive data audit logging throughout plan management: log member list access, invitation creation, member removal, and plan detail viewing. Track accessor role, IP, user agent, and result counts.',
      task_type: 'development',
      priority: 'high',
      status: 'completed',
      component: 'Backend',
      notes: 'Audit logging integrated into PlanManagementService and PlanManagementController with UserAuditLog.logAccess calls.'
    }
  ];

  console.log('Inserting multi-user plan infrastructure tasks...\n');

  for (const task of tasks) {
    try {
      await pool.query(`
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
    'SELECT COUNT(*) as count FROM admin_tasks WHERE task_number >= 144 AND task_number <= 153'
  );
  console.log(`\n✅ Total tasks in range 144-153: ${countResult.rows[0].count}`);

  // Get overall stats
  const statsResult = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status != 'completed') as pending
    FROM admin_tasks
  `);
  console.log(`\n📊 Overall Task Statistics:`);
  console.log(`   Total: ${statsResult.rows[0].total}`);
  console.log(`   Completed: ${statsResult.rows[0].completed}`);
  console.log(`   Pending: ${statsResult.rows[0].pending}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
