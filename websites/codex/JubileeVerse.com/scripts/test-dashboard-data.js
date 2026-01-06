require('dotenv').config();
const { Pool } = require('pg');

// Create direct pool connection (same as check-db-metrics.js which worked)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function testDashboardData() {
  try {
    console.log('=== Testing Dashboard Data Queries ===\n');

    // Query 1: Completed tasks (same as DailyProgressMetrics.getDashboardData)
    const completedResult = await pool.query(`
      SELECT
        COUNT(*) as completed_count,
        COALESCE(SUM(COALESCE(effort_hours, 0)), 0) as total_ehh,
        COALESCE(SUM(COALESCE(completed_work, 0)), 0) as total_cw_plus
      FROM admin_tasks
      WHERE status = 'completed'
    `);

    const completed = completedResult.rows[0] || {};
    const completedTasks = parseInt(completed.completed_count, 10) || 0;
    const totalEHH = parseFloat(completed.total_ehh) || 0;
    const totalCWPlus = parseFloat(completed.total_cw_plus) || 0;

    console.log('Completed Tasks Query:');
    console.log('  completedTasks:', completedTasks);
    console.log('  totalEHH:', totalEHH.toFixed(2));
    console.log('  totalCWPlus:', totalCWPlus.toFixed(2));
    console.log('  WPH (EHH/CW+):', (totalEHH / totalCWPlus).toFixed(2));

    // Query 2: Database tables count
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log('\nDatabase Tables:', tablesResult.rows[0].table_count);

    // Query 3: Pending tasks
    const pendingResult = await pool.query(`
      SELECT
        COUNT(*) as pending_count,
        COALESCE(SUM(COALESCE(effort_hours, 2.0)), 0) as pending_heh
      FROM admin_tasks
      WHERE status != 'completed'
    `);

    const pending = pendingResult.rows[0] || {};
    console.log('\nPending Tasks:');
    console.log('  count:', pending.pending_count);
    console.log('  pendingHEH:', parseFloat(pending.pending_heh).toFixed(2));

    console.log('\n=== Expected API progressMade Output ===');
    console.log(JSON.stringify({
      completedTasks: completedTasks,
      totalEHH: Math.round(totalEHH),
      totalCWPlus: Math.round(totalCWPlus),
      databaseTables: parseInt(tablesResult.rows[0].table_count, 10)
    }, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

testDashboardData();
