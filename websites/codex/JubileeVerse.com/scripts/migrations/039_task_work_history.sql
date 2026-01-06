-- ============================================
-- JubileeVerse Database Schema
-- Migration 039: Task Work History System
-- ============================================
-- Creates a comprehensive work history system that records all task
-- lifecycle events with timestamps, actors, and durations.

-- Work History Action Types
DO $$ BEGIN
    CREATE TYPE work_history_action AS ENUM (
        'created',
        'assigned',
        'status_changed',
        'developed',
        'submitted_for_review',
        'reviewed',
        'approved',
        'rejected',
        'rework_requested',
        'rework_completed',
        'documented',
        'qa_tested',
        'qa_passed',
        'qa_failed',
        'completed',
        'reopened',
        'comment_added',
        'field_updated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task Work History Table - stores all task lifecycle events
CREATE TABLE IF NOT EXISTS task_work_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task reference
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,

    -- Event details
    action work_history_action NOT NULL,
    actor VARCHAR(50) NOT NULL DEFAULT 'gabriel', -- 'gabriel' (human) or 'jubilee' (AI)

    -- Status tracking
    previous_status VARCHAR(50),
    new_status VARCHAR(50),

    -- Description of what happened
    description TEXT,

    -- Additional metadata (field changes, test results, etc.)
    metadata JSONB DEFAULT '{}',

    -- Timing information
    duration_seconds INTEGER, -- Time spent in this action (if applicable)

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_task_work_history_task_id ON task_work_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_work_history_action ON task_work_history(action);
CREATE INDEX IF NOT EXISTS idx_task_work_history_actor ON task_work_history(actor);
CREATE INDEX IF NOT EXISTS idx_task_work_history_created_at ON task_work_history(created_at DESC);

-- Task Duration Summary Table - stores calculated durations for completed tasks
CREATE TABLE IF NOT EXISTS task_duration_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,

    -- Total duration from submission to completion
    total_duration_seconds INTEGER,
    total_duration_minutes NUMERIC(10, 2),
    total_duration_hours NUMERIC(10, 2),

    -- Phase-specific durations
    time_in_submitted_seconds INTEGER DEFAULT 0,
    time_in_developing_seconds INTEGER DEFAULT 0,
    time_in_reviewing_seconds INTEGER DEFAULT 0,
    time_in_rework_seconds INTEGER DEFAULT 0,
    time_in_documenting_seconds INTEGER DEFAULT 0,
    time_in_approving_seconds INTEGER DEFAULT 0,

    -- Rework tracking
    rework_count INTEGER DEFAULT 0,
    total_rework_time_seconds INTEGER DEFAULT 0,

    -- Timestamps
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_duration_summary_task_id ON task_duration_summary(task_id);

-- Function to automatically log work history on task status changes
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_actor VARCHAR(50);
    v_description TEXT;
    v_action work_history_action;
BEGIN
    -- Determine actor based on new status
    CASE NEW.workflow_status
        WHEN 'submitted' THEN v_actor := 'gabriel';
        WHEN 'developing' THEN v_actor := 'jubilee';
        WHEN 'reviewing' THEN v_actor := 'jubilee'; -- Jubilee submits for review
        WHEN 'rework' THEN v_actor := 'gabriel'; -- Gabriel requests rework
        WHEN 'documenting' THEN v_actor := 'jubilee';
        WHEN 'approving' THEN v_actor := 'jubilee'; -- Jubilee submits for approval
        WHEN 'completed' THEN v_actor := 'gabriel'; -- Gabriel approves
        ELSE v_actor := 'gabriel';
    END CASE;

    -- Determine action type
    CASE
        WHEN OLD.workflow_status IS NULL THEN v_action := 'created';
        WHEN NEW.workflow_status = 'completed' THEN v_action := 'completed';
        WHEN NEW.workflow_status = 'rework' THEN v_action := 'rework_requested';
        WHEN OLD.workflow_status = 'rework' AND NEW.workflow_status = 'reviewing' THEN v_action := 'rework_completed';
        WHEN NEW.workflow_status = 'reviewing' THEN v_action := 'submitted_for_review';
        WHEN NEW.workflow_status = 'approving' THEN v_action := 'reviewed';
        ELSE v_action := 'status_changed';
    END CASE;

    -- Build description
    v_description := format('Status changed from %s to %s',
        COALESCE(OLD.workflow_status, 'none'),
        NEW.workflow_status
    );

    -- Insert work history entry
    INSERT INTO task_work_history (task_id, action, actor, previous_status, new_status, description)
    VALUES (NEW.id, v_action, v_actor, OLD.workflow_status, NEW.workflow_status, v_description);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log status changes
DROP TRIGGER IF EXISTS task_status_history_trigger ON admin_tasks;
CREATE TRIGGER task_status_history_trigger
    AFTER UPDATE OF workflow_status ON admin_tasks
    FOR EACH ROW
    WHEN (OLD.workflow_status IS DISTINCT FROM NEW.workflow_status)
    EXECUTE FUNCTION log_task_status_change();

-- Trigger for new task creation
CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_work_history (task_id, action, actor, new_status, description)
    VALUES (NEW.id, 'created', 'gabriel', NEW.workflow_status, 'Task created: ' || NEW.title);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_creation_history_trigger ON admin_tasks;
CREATE TRIGGER task_creation_history_trigger
    AFTER INSERT ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_creation();

-- Function to calculate and update task duration on completion
CREATE OR REPLACE FUNCTION calculate_task_duration()
RETURNS TRIGGER AS $$
DECLARE
    v_submitted_at TIMESTAMPTZ;
    v_total_seconds INTEGER;
    v_phase_seconds INTEGER;
    v_rework_count INTEGER;
BEGIN
    -- Only calculate when task is completed
    IF NEW.workflow_status = 'completed' AND (OLD.workflow_status IS NULL OR OLD.workflow_status != 'completed') THEN
        -- Get the original submission time
        SELECT MIN(created_at) INTO v_submitted_at
        FROM task_work_history
        WHERE task_id = NEW.id AND action = 'created';

        -- Calculate total duration
        v_total_seconds := EXTRACT(EPOCH FROM (NOW() - v_submitted_at))::INTEGER;

        -- Count rework cycles
        SELECT COUNT(*) INTO v_rework_count
        FROM task_work_history
        WHERE task_id = NEW.id AND action = 'rework_requested';

        -- Upsert duration summary
        INSERT INTO task_duration_summary (
            task_id,
            total_duration_seconds,
            total_duration_minutes,
            total_duration_hours,
            rework_count,
            submitted_at,
            completed_at
        ) VALUES (
            NEW.id,
            v_total_seconds,
            ROUND(v_total_seconds / 60.0, 2),
            ROUND(v_total_seconds / 3600.0, 2),
            v_rework_count,
            v_submitted_at,
            NOW()
        )
        ON CONFLICT (task_id) DO UPDATE SET
            total_duration_seconds = v_total_seconds,
            total_duration_minutes = ROUND(v_total_seconds / 60.0, 2),
            total_duration_hours = ROUND(v_total_seconds / 3600.0, 2),
            rework_count = v_rework_count,
            completed_at = NOW(),
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_duration_trigger ON admin_tasks;
CREATE TRIGGER task_duration_trigger
    AFTER UPDATE OF workflow_status ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_task_duration();

-- Add comments
COMMENT ON TABLE task_work_history IS 'Records all task lifecycle events with timestamps and actors for accountability and analysis';
COMMENT ON TABLE task_duration_summary IS 'Stores calculated duration metrics for completed tasks to support velocity analytics';
COMMENT ON COLUMN task_work_history.actor IS 'gabriel (human) or jubilee (AI) - who performed the action';
COMMENT ON COLUMN task_work_history.duration_seconds IS 'Time spent on this specific action, if tracked';
COMMENT ON COLUMN task_duration_summary.rework_count IS 'Number of times the task was sent back for rework';
