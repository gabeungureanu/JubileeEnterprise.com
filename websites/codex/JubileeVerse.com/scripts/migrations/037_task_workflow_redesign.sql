-- ============================================
-- JubileeVerse Database Schema
-- Migration 037: Collaborative Task Workflow Redesign
-- ============================================
-- Redesigns the task workflow to support collaboration between
-- AI (Jubilee) and Human (Gabriel) with clear ownership and status tracking.
--
-- Status Workflow (simplified names):
--   Submitted -> Developing -> Reviewing
--                           -> Rework (if issues found)
--                           -> Documenting (if approved for docs)
--   Documenting -> Approving -> Completed
--   Approving -> Rework (if issues found) -> back to cycle
--
-- Owner Rules:
--   Human (Gabriel): Submitted, Reviewing, Approving
--   AI (Jubilee): Developing, Rework, Documenting
--   None: Completed

-- Create new status enum for collaborative workflow
DO $$ BEGIN
    CREATE TYPE task_workflow_status AS ENUM (
        'submitted',
        'developing',
        'reviewing',
        'rework',
        'documenting',
        'approving',
        'completed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create owner enum
DO $$ BEGIN
    CREATE TYPE task_owner AS ENUM ('gabriel', 'jubilee', 'none');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create activity action enum
DO $$ BEGIN
    CREATE TYPE task_activity_action AS ENUM (
        'task_created',
        'status_changed',
        'development_started',
        'development_completed',
        'review_started',
        'review_completed',
        'rework_requested',
        'rework_completed',
        'documentation_started',
        'documentation_completed',
        'test_created',
        'approval_requested',
        'approved',
        'rejected',
        'description_updated',
        'note_added'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to admin_tasks table
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS workflow_status task_workflow_status DEFAULT 'submitted',
ADD COLUMN IF NOT EXISTS current_owner task_owner DEFAULT 'gabriel',
ADD COLUMN IF NOT EXISTS task_description TEXT,
ADD COLUMN IF NOT EXISTS page_component VARCHAR(255),
ADD COLUMN IF NOT EXISTS documentation_ref TEXT,
ADD COLUMN IF NOT EXISTS test_ref TEXT,
ADD COLUMN IF NOT EXISTS develop_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rework_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS document_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_started_at TIMESTAMPTZ;

-- Migrate existing status values to new workflow_status
UPDATE admin_tasks SET
    workflow_status = CASE status
        WHEN 'submitted' THEN 'submitted'::task_workflow_status
        WHEN 'in_review' THEN 'reviewing'::task_workflow_status
        WHEN 'in_progress' THEN 'developing'::task_workflow_status
        WHEN 'fixing' THEN 'rework'::task_workflow_status
        WHEN 'completed' THEN 'completed'::task_workflow_status
        ELSE 'submitted'::task_workflow_status
    END,
    current_owner = CASE status
        WHEN 'submitted' THEN 'gabriel'::task_owner
        WHEN 'in_review' THEN 'gabriel'::task_owner
        WHEN 'in_progress' THEN 'jubilee'::task_owner
        WHEN 'fixing' THEN 'jubilee'::task_owner
        WHEN 'completed' THEN 'none'::task_owner
        ELSE 'gabriel'::task_owner
    END,
    task_description = COALESCE(description, '')
WHERE workflow_status IS NULL OR task_description IS NULL;

-- Create task activity log table for Work History
CREATE TABLE IF NOT EXISTS task_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,

    -- Activity details
    action task_activity_action NOT NULL,
    actor task_owner NOT NULL,
    actor_name VARCHAR(50) NOT NULL DEFAULT 'System',

    -- Status transition (if applicable)
    previous_status task_workflow_status,
    new_status task_workflow_status,

    -- Activity description and details
    description TEXT NOT NULL,
    details JSONB,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for task_activity_log
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_created_at ON task_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_action ON task_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_actor ON task_activity_log(actor);

-- Create index for workflow_status queries
CREATE INDEX IF NOT EXISTS idx_admin_tasks_workflow_status ON admin_tasks(workflow_status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_current_owner ON admin_tasks(current_owner);

-- Function to automatically set owner based on workflow status
CREATE OR REPLACE FUNCTION set_task_owner_from_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Set owner based on status
    -- Human (Gabriel): submitted, reviewing, approving
    -- AI (Jubilee): developing, rework, documenting
    -- None: completed
    NEW.current_owner = CASE NEW.workflow_status
        WHEN 'submitted' THEN 'gabriel'::task_owner
        WHEN 'developing' THEN 'jubilee'::task_owner
        WHEN 'reviewing' THEN 'gabriel'::task_owner
        WHEN 'rework' THEN 'jubilee'::task_owner
        WHEN 'documenting' THEN 'jubilee'::task_owner
        WHEN 'approving' THEN 'gabriel'::task_owner
        WHEN 'completed' THEN 'none'::task_owner
        ELSE 'gabriel'::task_owner
    END;

    -- Update workflow timestamps
    IF NEW.workflow_status = 'developing' AND OLD.workflow_status = 'submitted' THEN
        NEW.develop_started_at = NOW();
    ELSIF NEW.workflow_status = 'reviewing' THEN
        NEW.review_started_at = NOW();
    ELSIF NEW.workflow_status = 'rework' THEN
        NEW.rework_started_at = NOW();
    ELSIF NEW.workflow_status = 'documenting' THEN
        NEW.document_started_at = NOW();
    ELSIF NEW.workflow_status = 'approving' THEN
        NEW.approval_started_at = NOW();
    ELSIF NEW.workflow_status = 'completed' THEN
        NEW.completed_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set owner when workflow status changes
DROP TRIGGER IF EXISTS set_task_owner_trigger ON admin_tasks;
CREATE TRIGGER set_task_owner_trigger
    BEFORE UPDATE OF workflow_status ON admin_tasks
    FOR EACH ROW
    WHEN (OLD.workflow_status IS DISTINCT FROM NEW.workflow_status)
    EXECUTE FUNCTION set_task_owner_from_status();

-- Function to log activity when status changes
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
    action_type task_activity_action;
    action_desc TEXT;
    actor_type task_owner;
BEGIN
    -- Determine action type and description based on transition
    CASE NEW.workflow_status
        WHEN 'developing' THEN
            action_type := 'development_started';
            action_desc := 'Jubilee started development';
            actor_type := 'jubilee';
        WHEN 'reviewing' THEN
            action_type := 'review_started';
            action_desc := 'Ready for Gabriel to review';
            actor_type := 'jubilee';
        WHEN 'rework' THEN
            action_type := 'rework_requested';
            action_desc := 'Gabriel requested rework';
            actor_type := 'gabriel';
        WHEN 'documenting' THEN
            action_type := 'documentation_started';
            action_desc := 'Jubilee started documentation';
            actor_type := 'jubilee';
        WHEN 'approving' THEN
            action_type := 'approval_requested';
            action_desc := 'Ready for Gabriel to approve';
            actor_type := 'jubilee';
        WHEN 'completed' THEN
            action_type := 'approved';
            action_desc := 'Gabriel approved - task completed';
            actor_type := 'gabriel';
        ELSE
            action_type := 'status_changed';
            action_desc := 'Status updated';
            actor_type := 'gabriel';
    END CASE;

    -- Insert activity log entry
    INSERT INTO task_activity_log (
        task_id, action, actor, actor_name,
        previous_status, new_status, description
    ) VALUES (
        NEW.id, action_type, actor_type,
        CASE actor_type WHEN 'jubilee' THEN 'Jubilee' ELSE 'Gabriel' END,
        OLD.workflow_status, NEW.workflow_status, action_desc
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log status changes
DROP TRIGGER IF EXISTS log_task_status_change_trigger ON admin_tasks;
CREATE TRIGGER log_task_status_change_trigger
    AFTER UPDATE OF workflow_status ON admin_tasks
    FOR EACH ROW
    WHEN (OLD.workflow_status IS DISTINCT FROM NEW.workflow_status)
    EXECUTE FUNCTION log_task_status_change();

-- Function to log task creation
CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_activity_log (
        task_id, action, actor, actor_name, new_status, description
    ) VALUES (
        NEW.id, 'task_created', 'gabriel', 'Gabriel',
        NEW.workflow_status, 'Task submitted'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log task creation
DROP TRIGGER IF EXISTS log_task_creation_trigger ON admin_tasks;
CREATE TRIGGER log_task_creation_trigger
    AFTER INSERT ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_creation();

-- Add comments
COMMENT ON TABLE task_activity_log IS 'Work History / Activity Log for tasks - tracks all status changes, development actions, reviews, and documentation updates';
COMMENT ON COLUMN admin_tasks.workflow_status IS 'Current workflow status: submitted, developing, reviewing, rework, documenting, approving, completed';
COMMENT ON COLUMN admin_tasks.current_owner IS 'Current owner: gabriel (human), jubilee (AI), or none (completed)';
COMMENT ON COLUMN admin_tasks.task_description IS 'Original instructions, requirements, and clarifications for the task';
COMMENT ON COLUMN admin_tasks.page_component IS 'The page or component being worked on';
COMMENT ON COLUMN admin_tasks.documentation_ref IS 'Reference to documentation created for this task';
COMMENT ON COLUMN admin_tasks.test_ref IS 'Reference to test cases created for this task';
