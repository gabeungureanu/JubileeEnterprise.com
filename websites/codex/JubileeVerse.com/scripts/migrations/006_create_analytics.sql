-- ============================================
-- JubileeVerse Database Schema
-- Migration 006: Analytics and Usage Tracking
-- ============================================

-- Daily usage statistics (aggregated)
CREATE TABLE IF NOT EXISTS usage_stats_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL,

    -- User metrics
    total_users INT DEFAULT 0,
    new_users INT DEFAULT 0,
    active_users INT DEFAULT 0,

    -- Conversation metrics
    total_conversations INT DEFAULT 0,
    new_conversations INT DEFAULT 0,

    -- Message metrics
    total_messages INT DEFAULT 0,
    user_messages INT DEFAULT 0,
    ai_responses INT DEFAULT 0,

    -- AI metrics
    total_tokens_used INT DEFAULT 0,
    avg_response_time_ms INT DEFAULT 0,

    -- Translation metrics
    translation_requests INT DEFAULT 0,
    translation_characters INT DEFAULT 0,

    -- Engagement
    avg_session_duration_seconds INT DEFAULT 0,
    avg_messages_per_conversation DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(stat_date)
);

-- Persona usage statistics
CREATE TABLE IF NOT EXISTS persona_stats_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

    conversation_count INT DEFAULT 0,
    message_count INT DEFAULT 0,
    unique_users INT DEFAULT 0,
    avg_rating DECIMAL(3,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(stat_date, persona_id)
);

-- User activity log (for security and analytics)
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT,
    response_time_ms INT,
    request_size INT,
    response_size INT,
    ip_address INET,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Error logs
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_type VARCHAR(100) NOT NULL,
    error_code VARCHAR(50),
    message TEXT NOT NULL,
    stack_trace TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_path VARCHAR(255),
    request_method VARCHAR(10),
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback and support tickets
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('bug', 'feature', 'content', 'general', 'support')),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Indexes for daily stats
CREATE INDEX IF NOT EXISTS idx_usage_stats_daily_date ON usage_stats_daily(stat_date);
CREATE INDEX IF NOT EXISTS idx_persona_stats_daily_date ON persona_stats_daily(stat_date);
CREATE INDEX IF NOT EXISTS idx_persona_stats_daily_persona ON persona_stats_daily(persona_id);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created ON user_activity_logs(created_at);

-- Indexes for API logs
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_status ON api_usage_logs(status_code);

-- Indexes for error logs
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON error_logs(resolved) WHERE resolved = FALSE;

-- Indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

-- Updated_at trigger for feedback
CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Partitioning for high-volume tables (optional, for scaling)
-- Note: Uncomment and modify if you expect very high volume

-- CREATE TABLE user_activity_logs_partitioned (
--     LIKE user_activity_logs INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

-- CREATE TABLE api_usage_logs_partitioned (
--     LIKE api_usage_logs INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);
