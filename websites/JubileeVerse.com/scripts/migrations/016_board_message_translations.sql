-- ============================================
-- JubileeVerse Database Schema
-- Migration 016: Board Message Translations
-- ============================================
-- This adds support for storing translated versions of board messages

-- Board message translations table
-- Stores translated content for each message per language
CREATE TABLE IF NOT EXISTS board_message_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_message_id UUID NOT NULL REFERENCES board_messages(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    translated_content TEXT NOT NULL,
    provider VARCHAR(50) DEFAULT 'openai',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one translation per message per language
    UNIQUE(board_message_id, language)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_board_message_translations_message ON board_message_translations(board_message_id);
CREATE INDEX IF NOT EXISTS idx_board_message_translations_language ON board_message_translations(language);
CREATE INDEX IF NOT EXISTS idx_board_message_translations_message_language ON board_message_translations(board_message_id, language);
