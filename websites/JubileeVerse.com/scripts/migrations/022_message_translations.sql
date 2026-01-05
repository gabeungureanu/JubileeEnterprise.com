-- Migration: 022_message_translations
-- Description: Add per-message translation storage for efficient retrieval
-- Created: 2024-12-24

-- Add language tracking to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS response_language VARCHAR(10) DEFAULT 'en';

-- Create message_translations table for caching translations
CREATE TABLE IF NOT EXISTS message_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    translated_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, language_code)
);

-- Create conversation_translations table for caching title translations
CREATE TABLE IF NOT EXISTS conversation_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    translated_title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, language_code)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_message_translations_message_id ON message_translations(message_id);
CREATE INDEX IF NOT EXISTS idx_message_translations_lookup ON message_translations(message_id, language_code);
CREATE INDEX IF NOT EXISTS idx_conversation_translations_conv_id ON conversation_translations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_translations_lookup ON conversation_translations(conversation_id, language_code);

-- Add comments for documentation
COMMENT ON TABLE message_translations IS 'Cached translations of messages in different languages';
COMMENT ON TABLE conversation_translations IS 'Cached translations of conversation titles in different languages';
COMMENT ON COLUMN conversations.response_language IS 'User preferred response language for this conversation';
