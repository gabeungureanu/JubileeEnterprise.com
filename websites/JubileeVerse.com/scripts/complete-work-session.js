#!/usr/bin/env node
/**
 * WORK SESSION COMPLETION SCRIPT
 *
 * Run this script whenever a work session or task is completed.
 * It prompts for task details and creates/updates the task record.
 *
 * Usage: node scripts/complete-work-session.js
 *
 * TRIGGER PHRASES (Claude should recognize these):
 * - "I'm done with..."
 * - "That's complete"
 * - "Finished with..."
 * - "All done"
 * - "Task complete"
 * - "Work is done"
 */

const { Pool } = require('pg');
const readline = require('readline');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function completeWorkSession() {
  console.log('\n=== WORK SESSION COMPLETION ===\n');
  console.log('Recording completed work to the task database.\n');

  // Get current stats first
  const currentStats = await pool.query(`
    SELECT
      COUNT(*) as task_count,
      COALESCE(SUM(effort_hours), 0) as total_ehh,
      COALESCE(SUM(completed_work), 0) as total_cw
    FROM admin_tasks
    WHERE status = 'completed'
  `);
  const stats = currentStats.rows[0];
  console.log('Current totals: ' + stats.task_count + ' tasks, ' +
              parseFloat(stats.total_ehh).toLocaleString() + ' EHH, ' +
              parseFloat(stats.total_cw).toLocaleString() + ' CW+\n');

  // Gather task info
  const title = await ask('Task title: ');
  const description = await ask('Brief description of work done: ');
  const taskType = await ask('Task type (development/enhancement/bug/operational) [enhancement]: ') || 'enhancement';
  const priority = await ask('Priority (high/medium/low) [high]: ') || 'high';
  const ehhStr = await ask('Estimated Human Hours (EHH) - how long without AI: ');
  const cwStr = await ask('Completed Work (CW+) - actual hours with AI: ');

  const effortHours = parseFloat(ehhStr) || 8;
  const completedWork = parseFloat(cwStr) || 1;

  // Get next task number
  const numResult = await pool.query(`
    SELECT COALESCE(MAX(task_number), 0) + 1 as next_num
    FROM admin_tasks
  `);
  const taskNumber = numResult.rows[0].next_num;

  // Insert the task
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
  `, [taskNumber, title, description, taskType, priority, effortHours, completedWork]);

  const created = result.rows[0];
  console.log('\n✅ Task #' + created.task_number + ' created successfully!');
  console.log('   Title: ' + created.title);
  console.log('   EHH: ' + created.effort_hours);
  console.log('   CW+: ' + created.completed_work);

  // Get new totals
  const newStats = await pool.query(`
    SELECT
      COUNT(*) as task_count,
      COALESCE(SUM(effort_hours), 0) as total_ehh,
      COALESCE(SUM(completed_work), 0) as total_cw
    FROM admin_tasks
    WHERE status = 'completed'
  `);

  const row = newStats.rows[0];
  console.log('\n=== Updated Database Totals ===');
  console.log('Completed Tasks: ' + row.task_count);
  console.log('Total EHH: ' + parseFloat(row.total_ehh).toLocaleString());
  console.log('Total CW+: ' + parseFloat(row.total_cw).toLocaleString());

  rl.close();
  await pool.end();
}

completeWorkSession().catch(err => {
  console.error('Error:', err.message);
  rl.close();
  pool.end();
  process.exit(1);
});
