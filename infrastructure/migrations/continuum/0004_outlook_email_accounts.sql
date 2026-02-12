-- Migration: 0004_outlook_email_accounts
-- Database: continuum
-- Author: Jubilee Solutions
-- Date: 2026-02-12
-- Description: Email accounts table for IMAP/SMTP sync connections

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS outlook_email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    email_address VARCHAR(255) NOT NULL,
    display_name VARCHAR(200),
    provider_type VARCHAR(30) NOT NULL DEFAULT 'generic',
    auth_method VARCHAR(20) NOT NULL DEFAULT 'app_password',
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_use_ssl BOOLEAN NOT NULL DEFAULT TRUE,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_use_ssl BOOLEAN NOT NULL DEFAULT TRUE,
    encrypted_password TEXT,
    connection_status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
    last_sync_at TIMESTAMPTZ,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_outlook_email_accounts_user ON outlook_email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_email_accounts_email ON outlook_email_accounts(email_address);
CREATE INDEX IF NOT EXISTS idx_outlook_email_accounts_status ON outlook_email_accounts(connection_status);

-- Add account_id reference to email folders
ALTER TABLE outlook_email_folders ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES outlook_email_accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_outlook_folders_account ON outlook_email_folders(account_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_outlook_email_accounts_updated_at ON outlook_email_accounts;
CREATE TRIGGER update_outlook_email_accounts_updated_at
    BEFORE UPDATE ON outlook_email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================================
-- DOWN MIGRATION (for rollback)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE outlook_email_folders DROP COLUMN IF EXISTS account_id;
-- DROP TABLE IF EXISTS outlook_email_accounts CASCADE;
-- COMMIT;
