-- ============================================
-- JubileeVerse Database Schema
-- Migration 005: Translations and Language Support
-- ============================================

-- Supported languages
CREATE TABLE IF NOT EXISTS languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100),
    direction VARCHAR(3) DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Translation cache (to avoid re-translating same content)
CREATE TABLE IF NOT EXISTS translation_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_hash VARCHAR(64) NOT NULL,
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    provider VARCHAR(50) DEFAULT 'openai',
    quality_score DECIMAL(3,2),
    usage_count INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_hash, source_language, target_language)
);

-- Translation requests log (for analytics and debugging)
CREATE TABLE IF NOT EXISTS translation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    character_count INT NOT NULL,
    processing_time_ms INT,
    provider VARCHAR(50) DEFAULT 'openai',
    cache_hit BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User translation preferences
CREATE TABLE IF NOT EXISTS user_translation_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    default_source_language VARCHAR(10) DEFAULT 'auto',
    default_target_language VARCHAR(10) NOT NULL,
    auto_detect BOOLEAN DEFAULT TRUE,
    save_translations BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Bible versions for reference lookups
CREATE TABLE IF NOT EXISTS bible_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    language VARCHAR(10) NOT NULL,
    description TEXT,
    copyright TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for translation cache
CREATE INDEX IF NOT EXISTS idx_translation_cache_hash ON translation_cache(source_hash);
CREATE INDEX IF NOT EXISTS idx_translation_cache_langs ON translation_cache(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_usage ON translation_cache(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_translation_cache_last_used ON translation_cache(last_used_at);

-- Indexes for translation logs
CREATE INDEX IF NOT EXISTS idx_translation_logs_user ON translation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_translation_logs_created ON translation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_translation_logs_status ON translation_logs(status);

-- Indexes for languages
CREATE INDEX IF NOT EXISTS idx_languages_code ON languages(code);
CREATE INDEX IF NOT EXISTS idx_languages_active ON languages(is_active) WHERE is_active = TRUE;

-- Updated_at trigger for translation preferences
CREATE TRIGGER update_user_translation_preferences_updated_at
    BEFORE UPDATE ON user_translation_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default languages
INSERT INTO languages (code, name, native_name, direction, display_order) VALUES
    ('en', 'English', 'English', 'ltr', 1),
    ('es', 'Spanish', 'Espa├▒ol', 'ltr', 2),
    ('fr', 'French', 'Fran├ºais', 'ltr', 3),
    ('de', 'German', 'Deutsch', 'ltr', 4),
    ('it', 'Italian', 'Italiano', 'ltr', 5),
    ('pt', 'Portuguese', 'Portugu├¬s', 'ltr', 6),
    ('ru', 'Russian', '­Ç­ó­ë­ë­ï­ü­ö', 'ltr', 7),
    ('zh', 'Chinese', '─ÿ╬ç', 'ltr', 8),
    ('ja', 'Japanese', '╠Ñ╠£╠¼', 'ltr', 9),
    ('ko', 'Korean', '╧£╠¡╠ó', 'ltr', 10),
    ('ar', 'Arabic', '╪º┘ä╪╣╪▒╪¿┘è╪®', 'rtl', 11),
    ('he', 'Hebrew', '╫ó╫æ╫¿╫Ö╫¬', 'rtl', 12),
    ('hi', 'Hindi', '╪╣┘å╪»┘ç', 'ltr', 13),
    ('sw', 'Swahili', 'Kiswahili', 'ltr', 14),
    ('tl', 'Tagalog', 'Tagalog', 'ltr', 15)
ON CONFLICT (code) DO NOTHING;

-- Insert default Bible versions
INSERT INTO bible_versions (code, name, language, is_default) VALUES
    ('NIV', 'New International Version', 'en', TRUE),
    ('ESV', 'English Standard Version', 'en', FALSE),
    ('KJV', 'King James Version', 'en', FALSE),
    ('NASB', 'New American Standard Bible', 'en', FALSE),
    ('NLT', 'New Living Translation', 'en', FALSE),
    ('MSG', 'The Message', 'en', FALSE),
    ('RVR1960', 'Reina-Valera 1960', 'es', FALSE),
    ('LSG', 'Louis Segond', 'fr', FALSE),
    ('LUT', 'Luther Bible', 'de', FALSE)
ON CONFLICT (code) DO NOTHING;
