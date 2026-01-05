-- ============================================
-- JubileeVerse Database Schema
-- Migration 010: Attachment Retention Policy
-- ============================================

-- Add expires_at column to message_attachments for retention policy
ALTER TABLE message_attachments
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add uploaded_by column to track who uploaded
ALTER TABLE message_attachments
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Set default expiration for existing attachments (30 days from creation)
UPDATE message_attachments
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_attachments_expires_at
ON message_attachments(expires_at)
WHERE expires_at IS NOT NULL;

-- Create index for storage stats
CREATE INDEX IF NOT EXISTS idx_attachments_created_at
ON message_attachments(created_at);

-- Function to get storage usage per user
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_id_param UUID)
RETURNS TABLE (
    total_attachments BIGINT,
    total_size BIGINT,
    active_attachments BIGINT,
    active_size BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_attachments,
        COALESCE(SUM(ma.file_size), 0)::BIGINT as total_size,
        COUNT(CASE WHEN ma.expires_at > NOW() OR ma.expires_at IS NULL THEN 1 END)::BIGINT as active_attachments,
        COALESCE(SUM(CASE WHEN ma.expires_at > NOW() OR ma.expires_at IS NULL THEN ma.file_size ELSE 0 END), 0)::BIGINT as active_size
    FROM message_attachments ma
    JOIN messages m ON ma.message_id = m.id
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;
