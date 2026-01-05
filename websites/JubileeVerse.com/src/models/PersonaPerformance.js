/**
 * PersonaPerformance Model
 * Handles persona behavior metrics and engagement tracking
 *
 * PRIVACY ENFORCEMENT:
 * - All queries exclude private conversations
 * - Database triggers prevent insertion for private conversations
 *
 * PURPOSE:
 * - Track persona quality and safety response effectiveness
 * - Identify personas attracting disproportionate boundary testing
 * - Enable continuous improvement of persona design and prompts
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to persona performance object
 */
function rowToPerformance(row) {
  if (!row) return null;
  return {
    id: row.id,
    personaId: row.persona_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    userId: row.user_id,
    scores: {
      relatability: { score: row.relatability, confidence: row.relatability_confidence },
      friendliness: { score: row.friendliness, confidence: row.friendliness_confidence },
      boundaryClarity: { score: row.boundary_clarity, confidence: row.boundary_clarity_confidence },
      biblicalAlignment: { score: row.biblical_alignment, confidence: row.biblical_alignment_confidence },
      redirectionEffectiveness: { score: row.redirection_effectiveness, confidence: row.redirection_effectiveness_confidence },
      flirtationDeflection: row.flirtation_deflection,
      unsafeBehaviorDiscouragement: row.unsafe_behavior_discouragement,
      crisisResourceProvision: row.crisis_resource_provision,
      conversationSteering: row.conversation_steering
    },
    boundaryTest: {
      encountered: row.encountered_boundary_test,
      type: row.boundary_test_type,
      handledAppropriately: row.handled_boundary_appropriately
    },
    crisisSignal: {
      encountered: row.encountered_crisis_signal,
      type: row.crisis_type,
      responseAppropriate: row.crisis_response_appropriate
    },
    overallScore: row.overall_score,
    improvementAreas: row.improvement_areas || [],
    privacyVerifiedAt: row.privacy_verified_at,
    analysisVersion: row.analysis_version,
    modelUsed: row.model_used,
    createdAt: row.created_at
  };
}

/**
 * Convert database row to engagement metrics object
 */
function rowToEngagementMetrics(row) {
  if (!row) return null;
  return {
    id: row.id,
    personaId: row.persona_id,
    yearMonth: row.year_month,
    usage: {
      totalConversations: row.total_conversations,
      totalMessages: row.total_messages,
      uniqueUsers: row.unique_users,
      newUsers: row.new_users,
      returningUsers: row.returning_users
    },
    session: {
      avgDurationSeconds: row.avg_session_duration_seconds,
      medianDurationSeconds: row.median_session_duration_seconds,
      avgMessagesPerSession: row.avg_messages_per_session
    },
    returnRates: {
      sevenDay: row.return_rate_7day,
      thirtyDay: row.return_rate_30day
    },
    performance: {
      avgRelatability: row.avg_relatability,
      avgFriendliness: row.avg_friendliness,
      avgBoundaryClarity: row.avg_boundary_clarity,
      avgBiblicalAlignment: row.avg_biblical_alignment,
      avgRedirectionEffectiveness: row.avg_redirection_effectiveness,
      avgOverallScore: row.avg_overall_score
    },
    safety: {
      boundaryTestCount: row.boundary_test_count,
      flirtationAttemptCount: row.flirtation_attempt_count,
      romanticPursuitCount: row.romantic_pursuit_count,
      crisisSignalCount: row.crisis_signal_count,
      boundaryHandlingSuccessRate: row.boundary_handling_success_rate
    },
    flags: {
      disproportionateBoundaryTesting: row.disproportionate_boundary_testing,
      boundaryTestingRatio: row.boundary_testing_ratio,
      flaggedForReview: row.flagged_for_review,
      reviewReason: row.review_reason
    },
    isFinalized: row.is_finalized,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    personaName: row.persona_name,
    personaSlug: row.persona_slug
  };
}

/**
 * Create a new persona performance record
 * PRIVACY: Database trigger blocks if conversation is private
 */
async function create(perfData) {
  const id = uuidv4();
  const scores = perfData.scores || {};
  const boundaryTest = perfData.boundaryTest || {};
  const crisisSignal = perfData.crisisSignal || {};

  try {
    const result = await database.query(`
      INSERT INTO persona_performance (
        id, persona_id, conversation_id, message_id, user_id,
        relatability, relatability_confidence,
        friendliness, friendliness_confidence,
        boundary_clarity, boundary_clarity_confidence,
        biblical_alignment, biblical_alignment_confidence,
        redirection_effectiveness, redirection_effectiveness_confidence,
        flirtation_deflection, unsafe_behavior_discouragement, crisis_resource_provision,
        conversation_steering,
        encountered_boundary_test, boundary_test_type, handled_boundary_appropriately,
        encountered_crisis_signal, crisis_type, crisis_response_appropriate,
        overall_score, improvement_areas,
        analysis_version, model_used, privacy_verified_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, NOW()
      )
      RETURNING *
    `, [
      id,
      perfData.personaId,
      perfData.conversationId,
      perfData.messageId || null,
      perfData.userId,
      scores.relatability?.score || null,
      scores.relatability?.confidence || null,
      scores.friendliness?.score || null,
      scores.friendliness?.confidence || null,
      scores.boundaryClarity?.score || null,
      scores.boundaryClarity?.confidence || null,
      scores.biblicalAlignment?.score || null,
      scores.biblicalAlignment?.confidence || null,
      scores.redirectionEffectiveness?.score || null,
      scores.redirectionEffectiveness?.confidence || null,
      scores.flirtationDeflection || null,
      scores.unsafeBehaviorDiscouragement || null,
      scores.crisisResourceProvision || null,
      scores.conversationSteering || null,
      boundaryTest.encountered || false,
      boundaryTest.type || null,
      boundaryTest.handledAppropriately,
      crisisSignal.encountered || false,
      crisisSignal.type || null,
      crisisSignal.responseAppropriate,
      perfData.overallScore || null,
      JSON.stringify(perfData.improvementAreas || []),
      perfData.analysisVersion || '1.0',
      perfData.modelUsed || null
    ]);

    return rowToPerformance(result.rows[0]);

  } catch (error) {
    if (error.message.includes('private conversations')) {
      return null;
    }
    throw error;
  }
}

/**
 * Find performance record by ID
 */
async function findById(performanceId) {
  const result = await database.query(`
    SELECT pp.*
    FROM persona_performance pp
    JOIN conversations c ON pp.conversation_id = c.id
    WHERE pp.id = $1 AND c.is_private = FALSE
  `, [performanceId]);

  return rowToPerformance(result.rows[0]);
}

/**
 * Find performance records by persona ID
 * PRIVACY: Excludes private conversations
 */
async function findByPersonaId(personaId, options = {}) {
  const { limit = 100, offset = 0, startDate = null, endDate = null } = options;

  let query = `
    SELECT pp.*
    FROM persona_performance pp
    JOIN conversations c ON pp.conversation_id = c.id
    WHERE pp.persona_id = $1 AND c.is_private = FALSE
  `;
  const params = [personaId];
  let paramIndex = 2;

  if (startDate) {
    query += ` AND pp.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND pp.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  query += ` ORDER BY pp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToPerformance);
}

/**
 * Get aggregated scores for a persona
 * PRIVACY: Excludes private conversations
 */
async function getAggregatedScores(personaId, options = {}) {
  const { startDate = null, endDate = null } = options;

  let query = `
    SELECT
      COUNT(*) as sample_count,
      AVG(relatability) as avg_relatability,
      AVG(friendliness) as avg_friendliness,
      AVG(boundary_clarity) as avg_boundary_clarity,
      AVG(biblical_alignment) as avg_biblical_alignment,
      AVG(redirection_effectiveness) as avg_redirection_effectiveness,
      AVG(conversation_steering) as avg_conversation_steering,
      AVG(overall_score) as avg_overall_score,
      COUNT(*) FILTER (WHERE encountered_boundary_test = TRUE) as boundary_test_count,
      COUNT(*) FILTER (WHERE handled_boundary_appropriately = TRUE) as boundary_handled_well,
      COUNT(*) FILTER (WHERE encountered_crisis_signal = TRUE) as crisis_signal_count,
      COUNT(*) FILTER (WHERE crisis_response_appropriate = TRUE) as crisis_handled_well
    FROM persona_performance pp
    JOIN conversations c ON pp.conversation_id = c.id
    WHERE pp.persona_id = $1 AND c.is_private = FALSE
  `;
  const params = [personaId];
  let paramIndex = 2;

  if (startDate) {
    query += ` AND pp.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND pp.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  const result = await database.query(query, params);
  return result.rows[0];
}

/**
 * Get boundary test records for a persona
 * PRIVACY: Excludes private conversations
 */
async function getBoundaryTests(personaId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const result = await database.query(`
    SELECT pp.*
    FROM persona_performance pp
    JOIN conversations c ON pp.conversation_id = c.id
    WHERE pp.persona_id = $1
      AND pp.encountered_boundary_test = TRUE
      AND c.is_private = FALSE
    ORDER BY pp.created_at DESC
    LIMIT $2 OFFSET $3
  `, [personaId, limit, offset]);

  return result.rows.map(rowToPerformance);
}

/**
 * Get engagement metrics for a persona and month
 */
async function getEngagementMetrics(personaId, yearMonth) {
  const result = await database.query(`
    SELECT pem.*, p.name as persona_name, p.slug as persona_slug
    FROM persona_engagement_metrics pem
    JOIN personas p ON pem.persona_id = p.id
    WHERE pem.persona_id = $1 AND pem.year_month = $2
  `, [personaId, yearMonth]);

  return rowToEngagementMetrics(result.rows[0]);
}

/**
 * Get engagement metrics history for a persona
 */
async function getEngagementHistory(personaId, months = 12) {
  const result = await database.query(`
    SELECT pem.*, p.name as persona_name, p.slug as persona_slug
    FROM persona_engagement_metrics pem
    JOIN personas p ON pem.persona_id = p.id
    WHERE pem.persona_id = $1
    ORDER BY pem.year_month DESC
    LIMIT $2
  `, [personaId, months]);

  return result.rows.map(rowToEngagementMetrics);
}

/**
 * Get personas flagged for review
 */
async function getFlaggedPersonas() {
  const result = await database.query(`
    SELECT pem.*, p.name as persona_name, p.slug as persona_slug
    FROM persona_engagement_metrics pem
    JOIN personas p ON pem.persona_id = p.id
    WHERE pem.flagged_for_review = TRUE
      AND pem.is_finalized = FALSE
    ORDER BY pem.boundary_testing_ratio DESC
  `);

  return result.rows.map(rowToEngagementMetrics);
}

/**
 * Get personas by boundary testing ratio
 */
async function getPersonasByBoundaryTesting(yearMonth, threshold = 1.5) {
  const result = await database.query(`
    SELECT pem.*, p.name as persona_name, p.slug as persona_slug
    FROM persona_engagement_metrics pem
    JOIN personas p ON pem.persona_id = p.id
    WHERE pem.year_month = $1
      AND pem.boundary_testing_ratio >= $2
    ORDER BY pem.boundary_testing_ratio DESC
  `, [yearMonth, threshold]);

  return result.rows.map(rowToEngagementMetrics);
}

/**
 * Calculate and update engagement metrics for a persona
 */
async function calculateEngagementMetrics(personaId, yearMonth) {
  try {
    await database.query(
      'SELECT aggregate_persona_engagement($1, $2)',
      [personaId, yearMonth]
    );

    return await getEngagementMetrics(personaId, yearMonth);

  } catch (error) {
    throw error;
  }
}

/**
 * Finalize engagement metrics for a month
 */
async function finalizeMonth(yearMonth) {
  const result = await database.query(`
    UPDATE persona_engagement_metrics
    SET is_finalized = TRUE, finalized_at = NOW(), updated_at = NOW()
    WHERE year_month = $1 AND is_finalized = FALSE
    RETURNING persona_id
  `, [yearMonth]);

  return { count: result.rowCount, personaIds: result.rows.map(r => r.persona_id) };
}

/**
 * Get platform-wide boundary testing average
 */
async function getPlatformBoundaryTestingRate(yearMonth) {
  const result = await database.query(`
    SELECT
      SUM(boundary_test_count)::DECIMAL / NULLIF(SUM(total_conversations), 0) as rate
    FROM persona_engagement_metrics
    WHERE year_month = $1
  `, [yearMonth]);

  return result.rows[0]?.rate || 0;
}

/**
 * Get improvement recommendations for a persona
 */
async function getImprovementRecommendations(personaId, options = {}) {
  const { limit = 10 } = options;

  // Get common improvement areas from recent performance records
  const result = await database.query(`
    SELECT
      jsonb_array_elements_text(improvement_areas) as area,
      COUNT(*) as frequency
    FROM persona_performance pp
    JOIN conversations c ON pp.conversation_id = c.id
    WHERE pp.persona_id = $1
      AND c.is_private = FALSE
      AND pp.improvement_areas IS NOT NULL
      AND pp.improvement_areas != '[]'::jsonb
    GROUP BY area
    ORDER BY frequency DESC
    LIMIT $2
  `, [personaId, limit]);

  return result.rows;
}

/**
 * Compare persona performance against platform average
 */
async function compareToAverage(personaId, yearMonth) {
  const result = await database.query(`
    WITH persona_stats AS (
      SELECT * FROM persona_engagement_metrics WHERE persona_id = $1 AND year_month = $2
    ),
    platform_stats AS (
      SELECT
        AVG(avg_overall_score) as platform_avg_score,
        AVG(boundary_handling_success_rate) as platform_boundary_success,
        AVG(boundary_testing_ratio) as platform_boundary_ratio
      FROM persona_engagement_metrics
      WHERE year_month = $2
    )
    SELECT
      ps.*,
      plt.platform_avg_score,
      plt.platform_boundary_success,
      plt.platform_boundary_ratio,
      ps.avg_overall_score - plt.platform_avg_score as score_vs_average,
      ps.boundary_handling_success_rate - plt.platform_boundary_success as boundary_success_vs_average
    FROM persona_stats ps
    CROSS JOIN platform_stats plt
  `, [personaId, yearMonth]);

  return result.rows[0];
}

module.exports = {
  // Core CRUD
  create,
  findById,
  findByPersonaId,

  // Aggregations
  getAggregatedScores,
  getBoundaryTests,

  // Engagement metrics
  getEngagementMetrics,
  getEngagementHistory,
  calculateEngagementMetrics,
  finalizeMonth,

  // Safety analysis
  getFlaggedPersonas,
  getPersonasByBoundaryTesting,
  getPlatformBoundaryTestingRate,

  // Improvement
  getImprovementRecommendations,
  compareToAverage
};
