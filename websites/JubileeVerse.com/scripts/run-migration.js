/**
 * Run database migration script
 * Usage: node scripts/run-migration.js <migration_file>
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'jubileeverse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

async function runMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('Usage: node scripts/run-migration.js <migration_file>');
    process.exit(1);
  }

  const migrationPath = path.resolve(migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`Running migration: ${migrationFile}`);
  console.log(`Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}`);

  const pool = new Pool(config);

  try {
    await pool.query(sql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.position) {
      // Find the problematic line
      const lines = sql.substring(0, parseInt(error.position)).split('\n');
      console.error(`Error at line ${lines.length}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
