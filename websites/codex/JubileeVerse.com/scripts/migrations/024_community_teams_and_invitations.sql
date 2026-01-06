-- ============================================
-- JubileeVerse Database Schema
-- Migration 024: Community Teams and Invitations
-- ============================================
-- This adds support for community teams and email invitations
-- Users can belong to infinite communities
-- Users can create communities and invite others by email
-- Users can receive invitations from other JubileeVerse users

-- Add description and image_url to communities if not exists
ALTER TABLE communities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Community Teams table
CREATE TABLE IF NOT EXISTS community_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'team',  -- Icon identifier (pastoral, outreach, worship, team)
    color VARCHAR(7) DEFAULT '#4a90a4',  -- Hex color for team badge
    sort_order INT DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,  -- Marks default teams created with community
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique team names within a community
    UNIQUE(community_id, name)
);

-- Team Members table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES community_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) DEFAULT 'member' CHECK (role IN ('leader', 'co-leader', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Ensure a user can only be in a team once
    UNIQUE(team_id, user_id)
);

-- Community Invitations table
CREATE TABLE IF NOT EXISTS community_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Invitee can be an existing user or just an email
    invitee_email VARCHAR(255) NOT NULL,
    invitee_user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- Set if user exists in system

    -- Invitation details
    message TEXT,  -- Optional personal message from inviter
    role VARCHAR(30) DEFAULT 'member' CHECK (role IN ('admin', 'member')),  -- Role to assign on accept

    -- Invitation token for email links
    token VARCHAR(255) NOT NULL UNIQUE,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    responded_at TIMESTAMPTZ,

    -- Prevent duplicate pending invitations
    UNIQUE(community_id, invitee_email, status)
);

-- Indexes for community_teams
CREATE INDEX IF NOT EXISTS idx_community_teams_community ON community_teams(community_id);
CREATE INDEX IF NOT EXISTS idx_community_teams_created_by ON community_teams(created_by);
CREATE INDEX IF NOT EXISTS idx_community_teams_sort ON community_teams(community_id, sort_order);

-- Indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Indexes for community_invitations
CREATE INDEX IF NOT EXISTS idx_community_invitations_community ON community_invitations(community_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_inviter ON community_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_invitee_email ON community_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_community_invitations_invitee_user ON community_invitations(invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_token ON community_invitations(token);
CREATE INDEX IF NOT EXISTS idx_community_invitations_status ON community_invitations(status);
CREATE INDEX IF NOT EXISTS idx_community_invitations_pending ON community_invitations(invitee_email, status) WHERE status = 'pending';

-- Apply updated_at trigger to community_teams
CREATE TRIGGER update_community_teams_updated_at
    BEFORE UPDATE ON community_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create default teams when a community is created
CREATE OR REPLACE FUNCTION create_default_community_teams()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create default teams for non-global communities
    IF NOT NEW.is_global THEN
        -- Create Pastoral Team
        INSERT INTO community_teams (community_id, name, description, icon, color, sort_order, is_default, created_by)
        VALUES (NEW.id, 'Pastoral Team', 'Church leadership and pastoral care', 'pastoral', '#6b8e4e', 1, TRUE, NEW.owner_id);

        -- Create Outreach Team
        INSERT INTO community_teams (community_id, name, description, icon, color, sort_order, is_default, created_by)
        VALUES (NEW.id, 'Outreach Team', 'Community outreach and evangelism', 'outreach', '#d4a574', 2, TRUE, NEW.owner_id);

        -- Create Worship Team
        INSERT INTO community_teams (community_id, name, description, icon, color, sort_order, is_default, created_by)
        VALUES (NEW.id, 'Worship Team', 'Worship and music ministry', 'worship', '#7a9cba', 3, TRUE, NEW.owner_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create default teams for new communities
DROP TRIGGER IF EXISTS create_default_teams_on_community ON communities;
CREATE TRIGGER create_default_teams_on_community
    AFTER INSERT ON communities
    FOR EACH ROW
    EXECUTE FUNCTION create_default_community_teams();

-- Function to auto-create a personal community for new users
CREATE OR REPLACE FUNCTION create_user_default_community()
RETURNS TRIGGER AS $$
DECLARE
    community_name VARCHAR(120);
    community_slug VARCHAR(120);
    new_community_id UUID;
BEGIN
    -- Build community name from user's display name
    community_name := COALESCE(
        SPLIT_PART(NEW.display_name, ' ', 1),
        SPLIT_PART(NEW.email, '@', 1)
    ) || '''s Community';

    -- Create a unique slug
    community_slug := LOWER(REGEXP_REPLACE(
        COALESCE(SPLIT_PART(NEW.display_name, ' ', 1), SPLIT_PART(NEW.email, '@', 1)) || '-community-' || SUBSTRING(NEW.id::TEXT, 1, 8),
        '[^a-z0-9-]', '-', 'g'
    ));

    -- Create the personal community
    INSERT INTO communities (name, slug, description, owner_id, is_global)
    VALUES (community_name, community_slug, 'Your personal community', NEW.id, FALSE)
    RETURNING id INTO new_community_id;

    -- Add user as owner of their community
    INSERT INTO community_memberships (community_id, user_id, role)
    VALUES (new_community_id, NEW.id, 'owner');

    -- Also add user to global Jubilee Community
    INSERT INTO community_memberships (community_id, user_id, role)
    VALUES ('c0000000-0000-0000-0000-000000000001', NEW.id, 'member')
    ON CONFLICT (community_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create personal community for new users
DROP TRIGGER IF EXISTS create_default_community_on_user ON users;
CREATE TRIGGER create_default_community_on_user
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_default_community();

-- Function to check for and process pending invitations when a user registers
CREATE OR REPLACE FUNCTION process_pending_invitations_for_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Update any pending invitations with this email to link to the new user
    UPDATE community_invitations
    SET invitee_user_id = NEW.id
    WHERE LOWER(invitee_email) = LOWER(NEW.email)
    AND invitee_user_id IS NULL
    AND status = 'pending';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process pending invitations when user registers
DROP TRIGGER IF EXISTS process_invitations_on_user_create ON users;
CREATE TRIGGER process_invitations_on_user_create
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION process_pending_invitations_for_user();

-- Helper function to accept an invitation
CREATE OR REPLACE FUNCTION accept_community_invitation(invitation_token VARCHAR)
RETURNS TABLE(success BOOLEAN, community_id UUID, community_name VARCHAR, message TEXT) AS $$
DECLARE
    inv RECORD;
BEGIN
    -- Find and validate the invitation
    SELECT ci.*, c.name as comm_name
    INTO inv
    FROM community_invitations ci
    JOIN communities c ON c.id = ci.community_id
    WHERE ci.token = invitation_token;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, 'Invitation not found'::TEXT;
        RETURN;
    END IF;

    IF inv.status != 'pending' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, ('Invitation has already been ' || inv.status)::TEXT;
        RETURN;
    END IF;

    IF inv.expires_at < NOW() THEN
        UPDATE community_invitations SET status = 'expired' WHERE id = inv.id;
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, 'Invitation has expired'::TEXT;
        RETURN;
    END IF;

    IF inv.invitee_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, 'Please register an account first'::TEXT;
        RETURN;
    END IF;

    -- Add user to community
    INSERT INTO community_memberships (community_id, user_id, role)
    VALUES (inv.community_id, inv.invitee_user_id, inv.role)
    ON CONFLICT (community_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Mark invitation as accepted
    UPDATE community_invitations
    SET status = 'accepted', responded_at = NOW()
    WHERE id = inv.id;

    RETURN QUERY SELECT TRUE, inv.community_id, inv.comm_name::VARCHAR, ('Welcome to ' || inv.comm_name)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on helper functions
-- (adjust as needed based on your database user setup)

COMMENT ON TABLE community_teams IS 'Teams within a community (e.g., Pastoral, Outreach, Worship)';
COMMENT ON TABLE team_members IS 'Many-to-many relationship between teams and users';
COMMENT ON TABLE community_invitations IS 'Email invitations to join communities';
COMMENT ON COLUMN community_invitations.token IS 'Unique token for invitation link in emails';
COMMENT ON COLUMN community_teams.is_default IS 'TRUE for auto-created teams (Pastoral, Outreach, Worship)';
