-- =============================================================================
-- Rollback: domain-registry-schema
-- WARNING: This will delete all domain registry data!
-- =============================================================================

DROP TABLE IF EXISTS domain_audit_log CASCADE;
DROP TABLE IF EXISTS domain_records CASCADE;
DROP TABLE IF EXISTS domain_registrations CASCADE;
DROP TABLE IF EXISTS reserved_domains CASCADE;
DROP TABLE IF EXISTS jubilee_domains CASCADE;
DROP TABLE IF EXISTS jubilee_tlds CASCADE;
