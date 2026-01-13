-- Migration: 0003_add_ehh_minutes.sql
-- Description: Add EHH (Estimated Human Hours) column to developer_tasks
-- Date: 2026-01-12

-- =============================================================================
-- ADD EHH_MINUTES COLUMN
-- Stores estimated human hours in minutes for each task
-- =============================================================================

-- Add ehh_minutes column to developer_tasks table
ALTER TABLE developer_tasks
ADD COLUMN IF NOT EXISTS ehh_minutes INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN developer_tasks.ehh_minutes IS 'Estimated Human Hours in minutes - how long a human would take at 70% efficiency without AI assistance';

-- =============================================================================
-- UPDATE VIEW
-- Update the developer_tasks_view to include ehh_minutes
-- =============================================================================

CREATE OR REPLACE VIEW developer_tasks_view AS
SELECT
    t.id,
    t.task_code,
    t.task_number,
    t.project_name,
    t.developer_initials,
    t.task_name,
    t.original_prompt,
    t.status,
    t.start_time,
    t.end_time,
    t.active_duration_ms,
    t.ehh_minutes,
    -- Format duration as HH:MM:SS
    CASE
        WHEN t.active_duration_ms > 0 THEN
            LPAD((t.active_duration_ms / 3600000)::TEXT, 2, '0') || ':' ||
            LPAD(((t.active_duration_ms % 3600000) / 60000)::TEXT, 2, '0') || ':' ||
            LPAD(((t.active_duration_ms % 60000) / 1000)::TEXT, 2, '0')
        ELSE '00:00:00'
    END AS duration_formatted,
    -- Format EHH as HH:MM
    CASE
        WHEN t.ehh_minutes IS NOT NULL AND t.ehh_minutes > 0 THEN
            LPAD((t.ehh_minutes / 60)::TEXT, 2, '0') || ':' ||
            LPAD((t.ehh_minutes % 60)::TEXT, 2, '0')
        ELSE NULL
    END AS ehh_formatted,
    t.last_activity_at,
    t.session_id,
    t.machine_name,
    t.workspace_path,
    t.created_at,
    t.updated_at,
    DATE(t.start_time) AS task_date,
    p.project_category,
    p.project_type
FROM developer_tasks t
LEFT JOIN developer_projects p ON t.project_id = p.id
ORDER BY t.start_time DESC;

-- =============================================================================
-- UPDATE DAILY SUMMARY VIEW
-- Include EHH totals in daily summary
-- =============================================================================

CREATE OR REPLACE VIEW developer_tasks_daily_summary AS
SELECT
    DATE(start_time) AS task_date,
    developer_initials,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'complete') AS completed_tasks,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tasks,
    SUM(active_duration_ms) AS total_duration_ms,
    SUM(ehh_minutes) AS total_ehh_minutes,
    -- Format total duration as HH:MM:SS
    LPAD((SUM(active_duration_ms) / 3600000)::TEXT, 2, '0') || ':' ||
    LPAD(((SUM(active_duration_ms) % 3600000) / 60000)::TEXT, 2, '0') || ':' ||
    LPAD(((SUM(active_duration_ms) % 60000) / 1000)::TEXT, 2, '0') AS total_duration_formatted,
    -- Format total EHH as HH:MM
    LPAD((COALESCE(SUM(ehh_minutes), 0) / 60)::TEXT, 2, '0') || ':' ||
    LPAD((COALESCE(SUM(ehh_minutes), 0) % 60)::TEXT, 2, '0') AS total_ehh_formatted
FROM developer_tasks
GROUP BY DATE(start_time), developer_initials
ORDER BY task_date DESC, developer_initials;
