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
  // Check all functions that might reference workflow_status or new_status
  const funcs = await pool.query(`
    SELECT proname, prosrc
    FROM pg_proc
    WHERE prosrc LIKE '%workflow_status%' OR prosrc LIKE '%new_status%'
  `);
  console.log('Functions referencing workflow_status or new_status:');
  funcs.rows.forEach(f => {
    console.log('\n=== ' + f.proname + ' ===');
    console.log(f.prosrc.substring(0, 300));
  });
  await pool.end();
}
check();
