#!/usr/bin/env node
/**
 * Record today's completed work as tasks
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

const todaysWork = [
  {
    title: 'Migration 072: Fix Activity Log Trigger',
    description: `Fixed the log_task_status_change trigger function after workflow_status column was removed.

The trigger was still referencing the dropped workflow_status column, causing errors when inserting new tasks.

Solution:
- Dropped old trigger function
- Created new trigger function using status column
- Recreated trigger on status column changes`,
    taskType: 'bug',
    effortHours: 0.3,
    completedWork: 0.05,
    component: 'Database'
  },
  {
    title: 'Migration 073: Fix All Remaining Status Triggers',
    description: `Fixed all remaining trigger functions that still referenced workflow_status column.

Functions fixed:
- set_task_owner_from_status
- log_task_creation
- validate_child_task_creation
- validate_child_task_reparenting

All functions now use the single 'status' column consistently.`,
    taskType: 'bug',
    effortHours: 0.5,
    completedWork: 0.1,
    component: 'Database'
  },
  {
    title: 'Migration 071: Consolidate Status Columns',
    description: `Removed redundant workflow_status column from admin_tasks table.

Problem: Two status columns existed (status and workflow_status) causing data sync issues where completed tasks weren't showing correctly on the dashboard.

Solution:
- Synced workflow_status data to status column (100 tasks updated)
- Dropped workflow_status column and its dependencies (index, triggers, view)
- Updated all model queries to use single 'status' column
- Dropped task_workflow_status enum type

Files Modified:
- src/models/DailyProgressMetrics.js
- src/models/DashboardMetrics.js
- src/models/AdminTask.js
- scripts/migrations/071_consolidate_status_columns.sql`,
    taskType: 'enhancement',
    effortHours: 2.0,
    completedWork: 0.5,
    component: 'Database'
  },
  {
    title: 'Fix Dashboard Progress Made Panel Data Queries',
    description: `Fixed the Progress Made panel on the Tasks dashboard to show real database values instead of hardcoded demo data.

Problem: The dashboard was showing demo values (99 completed tasks, 5890 EHH) instead of actual database data.

Root Cause: Model queries were using 'status' column but the actual workflow was updating 'workflow_status' column, causing a data mismatch.

Solution:
- Updated all queries in DailyProgressMetrics.js to use correct column
- Updated DashboardMetrics.js queries
- Updated AdminTask.js getStats() and calculateVelocity() queries
- Verified dashboard now shows correct values: 120 completed tasks, 5932 EHH, 130 CW+`,
    taskType: 'bug',
    effortHours: 1.5,
    completedWork: 0.3,
    component: 'Dashboard'
  },
  {
    title: 'Sync Status Column Data',
    description: `Created and ran sync script to align workflow_status with status column data.

Problem: 99 tasks had status='completed' but workflow_status='submitted', causing incorrect dashboard metrics.

Solution:
- Created scripts/sync-workflow-status.js
- Synced 100 tasks to have matching status values
- Verified data integrity after sync`,
    taskType: 'operational',
    effortHours: 0.5,
    completedWork: 0.1,
    component: 'Database'
  }
];

async function run() {
  try {
    console.log("=== Recording Today's Work ===\n");

    for (const work of todaysWork) {
      // Check if task already exists
      const existing = await pool.query(
        'SELECT id FROM admin_tasks WHERE title = $1',
        [work.title]
      );

      if (existing.rows.length > 0) {
        console.log(`Task already exists: ${work.title}`);
        continue;
      }

      // Get next task number
      const nextNum = await pool.query("SELECT nextval('task_code_seq')");
      const taskNumber = parseInt(nextNum.rows[0].nextval);
      const taskCode = 'JIT' + String(taskNumber).padStart(6, '0');

      // Insert the task
      await pool.query(`
        INSERT INTO admin_tasks (
          task_number, task_code, title, description, task_type,
          status, effort_hours, completed_work, component,
          created_at, completed_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          'completed', $6, $7, $8,
          NOW(), NOW()
        )
      `, [
        taskNumber, taskCode, work.title, work.description, work.taskType,
        work.effortHours, work.completedWork, work.component
      ]);

      console.log(`✅ Created: [${taskCode}] ${work.title}`);
      console.log(`   HEH: ${work.effortHours}, CW+: ${work.completedWork}\n`);
    }

    // Show updated totals
    const totals = await pool.query(`
      SELECT
        COUNT(*) as completed_count,
        COALESCE(SUM(effort_hours), 0) as total_ehh,
        COALESCE(SUM(completed_work), 0) as total_cw_plus
      FROM admin_tasks
      WHERE status = 'completed'
    `);

    console.log('=== UPDATED TOTALS ===');
    console.log(`Completed Tasks: ${totals.rows[0].completed_count}`);
    console.log(`Total EHH: ${totals.rows[0].total_ehh}`);
    console.log(`Total CW+: ${totals.rows[0].total_cw_plus}`);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
