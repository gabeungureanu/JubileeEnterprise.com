/**
 * DashboardMetrics Model
 * Handles weekly dashboard snapshots, session tracking, and gas gauge calculations
 */

const database = require('../database');

/**
 * Get the Monday date for a given date (start of work week)
 */
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

/**
 * Get current week's dashboard metrics
 */
async function getCurrentWeekMetrics() {
  const weekStart = getWeekStart();

  // First ensure tables exist
  await ensureTablesExist();

  const result = await database.query(`
    WITH current_tasks AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE status = 'in_review') as in_review,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'fixing') as fixing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status != 'completed') as total_pending,
        COALESCE(SUM(COALESCE(effort_hours, 2.0)) FILTER (WHERE status != 'completed'), 0) as pending_ehh,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= $1::DATE) as completed_this_week,
        COALESCE(SUM(COALESCE(effort_hours, 2.0)) FILTER (WHERE status = 'completed' AND completed_at >= $1::DATE), 0) as completed_ehh_this_week,
        COUNT(*) FILTER (WHERE status = 'completed' AND task_type = 'bug' AND completed_at >= $1::DATE) as bugs_fixed_this_week
      FROM admin_tasks
    ),
    weekly_time AS (
      SELECT
        COALESCE(SUM(hours_worked), 0) as hours_logged,
        COALESCE(SUM(sessions_count), 0) as sessions
      FROM daily_time_log
      WHERE week_start = $1::DATE
    )
    SELECT
      t.*,
      w.hours_logged,
      w.sessions,
      40.0 - w.hours_logged as hours_remaining
    FROM current_tasks t, weekly_time w
  `, [weekStart]);

  const row = result.rows[0] || {};

  return {
    weekStart,
    weekEnd: new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

    // Work Remaining (Left Panel)
    workRemaining: {
      submitted: parseInt(row.submitted, 10) || 0,
      inReview: parseInt(row.in_review, 10) || 0,
      inProgress: parseInt(row.in_progress, 10) || 0,
      fixing: parseInt(row.fixing, 10) || 0,
      totalPending: parseInt(row.total_pending, 10) || 0,
      pendingEHH: parseFloat(row.pending_ehh) || 0
    },

    // Progress Made (Right Panel)
    progressMade: {
      totalCompleted: parseInt(row.completed, 10) || 0,
      completedThisWeek: parseInt(row.completed_this_week, 10) || 0,
      completedEHH: parseFloat(row.completed_ehh_this_week) || 0,
      bugsFixed: parseInt(row.bugs_fixed_this_week, 10) || 0
    },

    // Time Tracking (Gas Gauge)
    timeTracking: {
      hoursLogged: parseFloat(row.hours_logged) || 0,
      hoursRemaining: Math.max(parseFloat(row.hours_remaining) || 40, 0),
      tankCapacity: 40,
      sessionsCount: parseInt(row.sessions, 10) || 0,
      fuelPercent: Math.max(0, Math.min(100, ((40 - parseFloat(row.hours_logged)) / 40) * 100))
    },

    calculatedAt: new Date().toISOString()
  };
}

/**
 * Start a new work session
 */
async function startSession(userId = null, sessionType = 'active') {
  const weekStart = getWeekStart();

  const result = await database.query(`
    INSERT INTO work_sessions (user_id, session_start, week_start, session_type, is_active)
    VALUES ($1, NOW(), $2::DATE, $3, true)
    RETURNING id, session_start
  `, [userId, weekStart, sessionType]);

  return result.rows[0];
}

/**
 * End an active work session
 */
async function endSession(sessionId) {
  const result = await database.query(`
    UPDATE work_sessions
    SET
      session_end = NOW(),
      duration_minutes = EXTRACT(EPOCH FROM (NOW() - session_start)) / 60,
      is_active = false
    WHERE id = $1
    RETURNING id, session_start, session_end, duration_minutes
  `, [sessionId]);

  if (result.rows[0]) {
    // Update daily time log
    await updateDailyTimeLog(result.rows[0]);
  }

  return result.rows[0];
}

/**
 * Get active session for a user
 */
async function getActiveSession(userId = null) {
  const result = await database.query(`
    SELECT id, session_start, session_type
    FROM work_sessions
    WHERE is_active = true
    ${userId ? 'AND user_id = $1' : ''}
    ORDER BY session_start DESC
    LIMIT 1
  `, userId ? [userId] : []);

  return result.rows[0] || null;
}

/**
 * Update daily time log after session ends
 */
async function updateDailyTimeLog(session) {
  const logDate = new Date(session.session_start).toISOString().split('T')[0];
  const weekStart = getWeekStart(new Date(session.session_start));
  const hoursWorked = (session.duration_minutes || 0) / 60;

  await database.query(`
    INSERT INTO daily_time_log (log_date, week_start, hours_worked, sessions_count, active_hours)
    VALUES ($1::DATE, $2::DATE, $3, 1, $3)
    ON CONFLICT (log_date) DO UPDATE SET
      hours_worked = daily_time_log.hours_worked + $3,
      sessions_count = daily_time_log.sessions_count + 1,
      active_hours = daily_time_log.active_hours + $3,
      updated_at = NOW()
  `, [logDate, weekStart, hoursWorked]);
}

/**
 * Log hours manually (for backfill or manual entry)
 */
async function logHours(date, hours, sessionType = 'active') {
  const logDate = new Date(date).toISOString().split('T')[0];
  const weekStart = getWeekStart(new Date(date));

  await database.query(`
    INSERT INTO daily_time_log (log_date, week_start, hours_worked, sessions_count, active_hours)
    VALUES ($1::DATE, $2::DATE, $3, 1, $3)
    ON CONFLICT (log_date) DO UPDATE SET
      hours_worked = $3,
      active_hours = $3,
      updated_at = NOW()
  `, [logDate, weekStart, hours]);
}

/**
 * Get gas gauge data (weekly fuel remaining)
 */
async function getGasGaugeData() {
  const weekStart = getWeekStart();

  const result = await database.query(`
    SELECT
      COALESCE(SUM(hours_worked), 0) as hours_used,
      40.0 as tank_capacity,
      40.0 - COALESCE(SUM(hours_worked), 0) as hours_remaining
    FROM daily_time_log
    WHERE week_start = $1::DATE
  `, [weekStart]);

  const row = result.rows[0] || {};
  const hoursUsed = parseFloat(row.hours_used) || 0;
  const hoursRemaining = Math.max(40 - hoursUsed, 0);

  return {
    weekStart,
    tankCapacity: 40,
    hoursUsed: Math.round(hoursUsed * 10) / 10,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    fuelPercent: Math.round((hoursRemaining / 40) * 100),
    isEmpty: hoursRemaining <= 0,
    isLow: hoursRemaining <= 8, // Less than 1 day
    daysRemaining: Math.floor(hoursRemaining / 8)
  };
}

/**
 * Ensure required tables exist (for first run)
 */
async function ensureTablesExist() {
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS daily_time_log (
        id SERIAL PRIMARY KEY,
        log_date DATE NOT NULL UNIQUE,
        week_start DATE NOT NULL,
        hours_worked DECIMAL(5,2) DEFAULT 0,
        sessions_count INTEGER DEFAULT 0,
        active_hours DECIMAL(5,2) DEFAULT 0,
        break_hours DECIMAL(5,2) DEFAULT 0,
        meeting_hours DECIMAL(5,2) DEFAULT 0,
        tasks_completed INTEGER DEFAULT 0,
        ehh_delivered DECIMAL(6,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await database.query(`
      CREATE TABLE IF NOT EXISTS work_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        session_start TIMESTAMP WITH TIME ZONE NOT NULL,
        session_end TIMESTAMP WITH TIME ZONE,
        duration_minutes INTEGER,
        week_start DATE NOT NULL,
        session_type VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  } catch (e) {
    // Tables may already exist
  }
}

/**
 * Update weekly snapshot (call after task changes)
 */
async function updateWeeklySnapshot() {
  const metrics = await getCurrentWeekMetrics();

  await database.query(`
    INSERT INTO dashboard_weekly_snapshots (
      week_start, week_end,
      tasks_submitted, tasks_in_review, tasks_in_progress, tasks_fixing,
      total_pending, pending_ehh,
      tasks_completed, completed_ehh, bugs_fixed,
      hours_logged, sessions_count,
      updated_at
    ) VALUES (
      $1::DATE, $2::DATE,
      $3, $4, $5, $6,
      $7, $8,
      $9, $10, $11,
      $12, $13,
      NOW()
    )
    ON CONFLICT (week_start) DO UPDATE SET
      tasks_submitted = $3,
      tasks_in_review = $4,
      tasks_in_progress = $5,
      tasks_fixing = $6,
      total_pending = $7,
      pending_ehh = $8,
      tasks_completed = $9,
      completed_ehh = $10,
      bugs_fixed = $11,
      hours_logged = $12,
      sessions_count = $13,
      updated_at = NOW()
  `, [
    metrics.weekStart,
    metrics.weekEnd,
    metrics.workRemaining.submitted,
    metrics.workRemaining.inReview,
    metrics.workRemaining.inProgress,
    metrics.workRemaining.fixing,
    metrics.workRemaining.totalPending,
    metrics.workRemaining.pendingEHH,
    metrics.progressMade.completedThisWeek,
    metrics.progressMade.completedEHH,
    metrics.progressMade.bugsFixed,
    metrics.timeTracking.hoursLogged,
    metrics.timeTracking.sessionsCount
  ]).catch(() => {
    // Table may not exist yet
  });
}

module.exports = {
  getWeekStart,
  getCurrentWeekMetrics,
  startSession,
  endSession,
  getActiveSession,
  logHours,
  getGasGaugeData,
  updateWeeklySnapshot,
  ensureTablesExist
};
