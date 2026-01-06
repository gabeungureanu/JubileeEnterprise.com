require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function verifyCWPlus() {
  const result = await pool.query(`
    SELECT
      status,
      COUNT(*) as task_count,
      ROUND(SUM(effort_hours)::numeric, 1) as total_ehh,
      ROUND(SUM(completed_work)::numeric, 1) as total_cw_plus,
      ROUND(AVG(effort_hours)::numeric, 1) as avg_ehh,
      ROUND(AVG(completed_work)::numeric, 2) as avg_cw_plus
    FROM admin_tasks
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'completed' THEN 1
        WHEN 'submitted' THEN 2
        ELSE 3
      END
  `);

  console.log('EHH vs CW+ Summary by Status:');
  console.log('==============================');
  result.rows.forEach(row => {
    console.log(`\n${row.status.toUpperCase()}:`);
    console.log(`  Tasks: ${row.task_count}`);
    console.log(`  Total EHH: ${row.total_ehh} hours`);
    if (row.total_cw_plus) {
      console.log(`  Total CW+: ${row.total_cw_plus} hours`);
      const multiplier = (parseFloat(row.total_ehh) / parseFloat(row.total_cw_plus)).toFixed(1);
      console.log(`  AI Productivity Multiplier: ${multiplier}x`);
    }
  });

  const totals = await pool.query(`
    SELECT
      COUNT(*) as total_tasks,
      ROUND(SUM(effort_hours)::numeric, 1) as total_ehh,
      ROUND(SUM(completed_work)::numeric, 1) as total_cw_plus,
      ROUND(SUM(CASE WHEN status = 'completed' THEN effort_hours ELSE 0 END)::numeric, 1) as completed_ehh,
      ROUND(SUM(CASE WHEN status = 'completed' THEN completed_work ELSE 0 END)::numeric, 1) as completed_cw_plus
    FROM admin_tasks
  `);

  const t = totals.rows[0];
  console.log('\n==============================');
  console.log('TOTALS:');
  console.log(`  Total Tasks: ${t.total_tasks}`);
  console.log(`  Total EHH: ${t.total_ehh} hours`);
  console.log(`  Total CW+: ${t.total_cw_plus} hours`);

  if (t.completed_cw_plus > 0) {
    const completedMultiplier = (parseFloat(t.completed_ehh) / parseFloat(t.completed_cw_plus)).toFixed(1);
    console.log(`\n  Completed Work:`);
    console.log(`    EHH: ${t.completed_ehh} hours`);
    console.log(`    CW+: ${t.completed_cw_plus} hours`);
    console.log(`    AI Productivity Multiplier: ${completedMultiplier}x faster`);
  }

  await pool.end();
}

verifyCWPlus().catch(console.error);
