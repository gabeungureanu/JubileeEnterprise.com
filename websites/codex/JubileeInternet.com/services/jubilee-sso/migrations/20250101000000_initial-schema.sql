-- =============================================================================
-- Migration: initial-schema
-- Created: 2025-01-01
-- Description: Core identity tables for Jubilee SSO
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Users Table
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id VARCHAR(21) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,

    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- OAuth Clients Table
-- -----------------------------------------------------------------------------
CREATE TABLE oauth_clients (
    id VARCHAR(21) PRIMARY KEY,
    client_id VARCHAR(64) NOT NULL UNIQUE,
    client_secret_hash VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    redirect_uris TEXT[] NOT NULL DEFAULT '{}',
    allowed_scopes TEXT[] NOT NULL DEFAULT '{openid}',
    allowed_grant_types TEXT[] NOT NULL DEFAULT '{authorization_code}',
    is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);

CREATE TRIGGER oauth_clients_updated_at
    BEFORE UPDATE ON oauth_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- Authorization Codes Table
-- -----------------------------------------------------------------------------
CREATE TABLE authorization_codes (
    code_hash VARCHAR(64) PRIMARY KEY,
    client_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(21) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scope TEXT[] NOT NULL DEFAULT '{openid}',
    code_challenge VARCHAR(128),
    code_challenge_method VARCHAR(10),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_codes_expires_at ON authorization_codes(expires_at);
CREATE INDEX idx_auth_codes_user_id ON authorization_codes(user_id);

-- -----------------------------------------------------------------------------
-- Refresh Tokens Table
-- -----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id VARCHAR(21) PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id VARCHAR(21) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(64) NOT NULL,
    scope TEXT[] NOT NULL DEFAULT '{openid}',
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_client_id ON refresh_tokens(client_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- Sessions Table (for web UI sessions)
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
    id VARCHAR(21) PRIMARY KEY,
    user_id VARCHAR(21) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(session_token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- -----------------------------------------------------------------------------
-- Audit Log Table
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(21),
    client_id VARCHAR(64),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_client_id ON audit_logs(client_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Partition audit logs by month for better performance (optional, for production)
-- This would require additional setup for automatic partition creation

-- -----------------------------------------------------------------------------
-- Email Verification Tokens Table
-- -----------------------------------------------------------------------------
CREATE TABLE email_verification_tokens (
    id VARCHAR(21) PRIMARY KEY,
    user_id VARCHAR(21) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_tokens_expires_at ON email_verification_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- Password Reset Tokens Table
-- -----------------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
    id VARCHAR(21) PRIMARY KEY,
    user_id VARCHAR(21) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_expires_at ON password_reset_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------
COMMENT ON TABLE users IS 'Core user identity table';
COMMENT ON TABLE oauth_clients IS 'Registered OAuth 2.0 / OIDC clients';
COMMENT ON TABLE authorization_codes IS 'Short-lived authorization codes for OAuth flow';
COMMENT ON TABLE refresh_tokens IS 'Long-lived refresh tokens for token renewal';
COMMENT ON TABLE sessions IS 'Web UI login sessions';
COMMENT ON TABLE audit_logs IS 'Security audit trail for authentication events';
