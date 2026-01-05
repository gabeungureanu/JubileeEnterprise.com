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

async function createTask() {
  const numResult = await pool.query('SELECT COALESCE(MAX(task_number), 0) + 1 as next_num FROM admin_tasks');
  const taskNumber = numResult.rows[0].next_num;

  const result = await pool.query(`
    INSERT INTO admin_tasks (
      task_number, title, description, task_type, priority,
      status, effort_hours, completed_work,
      frozen_ehh, frozen_cw_plus,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      'completed', $6, $7,
      $6, $7,
      NOW(), NOW()
    )
    RETURNING task_number, title, effort_hours, completed_work
  `, [
    taskNumber,
    'Collections UI - Language Translations top 100 by speakers',
    'Expanded Language Translations from 8 to 100 languages, ordered by total speakers (native + L2). Includes speaker counts from 1.5B (English) to 8M (Belarusian). Covers major world languages, Chinese dialects, Arabic varieties, Indian languages, and African languages.',
    'enhancement',
    'medium',
    8,
    0.25
  ]);

  console.log('Created Task #' + result.rows[0].task_number);
  console.log('  EHH: ' + result.rows[0].effort_hours + ', CW+: ' + result.rows[0].completed_work);

  const totals = await pool.query("SELECT COUNT(*) as count, SUM(effort_hours) as ehh, SUM(completed_work) as cw FROM admin_tasks WHERE status = 'completed'");
  console.log('Totals: ' + totals.rows[0].count + ' tasks, ' + parseFloat(totals.rows[0].ehh).toLocaleString() + ' EHH, ' + parseFloat(totals.rows[0].cw).toLocaleString() + ' CW+');

  await pool.end();
}
createTask();
