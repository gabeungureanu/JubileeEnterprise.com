#!/usr/bin/env node
/**
 * Analyze EHH shortfall - find underestimated tasks and missing work
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

// Traditional estimation guidelines for re-evaluation
const ESTIMATION_GUIDELINES = {
  // Services - typically underestimated
  'service_small': { min: 20, max: 40 },
  'service_medium': { min: 40, max: 80 },
  'service_large': { min: 80, max: 160 },
  'service_complex': { min: 120, max: 200 },

  // Migrations
  'migration_simple': { min: 2, max: 4 },
  'migration_moderate': { min: 8, max: 16 },
  'migration_complex': { min: 16, max: 40 },
  'migration_schema': { min: 20, max: 60 },

  // API modules
  'api_small': { min: 40, max: 80 },
  'api_medium': { min: 80, max: 160 },
  'api_large': { min: 160, max: 300 },

  // Pages
  'page_simple': { min: 8, max: 16 },
  'page_moderate': { min: 16, max: 32 },
  'page_complex': { min: 24, max: 60 },

  // Infrastructure
  'infrastructure': { min: 60, max: 120 },
  'testing': { min: 60, max: 120 }
};

async function analyze() {
  try {
    console.log('=== EHH SHORTFALL ANALYSIS ===');
    console.log('Target: Find ~294 missing EHH (5,890 - 5,596)\n');

    // Get current totals
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) as task_count,
        SUM(effort_hours) as total_ehh,
        SUM(completed_work) as total_cw
      FROM admin_tasks
      WHERE status = 'completed'
    `);

    const totals = totalsResult.rows[0];
    console.log('Current Totals:');
    console.log(`  Tasks: ${totals.task_count}`);
    console.log(`  EHH: ${parseFloat(totals.total_ehh).toFixed(1)}`);
    console.log(`  CW+: ${parseFloat(totals.total_cw).toFixed(2)}\n`);

    // Analyze tasks that may be underestimated
    console.log('=== POTENTIALLY UNDERESTIMATED TASKS ===\n');

    // 1. Services with low EHH (should be 40-160+ hours)
    const servicesResult = await pool.query(`
      SELECT task_code, title, effort_hours, completed_work, component
      FROM admin_tasks
      WHERE status = 'completed'
        AND (title ILIKE '%service%' OR component = 'Backend')
        AND effort_hours < 60
      ORDER BY effort_hours ASC
    `);

    console.log('1. SERVICES with EHH < 60 (may need 40-160 hours):');
    let serviceAdjustment = 0;
    servicesResult.rows.forEach(r => {
      const current = parseFloat(r.effort_hours) || 0;
      const suggested = 60; // minimum for a real service
      const diff = suggested - current;
      if (diff > 0) {
        serviceAdjustment += diff;
        console.log(`   [${r.task_code}] ${r.title.substring(0, 50)}`);
        console.log(`      Current: ${current} → Suggested: ${suggested} (+${diff})`);
      }
    });
    console.log(`   Service adjustment needed: +${serviceAdjustment.toFixed(1)} EHH\n`);

    // 2. API modules with low EHH
    const apiResult = await pool.query(`
      SELECT task_code, title, effort_hours, completed_work
      FROM admin_tasks
      WHERE status = 'completed'
        AND title ILIKE '%API module%'
        AND effort_hours < 80
      ORDER BY effort_hours ASC
    `);

    console.log('2. API MODULES with EHH < 80 (may need 80-200 hours):');
    let apiAdjustment = 0;
    apiResult.rows.forEach(r => {
      const current = parseFloat(r.effort_hours) || 0;
      const suggested = 80;
      const diff = suggested - current;
      if (diff > 0) {
        apiAdjustment += diff;
        console.log(`   [${r.task_code}] ${r.title.substring(0, 50)}`);
        console.log(`      Current: ${current} → Suggested: ${suggested} (+${diff})`);
      }
    });
    console.log(`   API adjustment needed: +${apiAdjustment.toFixed(1)} EHH\n`);

    // 3. Database schema work
    const schemaResult = await pool.query(`
      SELECT task_code, title, effort_hours, completed_work
      FROM admin_tasks
      WHERE status = 'completed'
        AND title ILIKE '%Database schema%'
        AND effort_hours < 20
      ORDER BY effort_hours ASC
    `);

    console.log('3. DATABASE SCHEMA work with EHH < 20 (may need 20-60 hours):');
    let schemaAdjustment = 0;
    schemaResult.rows.forEach(r => {
      const current = parseFloat(r.effort_hours) || 0;
      const suggested = 20;
      const diff = suggested - current;
      if (diff > 0) {
        schemaAdjustment += diff;
        console.log(`   [${r.task_code}] ${r.title.substring(0, 50)}`);
        console.log(`      Current: ${current} → Suggested: ${suggested} (+${diff})`);
      }
    });
    console.log(`   Schema adjustment needed: +${schemaAdjustment.toFixed(1)} EHH\n`);

    // 4. Frontend pages with low EHH
    const pagesResult = await pool.query(`
      SELECT task_code, title, effort_hours, completed_work
      FROM admin_tasks
      WHERE status = 'completed'
        AND (title ILIKE '%Frontend page%' OR title ILIKE '%Admin page%')
        AND effort_hours < 24
      ORDER BY effort_hours ASC
    `);

    console.log('4. FRONTEND/ADMIN PAGES with EHH < 24 (may need 24-60 hours):');
    let pageAdjustment = 0;
    pagesResult.rows.forEach(r => {
      const current = parseFloat(r.effort_hours) || 0;
      const suggested = 24;
      const diff = suggested - current;
      if (diff > 0) {
        pageAdjustment += diff;
        console.log(`   [${r.task_code}] ${r.title.substring(0, 50)}`);
        console.log(`      Current: ${current} → Suggested: ${suggested} (+${diff})`);
      }
    });
    console.log(`   Page adjustment needed: +${pageAdjustment.toFixed(1)} EHH\n`);

    // 5. Infrastructure work
    const infraResult = await pool.query(`
      SELECT task_code, title, effort_hours, completed_work
      FROM admin_tasks
      WHERE status = 'completed'
        AND (title ILIKE '%infrastructure%' OR title ILIKE '%Backend infrastructure%')
        AND effort_hours < 80
      ORDER BY effort_hours ASC
    `);

    console.log('5. INFRASTRUCTURE work with EHH < 80 (may need 80-160 hours):');
    let infraAdjustment = 0;
    infraResult.rows.forEach(r => {
      const current = parseFloat(r.effort_hours) || 0;
      const suggested = 100;
      const diff = suggested - current;
      if (diff > 0) {
        infraAdjustment += diff;
        console.log(`   [${r.task_code}] ${r.title.substring(0, 50)}`);
        console.log(`      Current: ${current} → Suggested: ${suggested} (+${diff})`);
      }
    });
    console.log(`   Infrastructure adjustment needed: +${infraAdjustment.toFixed(1)} EHH\n`);

    // 6. Small bug fixes that became major work
    const bugsResult = await pool.query(`
      SELECT task_code, title, effort_hours, completed_work
      FROM admin_tasks
      WHERE status = 'completed'
        AND task_type = 'bug'
        AND effort_hours < 8
      ORDER BY effort_hours ASC
      LIMIT 20
    `);

    console.log('6. BUG FIXES with EHH < 8 (some may need more):');
    let bugAdjustment = 0;
    bugsResult.rows.forEach(r => {
      const current = parseFloat(r.effort_hours) || 0;
      // Only adjust if it looks like significant work
      if (r.title.toLowerCase().includes('fix') &&
          (r.title.toLowerCase().includes('trigger') ||
           r.title.toLowerCase().includes('dashboard') ||
           r.title.toLowerCase().includes('migration'))) {
        const suggested = 12;
        const diff = suggested - current;
        if (diff > 0) {
          bugAdjustment += diff;
          console.log(`   [${r.task_code}] ${r.title.substring(0, 50)}`);
          console.log(`      Current: ${current} → Suggested: ${suggested} (+${diff})`);
        }
      }
    });
    console.log(`   Bug fix adjustment needed: +${bugAdjustment.toFixed(1)} EHH\n`);

    // Summary
    const totalAdjustment = serviceAdjustment + apiAdjustment + schemaAdjustment +
                           pageAdjustment + infraAdjustment + bugAdjustment;

    console.log('=== ADJUSTMENT SUMMARY ===');
    console.log(`Service adjustments:        +${serviceAdjustment.toFixed(1)} EHH`);
    console.log(`API module adjustments:     +${apiAdjustment.toFixed(1)} EHH`);
    console.log(`Schema adjustments:         +${schemaAdjustment.toFixed(1)} EHH`);
    console.log(`Page adjustments:           +${pageAdjustment.toFixed(1)} EHH`);
    console.log(`Infrastructure adjustments: +${infraAdjustment.toFixed(1)} EHH`);
    console.log(`Bug fix adjustments:        +${bugAdjustment.toFixed(1)} EHH`);
    console.log(`----------------------------------------`);
    console.log(`TOTAL from re-evaluation:   +${totalAdjustment.toFixed(1)} EHH`);
    console.log('');

    // Check for missing migrations
    console.log('=== CHECKING FOR MISSING TASK RECORDS ===\n');

    const migrationCheck = await pool.query(`
      SELECT task_code, title
      FROM admin_tasks
      WHERE title ILIKE '%Migration 07%'
      ORDER BY title
    `);

    console.log('Migrations 070+ in task database:');
    migrationCheck.rows.forEach(r => {
      console.log(`   ${r.title}`);
    });

    console.log('\nNote: Check if migrations 074-077 have task records.');
    console.log('These were created today and may not be tracked.\n');

    // Final recommendation
    console.log('=== RECOMMENDATION ===');
    console.log(`Shortfall to cover: 294 EHH`);
    console.log(`Re-evaluation can recover: ~${totalAdjustment.toFixed(0)} EHH`);
    console.log(`Remaining gap: ~${Math.max(0, 294 - totalAdjustment).toFixed(0)} EHH`);
    console.log('');
    console.log('Additional untracked work to capture:');
    console.log('- Formula versioning system (074) - estimate 40-80 EHH');
    console.log('- Stakeholder access system (075) - estimate 40-60 EHH');
    console.log('- Work estimation framework (076) - estimate 40-60 EHH');
    console.log('- Monotonic safeguards (077) - estimate 40-60 EHH');
    console.log('- FormulaService.js - estimate 60-80 EHH');
    console.log('- WorkDetectionService.js - estimate 60-80 EHH');
    console.log('- 25+ utility scripts - estimate 40-80 EHH');
    console.log('- Dashboard UI updates - estimate 40-80 EHH');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

analyze();
