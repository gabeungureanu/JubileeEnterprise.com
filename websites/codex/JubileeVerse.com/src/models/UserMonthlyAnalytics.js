/**
 * UserMonthlyAnalytics Model
 * Handles monthly aggregated analytics per user
 * Part of the User Analytics and Intelligence System
 *
 * Extended with:
 * - Faith-spectrum aggregates (atheist, traditional, Acts-believer)
 * - Predictive indicator aggregates (subscription, benefit, retention, gospel)
 * - Deception tracking with trend analysis
 * - Denominational leaning aggregates
 * - Safeguarding alerts and risk aggregates
 * - Life-domain health aggregates
 * - Spiritual health indicators (prayer openness, faith-mindedness, etc.)
 * - Struggles, strengths, and spiritual gifts profiles
 * - Doctrinal posture and learning style summaries
 * - Trauma sensitivity and gentle approach flags
 * - Privacy enforcement (excludes private conversations)
 *
 * Version 3.0 - Extended spiritual demographics
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');
const ConversationAnalysis = require('./ConversationAnalysis');

/**
 * Convert database row to analytics object (snake_case to camelCase)
 */
function rowToAnalytics(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    yearMonth: row.year_month,

    // Activity
    totalMessages: parseInt(row.total_messages) || 0,
    totalConversations: parseInt(row.total_conversations) || 0,
    uniquePersonasUsed: parseInt(row.unique_personas_used) || 0,
    avgMessagesPerConversation: parseFloat(row.avg_messages_per_conversation) || 0,
    privateConversationsExcluded: parseInt(row.private_conversations_excluded) || 0,

    // Sentiment
    avgSentiment: parseFloat(row.avg_sentiment) || null,
    minSentiment: row.min_sentiment,
    maxSentiment: row.max_sentiment,
    sentimentTrend: row.sentiment_trend,

    // Emotions
    emotions: {
      avgConfusion: parseFloat(row.avg_confusion) || 0,
      avgHope: parseFloat(row.avg_hope) || 0,
      avgRelief: parseFloat(row.avg_relief) || 0,
      avgPressure: parseFloat(row.avg_pressure) || 0,
      avgSafety: parseFloat(row.avg_safety) || 0,
      avgJoy: parseFloat(row.avg_joy) || 0,
      avgGrief: parseFloat(row.avg_grief) || 0,
      avgAnxiety: parseFloat(row.avg_anxiety) || 0,
      avgPeace: parseFloat(row.avg_peace) || 0,
      avgFrustration: parseFloat(row.avg_frustration) || 0,
      dominant: row.dominant_emotion
    },

    // Five-Fold
    fiveFold: {
      avgApostle: parseFloat(row.avg_apostle) || 0,
      avgProphet: parseFloat(row.avg_prophet) || 0,
      avgEvangelist: parseFloat(row.avg_evangelist) || 0,
      avgPastor: parseFloat(row.avg_pastor) || 0,
      avgTeacher: parseFloat(row.avg_teacher) || 0,
      dominant: row.dominant_fivefold
    },

    // MBTI
    mbti: {
      avgEI: parseFloat(row.avg_e_i) || 50,
      avgSN: parseFloat(row.avg_s_n) || 50,
      avgTF: parseFloat(row.avg_t_f) || 50,
      avgJP: parseFloat(row.avg_j_p) || 50,
      likelyType: row.likely_mbti_type
    },

    // Faith-Spectrum
    faithSpectrum: {
      avgAtheist: parseFloat(row.avg_faith_atheist) || 0,
      avgTraditional: parseFloat(row.avg_faith_traditional) || 0,
      avgActsBeliever: parseFloat(row.avg_faith_acts_believer) || 0
    },

    // Predictive Indicators
    predictive: {
      avgSubscribeLikelihood: parseFloat(row.avg_subscribe_likelihood) || 50,
      avgBenefitLikelihood: parseFloat(row.avg_benefit_likelihood) || 50,
      avgRetentionLikelihood: parseFloat(row.avg_retention_likelihood) || 50,
      avgGospelAdoption: parseFloat(row.avg_gospel_adoption) || 50,
      avgDeceptionIndex: parseFloat(row.avg_deception_index) || 0,
      deceptionTrend: row.deception_trend || 'stable'
    },

    // Denominational Leanings
    denominationalLeanings: row.denominational_leanings || {},
    dominantDenominationalLeaning: row.dominant_denominational_leaning,

    // Safeguarding
    safeguarding: {
      avgCultRisk: parseFloat(row.avg_cult_risk) || 0,
      maxCultRisk: row.max_cult_risk || 0,
      avgCultSusceptibility: parseFloat(row.avg_cult_susceptibility) || 0,
      alerts: row.safeguarding_alerts || []
    },

    // Life-Domain Health
    lifeDomains: {
      avgFinancialHealth: row.avg_financial_health !== null ? parseFloat(row.avg_financial_health) : null,
      avgFamilyHealth: row.avg_family_health !== null ? parseFloat(row.avg_family_health) : null,
      avgMarriageHealth: row.avg_marriage_health !== null ? parseFloat(row.avg_marriage_health) : null,
      avgParentingHealth: row.avg_parenting_health !== null ? parseFloat(row.avg_parenting_health) : null,
      avgSocialHealth: row.avg_social_health !== null ? parseFloat(row.avg_social_health) : null,
      avgEmotionalResilience: row.avg_emotional_resilience !== null ? parseFloat(row.avg_emotional_resilience) : null
    },
    domainsAnalyzed: row.domains_analyzed || {},

    // === NEW FIELDS (Migration 056) ===

    // Spiritual Health Indicators
    spiritualHealth: {
      avgPrayerOpenness: row.avg_prayer_openness !== null ? parseFloat(row.avg_prayer_openness) : null,
      avgFaithMindedness: row.avg_faith_mindedness !== null ? parseFloat(row.avg_faith_mindedness) : null,
      avgWorldlinessIndex: row.avg_worldliness_index !== null ? parseFloat(row.avg_worldliness_index) : null,
      avgScriptureLiteracy: row.avg_scripture_literacy !== null ? parseFloat(row.avg_scripture_literacy) : null,
      avgMaturityLevel: row.avg_maturity_level !== null ? parseFloat(row.avg_maturity_level) : null,
      avgDiscipleshipReadiness: row.avg_discipleship_readiness !== null ? parseFloat(row.avg_discipleship_readiness) : null,
      avgForgivenessPosture: row.avg_forgiveness_posture !== null ? parseFloat(row.avg_forgiveness_posture) : null,
      avgIsolationRisk: row.avg_isolation_risk !== null ? parseFloat(row.avg_isolation_risk) : null,
      avgConflictPosture: row.avg_conflict_posture !== null ? parseFloat(row.avg_conflict_posture) : null
    },

    // Struggles and Strengths
    topStruggles: row.top_struggles || [],
    topStrengths: row.top_strengths || [],
    spiritualGiftsProfile: row.spiritual_gifts_profile || [],

    // Doctrinal and Learning
    doctrinalPostureSummary: row.doctrinal_posture_summary || {},
    learningStyleSummary: row.learning_style_summary || {},
    spiritualPracticesSummary: row.spiritual_practices_summary || [],

    // Sensitivity Flags
    traumaSensitivityFlagged: row.trauma_sensitivity_flagged || false,
    gentleApproachRecommended: row.gentle_approach_recommended || false,

    // Inferred Languages
    inferredLanguages: row.inferred_languages || {},

    // Dashboard composite scores
    engagementHealth: parseFloat(row.engagement_health) || 50,
    loyaltyScore: parseFloat(row.loyalty_score) || 50,
    growthScore: parseFloat(row.growth_score) || 50,
    satisfactionScore: parseFloat(row.satisfaction_score) || 50,

    // Insights
    topNeeds: row.top_needs || [],
    topChallenges: row.top_challenges || [],
    topTopics: row.top_topics || [],
    worldviewSummary: row.worldview_summary || {},
    personaAffinity: row.persona_affinity || {},

    // Metadata
    isFinalized: row.is_finalized,
    finalizedAt: row.finalized_at,
    lastCalculatedAt: row.last_calculated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Find analytics for a user and month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Object|null} Analytics record or null
 */
async function findByUserAndMonth(userId, yearMonth) {
  const result = await database.query(
    'SELECT * FROM user_monthly_analytics WHERE user_id = $1 AND year_month = $2',
    [userId, yearMonth]
  );
  return rowToAnalytics(result.rows[0]);
}

/**
 * Find all analytics for a user (most recent first)
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Array} List of analytics records
 */
async function findByUserId(userId, options = {}) {
  const { limit = 12, offset = 0 } = options;

  const result = await database.query(`
    SELECT * FROM user_monthly_analytics
    WHERE user_id = $1
    ORDER BY year_month DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return result.rows.map(rowToAnalytics);
}

/**
 * Determine dominant item from score object
 * @param {Object} scores - Object with score values
 * @returns {string} Key of highest scoring item
 */
function getDominant(scores) {
  const entries = Object.entries(scores).filter(([k, v]) => typeof v === 'number' && v > 0);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Derive MBTI type from average scores
 * @param {number} eI - E/I score (100=E, 0=I)
 * @param {number} sN - S/N score (100=S, 0=N)
 * @param {number} tF - T/F score (100=T, 0=F)
 * @param {number} jP - J/P score (100=J, 0=P)
 * @returns {string} 4-letter MBTI type
 */
function deriveMbtiType(eI, sN, tF, jP) {
  return [
    eI >= 50 ? 'E' : 'I',
    sN >= 50 ? 'S' : 'N',
    tF >= 50 ? 'T' : 'F',
    jP >= 50 ? 'J' : 'P'
  ].join('');
}

/**
 * Calculate composite dashboard scores
 * @param {Object} stats - Aggregated stats
 * @param {Object} previousMonth - Previous month's analytics (for trends)
 * @returns {Object} Composite scores
 */
function calculateCompositeScores(stats, previousMonth = null) {
  const avgSentiment = parseFloat(stats.avg_sentiment) || 50;
  const avgHope = parseFloat(stats.avg_hope) || 0;
  const avgPeace = parseFloat(stats.avg_peace) || 0;
  const avgAnxiety = parseFloat(stats.avg_anxiety) || 0;
  const avgPressure = parseFloat(stats.avg_pressure) || 0;
  const avgConfusion = parseFloat(stats.avg_confusion) || 0;
  const avgRelief = parseFloat(stats.avg_relief) || 0;
  const totalMessages = parseInt(stats.total_messages) || 0;
  const totalConversations = parseInt(stats.total_conversations) || 0;

  // Engagement Health: combination of activity and emotional balance
  const activityScore = Math.min(100, (totalMessages / 10) * 20 + (totalConversations / 5) * 30);
  const emotionalBalance = (avgHope + avgPeace + avgRelief) / 3 - (avgAnxiety + avgPressure + avgConfusion) / 3 + 50;
  const engagementHealth = Math.max(0, Math.min(100, (activityScore * 0.4 + emotionalBalance * 0.6)));

  // Loyalty Score: based on returning behavior
  const loyaltyScore = Math.min(100, totalConversations * 15 + 20);

  // Growth Score: positive movement indicators + gospel adoption potential + discipleship readiness
  const positiveEmotions = avgHope + avgPeace + avgRelief;
  const negativeEmotions = avgAnxiety + avgPressure + avgConfusion;
  const gospelAdoption = parseFloat(stats.avg_gospel_adoption) || 50;
  const discipleshipReadiness = parseFloat(stats.avg_discipleship_readiness) || 50;
  const growthScore = Math.max(0, Math.min(100,
    (50 + (positiveEmotions - negativeEmotions) / 6) * 0.5 + gospelAdoption * 0.25 + discipleshipReadiness * 0.25
  ));

  // Satisfaction Score: sentiment + relief vs pressure
  const satisfactionScore = Math.max(0, Math.min(100,
    avgSentiment * 0.5 + (avgRelief - avgPressure + 50) * 0.3 + (100 - avgConfusion) * 0.2
  ));

  // Determine sentiment trend if we have previous data
  let sentimentTrend = 'stable';
  if (previousMonth && previousMonth.avgSentiment !== null) {
    const diff = avgSentiment - previousMonth.avgSentiment;
    if (diff > 10) sentimentTrend = 'improving';
    else if (diff < -10) sentimentTrend = 'declining';
    else if (Math.abs(diff) <= 5) sentimentTrend = 'stable';
    else sentimentTrend = 'fluctuating';
  }

  // Determine deception trend
  let deceptionTrend = 'stable';
  const avgDeception = parseFloat(stats.avg_deception_index) || 0;
  if (previousMonth && previousMonth.predictive?.avgDeceptionIndex !== undefined) {
    const diff = avgDeception - previousMonth.predictive.avgDeceptionIndex;
    if (diff > 10) deceptionTrend = 'worsening';
    else if (diff < -10) deceptionTrend = 'improving';
    else if (Math.abs(diff) <= 5) deceptionTrend = 'stable';
    else deceptionTrend = 'fluctuating';
  }

  return {
    engagementHealth: Math.round(engagementHealth * 100) / 100,
    loyaltyScore: Math.round(loyaltyScore * 100) / 100,
    growthScore: Math.round(growthScore * 100) / 100,
    satisfactionScore: Math.round(satisfactionScore * 100) / 100,
    sentimentTrend,
    deceptionTrend
  };
}

/**
 * Calculate and upsert monthly analytics for a user
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Object|null} Updated analytics record or null if no data
 */
async function calculateAndUpsert(userId, yearMonth) {
  // Check if already finalized
  const existing = await findByUserAndMonth(userId, yearMonth);
  if (existing?.isFinalized) {
    console.log(`Skipping finalized month ${yearMonth} for user ${userId}`);
    return existing;
  }

  // Get aggregated stats from conversation_analysis (v3 with privacy exclusion)
  const stats = await ConversationAnalysis.getAggregatedStats(userId, yearMonth);

  if (!stats || stats.total_messages === '0' || parseInt(stats.total_messages) === 0) {
    console.log(`No data for month ${yearMonth} for user ${userId}`);
    return null;
  }

  // Get top insights
  const topNeeds = await ConversationAnalysis.getTopInsights(userId, yearMonth, 'primary_needs');
  const topChallenges = await ConversationAnalysis.getTopInsights(userId, yearMonth, 'primary_challenges');
  const topTopics = await ConversationAnalysis.getTopInsights(userId, yearMonth, 'dominant_topics');
  const personaAffinity = await ConversationAnalysis.getPersonaAffinity(userId, yearMonth);

  // Get safeguarding alerts
  const safeguardingAlerts = await ConversationAnalysis.getSafeguardingAlerts(userId, yearMonth);

  // Get struggles, strengths, and gifts
  const topStruggles = await ConversationAnalysis.getAggregatedStruggles(userId, yearMonth);
  const topStrengths = await ConversationAnalysis.getAggregatedStrengths(userId, yearMonth);
  const spiritualGiftsProfile = await ConversationAnalysis.getAggregatedGifts(userId, yearMonth);

  // Get inferred languages
  const inferredLanguages = await ConversationAnalysis.getInferredLanguages(userId, yearMonth);

  // Get previous month for trend calculation
  const prevMonth = getPreviousYearMonth(yearMonth);
  const previousMonthData = await findByUserAndMonth(userId, prevMonth);

  // Calculate composite scores
  const compositeScores = calculateCompositeScores(stats, previousMonthData);

  // Determine dominant emotion
  const emotionScores = {
    confusion: parseFloat(stats.avg_confusion) || 0,
    hope: parseFloat(stats.avg_hope) || 0,
    relief: parseFloat(stats.avg_relief) || 0,
    pressure: parseFloat(stats.avg_pressure) || 0,
    safety: parseFloat(stats.avg_safety) || 0,
    joy: parseFloat(stats.avg_joy) || 0,
    grief: parseFloat(stats.avg_grief) || 0,
    anxiety: parseFloat(stats.avg_anxiety) || 0,
    peace: parseFloat(stats.avg_peace) || 0,
    frustration: parseFloat(stats.avg_frustration) || 0
  };
  const dominantEmotion = getDominant(emotionScores);

  // Determine dominant Five-Fold gift
  const fivefoldScores = {
    apostle: parseFloat(stats.avg_apostle) || 0,
    prophet: parseFloat(stats.avg_prophet) || 0,
    evangelist: parseFloat(stats.avg_evangelist) || 0,
    pastor: parseFloat(stats.avg_pastor) || 0,
    teacher: parseFloat(stats.avg_teacher) || 0
  };
  const dominantFivefold = getDominant(fivefoldScores);

  // Derive MBTI type
  const mbtiType = deriveMbtiType(
    parseFloat(stats.avg_e_i) || 50,
    parseFloat(stats.avg_s_n) || 50,
    parseFloat(stats.avg_t_f) || 50,
    parseFloat(stats.avg_j_p) || 50
  );

  // Build denominational leanings object
  const denominationalLeanings = {
    baptist: parseFloat(stats.avg_baptist) || 0,
    pentecostal: parseFloat(stats.avg_pentecostal) || 0,
    catholic: parseFloat(stats.avg_catholic) || 0,
    reformed: parseFloat(stats.avg_reformed) || 0,
    charismatic: parseFloat(stats.avg_charismatic) || 0,
    orthodox: parseFloat(stats.avg_orthodox) || 0,
    nondenominational: parseFloat(stats.avg_nondenominational) || 0,
    mainline: parseFloat(stats.avg_mainline) || 0,
    messianic: parseFloat(stats.avg_messianic) || 0
  };
  const dominantDenominationalLeaning = getDominant(denominationalLeanings);

  // Build domains analyzed counts
  const domainsAnalyzed = {
    financial: parseInt(stats.financial_analyzed_count) || 0,
    family: parseInt(stats.family_analyzed_count) || 0,
    marriage: parseInt(stats.marriage_analyzed_count) || 0,
    parenting: parseInt(stats.parenting_analyzed_count) || 0,
    social: parseInt(stats.social_analyzed_count) || 0,
    resilience: parseInt(stats.resilience_analyzed_count) || 0
  };

  // Calculate average messages per conversation
  const totalMessages = parseInt(stats.total_messages) || 0;
  const totalConversations = parseInt(stats.total_conversations) || 0;
  const avgMsgPerConv = totalConversations > 0 ? totalMessages / totalConversations : 0;

  // Determine trauma and gentle approach flags
  const traumaSensitivityFlagged = stats.trauma_sensitivity_detected === true;
  const gentleApproachRecommended = traumaSensitivityFlagged || parseInt(stats.gentle_tone_recommended_count) > 0;

  // Private conversations excluded count
  const privateExcluded = parseInt(stats.private_excluded) || 0;

  const id = existing?.id || uuidv4();

  const result = await database.query(`
    INSERT INTO user_monthly_analytics (
      id, user_id, year_month,
      total_messages, total_conversations, unique_personas_used, avg_messages_per_conversation,
      private_conversations_excluded,
      avg_sentiment, min_sentiment, max_sentiment, sentiment_trend,
      avg_confusion, avg_hope, avg_relief, avg_pressure, avg_safety,
      avg_joy, avg_grief, avg_anxiety, avg_peace, avg_frustration, dominant_emotion,
      avg_apostle, avg_prophet, avg_evangelist, avg_pastor, avg_teacher, dominant_fivefold,
      avg_e_i, avg_s_n, avg_t_f, avg_j_p, likely_mbti_type,
      avg_faith_atheist, avg_faith_traditional, avg_faith_acts_believer,
      avg_subscribe_likelihood, avg_benefit_likelihood, avg_retention_likelihood,
      avg_gospel_adoption, avg_deception_index, deception_trend,
      denominational_leanings, dominant_denominational_leaning,
      avg_cult_risk, max_cult_risk, avg_cult_susceptibility, safeguarding_alerts,
      avg_financial_health, avg_family_health, avg_marriage_health,
      avg_parenting_health, avg_social_health, avg_emotional_resilience, domains_analyzed,
      avg_prayer_openness, avg_faith_mindedness, avg_worldliness_index,
      avg_scripture_literacy, avg_maturity_level, avg_discipleship_readiness,
      avg_forgiveness_posture, avg_isolation_risk, avg_conflict_posture,
      top_struggles, top_strengths, spiritual_gifts_profile,
      doctrinal_posture_summary, learning_style_summary, spiritual_practices_summary,
      trauma_sensitivity_flagged, gentle_approach_recommended, inferred_languages,
      engagement_health, loyalty_score, growth_score, satisfaction_score,
      top_needs, top_challenges, top_topics, persona_affinity,
      last_calculated_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
      $24, $25, $26, $27, $28, $29,
      $30, $31, $32, $33, $34,
      $35, $36, $37,
      $38, $39, $40, $41, $42, $43,
      $44, $45,
      $46, $47, $48, $49,
      $50, $51, $52, $53, $54, $55, $56,
      $57, $58, $59, $60, $61, $62, $63, $64, $65,
      $66, $67, $68, $69, $70, $71,
      $72, $73, $74,
      $75, $76, $77, $78,
      $79, $80, $81, $82,
      NOW()
    )
    ON CONFLICT (user_id, year_month) DO UPDATE SET
      total_messages = EXCLUDED.total_messages,
      total_conversations = EXCLUDED.total_conversations,
      unique_personas_used = EXCLUDED.unique_personas_used,
      avg_messages_per_conversation = EXCLUDED.avg_messages_per_conversation,
      private_conversations_excluded = EXCLUDED.private_conversations_excluded,
      avg_sentiment = EXCLUDED.avg_sentiment,
      min_sentiment = EXCLUDED.min_sentiment,
      max_sentiment = EXCLUDED.max_sentiment,
      sentiment_trend = EXCLUDED.sentiment_trend,
      avg_confusion = EXCLUDED.avg_confusion,
      avg_hope = EXCLUDED.avg_hope,
      avg_relief = EXCLUDED.avg_relief,
      avg_pressure = EXCLUDED.avg_pressure,
      avg_safety = EXCLUDED.avg_safety,
      avg_joy = EXCLUDED.avg_joy,
      avg_grief = EXCLUDED.avg_grief,
      avg_anxiety = EXCLUDED.avg_anxiety,
      avg_peace = EXCLUDED.avg_peace,
      avg_frustration = EXCLUDED.avg_frustration,
      dominant_emotion = EXCLUDED.dominant_emotion,
      avg_apostle = EXCLUDED.avg_apostle,
      avg_prophet = EXCLUDED.avg_prophet,
      avg_evangelist = EXCLUDED.avg_evangelist,
      avg_pastor = EXCLUDED.avg_pastor,
      avg_teacher = EXCLUDED.avg_teacher,
      dominant_fivefold = EXCLUDED.dominant_fivefold,
      avg_e_i = EXCLUDED.avg_e_i,
      avg_s_n = EXCLUDED.avg_s_n,
      avg_t_f = EXCLUDED.avg_t_f,
      avg_j_p = EXCLUDED.avg_j_p,
      likely_mbti_type = EXCLUDED.likely_mbti_type,
      avg_faith_atheist = EXCLUDED.avg_faith_atheist,
      avg_faith_traditional = EXCLUDED.avg_faith_traditional,
      avg_faith_acts_believer = EXCLUDED.avg_faith_acts_believer,
      avg_subscribe_likelihood = EXCLUDED.avg_subscribe_likelihood,
      avg_benefit_likelihood = EXCLUDED.avg_benefit_likelihood,
      avg_retention_likelihood = EXCLUDED.avg_retention_likelihood,
      avg_gospel_adoption = EXCLUDED.avg_gospel_adoption,
      avg_deception_index = EXCLUDED.avg_deception_index,
      deception_trend = EXCLUDED.deception_trend,
      denominational_leanings = EXCLUDED.denominational_leanings,
      dominant_denominational_leaning = EXCLUDED.dominant_denominational_leaning,
      avg_cult_risk = EXCLUDED.avg_cult_risk,
      max_cult_risk = EXCLUDED.max_cult_risk,
      avg_cult_susceptibility = EXCLUDED.avg_cult_susceptibility,
      safeguarding_alerts = EXCLUDED.safeguarding_alerts,
      avg_financial_health = EXCLUDED.avg_financial_health,
      avg_family_health = EXCLUDED.avg_family_health,
      avg_marriage_health = EXCLUDED.avg_marriage_health,
      avg_parenting_health = EXCLUDED.avg_parenting_health,
      avg_social_health = EXCLUDED.avg_social_health,
      avg_emotional_resilience = EXCLUDED.avg_emotional_resilience,
      domains_analyzed = EXCLUDED.domains_analyzed,
      avg_prayer_openness = EXCLUDED.avg_prayer_openness,
      avg_faith_mindedness = EXCLUDED.avg_faith_mindedness,
      avg_worldliness_index = EXCLUDED.avg_worldliness_index,
      avg_scripture_literacy = EXCLUDED.avg_scripture_literacy,
      avg_maturity_level = EXCLUDED.avg_maturity_level,
      avg_discipleship_readiness = EXCLUDED.avg_discipleship_readiness,
      avg_forgiveness_posture = EXCLUDED.avg_forgiveness_posture,
      avg_isolation_risk = EXCLUDED.avg_isolation_risk,
      avg_conflict_posture = EXCLUDED.avg_conflict_posture,
      top_struggles = EXCLUDED.top_struggles,
      top_strengths = EXCLUDED.top_strengths,
      spiritual_gifts_profile = EXCLUDED.spiritual_gifts_profile,
      doctrinal_posture_summary = EXCLUDED.doctrinal_posture_summary,
      learning_style_summary = EXCLUDED.learning_style_summary,
      spiritual_practices_summary = EXCLUDED.spiritual_practices_summary,
      trauma_sensitivity_flagged = EXCLUDED.trauma_sensitivity_flagged,
      gentle_approach_recommended = EXCLUDED.gentle_approach_recommended,
      inferred_languages = EXCLUDED.inferred_languages,
      engagement_health = EXCLUDED.engagement_health,
      loyalty_score = EXCLUDED.loyalty_score,
      growth_score = EXCLUDED.growth_score,
      satisfaction_score = EXCLUDED.satisfaction_score,
      top_needs = EXCLUDED.top_needs,
      top_challenges = EXCLUDED.top_challenges,
      top_topics = EXCLUDED.top_topics,
      persona_affinity = EXCLUDED.persona_affinity,
      last_calculated_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `, [
    id, userId, yearMonth,
    totalMessages, totalConversations, parseInt(stats.unique_personas) || 0, avgMsgPerConv,
    privateExcluded,
    stats.avg_sentiment, stats.min_sentiment, stats.max_sentiment, compositeScores.sentimentTrend,
    stats.avg_confusion, stats.avg_hope, stats.avg_relief, stats.avg_pressure, stats.avg_safety,
    stats.avg_joy, stats.avg_grief, stats.avg_anxiety, stats.avg_peace, stats.avg_frustration, dominantEmotion,
    stats.avg_apostle, stats.avg_prophet, stats.avg_evangelist, stats.avg_pastor, stats.avg_teacher, dominantFivefold,
    stats.avg_e_i, stats.avg_s_n, stats.avg_t_f, stats.avg_j_p, mbtiType,
    stats.avg_faith_atheist, stats.avg_faith_traditional, stats.avg_faith_acts_believer,
    stats.avg_subscribe_likelihood, stats.avg_benefit_likelihood, stats.avg_retention_likelihood,
    stats.avg_gospel_adoption, stats.avg_deception_index, compositeScores.deceptionTrend,
    JSON.stringify(denominationalLeanings), dominantDenominationalLeaning,
    stats.avg_cult_risk, stats.max_cult_risk, stats.avg_cult_susceptibility, JSON.stringify(safeguardingAlerts),
    stats.avg_financial_health, stats.avg_family_health, stats.avg_marriage_health,
    stats.avg_parenting_health, stats.avg_social_health, stats.avg_emotional_resilience, JSON.stringify(domainsAnalyzed),
    stats.avg_prayer_openness, stats.avg_faith_mindedness, stats.avg_worldliness_index,
    stats.avg_scripture_literacy, stats.avg_maturity_level, stats.avg_discipleship_readiness,
    stats.avg_forgiveness_posture, stats.avg_isolation_risk, stats.avg_conflict_posture,
    JSON.stringify(topStruggles), JSON.stringify(topStrengths), JSON.stringify(spiritualGiftsProfile),
    JSON.stringify({}), JSON.stringify({}), JSON.stringify([]), // doctrinal, learning, practices summaries (computed separately)
    traumaSensitivityFlagged, gentleApproachRecommended, JSON.stringify(inferredLanguages),
    compositeScores.engagementHealth, compositeScores.loyaltyScore, compositeScores.growthScore, compositeScores.satisfactionScore,
    JSON.stringify(topNeeds), JSON.stringify(topChallenges), JSON.stringify(topTopics), JSON.stringify(personaAffinity)
  ]);

  console.log(`Monthly analytics calculated for user ${userId}, month ${yearMonth}, messages: ${totalMessages}, private excluded: ${privateExcluded}`);
  return rowToAnalytics(result.rows[0]);
}

/**
 * Finalize a month (make it immutable)
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Object} Result with count of finalized records
 */
async function finalizeMonth(yearMonth) {
  const result = await database.query(`
    UPDATE user_monthly_analytics
    SET is_finalized = TRUE, finalized_at = NOW(), updated_at = NOW()
    WHERE year_month = $1 AND is_finalized = FALSE
    RETURNING user_id
  `, [yearMonth]);

  console.log(`Month ${yearMonth} finalized, affected users: ${result.rowCount}`);
  return { count: result.rowCount };
}

/**
 * Get all users with analytics data for a month (excluding private-only conversations)
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Array<string>} List of user IDs
 */
async function getUsersForMonth(yearMonth) {
  const startDate = `${yearMonth}-01`;

  // Only include users who have non-private conversations with analytics
  const result = await database.query(`
    SELECT DISTINCT ca.user_id FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.created_at >= $1::DATE
      AND ca.created_at < ($1::DATE + INTERVAL '1 month')
  `, [startDate]);

  return result.rows.map(r => r.user_id);
}

/**
 * Get current year-month string
 * @returns {string} Current year-month (YYYY-MM)
 */
function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get previous year-month string
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {string} Previous year-month
 */
function getPreviousYearMonth(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

/**
 * Delete all analytics for a user (GDPR compliance)
 * @param {string} userId - User ID
 * @returns {number} Number of deleted records
 */
async function deleteByUserId(userId) {
  const result = await database.query(
    'DELETE FROM user_monthly_analytics WHERE user_id = $1',
    [userId]
  );
  return result.rowCount;
}

module.exports = {
  findByUserAndMonth,
  findByUserId,
  calculateAndUpsert,
  finalizeMonth,
  getUsersForMonth,
  getCurrentYearMonth,
  getPreviousYearMonth,
  deleteByUserId
};
