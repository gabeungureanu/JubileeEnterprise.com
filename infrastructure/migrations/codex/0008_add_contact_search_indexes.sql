-- =============================================================================
-- Migration: 0008_add_contact_search_indexes.sql
-- Description: Add missing search indexes for contacts (company, job_title,
--              first_name, last_name) to improve query performance.
-- =============================================================================

-- Index for searching by company name
CREATE INDEX IF NOT EXISTS idx_user_contacts_company ON user_contacts(company);

-- Index for searching by job title
CREATE INDEX IF NOT EXISTS idx_user_contacts_job_title ON user_contacts(job_title);

-- Index for searching by first name
CREATE INDEX IF NOT EXISTS idx_user_contacts_first_name ON user_contacts(first_name);

-- Index for searching by last name
CREATE INDEX IF NOT EXISTS idx_user_contacts_last_name ON user_contacts(last_name);

-- Composite index for name-based search (first + last)
CREATE INDEX IF NOT EXISTS idx_user_contacts_full_name ON user_contacts(first_name, last_name);
