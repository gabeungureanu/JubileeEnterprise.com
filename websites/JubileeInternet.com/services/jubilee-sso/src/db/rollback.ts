import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function rollback(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (databaseUrl === undefined) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    // Get the last executed migration
    const [lastMigration] = await sql<{ name: string }[]>`
      SELECT name FROM _migrations ORDER BY id DESC LIMIT 1
    `;

    if (lastMigration === undefined) {
      console.log('No migrations to rollback.');
      await sql.end();
      return;
    }

    const migrationName = lastMigration.name;
    const rollbackName = migrationName.replace('.sql', '.rollback.sql');
    const rollbackPath = join(__dirname, '../../migrations', rollbackName);

    console.log(`Rolling back: ${migrationName}`);

    try {
      const content = await readFile(rollbackPath, 'utf-8');

      await sql.begin(async (tx) => {
        // Execute the rollback SQL
        await tx.unsafe(content);

        // Remove the migration record
        await tx`
          DELETE FROM _migrations WHERE name = ${migrationName}
        `;
      });

      console.log(`  ✓ Rolled back ${migrationName}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`Rollback file not found: ${rollbackName}`);
        console.error('This migration cannot be automatically rolled back.');
        process.exit(1);
      }
      throw error;
    }
  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

rollback().catch(console.error);
