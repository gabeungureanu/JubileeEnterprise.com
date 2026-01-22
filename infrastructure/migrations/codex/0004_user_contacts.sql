-- Migration: 0004_user_contacts.sql
-- Description: User contacts table for JubileeOutlook People module
-- Date: 2026-01-22
-- Database: codex

-- =============================================================================
-- UP MIGRATION
-- =============================================================================

BEGIN;

-- =============================================================================
-- USER CONTACTS TABLE
-- Stores user contacts for the JubileeOutlook People module
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    display_name VARCHAR(500) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email_addresses TEXT[] DEFAULT '{}',
    phone_numbers TEXT[] DEFAULT '{}',
    mobile_phone VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(255),
    department VARCHAR(255),
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(255),
    postal_code VARCHAR(50),
    country VARCHAR(255),
    notes TEXT,
    photo_url TEXT,
    birthday DATE,
    anniversary DATE,
    spouse VARCHAR(255),
    website VARCHAR(500),
    is_favorite BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    category VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index for user lookup (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);

-- Index for searching by display name
CREATE INDEX IF NOT EXISTS idx_user_contacts_display_name ON user_contacts(display_name);

-- Index for filtering favorites
CREATE INDEX IF NOT EXISTS idx_user_contacts_favorite ON user_contacts(is_favorite);

-- Index for filtering deleted contacts
CREATE INDEX IF NOT EXISTS idx_user_contacts_deleted ON user_contacts(is_deleted);

-- Composite index for common query: non-deleted contacts by user
CREATE INDEX IF NOT EXISTS idx_user_contacts_user_active ON user_contacts(user_id, is_deleted) WHERE is_deleted = FALSE;

-- Index for email search (GIN index for array containment)
CREATE INDEX IF NOT EXISTS idx_user_contacts_emails ON user_contacts USING GIN(email_addresses);

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_user_contacts_updated_at ON user_contacts;
CREATE TRIGGER update_user_contacts_updated_at
    BEFORE UPDATE ON user_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_contacts IS 'Stores user contacts for the JubileeOutlook People module';
COMMENT ON COLUMN user_contacts.id IS 'Unique identifier for the contact';
COMMENT ON COLUMN user_contacts.user_id IS 'ID of the user who owns this contact';
COMMENT ON COLUMN user_contacts.display_name IS 'Display name shown in the UI';
COMMENT ON COLUMN user_contacts.first_name IS 'Contact first name';
COMMENT ON COLUMN user_contacts.last_name IS 'Contact last name';
COMMENT ON COLUMN user_contacts.email_addresses IS 'Array of email addresses';
COMMENT ON COLUMN user_contacts.phone_numbers IS 'Array of phone numbers';
COMMENT ON COLUMN user_contacts.mobile_phone IS 'Mobile phone number';
COMMENT ON COLUMN user_contacts.company IS 'Company/organization name';
COMMENT ON COLUMN user_contacts.job_title IS 'Job title/position';
COMMENT ON COLUMN user_contacts.department IS 'Department within the company';
COMMENT ON COLUMN user_contacts.address IS 'Street address';
COMMENT ON COLUMN user_contacts.city IS 'City';
COMMENT ON COLUMN user_contacts.state IS 'State/province';
COMMENT ON COLUMN user_contacts.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN user_contacts.country IS 'Country';
COMMENT ON COLUMN user_contacts.notes IS 'Additional notes about the contact';
COMMENT ON COLUMN user_contacts.photo_url IS 'URL to contact photo/avatar';
COMMENT ON COLUMN user_contacts.birthday IS 'Contact birthday';
COMMENT ON COLUMN user_contacts.anniversary IS 'Contact anniversary date';
COMMENT ON COLUMN user_contacts.spouse IS 'Spouse name';
COMMENT ON COLUMN user_contacts.website IS 'Contact website URL';
COMMENT ON COLUMN user_contacts.is_favorite IS 'Whether contact is marked as favorite';
COMMENT ON COLUMN user_contacts.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN user_contacts.deleted_at IS 'Timestamp when contact was soft deleted';
COMMENT ON COLUMN user_contacts.category IS 'Contact category for organization';
COMMENT ON COLUMN user_contacts.created_at IS 'Timestamp when contact was created';
COMMENT ON COLUMN user_contacts.updated_at IS 'Timestamp when contact was last updated';

COMMIT;

-- =============================================================================
-- DOWN MIGRATION (for rollback)
-- =============================================================================
-- To rollback this migration, run the following commands:
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS update_user_contacts_updated_at ON user_contacts;
-- DROP TABLE IF EXISTS user_contacts CASCADE;
-- COMMIT;
