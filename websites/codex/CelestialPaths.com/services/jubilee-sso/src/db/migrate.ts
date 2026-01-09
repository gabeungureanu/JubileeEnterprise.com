import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (databaseUrl === undefined) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    // Create migrations table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Get list of executed migrations
    const executed = await sql<{ name: string }[]>`
      SELECT name FROM _migrations ORDER BY id
    `;
    const executedNames = new Set(executed.map((m) => m.name));

    // Get migration files
    const migrationsDir = join(__dirname, '../../migrations');
    let files: string[];

    try {
      files = await readdir(migrationsDir);
    } catch {
      console.log('No migrations directory found. Creating...');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(migrationsDir, { recursive: true });
      files = [];
    }

    const migrationFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Run pending migrations
    let migrationsRan = 0;

    for (const file of migrationFiles) {
      if (executedNames.has(file)) {
        continue;
      }

      console.log(`Running migration: ${file}`);

      const content = await readFile(join(migrationsDir, file), 'utf-8');

      await sql.begin(async (tx) => {
        // Execute the migration SQL
        await tx.unsafe(content);

        // Record the migration
        await tx`
          INSERT INTO _migrations (name) VALUES (${file})
        `;
      });

      console.log(`  ✓ ${file}`);
      migrationsRan++;
    }

    if (migrationsRan === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`\nCompleted ${migrationsRan} migration(s).`);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate().catch(console.error);
