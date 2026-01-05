#!/usr/bin/env node
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
  const cols = await pool.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'admin_tasks'
      AND column_name IN ('status', 'workflow_status')
  `);
  console.log('Column definitions:');
  cols.rows.forEach(c => console.log('  ' + c.column_name + ': ' + c.udt_name));
  await pool.end();
}
check();
