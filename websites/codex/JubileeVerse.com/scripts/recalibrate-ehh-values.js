#!/usr/bin/env node
/**
 * Recalibrate EHH Values Using Traditional Estimation
 *
 * This script applies traditional software estimation methodology to existing tasks.
 * EHH = Estimated Human Hours (how long a skilled dev WITHOUT AI would take)
 * CW+ = Completed Work Plus (actual hours spent WITH AI)
 *
 * The script:
 * 1. Reads each task's title, description, and component
 * 2. Identifies what was delivered (migrations, services, pages, etc.)
 * 3. Applies industry-standard time estimates
 * 4. Freezes the calculated values with audit trail
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

/**
 * Traditional estimation guidelines
 * Based on industry-standard software development estimates
 */
const ESTIMATION_RULES = {
  // Migration patterns
  migration: {
    patterns: [/migration/i, /schema/i, /database.*change/i, /alter.*table/i, /create.*table/i],
    baseEstimate: { min: 8, max: 24 },
    complexityFactors: {
      simple: 0.5,    // 1-2 tables, basic columns
      moderate: 1.0,  // 3-5 tables, relationships
      complex: 2.0,   // 10+ tables, triggers, functions
    },
    indicators: {
      simple: [/simple/i, /basic/i, /single/i, /fix/i, /trigger/i],
      complex: [/consolidate/i, /comprehensive/i, /multiple/i, /all.*tables/i, /schema.*design/i]
    }
  },

  // Service/Backend patterns
  service: {
    patterns: [/service/i, /backend/i, /api.*module/i, /server.*component/i],
    baseEstimate: { min: 40, max: 80 },
    complexityFactors: {
      simple: 0.5,    // ~200 LOC, basic CRUD
      moderate: 1.0,  // ~500 LOC, business logic
      complex: 2.0,   // ~1000+ LOC, integrations
    },
    indicators: {
      simple: [/simple/i, /basic/i, /helper/i, /util/i],
      complex: [/ai/i, /integration/i, /complex/i, /comprehensive/i, /queue/i]
    }
  },

  // API Endpoint patterns
  endpoint: {
    patterns: [/endpoint/i, /api.*route/i, /controller/i, /route.*handler/i],
    baseEstimate: { min: 8, max: 16 },
    complexityFactors: {
      simple: 0.5,    // Simple CRUD
      moderate: 1.0,  // Business logic
      complex: 2.0,   // Complex integrations
    },
    indicators: {
      simple: [/crud/i, /get/i, /list/i],
      complex: [/upload/i, /process/i, /integrate/i, /webhook/i]
    }
  },

  // Frontend Page patterns
  page: {
    patterns: [/page/i, /view/i, /screen/i, /dashboard/i, /frontend.*component/i],
    baseEstimate: { min: 16, max: 32 },
    complexityFactors: {
      simple: 0.5,    // Static content
      moderate: 1.0,  // Forms and state
      complex: 1.5,   // Complex state management
    },
    indicators: {
      simple: [/static/i, /simple/i, /basic/i],
      complex: [/dashboard/i, /form/i, /state/i, /interactive/i, /chart/i]
    }
  },

  // Bug fix patterns
  bugfix: {
    patterns: [/fix/i, /bug/i, /error/i, /issue/i, /repair/i],
    baseEstimate: { min: 4, max: 12 },
    complexityFactors: {
      simple: 0.5,    // Obvious fix
      moderate: 1.0,  // Investigation required
      complex: 2.0,   // Deep debugging
    },
    indicators: {
      simple: [/typo/i, /obvious/i, /quick/i, /minor/i],
      complex: [/intermittent/i, /race/i, /memory/i, /deep/i, /investigate/i]
    }
  },

  // Research/Design patterns
  research: {
    patterns: [/research/i, /investigate/i, /design/i, /architecture/i, /plan/i, /analysis/i],
    baseEstimate: { min: 8, max: 24 },
    complexityFactors: {
      simple: 0.5,    // Quick spike
      moderate: 1.0,  // Technology evaluation
      complex: 2.0,   // Deep architectural
    },
    indicators: {
      simple: [/quick/i, /spike/i, /brief/i],
      complex: [/comprehensive/i, /architecture/i, /deep/i, /strategic/i]
    }
  },

  // Documentation patterns
  documentation: {
    patterns: [/document/i, /readme/i, /guide/i, /manual/i, /spec/i],
    baseEstimate: { min: 4, max: 12 },
    complexityFactors: {
      simple: 0.5,
      moderate: 1.0,
      complex: 1.5,
    },
    indicators: {
      simple: [/update/i, /minor/i, /fix/i],
      complex: [/comprehensive/i, /complete/i, /new/i, /full/i]
    }
  },

  // Enhancement/Feature patterns
  feature: {
    patterns: [/feature/i, /enhancement/i, /implement/i, /add.*new/i, /create.*new/i],
    baseEstimate: { min: 24, max: 60 },
    complexityFactors: {
      simple: 0.5,
      moderate: 1.0,
      complex: 2.0,
    },
    indicators: {
      simple: [/small/i, /minor/i, /simple/i],
      complex: [/comprehensive/i, /full/i, /complete/i, /system/i]
    }
  },

  // Operational/DevOps patterns
  operational: {
    patterns: [/deploy/i, /config/i, /setup/i, /sync/i, /script/i, /operational/i],
    baseEstimate: { min: 2, max: 8 },
    complexityFactors: {
      simple: 0.5,
      moderate: 1.0,
      complex: 2.0,
    },
    indicators: {
      simple: [/simple/i, /quick/i],
      complex: [/comprehensive/i, /multiple/i, /complex/i]
    }
  }
};

/**
 * Analyze task text to determine work type and complexity
 */
function analyzeTask(title, description, component, taskType) {
  const fullText = `${title} ${description || ''} ${component || ''} ${taskType || ''}`;

  // Find matching work type
  let matchedType = null;
  let maxPatternMatches = 0;

  for (const [typeName, typeConfig] of Object.entries(ESTIMATION_RULES)) {
    const matches = typeConfig.patterns.filter(p => p.test(fullText)).length;
    if (matches > maxPatternMatches) {
      maxPatternMatches = matches;
      matchedType = typeName;
    }
  }

  // Default to feature if no match
  if (!matchedType) {
    matchedType = 'feature';
  }

  const typeConfig = ESTIMATION_RULES[matchedType];

  // Determine complexity
  let complexity = 'moderate';
  const simpleMatches = typeConfig.indicators.simple.filter(p => p.test(fullText)).length;
  const complexMatches = typeConfig.indicators.complex.filter(p => p.test(fullText)).length;

  if (complexMatches > simpleMatches) {
    complexity = 'complex';
  } else if (simpleMatches > complexMatches) {
    complexity = 'simple';
  }

  // Calculate EHH range
  const factor = typeConfig.complexityFactors[complexity];
  const ehhLow = Math.round(typeConfig.baseEstimate.min * factor);
  const ehhHigh = Math.round(typeConfig.baseEstimate.max * factor);
  const ehhMedian = Math.round((ehhLow + ehhHigh) / 2);

  return {
    workType: matchedType,
    complexity,
    ehhLow,
    ehhHigh,
    ehhMedian,
    rationale: `${matchedType} (${complexity}): ${ehhLow}-${ehhHigh} hours based on traditional estimation`
  };
}

/**
 * Count deliverables in description to adjust estimates
 */
function countDeliverables(description) {
  if (!description) return { count: 1, multiplier: 1 };

  const counts = {
    files: (description.match(/\.(js|ts|sql|html|css|json)[\s,\n]/gi) || []).length,
    functions: (description.match(/function|method|endpoint|route/gi) || []).length,
    tables: (description.match(/table|migration|schema/gi) || []).length,
    components: (description.match(/component|page|view|panel/gi) || []).length,
  };

  const totalItems = Math.max(1, counts.files + counts.functions + counts.tables + counts.components);

  // Apply multiplier based on deliverable count (capped at 3x)
  const multiplier = Math.min(3, 1 + (totalItems - 1) * 0.2);

  return { count: totalItems, multiplier };
}

/**
 * Get formula version for audit trail
 */
async function getFormulaVersion() {
  const result = await pool.query(`
    SELECT id FROM formula_versions
    WHERE formula_name = 'EHH_TRADITIONAL_ESTIMATION'
    AND effective_until IS NULL
    ORDER BY version_number DESC
    LIMIT 1
  `);
  return result.rows[0]?.id;
}

/**
 * Main recalibration function
 */
async function recalibrate() {
  console.log('=== EHH Recalibration Using Traditional Estimation ===\n');
  console.log('This recalibrates EHH values based on what was actually delivered,');
  console.log('using industry-standard human development time estimates.\n');

  try {
    // Get formula version for audit
    const formulaVersionId = await getFormulaVersion();
    if (!formulaVersionId) {
      console.error('ERROR: No active formula version found. Run migration 074 first.');
      process.exit(1);
    }
    console.log(`Using formula version: ${formulaVersionId}\n`);

    // Get all completed tasks that need recalibration
    const tasksResult = await pool.query(`
      SELECT id, task_code, title, description, component, task_type,
             effort_hours as current_ehh, completed_work as current_cw,
             frozen_ehh, metrics_frozen_at
      FROM admin_tasks
      WHERE status = 'completed'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
    `);

    console.log(`Found ${tasksResult.rows.length} completed tasks to analyze\n`);

    let recalibratedCount = 0;
    let skippedCount = 0;
    let totalNewEHH = 0;
    let totalOldEHH = 0;

    for (const task of tasksResult.rows) {
      // Skip already frozen tasks (they have immutable values)
      if (task.metrics_frozen_at) {
        skippedCount++;
        totalNewEHH += parseFloat(task.frozen_ehh) || 0;
        totalOldEHH += parseFloat(task.frozen_ehh) || 0;
        continue;
      }

      // Analyze task for traditional estimation
      const analysis = analyzeTask(task.title, task.description, task.component, task.task_type);

      // Count deliverables for multiplier
      const deliverables = countDeliverables(task.description);

      // Calculate final EHH with deliverable multiplier
      const estimatedEHH = Math.round(analysis.ehhMedian * deliverables.multiplier);

      // Keep CW+ as is (actual time spent)
      const cwPlus = parseFloat(task.current_cw) || 0.25; // Default to 0.25 if not set

      const currentEHH = parseFloat(task.current_ehh) || 0;
      totalOldEHH += currentEHH;
      totalNewEHH += estimatedEHH;

      // Only update if EHH changed significantly (>10% difference)
      if (Math.abs(estimatedEHH - currentEHH) / Math.max(1, currentEHH) > 0.1) {
        // Update task with new EHH value
        await pool.query(`
          UPDATE admin_tasks
          SET effort_hours = $1,
              formula_version_id = $2,
              frozen_ehh = $1,
              frozen_cw_plus = $3,
              metrics_frozen_at = NOW()
          WHERE id = $4
        `, [estimatedEHH, formulaVersionId, cwPlus, task.id]);

        // Create audit log entry
        await pool.query(`
          INSERT INTO calculation_audit_log (
            task_id, formula_version_id, input_values,
            calculated_ehh, calculated_cw_plus,
            calculation_reason, calculation_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          task.id,
          formulaVersionId,
          JSON.stringify({
            title: task.title,
            component: task.component,
            task_type: task.task_type,
            work_type: analysis.workType,
            complexity: analysis.complexity,
            deliverable_count: deliverables.count,
            deliverable_multiplier: deliverables.multiplier
          }),
          estimatedEHH,
          cwPlus,
          'recalibration',
          `Traditional estimation: ${analysis.rationale}. ${deliverables.count} deliverables (${deliverables.multiplier.toFixed(1)}x multiplier).`
        ]);

        console.log(`[${task.task_code}] ${task.title.substring(0, 50)}...`);
        console.log(`  Type: ${analysis.workType} (${analysis.complexity})`);
        console.log(`  EHH: ${currentEHH} → ${estimatedEHH} hours`);
        console.log(`  CW+: ${cwPlus} hours`);
        console.log(`  Efficiency: ${cwPlus > 0 ? Math.round((estimatedEHH / cwPlus) * 100) : 0}%`);
        console.log('');

        recalibratedCount++;
      } else {
        // Still freeze the values even if unchanged
        await pool.query(`
          UPDATE admin_tasks
          SET formula_version_id = $1,
              frozen_ehh = effort_hours,
              frozen_cw_plus = completed_work,
              metrics_frozen_at = NOW()
          WHERE id = $2 AND metrics_frozen_at IS NULL
        `, [formulaVersionId, task.id]);

        skippedCount++;
      }
    }

    console.log('\n=== RECALIBRATION SUMMARY ===');
    console.log(`Tasks recalibrated: ${recalibratedCount}`);
    console.log(`Tasks skipped (frozen or unchanged): ${skippedCount}`);
    console.log(`\nTotal EHH before: ${totalOldEHH.toFixed(1)} hours`);
    console.log(`Total EHH after: ${totalNewEHH.toFixed(1)} hours`);
    console.log(`Change: ${(totalNewEHH - totalOldEHH).toFixed(1)} hours (${((totalNewEHH / totalOldEHH - 1) * 100).toFixed(1)}%)`);

    // Get updated totals from database
    const totals = await pool.query(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(effort_hours), 0) as total_ehh,
        COALESCE(SUM(completed_work), 0) as total_cw
      FROM admin_tasks
      WHERE status = 'completed'
    `);

    const row = totals.rows[0];
    const efficiency = parseFloat(row.total_cw) > 0
      ? Math.round((parseFloat(row.total_ehh) / parseFloat(row.total_cw)) * 100)
      : 0;

    console.log('\n=== FINAL TOTALS ===');
    console.log(`Completed Tasks: ${row.count}`);
    console.log(`Total EHH: ${parseFloat(row.total_ehh).toFixed(1)} hours`);
    console.log(`Total CW+: ${parseFloat(row.total_cw).toFixed(2)} hours`);
    console.log(`Work Efficiency: ${efficiency}%`);

  } catch (error) {
    console.error('Error during recalibration:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  recalibrate();
}

module.exports = { analyzeTask, countDeliverables, recalibrate };
