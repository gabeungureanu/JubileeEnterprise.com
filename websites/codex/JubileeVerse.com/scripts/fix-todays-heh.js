#!/usr/bin/env node
/**
 * Fix the HEH values for today's tasks - they were severely underestimated
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

// Corrected HEH values based on what a human developer would take
const corrections = [
  {
    title: 'Migration 071: Consolidate Status Columns',
    effortHours: 16.0,  // Schema investigation, data sync, migration creation, testing
    completedWork: 0.5   // Actual AI time
  },
  {
    title: 'Fix Dashboard Progress Made Panel Data Queries',
    effortHours: 12.0,  // Code investigation, fixing 3 model files, testing
    completedWork: 0.4
  },
  {
    title: 'Sync Status Column Data',
    effortHours: 4.0,   // Understanding mismatch, creating sync script, verification
    completedWork: 0.15
  },
  {
    title: 'Migration 072: Fix Activity Log Trigger',
    effortHours: 6.0,   // Debugging trigger error, understanding function, creating fix
    completedWork: 0.2
  },
  {
    title: 'Migration 073: Fix All Remaining Status Triggers',
    effortHours: 8.0,   // Finding all 4 functions, rewriting each, testing
    completedWork: 0.25
  }
];

async function run() {
  try {
    console.log("=== Correcting HEH Values ===\n");

    for (const fix of corrections) {
      const result = await pool.query(`
        UPDATE admin_tasks
        SET effort_hours = $1, completed_work = $2
        WHERE title = $3
        RETURNING task_code, title, effort_hours, completed_work
      `, [fix.effortHours, fix.completedWork, fix.title]);

      if (result.rows.length > 0) {
        const t = result.rows[0];
        console.log(`✅ [${t.task_code}] ${t.title.substring(0, 50)}...`);
        console.log(`   HEH: ${t.effort_hours}, CW+: ${t.completed_work}\n`);
      } else {
        console.log(`⚠️ Not found: ${fix.title}`);
      }
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

    console.log('=== CORRECTED TOTALS ===');
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
