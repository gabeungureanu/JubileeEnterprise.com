-- ============================================
-- JubileeVerse Database Schema
-- Migration 014: Subscription Plans and Usage Tracking
-- ============================================

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Plan identity
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,

    -- Plan tier (for ordering and comparison)
    tier_level INT NOT NULL DEFAULT 0,

    -- Pricing (stored in cents for precision)
    price_monthly_cents INT DEFAULT 0,
    price_yearly_cents INT DEFAULT 0,

    -- Limits (NULL means unlimited)
    daily_word_limit INT,
    monthly_word_limit INT,
    max_conversations INT,
    max_personas INT,
    max_communities INT,

    -- Features (stored as JSONB for flexibility)
    features JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, slug, description, tier_level, price_monthly_cents, price_yearly_cents, daily_word_limit, monthly_word_limit, is_active, is_default, features) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Free', 'free',
     'Basic access to JubileeVerse with limited AI interactions',
     0, 0, 0, 5000, 50000, TRUE, TRUE,
     '{"ai_providers": ["openai"], "max_message_length": 2000, "translation_enabled": false, "priority_support": false}'::jsonb),

    ('00000000-0000-0000-0000-000000000002', 'Standard', 'standard',
     'Enhanced access with more AI interactions and translation support',
     1, 999, 9990, 25000, 500000, TRUE, FALSE,
     '{"ai_providers": ["openai", "anthropic"], "max_message_length": 4000, "translation_enabled": true, "priority_support": false}'::jsonb),

    ('00000000-0000-0000-0000-000000000003', 'Ministry', 'ministry',
     'Full access for ministry leaders with expanded limits',
     2, 2999, 29990, 100000, 2000000, TRUE, FALSE,
     '{"ai_providers": ["openai", "anthropic", "grok"], "max_message_length": 8000, "translation_enabled": true, "priority_support": true, "community_creation": true}'::jsonb),

    ('00000000-0000-0000-0000-000000000004', 'Business', 'business',
     'Unlimited access for organizations and enterprises',
     3, 9999, 99990, NULL, NULL, TRUE, FALSE,
     '{"ai_providers": ["openai", "anthropic", "grok"], "max_message_length": 16000, "translation_enabled": true, "priority_support": true, "community_creation": true, "api_access": true, "custom_personas": true}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- User Subscriptions Table (links users to their subscription plan)
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,

    -- Subscription status
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'trialing')),

    -- Billing period
    billing_period VARCHAR(20) DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly', 'lifetime')),

    -- Important dates
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    -- Payment tracking (for future integration)
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Only one active subscription per user
    UNIQUE(user_id)
);

-- AI Usage Tracking - Daily Summary Table
CREATE TABLE IF NOT EXISTS ai_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Date for this record (UTC)
    usage_date DATE NOT NULL,

    -- Word counts
    words_sent INT DEFAULT 0,
    words_received INT DEFAULT 0,

    -- Request counts
    request_count INT DEFAULT 0,

    -- Provider breakdown (JSONB for flexibility)
    provider_usage JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One record per user per day
    UNIQUE(user_id, usage_date)
);

-- AI Usage Tracking - Monthly Summary Table (for efficient aggregation)
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Year and month
    usage_year INT NOT NULL,
    usage_month INT NOT NULL CHECK (usage_month >= 1 AND usage_month <= 12),

    -- Word counts (aggregated)
    words_sent INT DEFAULT 0,
    words_received INT DEFAULT 0,

    -- Request counts
    request_count INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One record per user per month
    UNIQUE(user_id, usage_year, usage_month)
);

-- AI Usage Tracking - Yearly Summary Table
CREATE TABLE IF NOT EXISTS ai_usage_yearly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Year
    usage_year INT NOT NULL,

    -- Word counts (aggregated)
    words_sent INT DEFAULT 0,
    words_received INT DEFAULT 0,

    -- Request counts
    request_count INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One record per user per year
    UNIQUE(user_id, usage_year)
);

-- AI Usage Tracking - Lifetime Totals (stored directly on users for fast access)
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_words_sent BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_words_received BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_request_count BIGINT DEFAULT 0;

-- Add community_id column to board_conversations if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'board_conversations' AND column_name = 'community_id'
    ) THEN
        ALTER TABLE board_conversations ADD COLUMN community_id UUID REFERENCES communities(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes for subscription plans
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription_plans(tier_level);

-- Indexes for user subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(user_id) WHERE status = 'active';

-- Indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user_date ON ai_usage_daily(user_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_user ON ai_usage_monthly(user_id, usage_year DESC, usage_month DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_yearly_user ON ai_usage_yearly(user_id, usage_year DESC);

-- Trigger to update monthly summary when daily is updated
CREATE OR REPLACE FUNCTION update_ai_usage_monthly()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ai_usage_monthly (user_id, usage_year, usage_month, words_sent, words_received, request_count)
    VALUES (
        NEW.user_id,
        EXTRACT(YEAR FROM NEW.usage_date)::INT,
        EXTRACT(MONTH FROM NEW.usage_date)::INT,
        NEW.words_sent,
        NEW.words_received,
        NEW.request_count
    )
    ON CONFLICT (user_id, usage_year, usage_month)
    DO UPDATE SET
        words_sent = ai_usage_monthly.words_sent + (NEW.words_sent - COALESCE(OLD.words_sent, 0)),
        words_received = ai_usage_monthly.words_received + (NEW.words_received - COALESCE(OLD.words_received, 0)),
        request_count = ai_usage_monthly.request_count + (NEW.request_count - COALESCE(OLD.request_count, 0)),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_usage_monthly
    AFTER INSERT OR UPDATE ON ai_usage_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_usage_monthly();

-- Trigger to update yearly summary when monthly is updated
CREATE OR REPLACE FUNCTION update_ai_usage_yearly()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ai_usage_yearly (user_id, usage_year, words_sent, words_received, request_count)
    VALUES (
        NEW.user_id,
        NEW.usage_year,
        NEW.words_sent,
        NEW.words_received,
        NEW.request_count
    )
    ON CONFLICT (user_id, usage_year)
    DO UPDATE SET
        words_sent = ai_usage_yearly.words_sent + (NEW.words_sent - COALESCE(OLD.words_sent, 0)),
        words_received = ai_usage_yearly.words_received + (NEW.words_received - COALESCE(OLD.words_received, 0)),
        request_count = ai_usage_yearly.request_count + (NEW.request_count - COALESCE(OLD.request_count, 0)),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_usage_yearly
    AFTER INSERT OR UPDATE ON ai_usage_monthly
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_usage_yearly();

-- Trigger to update lifetime totals on users table
CREATE OR REPLACE FUNCTION update_user_lifetime_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET
        lifetime_words_sent = lifetime_words_sent + (NEW.words_sent - COALESCE(OLD.words_sent, 0)),
        lifetime_words_received = lifetime_words_received + (NEW.words_received - COALESCE(OLD.words_received, 0)),
        lifetime_request_count = lifetime_request_count + (NEW.request_count - COALESCE(OLD.request_count, 0)),
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_lifetime_usage
    AFTER INSERT OR UPDATE ON ai_usage_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_user_lifetime_usage();

-- Function to assign default free plan to new users
CREATE OR REPLACE FUNCTION assign_default_subscription()
RETURNS TRIGGER AS $$
DECLARE
    default_plan_id UUID;
BEGIN
    SELECT id INTO default_plan_id FROM subscription_plans WHERE is_default = TRUE LIMIT 1;

    IF default_plan_id IS NOT NULL THEN
        INSERT INTO user_subscriptions (user_id, plan_id, status, billing_period)
        VALUES (NEW.id, default_plan_id, 'active', 'monthly')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assign_default_subscription
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION assign_default_subscription();

-- Apply updated_at triggers
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_usage_daily_updated_at
    BEFORE UPDATE ON ai_usage_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_usage_monthly_updated_at
    BEFORE UPDATE ON ai_usage_monthly
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_usage_yearly_updated_at
    BEFORE UPDATE ON ai_usage_yearly
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Assign free plan to existing users who don't have a subscription
INSERT INTO user_subscriptions (user_id, plan_id, status, billing_period)
SELECT u.id, sp.id, 'active', 'monthly'
FROM users u
CROSS JOIN subscription_plans sp
WHERE sp.is_default = TRUE
AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
