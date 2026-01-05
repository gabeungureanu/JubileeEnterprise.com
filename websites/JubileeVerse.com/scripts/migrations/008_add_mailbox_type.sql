-- ============================================
-- JubileeVerse Database Schema
-- Migration 008: Add mailbox_type to conversations
-- ============================================

-- Add mailbox_type column to conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS mailbox_type VARCHAR(50) DEFAULT 'chat_inbox'
CHECK (mailbox_type IN ('chat_inbox', 'kingdom_builder', 'creative_fire', 'gospel_pulse', 'shepherd_voice', 'hebraic_roots'));

-- Add is_focused column for Focused/Other filtering
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_focused BOOLEAN DEFAULT TRUE;

-- Create index for mailbox_type queries
CREATE INDEX IF NOT EXISTS idx_conversations_mailbox_type ON conversations(mailbox_type);
CREATE INDEX IF NOT EXISTS idx_conversations_user_mailbox ON conversations(user_id, mailbox_type, status);
CREATE INDEX IF NOT EXISTS idx_conversations_focused ON conversations(is_focused);
