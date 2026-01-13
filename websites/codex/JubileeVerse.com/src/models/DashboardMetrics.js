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
 * Uses admin tasks API when available, falls back to defaults
 */
async function getCurrentWeekMetrics() {
  const weekStart = getWeekStart();

  // First ensure tables exist
  await ensureTablesExist();

  try {
    // Try to get task stats via API
    const taskStats = await database.getAdminTaskStats().catch(() => null);

    if (taskStats) {
      return {
        weekStart,
        weekEnd: new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

        // Work Remaining (Left Panel)
        workRemaining: {
          submitted: taskStats.byStatus?.submitted || 0,
          inReview: taskStats.byStatus?.inReview || 0,
          inProgress: taskStats.byStatus?.inProgress || 0,
          fixing: taskStats.byStatus?.fixing || 0,
          totalPending: (taskStats.total || 0) - (taskStats.byStatus?.completed || 0),
          pendingEHH: 0 // Would need API support
        },

        // Progress Made (Right Panel)
        progressMade: {
          totalCompleted: taskStats.byStatus?.completed || 0,
          completedThisWeek: 0, // Would need API support for date filtering
          completedEHH: 0,
          bugsFixed: taskStats.byType?.bugs || 0
        },

        // Time Tracking (Gas Gauge) - default values
        timeTracking: {
          hoursLogged: 0,
          hoursRemaining: 40,
          tankCapacity: 40,
          sessionsCount: 0,
          fuelPercent: 100
        },

        calculatedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    console.warn('[getCurrentWeekMetrics] API call failed:', error.message);
  }

  // Return defaults if API fails
  console.log('[getCurrentWeekMetrics] Returning default metrics');
  return {
    weekStart,
    weekEnd: new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

    workRemaining: {
      submitted: 0,
      inReview: 0,
      inProgress: 0,
      fixing: 0,
      totalPending: 0,
      pendingEHH: 0
    },

    progressMade: {
      totalCompleted: 0,
      completedThisWeek: 0,
      completedEHH: 0,
      bugsFixed: 0
    },

    timeTracking: {
      hoursLogged: 0,
      hoursRemaining: 40,
      tankCapacity: 40,
      sessionsCount: 0,
      fuelPercent: 100
    },

    calculatedAt: new Date().toISOString()
  };
}

/**
 * Start a new work session
 * NOTE: In API mode, sessions are not persisted - returns a mock session
 */
async function startSession(userId = null, sessionType = 'active') {
  console.log('[startSession] Creating mock session (API mode)');
  return {
    id: `session_${Date.now()}`,
    session_start: new Date().toISOString()
  };
}

/**
 * End an active work session
 * NOTE: In API mode, sessions are not persisted - returns a mock response
 */
async function endSession(sessionId) {
  console.log('[endSession] Ending mock session (API mode):', sessionId);
  return {
    id: sessionId,
    session_start: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    session_end: new Date().toISOString(),
    duration_minutes: 60
  };
}

/**
 * Get active session for a user
 * NOTE: In API mode, sessions are not persisted - returns null
 */
async function getActiveSession(userId = null) {
  console.log('[getActiveSession] No active sessions in API mode');
  return null;
}

/**
 * Update daily time log after session ends
 * NOTE: In API mode, time logs are not persisted
 */
async function updateDailyTimeLog(session) {
  console.log('[updateDailyTimeLog] Time logging not available in API mode');
}

/**
 * Log hours manually (for backfill or manual entry)
 * NOTE: In API mode, hours are not persisted
 */
async function logHours(date, hours, sessionType = 'active') {
  console.log('[logHours] Hour logging not available in API mode:', { date, hours });
}

/**
 * Get gas gauge data (weekly fuel remaining)
 * NOTE: In API mode, returns default full tank
 */
async function getGasGaugeData() {
  const weekStart = getWeekStart();
  console.log('[getGasGaugeData] Returning default fuel gauge (API mode)');

  return {
    weekStart,
    tankCapacity: 40,
    hoursUsed: 0,
    hoursRemaining: 40,
    fuelPercent: 100,
    isEmpty: false,
    isLow: false,
    daysRemaining: 5
  };
}

/**
 * Ensure required tables exist (for first run)
 * NOTE: This is a no-op in API mode - tables must be created via migrations on InspireCodex
 */
async function ensureTablesExist() {
  console.log('[DashboardMetrics] ensureTablesExist called (no-op in API mode)');
  return true;
}

/**
 * Update weekly snapshot (call after task changes)
 * NOTE: In API mode, snapshots are not persisted
 */
async function updateWeeklySnapshot() {
  console.log('[updateWeeklySnapshot] Snapshot update not available in API mode');
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
