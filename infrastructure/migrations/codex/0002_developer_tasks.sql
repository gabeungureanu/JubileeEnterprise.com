-- Migration: 0002_developer_tasks.sql
-- Description: Create developer task tracking tables for automated time tracking
-- Date: 2026-01-12

-- =============================================================================
-- DEVELOPER PROJECTS TABLE
-- Stores project information detected from workspace folders
-- =============================================================================

CREATE TABLE IF NOT EXISTS developer_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(100) NOT NULL UNIQUE,      -- e.g., "jubileeinspire.com", "jubileebrowser"
    project_category VARCHAR(50) NOT NULL,          -- "application", "mobile", "codex", "continuum", "inspire"
    project_type VARCHAR(50),                        -- "wpf", "ios", "website", "api", "package"
    folder_path VARCHAR(500),                        -- Full path for reference
    description TEXT,                                -- Optional project description
    is_active BOOLEAN DEFAULT true,                  -- Whether project is actively tracked
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_developer_projects_name ON developer_projects(project_name);
CREATE INDEX IF NOT EXISTS idx_developer_projects_category ON developer_projects(project_category);

-- =============================================================================
-- DEVELOPER TASKS TABLE
-- Stores individual developer task entries with time tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS developer_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_code VARCHAR(20) NOT NULL UNIQUE,           -- "JTX-001", "JTX-002", etc.
    task_number SERIAL,                              -- Auto-incrementing number for code generation
    project_id UUID REFERENCES developer_projects(id) ON DELETE SET NULL,
    project_name VARCHAR(100) NOT NULL,              -- Denormalized for quick display
    developer_initials CHAR(2) NOT NULL,             -- "GU", "JD", etc.
    task_name VARCHAR(500) NOT NULL,                 -- AI-generated task title
    original_prompt TEXT,                            -- User's original prompt (for reference)
    status VARCHAR(20) DEFAULT 'in_progress'         -- "in_progress", "complete"
        CHECK (status IN ('in_progress', 'complete')),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- When task started
    end_time TIMESTAMPTZ,                            -- When task completed
    active_duration_ms BIGINT DEFAULT 0,             -- Active work time in milliseconds (excludes inactive periods)
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),      -- For inactivity tracking
    session_id VARCHAR(100),                         -- Unique session identifier for multi-VS Code support
    machine_name VARCHAR(100),                       -- Machine hostname for tracking
    workspace_path VARCHAR(500),                     -- Workspace folder path
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_developer_tasks_code ON developer_tasks(task_code);
CREATE INDEX IF NOT EXISTS idx_developer_tasks_number ON developer_tasks(task_number DESC);
CREATE INDEX IF NOT EXISTS idx_developer_tasks_developer ON developer_tasks(developer_initials);
CREATE INDEX IF NOT EXISTS idx_developer_tasks_project ON developer_tasks(project_name);
CREATE INDEX IF NOT EXISTS idx_developer_tasks_status ON developer_tasks(status);
-- Note: Cannot create expression index with DATE() as it's not immutable for TIMESTAMPTZ
-- Using start_time directly for range queries instead
CREATE INDEX IF NOT EXISTS idx_developer_tasks_start_time ON developer_tasks(start_time);
CREATE INDEX IF NOT EXISTS idx_developer_tasks_session ON developer_tasks(session_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to generate next task code (JTX-XXX)
CREATE OR REPLACE FUNCTION generate_task_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    next_num INTEGER;
    task_code VARCHAR(20);
BEGIN
    -- Get the next task number
    SELECT COALESCE(MAX(task_number), 0) + 1 INTO next_num FROM developer_tasks;

    -- Format as JTX-XXX with leading zeros
    task_code := 'JTX-' || LPAD(next_num::TEXT, 3, '0');

    RETURN task_code;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_developer_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_developer_tasks_updated_at ON developer_tasks;
CREATE TRIGGER trigger_developer_tasks_updated_at
    BEFORE UPDATE ON developer_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_developer_tasks_updated_at();

-- Function to update developer_projects updated_at
CREATE OR REPLACE FUNCTION update_developer_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at on projects
DROP TRIGGER IF EXISTS trigger_developer_projects_updated_at ON developer_projects;
CREATE TRIGGER trigger_developer_projects_updated_at
    BEFORE UPDATE ON developer_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_developer_projects_updated_at();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View for task list with formatted duration
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
    -- Format duration as HH:MM:SS
    CASE
        WHEN t.active_duration_ms > 0 THEN
            LPAD((t.active_duration_ms / 3600000)::TEXT, 2, '0') || ':' ||
            LPAD(((t.active_duration_ms % 3600000) / 60000)::TEXT, 2, '0') || ':' ||
            LPAD(((t.active_duration_ms % 60000) / 1000)::TEXT, 2, '0')
        ELSE '00:00:00'
    END AS duration_formatted,
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

-- View for daily task summary
CREATE OR REPLACE VIEW developer_tasks_daily_summary AS
SELECT
    DATE(start_time) AS task_date,
    developer_initials,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'complete') AS completed_tasks,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tasks,
    SUM(active_duration_ms) AS total_duration_ms,
    -- Format total duration as HH:MM:SS
    LPAD((SUM(active_duration_ms) / 3600000)::TEXT, 2, '0') || ':' ||
    LPAD(((SUM(active_duration_ms) % 3600000) / 60000)::TEXT, 2, '0') || ':' ||
    LPAD(((SUM(active_duration_ms) % 60000) / 1000)::TEXT, 2, '0') AS total_duration_formatted
FROM developer_tasks
GROUP BY DATE(start_time), developer_initials
ORDER BY task_date DESC, developer_initials;

-- =============================================================================
-- SEED DATA (Optional - for testing)
-- =============================================================================

-- Insert common projects
INSERT INTO developer_projects (project_name, project_category, project_type, folder_path)
VALUES
    ('jubileeverse.com', 'codex', 'website', 'websites/codex/JubileeVerse.com'),
    ('inspirecodex.com', 'codex', 'api', 'websites/codex/InspireCodex.com'),
    ('inspirecontinuum.com', 'codex', 'api', 'websites/codex/InspireContinuum.com'),
    ('jubileebrowser', 'application', 'wpf', 'applications/JubileeBrowser.wpf'),
    ('jubileeflywheel', 'application', 'wpf', 'applications/JubileeFlywheel.wpf'),
    ('jubileeoutlook', 'application', 'wpf', 'applications/JubileeOutlook.wpf'),
    ('jubileeinspire.ios', 'mobile', 'ios', 'mobile/JubileeInspire.ios'),
    ('wwbibleweb.com', 'codex', 'website', 'websites/codex/wwBibleweb.com')
ON CONFLICT (project_name) DO NOTHING;

-- =============================================================================
-- GRANTS (if needed for specific users/roles)
-- =============================================================================

-- Grant permissions to guardian user (adjust as needed)
-- GRANT ALL PRIVILEGES ON developer_projects TO guardian;
-- GRANT ALL PRIVILEGES ON developer_tasks TO guardian;
-- GRANT USAGE, SELECT ON SEQUENCE developer_tasks_task_number_seq TO guardian;
