-- ============================================
-- JubileeVerse Database Schema
-- Migration 012: Add subject lock for conversations
-- ============================================

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS subject_locked BOOLEAN NOT NULL DEFAULT FALSE;
