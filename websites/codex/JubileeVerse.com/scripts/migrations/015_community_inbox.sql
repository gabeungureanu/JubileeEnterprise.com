-- ============================================
-- JubileeVerse Database Schema
-- Migration 015: Community Inbox Messages
-- ============================================
-- This adds support for "My Community" inbox which shows
-- community announcements and direct messages within a community

-- Community inbox conversations (different from board_conversations)
-- These are private messages within a community context
CREATE TABLE IF NOT EXISTS community_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Conversation metadata
    title VARCHAR(255),
    summary TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),

    -- Language settings
    user_language VARCHAR(10) DEFAULT 'en',
    response_language VARCHAR(10) DEFAULT 'en',

    -- Statistics
    message_count INT DEFAULT 0,
    last_message_at TIMESTAMPTZ,

    -- Subject locking
    subject_locked BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Community inbox messages
CREATE TABLE IF NOT EXISTS community_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES community_conversations(id) ON DELETE CASCADE,

    -- Message content
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Persona that responded (for AI messages)
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Original content (if translated)
    original_content TEXT,
    original_language VARCHAR(10),
    translated_to VARCHAR(10),

    -- Metadata
    token_count INT,

    -- AI model info
    model_used VARCHAR(100),

    -- Status
    status VARCHAR(20) DEFAULT 'delivered' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'deleted')),

    -- Bible references
    bible_references JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for community conversations
CREATE INDEX IF NOT EXISTS idx_community_conversations_community ON community_conversations(community_id);
CREATE INDEX IF NOT EXISTS idx_community_conversations_user ON community_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_community_conversations_community_user ON community_conversations(community_id, user_id);
CREATE INDEX IF NOT EXISTS idx_community_conversations_status ON community_conversations(status);
CREATE INDEX IF NOT EXISTS idx_community_conversations_last_message ON community_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_community_conversations_created ON community_conversations(created_at DESC);

-- Indexes for community messages
CREATE INDEX IF NOT EXISTS idx_community_messages_conversation ON community_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_created ON community_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_community_messages_conversation_created ON community_messages(conversation_id, created_at);

-- Apply updated_at trigger
CREATE TRIGGER update_community_conversations_updated_at
    BEFORE UPDATE ON community_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update community conversation stats on message insert
CREATE OR REPLACE FUNCTION update_community_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE community_conversations
    SET
        message_count = (
            SELECT COUNT(*)
            FROM community_messages
            WHERE conversation_id = NEW.conversation_id
            AND status = 'delivered'
        ),
        last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_community_conversation_on_message
    AFTER INSERT ON community_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_community_conversation_stats();
