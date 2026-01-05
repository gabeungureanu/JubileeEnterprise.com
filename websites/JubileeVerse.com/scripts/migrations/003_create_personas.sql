-- ============================================
-- JubileeVerse Database Schema
-- Migration 003: Personas and Categories
-- ============================================

-- Persona categories
CREATE TABLE IF NOT EXISTS persona_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personas (AI characters)
CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(200),
    category_id UUID REFERENCES persona_categories(id) ON DELETE SET NULL,
    avatar_url VARCHAR(500),
    short_bio TEXT,
    full_bio TEXT,

    -- AI Configuration
    system_prompt TEXT NOT NULL,
    personality_traits JSONB DEFAULT '[]',
    expertise_areas JSONB DEFAULT '[]',
    speaking_style TEXT,

    -- Conversation starters
    greeting_message TEXT,
    conversation_starters JSONB DEFAULT '[]',

    -- Language support
    primary_language VARCHAR(10) DEFAULT 'en',
    supported_languages JSONB DEFAULT '["en"]',

    -- Metadata
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    rating_count INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Persona specialties (many-to-many with tags)
CREATE TABLE IF NOT EXISTS persona_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS persona_tag_assignments (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES persona_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (persona_id, tag_id)
);

-- User favorite personas
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, persona_id)
);

-- Persona ratings
CREATE TABLE IF NOT EXISTS persona_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, persona_id)
);

-- Indexes for personas
CREATE INDEX IF NOT EXISTS idx_personas_slug ON personas(slug);
CREATE INDEX IF NOT EXISTS idx_personas_category ON personas(category_id);
CREATE INDEX IF NOT EXISTS idx_personas_featured ON personas(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_personas_active ON personas(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_personas_usage ON personas(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_personas_rating ON personas(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_personas_name_trgm ON personas USING gin (name gin_trgm_ops);

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_persona_categories_slug ON persona_categories(slug);
CREATE INDEX IF NOT EXISTS idx_persona_categories_order ON persona_categories(display_order);

-- Indexes for favorites
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_persona ON user_favorites(persona_id);

-- Indexes for ratings
CREATE INDEX IF NOT EXISTS idx_persona_ratings_persona ON persona_ratings(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_ratings_user ON persona_ratings(user_id);

-- Apply updated_at triggers
CREATE TRIGGER update_persona_categories_updated_at
    BEFORE UPDATE ON persona_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personas_updated_at
    BEFORE UPDATE ON personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_persona_ratings_updated_at
    BEFORE UPDATE ON persona_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update persona rating average
CREATE OR REPLACE FUNCTION update_persona_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE personas
    SET
        average_rating = (
            SELECT COALESCE(AVG(rating), 0)
            FROM persona_ratings
            WHERE persona_id = COALESCE(NEW.persona_id, OLD.persona_id)
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM persona_ratings
            WHERE persona_id = COALESCE(NEW.persona_id, OLD.persona_id)
        )
    WHERE id = COALESCE(NEW.persona_id, OLD.persona_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_persona_rating_on_insert
    AFTER INSERT ON persona_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_persona_rating_stats();

CREATE TRIGGER update_persona_rating_on_update
    AFTER UPDATE ON persona_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_persona_rating_stats();

CREATE TRIGGER update_persona_rating_on_delete
    AFTER DELETE ON persona_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_persona_rating_stats();
