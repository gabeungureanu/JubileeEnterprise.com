-- JubileeOutlook Local Cache Schema
-- Run this script after creating the database
-- Connect to jubilee_outlook_cache database first
-- psql -U jubilee -h localhost -d jubilee_outlook_cache -f create_cache_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================
-- CACHED EMAILS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS cached_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id VARCHAR(255) UNIQUE NOT NULL,
    folder_id VARCHAR(255) NOT NULL,
    subject TEXT,
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    recipients JSONB DEFAULT '[]',
    cc_recipients JSONB DEFAULT '[]',
    bcc_recipients JSONB DEFAULT '[]',
    body TEXT,
    body_preview VARCHAR(500),
    is_html BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    is_draft BOOLEAN DEFAULT FALSE,
    has_attachments BOOLEAN DEFAULT FALSE,
    attachments JSONB DEFAULT '[]',
    importance VARCHAR(20) DEFAULT 'normal',
    received_date TIMESTAMPTZ,
    sent_date TIMESTAMPTZ,
    conversation_id VARCHAR(255),
    cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    sync_status VARCHAR(20) DEFAULT 'synced'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_folder ON cached_emails(folder_id);
CREATE INDEX IF NOT EXISTS idx_emails_received ON cached_emails(received_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON cached_emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_sync ON cached_emails(sync_status);
CREATE INDEX IF NOT EXISTS idx_emails_search ON cached_emails USING GIN(to_tsvector('english', subject || ' ' || COALESCE(body, '')));

-- ======================
-- CACHED FOLDERS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS cached_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    folder_type VARCHAR(50),
    parent_folder_id VARCHAR(255),
    unread_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_folders_type ON cached_folders(folder_type);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON cached_folders(parent_folder_id);

-- ======================
-- CACHED CALENDAR EVENTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS cached_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id VARCHAR(255) UNIQUE NOT NULL,
    calendar_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    description_format VARCHAR(20) DEFAULT 'plain',
    location VARCHAR(500),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    is_in_person BOOLEAN DEFAULT TRUE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    organizer_name VARCHAR(255),
    organizer_email VARCHAR(255),
    attendees JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'confirmed',
    reminder_minutes INTEGER,
    is_private BOOLEAN DEFAULT FALSE,
    categories JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    sync_status VARCHAR(20) DEFAULT 'synced'
);

-- description_format: 'plain' for plain text, 'xaml' for WPF FlowDocument XAML, 'html' for HTML
-- images: Array of {id, file_name, url, thumbnail_url, mime_type}
-- attachments: Array of {id, file_name, file_size, url, mime_type}

CREATE INDEX IF NOT EXISTS idx_events_calendar ON cached_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON cached_events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end ON cached_events(end_time);
CREATE INDEX IF NOT EXISTS idx_events_sync ON cached_events(sync_status);

-- ======================
-- CACHED CONTACTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS cached_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email_addresses JSONB DEFAULT '[]',
    phone_numbers JSONB DEFAULT '[]',
    company VARCHAR(255),
    job_title VARCHAR(255),
    department VARCHAR(255),
    notes TEXT,
    photo_url VARCHAR(500),
    cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    sync_status VARCHAR(20) DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON cached_contacts(display_name);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON cached_contacts USING GIN(email_addresses);
CREATE INDEX IF NOT EXISTS idx_contacts_sync ON cached_contacts(sync_status);

-- ======================
-- SYNC QUEUE TABLE
-- ======================
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    status VARCHAR(20) DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_created ON sync_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_entity ON sync_queue(entity_type, entity_id);

-- ======================
-- SYNC STATE TABLE
-- ======================
CREATE TABLE IF NOT EXISTS sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) UNIQUE NOT NULL,
    last_sync_token VARCHAR(500),
    last_sync_time TIMESTAMPTZ,
    full_sync_required BOOLEAN DEFAULT TRUE
);

-- Insert default sync states
INSERT INTO sync_state (entity_type, full_sync_required)
VALUES
    ('emails', TRUE),
    ('folders', TRUE),
    ('events', TRUE),
    ('contacts', TRUE)
ON CONFLICT (entity_type) DO NOTHING;

-- ======================
-- VERIFICATION QUERIES
-- ======================
SELECT 'Schema creation complete!' AS status;

-- Show created tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Show index count per table
SELECT
    tablename,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Show sync states
SELECT entity_type, full_sync_required FROM sync_state ORDER BY entity_type;
