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
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'task_activity_log'
  `);
  console.log('task_activity_log columns:');
  cols.rows.forEach(c => console.log('  ' + c.column_name));

  // Check trigger function
  const trigger = await pool.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'log_task_status_change'
  `);
  if (trigger.rows.length > 0) {
    console.log('\nlog_task_status_change function:');
    console.log(trigger.rows[0].prosrc.substring(0, 500));
  }

  await pool.end();
}
check();
