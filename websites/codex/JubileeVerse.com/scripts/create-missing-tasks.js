#!/usr/bin/env node
/**
 * Create missing task records for untracked work
 * - Migrations 074-077
 * - FormulaService.js
 * - WorkDetectionService.js
 * - Utility scripts
 * - Dashboard updates
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

// Missing tasks with traditional EHH estimates
// Valid task_type values: development, bug, enhancement, operational
const missingTasks = [
  {
    title: 'Migration 074: Formula Versioning System',
    description: 'Database schema for versioned formulas with audit logging. Creates formula_versions and calculation_audit_log tables with immutable records.',
    task_type: 'development',
    priority: 'high',
    effort_hours: 48, // Complex schema with functions, triggers, 400+ lines SQL
    completed_work: 1.5
  },
  {
    title: 'Migration 075: Stakeholder Access System',
    description: 'Database schema for stakeholder authentication, permissions, and query logging. Immutable audit trail for all stakeholder queries.',
    task_type: 'development',
    priority: 'high',
    effort_hours: 40, // Access control tables, functions, views
    completed_work: 1.0
  },
  {
    title: 'Migration 076: Work Estimation Framework',
    description: 'Database schema for component-based work estimation with traditional industry guidelines. 30 estimation guidelines loaded.',
    task_type: 'development',
    priority: 'high',
    effort_hours: 36, // Estimation tables, 30 guidelines
    completed_work: 0.8
  },
  {
    title: 'Migration 077: Monotonic Aggregate Safeguards',
    description: 'Database schema ensuring cumulative metrics can only increase. Includes adjustment logging, projection tracking, and drift alerts.',
    task_type: 'development',
    priority: 'high',
    effort_hours: 52, // Complex safeguards, triggers, projection tables
    completed_work: 1.2
  },
  {
    title: 'Backend service - FormulaService',
    description: 'Service for versioned formula calculations. Handles EHH/CW+ calculations with audit logging, formula versioning, and task metrics freezing.',
    task_type: 'development',
    priority: 'high',
    effort_hours: 72, // ~300 lines, complex formula logic
    completed_work: 1.5
  },
  {
    title: 'Backend service - WorkDetectionService',
    description: 'Automated work detection from development activity. Detects git commits, file changes, migrations. Maps file patterns to component types.',
    task_type: 'development',
    priority: 'high',
    effort_hours: 80, // ~400 lines, complex detection logic
    completed_work: 2.0
  },
  {
    title: 'Utility scripts - Analysis and verification tools',
    description: 'Collection of 25+ utility scripts for task analysis, EHH verification, dashboard data checks, migration runners, and recalibration tools.',
    task_type: 'operational',
    priority: 'medium',
    effort_hours: 60, // ~140KB of scripts
    completed_work: 3.0
  },
  {
    title: 'Dashboard UI - Metrics display and real-time updates',
    description: 'Major updates to admin-tasks.html for real-time metrics display, API data binding, and performance optimization (deferred loading).',
    task_type: 'enhancement',
    priority: 'high',
    effort_hours: 40, // Complex UI work, 11K+ lines file
    completed_work: 2.0
  }
];

async function createTasks() {
  console.log('=== Creating Missing Task Records ===\n');

  let totalEHH = 0;
  let totalCW = 0;

  for (const task of missingTasks) {
    try {
      // Get next task number (task_number is an integer)
      const numResult = await pool.query(`
        SELECT COALESCE(MAX(task_number), 0) + 1 as next_num
        FROM admin_tasks
      `);
      const taskNumber = numResult.rows[0].next_num;

      // Insert task as completed
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
      console.log(`Created: ${created.task_number}`);
      console.log(`  Title: ${created.title}`);
      console.log(`  EHH: ${created.effort_hours}, CW+: ${created.completed_work}`);
      console.log('');

      totalEHH += task.effort_hours;
      totalCW += task.completed_work;
    } catch (e) {
      console.error(`Error creating task "${task.title}":`, e.message);
    }
  }

  console.log('=== Summary ===');
  console.log(`Tasks created: ${missingTasks.length}`);
  console.log(`Total EHH added: ${totalEHH}`);
  console.log(`Total CW+ added: ${totalCW}`);

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

createTasks();
