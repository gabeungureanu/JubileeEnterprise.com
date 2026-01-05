#!/usr/bin/env node
/**
 * Check for Dashboard and Utility script tasks
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
  const result = await pool.query(`
    SELECT task_number, title, effort_hours, completed_work, status
    FROM admin_tasks
    WHERE title ILIKE '%Dashboard%' OR title ILIKE '%Utility scripts%'
    ORDER BY task_number
  `);
  console.log('Dashboard/Utility tasks:');
  result.rows.forEach(r => console.log('  ' + r.task_number + ': ' + r.title + ' (' + r.effort_hours + ' EHH, ' + r.completed_work + ' CW+, ' + r.status + ')'));
  if (result.rows.length === 0) console.log('  None found');
  await pool.end();
}
check();
