#!/usr/bin/env node
/**
 * Update underestimated tasks with proper EHH values
 * Based on traditional industry estimation guidelines
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

async function updateTasks() {
  console.log('=== Updating Underestimated Tasks ===\n');

  let totalAdjustment = 0;

  // 1. Infrastructure tasks that are severely underestimated
  // These should be 80-120 hours based on complexity
  console.log('1. Updating Infrastructure tasks...');
  const infraResult = await pool.query(`
    UPDATE admin_tasks
    SET effort_hours = 100,
        frozen_ehh = 100
    WHERE title ILIKE '%infrastructure%'
      AND effort_hours < 40
      AND status = 'completed'
    RETURNING task_number, title, effort_hours
  `);
  console.log(`   Updated ${infraResult.rowCount} infrastructure tasks to 100 EHH each`);

  // 2. Services with less than 60 EHH should be at minimum 60
  console.log('2. Updating Service tasks...');
  const serviceResult = await pool.query(`
    UPDATE admin_tasks
    SET effort_hours = 60,
        frozen_ehh = 60
    WHERE title ILIKE '%service%'
      AND effort_hours < 60
      AND status = 'completed'
    RETURNING task_number, title, effort_hours
  `);
  console.log(`   Updated ${serviceResult.rowCount} service tasks to 60 EHH each`);

  // 3. API modules should be at least 80 EHH
  console.log('3. Updating API module tasks...');
  const apiResult = await pool.query(`
    UPDATE admin_tasks
    SET effort_hours = 80,
        frozen_ehh = 80
    WHERE title ILIKE '%API module%'
      AND effort_hours < 80
      AND status = 'completed'
    RETURNING task_number, title, effort_hours
  `);
  console.log(`   Updated ${apiResult.rowCount} API module tasks to 80 EHH each`);

  // 4. Database schema tasks should be at least 20 EHH
  console.log('4. Updating Database schema tasks...');
  const schemaResult = await pool.query(`
    UPDATE admin_tasks
    SET effort_hours = 24,
        frozen_ehh = 24
    WHERE title ILIKE '%database schema%'
      AND effort_hours < 20
      AND status = 'completed'
    RETURNING task_number, title, effort_hours
  `);
  console.log(`   Updated ${schemaResult.rowCount} database schema tasks to 24 EHH each`);

  // 5. Controller & Route tasks should be at least 40 EHH
  console.log('5. Updating Controller & Route tasks...');
  const controllerResult = await pool.query(`
    UPDATE admin_tasks
    SET effort_hours = 48,
        frozen_ehh = 48
    WHERE title ILIKE '%controller%route%'
      AND effort_hours < 40
      AND status = 'completed'
    RETURNING task_number, title, effort_hours
  `);
  console.log(`   Updated ${controllerResult.rowCount} controller/route tasks to 48 EHH each`);

  // 6. Model tasks should be at least 40 EHH
  console.log('6. Updating Model tasks...');
  const modelResult = await pool.query(`
    UPDATE admin_tasks
    SET effort_hours = 48,
        frozen_ehh = 48
    WHERE title ILIKE '%model%'
      AND title NOT ILIKE '%database%'
      AND effort_hours < 40
      AND status = 'completed'
    RETURNING task_number, title, effort_hours
  `);
  console.log(`   Updated ${modelResult.rowCount} model tasks to 48 EHH each`);

  // Get new totals
  const totals = await pool.query(`
    SELECT
      COUNT(*) as task_count,
      COALESCE(SUM(effort_hours), 0) as total_ehh,
      COALESCE(SUM(completed_work), 0) as total_cw
    FROM admin_tasks
    WHERE status = 'completed'
  `);

  const row = totals.rows[0];
  console.log('\n=== New Database Totals ===');
  console.log(`Completed Tasks: ${row.task_count}`);
  console.log(`Total EHH: ${parseFloat(row.total_ehh).toLocaleString()}`);
  console.log(`Total CW+: ${parseFloat(row.total_cw).toLocaleString()}`);
  console.log(`Work Efficiency: ${Math.round((parseFloat(row.total_ehh) / parseFloat(row.total_cw)) * 100).toLocaleString()}%`);

  await pool.end();
}

updateTasks();
