-- ============================================
-- JubileeVerse Database Schema
-- Migration 100: User Device Tracking
-- ============================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- User devices table - tracks devices used for sign-in
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL, -- Unique identifier for the device
    device_name VARCHAR(255), -- User-friendly device name
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'browser', 'other')),
    platform VARCHAR(100), -- OS/Platform (Windows, macOS, iOS, Android, etc.)
    platform_version VARCHAR(50), -- OS version
    browser VARCHAR(100), -- Browser name if applicable
    browser_version VARCHAR(50), -- Browser version
    app_name VARCHAR(100), -- Application name (JubileeBrowser, web, etc.)
    app_version VARCHAR(50), -- Application version
    ip_address INET,
    last_ip_address INET,
    is_trusted BOOLEAN DEFAULT FALSE, -- User marked as trusted device
    is_current BOOLEAN DEFAULT FALSE, -- Currently active session on this device
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    login_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- Indexes for user_devices
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON user_devices(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_devices_trusted ON user_devices(is_trusted) WHERE is_trusted = TRUE;

-- Apply updated_at trigger to user_devices
CREATE TRIGGER update_user_devices_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE user_devices IS 'Tracks devices used by users to sign in, for security and device management features';
