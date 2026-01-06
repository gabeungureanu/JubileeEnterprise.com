-- ============================================
-- JubileeVerse Database Schema
-- Migration 009: Discussion Boards and Communities
-- ============================================

-- Discussion Boards (shared conversation spaces)
CREATE TABLE IF NOT EXISTS discussion_boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Board identity
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    -- Default persona for this board
    default_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Board type and settings
    board_type VARCHAR(50) DEFAULT 'community' CHECK (board_type IN ('community', 'private', 'moderated')),
    is_active BOOLEAN DEFAULT TRUE,

    -- Visual settings
    icon_url VARCHAR(500),
    banner_url VARCHAR(500),
    theme_color VARCHAR(20) DEFAULT '#ffbd59',

    -- Access settings
    requires_membership BOOLEAN DEFAULT FALSE,
    min_membership_level VARCHAR(50),

    -- Statistics
    member_count INT DEFAULT 0,
    post_count INT DEFAULT 0,
    last_activity_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Board membership
CREATE TABLE IF NOT EXISTS board_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES discussion_boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role in this board
    role VARCHAR(30) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),

    -- Notification preferences
    notify_new_posts BOOLEAN DEFAULT TRUE,
    notify_replies BOOLEAN DEFAULT TRUE,

    -- Status
    is_muted BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,

    -- Timestamps
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,

    UNIQUE(board_id, user_id)
);

-- Board conversations (shared discussions)
CREATE TABLE IF NOT EXISTS board_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES discussion_boards(id) ON DELETE CASCADE,

    -- Original author
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Topic information
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Persona used for AI responses
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Status and moderation
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'pinned', 'locked', 'hidden', 'deleted')),
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,

    -- Statistics
    view_count INT DEFAULT 0,
    reply_count INT DEFAULT 0,
    participant_count INT DEFAULT 1,
    last_reply_at TIMESTAMPTZ,
    last_reply_user_id UUID REFERENCES users(id),

    -- AI engagement tracking
    ai_response_count INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Board messages (posts in board conversations)
CREATE TABLE IF NOT EXISTS board_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_conversation_id UUID NOT NULL REFERENCES board_conversations(id) ON DELETE CASCADE,

    -- Author (user or AI persona)
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    is_ai_response BOOLEAN DEFAULT FALSE,

    -- Message content
    content TEXT NOT NULL,

    -- Reply threading
    parent_message_id UUID REFERENCES board_messages(id) ON DELETE SET NULL,
    reply_depth INT DEFAULT 0,

    -- Moderation
    status VARCHAR(30) DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'flagged', 'deleted')),
    flagged_reason TEXT,
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMPTZ,

    -- Engagement
    like_count INT DEFAULT 0,

    -- AI metadata
    model_used VARCHAR(100),
    token_count INT,
    bible_references JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message likes
CREATE TABLE IF NOT EXISTS board_message_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES board_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Insert default discussion boards with persona mappings
INSERT INTO discussion_boards (id, name, slug, description, board_type, theme_color) VALUES
    ('d0000001-0000-0000-0000-000000000001', 'Kingdom Builder', 'kingdom-builder',
     'Faith-based business strategies and entrepreneurship discussions with Elias Inspire',
     'community', '#4A90D9'),
    ('d0000002-0000-0000-0000-000000000002', 'Creative Fire', 'creative-fire',
     'Worship arts, creative expression, and artistic ministry with Santiago Inspire',
     'community', '#FF6B35'),
    ('d0000003-0000-0000-0000-000000000003', 'Gospel Pulse', 'gospel-pulse',
     'Evangelism, outreach, and spreading the Good News with Jubilee Inspire',
     'community', '#FFD700'),
    ('d0000004-0000-0000-0000-000000000004', 'Shepherd''s Voice', 'shepherds-voice',
     'Pastoral care, counseling, and spiritual guidance with Caleb Inspire',
     'community', '#2E8B57'),
    ('d0000005-0000-0000-0000-000000000005', 'Hebraic Roots', 'hebraic-roots',
     'Jewish traditions, Hebrew language, and biblical heritage with Zev Inspire',
     'community', '#8B4513')
ON CONFLICT (slug) DO NOTHING;

-- Indexes for discussion boards
CREATE INDEX IF NOT EXISTS idx_discussion_boards_slug ON discussion_boards(slug);
CREATE INDEX IF NOT EXISTS idx_discussion_boards_active ON discussion_boards(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_discussion_boards_type ON discussion_boards(board_type);

-- Indexes for memberships
CREATE INDEX IF NOT EXISTS idx_board_memberships_board ON board_memberships(board_id);
CREATE INDEX IF NOT EXISTS idx_board_memberships_user ON board_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_board_memberships_role ON board_memberships(role);

-- Indexes for board conversations
CREATE INDEX IF NOT EXISTS idx_board_conversations_board ON board_conversations(board_id);
CREATE INDEX IF NOT EXISTS idx_board_conversations_author ON board_conversations(author_id);
CREATE INDEX IF NOT EXISTS idx_board_conversations_status ON board_conversations(status);
CREATE INDEX IF NOT EXISTS idx_board_conversations_pinned ON board_conversations(board_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_board_conversations_last_reply ON board_conversations(last_reply_at DESC NULLS LAST);

-- Indexes for board messages
CREATE INDEX IF NOT EXISTS idx_board_messages_conversation ON board_messages(board_conversation_id);
CREATE INDEX IF NOT EXISTS idx_board_messages_author ON board_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_board_messages_parent ON board_messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_board_messages_created ON board_messages(created_at DESC);

-- Full-text search for board messages
CREATE INDEX IF NOT EXISTS idx_board_messages_content_search ON board_messages USING gin (to_tsvector('english', content));

-- Apply updated_at triggers
CREATE TRIGGER update_discussion_boards_updated_at
    BEFORE UPDATE ON discussion_boards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_conversations_updated_at
    BEFORE UPDATE ON board_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_messages_updated_at
    BEFORE UPDATE ON board_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update board stats
CREATE OR REPLACE FUNCTION update_board_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update conversation stats
    UPDATE board_conversations
    SET
        reply_count = (
            SELECT COUNT(*) FROM board_messages
            WHERE board_conversation_id = NEW.board_conversation_id
            AND status = 'visible'
        ) - 1, -- Subtract 1 for the original post
        last_reply_at = NOW(),
        last_reply_user_id = NEW.author_id,
        ai_response_count = (
            SELECT COUNT(*) FROM board_messages
            WHERE board_conversation_id = NEW.board_conversation_id
            AND is_ai_response = TRUE
        ),
        updated_at = NOW()
    WHERE id = NEW.board_conversation_id;

    -- Update board stats
    UPDATE discussion_boards
    SET
        post_count = (
            SELECT COUNT(*) FROM board_messages bm
            JOIN board_conversations bc ON bm.board_conversation_id = bc.id
            WHERE bc.board_id = (SELECT board_id FROM board_conversations WHERE id = NEW.board_conversation_id)
            AND bm.status = 'visible'
        ),
        last_activity_at = NOW(),
        updated_at = NOW()
    WHERE id = (SELECT board_id FROM board_conversations WHERE id = NEW.board_conversation_id);

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_board_on_message
    AFTER INSERT ON board_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_board_stats();

-- Function to update like counts
CREATE OR REPLACE FUNCTION update_message_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE board_messages SET like_count = like_count + 1 WHERE id = NEW.message_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE board_messages SET like_count = like_count - 1 WHERE id = OLD.message_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_like_count_trigger
    AFTER INSERT OR DELETE ON board_message_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_message_like_count();
