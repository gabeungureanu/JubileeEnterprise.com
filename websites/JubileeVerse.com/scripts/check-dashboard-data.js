#!/usr/bin/env node
/**
 * Check dashboard data status
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

async function check() {
  try {
    // Check what status columns exist
    const statusCol = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'admin_tasks' AND column_name IN ('status', 'workflow_status')
    `);
    console.log('=== STATUS COLUMNS IN admin_tasks ===');
    statusCol.rows.forEach(r => console.log(`  ${r.column_name}`));

    // Check all statuses
    const statuses = await pool.query(`
      SELECT workflow_status, COUNT(*) as count
      FROM admin_tasks
      GROUP BY workflow_status
      ORDER BY count DESC
    `);
    console.log('\n=== TASK WORKFLOW_STATUS BREAKDOWN ===');
    statuses.rows.forEach(r => console.log(`  ${r.workflow_status || 'NULL'}: ${r.count}`));

    // Check completed tasks with workflow_status
    const completed = await pool.query(`
      SELECT
        COUNT(*) as completed_count,
        COALESCE(SUM(COALESCE(effort_hours, 0)), 0) as total_ehh,
        COALESCE(SUM(COALESCE(completed_work, 0)), 0) as total_cw_plus
      FROM admin_tasks
      WHERE workflow_status = 'completed'
    `);
    console.log('\n=== COMPLETED TASKS (workflow_status = completed) ===');
    console.log(completed.rows[0]);

    // Check if there's a 'status' column too
    try {
      const statusCheck = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM admin_tasks
        GROUP BY status
        ORDER BY count DESC
      `);
      console.log('\n=== TASK STATUS BREAKDOWN (status column) ===');
      statusCheck.rows.forEach(r => console.log(`  ${r.status || 'NULL'}: ${r.count}`));
    } catch (e) {
      console.log('\n=== No status column exists ===');
    }

    // Check if effort_hours column exists
    const effortCol = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'admin_tasks' AND column_name IN ('effort_hours', 'completed_work')
    `);
    console.log('\n=== EFFORT COLUMNS IN admin_tasks ===');
    effortCol.rows.forEach(r => console.log(`  ${r.column_name}`));

    // Sample tasks
    const sample = await pool.query(`
      SELECT id, task_code, title, workflow_status, effort_hours
      FROM admin_tasks
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('\n=== SAMPLE TASKS ===');
    sample.rows.forEach(t => {
      console.log(`  [${t.task_code}] ${t.title.substring(0, 50)}...`);
      console.log(`    Status: ${t.workflow_status}, HEH: ${t.effort_hours}`);
    });

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

check();
