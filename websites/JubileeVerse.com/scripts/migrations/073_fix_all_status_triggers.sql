-- Migration 073: Fix all remaining triggers that reference workflow_status
-- These functions were not updated when we dropped workflow_status column

-- Drop all problematic triggers first
DROP TRIGGER IF EXISTS set_task_owner_trigger ON admin_tasks;
DROP TRIGGER IF EXISTS log_task_creation_trigger ON admin_tasks;
DROP TRIGGER IF EXISTS validate_child_task_creation_trigger ON admin_tasks;
DROP TRIGGER IF EXISTS validate_child_task_reparenting_trigger ON admin_tasks;

-- Drop all problematic functions
DROP FUNCTION IF EXISTS set_task_owner_from_status() CASCADE;
DROP FUNCTION IF EXISTS log_task_creation() CASCADE;
DROP FUNCTION IF EXISTS validate_child_task_creation() CASCADE;
DROP FUNCTION IF EXISTS validate_child_task_reparenting() CASCADE;

-- Recreate set_task_owner_from_status using status column
CREATE OR REPLACE FUNCTION set_task_owner_from_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Set owner based on status
    NEW.current_owner = CASE NEW.status
        WHEN 'submitted' THEN 'gabriel'::task_owner
        WHEN 'in_review' THEN 'gabriel'::task_owner
        WHEN 'in_progress' THEN 'jubilee'::task_owner
        WHEN 'fixing' THEN 'jubilee'::task_owner
        WHEN 'completed' THEN NULL
        ELSE 'gabriel'::task_owner
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate log_task_creation using status column (without new_status column)
CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_activity_log (
        task_id, action, actor, actor_name, description
    ) VALUES (
        NEW.id, 'task_created', 'gabriel', 'Gabriel',
        'Task submitted with status: ' || NEW.status::TEXT
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate validate_child_task_creation using status column
CREATE OR REPLACE FUNCTION validate_child_task_creation()
RETURNS TRIGGER AS $$
DECLARE
    parent_status admin_task_status;
BEGIN
    -- Only check if parent_task_id is being set
    IF NEW.parent_task_id IS NOT NULL THEN
        -- Get parent status
        SELECT status INTO parent_status
        FROM admin_tasks
        WHERE id = NEW.parent_task_id;

        -- Don't allow adding children to completed tasks
        IF parent_status = 'completed' THEN
            RAISE EXCEPTION 'Cannot add child task to a completed parent task';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate validate_child_task_reparenting using status column
CREATE OR REPLACE FUNCTION validate_child_task_reparenting()
RETURNS TRIGGER AS $$
DECLARE
    new_parent_status admin_task_status;
BEGIN
    -- Handle parent change
    IF OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id THEN
        -- If setting a new parent, check it's not completed
        IF NEW.parent_task_id IS NOT NULL THEN
            SELECT status INTO new_parent_status
            FROM admin_tasks
            WHERE id = NEW.parent_task_id;

            IF new_parent_status = 'completed' THEN
                RAISE EXCEPTION 'Cannot reparent task to a completed parent';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER set_task_owner_trigger
    BEFORE INSERT OR UPDATE OF status ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_owner_from_status();

CREATE TRIGGER log_task_creation_trigger
    AFTER INSERT ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_creation();

CREATE TRIGGER validate_child_task_creation_trigger
    BEFORE INSERT ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_child_task_creation();

CREATE TRIGGER validate_child_task_reparenting_trigger
    BEFORE UPDATE ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_child_task_reparenting();

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 073: Fixed all remaining triggers to use status column';
END $$;
