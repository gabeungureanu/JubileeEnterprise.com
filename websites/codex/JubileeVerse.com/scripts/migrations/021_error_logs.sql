-- Migration: 021_error_logs
-- Description: Create error_logs table for tracking application errors
-- Created: 2024-12-24

-- Error logs table for tracking and investigating application errors
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_type VARCHAR(100) NOT NULL,
    error_code VARCHAR(50),
    message TEXT NOT NULL,
    stack_trace TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_path VARCHAR(500),
    request_method VARCHAR(10),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_code ON error_logs(error_code);

-- Add comment for documentation
COMMENT ON TABLE error_logs IS 'Application error tracking for investigation and debugging';
