-- Migration: 0007_add_name_fields_to_contacts.sql
-- Description: Add additional name fields to user_contacts table
-- Date: 2026-01-27
-- Database: codex

-- =============================================================================
-- UP MIGRATION
-- =============================================================================

BEGIN;

-- Add title field (e.g., Mr., Ms., Dr.)
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS title VARCHAR(50);

-- Add middle name field
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255);

-- Add suffix field (e.g., Jr., Sr., III)
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS suffix VARCHAR(50);

-- Add nickname field
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN user_contacts.title IS 'Honorific title (Mr., Ms., Dr., etc.)';
COMMENT ON COLUMN user_contacts.middle_name IS 'Contact middle name';
COMMENT ON COLUMN user_contacts.suffix IS 'Name suffix (Jr., Sr., III, etc.)';
COMMENT ON COLUMN user_contacts.nickname IS 'Contact nickname or preferred name';

COMMIT;

-- =============================================================================
-- DOWN MIGRATION (for rollback)
-- =============================================================================
-- To rollback this migration, run the following commands:
--
-- BEGIN;
-- ALTER TABLE user_contacts DROP COLUMN IF EXISTS title;
-- ALTER TABLE user_contacts DROP COLUMN IF EXISTS middle_name;
-- ALTER TABLE user_contacts DROP COLUMN IF EXISTS suffix;
-- ALTER TABLE user_contacts DROP COLUMN IF EXISTS nickname;
-- COMMIT;
