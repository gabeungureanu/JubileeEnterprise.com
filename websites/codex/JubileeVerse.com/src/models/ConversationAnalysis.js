/**
 * ConversationAnalysis Model
 * Handles per-message analysis persistence and retrieval
 * Part of the User Analytics and Intelligence System
 *
 * Extended with:
 * - Faith-spectrum signals (atheist, traditional, Acts-believer)
 * - Predictive indicators (subscription, benefit, retention, gospel adoption)
 * - Deception index with trend tracking
 * - Denominational thinking patterns (9 categories)
 * - Cult risk/susceptibility safeguarding signals
 * - Life-domain health scores (conditional analysis)
 * - Spiritual health indicators with confidence gating
 * - Struggles, strengths, and spiritual gifts (JSONB with evidence tokens)
 * - Commandment alignment coaching signals
 * - Doctrinal posture and discipleship readiness
 * - Trauma sensitivity and conflict posture
 * - Learning style and spiritual practices
 * - Privacy enforcement (excludes private conversations)
 *
 * Version 3.0 - Strict consent and confidence-gated inference
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Default minimum confidence threshold for storing inferred fields
 */
const DEFAULT_CONFIDENCE_THRESHOLD = 60;

/**
 * Convert database row to analysis object (snake_case to camelCase)
 */
function rowToAnalysis(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    messageId: row.message_id,
    conversationId: row.conversation_id,
    personaId: row.persona_id,
    sessionId: row.session_id,

    // Sentiment
    sentimentScore: row.sentiment_score,
    sentimentLabel: row.sentiment_label,

    // Emotions
    emotions: {
      confusion: row.emotion_confusion,
      hope: row.emotion_hope,
      relief: row.emotion_relief,
      pressure: row.emotion_pressure,
      safety: row.emotion_safety,
      joy: row.emotion_joy,
      grief: row.emotion_grief,
      anxiety: row.emotion_anxiety,
      peace: row.emotion_peace,
      frustration: row.emotion_frustration
    },

    // Five-Fold
    fiveFold: {
      apostle: row.fivefold_apostle,
      prophet: row.fivefold_prophet,
      evangelist: row.fivefold_evangelist,
      pastor: row.fivefold_pastor,
      teacher: row.fivefold_teacher
    },

    // MBTI
    mbti: {
      eI: row.mbti_e_i,
      sN: row.mbti_s_n,
      tF: row.mbti_t_f,
      jP: row.mbti_j_p
    },

    // Faith-Spectrum (non-exclusive, overlapping signals)
    faithSpectrum: {
      atheistTendency: row.faith_atheist_tendency,
      traditionalTendency: row.faith_traditional_tendency,
      actsBelieverTendency: row.faith_acts_believer_tendency
    },

    // Predictive Indicators
    predictive: {
      subscribeLikelihood: row.predict_subscribe_likelihood,
      benefitLikelihood: row.predict_benefit_likelihood,
      retentionLikelihood: row.predict_retention_likelihood,
      gospelAdoption: row.predict_gospel_adoption
    },

    // Deception tracking (time-series)
    deceptionIndex: row.deception_index,
    deceptionMarkers: row.deception_markers || [],

    // Denominational Thinking Patterns (inferred, not declared)
    denominationalLeanings: {
      baptist: row.denom_baptist_leaning,
      pentecostal: row.denom_pentecostal_leaning,
      catholic: row.denom_catholic_leaning,
      reformed: row.denom_reformed_leaning,
      charismatic: row.denom_charismatic_leaning,
      orthodox: row.denom_orthodox_leaning,
      nondenominational: row.denom_nondenominational_leaning,
      mainline: row.denom_mainline_leaning,
      messianic: row.denom_messianic_leaning
    },

    // Safeguarding Signals
    safeguarding: {
      cultRiskScore: row.cult_risk_score,
      cultSusceptibilityScore: row.cult_susceptibility_score,
      cultRiskMarkers: row.cult_risk_markers || []
    },

    // Life-Domain Health (conditional - NULL if domain not analyzed)
    domainRelevance: row.domain_relevance || {},
    lifeDomains: {
      financialHealth: row.life_financial_health,
      familyHealth: row.life_family_health,
      marriageHealth: row.life_marriage_health,
      parentingHealth: row.life_parenting_health,
      socialHealth: row.life_social_health,
      emotionalResilience: row.life_emotional_resilience
    },

    // === NEW FIELDS (Migration 056) ===

    // Confidence and audit metadata
    confidenceThreshold: row.confidence_threshold || DEFAULT_CONFIDENCE_THRESHOLD,
    domainsEvaluated: row.domains_evaluated || [],

    // Inferred language (with confidence)
    inferredLanguage: row.inferred_language,
    inferredLanguageConfidence: row.inferred_language_confidence,
    translationRequested: row.translation_requested || false,

    // Spiritual struggles (structured JSONB with evidence tokens)
    struggles: row.struggles || [],
    struggleRelevanceTriggered: row.struggle_relevance_triggered || false,

    // Spiritual strengths and gifts
    strengths: row.strengths || [],
    spiritualGifts: row.spiritual_gifts || [],

    // Spiritual health indicators (with confidence gating)
    spiritualHealth: {
      prayerOpenness: row.prayer_openness,
      prayerOpennessConfidence: row.prayer_openness_confidence,
      faithMindedness: row.faith_mindedness,
      faithMindednessConfidence: row.faith_mindedness_confidence,
      worldlinessIndex: row.worldliness_index,
      worldlinessIndexConfidence: row.worldliness_index_confidence,
      healthConscientiousness: row.health_conscientiousness,
      healthConscientiousnessConfidence: row.health_conscientiousness_confidence,
      moneyAttachmentRisk: row.money_attachment_risk,
      moneyAttachmentConfidence: row.money_attachment_confidence,
      forgivenessPosture: row.forgiveness_posture,
      forgivenessPostureConfidence: row.forgiveness_posture_confidence,
      scriptureLiteracy: row.scripture_literacy,
      scriptureLiteracyConfidence: row.scripture_literacy_confidence,
      maturityLevel: row.maturity_level,
      maturityLevelConfidence: row.maturity_level_confidence
    },

    // Commandment alignment (coaching signals, not moral verdicts)
    commandmentCues: row.commandment_cues || {},
    loveOfGodOrientation: row.love_of_god_orientation,
    loveOfGodConfidence: row.love_of_god_confidence,

    // Doctrinal posture
    doctrinalPosture: row.doctrinal_posture || {},

    // Discipleship readiness
    discipleshipReadiness: row.discipleship_readiness,
    discipleshipReadinessConfidence: row.discipleship_readiness_confidence,
    discipleshipIndicators: row.discipleship_indicators || {},

    // Community orientation
    communityOrientation: {
      isolationRisk: row.isolation_risk,
      isolationRiskConfidence: row.isolation_risk_confidence,
      fellowshipDesire: row.fellowship_desire,
      fellowshipDesireConfidence: row.fellowship_desire_confidence,
      leadershipReadiness: row.leadership_readiness,
      leadershipReadinessConfidence: row.leadership_readiness_confidence,
      counselSeeking: row.counsel_seeking,
      counselSeekingConfidence: row.counsel_seeking_confidence
    },

    // Trauma sensitivity and conflict posture
    traumaSensitivityCues: row.trauma_sensitivity_cues || [],
    gentleToneRecommended: row.gentle_tone_recommended || false,
    conflictPosture: row.conflict_posture,
    conflictPostureConfidence: row.conflict_posture_confidence,

    // Learning style and spiritual practices
    learningStyle: row.learning_style || {},
    spiritualPractices: row.spiritual_practices || [],

    // Insights
    primaryNeeds: row.primary_needs || [],
    primaryChallenges: row.primary_challenges || [],
    dominantTopics: row.dominant_topics || [],
    worldviewIndicators: row.worldview_indicators || {},
    bibleReferencesDiscussed: row.bible_references_discussed || [],

    // Metadata
    analysisVersion: row.analysis_version,
    promptVersion: row.prompt_version,
    modelUsed: row.model_used,
    processingTimeMs: row.processing_time_ms,
    confidenceScore: row.confidence_score,
    lastAccessedBy: row.last_accessed_by,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at
  };
}

/**
 * Create a new conversation analysis record
 * @param {Object} analysisData - Analysis data to persist
 * @returns {Object} Created analysis record
 */
async function create(analysisData) {
  const id = uuidv4();

  const result = await database.query(`
    INSERT INTO conversation_analysis (
      id, user_id, message_id, conversation_id, persona_id, session_id,
      sentiment_score, sentiment_label,
      emotion_confusion, emotion_hope, emotion_relief, emotion_pressure, emotion_safety,
      emotion_joy, emotion_grief, emotion_anxiety, emotion_peace, emotion_frustration,
      fivefold_apostle, fivefold_prophet, fivefold_evangelist, fivefold_pastor, fivefold_teacher,
      mbti_e_i, mbti_s_n, mbti_t_f, mbti_j_p,
      faith_atheist_tendency, faith_traditional_tendency, faith_acts_believer_tendency,
      predict_subscribe_likelihood, predict_benefit_likelihood, predict_retention_likelihood,
      predict_gospel_adoption, deception_index, deception_markers,
      denom_baptist_leaning, denom_pentecostal_leaning, denom_catholic_leaning,
      denom_reformed_leaning, denom_charismatic_leaning, denom_orthodox_leaning,
      denom_nondenominational_leaning, denom_mainline_leaning, denom_messianic_leaning,
      cult_risk_score, cult_susceptibility_score, cult_risk_markers,
      domain_relevance, life_financial_health, life_family_health, life_marriage_health,
      life_parenting_health, life_social_health, life_emotional_resilience,
      primary_needs, primary_challenges, dominant_topics, worldview_indicators, bible_references_discussed,
      confidence_threshold, domains_evaluated,
      inferred_language, inferred_language_confidence, translation_requested,
      struggles, struggle_relevance_triggered, strengths, spiritual_gifts,
      prayer_openness, prayer_openness_confidence,
      faith_mindedness, faith_mindedness_confidence,
      worldliness_index, worldliness_index_confidence,
      health_conscientiousness, health_conscientiousness_confidence,
      money_attachment_risk, money_attachment_confidence,
      forgiveness_posture, forgiveness_posture_confidence,
      scripture_literacy, scripture_literacy_confidence,
      maturity_level, maturity_level_confidence,
      commandment_cues, love_of_god_orientation, love_of_god_confidence,
      doctrinal_posture,
      discipleship_readiness, discipleship_readiness_confidence, discipleship_indicators,
      isolation_risk, isolation_risk_confidence,
      fellowship_desire, fellowship_desire_confidence,
      leadership_readiness, leadership_readiness_confidence,
      counsel_seeking, counsel_seeking_confidence,
      trauma_sensitivity_cues, gentle_tone_recommended,
      conflict_posture, conflict_posture_confidence,
      learning_style, spiritual_practices,
      analysis_version, prompt_version, model_used, processing_time_ms, confidence_score
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23,
      $24, $25, $26, $27,
      $28, $29, $30,
      $31, $32, $33, $34, $35, $36,
      $37, $38, $39, $40, $41, $42, $43, $44, $45,
      $46, $47, $48,
      $49, $50, $51, $52, $53, $54, $55,
      $56, $57, $58, $59, $60,
      $61, $62,
      $63, $64, $65,
      $66, $67, $68, $69,
      $70, $71,
      $72, $73,
      $74, $75,
      $76, $77,
      $78, $79,
      $80, $81,
      $82, $83,
      $84, $85,
      $86, $87, $88,
      $89,
      $90, $91, $92,
      $93, $94,
      $95, $96,
      $97, $98,
      $99, $100,
      $101, $102,
      $103, $104,
      $105, $106,
      $107, $108, $109, $110, $111
    )
    RETURNING *
  `, [
    id,
    analysisData.userId,
    analysisData.messageId,
    analysisData.conversationId,
    analysisData.personaId || null,
    analysisData.sessionId || null,
    // Sentiment
    analysisData.sentimentScore,
    analysisData.sentimentLabel,
    // Emotions
    analysisData.emotions?.confusion || 0,
    analysisData.emotions?.hope || 0,
    analysisData.emotions?.relief || 0,
    analysisData.emotions?.pressure || 0,
    analysisData.emotions?.safety || 0,
    analysisData.emotions?.joy || 0,
    analysisData.emotions?.grief || 0,
    analysisData.emotions?.anxiety || 0,
    analysisData.emotions?.peace || 0,
    analysisData.emotions?.frustration || 0,
    // Five-Fold
    analysisData.fiveFold?.apostle || 0,
    analysisData.fiveFold?.prophet || 0,
    analysisData.fiveFold?.evangelist || 0,
    analysisData.fiveFold?.pastor || 0,
    analysisData.fiveFold?.teacher || 0,
    // MBTI
    analysisData.mbti?.eI || 50,
    analysisData.mbti?.sN || 50,
    analysisData.mbti?.tF || 50,
    analysisData.mbti?.jP || 50,
    // Faith-Spectrum
    analysisData.faithSpectrum?.atheistTendency || 0,
    analysisData.faithSpectrum?.traditionalTendency || 0,
    analysisData.faithSpectrum?.actsBelieverTendency || 0,
    // Predictive
    analysisData.predictive?.subscribeLikelihood || 50,
    analysisData.predictive?.benefitLikelihood || 50,
    analysisData.predictive?.retentionLikelihood || 50,
    analysisData.predictive?.gospelAdoption || 50,
    analysisData.deceptionIndex || 0,
    JSON.stringify(analysisData.deceptionMarkers || []),
    // Denominational
    analysisData.denominationalLeanings?.baptist || 0,
    analysisData.denominationalLeanings?.pentecostal || 0,
    analysisData.denominationalLeanings?.catholic || 0,
    analysisData.denominationalLeanings?.reformed || 0,
    analysisData.denominationalLeanings?.charismatic || 0,
    analysisData.denominationalLeanings?.orthodox || 0,
    analysisData.denominationalLeanings?.nondenominational || 0,
    analysisData.denominationalLeanings?.mainline || 0,
    analysisData.denominationalLeanings?.messianic || 0,
    // Safeguarding
    analysisData.safeguarding?.cultRiskScore || 0,
    analysisData.safeguarding?.cultSusceptibilityScore || 0,
    JSON.stringify(analysisData.safeguarding?.cultRiskMarkers || []),
    // Life-Domains (conditional - use null if not analyzed)
    JSON.stringify(analysisData.domainRelevance || {}),
    analysisData.lifeDomains?.financialHealth ?? null,
    analysisData.lifeDomains?.familyHealth ?? null,
    analysisData.lifeDomains?.marriageHealth ?? null,
    analysisData.lifeDomains?.parentingHealth ?? null,
    analysisData.lifeDomains?.socialHealth ?? null,
    analysisData.lifeDomains?.emotionalResilience ?? null,
    // Insights
    JSON.stringify(analysisData.primaryNeeds || []),
    JSON.stringify(analysisData.primaryChallenges || []),
    JSON.stringify(analysisData.dominantTopics || []),
    JSON.stringify(analysisData.worldviewIndicators || {}),
    JSON.stringify(analysisData.bibleReferencesDiscussed || []),
    // Confidence and audit metadata
    analysisData.confidenceThreshold || DEFAULT_CONFIDENCE_THRESHOLD,
    JSON.stringify(analysisData.domainsEvaluated || []),
    // Inferred language
    analysisData.inferredLanguage || null,
    analysisData.inferredLanguageConfidence ?? null,
    analysisData.translationRequested || false,
    // Struggles and strengths
    JSON.stringify(analysisData.struggles || []),
    analysisData.struggleRelevanceTriggered || false,
    JSON.stringify(analysisData.strengths || []),
    JSON.stringify(analysisData.spiritualGifts || []),
    // Spiritual health indicators (with confidence)
    analysisData.spiritualHealth?.prayerOpenness ?? null,
    analysisData.spiritualHealth?.prayerOpennessConfidence ?? null,
    analysisData.spiritualHealth?.faithMindedness ?? null,
    analysisData.spiritualHealth?.faithMindednessConfidence ?? null,
    analysisData.spiritualHealth?.worldlinessIndex ?? null,
    analysisData.spiritualHealth?.worldlinessIndexConfidence ?? null,
    analysisData.spiritualHealth?.healthConscientiousness ?? null,
    analysisData.spiritualHealth?.healthConscientiousnessConfidence ?? null,
    analysisData.spiritualHealth?.moneyAttachmentRisk ?? null,
    analysisData.spiritualHealth?.moneyAttachmentConfidence ?? null,
    analysisData.spiritualHealth?.forgivenessPosture ?? null,
    analysisData.spiritualHealth?.forgivenessPostureConfidence ?? null,
    analysisData.spiritualHealth?.scriptureLiteracy ?? null,
    analysisData.spiritualHealth?.scriptureLiteracyConfidence ?? null,
    analysisData.spiritualHealth?.maturityLevel ?? null,
    analysisData.spiritualHealth?.maturityLevelConfidence ?? null,
    // Commandment alignment
    JSON.stringify(analysisData.commandmentCues || {}),
    analysisData.loveOfGodOrientation ?? null,
    analysisData.loveOfGodConfidence ?? null,
    // Doctrinal posture
    JSON.stringify(analysisData.doctrinalPosture || {}),
    // Discipleship
    analysisData.discipleshipReadiness ?? null,
    analysisData.discipleshipReadinessConfidence ?? null,
    JSON.stringify(analysisData.discipleshipIndicators || {}),
    // Community orientation
    analysisData.communityOrientation?.isolationRisk ?? null,
    analysisData.communityOrientation?.isolationRiskConfidence ?? null,
    analysisData.communityOrientation?.fellowshipDesire ?? null,
    analysisData.communityOrientation?.fellowshipDesireConfidence ?? null,
    analysisData.communityOrientation?.leadershipReadiness ?? null,
    analysisData.communityOrientation?.leadershipReadinessConfidence ?? null,
    analysisData.communityOrientation?.counselSeeking ?? null,
    analysisData.communityOrientation?.counselSeekingConfidence ?? null,
    // Trauma and conflict
    JSON.stringify(analysisData.traumaSensitivityCues || []),
    analysisData.gentleToneRecommended || false,
    analysisData.conflictPosture ?? null,
    analysisData.conflictPostureConfidence ?? null,
    // Learning and practices
    JSON.stringify(analysisData.learningStyle || {}),
    JSON.stringify(analysisData.spiritualPractices || []),
    // Metadata
    analysisData.analysisVersion || '3.0',
    analysisData.promptVersion || '3.0',
    analysisData.modelUsed,
    analysisData.processingTimeMs,
    analysisData.confidenceScore
  ]);

  return rowToAnalysis(result.rows[0]);
}

/**
 * Find analysis by ID
 * @param {string} id - Analysis ID
 * @returns {Object|null} Analysis record or null
 */
async function findById(id) {
  const result = await database.query(
    'SELECT * FROM conversation_analysis WHERE id = $1',
    [id]
  );
  return rowToAnalysis(result.rows[0]);
}

/**
 * Find analysis by message ID
 * @param {string} messageId - Message ID
 * @returns {Object|null} Analysis record or null
 */
async function findByMessageId(messageId) {
  const result = await database.query(
    'SELECT * FROM conversation_analysis WHERE message_id = $1',
    [messageId]
  );
  return rowToAnalysis(result.rows[0]);
}

/**
 * Find analyses by user ID with pagination (excludes private conversations)
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Array} List of analysis records
 */
async function findByUserId(userId, options = {}) {
  const { limit = 50, offset = 0, startDate = null, endDate = null, includePrivate = false } = options;

  let query = `
    SELECT ca.* FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id
    WHERE ca.user_id = $1
  `;
  const params = [userId];
  let paramIndex = 2;

  // Exclude private conversations unless explicitly requested
  if (!includePrivate) {
    query += ` AND c.is_private = FALSE`;
  }

  if (startDate) {
    query += ` AND ca.created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND ca.created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  query += ` ORDER BY ca.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await database.query(query, params);
  return result.rows.map(rowToAnalysis);
}

/**
 * Find analyses by conversation ID
 * @param {string} conversationId - Conversation ID
 * @returns {Array} List of analysis records in chronological order
 */
async function findByConversationId(conversationId) {
  const result = await database.query(
    'SELECT * FROM conversation_analysis WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return result.rows.map(rowToAnalysis);
}

/**
 * Get aggregated stats for a user within a year-month (v3 with privacy exclusion and new fields)
 * Used for monthly analytics calculation
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Object} Aggregated statistics including all new fields
 */
async function getAggregatedStats(userId, yearMonth) {
  const startDate = `${yearMonth}-01`;

  const result = await database.query(`
    SELECT
      COUNT(*) as total_messages,
      COUNT(DISTINCT ca.conversation_id) as total_conversations,
      COUNT(DISTINCT ca.persona_id) as unique_personas,

      -- Count excluded private conversations
      (SELECT COUNT(DISTINCT c.id) FROM conversations c
       WHERE c.user_id = $1
       AND c.is_private = TRUE
       AND c.created_at >= $2::DATE
       AND c.created_at < ($2::DATE + INTERVAL '1 month')) as private_excluded,

      -- Sentiment
      ROUND(AVG(ca.sentiment_score)::NUMERIC, 2) as avg_sentiment,
      MIN(ca.sentiment_score) as min_sentiment,
      MAX(ca.sentiment_score) as max_sentiment,

      -- Emotions
      ROUND(AVG(ca.emotion_confusion)::NUMERIC, 2) as avg_confusion,
      ROUND(AVG(ca.emotion_hope)::NUMERIC, 2) as avg_hope,
      ROUND(AVG(ca.emotion_relief)::NUMERIC, 2) as avg_relief,
      ROUND(AVG(ca.emotion_pressure)::NUMERIC, 2) as avg_pressure,
      ROUND(AVG(ca.emotion_safety)::NUMERIC, 2) as avg_safety,
      ROUND(AVG(ca.emotion_joy)::NUMERIC, 2) as avg_joy,
      ROUND(AVG(ca.emotion_grief)::NUMERIC, 2) as avg_grief,
      ROUND(AVG(ca.emotion_anxiety)::NUMERIC, 2) as avg_anxiety,
      ROUND(AVG(ca.emotion_peace)::NUMERIC, 2) as avg_peace,
      ROUND(AVG(ca.emotion_frustration)::NUMERIC, 2) as avg_frustration,

      -- Five-Fold
      ROUND(AVG(ca.fivefold_apostle)::NUMERIC, 2) as avg_apostle,
      ROUND(AVG(ca.fivefold_prophet)::NUMERIC, 2) as avg_prophet,
      ROUND(AVG(ca.fivefold_evangelist)::NUMERIC, 2) as avg_evangelist,
      ROUND(AVG(ca.fivefold_pastor)::NUMERIC, 2) as avg_pastor,
      ROUND(AVG(ca.fivefold_teacher)::NUMERIC, 2) as avg_teacher,

      -- MBTI
      ROUND(AVG(ca.mbti_e_i)::NUMERIC, 2) as avg_e_i,
      ROUND(AVG(ca.mbti_s_n)::NUMERIC, 2) as avg_s_n,
      ROUND(AVG(ca.mbti_t_f)::NUMERIC, 2) as avg_t_f,
      ROUND(AVG(ca.mbti_j_p)::NUMERIC, 2) as avg_j_p,

      -- Faith-Spectrum
      ROUND(AVG(ca.faith_atheist_tendency)::NUMERIC, 2) as avg_faith_atheist,
      ROUND(AVG(ca.faith_traditional_tendency)::NUMERIC, 2) as avg_faith_traditional,
      ROUND(AVG(ca.faith_acts_believer_tendency)::NUMERIC, 2) as avg_faith_acts_believer,

      -- Predictive
      ROUND(AVG(ca.predict_subscribe_likelihood)::NUMERIC, 2) as avg_subscribe_likelihood,
      ROUND(AVG(ca.predict_benefit_likelihood)::NUMERIC, 2) as avg_benefit_likelihood,
      ROUND(AVG(ca.predict_retention_likelihood)::NUMERIC, 2) as avg_retention_likelihood,
      ROUND(AVG(ca.predict_gospel_adoption)::NUMERIC, 2) as avg_gospel_adoption,
      ROUND(AVG(ca.deception_index)::NUMERIC, 2) as avg_deception_index,

      -- Denominational
      ROUND(AVG(ca.denom_baptist_leaning)::NUMERIC, 2) as avg_baptist,
      ROUND(AVG(ca.denom_pentecostal_leaning)::NUMERIC, 2) as avg_pentecostal,
      ROUND(AVG(ca.denom_catholic_leaning)::NUMERIC, 2) as avg_catholic,
      ROUND(AVG(ca.denom_reformed_leaning)::NUMERIC, 2) as avg_reformed,
      ROUND(AVG(ca.denom_charismatic_leaning)::NUMERIC, 2) as avg_charismatic,
      ROUND(AVG(ca.denom_orthodox_leaning)::NUMERIC, 2) as avg_orthodox,
      ROUND(AVG(ca.denom_nondenominational_leaning)::NUMERIC, 2) as avg_nondenominational,
      ROUND(AVG(ca.denom_mainline_leaning)::NUMERIC, 2) as avg_mainline,
      ROUND(AVG(ca.denom_messianic_leaning)::NUMERIC, 2) as avg_messianic,

      -- Safeguarding
      ROUND(AVG(ca.cult_risk_score)::NUMERIC, 2) as avg_cult_risk,
      MAX(ca.cult_risk_score) as max_cult_risk,
      ROUND(AVG(ca.cult_susceptibility_score)::NUMERIC, 2) as avg_cult_susceptibility,

      -- Life-Domains (averages only for non-null values)
      ROUND(AVG(ca.life_financial_health)::NUMERIC, 2) as avg_financial_health,
      ROUND(AVG(ca.life_family_health)::NUMERIC, 2) as avg_family_health,
      ROUND(AVG(ca.life_marriage_health)::NUMERIC, 2) as avg_marriage_health,
      ROUND(AVG(ca.life_parenting_health)::NUMERIC, 2) as avg_parenting_health,
      ROUND(AVG(ca.life_social_health)::NUMERIC, 2) as avg_social_health,
      ROUND(AVG(ca.life_emotional_resilience)::NUMERIC, 2) as avg_emotional_resilience,

      -- Domain analysis counts
      COUNT(ca.life_financial_health) as financial_analyzed_count,
      COUNT(ca.life_family_health) as family_analyzed_count,
      COUNT(ca.life_marriage_health) as marriage_analyzed_count,
      COUNT(ca.life_parenting_health) as parenting_analyzed_count,
      COUNT(ca.life_social_health) as social_analyzed_count,
      COUNT(ca.life_emotional_resilience) as resilience_analyzed_count,

      -- Spiritual health indicators (only where confidence met threshold)
      ROUND(AVG(CASE WHEN ca.prayer_openness_confidence >= ca.confidence_threshold THEN ca.prayer_openness END)::NUMERIC, 2) as avg_prayer_openness,
      ROUND(AVG(CASE WHEN ca.faith_mindedness_confidence >= ca.confidence_threshold THEN ca.faith_mindedness END)::NUMERIC, 2) as avg_faith_mindedness,
      ROUND(AVG(CASE WHEN ca.worldliness_index_confidence >= ca.confidence_threshold THEN ca.worldliness_index END)::NUMERIC, 2) as avg_worldliness_index,
      ROUND(AVG(CASE WHEN ca.scripture_literacy_confidence >= ca.confidence_threshold THEN ca.scripture_literacy END)::NUMERIC, 2) as avg_scripture_literacy,
      ROUND(AVG(CASE WHEN ca.maturity_level_confidence >= ca.confidence_threshold THEN ca.maturity_level END)::NUMERIC, 2) as avg_maturity_level,
      ROUND(AVG(CASE WHEN ca.discipleship_readiness_confidence >= ca.confidence_threshold THEN ca.discipleship_readiness END)::NUMERIC, 2) as avg_discipleship_readiness,
      ROUND(AVG(CASE WHEN ca.forgiveness_posture_confidence >= ca.confidence_threshold THEN ca.forgiveness_posture END)::NUMERIC, 2) as avg_forgiveness_posture,
      ROUND(AVG(CASE WHEN ca.isolation_risk_confidence >= ca.confidence_threshold THEN ca.isolation_risk END)::NUMERIC, 2) as avg_isolation_risk,
      ROUND(AVG(CASE WHEN ca.conflict_posture_confidence >= ca.confidence_threshold THEN ca.conflict_posture END)::NUMERIC, 2) as avg_conflict_posture,

      -- Trauma and sensitivity flags
      BOOL_OR(jsonb_array_length(COALESCE(ca.trauma_sensitivity_cues, '[]'::jsonb)) > 0) as trauma_sensitivity_detected,
      COUNT(CASE WHEN ca.gentle_tone_recommended = TRUE THEN 1 END) as gentle_tone_recommended_count,

      -- Struggle relevance triggered count
      COUNT(CASE WHEN ca.struggle_relevance_triggered = TRUE THEN 1 END) as struggle_triggered_count

    FROM conversation_analysis ca
    -- JOIN to exclude private conversations
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
  `, [userId, startDate]);

  return result.rows[0];
}

/**
 * Get aggregated struggles for a user in a month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @param {number} limit - Max struggles to return
 * @returns {Array} Aggregated struggles by key with frequency and avg score
 */
async function getAggregatedStruggles(userId, yearMonth, limit = 10) {
  const startDate = `${yearMonth}-01`;

  const result = await database.query(`
    SELECT
      struggle->>'key' as struggle_key,
      COUNT(*) as occurrence_count,
      ROUND(AVG((struggle->>'score')::INTEGER)::NUMERIC, 2) as avg_score,
      ROUND(AVG((struggle->>'confidence')::INTEGER)::NUMERIC, 2) as avg_confidence
    FROM conversation_analysis ca,
    LATERAL jsonb_array_elements(ca.struggles) as struggle
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
      AND ca.struggle_relevance_triggered = TRUE
    GROUP BY struggle->>'key'
    ORDER BY occurrence_count DESC, avg_score DESC
    LIMIT $3
  `, [userId, startDate, limit]);

  return result.rows.map(r => ({
    key: r.struggle_key,
    occurrenceCount: parseInt(r.occurrence_count),
    avgScore: parseFloat(r.avg_score),
    avgConfidence: parseFloat(r.avg_confidence)
  }));
}

/**
 * Get aggregated strengths for a user in a month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @param {number} limit - Max strengths to return
 * @returns {Array} Aggregated strengths by key
 */
async function getAggregatedStrengths(userId, yearMonth, limit = 10) {
  const startDate = `${yearMonth}-01`;

  const result = await database.query(`
    SELECT
      strength->>'key' as strength_key,
      COUNT(*) as occurrence_count,
      ROUND(AVG((strength->>'score')::INTEGER)::NUMERIC, 2) as avg_score,
      ROUND(AVG((strength->>'confidence')::INTEGER)::NUMERIC, 2) as avg_confidence
    FROM conversation_analysis ca,
    LATERAL jsonb_array_elements(ca.strengths) as strength
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
    GROUP BY strength->>'key'
    ORDER BY occurrence_count DESC, avg_score DESC
    LIMIT $3
  `, [userId, startDate, limit]);

  return result.rows.map(r => ({
    key: r.strength_key,
    occurrenceCount: parseInt(r.occurrence_count),
    avgScore: parseFloat(r.avg_score),
    avgConfidence: parseFloat(r.avg_confidence)
  }));
}

/**
 * Get aggregated spiritual gifts for a user in a month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @param {number} limit - Max gifts to return
 * @returns {Array} Aggregated gifts by key
 */
async function getAggregatedGifts(userId, yearMonth, limit = 10) {
  const startDate = `${yearMonth}-01`;

  const result = await database.query(`
    SELECT
      gift->>'gift_key' as gift_key,
      COUNT(*) as evidence_count,
      ROUND(AVG((gift->>'score')::INTEGER)::NUMERIC, 2) as avg_score,
      ROUND(AVG((gift->>'confidence')::INTEGER)::NUMERIC, 2) as avg_confidence
    FROM conversation_analysis ca,
    LATERAL jsonb_array_elements(ca.spiritual_gifts) as gift
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
    GROUP BY gift->>'gift_key'
    ORDER BY evidence_count DESC, avg_score DESC
    LIMIT $3
  `, [userId, startDate, limit]);

  return result.rows.map(r => ({
    giftKey: r.gift_key,
    evidenceCount: parseInt(r.evidence_count),
    avgScore: parseFloat(r.avg_score),
    avgConfidence: parseFloat(r.avg_confidence)
  }));
}

/**
 * Get inferred language usage for a user in a month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Object} Language code to message count mapping
 */
async function getInferredLanguages(userId, yearMonth) {
  const startDate = `${yearMonth}-01`;

  const result = await database.query(`
    SELECT
      inferred_language,
      COUNT(*) as message_count,
      ROUND(AVG(inferred_language_confidence)::NUMERIC, 2) as avg_confidence
    FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
      AND ca.inferred_language IS NOT NULL
    GROUP BY inferred_language
    ORDER BY message_count DESC
  `, [userId, startDate]);

  const languages = {};
  result.rows.forEach(r => {
    languages[r.inferred_language] = {
      messageCount: parseInt(r.message_count),
      avgConfidence: parseFloat(r.avg_confidence)
    };
  });
  return languages;
}

/**
 * Get deception index trend for a user over time
 * @param {string} userId - User ID
 * @param {number} limit - Number of recent analyses to consider
 * @returns {Object} Trend data with direction and change
 */
async function getDeceptionTrend(userId, limit = 20) {
  const result = await database.query(`
    SELECT ca.deception_index, ca.created_at
    FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.deception_index IS NOT NULL
    ORDER BY ca.created_at DESC
    LIMIT $2
  `, [userId, limit]);

  if (result.rows.length < 2) {
    return { trend: 'insufficient_data', values: result.rows };
  }

  const values = result.rows.map(r => r.deception_index).reverse();
  const recentAvg = values.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, values.length);
  const oldAvg = values.slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(5, values.length);

  const change = recentAvg - oldAvg;
  let trend = 'stable';
  if (change > 10) trend = 'worsening';
  else if (change < -10) trend = 'improving';
  else if (Math.abs(change) > 5) trend = 'fluctuating';

  return {
    trend,
    recentAverage: Math.round(recentAvg),
    change: Math.round(change),
    dataPoints: values.length
  };
}

/**
 * Get safeguarding alerts for a user in a month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Array} List of high-risk markers observed
 */
async function getSafeguardingAlerts(userId, yearMonth) {
  const startDate = `${yearMonth}-01`;

  const result = await database.query(`
    SELECT ca.cult_risk_score, ca.cult_susceptibility_score, ca.cult_risk_markers, ca.created_at
    FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
      AND (ca.cult_risk_score > 50 OR ca.cult_susceptibility_score > 50)
    ORDER BY ca.created_at DESC
  `, [userId, startDate]);

  return result.rows.map(r => ({
    cultRiskScore: r.cult_risk_score,
    cultSusceptibilityScore: r.cult_susceptibility_score,
    markers: r.cult_risk_markers,
    createdAt: r.created_at
  }));
}

/**
 * Get top items from JSONB arrays across analyses for a month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @param {string} field - JSONB field name (primary_needs, primary_challenges, dominant_topics)
 * @param {number} limit - Max items to return
 * @returns {Array} Ranked list of items with frequency
 */
async function getTopInsights(userId, yearMonth, field, limit = 5) {
  const startDate = `${yearMonth}-01`;

  // Validate field name to prevent SQL injection
  const validFields = ['primary_needs', 'primary_challenges', 'dominant_topics'];
  if (!validFields.includes(field)) {
    throw new Error(`Invalid field: ${field}`);
  }

  const result = await database.query(`
    SELECT item, COUNT(*) as frequency
    FROM conversation_analysis ca,
    LATERAL jsonb_array_elements_text(ca.${field}) as item
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
    GROUP BY item
    ORDER BY frequency DESC
    LIMIT $3
  `, [userId, startDate, limit]);

  return result.rows.map(r => ({ item: r.item, frequency: parseInt(r.frequency) }));
}

/**
 * Get persona usage counts for a user in a month
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Object} Persona ID to count mapping
 */
async function getPersonaAffinity(userId, yearMonth) {
  const startDate = `${yearMonth}-01`;

  const result = await database.query(`
    SELECT ca.persona_id, COUNT(*) as count
    FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
      AND ca.persona_id IS NOT NULL
      AND ca.created_at >= $2::DATE
      AND ca.created_at < ($2::DATE + INTERVAL '1 month')
    GROUP BY ca.persona_id
    ORDER BY count DESC
  `, [userId, startDate]);

  const affinity = {};
  result.rows.forEach(r => {
    affinity[r.persona_id] = parseInt(r.count);
  });
  return affinity;
}

/**
 * Check if analysis exists for a message
 * @param {string} messageId - Message ID
 * @returns {boolean} True if analysis exists
 */
async function existsForMessage(messageId) {
  const result = await database.query(
    'SELECT 1 FROM conversation_analysis WHERE message_id = $1 LIMIT 1',
    [messageId]
  );
  return result.rows.length > 0;
}

/**
 * Count total analyses for a user (excluding private)
 * @param {string} userId - User ID
 * @returns {number} Total count
 */
async function countByUserId(userId) {
  const result = await database.query(`
    SELECT COUNT(*) as count
    FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
  `, [userId]);
  return parseInt(result.rows[0].count);
}

/**
 * Get recent analyses for a user (excluding private)
 * @param {string} userId - User ID
 * @param {number} limit - Max records
 * @returns {Array} Recent analyses
 */
async function getRecent(userId, limit = 10) {
  const result = await database.query(`
    SELECT ca.* FROM conversation_analysis ca
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = $1
    ORDER BY ca.created_at DESC
    LIMIT $2
  `, [userId, limit]);
  return result.rows.map(rowToAnalysis);
}

/**
 * Delete all analyses for a user (GDPR compliance)
 * @param {string} userId - User ID
 * @returns {number} Number of deleted records
 */
async function deleteByUserId(userId) {
  const result = await database.query(
    'DELETE FROM conversation_analysis WHERE user_id = $1',
    [userId]
  );
  return result.rowCount;
}

/**
 * Log access to analytics data (RBAC auditing)
 * @param {Object} accessData - Access log data
 * @returns {Object} Created log entry
 */
async function logAccess(accessData) {
  const result = await database.query(`
    INSERT INTO analytics_access_log (
      accessed_by, access_type, target_user_id, target_analysis_id,
      target_year_month, access_fields, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    accessData.accessedBy,
    accessData.accessType,
    accessData.targetUserId || null,
    accessData.targetAnalysisId || null,
    accessData.targetYearMonth || null,
    JSON.stringify(accessData.accessFields || []),
    accessData.ipAddress || null,
    accessData.userAgent || null
  ]);
  return result.rows[0];
}

/**
 * Update last_accessed metadata on an analysis record
 * @param {string} id - Analysis ID
 * @param {string} accessedBy - User ID who accessed
 */
async function updateLastAccessed(id, accessedBy) {
  await database.query(`
    UPDATE conversation_analysis
    SET last_accessed_by = $2, last_accessed_at = NOW()
    WHERE id = $1
  `, [id, accessedBy]);
}

/**
 * Update safeguard info for an analysis record
 * @param {string} messageId - Message UUID
 * @param {Object} safeguardInfo - Safeguard analysis results
 */
async function updateSafeguardInfo(messageId, safeguardInfo) {
  await database.query(`
    UPDATE conversation_analysis
    SET safeguard_analyzed = $2,
        safeguard_flags_generated = $3,
        persona_performance_id = $4,
        updated_at = NOW()
    WHERE message_id = $1
  `, [
    messageId,
    safeguardInfo.safeguardAnalyzed || false,
    safeguardInfo.safeguardFlagsGenerated || 0,
    safeguardInfo.personaPerformanceId || null
  ]);
}

module.exports = {
  create,
  findById,
  findByMessageId,
  findByUserId,
  findByConversationId,
  getAggregatedStats,
  getAggregatedStruggles,
  getAggregatedStrengths,
  getAggregatedGifts,
  getInferredLanguages,
  getDeceptionTrend,
  getSafeguardingAlerts,
  getTopInsights,
  getPersonaAffinity,
  existsForMessage,
  countByUserId,
  getRecent,
  deleteByUserId,
  logAccess,
  updateLastAccessed,
  updateSafeguardInfo,
  DEFAULT_CONFIDENCE_THRESHOLD
};
