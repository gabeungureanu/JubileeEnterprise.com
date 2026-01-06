#!/usr/bin/env node
/**
 * Create task for today's dashboard work
 * - Page load reveal animation with green/red sliding lines
 * - Replaced Rework/Load gauges with Delivery Confidence and Quality Control
 * - Confidence gauge capped at 99%, aligned with Milestone Confidence label
 * - Quality Control renamed from System Stability with updated calculation
 * - Stationary 10% red zone on Fuel gauge drawn on top of fill
 * - Fixed timezone date parsing to prevent off-by-one day discrepancy
 * - Updated all gauge tooltips for clarity
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

async function createTask() {
  console.log('=== Creating Task for Today\'s Dashboard Work ===\n');

  // Get next task number
  const numResult = await pool.query(`
    SELECT COALESCE(MAX(task_number), 0) + 1 as next_num
    FROM admin_tasks
  `);
  const taskNumber = numResult.rows[0].next_num;

  const task = {
    title: 'Dashboard UI - Gauge improvements and page animations',
    description: `Major dashboard enhancements:
- Page load reveal animation with green/red vertical lines sliding from center
- Replaced Rework gauge with Delivery Confidence (capped at 99%, aligned with Milestone Confidence label)
- Replaced Load gauge with Quality Control (tracking process reliability)
- Added stationary 10% red zone on Fuel gauge (drawn on top of fill)
- Fixed timezone date parsing to prevent off-by-one day discrepancy
- Updated all gauge tooltips for clearer terminology
- Created parseLocalDate() utility for consistent date handling`,
    task_type: 'enhancement',
    priority: 'high',
    effort_hours: 32, // Complex UI animation, gauge logic, date handling
    completed_work: 1.5 // Actual hours worked with AI assistance
  };

  const result = await pool.query(`
    INSERT INTO admin_tasks (
      task_number, title, description, task_type, priority,
      status, effort_hours, completed_work,
      frozen_ehh, frozen_cw_plus,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      'completed', $6, $7,
      $6, $7,
      NOW(), NOW()
    )
    RETURNING task_number, title, effort_hours, completed_work
  `, [taskNumber, task.title, task.description, task.task_type, task.priority, task.effort_hours, task.completed_work]);

  const created = result.rows[0];
  console.log('Created Task #' + created.task_number);
  console.log('  Title: ' + created.title);
  console.log('  EHH: ' + created.effort_hours);
  console.log('  CW+: ' + created.completed_work);

  // Get new totals
  const totals = await pool.query(`
    SELECT
      COUNT(*) as task_count,
      COALESCE(SUM(effort_hours), 0) as total_ehh,
      COALESCE(SUM(completed_work), 0) as total_cw
    FROM admin_tasks
    WHERE status = 'completed'
  `);

  const row = totals.rows[0];
  console.log('\n=== Updated Database Totals ===');
  console.log('Completed Tasks: ' + row.task_count);
  console.log('Total EHH: ' + parseFloat(row.total_ehh).toLocaleString());
  console.log('Total CW+: ' + parseFloat(row.total_cw).toLocaleString());

  await pool.end();
}

createTask();
