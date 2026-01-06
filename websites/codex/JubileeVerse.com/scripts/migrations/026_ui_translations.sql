-- ============================================
-- JubileeVerse Database Schema
-- Migration 026: UI String Translations
-- ============================================
-- This table stores translations for UI elements like placeholder text
-- that include persona names (which should be transliterated, not translated)

-- UI translations cache for interface strings
CREATE TABLE IF NOT EXISTS ui_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    string_key VARCHAR(100) NOT NULL,
    persona_slug VARCHAR(50),
    target_language VARCHAR(10) NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(string_key, persona_slug, target_language)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ui_translations_lookup
    ON ui_translations(string_key, persona_slug, target_language);

CREATE INDEX IF NOT EXISTS idx_ui_translations_language
    ON ui_translations(target_language);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ui_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ui_translations_updated_at ON ui_translations;
CREATE TRIGGER update_ui_translations_updated_at
    BEFORE UPDATE ON ui_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_ui_translations_updated_at();

-- Pre-populate English defaults (source strings)
INSERT INTO ui_translations (string_key, persona_slug, target_language, source_text, translated_text) VALUES
    ('search_placeholder', 'jubilee', 'en', 'Ask Jubilee Anything...', 'Ask Jubilee Anything...'),
    ('search_placeholder', 'melody', 'en', 'Ask Melody Anything...', 'Ask Melody Anything...'),
    ('search_placeholder', 'zariah', 'en', 'Ask Zariah Anything...', 'Ask Zariah Anything...'),
    ('search_placeholder', 'elias', 'en', 'Ask Elias Anything...', 'Ask Elias Anything...'),
    ('search_placeholder', 'eliana', 'en', 'Ask Eliana Anything...', 'Ask Eliana Anything...'),
    ('search_placeholder', 'caleb', 'en', 'Ask Caleb Anything...', 'Ask Caleb Anything...'),
    ('search_placeholder', 'imani', 'en', 'Ask Imani Anything...', 'Ask Imani Anything...'),
    ('search_placeholder', 'zev', 'en', 'Ask Zev Anything...', 'Ask Zev Anything...'),
    ('search_placeholder', 'amir', 'en', 'Ask Amir Anything...', 'Ask Amir Anything...'),
    ('search_placeholder', 'nova', 'en', 'Ask Nova Anything...', 'Ask Nova Anything...'),
    ('search_placeholder', 'santiago', 'en', 'Ask Santiago Anything...', 'Ask Santiago Anything...'),
    ('search_placeholder', 'tahoma', 'en', 'Ask Tahoma Anything...', 'Ask Tahoma Anything...')
ON CONFLICT (string_key, persona_slug, target_language) DO NOTHING;
