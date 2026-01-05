-- ============================================
-- JubileeVerse Database Schema
-- Migration 013: Board Message Translations
-- ============================================

CREATE TABLE IF NOT EXISTS board_message_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_message_id UUID NOT NULL REFERENCES board_messages(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    translated_content TEXT NOT NULL,
    provider VARCHAR(50) DEFAULT 'openai',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(board_message_id, language)
);

CREATE INDEX IF NOT EXISTS idx_board_message_translations_message ON board_message_translations(board_message_id);
CREATE INDEX IF NOT EXISTS idx_board_message_translations_language ON board_message_translations(language);
