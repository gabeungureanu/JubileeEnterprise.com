-- =============================================================================
-- Migration: 0010_contact_groups.sql
-- Description: Create contact groups tables for organizing contacts into
--              named groups (e.g., "Family", "Colleagues", "VIP").
-- =============================================================================

-- Contact groups table
CREATE TABLE IF NOT EXISTS contact_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for group membership
CREATE TABLE IF NOT EXISTS contact_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (group_id, contact_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_contact_groups_user ON contact_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_group ON contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact ON contact_group_members(contact_id);
