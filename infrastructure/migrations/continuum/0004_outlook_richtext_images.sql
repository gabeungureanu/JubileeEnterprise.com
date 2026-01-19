-- Migration: 0004_outlook_richtext_images
-- Database: continuum
-- Author: Jubilee Solutions
-- Date: 2026-01-19
-- Description: Add rich text (XAML) support for event descriptions and event images table

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- ============================================================================
-- MODIFY CALENDAR EVENTS FOR RICH TEXT SUPPORT
-- ============================================================================

-- Add column to indicate if description is in rich text (XAML) format
-- This allows backwards compatibility with plain text descriptions
ALTER TABLE outlook_calendar_events
ADD COLUMN IF NOT EXISTS description_format VARCHAR(20) DEFAULT 'plain';

-- Add comment explaining the format values
COMMENT ON COLUMN outlook_calendar_events.description_format IS
'Format of the description field: "plain" for plain text, "xaml" for WPF FlowDocument XAML, "html" for HTML';

-- Add column for meeting type (in-person vs virtual)
ALTER TABLE outlook_calendar_events
ADD COLUMN IF NOT EXISTS is_in_person BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN outlook_calendar_events.is_in_person IS
'Whether this is an in-person event (TRUE) or virtual/online meeting (FALSE)';

-- ============================================================================
-- EVENT IMAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlook_event_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES outlook_calendar_events(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'image/jpeg',
    width INTEGER,
    height INTEGER,
    storage_key VARCHAR(500),
    storage_provider VARCHAR(50) DEFAULT 'local',
    url VARCHAR(1000),
    thumbnail_url VARCHAR(1000),
    checksum VARCHAR(64),
    display_order INTEGER DEFAULT 0,
    added_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlook_event_images_event ON outlook_event_images(event_id);
CREATE INDEX IF NOT EXISTS idx_outlook_event_images_order ON outlook_event_images(event_id, display_order);

COMMENT ON TABLE outlook_event_images IS
'Images attached to calendar events for visual reference';

-- ============================================================================
-- UPDATE EVENT ATTACHMENTS TABLE
-- ============================================================================

-- Add URL column for cloud-stored attachments
ALTER TABLE outlook_event_attachments
ADD COLUMN IF NOT EXISTS url VARCHAR(1000);

COMMENT ON COLUMN outlook_event_attachments.url IS
'Public URL of the attachment when stored in cloud storage';

-- ============================================================================
-- SAMPLE DATA UPDATES (for existing test data)
-- ============================================================================

-- Update any existing events to have the default description format
UPDATE outlook_calendar_events
SET description_format = 'plain'
WHERE description_format IS NULL;

-- Update any existing events to have is_in_person set
UPDATE outlook_calendar_events
SET is_in_person = TRUE
WHERE is_in_person IS NULL;

-- ============================================================================
-- CREATE VIEW FOR EVENT DETAILS WITH IMAGES
-- ============================================================================

CREATE OR REPLACE VIEW outlook_event_details AS
SELECT
    e.*,
    c.name AS calendar_name,
    c.color AS calendar_color,
    c.time_zone AS calendar_timezone,
    (SELECT COUNT(*) FROM outlook_event_attendees WHERE event_id = e.id) AS attendee_count,
    (SELECT COUNT(*) FROM outlook_event_attachments WHERE event_id = e.id) AS attachment_count,
    (SELECT COUNT(*) FROM outlook_event_images WHERE event_id = e.id) AS image_count,
    (SELECT json_agg(json_build_object(
        'id', i.id,
        'file_name', i.file_name,
        'url', i.url,
        'thumbnail_url', i.thumbnail_url,
        'mime_type', i.mime_type
    ) ORDER BY i.display_order)
    FROM outlook_event_images i WHERE i.event_id = e.id) AS images,
    (SELECT json_agg(json_build_object(
        'id', a.id,
        'file_name', a.file_name,
        'file_size', a.file_size,
        'url', a.url,
        'mime_type', a.mime_type
    ))
    FROM outlook_event_attachments a WHERE a.event_id = e.id) AS attachments
FROM outlook_calendar_events e
JOIN outlook_calendars c ON e.calendar_id = c.id;

COMMENT ON VIEW outlook_event_details IS
'Comprehensive view of calendar events with related images and attachments';

COMMIT;

-- ============================================================================
-- DOWN MIGRATION (for rollback)
-- ============================================================================
-- To rollback this migration, run the following commands:
--
-- BEGIN;
-- DROP VIEW IF EXISTS outlook_event_details;
-- DROP TABLE IF EXISTS outlook_event_images CASCADE;
-- ALTER TABLE outlook_calendar_events DROP COLUMN IF EXISTS description_format;
-- ALTER TABLE outlook_calendar_events DROP COLUMN IF EXISTS is_in_person;
-- ALTER TABLE outlook_event_attachments DROP COLUMN IF EXISTS url;
-- COMMIT;
