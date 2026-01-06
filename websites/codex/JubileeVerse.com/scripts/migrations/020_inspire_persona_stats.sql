-- ============================================
-- JubileeVerse Database Schema
-- Migration 020: Inspire Persona Stats Tracking
-- ============================================
-- Track response counts for the 12 Inspire family personas
-- These personas are stored in YAML/Qdrant, not the personas table

-- Create inspire_persona_stats table
CREATE TABLE IF NOT EXISTS inspire_persona_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_slug VARCHAR(50) NOT NULL UNIQUE,
    persona_name VARCHAR(100) NOT NULL,
    response_count BIGINT DEFAULT 0,
    tokens_used BIGINT DEFAULT 0,
    last_response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the 12 Inspire family personas
INSERT INTO inspire_persona_stats (persona_slug, persona_name) VALUES
    ('jubilee', 'Jubilee Inspire'),
    ('melody', 'Melody Inspire'),
    ('zariah', 'Zariah Inspire'),
    ('eliana', 'Eliana Inspire'),
    ('imani', 'Imani Inspire'),
    ('nova', 'Nova Inspire'),
    ('elias', 'Elias Inspire'),
    ('caleb', 'Caleb Inspire'),
    ('zev', 'Zev Inspire'),
    ('amir', 'Amir Inspire'),
    ('santiago', 'Santiago Inspire'),
    ('tahoma', 'Tahoma Inspire')
ON CONFLICT (persona_slug) DO NOTHING;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_inspire_persona_stats_slug ON inspire_persona_stats(persona_slug);

-- Updated_at trigger
CREATE TRIGGER update_inspire_persona_stats_updated_at
    BEFORE UPDATE ON inspire_persona_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment persona response count
CREATE OR REPLACE FUNCTION increment_inspire_persona_response(
    p_persona_slug VARCHAR(50),
    p_tokens INT DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    UPDATE inspire_persona_stats
    SET
        response_count = response_count + 1,
        tokens_used = tokens_used + COALESCE(p_tokens, 0),
        last_response_at = NOW(),
        updated_at = NOW()
    WHERE persona_slug = p_persona_slug;
END;
$$ LANGUAGE plpgsql;
