-- Migration 074: Formula Versioning System
-- Purpose: Create immutable, versioned formula definitions for EHH/CW+ calculations
-- This ensures historical data remains consistent and reproducible

-- ============================================================================
-- FORMULA VERSIONS TABLE
-- Stores versioned formulas that are immutable once created
-- ============================================================================

CREATE TABLE IF NOT EXISTS formula_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Formula identification
  formula_name VARCHAR(100) NOT NULL,
  version_number INTEGER NOT NULL,

  -- Formula definition (human-readable)
  display_name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,

  -- The formula logic (stored as documentation, actual calculation in code)
  formula_documentation TEXT NOT NULL,

  -- Validity period (once effective_until is set, formula is retired)
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,  -- NULL = currently active

  -- Provenance
  created_by UUID REFERENCES users(id),
  rationale TEXT NOT NULL,  -- Why this version was created

  -- Immutability - these values NEVER change after creation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique version numbers per formula
  UNIQUE(formula_name, version_number)
);

-- Index for quick lookup of active formula
CREATE INDEX idx_formula_versions_active
ON formula_versions(formula_name, effective_from)
WHERE effective_until IS NULL;

-- ============================================================================
-- CALCULATION AUDIT LOG
-- Immutable record of every EHH/CW+ calculation performed
-- ============================================================================

CREATE TABLE IF NOT EXISTS calculation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was calculated
  task_id UUID NOT NULL REFERENCES admin_tasks(id),
  formula_version_id UUID NOT NULL REFERENCES formula_versions(id),

  -- Input values (frozen at calculation time)
  input_values JSONB NOT NULL,
  -- Example: {"task_title": "...", "components": [...], "estimation_method": "traditional"}

  -- Calculated output values
  calculated_ehh DECIMAL(10,2) NOT NULL,
  calculated_cw_plus DECIMAL(10,2) NOT NULL,

  -- Calculation metadata
  calculation_reason VARCHAR(50) NOT NULL,  -- 'task_completion', 'recalibration', 'manual_adjustment'
  calculation_notes TEXT,

  -- Timing
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_by UUID REFERENCES users(id),

  -- This table is append-only - no updates or deletes allowed via application
  -- Constraint enforced by removing UPDATE/DELETE grants in production
  CONSTRAINT calculation_audit_immutable CHECK (true)
);

-- Indexes for audit queries
CREATE INDEX idx_calc_audit_task ON calculation_audit_log(task_id);
CREATE INDEX idx_calc_audit_formula ON calculation_audit_log(formula_version_id);
CREATE INDEX idx_calc_audit_date ON calculation_audit_log(calculated_at);
CREATE INDEX idx_calc_audit_reason ON calculation_audit_log(calculation_reason);

-- ============================================================================
-- MODIFY admin_tasks TO TRACK FORMULA VERSION AND FROZEN VALUES
-- ============================================================================

-- Add columns to admin_tasks for frozen metrics
ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS formula_version_id UUID REFERENCES formula_versions(id),
ADD COLUMN IF NOT EXISTS frozen_ehh DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS frozen_cw_plus DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS metrics_frozen_at TIMESTAMPTZ;

-- Comment on columns
COMMENT ON COLUMN admin_tasks.formula_version_id IS 'The formula version used to calculate this task''s EHH/CW+';
COMMENT ON COLUMN admin_tasks.frozen_ehh IS 'The EHH value at task completion - never recalculated';
COMMENT ON COLUMN admin_tasks.frozen_cw_plus IS 'The CW+ value at task completion - never recalculated';
COMMENT ON COLUMN admin_tasks.metrics_frozen_at IS 'Timestamp when metrics were frozen';

-- ============================================================================
-- METRIC SNAPSHOTS TABLE
-- Daily snapshots for reproducible historical queries
-- ============================================================================

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What date this snapshot represents
  snapshot_date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL,  -- 'daily_totals', 'velocity', 'cumulative'

  -- Frozen data (complete snapshot of metrics at end of day)
  frozen_data JSONB NOT NULL,

  -- Verification hash (SHA-256 of frozen_data for integrity)
  data_hash VARCHAR(64) NOT NULL,

  -- Formula version in effect when snapshot was taken
  formula_version_id UUID REFERENCES formula_versions(id),

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one snapshot per date per metric type
  UNIQUE(snapshot_date, metric_type)
);

CREATE INDEX idx_metric_snapshots_date ON metric_snapshots(snapshot_date);
CREATE INDEX idx_metric_snapshots_type ON metric_snapshots(metric_type);

-- ============================================================================
-- SEED INITIAL FORMULA VERSION (v1)
-- This is the traditional estimation methodology
-- ============================================================================

INSERT INTO formula_versions (
  formula_name,
  version_number,
  display_name,
  description,
  formula_documentation,
  rationale
) VALUES (
  'EHH_TRADITIONAL_ESTIMATION',
  1,
  'Traditional EHH Estimation v1',
  'Estimates Estimated Human Hours (EHH) using traditional software development estimation based on actual deliverables produced.',
  E'## Traditional EHH Estimation Methodology\n\n### Definition\n- **CW+ (Completed Work Plus)**: Actual hours spent WITH AI assistance\n- **EHH (Estimated Human Hours)**: How long a skilled human developer WITHOUT AI would take\n\n### Estimation Process\n1. Document all deliverables (files, endpoints, pages, migrations)\n2. Apply traditional industry estimates to each component\n3. Sum all components for total EHH\n\n### Component Estimates\n| Component Type | Hours Range |\n|----------------|-------------|\n| Database migration (simple) | 2-4 hours |\n| Database migration (complex) | 16-40 hours |\n| API endpoint (simple CRUD) | 4-8 hours |\n| API endpoint (complex) | 16-32 hours |\n| Full service layer (~500 LOC) | 40-80 hours |\n| Frontend page (simple) | 8-16 hours |\n| Frontend page (complex) | 24-48 hours |\n| Research/investigation (simple) | 2-4 hours |\n| Research/investigation (deep) | 16-40 hours |\n| Full feature (full stack) | 80-200 hours |\n| Complete module/subsystem | 200-500 hours |\n\n### Work Efficiency Calculation\nWork Efficiency = (EHH / CW+) × 100\n\nExample: If 500 EHH delivered in 10 CW+ hours = 5,000% efficiency',
  'Initial formula establishing traditional estimation methodology. EHH and CW+ are not related by simple multipliers - EHH is based on real deliverables, CW+ is actual time spent with AI assistance.'
) ON CONFLICT (formula_name, version_number) DO NOTHING;

-- ============================================================================
-- FUNCTION: Get Active Formula Version
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_formula(p_formula_name VARCHAR)
RETURNS formula_versions AS $$
DECLARE
  result formula_versions;
BEGIN
  SELECT * INTO result
  FROM formula_versions
  WHERE formula_name = p_formula_name
    AND effective_until IS NULL
  ORDER BY version_number DESC
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Freeze Task Metrics
-- Called when task is completed to lock EHH/CW+ values
-- ============================================================================

CREATE OR REPLACE FUNCTION freeze_task_metrics(
  p_task_id UUID,
  p_ehh DECIMAL,
  p_cw_plus DECIMAL,
  p_formula_version_id UUID,
  p_calculated_by UUID DEFAULT NULL,
  p_calculation_reason VARCHAR DEFAULT 'task_completion'
)
RETURNS void AS $$
BEGIN
  -- Update task with frozen values
  UPDATE admin_tasks
  SET
    frozen_ehh = p_ehh,
    frozen_cw_plus = p_cw_plus,
    formula_version_id = p_formula_version_id,
    metrics_frozen_at = NOW(),
    effort_hours = p_ehh,  -- Also update the display columns
    completed_work = p_cw_plus
  WHERE id = p_task_id;

  -- Create audit log entry
  INSERT INTO calculation_audit_log (
    task_id,
    formula_version_id,
    input_values,
    calculated_ehh,
    calculated_cw_plus,
    calculation_reason,
    calculated_by
  )
  SELECT
    p_task_id,
    p_formula_version_id,
    jsonb_build_object(
      'task_title', title,
      'task_type', task_type,
      'component', component
    ),
    p_ehh,
    p_cw_plus,
    p_calculation_reason,
    p_calculated_by
  FROM admin_tasks
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- In production, revoke UPDATE/DELETE on calculation_audit_log for immutability
-- REVOKE UPDATE, DELETE ON calculation_audit_log FROM application_user;

COMMENT ON TABLE formula_versions IS 'Versioned, immutable formula definitions for EHH/CW+ calculations';
COMMENT ON TABLE calculation_audit_log IS 'Immutable audit trail of all EHH/CW+ calculations';
COMMENT ON TABLE metric_snapshots IS 'Daily frozen snapshots for reproducible historical queries';
