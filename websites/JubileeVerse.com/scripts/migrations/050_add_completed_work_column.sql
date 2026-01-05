-- ============================================
-- JubileeVerse Database Schema
-- Migration 050: Add Completed Work (AI+Human) Column
-- ============================================
-- Adds completed_work column to track actual time spent completing tasks
-- with AI assistance (Claude Code, OpenAI Codex, etc.) at 90% efficiency.
--
-- CW+ represents the actual hours spent by human + AI working together
-- to complete each task. This is typically much lower than EHH because
-- AI tools can dramatically accelerate development work.
--
-- Formula: CW+ = Raw AI-assisted hours / 0.9 (90% efficiency)
-- Minimum value: 0.1 hours (6 minutes)

-- Add the completed_work column
ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS completed_work DECIMAL(6,2);

-- Add comment explaining the column
COMMENT ON COLUMN admin_tasks.completed_work IS 'Completed Work (AI+Human) - Actual hours spent with AI assistance at 90% efficiency';
