-- Migration: 0001_initial_schema
-- Database: inspire
-- Author: Jubilee Solutions
-- Date: 2026-01-04
-- Description: Initial Inspire database schema - Ministry content, conversations, collections

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- BIBLE CONTENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS bible_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    copyright_text TEXT,
    is_public_domain BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bible_verses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES bible_versions(id),
    book_code VARCHAR(10) NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    text_searchable TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (version_id, book_code, chapter, verse)
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_version ON bible_verses(version_id);
CREATE INDEX IF NOT EXISTS idx_bible_verses_reference ON bible_verses(book_code, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_bible_verses_search ON bible_verses USING GIN(text_searchable);

-- ============================================================================
-- MINISTRY CONTENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ministry_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type_id UUID NOT NULL REFERENCES content_types(id),
    slug CITEXT NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    subtitle VARCHAR(500),
    description TEXT,
    author_id UUID NOT NULL,
    author_name VARCHAR(200),
    content_body TEXT,
    content_html TEXT,
    content_json JSONB,
    thumbnail_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    media_url VARCHAR(500),
    media_duration_seconds INTEGER,
    cdn_bucket VARCHAR(100),
    cdn_path VARCHAR(500),
    cdn_url VARCHAR(500),
    tags JSONB DEFAULT '[]',
    categories JSONB DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    previous_version_id UUID REFERENCES ministry_content(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    published_by UUID,
    view_count BIGINT NOT NULL DEFAULT 0,
    download_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ministry_content_type ON ministry_content(content_type_id);
CREATE INDEX IF NOT EXISTS idx_ministry_content_author ON ministry_content(author_id);
CREATE INDEX IF NOT EXISTS idx_ministry_content_status ON ministry_content(status);
CREATE INDEX IF NOT EXISTS idx_ministry_content_published ON ministry_content(published_at) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS content_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    author_id UUID NOT NULL,
    author_name VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_series_items (
    series_id UUID NOT NULL REFERENCES content_series(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES ministry_content(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (series_id, content_id)
);

-- ============================================================================
-- CONVERSATIONS & MESSAGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    persona_id UUID NOT NULL,
    title VARCHAR(200),
    summary TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    user_language VARCHAR(10) DEFAULT 'en',
    response_language VARCHAR(10) DEFAULT 'en',
    auto_translate BOOLEAN NOT NULL DEFAULT FALSE,
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    context_summary TEXT,
    context_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_persona ON conversations(persona_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    original_content TEXT,
    original_language VARCHAR(10),
    translated_to VARCHAR(10),
    token_count INTEGER,
    processing_time_ms INTEGER,
    model_used VARCHAR(50),
    model_version VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'delivered',
    error_message TEXT,
    request_id UUID,
    bible_references JSONB DEFAULT '[]',
    content_searchable TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(content_searchable);

CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    translated_content TEXT NOT NULL,
    confidence DECIMAL(3,2),
    model_used VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, language_code)
);

-- ============================================================================
-- COLLECTIONS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS collection_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,
    section VARCHAR(100) NOT NULL,
    collection_type VARCHAR(50) NOT NULL,
    qdrant_collection_name VARCHAR(100),
    qdrant_vector_size INTEGER DEFAULT 1536,
    qdrant_distance_metric VARCHAR(20) DEFAULT 'Cosine',
    persona_id UUID,
    template_id UUID REFERENCES collection_templates(id),
    parent_collection_id UUID REFERENCES collections(id),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    last_exported_at TIMESTAMPTZ,
    export_checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_section ON collections(section);
CREATE INDEX IF NOT EXISTS idx_collections_type ON collections(collection_type);
CREATE INDEX IF NOT EXISTS idx_collections_persona ON collections(persona_id);

CREATE TABLE IF NOT EXISTS collection_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    template_id UUID REFERENCES collection_templates(id),
    parent_category_id UUID REFERENCES collection_categories(id),
    slug CITEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,
    level INTEGER NOT NULL DEFAULT 0,
    path VARCHAR(100),
    display_order INTEGER NOT NULL DEFAULT 0,
    stage_number INTEGER,
    domain_number INTEGER,
    icon VARCHAR(50),
    icon_color VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_expandable BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_collection_categories_collection ON collection_categories(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_categories_parent ON collection_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_collection_categories_path ON collection_categories(path);

CREATE TABLE IF NOT EXISTS category_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES collection_categories(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    slug CITEXT NOT NULL,
    name VARCHAR(200) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    content TEXT,
    content_json JSONB,
    trigger_event VARCHAR(100),
    trigger_conditions JSONB,
    property_key VARCHAR(100),
    property_value TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    vector_embedding_id VARCHAR(100),
    embedding_model VARCHAR(50),
    last_embedded_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_category_items_category ON category_items(category_id);
CREATE INDEX IF NOT EXISTS idx_category_items_type ON category_items(item_type);

-- ============================================================================
-- TRANSLATIONS & LOCALIZATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key CITEXT NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    translation TEXT NOT NULL,
    context VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (key, language_code)
);

CREATE INDEX IF NOT EXISTS idx_ui_translations_lang ON ui_translations(language_code);

-- ============================================================================
-- ANALYTICS & ENGAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    persona_id UUID NOT NULL,
    sentiment_score DECIMAL(3,2),
    engagement_level VARCHAR(20),
    helpfulness_rating INTEGER,
    topic_classification JSONB DEFAULT '[]',
    key_phrases JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_analytics_user ON conversation_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_persona ON conversation_analytics(persona_id);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    usage_date DATE NOT NULL,
    words_sent BIGINT NOT NULL DEFAULT 0,
    words_received BIGINT NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    provider_usage JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user ON ai_usage_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date ON ai_usage_daily(usage_date);

CREATE TABLE IF NOT EXISTS ai_usage_monthly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    usage_year INTEGER NOT NULL,
    usage_month INTEGER NOT NULL,
    words_sent BIGINT NOT NULL DEFAULT 0,
    words_received BIGINT NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, usage_year, usage_month)
);

CREATE TABLE IF NOT EXISTS persona_engagement_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID NOT NULL,
    year_month CHAR(7) NOT NULL,
    total_conversations INTEGER NOT NULL DEFAULT 0,
    total_messages BIGINT NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    new_users INTEGER NOT NULL DEFAULT 0,
    returning_users INTEGER NOT NULL DEFAULT 0,
    avg_session_duration_seconds INTEGER,
    median_session_duration_seconds INTEGER,
    avg_messages_per_session DECIMAL(5,2),
    return_rate_7day DECIMAL(5,4),
    return_rate_30day DECIMAL(5,4),
    avg_relatability DECIMAL(5,2),
    avg_friendliness DECIMAL(5,2),
    avg_boundary_clarity DECIMAL(5,2),
    avg_biblical_alignment DECIMAL(5,2),
    avg_overall_score DECIMAL(5,2),
    boundary_test_count INTEGER NOT NULL DEFAULT 0,
    crisis_signal_count INTEGER NOT NULL DEFAULT 0,
    boundary_handling_success_rate DECIMAL(5,4),
    flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason TEXT,
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_persona_engagement_persona ON persona_engagement_metrics(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_engagement_month ON persona_engagement_metrics(year_month);

-- ============================================================================
-- ERROR LOGGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    user_id UUID,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_code ON error_logs(error_code);

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

DROP TRIGGER IF EXISTS update_ministry_content_updated_at ON ministry_content;
CREATE TRIGGER update_ministry_content_updated_at
    BEFORE UPDATE ON ministry_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_series_updated_at ON content_series;
CREATE TRIGGER update_content_series_updated_at
    BEFORE UPDATE ON content_series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at
    BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collection_categories_updated_at ON collection_categories;
CREATE TRIGGER update_collection_categories_updated_at
    BEFORE UPDATE ON collection_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_category_items_updated_at ON category_items;
CREATE TRIGGER update_category_items_updated_at
    BEFORE UPDATE ON category_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET message_count = (SELECT COUNT(*) FROM messages WHERE conversation_id = NEW.conversation_id),
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;
CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

COMMIT;
