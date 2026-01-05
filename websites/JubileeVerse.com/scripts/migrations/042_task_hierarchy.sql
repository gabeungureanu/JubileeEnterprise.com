-- ============================================
-- JubileeVerse Database Schema
-- Migration 042: Parent/Child Task Hierarchy
-- ============================================
-- Adds support for hierarchical task relationships where a parent task
-- can contain multiple child tasks. Child tasks inherit and operate
-- under the status of their parent task.
--
-- Key Features:
-- - parent_task_id column for task hierarchy
-- - Child tasks do not have independent workflow status
-- - Parent task titles can be updated to reflect combined scope
-- - Closed parent tasks cannot receive new children

-- Add parent_task_id column to admin_tasks
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES admin_tasks(id) ON DELETE SET NULL;

-- Add is_parent flag for quick identification
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT FALSE;

-- Add child_count for quick child counting without joins
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS child_count INT DEFAULT 0;

-- Add display_order for ordering children under parent
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Create index for parent-child queries
CREATE INDEX IF NOT EXISTS idx_admin_tasks_parent_task_id ON admin_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_is_parent ON admin_tasks(is_parent) WHERE is_parent = TRUE;

-- Function to validate child task creation
-- Prevents adding children to completed/closed parent tasks
CREATE OR REPLACE FUNCTION validate_child_task_creation()
RETURNS TRIGGER AS $$
DECLARE
    parent_status task_workflow_status;
BEGIN
    -- Only check if parent_task_id is being set
    IF NEW.parent_task_id IS NOT NULL THEN
        -- Get parent status
        SELECT workflow_status INTO parent_status
        FROM admin_tasks
        WHERE id = NEW.parent_task_id;

        -- Prevent adding children to completed tasks
        IF parent_status = 'completed' THEN
            RAISE EXCEPTION 'Cannot add child task to a completed parent task. Create a new parent task instead.';
        END IF;

        -- Mark parent as having children
        UPDATE admin_tasks
        SET is_parent = TRUE,
            child_count = child_count + 1
        WHERE id = NEW.parent_task_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate child task creation
DROP TRIGGER IF EXISTS validate_child_task_creation_trigger ON admin_tasks;
CREATE TRIGGER validate_child_task_creation_trigger
    BEFORE INSERT ON admin_tasks
    FOR EACH ROW
    WHEN (NEW.parent_task_id IS NOT NULL)
    EXECUTE FUNCTION validate_child_task_creation();

-- Function to update parent child_count when child is deleted
CREATE OR REPLACE FUNCTION update_parent_child_count_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.parent_task_id IS NOT NULL THEN
        UPDATE admin_tasks
        SET child_count = GREATEST(0, child_count - 1)
        WHERE id = OLD.parent_task_id;

        -- If no more children, unmark as parent
        UPDATE admin_tasks
        SET is_parent = FALSE
        WHERE id = OLD.parent_task_id
          AND child_count = 0;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update parent when child is deleted
DROP TRIGGER IF EXISTS update_parent_child_count_trigger ON admin_tasks;
CREATE TRIGGER update_parent_child_count_trigger
    AFTER DELETE ON admin_tasks
    FOR EACH ROW
    WHEN (OLD.parent_task_id IS NOT NULL)
    EXECUTE FUNCTION update_parent_child_count_on_delete();

-- Function to prevent reparenting to completed tasks
CREATE OR REPLACE FUNCTION validate_child_task_reparenting()
RETURNS TRIGGER AS $$
DECLARE
    old_parent_status task_workflow_status;
    new_parent_status task_workflow_status;
BEGIN
    -- Handle parent change
    IF OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id THEN
        -- If setting a new parent, check it's not completed
        IF NEW.parent_task_id IS NOT NULL THEN
            SELECT workflow_status INTO new_parent_status
            FROM admin_tasks
            WHERE id = NEW.parent_task_id;

            IF new_parent_status = 'completed' THEN
                RAISE EXCEPTION 'Cannot move task to a completed parent. Create a new parent task instead.';
            END IF;

            -- Increment new parent's child count
            UPDATE admin_tasks
            SET is_parent = TRUE,
                child_count = child_count + 1
            WHERE id = NEW.parent_task_id;
        END IF;

        -- Decrement old parent's child count if had one
        IF OLD.parent_task_id IS NOT NULL THEN
            UPDATE admin_tasks
            SET child_count = GREATEST(0, child_count - 1)
            WHERE id = OLD.parent_task_id;

            UPDATE admin_tasks
            SET is_parent = FALSE
            WHERE id = OLD.parent_task_id
              AND child_count = 0;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reparenting validation
DROP TRIGGER IF EXISTS validate_child_task_reparenting_trigger ON admin_tasks;
CREATE TRIGGER validate_child_task_reparenting_trigger
    BEFORE UPDATE OF parent_task_id ON admin_tasks
    FOR EACH ROW
    WHEN (OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id)
    EXECUTE FUNCTION validate_child_task_reparenting();

-- View for tasks with their children (for UI display)
-- Note: task_code may not exist in older schemas, so we handle it conditionally
DO $$
BEGIN
    -- Drop existing view if it exists
    DROP VIEW IF EXISTS task_hierarchy;

    -- Check if task_code column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_tasks' AND column_name = 'task_code'
    ) THEN
        EXECUTE '
        CREATE VIEW task_hierarchy AS
        SELECT
            t.id,
            t.task_number,
            t.task_code,
            t.title,
            t.description,
            t.task_type,
            t.priority,
            t.workflow_status,
            t.current_owner,
            t.parent_task_id,
            t.is_parent,
            t.child_count,
            t.display_order,
            t.created_at,
            t.updated_at,
            p.task_number AS parent_task_number,
            p.title AS parent_title,
            CASE
                WHEN t.parent_task_id IS NULL THEN 0
                ELSE 1
            END AS hierarchy_level
        FROM admin_tasks t
        LEFT JOIN admin_tasks p ON t.parent_task_id = p.id';
    ELSE
        EXECUTE '
        CREATE VIEW task_hierarchy AS
        SELECT
            t.id,
            t.task_number,
            NULL::VARCHAR AS task_code,
            t.title,
            t.description,
            t.task_type,
            t.priority,
            t.workflow_status,
            t.current_owner,
            t.parent_task_id,
            t.is_parent,
            t.child_count,
            t.display_order,
            t.created_at,
            t.updated_at,
            p.task_number AS parent_task_number,
            p.title AS parent_title,
            CASE
                WHEN t.parent_task_id IS NULL THEN 0
                ELSE 1
            END AS hierarchy_level
        FROM admin_tasks t
        LEFT JOIN admin_tasks p ON t.parent_task_id = p.id';
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN admin_tasks.parent_task_id IS 'Reference to parent task for hierarchical organization. Child tasks operate under parent status.';
COMMENT ON COLUMN admin_tasks.is_parent IS 'Quick flag indicating this task has child tasks beneath it';
COMMENT ON COLUMN admin_tasks.child_count IS 'Count of direct child tasks for quick display without joins';
COMMENT ON COLUMN admin_tasks.display_order IS 'Order for displaying children under a parent task';
COMMENT ON VIEW task_hierarchy IS 'Flattened view of task hierarchy for UI display with parent info';
