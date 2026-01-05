-- ============================================
-- JubileeVerse Database Schema
-- Migration 011: Communities + Multi-Persona Chat
-- ============================================

-- Add persona attribution to messages
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_persona_id ON messages(persona_id);

-- Track persona participation in a conversation
CREATE TABLE IF NOT EXISTS conversation_personas (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_personas_persona ON conversation_personas(persona_id);
CREATE INDEX IF NOT EXISTS idx_conversation_personas_conversation ON conversation_personas(conversation_id);

-- Communities (global and personal)
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_global BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_community_memberships_user ON community_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_community ON community_memberships(community_id);

-- Attach community to board conversations
ALTER TABLE board_conversations
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_board_conversations_community ON board_conversations(community_id);

-- Seed global Jubilee community
INSERT INTO communities (id, name, slug, is_global)
VALUES ('c0000000-0000-0000-0000-000000000001', 'Jubilee Community', 'jubilee-community', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Ensure existing conversations are scoped to the global community by default
UPDATE board_conversations
SET community_id = 'c0000000-0000-0000-0000-000000000001'
WHERE community_id IS NULL;

-- Enroll all existing users into the global community
INSERT INTO community_memberships (community_id, user_id, role)
SELECT 'c0000000-0000-0000-0000-000000000001', u.id, 'member'
FROM users u
ON CONFLICT (community_id, user_id) DO NOTHING;

-- Apply updated_at trigger
CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
