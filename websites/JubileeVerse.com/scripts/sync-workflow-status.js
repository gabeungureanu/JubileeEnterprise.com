#!/usr/bin/env node
/**
 * Sync workflow_status to match status for completed tasks
 * This fixes the mismatch where status='completed' but workflow_status='submitted'
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
    console.log('=== SYNCING WORKFLOW_STATUS TO STATUS ===\n');

    // Count before
    const before = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE workflow_status = 'completed') as wf_completed,
        COUNT(*) FILTER (WHERE status = 'completed') as status_completed
      FROM admin_tasks
    `);
    console.log('Before sync:');
    console.log(`  workflow_status=completed: ${before.rows[0].wf_completed}`);
    console.log(`  status=completed: ${before.rows[0].status_completed}`);

    // Sync workflow_status to match status for all tasks
    // Cast status to text then to workflow_status type
    const result = await pool.query(`
      UPDATE admin_tasks
      SET workflow_status = status::TEXT::task_workflow_status
      WHERE workflow_status::TEXT != status::TEXT
        OR workflow_status IS NULL
      RETURNING id, task_code, status, workflow_status
    `);

    console.log(`\nUpdated ${result.rowCount} tasks`);

    // Count after
    const after = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE workflow_status = 'completed') as wf_completed,
        COUNT(*) FILTER (WHERE status = 'completed') as status_completed,
        COALESCE(SUM(effort_hours) FILTER (WHERE workflow_status = 'completed'), 0) as total_heh,
        COALESCE(SUM(completed_work) FILTER (WHERE workflow_status = 'completed'), 0) as total_cw_plus
      FROM admin_tasks
    `);
    console.log('\nAfter sync:');
    console.log(`  workflow_status=completed: ${after.rows[0].wf_completed}`);
    console.log(`  status=completed: ${after.rows[0].status_completed}`);
    console.log(`  Total HEH: ${after.rows[0].total_heh}`);
    console.log(`  Total CW+: ${after.rows[0].total_cw_plus}`);

    console.log('\n✅ Workflow status synced successfully!');

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
