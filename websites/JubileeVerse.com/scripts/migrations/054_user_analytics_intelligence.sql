-- ============================================
-- JubileeVerse Database Schema
-- Migration 054: User Analytics and Intelligence System
-- ============================================
-- Comprehensive analytics system for conversation analysis,
-- user profiling, and monthly aggregations.
-- All scores normalized to 0-100 scale.

-- ============================================
-- EXTEND users TABLE
-- ============================================
DO $$
BEGIN
    -- Add user_type column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'user_type'
    ) THEN
        ALTER TABLE users ADD COLUMN user_type VARCHAR(50) DEFAULT 'unclassified';
        COMMENT ON COLUMN users.user_type IS 'AI-derived user classification: seeker, believer, leader, pastor, educator, counselor, unclassified';
    END IF;

    -- Add subscription_tier column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free';
        COMMENT ON COLUMN users.subscription_tier IS 'Current subscription tier: free, basic, premium, enterprise';
    END IF;

    -- Add analytics_consent column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'analytics_consent'
    ) THEN
        ALTER TABLE users ADD COLUMN analytics_consent BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN users.analytics_consent IS 'User consent for AI-powered conversation analysis';
    END IF;

    -- Add analytics_consent_at column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'analytics_consent_at'
    ) THEN
        ALTER TABLE users ADD COLUMN analytics_consent_at TIMESTAMPTZ;
        COMMENT ON COLUMN users.analytics_consent_at IS 'Timestamp when analytics consent was granted';
    END IF;
END $$;

-- Index for analytics queries on users
CREATE INDEX IF NOT EXISTS idx_users_analytics_consent ON users(analytics_consent) WHERE analytics_consent = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- ============================================
-- CONVERSATION ANALYSIS TABLE
-- Per-message analysis results
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign keys (reference existing tables)
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Session tracking (optional, for grouping related messages)
    session_id UUID,

    -- ============================================
    -- SENTIMENT ANALYSIS (0-100 scale)
    -- ============================================
    sentiment_score SMALLINT CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
    sentiment_label VARCHAR(20), -- 'negative', 'neutral', 'positive', 'mixed'

    -- ============================================
    -- EMOTIONAL INDICATORS (0-100 scale)
    -- Each represents intensity of that emotion
    -- ============================================
    emotion_confusion SMALLINT DEFAULT 0 CHECK (emotion_confusion >= 0 AND emotion_confusion <= 100),
    emotion_hope SMALLINT DEFAULT 0 CHECK (emotion_hope >= 0 AND emotion_hope <= 100),
    emotion_relief SMALLINT DEFAULT 0 CHECK (emotion_relief >= 0 AND emotion_relief <= 100),
    emotion_pressure SMALLINT DEFAULT 0 CHECK (emotion_pressure >= 0 AND emotion_pressure <= 100),
    emotion_safety SMALLINT DEFAULT 0 CHECK (emotion_safety >= 0 AND emotion_safety <= 100),
    emotion_joy SMALLINT DEFAULT 0 CHECK (emotion_joy >= 0 AND emotion_joy <= 100),
    emotion_grief SMALLINT DEFAULT 0 CHECK (emotion_grief >= 0 AND emotion_grief <= 100),
    emotion_anxiety SMALLINT DEFAULT 0 CHECK (emotion_anxiety >= 0 AND emotion_anxiety <= 100),
    emotion_peace SMALLINT DEFAULT 0 CHECK (emotion_peace >= 0 AND emotion_peace <= 100),
    emotion_frustration SMALLINT DEFAULT 0 CHECK (emotion_frustration >= 0 AND emotion_frustration <= 100),

    -- ============================================
    -- FIVE-FOLD MINISTRY INDICATORS (0-100 scale)
    -- Based on Ephesians 4:11 gifts
    -- ============================================
    fivefold_apostle SMALLINT DEFAULT 0 CHECK (fivefold_apostle >= 0 AND fivefold_apostle <= 100),
    fivefold_prophet SMALLINT DEFAULT 0 CHECK (fivefold_prophet >= 0 AND fivefold_prophet <= 100),
    fivefold_evangelist SMALLINT DEFAULT 0 CHECK (fivefold_evangelist >= 0 AND fivefold_evangelist <= 100),
    fivefold_pastor SMALLINT DEFAULT 0 CHECK (fivefold_pastor >= 0 AND fivefold_pastor <= 100),
    fivefold_teacher SMALLINT DEFAULT 0 CHECK (fivefold_teacher >= 0 AND fivefold_teacher <= 100),

    -- ============================================
    -- MBTI PROBABILISTIC INDICATORS (0-100 scale)
    -- Each represents probability toward one pole
    -- E.g., e_i = 70 means 70% Extrovert, 30% Introvert
    -- ============================================
    mbti_e_i SMALLINT DEFAULT 50 CHECK (mbti_e_i >= 0 AND mbti_e_i <= 100), -- E vs I
    mbti_s_n SMALLINT DEFAULT 50 CHECK (mbti_s_n >= 0 AND mbti_s_n <= 100), -- S vs N
    mbti_t_f SMALLINT DEFAULT 50 CHECK (mbti_t_f >= 0 AND mbti_t_f <= 100), -- T vs F
    mbti_j_p SMALLINT DEFAULT 50 CHECK (mbti_j_p >= 0 AND mbti_j_p <= 100), -- J vs P

    -- ============================================
    -- EXTRACTED INSIGHTS (JSONB for flexibility)
    -- ============================================
    primary_needs JSONB DEFAULT '[]'::JSONB,
    -- Example: ["spiritual guidance", "prayer support", "biblical understanding"]

    primary_challenges JSONB DEFAULT '[]'::JSONB,
    -- Example: ["doubt", "marriage struggles", "work stress"]

    dominant_topics JSONB DEFAULT '[]'::JSONB,
    -- Example: ["faith", "family", "career", "healing"]

    worldview_indicators JSONB DEFAULT '{}'::JSONB,
    -- Example: {"theological_tradition": "evangelical", "spiritual_maturity": "growing", "engagement_level": "active"}

    bible_references_discussed JSONB DEFAULT '[]'::JSONB,
    -- Example: ["John 3:16", "Romans 8:28", "Psalm 23"]

    -- ============================================
    -- ANALYSIS METADATA
    -- ============================================
    analysis_version VARCHAR(20) DEFAULT '1.0',
    model_used VARCHAR(100),
    processing_time_ms INT,
    confidence_score SMALLINT CHECK (confidence_score >= 0 AND confidence_score <= 100),

    -- Timestamps (no updated_at - analysis is immutable once created)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate analysis per message
    CONSTRAINT conversation_analysis_message_unique UNIQUE (message_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_user ON conversation_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_conversation ON conversation_analysis(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_message ON conversation_analysis(message_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_session ON conversation_analysis(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_created ON conversation_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_sentiment ON conversation_analysis(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_user_created ON conversation_analysis(user_id, created_at DESC);

-- GIN indexes for JSONB searches
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_topics ON conversation_analysis USING GIN (dominant_topics);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_needs ON conversation_analysis USING GIN (primary_needs);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_challenges ON conversation_analysis USING GIN (primary_challenges);

COMMENT ON TABLE conversation_analysis IS 'Per-message AI analysis results including sentiment, emotions, personality indicators, and extracted insights. Immutable once created.';

-- ============================================
-- USER MONTHLY ANALYTICS TABLE
-- Dashboard-ready aggregations per user per month
-- ============================================
CREATE TABLE IF NOT EXISTS user_monthly_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Composite key: user + year-month
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- Format: "2025-01"

    -- ============================================
    -- ACTIVITY METRICS
    -- ============================================
    total_messages INT DEFAULT 0,
    total_conversations INT DEFAULT 0,
    unique_personas_used INT DEFAULT 0,
    avg_messages_per_conversation DECIMAL(6,2) DEFAULT 0,

    -- ============================================
    -- SENTIMENT AGGREGATES (0-100 scale)
    -- ============================================
    avg_sentiment DECIMAL(5,2),
    min_sentiment SMALLINT,
    max_sentiment SMALLINT,
    sentiment_trend VARCHAR(20), -- 'improving', 'declining', 'stable', 'fluctuating'

    -- ============================================
    -- EMOTIONAL AVERAGES (0-100 scale)
    -- ============================================
    avg_confusion DECIMAL(5,2) DEFAULT 0,
    avg_hope DECIMAL(5,2) DEFAULT 0,
    avg_relief DECIMAL(5,2) DEFAULT 0,
    avg_pressure DECIMAL(5,2) DEFAULT 0,
    avg_safety DECIMAL(5,2) DEFAULT 0,
    avg_joy DECIMAL(5,2) DEFAULT 0,
    avg_grief DECIMAL(5,2) DEFAULT 0,
    avg_anxiety DECIMAL(5,2) DEFAULT 0,
    avg_peace DECIMAL(5,2) DEFAULT 0,
    avg_frustration DECIMAL(5,2) DEFAULT 0,
    dominant_emotion VARCHAR(30), -- Most frequently detected emotion

    -- ============================================
    -- FIVE-FOLD AVERAGES (0-100 scale)
    -- ============================================
    avg_apostle DECIMAL(5,2) DEFAULT 0,
    avg_prophet DECIMAL(5,2) DEFAULT 0,
    avg_evangelist DECIMAL(5,2) DEFAULT 0,
    avg_pastor DECIMAL(5,2) DEFAULT 0,
    avg_teacher DECIMAL(5,2) DEFAULT 0,
    dominant_fivefold VARCHAR(30), -- Highest scoring gift

    -- ============================================
    -- MBTI PROBABILITY AVERAGES (0-100 scale)
    -- ============================================
    avg_e_i DECIMAL(5,2) DEFAULT 50,
    avg_s_n DECIMAL(5,2) DEFAULT 50,
    avg_t_f DECIMAL(5,2) DEFAULT 50,
    avg_j_p DECIMAL(5,2) DEFAULT 50,
    likely_mbti_type VARCHAR(4), -- Derived type, e.g., "ENFJ"

    -- ============================================
    -- DASHBOARD COMPOSITE SCORES (0-100 scale)
    -- Derived metrics for dashboard gauges
    -- ============================================
    engagement_health DECIMAL(5,2) DEFAULT 50,
    -- Combination of: return frequency, session depth, emotional balance

    loyalty_score DECIMAL(5,2) DEFAULT 50,
    -- Weighted by: repeated sessions, time between visits

    growth_score DECIMAL(5,2) DEFAULT 50,
    -- Positive directional movement in: needs→solutions, confusion→clarity

    satisfaction_score DECIMAL(5,2) DEFAULT 50,
    -- Composite of: sentiment trend, relief vs pressure, resolution signals

    -- ============================================
    -- AGGREGATED INSIGHTS (JSONB)
    -- ============================================
    top_needs JSONB DEFAULT '[]'::JSONB,
    -- Ranked list of most common needs

    top_challenges JSONB DEFAULT '[]'::JSONB,
    -- Ranked list of most common challenges

    top_topics JSONB DEFAULT '[]'::JSONB,
    -- Ranked list of most discussed topics

    worldview_summary JSONB DEFAULT '{}'::JSONB,
    -- Aggregated worldview indicators

    persona_affinity JSONB DEFAULT '{}'::JSONB,
    -- Usage count per persona: {"jubilee": 45, "elias": 12}

    -- ============================================
    -- METADATA
    -- ============================================
    is_finalized BOOLEAN DEFAULT FALSE,
    -- TRUE after month ends (immutable after finalization)

    finalized_at TIMESTAMPTZ,
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one record per user per month
    CONSTRAINT user_monthly_analytics_unique UNIQUE (user_id, year_month)
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_user_monthly_analytics_user ON user_monthly_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_monthly_analytics_yearmonth ON user_monthly_analytics(year_month);
CREATE INDEX IF NOT EXISTS idx_user_monthly_analytics_finalized ON user_monthly_analytics(is_finalized);
CREATE INDEX IF NOT EXISTS idx_user_monthly_analytics_user_yearmonth ON user_monthly_analytics(user_id, year_month DESC);

-- GIN indexes for JSONB
CREATE INDEX IF NOT EXISTS idx_user_monthly_analytics_topics ON user_monthly_analytics USING GIN (top_topics);
CREATE INDEX IF NOT EXISTS idx_user_monthly_analytics_persona ON user_monthly_analytics USING GIN (persona_affinity);

-- Trigger for updated_at
CREATE TRIGGER update_user_monthly_analytics_updated_at
    BEFORE UPDATE ON user_monthly_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_monthly_analytics IS 'Monthly aggregated analytics per user for dashboard display. Finalized records are immutable after month-end processing.';

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get aggregated stats for a user for a month
CREATE OR REPLACE FUNCTION get_user_monthly_stats(p_user_id UUID, p_year_month VARCHAR(7))
RETURNS TABLE (
    total_messages BIGINT,
    total_conversations BIGINT,
    unique_personas BIGINT,
    avg_sentiment NUMERIC,
    min_sentiment SMALLINT,
    max_sentiment SMALLINT,
    avg_confusion NUMERIC,
    avg_hope NUMERIC,
    avg_relief NUMERIC,
    avg_pressure NUMERIC,
    avg_safety NUMERIC,
    avg_joy NUMERIC,
    avg_grief NUMERIC,
    avg_anxiety NUMERIC,
    avg_peace NUMERIC,
    avg_frustration NUMERIC,
    avg_apostle NUMERIC,
    avg_prophet NUMERIC,
    avg_evangelist NUMERIC,
    avg_pastor NUMERIC,
    avg_teacher NUMERIC,
    avg_e_i NUMERIC,
    avg_s_n NUMERIC,
    avg_t_f NUMERIC,
    avg_j_p NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_messages,
        COUNT(DISTINCT ca.conversation_id)::BIGINT as total_conversations,
        COUNT(DISTINCT ca.persona_id)::BIGINT as unique_personas,

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
        ROUND(AVG(ca.mbti_j_p)::NUMERIC, 2) as avg_j_p

    FROM conversation_analysis ca
    WHERE ca.user_id = p_user_id
      AND ca.created_at >= (p_year_month || '-01')::DATE
      AND ca.created_at < ((p_year_month || '-01')::DATE + INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql;

-- Function to finalize a month's analytics (make immutable)
CREATE OR REPLACE FUNCTION finalize_monthly_analytics(p_year_month VARCHAR(7))
RETURNS INT AS $$
DECLARE
    affected_count INT;
BEGIN
    UPDATE user_monthly_analytics
    SET is_finalized = TRUE,
        finalized_at = NOW(),
        updated_at = NOW()
    WHERE year_month = p_year_month
      AND is_finalized = FALSE;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old analysis data (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_conversation_analysis(days_to_keep INT DEFAULT 365)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM conversation_analysis
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN conversation_analysis.sentiment_score IS 'Overall sentiment 0-100 where 0=very negative, 50=neutral, 100=very positive';
COMMENT ON COLUMN conversation_analysis.fivefold_apostle IS 'Five-Fold Ministry: Apostolic/pioneering language indicator 0-100';
COMMENT ON COLUMN conversation_analysis.fivefold_prophet IS 'Five-Fold Ministry: Prophetic/truth-telling language indicator 0-100';
COMMENT ON COLUMN conversation_analysis.fivefold_evangelist IS 'Five-Fold Ministry: Evangelistic/sharing language indicator 0-100';
COMMENT ON COLUMN conversation_analysis.fivefold_pastor IS 'Five-Fold Ministry: Pastoral/nurturing language indicator 0-100';
COMMENT ON COLUMN conversation_analysis.fivefold_teacher IS 'Five-Fold Ministry: Teaching/explaining language indicator 0-100';
COMMENT ON COLUMN conversation_analysis.mbti_e_i IS 'MBTI E/I axis: 100=Extrovert, 0=Introvert, 50=balanced';
COMMENT ON COLUMN conversation_analysis.mbti_s_n IS 'MBTI S/N axis: 100=Sensing, 0=Intuition, 50=balanced';
COMMENT ON COLUMN conversation_analysis.mbti_t_f IS 'MBTI T/F axis: 100=Thinking, 0=Feeling, 50=balanced';
COMMENT ON COLUMN conversation_analysis.mbti_j_p IS 'MBTI J/P axis: 100=Judging, 0=Perceiving, 50=balanced';
COMMENT ON COLUMN user_monthly_analytics.engagement_health IS 'Dashboard gauge: combination of return frequency, session depth, emotional balance';
COMMENT ON COLUMN user_monthly_analytics.loyalty_score IS 'Dashboard gauge: weighted by repeated sessions and time between visits';
COMMENT ON COLUMN user_monthly_analytics.growth_score IS 'Dashboard gauge: positive movement in needs→solutions, confusion→clarity';
COMMENT ON COLUMN user_monthly_analytics.satisfaction_score IS 'Dashboard gauge: sentiment trend, relief vs pressure, resolution signals';
