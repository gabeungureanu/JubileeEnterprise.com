-- Migration 072: Fix activity log trigger after workflow_status removal
-- The trigger was referencing the dropped workflow_status column

-- Drop the old trigger function that references workflow_status
DROP FUNCTION IF EXISTS log_task_status_change() CASCADE;

-- Create updated trigger function that uses status column
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
    action_type task_activity_action;
    action_desc TEXT;
    actor_type task_owner;
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Determine action type and description based on transition
        CASE NEW.status
            WHEN 'in_progress' THEN
                action_type := 'development_started';
                action_desc := 'Development started';
                actor_type := 'jubilee';
            WHEN 'in_review' THEN
                action_type := 'review_started';
                action_desc := 'Ready for review';
                actor_type := 'gabriel';
            WHEN 'fixing' THEN
                action_type := 'fix_requested';
                action_desc := 'Fixes requested';
                actor_type := 'gabriel';
            WHEN 'completed' THEN
                action_type := 'completed';
                action_desc := 'Task completed';
                actor_type := 'gabriel';
            ELSE
                action_type := 'status_changed';
                action_desc := 'Status changed to ' || NEW.status::TEXT;
                actor_type := 'system';
        END CASE;

        -- Insert activity log entry
        INSERT INTO task_activity_log (task_id, action, actor, description)
        VALUES (NEW.id, action_type, actor_type, action_desc);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS log_task_status_change_trigger ON admin_tasks;
CREATE TRIGGER log_task_status_change_trigger
    AFTER UPDATE OF status ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_status_change();

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 072: Fixed activity log trigger to use status column';
END $$;
