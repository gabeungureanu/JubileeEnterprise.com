-- ============================================
-- JubileeVerse Database Schema
-- Migration 032: Admin Task Tracking System
-- ============================================
-- Creates an admin-only task tracking system for development work,
-- bug reports, and operational tasks across the platform.
-- Tasks follow a defined workflow: Submitted -> In Review -> In Progress -> Fixing -> Completed

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Task Types Enum
DO $$ BEGIN
    CREATE TYPE admin_task_type AS ENUM ('development', 'bug', 'enhancement', 'operational');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task Status Enum (workflow order)
DO $$ BEGIN
    CREATE TYPE admin_task_status AS ENUM ('submitted', 'in_review', 'in_progress', 'fixing', 'completed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task Priority Enum
DO $$ BEGIN
    CREATE TYPE admin_task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Admin Tasks Table
CREATE TABLE IF NOT EXISTS admin_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task identification
    task_number SERIAL,  -- Auto-incrementing task number for easy reference (JV-001, JV-002, etc.)
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Task classification
    task_type admin_task_type NOT NULL DEFAULT 'development',
    priority admin_task_priority NOT NULL DEFAULT 'medium',
    status admin_task_status NOT NULL DEFAULT 'submitted',

    -- Component/Area affected (e.g., 'chat', 'personas', 'billing', 'auth', 'admin', 'frontend', 'backend')
    component VARCHAR(100),

    -- Assignment and ownership
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Workflow timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    fixing_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Additional metadata
    notes TEXT,  -- Internal notes visible only to admins
    resolution TEXT,  -- How the task was resolved (for completed tasks)

    -- Standard timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_admin_tasks_status ON admin_tasks(status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_type ON admin_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_priority ON admin_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_assigned_to ON admin_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_created_at ON admin_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_task_number ON admin_tasks(task_number);

-- Task Status History Table (audit trail)
CREATE TABLE IF NOT EXISTS admin_task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,

    -- What changed
    previous_status admin_task_status,
    new_status admin_task_status,

    -- Who made the change
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Optional comment for the change
    comment TEXT,

    -- When the change was made
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_task_history_task_id ON admin_task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_admin_task_history_changed_at ON admin_task_history(changed_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS admin_tasks_updated_at ON admin_tasks;
CREATE TRIGGER admin_tasks_updated_at
    BEFORE UPDATE ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_task_updated_at();

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions TEXT[];
BEGIN
    -- Define valid transitions for each status
    CASE OLD.status
        WHEN 'submitted' THEN
            valid_transitions := ARRAY['in_review', 'completed'];  -- Can skip to completed if duplicate/invalid
        WHEN 'in_review' THEN
            valid_transitions := ARRAY['in_progress', 'submitted', 'completed'];  -- Can go back to submitted or skip to completed
        WHEN 'in_progress' THEN
            valid_transitions := ARRAY['fixing', 'in_review', 'completed'];  -- Can go back to in_review
        WHEN 'fixing' THEN
            valid_transitions := ARRAY['completed', 'in_progress'];  -- Can go back to in_progress
        WHEN 'completed' THEN
            valid_transitions := ARRAY['in_progress'];  -- Can reopen if needed
        ELSE
            valid_transitions := ARRAY[]::TEXT[];
    END CASE;

    -- Check if transition is valid
    IF NEW.status::TEXT = ANY(valid_transitions) OR NEW.status = OLD.status THEN
        -- Update workflow timestamps
        IF NEW.status = 'in_review' AND OLD.status = 'submitted' THEN
            NEW.reviewed_at = NOW();
        ELSIF NEW.status = 'in_progress' AND OLD.status IN ('submitted', 'in_review') THEN
            NEW.started_at = NOW();
        ELSIF NEW.status = 'fixing' AND OLD.status = 'in_progress' THEN
            NEW.fixing_at = NOW();
        ELSIF NEW.status = 'completed' THEN
            NEW.completed_at = NOW();
        END IF;

        RETURN NEW;
    ELSE
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate status transitions
DROP TRIGGER IF EXISTS admin_tasks_status_transition ON admin_tasks;
CREATE TRIGGER admin_tasks_status_transition
    BEFORE UPDATE OF status ON admin_tasks
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_task_status_transition();

-- Insert some sample tasks for demonstration
INSERT INTO admin_tasks (title, description, task_type, priority, status, component, notes)
VALUES
    ('Implement admin task tracking system', 'Create a comprehensive task tracking system for administrative and development work', 'development', 'high', 'in_progress', 'admin', 'Initial implementation of the task tracking feature'),
    ('Fix persona selection race condition', 'When navigating from search to chat, the selected persona was not being applied correctly due to async loading', 'bug', 'high', 'completed', 'chat', 'Fixed by ensuring persona directory loads before setting selection'),
    ('Update streaming animation speed', 'Adjust chat streaming animation to feel more natural', 'enhancement', 'medium', 'completed', 'chat', 'Reverted to 20ms interval with 1-3 char chunks'),
    ('Add hospitality engagement tracking', 'Create system to track visitor engagement and trigger persona-driven interactions', 'development', 'high', 'in_review', 'hospitality', 'Phase 1 of hospitality module'),
    ('Review translation endpoint performance', 'Evaluate and optimize translation API response times', 'operational', 'medium', 'submitted', 'translation', NULL)
ON CONFLICT DO NOTHING;

-- Add comment explaining the table purpose
COMMENT ON TABLE admin_tasks IS 'Administrative task tracking for development work, bug reports, and operational tasks. Tasks follow workflow: Submitted -> In Review -> In Progress -> Fixing -> Completed';
COMMENT ON TABLE admin_task_history IS 'Audit trail of all status changes for admin tasks';
