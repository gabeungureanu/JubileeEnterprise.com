import postgres from 'postgres';
import { getConfig } from '../config/index.js';

let sql: postgres.Sql | null = null;

export function getDatabase(): postgres.Sql {
  if (sql !== null) {
    return sql;
  }

  const config = getConfig();

  sql = postgres(config.DATABASE_URL, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  return sql;
}

export async function closeDatabase(): Promise<void> {
  if (sql !== null) {
    await sql.end();
    sql = null;
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const db = getDatabase();
    await db`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
