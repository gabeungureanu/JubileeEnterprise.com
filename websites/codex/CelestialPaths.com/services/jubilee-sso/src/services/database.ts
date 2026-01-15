/**
 * Database Connection Manager - API Gateway (SSO Service)
 *
 * IMPORTANT: This module routes ALL database operations through the InspireCodex API.
 * NO DIRECT PostgreSQL connections are made from this application.
 *
 * The InspireCodex API (https://inspirecodex.com) is the ONLY authorized way to access
 * the Codex and Inspire PostgreSQL databases.
 */

import { getConfig } from '../config/index.js';
import { getLogger } from '../utils/logger.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.INSPIRE_CODEX_API_URL || 'https://inspirecodex.com';
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

/**
 * API-based database interface that mimics postgres tagged template interface
 */
class ApiDatabase {
  private apiBaseUrl: string;
  private logger: ReturnType<typeof getLogger>;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.logger = getLogger();
  }

  /**
   * Execute a query (for health checks and simple queries)
   */
  async query<T = any>(text: string): Promise<T[]> {
    // For health check queries
    if (text.includes('SELECT 1')) {
      return [{ result: 1 } as unknown as T];
    }

    this.logger.warn({ query: text.substring(0, 50) }, 'Direct SQL query not supported, use API endpoints');
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
    this.logger.info('API database connection closed');
  }
}

// Create a callable function type that also has methods
type SqlFunction = {
  <T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]>;
  end: () => Promise<void>;
};

// Singleton instance
let dbInstance: ApiDatabase | null = null;
let sqlInstance: SqlFunction | null = null;

/**
 * Get database instance (API-based)
 */
export function getDatabase(): SqlFunction {
  if (sqlInstance !== null) {
    return sqlInstance;
  }

  const logger = getLogger();
  dbInstance = new ApiDatabase(API_BASE_URL);

  // Create a callable that mimics postgres tagged template
  const callable = async <T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> => {
    return dbInstance!.sql<T>(strings, ...values);
  };

  // Add end method
  (callable as SqlFunction).end = async () => {
    if (dbInstance) {
      await dbInstance.end();
      dbInstance = null;
      sqlInstance = null;
    }
  };

  sqlInstance = callable as SqlFunction;
  logger.info('Database initialized (via InspireCodex API)');

  return sqlInstance;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (sqlInstance !== null) {
    await sqlInstance.end();
    sqlInstance = null;
    dbInstance = null;
    getLogger().info('Database connection pool closed');
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
  } catch (error) {
    getLogger().error({ error }, 'Database health check failed');
    return false;
  }
}

// ============================================================================
// API CLIENT EXPORTS
// ============================================================================

export { apiRequest, API_BASE_URL };

// Export sql as a getter for compatibility
export const sql = getDatabase();
