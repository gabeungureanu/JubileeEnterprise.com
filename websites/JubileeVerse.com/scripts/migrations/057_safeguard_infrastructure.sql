-- Migration 057: Safeguard Infrastructure
-- Safety detection, alerting, and persona performance tracking
-- All subject to strict privacy enforcement (is_private = FALSE required)

-- ============================================
-- SAFETY FLAGS TABLE
-- Records detected safety events during non-private conversations
-- ============================================

CREATE TABLE IF NOT EXISTS safety_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    session_id VARCHAR(255),

    -- Safety classification
    category VARCHAR(50) NOT NULL,
    -- Categories: self_harm, harm_to_others, coercive_language, sexual_advance,
    -- grooming_behavior, manipulation_attempt, boundary_violation, abuse_language,
    -- crisis_signal, deception_attempt, identity_confusion, exploitation_risk

    subcategory VARCHAR(100),
    -- More specific classification within category

    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    -- Levels: low, moderate, elevated, high, critical

    confidence SMALLINT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    -- Confidence score 0-100

    -- Detection details
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'user_message',
    -- Types: user_message, pattern_match, behavioral_sequence, escalation

    evidence_tokens TEXT[],
    -- Short redacted evidence snippets (3-5 words each, NO full quotes)

    internal_summary TEXT,
    -- Concise internal description of what was detected (for admin review)

    -- Response tracking
    persona_response_type VARCHAR(50),
    -- How the persona responded: deflection, resource_offer, boundary_set,
    -- empathy_redirect, escalation_warning, crisis_support, none

    persona_response_appropriate BOOLEAN,
    -- Was the persona's response appropriate? (evaluated by AI)

    response_evaluation_notes TEXT,
    -- Notes on persona response quality

    -- Alert status
    alert_generated BOOLEAN DEFAULT FALSE,
    alert_id UUID,

    -- Privacy verification (logged for audit)
    privacy_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Timestamp when is_private=FALSE was verified before recording

    -- Metadata
    analysis_version VARCHAR(20) DEFAULT '1.0',
    model_used VARCHAR(50),
    processing_time_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for safety_flags
CREATE INDEX IF NOT EXISTS idx_safety_flags_user_id ON safety_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_flags_conversation_id ON safety_flags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_safety_flags_persona_id ON safety_flags(persona_id);
CREATE INDEX IF NOT EXISTS idx_safety_flags_category ON safety_flags(category);
CREATE INDEX IF NOT EXISTS idx_safety_flags_severity ON safety_flags(severity);
CREATE INDEX IF NOT EXISTS idx_safety_flags_created_at ON safety_flags(created_at);
CREATE INDEX IF NOT EXISTS idx_safety_flags_alert_generated ON safety_flags(alert_generated) WHERE alert_generated = FALSE;

COMMENT ON TABLE safety_flags IS 'Records detected safety events from non-private conversations for admin review';
COMMENT ON COLUMN safety_flags.evidence_tokens IS 'Short redacted evidence snippets (3-5 words each), never full user quotes';
COMMENT ON COLUMN safety_flags.internal_summary IS 'Concise admin-facing summary, not raw conversation text';


-- ============================================
-- ADMIN ALERTS TABLE
-- Administrator-visible safety notifications
-- ============================================

CREATE TABLE IF NOT EXISTS admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    safety_flag_id UUID REFERENCES safety_flags(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Alert classification
    alert_type VARCHAR(50) NOT NULL,
    -- Types: safety_threshold, pattern_detected, escalation, crisis,
    -- persona_issue, repeated_violation, trend_alert

    category VARCHAR(50) NOT NULL,
    -- Same categories as safety_flags

    severity VARCHAR(20) NOT NULL DEFAULT 'moderate',
    -- Levels: low, moderate, elevated, high, critical

    confidence SMALLINT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),

    -- Alert content (redacted, no raw text)
    title VARCHAR(200) NOT NULL,
    -- Short descriptive title

    redacted_summary TEXT NOT NULL,
    -- Summarized context without raw conversation text

    recommended_action VARCHAR(100),
    -- Suggested next step for admin

    -- Review tracking
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    -- Status: new, viewed, acknowledged, under_review, resolved, escalated, dismissed

    viewed_at TIMESTAMP WITH TIME ZONE,
    viewed_by UUID REFERENCES users(id),

    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),

    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,

    -- Access control
    requires_authorization BOOLEAN DEFAULT TRUE,
    -- If true, detailed view requires explicit auth

    authorization_level VARCHAR(20) DEFAULT 'admin',
    -- Required role: admin, safety_reviewer, counselor, superadmin

    detail_accessed_at TIMESTAMP WITH TIME ZONE,
    detail_accessed_by UUID REFERENCES users(id),

    -- Metadata
    auto_generated BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    -- Optional expiration for low-severity alerts

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for admin_alerts
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON admin_alerts(status);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_category ON admin_alerts(category);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_user_id ON admin_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON admin_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_new ON admin_alerts(status, severity) WHERE status = 'new';

COMMENT ON TABLE admin_alerts IS 'Administrator-visible safety notifications with access control';
COMMENT ON COLUMN admin_alerts.redacted_summary IS 'Summary without raw conversation text - detail requires authorization';


-- ============================================
-- ADMIN ALERT ACCESS LOG
-- Audit trail for alert access
-- ============================================

CREATE TABLE IF NOT EXISTS admin_alert_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES admin_alerts(id) ON DELETE CASCADE,
    accessed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_type VARCHAR(50) NOT NULL,
    -- Types: view_summary, view_detail, acknowledge, resolve, escalate, export

    ip_address INET,
    user_agent TEXT,
    access_granted BOOLEAN NOT NULL,
    denial_reason VARCHAR(100),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_access_log_alert_id ON admin_alert_access_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_access_log_accessed_by ON admin_alert_access_log(accessed_by);
CREATE INDEX IF NOT EXISTS idx_alert_access_log_created_at ON admin_alert_access_log(created_at);


-- ============================================
-- PERSONA PERFORMANCE TABLE
-- Per-interaction persona behavior metrics
-- ============================================

CREATE TABLE IF NOT EXISTS persona_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Core performance scores (0-100)
    relatability SMALLINT CHECK (relatability >= 0 AND relatability <= 100),
    relatability_confidence SMALLINT CHECK (relatability_confidence >= 0 AND relatability_confidence <= 100),

    friendliness SMALLINT CHECK (friendliness >= 0 AND friendliness <= 100),
    friendliness_confidence SMALLINT CHECK (friendliness_confidence >= 0 AND friendliness_confidence <= 100),

    boundary_clarity SMALLINT CHECK (boundary_clarity >= 0 AND boundary_clarity <= 100),
    boundary_clarity_confidence SMALLINT CHECK (boundary_clarity_confidence >= 0 AND boundary_clarity_confidence <= 100),

    biblical_alignment SMALLINT CHECK (biblical_alignment >= 0 AND biblical_alignment <= 100),
    biblical_alignment_confidence SMALLINT CHECK (biblical_alignment_confidence >= 0 AND biblical_alignment_confidence <= 100),

    redirection_effectiveness SMALLINT CHECK (redirection_effectiveness >= 0 AND redirection_effectiveness <= 100),
    redirection_effectiveness_confidence SMALLINT CHECK (redirection_effectiveness_confidence >= 0 AND redirection_effectiveness_confidence <= 100),

    -- Safety response metrics
    flirtation_deflection SMALLINT CHECK (flirtation_deflection >= 0 AND flirtation_deflection <= 100),
    -- How well persona deflected romantic/flirtatious advances (if applicable)

    unsafe_behavior_discouragement SMALLINT CHECK (unsafe_behavior_discouragement >= 0 AND unsafe_behavior_discouragement <= 100),
    -- How well persona discouraged unsafe behavior (if applicable)

    crisis_resource_provision SMALLINT CHECK (crisis_resource_provision >= 0 AND crisis_resource_provision <= 100),
    -- Appropriateness of crisis resources offered (if applicable)

    conversation_steering SMALLINT CHECK (conversation_steering >= 0 AND conversation_steering <= 100),
    -- How well persona kept conversation on healthy path

    -- Situational flags
    encountered_boundary_test BOOLEAN DEFAULT FALSE,
    boundary_test_type VARCHAR(50),
    -- Types: flirtation, romantic_pursuit, sexual, manipulation, aggression, deception

    handled_boundary_appropriately BOOLEAN,
    -- Evaluation of how boundary was handled

    encountered_crisis_signal BOOLEAN DEFAULT FALSE,
    crisis_type VARCHAR(50),
    -- Types: self_harm, suicide, abuse, violence, medical_emergency

    crisis_response_appropriate BOOLEAN,
    -- Evaluation of crisis response

    -- Overall assessment
    overall_score SMALLINT CHECK (overall_score >= 0 AND overall_score <= 100),
    -- Weighted composite of all scores

    improvement_areas JSONB DEFAULT '[]',
    -- Array of identified improvement opportunities

    -- Privacy verification
    privacy_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Metadata
    analysis_version VARCHAR(20) DEFAULT '1.0',
    model_used VARCHAR(50),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for persona_performance
CREATE INDEX IF NOT EXISTS idx_persona_performance_persona_id ON persona_performance(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_performance_user_id ON persona_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_performance_conversation_id ON persona_performance(conversation_id);
CREATE INDEX IF NOT EXISTS idx_persona_performance_created_at ON persona_performance(created_at);
CREATE INDEX IF NOT EXISTS idx_persona_performance_boundary_test ON persona_performance(persona_id, encountered_boundary_test)
    WHERE encountered_boundary_test = TRUE;

COMMENT ON TABLE persona_performance IS 'Per-interaction persona behavior metrics for non-private conversations';


-- ============================================
-- PERSONA ENGAGEMENT METRICS TABLE
-- Aggregated persona-level engagement data
-- ============================================

CREATE TABLE IF NOT EXISTS persona_engagement_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    year_month CHAR(7) NOT NULL, -- YYYY-MM format

    -- Usage metrics
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    returning_users INTEGER DEFAULT 0,

    -- Session metrics
    avg_session_duration_seconds INTEGER,
    median_session_duration_seconds INTEGER,
    avg_messages_per_session DECIMAL(6,2),

    -- Return rates
    return_rate_7day DECIMAL(5,2),
    return_rate_30day DECIMAL(5,2),

    -- Performance averages (from persona_performance)
    avg_relatability DECIMAL(5,2),
    avg_friendliness DECIMAL(5,2),
    avg_boundary_clarity DECIMAL(5,2),
    avg_biblical_alignment DECIMAL(5,2),
    avg_redirection_effectiveness DECIMAL(5,2),
    avg_overall_score DECIMAL(5,2),

    -- Safety metrics
    boundary_test_count INTEGER DEFAULT 0,
    flirtation_attempt_count INTEGER DEFAULT 0,
    romantic_pursuit_count INTEGER DEFAULT 0,
    crisis_signal_count INTEGER DEFAULT 0,

    boundary_handling_success_rate DECIMAL(5,2),
    -- Percentage of boundary tests handled appropriately

    -- Safety concern flag
    disproportionate_boundary_testing BOOLEAN DEFAULT FALSE,
    -- Flag if this persona attracts more boundary testing than average

    boundary_testing_ratio DECIMAL(5,2),
    -- Ratio compared to platform average

    flagged_for_review BOOLEAN DEFAULT FALSE,
    review_reason TEXT,

    -- Finalization
    is_finalized BOOLEAN DEFAULT FALSE,
    finalized_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(persona_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_persona_engagement_persona_id ON persona_engagement_metrics(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_engagement_year_month ON persona_engagement_metrics(year_month);
CREATE INDEX IF NOT EXISTS idx_persona_engagement_flagged ON persona_engagement_metrics(flagged_for_review)
    WHERE flagged_for_review = TRUE;

COMMENT ON TABLE persona_engagement_metrics IS 'Monthly aggregated persona engagement and safety metrics';
COMMENT ON COLUMN persona_engagement_metrics.disproportionate_boundary_testing IS 'Flag if persona attracts unusual boundary-testing behavior';


-- ============================================
-- SAFEGUARD THRESHOLDS CONFIG TABLE
-- Configurable thresholds for alert generation
-- ============================================

CREATE TABLE IF NOT EXISTS safeguard_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(100),

    -- Thresholds
    alert_confidence_threshold SMALLINT DEFAULT 70,
    -- Minimum confidence to generate alert

    severity_escalation_threshold SMALLINT DEFAULT 85,
    -- Confidence at which severity auto-escalates

    repeat_count_threshold INTEGER DEFAULT 3,
    -- Number of occurrences before pattern alert

    repeat_window_hours INTEGER DEFAULT 24,
    -- Time window for counting repeats

    auto_alert BOOLEAN DEFAULT TRUE,
    -- Whether to auto-generate admin alerts

    requires_immediate_review BOOLEAN DEFAULT FALSE,
    -- For critical categories

    -- Active status
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(category, subcategory)
);

-- Insert default thresholds
INSERT INTO safeguard_thresholds (category, subcategory, alert_confidence_threshold, severity_escalation_threshold, requires_immediate_review, auto_alert)
VALUES
    ('self_harm', NULL, 60, 75, TRUE, TRUE),
    ('self_harm', 'suicide_ideation', 50, 70, TRUE, TRUE),
    ('harm_to_others', NULL, 65, 80, TRUE, TRUE),
    ('coercive_language', NULL, 70, 85, FALSE, TRUE),
    ('sexual_advance', NULL, 65, 80, FALSE, TRUE),
    ('sexual_advance', 'explicit', 50, 70, TRUE, TRUE),
    ('grooming_behavior', NULL, 60, 75, TRUE, TRUE),
    ('manipulation_attempt', NULL, 70, 85, FALSE, TRUE),
    ('boundary_violation', NULL, 75, 90, FALSE, TRUE),
    ('boundary_violation', 'repeated', 60, 75, FALSE, TRUE),
    ('abuse_language', NULL, 70, 85, FALSE, TRUE),
    ('crisis_signal', NULL, 55, 70, TRUE, TRUE),
    ('deception_attempt', NULL, 75, 90, FALSE, FALSE),
    ('identity_confusion', NULL, 80, 95, FALSE, FALSE),
    ('exploitation_risk', NULL, 60, 75, TRUE, TRUE)
ON CONFLICT (category, subcategory) DO NOTHING;


-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to verify conversation is not private before safety analysis
CREATE OR REPLACE FUNCTION verify_conversation_not_private(conv_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_priv BOOLEAN;
BEGIN
    SELECT is_private INTO is_priv FROM conversations WHERE id = conv_id;
    RETURN COALESCE(is_priv, TRUE) = FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_conversation_not_private IS 'Returns TRUE only if conversation exists and is_private = FALSE';


-- Function to get alert threshold for a category
CREATE OR REPLACE FUNCTION get_alert_threshold(cat VARCHAR, subcat VARCHAR DEFAULT NULL)
RETURNS TABLE(
    confidence_threshold SMALLINT,
    escalation_threshold SMALLINT,
    immediate_review BOOLEAN,
    auto_alert BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        st.alert_confidence_threshold,
        st.severity_escalation_threshold,
        st.requires_immediate_review,
        st.auto_alert
    FROM safeguard_thresholds st
    WHERE st.category = cat
      AND (st.subcategory = subcat OR (subcat IS NULL AND st.subcategory IS NULL))
      AND st.is_active = TRUE
    ORDER BY st.subcategory NULLS LAST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- Function to calculate persona boundary testing ratio
CREATE OR REPLACE FUNCTION calculate_persona_boundary_ratio(p_id UUID, ym CHAR(7))
RETURNS DECIMAL AS $$
DECLARE
    persona_rate DECIMAL;
    platform_avg DECIMAL;
BEGIN
    -- Get persona's boundary test rate
    SELECT
        CASE WHEN total_conversations > 0
             THEN boundary_test_count::DECIMAL / total_conversations
             ELSE 0
        END INTO persona_rate
    FROM persona_engagement_metrics
    WHERE persona_id = p_id AND year_month = ym;

    -- Get platform average
    SELECT
        CASE WHEN SUM(total_conversations) > 0
             THEN SUM(boundary_test_count)::DECIMAL / SUM(total_conversations)
             ELSE 0
        END INTO platform_avg
    FROM persona_engagement_metrics
    WHERE year_month = ym;

    -- Return ratio (> 1.5 means 50% above average)
    IF platform_avg > 0 THEN
        RETURN persona_rate / platform_avg;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- Function to aggregate persona engagement metrics for a month
CREATE OR REPLACE FUNCTION aggregate_persona_engagement(p_id UUID, ym CHAR(7))
RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    boundary_ratio DECIMAL;
BEGIN
    start_date := (ym || '-01')::DATE;
    end_date := (start_date + INTERVAL '1 month')::DATE;

    INSERT INTO persona_engagement_metrics (
        persona_id, year_month,
        total_conversations, total_messages, unique_users,
        avg_relatability, avg_friendliness, avg_boundary_clarity,
        avg_biblical_alignment, avg_redirection_effectiveness, avg_overall_score,
        boundary_test_count, flirtation_attempt_count, crisis_signal_count,
        boundary_handling_success_rate
    )
    SELECT
        p_id,
        ym,
        COUNT(DISTINCT pp.conversation_id),
        COUNT(pp.id),
        COUNT(DISTINCT pp.user_id),
        AVG(pp.relatability),
        AVG(pp.friendliness),
        AVG(pp.boundary_clarity),
        AVG(pp.biblical_alignment),
        AVG(pp.redirection_effectiveness),
        AVG(pp.overall_score),
        COUNT(*) FILTER (WHERE pp.encountered_boundary_test = TRUE),
        COUNT(*) FILTER (WHERE pp.boundary_test_type = 'flirtation' OR pp.boundary_test_type = 'romantic_pursuit'),
        COUNT(*) FILTER (WHERE pp.encountered_crisis_signal = TRUE),
        CASE
            WHEN COUNT(*) FILTER (WHERE pp.encountered_boundary_test = TRUE) > 0
            THEN (COUNT(*) FILTER (WHERE pp.handled_boundary_appropriately = TRUE)::DECIMAL /
                  COUNT(*) FILTER (WHERE pp.encountered_boundary_test = TRUE)) * 100
            ELSE NULL
        END
    FROM persona_performance pp
    JOIN conversations c ON pp.conversation_id = c.id
    WHERE pp.persona_id = p_id
      AND pp.created_at >= start_date
      AND pp.created_at < end_date
      AND c.is_private = FALSE  -- Privacy enforcement
    ON CONFLICT (persona_id, year_month) DO UPDATE SET
        total_conversations = EXCLUDED.total_conversations,
        total_messages = EXCLUDED.total_messages,
        unique_users = EXCLUDED.unique_users,
        avg_relatability = EXCLUDED.avg_relatability,
        avg_friendliness = EXCLUDED.avg_friendliness,
        avg_boundary_clarity = EXCLUDED.avg_boundary_clarity,
        avg_biblical_alignment = EXCLUDED.avg_biblical_alignment,
        avg_redirection_effectiveness = EXCLUDED.avg_redirection_effectiveness,
        avg_overall_score = EXCLUDED.avg_overall_score,
        boundary_test_count = EXCLUDED.boundary_test_count,
        flirtation_attempt_count = EXCLUDED.flirtation_attempt_count,
        crisis_signal_count = EXCLUDED.crisis_signal_count,
        boundary_handling_success_rate = EXCLUDED.boundary_handling_success_rate,
        updated_at = NOW();

    -- Calculate and update boundary testing ratio
    boundary_ratio := calculate_persona_boundary_ratio(p_id, ym);

    UPDATE persona_engagement_metrics
    SET
        boundary_testing_ratio = boundary_ratio,
        disproportionate_boundary_testing = (boundary_ratio > 1.5),
        flagged_for_review = (boundary_ratio > 2.0),
        review_reason = CASE WHEN boundary_ratio > 2.0
                            THEN 'Boundary testing rate ' || ROUND(boundary_ratio * 100) || '% of platform average'
                            ELSE NULL END
    WHERE persona_id = p_id AND year_month = ym;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- ADD COLUMNS TO EXISTING TABLES
-- ============================================

DO $$
BEGIN
    -- Add safeguard fields to conversation_analysis if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversation_analysis' AND column_name = 'safeguard_analyzed'
    ) THEN
        ALTER TABLE conversation_analysis ADD COLUMN safeguard_analyzed BOOLEAN DEFAULT FALSE;
        ALTER TABLE conversation_analysis ADD COLUMN safeguard_flags_generated INTEGER DEFAULT 0;
        ALTER TABLE conversation_analysis ADD COLUMN persona_performance_id UUID;
        COMMENT ON COLUMN conversation_analysis.safeguard_analyzed IS 'Whether safeguard analysis was performed';
    END IF;

    -- Add safety-related role to users if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'safety_reviewer'
    ) THEN
        -- If user_role is an enum, we'd add the new value
        -- For now, assume role is VARCHAR and document the new roles
        NULL;
    END IF;
END $$;


-- ============================================
-- TRIGGER: Prevent safety records for private conversations
-- ============================================

CREATE OR REPLACE FUNCTION prevent_private_safety_records()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT verify_conversation_not_private(NEW.conversation_id) THEN
        RAISE EXCEPTION 'Cannot create safety records for private conversations';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_safety_flags_privacy ON safety_flags;
CREATE TRIGGER trg_safety_flags_privacy
    BEFORE INSERT ON safety_flags
    FOR EACH ROW
    EXECUTE FUNCTION prevent_private_safety_records();

DROP TRIGGER IF EXISTS trg_persona_performance_privacy ON persona_performance;
CREATE TRIGGER trg_persona_performance_privacy
    BEFORE INSERT ON persona_performance
    FOR EACH ROW
    EXECUTE FUNCTION prevent_private_safety_records();

COMMENT ON TRIGGER trg_safety_flags_privacy ON safety_flags IS 'Hard block: prevents any safety flags for private conversations';
COMMENT ON TRIGGER trg_persona_performance_privacy ON persona_performance IS 'Hard block: prevents persona metrics for private conversations';


-- ============================================
-- VIEWS
-- ============================================

-- View for active alerts requiring attention
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT
    a.id,
    a.alert_type,
    a.category,
    a.severity,
    a.confidence,
    a.title,
    a.redacted_summary,
    a.recommended_action,
    a.status,
    a.created_at,
    a.requires_authorization,
    a.authorization_level,
    u.display_name as user_display_name,
    p.name as persona_name,
    CASE
        WHEN a.severity = 'critical' THEN 1
        WHEN a.severity = 'high' THEN 2
        WHEN a.severity = 'elevated' THEN 3
        WHEN a.severity = 'moderate' THEN 4
        ELSE 5
    END as severity_order
FROM admin_alerts a
LEFT JOIN users u ON a.user_id = u.id
LEFT JOIN personas p ON a.persona_id = p.id
WHERE a.status IN ('new', 'viewed', 'acknowledged', 'under_review')
  AND (a.expires_at IS NULL OR a.expires_at > NOW())
ORDER BY severity_order, a.created_at DESC;

COMMENT ON VIEW v_active_alerts IS 'Active alerts requiring admin attention, sorted by severity';


-- View for persona safety trends
CREATE OR REPLACE VIEW v_persona_safety_trends AS
SELECT
    p.id as persona_id,
    p.name as persona_name,
    p.slug as persona_slug,
    pem.year_month,
    pem.total_conversations,
    pem.boundary_test_count,
    pem.flirtation_attempt_count,
    pem.crisis_signal_count,
    pem.boundary_handling_success_rate,
    pem.disproportionate_boundary_testing,
    pem.boundary_testing_ratio,
    pem.flagged_for_review,
    pem.avg_overall_score
FROM personas p
JOIN persona_engagement_metrics pem ON p.id = pem.persona_id
ORDER BY p.name, pem.year_month DESC;

COMMENT ON VIEW v_persona_safety_trends IS 'Persona safety metrics over time';
