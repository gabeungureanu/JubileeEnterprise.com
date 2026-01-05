require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function checkMissingEHH() {
  const result = await pool.query(`
    SELECT id, title, status, effort_hours
    FROM admin_tasks
    WHERE effort_hours IS NULL OR effort_hours = 0
    ORDER BY id
  `);
  console.log('Tasks missing EHH:', result.rows.length);
  result.rows.forEach(row => {
    console.log('  ID:', row.id, '| Status:', row.status, '| Title:', (row.title || '').substring(0, 50));
  });

  const total = await pool.query('SELECT COUNT(*) as total FROM admin_tasks');
  console.log('\nTotal tasks:', total.rows[0].total);

  await pool.end();
}

checkMissingEHH().catch(console.error);
