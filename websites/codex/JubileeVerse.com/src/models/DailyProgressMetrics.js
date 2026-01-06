/**
 * DailyProgressMetrics Model
 * Handles daily progress snapshots for historical trend analysis
 *
 * MILESTONE-DRIVEN VELOCITY DASHBOARD
 * Velocity is calculated dynamically based on completed tasks and work history
 */

const database = require('../database');

// ============================================
// MILESTONE CONFIGURATION
// ============================================

// Default project milestone date (can be overridden by getMilestoneDate())
let MILESTONE_DATE = new Date('2025-12-31T23:59:59');

/**
 * Get milestone date from database or use default
 */
async function getMilestoneDate() {
  try {
    const result = await database.query(`
      SELECT milestone_date FROM daily_progress_metrics
      ORDER BY metric_date DESC LIMIT 1
    `);
    if (result.rows[0]?.milestone_date) {
      return new Date(result.rows[0].milestone_date);
    }
  } catch (e) {
    // Table might not exist
  }
  return MILESTONE_DATE;
}

/**
 * Set the milestone date
 */
function setMilestoneDate(date) {
  MILESTONE_DATE = new Date(date);
}

// Working hours configuration
const HOURS_PER_WORKDAY = 8;
const WORKDAYS_PER_WEEK = 5; // Monday through Friday

// Weekly fuel tank capacity (40 hours standard work week)
const WEEKLY_TANK_CAPACITY = HOURS_PER_WORKDAY * WORKDAYS_PER_WEEK;

// Hourly rate for value calculations
const DEFAULT_HOURLY_RATE = 150;

// Velocity baseline: Work Per Hour at normal pace
const VELOCITY_BASELINE = 30;

// ============================================
// MILESTONE UTILITY FUNCTIONS
// ============================================

/**
 * Check if a date is a weekday (Monday-Friday)
 */
function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // 1=Monday, 5=Friday
}

/**
 * Calculate remaining working hours between now and milestone
 * Excludes weekends, counts only Monday-Friday
 */
function calculateRemainingWorkingHours(fromDate = new Date()) {
  const now = new Date(fromDate);
  const milestone = new Date(MILESTONE_DATE);

  // If we're past the milestone, return 0
  if (now >= milestone) {
    return {
      totalHours: 0,
      workingDays: 0,
      calendarDays: 0,
      weeksRemaining: 0
    };
  }

  let workingDays = 0;
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  // Count working days from tomorrow to milestone (inclusive)
  const endDate = new Date(milestone);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    if (isWeekday(current)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Calculate hours remaining today if it's a weekday
  let hoursRemainingToday = 0;
  if (isWeekday(now)) {
    const currentHour = now.getHours();
    // Assume 9 AM - 5 PM workday
    const workdayStart = 9;
    const workdayEnd = 17;
    if (currentHour < workdayEnd) {
      hoursRemainingToday = Math.max(0, workdayEnd - Math.max(currentHour, workdayStart));
    }
  }

  const totalHours = (workingDays * HOURS_PER_WORKDAY) + hoursRemainingToday;
  const calendarDays = Math.ceil((milestone - now) / (1000 * 60 * 60 * 24));
  const weeksRemaining = workingDays / WORKDAYS_PER_WEEK;

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    workingDays,
    calendarDays,
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    hoursRemainingToday: Math.round(hoursRemainingToday * 10) / 10,
    milestoneDate: MILESTONE_DATE.toISOString().split('T')[0]
  };
}

/**
 * Calculate velocity from recent working days
 * Uses last 4 working days of completed effort, or calculates from task work history
 */
async function calculateRecentVelocity() {
  // First try to get EHH from daily_progress_metrics
  let totalEHH = 0;
  let daysCounted = 0;
  let avgDailyEHH = 0;

  try {
    const result = await database.query(`
      WITH last_4_workdays AS (
        SELECT metric_date, daily_ehh
        FROM daily_progress_metrics
        WHERE metric_date <= CURRENT_DATE
          AND EXTRACT(DOW FROM metric_date) BETWEEN 1 AND 5
        ORDER BY metric_date DESC
        LIMIT 4
      )
      SELECT
        COALESCE(SUM(daily_ehh), 0) as total_ehh,
        COUNT(*) as days_counted,
        COALESCE(AVG(daily_ehh), 0) as avg_daily_ehh
      FROM last_4_workdays
    `);

    const row = result.rows[0] || {};
    totalEHH = parseFloat(row.total_ehh) || 0;
    daysCounted = parseInt(row.days_counted, 10) || 0;
    avgDailyEHH = parseFloat(row.avg_daily_ehh) || 0;
  } catch (e) {
    // Table might not exist
  }

  // If no metrics data, calculate from task work history
  if (totalEHH === 0) {
    try {
      // Get total work hours from task work history in last 7 days
      const workResult = await database.query(`
        SELECT
          COALESCE(SUM(hours_worked), 0) as total_hours,
          COUNT(DISTINCT work_date) as days_worked
        FROM task_work_history
        WHERE work_date >= CURRENT_DATE - 7
      `);

      const actualHoursWorked = parseFloat(workResult.rows[0]?.total_hours) || 0;
      const daysWorked = parseInt(workResult.rows[0]?.days_worked, 10) || 0;

      // Get completed tasks with their effort estimates
      const taskResult = await database.query(`
        SELECT
          COUNT(*) as completed_count,
          COALESCE(SUM(COALESCE(effort_hours, 2.0)), 0) as total_effort_ehh
        FROM admin_tasks
        WHERE status = 'completed'
          AND completed_at >= NOW() - INTERVAL '7 days'
      `);

      const completedTaskEHH = parseFloat(taskResult.rows[0]?.total_effort_ehh) || 0;

      if (actualHoursWorked > 0 && completedTaskEHH > 0) {
        // Calculate velocity: EHH delivered per hour worked
        totalEHH = completedTaskEHH;
        daysCounted = Math.max(daysWorked, 1);
        avgDailyEHH = totalEHH / daysCounted;
      }
    } catch (e) {
      // Tables might not exist
    }
  }

  // If still no data, calculate from all completed tasks since project start
  // Use actual completed_work (CW+) for accurate WPH calculation
  let totalCWPlus = 0;
  if (totalEHH === 0) {
    try {
      const allTasksResult = await database.query(`
        SELECT
          COUNT(*) as completed_count,
          COALESCE(SUM(COALESCE(effort_hours, 0)), 0) as total_effort_ehh,
          COALESCE(SUM(COALESCE(completed_work, 0)), 0) as total_cw_plus,
          MIN(completed_at) as first_completion,
          MAX(completed_at) as last_completion
        FROM admin_tasks
        WHERE status = 'completed'
      `);

      const row = allTasksResult.rows[0] || {};
      const completedCount = parseInt(row.completed_count, 10) || 0;
      totalEHH = parseFloat(row.total_effort_ehh) || 0;
      totalCWPlus = parseFloat(row.total_cw_plus) || 0;

      // Estimate days worked based on completion spread
      if (row.first_completion && row.last_completion) {
        const firstDate = new Date(row.first_completion);
        const lastDate = new Date(row.last_completion);
        const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
        // Assume 5 working days per 7 calendar days
        daysCounted = Math.max(1, Math.round(daysDiff * 5 / 7));
      } else {
        daysCounted = 4; // Default to 4 working days
      }

      avgDailyEHH = daysCounted > 0 ? totalEHH / daysCounted : 0;
    } catch (e) {
      // Use defaults
      totalEHH = 2500; // Default demo value
      totalCWPlus = 50; // Default CW+ (resulting in WPH of 50)
      daysCounted = 4;
      avgDailyEHH = 625;
    }
  }

  // Calculate WPH (Work Per Hour) = EHH / CW+ (actual completed work hours)
  // This measures how much value (in EHH) is delivered per actual hour worked (CW+)
  // Use CW+ if available, otherwise fall back to estimated hours
  const hoursWorked = totalCWPlus > 0 ? totalCWPlus : daysCounted * HOURS_PER_WORKDAY;
  const wph = hoursWorked > 0 ? totalEHH / hoursWorked : 0;

  return {
    totalEHH: Math.round(totalEHH * 10) / 10,
    totalCWPlus: Math.round(totalCWPlus * 10) / 10,
    daysCounted,
    avgDailyEHH: Math.round(avgDailyEHH * 10) / 10,
    hoursWorked: Math.round(hoursWorked * 10) / 10,
    wph: Math.round(wph * 100) / 100, // WPH with 2 decimal precision
    velocityMultiplier: Math.round(wph * HOURS_PER_WORKDAY) // Multiplier based on daily output
  };
}

/**
 * Get Monday of the week for any date
 */
function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

/**
 * Ensure the daily_progress_metrics table exists with milestone fields
 */
async function ensureTableExists() {
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS daily_progress_metrics (
        id SERIAL PRIMARY KEY,
        metric_date DATE NOT NULL UNIQUE,
        daily_ehh DECIMAL(8,2) DEFAULT 0,
        rolling_4day_ehh DECIMAL(8,2) DEFAULT 0,
        rolling_7day_ehh DECIMAL(8,2) DEFAULT 0,
        velocity_wph DECIMAL(6,2) DEFAULT 0,
        velocity_multiplier DECIMAL(6,2) DEFAULT 1,
        weekly_hours_consumed DECIMAL(5,2) DEFAULT 0,
        weekly_hours_remaining DECIMAL(5,2) DEFAULT 40,
        week_start DATE NOT NULL,

        -- Milestone tracking fields
        milestone_date DATE DEFAULT '2025-12-31',
        milestone_hours_remaining DECIMAL(8,2) DEFAULT 0,
        milestone_workdays_remaining INTEGER DEFAULT 0,
        projected_completion_ehh DECIMAL(10,2) DEFAULT 0,
        on_track_status VARCHAR(20) DEFAULT 'unknown',

        -- Development output metrics
        lines_of_code INTEGER DEFAULT 0,
        lines_of_code_delta INTEGER DEFAULT 0,
        api_endpoints INTEGER DEFAULT 0,
        api_endpoints_delta INTEGER DEFAULT 0,
        database_tables INTEGER DEFAULT 0,
        database_tables_delta INTEGER DEFAULT 0,

        -- Task metrics
        tasks_completed_today INTEGER DEFAULT 0,
        tasks_completed_total INTEGER DEFAULT 0,
        tasks_pending INTEGER DEFAULT 0,

        -- Value metrics
        value_delivered DECIMAL(12,2) DEFAULT 0,
        value_delta DECIMAL(10,2) DEFAULT 0,
        hourly_rate DECIMAL(8,2) DEFAULT 150,

        -- Team equivalency metrics
        dev_week_equivalents DECIMAL(6,2) DEFAULT 0,
        team_size_equivalent DECIMAL(4,1) DEFAULT 1,

        -- Work remaining estimates
        estimated_remaining_ehh DECIMAL(8,2) DEFAULT 0,
        estimated_remaining_tasks INTEGER DEFAULT 0,

        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        notes TEXT
      )
    `);

    // Add milestone columns if they don't exist (for existing tables)
    await database.query(`
      ALTER TABLE daily_progress_metrics
      ADD COLUMN IF NOT EXISTS rolling_4day_ehh DECIMAL(8,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS velocity_wph DECIMAL(6,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS milestone_date DATE DEFAULT '2025-12-31',
      ADD COLUMN IF NOT EXISTS milestone_hours_remaining DECIMAL(8,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS milestone_workdays_remaining INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS projected_completion_ehh DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS on_track_status VARCHAR(20) DEFAULT 'unknown'
    `).catch(() => {});

  } catch (e) {
    // Table may already exist
  }
}

/**
 * Get today's metrics (or most recent if today not recorded)
 */
async function getTodayMetrics() {
  await ensureTableExists();

  const result = await database.query(`
    SELECT *
    FROM daily_progress_metrics
    WHERE metric_date <= CURRENT_DATE
    ORDER BY metric_date DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return getDefaultMetrics();
  }

  return formatMetricsRow(result.rows[0]);
}

/**
 * Get metrics for a specific date
 */
async function getMetricsForDate(date) {
  const result = await database.query(`
    SELECT *
    FROM daily_progress_metrics
    WHERE metric_date = $1::DATE
  `, [date]);

  if (result.rows.length === 0) {
    return null;
  }

  return formatMetricsRow(result.rows[0]);
}

/**
 * Get rolling 7-day metrics history
 */
async function getWeekHistory() {
  const result = await database.query(`
    SELECT *
    FROM daily_progress_metrics
    WHERE metric_date >= CURRENT_DATE - 7
    ORDER BY metric_date DESC
  `);

  return result.rows.map(formatMetricsRow);
}

/**
 * Get fuel gauge data (weekly hours consumption)
 */
async function getFuelGaugeData() {
  await ensureTableExists();

  const weekStart = getMonday();

  // Get hours consumed this week from daily_time_log
  const timeResult = await database.query(`
    SELECT COALESCE(SUM(hours_worked), 0) as hours_consumed
    FROM daily_time_log
    WHERE week_start = $1::DATE
  `, [weekStart]);

  const hoursConsumed = parseFloat(timeResult.rows[0]?.hours_consumed) || 0;
  const hoursRemaining = Math.max(0, WEEKLY_TANK_CAPACITY - hoursConsumed);
  const fuelPercent = (hoursRemaining / WEEKLY_TANK_CAPACITY) * 100;

  return {
    weekStart,
    tankCapacity: WEEKLY_TANK_CAPACITY,
    hoursConsumed: Math.round(hoursConsumed * 10) / 10,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    fuelPercent: Math.round(fuelPercent),
    isLow: fuelPercent <= 25,
    isCritical: fuelPercent <= 10,
    isEmpty: fuelPercent <= 0,
    needlePosition: fuelPercent
  };
}

/**
 * Record metrics for today with milestone calculations
 */
async function recordTodayMetrics(metrics) {
  await ensureTableExists();

  const today = new Date().toISOString().split('T')[0];
  const weekStart = getMonday();

  // Calculate milestone data
  const milestoneData = calculateRemainingWorkingHours();
  const velocityData = await calculateRecentVelocity();

  // Calculate rolling 4-day and 7-day EHH
  const rollingResult = await database.query(`
    SELECT
      COALESCE(SUM(CASE WHEN metric_date >= $1::DATE - 3 THEN daily_ehh ELSE 0 END), 0) as rolling_4day,
      COALESCE(SUM(CASE WHEN metric_date >= $1::DATE - 6 THEN daily_ehh ELSE 0 END), 0) as rolling_7day
    FROM daily_progress_metrics
    WHERE metric_date < $1::DATE
  `, [today]);

  const rolling4dayEHH = (parseFloat(rollingResult.rows[0]?.rolling_4day) || 0) + (metrics.dailyEHH || 0);
  const rolling7dayEHH = (parseFloat(rollingResult.rows[0]?.rolling_7day) || 0) + (metrics.dailyEHH || 0);

  // Project completion based on current velocity
  const projectedEHH = velocityData.wph * milestoneData.totalHours;

  // Determine if on track
  const pendingEHH = metrics.pendingEHH || 0;
  const onTrackStatus = projectedEHH >= pendingEHH ? 'on_track' :
                        projectedEHH >= pendingEHH * 0.8 ? 'at_risk' : 'behind';

  // Get previous day's cumulative values for delta calculation
  const prevResult = await database.query(`
    SELECT lines_of_code, api_endpoints, database_tables, tasks_completed_total
    FROM daily_progress_metrics
    WHERE metric_date < $1::DATE
    ORDER BY metric_date DESC
    LIMIT 1
  `, [today]);

  const prev = prevResult.rows[0] || {};
  const prevLOC = parseInt(prev.lines_of_code, 10) || 0;
  const prevAPI = parseInt(prev.api_endpoints, 10) || 0;
  const prevTables = parseInt(prev.database_tables, 10) || 0;

  await database.query(`
    INSERT INTO daily_progress_metrics (
      metric_date, week_start,
      daily_ehh, rolling_4day_ehh, rolling_7day_ehh,
      velocity_wph, velocity_multiplier,
      weekly_hours_consumed, weekly_hours_remaining,
      milestone_date, milestone_hours_remaining, milestone_workdays_remaining,
      projected_completion_ehh, on_track_status,
      lines_of_code, lines_of_code_delta,
      api_endpoints, api_endpoints_delta,
      database_tables, database_tables_delta,
      tasks_completed_today, tasks_completed_total, tasks_pending,
      value_delivered, value_delta, hourly_rate,
      dev_week_equivalents, team_size_equivalent,
      estimated_remaining_ehh, estimated_remaining_tasks
    ) VALUES (
      $1::DATE, $2::DATE,
      $3, $4, $5,
      $6, $7,
      $8, $9,
      $10::DATE, $11, $12,
      $13, $14,
      $15, $16,
      $17, $18,
      $19, $20,
      $21, $22, $23,
      $24, $25, $26,
      $27, $28,
      $29, $30
    )
    ON CONFLICT (metric_date) DO UPDATE SET
      daily_ehh = EXCLUDED.daily_ehh,
      rolling_4day_ehh = EXCLUDED.rolling_4day_ehh,
      rolling_7day_ehh = EXCLUDED.rolling_7day_ehh,
      velocity_wph = EXCLUDED.velocity_wph,
      velocity_multiplier = EXCLUDED.velocity_multiplier,
      weekly_hours_consumed = EXCLUDED.weekly_hours_consumed,
      weekly_hours_remaining = EXCLUDED.weekly_hours_remaining,
      milestone_date = EXCLUDED.milestone_date,
      milestone_hours_remaining = EXCLUDED.milestone_hours_remaining,
      milestone_workdays_remaining = EXCLUDED.milestone_workdays_remaining,
      projected_completion_ehh = EXCLUDED.projected_completion_ehh,
      on_track_status = EXCLUDED.on_track_status,
      lines_of_code = EXCLUDED.lines_of_code,
      lines_of_code_delta = EXCLUDED.lines_of_code_delta,
      api_endpoints = EXCLUDED.api_endpoints,
      api_endpoints_delta = EXCLUDED.api_endpoints_delta,
      database_tables = EXCLUDED.database_tables,
      database_tables_delta = EXCLUDED.database_tables_delta,
      tasks_completed_today = EXCLUDED.tasks_completed_today,
      tasks_completed_total = EXCLUDED.tasks_completed_total,
      tasks_pending = EXCLUDED.tasks_pending,
      value_delivered = EXCLUDED.value_delivered,
      value_delta = EXCLUDED.value_delta,
      dev_week_equivalents = EXCLUDED.dev_week_equivalents,
      team_size_equivalent = EXCLUDED.team_size_equivalent,
      estimated_remaining_ehh = EXCLUDED.estimated_remaining_ehh,
      estimated_remaining_tasks = EXCLUDED.estimated_remaining_tasks
  `, [
    today, weekStart,
    metrics.dailyEHH || 0,
    rolling4dayEHH,
    rolling7dayEHH,
    velocityData.wph,
    velocityData.velocityMultiplier,
    metrics.hoursWorked || 0,
    WEEKLY_TANK_CAPACITY - (metrics.hoursWorked || 0),
    milestoneData.milestoneDate,
    milestoneData.totalHours,
    milestoneData.workingDays,
    projectedEHH,
    onTrackStatus,
    metrics.linesOfCode || 0,
    (metrics.linesOfCode || 0) - prevLOC,
    metrics.apiEndpoints || 0,
    (metrics.apiEndpoints || 0) - prevAPI,
    metrics.databaseTables || 0,
    (metrics.databaseTables || 0) - prevTables,
    metrics.tasksCompletedToday || 0,
    metrics.tasksCompletedTotal || 0,
    metrics.tasksPending || 0,
    rolling7dayEHH * DEFAULT_HOURLY_RATE,
    (metrics.dailyEHH || 0) * DEFAULT_HOURLY_RATE,
    DEFAULT_HOURLY_RATE,
    rolling7dayEHH / 40,
    velocityData.velocityMultiplier,
    metrics.estimatedRemainingEHH || 0,
    metrics.estimatedRemainingTasks || 0
  ]);
}

/**
 * Get comprehensive milestone-driven dashboard data
 */
async function getDashboardData() {
  await ensureTableExists();

  const [todayMetrics, fuelGauge, weekHistory, velocityData, liveMetrics] = await Promise.all([
    getTodayMetrics(),
    getFuelGaugeData(),
    getWeekHistory(),
    calculateRecentVelocity(),
    getLiveMetrics()  // Get live API endpoints and DB tables count
  ]);

  // Calculate milestone data dynamically
  const milestoneData = calculateRemainingWorkingHours();

  // Calculate remaining work from pending tasks
  let pendingResult;
  try {
    pendingResult = await database.query(`
      SELECT
        COUNT(*) as pending_count,
        COALESCE(SUM(COALESCE(effort_hours, 2.0)), 0) as pending_ehh
      FROM admin_tasks
      WHERE status != 'completed'
    `);
  } catch (err) {
    console.error('[getDashboardData] Pending tasks query failed:', err.message);
    pendingResult = { rows: [{ pending_count: 0, pending_ehh: 0 }] };
  }

  const pending = pendingResult.rows[0] || {};
  const pendingEHH = parseFloat(pending.pending_ehh) || 0;
  const pendingTasks = parseInt(pending.pending_count, 10) || 0;

  // Get completed tasks totals (EHH and CW+)
  let completedResult;
  try {
    completedResult = await database.query(`
      SELECT
        COUNT(*) as completed_count,
        COALESCE(SUM(COALESCE(effort_hours, 0)), 0) as total_ehh,
        COALESCE(SUM(COALESCE(completed_work, 0)), 0) as total_cw_plus
      FROM admin_tasks
      WHERE status = 'completed'
    `);
    console.log('[getDashboardData] Completed tasks from DB:', {
      count: completedResult.rows[0]?.completed_count,
      ehh: completedResult.rows[0]?.total_ehh,
      cwPlus: completedResult.rows[0]?.total_cw_plus
    });
  } catch (err) {
    console.error('[getDashboardData] Completed tasks query failed:', err.message);
    completedResult = { rows: [{ completed_count: 0, total_ehh: 0, total_cw_plus: 0 }] };
  }

  const completed = completedResult.rows[0] || {};
  const completedTasks = parseInt(completed.completed_count, 10) || 0;
  const totalEHH = parseFloat(completed.total_ehh) || 0;
  const totalCWPlus = parseFloat(completed.total_cw_plus) || 0;

  console.log('[getDashboardData] Final values:', { completedTasks, totalEHH, totalCWPlus });

  // Project completion based on current velocity
  const projectedEHH = velocityData.wph * milestoneData.totalHours;
  const workDeficit = Math.max(0, pendingEHH - projectedEHH);
  const onTrack = projectedEHH >= pendingEHH;

  // Calculate pace required to complete on time
  const requiredWPH = milestoneData.totalHours > 0
    ? pendingEHH / milestoneData.totalHours
    : 0;

  // Calculate estimated completion date at current pace
  let estimatedCompletionDate = null;
  if (velocityData.wph > 0 && pendingEHH > 0) {
    const hoursToComplete = pendingEHH / velocityData.wph;
    const daysToComplete = Math.ceil(hoursToComplete / HOURS_PER_WORKDAY);
    const completion = new Date();
    let daysAdded = 0;
    while (daysAdded < daysToComplete) {
      completion.setDate(completion.getDate() + 1);
      if (isWeekday(completion)) {
        daysAdded++;
      }
    }
    estimatedCompletionDate = completion.toISOString().split('T')[0];
  }

  // Determine velocity zone based on WPH
  const velocityZone = velocityData.wph >= 100 ? 'peak' :
                       velocityData.wph >= 50 ? 'accelerating' :
                       velocityData.wph >= 20 ? 'normal' : 'warming_up';

  return {
    // Milestone information
    milestone: {
      date: milestoneData.milestoneDate,
      hoursRemaining: milestoneData.totalHours,
      workdaysRemaining: milestoneData.workingDays,
      weeksRemaining: milestoneData.weeksRemaining,
      calendarDaysRemaining: milestoneData.calendarDays
    },

    // Current velocity (for speedometer)
    // WPH = Value Delivered Hours / Actual Hours Worked
    velocity: {
      wph: velocityData.wph,
      multiplier: velocityData.velocityMultiplier,
      rolling4dayEHH: velocityData.totalEHH,
      avgDailyEHH: velocityData.avgDailyEHH,
      daysCounted: velocityData.daysCounted,
      zone: velocityZone,
      requiredWPH: Math.round(requiredWPH * 100) / 100,
      paceStatus: velocityData.wph >= requiredWPH ? 'ahead' :
                  velocityData.wph >= requiredWPH * 0.8 ? 'on_pace' : 'behind',
      // New precise metrics
      valueDeliveredHours: velocityData.totalEHH,  // VDH - total EHH delivered
      actualHoursWorked: velocityData.hoursWorked,  // AHW - actual clock hours
      totalEHH: velocityData.totalEHH  // Alias for backward compatibility
    },

    // Fuel gauge (weekly hours)
    fuel: fuelGauge,

    // Progress Made (right panel - green indicators)
    progressMade: {
      completedTasks,                              // Count of completed tasks (from DB)
      totalEHH: Math.round(totalEHH),              // Est. Human Hours (EHH) - integer, from completed tasks
      totalCWPlus: Math.round(totalCWPlus),        // Completed Work (CW+) - integer, from completed tasks
      rolling7dayEHH: todayMetrics.rolling7dayEHH, // Legacy - renamed to avoid overwrite
      rolling4dayEHH: velocityData.totalEHH,
      valueDeliveredHours: velocityData.totalEHH,  // VDH - precise, no shorthand
      actualHoursWorked: velocityData.hoursWorked, // AHW - from work session logs
      linesOfCode: todayMetrics.linesOfCode,
      linesOfCodeFormatted: formatNumber(todayMetrics.linesOfCode),
      apiEndpoints: liveMetrics.apiEndpoints,      // Live count from routes
      databaseTables: liveMetrics.databaseTables,  // Live count from DB schema
      tasksCompleted: todayMetrics.tasksCompletedTotal,
      velocityMultiplier: velocityData.velocityMultiplier
    },

    // Work Remaining (left panel - milestone-driven)
    workRemaining: {
      pendingTasks,
      pendingEHH: Math.round(pendingEHH * 10) / 10,
      projectedCompletionEHH: Math.round(projectedEHH * 10) / 10,
      workDeficit: Math.round(workDeficit * 10) / 10,
      onTrack,
      estimatedCompletionDate,
      estimatedDaysRemaining: velocityData.wph > 0
        ? Math.ceil(pendingEHH / (velocityData.wph * HOURS_PER_WORKDAY))
        : null,
      hoursRemaining: fuelGauge.hoursRemaining,
      hoursUsed: fuelGauge.hoursConsumed,  // AHW - actual hours worked this week
      milestoneHoursRemaining: milestoneData.totalHours
    },

    // Historical trend
    trend: {
      history: weekHistory,
      direction: weekHistory.length >= 2
        ? (weekHistory[0]?.velocityValue || 0) > (weekHistory[1]?.velocityValue || 0) ? 'up' : 'down'
        : 'stable'
    },

    // Timestamp
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Format a metrics row from database
 */
function formatMetricsRow(row) {
  return {
    metricDate: row.metric_date,
    weekStart: row.week_start,
    dailyEHH: parseFloat(row.daily_ehh) || 0,
    rolling4dayEHH: parseFloat(row.rolling_4day_ehh) || 0,
    rolling7dayEHH: parseFloat(row.rolling_7day_ehh) || 0,
    velocityWPH: parseFloat(row.velocity_wph) || 0,
    velocityValue: parseFloat(row.velocity_wph) || parseFloat(row.velocity_value) || 0,
    velocityMultiplier: parseFloat(row.velocity_multiplier) || 0,
    weeklyHoursConsumed: parseFloat(row.weekly_hours_consumed) || 0,
    weeklyHoursRemaining: parseFloat(row.weekly_hours_remaining) || 40,
    milestoneDate: row.milestone_date,
    milestoneHoursRemaining: parseFloat(row.milestone_hours_remaining) || 0,
    milestoneWorkdaysRemaining: parseInt(row.milestone_workdays_remaining, 10) || 0,
    projectedCompletionEHH: parseFloat(row.projected_completion_ehh) || 0,
    onTrackStatus: row.on_track_status || 'unknown',
    linesOfCode: parseInt(row.lines_of_code, 10) || 0,
    linesOfCodeDelta: parseInt(row.lines_of_code_delta, 10) || 0,
    apiEndpoints: parseInt(row.api_endpoints, 10) || 0,
    apiEndpointsDelta: parseInt(row.api_endpoints_delta, 10) || 0,
    databaseTables: parseInt(row.database_tables, 10) || 0,
    databaseTablesDelta: parseInt(row.database_tables_delta, 10) || 0,
    tasksCompletedToday: parseInt(row.tasks_completed_today, 10) || 0,
    tasksCompletedTotal: parseInt(row.tasks_completed_total, 10) || 0,
    tasksPending: parseInt(row.tasks_pending, 10) || 0,
    valueDelivered: parseFloat(row.value_delivered) || 0,
    valueDelta: parseFloat(row.value_delta) || 0,
    hourlyRate: parseFloat(row.hourly_rate) || DEFAULT_HOURLY_RATE,
    devWeekEquivalents: parseFloat(row.dev_week_equivalents) || 0,
    teamSizeEquivalent: parseFloat(row.team_size_equivalent) || 1,
    estimatedRemainingEHH: parseFloat(row.estimated_remaining_ehh) || 0,
    estimatedRemainingTasks: parseInt(row.estimated_remaining_tasks, 10) || 0
  };
}

/**
 * Get default metrics for demo/when no data exists
 */
function getDefaultMetrics() {
  const milestoneData = calculateRemainingWorkingHours();

  return {
    metricDate: new Date().toISOString().split('T')[0],
    weekStart: getMonday(),
    dailyEHH: 625,
    rolling4dayEHH: 2500,
    rolling7dayEHH: 2500,
    velocityWPH: 78.125, // 2500 EHH / 32 hours worked
    velocityValue: 78.125,
    velocityMultiplier: 78,
    weeklyHoursConsumed: 32,
    weeklyHoursRemaining: 8,
    milestoneDate: milestoneData.milestoneDate,
    milestoneHoursRemaining: milestoneData.totalHours,
    milestoneWorkdaysRemaining: milestoneData.workingDays,
    projectedCompletionEHH: 78.125 * milestoneData.totalHours,
    onTrackStatus: 'on_track',
    linesOfCode: 56000,
    linesOfCodeDelta: 0,
    apiEndpoints: 239,
    apiEndpointsDelta: 0,
    databaseTables: 82,
    databaseTablesDelta: 0,
    tasksCompletedToday: 0,
    tasksCompletedTotal: 75,
    tasksPending: 0,
    valueDelivered: 375000,
    valueDelta: 0,
    hourlyRate: DEFAULT_HOURLY_RATE,
    devWeekEquivalents: 62.5,
    teamSizeEquivalent: 78,
    estimatedRemainingEHH: 0,
    estimatedRemainingTasks: 0
  };
}

/**
 * Format number with K/M suffix
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}

/**
 * Format currency with K suffix
 */
function formatCurrency(num) {
  if (num >= 1000000) {
    return '$' + (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return '$' + (num / 1000).toFixed(0) + 'K';
  }
  return '$' + num.toFixed(0);
}

/**
 * Count database tables dynamically
 * Queries PostgreSQL information_schema to get actual table count
 */
async function countDatabaseTables() {
  try {
    const result = await database.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);
    return parseInt(result.rows[0]?.table_count, 10) || 0;
  } catch (error) {
    console.error('Error counting database tables:', error);
    return 0;
  }
}

/**
 * Count API endpoints dynamically
 * Scans the routes directory to count registered endpoints
 */
async function countAPIEndpoints() {
  try {
    const fs = require('fs');
    const path = require('path');
    const routesDir = path.join(__dirname, '..', 'routes');

    let endpointCount = 0;

    // Read all route files
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Count route definitions: router.get, router.post, router.put, router.delete, router.patch
      const routePatterns = [
        /router\.(get|post|put|delete|patch)\s*\(/gi,
        /app\.(get|post|put|delete|patch)\s*\(/gi
      ];

      for (const pattern of routePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          endpointCount += matches.length;
        }
      }
    }

    return endpointCount;
  } catch (error) {
    console.error('Error counting API endpoints:', error);
    return 0;
  }
}

/**
 * Get live metrics (API endpoints, DB tables) - always recalculated
 */
async function getLiveMetrics() {
  const [apiEndpoints, databaseTables] = await Promise.all([
    countAPIEndpoints(),
    countDatabaseTables()
  ]);

  return {
    apiEndpoints,
    databaseTables
  };
}

module.exports = {
  // Constants
  MILESTONE_DATE,
  VELOCITY_BASELINE,
  WEEKLY_TANK_CAPACITY,
  DEFAULT_HOURLY_RATE,
  HOURS_PER_WORKDAY,
  WORKDAYS_PER_WEEK,

  // Milestone utilities
  calculateRemainingWorkingHours,
  calculateRecentVelocity,
  isWeekday,
  getMilestoneDate,
  setMilestoneDate,

  // Data access
  getTodayMetrics,
  getMetricsForDate,
  getWeekHistory,
  getFuelGaugeData,
  recordTodayMetrics,
  getDashboardData,
  ensureTableExists,

  // Live metrics
  countDatabaseTables,
  countAPIEndpoints,
  getLiveMetrics
};
