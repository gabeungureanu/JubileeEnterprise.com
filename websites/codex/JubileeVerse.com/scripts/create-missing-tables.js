#!/usr/bin/env node
/**
 * Create missing tables for dashboard metrics
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

async function run() {
  try {
    console.log('Creating missing tables...');

    // Create daily_time_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_time_log (
        id SERIAL PRIMARY KEY,
        user_id UUID,
        log_date DATE NOT NULL DEFAULT CURRENT_DATE,
        hours_worked DECIMAL(4,2) DEFAULT 0,
        week_number INTEGER,
        year INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Created daily_time_log table');

    // Create task_work_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_work_history (
        id SERIAL PRIMARY KEY,
        task_id UUID REFERENCES admin_tasks(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        actor VARCHAR(100),
        previous_status VARCHAR(50),
        new_status VARCHAR(50),
        description TEXT,
        hours_worked DECIMAL(5,2) DEFAULT 0,
        work_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Created task_work_history table');

    console.log('Done!');
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
