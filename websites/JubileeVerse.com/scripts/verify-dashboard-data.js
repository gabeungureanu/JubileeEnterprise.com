#!/usr/bin/env node
/**
 * Verify dashboard data is correctly retrieved from database
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

async function verify() {
  try {
    // Same query the API uses (from DailyProgressMetrics.getDashboardData)
    const result = await pool.query(`
      SELECT
        COUNT(*) as completed_count,
        COALESCE(SUM(COALESCE(effort_hours, 0)), 0) as total_ehh,
        COALESCE(SUM(COALESCE(completed_work, 0)), 0) as total_cw_plus
      FROM admin_tasks
      WHERE status = 'completed'
    `);

    const row = result.rows[0];
    const ehh = parseFloat(row.total_ehh) || 0;
    const cwPlus = parseFloat(row.total_cw_plus) || 0;
    const efficiency = cwPlus > 0 ? Math.round((ehh / cwPlus) * 100) : 0;

    console.log('=== Dashboard Data Source Verification ===\n');
    console.log('Data from admin_tasks table (status = completed):');
    console.log('  Completed Tasks:', row.completed_count);
    console.log('  Total EHH:', Math.round(ehh).toLocaleString(), 'hours');
    console.log('  Total CW+:', Math.round(cwPlus).toLocaleString(), 'hours');
    console.log('  Work Efficiency:', efficiency.toLocaleString() + '%');

    // Check what the API endpoint returns
    console.log('\n=== Expected API Response (progressMade) ===');
    console.log(JSON.stringify({
      completedTasks: parseInt(row.completed_count),
      totalEHH: Math.round(ehh),
      totalCWPlus: Math.round(cwPlus)
    }, null, 2));

    // Check frozen metrics
    const frozenResult = await pool.query(`
      SELECT
        COUNT(*) as frozen_count,
        COALESCE(SUM(frozen_ehh), 0) as frozen_ehh_total,
        COALESCE(SUM(frozen_cw_plus), 0) as frozen_cw_total
      FROM admin_tasks
      WHERE frozen_ehh IS NOT NULL
    `);

    console.log('\n=== Frozen Metrics ===');
    console.log('  Tasks with frozen values:', frozenResult.rows[0].frozen_count);
    console.log('  Frozen EHH total:', Math.round(parseFloat(frozenResult.rows[0].frozen_ehh_total)).toLocaleString());
    console.log('  Frozen CW+ total:', Math.round(parseFloat(frozenResult.rows[0].frozen_cw_total)).toLocaleString());

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

verify();
