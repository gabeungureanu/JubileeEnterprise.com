-- ============================================
-- JubileeVerse Database Schema
-- Migration 093: Session Store Table
-- ============================================
-- Creates the session_store table for connect-pg-simple session middleware
-- This is separate from user_sessions which tracks session metadata

-- Create session store table for express-session with connect-pg-simple
CREATE TABLE IF NOT EXISTS session_store (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    CONSTRAINT session_store_pkey PRIMARY KEY (sid)
);

-- Create index for efficient expired session cleanup
CREATE INDEX IF NOT EXISTS session_store_expire_idx ON session_store (expire);

-- Add comment explaining the table's purpose
COMMENT ON TABLE session_store IS 'Express session storage for connect-pg-simple middleware. Separate from user_sessions which tracks session metadata.';
COMMENT ON COLUMN session_store.sid IS 'Session ID (primary key)';
COMMENT ON COLUMN session_store.sess IS 'Session data stored as JSON';
COMMENT ON COLUMN session_store.expire IS 'Session expiration timestamp';
