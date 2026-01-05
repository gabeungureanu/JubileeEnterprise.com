/**
 * Migration Configuration
 *
 * Loads database connection settings from environment variables.
 * Enforces environment safety rules for production deployments.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
config({ path: resolve(__dirname, '../../../../.env') });

export type DatabaseName = 'codex' | 'inspire' | 'continuum';
export type Environment = 'development' | 'staging' | 'production';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface MigrationConfig {
  environment: Environment;
  databases: Record<DatabaseName, DatabaseConfig>;
  migrationsPath: string;
}

/**
 * Get the current environment
 */
export function getEnvironment(): Environment {
  const env = process.env.NODE_ENV ?? 'development';

  if (env === 'production' || env === 'staging' || env === 'development') {
    return env;
  }

  console.warn(`Unknown NODE_ENV "${env}", defaulting to development`);
  return 'development';
}

/**
 * Validate that we have explicit permission to run in production
 */
export function validateProductionAccess(args: string[]): void {
  const env = getEnvironment();

  if (env === 'production') {
    const hasProductionFlag = args.includes('--production') || args.includes('-p');

    if (!hasProductionFlag) {
      console.error('');
      console.error('╔═══════════════════════════════════════════════════════════════╗');
      console.error('║                    PRODUCTION SAFEGUARD                       ║');
      console.error('╠═══════════════════════════════════════════════════════════════╣');
      console.error('║  You are attempting to run migrations in PRODUCTION.         ║');
      console.error('║                                                               ║');
      console.error('║  To confirm this is intentional, add the --production flag:  ║');
      console.error('║                                                               ║');
      console.error('║    npm run migrate:codex -- --production                      ║');
      console.error('║                                                               ║');
      console.error('╚═══════════════════════════════════════════════════════════════╝');
      console.error('');
      process.exit(1);
    }

    console.log('');
    console.log('⚠️  PRODUCTION MODE - Migrations will be applied to production database');
    console.log('');
  }
}

/**
 * Get database configuration for a specific database
 *
 * Supports environment variables in format: DB_CODEX_HOST, DB_INSPIRE_PORT, etc.
 * This matches the convention used in .env.example
 */
export function getDatabaseConfig(dbName: DatabaseName): DatabaseConfig {
  const prefix = dbName.toUpperCase();

  // Use DB_CODEX_* format to match .env.example convention
  const host = process.env[`DB_${prefix}_HOST`] ?? 'localhost';
  const port = parseInt(process.env[`DB_${prefix}_PORT`] ?? getDefaultPort(dbName), 10);
  const database = process.env[`DB_${prefix}_NAME`] ?? `jubilee_${dbName}`;
  const user = process.env[`DB_${prefix}_USER`] ?? 'jubilee';
  const password = process.env[`DB_${prefix}_PASSWORD`] ?? `jubilee_dev_${dbName}`;

  return { host, port, database, user, password };
}

/**
 * Get default port for each database
 */
function getDefaultPort(dbName: DatabaseName): string {
  switch (dbName) {
    case 'codex':
      return '5432';
    case 'inspire':
      return '5433';
    case 'continuum':
      return '5434';
  }
}

/**
 * Get full migration configuration
 */
export function getMigrationConfig(): MigrationConfig {
  return {
    environment: getEnvironment(),
    databases: {
      codex: getDatabaseConfig('codex'),
      inspire: getDatabaseConfig('inspire'),
      continuum: getDatabaseConfig('continuum'),
    },
    migrationsPath: resolve(__dirname, '../../'),
  };
}

/**
 * Mask password for display
 */
export function maskPassword(password: string): string {
  if (password.length <= 4) {
    return '****';
  }
  return password.substring(0, 2) + '****' + password.substring(password.length - 2);
}

/**
 * Display configuration summary
 */
export function displayConfig(dbName: DatabaseName): void {
  const config = getDatabaseConfig(dbName);
  const env = getEnvironment();

  console.log(`Database: ${dbName}`);
  console.log(`Environment: ${env}`);
  console.log(`Host: ${config.host}:${config.port}`);
  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  console.log(`Password: ${maskPassword(config.password)}`);
}
