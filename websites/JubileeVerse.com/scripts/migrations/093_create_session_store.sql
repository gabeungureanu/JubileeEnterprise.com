-- ============================================
-- JubileeVerse Database Schema
-- Migration 093: Session Store Table
-- Required by connect-pg-simple for session storage
-- ============================================

-- Create session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Create index on expire for cleanup queries
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
