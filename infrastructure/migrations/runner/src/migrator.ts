/**
 * Migration Executor
 *
 * Handles the execution of SQL migration files with proper
 * state tracking and error handling.
 */

import pg from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getDatabaseConfig, getMigrationConfig, type DatabaseName } from './config.js';

const { Pool } = pg;

export interface MigrationFile {
  version: string;
  name: string;
  filename: string;
  path: string;
}

export interface MigrationRecord {
  version: string;
  name: string;
  applied_at: Date;
  execution_time_ms: number;
  checksum: string;
  status: 'success' | 'failed' | 'pending';
}

export interface MigrationResult {
  database: DatabaseName;
  applied: MigrationFile[];
  skipped: MigrationFile[];
  failed: MigrationFile | null;
  error: Error | null;
}

/**
 * Create a database connection pool
 */
export function createPool(dbName: DatabaseName): pg.Pool {
  const config = getDatabaseConfig(dbName);

  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Ensure the schema_migrations table exists
 */
async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(20) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER NOT NULL DEFAULT 0,
      checksum VARCHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'success',
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
    ON schema_migrations(applied_at);

    CREATE INDEX IF NOT EXISTS idx_schema_migrations_status
    ON schema_migrations(status);
  `);
}

/**
 * Calculate a simple checksum for migration content
 */
function calculateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Get list of migration files for a database
 */
export async function getMigrationFiles(dbName: DatabaseName): Promise<MigrationFile[]> {
  const config = getMigrationConfig();
  const migrationsDir = join(config.migrationsPath, dbName);

  try {
    const files = await readdir(migrationsDir);

    const migrations = files
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => /^\d{4}_/.test(f))
      .map((filename) => {
        const match = filename.match(/^(\d{4})_(.+)\.sql$/);
        if (!match) return null;

        return {
          version: match[1],
          name: match[2],
          filename,
          path: join(migrationsDir, filename),
        };
      })
      .filter((m): m is MigrationFile => m !== null)
      .sort((a, b) => a.version.localeCompare(b.version));

    return migrations;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get applied migrations from database
 */
export async function getAppliedMigrations(pool: pg.Pool): Promise<Map<string, MigrationRecord>> {
  await ensureMigrationsTable(pool);

  const result = await pool.query<MigrationRecord>(`
    SELECT version, name, applied_at, execution_time_ms, checksum, status
    FROM schema_migrations
    ORDER BY version
  `);

  const map = new Map<string, MigrationRecord>();
  for (const row of result.rows) {
    map.set(row.version, row);
  }

  return map;
}

/**
 * Get pending migrations (not yet applied)
 */
export async function getPendingMigrations(
  dbName: DatabaseName,
  pool: pg.Pool
): Promise<MigrationFile[]> {
  const allMigrations = await getMigrationFiles(dbName);
  const appliedMigrations = await getAppliedMigrations(pool);

  return allMigrations.filter((m) => {
    const applied = appliedMigrations.get(m.version);
    return !applied || applied.status === 'failed';
  });
}

/**
 * Execute a single migration
 */
async function executeMigration(
  pool: pg.Pool,
  migration: MigrationFile
): Promise<{ success: boolean; error?: Error; executionTime: number }> {
  const startTime = Date.now();

  try {
    const content = await readFile(migration.path, 'utf-8');
    const checksum = calculateChecksum(content);

    // Start transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Execute the migration SQL
      await client.query(content);

      // Record the migration
      await client.query(
        `INSERT INTO schema_migrations (version, name, execution_time_ms, checksum, status)
         VALUES ($1, $2, $3, $4, 'success')
         ON CONFLICT (version) DO UPDATE SET
           applied_at = NOW(),
           execution_time_ms = $3,
           checksum = $4,
           status = 'success',
           error_message = NULL`,
        [migration.version, migration.name, Date.now() - startTime, checksum]
      );

      await client.query('COMMIT');

      return { success: true, executionTime: Date.now() - startTime };
    } catch (error) {
      await client.query('ROLLBACK');

      // Record the failure
      await pool.query(
        `INSERT INTO schema_migrations (version, name, execution_time_ms, checksum, status, error_message)
         VALUES ($1, $2, $3, $4, 'failed', $5)
         ON CONFLICT (version) DO UPDATE SET
           applied_at = NOW(),
           execution_time_ms = $3,
           status = 'failed',
           error_message = $5`,
        [
          migration.version,
          migration.name,
          Date.now() - startTime,
          checksum,
          error instanceof Error ? error.message : String(error),
        ]
      );

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Run all pending migrations for a database
 */
export async function runMigrations(dbName: DatabaseName): Promise<MigrationResult> {
  const pool = createPool(dbName);
  const result: MigrationResult = {
    database: dbName,
    applied: [],
    skipped: [],
    failed: null,
    error: null,
  };

  try {
    await ensureMigrationsTable(pool);

    const allMigrations = await getMigrationFiles(dbName);
    const appliedMigrations = await getAppliedMigrations(pool);

    for (const migration of allMigrations) {
      const existing = appliedMigrations.get(migration.version);

      if (existing && existing.status === 'success') {
        result.skipped.push(migration);
        continue;
      }

      console.log(`  Applying ${migration.version}_${migration.name}...`);

      const execResult = await executeMigration(pool, migration);

      if (execResult.success) {
        console.log(`  ✓ Applied in ${execResult.executionTime}ms`);
        result.applied.push(migration);
      } else {
        console.log(`  ✗ Failed: ${execResult.error?.message}`);
        result.failed = migration;
        result.error = execResult.error ?? new Error('Unknown error');
        break; // Stop on first failure
      }
    }
  } finally {
    await pool.end();
  }

  return result;
}

/**
 * Get migration status for a database
 */
export async function getMigrationStatus(dbName: DatabaseName): Promise<{
  database: DatabaseName;
  applied: MigrationRecord[];
  pending: MigrationFile[];
  failed: MigrationRecord[];
}> {
  const pool = createPool(dbName);

  try {
    await ensureMigrationsTable(pool);

    const allMigrations = await getMigrationFiles(dbName);
    const appliedMigrations = await getAppliedMigrations(pool);

    const applied: MigrationRecord[] = [];
    const pending: MigrationFile[] = [];
    const failed: MigrationRecord[] = [];

    for (const migration of allMigrations) {
      const record = appliedMigrations.get(migration.version);

      if (!record) {
        pending.push(migration);
      } else if (record.status === 'success') {
        applied.push(record);
      } else {
        failed.push(record);
      }
    }

    return { database: dbName, applied, pending, failed };
  } finally {
    await pool.end();
  }
}

/**
 * Test database connection
 */
export async function testConnection(dbName: DatabaseName): Promise<boolean> {
  const pool = createPool(dbName);

  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}
