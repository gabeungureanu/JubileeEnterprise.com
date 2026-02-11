-- =============================================================================
-- Migration: 0009_fix_contact_array_columns_to_jsonb.sql
-- Description: Align schema with actual database state. The email_addresses and
--              phone_numbers columns are JSONB in the database (not TEXT[] as
--              originally declared in 0004). This migration ensures consistency
--              and updates indexes to use proper JSONB operators.
-- =============================================================================

-- Ensure columns are JSONB (idempotent - no-op if already JSONB)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_contacts'
    AND column_name = 'email_addresses'
    AND udt_name != 'jsonb'
  ) THEN
    ALTER TABLE user_contacts ALTER COLUMN email_addresses TYPE JSONB USING email_addresses::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_contacts'
    AND column_name = 'phone_numbers'
    AND udt_name != 'jsonb'
  ) THEN
    ALTER TABLE user_contacts ALTER COLUMN phone_numbers TYPE JSONB USING phone_numbers::jsonb;
  END IF;
END $$;

-- Set default values for JSONB columns (empty JSON array)
ALTER TABLE user_contacts ALTER COLUMN email_addresses SET DEFAULT '[]'::jsonb;
ALTER TABLE user_contacts ALTER COLUMN phone_numbers SET DEFAULT '[]'::jsonb;

-- Drop old GIN index (was created for TEXT[] arrays)
DROP INDEX IF EXISTS idx_user_contacts_emails;

-- Create new GIN index optimized for JSONB
CREATE INDEX IF NOT EXISTS idx_user_contacts_emails_jsonb ON user_contacts USING GIN(email_addresses jsonb_ops);

-- Add GIN index for phone_numbers too
CREATE INDEX IF NOT EXISTS idx_user_contacts_phones_jsonb ON user_contacts USING GIN(phone_numbers jsonb_ops);
