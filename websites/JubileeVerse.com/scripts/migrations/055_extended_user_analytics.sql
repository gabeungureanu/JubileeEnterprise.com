-- ============================================
-- JubileeVerse Database Schema
-- Migration 055: Extended User Analytics
-- ============================================
-- Adds faith-spectrum signals, predictive indicators, denominational
-- tracking, safeguarding signals, and life-domain health scores.
-- All scores normalized to 0-100 scale.

-- ============================================
-- EXTEND users TABLE - Declared Denomination
-- ============================================
DO $$
BEGIN
    -- Add declared_denomination column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_denomination'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_denomination VARCHAR(100);
        COMMENT ON COLUMN users.declared_denomination IS 'User self-declared denominational identity (stable profile attribute)';
    END IF;

    -- Add declared_denomination_at column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'declared_denomination_at'
    ) THEN
        ALTER TABLE users ADD COLUMN declared_denomination_at TIMESTAMPTZ;
        COMMENT ON COLUMN users.declared_denomination_at IS 'Timestamp when user declared their denomination';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_declared_denomination ON users(declared_denomination) WHERE declared_denomination IS NOT NULL;

-- ============================================
-- EXTEND conversation_analysis TABLE
-- ============================================

-- ============================================
-- FAITH-SPECTRUM SIGNALS (0-100 scale)
-- Non-exclusive, overlapping signals
-- ============================================
DO $$
BEGIN
    -- Atheist tendency score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'faith_atheist_tendency'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN faith_atheist_tendency SMALLINT DEFAULT 0 CHECK (faith_atheist_tendency >= 0 AND faith_atheist_tendency <= 100);
        COMMENT ON COLUMN conversation_analysis.faith_atheist_tendency IS 'Atheistic skepticism/naturalistic framing tendency 0-100';
    END IF;

    -- Traditional Christian tendency score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'faith_traditional_tendency'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN faith_traditional_tendency SMALLINT DEFAULT 0 CHECK (faith_traditional_tendency >= 0 AND faith_traditional_tendency <= 100);
        COMMENT ON COLUMN conversation_analysis.faith_traditional_tendency IS 'Institutional/cultural Christianity alignment 0-100';
    END IF;

    -- Book-of-Acts believer tendency score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'faith_acts_believer_tendency'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN faith_acts_believer_tendency SMALLINT DEFAULT 0 CHECK (faith_acts_believer_tendency >= 0 AND faith_acts_believer_tendency <= 100);
        COMMENT ON COLUMN conversation_analysis.faith_acts_believer_tendency IS 'Early-church/Acts-aligned faith and practice 0-100';
    END IF;
END $$;

-- ============================================
-- PREDICTIVE ADOPTION & RETENTION (0-100 scale)
-- ============================================
DO $$
BEGIN
    -- Subscription likelihood
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'predict_subscribe_likelihood'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN predict_subscribe_likelihood SMALLINT DEFAULT 50 CHECK (predict_subscribe_likelihood >= 0 AND predict_subscribe_likelihood <= 100);
        COMMENT ON COLUMN conversation_analysis.predict_subscribe_likelihood IS 'Likelihood user will subscribe to Jubileeverse 0-100';
    END IF;

    -- Benefit likelihood
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'predict_benefit_likelihood'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN predict_benefit_likelihood SMALLINT DEFAULT 50 CHECK (predict_benefit_likelihood >= 0 AND predict_benefit_likelihood <= 100);
        COMMENT ON COLUMN conversation_analysis.predict_benefit_likelihood IS 'Likelihood user will benefit from Jubileeverse 0-100';
    END IF;

    -- Retention likelihood
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'predict_retention_likelihood'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN predict_retention_likelihood SMALLINT DEFAULT 50 CHECK (predict_retention_likelihood >= 0 AND predict_retention_likelihood <= 100);
        COMMENT ON COLUMN conversation_analysis.predict_retention_likelihood IS 'Likelihood user will remain subscribed 0-100';
    END IF;

    -- Gospel adoption likelihood
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'predict_gospel_adoption'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN predict_gospel_adoption SMALLINT DEFAULT 50 CHECK (predict_gospel_adoption >= 0 AND predict_gospel_adoption <= 100);
        COMMENT ON COLUMN conversation_analysis.predict_gospel_adoption IS 'Likelihood user will adopt original gospel message based on Scripture openness, repentance willingness, biblical worldview alignment 0-100';
    END IF;

    -- Deception index (time-series tracked)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'deception_index'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN deception_index SMALLINT DEFAULT 0 CHECK (deception_index >= 0 AND deception_index <= 100);
        COMMENT ON COLUMN conversation_analysis.deception_index IS 'Degree of confused/contradictory/manipulative belief patterns conflicting with Scripture 0-100';
    END IF;

    -- Deception markers metadata
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'deception_markers'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN deception_markers JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.deception_markers IS 'Specific markers contributing to deception index for trend analysis';
    END IF;
END $$;

-- ============================================
-- DENOMINATIONAL THINKING PATTERNS (0-100 scale)
-- Inferred alignment, independent of declared identity
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_baptist_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_baptist_leaning SMALLINT DEFAULT 0 CHECK (denom_baptist_leaning >= 0 AND denom_baptist_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_baptist_leaning IS 'Baptist thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_pentecostal_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_pentecostal_leaning SMALLINT DEFAULT 0 CHECK (denom_pentecostal_leaning >= 0 AND denom_pentecostal_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_pentecostal_leaning IS 'Pentecostal thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_catholic_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_catholic_leaning SMALLINT DEFAULT 0 CHECK (denom_catholic_leaning >= 0 AND denom_catholic_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_catholic_leaning IS 'Catholic thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_reformed_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_reformed_leaning SMALLINT DEFAULT 0 CHECK (denom_reformed_leaning >= 0 AND denom_reformed_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_reformed_leaning IS 'Reformed/Calvinist thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_charismatic_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_charismatic_leaning SMALLINT DEFAULT 0 CHECK (denom_charismatic_leaning >= 0 AND denom_charismatic_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_charismatic_leaning IS 'Charismatic thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_orthodox_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_orthodox_leaning SMALLINT DEFAULT 0 CHECK (denom_orthodox_leaning >= 0 AND denom_orthodox_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_orthodox_leaning IS 'Eastern Orthodox thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_nondenominational_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_nondenominational_leaning SMALLINT DEFAULT 0 CHECK (denom_nondenominational_leaning >= 0 AND denom_nondenominational_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_nondenominational_leaning IS 'Non-denominational evangelical thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_mainline_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_mainline_leaning SMALLINT DEFAULT 0 CHECK (denom_mainline_leaning >= 0 AND denom_mainline_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_mainline_leaning IS 'Mainline Protestant thinking pattern alignment 0-100';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'denom_messianic_leaning'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN denom_messianic_leaning SMALLINT DEFAULT 0 CHECK (denom_messianic_leaning >= 0 AND denom_messianic_leaning <= 100);
        COMMENT ON COLUMN conversation_analysis.denom_messianic_leaning IS 'Messianic/Hebrew Roots thinking pattern alignment 0-100';
    END IF;
END $$;

-- ============================================
-- SAFEGUARDING: CULT RISK SIGNALS (0-100 scale)
-- ============================================
DO $$
BEGIN
    -- Cult risk score (current influence)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'cult_risk_score'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN cult_risk_score SMALLINT DEFAULT 0 CHECK (cult_risk_score >= 0 AND cult_risk_score <= 100);
        COMMENT ON COLUMN conversation_analysis.cult_risk_score IS 'Likelihood of current coercive/high-control religious influence 0-100';
    END IF;

    -- Cult susceptibility score (vulnerability)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'cult_susceptibility_score'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN cult_susceptibility_score SMALLINT DEFAULT 0 CHECK (cult_susceptibility_score >= 0 AND cult_susceptibility_score <= 100);
        COMMENT ON COLUMN conversation_analysis.cult_susceptibility_score IS 'Vulnerability to coercive influence based on crisis/loneliness/instability 0-100';
    END IF;

    -- Cult risk markers (evidence/justification)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'cult_risk_markers'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN cult_risk_markers JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN conversation_analysis.cult_risk_markers IS 'Specific markers: authority_claims, fear_control, isolation_cues, financial_exploitation, accountability_hostility';
    END IF;
END $$;

-- ============================================
-- LIFE-DOMAIN HEALTH SCORES (0-100 scale)
-- Conditional - only computed when domain is relevant
-- ============================================
DO $$
BEGIN
    -- Domain relevance flags and confidence
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'domain_relevance'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN domain_relevance JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN conversation_analysis.domain_relevance IS 'Which domains were relevant to this interaction: {financial: true, family: false, ...} with confidence scores';
    END IF;

    -- Financial health index
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'life_financial_health'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN life_financial_health SMALLINT CHECK (life_financial_health >= 0 AND life_financial_health <= 100);
        COMMENT ON COLUMN conversation_analysis.life_financial_health IS 'Financial health indicator when domain relevant 0-100 (NULL if not analyzed)';
    END IF;

    -- Family health index
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'life_family_health'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN life_family_health SMALLINT CHECK (life_family_health >= 0 AND life_family_health <= 100);
        COMMENT ON COLUMN conversation_analysis.life_family_health IS 'Family relationship health indicator when domain relevant 0-100 (NULL if not analyzed)';
    END IF;

    -- Marriage health index
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'life_marriage_health'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN life_marriage_health SMALLINT CHECK (life_marriage_health >= 0 AND life_marriage_health <= 100);
        COMMENT ON COLUMN conversation_analysis.life_marriage_health IS 'Marriage health indicator when domain relevant 0-100 (NULL if not analyzed)';
    END IF;

    -- Parenting stress index (inverted: 0=high stress, 100=low stress)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'life_parenting_health'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN life_parenting_health SMALLINT CHECK (life_parenting_health >= 0 AND life_parenting_health <= 100);
        COMMENT ON COLUMN conversation_analysis.life_parenting_health IS 'Parenting/children-related wellbeing when domain relevant 0-100 (NULL if not analyzed)';
    END IF;

    -- Social relationship health index
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'life_social_health'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN life_social_health SMALLINT CHECK (life_social_health >= 0 AND life_social_health <= 100);
        COMMENT ON COLUMN conversation_analysis.life_social_health IS 'Social relationship health indicator when domain relevant 0-100 (NULL if not analyzed)';
    END IF;

    -- Emotional resilience index
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'life_emotional_resilience'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN life_emotional_resilience SMALLINT CHECK (life_emotional_resilience >= 0 AND life_emotional_resilience <= 100);
        COMMENT ON COLUMN conversation_analysis.life_emotional_resilience IS 'Emotional resilience indicator when domain relevant 0-100 (NULL if not analyzed)';
    END IF;
END $$;

-- ============================================
-- EXTEND user_monthly_analytics TABLE
-- ============================================

-- Faith-spectrum monthly averages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_faith_atheist'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_faith_atheist DECIMAL(5,2) DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.avg_faith_atheist IS 'Monthly average atheist tendency score';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_faith_traditional'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_faith_traditional DECIMAL(5,2) DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.avg_faith_traditional IS 'Monthly average traditional Christian tendency score';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_faith_acts_believer'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_faith_acts_believer DECIMAL(5,2) DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.avg_faith_acts_believer IS 'Monthly average Acts-believer tendency score';
    END IF;
END $$;

-- Predictive monthly averages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_subscribe_likelihood'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_subscribe_likelihood DECIMAL(5,2) DEFAULT 50;
        COMMENT ON COLUMN user_monthly_analytics.avg_subscribe_likelihood IS 'Monthly average subscription likelihood';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_benefit_likelihood'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_benefit_likelihood DECIMAL(5,2) DEFAULT 50;
        COMMENT ON COLUMN user_monthly_analytics.avg_benefit_likelihood IS 'Monthly average benefit likelihood';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_retention_likelihood'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_retention_likelihood DECIMAL(5,2) DEFAULT 50;
        COMMENT ON COLUMN user_monthly_analytics.avg_retention_likelihood IS 'Monthly average retention likelihood';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_gospel_adoption'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_gospel_adoption DECIMAL(5,2) DEFAULT 50;
        COMMENT ON COLUMN user_monthly_analytics.avg_gospel_adoption IS 'Monthly average gospel adoption likelihood';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_deception_index'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_deception_index DECIMAL(5,2) DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.avg_deception_index IS 'Monthly average deception index';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'deception_trend'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN deception_trend VARCHAR(20) DEFAULT 'stable';
        COMMENT ON COLUMN user_monthly_analytics.deception_trend IS 'Deception index trend: improving, worsening, stable, fluctuating';
    END IF;
END $$;

-- Denominational monthly averages (stored as JSONB for flexibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'denominational_leanings'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN denominational_leanings JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.denominational_leanings IS 'Monthly averaged denominational thinking pattern scores: {baptist: 45, pentecostal: 30, ...}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'dominant_denominational_leaning'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN dominant_denominational_leaning VARCHAR(50);
        COMMENT ON COLUMN user_monthly_analytics.dominant_denominational_leaning IS 'Highest scoring denominational thinking pattern for the month';
    END IF;
END $$;

-- Safeguarding monthly averages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_cult_risk'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_cult_risk DECIMAL(5,2) DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.avg_cult_risk IS 'Monthly average cult risk score';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'max_cult_risk'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN max_cult_risk SMALLINT DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.max_cult_risk IS 'Maximum cult risk score observed this month';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_cult_susceptibility'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_cult_susceptibility DECIMAL(5,2) DEFAULT 0;
        COMMENT ON COLUMN user_monthly_analytics.avg_cult_susceptibility IS 'Monthly average cult susceptibility score';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'safeguarding_alerts'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN safeguarding_alerts JSONB DEFAULT '[]'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.safeguarding_alerts IS 'List of safeguarding concerns flagged during the month';
    END IF;
END $$;

-- Life-domain monthly averages (NULL when domain not analyzed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_financial_health'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_financial_health DECIMAL(5,2);
        COMMENT ON COLUMN user_monthly_analytics.avg_financial_health IS 'Monthly average financial health (NULL if domain never analyzed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_family_health'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_family_health DECIMAL(5,2);
        COMMENT ON COLUMN user_monthly_analytics.avg_family_health IS 'Monthly average family health (NULL if domain never analyzed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_marriage_health'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_marriage_health DECIMAL(5,2);
        COMMENT ON COLUMN user_monthly_analytics.avg_marriage_health IS 'Monthly average marriage health (NULL if domain never analyzed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_parenting_health'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_parenting_health DECIMAL(5,2);
        COMMENT ON COLUMN user_monthly_analytics.avg_parenting_health IS 'Monthly average parenting health (NULL if domain never analyzed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_social_health'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_social_health DECIMAL(5,2);
        COMMENT ON COLUMN user_monthly_analytics.avg_social_health IS 'Monthly average social relationship health (NULL if domain never analyzed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'avg_emotional_resilience'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN avg_emotional_resilience DECIMAL(5,2);
        COMMENT ON COLUMN user_monthly_analytics.avg_emotional_resilience IS 'Monthly average emotional resilience (NULL if domain never analyzed)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_monthly_analytics' AND column_name = 'domains_analyzed'
    ) THEN
        ALTER TABLE user_monthly_analytics ADD COLUMN domains_analyzed JSONB DEFAULT '{}'::JSONB;
        COMMENT ON COLUMN user_monthly_analytics.domains_analyzed IS 'Count of times each domain was analyzed: {financial: 5, family: 12, ...}';
    END IF;
END $$;

-- ============================================
-- UPDATED AGGREGATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_user_monthly_stats_extended(p_user_id UUID, p_year_month VARCHAR(7))
RETURNS TABLE (
    -- Base stats
    total_messages BIGINT,
    total_conversations BIGINT,
    unique_personas BIGINT,
    -- Sentiment
    avg_sentiment NUMERIC,
    min_sentiment SMALLINT,
    max_sentiment SMALLINT,
    -- Emotions
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
    -- Five-Fold
    avg_apostle NUMERIC,
    avg_prophet NUMERIC,
    avg_evangelist NUMERIC,
    avg_pastor NUMERIC,
    avg_teacher NUMERIC,
    -- MBTI
    avg_e_i NUMERIC,
    avg_s_n NUMERIC,
    avg_t_f NUMERIC,
    avg_j_p NUMERIC,
    -- Faith-spectrum
    avg_faith_atheist NUMERIC,
    avg_faith_traditional NUMERIC,
    avg_faith_acts_believer NUMERIC,
    -- Predictive
    avg_subscribe_likelihood NUMERIC,
    avg_benefit_likelihood NUMERIC,
    avg_retention_likelihood NUMERIC,
    avg_gospel_adoption NUMERIC,
    avg_deception_index NUMERIC,
    -- Denominational
    avg_baptist NUMERIC,
    avg_pentecostal NUMERIC,
    avg_catholic NUMERIC,
    avg_reformed NUMERIC,
    avg_charismatic NUMERIC,
    avg_orthodox NUMERIC,
    avg_nondenominational NUMERIC,
    avg_mainline NUMERIC,
    avg_messianic NUMERIC,
    -- Safeguarding
    avg_cult_risk NUMERIC,
    max_cult_risk SMALLINT,
    avg_cult_susceptibility NUMERIC,
    -- Life-domains (averages only where analyzed)
    avg_financial_health NUMERIC,
    avg_family_health NUMERIC,
    avg_marriage_health NUMERIC,
    avg_parenting_health NUMERIC,
    avg_social_health NUMERIC,
    avg_emotional_resilience NUMERIC,
    -- Domain analysis counts
    financial_analyzed_count BIGINT,
    family_analyzed_count BIGINT,
    marriage_analyzed_count BIGINT,
    parenting_analyzed_count BIGINT,
    social_analyzed_count BIGINT,
    resilience_analyzed_count BIGINT
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
        ROUND(AVG(ca.mbti_j_p)::NUMERIC, 2) as avg_j_p,

        -- Faith-spectrum
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

        -- Life-domains (average only where NOT NULL)
        ROUND(AVG(ca.life_financial_health)::NUMERIC, 2) as avg_financial_health,
        ROUND(AVG(ca.life_family_health)::NUMERIC, 2) as avg_family_health,
        ROUND(AVG(ca.life_marriage_health)::NUMERIC, 2) as avg_marriage_health,
        ROUND(AVG(ca.life_parenting_health)::NUMERIC, 2) as avg_parenting_health,
        ROUND(AVG(ca.life_social_health)::NUMERIC, 2) as avg_social_health,
        ROUND(AVG(ca.life_emotional_resilience)::NUMERIC, 2) as avg_emotional_resilience,

        -- Count how many times each domain was analyzed
        COUNT(ca.life_financial_health)::BIGINT as financial_analyzed_count,
        COUNT(ca.life_family_health)::BIGINT as family_analyzed_count,
        COUNT(ca.life_marriage_health)::BIGINT as marriage_analyzed_count,
        COUNT(ca.life_parenting_health)::BIGINT as parenting_analyzed_count,
        COUNT(ca.life_social_health)::BIGINT as social_analyzed_count,
        COUNT(ca.life_emotional_resilience)::BIGINT as resilience_analyzed_count

    FROM conversation_analysis ca
    WHERE ca.user_id = p_user_id
      AND ca.created_at >= (p_year_month || '-01')::DATE
      AND ca.created_at < ((p_year_month || '-01')::DATE + INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES FOR NEW COLUMNS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_faith_spectrum ON conversation_analysis(faith_atheist_tendency, faith_traditional_tendency, faith_acts_believer_tendency);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_cult_risk ON conversation_analysis(cult_risk_score) WHERE cult_risk_score > 50;
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_deception ON conversation_analysis(deception_index) WHERE deception_index > 50;
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_gospel_adoption ON conversation_analysis(predict_gospel_adoption);

-- GIN indexes for new JSONB columns
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_domain_relevance ON conversation_analysis USING GIN (domain_relevance);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_cult_markers ON conversation_analysis USING GIN (cult_risk_markers);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_deception_markers ON conversation_analysis USING GIN (deception_markers);
CREATE INDEX IF NOT EXISTS idx_user_monthly_analytics_denom_leanings ON user_monthly_analytics USING GIN (denominational_leanings);
