-- ============================================
-- JubileeVerse Database Schema
-- Migration 036: Operational Health Metrics
-- ============================================
-- Stores daily operational health snapshots for System Stress (TEMP),
-- Workflow Health (OIL), and Execution Intensity (RPM) gauges.
-- These metrics enable human+AI collaborative system health monitoring.

-- ============================================
-- OPERATIONAL HEALTH METRICS TABLE
-- ============================================
-- Stores daily snapshots of system health indicators
CREATE TABLE IF NOT EXISTS operational_health_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL UNIQUE,

  -- SYSTEM STRESS (TEMP Gauge) - 0-100 scale
  -- Composite of task churn, state changes, rework, interruptions, volatility
  system_stress DECIMAL(5,2) DEFAULT 0,
  stress_zone VARCHAR(20) DEFAULT 'stable', -- 'stable', 'warm', 'overheated'

  -- Stress component metrics (raw inputs)
  task_churn_count INTEGER DEFAULT 0,           -- Tasks created+deleted today
  state_change_count INTEGER DEFAULT 0,         -- Total status transitions today
  rework_task_count INTEGER DEFAULT 0,          -- Tasks moved back to fixing/in_progress
  rework_ratio DECIMAL(5,4) DEFAULT 0,          -- Rework / total completions
  domain_count INTEGER DEFAULT 0,               -- Distinct task components active
  velocity_volatility DECIMAL(5,2) DEFAULT 0,   -- Std dev of recent daily HEH
  interruption_count INTEGER DEFAULT 0,         -- Priority changes, blockers added

  -- WORKFLOW HEALTH (OIL Gauge) - 0-100 scale (displayed as PSI)
  -- Composite of automation, reuse, AI acceptance, friction reduction
  workflow_health DECIMAL(5,2) DEFAULT 50,
  health_zone VARCHAR(20) DEFAULT 'optimal', -- 'critical', 'low', 'optimal', 'excellent'

  -- Health component metrics (raw inputs)
  automation_coverage DECIMAL(5,2) DEFAULT 0,   -- % of tasks with automation assistance
  template_reuse_count INTEGER DEFAULT 0,       -- Tasks created from templates
  template_reuse_ratio DECIMAL(5,4) DEFAULT 0,  -- Template tasks / total tasks
  ai_suggestions_accepted INTEGER DEFAULT 0,    -- AI recommendations accepted
  ai_suggestions_total INTEGER DEFAULT 0,       -- Total AI suggestions made
  ai_acceptance_rate DECIMAL(5,4) DEFAULT 0,    -- Accepted / total suggestions
  manual_override_count INTEGER DEFAULT 0,      -- Manual corrections to AI output
  avg_task_definition_score DECIMAL(5,2) DEFAULT 0, -- Clarity score 0-100
  execution_friction_score DECIMAL(5,2) DEFAULT 0,  -- Lower is better

  -- EXECUTION INTENSITY (RPM Gauge) - 0-8000 scale (displayed as K)
  -- Composite of concurrent tasks, AI sessions, parallel streams
  execution_intensity INTEGER DEFAULT 0,
  intensity_zone VARCHAR(20) DEFAULT 'optimal', -- 'idle', 'warming', 'optimal', 'high', 'excessive'

  -- Intensity component metrics (raw inputs)
  concurrent_tasks INTEGER DEFAULT 0,           -- Tasks in active states right now
  active_ai_sessions INTEGER DEFAULT 0,         -- AI sessions in progress
  active_personas INTEGER DEFAULT 0,            -- Distinct personas engaged
  parallel_work_streams INTEGER DEFAULT 0,      -- Distinct components being worked
  peak_concurrent_tasks INTEGER DEFAULT 0,      -- Max concurrent today
  avg_concurrent_tasks DECIMAL(5,2) DEFAULT 0,  -- Average concurrent today

  -- INTERRELATIONSHIP FACTORS
  -- These capture how gauges affect each other
  stress_from_intensity DECIMAL(5,2) DEFAULT 0,   -- RPM contribution to TEMP
  stress_from_low_health DECIMAL(5,2) DEFAULT 0,  -- Low OIL amplifying TEMP
  health_stress_dampening DECIMAL(5,4) DEFAULT 1, -- How much OIL reduces TEMP effect
  intensity_sustainability DECIMAL(5,2) DEFAULT 100, -- Can current RPM be sustained?

  -- COMPOSITE SCORES
  overall_system_health DECIMAL(5,2) DEFAULT 50, -- Weighted composite 0-100
  risk_level VARCHAR(20) DEFAULT 'low',          -- 'low', 'moderate', 'elevated', 'high'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Add columns if table already exists
ALTER TABLE operational_health_metrics
  ADD COLUMN IF NOT EXISTS stress_from_intensity DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stress_from_low_health DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_stress_dampening DECIMAL(5,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS intensity_sustainability DECIMAL(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS overall_system_health DECIMAL(5,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'low';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_operational_health_date ON operational_health_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_operational_health_stress ON operational_health_metrics(system_stress, stress_zone);
CREATE INDEX IF NOT EXISTS idx_operational_health_health ON operational_health_metrics(workflow_health, health_zone);
CREATE INDEX IF NOT EXISTS idx_operational_health_intensity ON operational_health_metrics(execution_intensity, intensity_zone);
CREATE INDEX IF NOT EXISTS idx_operational_health_risk ON operational_health_metrics(risk_level, metric_date);

-- ============================================
-- CALCULATION FUNCTIONS
-- ============================================

-- Function to calculate System Stress (TEMP)
CREATE OR REPLACE FUNCTION calculate_system_stress(
  p_task_churn INTEGER,
  p_state_changes INTEGER,
  p_rework_ratio DECIMAL,
  p_domain_count INTEGER,
  p_velocity_volatility DECIMAL,
  p_interruptions INTEGER,
  p_execution_intensity INTEGER,
  p_workflow_health DECIMAL
)
RETURNS TABLE(
  stress_value DECIMAL,
  stress_zone VARCHAR,
  stress_from_intensity DECIMAL,
  stress_from_low_health DECIMAL
) AS $$
DECLARE
  v_base_stress DECIMAL;
  v_intensity_stress DECIMAL;
  v_health_stress DECIMAL;
  v_total_stress DECIMAL;
  v_health_dampening DECIMAL;
  v_zone VARCHAR(20);
BEGIN
  -- Base stress from direct factors (0-60 range)
  v_base_stress := LEAST(60,
    (p_task_churn * 2) +                    -- Each churn event adds 2
    (p_state_changes * 0.5) +               -- State changes add 0.5 each
    (p_rework_ratio * 100 * 3) +            -- Rework ratio heavily weighted
    (GREATEST(0, p_domain_count - 3) * 5) + -- Penalty for >3 domains
    (p_velocity_volatility * 2) +           -- Volatility contributes
    (p_interruptions * 3)                   -- Interruptions are stressful
  );

  -- Stress from high execution intensity (0-25 range)
  -- RPM > 5000 starts adding stress
  v_intensity_stress := CASE
    WHEN p_execution_intensity > 7000 THEN 25
    WHEN p_execution_intensity > 6000 THEN 20
    WHEN p_execution_intensity > 5000 THEN 15
    WHEN p_execution_intensity > 4000 THEN 8
    ELSE 0
  END;

  -- Stress amplification from low workflow health (0-15 range)
  -- Low health means friction, which amplifies stress
  v_health_stress := CASE
    WHEN p_workflow_health < 30 THEN 15
    WHEN p_workflow_health < 50 THEN 10
    WHEN p_workflow_health < 70 THEN 5
    ELSE 0
  END;

  -- Health dampening effect (high health reduces stress impact)
  v_health_dampening := CASE
    WHEN p_workflow_health >= 80 THEN 0.7  -- 30% reduction
    WHEN p_workflow_health >= 60 THEN 0.85 -- 15% reduction
    ELSE 1.0                               -- No reduction
  END;

  -- Calculate total stress with dampening
  v_total_stress := LEAST(100,
    (v_base_stress + v_intensity_stress + v_health_stress) * v_health_dampening
  );

  -- Determine zone
  v_zone := CASE
    WHEN v_total_stress >= 70 THEN 'overheated'
    WHEN v_total_stress >= 45 THEN 'warm'
    ELSE 'stable'
  END;

  RETURN QUERY SELECT
    ROUND(v_total_stress, 2)::DECIMAL,
    v_zone::VARCHAR,
    ROUND(v_intensity_stress, 2)::DECIMAL,
    ROUND(v_health_stress, 2)::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Workflow Health (OIL)
CREATE OR REPLACE FUNCTION calculate_workflow_health(
  p_automation_coverage DECIMAL,
  p_template_reuse_ratio DECIMAL,
  p_ai_acceptance_rate DECIMAL,
  p_manual_overrides INTEGER,
  p_avg_definition_score DECIMAL,
  p_friction_score DECIMAL
)
RETURNS TABLE(
  health_value DECIMAL,
  health_zone VARCHAR
) AS $$
DECLARE
  v_health DECIMAL;
  v_zone VARCHAR(20);
BEGIN
  -- Calculate weighted health score (0-100)
  v_health := (
    (p_automation_coverage * 0.20) +           -- 20% weight: automation coverage
    (p_template_reuse_ratio * 100 * 0.15) +    -- 15% weight: template reuse
    (p_ai_acceptance_rate * 100 * 0.25) +      -- 25% weight: AI acceptance (key metric)
    (p_avg_definition_score * 0.15) +          -- 15% weight: task clarity
    ((100 - p_friction_score) * 0.15) +        -- 15% weight: low friction
    (GREATEST(0, 100 - p_manual_overrides * 5) * 0.10) -- 10% weight: few overrides
  );

  -- Clamp to 0-100
  v_health := GREATEST(0, LEAST(100, v_health));

  -- Determine zone
  v_zone := CASE
    WHEN v_health >= 80 THEN 'excellent'
    WHEN v_health >= 60 THEN 'optimal'
    WHEN v_health >= 40 THEN 'low'
    ELSE 'critical'
  END;

  RETURN QUERY SELECT
    ROUND(v_health, 2)::DECIMAL,
    v_zone::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Execution Intensity (RPM)
CREATE OR REPLACE FUNCTION calculate_execution_intensity(
  p_concurrent_tasks INTEGER,
  p_active_ai_sessions INTEGER,
  p_active_personas INTEGER,
  p_parallel_streams INTEGER
)
RETURNS TABLE(
  intensity_value INTEGER,
  intensity_zone VARCHAR,
  sustainability DECIMAL
) AS $$
DECLARE
  v_intensity INTEGER;
  v_zone VARCHAR(20);
  v_sustainability DECIMAL;
BEGIN
  -- Calculate intensity as RPM (0-8000 scale)
  -- Each factor contributes to the "spin rate"
  v_intensity := (
    (p_concurrent_tasks * 500) +      -- Each concurrent task = 500 RPM
    (p_active_ai_sessions * 800) +    -- AI sessions are intensive = 800 RPM
    (p_active_personas * 300) +       -- Each persona = 300 RPM
    (p_parallel_streams * 400)        -- Parallel streams = 400 RPM
  );

  -- Cap at 8000
  v_intensity := LEAST(8000, v_intensity);

  -- Determine zone
  v_zone := CASE
    WHEN v_intensity >= 7000 THEN 'excessive'
    WHEN v_intensity >= 5500 THEN 'high'
    WHEN v_intensity >= 3000 THEN 'optimal'
    WHEN v_intensity >= 1000 THEN 'warming'
    ELSE 'idle'
  END;

  -- Calculate sustainability (can this intensity be maintained?)
  v_sustainability := CASE
    WHEN v_intensity >= 7000 THEN 40  -- Very difficult to sustain
    WHEN v_intensity >= 6000 THEN 60
    WHEN v_intensity >= 5000 THEN 75
    WHEN v_intensity >= 3000 THEN 90  -- Optimal, sustainable
    ELSE 100                          -- Easy to sustain
  END;

  RETURN QUERY SELECT
    v_intensity,
    v_zone::VARCHAR,
    ROUND(v_sustainability, 2)::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- Function to record today's operational health metrics
CREATE OR REPLACE FUNCTION record_operational_health()
RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_task_churn INTEGER;
  v_state_changes INTEGER;
  v_rework_count INTEGER;
  v_rework_ratio DECIMAL;
  v_domain_count INTEGER;
  v_concurrent_tasks INTEGER;
  v_completed_today INTEGER;
  v_stress_result RECORD;
  v_health_result RECORD;
  v_intensity_result RECORD;
  v_overall_health DECIMAL;
  v_risk_level VARCHAR(20);
BEGIN
  -- Gather task metrics
  SELECT
    COUNT(*) FILTER (WHERE DATE(created_at) = v_today OR DATE(updated_at) = v_today),
    COUNT(DISTINCT component),
    COUNT(*) FILTER (WHERE status IN ('in_progress', 'in_review', 'fixing')),
    COUNT(*) FILTER (WHERE status = 'completed' AND DATE(completed_at) = v_today)
  INTO v_task_churn, v_domain_count, v_concurrent_tasks, v_completed_today
  FROM admin_tasks;

  -- Count state changes (from task history if available, otherwise estimate)
  v_state_changes := COALESCE(v_task_churn * 2, 0);

  -- Count rework (tasks that went backwards)
  SELECT COUNT(*) INTO v_rework_count
  FROM admin_tasks
  WHERE status IN ('fixing')
    AND DATE(updated_at) = v_today;

  v_rework_ratio := CASE
    WHEN v_completed_today > 0 THEN v_rework_count::DECIMAL / v_completed_today
    ELSE 0
  END;

  -- Calculate each gauge using the functions
  SELECT * INTO v_health_result FROM calculate_workflow_health(
    75,    -- automation_coverage (baseline estimate)
    0.3,   -- template_reuse_ratio
    0.85,  -- ai_acceptance_rate (high for AI-assisted dev)
    2,     -- manual_overrides
    80,    -- avg_definition_score
    20     -- friction_score
  );

  SELECT * INTO v_intensity_result FROM calculate_execution_intensity(
    v_concurrent_tasks,
    2,  -- active_ai_sessions (baseline)
    3,  -- active_personas
    v_domain_count
  );

  SELECT * INTO v_stress_result FROM calculate_system_stress(
    v_task_churn,
    v_state_changes,
    v_rework_ratio,
    v_domain_count,
    5.0,  -- velocity_volatility (baseline)
    0,    -- interruptions
    v_intensity_result.intensity_value,
    v_health_result.health_value
  );

  -- Calculate overall system health
  v_overall_health := (
    ((100 - v_stress_result.stress_value) * 0.35) +  -- Low stress is good
    (v_health_result.health_value * 0.40) +           -- Health is important
    (CASE
      WHEN v_intensity_result.intensity_zone = 'optimal' THEN 85
      WHEN v_intensity_result.intensity_zone IN ('warming', 'high') THEN 70
      WHEN v_intensity_result.intensity_zone = 'idle' THEN 50
      ELSE 40
    END * 0.25)
  );

  -- Determine risk level
  v_risk_level := CASE
    WHEN v_stress_result.stress_zone = 'overheated' OR v_health_result.health_zone = 'critical' THEN 'high'
    WHEN v_stress_result.stress_zone = 'warm' OR v_health_result.health_zone = 'low' THEN 'elevated'
    WHEN v_intensity_result.intensity_zone = 'excessive' THEN 'moderate'
    ELSE 'low'
  END;

  -- Insert or update metrics
  INSERT INTO operational_health_metrics (
    metric_date,
    system_stress, stress_zone,
    task_churn_count, state_change_count, rework_task_count, rework_ratio,
    domain_count,
    workflow_health, health_zone,
    automation_coverage, ai_acceptance_rate,
    execution_intensity, intensity_zone,
    concurrent_tasks, parallel_work_streams,
    stress_from_intensity, stress_from_low_health,
    intensity_sustainability,
    overall_system_health, risk_level
  )
  VALUES (
    v_today,
    v_stress_result.stress_value, v_stress_result.stress_zone,
    v_task_churn, v_state_changes, v_rework_count, v_rework_ratio,
    v_domain_count,
    v_health_result.health_value, v_health_result.health_zone,
    75, 0.85,
    v_intensity_result.intensity_value, v_intensity_result.intensity_zone,
    v_concurrent_tasks, v_domain_count,
    v_stress_result.stress_from_intensity, v_stress_result.stress_from_low_health,
    v_intensity_result.sustainability,
    v_overall_health, v_risk_level
  )
  ON CONFLICT (metric_date) DO UPDATE SET
    system_stress = EXCLUDED.system_stress,
    stress_zone = EXCLUDED.stress_zone,
    task_churn_count = EXCLUDED.task_churn_count,
    state_change_count = EXCLUDED.state_change_count,
    rework_task_count = EXCLUDED.rework_task_count,
    rework_ratio = EXCLUDED.rework_ratio,
    domain_count = EXCLUDED.domain_count,
    workflow_health = EXCLUDED.workflow_health,
    health_zone = EXCLUDED.health_zone,
    execution_intensity = EXCLUDED.execution_intensity,
    intensity_zone = EXCLUDED.intensity_zone,
    concurrent_tasks = EXCLUDED.concurrent_tasks,
    parallel_work_streams = EXCLUDED.parallel_work_streams,
    stress_from_intensity = EXCLUDED.stress_from_intensity,
    stress_from_low_health = EXCLUDED.stress_from_low_health,
    intensity_sustainability = EXCLUDED.intensity_sustainability,
    overall_system_health = EXCLUDED.overall_system_health,
    risk_level = EXCLUDED.risk_level,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA FOR DEMO
-- ============================================
-- Insert baseline metrics for Dec 25, 2025
INSERT INTO operational_health_metrics (
  metric_date,
  system_stress, stress_zone,
  task_churn_count, state_change_count, rework_task_count, rework_ratio,
  domain_count, velocity_volatility,
  workflow_health, health_zone,
  automation_coverage, template_reuse_ratio, ai_acceptance_rate,
  avg_task_definition_score, execution_friction_score,
  execution_intensity, intensity_zone,
  concurrent_tasks, active_ai_sessions, active_personas, parallel_work_streams,
  stress_from_intensity, stress_from_low_health, health_stress_dampening,
  intensity_sustainability,
  overall_system_health, risk_level,
  notes
)
VALUES (
  '2025-12-25',
  35, 'stable',
  8, 24, 1, 0.04,
  5, 3.2,
  82, 'excellent',
  78, 0.35, 0.88,
  85, 15,
  4500, 'optimal',
  9, 2, 3, 5,
  8, 0, 0.70,
  90,
  78, 'low',
  'Initial baseline - stable operations with high AI assistance'
)
ON CONFLICT (metric_date) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE operational_health_metrics IS 'Daily snapshots of system operational health for TEMP (Stress), OIL (Workflow Health), and RPM (Execution Intensity) dashboard gauges';
COMMENT ON COLUMN operational_health_metrics.system_stress IS 'TEMP gauge: 0-100 scale measuring task churn, rework, volatility. <45=stable(green), 45-70=warm(yellow), >70=overheated(red)';
COMMENT ON COLUMN operational_health_metrics.workflow_health IS 'OIL gauge: 0-100 scale measuring automation, AI acceptance, friction. Displayed as PSI (0-100). High=smooth workflows';
COMMENT ON COLUMN operational_health_metrics.execution_intensity IS 'RPM gauge: 0-8000 scale measuring concurrent work intensity. 3000-5500=optimal, >7000=excessive risk';
COMMENT ON FUNCTION calculate_system_stress IS 'Calculates System Stress (TEMP) from task churn, rework, volatility, with RPM and OIL interactions';
COMMENT ON FUNCTION calculate_workflow_health IS 'Calculates Workflow Health (OIL) from automation coverage, AI acceptance, task clarity';
COMMENT ON FUNCTION calculate_execution_intensity IS 'Calculates Execution Intensity (RPM) from concurrent tasks, AI sessions, parallel streams';
