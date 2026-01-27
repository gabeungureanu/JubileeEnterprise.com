-- Migration: 0006_add_office_to_contacts.sql
-- Description: Add office field to user_contacts table
-- Date: 2026-01-27
-- Database: codex

-- =============================================================================
-- UP MIGRATION
-- =============================================================================

BEGIN;

-- Add office column to user_contacts table
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS office VARCHAR(255);

-- Add comment for the new column
COMMENT ON COLUMN user_contacts.office IS 'Office location within the company';

COMMIT;

-- =============================================================================
-- DOWN MIGRATION (for rollback)
-- =============================================================================
-- To rollback this migration, run the following commands:
--
-- BEGIN;
-- ALTER TABLE user_contacts DROP COLUMN IF EXISTS office;
-- COMMIT;
