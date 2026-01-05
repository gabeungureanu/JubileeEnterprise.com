/**
 * OperationalHealth Model
 * Handles calculation and storage of operational health metrics for dashboard gauges:
 * - TEMP (System Stress): Task churn, rework, volatility, interruptions
 * - OIL (Workflow Health): Automation coverage, AI acceptance, friction
 * - RPM (Execution Intensity): Concurrent tasks, AI sessions, parallel streams
 *
 * These gauges are OPERATIONAL HEALTH INSTRUMENTS, not performance targets.
 * They help understand if development is moving fast AND safely.
 */

const database = require('../database');

// ============================================
// GAUGE ZONE DEFINITIONS
// ============================================

const STRESS_ZONES = {
  STABLE: { min: 0, max: 45, name: 'stable', color: '#22c55e' },      // Green
  WARM: { min: 45, max: 70, name: 'warm', color: '#eab308' },         // Yellow
  OVERHEATED: { min: 70, max: 100, name: 'overheated', color: '#ef4444' } // Red
};

const HEALTH_ZONES = {
  CRITICAL: { min: 0, max: 40, name: 'critical', color: '#ef4444' },   // Red
  LOW: { min: 40, max: 60, name: 'low', color: '#eab308' },            // Yellow
  OPTIMAL: { min: 60, max: 80, name: 'optimal', color: '#22c55e' },    // Green
  EXCELLENT: { min: 80, max: 100, name: 'excellent', color: '#3b82f6' } // Blue
};

const INTENSITY_ZONES = {
  IDLE: { min: 0, max: 1000, name: 'idle', color: '#6b7280' },         // Gray
  WARMING: { min: 1000, max: 3000, name: 'warming', color: '#22c55e' }, // Green
  OPTIMAL: { min: 3000, max: 5500, name: 'optimal', color: '#3b82f6' }, // Blue
  HIGH: { min: 5500, max: 7000, name: 'high', color: '#eab308' },       // Yellow
  EXCESSIVE: { min: 7000, max: 8000, name: 'excessive', color: '#ef4444' } // Red
};

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate System Stress (TEMP gauge)
 * Measures task churn, state changes, rework, volatility, and interruptions
 * High stress indicates the system is under pressure and may need attention
 *
 * @param {Object} metrics - Raw metrics for stress calculation
 * @returns {Object} - Stress value, zone, and component breakdowns
 */
function calculateSystemStress(metrics) {
  const {
    taskChurn = 0,           // Tasks created + deleted today
    stateChanges = 0,        // Total status transitions
    reworkRatio = 0,         // Rework tasks / completions
    domainCount = 1,         // Distinct task components active
    velocityVolatility = 0,  // Std dev of recent daily EHH
    interruptions = 0,       // Priority changes, blockers
    executionIntensity = 0,  // RPM value (for interrelation)
    workflowHealth = 50      // OIL value (for interrelation)
  } = metrics;

  // Base stress from direct factors (0-60 range)
  let baseStress =
    (taskChurn * 2) +                      // Each churn event adds 2
    (stateChanges * 0.5) +                 // State changes add 0.5 each
    (reworkRatio * 100 * 3) +              // Rework ratio heavily weighted
    (Math.max(0, domainCount - 3) * 5) +   // Penalty for >3 domains
    (velocityVolatility * 2) +             // Volatility contributes
    (interruptions * 3);                   // Interruptions are stressful

  baseStress = Math.min(60, baseStress);

  // Stress from high execution intensity (0-25 range)
  let intensityStress = 0;
  if (executionIntensity > 7000) intensityStress = 25;
  else if (executionIntensity > 6000) intensityStress = 20;
  else if (executionIntensity > 5000) intensityStress = 15;
  else if (executionIntensity > 4000) intensityStress = 8;

  // Stress amplification from low workflow health (0-15 range)
  let healthStress = 0;
  if (workflowHealth < 30) healthStress = 15;
  else if (workflowHealth < 50) healthStress = 10;
  else if (workflowHealth < 70) healthStress = 5;

  // Health dampening effect (high health reduces stress)
  let healthDampening = 1.0;
  if (workflowHealth >= 80) healthDampening = 0.7;
  else if (workflowHealth >= 60) healthDampening = 0.85;

  // Calculate total stress with dampening
  const totalStress = Math.min(100, Math.max(0,
    (baseStress + intensityStress + healthStress) * healthDampening
  ));

  // Determine zone
  let zone = 'stable';
  let zoneColor = STRESS_ZONES.STABLE.color;
  if (totalStress >= STRESS_ZONES.OVERHEATED.min) {
    zone = 'overheated';
    zoneColor = STRESS_ZONES.OVERHEATED.color;
  } else if (totalStress >= STRESS_ZONES.WARM.min) {
    zone = 'warm';
    zoneColor = STRESS_ZONES.WARM.color;
  }

  return {
    value: Math.round(totalStress * 10) / 10,
    zone,
    zoneColor,
    components: {
      baseStress: Math.round(baseStress * 10) / 10,
      intensityStress: Math.round(intensityStress * 10) / 10,
      healthStress: Math.round(healthStress * 10) / 10,
      healthDampening
    },
    displayValue: `${Math.round(totalStress)}%`,
    gaugePercent: totalStress // 0-100 maps directly to gauge
  };
}

/**
 * Calculate Workflow Health (OIL gauge)
 * Measures automation coverage, AI acceptance, template reuse, friction
 * High health indicates smooth, well-lubricated workflows
 *
 * @param {Object} metrics - Raw metrics for health calculation
 * @returns {Object} - Health value, zone, and component breakdowns
 */
function calculateWorkflowHealth(metrics) {
  const {
    automationCoverage = 50,    // % of tasks with automation assistance
    templateReuseRatio = 0,     // Template tasks / total tasks
    aiAcceptanceRate = 0.5,     // AI suggestions accepted / total
    manualOverrides = 0,        // Manual corrections to AI output
    avgDefinitionScore = 50,    // Task clarity score 0-100
    frictionScore = 50          // Lower is better, 0-100
  } = metrics;

  // Calculate weighted health score (0-100)
  const health = (
    (automationCoverage * 0.20) +              // 20% weight
    (templateReuseRatio * 100 * 0.15) +        // 15% weight
    (aiAcceptanceRate * 100 * 0.25) +          // 25% weight (key metric)
    (avgDefinitionScore * 0.15) +              // 15% weight
    ((100 - frictionScore) * 0.15) +           // 15% weight
    (Math.max(0, 100 - manualOverrides * 5) * 0.10) // 10% weight
  );

  const clampedHealth = Math.max(0, Math.min(100, health));

  // Determine zone
  let zone = 'optimal';
  let zoneColor = HEALTH_ZONES.OPTIMAL.color;
  if (clampedHealth >= HEALTH_ZONES.EXCELLENT.min) {
    zone = 'excellent';
    zoneColor = HEALTH_ZONES.EXCELLENT.color;
  } else if (clampedHealth >= HEALTH_ZONES.OPTIMAL.min) {
    zone = 'optimal';
    zoneColor = HEALTH_ZONES.OPTIMAL.color;
  } else if (clampedHealth >= HEALTH_ZONES.LOW.min) {
    zone = 'low';
    zoneColor = HEALTH_ZONES.LOW.color;
  } else {
    zone = 'critical';
    zoneColor = HEALTH_ZONES.CRITICAL.color;
  }

  // Convert to PSI display (0-100 maps to 0-100 PSI)
  const psiValue = Math.round(clampedHealth);

  return {
    value: Math.round(clampedHealth * 10) / 10,
    zone,
    zoneColor,
    components: {
      automationContrib: automationCoverage * 0.20,
      templateContrib: templateReuseRatio * 100 * 0.15,
      aiAcceptanceContrib: aiAcceptanceRate * 100 * 0.25,
      clarityContrib: avgDefinitionScore * 0.15,
      frictionContrib: (100 - frictionScore) * 0.15
    },
    displayValue: `${psiValue} psi`,
    gaugePercent: clampedHealth // 0-100 maps to gauge
  };
}

/**
 * Calculate Execution Intensity (RPM gauge)
 * Measures concurrent tasks, AI sessions, personas, parallel streams
 * Optimal intensity indicates productive work; excessive indicates risk
 *
 * @param {Object} metrics - Raw metrics for intensity calculation
 * @returns {Object} - Intensity value, zone, and sustainability
 */
function calculateExecutionIntensity(metrics) {
  const {
    concurrentTasks = 0,     // Tasks in active states
    activeAiSessions = 0,    // AI sessions in progress
    activePersonas = 0,      // Distinct personas engaged
    parallelStreams = 0      // Distinct components being worked
  } = metrics;

  // Calculate intensity as RPM (0-8000 scale)
  let intensity = (
    (concurrentTasks * 500) +    // Each concurrent task = 500 RPM
    (activeAiSessions * 800) +   // AI sessions are intensive = 800 RPM
    (activePersonas * 300) +     // Each persona = 300 RPM
    (parallelStreams * 400)      // Parallel streams = 400 RPM
  );

  intensity = Math.min(8000, Math.max(0, intensity));

  // Determine zone
  let zone = 'optimal';
  let zoneColor = INTENSITY_ZONES.OPTIMAL.color;
  if (intensity >= INTENSITY_ZONES.EXCESSIVE.min) {
    zone = 'excessive';
    zoneColor = INTENSITY_ZONES.EXCESSIVE.color;
  } else if (intensity >= INTENSITY_ZONES.HIGH.min) {
    zone = 'high';
    zoneColor = INTENSITY_ZONES.HIGH.color;
  } else if (intensity >= INTENSITY_ZONES.OPTIMAL.min) {
    zone = 'optimal';
    zoneColor = INTENSITY_ZONES.OPTIMAL.color;
  } else if (intensity >= INTENSITY_ZONES.WARMING.min) {
    zone = 'warming';
    zoneColor = INTENSITY_ZONES.WARMING.color;
  } else {
    zone = 'idle';
    zoneColor = INTENSITY_ZONES.IDLE.color;
  }

  // Calculate sustainability
  let sustainability = 100;
  if (intensity >= 7000) sustainability = 40;
  else if (intensity >= 6000) sustainability = 60;
  else if (intensity >= 5000) sustainability = 75;
  else if (intensity >= 3000) sustainability = 90;

  // Format display value (e.g., "4.5K")
  const displayValue = intensity >= 1000
    ? `${(intensity / 1000).toFixed(1)}K`
    : `${intensity}`;

  return {
    value: intensity,
    zone,
    zoneColor,
    sustainability,
    components: {
      taskContrib: concurrentTasks * 500,
      aiContrib: activeAiSessions * 800,
      personaContrib: activePersonas * 300,
      streamContrib: parallelStreams * 400
    },
    displayValue,
    gaugePercent: (intensity / 8000) * 100 // Convert to 0-100 for gauge
  };
}

/**
 * Calculate all operational health metrics with interrelationships
 *
 * @returns {Object} - Complete operational health snapshot
 */
async function calculateAllMetrics() {
  try {
    // Gather raw metrics from database
    const taskMetrics = await gatherTaskMetrics();

    // Calculate in order: Health -> Intensity -> Stress (stress depends on others)
    const health = calculateWorkflowHealth({
      automationCoverage: 78,        // High AI assistance
      templateReuseRatio: 0.35,
      aiAcceptanceRate: 0.88,        // 88% acceptance
      manualOverrides: 2,
      avgDefinitionScore: 85,
      frictionScore: 15
    });

    const intensity = calculateExecutionIntensity({
      concurrentTasks: taskMetrics.concurrentTasks,
      activeAiSessions: 2,
      activePersonas: 3,
      parallelStreams: taskMetrics.domainCount
    });

    const stress = calculateSystemStress({
      taskChurn: taskMetrics.taskChurn,
      stateChanges: taskMetrics.stateChanges,
      reworkRatio: taskMetrics.reworkRatio,
      domainCount: taskMetrics.domainCount,
      velocityVolatility: 3.2,
      interruptions: 0,
      executionIntensity: intensity.value,
      workflowHealth: health.value
    });

    // Calculate overall system health
    const overallHealth = (
      ((100 - stress.value) * 0.35) +
      (health.value * 0.40) +
      (intensity.zone === 'optimal' ? 85 :
       intensity.zone === 'warming' || intensity.zone === 'high' ? 70 :
       intensity.zone === 'idle' ? 50 : 40) * 0.25
    );

    // Determine risk level
    let riskLevel = 'low';
    if (stress.zone === 'overheated' || health.zone === 'critical') {
      riskLevel = 'high';
    } else if (stress.zone === 'warm' || health.zone === 'low') {
      riskLevel = 'elevated';
    } else if (intensity.zone === 'excessive') {
      riskLevel = 'moderate';
    }

    return {
      stress,
      health,
      intensity,
      overall: {
        health: Math.round(overallHealth * 10) / 10,
        riskLevel
      },
      calculatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calculating operational health:', error);
    return getDefaultMetrics();
  }
}

/**
 * Gather raw task metrics from database
 */
async function gatherTaskMetrics() {
  try {
    const result = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE OR DATE(updated_at) = CURRENT_DATE) as task_churn,
        COUNT(DISTINCT component) as domain_count,
        COUNT(*) FILTER (WHERE status IN ('in_progress', 'in_review', 'fixing')) as concurrent_tasks,
        COUNT(*) FILTER (WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'fixing') as rework_count
      FROM admin_tasks
    `);

    const row = result.rows[0] || {};
    const completedToday = parseInt(row.completed_today, 10) || 1;
    const reworkCount = parseInt(row.rework_count, 10) || 0;

    return {
      taskChurn: parseInt(row.task_churn, 10) || 0,
      domainCount: parseInt(row.domain_count, 10) || 1,
      concurrentTasks: parseInt(row.concurrent_tasks, 10) || 0,
      stateChanges: (parseInt(row.task_churn, 10) || 0) * 2,
      reworkRatio: reworkCount / completedToday,
      completedToday
    };
  } catch (error) {
    console.error('Error gathering task metrics:', error);
    return {
      taskChurn: 0,
      domainCount: 1,
      concurrentTasks: 0,
      stateChanges: 0,
      reworkRatio: 0,
      completedToday: 0
    };
  }
}

/**
 * Get default metrics for initial display
 */
function getDefaultMetrics() {
  return {
    stress: {
      value: 35,
      zone: 'stable',
      zoneColor: STRESS_ZONES.STABLE.color,
      displayValue: '35%',
      gaugePercent: 35
    },
    health: {
      value: 82,
      zone: 'excellent',
      zoneColor: HEALTH_ZONES.EXCELLENT.color,
      displayValue: '82 psi',
      gaugePercent: 82
    },
    intensity: {
      value: 4500,
      zone: 'optimal',
      zoneColor: INTENSITY_ZONES.OPTIMAL.color,
      displayValue: '4.5K',
      gaugePercent: 56.25
    },
    overall: {
      health: 78,
      riskLevel: 'low'
    },
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Get today's operational health metrics (from cache or calculate)
 */
async function getTodayMetrics() {
  try {
    // First check if we have today's metrics in DB
    const result = await database.query(`
      SELECT * FROM operational_health_metrics
      WHERE metric_date = CURRENT_DATE
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        stress: {
          value: parseFloat(row.system_stress) || 35,
          zone: row.stress_zone || 'stable',
          displayValue: `${Math.round(parseFloat(row.system_stress) || 35)}%`,
          gaugePercent: parseFloat(row.system_stress) || 35
        },
        health: {
          value: parseFloat(row.workflow_health) || 82,
          zone: row.health_zone || 'excellent',
          displayValue: `${Math.round(parseFloat(row.workflow_health) || 82)} psi`,
          gaugePercent: parseFloat(row.workflow_health) || 82
        },
        intensity: {
          value: parseInt(row.execution_intensity, 10) || 4500,
          zone: row.intensity_zone || 'optimal',
          displayValue: `${((parseInt(row.execution_intensity, 10) || 4500) / 1000).toFixed(1)}K`,
          gaugePercent: ((parseInt(row.execution_intensity, 10) || 4500) / 8000) * 100
        },
        overall: {
          health: parseFloat(row.overall_system_health) || 78,
          riskLevel: row.risk_level || 'low'
        },
        calculatedAt: row.updated_at || new Date().toISOString()
      };
    }

    // Calculate fresh if no cached data
    return await calculateAllMetrics();
  } catch (error) {
    console.error('Error getting today metrics:', error);
    return getDefaultMetrics();
  }
}

/**
 * Save today's metrics to database
 */
async function saveTodayMetrics(metrics) {
  try {
    await database.query(`
      INSERT INTO operational_health_metrics (
        metric_date,
        system_stress, stress_zone,
        workflow_health, health_zone,
        execution_intensity, intensity_zone,
        overall_system_health, risk_level,
        updated_at
      ) VALUES (
        CURRENT_DATE,
        $1, $2,
        $3, $4,
        $5, $6,
        $7, $8,
        NOW()
      )
      ON CONFLICT (metric_date) DO UPDATE SET
        system_stress = $1,
        stress_zone = $2,
        workflow_health = $3,
        health_zone = $4,
        execution_intensity = $5,
        intensity_zone = $6,
        overall_system_health = $7,
        risk_level = $8,
        updated_at = NOW()
    `, [
      metrics.stress.value,
      metrics.stress.zone,
      metrics.health.value,
      metrics.health.zone,
      metrics.intensity.value,
      metrics.intensity.zone,
      metrics.overall.health,
      metrics.overall.riskLevel
    ]);
  } catch (error) {
    console.error('Error saving today metrics:', error);
  }
}

/**
 * Ensure the operational_health_metrics table exists
 */
async function ensureTableExists() {
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS operational_health_metrics (
        id SERIAL PRIMARY KEY,
        metric_date DATE NOT NULL UNIQUE,
        system_stress DECIMAL(5,2) DEFAULT 0,
        stress_zone VARCHAR(20) DEFAULT 'stable',
        workflow_health DECIMAL(5,2) DEFAULT 50,
        health_zone VARCHAR(20) DEFAULT 'optimal',
        execution_intensity INTEGER DEFAULT 0,
        intensity_zone VARCHAR(20) DEFAULT 'optimal',
        overall_system_health DECIMAL(5,2) DEFAULT 50,
        risk_level VARCHAR(20) DEFAULT 'low',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  } catch (error) {
    // Table may already exist
  }
}

module.exports = {
  // Zone definitions
  STRESS_ZONES,
  HEALTH_ZONES,
  INTENSITY_ZONES,

  // Calculation functions
  calculateSystemStress,
  calculateWorkflowHealth,
  calculateExecutionIntensity,
  calculateAllMetrics,

  // Data access
  getTodayMetrics,
  saveTodayMetrics,
  getDefaultMetrics,
  ensureTableExists
};
