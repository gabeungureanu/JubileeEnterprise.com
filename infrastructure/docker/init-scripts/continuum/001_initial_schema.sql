-- Continuum Database: Initial Schema
-- The user data and activity layer
--
-- OWNERSHIP: Chat logs, user-created content, user websites, drafts, notes,
--            activity records, subscriptions, billing, user sessions,
--            domain registrations, community memberships
--
-- ACCESS PATTERN: High-volume writes, horizontal scaling

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- USER PREFERENCES & SETTINGS
-- ============================================================================

-- User settings (extends Codex user identity)
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE, -- FK to Codex users
    -- Theme & Display
    theme VARCHAR(20) DEFAULT 'light',
    font_size VARCHAR(20) DEFAULT 'medium',
    -- Notifications
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    -- Content preferences
    preferred_bible_version VARCHAR(20) DEFAULT 'KJV',
    preferred_persona_id UUID, -- FK to Codex personas
    -- Flexible preferences
    preferences JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);

-- ============================================================================
-- USER SESSIONS
-- ============================================================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    -- Request metadata
    user_agent TEXT,
    ip_address INET,
    device_fingerprint VARCHAR(64),
    -- Lifecycle
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- SUBSCRIPTIONS & BILLING
-- ============================================================================

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    slug CITEXT NOT NULL UNIQUE,
    description TEXT,
    tier_level INTEGER NOT NULL DEFAULT 0,
    -- Pricing (in cents)
    price_monthly_cents INTEGER NOT NULL DEFAULT 0,
    price_yearly_cents INTEGER NOT NULL DEFAULT 0,
    -- Limits
    daily_word_limit INTEGER,
    monthly_word_limit INTEGER,
    max_conversations INTEGER,
    max_personas INTEGER,
    max_communities INTEGER,
    -- Features
    features JSONB DEFAULT '[]',
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE, -- FK to Codex users (one active subscription per user)
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, cancelled, expired, past_due, trialing
    billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, yearly, lifetime
    -- Dates
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    -- Stripe integration
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    -- Payment tracking
    payment_method_id UUID,
    last_payment_date TIMESTAMPTZ,
    last_payment_amount_cents INTEGER,
    next_billing_date TIMESTAMPTZ,
    -- Failure handling
    payment_failed_at TIMESTAMPTZ,
    payment_failure_count INTEGER NOT NULL DEFAULT 0,
    grace_period_ends_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);

-- Payment methods
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    -- Stripe
    stripe_payment_method_id VARCHAR(100) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(100) NOT NULL,
    -- Card details (last 4 only, everything else from Stripe)
    card_brand VARCHAR(20),
    card_last_four VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    cardholder_name VARCHAR(200),
    -- Billing address
    billing_address_line1 VARCHAR(200),
    billing_address_line2 VARCHAR(200),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(2),
    -- Status
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);

-- Billing information
CREATE TABLE billing_information (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE, -- FK to Codex users
    -- Contact
    billing_name VARCHAR(200),
    billing_email CITEXT,
    billing_phone VARCHAR(50),
    phone_country_code VARCHAR(5),
    -- Address
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2),
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tax IDs
CREATE TABLE billing_tax_ids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    tax_id_type VARCHAR(20) NOT NULL,
    tax_id_value VARCHAR(100) NOT NULL,
    stripe_tax_id VARCHAR(100),
    verification_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, unverified, unavailable
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_tax_ids_user ON billing_tax_ids(user_id);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    subscription_id UUID REFERENCES user_subscriptions(id),
    -- Stripe
    stripe_invoice_id VARCHAR(100) UNIQUE,
    stripe_payment_intent_id VARCHAR(100),
    stripe_charge_id VARCHAR(100),
    -- Invoice details
    invoice_number VARCHAR(50),
    invoice_date DATE NOT NULL,
    due_date DATE,
    -- Amounts (in cents)
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    amount_paid_cents INTEGER NOT NULL DEFAULT 0,
    amount_due_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, open, paid, void, uncollectible, failed
    -- Payment details
    payment_method_id UUID REFERENCES payment_methods(id),
    card_brand VARCHAR(20),
    card_last_four VARCHAR(4),
    -- Description
    description TEXT,
    period_start DATE,
    period_end DATE,
    -- URLs
    invoice_pdf_url VARCHAR(500),
    hosted_invoice_url VARCHAR(500),
    -- Failure handling
    last_payment_error TEXT,
    payment_attempt_count INTEGER NOT NULL DEFAULT 0,
    next_payment_attempt_at TIMESTAMPTZ,
    -- Timestamps
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);

-- Invoice line items
CREATE TABLE invoice_line_items (
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

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================================================
-- COMMUNITIES & DISCUSSION BOARDS
-- ============================================================================

-- Communities
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    description TEXT,
    owner_id UUID NOT NULL, -- FK to Codex users
    -- Settings
    is_global BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE for default Jubilee Community
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    -- Stats
    member_count INTEGER NOT NULL DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communities_owner ON communities(owner_id);
CREATE INDEX idx_communities_public ON communities(is_public) WHERE is_public = TRUE;

-- Community memberships
CREATE TABLE community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FK to Codex users
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- owner, admin, moderator, member
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, pending, banned
    -- Timestamps
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (community_id, user_id)
);

CREATE INDEX idx_community_memberships_user ON community_memberships(user_id);
CREATE INDEX idx_community_memberships_community ON community_memberships(community_id);

-- Discussion boards
CREATE TABLE discussion_boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    description TEXT,
    -- Configuration
    default_persona_id UUID, -- FK to Codex personas
    board_type VARCHAR(20) NOT NULL DEFAULT 'community', -- community, private, moderated
    -- Display
    icon_url VARCHAR(500),
    banner_url VARCHAR(500),
    theme_color VARCHAR(20),
    -- Access control
    requires_membership BOOLEAN NOT NULL DEFAULT FALSE,
    min_membership_level VARCHAR(20),
    -- Stats
    member_count INTEGER NOT NULL DEFAULT 0,
    post_count INTEGER NOT NULL DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_discussion_boards_community ON discussion_boards(community_id);
CREATE INDEX idx_discussion_boards_active ON discussion_boards(is_active) WHERE is_active = TRUE;

-- Board memberships
CREATE TABLE board_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES discussion_boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FK to Codex users
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- owner, admin, moderator, member
    -- Notifications
    notify_new_posts BOOLEAN NOT NULL DEFAULT TRUE,
    notify_replies BOOLEAN NOT NULL DEFAULT TRUE,
    -- Status
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    -- Timestamps
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    UNIQUE (board_id, user_id)
);

CREATE INDEX idx_board_memberships_user ON board_memberships(user_id);
CREATE INDEX idx_board_memberships_board ON board_memberships(board_id);

-- Board conversations (threads)
CREATE TABLE board_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES discussion_boards(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id),
    author_id UUID NOT NULL, -- FK to Codex users
    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    persona_id UUID, -- FK to Codex personas (if AI-initiated)
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, pinned, locked, hidden, deleted
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    -- Stats
    view_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    participant_count INTEGER NOT NULL DEFAULT 0,
    ai_response_count INTEGER NOT NULL DEFAULT 0,
    -- Last activity
    last_reply_at TIMESTAMPTZ,
    last_reply_user_id UUID, -- FK to Codex users
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_conversations_board ON board_conversations(board_id);
CREATE INDEX idx_board_conversations_author ON board_conversations(author_id);
CREATE INDEX idx_board_conversations_status ON board_conversations(status);
CREATE INDEX idx_board_conversations_pinned ON board_conversations(is_pinned) WHERE is_pinned = TRUE;

-- Board messages (posts)
CREATE TABLE board_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_conversation_id UUID NOT NULL REFERENCES board_conversations(id) ON DELETE CASCADE,
    author_id UUID NOT NULL, -- FK to Codex users
    persona_id UUID, -- FK to Codex personas (if AI response)
    is_ai_response BOOLEAN NOT NULL DEFAULT FALSE,
    -- Content
    content TEXT NOT NULL,
    content_searchable TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    -- Threading
    parent_message_id UUID REFERENCES board_messages(id),
    reply_depth INTEGER NOT NULL DEFAULT 0,
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'visible', -- visible, hidden, flagged, deleted
    flagged_reason TEXT,
    moderated_by UUID, -- FK to Codex users
    moderated_at TIMESTAMPTZ,
    -- Stats
    like_count INTEGER NOT NULL DEFAULT 0,
    -- AI metadata
    model_used VARCHAR(50),
    token_count INTEGER,
    bible_references JSONB DEFAULT '[]',
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_messages_conversation ON board_messages(board_conversation_id);
CREATE INDEX idx_board_messages_author ON board_messages(author_id);
CREATE INDEX idx_board_messages_parent ON board_messages(parent_message_id);
CREATE INDEX idx_board_messages_search ON board_messages USING GIN(content_searchable);

-- Board message likes
CREATE TABLE board_message_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES board_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FK to Codex users
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, user_id)
);

-- Board message translations
CREATE TABLE board_message_translations (
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

-- User favorites (personas)
CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    persona_id UUID NOT NULL, -- FK to Codex personas
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, persona_id)
);

CREATE INDEX idx_user_favorites_user ON user_favorites(user_id);

-- Persona ratings
CREATE TABLE persona_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    persona_id UUID NOT NULL, -- FK to Codex personas
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, persona_id)
);

CREATE INDEX idx_persona_ratings_persona ON persona_ratings(persona_id);

-- Message bookmarks
CREATE TABLE message_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    message_id UUID NOT NULL, -- FK to Inspire messages
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, message_id)
);

CREATE INDEX idx_message_bookmarks_user ON message_bookmarks(user_id);

-- ============================================================================
-- DOMAIN REGISTRY (JubileeInternet)
-- ============================================================================

-- Jubilee TLDs
CREATE TABLE jubilee_tlds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tld CITEXT NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Configuration
    is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
    eligibility_rules JSONB,
    -- Pricing
    price_per_year_cents INTEGER NOT NULL DEFAULT 0,
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registered domains
CREATE TABLE jubilee_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL,
    tld_id UUID NOT NULL REFERENCES jubilee_tlds(id),
    full_domain CITEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL, -- FK to Codex users
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- active, expired, suspended, pending_verification, pending_payment, reserved, deleted
    -- Dates
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jubilee_domains_owner ON jubilee_domains(owner_id);
CREATE INDEX idx_jubilee_domains_status ON jubilee_domains(status);
CREATE INDEX idx_jubilee_domains_expires ON jubilee_domains(expires_at);

-- Reserved domains
CREATE TABLE reserved_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL,
    tld_id UUID NOT NULL REFERENCES jubilee_tlds(id),
    full_domain CITEXT NOT NULL UNIQUE,
    reason VARCHAR(30) NOT NULL, -- system, offensive, trademark, official, future_use
    reserved_by UUID, -- FK to Codex users
    notes TEXT,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain registration transactions
CREATE TABLE domain_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES jubilee_domains(id),
    user_id UUID NOT NULL, -- FK to Codex users
    transaction_id VARCHAR(100), -- Stripe
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    years INTEGER NOT NULL DEFAULT 1,
    registration_type VARCHAR(20) NOT NULL, -- new, renewal, transfer
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_domain_registrations_domain ON domain_registrations(domain_id);
CREATE INDEX idx_domain_registrations_user ON domain_registrations(user_id);

-- Domain DNS records
CREATE TABLE domain_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID NOT NULL REFERENCES jubilee_domains(id) ON DELETE CASCADE,
    record_type VARCHAR(10) NOT NULL, -- A, AAAA, CNAME, TXT, MX, JUBILEE
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 3600,
    priority INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domain_records_domain ON domain_records(domain_id);

-- ============================================================================
-- SAFETY & MODERATION (User-generated)
-- ============================================================================

-- Safety flags (detected in user conversations)
CREATE TABLE safety_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    conversation_id UUID, -- FK to Inspire conversations
    message_id UUID, -- FK to Inspire messages
    persona_id UUID, -- FK to Codex personas
    session_id UUID,
    -- Classification
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    severity VARCHAR(20) NOT NULL, -- low, moderate, elevated, high, critical
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    trigger_type VARCHAR(50),
    -- Evidence (redacted)
    evidence_tokens TEXT[],
    internal_summary TEXT,
    -- Persona response evaluation
    persona_response_type VARCHAR(50),
    persona_response_appropriate BOOLEAN,
    response_evaluation_notes TEXT,
    -- Alert tracking
    alert_generated BOOLEAN NOT NULL DEFAULT FALSE,
    alert_id UUID,
    -- Privacy
    privacy_verified_at TIMESTAMPTZ,
    -- Analysis metadata
    analysis_version VARCHAR(20),
    model_used VARCHAR(50),
    processing_time_ms INTEGER,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_safety_flags_user ON safety_flags(user_id);
CREATE INDEX idx_safety_flags_category ON safety_flags(category);
CREATE INDEX idx_safety_flags_severity ON safety_flags(severity);
CREATE INDEX idx_safety_flags_created ON safety_flags(created_at);

-- Admin alerts (for safety review)
CREATE TABLE admin_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    safety_flag_id UUID REFERENCES safety_flags(id),
    user_id UUID NOT NULL, -- FK to Codex users
    persona_id UUID, -- FK to Codex personas
    conversation_id UUID, -- FK to Inspire conversations
    -- Alert details
    alert_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    confidence INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    redacted_summary TEXT,
    recommended_action TEXT,
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'new', -- new, viewed, acknowledged, under_review, resolved, escalated, dismissed
    -- Review tracking
    viewed_at TIMESTAMPTZ,
    viewed_by UUID, -- FK to Codex users
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,
    -- Access control
    requires_authorization BOOLEAN NOT NULL DEFAULT FALSE,
    authorization_level VARCHAR(30),
    detail_accessed_at TIMESTAMPTZ,
    detail_accessed_by UUID,
    -- Metadata
    auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_alerts_status ON admin_alerts(status);
CREATE INDEX idx_admin_alerts_severity ON admin_alerts(severity);
CREATE INDEX idx_admin_alerts_created ON admin_alerts(created_at);

-- ============================================================================
-- ACTIVITY TRACKING
-- ============================================================================

-- User activity log
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    activity_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    -- Data
    metadata JSONB DEFAULT '{}',
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_created ON user_activity(created_at);

-- Partition user_activity by month for performance
-- (In production, implement table partitioning)

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

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discussion_boards_updated_at
    BEFORE UPDATE ON discussion_boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_conversations_updated_at
    BEFORE UPDATE ON board_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_messages_updated_at
    BEFORE UPDATE ON board_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jubilee_domains_updated_at
    BEFORE UPDATE ON jubilee_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update board conversation stats on new message
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

CREATE TRIGGER update_board_conversation_on_message
    AFTER INSERT ON board_messages
    FOR EACH ROW EXECUTE FUNCTION update_board_conversation_stats();

-- Update board message like count
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

CREATE TRIGGER update_like_count_on_like
    AFTER INSERT OR DELETE ON board_message_likes
    FOR EACH ROW EXECUTE FUNCTION update_message_like_count();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Default subscription plans
INSERT INTO subscription_plans (name, slug, description, tier_level, price_monthly_cents, price_yearly_cents, daily_word_limit, monthly_word_limit, max_conversations, max_personas, features, is_default) VALUES
    ('Free', 'free', 'Free tier with basic features', 0, 0, 0, 1000, 25000, 5, 3, '["basic_personas", "community_access"]', TRUE),
    ('Essentials', 'essentials', 'Essential features for regular use', 1, 999, 9990, 5000, 100000, 25, 10, '["all_personas", "priority_response", "export_conversations"]', FALSE),
    ('Ministry', 'ministry', 'Full features for ministry work', 2, 2499, 24990, NULL, NULL, NULL, NULL, '["unlimited_usage", "custom_personas", "api_access", "analytics"]', FALSE),
    ('Enterprise', 'enterprise', 'Enterprise features with support', 3, 9999, 99990, NULL, NULL, NULL, NULL, '["everything", "dedicated_support", "sla", "custom_integration"]', FALSE);

-- Default Jubilee TLDs
INSERT INTO jubilee_tlds (tld, display_name, description, price_per_year_cents) VALUES
    ('bible', '.bible', 'Bible-focused websites and ministries', 2499),
    ('faith', '.faith', 'Faith-based organizations and content', 1999),
    ('church', '.church', 'Churches and religious organizations', 2499),
    ('ministry', '.ministry', 'Ministry organizations', 1999),
    ('prayer', '.prayer', 'Prayer-focused content', 1499),
    ('worship', '.worship', 'Worship and praise content', 1499),
    ('gospel', '.gospel', 'Gospel-centered content', 1999),
    ('christian', '.christian', 'Christian content and organizations', 1999);

-- Default global community
INSERT INTO communities (name, slug, description, owner_id, is_global, is_public)
VALUES ('Jubilee Community', 'jubilee', 'The global Jubilee community', '00000000-0000-0000-0000-000000000000', TRUE, TRUE);
