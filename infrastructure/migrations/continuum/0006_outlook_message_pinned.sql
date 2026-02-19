-- Migration: 0006_outlook_message_pinned
-- Description: Add is_pinned boolean column to outlook_email_messages for pin/unpin support
-- Date: 2026-02-19

ALTER TABLE outlook_email_messages
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_outlook_messages_pinned
  ON outlook_email_messages (user_id, is_pinned)
  WHERE is_pinned = TRUE;
