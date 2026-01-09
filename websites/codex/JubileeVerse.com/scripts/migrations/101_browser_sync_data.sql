-- ============================================
-- JubileeVerse Database Schema
-- Migration 101: Browser Sync Data
-- ============================================
-- Stores browser sync data (bookmarks, history, settings) for cross-device sync

-- Browser sync data table
CREATE TABLE IF NOT EXISTS browser_sync_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('bookmark', 'history', 'password', 'autofill', 'extension', 'theme', 'settings')),
    entity_id VARCHAR(255) NOT NULL, -- Unique ID for the entity within its type
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
    data JSONB, -- The actual sync data
    client_timestamp BIGINT NOT NULL, -- Client-side timestamp in milliseconds
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1, -- For conflict resolution
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, entity_type, entity_id)
);

-- Indexes for browser_sync_data
CREATE INDEX IF NOT EXISTS idx_browser_sync_user_id ON browser_sync_data(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_sync_device_id ON browser_sync_data(device_id);
CREATE INDEX IF NOT EXISTS idx_browser_sync_entity_type ON browser_sync_data(entity_type);
CREATE INDEX IF NOT EXISTS idx_browser_sync_server_timestamp ON browser_sync_data(server_timestamp);
CREATE INDEX IF NOT EXISTS idx_browser_sync_user_timestamp ON browser_sync_data(user_id, server_timestamp);
CREATE INDEX IF NOT EXISTS idx_browser_sync_user_type ON browser_sync_data(user_id, entity_type);

-- Apply updated_at trigger
CREATE TRIGGER update_browser_sync_data_updated_at
    BEFORE UPDATE ON browser_sync_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Browser sync preferences table - stores user sync preferences
CREATE TABLE IF NOT EXISTS browser_sync_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    sync_bookmarks BOOLEAN DEFAULT TRUE,
    sync_history BOOLEAN DEFAULT TRUE,
    sync_passwords BOOLEAN DEFAULT FALSE,
    sync_autofill BOOLEAN DEFAULT FALSE,
    sync_extensions BOOLEAN DEFAULT FALSE,
    sync_themes BOOLEAN DEFAULT TRUE,
    sync_settings BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for sync preferences
CREATE INDEX IF NOT EXISTS idx_browser_sync_prefs_user_id ON browser_sync_preferences(user_id);

-- Apply updated_at trigger
CREATE TRIGGER update_browser_sync_preferences_updated_at
    BEFORE UPDATE ON browser_sync_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE browser_sync_data IS 'Stores browser sync data (bookmarks, history, settings) for cross-device sync';
COMMENT ON TABLE browser_sync_preferences IS 'Stores user preferences for what data to sync across devices';
