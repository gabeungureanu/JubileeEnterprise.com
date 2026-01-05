#!/usr/bin/env node
/**
 * Check status column mismatch
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
    console.log('=== STATUS COLUMN ANALYSIS ===\n');

    // Check both columns
    const both = await pool.query(`
      SELECT
        status,
        workflow_status,
        COUNT(*) as count
      FROM admin_tasks
      GROUP BY status, workflow_status
      ORDER BY count DESC
    `);

    console.log('Status vs Workflow_Status breakdown:');
    both.rows.forEach(r => {
      console.log(`  status="${r.status}" | workflow_status="${r.workflow_status || 'NULL'}" : ${r.count} tasks`);
    });

    // Find tasks where status=completed but workflow_status is NOT completed
    const mismatch = await pool.query(`
      SELECT COUNT(*) as count
      FROM admin_tasks
      WHERE status = 'completed'
        AND (workflow_status IS NULL OR workflow_status != 'completed')
    `);
    console.log(`\nTasks with status=completed but workflow_status NOT completed: ${mismatch.rows[0].count}`);

    // Sample of mismatched tasks
    const sample = await pool.query(`
      SELECT task_code, title, status, workflow_status, effort_hours
      FROM admin_tasks
      WHERE status = 'completed'
        AND (workflow_status IS NULL OR workflow_status != 'completed')
      LIMIT 10
    `);

    if (sample.rows.length > 0) {
      console.log('\nSample mismatched tasks:');
      sample.rows.forEach(t => {
        console.log(`  [${t.task_code}] ${t.title.substring(0, 50)}...`);
        console.log(`    status="${t.status}" | workflow_status="${t.workflow_status || 'NULL'}"`);
      });
    }

    // Total HEH in mismatched tasks
    const heh = await pool.query(`
      SELECT
        COALESCE(SUM(effort_hours), 0) as total_heh,
        COUNT(*) as count
      FROM admin_tasks
      WHERE status = 'completed'
        AND (workflow_status IS NULL OR workflow_status != 'completed')
    `);
    console.log(`\nMismatched tasks: ${heh.rows[0].count} tasks with ${heh.rows[0].total_heh} total HEH`);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
