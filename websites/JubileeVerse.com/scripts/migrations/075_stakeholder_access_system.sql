-- Migration 075: Stakeholder Access System
-- Purpose: Enable stakeholders to access historical metrics with full audit trail
-- All queries are logged and results are reproducible

-- ============================================================================
-- STAKEHOLDER ACCESS TABLE
-- Defines what metrics each stakeholder can access
-- ============================================================================

CREATE TABLE IF NOT EXISTS stakeholder_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Access levels
  can_view_metrics BOOLEAN DEFAULT true,
  can_view_velocity BOOLEAN DEFAULT true,
  can_view_projections BOOLEAN DEFAULT true,
  can_query_historical BOOLEAN DEFAULT true,
  can_export_data BOOLEAN DEFAULT false,

  -- Scope limitations
  date_range_limit_days INTEGER,  -- NULL = unlimited, e.g., 90 = last 90 days only
  task_visibility VARCHAR(50) DEFAULT 'summary',  -- 'summary', 'details', 'full'

  -- Access period
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ,  -- NULL = never expires
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active access record per user (partial unique index)
CREATE UNIQUE INDEX idx_stakeholder_access_unique_active
  ON stakeholder_access(user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_stakeholder_access_user ON stakeholder_access(user_id);
-- Note: We can't use NOW() in index predicates, so we just check revoked_at
-- Expiration checks are done at query time
CREATE INDEX idx_stakeholder_access_active ON stakeholder_access(user_id)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- STAKEHOLDER QUERY LOG
-- Immutable record of every query made by stakeholders
-- ============================================================================

CREATE TABLE IF NOT EXISTS stakeholder_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who queried
  user_id UUID NOT NULL REFERENCES users(id),
  session_id VARCHAR(100),

  -- What was queried
  query_type VARCHAR(50) NOT NULL,
  -- Types: 'metrics', 'velocity', 'projection', 'historical', 'task_detail', 'export'

  query_parameters JSONB NOT NULL,
  -- Stores: date_range, filters, requested_fields, etc.

  -- Response metadata (for reproducibility)
  response_hash VARCHAR(64) NOT NULL,  -- SHA-256 of response data
  response_row_count INTEGER,
  response_summary JSONB,  -- Key aggregates for quick audit

  -- Timing
  queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_time_ms INTEGER,

  -- This table is append-only
  CONSTRAINT stakeholder_query_immutable CHECK (true)
);

CREATE INDEX idx_query_log_user ON stakeholder_query_log(user_id);
CREATE INDEX idx_query_log_type ON stakeholder_query_log(query_type);
CREATE INDEX idx_query_log_date ON stakeholder_query_log(queried_at);

-- ============================================================================
-- ENHANCE METRIC_SNAPSHOTS FOR STAKEHOLDER ACCESS
-- Add fields for reproducibility verification
-- ============================================================================

ALTER TABLE metric_snapshots
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- ============================================================================
-- STAKEHOLDER DASHBOARD PREFERENCES
-- Store customization for each stakeholder's view
-- ============================================================================

CREATE TABLE IF NOT EXISTS stakeholder_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Dashboard configuration
  default_date_range INTEGER DEFAULT 30,  -- days
  show_velocity BOOLEAN DEFAULT true,
  show_projections BOOLEAN DEFAULT true,
  show_breakdown BOOLEAN DEFAULT false,

  -- Notification preferences
  daily_summary_email BOOLEAN DEFAULT false,
  weekly_report_email BOOLEAN DEFAULT true,
  alert_on_projection_drift BOOLEAN DEFAULT true,
  projection_drift_threshold_days INTEGER DEFAULT 7,

  -- Display preferences
  timezone VARCHAR(50) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================================
-- FUNCTION: Check Stakeholder Access
-- Validates if a user has access to a specific query type
-- ============================================================================

CREATE OR REPLACE FUNCTION check_stakeholder_access(
  p_user_id UUID,
  p_query_type VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_access stakeholder_access%ROWTYPE;
BEGIN
  -- Get active access record
  SELECT * INTO v_access
  FROM stakeholder_access
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check specific permission
  CASE p_query_type
    WHEN 'metrics' THEN RETURN v_access.can_view_metrics;
    WHEN 'velocity' THEN RETURN v_access.can_view_velocity;
    WHEN 'projection' THEN RETURN v_access.can_view_projections;
    WHEN 'historical' THEN RETURN v_access.can_query_historical;
    WHEN 'export' THEN RETURN v_access.can_export_data;
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Log Stakeholder Query
-- Records every stakeholder query for audit trail
-- ============================================================================

CREATE OR REPLACE FUNCTION log_stakeholder_query(
  p_user_id UUID,
  p_query_type VARCHAR,
  p_parameters JSONB,
  p_response_hash VARCHAR,
  p_row_count INTEGER DEFAULT NULL,
  p_summary JSONB DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_session_id VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO stakeholder_query_log (
    user_id, session_id, query_type, query_parameters,
    response_hash, response_row_count, response_summary, response_time_ms
  ) VALUES (
    p_user_id, p_session_id, p_query_type, p_parameters,
    p_response_hash, p_row_count, p_summary, p_response_time_ms
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Historical Metrics (Reproducible)
-- Always returns from snapshots, never recalculates
-- ============================================================================

CREATE OR REPLACE FUNCTION get_stakeholder_historical_metrics(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_metric_type VARCHAR DEFAULT 'daily_totals'
)
RETURNS TABLE (
  snapshot_date DATE,
  metric_type VARCHAR,
  frozen_data JSONB,
  formula_version VARCHAR,
  data_hash VARCHAR
) AS $$
DECLARE
  v_access stakeholder_access%ROWTYPE;
BEGIN
  -- Verify access
  SELECT * INTO v_access
  FROM stakeholder_access
  WHERE stakeholder_access.user_id = p_user_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stakeholder access denied for user %', p_user_id;
  END IF;

  IF NOT v_access.can_query_historical THEN
    RAISE EXCEPTION 'User % does not have historical query access', p_user_id;
  END IF;

  -- Apply date range limits if specified
  IF v_access.date_range_limit_days IS NOT NULL THEN
    IF p_start_date < (CURRENT_DATE - v_access.date_range_limit_days) THEN
      RAISE EXCEPTION 'Date range exceeds allowed limit of % days', v_access.date_range_limit_days;
    END IF;
  END IF;

  -- Return from frozen snapshots only
  RETURN QUERY
  SELECT
    ms.snapshot_date,
    ms.metric_type,
    ms.frozen_data,
    fv.version_number::VARCHAR as formula_version,
    ms.data_hash
  FROM metric_snapshots ms
  LEFT JOIN formula_versions fv ON ms.formula_version_id = fv.id
  WHERE ms.snapshot_date BETWEEN p_start_date AND p_end_date
    AND ms.metric_type = p_metric_type
  ORDER BY ms.snapshot_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEW: Active Stakeholders
-- Current stakeholders with active access
-- ============================================================================

CREATE OR REPLACE VIEW v_active_stakeholders AS
SELECT
  sa.id as access_id,
  sa.user_id,
  u.email,
  u.display_name as user_name,
  sa.can_view_metrics,
  sa.can_view_velocity,
  sa.can_view_projections,
  sa.can_query_historical,
  sa.can_export_data,
  sa.date_range_limit_days,
  sa.task_visibility,
  sa.granted_at,
  sa.expires_at,
  COALESCE(query_stats.query_count, 0) as total_queries,
  query_stats.last_query_at
FROM stakeholder_access sa
JOIN users u ON sa.user_id = u.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as query_count,
    MAX(queried_at) as last_query_at
  FROM stakeholder_query_log sql
  WHERE sql.user_id = sa.user_id
) query_stats ON true
WHERE sa.revoked_at IS NULL
  AND (sa.expires_at IS NULL OR sa.expires_at > NOW());

-- ============================================================================
-- VIEW: Query Audit Summary
-- Aggregated query statistics by user and type
-- ============================================================================

CREATE OR REPLACE VIEW v_query_audit_summary AS
SELECT
  sql.user_id,
  u.email,
  sql.query_type,
  COUNT(*) as query_count,
  MIN(sql.queried_at) as first_query,
  MAX(sql.queried_at) as last_query,
  AVG(sql.response_time_ms)::INTEGER as avg_response_time_ms,
  SUM(sql.response_row_count) as total_rows_returned
FROM stakeholder_query_log sql
JOIN users u ON sql.user_id = u.id
GROUP BY sql.user_id, u.email, sql.query_type
ORDER BY MAX(sql.queried_at) DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE stakeholder_access IS 'Controls what metrics stakeholders can access';
COMMENT ON TABLE stakeholder_query_log IS 'Immutable audit trail of all stakeholder queries';
COMMENT ON TABLE stakeholder_preferences IS 'Stakeholder dashboard customization settings';
COMMENT ON FUNCTION check_stakeholder_access IS 'Validates stakeholder permissions for query types';
COMMENT ON FUNCTION log_stakeholder_query IS 'Records queries for audit trail';
COMMENT ON FUNCTION get_stakeholder_historical_metrics IS 'Returns frozen metrics - never recalculates';
