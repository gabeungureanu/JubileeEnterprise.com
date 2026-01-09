#!/usr/bin/env node
/**
 * Database Migration Runner
 * Executes SQL migration files in order
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse',
};

// Migration directories
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR = path.join(__dirname, 'seeds');

/**
 * Create database if it doesn't exist
 */
async function createDatabase() {
  const pool = new Pool({
    ...config,
    database: 'postgres', // Connect to default database first
  });

  try {
    // Check if database exists
    const result = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database]
    );

    if (result.rows.length === 0) {
      console.log(`Creating database: ${config.database}`);
      await pool.query(`CREATE DATABASE ${config.database}`);
      console.log(`Database '${config.database}' created successfully`);
    } else {
      console.log(`Database '${config.database}' already exists`);
    }
  } catch (error) {
    if (error.code === '42P04') {
      // Database already exists
      console.log(`Database '${config.database}' already exists`);
    } else {
      throw error;
    }
  } finally {
    await pool.end();
  }
}

/**
 * Get list of SQL files from directory, sorted by name
 */
function getMigrationFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      name: file,
      path: path.join(dir, file),
    }));
}

/**
 * Execute a single SQL file
 */
async function executeSqlFile(pool, filePath, fileName) {
  console.log(`\n📄 Executing: ${fileName}`);

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    await pool.query(sql);
    console.log(`   ✅ ${fileName} completed`);
    return true;
  } catch (error) {
    console.error(`   ❌ ${fileName} failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run all migrations
 */
async function runMigrations(pool) {
  console.log('\n🔄 Running migrations...');

  const migrations = getMigrationFiles(MIGRATIONS_DIR);

  if (migrations.length === 0) {
    console.log('No migration files found');
    return;
  }

  for (const migration of migrations) {
    await executeSqlFile(pool, migration.path, migration.name);
  }

  console.log(`\n✅ All ${migrations.length} migrations completed`);
}

/**
 * Run all seed files
 */
async function runSeeds(pool) {
  console.log('\n🌱 Running seeds...');

  const seeds = getMigrationFiles(SEEDS_DIR);

  if (seeds.length === 0) {
    console.log('No seed files found');
    return;
  }

  for (const seed of seeds) {
    await executeSqlFile(pool, seed.path, seed.name);
  }

  console.log(`\n✅ All ${seeds.length} seeds completed`);
}

/**
 * Main migration runner
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  console.log('═══════════════════════════════════════════════════════');
  console.log('   JubileeVerse Database Migration Tool');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\nDatabase: ${config.database}@${config.host}:${config.port}`);

  try {
    // Create database if needed
    await createDatabase();

    // Connect to the database
    const pool = new Pool(config);

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database');

    switch (command) {
      case 'migrate':
        await runMigrations(pool);
        break;
      case 'seed':
        await runSeeds(pool);
        break;
      case 'all':
        await runMigrations(pool);
        await runSeeds(pool);
        break;
      case 'reset':
        console.log('\n⚠️  Resetting database (dropping all tables)...');
        await pool.query(`
          DROP SCHEMA public CASCADE;
          CREATE SCHEMA public;
          GRANT ALL ON SCHEMA public TO postgres;
          GRANT ALL ON SCHEMA public TO public;
        `);
        console.log('✅ Database reset complete');
        await runMigrations(pool);
        await runSeeds(pool);
        break;
      default:
        console.log(`
Usage: node scripts/migrate.js [command]

Commands:
  migrate   Run pending migrations only
  seed      Run seed files only
  all       Run migrations and seeds (default)
  reset     Drop all tables and re-run migrations and seeds
        `);
    }

    await pool.end();
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   Migration complete!');
    console.log('═══════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
