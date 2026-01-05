-- Codex Database: Initial Schema
-- The foundational, canonical system of record for the Jubilee platform
--
-- OWNERSHIP: Global identities, SSO, roles/permissions, persona metadata,
--            platform configuration, feature flags, canonical Scripture references
--
-- ACCESS PATTERN: Read-mostly with carefully controlled write access

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- CORE IDENTITY TABLES
-- ============================================================================

-- Global user identities - THE authoritative source for user identity
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Identity
    email CITEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    -- Authentication (password optional for SSO-only users)
    password_hash VARCHAR(255),
    password_changed_at TIMESTAMPTZ,
    require_password_change BOOLEAN NOT NULL DEFAULT FALSE,
    -- Profile
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    preferred_language VARCHAR(10) DEFAULT 'en',
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    lockout_end_time TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    -- Tracking
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_users_created ON users(created_at);

-- ============================================================================
-- ROLES AND PERMISSIONS
-- ============================================================================

-- Platform-wide roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Hierarchy: 1 = SuperAdmin, 10 = Admin, 50 = Moderator, 100 = User
    hierarchy_level INTEGER NOT NULL DEFAULT 100,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Granular permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    resource_category CITEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role-to-permission assignments
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    PRIMARY KEY (role_id, permission_id)
);

-- User-to-role assignments
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    -- Optional scope restriction (e.g., specific resource or domain)
    resource_scope CITEXT,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id, COALESCE(resource_scope, ''))
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- ============================================================================
-- SSO & OAUTH
-- ============================================================================

-- OAuth2 client registration
CREATE TABLE oauth_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(64) NOT NULL UNIQUE,
    client_secret_hash VARCHAR(255),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Configuration
    redirect_uris TEXT[] NOT NULL DEFAULT '{}',
    allowed_scopes TEXT[] NOT NULL DEFAULT '{}',
    allowed_grant_types TEXT[] NOT NULL DEFAULT '{authorization_code}',
    -- Token lifetimes (in seconds)
    access_token_lifetime INTEGER NOT NULL DEFAULT 900,
    refresh_token_lifetime INTEGER NOT NULL DEFAULT 2592000,
    -- Type
    is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
    is_first_party BOOLEAN NOT NULL DEFAULT FALSE,
    -- Ownership
    owner_id UUID REFERENCES users(id),
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);

-- OAuth2 authorization codes (short-lived)
CREATE TABLE authorization_codes (
    code_hash VARCHAR(64) PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scope TEXT[] NOT NULL DEFAULT '{}',
    code_challenge VARCHAR(128),
    code_challenge_method VARCHAR(10),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_codes_expires ON authorization_codes(expires_at);

-- OAuth2 refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scope TEXT[] NOT NULL DEFAULT '{}',
    -- Token family for rotation detection
    token_family UUID NOT NULL DEFAULT uuid_generate_v4(),
    -- Request metadata
    user_agent TEXT,
    ip_address INET,
    device_fingerprint VARCHAR(64),
    -- Lifecycle
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(50),
    replaced_by_id UUID REFERENCES refresh_tokens(id)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Two-factor authentication
CREATE TABLE two_factor_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method_type VARCHAR(20) NOT NULL, -- totp, sms, email, backup_code
    secret_hash VARCHAR(255),
    algorithm VARCHAR(20) DEFAULT 'SHA1',
    digits INTEGER DEFAULT 6,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, method_type)
);

-- ============================================================================
-- EMAIL VERIFICATION & PASSWORD RESET
-- ============================================================================

CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    new_email CITEXT, -- For email change verification
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PERSONA METADATA (Definitions only, not conversations)
-- ============================================================================

-- Persona categories
CREATE TABLE persona_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Persona definitions (canonical metadata)
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(200),
    category_id UUID REFERENCES persona_categories(id),
    -- Profile
    avatar_url VARCHAR(500),
    short_bio VARCHAR(500),
    full_bio TEXT,
    -- AI Configuration
    system_prompt TEXT NOT NULL,
    personality_traits JSONB DEFAULT '[]',
    expertise_areas JSONB DEFAULT '[]',
    greeting_message TEXT,
    conversation_starters JSONB DEFAULT '[]',
    -- Language
    primary_language VARCHAR(10) NOT NULL DEFAULT 'en',
    supported_languages JSONB DEFAULT '["en"]',
    -- Status
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Metadata
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_personas_category ON personas(category_id);
CREATE INDEX idx_personas_active ON personas(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_personas_featured ON personas(is_featured) WHERE is_featured = TRUE;

-- Persona tags for classification
CREATE TABLE persona_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    slug CITEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE persona_tag_assignments (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES persona_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (persona_id, tag_id)
);

-- ============================================================================
-- PLATFORM CONFIGURATION
-- ============================================================================

-- Feature flags
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    description TEXT,
    -- State
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_percentage INTEGER DEFAULT 100, -- For gradual rollout
    -- Targeting
    target_environments TEXT[] DEFAULT '{development,staging,production}',
    target_user_ids UUID[] DEFAULT '{}',
    target_roles TEXT[] DEFAULT '{}',
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Platform settings
CREATE TABLE platform_settings (
    key CITEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE, -- Can be exposed to clients
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- ============================================================================
-- CANONICAL SCRIPTURE REFERENCES
-- ============================================================================

-- Bible books reference
CREATE TABLE bible_books (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE, -- e.g., 'GEN', 'MAT'
    name VARCHAR(50) NOT NULL,
    testament VARCHAR(10) NOT NULL, -- 'OT' or 'NT'
    chapter_count INTEGER NOT NULL,
    display_order INTEGER NOT NULL
);

-- Bible verses (canonical reference only - content in Inspire)
CREATE TABLE bible_verse_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id INTEGER NOT NULL REFERENCES bible_books(id),
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    -- Cross-references
    cross_references JSONB DEFAULT '[]',
    UNIQUE (book_id, chapter, verse)
);

CREATE INDEX idx_verse_refs_book ON bible_verse_references(book_id);
CREATE INDEX idx_verse_refs_chapter ON bible_verse_references(book_id, chapter);

-- ============================================================================
-- ADMIN & MODERATION
-- ============================================================================

-- Admin tasks
CREATE TABLE admin_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_number SERIAL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL, -- development, bug, enhancement, operational
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    component VARCHAR(100),
    -- Assignments
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    -- Timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Resolution
    notes TEXT,
    resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_tasks_status ON admin_tasks(status);
CREATE INDEX idx_admin_tasks_assignee ON admin_tasks(assigned_to);

-- Admin task history
CREATE TABLE admin_task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id),
    comment TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safety thresholds configuration
CREATE TABLE safety_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    alert_confidence_threshold INTEGER NOT NULL DEFAULT 70,
    severity_escalation_threshold INTEGER NOT NULL DEFAULT 85,
    repeat_count_threshold INTEGER NOT NULL DEFAULT 3,
    repeat_window_hours INTEGER NOT NULL DEFAULT 24,
    auto_alert BOOLEAN NOT NULL DEFAULT TRUE,
    requires_immediate_review BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category, COALESCE(subcategory, ''))
);

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    client_id UUID REFERENCES oauth_clients(id),
    resource_type VARCHAR(50),
    resource_id UUID,
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    -- Event data
    description TEXT,
    outcome VARCHAR(20), -- success, failure, error
    metadata JSONB DEFAULT '{}',
    -- Timestamp
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_occurred ON audit_logs(occurred_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_clients_updated_at
    BEFORE UPDATE ON oauth_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_persona_categories_updated_at
    BEFORE UPDATE ON persona_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personas_updated_at
    BEFORE UPDATE ON personas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_tasks_updated_at
    BEFORE UPDATE ON admin_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Default roles
INSERT INTO roles (name, display_name, description, hierarchy_level, is_system_role) VALUES
    ('superadmin', 'Super Administrator', 'Full system access', 1, TRUE),
    ('admin', 'Administrator', 'Administrative access', 10, TRUE),
    ('moderator', 'Moderator', 'Content moderation access', 50, TRUE),
    ('user', 'User', 'Standard user access', 100, TRUE);

-- Default permissions
INSERT INTO permissions (name, display_name, description, resource_category) VALUES
    ('users:read', 'View Users', 'View user information', 'users'),
    ('users:write', 'Manage Users', 'Create and update users', 'users'),
    ('users:delete', 'Delete Users', 'Delete user accounts', 'users'),
    ('roles:read', 'View Roles', 'View role information', 'roles'),
    ('roles:write', 'Manage Roles', 'Create and update roles', 'roles'),
    ('personas:read', 'View Personas', 'View persona definitions', 'personas'),
    ('personas:write', 'Manage Personas', 'Create and update personas', 'personas'),
    ('content:read', 'View Content', 'View ministry content', 'content'),
    ('content:write', 'Manage Content', 'Create and update content', 'content'),
    ('content:publish', 'Publish Content', 'Publish content to production', 'content'),
    ('admin:tasks', 'Admin Tasks', 'Manage admin tasks', 'admin'),
    ('admin:safety', 'Safety Review', 'Review safety alerts', 'admin'),
    ('platform:config', 'Platform Config', 'Manage platform settings', 'platform');

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'superadmin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name NOT IN ('platform:config');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator' AND p.resource_category IN ('personas', 'content', 'admin');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN ('personas:read', 'content:read');

-- Default platform settings
INSERT INTO platform_settings (key, value, description, is_public) VALUES
    ('maintenance_mode', 'false', 'Enable maintenance mode', FALSE),
    ('registration_enabled', 'true', 'Allow new user registration', TRUE),
    ('default_language', '"en"', 'Default platform language', TRUE),
    ('supported_languages', '["en", "es", "fr", "de", "pt", "zh", "ko", "ja"]', 'Supported languages', TRUE);

-- Bible books reference data
INSERT INTO bible_books (code, name, testament, chapter_count, display_order) VALUES
    ('GEN', 'Genesis', 'OT', 50, 1),
    ('EXO', 'Exodus', 'OT', 40, 2),
    ('LEV', 'Leviticus', 'OT', 27, 3),
    ('NUM', 'Numbers', 'OT', 36, 4),
    ('DEU', 'Deuteronomy', 'OT', 34, 5),
    ('JOS', 'Joshua', 'OT', 24, 6),
    ('JDG', 'Judges', 'OT', 21, 7),
    ('RUT', 'Ruth', 'OT', 4, 8),
    ('1SA', '1 Samuel', 'OT', 31, 9),
    ('2SA', '2 Samuel', 'OT', 24, 10),
    ('1KI', '1 Kings', 'OT', 22, 11),
    ('2KI', '2 Kings', 'OT', 25, 12),
    ('1CH', '1 Chronicles', 'OT', 29, 13),
    ('2CH', '2 Chronicles', 'OT', 36, 14),
    ('EZR', 'Ezra', 'OT', 10, 15),
    ('NEH', 'Nehemiah', 'OT', 13, 16),
    ('EST', 'Esther', 'OT', 10, 17),
    ('JOB', 'Job', 'OT', 42, 18),
    ('PSA', 'Psalms', 'OT', 150, 19),
    ('PRO', 'Proverbs', 'OT', 31, 20),
    ('ECC', 'Ecclesiastes', 'OT', 12, 21),
    ('SNG', 'Song of Solomon', 'OT', 8, 22),
    ('ISA', 'Isaiah', 'OT', 66, 23),
    ('JER', 'Jeremiah', 'OT', 52, 24),
    ('LAM', 'Lamentations', 'OT', 5, 25),
    ('EZK', 'Ezekiel', 'OT', 48, 26),
    ('DAN', 'Daniel', 'OT', 12, 27),
    ('HOS', 'Hosea', 'OT', 14, 28),
    ('JOL', 'Joel', 'OT', 3, 29),
    ('AMO', 'Amos', 'OT', 9, 30),
    ('OBA', 'Obadiah', 'OT', 1, 31),
    ('JON', 'Jonah', 'OT', 4, 32),
    ('MIC', 'Micah', 'OT', 7, 33),
    ('NAM', 'Nahum', 'OT', 3, 34),
    ('HAB', 'Habakkuk', 'OT', 3, 35),
    ('ZEP', 'Zephaniah', 'OT', 3, 36),
    ('HAG', 'Haggai', 'OT', 2, 37),
    ('ZEC', 'Zechariah', 'OT', 14, 38),
    ('MAL', 'Malachi', 'OT', 4, 39),
    ('MAT', 'Matthew', 'NT', 28, 40),
    ('MRK', 'Mark', 'NT', 16, 41),
    ('LUK', 'Luke', 'NT', 24, 42),
    ('JHN', 'John', 'NT', 21, 43),
    ('ACT', 'Acts', 'NT', 28, 44),
    ('ROM', 'Romans', 'NT', 16, 45),
    ('1CO', '1 Corinthians', 'NT', 16, 46),
    ('2CO', '2 Corinthians', 'NT', 13, 47),
    ('GAL', 'Galatians', 'NT', 6, 48),
    ('EPH', 'Ephesians', 'NT', 6, 49),
    ('PHP', 'Philippians', 'NT', 4, 50),
    ('COL', 'Colossians', 'NT', 4, 51),
    ('1TH', '1 Thessalonians', 'NT', 5, 52),
    ('2TH', '2 Thessalonians', 'NT', 3, 53),
    ('1TI', '1 Timothy', 'NT', 6, 54),
    ('2TI', '2 Timothy', 'NT', 4, 55),
    ('TIT', 'Titus', 'NT', 3, 56),
    ('PHM', 'Philemon', 'NT', 1, 57),
    ('HEB', 'Hebrews', 'NT', 13, 58),
    ('JAS', 'James', 'NT', 5, 59),
    ('1PE', '1 Peter', 'NT', 5, 60),
    ('2PE', '2 Peter', 'NT', 3, 61),
    ('1JN', '1 John', 'NT', 5, 62),
    ('2JN', '2 John', 'NT', 1, 63),
    ('3JN', '3 John', 'NT', 1, 64),
    ('JUD', 'Jude', 'NT', 1, 65),
    ('REV', 'Revelation', 'NT', 22, 66);

-- Default safety thresholds
INSERT INTO safety_thresholds (category, alert_confidence_threshold, requires_immediate_review) VALUES
    ('self_harm', 60, TRUE),
    ('harm_to_others', 60, TRUE),
    ('crisis_signal', 50, TRUE),
    ('grooming_behavior', 70, TRUE),
    ('sexual_advance', 75, FALSE),
    ('manipulation_attempt', 75, FALSE),
    ('coercive_language', 80, FALSE),
    ('boundary_violation', 80, FALSE),
    ('abuse_language', 70, FALSE),
    ('deception_attempt', 80, FALSE),
    ('identity_confusion', 85, FALSE),
    ('exploitation_risk', 70, TRUE);
