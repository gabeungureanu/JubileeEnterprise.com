#!/usr/bin/env node
/**
 * Run a single migration file
 * Usage: node scripts/run-single-migration.js 041_qa_test_numbering.sql
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function run() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Usage: node scripts/run-single-migration.js <migration_file>');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, 'migrations', migrationFile);
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  try {
    console.log(`Running migration: ${migrationFile}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log(`✅ Migration completed successfully`);

    // Show assigned QA numbers if this is the numbering migration
    if (migrationFile.includes('qa_test_numbering')) {
      const result = await pool.query('SELECT qa_number, test_name, category FROM qa_tests ORDER BY qa_number');
      console.log('\n📋 Assigned QA Numbers:');
      result.rows.forEach(row => {
        console.log(`  ${row.qa_number}: ${row.test_name} [${row.category}]`);
      });
    }
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
