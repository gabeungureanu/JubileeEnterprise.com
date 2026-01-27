-- Migration: 0005_user_email_preferences.sql
-- Description: Add tables for JubileeOutlook email preferences (blocked senders and ignored conversations)
-- Author: Jubilee AI Assistant
-- Date: 2026-01-27

-- ============================================================================
-- BLOCKED EMAIL SENDERS
-- Stores email addresses that users have blocked in JubileeOutlook
-- Messages from blocked senders are automatically filtered to Junk folder
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_blocked_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Ensure each user can only block an email once
    UNIQUE(user_id, email_address)
);

-- Index for fast lookups by user_id (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_blocked_senders_user_id ON user_blocked_senders(user_id);

-- Index for checking if specific email is blocked (for filtering incoming mail)
CREATE INDEX IF NOT EXISTS idx_blocked_senders_email ON user_blocked_senders(email_address);

COMMENT ON TABLE user_blocked_senders IS 'Email addresses blocked by users in JubileeOutlook. Messages from blocked senders are filtered to Junk.';
COMMENT ON COLUMN user_blocked_senders.email_address IS 'Normalized email address (lowercase, trimmed)';
COMMENT ON COLUMN user_blocked_senders.blocked_at IS 'Timestamp when the sender was blocked';

-- ============================================================================
-- IGNORED EMAIL CONVERSATIONS
-- Stores conversation IDs that users have chosen to ignore in JubileeOutlook
-- Messages from ignored conversations are hidden from inbox and moved to Trash
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_ignored_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) NOT NULL,
    ignored_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Ensure each user can only ignore a conversation once
    UNIQUE(user_id, conversation_id)
);

-- Index for fast lookups by user_id (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_ignored_conversations_user_id ON user_ignored_conversations(user_id);

-- Index for checking if specific conversation is ignored (for filtering)
CREATE INDEX IF NOT EXISTS idx_ignored_conversations_conv_id ON user_ignored_conversations(conversation_id);

COMMENT ON TABLE user_ignored_conversations IS 'Email conversation IDs ignored by users in JubileeOutlook. Messages from ignored conversations are hidden and moved to Trash.';
COMMENT ON COLUMN user_ignored_conversations.conversation_id IS 'Email thread/conversation ID from the email provider';
COMMENT ON COLUMN user_ignored_conversations.ignored_at IS 'Timestamp when the conversation was ignored';
