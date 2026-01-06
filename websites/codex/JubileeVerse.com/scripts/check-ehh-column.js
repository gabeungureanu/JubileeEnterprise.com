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

async function check() {
  // Check column names related to effort/hours
  const cols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'admin_tasks'
      AND (column_name LIKE '%effort%' OR column_name LIKE '%hour%' OR column_name LIKE '%ehh%' OR column_name LIKE '%heh%')
  `);
  console.log('Effort/Hours columns in admin_tasks:');
  cols.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));

  // Check current values
  const sample = await pool.query(`
    SELECT task_code, title, effort_hours, completed_work
    FROM admin_tasks
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 5
  `);
  console.log('\nRecent completed tasks:');
  sample.rows.forEach(t => {
    console.log('  [' + t.task_code + '] effort_hours=' + t.effort_hours + ', completed_work=' + t.completed_work);
  });

  await pool.end();
}
check();
