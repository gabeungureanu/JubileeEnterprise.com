-- ============================================
-- JubileeVerse Database Schema
-- Migration 004: Conversations and Messages
-- ============================================

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

    -- Conversation metadata
    title VARCHAR(255),
    summary TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),

    -- Language settings
    user_language VARCHAR(10) DEFAULT 'en',
    response_language VARCHAR(10) DEFAULT 'en',
    auto_translate BOOLEAN DEFAULT FALSE,

    -- Statistics
    message_count INT DEFAULT 0,
    last_message_at TIMESTAMPTZ,

    -- Context for AI (stored conversation context)
    context_summary TEXT,
    context_updated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Message content
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Original content (if translated)
    original_content TEXT,
    original_language VARCHAR(10),
    translated_to VARCHAR(10),

    -- Metadata
    token_count INT,
    processing_time_ms INT,

    -- AI model info
    model_used VARCHAR(100),
    model_version VARCHAR(50),

    -- Status
    status VARCHAR(20) DEFAULT 'delivered' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'deleted')),
    error_message TEXT,

    -- For async processing
    request_id UUID,

    -- Bible references extracted from response
    bible_references JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message attachments (for future use - images, documents)
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation bookmarks (save important messages)
CREATE TABLE IF NOT EXISTS message_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_persona ON conversations(persona_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_user_active ON conversations(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_request_id ON messages(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);

-- Full-text search index for messages
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin (to_tsvector('english', content));

-- Indexes for bookmarks
CREATE INDEX IF NOT EXISTS idx_message_bookmarks_user ON message_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_message_bookmarks_message ON message_bookmarks(message_id);

-- Apply updated_at trigger
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation stats on message insert
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        message_count = (
            SELECT COUNT(*)
            FROM messages
            WHERE conversation_id = NEW.conversation_id
            AND status = 'delivered'
        ),
        last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;

    -- Increment persona usage count
    UPDATE personas
    SET usage_count = usage_count + 1
    WHERE id = (SELECT persona_id FROM conversations WHERE id = NEW.conversation_id)
    AND NEW.role = 'user';

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_stats();
