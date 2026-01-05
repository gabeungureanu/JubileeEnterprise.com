-- Migration 071: Consolidate status and workflow_status columns
-- Problem: Two status columns exist (status and workflow_status) causing data sync issues
-- Solution: Keep 'status' column, drop 'workflow_status' column
-- The code has been updated to use 'status' consistently

-- No need to sync workflow_status to status - we're dropping workflow_status entirely
-- Migration 037 already set up workflow_status, and we're consolidating to use only 'status'

-- Drop the index on workflow_status
DROP INDEX IF EXISTS idx_admin_tasks_workflow_status;

-- Drop the task_hierarchy view that references workflow_status
DROP VIEW IF EXISTS task_hierarchy;

-- Drop triggers that reference workflow_status
DROP TRIGGER IF EXISTS set_task_owner_trigger ON admin_tasks;
DROP TRIGGER IF EXISTS log_task_status_change_trigger ON admin_tasks;

-- Now drop the workflow_status column (CASCADE will handle remaining deps)
ALTER TABLE admin_tasks DROP COLUMN IF EXISTS workflow_status CASCADE;

-- Drop the unused enum type
DROP TYPE IF EXISTS task_workflow_status CASCADE;

-- Add comment explaining the status column
COMMENT ON COLUMN admin_tasks.status IS 'Task workflow status: submitted, in_review, in_progress, fixing, completed';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 071: Consolidated status columns - removed workflow_status, keeping status';
END $$;
