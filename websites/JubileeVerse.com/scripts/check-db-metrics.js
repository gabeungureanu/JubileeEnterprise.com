require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function checkMetrics() {
  try {
    // Test completed tasks query - same as DailyProgressMetrics
    const result = await pool.query(`
      SELECT
        COUNT(*) as completed_count,
        COALESCE(SUM(COALESCE(effort_hours, 0)), 0) as total_ehh,
        COALESCE(SUM(COALESCE(completed_work, 0)), 0) as total_cw_plus
      FROM admin_tasks
      WHERE status = 'completed'
    `);

    console.log('=== Completed Tasks Metrics (from DB) ===');
    console.log('Completed Count:', result.rows[0].completed_count);
    console.log('Total EHH:', parseFloat(result.rows[0].total_ehh).toFixed(2));
    console.log('Total CW+:', parseFloat(result.rows[0].total_cw_plus).toFixed(2));
    console.log('WPH (EHH/CW+):', (parseFloat(result.rows[0].total_ehh) / parseFloat(result.rows[0].total_cw_plus)).toFixed(2));

    // Check status breakdown
    const statusResult = await pool.query('SELECT status, COUNT(*) as count FROM admin_tasks GROUP BY status ORDER BY status');
    console.log('\n=== All Tasks by Status ===');
    statusResult.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));

    // Check DB tables count
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log('\n=== Database Tables ===');
    console.log('Table Count:', tablesResult.rows[0].table_count);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

checkMetrics();
