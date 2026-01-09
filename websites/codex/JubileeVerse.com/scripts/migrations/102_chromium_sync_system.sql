-- ============================================
-- JubileeVerse Database Schema
-- Migration 102: Chromium-style Browser Sync System
-- Full multi-device sync architecture with versioning
-- ============================================

-- ============================================
-- SYNC COLLECTIONS TABLE
-- Represents each sync data type per user
-- ============================================
CREATE TABLE IF NOT EXISTS sync_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_type VARCHAR(50) NOT NULL CHECK (collection_type IN (
        'bookmarks', 'history', 'passwords', 'autofill',
        'settings', 'tabs', 'extensions', 'themes'
    )),
    -- Monotonically increasing version for this collection
    current_version BIGINT NOT NULL DEFAULT 0,
    -- Encryption key ID for this collection (client manages actual keys)
    encryption_key_id VARCHAR(255),
    -- Whether this collection is enabled for sync
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, collection_type)
);

-- Indexes for sync_collections
CREATE INDEX IF NOT EXISTS idx_sync_collections_user_id ON sync_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_collections_type ON sync_collections(collection_type);

-- ============================================
-- SYNC ITEMS TABLE
-- Stores individual sync items with versioning
-- ============================================
CREATE TABLE IF NOT EXISTS sync_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES sync_collections(id) ON DELETE CASCADE,
    -- Client-generated unique ID for the item
    client_id VARCHAR(255) NOT NULL,
    -- Server-assigned monotonic version (increments on each change)
    server_version BIGINT NOT NULL DEFAULT 0,
    -- Item payload (encrypted by client for sensitive data)
    payload JSONB NOT NULL,
    -- Payload checksum for integrity verification
    payload_hash VARCHAR(64),
    -- Whether payload is encrypted
    is_encrypted BOOLEAN DEFAULT FALSE,
    -- Tombstone flag for deletions
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    -- Device that last modified this item
    last_modified_by UUID REFERENCES user_devices(id),
    -- Client timestamp of last modification
    client_modified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(collection_id, client_id)
);

-- Indexes for sync_items
CREATE INDEX IF NOT EXISTS idx_sync_items_collection_id ON sync_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_sync_items_server_version ON sync_items(server_version);
CREATE INDEX IF NOT EXISTS idx_sync_items_client_id ON sync_items(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_items_deleted ON sync_items(is_deleted) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_sync_items_collection_version ON sync_items(collection_id, server_version);

-- ============================================
-- SYNC PROGRESS TABLE
-- Per-device progress markers for incremental sync
-- ============================================
CREATE TABLE IF NOT EXISTS sync_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES sync_collections(id) ON DELETE CASCADE,
    -- Last acknowledged server version for this device/collection
    last_acknowledged_version BIGINT NOT NULL DEFAULT 0,
    -- Last successful sync timestamp
    last_sync_at TIMESTAMPTZ,
    -- Number of items synced in last batch
    last_sync_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, collection_id)
);

-- Indexes for sync_progress
CREATE INDEX IF NOT EXISTS idx_sync_progress_device_id ON sync_progress(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_progress_collection_id ON sync_progress(collection_id);

-- ============================================
-- SYNC CONFLICTS TABLE
-- Track and resolve sync conflicts
-- ============================================
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES sync_items(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
    -- The conflicting payload from the device
    conflicting_payload JSONB NOT NULL,
    -- Resolution status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
    -- How it was resolved
    resolution_type VARCHAR(20) CHECK (resolution_type IN ('server_wins', 'client_wins', 'merged', 'manual')),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sync_conflicts
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_item_id ON sync_conflicts(item_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(status) WHERE status = 'pending';

-- ============================================
-- BOOKMARKS TABLE
-- Specialized table for bookmark data
-- ============================================
CREATE TABLE IF NOT EXISTS browser_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sync_item_id UUID REFERENCES sync_items(id) ON DELETE SET NULL,
    -- Client-generated unique ID
    client_id VARCHAR(255) NOT NULL,
    -- Parent folder client_id (null for root)
    parent_id VARCHAR(255),
    -- Bookmark data
    title VARCHAR(500) NOT NULL,
    url TEXT,
    favicon_url TEXT,
    -- Is this a folder?
    is_folder BOOLEAN DEFAULT FALSE,
    -- Position within parent folder
    position INTEGER DEFAULT 0,
    -- Special folder type (bookmarks_bar, other_bookmarks, mobile_bookmarks)
    special_folder VARCHAR(50),
    -- Timestamps
    date_added TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_modified TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);

-- Indexes for browser_bookmarks
CREATE INDEX IF NOT EXISTS idx_browser_bookmarks_user_id ON browser_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_bookmarks_parent_id ON browser_bookmarks(parent_id);
CREATE INDEX IF NOT EXISTS idx_browser_bookmarks_sync_item ON browser_bookmarks(sync_item_id);

-- ============================================
-- BROWSER HISTORY TABLE
-- Specialized table for browsing history
-- ============================================
CREATE TABLE IF NOT EXISTS browser_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sync_item_id UUID REFERENCES sync_items(id) ON DELETE SET NULL,
    -- Client-generated unique ID
    client_id VARCHAR(255) NOT NULL,
    -- Page data
    url TEXT NOT NULL,
    title VARCHAR(500),
    -- Visit data
    visit_time TIMESTAMPTZ NOT NULL,
    visit_count INTEGER DEFAULT 1,
    typed_count INTEGER DEFAULT 0,
    -- Transition type (link, typed, auto_bookmark, etc.)
    transition_type VARCHAR(50),
    -- Reference to the page that led to this visit
    referrer_url TEXT,
    -- Duration on page in seconds
    visit_duration INTEGER,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);

-- Indexes for browser_history
CREATE INDEX IF NOT EXISTS idx_browser_history_user_id ON browser_history(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_history_visit_time ON browser_history(visit_time);
CREATE INDEX IF NOT EXISTS idx_browser_history_url ON browser_history(url);
CREATE INDEX IF NOT EXISTS idx_browser_history_sync_item ON browser_history(sync_item_id);

-- ============================================
-- BROWSER PASSWORDS TABLE
-- Specialized table for saved passwords (encrypted)
-- ============================================
CREATE TABLE IF NOT EXISTS browser_passwords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sync_item_id UUID REFERENCES sync_items(id) ON DELETE SET NULL,
    -- Client-generated unique ID
    client_id VARCHAR(255) NOT NULL,
    -- Origin/URL (not encrypted - needed for lookup)
    origin_url TEXT NOT NULL,
    action_url TEXT,
    -- Encrypted credential data (username, password encrypted by client)
    encrypted_username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    -- Encryption metadata
    encryption_iv VARCHAR(64),
    encryption_version INTEGER DEFAULT 1,
    -- Username hint (first char + length) for UI
    username_hint VARCHAR(20),
    -- Form metadata
    username_element VARCHAR(255),
    password_element VARCHAR(255),
    submit_element VARCHAR(255),
    signon_realm VARCHAR(500),
    -- Timestamps
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_last_used TIMESTAMPTZ,
    date_password_modified TIMESTAMPTZ,
    times_used INTEGER DEFAULT 0,
    -- Status
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    blacklisted_by_user BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);

-- Indexes for browser_passwords
CREATE INDEX IF NOT EXISTS idx_browser_passwords_user_id ON browser_passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_passwords_origin ON browser_passwords(origin_url);
CREATE INDEX IF NOT EXISTS idx_browser_passwords_sync_item ON browser_passwords(sync_item_id);

-- ============================================
-- BROWSER AUTOFILL TABLE
-- Specialized table for autofill data
-- ============================================
CREATE TABLE IF NOT EXISTS browser_autofill (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sync_item_id UUID REFERENCES sync_items(id) ON DELETE SET NULL,
    -- Client-generated unique ID
    client_id VARCHAR(255) NOT NULL,
    -- Autofill type (address, credit_card, generic)
    autofill_type VARCHAR(50) NOT NULL CHECK (autofill_type IN ('address', 'credit_card', 'generic')),
    -- Encrypted profile data (full data encrypted by client)
    encrypted_data TEXT NOT NULL,
    encryption_iv VARCHAR(64),
    encryption_version INTEGER DEFAULT 1,
    -- Non-sensitive metadata for UI
    profile_label VARCHAR(255),
    -- Timestamps
    date_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    use_count INTEGER DEFAULT 0,
    use_date TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);

-- Indexes for browser_autofill
CREATE INDEX IF NOT EXISTS idx_browser_autofill_user_id ON browser_autofill(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_autofill_type ON browser_autofill(autofill_type);
CREATE INDEX IF NOT EXISTS idx_browser_autofill_sync_item ON browser_autofill(sync_item_id);

-- ============================================
-- BROWSER SETTINGS TABLE
-- User browser settings sync
-- ============================================
CREATE TABLE IF NOT EXISTS browser_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sync_item_id UUID REFERENCES sync_items(id) ON DELETE SET NULL,
    -- Client-generated unique ID
    client_id VARCHAR(255) NOT NULL,
    -- Setting key and value
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSONB NOT NULL,
    -- Category for grouping
    category VARCHAR(100),
    -- Device-specific or global
    is_device_specific BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);

-- Indexes for browser_settings
CREATE INDEX IF NOT EXISTS idx_browser_settings_user_id ON browser_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_settings_key ON browser_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_browser_settings_sync_item ON browser_settings(sync_item_id);

-- ============================================
-- OPEN TABS TABLE
-- Synced open tabs across devices
-- ============================================
CREATE TABLE IF NOT EXISTS browser_open_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
    sync_item_id UUID REFERENCES sync_items(id) ON DELETE SET NULL,
    -- Client-generated unique ID
    client_id VARCHAR(255) NOT NULL,
    -- Tab data
    url TEXT NOT NULL,
    title VARCHAR(500),
    favicon_url TEXT,
    -- Tab position and grouping
    window_id VARCHAR(100),
    tab_index INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    -- Group info
    group_id VARCHAR(100),
    group_title VARCHAR(255),
    group_color VARCHAR(20),
    -- Timestamps
    last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, client_id)
);

-- Indexes for browser_open_tabs
CREATE INDEX IF NOT EXISTS idx_browser_open_tabs_user_id ON browser_open_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_open_tabs_device_id ON browser_open_tabs(device_id);
CREATE INDEX IF NOT EXISTS idx_browser_open_tabs_sync_item ON browser_open_tabs(sync_item_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp triggers
DROP TRIGGER IF EXISTS update_sync_collections_updated_at ON sync_collections;
CREATE TRIGGER update_sync_collections_updated_at
    BEFORE UPDATE ON sync_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_items_updated_at ON sync_items;
CREATE TRIGGER update_sync_items_updated_at
    BEFORE UPDATE ON sync_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_progress_updated_at ON sync_progress;
CREATE TRIGGER update_sync_progress_updated_at
    BEFORE UPDATE ON sync_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_browser_bookmarks_updated_at ON browser_bookmarks;
CREATE TRIGGER update_browser_bookmarks_updated_at
    BEFORE UPDATE ON browser_bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_browser_history_updated_at ON browser_history;
CREATE TRIGGER update_browser_history_updated_at
    BEFORE UPDATE ON browser_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_browser_passwords_updated_at ON browser_passwords;
CREATE TRIGGER update_browser_passwords_updated_at
    BEFORE UPDATE ON browser_passwords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_browser_autofill_updated_at ON browser_autofill;
CREATE TRIGGER update_browser_autofill_updated_at
    BEFORE UPDATE ON browser_autofill
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_browser_settings_updated_at ON browser_settings;
CREATE TRIGGER update_browser_settings_updated_at
    BEFORE UPDATE ON browser_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_browser_open_tabs_updated_at ON browser_open_tabs;
CREATE TRIGGER update_browser_open_tabs_updated_at
    BEFORE UPDATE ON browser_open_tabs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Get next version for collection
-- ============================================
CREATE OR REPLACE FUNCTION get_next_collection_version(p_collection_id UUID)
RETURNS BIGINT AS $$
DECLARE
    next_version BIGINT;
BEGIN
    -- Atomically increment and return the new version
    UPDATE sync_collections
    SET current_version = current_version + 1,
        updated_at = NOW()
    WHERE id = p_collection_id
    RETURNING current_version INTO next_version;

    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Upsert sync item
-- ============================================
CREATE OR REPLACE FUNCTION upsert_sync_item(
    p_collection_id UUID,
    p_client_id VARCHAR(255),
    p_payload JSONB,
    p_device_id UUID DEFAULT NULL,
    p_is_encrypted BOOLEAN DEFAULT FALSE,
    p_is_deleted BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(item_id UUID, new_version BIGINT) AS $$
DECLARE
    v_item_id UUID;
    v_version BIGINT;
BEGIN
    -- Get next version
    v_version := get_next_collection_version(p_collection_id);

    -- Upsert the item
    INSERT INTO sync_items (collection_id, client_id, server_version, payload, is_encrypted, is_deleted, last_modified_by, client_modified_at, deleted_at)
    VALUES (p_collection_id, p_client_id, v_version, p_payload, p_is_encrypted, p_is_deleted, p_device_id, NOW(), CASE WHEN p_is_deleted THEN NOW() ELSE NULL END)
    ON CONFLICT (collection_id, client_id) DO UPDATE SET
        server_version = v_version,
        payload = EXCLUDED.payload,
        is_encrypted = EXCLUDED.is_encrypted,
        is_deleted = EXCLUDED.is_deleted,
        last_modified_by = EXCLUDED.last_modified_by,
        client_modified_at = NOW(),
        deleted_at = CASE WHEN EXCLUDED.is_deleted THEN NOW() ELSE sync_items.deleted_at END,
        updated_at = NOW()
    RETURNING id INTO v_item_id;

    RETURN QUERY SELECT v_item_id, v_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get items since version
-- ============================================
CREATE OR REPLACE FUNCTION get_sync_items_since_version(
    p_collection_id UUID,
    p_since_version BIGINT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    item_id UUID,
    client_id VARCHAR(255),
    server_version BIGINT,
    payload JSONB,
    is_encrypted BOOLEAN,
    is_deleted BOOLEAN,
    client_modified_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        si.id,
        si.client_id,
        si.server_version,
        si.payload,
        si.is_encrypted,
        si.is_deleted,
        si.client_modified_at
    FROM sync_items si
    WHERE si.collection_id = p_collection_id
      AND si.server_version > p_since_version
    ORDER BY si.server_version ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE sync_collections IS 'Represents each sync data type (bookmarks, history, etc.) per user with version tracking';
COMMENT ON TABLE sync_items IS 'Individual sync items with server-assigned monotonic versions for incremental sync';
COMMENT ON TABLE sync_progress IS 'Per-device progress markers tracking last acknowledged version for each collection';
COMMENT ON TABLE sync_conflicts IS 'Tracks and stores sync conflicts for resolution';
COMMENT ON TABLE browser_bookmarks IS 'Denormalized bookmark data for efficient querying';
COMMENT ON TABLE browser_history IS 'Denormalized browsing history data';
COMMENT ON TABLE browser_passwords IS 'Encrypted saved passwords - client-side encryption required';
COMMENT ON TABLE browser_autofill IS 'Encrypted autofill profiles - client-side encryption required';
COMMENT ON TABLE browser_settings IS 'Browser settings that sync across devices';
COMMENT ON TABLE browser_open_tabs IS 'Currently open tabs per device for cross-device tab access';
COMMENT ON FUNCTION get_next_collection_version(UUID) IS 'Atomically increments and returns the next version for a collection';
COMMENT ON FUNCTION upsert_sync_item(UUID, VARCHAR, JSONB, UUID, BOOLEAN, BOOLEAN) IS 'Upserts a sync item with automatic version assignment';
COMMENT ON FUNCTION get_sync_items_since_version(UUID, BIGINT, INTEGER) IS 'Retrieves sync items changed since a given version';
