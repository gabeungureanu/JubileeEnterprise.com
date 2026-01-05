-- =============================================================================
-- Migration: domain-registry-schema
-- Description: Core domain registry tables for Jubilee Internet
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Jubilee TLDs (Top-Level Domains)
-- -----------------------------------------------------------------------------
CREATE TABLE jubilee_tlds (
    id VARCHAR(21) PRIMARY KEY,
    tld VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
    eligibility_rules TEXT,
    price_per_year INTEGER NOT NULL DEFAULT 300, -- cents ($3.00)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jubilee_tlds_tld ON jubilee_tlds(tld);
CREATE INDEX idx_jubilee_tlds_active ON jubilee_tlds(is_active);

-- -----------------------------------------------------------------------------
-- Registered Domains
-- -----------------------------------------------------------------------------
CREATE TABLE jubilee_domains (
    id VARCHAR(21) PRIMARY KEY,
    name VARCHAR(63) NOT NULL, -- domain name without TLD
    tld_id VARCHAR(21) NOT NULL REFERENCES jubilee_tlds(id),
    full_domain VARCHAR(255) NOT NULL UNIQUE, -- complete domain like "example.church"
    owner_id VARCHAR(21) NOT NULL, -- references users in SSO database
    status VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
    registered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_domain_name CHECK (name ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
    CONSTRAINT valid_status CHECK (status IN (
        'active', 'expired', 'suspended', 'pending_verification',
        'pending_payment', 'reserved', 'deleted'
    ))
);

CREATE INDEX idx_jubilee_domains_owner ON jubilee_domains(owner_id);
CREATE INDEX idx_jubilee_domains_status ON jubilee_domains(status);
CREATE INDEX idx_jubilee_domains_expires ON jubilee_domains(expires_at);
CREATE INDEX idx_jubilee_domains_full ON jubilee_domains(full_domain);
CREATE INDEX idx_jubilee_domains_name_tld ON jubilee_domains(name, tld_id);

-- Trigger for updated_at
CREATE TRIGGER jubilee_domains_updated_at
    BEFORE UPDATE ON jubilee_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- Reserved Domains
-- -----------------------------------------------------------------------------
CREATE TABLE reserved_domains (
    id VARCHAR(21) PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    tld_id VARCHAR(21) REFERENCES jubilee_tlds(id), -- null = all TLDs
    full_domain VARCHAR(255), -- null if applies to all TLDs
    reason VARCHAR(30) NOT NULL,
    reserved_by VARCHAR(21), -- user who reserved it, if applicable
    notes TEXT,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_reason CHECK (reason IN (
        'system', 'offensive', 'trademark', 'official', 'future_use'
    )),
    CONSTRAINT unique_reservation UNIQUE (name, tld_id)
);

CREATE INDEX idx_reserved_domains_name ON reserved_domains(name);
CREATE INDEX idx_reserved_domains_full ON reserved_domains(full_domain);

-- -----------------------------------------------------------------------------
-- Domain Registrations (Transaction History)
-- -----------------------------------------------------------------------------
CREATE TABLE domain_registrations (
    id VARCHAR(21) PRIMARY KEY,
    domain_id VARCHAR(21) NOT NULL REFERENCES jubilee_domains(id),
    user_id VARCHAR(21) NOT NULL,
    transaction_id VARCHAR(255), -- external payment ID (e.g., Stripe)
    amount INTEGER NOT NULL, -- cents
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    years INTEGER NOT NULL DEFAULT 1,
    registration_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT valid_registration_type CHECK (registration_type IN (
        'new', 'renewal', 'transfer'
    )),
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'completed', 'failed', 'refunded'
    ))
);

CREATE INDEX idx_domain_registrations_domain ON domain_registrations(domain_id);
CREATE INDEX idx_domain_registrations_user ON domain_registrations(user_id);
CREATE INDEX idx_domain_registrations_status ON domain_registrations(status);
CREATE INDEX idx_domain_registrations_transaction ON domain_registrations(transaction_id);

-- -----------------------------------------------------------------------------
-- Domain DNS Records (for Jubilee Network resolution)
-- -----------------------------------------------------------------------------
CREATE TABLE domain_records (
    id VARCHAR(21) PRIMARY KEY,
    domain_id VARCHAR(21) NOT NULL REFERENCES jubilee_domains(id) ON DELETE CASCADE,
    record_type VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL, -- subdomain or @ for root
    value TEXT NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 3600,
    priority INTEGER, -- for MX records
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_record_type CHECK (record_type IN (
        'A', 'AAAA', 'CNAME', 'TXT', 'MX', 'JUBILEE'
    ))
);

CREATE INDEX idx_domain_records_domain ON domain_records(domain_id);
CREATE INDEX idx_domain_records_type ON domain_records(record_type);
CREATE INDEX idx_domain_records_lookup ON domain_records(domain_id, name, record_type);

CREATE TRIGGER domain_records_updated_at
    BEFORE UPDATE ON domain_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- Domain Audit Log
-- -----------------------------------------------------------------------------
CREATE TABLE domain_audit_log (
    id BIGSERIAL PRIMARY KEY,
    domain_id VARCHAR(21),
    user_id VARCHAR(21),
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domain_audit_domain ON domain_audit_log(domain_id);
CREATE INDEX idx_domain_audit_user ON domain_audit_log(user_id);
CREATE INDEX idx_domain_audit_action ON domain_audit_log(action);
CREATE INDEX idx_domain_audit_created ON domain_audit_log(created_at);

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------
COMMENT ON TABLE jubilee_tlds IS 'Jubilee Internet top-level domains (.church, .faith, etc.)';
COMMENT ON TABLE jubilee_domains IS 'Registered domains within the Jubilee Internet namespace';
COMMENT ON TABLE reserved_domains IS 'Reserved or blocked domain names';
COMMENT ON TABLE domain_registrations IS 'Domain registration and renewal transaction history';
COMMENT ON TABLE domain_records IS 'DNS-like records for Jubilee Network resolution';
COMMENT ON TABLE domain_audit_log IS 'Audit trail for domain management actions';

-- -----------------------------------------------------------------------------
-- Note on Architecture
-- -----------------------------------------------------------------------------
-- This domain registry is INTERNAL to the Jubilee Internet only.
-- These domains do NOT exist on the public Internet/ICANN DNS.
-- Resolution is handled exclusively by Jubilee Browser and Jubilee services.
-- -----------------------------------------------------------------------------
