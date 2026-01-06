require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function verifyEHH() {
  const result = await pool.query(`
    SELECT
      status,
      COUNT(*) as task_count,
      SUM(effort_hours) as total_ehh,
      ROUND(AVG(effort_hours)::numeric, 1) as avg_ehh
    FROM admin_tasks
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'completed' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'fixing' THEN 3
        WHEN 'in_review' THEN 4
        WHEN 'submitted' THEN 5
      END
  `);

  console.log('EHH Summary by Status:');
  console.log('========================');
  result.rows.forEach(row => {
    console.log(`${row.status.toUpperCase()}:`);
    console.log(`  Tasks: ${row.task_count} | Total EHH: ${parseFloat(row.total_ehh).toFixed(1)} | Avg: ${row.avg_ehh} EHH`);
  });

  const totals = await pool.query(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(effort_hours) as total_ehh,
      SUM(CASE WHEN status = 'completed' THEN effort_hours ELSE 0 END) as completed_ehh,
      SUM(CASE WHEN status = 'submitted' THEN effort_hours ELSE 0 END) as submitted_ehh
    FROM admin_tasks
  `);

  const t = totals.rows[0];
  console.log('\n========================');
  console.log('TOTALS:');
  console.log(`  Total Tasks: ${t.total_tasks}`);
  console.log(`  Total EHH: ${parseFloat(t.total_ehh).toFixed(1)} hours`);
  console.log(`  Completed EHH: ${parseFloat(t.completed_ehh).toFixed(1)} hours`);
  console.log(`  Submitted (Future) EHH: ${parseFloat(t.submitted_ehh).toFixed(1)} hours`);

  await pool.end();
}

verifyEHH().catch(console.error);
