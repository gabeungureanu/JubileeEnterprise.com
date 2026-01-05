-- Migration: 0001_initial_schema
-- Database: continuum
-- Author: Jubilee Solutions
-- Date: 2026-01-04
-- Description: Initial Continuum database schema - User data, activity, subscriptions

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- USER PREFERENCES & SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    theme VARCHAR(20) DEFAULT 'light',
    font_size VARCHAR(20) DEFAULT 'medium',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_bible_version VARCHAR(20) DEFAULT 'KJV',
    preferred_persona_id UUID,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ============================================================================
-- USER SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_agent TEXT,
    ip_address INET,
    device_fingerprint VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- SUBSCRIPTIONS & BILLING
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    slug CITEXT NOT NULL UNIQUE,
    description TEXT,
    tier_level INTEGER NOT NULL DEFAULT 0,
    price_monthly_cents INTEGER NOT NULL DEFAULT 0,
    price_yearly_cents INTEGER NOT NULL DEFAULT 0,
    daily_word_limit INTEGER,
    monthly_word_limit INTEGER,
    max_conversations INTEGER,
    max_personas INTEGER,
    max_communities INTEGER,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    payment_method_id UUID,
    last_payment_date TIMESTAMPTZ,
    last_payment_amount_cents INTEGER,
    next_billing_date TIMESTAMPTZ,
    payment_failed_at TIMESTAMPTZ,
    payment_failure_count INTEGER NOT NULL DEFAULT 0,
    grace_period_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    stripe_payment_method_id VARCHAR(100) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(100) NOT NULL,
    card_brand VARCHAR(20),
    card_last_four VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    cardholder_name VARCHAR(200),
    billing_address_line1 VARCHAR(200),
    billing_address_line2 VARCHAR(200),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(2),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

CREATE TABLE IF NOT EXISTS billing_information (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    billing_name VARCHAR(200),
    billing_email CITEXT,
    billing_phone VARCHAR(50),
    phone_country_code VARCHAR(5),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_tax_ids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    tax_id_type VARCHAR(20) NOT NULL,
    tax_id_value VARCHAR(100) NOT NULL,
    stripe_tax_id VARCHAR(100),
    verification_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_tax_ids_user ON billing_tax_ids(user_id);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    subscription_id UUID REFERENCES user_subscriptions(id),
    stripe_invoice_id VARCHAR(100) UNIQUE,
    stripe_payment_intent_id VARCHAR(100),
    stripe_charge_id VARCHAR(100),
    invoice_number VARCHAR(50),
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    amount_paid_cents INTEGER NOT NULL DEFAULT 0,
    amount_due_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    payment_method_id UUID REFERENCES payment_methods(id),
    card_brand VARCHAR(20),
    card_last_four VARCHAR(4),
    description TEXT,
    period_start DATE,
    period_end DATE,
    invoice_pdf_url VARCHAR(500),
    hosted_invoice_url VARCHAR(500),
    last_payment_error TEXT,
    payment_attempt_count INTEGER NOT NULL DEFAULT 0,
    next_payment_attempt_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    stripe_line_item_id VARCHAR(100),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_amount_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id),
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================================================
-- COMMUNITIES & DISCUSSION BOARDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    description TEXT,
    owner_id UUID NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    member_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communities_owner ON communities(owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_public ON communities(is_public) WHERE is_public = TRUE;

CREATE TABLE IF NOT EXISTS community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_memberships_user ON community_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_community ON community_memberships(community_id);

CREATE TABLE IF NOT EXISTS discussion_boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    description TEXT,
    default_persona_id UUID,
    board_type VARCHAR(20) NOT NULL DEFAULT 'community',
    icon_url VARCHAR(500),
    banner_url VARCHAR(500),
    theme_color VARCHAR(20),
    requires_membership BOOLEAN NOT NULL DEFAULT FALSE,
    min_membership_level VARCHAR(20),
    member_count INTEGER NOT NULL DEFAULT 0,
    post_count INTEGER NOT NULL DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussion_boards_community ON discussion_boards(community_id);
CREATE INDEX IF NOT EXISTS idx_discussion_boards_active ON discussion_boards(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS board_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES discussion_boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    notify_new_posts BOOLEAN NOT NULL DEFAULT TRUE,
    notify_replies BOOLEAN NOT NULL DEFAULT TRUE,
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    UNIQUE (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_board_memberships_user ON board_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_board_memberships_board ON board_memberships(board_id);

CREATE TABLE IF NOT EXISTS board_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES discussion_boards(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id),
    author_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    persona_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    view_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    participant_count INTEGER NOT NULL DEFAULT 0,
    ai_response_count INTEGER NOT NULL DEFAULT 0,
    last_reply_at TIMESTAMPTZ,
    last_reply_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_conversations_board ON board_conversations(board_id);
CREATE INDEX IF NOT EXISTS idx_board_conversations_author ON board_conversations(author_id);
CREATE INDEX IF NOT EXISTS idx_board_conversations_status ON board_conversations(status);
CREATE INDEX IF NOT EXISTS idx_board_conversations_pinned ON board_conversations(is_pinned) WHERE is_pinned = TRUE;

CREATE TABLE IF NOT EXISTS board_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_conversation_id UUID NOT NULL REFERENCES board_conversations(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    persona_id UUID,
    is_ai_response BOOLEAN NOT NULL DEFAULT FALSE,
    content TEXT NOT NULL,
    content_searchable TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    parent_message_id UUID REFERENCES board_messages(id),
    reply_depth INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    flagged_reason TEXT,
    moderated_by UUID,
    moderated_at TIMESTAMPTZ,
    like_count INTEGER NOT NULL DEFAULT 0,
    model_used VARCHAR(50),
    token_count INTEGER,
    bible_references JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_messages_conversation ON board_messages(board_conversation_id);
CREATE INDEX IF NOT EXISTS idx_board_messages_author ON board_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_board_messages_parent ON board_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_board_messages_search ON board_messages USING GIN(content_searchable);

CREATE TABLE IF NOT EXISTS board_message_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES board_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS board_message_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_message_id UUID NOT NULL REFERENCES board_messages(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    translated_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (board_message_id, language_code)
);

-- ============================================================================
-- USER FAVORITES & BOOKMARKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    persona_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);

CREATE TABLE IF NOT EXISTS persona_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    persona_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_ratings_persona ON persona_ratings(persona_id);

CREATE TABLE IF NOT EXISTS message_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    message_id UUID NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_bookmarks_user ON message_bookmarks(user_id);

-- ============================================================================
-- DOMAIN REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS jubilee_tlds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tld CITEXT NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
    eligibility_rules JSONB,
    price_per_year_cents INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jubilee_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL,
    tld_id UUID NOT NULL REFERENCES jubilee_tlds(id),
    full_domain CITEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jubilee_domains_owner ON jubilee_domains(owner_id);
CREATE INDEX IF NOT EXISTS idx_jubilee_domains_status ON jubilee_domains(status);
CREATE INDEX IF NOT EXISTS idx_jubilee_domains_expires ON jubilee_domains(expires_at);

CREATE TABLE IF NOT EXISTS reserved_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL,
    tld_id UUID NOT NULL REFERENCES jubilee_tlds(id),
    full_domain CITEXT NOT NULL UNIQUE,
    reason VARCHAR(30) NOT NULL,
    reserved_by UUID,
    notes TEXT,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES jubilee_domains(id),
    user_id UUID NOT NULL,
    transaction_id VARCHAR(100),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    years INTEGER NOT NULL DEFAULT 1,
    registration_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_domain_registrations_domain ON domain_registrations(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_registrations_user ON domain_registrations(user_id);

CREATE TABLE IF NOT EXISTS domain_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES jubilee_domains(id) ON DELETE CASCADE,
    record_type VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 3600,
    priority INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_records_domain ON domain_records(domain_id);

-- ============================================================================
-- SAFETY & MODERATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS safety_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    conversation_id UUID,
    message_id UUID,
    persona_id UUID,
    session_id UUID,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    severity VARCHAR(20) NOT NULL,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    trigger_type VARCHAR(50),
    evidence_tokens TEXT[],
    internal_summary TEXT,
    persona_response_type VARCHAR(50),
    persona_response_appropriate BOOLEAN,
    response_evaluation_notes TEXT,
    alert_generated BOOLEAN NOT NULL DEFAULT FALSE,
    alert_id UUID,
    privacy_verified_at TIMESTAMPTZ,
    analysis_version VARCHAR(20),
    model_used VARCHAR(50),
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_flags_user ON safety_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_flags_category ON safety_flags(category);
CREATE INDEX IF NOT EXISTS idx_safety_flags_severity ON safety_flags(severity);
CREATE INDEX IF NOT EXISTS idx_safety_flags_created ON safety_flags(created_at);

CREATE TABLE IF NOT EXISTS admin_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    safety_flag_id UUID REFERENCES safety_flags(id),
    user_id UUID NOT NULL,
    persona_id UUID,
    conversation_id UUID,
    alert_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    confidence INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    redacted_summary TEXT,
    recommended_action TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    viewed_at TIMESTAMPTZ,
    viewed_by UUID,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,
    requires_authorization BOOLEAN NOT NULL DEFAULT FALSE,
    authorization_level VARCHAR(30),
    detail_accessed_at TIMESTAMPTZ,
    detail_accessed_by UUID,
    auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON admin_alerts(status);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created ON admin_alerts(created_at);

-- ============================================================================
-- ACTIVITY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_communities_updated_at ON communities;
CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_discussion_boards_updated_at ON discussion_boards;
CREATE TRIGGER update_discussion_boards_updated_at
    BEFORE UPDATE ON discussion_boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_board_conversations_updated_at ON board_conversations;
CREATE TRIGGER update_board_conversations_updated_at
    BEFORE UPDATE ON board_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_board_messages_updated_at ON board_messages;
CREATE TRIGGER update_board_messages_updated_at
    BEFORE UPDATE ON board_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jubilee_domains_updated_at ON jubilee_domains;
CREATE TRIGGER update_jubilee_domains_updated_at
    BEFORE UPDATE ON jubilee_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_board_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE board_conversations
    SET reply_count = (SELECT COUNT(*) FROM board_messages WHERE board_conversation_id = NEW.board_conversation_id),
        last_reply_at = NEW.created_at,
        last_reply_user_id = NEW.author_id,
        updated_at = NOW()
    WHERE id = NEW.board_conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_board_conversation_on_message ON board_messages;
CREATE TRIGGER update_board_conversation_on_message
    AFTER INSERT ON board_messages
    FOR EACH ROW EXECUTE FUNCTION update_board_conversation_stats();

CREATE OR REPLACE FUNCTION update_message_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE board_messages SET like_count = like_count + 1 WHERE id = NEW.message_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE board_messages SET like_count = like_count - 1 WHERE id = OLD.message_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_like_count_on_like ON board_message_likes;
CREATE TRIGGER update_like_count_on_like
    AFTER INSERT OR DELETE ON board_message_likes
    FOR EACH ROW EXECUTE FUNCTION update_message_like_count();

COMMIT;
