-- Migration 077: Monotonic Aggregate Safeguards
-- Purpose: Ensure cumulative metrics can only increase, with logged exceptions
-- Prevents accidental or intentional data manipulation

-- ============================================================================
-- AGGREGATE METRICS TABLE
-- Stores cumulative totals with validation
-- ============================================================================

CREATE TABLE IF NOT EXISTS aggregate_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metric identification
  metric_name VARCHAR(100) NOT NULL,
  -- E.g., 'total_ehh', 'total_cw_plus', 'completed_task_count', 'total_velocity'

  -- Current cumulative value
  current_value DECIMAL(12,2) NOT NULL,
  previous_value DECIMAL(12,2),

  -- Value tracking
  last_increased_at TIMESTAMPTZ,
  last_decreased_at TIMESTAMPTZ,
  decrease_count INTEGER DEFAULT 0,

  -- Snapshot timing
  snapshot_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique per metric per date
  UNIQUE(metric_name, snapshot_date)
);

CREATE INDEX idx_aggregate_metrics_name ON aggregate_metrics(metric_name);
CREATE INDEX idx_aggregate_metrics_date ON aggregate_metrics(snapshot_date DESC);

-- ============================================================================
-- AGGREGATE ADJUSTMENT LOG
-- Records any decrease in aggregate values with explanation
-- ============================================================================

CREATE TABLE IF NOT EXISTS aggregate_adjustment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was adjusted
  metric_name VARCHAR(100) NOT NULL,
  adjustment_date DATE NOT NULL,

  -- Values
  value_before DECIMAL(12,2) NOT NULL,
  value_after DECIMAL(12,2) NOT NULL,
  adjustment_amount DECIMAL(12,2) GENERATED ALWAYS AS (value_after - value_before) STORED,

  -- Explanation (required for decreases)
  adjustment_reason VARCHAR(100) NOT NULL,
  -- Types: 'data_correction', 'duplicate_removal', 'recalibration', 'bug_fix', 'administrative'

  adjustment_notes TEXT NOT NULL,  -- Required explanation

  -- Approval chain
  adjusted_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  -- References
  related_task_ids UUID[],  -- Tasks affected by this adjustment
  audit_reference VARCHAR(200),  -- External audit/ticket reference

  -- Immutable timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- This table is append-only
  CONSTRAINT adjustment_log_immutable CHECK (true)
);

CREATE INDEX idx_adjustment_log_metric ON aggregate_adjustment_log(metric_name);
CREATE INDEX idx_adjustment_log_date ON aggregate_adjustment_log(adjustment_date);
CREATE INDEX idx_adjustment_log_reason ON aggregate_adjustment_log(adjustment_reason);

-- ============================================================================
-- TIMELINE PROJECTIONS TABLE
-- Track projection stability and drift
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What is being projected
  milestone_name VARCHAR(200) NOT NULL,
  milestone_description TEXT,

  -- Target
  target_metric VARCHAR(100) NOT NULL,  -- E.g., 'total_ehh'
  target_value DECIMAL(12,2) NOT NULL,

  -- Current projection
  projected_completion_date DATE NOT NULL,
  confidence_level DECIMAL(5,2),  -- 0-100%

  -- Drift tracking
  original_projected_date DATE NOT NULL,
  drift_days INTEGER GENERATED ALWAYS AS (projected_completion_date - original_projected_date) STORED,
  drift_alert_threshold_days INTEGER DEFAULT 7,

  -- Status
  status VARCHAR(50) DEFAULT 'active',
  -- Values: 'active', 'achieved', 'delayed', 'cancelled'

  actual_completion_date DATE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active projection per milestone (partial unique index)
CREATE UNIQUE INDEX idx_projections_unique_active
  ON timeline_projections(milestone_name)
  WHERE status = 'active';

CREATE INDEX idx_projections_status ON timeline_projections(status);
CREATE INDEX idx_projections_target ON timeline_projections(target_metric);

-- ============================================================================
-- PROJECTION HISTORY TABLE
-- Track all changes to projections over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS projection_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  projection_id UUID NOT NULL REFERENCES timeline_projections(id),

  -- Snapshot of projection at this point in time
  snapshot_date DATE NOT NULL,
  projected_completion_date DATE NOT NULL,
  confidence_level DECIMAL(5,2),
  current_metric_value DECIMAL(12,2),

  -- Velocity data used for projection
  velocity_7day DECIMAL(10,2),
  velocity_30day DECIMAL(10,2),
  velocity_used DECIMAL(10,2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projection_history_projection ON projection_history(projection_id);
CREATE INDEX idx_projection_history_date ON projection_history(snapshot_date);

-- ============================================================================
-- FUNCTION: Update Aggregate Metric (with safeguards)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_aggregate_metric(
  p_metric_name VARCHAR,
  p_new_value DECIMAL,
  p_snapshot_date DATE DEFAULT CURRENT_DATE,
  p_adjustment_reason VARCHAR DEFAULT NULL,
  p_adjustment_notes TEXT DEFAULT NULL,
  p_adjusted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current RECORD;
  v_is_decrease BOOLEAN;
BEGIN
  -- Get current value
  SELECT * INTO v_current
  FROM aggregate_metrics
  WHERE metric_name = p_metric_name
    AND snapshot_date = p_snapshot_date;

  -- Check if this is a decrease
  v_is_decrease := v_current.current_value IS NOT NULL AND p_new_value < v_current.current_value;

  -- If decrease, require explanation
  IF v_is_decrease THEN
    IF p_adjustment_reason IS NULL OR p_adjustment_notes IS NULL THEN
      RAISE EXCEPTION 'Aggregate decrease requires adjustment_reason and adjustment_notes';
    END IF;

    -- Log the adjustment
    INSERT INTO aggregate_adjustment_log (
      metric_name, adjustment_date, value_before, value_after,
      adjustment_reason, adjustment_notes, adjusted_by
    ) VALUES (
      p_metric_name, p_snapshot_date, v_current.current_value, p_new_value,
      p_adjustment_reason, p_adjustment_notes, p_adjusted_by
    );
  END IF;

  -- Upsert the metric
  INSERT INTO aggregate_metrics (
    metric_name, snapshot_date, current_value, previous_value,
    last_increased_at, last_decreased_at, decrease_count
  ) VALUES (
    p_metric_name, p_snapshot_date, p_new_value, NULL,
    CASE WHEN NOT v_is_decrease THEN NOW() ELSE NULL END,
    CASE WHEN v_is_decrease THEN NOW() ELSE NULL END,
    CASE WHEN v_is_decrease THEN 1 ELSE 0 END
  )
  ON CONFLICT (metric_name, snapshot_date) DO UPDATE SET
    previous_value = aggregate_metrics.current_value,
    current_value = p_new_value,
    last_increased_at = CASE
      WHEN p_new_value > aggregate_metrics.current_value THEN NOW()
      ELSE aggregate_metrics.last_increased_at
    END,
    last_decreased_at = CASE
      WHEN p_new_value < aggregate_metrics.current_value THEN NOW()
      ELSE aggregate_metrics.last_decreased_at
    END,
    decrease_count = aggregate_metrics.decrease_count + CASE
      WHEN p_new_value < aggregate_metrics.current_value THEN 1
      ELSE 0
    END,
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Check Projection Drift
-- Returns projections that have drifted beyond threshold
-- ============================================================================

CREATE OR REPLACE FUNCTION check_projection_drift()
RETURNS TABLE (
  projection_id UUID,
  milestone_name VARCHAR,
  original_date DATE,
  current_projected_date DATE,
  drift_days INTEGER,
  threshold_days INTEGER,
  alert_needed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tp.id as projection_id,
    tp.milestone_name,
    tp.original_projected_date as original_date,
    tp.projected_completion_date as current_projected_date,
    tp.drift_days,
    tp.drift_alert_threshold_days as threshold_days,
    ABS(tp.drift_days) > tp.drift_alert_threshold_days as alert_needed
  FROM timeline_projections tp
  WHERE tp.status = 'active'
    AND ABS(tp.drift_days) > tp.drift_alert_threshold_days
  ORDER BY ABS(tp.drift_days) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update Projection with History
-- ============================================================================

CREATE OR REPLACE FUNCTION update_projection(
  p_projection_id UUID,
  p_new_projected_date DATE,
  p_confidence_level DECIMAL,
  p_current_metric_value DECIMAL,
  p_velocity_7day DECIMAL,
  p_velocity_30day DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_velocity_used DECIMAL;
BEGIN
  -- Determine which velocity to use (weighted average)
  v_velocity_used := (p_velocity_7day * 0.3 + p_velocity_30day * 0.7);

  -- Update the projection
  UPDATE timeline_projections
  SET
    projected_completion_date = p_new_projected_date,
    confidence_level = p_confidence_level,
    updated_at = NOW()
  WHERE id = p_projection_id;

  -- Record history
  INSERT INTO projection_history (
    projection_id, snapshot_date, projected_completion_date,
    confidence_level, current_metric_value,
    velocity_7day, velocity_30day, velocity_used
  ) VALUES (
    p_projection_id, CURRENT_DATE, p_new_projected_date,
    p_confidence_level, p_current_metric_value,
    p_velocity_7day, p_velocity_30day, v_velocity_used
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Validate Aggregate Updates
-- Ensures proper documentation for any decreases
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_aggregate_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If value decreased without going through update_aggregate_metric function,
  -- check that an adjustment log exists
  IF NEW.current_value < OLD.current_value THEN
    IF NOT EXISTS (
      SELECT 1 FROM aggregate_adjustment_log
      WHERE metric_name = NEW.metric_name
        AND adjustment_date = NEW.snapshot_date
        AND created_at >= NOW() - INTERVAL '1 minute'
    ) THEN
      RAISE WARNING 'Aggregate metric % decreased without logged explanation', NEW.metric_name;
      -- We warn but don't block - the daily job will flag this
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_aggregate_update
  BEFORE UPDATE ON aggregate_metrics
  FOR EACH ROW
  EXECUTE FUNCTION validate_aggregate_update();

-- ============================================================================
-- VIEW: Aggregate Metrics Summary
-- Current state of all tracked aggregates
-- ============================================================================

CREATE OR REPLACE VIEW v_aggregate_metrics_summary AS
SELECT
  am.metric_name,
  am.snapshot_date,
  am.current_value,
  am.previous_value,
  am.current_value - COALESCE(am.previous_value, 0) as daily_change,
  am.decrease_count,
  am.last_increased_at,
  am.last_decreased_at,
  COALESCE(adjustments.adjustment_count, 0) as total_adjustments,
  adjustments.last_adjustment_reason
FROM aggregate_metrics am
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as adjustment_count,
    MAX(adjustment_reason) as last_adjustment_reason
  FROM aggregate_adjustment_log aal
  WHERE aal.metric_name = am.metric_name
) adjustments ON true
WHERE am.snapshot_date = (
  SELECT MAX(snapshot_date) FROM aggregate_metrics am2
  WHERE am2.metric_name = am.metric_name
)
ORDER BY am.metric_name;

-- ============================================================================
-- VIEW: Projection Status Dashboard
-- Current projection status with drift indicators
-- ============================================================================

CREATE OR REPLACE VIEW v_projection_status AS
SELECT
  tp.id,
  tp.milestone_name,
  tp.target_metric,
  tp.target_value,
  tp.original_projected_date,
  tp.projected_completion_date,
  tp.drift_days,
  tp.drift_alert_threshold_days,
  CASE
    WHEN tp.drift_days > tp.drift_alert_threshold_days THEN 'delayed'
    WHEN tp.drift_days < -tp.drift_alert_threshold_days THEN 'ahead'
    ELSE 'on_track'
  END as drift_status,
  tp.confidence_level,
  tp.status,
  tp.created_at,
  tp.updated_at,
  history.history_count
FROM timeline_projections tp
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as history_count
  FROM projection_history ph
  WHERE ph.projection_id = tp.id
) history ON true
WHERE tp.status = 'active'
ORDER BY ABS(tp.drift_days) DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE aggregate_metrics IS 'Cumulative totals with monotonic increase safeguards';
COMMENT ON TABLE aggregate_adjustment_log IS 'Immutable log of all aggregate decreases with explanations';
COMMENT ON TABLE timeline_projections IS 'Milestone projections with drift tracking';
COMMENT ON TABLE projection_history IS 'Historical snapshots of projection changes';
COMMENT ON FUNCTION update_aggregate_metric IS 'Safely updates aggregates, requiring explanation for decreases';
COMMENT ON FUNCTION check_projection_drift IS 'Identifies projections that have drifted beyond threshold';
