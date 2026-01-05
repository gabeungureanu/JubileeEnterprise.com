-- ============================================
-- JubileeVerse Database Schema
-- Migration 056: Spiritual Demographics with Privacy Controls
-- ============================================
-- Implements:
-- - Self-declared demographics on user profile (sex/gender, languages, church background)
-- - Extensible per-interaction traits with confidence gating
-- - Spiritual health signals (struggles, strengths, gifts)
-- - Commandment alignment coaching signals
-- - Doctrinal posture and discipleship readiness
-- - Per-conversation privacy flag (is_private overrides all analytics)
-- - Strict consent enforcement
-- ============================================

-- ============================================
-- EXTEND users TABLE - Self-Declared Demographics
-- ============================================
DO $$
BEGIN
    -- Self-declared sex/gender (never inferred)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_sex'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_sex VARCHAR(20);
        COMMENT ON COLUMN users.declared_sex IS 'Self-declared sex/gender - NEVER inferred from name/writing style';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_sex_at'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_sex_at TIMESTAMPTZ;
    END IF;

    -- Primary language (self-declared profile attribute)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_primary_language'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_primary_language VARCHAR(10);
        COMMENT ON COLUMN users.declared_primary_language IS 'Self-declared primary language (ISO code)';
    END IF;

    -- Secondary languages (self-declared, JSON array)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_secondary_languages'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_secondary_languages JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN users.declared_secondary_languages IS 'Self-declared secondary languages (array of ISO codes)';
    END IF;

    -- Language interests (languages user wants to learn)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_language_interests'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_language_interests JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN users.declared_language_interests IS 'Languages user wants to learn or practice';
    END IF;

    -- Church background (self-declared)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_church_background'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_church_background VARCHAR(100);
        COMMENT ON COLUMN users.declared_church_background IS 'Self-declared church background/history';
    END IF;

    -- Current church attendance (self-declared)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_church_attendance'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_church_attendance VARCHAR(50);
        COMMENT ON COLUMN users.declared_church_attendance IS 'Self-declared: none, occasional, regular, leadership';
    END IF;

    -- Years as believer (self-declared)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_years_believer'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_years_believer INTEGER;
        COMMENT ON COLUMN users.declared_years_believer IS 'Self-declared years as believer (NULL if never/unsure)';
    END IF;

    -- Age range (self-declared for pastoral context)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_age_range'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_age_range VARCHAR(20);
        COMMENT ON COLUMN users.declared_age_range IS 'Self-declared age range: teen, young_adult, adult, senior';
    END IF;

    -- Marital status (self-declared)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_marital_status'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_marital_status VARCHAR(30);
        COMMENT ON COLUMN users.declared_marital_status IS 'Self-declared: single, dating, engaged, married, divorced, widowed';
    END IF;

    -- Parent status (self-declared)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_parent_status'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_parent_status VARCHAR(30);
        COMMENT ON COLUMN users.declared_parent_status IS 'Self-declared: no_children, expecting, young_children, teens, adult_children';
    END IF;

    -- Profile demographics last updated timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'demographics_updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN demographics_updated_at TIMESTAMPTZ;
        COMMENT ON COLUMN users.demographics_updated_at IS 'Last time user updated demographic information';
    END IF;
END $$;

-- ============================================
-- EXTEND conversations TABLE - Privacy Flag
-- ============================================
DO $$
BEGIN
    -- Per-conversation privacy override
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'is_private'
    ) THEN
        ALTER TABLE conversations ADD COLUMN is_private BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN conversations.is_private IS 'Privacy override - when TRUE, NO analytics are stored for this conversation';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'marked_private_at'
    ) THEN
        ALTER TABLE conversations ADD COLUMN marked_private_at TIMESTAMPTZ;
        COMMENT ON COLUMN conversations.marked_private_at IS 'Timestamp when conversation was marked private';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_is_private ON conversations(is_private) WHERE is_private = TRUE;

-- ============================================
-- EXTEND conversation_analysis TABLE - Extended Traits with Confidence
-- ============================================

-- ============================================
-- CONFIDENCE METADATA (applied to all inferred fields)
-- ============================================
DO $$
BEGIN
    -- Minimum confidence threshold used for this analysis
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'confidence_threshold'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN confidence_threshold SMALLINT DEFAULT 60;
        COMMENT ON COLUMN conversation_analysis.confidence_threshold IS 'Minimum confidence required to store inferred fields (0-100)';
    END IF;

    -- Analysis pass metadata (which domains were evaluated)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'domains_evaluated'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN domains_evaluated JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.domains_evaluated IS 'List of domains evaluated in pass one: [demographics, spiritual_struggle, prayer, doctrinal, ...]';
    END IF;
END $$;

-- ============================================
-- INFERRED LANGUAGE SIGNALS (with confidence)
-- ============================================
DO $$
BEGIN
    -- Inferred primary language from interaction patterns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'inferred_language'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN inferred_language VARCHAR(10);
        COMMENT ON COLUMN conversation_analysis.inferred_language IS 'Language inferred from this message (ISO code)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'inferred_language_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN inferred_language_confidence SMALLINT CHECK (inferred_language_confidence >= 0 AND inferred_language_confidence <= 100);
        COMMENT ON COLUMN conversation_analysis.inferred_language_confidence IS 'Confidence in language inference 0-100';
    END IF;

    -- Translation request detected (explicit user signal)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'translation_requested'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN translation_requested BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN conversation_analysis.translation_requested IS 'User explicitly requested translation in this message';
    END IF;
END $$;

-- ============================================
-- SPIRITUAL STRUGGLES (category tags with severity and confidence)
-- Only computed when relevance gate triggers
-- ============================================
DO $$
BEGIN
    -- Struggles array with structured schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'struggles'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN struggles JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.struggles IS 'Detected struggles: [{key, score(0-100), confidence(0-100), evidence_tokens[], last_seen}]';
    END IF;

    -- Struggle relevance gate result
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'struggle_relevance_triggered'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN struggle_relevance_triggered BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN conversation_analysis.struggle_relevance_triggered IS 'TRUE if content triggered spiritual struggle relevance gate';
    END IF;
END $$;

-- ============================================
-- SPIRITUAL STRENGTHS & GIFTS (category tags with confidence)
-- ============================================
DO $$
BEGIN
    -- Strengths array (fruit of the Spirit, virtues)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'strengths'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN strengths JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.strengths IS 'Detected strengths: [{key, score(0-100), confidence(0-100), evidence_tokens[]}]';
    END IF;

    -- Spiritual gifts indicators
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'spiritual_gifts'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN spiritual_gifts JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.spiritual_gifts IS 'Detected gift indicators beyond Five-Fold: [{gift_key, score, confidence, evidence_tokens[]}]';
    END IF;
END $$;

-- ============================================
-- SPIRITUAL HEALTH INDICATORS (0-100 with confidence)
-- Only computed when relevant, NULL if below threshold
-- ============================================
DO $$
BEGIN
    -- Prayer openness
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'prayer_openness'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN prayer_openness SMALLINT CHECK (prayer_openness >= 0 AND prayer_openness <= 100);
        COMMENT ON COLUMN conversation_analysis.prayer_openness IS 'Openness to prayer 0-100 (NULL if not relevant/insufficient evidence)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'prayer_openness_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN prayer_openness_confidence SMALLINT CHECK (prayer_openness_confidence >= 0 AND prayer_openness_confidence <= 100);
    END IF;

    -- Faith-mindedness vs doubt-mindedness
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'faith_mindedness'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN faith_mindedness SMALLINT CHECK (faith_mindedness >= 0 AND faith_mindedness <= 100);
        COMMENT ON COLUMN conversation_analysis.faith_mindedness IS 'Faith orientation 0-100 (0=doubt-dominated, 100=faith-dominated)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'faith_mindedness_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN faith_mindedness_confidence SMALLINT CHECK (faith_mindedness_confidence >= 0 AND faith_mindedness_confidence <= 100);
    END IF;

    -- Worldliness index
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'worldliness_index'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN worldliness_index SMALLINT CHECK (worldliness_index >= 0 AND worldliness_index <= 100);
        COMMENT ON COLUMN conversation_analysis.worldliness_index IS 'Worldly vs spiritual orientation 0-100 (0=spiritually-minded, 100=worldly-minded)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'worldliness_index_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN worldliness_index_confidence SMALLINT CHECK (worldliness_index_confidence >= 0 AND worldliness_index_confidence <= 100);
    END IF;

    -- Health conscientiousness
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'health_conscientiousness'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN health_conscientiousness SMALLINT CHECK (health_conscientiousness >= 0 AND health_conscientiousness <= 100);
        COMMENT ON COLUMN conversation_analysis.health_conscientiousness IS 'Physical health awareness/stewardship 0-100 (NULL if not discussed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'health_conscientiousness_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN health_conscientiousness_confidence SMALLINT CHECK (health_conscientiousness_confidence >= 0 AND health_conscientiousness_confidence <= 100);
    END IF;

    -- Money attachment / greed risk
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'money_attachment_risk'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN money_attachment_risk SMALLINT CHECK (money_attachment_risk >= 0 AND money_attachment_risk <= 100);
        COMMENT ON COLUMN conversation_analysis.money_attachment_risk IS 'Money attachment/greed indicators 0-100 (NULL if financial topics not discussed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'money_attachment_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN money_attachment_confidence SMALLINT CHECK (money_attachment_confidence >= 0 AND money_attachment_confidence <= 100);
    END IF;

    -- Forgiveness posture
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'forgiveness_posture'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN forgiveness_posture SMALLINT CHECK (forgiveness_posture >= 0 AND forgiveness_posture <= 100);
        COMMENT ON COLUMN conversation_analysis.forgiveness_posture IS 'Willingness to forgive 0-100 (0=bitter/unforgiving, 100=readily forgiving)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'forgiveness_posture_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN forgiveness_posture_confidence SMALLINT CHECK (forgiveness_posture_confidence >= 0 AND forgiveness_posture_confidence <= 100);
    END IF;

    -- Scripture literacy
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'scripture_literacy'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN scripture_literacy SMALLINT CHECK (scripture_literacy >= 0 AND scripture_literacy <= 100);
        COMMENT ON COLUMN conversation_analysis.scripture_literacy IS 'Biblical knowledge/familiarity 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'scripture_literacy_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN scripture_literacy_confidence SMALLINT CHECK (scripture_literacy_confidence >= 0 AND scripture_literacy_confidence <= 100);
    END IF;

    -- Spiritual maturity level
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'maturity_level'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN maturity_level SMALLINT CHECK (maturity_level >= 0 AND maturity_level <= 100);
        COMMENT ON COLUMN conversation_analysis.maturity_level IS 'Spiritual maturity estimate 0-100 (0=new believer/seeker, 100=mature disciple)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'maturity_level_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN maturity_level_confidence SMALLINT CHECK (maturity_level_confidence >= 0 AND maturity_level_confidence <= 100);
    END IF;
END $$;

-- ============================================
-- COMMANDMENT ALIGNMENT (coaching signals, not moral verdicts)
-- ============================================
DO $$
BEGIN
    -- Commandment alignment cues (topical flags with intensity)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'commandment_cues'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN commandment_cues JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN conversation_analysis.commandment_cues IS 'Coaching signals: {idolatry_cue, covetousness_cue, deception_cue, unforgiveness_cue, sexual_temptation_cue, integrity_cue} each with {score, confidence}';
    END IF;

    -- Love of God orientation (desire to obey, align with Scripture)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'love_of_god_orientation'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN love_of_god_orientation SMALLINT CHECK (love_of_god_orientation >= 0 AND love_of_god_orientation <= 100);
        COMMENT ON COLUMN conversation_analysis.love_of_god_orientation IS 'Orientation toward obedience/Scripture alignment 0-100 (high threshold required)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'love_of_god_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN love_of_god_confidence SMALLINT CHECK (love_of_god_confidence >= 0 AND love_of_god_confidence <= 100);
    END IF;
END $$;

-- ============================================
-- DOCTRINAL POSTURE (distribution of emphasis)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'doctrinal_posture'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN doctrinal_posture JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN conversation_analysis.doctrinal_posture IS 'Doctrinal emphasis distribution: {scripture_authority, tradition_authority, experiential_emphasis, skepticism_emphasis, openness_to_correction} each 0-100 with confidence';
    END IF;
END $$;

-- ============================================
-- DISCIPLESHIP READINESS
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'discipleship_readiness'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN discipleship_readiness SMALLINT CHECK (discipleship_readiness >= 0 AND discipleship_readiness <= 100);
        COMMENT ON COLUMN conversation_analysis.discipleship_readiness IS 'Willingness to take action steps 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'discipleship_readiness_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN discipleship_readiness_confidence SMALLINT CHECK (discipleship_readiness_confidence >= 0 AND discipleship_readiness_confidence <= 100);
    END IF;

    -- Specific readiness indicators
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'discipleship_indicators'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN discipleship_indicators JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN conversation_analysis.discipleship_indicators IS 'Specific readiness: {reading_plan, prayer_habit, confession, restitution, forgiveness, accountability, serving} each 0-100';
    END IF;
END $$;

-- ============================================
-- COMMUNITY ORIENTATION
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'isolation_risk'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN isolation_risk SMALLINT CHECK (isolation_risk >= 0 AND isolation_risk <= 100);
        COMMENT ON COLUMN conversation_analysis.isolation_risk IS 'Risk of spiritual isolation 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'isolation_risk_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN isolation_risk_confidence SMALLINT CHECK (isolation_risk_confidence >= 0 AND isolation_risk_confidence <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'fellowship_desire'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN fellowship_desire SMALLINT CHECK (fellowship_desire >= 0 AND fellowship_desire <= 100);
        COMMENT ON COLUMN conversation_analysis.fellowship_desire IS 'Desire for Christian community/fellowship 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'fellowship_desire_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN fellowship_desire_confidence SMALLINT CHECK (fellowship_desire_confidence >= 0 AND fellowship_desire_confidence <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'leadership_readiness'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN leadership_readiness SMALLINT CHECK (leadership_readiness >= 0 AND leadership_readiness <= 100);
        COMMENT ON COLUMN conversation_analysis.leadership_readiness IS 'Readiness for spiritual leadership 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'leadership_readiness_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN leadership_readiness_confidence SMALLINT CHECK (leadership_readiness_confidence >= 0 AND leadership_readiness_confidence <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'counsel_seeking'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN counsel_seeking SMALLINT CHECK (counsel_seeking >= 0 AND counsel_seeking <= 100);
        COMMENT ON COLUMN conversation_analysis.counsel_seeking IS 'Willingness to seek counsel/advice 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'counsel_seeking_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN counsel_seeking_confidence SMALLINT CHECK (counsel_seeking_confidence >= 0 AND counsel_seeking_confidence <= 100);
    END IF;
END $$;

-- ============================================
-- TRAUMA SENSITIVITY & CONFLICT POSTURE
-- ============================================
DO $$
BEGIN
    -- Trauma sensitivity cues (for tone adaptation, NOT diagnosis)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'trauma_sensitivity_cues'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN trauma_sensitivity_cues JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.trauma_sensitivity_cues IS 'Trauma indicators for gentle tone: [{cue_type, confidence}] - NOT medical diagnosis';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'gentle_tone_recommended'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN gentle_tone_recommended BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN conversation_analysis.gentle_tone_recommended IS 'Flag to adopt extra-gentle pastoral approach';
    END IF;

    -- Conflict posture
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'conflict_posture'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN conflict_posture SMALLINT CHECK (conflict_posture >= 0 AND conflict_posture <= 100);
        COMMENT ON COLUMN conversation_analysis.conflict_posture IS 'Conflict handling: 0=combative, 50=neutral, 100=peacemaking';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'conflict_posture_confidence'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN conflict_posture_confidence SMALLINT CHECK (conflict_posture_confidence >= 0 AND conflict_posture_confidence <= 100);
    END IF;
END $$;

-- ============================================
-- LEARNING STYLE & SPIRITUAL PRACTICES
-- ============================================
DO $$
BEGIN
    -- Learning style preferences
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'learning_style'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN learning_style JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN conversation_analysis.learning_style IS 'Preferred styles: {practical_steps, storytelling, theological_depth, short_answers} each 0-100';
    END IF;

    -- Expressed spiritual practices
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'spiritual_practices'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN spiritual_practices JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.spiritual_practices IS 'Expressed practices: [{practice_key, frequency, importance, confidence}]';
    END IF;
END $$;

-- ============================================
-- AUDIT & ACCESS CONTROL METADATA
-- ============================================
DO $$
BEGIN
    -- Prompt version used for this analysis
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'prompt_version'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN prompt_version VARCHAR(20) DEFAULT '3.0';
        COMMENT ON COLUMN conversation_analysis.prompt_version IS 'Version of analysis prompt used for reproducibility';
    END IF;

    -- Access audit log (last accessed by, for RBAC logging)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'last_accessed_by'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN last_accessed_by UUID;
        COMMENT ON COLUMN conversation_analysis.last_accessed_by IS 'Last admin/system user who accessed this record';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'last_accessed_at'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN last_accessed_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================
-- EXTEND user_monthly_analytics TABLE
-- ============================================

-- Spiritual health monthly averages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_prayer_openness'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_prayer_openness DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_faith_mindedness'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_faith_mindedness DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_worldliness_index'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_worldliness_index DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_scripture_literacy'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_scripture_literacy DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_maturity_level'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_maturity_level DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_discipleship_readiness'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_discipleship_readiness DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_forgiveness_posture'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_forgiveness_posture DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_isolation_risk'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_isolation_risk DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_conflict_posture'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_conflict_posture DECIMAL(5,2);
    END IF;
END $$;

-- Struggles and strengths aggregates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'top_struggles'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN top_struggles JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.top_struggles IS 'Top struggles by frequency/severity: [{key, avg_score, occurrence_count}]';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'top_strengths'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN top_strengths JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.top_strengths IS 'Top strengths by frequency: [{key, avg_score, occurrence_count}]';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'spiritual_gifts_profile'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN spiritual_gifts_profile JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.spiritual_gifts_profile IS 'Aggregated gift indicators: [{gift_key, avg_score, evidence_count}]';
    END IF;
END $$;

-- Doctrinal and learning preferences
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'doctrinal_posture_summary'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN doctrinal_posture_summary JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.doctrinal_posture_summary IS 'Averaged doctrinal posture distribution';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'learning_style_summary'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN learning_style_summary JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.learning_style_summary IS 'Averaged learning style preferences';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'spiritual_practices_summary'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN spiritual_practices_summary JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.spiritual_practices_summary IS 'Aggregated spiritual practices';
    END IF;
END $$;

-- Safeguarding and sensitivity flags
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'trauma_sensitivity_flagged'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN trauma_sensitivity_flagged BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN user_monthly_analytics.trauma_sensitivity_flagged IS 'TRUE if trauma sensitivity cues detected this month';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'gentle_approach_recommended'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN gentle_approach_recommended BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN user_monthly_analytics.gentle_approach_recommended IS 'TRUE if gentle pastoral approach recommended';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'private_conversations_excluded'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN private_conversations_excluded INTEGER DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.private_conversations_excluded IS 'Count of private conversations excluded from this aggregation';
    END IF;
END $$;

-- Inferred language tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'inferred_languages'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN inferred_languages JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.inferred_languages IS 'Language usage this month: {lang_code: message_count}';
    END IF;
END $$;

-- ============================================
-- ANALYTICS ACCESS LOG TABLE (for RBAC auditing)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_by UUID NOT NULL,
    access_type VARCHAR(50) NOT NULL, -- 'view_analysis', 'view_monthly', 'export', etc.
    target_user_id UUID, -- The user whose data was accessed
    target_analysis_id UUID, -- Specific analysis record if applicable
    target_year_month VARCHAR(7), -- If monthly analytics
    access_fields JSONB DEFAULT '[]'::JSONB, -- Which sensitive fields were accessed
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_access_log_accessed_by ON analytics_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_analytics_access_log_target_user ON analytics_access_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_access_log_created_at ON analytics_access_log(created_at);

COMMENT ON TABLE analytics_access_log IS 'Audit log for access to sensitive analytics data';

-- ============================================
-- UPDATED AGGREGATION FUNCTION (v3 with privacy exclusion)
-- ============================================
CREATE OR REPLACE FUNCTION get_user_monthly_stats_v3(p_user_id UUID, p_year_month VARCHAR(7))
RETURNS TABLE (
    -- Base stats
    total_messages BIGINT,
    total_conversations BIGINT,
    unique_personas BIGINT,
    private_excluded BIGINT,
    -- Sentiment
    avg_sentiment NUMERIC,
    min_sentiment SMALLINT,
    max_sentiment SMALLINT,
    -- Emotions (abbreviated for space)
    avg_confusion NUMERIC, avg_hope NUMERIC, avg_relief NUMERIC, avg_pressure NUMERIC,
    avg_safety NUMERIC, avg_joy NUMERIC, avg_grief NUMERIC, avg_anxiety NUMERIC,
    avg_peace NUMERIC, avg_frustration NUMERIC,
    -- Five-Fold
    avg_apostle NUMERIC, avg_prophet NUMERIC, avg_evangelist NUMERIC, avg_pastor NUMERIC, avg_teacher NUMERIC,
    -- MBTI
    avg_e_i NUMERIC, avg_s_n NUMERIC, avg_t_f NUMERIC, avg_j_p NUMERIC,
    -- Faith-spectrum
    avg_faith_atheist NUMERIC, avg_faith_traditional NUMERIC, avg_faith_acts_believer NUMERIC,
    -- Predictive
    avg_subscribe_likelihood NUMERIC, avg_benefit_likelihood NUMERIC,
    avg_retention_likelihood NUMERIC, avg_gospel_adoption NUMERIC, avg_deception_index NUMERIC,
    -- Spiritual health indicators (new)
    avg_prayer_openness NUMERIC,
    avg_faith_mindedness NUMERIC,
    avg_worldliness_index NUMERIC,
    avg_scripture_literacy NUMERIC,
    avg_maturity_level NUMERIC,
    avg_discipleship_readiness NUMERIC,
    avg_forgiveness_posture NUMERIC,
    avg_isolation_risk NUMERIC,
    avg_conflict_posture NUMERIC,
    -- Safeguarding
    avg_cult_risk NUMERIC, max_cult_risk SMALLINT, avg_cult_susceptibility NUMERIC,
    -- Life-domains
    avg_financial_health NUMERIC, avg_family_health NUMERIC, avg_marriage_health NUMERIC,
    avg_parenting_health NUMERIC, avg_social_health NUMERIC, avg_emotional_resilience NUMERIC,
    -- Flags
    trauma_sensitivity_detected BOOLEAN,
    gentle_tone_recommended_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_messages,
        COUNT(DISTINCT ca.conversation_id)::BIGINT as total_conversations,
        COUNT(DISTINCT ca.persona_id)::BIGINT as unique_personas,
        -- Count excluded private conversations
        (SELECT COUNT(DISTINCT c.id) FROM conversations c
         WHERE c.user_id = p_user_id
         AND c.is_private = TRUE
         AND c.created_at >= (p_year_month || '-01')::DATE
         AND c.created_at < ((p_year_month || '-01')::DATE + INTERVAL '1 month'))::BIGINT as private_excluded,

        -- Sentiment
        ROUND(AVG(ca.sentiment_score)::NUMERIC, 2),
        MIN(ca.sentiment_score),
        MAX(ca.sentiment_score),

        -- Emotions
        ROUND(AVG(ca.emotion_confusion)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_hope)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_relief)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_pressure)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_safety)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_joy)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_grief)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_anxiety)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_peace)::NUMERIC, 2),
        ROUND(AVG(ca.emotion_frustration)::NUMERIC, 2),

        -- Five-Fold
        ROUND(AVG(ca.fivefold_apostle)::NUMERIC, 2),
        ROUND(AVG(ca.fivefold_prophet)::NUMERIC, 2),
        ROUND(AVG(ca.fivefold_evangelist)::NUMERIC, 2),
        ROUND(AVG(ca.fivefold_pastor)::NUMERIC, 2),
        ROUND(AVG(ca.fivefold_teacher)::NUMERIC, 2),

        -- MBTI
        ROUND(AVG(ca.mbti_e_i)::NUMERIC, 2),
        ROUND(AVG(ca.mbti_s_n)::NUMERIC, 2),
        ROUND(AVG(ca.mbti_t_f)::NUMERIC, 2),
        ROUND(AVG(ca.mbti_j_p)::NUMERIC, 2),

        -- Faith-spectrum
        ROUND(AVG(ca.faith_atheist_tendency)::NUMERIC, 2),
        ROUND(AVG(ca.faith_traditional_tendency)::NUMERIC, 2),
        ROUND(AVG(ca.faith_acts_believer_tendency)::NUMERIC, 2),

        -- Predictive
        ROUND(AVG(ca.predict_subscribe_likelihood)::NUMERIC, 2),
        ROUND(AVG(ca.predict_benefit_likelihood)::NUMERIC, 2),
        ROUND(AVG(ca.predict_retention_likelihood)::NUMERIC, 2),
        ROUND(AVG(ca.predict_gospel_adoption)::NUMERIC, 2),
        ROUND(AVG(ca.deception_index)::NUMERIC, 2),

        -- Spiritual health indicators (only where confidence met threshold)
        ROUND(AVG(CASE WHEN ca.prayer_openness_confidence >= ca.confidence_threshold THEN ca.prayer_openness END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.faith_mindedness_confidence >= ca.confidence_threshold THEN ca.faith_mindedness END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.worldliness_index_confidence >= ca.confidence_threshold THEN ca.worldliness_index END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.scripture_literacy_confidence >= ca.confidence_threshold THEN ca.scripture_literacy END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.maturity_level_confidence >= ca.confidence_threshold THEN ca.maturity_level END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.discipleship_readiness_confidence >= ca.confidence_threshold THEN ca.discipleship_readiness END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.forgiveness_posture_confidence >= ca.confidence_threshold THEN ca.forgiveness_posture END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.isolation_risk_confidence >= ca.confidence_threshold THEN ca.isolation_risk END)::NUMERIC, 2),
        ROUND(AVG(CASE WHEN ca.conflict_posture_confidence >= ca.confidence_threshold THEN ca.conflict_posture END)::NUMERIC, 2),

        -- Safeguarding
        ROUND(AVG(ca.cult_risk_score)::NUMERIC, 2),
        MAX(ca.cult_risk_score),
        ROUND(AVG(ca.cult_susceptibility_score)::NUMERIC, 2),

        -- Life-domains
        ROUND(AVG(ca.life_financial_health)::NUMERIC, 2),
        ROUND(AVG(ca.life_family_health)::NUMERIC, 2),
        ROUND(AVG(ca.life_marriage_health)::NUMERIC, 2),
        ROUND(AVG(ca.life_parenting_health)::NUMERIC, 2),
        ROUND(AVG(ca.life_social_health)::NUMERIC, 2),
        ROUND(AVG(ca.life_emotional_resilience)::NUMERIC, 2),

        -- Flags
        BOOL_OR(jsonb_array_length(ca.trauma_sensitivity_cues) > 0) as trauma_sensitivity_detected,
        COUNT(CASE WHEN ca.gentle_tone_recommended = TRUE THEN 1 END)::BIGINT as gentle_tone_recommended_count

    FROM conversation_analysis ca
    -- JOIN to exclude private conversations
    INNER JOIN conversations c ON ca.conversation_id = c.id AND c.is_private = FALSE
    WHERE ca.user_id = p_user_id
      AND ca.created_at >= (p_year_month || '-01')::DATE
      AND ca.created_at < ((p_year_month || '-01')::DATE + INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES FOR NEW COLUMNS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_struggles ON conversation_analysis USING GIN (struggles);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_strengths ON conversation_analysis USING GIN (strengths);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_spiritual_gifts ON conversation_analysis USING GIN (spiritual_gifts);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_commandment_cues ON conversation_analysis USING GIN (commandment_cues);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_doctrinal_posture ON conversation_analysis USING GIN (doctrinal_posture);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_trauma_cues ON conversation_analysis USING GIN (trauma_sensitivity_cues);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_gentle_tone ON conversation_analysis(gentle_tone_recommended) WHERE gentle_tone_recommended = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_struggle_triggered ON conversation_analysis(struggle_relevance_triggered) WHERE struggle_relevance_triggered = TRUE;

-- Spiritual health indicator indexes (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_maturity ON conversation_analysis(maturity_level) WHERE maturity_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_isolation ON conversation_analysis(isolation_risk) WHERE isolation_risk > 70;

-- User demographics indexes
CREATE INDEX IF NOT EXISTS idx_users_declared_sex ON users(declared_sex) WHERE declared_sex IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_declared_age_range ON users(declared_age_range) WHERE declared_age_range IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_marital_status ON users(declared_marital_status) WHERE declared_marital_status IS NOT NULL;
