/**
 * FormulaService - Versioned EHH/CW+ Calculation Service
 *
 * This service manages versioned formulas for calculating Estimated Human Hours (EHH)
 * and Completed Work Plus (CW+). All calculations are audited and formulas are immutable.
 *
 * Key Concepts:
 * - EHH: How long a skilled human developer WITHOUT AI would take
 * - CW+: Actual hours spent WITH AI assistance
 * - Work Efficiency: EHH / CW+ (typically 2000-10000%)
 */

const database = require('../database');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Traditional estimation guidelines for component types
 * These are used to validate and guide EHH estimations
 */
const ESTIMATION_GUIDELINES = {
  // Database work
  'migration_simple': { min: 2, max: 4, description: 'Simple migration (1-2 tables, basic columns)' },
  'migration_moderate': { min: 8, max: 16, description: 'Moderate migration (3-5 tables, relationships)' },
  'migration_complex': { min: 16, max: 40, description: 'Complex migration (10+ tables, triggers, functions)' },

  // API/Backend work
  'endpoint_simple': { min: 4, max: 8, description: 'Simple CRUD endpoint' },
  'endpoint_moderate': { min: 8, max: 16, description: 'Endpoint with business logic' },
  'endpoint_complex': { min: 16, max: 32, description: 'Complex endpoint with integrations' },
  'service_small': { min: 20, max: 40, description: 'Small service (~200 LOC)' },
  'service_medium': { min: 40, max: 80, description: 'Medium service (~500 LOC)' },
  'service_large': { min: 80, max: 160, description: 'Large service (~1000+ LOC)' },

  // Frontend work
  'page_simple': { min: 8, max: 16, description: 'Simple static page' },
  'page_moderate': { min: 16, max: 32, description: 'Page with forms and state' },
  'page_complex': { min: 24, max: 48, description: 'Complex page with state management' },
  'component_simple': { min: 2, max: 4, description: 'Simple reusable component' },
  'component_complex': { min: 8, max: 16, description: 'Complex component with logic' },

  // Research/Design work
  'research_simple': { min: 2, max: 4, description: 'Quick investigation or spike' },
  'research_moderate': { min: 8, max: 16, description: 'Technology evaluation' },
  'research_deep': { min: 16, max: 40, description: 'Deep architectural research' },
  'architecture_decision': { min: 16, max: 32, description: 'Architectural design decision' },

  // Bug fixes
  'bugfix_simple': { min: 2, max: 4, description: 'Obvious fix, clear error' },
  'bugfix_moderate': { min: 4, max: 8, description: 'Investigation required' },
  'bugfix_complex': { min: 8, max: 24, description: 'Deep debugging, intermittent issues' },

  // Full features
  'feature_small': { min: 40, max: 80, description: 'Small feature (single component)' },
  'feature_medium': { min: 80, max: 200, description: 'Medium feature (full stack)' },
  'feature_large': { min: 200, max: 500, description: 'Large feature or subsystem' }
};

/**
 * Get the currently active formula version
 * @param {string} formulaName - Name of the formula (e.g., 'EHH_TRADITIONAL_ESTIMATION')
 * @returns {Object|null} The active formula version or null if not found
 */
async function getActiveFormula(formulaName = 'EHH_TRADITIONAL_ESTIMATION') {
  try {
    const result = await database.query(`
      SELECT * FROM formula_versions
      WHERE formula_name = $1
        AND effective_until IS NULL
      ORDER BY version_number DESC
      LIMIT 1
    `, [formulaName]);

    return result.rows[0] || null;
  } catch (error) {
    logger.error('[FormulaService] Failed to get active formula', { formulaName, error: error.message });
    return null;
  }
}

/**
 * Get a specific formula version by ID
 * @param {string} formulaVersionId - UUID of the formula version
 * @returns {Object|null} The formula version or null if not found
 */
async function getFormulaById(formulaVersionId) {
  try {
    const result = await database.query(`
      SELECT * FROM formula_versions WHERE id = $1
    `, [formulaVersionId]);

    return result.rows[0] || null;
  } catch (error) {
    logger.error('[FormulaService] Failed to get formula by ID', { formulaVersionId, error: error.message });
    return null;
  }
}

/**
 * Calculate EHH using traditional estimation methodology
 * This breaks down deliverables and applies industry-standard estimates
 *
 * @param {Object} deliverables - Description of what was delivered
 * @param {string} deliverables.description - Text description of work done
 * @param {Array} deliverables.components - Array of {type, count, complexity} objects
 * @returns {Object} {ehh_low, ehh_high, ehh_median, breakdown}
 */
function estimateEHH(deliverables) {
  const breakdown = [];
  let totalLow = 0;
  let totalHigh = 0;

  // Process each component
  if (deliverables.components && Array.isArray(deliverables.components)) {
    for (const component of deliverables.components) {
      const guidelineKey = `${component.type}_${component.complexity || 'moderate'}`;
      const guideline = ESTIMATION_GUIDELINES[guidelineKey] || ESTIMATION_GUIDELINES[component.type];

      if (guideline) {
        const count = component.count || 1;
        const low = guideline.min * count;
        const high = guideline.max * count;

        breakdown.push({
          type: component.type,
          complexity: component.complexity || 'moderate',
          count,
          description: component.description || guideline.description,
          ehh_low: low,
          ehh_high: high,
          ehh_median: (low + high) / 2
        });

        totalLow += low;
        totalHigh += high;
      }
    }
  }

  return {
    ehh_low: totalLow,
    ehh_high: totalHigh,
    ehh_median: (totalLow + totalHigh) / 2,
    breakdown
  };
}

/**
 * Freeze task metrics - lock EHH/CW+ values when task is completed
 * This creates an immutable audit record
 *
 * @param {string} taskId - UUID of the task
 * @param {number} ehh - Estimated Human Hours
 * @param {number} cwPlus - Completed Work Plus (actual hours with AI)
 * @param {Object} options - Additional options
 * @param {string} options.calculatedBy - User ID who performed calculation
 * @param {string} options.reason - Reason for calculation ('task_completion', 'recalibration', 'manual_adjustment')
 * @param {Object} options.inputValues - Input values used for calculation
 * @returns {boolean} Success status
 */
async function freezeTaskMetrics(taskId, ehh, cwPlus, options = {}) {
  const {
    calculatedBy = null,
    reason = 'task_completion',
    inputValues = {}
  } = options;

  try {
    // Get active formula
    const formula = await getActiveFormula();
    if (!formula) {
      throw new Error('No active formula version found');
    }

    // Use database function to freeze metrics
    await database.query(`
      SELECT freeze_task_metrics($1, $2, $3, $4, $5, $6)
    `, [taskId, ehh, cwPlus, formula.id, calculatedBy, reason]);

    logger.info('[FormulaService] Task metrics frozen', {
      taskId,
      ehh,
      cwPlus,
      formulaVersion: formula.version_number,
      reason
    });

    return true;
  } catch (error) {
    logger.error('[FormulaService] Failed to freeze task metrics', {
      taskId,
      ehh,
      cwPlus,
      error: error.message
    });
    return false;
  }
}

/**
 * Get calculation history for a task
 * Returns all audit records showing how EHH/CW+ was calculated
 *
 * @param {string} taskId - UUID of the task
 * @returns {Array} Array of calculation audit records
 */
async function getTaskCalculationHistory(taskId) {
  try {
    const result = await database.query(`
      SELECT
        cal.*,
        fv.formula_name,
        fv.version_number,
        fv.display_name as formula_display_name
      FROM calculation_audit_log cal
      JOIN formula_versions fv ON cal.formula_version_id = fv.id
      WHERE cal.task_id = $1
      ORDER BY cal.calculated_at DESC
    `, [taskId]);

    return result.rows;
  } catch (error) {
    logger.error('[FormulaService] Failed to get calculation history', { taskId, error: error.message });
    return [];
  }
}

/**
 * Create a daily metric snapshot
 * These snapshots are used for reproducible historical queries
 *
 * @param {string} metricType - Type of metric ('daily_totals', 'velocity', 'cumulative')
 * @param {Object} data - The metric data to snapshot
 * @param {Date} snapshotDate - The date for this snapshot (defaults to today)
 * @returns {boolean} Success status
 */
async function createMetricSnapshot(metricType, data, snapshotDate = new Date()) {
  try {
    const formula = await getActiveFormula();
    const dateStr = snapshotDate.toISOString().split('T')[0];
    const dataJson = JSON.stringify(data);
    const dataHash = crypto.createHash('sha256').update(dataJson).digest('hex');

    await database.query(`
      INSERT INTO metric_snapshots (snapshot_date, metric_type, frozen_data, data_hash, formula_version_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (snapshot_date, metric_type)
      DO UPDATE SET
        frozen_data = EXCLUDED.frozen_data,
        data_hash = EXCLUDED.data_hash,
        formula_version_id = EXCLUDED.formula_version_id
    `, [dateStr, metricType, data, dataHash, formula?.id]);

    logger.info('[FormulaService] Metric snapshot created', { metricType, snapshotDate: dateStr });
    return true;
  } catch (error) {
    logger.error('[FormulaService] Failed to create metric snapshot', { metricType, error: error.message });
    return false;
  }
}

/**
 * Get historical metric snapshot
 * Returns frozen data from a specific date - never recalculates
 *
 * @param {string} metricType - Type of metric
 * @param {Date|string} snapshotDate - The date to query
 * @returns {Object|null} The frozen metric data or null if not found
 */
async function getMetricSnapshot(metricType, snapshotDate) {
  try {
    const dateStr = typeof snapshotDate === 'string'
      ? snapshotDate
      : snapshotDate.toISOString().split('T')[0];

    const result = await database.query(`
      SELECT
        ms.*,
        fv.formula_name,
        fv.version_number as formula_version
      FROM metric_snapshots ms
      LEFT JOIN formula_versions fv ON ms.formula_version_id = fv.id
      WHERE ms.snapshot_date = $1 AND ms.metric_type = $2
    `, [dateStr, metricType]);

    return result.rows[0] || null;
  } catch (error) {
    logger.error('[FormulaService] Failed to get metric snapshot', { metricType, snapshotDate, error: error.message });
    return null;
  }
}

/**
 * Validate an EHH estimate against guidelines
 * Returns warnings if estimate seems unreasonable
 *
 * @param {number} ehh - The EHH estimate
 * @param {Object} deliverables - Description of deliverables
 * @returns {Object} {valid, warnings, suggestions}
 */
function validateEHHEstimate(ehh, deliverables) {
  const warnings = [];
  const suggestions = [];

  // Get expected range based on deliverables
  const expected = estimateEHH(deliverables);

  if (ehh < expected.ehh_low * 0.5) {
    warnings.push(`EHH (${ehh}) seems too low. Expected range: ${expected.ehh_low}-${expected.ehh_high} hours.`);
    suggestions.push('Consider if all components have been accounted for.');
  }

  if (ehh > expected.ehh_high * 2) {
    warnings.push(`EHH (${ehh}) seems high. Expected range: ${expected.ehh_low}-${expected.ehh_high} hours.`);
    suggestions.push('Verify the complexity levels are accurate.');
  }

  return {
    valid: warnings.length === 0,
    warnings,
    suggestions,
    expectedRange: {
      low: expected.ehh_low,
      high: expected.ehh_high,
      median: expected.ehh_median
    }
  };
}

/**
 * Get all formula versions for display/audit
 * @returns {Array} Array of all formula versions
 */
async function getAllFormulaVersions() {
  try {
    const result = await database.query(`
      SELECT * FROM formula_versions
      ORDER BY formula_name, version_number DESC
    `);
    return result.rows;
  } catch (error) {
    logger.error('[FormulaService] Failed to get formula versions', { error: error.message });
    return [];
  }
}

module.exports = {
  // Formula management
  getActiveFormula,
  getFormulaById,
  getAllFormulaVersions,

  // EHH estimation
  estimateEHH,
  validateEHHEstimate,
  ESTIMATION_GUIDELINES,

  // Task metrics
  freezeTaskMetrics,
  getTaskCalculationHistory,

  // Metric snapshots
  createMetricSnapshot,
  getMetricSnapshot
};
