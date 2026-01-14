-- Migration: 0003_jubilee_outlook_schema
-- Database: continuum
-- Author: Jubilee Solutions
-- Date: 2026-01-14
-- Description: JubileeOutlook schema - Calendar events, email messages, contacts, and attachments

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- ============================================================================
-- CALENDARS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#0078D4',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    time_zone VARCHAR(100) DEFAULT 'UTC',
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    external_calendar_id VARCHAR(255),
    external_provider VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_calendars_user ON outlook_calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_calendars_default ON outlook_calendars(user_id, is_default) WHERE is_default = TRUE;

-- ============================================================================
-- CALENDAR EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES outlook_calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    subject VARCHAR(500) NOT NULL,
    location VARCHAR(500),
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    time_zone VARCHAR(100) DEFAULT 'UTC',
    status VARCHAR(20) NOT NULL DEFAULT 'free',
    category VARCHAR(50),
    event_color VARCHAR(7) DEFAULT '#5B9BD5',
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule TEXT,
    recurrence_parent_id UUID REFERENCES outlook_calendar_events(id) ON DELETE SET NULL,
    reminder_minutes INTEGER DEFAULT 15,
    organizer_id UUID,
    organizer_email VARCHAR(255),
    organizer_name VARCHAR(200),
    external_event_id VARCHAR(255),
    external_provider VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_times CHECK (end_time > start_time OR is_all_day = TRUE)
);

CREATE INDEX IF NOT EXISTS idx_outlook_events_calendar ON outlook_calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_outlook_events_user ON outlook_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_events_start ON outlook_calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_outlook_events_end ON outlook_calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_outlook_events_date_range ON outlook_calendar_events(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_outlook_events_recurring ON outlook_calendar_events(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

-- ============================================================================
-- EVENT ATTENDEES
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES outlook_calendar_events(id) ON DELETE CASCADE,
    attendee_email VARCHAR(255) NOT NULL,
    attendee_name VARCHAR(200),
    attendee_user_id UUID,
    response_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_organizer BOOLEAN NOT NULL DEFAULT FALSE,
    response_time TIMESTAMPTZ,
    response_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, attendee_email)
);

CREATE INDEX IF NOT EXISTS idx_outlook_attendees_event ON outlook_event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_outlook_attendees_email ON outlook_event_attendees(attendee_email);
CREATE INDEX IF NOT EXISTS idx_outlook_attendees_user ON outlook_event_attendees(attendee_user_id) WHERE attendee_user_id IS NOT NULL;

-- ============================================================================
-- EVENT ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_event_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES outlook_calendar_events(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100),
    storage_key VARCHAR(500),
    storage_provider VARCHAR(50) DEFAULT 'local',
    checksum VARCHAR(64),
    is_inline BOOLEAN NOT NULL DEFAULT FALSE,
    added_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_event_attachments_event ON outlook_event_attachments(event_id);

-- ============================================================================
-- EMAIL FOLDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_email_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    parent_folder_id UUID REFERENCES outlook_email_folders(id) ON DELETE CASCADE,
    folder_type VARCHAR(30) NOT NULL DEFAULT 'custom',
    unread_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    icon VARCHAR(50),
    color VARCHAR(7),
    external_folder_id VARCHAR(255),
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_folders_user ON outlook_email_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_folders_parent ON outlook_email_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_outlook_folders_type ON outlook_email_folders(user_id, folder_type);

-- ============================================================================
-- EMAIL MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID NOT NULL REFERENCES outlook_email_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conversation_id UUID,
    subject VARCHAR(1000),
    body_preview VARCHAR(500),
    body_text TEXT,
    body_html TEXT,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(200),
    sender_user_id UUID,
    reply_to_email VARCHAR(255),
    reply_to_name VARCHAR(200),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
    is_sent BOOLEAN NOT NULL DEFAULT FALSE,
    importance VARCHAR(20) NOT NULL DEFAULT 'normal',
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    in_reply_to_message_id UUID REFERENCES outlook_email_messages(id) ON DELETE SET NULL,
    external_message_id VARCHAR(255),
    internet_message_id VARCHAR(500),
    headers JSONB DEFAULT '{}',
    categories JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_messages_folder ON outlook_email_messages(folder_id);
CREATE INDEX IF NOT EXISTS idx_outlook_messages_user ON outlook_email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_messages_conversation ON outlook_email_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_outlook_messages_sender ON outlook_email_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_outlook_messages_received ON outlook_email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_outlook_messages_unread ON outlook_email_messages(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_outlook_messages_flagged ON outlook_email_messages(user_id, is_flagged) WHERE is_flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_outlook_messages_draft ON outlook_email_messages(user_id, is_draft) WHERE is_draft = TRUE;

-- Full text search on email subject and body
ALTER TABLE outlook_email_messages ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
CREATE INDEX IF NOT EXISTS idx_outlook_messages_search ON outlook_email_messages USING GIN(search_vector);

-- ============================================================================
-- EMAIL RECIPIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_email_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES outlook_email_messages(id) ON DELETE CASCADE,
    recipient_type VARCHAR(10) NOT NULL DEFAULT 'to',
    email VARCHAR(255) NOT NULL,
    name VARCHAR(200),
    recipient_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recipient_type CHECK (recipient_type IN ('to', 'cc', 'bcc'))
);

CREATE INDEX IF NOT EXISTS idx_outlook_recipients_message ON outlook_email_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_outlook_recipients_email ON outlook_email_recipients(email);

-- ============================================================================
-- EMAIL ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES outlook_email_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100),
    content_id VARCHAR(255),
    storage_key VARCHAR(500),
    storage_provider VARCHAR(50) DEFAULT 'local',
    checksum VARCHAR(64),
    is_inline BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_email_attachments_message ON outlook_email_attachments(message_id);

-- ============================================================================
-- CONTACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    display_name VARCHAR(300) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    nickname VARCHAR(100),
    title VARCHAR(50),
    suffix VARCHAR(20),
    company_name VARCHAR(200),
    department VARCHAR(200),
    job_title VARCHAR(200),
    notes TEXT,
    birthday DATE,
    anniversary DATE,
    photo_url VARCHAR(500),
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    external_contact_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_contacts_user ON outlook_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_contacts_name ON outlook_contacts(user_id, display_name);
CREATE INDEX IF NOT EXISTS idx_outlook_contacts_favorite ON outlook_contacts(user_id, is_favorite) WHERE is_favorite = TRUE;

-- ============================================================================
-- CONTACT EMAIL ADDRESSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_contact_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES outlook_contacts(id) ON DELETE CASCADE,
    email CITEXT NOT NULL,
    email_type VARCHAR(20) NOT NULL DEFAULT 'personal',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contact_id, email)
);

CREATE INDEX IF NOT EXISTS idx_outlook_contact_emails_contact ON outlook_contact_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_outlook_contact_emails_email ON outlook_contact_emails(email);

-- ============================================================================
-- CONTACT PHONE NUMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_contact_phones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES outlook_contacts(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    phone_type VARCHAR(20) NOT NULL DEFAULT 'mobile',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_contact_phones_contact ON outlook_contact_phones(contact_id);

-- ============================================================================
-- CONTACT ADDRESSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_contact_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES outlook_contacts(id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL DEFAULT 'home',
    street VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_contact_addresses_contact ON outlook_contact_addresses(contact_id);

-- ============================================================================
-- CONTACT GROUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_contact_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_outlook_contact_groups_user ON outlook_contact_groups(user_id);

CREATE TABLE IF NOT EXISTS outlook_contact_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES outlook_contact_groups(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES outlook_contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_outlook_group_members_group ON outlook_contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_outlook_group_members_contact ON outlook_contact_group_members(contact_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_outlook_calendars_updated_at ON outlook_calendars;
CREATE TRIGGER update_outlook_calendars_updated_at
    BEFORE UPDATE ON outlook_calendars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlook_events_updated_at ON outlook_calendar_events;
CREATE TRIGGER update_outlook_events_updated_at
    BEFORE UPDATE ON outlook_calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlook_attendees_updated_at ON outlook_event_attendees;
CREATE TRIGGER update_outlook_attendees_updated_at
    BEFORE UPDATE ON outlook_event_attendees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlook_folders_updated_at ON outlook_email_folders;
CREATE TRIGGER update_outlook_folders_updated_at
    BEFORE UPDATE ON outlook_email_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlook_messages_updated_at ON outlook_email_messages;
CREATE TRIGGER update_outlook_messages_updated_at
    BEFORE UPDATE ON outlook_email_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlook_contacts_updated_at ON outlook_contacts;
CREATE TRIGGER update_outlook_contacts_updated_at
    BEFORE UPDATE ON outlook_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlook_contact_groups_updated_at ON outlook_contact_groups;
CREATE TRIGGER update_outlook_contact_groups_updated_at
    BEFORE UPDATE ON outlook_contact_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FOLDER COUNT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_outlook_folder_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE outlook_email_folders
        SET total_count = total_count + 1,
            unread_count = unread_count + CASE WHEN NEW.is_read = FALSE THEN 1 ELSE 0 END
        WHERE id = NEW.folder_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE outlook_email_folders
        SET total_count = total_count - 1,
            unread_count = unread_count - CASE WHEN OLD.is_read = FALSE THEN 1 ELSE 0 END
        WHERE id = OLD.folder_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.folder_id != NEW.folder_id THEN
            UPDATE outlook_email_folders
            SET total_count = total_count - 1,
                unread_count = unread_count - CASE WHEN OLD.is_read = FALSE THEN 1 ELSE 0 END
            WHERE id = OLD.folder_id;
            UPDATE outlook_email_folders
            SET total_count = total_count + 1,
                unread_count = unread_count + CASE WHEN NEW.is_read = FALSE THEN 1 ELSE 0 END
            WHERE id = NEW.folder_id;
        ELSIF OLD.is_read != NEW.is_read THEN
            UPDATE outlook_email_folders
            SET unread_count = unread_count + CASE WHEN NEW.is_read = FALSE THEN 1 ELSE -1 END
            WHERE id = NEW.folder_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_folder_counts_on_message ON outlook_email_messages;
CREATE TRIGGER update_folder_counts_on_message
    AFTER INSERT OR UPDATE OR DELETE ON outlook_email_messages
    FOR EACH ROW EXECUTE FUNCTION update_outlook_folder_counts();

-- ============================================================================
-- FULL TEXT SEARCH TRIGGER FOR EMAILS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_outlook_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body_text, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.sender_name, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.sender_email, '')), 'C');
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_message_search_vector ON outlook_email_messages;
CREATE TRIGGER update_message_search_vector
    BEFORE INSERT OR UPDATE ON outlook_email_messages
    FOR EACH ROW EXECUTE FUNCTION update_outlook_message_search_vector();

COMMIT;

-- ============================================================================
-- DOWN MIGRATION (for rollback)
-- ============================================================================
-- To rollback this migration, run the following commands:
--
-- BEGIN;
-- DROP TABLE IF EXISTS outlook_contact_group_members CASCADE;
-- DROP TABLE IF EXISTS outlook_contact_groups CASCADE;
-- DROP TABLE IF EXISTS outlook_contact_addresses CASCADE;
-- DROP TABLE IF EXISTS outlook_contact_phones CASCADE;
-- DROP TABLE IF EXISTS outlook_contact_emails CASCADE;
-- DROP TABLE IF EXISTS outlook_contacts CASCADE;
-- DROP TABLE IF EXISTS outlook_email_attachments CASCADE;
-- DROP TABLE IF EXISTS outlook_email_recipients CASCADE;
-- DROP TABLE IF EXISTS outlook_email_messages CASCADE;
-- DROP TABLE IF EXISTS outlook_email_folders CASCADE;
-- DROP TABLE IF EXISTS outlook_event_attachments CASCADE;
-- DROP TABLE IF EXISTS outlook_event_attendees CASCADE;
-- DROP TABLE IF EXISTS outlook_calendar_events CASCADE;
-- DROP TABLE IF EXISTS outlook_calendars CASCADE;
-- DROP FUNCTION IF EXISTS update_outlook_folder_counts();
-- DROP FUNCTION IF EXISTS update_outlook_message_search_vector();
-- COMMIT;
