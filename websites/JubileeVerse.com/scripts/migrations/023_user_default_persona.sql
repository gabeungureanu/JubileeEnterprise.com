-- ============================================
-- JubileeVerse Database Schema
-- Migration 023: User Default Persona Preference
-- ============================================
-- Adds support for storing a user's default AI persona preference
-- that persists across sessions, devices, and logins.
-- When a user selects a persona on search.html, it becomes their default.
-- This default is used when creating new conversations in chat.html.
-- ============================================

-- Add default_persona_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_default_persona ON users(default_persona_id) WHERE default_persona_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN users.default_persona_id IS 'The user''s preferred default AI persona, selected via search.html. Used as the baseline persona for new conversations.';
