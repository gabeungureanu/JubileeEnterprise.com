-- =============================================================================
-- Rollback: initial-schema
-- Description: Drops all core identity tables
-- WARNING: This will delete all user data!
-- =============================================================================

DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS email_verification_tokens CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS authorization_codes CASCADE;
DROP TABLE IF EXISTS oauth_clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
