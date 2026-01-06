-- ============================================
-- JubileeVerse Database Schema
-- Migration 044: Fix Dashboard Columns
-- ============================================
-- Adds missing columns to daily_time_log and task_work_history tables
-- to support the dashboard metrics and refresh functionality.

-- Add week_start column to daily_time_log if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_time_log' AND column_name = 'week_start'
    ) THEN
        ALTER TABLE daily_time_log ADD COLUMN week_start DATE;

        -- Update existing rows to calculate week_start from log_date
        UPDATE daily_time_log
        SET week_start = log_date - EXTRACT(DOW FROM log_date)::INTEGER + 1
        WHERE week_start IS NULL;

        -- Make it NOT NULL after populating
        ALTER TABLE daily_time_log ALTER COLUMN week_start SET NOT NULL;

        -- Create index
        CREATE INDEX IF NOT EXISTS idx_daily_time_log_week_start ON daily_time_log(week_start);
    END IF;
END $$;

-- Add sessions_count column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_time_log' AND column_name = 'sessions_count'
    ) THEN
        ALTER TABLE daily_time_log ADD COLUMN sessions_count INTEGER DEFAULT 1;
    END IF;
END $$;

-- Add active_hours column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_time_log' AND column_name = 'active_hours'
    ) THEN
        ALTER TABLE daily_time_log ADD COLUMN active_hours DECIMAL(5,2) DEFAULT 0;
        -- Set active_hours same as hours_worked for existing rows
        UPDATE daily_time_log SET active_hours = hours_worked WHERE active_hours = 0;
    END IF;
END $$;

-- Add tasks_completed column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_time_log' AND column_name = 'tasks_completed'
    ) THEN
        ALTER TABLE daily_time_log ADD COLUMN tasks_completed INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add heh_delivered column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_time_log' AND column_name = 'heh_delivered'
    ) THEN
        ALTER TABLE daily_time_log ADD COLUMN heh_delivered DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Add metadata column to task_work_history if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_work_history' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE task_work_history ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add duration_seconds column to task_work_history if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_work_history' AND column_name = 'duration_seconds'
    ) THEN
        ALTER TABLE task_work_history ADD COLUMN duration_seconds INTEGER;
    END IF;
END $$;

-- Create the get_week_start function if it doesn't exist
CREATE OR REPLACE FUNCTION get_week_start(target_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
    -- Return Monday of the week containing target_date
    RETURN target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON COLUMN daily_time_log.week_start IS 'Monday of the week for this log entry';
COMMENT ON COLUMN task_work_history.metadata IS 'Additional metadata (field changes, test results, etc.)';
COMMENT ON COLUMN task_work_history.duration_seconds IS 'Time spent on this specific action, if tracked';
