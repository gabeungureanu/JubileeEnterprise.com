#!/usr/bin/env node
/**
 * Show work actually done in the last 24 hours
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

async function show() {
  try {
    // Check tasks created/updated in last 24 hours
    const result = await pool.query(`
      SELECT task_code, title, effort_hours as ehh, completed_work as cw,
             created_at, completed_at, updated_at
      FROM admin_tasks
      WHERE status = 'completed'
      AND (created_at >= NOW() - INTERVAL '24 hours'
           OR updated_at >= NOW() - INTERVAL '24 hours')
      ORDER BY COALESCE(updated_at, created_at) DESC
    `);

    console.log('=== WORK IN LAST 24 HOURS ===\n');
    let totalEHH = 0;
    let totalCW = 0;

    result.rows.forEach(t => {
      const ehh = parseFloat(t.ehh) || 0;
      const cw = parseFloat(t.cw) || 0;
      totalEHH += ehh;
      totalCW += cw;
      console.log(`[${t.task_code}] ${t.title}`);
      console.log(`  EHH: ${ehh} | CW+: ${cw}`);
      console.log(`  Created: ${new Date(t.created_at).toLocaleString()}`);
      if (t.updated_at && t.updated_at !== t.created_at) {
        console.log(`  Updated: ${new Date(t.updated_at).toLocaleString()}`);
      }
      console.log('');
    });

    console.log('=== LAST 24 HOURS TOTALS ===');
    console.log(`Tasks: ${result.rows.length}`);
    console.log(`Total EHH: ${totalEHH.toFixed(1)}`);
    console.log(`Total CW+: ${totalCW.toFixed(2)}`);
    console.log(`Work Efficiency: ${totalCW > 0 ? ((totalEHH / totalCW) * 100).toFixed(0) : 0}%`);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

show();
