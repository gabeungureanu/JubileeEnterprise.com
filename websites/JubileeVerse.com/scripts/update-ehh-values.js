#!/usr/bin/env node
/**
 * Update EHH values for today's tasks with correct estimates
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

async function update() {
  try {
    // Update existing tasks with correct EHH values (at 70% human efficiency)
    const updates = [
      { title: 'Migration 072: Fix Activity Log Trigger', ehh: 3.5, cw: 0.2 },
      { title: 'Migration 073: Fix All Remaining Status Triggers', ehh: 7, cw: 0.25 },
      { title: 'Migration 071: Consolidate Status Columns', ehh: 10, cw: 0.5 },
      { title: 'Fix Dashboard Progress Made Panel Data Queries', ehh: 6, cw: 0.4 },
      { title: 'Sync Status Column Data', ehh: 2, cw: 0.15 }
    ];

    console.log('=== Updating EHH Values ===\n');

    for (const u of updates) {
      const result = await pool.query(
        'UPDATE admin_tasks SET effort_hours = $1, completed_work = $2 WHERE title = $3 RETURNING task_code, title, effort_hours, completed_work',
        [u.ehh, u.cw, u.title]
      );
      if (result.rows.length > 0) {
        const r = result.rows[0];
        console.log(`[${r.task_code}] ${r.title}`);
        console.log(`  EHH: ${r.effort_hours} | CW+: ${r.completed_work}`);
        console.log('');
      }
    }

    // Add missing tasks
    console.log('=== Adding Missing Tasks ===\n');

    const newTasks = [
      {
        title: 'Update HEH to EHH Terminology',
        description: `Updated all code references from HEH (Human Effort Hours) to EHH (Estimated Human Hours) for consistency.

Files Updated:
- src/models/DailyProgressMetrics.js
- src/models/DashboardMetrics.js
- src/models/AdminTask.js

Changed column aliases, variable names, and comments throughout the codebase.`,
        taskType: 'enhancement',
        effortHours: 3,
        completedWork: 0.15,
        component: 'Models'
      },
      {
        title: 'Document EHH Calculation Methodology',
        description: `Added comprehensive documentation for EHH and CW+ metrics to the developer guide.

Added to help/00-JUBILEE DEVELOPER.md:
- EHH definition (Estimated Human Hours at 70% efficiency)
- CW+ definition (Completed Work Plus - actual AI time)
- Work Efficiency formula
- Example EHH ranges for different task types
- Recording requirements for task effort tracking`,
        taskType: 'documentation',
        effortHours: 2,
        completedWork: 0.1,
        component: 'Documentation'
      }
    ];

    for (const work of newTasks) {
      // Check if task already exists
      const existing = await pool.query(
        'SELECT id FROM admin_tasks WHERE title = $1',
        [work.title]
      );

      if (existing.rows.length > 0) {
        console.log(`Task already exists: ${work.title}`);
        continue;
      }

      // Get next task number
      const nextNum = await pool.query("SELECT nextval('task_code_seq')");
      const taskNumber = parseInt(nextNum.rows[0].nextval);
      const taskCode = 'JIT' + String(taskNumber).padStart(6, '0');

      // Insert the task
      await pool.query(`
        INSERT INTO admin_tasks (
          task_number, task_code, title, description, task_type,
          status, effort_hours, completed_work, component,
          created_at, completed_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          'completed', $6, $7, $8,
          NOW(), NOW()
        )
      `, [
        taskNumber, taskCode, work.title, work.description, work.taskType,
        work.effortHours, work.completedWork, work.component
      ]);

      console.log(`Created: [${taskCode}] ${work.title}`);
      console.log(`  EHH: ${work.effortHours} | CW+: ${work.completedWork}`);
      console.log('');
    }

    // Show updated totals for today
    const totals = await pool.query(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(effort_hours), 0) as total_ehh,
        COALESCE(SUM(completed_work), 0) as total_cw
      FROM admin_tasks
      WHERE DATE(completed_at) = CURRENT_DATE
    `);

    console.log('=== TODAY\'S UPDATED TOTALS ===');
    console.log(`Tasks Completed Today: ${totals.rows[0].count}`);
    console.log(`Total EHH: ${totals.rows[0].total_ehh}`);
    console.log(`Total CW+: ${totals.rows[0].total_cw}`);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

update();
