#!/usr/bin/env node
/**
 * Create task for Scripture collection categories work
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

async function createTask() {
  console.log('=== Creating Task for Scripture Collection Categories ===\n');

  // Get next task number
  const numResult = await pool.query(`
    SELECT COALESCE(MAX(task_number), 0) + 1 as next_num
    FROM admin_tasks
  `);
  const taskNumber = numResult.rows[0].next_num;

  const task = {
    title: 'Collections UI - Scripture (JSV) category structure',
    description: `Added complete Scripture collection hierarchy to admin-collections.html:
- 4 top-level categories: Jubilee Bible (JSV), Translation Rules, Language Translations, Validation Controls
- 66 books of the Bible under Jubilee Bible (JSV)
- 6 subcategories under Translation Rules with nested children
- 8 language options under Language Translations
- 8 validation categories under Validation Controls with nested children
- Created scriptureDomains data structure
- Updated getDomainsForStage() to handle Scripture categories
- Updated getSubcategoriesForCollection() for Scripture (a1)`,
    task_type: 'enhancement',
    priority: 'high',
    effort_hours: 16, // Data structure design, hierarchical organization
    completed_work: 0.5 // Actual time with AI
  };

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
  `, [taskNumber, task.title, task.description, task.task_type, task.priority, task.effort_hours, task.completed_work]);

  const created = result.rows[0];
  console.log('Created Task #' + created.task_number);
  console.log('  Title: ' + created.title);
  console.log('  EHH: ' + created.effort_hours);
  console.log('  CW+: ' + created.completed_work);

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
  console.log('\n=== Updated Database Totals ===');
  console.log('Completed Tasks: ' + row.task_count);
  console.log('Total EHH: ' + parseFloat(row.total_ehh).toLocaleString());
  console.log('Total CW+: ' + parseFloat(row.total_cw).toLocaleString());

  await pool.end();
}

createTask();
