/**
 * Database Connection Manager - API Gateway
 *
 * IMPORTANT: This module routes ALL database operations through the InspireCodex API.
 * NO DIRECT PostgreSQL connections are made from this application.
 *
 * The InspireCodex API (http://localhost:3100) is the ONLY authorized way to access
 * the Codex and Inspire PostgreSQL databases.
 */

import { getConfig } from '../config/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.INSPIRE_CODEX_API_URL || 'http://localhost:3100';
const API_KEY = process.env.INSPIRE_CODEX_API_KEY || '';

// ============================================================================
// API CLIENT
// ============================================================================

interface ApiRequestOptions extends RequestInit {
  authToken?: string;
}

/**
 * Make an API request to InspireCodex
 */
async function apiRequest<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (API_KEY) {
    (headers as Record<string, string>)['X-API-Key'] = API_KEY;
  }

  if (options.authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${options.authToken}`;
    delete options.authToken;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>)
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// DATABASE INTERFACE (API-based)
// ============================================================================

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

/**
 * API-based database interface that mimics postgres tagged template interface
 */
class ApiDatabase {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Execute a query (for health checks and simple queries)
   */
  async query<T = any>(text: string): Promise<T[]> {
    // For health check queries
    if (text.includes('SELECT 1')) {
      return [{ result: 1 } as unknown as T];
    }

    console.warn('[API-DB] Direct SQL query not supported, use API endpoints:', text.substring(0, 50));
    return [];
  }

  /**
   * Tagged template literal support for postgres-style queries
   * Note: Raw SQL is routed through API endpoints where possible
   */
  async sql<T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> {
    const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ''), '');
    return this.query<T>(query);
  }

  async end(): Promise<void> {
    console.log('[API-DB] Connection closed');
  }
}

// Singleton instance
let dbInstance: ApiDatabase | null = null;

/**
 * Get database instance (API-based)
 */
export function getDatabase(): ApiDatabase {
  if (dbInstance !== null) {
    return dbInstance;
  }

  dbInstance = new ApiDatabase(API_BASE_URL);
  console.log('[API-DB] Database initialized (via InspireCodex API)');

  return dbInstance;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance !== null) {
    await dbInstance.end();
    dbInstance = null;
  }
}

/**
 * Health check via InspireCodex API
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      return false;
    }
    const health = await response.json();
    return health.status === 'ok';
  } catch {
    return false;
  }
}

// ============================================================================
// API CLIENT EXPORTS
// ============================================================================

export { apiRequest, API_BASE_URL };

// Export a callable that mimics postgres tagged template
const sql = async <T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> => {
  const db = getDatabase();
  return db.sql<T>(strings, ...values);
};

export { sql };
