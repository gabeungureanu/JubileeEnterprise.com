#!/usr/bin/env node
/**
 * Run specific new migrations
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse',
};

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Migrations to run
const NEW_MIGRATIONS = [
  '042_task_hierarchy.sql',
  '043_hospitality_cockpit_metrics.sql'
];

async function main() {
  console.log('Running new migrations...');

  const pool = new Pool(config);

  try {
    await pool.query('SELECT NOW()');
    console.log('Connected to database');

    for (const migrationName of NEW_MIGRATIONS) {
      const filePath = path.join(MIGRATIONS_DIR, migrationName);

      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${migrationName} - file not found`);
        continue;
      }

      console.log(`\nExecuting: ${migrationName}`);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await pool.query(sql);
        console.log(`  ✓ ${migrationName} completed`);
      } catch (error) {
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate key')) {
          console.log(`  ~ ${migrationName} already applied (skipped)`);
        } else {
          console.error(`  ✗ ${migrationName} failed: ${error.message}`);
          throw error;
        }
      }
    }

    console.log('\nNew migrations complete!');
  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
