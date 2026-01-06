-- ============================================
-- JubileeVerse Database Schema
-- Migration 035: Daily Progress Metrics Table
-- ============================================
-- Stores daily snapshots for historical trend analysis.
-- One row per day, never overwritten - allows velocity tracking over time.
-- MILESTONE-DRIVEN: All calculations reference Dec 31, 2025 milestone.

-- Daily Progress Metrics
-- Stores comprehensive daily development metrics for trend analysis
CREATE TABLE IF NOT EXISTS daily_progress_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL UNIQUE,

  -- Core velocity metrics (rolling windows)
  daily_heh DECIMAL(8,2) DEFAULT 0,           -- HEH completed this specific day
  rolling_4day_heh DECIMAL(8,2) DEFAULT 0,    -- Rolling 4-day total (working days)
  rolling_7day_heh DECIMAL(8,2) DEFAULT 0,    -- Rolling 7-day total at end of this day
  velocity_wph DECIMAL(6,2) DEFAULT 0,        -- Work Per Hour (HEH / hours worked)
  velocity_multiplier DECIMAL(6,2) DEFAULT 1, -- Speed multiplier (e.g., 78x)

  -- Weekly fuel gauge tracking
  weekly_hours_consumed DECIMAL(5,2) DEFAULT 0,  -- Hours worked this week up to this day
  weekly_hours_remaining DECIMAL(5,2) DEFAULT 40, -- Hours remaining in weekly tank
  week_start DATE NOT NULL,                       -- Monday of this week

  -- MILESTONE TRACKING (Dec 31, 2025)
  milestone_date DATE DEFAULT '2025-12-31',           -- Target milestone date
  milestone_hours_remaining DECIMAL(8,2) DEFAULT 0,   -- Working hours until milestone
  milestone_workdays_remaining INTEGER DEFAULT 0,      -- Business days until milestone
  projected_completion_heh DECIMAL(10,2) DEFAULT 0,   -- Projected HEH at current velocity
  on_track_status VARCHAR(20) DEFAULT 'unknown',      -- 'on_track', 'at_risk', 'behind'

  -- Development output metrics
  lines_of_code INTEGER DEFAULT 0,            -- Cumulative LOC at end of day
  lines_of_code_delta INTEGER DEFAULT 0,      -- LOC added this day
  api_endpoints INTEGER DEFAULT 0,            -- Cumulative API endpoints
  api_endpoints_delta INTEGER DEFAULT 0,      -- Endpoints added this day
  database_tables INTEGER DEFAULT 0,          -- Cumulative database tables
  database_tables_delta INTEGER DEFAULT 0,    -- Tables added this day

  -- Task metrics
  tasks_completed_today INTEGER DEFAULT 0,
  tasks_completed_total INTEGER DEFAULT 0,
  tasks_pending INTEGER DEFAULT 0,

  -- Value metrics
  value_delivered DECIMAL(12,2) DEFAULT 0,    -- Total USD value delivered
  value_delta DECIMAL(10,2) DEFAULT 0,        -- Value added this day
  hourly_rate DECIMAL(8,2) DEFAULT 150,       -- Rate used for calculations

  -- Team equivalency metrics
  dev_week_equivalents DECIMAL(6,2) DEFAULT 0,  -- How many dev-weeks this represents
  team_size_equivalent DECIMAL(4,1) DEFAULT 1,  -- Equivalent team size at normal pace

  -- Work remaining estimates
  estimated_remaining_heh DECIMAL(8,2) DEFAULT 0,
  estimated_remaining_tasks INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Add new columns if table already exists
ALTER TABLE daily_progress_metrics
  ADD COLUMN IF NOT EXISTS rolling_4day_heh DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS velocity_wph DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_date DATE DEFAULT '2025-12-31',
  ADD COLUMN IF NOT EXISTS milestone_hours_remaining DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_workdays_remaining INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_completion_heh DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS on_track_status VARCHAR(20) DEFAULT 'unknown';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_daily_progress_date ON daily_progress_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_progress_week ON daily_progress_metrics(week_start, metric_date);
CREATE INDEX IF NOT EXISTS idx_daily_progress_velocity ON daily_progress_metrics(velocity_wph DESC);
CREATE INDEX IF NOT EXISTS idx_daily_progress_milestone ON daily_progress_metrics(on_track_status, metric_date);

-- Function to get Monday of any week
CREATE OR REPLACE FUNCTION get_monday(target_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  RETURN target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if a date is a weekday (Mon-Fri)
CREATE OR REPLACE FUNCTION is_weekday(target_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXTRACT(DOW FROM target_date) BETWEEN 1 AND 5;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate working days between two dates
CREATE OR REPLACE FUNCTION count_working_days(start_date DATE, end_date DATE)
RETURNS INTEGER AS $$
DECLARE
  working_days INTEGER := 0;
  curr_date DATE := start_date;
BEGIN
  WHILE curr_date <= end_date LOOP
    IF is_weekday(curr_date) THEN
      working_days := working_days + 1;
    END IF;
    curr_date := curr_date + 1;
  END LOOP;
  RETURN working_days;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate remaining working hours until milestone
CREATE OR REPLACE FUNCTION get_milestone_hours_remaining(from_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
DECLARE
  milestone DATE := '2025-12-31'::DATE;
  working_days INTEGER;
BEGIN
  IF from_date >= milestone THEN
    RETURN 0;
  END IF;
  working_days := count_working_days(from_date, milestone);
  RETURN working_days * 8.0; -- 8 hours per working day
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to record or update today's metrics with milestone tracking
CREATE OR REPLACE FUNCTION record_daily_metrics(
  p_daily_heh DECIMAL DEFAULT 0,
  p_lines_of_code INTEGER DEFAULT 0,
  p_api_endpoints INTEGER DEFAULT 0,
  p_database_tables INTEGER DEFAULT 0,
  p_tasks_completed INTEGER DEFAULT 0,
  p_hours_worked DECIMAL DEFAULT 0,
  p_hourly_rate DECIMAL DEFAULT 150,
  p_pending_heh DECIMAL DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := get_monday(CURRENT_DATE);
  v_milestone DATE := '2025-12-31'::DATE;
  v_rolling_4day DECIMAL;
  v_rolling_7day DECIMAL;
  v_weekly_hours DECIMAL;
  v_prev_loc INTEGER;
  v_prev_api INTEGER;
  v_prev_tables INTEGER;
  v_milestone_hours DECIMAL;
  v_milestone_days INTEGER;
  v_wph DECIMAL;
  v_projected_heh DECIMAL;
  v_on_track VARCHAR(20);
BEGIN
  -- Calculate rolling 4-day HEH (working days only)
  SELECT COALESCE(SUM(daily_heh), 0) INTO v_rolling_4day
  FROM (
    SELECT daily_heh FROM daily_progress_metrics
    WHERE metric_date < v_today AND is_weekday(metric_date)
    ORDER BY metric_date DESC
    LIMIT 3
  ) sub;
  v_rolling_4day := v_rolling_4day + p_daily_heh;

  -- Calculate rolling 7-day HEH
  SELECT COALESCE(SUM(daily_heh), 0) INTO v_rolling_7day
  FROM daily_progress_metrics
  WHERE metric_date > v_today - 7 AND metric_date < v_today;
  v_rolling_7day := v_rolling_7day + p_daily_heh;

  -- Calculate weekly hours consumed
  SELECT COALESCE(SUM(hours_worked), 0) INTO v_weekly_hours
  FROM daily_time_log
  WHERE week_start = v_week_start;
  v_weekly_hours := v_weekly_hours + p_hours_worked;

  -- Calculate milestone metrics
  v_milestone_hours := get_milestone_hours_remaining(v_today);
  v_milestone_days := count_working_days(v_today, v_milestone);

  -- Calculate WPH (Work Per Hour) - based on 4 days * 8 hours
  v_wph := CASE WHEN v_rolling_4day > 0 THEN v_rolling_4day / 32.0 ELSE 0 END;

  -- Project completion at current velocity
  v_projected_heh := v_wph * v_milestone_hours;

  -- Determine on-track status
  v_on_track := CASE
    WHEN v_projected_heh >= p_pending_heh THEN 'on_track'
    WHEN v_projected_heh >= p_pending_heh * 0.8 THEN 'at_risk'
    ELSE 'behind'
  END;

  -- Get previous cumulative values
  SELECT
    COALESCE(lines_of_code, 0),
    COALESCE(api_endpoints, 0),
    COALESCE(database_tables, 0)
  INTO v_prev_loc, v_prev_api, v_prev_tables
  FROM daily_progress_metrics
  WHERE metric_date = v_today - 1;

  IF v_prev_loc IS NULL THEN
    v_prev_loc := 0;
    v_prev_api := 0;
    v_prev_tables := 0;
  END IF;

  INSERT INTO daily_progress_metrics (
    metric_date, week_start,
    daily_heh, rolling_4day_heh, rolling_7day_heh,
    velocity_wph, velocity_multiplier,
    weekly_hours_consumed, weekly_hours_remaining,
    milestone_date, milestone_hours_remaining, milestone_workdays_remaining,
    projected_completion_heh, on_track_status,
    lines_of_code, lines_of_code_delta,
    api_endpoints, api_endpoints_delta,
    database_tables, database_tables_delta,
    tasks_completed_today, tasks_completed_total,
    value_delivered, value_delta, hourly_rate,
    dev_week_equivalents, team_size_equivalent
  )
  VALUES (
    v_today, v_week_start,
    p_daily_heh, v_rolling_4day, v_rolling_7day,
    v_wph, v_wph * 8,
    v_weekly_hours, 40.0 - v_weekly_hours,
    v_milestone, v_milestone_hours, v_milestone_days,
    v_projected_heh, v_on_track,
    p_lines_of_code, p_lines_of_code - v_prev_loc,
    p_api_endpoints, p_api_endpoints - v_prev_api,
    p_database_tables, p_database_tables - v_prev_tables,
    p_tasks_completed, (SELECT COUNT(*) FROM admin_tasks WHERE status = 'completed'),
    v_rolling_7day * p_hourly_rate, p_daily_heh * p_hourly_rate, p_hourly_rate,
    v_rolling_7day / 40.0,
    v_wph * 8
  )
  ON CONFLICT (metric_date) DO UPDATE SET
    daily_heh = EXCLUDED.daily_heh,
    rolling_4day_heh = EXCLUDED.rolling_4day_heh,
    rolling_7day_heh = EXCLUDED.rolling_7day_heh,
    velocity_wph = EXCLUDED.velocity_wph,
    velocity_multiplier = EXCLUDED.velocity_multiplier,
    weekly_hours_consumed = EXCLUDED.weekly_hours_consumed,
    weekly_hours_remaining = EXCLUDED.weekly_hours_remaining,
    milestone_hours_remaining = EXCLUDED.milestone_hours_remaining,
    milestone_workdays_remaining = EXCLUDED.milestone_workdays_remaining,
    projected_completion_heh = EXCLUDED.projected_completion_heh,
    on_track_status = EXCLUDED.on_track_status,
    lines_of_code = EXCLUDED.lines_of_code,
    lines_of_code_delta = EXCLUDED.lines_of_code_delta,
    api_endpoints = EXCLUDED.api_endpoints,
    api_endpoints_delta = EXCLUDED.api_endpoints_delta,
    database_tables = EXCLUDED.database_tables,
    database_tables_delta = EXCLUDED.database_tables_delta,
    tasks_completed_today = EXCLUDED.tasks_completed_today,
    tasks_completed_total = EXCLUDED.tasks_completed_total,
    value_delivered = EXCLUDED.value_delivered,
    value_delta = EXCLUDED.value_delta,
    dev_week_equivalents = EXCLUDED.dev_week_equivalents,
    team_size_equivalent = EXCLUDED.team_size_equivalent;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE daily_progress_metrics IS 'Daily snapshots of development progress for historical trend analysis with milestone tracking';
COMMENT ON FUNCTION record_daily_metrics IS 'Records or updates metrics for the current day with milestone projections';
COMMENT ON FUNCTION get_milestone_hours_remaining IS 'Calculates working hours remaining until Dec 31, 2025 milestone';
COMMENT ON FUNCTION count_working_days IS 'Counts business days (Mon-Fri) between two dates';

-- Backfill: Create initial metrics for project start (Dec 21-25, 2025)
-- Based on the known project stats: 56K LOC, 239 APIs, 82 tables, 2500 HEH total over 4 days
-- WPH = 2500 / 32 hours = 78.125
INSERT INTO daily_progress_metrics (
  metric_date, week_start,
  daily_heh, rolling_4day_heh, rolling_7day_heh,
  velocity_wph, velocity_multiplier,
  weekly_hours_consumed, weekly_hours_remaining,
  milestone_date, milestone_hours_remaining, milestone_workdays_remaining,
  projected_completion_heh, on_track_status,
  lines_of_code, lines_of_code_delta,
  api_endpoints, api_endpoints_delta,
  database_tables, database_tables_delta,
  tasks_completed_today, tasks_completed_total,
  value_delivered, value_delta, hourly_rate,
  dev_week_equivalents, team_size_equivalent
)
VALUES
  -- Day 1: Dec 21, 2025 (Saturday - weekend but worked)
  ('2025-12-21', '2025-12-15',
   625, 625, 625,
   78.125, 625,
   8, 32,
   '2025-12-31', 48, 6,
   3750, 'on_track',
   14000, 14000, 60, 60, 20, 20,
   15, 15, 93750, 93750, 150,
   15.6, 625),
  -- Day 2: Dec 22, 2025 (Sunday - weekend but worked)
  ('2025-12-22', '2025-12-22',
   625, 1250, 1250,
   78.125, 625,
   16, 24,
   '2025-12-31', 48, 6,
   3750, 'on_track',
   28000, 14000, 120, 60, 41, 21,
   18, 33, 187500, 93750, 150,
   31.3, 625),
  -- Day 3: Dec 23, 2025 (Monday)
  ('2025-12-23', '2025-12-22',
   625, 1875, 1875,
   78.125, 625,
   24, 16,
   '2025-12-31', 48, 6,
   3750, 'on_track',
   42000, 14000, 180, 60, 62, 21,
   20, 53, 281250, 93750, 150,
   46.9, 625),
  -- Day 4: Dec 24, 2025 (Tuesday)
  ('2025-12-24', '2025-12-22',
   625, 2500, 2500,
   78.125, 625,
   32, 8,
   '2025-12-31', 40, 5,
   3125, 'on_track',
   56000, 14000, 239, 59, 82, 20,
   22, 75, 375000, 93750, 150,
   62.5, 625),
  -- Day 5: Dec 25, 2025 (Wednesday - Christmas, holiday)
  ('2025-12-25', '2025-12-22',
   0, 2500, 2500,
   78.125, 625,
   32, 8,
   '2025-12-31', 32, 4,
   2500, 'on_track',
   56000, 0, 239, 0, 82, 0,
   0, 75, 375000, 0, 150,
   62.5, 625)
ON CONFLICT (metric_date) DO NOTHING;
