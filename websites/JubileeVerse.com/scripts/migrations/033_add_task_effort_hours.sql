-- ============================================
-- JubileeVerse Database Schema
-- Migration 033: Add Effort Hours to Admin Tasks
-- ============================================
-- Adds effort_hours field to support Development Velocity gauge
-- that measures Human-Equivalent Hours (HEH) delivered per week.

-- Add effort_hours column to admin_tasks
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS effort_hours DECIMAL(5,2) DEFAULT 2.0;

-- Add progress_percent for partial contribution calculation (0-100)
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100);

-- Create index for velocity calculations (completed tasks in time window)
CREATE INDEX IF NOT EXISTS idx_admin_tasks_completed_at ON admin_tasks(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Add comments explaining the fields
COMMENT ON COLUMN admin_tasks.effort_hours IS 'Estimated Human-Equivalent Hours for this task. Used for velocity calculations. Default is 2.0 hours based on average task complexity.';
COMMENT ON COLUMN admin_tasks.progress_percent IS 'Percentage of task completion (0-100). Used for partial velocity contribution of in-progress tasks.';

-- Update existing tasks with effort estimates based on priority and type
UPDATE admin_tasks SET effort_hours =
    CASE
        -- Critical bugs and development tasks get higher estimates
        WHEN priority = 'critical' AND task_type IN ('bug', 'development') THEN 8.0
        WHEN priority = 'high' AND task_type IN ('bug', 'development') THEN 4.0
        WHEN priority = 'high' AND task_type = 'enhancement' THEN 3.0
        -- Medium priority
        WHEN priority = 'medium' AND task_type = 'development' THEN 3.0
        WHEN priority = 'medium' AND task_type = 'bug' THEN 2.0
        WHEN priority = 'medium' AND task_type = 'enhancement' THEN 2.0
        -- Low priority and operational
        WHEN priority = 'low' THEN 1.0
        WHEN task_type = 'operational' THEN 1.5
        -- Default
        ELSE 2.0
    END
WHERE effort_hours = 2.0;

-- Set progress_percent based on current status
UPDATE admin_tasks SET progress_percent =
    CASE status
        WHEN 'submitted' THEN 0
        WHEN 'in_review' THEN 15
        WHEN 'in_progress' THEN 50
        WHEN 'fixing' THEN 80
        WHEN 'completed' THEN 100
    END
WHERE progress_percent = 0 OR progress_percent IS NULL;
