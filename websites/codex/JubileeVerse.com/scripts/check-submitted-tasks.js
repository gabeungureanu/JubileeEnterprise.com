require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function checkSubmittedTasks() {
  const result = await pool.query(`
    SELECT id, task_number, title, task_type, priority, status, effort_hours
    FROM admin_tasks
    WHERE status = 'submitted'
    ORDER BY task_number
  `);
  console.log('Submitted tasks:', result.rows.length);
  console.log('');
  result.rows.forEach(row => {
    console.log('Task:', row.task_number);
    console.log('  Title:', (row.title || '').substring(0, 70));
    console.log('  Type:', row.task_type, '| Priority:', row.priority);
    console.log('  EHH:', row.effort_hours);
    console.log('');
  });
  await pool.end();
}

checkSubmittedTasks().catch(console.error);
