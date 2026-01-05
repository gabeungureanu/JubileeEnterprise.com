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
  // Check what depends on workflow_status column
  const deps = await pool.query(`
    SELECT
      d.refobjid::regclass AS dependent_table,
      a.attname AS column_name,
      d.deptype,
      pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent_object
    FROM pg_depend d
    JOIN pg_attribute a ON d.refobjid = a.attrelid AND d.refobjsubid = a.attnum
    WHERE a.attname = 'workflow_status'
      AND a.attrelid = 'admin_tasks'::regclass
  `);

  console.log('Dependencies on workflow_status column:');
  if (deps.rows.length === 0) {
    console.log('  None found via pg_depend');
  } else {
    deps.rows.forEach(d => console.log('  ' + d.dependent_object));
  }

  // Check for indexes
  const indexes = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'admin_tasks'
      AND indexdef LIKE '%workflow_status%'
  `);

  console.log('\nIndexes using workflow_status:');
  indexes.rows.forEach(i => console.log('  ' + i.indexname));

  // Check for triggers
  const triggers = await pool.query(`
    SELECT tgname, pg_get_triggerdef(oid) as triggerdef
    FROM pg_trigger
    WHERE tgrelid = 'admin_tasks'::regclass
  `);

  console.log('\nTriggers on admin_tasks:');
  triggers.rows.forEach(t => console.log('  ' + t.tgname));

  await pool.end();
}
check();
