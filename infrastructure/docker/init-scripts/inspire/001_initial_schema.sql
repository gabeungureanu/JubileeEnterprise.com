-- Inspire Database: Initial Schema
-- The authoritative ministry content database
--
-- OWNERSHIP: Books, music, videos, teaching series, ministry-produced content,
--            content metadata, CDN delivery references, persona conversations,
--            collections, translations, analytics
--
-- ACCESS PATTERN: Read-heavy with content versioning

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- BIBLE CONTENT (Full scripture text)
-- ============================================================================

-- Bible versions/translations
CREATE TABLE bible_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code CITEXT NOT NULL UNIQUE, -- e.g., 'KJV', 'NIV', 'ESV'
    name VARCHAR(100) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    copyright_text TEXT,
    is_public_domain BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bible verse content
CREATE TABLE bible_verses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES bible_versions(id),
    book_code VARCHAR(10) NOT NULL, -- References Codex bible_books
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    -- For search
    text_searchable TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (version_id, book_code, chapter, verse)
);

CREATE INDEX idx_bible_verses_version ON bible_verses(version_id);
CREATE INDEX idx_bible_verses_reference ON bible_verses(book_code, chapter, verse);
CREATE INDEX idx_bible_verses_search ON bible_verses USING GIN(text_searchable);

-- ============================================================================
-- MINISTRY CONTENT
-- ============================================================================

-- Content types enumeration
CREATE TABLE content_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ministry content (books, music, videos, teachings)
CREATE TABLE ministry_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type_id UUID NOT NULL REFERENCES content_types(id),
    -- Metadata
    slug CITEXT NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    subtitle VARCHAR(500),
    description TEXT,
    -- Creator (references Codex user)
    author_id UUID NOT NULL, -- FK to Codex users
    author_name VARCHAR(200), -- Denormalized for display
    -- Content
    content_body TEXT,
    content_html TEXT,
    content_json JSONB,
    -- Media
    thumbnail_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    media_url VARCHAR(500),
    media_duration_seconds INTEGER,
    -- CDN delivery
    cdn_bucket VARCHAR(100),
    cdn_path VARCHAR(500),
    cdn_url VARCHAR(500),
    -- Classification
    tags JSONB DEFAULT '[]',
    categories JSONB DEFAULT '[]',
    -- Versioning (content is largely immutable)
    version INTEGER NOT NULL DEFAULT 1,
    previous_version_id UUID REFERENCES ministry_content(id),
    -- Publishing
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, review, published, archived
    published_at TIMESTAMPTZ,
    published_by UUID, -- FK to Codex users
    -- Tracking
    view_count BIGINT NOT NULL DEFAULT 0,
    download_count BIGINT NOT NULL DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ministry_content_type ON ministry_content(content_type_id);
CREATE INDEX idx_ministry_content_author ON ministry_content(author_id);
CREATE INDEX idx_ministry_content_status ON ministry_content(status);
CREATE INDEX idx_ministry_content_published ON ministry_content(published_at) WHERE status = 'published';

-- Content series (teaching series, book series, etc.)
CREATE TABLE content_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    author_id UUID NOT NULL, -- FK to Codex users
    author_name VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content in series (ordering)
CREATE TABLE content_series_items (
    series_id UUID NOT NULL REFERENCES content_series(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES ministry_content(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (series_id, content_id)
);

-- ============================================================================
-- CONVERSATIONS & MESSAGING (Ministry context)
-- ============================================================================

-- Conversations between users and personas
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    persona_id UUID NOT NULL, -- FK to Codex personas
    -- Metadata
    title VARCHAR(200),
    summary TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, archived, deleted
    -- Language settings
    user_language VARCHAR(10) DEFAULT 'en',
    response_language VARCHAR(10) DEFAULT 'en',
    auto_translate BOOLEAN NOT NULL DEFAULT FALSE,
    -- Stats
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    -- Context management
    context_summary TEXT,
    context_updated_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_persona ON conversations(persona_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at);

-- Individual messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    -- Message content
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    -- Translation
    original_content TEXT,
    original_language VARCHAR(10),
    translated_to VARCHAR(10),
    -- AI metadata
    token_count INTEGER,
    processing_time_ms INTEGER,
    model_used VARCHAR(50),
    model_version VARCHAR(20),
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'delivered', -- pending, processing, delivered, failed, deleted
    error_message TEXT,
    request_id UUID, -- For async processing
    -- References
    bible_references JSONB DEFAULT '[]',
    -- Searchable content
    content_searchable TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_search ON messages USING GIN(content_searchable);

-- Message attachments
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message translations cache
CREATE TABLE message_translations (
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
-- COLLECTIONS SYSTEM (Persona Knowledge Base)
-- ============================================================================

-- Collection templates
CREATE TABLE collection_templates (
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

-- Collections container
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,
    -- Classification
    section VARCHAR(100) NOT NULL, -- authority_and_identity, orchestration_and_mediation, interaction_and_context
    collection_type VARCHAR(50) NOT NULL, -- scripture, doctrine, governance, persona, fivefold, etc.
    -- Vector database integration
    qdrant_collection_name VARCHAR(100),
    qdrant_vector_size INTEGER DEFAULT 1536,
    qdrant_distance_metric VARCHAR(20) DEFAULT 'Cosine',
    -- Relationships
    persona_id UUID, -- FK to Codex personas (optional)
    template_id UUID REFERENCES collection_templates(id),
    parent_collection_id UUID REFERENCES collections(id),
    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,
    last_exported_at TIMESTAMPTZ,
    export_checksum VARCHAR(64),
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collections_section ON collections(section);
CREATE INDEX idx_collections_type ON collections(collection_type);
CREATE INDEX idx_collections_persona ON collections(persona_id);

-- Collection categories (tree structure)
CREATE TABLE collection_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    template_id UUID REFERENCES collection_templates(id),
    parent_category_id UUID REFERENCES collection_categories(id),
    -- Identity
    slug CITEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,
    -- Hierarchy
    level INTEGER NOT NULL DEFAULT 0, -- 0 = root
    path VARCHAR(100), -- Materialized path, e.g., '01.04.02'
    display_order INTEGER NOT NULL DEFAULT 0,
    -- Persona stages (optional)
    stage_number INTEGER, -- 1-32 for persona stages
    domain_number INTEGER, -- 1-24 for domains within stages
    -- Display
    icon VARCHAR(50),
    icon_color VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_expandable BOOLEAN NOT NULL DEFAULT TRUE,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, slug)
);

CREATE INDEX idx_collection_categories_collection ON collection_categories(collection_id);
CREATE INDEX idx_collection_categories_parent ON collection_categories(parent_category_id);
CREATE INDEX idx_collection_categories_path ON collection_categories(path);

-- Category items (content within categories)
CREATE TABLE category_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES collection_categories(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    -- Identity
    slug CITEXT NOT NULL,
    name VARCHAR(200) NOT NULL,
    item_type VARCHAR(50) NOT NULL, -- activation, property, event_trigger, prompt, instruction, reference, metadata
    -- Content
    content TEXT,
    content_json JSONB,
    -- Trigger configuration
    trigger_event VARCHAR(100),
    trigger_conditions JSONB,
    -- Property configuration
    property_key VARCHAR(100),
    property_value TEXT,
    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    -- Vector embedding
    vector_embedding_id VARCHAR(100),
    embedding_model VARCHAR(50),
    last_embedded_at TIMESTAMPTZ,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, slug)
);

CREATE INDEX idx_category_items_category ON category_items(category_id);
CREATE INDEX idx_category_items_type ON category_items(item_type);

-- ============================================================================
-- TRANSLATIONS & LOCALIZATION
-- ============================================================================

-- UI translations
CREATE TABLE ui_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key CITEXT NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    translation TEXT NOT NULL,
    context VARCHAR(100), -- Component or page context
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (key, language_code)
);

CREATE INDEX idx_ui_translations_lang ON ui_translations(language_code);

-- ============================================================================
-- ANALYTICS & ENGAGEMENT
-- ============================================================================

-- Conversation analytics
CREATE TABLE conversation_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FK to Codex users
    persona_id UUID NOT NULL, -- FK to Codex personas
    -- Metrics
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    engagement_level VARCHAR(20), -- low, medium, high
    helpfulness_rating INTEGER, -- 1-5
    -- Classification
    topic_classification JSONB DEFAULT '[]',
    key_phrases JSONB DEFAULT '[]',
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_analytics_user ON conversation_analytics(user_id);
CREATE INDEX idx_conversation_analytics_persona ON conversation_analytics(persona_id);

-- AI usage tracking (daily aggregates)
CREATE TABLE ai_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK to Codex users
    usage_date DATE NOT NULL,
    -- Metrics
    words_sent BIGINT NOT NULL DEFAULT 0,
    words_received BIGINT NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    -- Provider breakdown
    provider_usage JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, usage_date)
);

CREATE INDEX idx_ai_usage_daily_user ON ai_usage_daily(user_id);
CREATE INDEX idx_ai_usage_daily_date ON ai_usage_daily(usage_date);

-- AI usage monthly aggregates
CREATE TABLE ai_usage_monthly (
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

-- Persona engagement metrics (monthly)
CREATE TABLE persona_engagement_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID NOT NULL, -- FK to Codex personas
    year_month CHAR(7) NOT NULL, -- YYYY-MM
    -- Conversation metrics
    total_conversations INTEGER NOT NULL DEFAULT 0,
    total_messages BIGINT NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    new_users INTEGER NOT NULL DEFAULT 0,
    returning_users INTEGER NOT NULL DEFAULT 0,
    -- Session metrics
    avg_session_duration_seconds INTEGER,
    median_session_duration_seconds INTEGER,
    avg_messages_per_session DECIMAL(5,2),
    -- Retention
    return_rate_7day DECIMAL(5,4),
    return_rate_30day DECIMAL(5,4),
    -- Quality scores
    avg_relatability DECIMAL(5,2),
    avg_friendliness DECIMAL(5,2),
    avg_boundary_clarity DECIMAL(5,2),
    avg_biblical_alignment DECIMAL(5,2),
    avg_overall_score DECIMAL(5,2),
    -- Safety metrics
    boundary_test_count INTEGER NOT NULL DEFAULT 0,
    crisis_signal_count INTEGER NOT NULL DEFAULT 0,
    boundary_handling_success_rate DECIMAL(5,4),
    -- Review flags
    flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason TEXT,
    -- Finalization
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, year_month)
);

CREATE INDEX idx_persona_engagement_persona ON persona_engagement_metrics(persona_id);
CREATE INDEX idx_persona_engagement_month ON persona_engagement_metrics(year_month);

-- ============================================================================
-- ERROR LOGGING
-- ============================================================================

CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    user_id UUID, -- FK to Codex users
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_logs_created ON error_logs(created_at);
CREATE INDEX idx_error_logs_code ON error_logs(error_code);

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

CREATE TRIGGER update_ministry_content_updated_at
    BEFORE UPDATE ON ministry_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_series_updated_at
    BEFORE UPDATE ON content_series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at
    BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_categories_updated_at
    BEFORE UPDATE ON collection_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_items_updated_at
    BEFORE UPDATE ON category_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update conversation message count and last_message_at
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

CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Default content types
INSERT INTO content_types (slug, name, description, icon) VALUES
    ('book', 'Book', 'Written publications and eBooks', 'book'),
    ('article', 'Article', 'Written articles and blog posts', 'article'),
    ('audio', 'Audio', 'Podcasts and audio teachings', 'headphones'),
    ('video', 'Video', 'Video teachings and sermons', 'video'),
    ('music', 'Music', 'Songs and worship music', 'music'),
    ('sermon', 'Sermon', 'Recorded sermons and messages', 'microphone'),
    ('devotional', 'Devotional', 'Daily devotional content', 'heart'),
    ('study', 'Bible Study', 'Bible study materials', 'book-open'),
    ('course', 'Course', 'Educational courses', 'graduation-cap');

-- Default Bible versions
INSERT INTO bible_versions (code, name, language, is_public_domain) VALUES
    ('KJV', 'King James Version', 'en', TRUE),
    ('ASV', 'American Standard Version', 'en', TRUE),
    ('WEB', 'World English Bible', 'en', TRUE),
    ('YLT', 'Young''s Literal Translation', 'en', TRUE);

-- Default collection templates
INSERT INTO collection_templates (slug, name, description, template_type) VALUES
    ('persona-32-stage', '32-Stage Persona Template', 'Standard 32-stage persona development template', 'persona'),
    ('scripture-reference', 'Scripture Reference Template', 'Template for scripture-based collections', 'scripture'),
    ('doctrine-framework', 'Doctrine Framework Template', 'Template for doctrinal collections', 'doctrine');
