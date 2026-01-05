-- Migration 076: Work Estimation Framework
-- Purpose: Store granular work breakdown for accurate EHH estimation
-- This enables traditional estimation based on actual deliverables

-- ============================================================================
-- WORK ESTIMATION BREAKDOWN TABLE
-- Stores component-level breakdown of work for each task
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_estimation_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,

  -- What was produced
  component_type VARCHAR(50) NOT NULL,
  -- Valid types: 'migration', 'service', 'endpoint', 'page', 'component',
  --              'bugfix', 'research', 'documentation', 'operational', 'feature'

  component_name VARCHAR(200),
  component_description TEXT,

  -- Deliverable metrics (for validation)
  lines_of_code INTEGER,
  files_created INTEGER,
  files_modified INTEGER,

  -- Traditional estimation (in human hours WITHOUT AI)
  estimated_human_hours_low DECIMAL(10,2) NOT NULL,
  estimated_human_hours_high DECIMAL(10,2) NOT NULL,
  estimated_human_hours_median DECIMAL(10,2)
    GENERATED ALWAYS AS ((estimated_human_hours_low + estimated_human_hours_high) / 2) STORED,

  -- Complexity assessment
  complexity VARCHAR(20) NOT NULL DEFAULT 'moderate',
  -- Valid: 'simple', 'moderate', 'complex'

  -- Estimation rationale (for auditing)
  estimation_notes TEXT,
  comparable_industry_reference TEXT,
  -- E.g., "Similar to building a RESTful API from scratch - industry standard 40-80 hours"

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT valid_complexity CHECK (complexity IN ('simple', 'moderate', 'complex')),
  CONSTRAINT valid_component_type CHECK (component_type IN (
    'migration', 'service', 'endpoint', 'page', 'component',
    'bugfix', 'research', 'documentation', 'operational', 'feature'
  )),
  CONSTRAINT valid_estimation_range CHECK (estimated_human_hours_low <= estimated_human_hours_high)
);

-- Indexes for efficient queries
CREATE INDEX idx_work_breakdown_task ON work_estimation_breakdown(task_id);
CREATE INDEX idx_work_breakdown_type ON work_estimation_breakdown(component_type);
CREATE INDEX idx_work_breakdown_created ON work_estimation_breakdown(created_at);

-- ============================================================================
-- ESTIMATION GUIDELINES TABLE
-- Reference data for traditional estimation ranges
-- ============================================================================

CREATE TABLE IF NOT EXISTS estimation_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  component_type VARCHAR(50) NOT NULL,
  complexity VARCHAR(20) NOT NULL,

  -- Estimation range
  hours_low DECIMAL(10,2) NOT NULL,
  hours_high DECIMAL(10,2) NOT NULL,
  hours_median DECIMAL(10,2) GENERATED ALWAYS AS ((hours_low + hours_high) / 2) STORED,

  -- Description for UI/documentation
  description TEXT NOT NULL,
  examples TEXT,

  -- Validity
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,  -- NULL = currently active

  -- Unique constraint for active guidelines
  UNIQUE(component_type, complexity, effective_until)
);

-- ============================================================================
-- SEED DEFAULT ESTIMATION GUIDELINES
-- Based on traditional software estimation methodology
-- ============================================================================

INSERT INTO estimation_guidelines (component_type, complexity, hours_low, hours_high, description, examples) VALUES
  -- Database/Migration work
  ('migration', 'simple', 2, 4, 'Simple migration (1-2 tables, basic columns)', 'Add a timestamp column, create a simple lookup table'),
  ('migration', 'moderate', 8, 16, 'Moderate migration (3-5 tables, relationships)', 'Create user preferences system, add foreign keys'),
  ('migration', 'complex', 16, 40, 'Complex migration (10+ tables, triggers, functions)', 'Design complete schema for new feature, add stored procedures'),

  -- Service/Backend work
  ('service', 'simple', 20, 40, 'Small service (~200 LOC)', 'Simple utility service, basic CRUD wrapper'),
  ('service', 'moderate', 40, 80, 'Medium service (~500 LOC)', 'Business logic service with validation'),
  ('service', 'complex', 80, 160, 'Large service (~1000+ LOC)', 'AI integration, complex business rules'),

  -- API Endpoints
  ('endpoint', 'simple', 4, 8, 'Simple CRUD endpoint', 'GET/POST for a resource'),
  ('endpoint', 'moderate', 8, 16, 'Endpoint with business logic', 'Endpoint with validation, permissions'),
  ('endpoint', 'complex', 16, 32, 'Complex endpoint with integrations', 'Payment processing, third-party APIs'),

  -- Frontend Pages
  ('page', 'simple', 8, 16, 'Simple static page', 'About page, simple form'),
  ('page', 'moderate', 16, 32, 'Page with forms and state', 'Settings page, search results'),
  ('page', 'complex', 24, 48, 'Complex page with state management', 'Dashboard, real-time updates'),

  -- Components
  ('component', 'simple', 2, 4, 'Simple reusable component', 'Button, input field'),
  ('component', 'moderate', 4, 8, 'Component with some logic', 'Form field with validation'),
  ('component', 'complex', 8, 16, 'Complex component', 'Data grid, chart, rich editor'),

  -- Bug fixes
  ('bugfix', 'simple', 2, 4, 'Obvious fix, clear error', 'Typo fix, null check'),
  ('bugfix', 'moderate', 4, 8, 'Investigation required', 'Logic error, edge case'),
  ('bugfix', 'complex', 8, 24, 'Deep debugging, intermittent issues', 'Race condition, memory leak'),

  -- Research/Design
  ('research', 'simple', 2, 4, 'Quick investigation or spike', 'Library evaluation'),
  ('research', 'moderate', 8, 16, 'Technology evaluation', 'Compare frameworks'),
  ('research', 'complex', 16, 40, 'Deep architectural research', 'System design, scalability analysis'),

  -- Documentation
  ('documentation', 'simple', 2, 4, 'Simple doc update', 'Update README, add comments'),
  ('documentation', 'moderate', 4, 12, 'Comprehensive documentation', 'API docs, user guide section'),
  ('documentation', 'complex', 12, 24, 'Full documentation suite', 'Complete developer guide'),

  -- Operational
  ('operational', 'simple', 1, 2, 'Simple operational task', 'Config change, restart service'),
  ('operational', 'moderate', 2, 8, 'Moderate operational task', 'Deploy, database sync'),
  ('operational', 'complex', 8, 24, 'Complex operational task', 'Migration, data recovery'),

  -- Features (full-stack)
  ('feature', 'simple', 40, 80, 'Small feature (single component)', 'Add export button with backend'),
  ('feature', 'moderate', 80, 200, 'Medium feature (full stack)', 'User preferences, notifications'),
  ('feature', 'complex', 200, 500, 'Large feature or subsystem', 'Chat system, billing module')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- ADD ESTIMATION COLUMNS TO ADMIN_TASKS
-- ============================================================================

ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS ehh_estimation_method VARCHAR(50) DEFAULT 'traditional',
ADD COLUMN IF NOT EXISTS ehh_low DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS ehh_high DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS primary_component_type VARCHAR(50);

COMMENT ON COLUMN admin_tasks.ehh_estimation_method IS 'Method used for EHH estimation: traditional, formula, manual';
COMMENT ON COLUMN admin_tasks.ehh_low IS 'Low end of EHH estimate range';
COMMENT ON COLUMN admin_tasks.ehh_high IS 'High end of EHH estimate range';
COMMENT ON COLUMN admin_tasks.primary_component_type IS 'Primary type of work (migration, service, page, etc.)';

-- ============================================================================
-- FUNCTION: Get Estimation Guideline
-- Returns the appropriate estimation range for a component type and complexity
-- ============================================================================

CREATE OR REPLACE FUNCTION get_estimation_guideline(
  p_component_type VARCHAR,
  p_complexity VARCHAR DEFAULT 'moderate'
)
RETURNS TABLE (hours_low DECIMAL, hours_high DECIMAL, hours_median DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT eg.hours_low, eg.hours_high, eg.hours_median
  FROM estimation_guidelines eg
  WHERE eg.component_type = p_component_type
    AND eg.complexity = p_complexity
    AND eg.effective_until IS NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Calculate Task EHH from Breakdown
-- Sums all component estimates for a task
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_task_ehh_from_breakdown(p_task_id UUID)
RETURNS TABLE (
  ehh_low DECIMAL,
  ehh_high DECIMAL,
  ehh_median DECIMAL,
  component_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(web.estimated_human_hours_low), 0) as ehh_low,
    COALESCE(SUM(web.estimated_human_hours_high), 0) as ehh_high,
    COALESCE(SUM(web.estimated_human_hours_median), 0) as ehh_median,
    COUNT(*)::INTEGER as component_count
  FROM work_estimation_breakdown web
  WHERE web.task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEW: Task Estimation Summary
-- Aggregated view of task estimations with breakdown details
-- ============================================================================

CREATE OR REPLACE VIEW v_task_estimation_summary AS
SELECT
  t.id as task_id,
  t.task_code,
  t.title,
  t.ehh_estimation_method,
  t.effort_hours as current_ehh,
  t.frozen_ehh,
  t.ehh_low,
  t.ehh_high,
  COALESCE(breakdown.component_count, 0) as breakdown_components,
  COALESCE(breakdown.total_ehh_low, 0) as breakdown_ehh_low,
  COALESCE(breakdown.total_ehh_high, 0) as breakdown_ehh_high,
  COALESCE(breakdown.total_ehh_median, 0) as breakdown_ehh_median,
  CASE
    WHEN t.frozen_ehh IS NOT NULL THEN 'frozen'
    WHEN breakdown.component_count > 0 THEN 'breakdown'
    WHEN t.effort_hours IS NOT NULL THEN 'estimated'
    ELSE 'pending'
  END as estimation_status
FROM admin_tasks t
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as component_count,
    SUM(estimated_human_hours_low) as total_ehh_low,
    SUM(estimated_human_hours_high) as total_ehh_high,
    SUM(estimated_human_hours_median) as total_ehh_median
  FROM work_estimation_breakdown
  WHERE task_id = t.id
) breakdown ON true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE work_estimation_breakdown IS 'Component-level breakdown of work for accurate EHH estimation using traditional methodology';
COMMENT ON TABLE estimation_guidelines IS 'Reference data for traditional software development time estimates';
COMMENT ON VIEW v_task_estimation_summary IS 'Aggregated view of task estimations showing current values and breakdown summaries';
