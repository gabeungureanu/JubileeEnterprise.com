#!/usr/bin/env node
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function show() {
  // Get today's tasks
  const tasks = await pool.query(`
    SELECT task_code, title, effort_hours as ehh, completed_work as cw_plus, completed_at
    FROM admin_tasks
    WHERE DATE(completed_at) = CURRENT_DATE
    ORDER BY completed_at DESC
  `);

  console.log("=== TODAY'S COMPLETED TASKS ===\n");

  let totalEHH = 0;
  let totalCW = 0;

  tasks.rows.forEach(t => {
    const ehh = parseFloat(t.ehh) || 0;
    const cw = parseFloat(t.cw_plus) || 0;
    totalEHH += ehh;
    totalCW += cw;
    console.log(`[${t.task_code}] ${t.title}`);
    console.log(`  EHH: ${ehh} | CW+: ${cw}`);
    console.log('');
  });

  console.log('=== TOTALS ===');
  console.log(`Tasks Today: ${tasks.rows.length}`);
  console.log(`Total EHH: ${totalEHH}`);
  console.log(`Total CW+: ${totalCW}`);
  console.log(`Work Efficiency: ${totalCW > 0 ? ((totalEHH / totalCW) * 100).toFixed(0) : 0}%`);

  await pool.end();
}
show();
