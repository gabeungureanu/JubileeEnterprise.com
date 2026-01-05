/**
 * HospitalityCockpit Model
 * Handles hospitality dashboard "cockpit" metrics for flight-instrument gauges
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to metrics object
 */
function rowToMetrics(row) {
  if (!row) return null;
  return {
    id: row.id,
    metricDate: row.metric_date,

    // Attitude Indicator
    attitude: {
      pitch: parseFloat(row.attitude_pitch) || 0,
      roll: parseFloat(row.attitude_roll) || 0,
      stability: row.attitude_stability || 'stable'
    },
    attitudeInputs: {
      sentimentScore: parseFloat(row.sentiment_score) || 0,
      acceptanceRate: parseFloat(row.acceptance_rate) || 0,
      negativeKeywordDensity: parseFloat(row.negative_keyword_density) || 0,
      dropOffRate: parseFloat(row.drop_off_rate) || 0
    },

    // Altimeter
    altitude: {
      feet: parseInt(row.altitude_feet) || 0,
      trend: row.altitude_trend || 'level'
    },
    altitudeInputs: {
      returningUsers7dPct: parseFloat(row.returning_users_7d_pct) || 0,
      returningUsers30dPct: parseFloat(row.returning_users_30d_pct) || 0,
      avgSessionsPerUser: parseFloat(row.avg_sessions_per_user) || 0,
      userLongevityDays: parseFloat(row.user_longevity_days) || 0
    },

    // Airspeed
    airspeed: {
      knots: parseInt(row.airspeed_knots) || 0,
      zone: row.airspeed_zone || 'cruise'
    },
    airspeedInputs: {
      chatInteractionsPerUser: parseFloat(row.chat_interactions_per_user) || 0,
      listeningSessionsPerUser: parseFloat(row.listening_sessions_per_user) || 0,
      prayerAcceptancesPerUser: parseFloat(row.prayer_acceptances_per_user) || 0,
      engagementFlowsCompleted: parseFloat(row.engagement_flows_completed) || 0,
      totalActiveUsers: parseInt(row.total_active_users) || 0
    },

    // Vertical Speed
    verticalSpeed: {
      fpm: parseInt(row.vertical_speed_fpm) || 0,
      trend: row.vertical_trend || 'level'
    },
    verticalSpeedInputs: {
      engagementDeltaPct: parseFloat(row.engagement_delta_pct) || 0,
      retentionDeltaPct: parseFloat(row.retention_delta_pct) || 0,
      sessionDepthDeltaPct: parseFloat(row.session_depth_delta_pct) || 0
    },

    // Heading
    heading: {
      degrees: parseInt(row.heading_degrees) || 0,
      deviation: parseInt(row.heading_deviation) || 0
    },
    usageDistribution: {
      prayer: parseFloat(row.usage_prayer_pct) || 0,
      listening: parseFloat(row.usage_listening_pct) || 0,
      scripture: parseFloat(row.usage_scripture_pct) || 0,
      community: parseFloat(row.usage_community_pct) || 0,
      discipleship: parseFloat(row.usage_discipleship_pct) || 0,
      other: parseFloat(row.usage_other_pct) || 0
    },
    targetDistribution: {
      prayer: parseFloat(row.target_prayer_pct) || 25,
      listening: parseFloat(row.target_listening_pct) || 20,
      scripture: parseFloat(row.target_scripture_pct) || 20,
      community: parseFloat(row.target_community_pct) || 20,
      discipleship: parseFloat(row.target_discipleship_pct) || 10,
      other: parseFloat(row.target_other_pct) || 5
    },

    // Engine Health
    engine: {
      fuel: parseInt(row.engine_fuel) || 100,
      fuelWarning: row.fuel_warning || false,
      fuelConsumptionRate: parseFloat(row.fuel_consumption_rate) || 0,

      stress: parseInt(row.engine_stress) || 0,
      stressWarning: row.stress_warning || false,
      unresolvedIssuesCount: parseInt(row.unresolved_issues_count) || 0,
      negativeSentimentSpikes: parseInt(row.negative_sentiment_spikes) || 0,

      friction: parseInt(row.engine_friction) || 0,
      frictionWarning: row.friction_warning || false,
      reworkRatePct: parseFloat(row.rework_rate_pct) || 0,
      processInefficiencyScore: parseFloat(row.process_inefficiency_score) || 0,

      rpm: parseInt(row.engine_rpm) || 0,
      rpmWarning: row.rpm_warning || false,
      concurrentListeningRooms: parseInt(row.concurrent_listening_rooms) || 0,
      concurrentAiSessions: parseInt(row.concurrent_ai_sessions) || 0,
      concurrentCommunityActivity: parseInt(row.concurrent_community_activity) || 0
    },

    // Overall Health
    overallHealthScore: parseInt(row.overall_health_score) || 50,
    healthStatus: row.health_status || 'nominal',
    alertsCount: parseInt(row.alerts_count) || 0,

    // Timestamps
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    calculatedAt: row.calculated_at
  };
}

/**
 * Get today's metrics (or create if not exists)
 */
async function getToday() {
  const today = new Date().toISOString().split('T')[0];

  let result = await database.query(
    'SELECT * FROM hospitality_daily_metrics WHERE metric_date = $1',
    [today]
  );

  if (result.rows.length === 0) {
    // Create today's record with defaults
    result = await database.query(`
      INSERT INTO hospitality_daily_metrics (id, metric_date)
      VALUES ($1, $2)
      RETURNING *
    `, [uuidv4(), today]);
  }

  return rowToMetrics(result.rows[0]);
}

/**
 * Get metrics for a specific date
 */
async function getByDate(date) {
  const result = await database.query(
    'SELECT * FROM hospitality_daily_metrics WHERE metric_date = $1',
    [date]
  );
  return rowToMetrics(result.rows[0]);
}

/**
 * Get metrics for date range (for trend analysis)
 */
async function getRange(startDate, endDate) {
  const result = await database.query(`
    SELECT * FROM hospitality_daily_metrics
    WHERE metric_date >= $1 AND metric_date <= $2
    ORDER BY metric_date ASC
  `, [startDate, endDate]);
  return result.rows.map(rowToMetrics);
}

/**
 * Get last N days of metrics
 */
async function getLastDays(days = 7) {
  const result = await database.query(`
    SELECT * FROM hospitality_daily_metrics
    WHERE metric_date >= CURRENT_DATE - $1
    ORDER BY metric_date DESC
  `, [days]);
  return result.rows.map(rowToMetrics);
}

/**
 * Update today's metrics with calculated values
 */
async function updateToday(metrics) {
  const today = new Date().toISOString().split('T')[0];

  // Ensure today's record exists
  await getToday();

  const result = await database.query(`
    UPDATE hospitality_daily_metrics SET
      -- Attitude
      attitude_pitch = $2,
      attitude_roll = $3,
      attitude_stability = $4,
      sentiment_score = $5,
      acceptance_rate = $6,
      negative_keyword_density = $7,
      drop_off_rate = $8,

      -- Altitude
      altitude_feet = $9,
      altitude_trend = $10,
      returning_users_7d_pct = $11,
      returning_users_30d_pct = $12,
      avg_sessions_per_user = $13,
      user_longevity_days = $14,

      -- Airspeed
      airspeed_knots = $15,
      airspeed_zone = $16,
      chat_interactions_per_user = $17,
      listening_sessions_per_user = $18,
      prayer_acceptances_per_user = $19,
      engagement_flows_completed = $20,
      total_active_users = $21,

      -- Vertical Speed
      vertical_speed_fpm = $22,
      vertical_trend = $23,
      engagement_delta_pct = $24,
      retention_delta_pct = $25,
      session_depth_delta_pct = $26,

      -- Heading
      heading_degrees = $27,
      heading_deviation = $28,
      usage_prayer_pct = $29,
      usage_listening_pct = $30,
      usage_scripture_pct = $31,
      usage_community_pct = $32,
      usage_discipleship_pct = $33,
      usage_other_pct = $34,

      -- Engine
      engine_fuel = $35,
      fuel_consumption_rate = $36,
      fuel_warning = $37,
      engine_stress = $38,
      unresolved_issues_count = $39,
      negative_sentiment_spikes = $40,
      stress_warning = $41,
      engine_friction = $42,
      rework_rate_pct = $43,
      process_inefficiency_score = $44,
      friction_warning = $45,
      engine_rpm = $46,
      concurrent_listening_rooms = $47,
      concurrent_ai_sessions = $48,
      concurrent_community_activity = $49,
      rpm_warning = $50,

      -- Overall
      overall_health_score = $51,
      health_status = $52,
      alerts_count = $53,
      calculated_at = NOW()
    WHERE metric_date = $1
    RETURNING *
  `, [
    today,
    metrics.attitude?.pitch || 0,
    metrics.attitude?.roll || 0,
    metrics.attitude?.stability || 'stable',
    metrics.attitudeInputs?.sentimentScore || 0,
    metrics.attitudeInputs?.acceptanceRate || 0,
    metrics.attitudeInputs?.negativeKeywordDensity || 0,
    metrics.attitudeInputs?.dropOffRate || 0,
    metrics.altitude?.feet || 0,
    metrics.altitude?.trend || 'level',
    metrics.altitudeInputs?.returningUsers7dPct || 0,
    metrics.altitudeInputs?.returningUsers30dPct || 0,
    metrics.altitudeInputs?.avgSessionsPerUser || 0,
    metrics.altitudeInputs?.userLongevityDays || 0,
    metrics.airspeed?.knots || 0,
    metrics.airspeed?.zone || 'cruise',
    metrics.airspeedInputs?.chatInteractionsPerUser || 0,
    metrics.airspeedInputs?.listeningSessionsPerUser || 0,
    metrics.airspeedInputs?.prayerAcceptancesPerUser || 0,
    metrics.airspeedInputs?.engagementFlowsCompleted || 0,
    metrics.airspeedInputs?.totalActiveUsers || 0,
    metrics.verticalSpeed?.fpm || 0,
    metrics.verticalSpeed?.trend || 'level',
    metrics.verticalSpeedInputs?.engagementDeltaPct || 0,
    metrics.verticalSpeedInputs?.retentionDeltaPct || 0,
    metrics.verticalSpeedInputs?.sessionDepthDeltaPct || 0,
    metrics.heading?.degrees || 0,
    metrics.heading?.deviation || 0,
    metrics.usageDistribution?.prayer || 0,
    metrics.usageDistribution?.listening || 0,
    metrics.usageDistribution?.scripture || 0,
    metrics.usageDistribution?.community || 0,
    metrics.usageDistribution?.discipleship || 0,
    metrics.usageDistribution?.other || 0,
    metrics.engine?.fuel || 100,
    metrics.engine?.fuelConsumptionRate || 0,
    metrics.engine?.fuelWarning || false,
    metrics.engine?.stress || 0,
    metrics.engine?.unresolvedIssuesCount || 0,
    metrics.engine?.negativeSentimentSpikes || 0,
    metrics.engine?.stressWarning || false,
    metrics.engine?.friction || 0,
    metrics.engine?.reworkRatePct || 0,
    metrics.engine?.processInefficiencyScore || 0,
    metrics.engine?.frictionWarning || false,
    metrics.engine?.rpm || 0,
    metrics.engine?.concurrentListeningRooms || 0,
    metrics.engine?.concurrentAiSessions || 0,
    metrics.engine?.concurrentCommunityActivity || 0,
    metrics.engine?.rpmWarning || false,
    metrics.overallHealthScore || 50,
    metrics.healthStatus || 'nominal',
    metrics.alertsCount || 0
  ]);

  return rowToMetrics(result.rows[0]);
}

/**
 * Get active alerts
 */
async function getActiveAlerts() {
  const result = await database.query(`
    SELECT * FROM hospitality_alerts
    WHERE is_active = TRUE
    ORDER BY severity DESC, created_at DESC
  `);
  return result.rows.map(row => ({
    id: row.id,
    metricDate: row.metric_date,
    alertType: row.alert_type,
    severity: row.severity,
    gaugeName: row.gauge_name,
    currentValue: parseFloat(row.current_value),
    thresholdValue: parseFloat(row.threshold_value),
    message: row.message,
    recommendation: row.recommendation,
    isActive: row.is_active,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at
  }));
}

/**
 * Create a new alert
 */
async function createAlert(alertData) {
  const today = new Date().toISOString().split('T')[0];
  const result = await database.query(`
    INSERT INTO hospitality_alerts (
      id, metric_date, alert_type, severity, gauge_name,
      current_value, threshold_value, message, recommendation
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    uuidv4(),
    today,
    alertData.alertType,
    alertData.severity || 'warning',
    alertData.gaugeName,
    alertData.currentValue,
    alertData.thresholdValue,
    alertData.message,
    alertData.recommendation
  ]);
  return result.rows[0];
}

/**
 * Acknowledge an alert
 */
async function acknowledgeAlert(alertId, userId) {
  const result = await database.query(`
    UPDATE hospitality_alerts
    SET acknowledged_at = NOW(), acknowledged_by = $2
    WHERE id = $1
    RETURNING *
  `, [alertId, userId]);
  return result.rows[0];
}

/**
 * Resolve an alert
 */
async function resolveAlert(alertId) {
  const result = await database.query(`
    UPDATE hospitality_alerts
    SET is_active = FALSE, resolved_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [alertId]);
  return result.rows[0];
}

/**
 * Get cockpit configuration
 */
async function getConfig() {
  const result = await database.query(`
    SELECT config_key, config_value FROM hospitality_cockpit_config
  `);

  const config = {};
  for (const row of result.rows) {
    config[row.config_key] = row.config_value;
  }
  return config;
}

/**
 * Update cockpit configuration
 */
async function updateConfig(key, value, userId) {
  const result = await database.query(`
    INSERT INTO hospitality_cockpit_config (id, config_key, config_value, updated_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (config_key)
    DO UPDATE SET config_value = $3, updated_at = NOW(), updated_by = $4
    RETURNING *
  `, [uuidv4(), key, JSON.stringify(value), userId]);
  return result.rows[0];
}

module.exports = {
  getToday,
  getByDate,
  getRange,
  getLastDays,
  updateToday,
  getActiveAlerts,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  getConfig,
  updateConfig
};
