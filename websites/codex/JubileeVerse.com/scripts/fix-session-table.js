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
    // Check current user_sessions structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_sessions'
      ORDER BY ordinal_position
    `);

    console.log('Current user_sessions columns:');
    result.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

    // Drop and recreate with correct schema for connect-pg-simple
    console.log('\nRecreating user_sessions table with correct schema...');

    await pool.query('DROP TABLE IF EXISTS user_sessions CASCADE');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" VARCHAR NOT NULL COLLATE "default",
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
      )
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire")');

    console.log('user_sessions table recreated successfully!');

    // Verify
    const verify = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_sessions'
      ORDER BY ordinal_position
    `);
    console.log('\nVerified columns:');
    verify.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
