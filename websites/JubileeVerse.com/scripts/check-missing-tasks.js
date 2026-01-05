#!/usr/bin/env node
/**
 * Check if migrations 074-077 and new services have task records
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
    SELECT task_number, title, effort_hours
    FROM admin_tasks
    WHERE title ILIKE '%Migration 074%'
       OR title ILIKE '%Migration 075%'
       OR title ILIKE '%Migration 076%'
       OR title ILIKE '%Migration 077%'
       OR title ILIKE '%FormulaService%'
       OR title ILIKE '%WorkDetectionService%'
       OR title ILIKE '%formula version%'
       OR title ILIKE '%stakeholder access%'
       OR title ILIKE '%work estimation%'
       OR title ILIKE '%monotonic%'
    ORDER BY task_number
  `);
  console.log('Existing tasks for new work:');
  if (result.rows.length === 0) {
    console.log('  None found - need to create');
  } else {
    result.rows.forEach(r => console.log('  ' + r.task_number + ': ' + r.title + ' (' + r.effort_hours + ' EHH)'));
  }
  await pool.end();
}
check();
