const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'JubileeVerse',
  user: process.env.DB_USER || 'guardian',
  password: process.env.DB_PASSWORD
});

async function run() {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('session', 'user_sessions')
      ORDER BY table_name, ordinal_position
    `);
    console.log('Session tables columns:');
    result.rows.forEach(r => console.log(`${r.table_name}: ${r.column_name} (${r.data_type})`));

    if (result.rows.length === 0) {
      console.log('No session tables found!');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
