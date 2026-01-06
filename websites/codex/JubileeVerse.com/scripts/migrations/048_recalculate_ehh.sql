-- ============================================
-- JubileeVerse Database Schema
-- Migration 048: Recalculate Effort Hours to EHH
-- ============================================
-- Updates effort_hours column to represent Est. Human Hours (EHH)
-- based on 70% efficiency rating.
-- EHH = Raw Hours / 0.7

-- Update all tasks with effort_hours to use EHH calculation
-- Current values represent raw AI/machine hours, we need human-equivalent hours
UPDATE admin_tasks
SET effort_hours = ROUND((effort_hours / 0.7)::numeric, 1)
WHERE effort_hours IS NOT NULL AND effort_hours > 0;

-- Add comment explaining the column
COMMENT ON COLUMN admin_tasks.effort_hours IS 'Est. Human Hours (EHH) - Estimated time for a human developer at 70% efficiency';
