-- =============================================================================
-- Migration: 0011_fix_contact_groups_user_id.sql
-- Description: Remove foreign key constraint on contact_groups.user_id to match
--              user_contacts table behavior. The user_contacts table uses a plain
--              VARCHAR(255) user_id without FK, allowing any userId format.
--              contact_groups should work the same way.
-- =============================================================================

-- Drop the FK constraint that references users(id)
ALTER TABLE contact_groups DROP CONSTRAINT IF EXISTS contact_groups_user_id_fkey;

-- Change column type from UUID to VARCHAR(255) to match user_contacts.user_id
ALTER TABLE contact_groups ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::TEXT;
