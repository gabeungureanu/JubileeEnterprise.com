-- ============================================
-- JubileeVerse Database Schema
-- Migration 040: Task Code System
-- ============================================
-- Adds a dedicated task_code column with JIT + 6 digit format
-- for consistent task identification (JIT000001, JIT000042, etc.)

-- Add task_code column
ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS task_code VARCHAR(12);

-- Create sequence for task codes starting from 1
CREATE SEQUENCE IF NOT EXISTS task_code_seq START WITH 1 INCREMENT BY 1;

-- Function to generate task_code on insert
CREATE OR REPLACE FUNCTION generate_task_code()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    -- Get next value from sequence
    SELECT nextval('task_code_seq') INTO next_num;

    -- Generate task_code in JIT + 6 digit format
    NEW.task_code := 'JIT' || LPAD(next_num::TEXT, 6, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate task_code on insert
DROP TRIGGER IF EXISTS admin_tasks_generate_code ON admin_tasks;
CREATE TRIGGER admin_tasks_generate_code
    BEFORE INSERT ON admin_tasks
    FOR EACH ROW
    WHEN (NEW.task_code IS NULL)
    EXECUTE FUNCTION generate_task_code();

-- Backfill existing tasks with task_code based on their task_number
UPDATE admin_tasks
SET task_code = 'JIT' || LPAD(task_number::TEXT, 6, '0')
WHERE task_code IS NULL;

-- Set sequence to continue from max existing task_number + 1
SELECT setval('task_code_seq', COALESCE((SELECT MAX(task_number) FROM admin_tasks), 0));

-- Add unique constraint on task_code
ALTER TABLE admin_tasks DROP CONSTRAINT IF EXISTS admin_tasks_task_code_unique;
ALTER TABLE admin_tasks ADD CONSTRAINT admin_tasks_task_code_unique UNIQUE (task_code);

-- Create index for task_code lookups
CREATE INDEX IF NOT EXISTS idx_admin_tasks_task_code ON admin_tasks(task_code);

-- Make task_code NOT NULL after backfill
ALTER TABLE admin_tasks ALTER COLUMN task_code SET NOT NULL;

-- Add comment
COMMENT ON COLUMN admin_tasks.task_code IS 'Unique task code in JIT + 6 digit format (JIT000001, JIT000042, etc.)';
