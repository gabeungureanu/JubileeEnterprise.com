-- ============================================
-- JubileeVerse Database Schema
-- Migration 018: Admin Analytics Dashboard
-- ============================================

-- Monthly Analytics Summary Table
-- Aggregates user counts, revenue, and token usage for admin dashboard
CREATE TABLE IF NOT EXISTS admin_monthly_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Year and month
    analytics_year INT NOT NULL,
    analytics_month INT NOT NULL CHECK (analytics_month >= 1 AND analytics_month <= 12),

    -- User counts (snapshot at end of month, updated in real-time for current month)
    subscribed_users_count INT DEFAULT 0,
    free_users_count INT DEFAULT 0,

    -- Revenue (in cents for precision)
    monthly_revenue_cents INT DEFAULT 0,

    -- Token usage by provider
    openai_tokens_used BIGINT DEFAULT 0,
    claude_tokens_used BIGINT DEFAULT 0,
    gemini_tokens_used BIGINT DEFAULT 0,
    copilot_tokens_used BIGINT DEFAULT 0,
    grok_tokens_used BIGINT DEFAULT 0,

    -- Token costs (in cents for precision, e.g., 1426 = $14.26)
    openai_cost_cents INT DEFAULT 0,
    claude_cost_cents INT DEFAULT 0,
    gemini_cost_cents INT DEFAULT 0,
    copilot_cost_cents INT DEFAULT 0,
    grok_cost_cents INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One record per month
    UNIQUE(analytics_year, analytics_month)
);

-- Token usage tracking per request (for detailed cost calculation)
CREATE TABLE IF NOT EXISTS ai_token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Request details
    request_id VARCHAR(100),

    -- Provider info
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('openai', 'claude', 'gemini', 'copilot', 'grok')),
    model VARCHAR(100),

    -- Token counts
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,

    -- Cost in cents (calculated based on model pricing)
    cost_cents INT DEFAULT 0,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Provider pricing configuration (for calculating costs)
CREATE TABLE IF NOT EXISTS ai_provider_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    provider VARCHAR(30) NOT NULL,
    model VARCHAR(100) NOT NULL,

    -- Pricing per 1000 tokens in cents (e.g., 0.15 cents = 15 for $0.0015)
    prompt_cost_per_1k_cents DECIMAL(10, 4) DEFAULT 0,
    completion_cost_per_1k_cents DECIMAL(10, 4) DEFAULT 0,

    -- Effective dates for pricing changes
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(provider, model, effective_from)
);

-- Insert default pricing (approximate as of late 2024)
INSERT INTO ai_provider_pricing (provider, model, prompt_cost_per_1k_cents, completion_cost_per_1k_cents) VALUES
    -- OpenAI GPT-4o pricing
    ('openai', 'gpt-4o', 0.25, 1.0),
    ('openai', 'gpt-4o-mini', 0.015, 0.06),
    ('openai', 'gpt-4-turbo', 1.0, 3.0),
    -- Claude pricing
    ('claude', 'claude-3-5-sonnet-20241022', 0.3, 1.5),
    ('claude', 'claude-3-opus-20240229', 1.5, 7.5),
    ('claude', 'claude-3-haiku-20240307', 0.025, 0.125),
    -- Gemini pricing
    ('gemini', 'gemini-1.5-pro', 0.125, 0.5),
    ('gemini', 'gemini-1.5-flash', 0.0075, 0.03),
    -- Grok pricing (approximate)
    ('grok', 'grok-2', 0.5, 1.5),
    ('grok', 'grok-2-mini', 0.1, 0.3)
ON CONFLICT (provider, model, effective_from) DO NOTHING;

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_admin_monthly_analytics_date ON admin_monthly_analytics(analytics_year DESC, analytics_month DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_provider ON ai_token_usage(provider);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created ON ai_token_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user ON ai_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_pricing_active ON ai_provider_pricing(provider, model) WHERE is_active = TRUE;

-- Function to update monthly analytics when token usage is recorded
CREATE OR REPLACE FUNCTION update_monthly_token_analytics()
RETURNS TRIGGER AS $$
DECLARE
    current_year INT;
    current_month INT;
BEGIN
    current_year := EXTRACT(YEAR FROM NEW.created_at)::INT;
    current_month := EXTRACT(MONTH FROM NEW.created_at)::INT;

    -- Insert or update monthly analytics
    INSERT INTO admin_monthly_analytics (analytics_year, analytics_month)
    VALUES (current_year, current_month)
    ON CONFLICT (analytics_year, analytics_month) DO NOTHING;

    -- Update token counts and costs based on provider
    IF NEW.provider = 'openai' THEN
        UPDATE admin_monthly_analytics
        SET openai_tokens_used = openai_tokens_used + NEW.total_tokens,
            openai_cost_cents = openai_cost_cents + NEW.cost_cents,
            updated_at = NOW()
        WHERE analytics_year = current_year AND analytics_month = current_month;
    ELSIF NEW.provider = 'claude' THEN
        UPDATE admin_monthly_analytics
        SET claude_tokens_used = claude_tokens_used + NEW.total_tokens,
            claude_cost_cents = claude_cost_cents + NEW.cost_cents,
            updated_at = NOW()
        WHERE analytics_year = current_year AND analytics_month = current_month;
    ELSIF NEW.provider = 'gemini' THEN
        UPDATE admin_monthly_analytics
        SET gemini_tokens_used = gemini_tokens_used + NEW.total_tokens,
            gemini_cost_cents = gemini_cost_cents + NEW.cost_cents,
            updated_at = NOW()
        WHERE analytics_year = current_year AND analytics_month = current_month;
    ELSIF NEW.provider = 'copilot' THEN
        UPDATE admin_monthly_analytics
        SET copilot_tokens_used = copilot_tokens_used + NEW.total_tokens,
            copilot_cost_cents = copilot_cost_cents + NEW.cost_cents,
            updated_at = NOW()
        WHERE analytics_year = current_year AND analytics_month = current_month;
    ELSIF NEW.provider = 'grok' THEN
        UPDATE admin_monthly_analytics
        SET grok_tokens_used = grok_tokens_used + NEW.total_tokens,
            grok_cost_cents = grok_cost_cents + NEW.cost_cents,
            updated_at = NOW()
        WHERE analytics_year = current_year AND analytics_month = current_month;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update monthly analytics on token usage insert
DROP TRIGGER IF EXISTS trigger_update_monthly_token_analytics ON ai_token_usage;
CREATE TRIGGER trigger_update_monthly_token_analytics
    AFTER INSERT ON ai_token_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_monthly_token_analytics();

-- Function to recalculate user counts and revenue for current month
CREATE OR REPLACE FUNCTION refresh_monthly_user_analytics()
RETURNS void AS $$
DECLARE
    current_year INT;
    current_month INT;
    subscribed_count INT;
    free_count INT;
    revenue INT;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW())::INT;
    current_month := EXTRACT(MONTH FROM NOW())::INT;

    -- Count subscribed users (active subscription with non-free plan)
    SELECT COUNT(*) INTO subscribed_count
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.status = 'active' AND sp.slug != 'free';

    -- Count free users (active subscription with free plan or no subscription)
    SELECT COUNT(*) INTO free_count
    FROM users u
    WHERE NOT EXISTS (
        SELECT 1 FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = u.id AND us.status = 'active' AND sp.slug != 'free'
    );

    -- Calculate monthly revenue from active subscriptions
    SELECT COALESCE(SUM(sp.price_monthly_cents), 0) INTO revenue
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.status = 'active' AND sp.slug != 'free';

    -- Upsert the analytics record
    INSERT INTO admin_monthly_analytics (analytics_year, analytics_month, subscribed_users_count, free_users_count, monthly_revenue_cents)
    VALUES (current_year, current_month, subscribed_count, free_count, revenue)
    ON CONFLICT (analytics_year, analytics_month)
    DO UPDATE SET
        subscribed_users_count = EXCLUDED.subscribed_users_count,
        free_users_count = EXCLUDED.free_users_count,
        monthly_revenue_cents = EXCLUDED.monthly_revenue_cents,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Run initial analytics refresh
SELECT refresh_monthly_user_analytics();

-- Apply updated_at triggers
CREATE TRIGGER update_admin_monthly_analytics_updated_at
    BEFORE UPDATE ON admin_monthly_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_provider_pricing_updated_at
    BEFORE UPDATE ON ai_provider_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
