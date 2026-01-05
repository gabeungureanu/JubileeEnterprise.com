#!/usr/bin/env node
/**
 * Migration CLI
 *
 * Command-line interface for running database migrations.
 *
 * Commands:
 *   run <database>    Run pending migrations
 *   status            Show migration status for all databases
 *   create <database> Create a new migration file
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  getEnvironment,
  validateProductionAccess,
  displayConfig,
  getMigrationConfig,
  type DatabaseName,
} from './config.js';
import {
  runMigrations,
  getMigrationStatus,
  getMigrationFiles,
  testConnection,
} from './migrator.js';

const program = new Command();

const DATABASES: DatabaseName[] = ['codex', 'inspire', 'continuum'];

program
  .name('jubilee-migrate')
  .description('Database migration tool for Jubilee Solutions')
  .version('1.0.0');

// ============================================================================
// RUN COMMAND
// ============================================================================

program
  .command('run <database>')
  .description('Run pending migrations for a database (codex, inspire, continuum, or all)')
  .option('-p, --production', 'Confirm running in production environment')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (database: string, options) => {
    const env = getEnvironment();

    // Validate production access
    if (env === 'production' && !options.production) {
      validateProductionAccess([]);
    }

    console.log('');
    console.log(chalk.bold('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold('║              Jubilee Solutions - Database Migrations       ║'));
    console.log(chalk.bold('╚════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(`Environment: ${chalk.cyan(env)}`);
    console.log('');

    const databasesToRun: DatabaseName[] =
      database === 'all' ? DATABASES : [database as DatabaseName];

    if (!databasesToRun.every((db) => DATABASES.includes(db))) {
      console.error(chalk.red(`Invalid database: ${database}`));
      console.error(`Valid options: ${DATABASES.join(', ')}, all`);
      process.exit(1);
    }

    let hasErrors = false;

    for (const dbName of databasesToRun) {
      console.log(chalk.bold(`\n▶ ${dbName.toUpperCase()} Database`));
      console.log('─'.repeat(50));

      if (options.verbose) {
        displayConfig(dbName);
        console.log('');
      }

      // Test connection
      const connected = await testConnection(dbName);
      if (!connected) {
        console.log(chalk.red(`  ✗ Cannot connect to ${dbName} database`));
        hasErrors = true;
        continue;
      }

      console.log(chalk.green(`  ✓ Connected to ${dbName} database`));
      console.log('');

      // Run migrations
      const result = await runMigrations(dbName);

      if (result.applied.length === 0 && !result.failed) {
        console.log(chalk.gray('  No pending migrations'));
      } else {
        console.log('');
        console.log(`  Applied: ${chalk.green(result.applied.length)}`);
        console.log(`  Skipped: ${chalk.gray(result.skipped.length)}`);

        if (result.failed) {
          console.log(`  Failed:  ${chalk.red('1')}`);
          console.log('');
          console.log(chalk.red(`  Error in ${result.failed.version}_${result.failed.name}:`));
          console.log(chalk.red(`    ${result.error?.message}`));
          hasErrors = true;
        }
      }
    }

    console.log('');
    console.log('─'.repeat(50));

    if (hasErrors) {
      console.log(chalk.red('Migration completed with errors'));
      process.exit(1);
    } else {
      console.log(chalk.green('Migration completed successfully'));
    }
  });

// ============================================================================
// STATUS COMMAND
// ============================================================================

program
  .command('status')
  .description('Show migration status for all databases')
  .option('-d, --database <name>', 'Show status for specific database')
  .action(async (options) => {
    console.log('');
    console.log(chalk.bold('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold('║              Jubilee Solutions - Migration Status          ║'));
    console.log(chalk.bold('╚════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(`Environment: ${chalk.cyan(getEnvironment())}`);
    console.log('');

    const databasesToCheck: DatabaseName[] = options.database
      ? [options.database as DatabaseName]
      : DATABASES;

    for (const dbName of databasesToCheck) {
      console.log(chalk.bold(`\n▶ ${dbName.toUpperCase()} Database`));
      console.log('─'.repeat(60));

      const connected = await testConnection(dbName);
      if (!connected) {
        console.log(chalk.red(`  ✗ Cannot connect to database`));
        continue;
      }

      const status = await getMigrationStatus(dbName);

      if (status.applied.length === 0 && status.pending.length === 0) {
        console.log(chalk.gray('  No migrations found'));
        continue;
      }

      // Show applied migrations
      if (status.applied.length > 0) {
        console.log(chalk.green(`\n  Applied (${status.applied.length}):`));
        for (const m of status.applied) {
          const date = new Date(m.applied_at).toISOString().split('T')[0];
          console.log(`    ${chalk.green('✓')} ${m.version}_${m.name} (${date})`);
        }
      }

      // Show failed migrations
      if (status.failed.length > 0) {
        console.log(chalk.red(`\n  Failed (${status.failed.length}):`));
        for (const m of status.failed) {
          console.log(`    ${chalk.red('✗')} ${m.version}_${m.name}`);
        }
      }

      // Show pending migrations
      if (status.pending.length > 0) {
        console.log(chalk.yellow(`\n  Pending (${status.pending.length}):`));
        for (const m of status.pending) {
          console.log(`    ${chalk.yellow('○')} ${m.version}_${m.name}`);
        }
      }
    }

    console.log('');
  });

// ============================================================================
// CREATE COMMAND
// ============================================================================

program
  .command('create <database> <name>')
  .description('Create a new migration file')
  .action(async (database: string, name: string) => {
    if (!DATABASES.includes(database as DatabaseName)) {
      console.error(chalk.red(`Invalid database: ${database}`));
      console.error(`Valid options: ${DATABASES.join(', ')}`);
      process.exit(1);
    }

    const dbName = database as DatabaseName;
    const config = getMigrationConfig();
    const migrationsDir = join(config.migrationsPath, dbName);

    // Ensure directory exists
    await mkdir(migrationsDir, { recursive: true });

    // Get next version number
    const existingMigrations = await getMigrationFiles(dbName);
    const lastVersion = existingMigrations.length > 0
      ? parseInt(existingMigrations[existingMigrations.length - 1].version, 10)
      : 0;
    const nextVersion = String(lastVersion + 1).padStart(4, '0');

    // Sanitize name
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const filename = `${nextVersion}_${sanitizedName}.sql`;
    const filepath = join(migrationsDir, filename);

    // Get current date
    const today = new Date().toISOString().split('T')[0];

    // Create migration template
    const template = `-- Migration: ${nextVersion}_${sanitizedName}
-- Database: ${dbName}
-- Author: [Your Name]
-- Date: ${today}
-- Description: [Brief description of what this migration does]

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- Add your SQL statements here
-- Remember to use IF NOT EXISTS / IF EXISTS for idempotency

-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

COMMIT;
`;

    await writeFile(filepath, template);

    console.log('');
    console.log(chalk.green('✓ Migration file created:'));
    console.log('');
    console.log(`  ${chalk.cyan(filepath)}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit the migration file with your SQL changes');
    console.log('  2. Test in development: npm run migrate:' + dbName);
    console.log('  3. Commit the migration file');
    console.log('');
  });

// ============================================================================
// VERIFY COMMAND
// ============================================================================

program
  .command('verify')
  .description('Verify all database connections')
  .action(async () => {
    console.log('');
    console.log(chalk.bold('Verifying database connections...'));
    console.log('');

    for (const dbName of DATABASES) {
      process.stdout.write(`  ${dbName}: `);
      const connected = await testConnection(dbName);

      if (connected) {
        console.log(chalk.green('✓ Connected'));
      } else {
        console.log(chalk.red('✗ Failed'));
      }
    }

    console.log('');
  });

// Parse command line arguments
program.parse();
