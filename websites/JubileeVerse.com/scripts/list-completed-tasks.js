require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function listCompletedTasks() {
  const result = await pool.query(`
    SELECT task_number, title, task_type, priority, effort_hours, completed_work
    FROM admin_tasks
    WHERE status = 'completed'
    ORDER BY task_number
  `);
  console.log('Completed tasks:', result.rows.length);
  console.log('');
  result.rows.forEach(row => {
    console.log(`${row.task_number}: ${(row.title || '').substring(0, 55)}`);
    console.log(`   Type: ${row.task_type} | Priority: ${row.priority} | EHH: ${row.effort_hours}`);
  });
  await pool.end();
}

listCompletedTasks().catch(console.error);
