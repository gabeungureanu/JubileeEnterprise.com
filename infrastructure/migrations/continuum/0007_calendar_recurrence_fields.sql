-- Migration: 0007_calendar_recurrence_fields
-- Database: continuum
-- Author: Jubilee Solutions
-- Date: 2026-02-21
-- Description: Add dedicated recurrence columns to calendar events for full recurring event support

BEGIN;

-- Add recurrence detail columns
ALTER TABLE outlook_calendar_events ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20);
ALTER TABLE outlook_calendar_events ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1;
ALTER TABLE outlook_calendar_events ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ;
ALTER TABLE outlook_calendar_events ADD COLUMN IF NOT EXISTS recurrence_occurrences INTEGER;
ALTER TABLE outlook_calendar_events ADD COLUMN IF NOT EXISTS recurrence_days_of_week TEXT[];
ALTER TABLE outlook_calendar_events ADD COLUMN IF NOT EXISTS recurrence_exception_dates TEXT[];

-- Index for efficient recurring event queries
CREATE INDEX IF NOT EXISTS idx_outlook_events_is_recurring
  ON outlook_calendar_events(user_id, is_recurring)
  WHERE is_recurring = TRUE;

COMMIT;
