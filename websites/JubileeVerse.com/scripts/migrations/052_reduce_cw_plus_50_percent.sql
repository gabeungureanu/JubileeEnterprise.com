-- ============================================
-- JubileeVerse Database Schema
-- Migration 052: Reduce CW+ to 50% of Original Estimates
-- ============================================
-- Adjusts Completed Work (AI+Human) to 50% of original estimates
-- This better reflects the actual time spent with an experienced
-- developer working with AI tools like Claude Code.
--
-- Original estimates were based on 90% efficiency, but with
-- Gabriel's development background, the actual time is closer
-- to 50% of what was estimated.

-- Update all completed_work values to 50% of current values
UPDATE admin_tasks
SET completed_work = ROUND((completed_work * 0.5)::numeric, 2)
WHERE completed_work IS NOT NULL AND completed_work > 0;

-- Ensure minimum value of 0.10 (6 minutes) for any task
UPDATE admin_tasks
SET completed_work = 0.10
WHERE completed_work IS NOT NULL AND completed_work > 0 AND completed_work < 0.10;
