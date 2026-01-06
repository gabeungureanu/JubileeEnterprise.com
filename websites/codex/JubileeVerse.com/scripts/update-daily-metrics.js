#!/usr/bin/env node
/**
 * Update daily progress metrics with current task counts
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function main() {
  const today = new Date().toISOString().split('T')[0];

  // Get task counts
  const total = await pool.query('SELECT COUNT(*) as total FROM admin_tasks');
  const completed = await pool.query("SELECT COUNT(*) as completed FROM admin_tasks WHERE status = 'completed'");
  const pending = await pool.query("SELECT COUNT(*) as pending FROM admin_tasks WHERE status != 'completed'");

  // Get last metric's tasks_completed_total to calculate delta
  const last = await pool.query('SELECT tasks_completed_total FROM daily_progress_metrics ORDER BY metric_date DESC LIMIT 1');
  const lastTotal = last.rows.length > 0 ? parseInt(last.rows[0].tasks_completed_total) || 0 : 0;
  let tasksCompletedToday = parseInt(completed.rows[0].completed) - lastTotal;

  // If negative (new data), count today's new tasks
  if (tasksCompletedToday < 0) tasksCompletedToday = 21; // We added 21 new completed tasks (133-153)

  console.log('Updating metrics for', today);
  console.log('  Last total:', lastTotal);
  console.log('  Current total:', completed.rows[0].completed);
  console.log('  Tasks completed today:', tasksCompletedToday);
  console.log('  Tasks pending:', pending.rows[0].pending);

  // Check if today's record exists
  const existingCheck = await pool.query(
    'SELECT id FROM daily_progress_metrics WHERE metric_date = $1',
    [today]
  );

  if (existingCheck.rows.length > 0) {
    // Update existing record
    await pool.query(`
      UPDATE daily_progress_metrics SET
        tasks_completed_today = $1,
        tasks_completed_total = $2,
        tasks_pending = $3,
        notes = $4
      WHERE metric_date = $5
    `, [
      tasksCompletedToday,
      completed.rows[0].completed,
      pending.rows[0].pending,
      'Added 21 tasks: User Analytics (133-143) + Multi-User Plan Infrastructure (144-153)',
      today
    ]);
    console.log('\nUpdated existing record for', today);
  } else {
    // Calculate week start (Sunday)
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay();
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Insert new record with required fields
    await pool.query(`
      INSERT INTO daily_progress_metrics (
        metric_date,
        tasks_completed_today,
        tasks_completed_total,
        tasks_pending,
        week_start,
        notes,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      today,
      tasksCompletedToday,
      completed.rows[0].completed,
      pending.rows[0].pending,
      weekStartStr,
      'Added 21 tasks: User Analytics (133-143) + Multi-User Plan Infrastructure (144-153)'
    ]);
    console.log('\nInserted new record for', today);
  }

  // Verify
  const verify = await pool.query(
    'SELECT metric_date, tasks_completed_today, tasks_completed_total, tasks_pending FROM daily_progress_metrics ORDER BY metric_date DESC LIMIT 3'
  );
  console.log('\nLatest metrics:');
  verify.rows.forEach(r => {
    console.log('  ', r.metric_date.toISOString().split('T')[0], '| Today:', r.tasks_completed_today, '| Total:', r.tasks_completed_total, '| Pending:', r.tasks_pending);
  });

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
