/**
 * ConversationAnalysisService
 * Handles AI-powered analysis of user conversations
 * Part of the User Analytics and Intelligence System
 *
 * Version 3.0 - Extended Spiritual Demographics with Privacy Controls
 *
 * Features:
 * - Two-pass evaluation (relevance gating then detailed analysis)
 * - Confidence thresholds for all inferred fields
 * - Privacy enforcement (is_private conversations excluded)
 * - Struggles and strengths with evidence tokens
 * - Spiritual health indicators
 * - Commandment alignment coaching signals
 * - Doctrinal posture and discipleship readiness
 * - Trauma sensitivity and conflict posture
 * - Learning style and spiritual practices
 * - Self-declared demographics (never inferred for identity)
 */

const logger = require('../utils/logger');
const AIService = require('./AIService');
const ConversationAnalysis = require('../models/ConversationAnalysis');
const User = require('../models/User');
const UserMonthlyAnalytics = require('../models/UserMonthlyAnalytics');
const SafeguardService = require('./SafeguardService');

/**
 * Default confidence threshold for storing inferred fields
 */
const DEFAULT_CONFIDENCE_THRESHOLD = 60;

/**
 * Higher confidence threshold for sensitive fields
 */
const SENSITIVE_CONFIDENCE_THRESHOLD = 75;

/**
 * Pass 1 System Prompt: Relevance Classification
 * Determines which domains apply before detailed analysis
 */
const RELEVANCE_SYSTEM_PROMPT = `You are a conversation classifier for JubileeVerse, a faith-based platform. Quickly determine which analysis domains are relevant to this conversation.

Return ONLY a JSON object with boolean flags and confidence scores (0-100) for each domain:

{
  "domainsRelevant": {
    "demographics": {"relevant": false, "confidence": 0, "reason": ""},
    "language": {"relevant": false, "confidence": 0, "detected": null},
    "spiritualStruggle": {"relevant": false, "confidence": 0, "categories": []},
    "spiritualStrength": {"relevant": false, "confidence": 0},
    "prayerOpenness": {"relevant": false, "confidence": 0},
    "doctrinalAlignment": {"relevant": false, "confidence": 0},
    "churchBackground": {"relevant": false, "confidence": 0},
    "financialStress": {"relevant": false, "confidence": 0},
    "familyStress": {"relevant": false, "confidence": 0},
    "marriageStress": {"relevant": false, "confidence": 0},
    "parentingStress": {"relevant": false, "confidence": 0},
    "socialStress": {"relevant": false, "confidence": 0},
    "identityQuestions": {"relevant": false, "confidence": 0},
    "traumaCues": {"relevant": false, "confidence": 0, "gentleToneNeeded": false},
    "leadershipCalling": {"relevant": false, "confidence": 0},
    "deceptionCues": {"relevant": false, "confidence": 0},
    "cultRiskCues": {"relevant": false, "confidence": 0}
  },
  "translationRequested": false,
  "primaryLanguage": "en"
}

RULES:
1. Set "relevant" to true ONLY if the conversation meaningfully touches that domain
2. "confidence" indicates how sure you are of your relevance judgment
3. For spiritualStruggle, list specific categories detected: ["temptation", "addiction", "confession", "relationalConflict", "financialAnxiety", "sexualContent", "integrityIssue", "doubt", "grief", "anger", "fear", "depression"]
4. For language, set "detected" to the ISO language code if not English
5. For traumaCues, set "gentleToneNeeded" if you detect vulnerability markers
6. Be conservative - many conversations are casual and don't warrant deep analysis`;

/**
 * Pass 2 System Prompt: Full Analysis
 * Only analyzes domains flagged as relevant in Pass 1
 */
const ANALYSIS_SYSTEM_PROMPT = `You are an expert conversation analyst for JubileeVerse, a faith-based AI chat platform rooted in biblical Christianity. Your task is to analyze a user's message and the AI's response to extract comprehensive insights.

IMPORTANT: This analysis must be honest, nuanced, and grounded in Scripture. Do not shy away from identifying patterns that suggest the user may be deceived, resistant to truth, or operating from a worldview that conflicts with biblical teaching.

You will receive a list of RELEVANT_DOMAINS. ONLY analyze the domains marked as relevant. For non-relevant domains, return null or empty values.

Analyze the conversation and return a JSON object with these fields (all scores 0-100):

{
  "sentiment": {
    "score": <0-100>,
    "label": "<negative|slightly_negative|neutral|slightly_positive|positive>"
  },

  "emotions": {
    "confusion": <0-100>,
    "hope": <0-100>,
    "relief": <0-100>,
    "pressure": <0-100>,
    "safety": <0-100>,
    "joy": <0-100>,
    "grief": <0-100>,
    "anxiety": <0-100>,
    "peace": <0-100>,
    "frustration": <0-100>
  },

  "fiveFold": {
    "apostle": <0-100>,
    "prophet": <0-100>,
    "evangelist": <0-100>,
    "pastor": <0-100>,
    "teacher": <0-100>
  },

  "mbti": {
    "eI": <0-100, 0=introvert, 100=extrovert>,
    "sN": <0-100, 0=sensing, 100=intuition>,
    "tF": <0-100, 0=thinking, 100=feeling>,
    "jP": <0-100, 0=judging, 100=perceiving>
  },

  "faithSpectrum": {
    "atheistTendency": <0-100>,
    "traditionalTendency": <0-100>,
    "actsBelieverTendency": <0-100>
  },

  "predictive": {
    "subscribeLikelihood": <0-100>,
    "benefitLikelihood": <0-100>,
    "retentionLikelihood": <0-100>,
    "gospelAdoption": <0-100>
  },

  "deceptionIndex": <0-100>,
  "deceptionMarkers": ["<short marker, not full quotes>"],

  "denominationalLeanings": {
    "baptist": <0-100>,
    "pentecostal": <0-100>,
    "catholic": <0-100>,
    "reformed": <0-100>,
    "charismatic": <0-100>,
    "orthodox": <0-100>,
    "nondenominational": <0-100>,
    "mainline": <0-100>,
    "messianic": <0-100>
  },

  "safeguarding": {
    "cultRiskScore": <0-100>,
    "cultSusceptibilityScore": <0-100>,
    "cultRiskMarkers": ["<short markers>"]
  },

  "struggles": [
    {"key": "<category>", "score": <0-100 intensity>, "confidence": <0-100>, "evidenceTokens": ["<short evidence, NOT full quotes>"]}
  ],

  "strengths": [
    {"key": "<category>", "score": <0-100>, "confidence": <0-100>, "evidenceTokens": ["<short evidence>"]}
  ],

  "spiritualGifts": [
    {"giftKey": "<gift>", "score": <0-100>, "confidence": <0-100>, "evidenceTokens": ["<short evidence>"]}
  ],

  "spiritualHealth": {
    "prayerOpenness": {"score": <0-100 or null>, "confidence": <0-100>},
    "faithMindedness": {"score": <0-100 or null>, "confidence": <0-100>},
    "worldlinessIndex": {"score": <0-100 or null>, "confidence": <0-100>},
    "healthConscientiousness": {"score": <0-100 or null>, "confidence": <0-100>},
    "moneyAttachmentRisk": {"score": <0-100 or null>, "confidence": <0-100>},
    "forgivenessPosture": {"score": <0-100 or null>, "confidence": <0-100>},
    "scriptureLiteracy": {"score": <0-100 or null>, "confidence": <0-100>},
    "maturityLevel": {"score": <0-100 or null>, "confidence": <0-100>}
  },

  "commandmentCues": {
    "idolatryCue": {"score": <0-100>, "confidence": <0-100>},
    "covetousnessCue": {"score": <0-100>, "confidence": <0-100>},
    "deceptionCue": {"score": <0-100>, "confidence": <0-100>},
    "unforgivenessCue": {"score": <0-100>, "confidence": <0-100>},
    "sexualTemptationCue": {"score": <0-100>, "confidence": <0-100>},
    "integrityCue": {"score": <0-100>, "confidence": <0-100>}
  },
  "loveOfGodOrientation": {"score": <0-100 or null>, "confidence": <0-100>},

  "doctrinalPosture": {
    "scriptureAuthority": {"score": <0-100>, "confidence": <0-100>},
    "traditionAuthority": {"score": <0-100>, "confidence": <0-100>},
    "experientialEmphasis": {"score": <0-100>, "confidence": <0-100>},
    "skepticismEmphasis": {"score": <0-100>, "confidence": <0-100>},
    "opennessToCorrection": {"score": <0-100>, "confidence": <0-100>}
  },

  "discipleshipReadiness": {"score": <0-100 or null>, "confidence": <0-100>},
  "discipleshipIndicators": {
    "readingPlan": <0-100 or null>,
    "prayerHabit": <0-100 or null>,
    "confession": <0-100 or null>,
    "restitution": <0-100 or null>,
    "forgiveness": <0-100 or null>,
    "accountability": <0-100 or null>,
    "serving": <0-100 or null>
  },

  "communityOrientation": {
    "isolationRisk": {"score": <0-100 or null>, "confidence": <0-100>},
    "fellowshipDesire": {"score": <0-100 or null>, "confidence": <0-100>},
    "leadershipReadiness": {"score": <0-100 or null>, "confidence": <0-100>},
    "counselSeeking": {"score": <0-100 or null>, "confidence": <0-100>}
  },

  "traumaSensitivityCues": [{"cueType": "<type>", "confidence": <0-100>}],
  "gentleToneRecommended": <true/false>,
  "conflictPosture": {"score": <0-100, 0=combative, 50=neutral, 100=peacemaking>, "confidence": <0-100>},

  "learningStyle": {
    "practicalSteps": <0-100>,
    "storytelling": <0-100>,
    "theologicalDepth": <0-100>,
    "shortAnswers": <0-100>
  },

  "spiritualPractices": [
    {"practiceKey": "<practice>", "frequency": "<expressed|implied|rare>", "importance": <0-100>, "confidence": <0-100>}
  ],

  "domainRelevance": {<echoed from input>},

  "lifeDomains": {
    "financialHealth": <0-100 or null>,
    "familyHealth": <0-100 or null>,
    "marriageHealth": <0-100 or null>,
    "parentingHealth": <0-100 or null>,
    "socialHealth": <0-100 or null>,
    "emotionalResilience": <0-100 or null>
  },

  "inferredLanguage": "<ISO code or null>",
  "inferredLanguageConfidence": <0-100 or null>,
  "translationRequested": <true/false>,

  "primaryNeeds": ["<need1>", "<need2>"],
  "primaryChallenges": ["<challenge1>", "<challenge2>"],
  "dominantTopics": ["<topic1>", "<topic2>"],
  "worldviewIndicators": {
    "faithLevel": "<exploring|growing|mature|mentoring>",
    "biblicalLiteracy": "<beginner|intermediate|advanced>",
    "communityConnection": "<isolated|seeking|connected|leading>"
  },
  "bibleReferencesDiscussed": ["<ref1>", "<ref2>"],
  "confidenceScore": <0-100>
}

CRITICAL GUIDELINES:

1. STRUGGLES (Only when spiritualStruggle domain is relevant):
   - Categories: temptation, addiction, pornography, lust, anger, bitterness, unforgiveness, doubt, anxiety, depression, grief, financial_stress, relational_conflict, integrity_issue, identity_crisis, fear, pride, laziness, gluttony, gossip, envy
   - Store SHORT evidenceTokens (3-5 words each), NEVER full quotes
   - Require confidence >= 60 to include

2. STRENGTHS (Only when spiritualStrength domain is relevant):
   - Categories: love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self_control, generosity, hospitality, wisdom, discernment, courage, humility, gratitude, perseverance
   - Same evidence token rules as struggles

3. SPIRITUAL GIFTS:
   - Beyond Five-Fold: healing, miracles, tongues, interpretation, knowledge, wisdom, discernment, faith, giving, mercy, administration, exhortation, intercession, craftsmanship
   - Only include when clearly evidenced

4. COMMANDMENT CUES (Coaching signals, NOT moral verdicts):
   - These help the system adapt its pastoral approach
   - NEVER surface these to the user as accusations
   - High threshold required (confidence >= 75)

5. LOVE OF GOD ORIENTATION:
   - Defined as: orientation toward obedience and desire to align with Scripture
   - Conservative scoring, require strong evidence
   - NOT a judgment, just a coaching signal for persona adaptation

6. CONFIDENCE GATING:
   - If confidence < 60, store the field as null
   - Sensitive fields (struggles, commandmentCues) require confidence >= 75
   - "insufficient_data" is a valid state - don't guess

7. PRIVACY NOTE:
   - This analysis is for internal coaching only
   - NEVER store full user quotes
   - Evidence tokens should be 3-5 word summaries

8. SEX/GENDER:
   - NEVER infer sex/gender from name, writing style, or personality
   - Sex/gender is ONLY stored when user explicitly declares it
   - Do not include any sex/gender inference in this analysis

Return ONLY valid JSON, no additional text.`;

/**
 * Check if conversation is private (excluded from analytics)
 * @param {string} conversationId - Conversation ID
 * @returns {boolean} True if conversation is private
 */
async function isConversationPrivate(conversationId) {
  const database = require('../database');
  const result = await database.query(
    'SELECT is_private FROM conversations WHERE id = $1',
    [conversationId]
  );
  return result.rows[0]?.is_private === true;
}

/**
 * Pass 1: Classify relevance of domains
 * @param {string} userMessage - User's message
 * @param {string} aiResponse - AI's response
 * @returns {Object} Relevance classification
 */
async function classifyRelevance(userMessage, aiResponse) {
  const prompt = `Classify this conversation:

USER: ${userMessage.substring(0, 1000)}

AI: ${aiResponse.substring(0, 500)}

Return the relevance classification JSON.`;

  try {
    const result = await AIService.generateResponse({
      systemPrompt: RELEVANCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1024,
      temperature: 0.2
    });

    let jsonStr = result.content || result;
    if (typeof jsonStr !== 'string') jsonStr = JSON.stringify(jsonStr);
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return JSON.parse(jsonStr);
  } catch (error) {
    logger.warn('Relevance classification failed, using defaults', { error: error.message });
    return {
      domainsRelevant: {},
      translationRequested: false,
      primaryLanguage: 'en'
    };
  }
}

/**
 * Analyze a user message and AI response (Two-Pass Evaluation)
 * @param {Object} options - Analysis options
 * @returns {Object} Analysis result
 */
async function analyzeMessage(options) {
  const startTime = Date.now();
  const {
    userId,
    messageId,
    conversationId,
    personaId = null,
    sessionId = null,
    userMessage,
    aiResponse
  } = options;

  try {
    // Check if user has analytics consent
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.analyticsConsent) {
      logger.debug('Skipping analysis - user has not consented', { userId });
      return { skipped: true, reason: 'no_consent' };
    }

    // Check if conversation is private (hard gatekeeper)
    const isPrivate = await isConversationPrivate(conversationId);
    if (isPrivate) {
      logger.debug('Skipping analysis - conversation is private', { conversationId });
      return { skipped: true, reason: 'private_conversation' };
    }

    // Check for existing analysis (idempotent)
    const existingAnalysis = await ConversationAnalysis.existsForMessage(messageId);
    if (existingAnalysis) {
      logger.debug('Analysis already exists for message', { messageId });
      return { skipped: true, reason: 'already_analyzed' };
    }

    // ========== PASS 1: Relevance Classification ==========
    const relevance = await classifyRelevance(userMessage, aiResponse);
    const domainsRelevant = relevance.domainsRelevant || {};

    // Build list of relevant domains for pass 2
    const relevantDomainsList = Object.entries(domainsRelevant)
      .filter(([_, v]) => v?.relevant === true)
      .map(([k]) => k);

    logger.debug('Pass 1 complete', {
      messageId,
      relevantDomains: relevantDomainsList,
      translationRequested: relevance.translationRequested
    });

    // ========== PASS 2: Full Analysis ==========
    const analysisPrompt = `RELEVANT_DOMAINS: ${JSON.stringify(relevantDomainsList)}

Analyze this conversation exchange:

USER MESSAGE:
${userMessage}

AI RESPONSE:
${aiResponse}

Provide your comprehensive analysis as JSON. Only analyze the relevant domains deeply.`;

    const aiResult = await AIService.generateResponse({
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: analysisPrompt }],
      maxTokens: 4096,
      temperature: 0.3
    });

    // Parse the JSON response
    let analysisData;
    try {
      let jsonStr = aiResult.content || aiResult;
      if (typeof jsonStr !== 'string') jsonStr = JSON.stringify(jsonStr);
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisData = JSON.parse(jsonStr);
    } catch (parseError) {
      logger.error('Failed to parse analysis JSON', {
        messageId,
        error: parseError.message,
        rawResponse: (aiResult.content || '').substring(0, 500)
      });
      throw new Error('Invalid analysis response format');
    }

    // Normalize and apply confidence gating
    const normalizedData = normalizeAnalysisData(analysisData, domainsRelevant);

    // Calculate processing time
    const processingTimeMs = Date.now() - startTime;

    // Persist the analysis
    const savedAnalysis = await ConversationAnalysis.create({
      userId,
      messageId,
      conversationId,
      personaId,
      sessionId,
      // Sentiment
      sentimentScore: normalizedData.sentiment.score,
      sentimentLabel: normalizedData.sentiment.label,
      // Emotions
      emotions: normalizedData.emotions,
      // Five-Fold
      fiveFold: normalizedData.fiveFold,
      // MBTI
      mbti: normalizedData.mbti,
      // Faith-Spectrum
      faithSpectrum: normalizedData.faithSpectrum,
      // Predictive
      predictive: normalizedData.predictive,
      deceptionIndex: normalizedData.deceptionIndex,
      deceptionMarkers: normalizedData.deceptionMarkers,
      // Denominational
      denominationalLeanings: normalizedData.denominationalLeanings,
      // Safeguarding
      safeguarding: normalizedData.safeguarding,
      // Life-Domains
      domainRelevance: normalizedData.domainRelevance,
      lifeDomains: normalizedData.lifeDomains,
      // New fields (Migration 056)
      confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
      domainsEvaluated: relevantDomainsList,
      inferredLanguage: normalizedData.inferredLanguage,
      inferredLanguageConfidence: normalizedData.inferredLanguageConfidence,
      translationRequested: normalizedData.translationRequested,
      struggles: normalizedData.struggles,
      struggleRelevanceTriggered: relevantDomainsList.includes('spiritualStruggle'),
      strengths: normalizedData.strengths,
      spiritualGifts: normalizedData.spiritualGifts,
      spiritualHealth: normalizedData.spiritualHealth,
      commandmentCues: normalizedData.commandmentCues,
      loveOfGodOrientation: normalizedData.loveOfGodOrientation,
      loveOfGodConfidence: normalizedData.loveOfGodConfidence,
      doctrinalPosture: normalizedData.doctrinalPosture,
      discipleshipReadiness: normalizedData.discipleshipReadiness,
      discipleshipReadinessConfidence: normalizedData.discipleshipReadinessConfidence,
      discipleshipIndicators: normalizedData.discipleshipIndicators,
      communityOrientation: normalizedData.communityOrientation,
      traumaSensitivityCues: normalizedData.traumaSensitivityCues,
      gentleToneRecommended: normalizedData.gentleToneRecommended,
      conflictPosture: normalizedData.conflictPosture,
      conflictPostureConfidence: normalizedData.conflictPostureConfidence,
      learningStyle: normalizedData.learningStyle,
      spiritualPractices: normalizedData.spiritualPractices,
      // Insights
      primaryNeeds: normalizedData.primaryNeeds,
      primaryChallenges: normalizedData.primaryChallenges,
      dominantTopics: normalizedData.dominantTopics,
      worldviewIndicators: normalizedData.worldviewIndicators,
      bibleReferencesDiscussed: normalizedData.bibleReferencesDiscussed,
      // Metadata
      analysisVersion: '3.0',
      promptVersion: '3.0',
      modelUsed: 'gpt-4o-mini',
      processingTimeMs,
      confidenceScore: normalizedData.confidenceScore
    });

    logger.info('Conversation analysis completed (v3)', {
      messageId,
      userId,
      processingTimeMs,
      confidenceScore: normalizedData.confidenceScore,
      domainsAnalyzed: relevantDomainsList.length,
      strugglesDetected: normalizedData.struggles?.length || 0,
      gentleTone: normalizedData.gentleToneRecommended
    });

    // ========== SAFEGUARD ANALYSIS ==========
    // Run safety detection and persona performance evaluation
    // This is privacy-gated internally by SafeguardService
    let safeguardResult = null;
    try {
      // Get persona details for performance evaluation
      let personaName = null;
      let personaDescription = null;
      if (personaId) {
        const Persona = require('../models/Persona');
        const persona = await Persona.findById(personaId);
        if (persona) {
          personaName = persona.name;
          personaDescription = persona.shortBio || persona.description;
        }
      }

      safeguardResult = await SafeguardService.analyzeSafeguards({
        userId,
        conversationId,
        messageId,
        personaId,
        sessionId,
        userMessage,
        aiResponse,
        personaName,
        personaDescription
      });

      if (!safeguardResult.skipped) {
        logger.info('Safeguard analysis completed', {
          messageId,
          flagsDetected: safeguardResult.safetyFlags?.length || 0,
          alertsGenerated: safeguardResult.alertsGenerated || 0,
          overallRisk: safeguardResult.overallRisk
        });

        // Update conversation_analysis record with safeguard info
        if (safeguardResult.safetyFlags?.length > 0 || safeguardResult.personaPerformance) {
          await ConversationAnalysis.updateSafeguardInfo(messageId, {
            safeguardAnalyzed: true,
            safeguardFlagsGenerated: safeguardResult.safetyFlags?.length || 0,
            personaPerformanceId: safeguardResult.personaPerformance || null
          });
        }
      }
    } catch (safeguardError) {
      // Log but don't fail the main analysis if safeguard fails
      logger.error('Safeguard analysis failed (non-blocking)', {
        messageId,
        error: safeguardError.message
      });
    }

    return {
      success: true,
      analysis: savedAnalysis,
      safeguard: safeguardResult
    };

  } catch (error) {
    logger.error('Conversation analysis failed', {
      messageId,
      userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Normalize and validate analysis data with confidence gating
 * @param {Object} data - Raw analysis data from AI
 * @param {Object} domainsRelevant - Relevance flags from Pass 1
 * @returns {Object} Normalized data
 */
function normalizeAnalysisData(data, domainsRelevant = {}) {
  const clamp = (val, min = 0, max = 100) => {
    const num = parseInt(val) || 0;
    return Math.max(min, Math.min(max, num));
  };

  const clampOrNull = (val) => {
    if (val === null || val === undefined) return null;
    return clamp(val);
  };

  /**
   * Apply confidence gating: return null if confidence below threshold
   */
  const gatedScore = (obj, threshold = DEFAULT_CONFIDENCE_THRESHOLD) => {
    if (!obj || typeof obj !== 'object') return { score: null, confidence: null };
    const score = obj.score !== null && obj.score !== undefined ? clamp(obj.score) : null;
    const confidence = obj.confidence !== null ? clamp(obj.confidence) : null;
    if (confidence === null || confidence < threshold) {
      return { score: null, confidence };
    }
    return { score, confidence };
  };

  /**
   * Apply sensitive confidence gating (higher threshold)
   */
  const sensitiveGatedScore = (obj) => gatedScore(obj, SENSITIVE_CONFIDENCE_THRESHOLD);

  const validLabels = ['negative', 'slightly_negative', 'neutral', 'slightly_positive', 'positive'];
  const sentimentLabel = validLabels.includes(data.sentiment?.label)
    ? data.sentiment.label
    : 'neutral';

  // Process struggles with confidence gating
  const struggles = Array.isArray(data.struggles)
    ? data.struggles
        .filter(s => s.confidence >= SENSITIVE_CONFIDENCE_THRESHOLD)
        .map(s => ({
          key: String(s.key || '').substring(0, 50),
          score: clamp(s.score),
          confidence: clamp(s.confidence),
          evidenceTokens: Array.isArray(s.evidenceTokens)
            ? s.evidenceTokens.slice(0, 5).map(t => String(t).substring(0, 50))
            : []
        }))
        .slice(0, 10)
    : [];

  // Process strengths
  const strengths = Array.isArray(data.strengths)
    ? data.strengths
        .filter(s => s.confidence >= DEFAULT_CONFIDENCE_THRESHOLD)
        .map(s => ({
          key: String(s.key || '').substring(0, 50),
          score: clamp(s.score),
          confidence: clamp(s.confidence),
          evidenceTokens: Array.isArray(s.evidenceTokens)
            ? s.evidenceTokens.slice(0, 5).map(t => String(t).substring(0, 50))
            : []
        }))
        .slice(0, 10)
    : [];

  // Process spiritual gifts
  const spiritualGifts = Array.isArray(data.spiritualGifts)
    ? data.spiritualGifts
        .filter(g => g.confidence >= DEFAULT_CONFIDENCE_THRESHOLD)
        .map(g => ({
          giftKey: String(g.giftKey || '').substring(0, 50),
          score: clamp(g.score),
          confidence: clamp(g.confidence),
          evidenceTokens: Array.isArray(g.evidenceTokens)
            ? g.evidenceTokens.slice(0, 5).map(t => String(t).substring(0, 50))
            : []
        }))
        .slice(0, 10)
    : [];

  // Process spiritual health with confidence gating
  const sh = data.spiritualHealth || {};
  const spiritualHealth = {
    prayerOpenness: gatedScore(sh.prayerOpenness).score,
    prayerOpennessConfidence: gatedScore(sh.prayerOpenness).confidence,
    faithMindedness: gatedScore(sh.faithMindedness).score,
    faithMindednessConfidence: gatedScore(sh.faithMindedness).confidence,
    worldlinessIndex: gatedScore(sh.worldlinessIndex).score,
    worldlinessIndexConfidence: gatedScore(sh.worldlinessIndex).confidence,
    healthConscientiousness: gatedScore(sh.healthConscientiousness).score,
    healthConscientiousnessConfidence: gatedScore(sh.healthConscientiousness).confidence,
    moneyAttachmentRisk: gatedScore(sh.moneyAttachmentRisk).score,
    moneyAttachmentConfidence: gatedScore(sh.moneyAttachmentRisk).confidence,
    forgivenessPosture: gatedScore(sh.forgivenessPosture).score,
    forgivenessPostureConfidence: gatedScore(sh.forgivenessPosture).confidence,
    scriptureLiteracy: gatedScore(sh.scriptureLiteracy).score,
    scriptureLiteracyConfidence: gatedScore(sh.scriptureLiteracy).confidence,
    maturityLevel: gatedScore(sh.maturityLevel).score,
    maturityLevelConfidence: gatedScore(sh.maturityLevel).confidence
  };

  // Process commandment cues with sensitive gating
  const cc = data.commandmentCues || {};
  const commandmentCues = {
    idolatryCue: sensitiveGatedScore(cc.idolatryCue),
    covetousnessCue: sensitiveGatedScore(cc.covetousnessCue),
    deceptionCue: sensitiveGatedScore(cc.deceptionCue),
    unforgivenessCue: sensitiveGatedScore(cc.unforgivenessCue),
    sexualTemptationCue: sensitiveGatedScore(cc.sexualTemptationCue),
    integrityCue: sensitiveGatedScore(cc.integrityCue)
  };

  // Love of God orientation (high threshold)
  const log = sensitiveGatedScore(data.loveOfGodOrientation);

  // Doctrinal posture
  const dp = data.doctrinalPosture || {};
  const doctrinalPosture = {
    scriptureAuthority: gatedScore(dp.scriptureAuthority),
    traditionAuthority: gatedScore(dp.traditionAuthority),
    experientialEmphasis: gatedScore(dp.experientialEmphasis),
    skepticismEmphasis: gatedScore(dp.skepticismEmphasis),
    opennessToCorrection: gatedScore(dp.opennessToCorrection)
  };

  // Discipleship readiness
  const dr = gatedScore(data.discipleshipReadiness);
  const di = data.discipleshipIndicators || {};
  const discipleshipIndicators = {
    readingPlan: clampOrNull(di.readingPlan),
    prayerHabit: clampOrNull(di.prayerHabit),
    confession: clampOrNull(di.confession),
    restitution: clampOrNull(di.restitution),
    forgiveness: clampOrNull(di.forgiveness),
    accountability: clampOrNull(di.accountability),
    serving: clampOrNull(di.serving)
  };

  // Community orientation
  const co = data.communityOrientation || {};
  const communityOrientation = {
    isolationRisk: gatedScore(co.isolationRisk).score,
    isolationRiskConfidence: gatedScore(co.isolationRisk).confidence,
    fellowshipDesire: gatedScore(co.fellowshipDesire).score,
    fellowshipDesireConfidence: gatedScore(co.fellowshipDesire).confidence,
    leadershipReadiness: gatedScore(co.leadershipReadiness).score,
    leadershipReadinessConfidence: gatedScore(co.leadershipReadiness).confidence,
    counselSeeking: gatedScore(co.counselSeeking).score,
    counselSeekingConfidence: gatedScore(co.counselSeeking).confidence
  };

  // Trauma sensitivity
  const traumaSensitivityCues = Array.isArray(data.traumaSensitivityCues)
    ? data.traumaSensitivityCues
        .filter(t => t.confidence >= DEFAULT_CONFIDENCE_THRESHOLD)
        .map(t => ({
          cueType: String(t.cueType || '').substring(0, 50),
          confidence: clamp(t.confidence)
        }))
        .slice(0, 10)
    : [];

  // Conflict posture
  const cp = gatedScore(data.conflictPosture);

  // Learning style
  const ls = data.learningStyle || {};
  const learningStyle = {
    practicalSteps: clamp(ls.practicalSteps),
    storytelling: clamp(ls.storytelling),
    theologicalDepth: clamp(ls.theologicalDepth),
    shortAnswers: clamp(ls.shortAnswers)
  };

  // Spiritual practices
  const spiritualPractices = Array.isArray(data.spiritualPractices)
    ? data.spiritualPractices
        .filter(p => p.confidence >= DEFAULT_CONFIDENCE_THRESHOLD)
        .map(p => ({
          practiceKey: String(p.practiceKey || '').substring(0, 50),
          frequency: ['expressed', 'implied', 'rare'].includes(p.frequency) ? p.frequency : 'implied',
          importance: clamp(p.importance),
          confidence: clamp(p.confidence)
        }))
        .slice(0, 10)
    : [];

  return {
    sentiment: {
      score: clamp(data.sentiment?.score, 0, 100),
      label: sentimentLabel
    },
    emotions: {
      confusion: clamp(data.emotions?.confusion),
      hope: clamp(data.emotions?.hope),
      relief: clamp(data.emotions?.relief),
      pressure: clamp(data.emotions?.pressure),
      safety: clamp(data.emotions?.safety),
      joy: clamp(data.emotions?.joy),
      grief: clamp(data.emotions?.grief),
      anxiety: clamp(data.emotions?.anxiety),
      peace: clamp(data.emotions?.peace),
      frustration: clamp(data.emotions?.frustration)
    },
    fiveFold: {
      apostle: clamp(data.fiveFold?.apostle),
      prophet: clamp(data.fiveFold?.prophet),
      evangelist: clamp(data.fiveFold?.evangelist),
      pastor: clamp(data.fiveFold?.pastor),
      teacher: clamp(data.fiveFold?.teacher)
    },
    mbti: {
      eI: clamp(data.mbti?.eI, 0, 100),
      sN: clamp(data.mbti?.sN, 0, 100),
      tF: clamp(data.mbti?.tF, 0, 100),
      jP: clamp(data.mbti?.jP, 0, 100)
    },
    faithSpectrum: {
      atheistTendency: clamp(data.faithSpectrum?.atheistTendency),
      traditionalTendency: clamp(data.faithSpectrum?.traditionalTendency),
      actsBelieverTendency: clamp(data.faithSpectrum?.actsBelieverTendency)
    },
    predictive: {
      subscribeLikelihood: clamp(data.predictive?.subscribeLikelihood, 0, 100),
      benefitLikelihood: clamp(data.predictive?.benefitLikelihood, 0, 100),
      retentionLikelihood: clamp(data.predictive?.retentionLikelihood, 0, 100),
      gospelAdoption: clamp(data.predictive?.gospelAdoption, 0, 100)
    },
    deceptionIndex: clamp(data.deceptionIndex),
    deceptionMarkers: Array.isArray(data.deceptionMarkers)
      ? data.deceptionMarkers.slice(0, 10).map(m => String(m).substring(0, 100))
      : [],
    denominationalLeanings: {
      baptist: clamp(data.denominationalLeanings?.baptist),
      pentecostal: clamp(data.denominationalLeanings?.pentecostal),
      catholic: clamp(data.denominationalLeanings?.catholic),
      reformed: clamp(data.denominationalLeanings?.reformed),
      charismatic: clamp(data.denominationalLeanings?.charismatic),
      orthodox: clamp(data.denominationalLeanings?.orthodox),
      nondenominational: clamp(data.denominationalLeanings?.nondenominational),
      mainline: clamp(data.denominationalLeanings?.mainline),
      messianic: clamp(data.denominationalLeanings?.messianic)
    },
    safeguarding: {
      cultRiskScore: clamp(data.safeguarding?.cultRiskScore),
      cultSusceptibilityScore: clamp(data.safeguarding?.cultSusceptibilityScore),
      cultRiskMarkers: Array.isArray(data.safeguarding?.cultRiskMarkers)
        ? data.safeguarding.cultRiskMarkers.slice(0, 10).map(m => String(m).substring(0, 100))
        : []
    },
    domainRelevance: data.domainRelevance || domainsRelevant,
    lifeDomains: {
      financialHealth: clampOrNull(data.lifeDomains?.financialHealth),
      familyHealth: clampOrNull(data.lifeDomains?.familyHealth),
      marriageHealth: clampOrNull(data.lifeDomains?.marriageHealth),
      parentingHealth: clampOrNull(data.lifeDomains?.parentingHealth),
      socialHealth: clampOrNull(data.lifeDomains?.socialHealth),
      emotionalResilience: clampOrNull(data.lifeDomains?.emotionalResilience)
    },
    // New fields
    inferredLanguage: data.inferredLanguage || null,
    inferredLanguageConfidence: clampOrNull(data.inferredLanguageConfidence),
    translationRequested: data.translationRequested === true,
    struggles,
    strengths,
    spiritualGifts,
    spiritualHealth,
    commandmentCues,
    loveOfGodOrientation: log.score,
    loveOfGodConfidence: log.confidence,
    doctrinalPosture,
    discipleshipReadiness: dr.score,
    discipleshipReadinessConfidence: dr.confidence,
    discipleshipIndicators,
    communityOrientation,
    traumaSensitivityCues,
    gentleToneRecommended: data.gentleToneRecommended === true || traumaSensitivityCues.length > 0,
    conflictPosture: cp.score,
    conflictPostureConfidence: cp.confidence,
    learningStyle,
    spiritualPractices,
    // Insights
    primaryNeeds: Array.isArray(data.primaryNeeds) ? data.primaryNeeds.slice(0, 5) : [],
    primaryChallenges: Array.isArray(data.primaryChallenges) ? data.primaryChallenges.slice(0, 5) : [],
    dominantTopics: Array.isArray(data.dominantTopics) ? data.dominantTopics.slice(0, 10) : [],
    worldviewIndicators: data.worldviewIndicators || {},
    bibleReferencesDiscussed: Array.isArray(data.bibleReferencesDiscussed) ? data.bibleReferencesDiscussed : [],
    confidenceScore: clamp(data.confidenceScore, 0, 100)
  };
}

/**
 * Get analytics summary for a user
 * @param {string} userId - User ID
 * @returns {Object} Analytics summary
 */
async function getUserAnalyticsSummary(userId) {
  try {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const currentMonth = await UserMonthlyAnalytics.findByUserAndMonth(userId, currentYearMonth);
    const totalAnalyses = await ConversationAnalysis.countByUserId(userId);
    const recentAnalyses = await ConversationAnalysis.getRecent(userId, 10);
    const deceptionTrend = await ConversationAnalysis.getDeceptionTrend(userId);

    let recentSentimentAvg = 50;
    if (recentAnalyses.length > 0) {
      const sum = recentAnalyses.reduce((acc, a) => acc + (a.sentimentScore || 50), 0);
      recentSentimentAvg = Math.round(sum / recentAnalyses.length);
    }

    return {
      totalAnalyses,
      currentMonth: currentMonth ? {
        yearMonth: currentMonth.yearMonth,
        totalMessages: currentMonth.totalMessages,
        totalConversations: currentMonth.totalConversations,
        privateExcluded: currentMonth.privateConversationsExcluded,
        avgSentiment: currentMonth.avgSentiment,
        dominantEmotion: currentMonth.emotions?.dominant,
        dominantFivefold: currentMonth.fiveFold?.dominant,
        mbtiType: currentMonth.mbti?.likelyType,
        compositeScores: {
          engagementHealth: currentMonth.engagementHealth,
          loyaltyScore: currentMonth.loyaltyScore,
          growthScore: currentMonth.growthScore,
          satisfactionScore: currentMonth.satisfactionScore
        },
        faithSpectrum: currentMonth.faithSpectrum,
        predictive: currentMonth.predictive,
        safeguarding: currentMonth.safeguarding,
        denominationalLeanings: currentMonth.denominationalLeanings,
        dominantDenominationalLeaning: currentMonth.dominantDenominationalLeaning,
        spiritualHealth: currentMonth.spiritualHealth,
        topStruggles: currentMonth.topStruggles,
        topStrengths: currentMonth.topStrengths,
        traumaSensitivityFlagged: currentMonth.traumaSensitivityFlagged,
        gentleApproachRecommended: currentMonth.gentleApproachRecommended
      } : null,
      recentTrend: {
        sentimentAvg: recentSentimentAvg,
        analysisCount: recentAnalyses.length
      },
      deceptionTrend
    };
  } catch (error) {
    logger.error('Failed to get user analytics summary', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get detailed monthly analytics for a user
 * @param {string} userId - User ID
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @returns {Object} Monthly analytics
 */
async function getMonthlyAnalytics(userId, yearMonth) {
  try {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new Error('Invalid yearMonth format. Use YYYY-MM');
    }

    const analytics = await UserMonthlyAnalytics.findByUserAndMonth(userId, yearMonth);

    if (!analytics) {
      const calculated = await UserMonthlyAnalytics.calculateAndUpsert(userId, yearMonth);
      return calculated;
    }

    return analytics;
  } catch (error) {
    logger.error('Failed to get monthly analytics', { userId, yearMonth, error: error.message });
    throw error;
  }
}

/**
 * Get analytics history for a user
 * @param {string} userId - User ID
 * @param {number} months - Number of months to retrieve
 * @returns {Array} Monthly analytics array
 */
async function getAnalyticsHistory(userId, months = 12) {
  try {
    const analytics = await UserMonthlyAnalytics.findByUserId(userId, { limit: months });
    return analytics;
  } catch (error) {
    logger.error('Failed to get analytics history', { userId, error: error.message });
    throw error;
  }
}

/**
 * Update user's analytics consent
 * @param {string} userId - User ID
 * @param {boolean} consent - Consent value
 * @returns {Object} Updated user consent status
 */
async function updateAnalyticsConsent(userId, consent) {
  try {
    const updates = {
      analyticsConsent: consent,
      analyticsConsentAt: consent ? new Date() : null
    };

    const updatedUser = await User.update(userId, updates);

    logger.info('Analytics consent updated', { userId, consent });

    return {
      analyticsConsent: updatedUser.analyticsConsent,
      analyticsConsentAt: updatedUser.analyticsConsentAt
    };
  } catch (error) {
    logger.error('Failed to update analytics consent', { userId, error: error.message });
    throw error;
  }
}

/**
 * Update user's declared demographics (self-reported only)
 * @param {string} userId - User ID
 * @param {Object} demographics - Self-declared demographic fields
 * @returns {Object} Updated demographics
 */
async function updateDeclaredDemographics(userId, demographics) {
  try {
    const allowedFields = [
      'declaredDenomination',
      'declaredSex',
      'declaredPrimaryLanguage',
      'declaredSecondaryLanguages',
      'declaredLanguageInterests',
      'declaredChurchBackground',
      'declaredChurchAttendance',
      'declaredYearsBeliever',
      'declaredAgeRange',
      'declaredMaritalStatus',
      'declaredParentStatus'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (demographics[field] !== undefined) {
        updates[field] = demographics[field];
        // Add timestamp for sex declaration
        if (field === 'declaredSex') {
          updates.declaredSexAt = new Date();
        }
        if (field === 'declaredDenomination') {
          updates.declaredDenominationAt = new Date();
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.demographicsUpdatedAt = new Date();
    }

    const updatedUser = await User.update(userId, updates);

    logger.info('Declared demographics updated', { userId, fieldsUpdated: Object.keys(updates) });

    return {
      declaredDenomination: updatedUser.declaredDenomination,
      declaredSex: updatedUser.declaredSex,
      declaredPrimaryLanguage: updatedUser.declaredPrimaryLanguage,
      declaredSecondaryLanguages: updatedUser.declaredSecondaryLanguages,
      declaredLanguageInterests: updatedUser.declaredLanguageInterests,
      declaredChurchBackground: updatedUser.declaredChurchBackground,
      declaredChurchAttendance: updatedUser.declaredChurchAttendance,
      declaredYearsBeliever: updatedUser.declaredYearsBeliever,
      declaredAgeRange: updatedUser.declaredAgeRange,
      declaredMaritalStatus: updatedUser.declaredMaritalStatus,
      declaredParentStatus: updatedUser.declaredParentStatus,
      demographicsUpdatedAt: updatedUser.demographicsUpdatedAt
    };
  } catch (error) {
    logger.error('Failed to update declared demographics', { userId, error: error.message });
    throw error;
  }
}

/**
 * Delete all analytics data for a user (GDPR compliance)
 * @param {string} userId - User ID
 * @returns {Object} Deletion summary
 */
async function deleteUserAnalytics(userId) {
  try {
    const analysesDeleted = await ConversationAnalysis.deleteByUserId(userId);
    const monthlyDeleted = await UserMonthlyAnalytics.deleteByUserId(userId);

    await User.update(userId, {
      analyticsConsent: false,
      analyticsConsentAt: null
    });

    logger.info('User analytics deleted', { userId, analysesDeleted, monthlyDeleted });

    return {
      analysesDeleted,
      monthlyDeleted
    };
  } catch (error) {
    logger.error('Failed to delete user analytics', { userId, error: error.message });
    throw error;
  }
}

module.exports = {
  analyzeMessage,
  getUserAnalyticsSummary,
  getMonthlyAnalytics,
  getAnalyticsHistory,
  updateAnalyticsConsent,
  updateDeclaredDemographics,
  deleteUserAnalytics,
  DEFAULT_CONFIDENCE_THRESHOLD,
  SENSITIVE_CONFIDENCE_THRESHOLD
};
