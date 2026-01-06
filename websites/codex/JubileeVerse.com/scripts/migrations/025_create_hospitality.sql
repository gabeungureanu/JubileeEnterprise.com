-- ============================================
-- JubileeVerse Database Schema
-- Migration 025: Hospitality Module
-- ============================================
-- Hospitality system for tracking user engagement,
-- triggering contextual interactions, and managing engagement rules.
-- Supports both visitors (non-subscribers) and subscribers.

-- ============================================
-- HOSPITALITY USER STATE
-- Per-user snapshot of current engagement metrics
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_user_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),  -- For anonymous visitors

    -- Engagement metrics
    page_views INT DEFAULT 0,
    session_count INT DEFAULT 1,
    total_time_on_site_seconds INT DEFAULT 0,
    current_session_start TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),

    -- Engagement scoring (0-100)
    engagement_score INT DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),

    -- Funnel position
    funnel_stage VARCHAR(50) DEFAULT 'visitor' CHECK (funnel_stage IN ('visitor', 'interested', 'engaged', 'subscriber', 'advocate')),

    -- Last context
    last_page_url VARCHAR(500),
    last_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Hospitality popup tracking
    popups_shown_today INT DEFAULT 0,
    popups_dismissed_today INT DEFAULT 0,
    last_popup_shown_at TIMESTAMPTZ,
    last_popup_type VARCHAR(100),

    -- Cooldown tracking
    global_cooldown_until TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: one record per user OR session (not both null)
    CONSTRAINT hospitality_user_state_user_unique UNIQUE(user_id),
    CONSTRAINT hospitality_user_state_session_unique UNIQUE(session_id),
    CONSTRAINT hospitality_user_state_has_identifier CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- ============================================
-- HOSPITALITY RULES
-- Configurable engagement rules (created before actions for FK)
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Rule identification
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    -- Targeting
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('all', 'visitor', 'subscriber', 'free', 'paid')),
    target_funnel_stages VARCHAR(255),  -- Comma-separated: 'visitor,interested,engaged'

    -- Trigger conditions (JSONB for flexibility)
    -- Example: {"event_type": "page_view", "page_count_gte": 3, "time_on_site_gte": 60}
    trigger_conditions JSONB NOT NULL DEFAULT '{}',

    -- Action configuration
    action_type VARCHAR(100) NOT NULL CHECK (action_type IN ('popup', 'notification', 'persona_message', 'redirect')),
    -- Example: {"subtype": "welcome", "persona_id": "...", "title": "...", "message": "..."}
    action_config JSONB NOT NULL DEFAULT '{}',

    -- Scheduling
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 100,  -- Lower = higher priority
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,

    -- Rate limiting
    max_per_session INT DEFAULT 1,
    max_per_day INT DEFAULT 3,
    cooldown_seconds INT DEFAULT 300,  -- 5 minute default

    -- Admin tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- HOSPITALITY EVENTS
-- Append-only log of engagement signals
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),  -- For anonymous visitors

    -- Event details
    event_type VARCHAR(100) NOT NULL,  -- page_view, scroll_depth, time_on_page, chat_start, interaction, etc.
    event_source VARCHAR(100),         -- page, persona, feature, system
    event_context JSONB DEFAULT '{}',  -- Flexible context data

    -- Page context
    page_url VARCHAR(500),
    page_title VARCHAR(255),
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Metrics
    metric_value INT,  -- e.g., scroll percentage, seconds, click count

    -- Client info (for analytics, privacy-conscious)
    user_agent VARCHAR(500),
    ip_hash VARCHAR(64),  -- Hashed for privacy
    referrer VARCHAR(500),

    -- Timestamp (no updated_at - append-only)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure at least one identifier
    CONSTRAINT hospitality_events_has_identifier CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- ============================================
-- HOSPITALITY ACTIONS
-- Record of system/persona actions taken
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),

    -- Rule that triggered this action
    rule_id UUID REFERENCES hospitality_rules(id) ON DELETE SET NULL,

    -- Action details
    action_type VARCHAR(100) NOT NULL,  -- popup, notification, persona_message, redirect
    action_subtype VARCHAR(100),        -- welcome, engagement, assistance, recognition

    -- Persona involvement
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Content delivered
    action_content JSONB DEFAULT '{}',  -- Message text, popup config, etc.

    -- Outcome tracking
    outcome VARCHAR(50) DEFAULT 'pending' CHECK (outcome IN ('pending', 'shown', 'clicked', 'dismissed', 'converted', 'expired')),
    outcome_at TIMESTAMPTZ,

    -- Context
    trigger_event_id UUID REFERENCES hospitality_events(id) ON DELETE SET NULL,
    page_url VARCHAR(500),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure at least one identifier
    CONSTRAINT hospitality_actions_has_identifier CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- ============================================
-- HOSPITALITY RULE COOLDOWNS
-- Per-user/session cooldowns for each rule
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_rule_cooldowns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    rule_id UUID NOT NULL REFERENCES hospitality_rules(id) ON DELETE CASCADE,

    -- Cooldown state
    times_triggered_session INT DEFAULT 0,
    times_triggered_today INT DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,

    -- Daily reset tracking
    last_daily_reset DATE DEFAULT CURRENT_DATE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One cooldown record per user/rule or session/rule
    CONSTRAINT hospitality_cooldowns_user_rule_unique UNIQUE(user_id, rule_id),
    CONSTRAINT hospitality_cooldowns_session_rule_unique UNIQUE(session_id, rule_id),
    CONSTRAINT hospitality_cooldowns_has_identifier CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- ============================================
-- INDEXES
-- ============================================

-- hospitality_user_state indexes
CREATE INDEX IF NOT EXISTS idx_hospitality_user_state_user ON hospitality_user_state(user_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_user_state_session ON hospitality_user_state(session_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_user_state_last_activity ON hospitality_user_state(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_hospitality_user_state_funnel ON hospitality_user_state(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_hospitality_user_state_score ON hospitality_user_state(engagement_score);

-- hospitality_events indexes
CREATE INDEX IF NOT EXISTS idx_hospitality_events_user ON hospitality_events(user_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_events_session ON hospitality_events(session_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_events_type ON hospitality_events(event_type);
CREATE INDEX IF NOT EXISTS idx_hospitality_events_created ON hospitality_events(created_at);
CREATE INDEX IF NOT EXISTS idx_hospitality_events_page ON hospitality_events(page_url);
CREATE INDEX IF NOT EXISTS idx_hospitality_events_persona ON hospitality_events(persona_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_events_user_created ON hospitality_events(user_id, created_at DESC);

-- hospitality_actions indexes
CREATE INDEX IF NOT EXISTS idx_hospitality_actions_user ON hospitality_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_actions_session ON hospitality_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_actions_rule ON hospitality_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_actions_type ON hospitality_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_hospitality_actions_outcome ON hospitality_actions(outcome);
CREATE INDEX IF NOT EXISTS idx_hospitality_actions_created ON hospitality_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_hospitality_actions_pending ON hospitality_actions(user_id, outcome) WHERE outcome = 'pending';

-- hospitality_rules indexes
CREATE INDEX IF NOT EXISTS idx_hospitality_rules_active ON hospitality_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_hospitality_rules_priority ON hospitality_rules(priority);
CREATE INDEX IF NOT EXISTS idx_hospitality_rules_target ON hospitality_rules(target_audience);
CREATE INDEX IF NOT EXISTS idx_hospitality_rules_active_priority ON hospitality_rules(is_active, priority) WHERE is_active = TRUE;

-- hospitality_rule_cooldowns indexes
CREATE INDEX IF NOT EXISTS idx_hospitality_cooldowns_user ON hospitality_rule_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_cooldowns_session ON hospitality_rule_cooldowns(session_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_cooldowns_rule ON hospitality_rule_cooldowns(rule_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_cooldowns_until ON hospitality_rule_cooldowns(cooldown_until);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for hospitality_user_state
CREATE TRIGGER update_hospitality_user_state_updated_at
    BEFORE UPDATE ON hospitality_user_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for hospitality_actions
CREATE TRIGGER update_hospitality_actions_updated_at
    BEFORE UPDATE ON hospitality_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for hospitality_rules
CREATE TRIGGER update_hospitality_rules_updated_at
    BEFORE UPDATE ON hospitality_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for hospitality_rule_cooldowns
CREATE TRIGGER update_hospitality_rule_cooldowns_updated_at
    BEFORE UPDATE ON hospitality_rule_cooldowns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to reset daily counters (call via cron or scheduled job)
CREATE OR REPLACE FUNCTION reset_hospitality_daily_counters()
RETURNS void AS $$
BEGIN
    -- Reset user state daily counters
    UPDATE hospitality_user_state
    SET popups_shown_today = 0,
        popups_dismissed_today = 0,
        updated_at = NOW()
    WHERE popups_shown_today > 0 OR popups_dismissed_today > 0;

    -- Reset cooldown daily counters
    UPDATE hospitality_rule_cooldowns
    SET times_triggered_today = 0,
        last_daily_reset = CURRENT_DATE,
        updated_at = NOW()
    WHERE last_daily_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old events (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_hospitality_events(days_to_keep INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM hospitality_events
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE hospitality_user_state IS 'Per-user engagement snapshot for hospitality module - tracks engagement score and funnel position';
COMMENT ON TABLE hospitality_events IS 'Append-only log of user engagement signals (page views, interactions, etc.)';
COMMENT ON TABLE hospitality_actions IS 'Actions taken by the hospitality system (popups shown, messages sent)';
COMMENT ON TABLE hospitality_rules IS 'Configurable rules for triggering hospitality actions based on engagement signals';
COMMENT ON TABLE hospitality_rule_cooldowns IS 'Per-user/session cooldowns to prevent action spam';

COMMENT ON COLUMN hospitality_user_state.funnel_stage IS 'User journey stage: visitor -> interested -> engaged -> subscriber -> advocate';
COMMENT ON COLUMN hospitality_user_state.engagement_score IS 'Calculated engagement score 0-100 based on user activity';
COMMENT ON COLUMN hospitality_rules.trigger_conditions IS 'JSONB conditions like {event_type, page_count_gte, time_on_site_gte, engagement_score_gte}';
COMMENT ON COLUMN hospitality_rules.action_config IS 'JSONB action details like {subtype, persona_id, title, message, primaryAction, secondaryAction}';
COMMENT ON COLUMN hospitality_events.ip_hash IS 'SHA-256 hash of IP address (first 16 chars) for privacy-conscious analytics';
