import postgres from 'postgres';
import { getConfig } from '../config/index.js';
import { getLogger } from '../utils/logger.js';

let sql: postgres.Sql | null = null;

export function getDatabase(): postgres.Sql {
  if (sql !== null) {
    return sql;
  }

  const config = getConfig();
  const logger = getLogger();

  sql = postgres(config.DATABASE_URL, {
    max: config.DATABASE_POOL_MAX,
    min: config.DATABASE_POOL_MIN,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: (notice) => {
      logger.debug({ notice }, 'Database notice');
    },
  });

  logger.info('Database connection pool initialized');

  return sql;
}

export async function closeDatabase(): Promise<void> {
  if (sql !== null) {
    await sql.end();
    sql = null;
    getLogger().info('Database connection pool closed');
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const db = getDatabase();
    await db`SELECT 1`;
    return true;
  } catch (error) {
    getLogger().error({ error }, 'Database health check failed');
    return false;
  }
}

export { sql };
