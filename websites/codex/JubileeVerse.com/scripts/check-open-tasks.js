#!/usr/bin/env node
/**
 * Check Open Tasks in PostgreSQL
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

async function run() {
  try {
    // Check open/in-progress tasks using status
    const tasks = await pool.query(`
      SELECT id, task_code, title, status, parent_task_id, effort_hours, created_at
      FROM admin_tasks
      WHERE status != 'completed'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    console.log('=== OPEN/IN-PROGRESS TASKS ===\n');
    if (tasks.rows.length === 0) {
      console.log('No open or in-progress tasks found.\n');
    } else {
      tasks.rows.forEach(task => {
        console.log(`[${task.task_code}] ${task.title}`);
        console.log(`  Status: ${task.status || 'N/A'} | HEH: ${task.effort_hours || 'N/A'}`);
        console.log(`  Parent: ${task.parent_task_id || 'None'} | Created: ${new Date(task.created_at).toLocaleString()}\n`);
      });
    }

    // Also check recent completed tasks
    const completed = await pool.query(`
      SELECT id, task_code, title, status, completed_at
      FROM admin_tasks
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 5
    `);

    console.log('=== RECENTLY COMPLETED TASKS ===\n');
    if (completed.rows.length === 0) {
      console.log('No recently completed tasks found.\n');
    } else {
      completed.rows.forEach(task => {
        console.log(`[${task.task_code}] ${task.title}`);
        console.log(`  Completed: ${task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A'}\n`);
      });
    }

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
