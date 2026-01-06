-- ============================================
-- JubileeVerse Database Schema
-- Migration 034: Dashboard Metrics & Session Tracking
-- ============================================
-- Supports the velocity dashboard with weekly tracking,
-- session time logging, and gas gauge functionality.

-- Weekly Dashboard Snapshots
-- Stores weekly rollups of task metrics for historical tracking
CREATE TABLE IF NOT EXISTS dashboard_weekly_snapshots (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,           -- Monday of the week
  week_end DATE NOT NULL,             -- Sunday of the week

  -- Work Remaining metrics
  tasks_submitted INTEGER DEFAULT 0,
  tasks_in_review INTEGER DEFAULT 0,
  tasks_in_progress INTEGER DEFAULT 0,
  tasks_fixing INTEGER DEFAULT 0,
  total_pending INTEGER DEFAULT 0,
  pending_heh DECIMAL(8,2) DEFAULT 0,

  -- Progress Made metrics
  tasks_completed INTEGER DEFAULT 0,
  completed_heh DECIMAL(8,2) DEFAULT 0,
  bugs_fixed INTEGER DEFAULT 0,

  -- Velocity metrics
  velocity_wph DECIMAL(6,2) DEFAULT 0,   -- Work Per Hour
  velocity_ratio DECIMAL(4,2) DEFAULT 0,

  -- Time tracking
  hours_logged DECIMAL(6,2) DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(week_start)
);

-- Session Time Tracking
-- Records active work sessions for gas gauge calculation
CREATE TABLE IF NOT EXISTS work_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Session timing
  session_start TIMESTAMP WITH TIME ZONE NOT NULL,
  session_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,            -- Computed on session end

  -- Week reference
  week_start DATE NOT NULL,            -- Monday of the session's week

  -- Session metadata
  session_type VARCHAR(50) DEFAULT 'active',  -- 'active', 'break', 'meeting'
  notes TEXT,

  -- Automatic tracking
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Time Log
-- Aggregates session time by day for easier querying
CREATE TABLE IF NOT EXISTS daily_time_log (
  id SERIAL PRIMARY KEY,
  log_date DATE NOT NULL,
  week_start DATE NOT NULL,            -- Monday of the week

  -- Time metrics
  hours_worked DECIMAL(5,2) DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,

  -- Breakdown by session type
  active_hours DECIMAL(5,2) DEFAULT 0,
  break_hours DECIMAL(5,2) DEFAULT 0,
  meeting_hours DECIMAL(5,2) DEFAULT 0,

  -- Task metrics for the day
  tasks_completed INTEGER DEFAULT 0,
  heh_delivered DECIMAL(6,2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(log_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_week ON dashboard_weekly_snapshots(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_work_sessions_week ON work_sessions(week_start, session_start);
CREATE INDEX IF NOT EXISTS idx_work_sessions_active ON work_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_daily_time_log_week ON daily_time_log(week_start, log_date);

-- Function to get Monday of current week
CREATE OR REPLACE FUNCTION get_week_start(target_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  RETURN target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate weekly hours remaining (gas gauge)
CREATE OR REPLACE FUNCTION get_weekly_hours_remaining(target_week DATE DEFAULT NULL)
RETURNS DECIMAL AS $$
DECLARE
  week_start_date DATE;
  total_hours DECIMAL;
  tank_capacity DECIMAL := 40.0;  -- 40 hours per week
BEGIN
  week_start_date := COALESCE(target_week, get_week_start(CURRENT_DATE));

  SELECT COALESCE(SUM(hours_worked), 0) INTO total_hours
  FROM daily_time_log
  WHERE week_start = week_start_date;

  RETURN GREATEST(tank_capacity - total_hours, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update or create current week snapshot
CREATE OR REPLACE FUNCTION update_weekly_snapshot()
RETURNS void AS $$
DECLARE
  week_start_date DATE;
  week_end_date DATE;
BEGIN
  week_start_date := get_week_start(CURRENT_DATE);
  week_end_date := week_start_date + 6;

  INSERT INTO dashboard_weekly_snapshots (
    week_start, week_end,
    tasks_submitted, tasks_in_review, tasks_in_progress, tasks_fixing, total_pending, pending_heh,
    tasks_completed, completed_heh, bugs_fixed,
    hours_logged, sessions_count,
    updated_at
  )
  SELECT
    week_start_date,
    week_end_date,
    COUNT(*) FILTER (WHERE status = 'submitted'),
    COUNT(*) FILTER (WHERE status = 'in_review'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'fixing'),
    COUNT(*) FILTER (WHERE status NOT IN ('completed')),
    COALESCE(SUM(effort_hours) FILTER (WHERE status NOT IN ('completed')), 0),
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= week_start_date),
    COALESCE(SUM(effort_hours) FILTER (WHERE status = 'completed' AND completed_at >= week_start_date), 0),
    COUNT(*) FILTER (WHERE status = 'completed' AND task_type = 'bug' AND completed_at >= week_start_date),
    (SELECT COALESCE(SUM(hours_worked), 0) FROM daily_time_log WHERE week_start = week_start_date),
    (SELECT COALESCE(SUM(sessions_count), 0) FROM daily_time_log WHERE week_start = week_start_date),
    NOW()
  FROM admin_tasks
  ON CONFLICT (week_start) DO UPDATE SET
    tasks_submitted = EXCLUDED.tasks_submitted,
    tasks_in_review = EXCLUDED.tasks_in_review,
    tasks_in_progress = EXCLUDED.tasks_in_progress,
    tasks_fixing = EXCLUDED.tasks_fixing,
    total_pending = EXCLUDED.total_pending,
    pending_heh = EXCLUDED.pending_heh,
    tasks_completed = EXCLUDED.tasks_completed,
    completed_heh = EXCLUDED.completed_heh,
    bugs_fixed = EXCLUDED.bugs_fixed,
    hours_logged = EXCLUDED.hours_logged,
    sessions_count = EXCLUDED.sessions_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE dashboard_weekly_snapshots IS 'Weekly rollups of task and time metrics for the velocity dashboard';
COMMENT ON TABLE work_sessions IS 'Tracks active work sessions for gas gauge time consumption';
COMMENT ON TABLE daily_time_log IS 'Daily aggregation of work time for quick weekly queries';
COMMENT ON FUNCTION get_week_start IS 'Returns the Monday date for any given date';
COMMENT ON FUNCTION get_weekly_hours_remaining IS 'Calculates remaining hours in the 40-hour weekly tank';

-- Backfill: Create initial weekly snapshot
SELECT update_weekly_snapshot();

-- Backfill: Log estimated hours for completed tasks this week
-- Assumes 8 hours per day for the 4 days of development
INSERT INTO daily_time_log (log_date, week_start, hours_worked, sessions_count, active_hours, tasks_completed, heh_delivered)
VALUES
  ('2025-12-21', get_week_start('2025-12-21'::DATE), 8.0, 1, 8.0, 0, 0),
  ('2025-12-22', get_week_start('2025-12-22'::DATE), 8.0, 1, 8.0, 0, 0),
  ('2025-12-23', get_week_start('2025-12-23'::DATE), 8.0, 1, 8.0, 0, 0),
  ('2025-12-24', get_week_start('2025-12-24'::DATE), 8.0, 1, 8.0, 0, 0)
ON CONFLICT (log_date) DO NOTHING;
