-- =============================================================================
-- Jubilee SSO - Database Initialization
-- =============================================================================
-- This script runs on first database creation.
-- For schema changes, use migrations instead.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create dedicated roles with least privilege
-- Note: In production, create roles via secrets management, not here

-- Read-only role for reporting/analytics
CREATE ROLE jubilee_sso_readonly;
GRANT CONNECT ON DATABASE jubilee_sso_dev TO jubilee_sso_readonly;
GRANT USAGE ON SCHEMA public TO jubilee_sso_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO jubilee_sso_readonly;

-- Application role (used by SSO service)
-- Already created as the main user, but document privileges here
COMMENT ON DATABASE jubilee_sso_dev IS 'Jubilee SSO Identity Database - Security Critical';
