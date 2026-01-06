/**
 * HospitalityCockpitService
 * Calculates and manages hospitality dashboard "cockpit" metrics
 * using flight-instrument metaphors for situational awareness
 */

const database = require('../database');
const HospitalityCockpit = require('../models/HospitalityCockpit');
const logger = require('../utils/logger');

/**
 * Calculate attitude indicator (primary gauge)
 * Represents overall user mood, trust, and hospitality balance
 * Pitch: -90 (nose down/frustration) to +90 (nose up/satisfaction)
 * Roll: -45 to +45 (segment polarization)
 */
async function calculateAttitude() {
  try {
    // Get sentiment from recent messages (last 24 hours)
    const sentimentResult = await database.query(`
      SELECT
        AVG(CASE
          WHEN content ILIKE '%thank%' OR content ILIKE '%bless%' OR content ILIKE '%grateful%'
            OR content ILIKE '%love%' OR content ILIKE '%amazing%' OR content ILIKE '%wonderful%'
          THEN 50
          WHEN content ILIKE '%help%' OR content ILIKE '%please%' OR content ILIKE '%pray%'
          THEN 20
          WHEN content ILIKE '%frustrat%' OR content ILIKE '%confus%' OR content ILIKE '%angry%'
            OR content ILIKE '%hate%' OR content ILIKE '%wrong%' OR content ILIKE '%broken%'
          THEN -50
          ELSE 0
        END) as sentiment_score,
        COUNT(*) FILTER (WHERE content ILIKE '%frustrat%' OR content ILIKE '%confus%'
          OR content ILIKE '%angry%' OR content ILIKE '%hate%') * 1.0 / NULLIF(COUNT(*), 0) as negative_density
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND type = 'user'
    `);

    // Get hospitality action acceptance rate
    const acceptanceResult = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE outcome IN ('clicked', 'converted')) * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE outcome != 'pending'), 0) as acceptance_rate
      FROM hospitality_actions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    // Get drop-off rate (users who left within 30 seconds of a key action)
    const dropOffResult = await database.query(`
      SELECT
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'page_exit'
          AND metric_value < 30) * 100.0 /
          NULLIF(COUNT(DISTINCT session_id), 0) as drop_off_rate
      FROM hospitality_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const sentimentScore = parseFloat(sentimentResult.rows[0]?.sentiment_score) || 0;
    const negativeDensity = parseFloat(sentimentResult.rows[0]?.negative_density) || 0;
    const acceptanceRate = parseFloat(acceptanceResult.rows[0]?.acceptance_rate) || 50;
    const dropOffRate = parseFloat(dropOffResult.rows[0]?.drop_off_rate) || 10;

    // Calculate pitch using weighted formula
    // Sentiment: 40%, Acceptance: 30%, Negative density: 15%, Drop-off: 15%
    const pitch = Math.max(-90, Math.min(90,
      (sentimentScore * 0.36) +
      (acceptanceRate * 0.27) -
      (negativeDensity * 100 * 0.135) -
      (dropOffRate * 0.135)
    ));

    // Roll represents segment polarization (simplified for now)
    const roll = 0; // Would need more sophisticated segment analysis

    // Determine stability based on variance
    let stability = 'stable';
    if (Math.abs(pitch) > 60) stability = 'turbulent';
    else if (Math.abs(pitch) > 30) stability = 'unstable';
    else if (Math.abs(pitch) < 15) stability = 'smooth';

    return {
      attitude: { pitch: Math.round(pitch * 100) / 100, roll, stability },
      attitudeInputs: {
        sentimentScore: Math.round(sentimentScore * 100) / 100,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        negativeKeywordDensity: Math.round(negativeDensity * 10000) / 10000,
        dropOffRate: Math.round(dropOffRate * 100) / 100
      }
    };
  } catch (error) {
    logger.error('Error calculating attitude:', error);
    return {
      attitude: { pitch: 0, roll: 0, stability: 'stable' },
      attitudeInputs: { sentimentScore: 0, acceptanceRate: 50, negativeKeywordDensity: 0, dropOffRate: 10 }
    };
  }
}

/**
 * Calculate altimeter (retention altitude)
 * 0-40,000 feet representing engagement sustainability
 */
async function calculateAltitude() {
  try {
    // Get 7-day returning user percentage
    const return7dResult = await database.query(`
      SELECT
        COUNT(DISTINCT user_id) FILTER (WHERE
          user_id IN (
            SELECT user_id FROM hospitality_events
            WHERE created_at >= NOW() - INTERVAL '14 days'
              AND created_at < NOW() - INTERVAL '7 days'
          )
        ) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0) as return_rate
      FROM hospitality_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND user_id IS NOT NULL
    `);

    // Get 30-day returning user percentage
    const return30dResult = await database.query(`
      SELECT
        COUNT(DISTINCT user_id) FILTER (WHERE
          user_id IN (
            SELECT user_id FROM hospitality_events
            WHERE created_at >= NOW() - INTERVAL '60 days'
              AND created_at < NOW() - INTERVAL '30 days'
          )
        ) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0) as return_rate
      FROM hospitality_events
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND user_id IS NOT NULL
    `);

    // Get average sessions per user
    const sessionsResult = await database.query(`
      SELECT AVG(session_count) as avg_sessions
      FROM hospitality_user_state
      WHERE last_activity_at >= NOW() - INTERVAL '7 days'
    `);

    // Get user longevity (average days since first visit)
    const longevityResult = await database.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as avg_days
      FROM hospitality_user_state
      WHERE last_activity_at >= NOW() - INTERVAL '30 days'
    `);

    const return7d = parseFloat(return7dResult.rows[0]?.return_rate) || 30;
    const return30d = parseFloat(return30dResult.rows[0]?.return_rate) || 20;
    const avgSessions = parseFloat(sessionsResult.rows[0]?.avg_sessions) || 2;
    const longevity = parseFloat(longevityResult.rows[0]?.avg_days) || 30;

    // Calculate altitude (0-40,000 feet)
    const altitude = Math.min(40000, Math.round(
      (return7d * 120) +
      (return30d * 120) +
      (Math.min(avgSessions, 10) * 800) +
      (Math.min(longevity, 365) / 365 * 8000)
    ));

    // Determine trend based on week-over-week change
    let trend = 'level';
    // Would need historical comparison for actual trend

    return {
      altitude: { feet: altitude, trend },
      altitudeInputs: {
        returningUsers7dPct: Math.round(return7d * 100) / 100,
        returningUsers30dPct: Math.round(return30d * 100) / 100,
        avgSessionsPerUser: Math.round(avgSessions * 100) / 100,
        userLongevityDays: Math.round(longevity * 100) / 100
      }
    };
  } catch (error) {
    logger.error('Error calculating altitude:', error);
    return {
      altitude: { feet: 10000, trend: 'level' },
      altitudeInputs: { returningUsers7dPct: 30, returningUsers30dPct: 20, avgSessionsPerUser: 2, userLongevityDays: 30 }
    };
  }
}

/**
 * Calculate airspeed (engagement velocity)
 * Rate of meaningful hospitality actions per time unit
 */
async function calculateAirspeed() {
  try {
    // Get chat interactions per active user
    const chatResult = await database.query(`
      SELECT
        COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT user_id), 0) as per_user
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND type = 'user'
        AND user_id IS NOT NULL
    `);

    // Get listening sessions per user (from hospitality events)
    const listeningResult = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'listening_start') * 1.0 /
          NULLIF(COUNT(DISTINCT user_id), 0) as per_user
      FROM hospitality_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND user_id IS NOT NULL
    `);

    // Get prayer acceptances per user
    const prayerResult = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE action_type = 'persona_message' AND outcome = 'clicked') * 1.0 /
          NULLIF(COUNT(DISTINCT user_id), 0) as per_user
      FROM hospitality_actions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND user_id IS NOT NULL
    `);

    // Get total active users
    const activeUsersResult = await database.query(`
      SELECT COUNT(DISTINCT user_id) as total
      FROM hospitality_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND user_id IS NOT NULL
    `);

    const chatPerUser = parseFloat(chatResult.rows[0]?.per_user) || 3;
    const listeningPerUser = parseFloat(listeningResult.rows[0]?.per_user) || 0.5;
    const prayerPerUser = parseFloat(prayerResult.rows[0]?.per_user) || 0.2;
    const activeUsers = parseInt(activeUsersResult.rows[0]?.total) || 100;

    // Calculate raw velocity and normalize
    const rawVelocity = (chatPerUser * 10) + (listeningPerUser * 25) + (prayerPerUser * 15);
    const airspeed = Math.min(500, Math.max(0, Math.round(rawVelocity * 5)));

    // Determine zone
    let zone = 'cruise';
    if (airspeed < 50) zone = 'stall';
    else if (airspeed < 100) zone = 'slow';
    else if (airspeed > 400) zone = 'overspeed';
    else if (airspeed > 300) zone = 'fast';

    return {
      airspeed: { knots: airspeed, zone },
      airspeedInputs: {
        chatInteractionsPerUser: Math.round(chatPerUser * 100) / 100,
        listeningSessionsPerUser: Math.round(listeningPerUser * 100) / 100,
        prayerAcceptancesPerUser: Math.round(prayerPerUser * 100) / 100,
        engagementFlowsCompleted: 0,
        totalActiveUsers: activeUsers
      }
    };
  } catch (error) {
    logger.error('Error calculating airspeed:', error);
    return {
      airspeed: { knots: 150, zone: 'cruise' },
      airspeedInputs: { chatInteractionsPerUser: 3, listeningSessionsPerUser: 0.5, prayerAcceptancesPerUser: 0.2, engagementFlowsCompleted: 0, totalActiveUsers: 100 }
    };
  }
}

/**
 * Calculate vertical speed (engagement trend)
 * -2000 to +2000 fpm indicating improving or declining engagement
 */
async function calculateVerticalSpeed() {
  try {
    // Get this week's vs last week's engagement counts
    const trendResult = await database.query(`
      WITH this_week AS (
        SELECT COUNT(*) as count
        FROM hospitality_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
      ),
      last_week AS (
        SELECT COUNT(*) as count
        FROM hospitality_events
        WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days'
      )
      SELECT
        this_week.count as this_week,
        last_week.count as last_week,
        CASE
          WHEN last_week.count > 0
          THEN ((this_week.count - last_week.count) * 100.0 / last_week.count)
          ELSE 0
        END as delta_pct
      FROM this_week, last_week
    `);

    const thisWeek = parseInt(trendResult.rows[0]?.this_week) || 100;
    const lastWeek = parseInt(trendResult.rows[0]?.last_week) || 100;
    const deltaPct = parseFloat(trendResult.rows[0]?.delta_pct) || 0;

    // Map delta percentage to vertical speed (-2000 to +2000 fpm)
    // ±100% change = ±2000 fpm
    const fpm = Math.max(-2000, Math.min(2000, Math.round(deltaPct * 20)));

    // Determine trend
    let trend = 'level';
    if (fpm < -1000) trend = 'dive';
    else if (fpm < -200) trend = 'descent';
    else if (fpm > 1000) trend = 'rapid_climb';
    else if (fpm > 200) trend = 'climb';

    return {
      verticalSpeed: { fpm, trend },
      verticalSpeedInputs: {
        engagementDeltaPct: Math.round(deltaPct * 100) / 100,
        retentionDeltaPct: 0, // Would need separate calculation
        sessionDepthDeltaPct: 0
      }
    };
  } catch (error) {
    logger.error('Error calculating vertical speed:', error);
    return {
      verticalSpeed: { fpm: 0, trend: 'level' },
      verticalSpeedInputs: { engagementDeltaPct: 0, retentionDeltaPct: 0, sessionDepthDeltaPct: 0 }
    };
  }
}

/**
 * Calculate heading (strategic alignment)
 * 0-360 degrees indicating direction of user behavior
 */
async function calculateHeading() {
  try {
    // Get usage distribution from events
    const usageResult = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type ILIKE '%pray%') as prayer,
        COUNT(*) FILTER (WHERE event_type ILIKE '%listen%') as listening,
        COUNT(*) FILTER (WHERE event_type ILIKE '%scripture%' OR event_type ILIKE '%bible%') as scripture,
        COUNT(*) FILTER (WHERE event_type ILIKE '%communit%' OR event_type ILIKE '%board%') as community,
        COUNT(*) FILTER (WHERE event_type ILIKE '%disciple%' OR event_type ILIKE '%study%') as discipleship,
        COUNT(*) as total
      FROM hospitality_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const row = usageResult.rows[0];
    const total = parseInt(row?.total) || 1;

    const actual = {
      prayer: (parseInt(row?.prayer) || 0) * 100 / total,
      listening: (parseInt(row?.listening) || 0) * 100 / total,
      scripture: (parseInt(row?.scripture) || 0) * 100 / total,
      community: (parseInt(row?.community) || 0) * 100 / total,
      discipleship: (parseInt(row?.discipleship) || 0) * 100 / total
    };
    actual.other = 100 - actual.prayer - actual.listening - actual.scripture - actual.community - actual.discipleship;

    // Target distribution (from config or defaults)
    const target = { prayer: 25, listening: 20, scripture: 20, community: 20, discipleship: 10, other: 5 };

    // Calculate deviation (sum of absolute differences)
    const deviation = Math.abs(actual.prayer - target.prayer) +
                      Math.abs(actual.listening - target.listening) +
                      Math.abs(actual.scripture - target.scripture) +
                      Math.abs(actual.community - target.community) +
                      Math.abs(actual.discipleship - target.discipleship);

    // Map deviation to heading (0 = on course, deviation creates drift)
    // Heading of 360/0 = perfect alignment
    const heading = Math.round(360 - Math.min(180, deviation * 2));
    const headingDeviation = Math.round(deviation);

    return {
      heading: { degrees: heading >= 360 ? 0 : heading, deviation: headingDeviation },
      usageDistribution: {
        prayer: Math.round(actual.prayer * 100) / 100,
        listening: Math.round(actual.listening * 100) / 100,
        scripture: Math.round(actual.scripture * 100) / 100,
        community: Math.round(actual.community * 100) / 100,
        discipleship: Math.round(actual.discipleship * 100) / 100,
        other: Math.round(actual.other * 100) / 100
      },
      targetDistribution: target
    };
  } catch (error) {
    logger.error('Error calculating heading:', error);
    return {
      heading: { degrees: 0, deviation: 0 },
      usageDistribution: { prayer: 20, listening: 20, scripture: 20, community: 20, discipleship: 10, other: 10 },
      targetDistribution: { prayer: 25, listening: 20, scripture: 20, community: 20, discipleship: 10, other: 5 }
    };
  }
}

/**
 * Calculate engine health gauges
 * Fuel, Stress, Friction, RPM
 */
async function calculateEngineHealth() {
  try {
    // Fuel: Estimate based on API usage remaining (simplified)
    const fuel = 75; // Would integrate with actual quota tracking

    // Stress: Based on unresolved issues and negative sentiment
    const stressResult = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE outcome = 'pending') as unresolved,
        COUNT(*) FILTER (WHERE outcome = 'dismissed') as dismissed
      FROM hospitality_actions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
    const unresolvedIssues = parseInt(stressResult.rows[0]?.unresolved) || 0;
    const stress = Math.min(100, unresolvedIssues * 5);

    // Friction: Based on task rework rate
    const frictionResult = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE workflow_status = 'rework') * 100.0 /
          NULLIF(COUNT(*), 0) as rework_rate
      FROM admin_tasks
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    const reworkRate = parseFloat(frictionResult.rows[0]?.rework_rate) || 5;
    const friction = Math.min(100, Math.round(reworkRate * 2));

    // RPM: Concurrent activity level
    const rpmResult = await database.query(`
      SELECT
        COUNT(DISTINCT user_id) as concurrent_users
      FROM hospitality_events
      WHERE created_at >= NOW() - INTERVAL '5 minutes'
    `);
    const concurrentUsers = parseInt(rpmResult.rows[0]?.concurrent_users) || 10;
    const rpm = Math.min(100, concurrentUsers * 2);

    return {
      engine: {
        fuel,
        fuelWarning: fuel < 30,
        fuelConsumptionRate: 2.5,
        stress,
        stressWarning: stress > 70,
        unresolvedIssuesCount: unresolvedIssues,
        negativeSentimentSpikes: 0,
        friction,
        frictionWarning: friction > 40,
        reworkRatePct: Math.round(reworkRate * 100) / 100,
        processInefficiencyScore: 0,
        rpm,
        rpmWarning: rpm > 80,
        concurrentListeningRooms: 0,
        concurrentAiSessions: concurrentUsers,
        concurrentCommunityActivity: 0
      }
    };
  } catch (error) {
    logger.error('Error calculating engine health:', error);
    return {
      engine: {
        fuel: 75, fuelWarning: false, fuelConsumptionRate: 2.5,
        stress: 20, stressWarning: false, unresolvedIssuesCount: 0, negativeSentimentSpikes: 0,
        friction: 10, frictionWarning: false, reworkRatePct: 5, processInefficiencyScore: 0,
        rpm: 30, rpmWarning: false, concurrentListeningRooms: 0, concurrentAiSessions: 10, concurrentCommunityActivity: 0
      }
    };
  }
}

/**
 * Calculate overall health score and status
 */
function calculateOverallHealth(metrics) {
  // Weighted average of all gauge health
  const attitudeHealth = 50 + (metrics.attitude?.pitch || 0) * 0.5; // 0-100
  const altitudeHealth = (metrics.altitude?.feet || 0) / 400; // 0-100
  const airspeedHealth = metrics.airspeed?.zone === 'cruise' ? 80 :
                         metrics.airspeed?.zone === 'slow' ? 50 :
                         metrics.airspeed?.zone === 'stall' ? 20 : 60;
  const vsiHealth = 50 + (metrics.verticalSpeed?.fpm || 0) / 40; // 0-100
  const headingHealth = 100 - (metrics.heading?.deviation || 0);
  const engineHealth = (
    (metrics.engine?.fuel || 75) +
    (100 - (metrics.engine?.stress || 20)) +
    (100 - (metrics.engine?.friction || 10)) +
    (100 - Math.abs((metrics.engine?.rpm || 30) - 50))
  ) / 4;

  const overall = Math.round(
    (attitudeHealth * 0.25) +
    (altitudeHealth * 0.15) +
    (airspeedHealth * 0.15) +
    (vsiHealth * 0.15) +
    (headingHealth * 0.10) +
    (engineHealth * 0.20)
  );

  let status = 'nominal';
  if (overall < 30) status = 'critical';
  else if (overall < 50) status = 'warning';
  else if (overall >= 75) status = 'optimal';

  return { overallHealthScore: Math.max(0, Math.min(100, overall)), healthStatus: status };
}

/**
 * Calculate all metrics and update today's record
 */
async function calculateAndUpdateMetrics() {
  logger.info('Calculating hospitality cockpit metrics...');

  const [attitude, altitude, airspeed, verticalSpeed, heading, engine] = await Promise.all([
    calculateAttitude(),
    calculateAltitude(),
    calculateAirspeed(),
    calculateVerticalSpeed(),
    calculateHeading(),
    calculateEngineHealth()
  ]);

  const metrics = {
    ...attitude,
    ...altitude,
    ...airspeed,
    ...verticalSpeed,
    ...heading,
    ...engine
  };

  const health = calculateOverallHealth(metrics);
  metrics.overallHealthScore = health.overallHealthScore;
  metrics.healthStatus = health.healthStatus;
  metrics.alertsCount = 0; // Would count from alerts table

  const updated = await HospitalityCockpit.updateToday(metrics);
  logger.info('Hospitality cockpit metrics updated', { health: health.healthStatus, score: health.overallHealthScore });

  return updated;
}

/**
 * Get current cockpit state (today's metrics or calculate if stale)
 */
async function getCockpitState() {
  let metrics = await HospitalityCockpit.getToday();

  // If metrics are stale (older than 5 minutes), recalculate
  if (!metrics.calculatedAt ||
      new Date() - new Date(metrics.calculatedAt) > 5 * 60 * 1000) {
    metrics = await calculateAndUpdateMetrics();
  }

  const alerts = await HospitalityCockpit.getActiveAlerts();
  const config = await HospitalityCockpit.getConfig();

  return {
    metrics,
    alerts,
    config,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  calculateAttitude,
  calculateAltitude,
  calculateAirspeed,
  calculateVerticalSpeed,
  calculateHeading,
  calculateEngineHealth,
  calculateOverallHealth,
  calculateAndUpdateMetrics,
  getCockpitState
};
