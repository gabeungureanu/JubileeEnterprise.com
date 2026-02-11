/**
 * @jubilee/database
 *
 * Shared database package for all Jubilee services.
 * Provides connection pooling and query functions for Codex, Inspire, and Continuum databases.
 */

import { Pool } from 'pg';

// Database pools
let codexPool: Pool | null = null;
let inspirePool: Pool | null = null;
let continuumPool: Pool | null = null;

/**
 * Initialize all database connection pools
 */
export async function initializePools(): Promise<void> {
  codexPool = new Pool({
    host: process.env.DB_CODEX_HOST || 'localhost',
    port: parseInt(process.env.DB_CODEX_PORT || '5432'),
    database: process.env.DB_CODEX_NAME || 'jubilee_codex',
    user: process.env.DB_CODEX_USER || 'jubilee',
    password: process.env.DB_CODEX_PASSWORD || 'Pass@123',
    max: parseInt(process.env.DB_CODEX_POOL_SIZE || '10'),
    idleTimeoutMillis: 30000,
  });

  inspirePool = new Pool({
    host: process.env.DB_INSPIRE_HOST || 'localhost',
    port: parseInt(process.env.DB_INSPIRE_PORT || '5432'),
    database: process.env.DB_INSPIRE_NAME || 'jubilee_inspire',
    user: process.env.DB_INSPIRE_USER || 'jubilee',
    password: process.env.DB_INSPIRE_PASSWORD || 'Pass@123',
    max: parseInt(process.env.DB_INSPIRE_POOL_SIZE || '10'),
    idleTimeoutMillis: 30000,
  });

  continuumPool = new Pool({
    host: process.env.DB_CONTINUUM_HOST || 'localhost',
    port: parseInt(process.env.DB_CONTINUUM_PORT || '5432'),
    database: process.env.DB_CONTINUUM_NAME || 'jubilee_continuum',
    user: process.env.DB_CONTINUUM_USER || 'jubilee',
    password: process.env.DB_CONTINUUM_PASSWORD || 'Pass@123',
    max: parseInt(process.env.DB_CONTINUUM_POOL_SIZE || '10'),
    idleTimeoutMillis: 30000,
  });

  // Test connections
  await codexPool.query('SELECT 1');
  await inspirePool.query('SELECT 1');
  await continuumPool.query('SELECT 1');
}

/**
 * Close all database connection pools
 */
export async function closePools(): Promise<void> {
  if (codexPool) await codexPool.end();
  if (inspirePool) await inspirePool.end();
  if (continuumPool) await continuumPool.end();
}

/**
 * Check health of all databases
 */
export async function checkAllHealth(): Promise<Array<{ database: string; healthy: boolean; error?: string }>> {
  const results = [];

  for (const [name, pool] of [
    ['codex', codexPool],
    ['inspire', inspirePool],
    ['continuum', continuumPool],
  ] as const) {
    try {
      if (pool) {
        await pool.query('SELECT 1');
        results.push({ database: name, healthy: true });
      } else {
        results.push({ database: name, healthy: false, error: 'Pool not initialized' });
      }
    } catch (error: any) {
      results.push({ database: name, healthy: false, error: error.message });
    }
  }

  return results;
}

/**
 * Get the Codex database pool
 */
export function getCodexPool(): Pool {
  if (!codexPool) throw new Error('Codex pool not initialized');
  return codexPool;
}

/**
 * Get the Inspire database pool
 */
export function getInspirePool(): Pool {
  if (!inspirePool) throw new Error('Inspire pool not initialized');
  return inspirePool;
}

/**
 * Get the Continuum database pool
 */
export function getContinuumPool(): Pool {
  if (!continuumPool) throw new Error('Continuum pool not initialized');
  return continuumPool;
}
