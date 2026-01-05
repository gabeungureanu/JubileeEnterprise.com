import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createMigration(): Promise<void> {
  const name = process.argv[2];

  if (name === undefined || name.trim() === '') {
    console.error('Usage: npm run migrate:create -- <migration-name>');
    console.error('Example: npm run migrate:create -- add-users-table');
    process.exit(1);
  }

  // Sanitize name
  const sanitizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-');

  // Create timestamp prefix
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);

  const fileName = `${timestamp}_${sanitizedName}.sql`;
  const rollbackFileName = `${timestamp}_${sanitizedName}.rollback.sql`;

  const migrationsDir = join(__dirname, '../../migrations');

  // Ensure migrations directory exists
  await mkdir(migrationsDir, { recursive: true });

  const migrationPath = join(migrationsDir, fileName);
  const rollbackPath = join(migrationsDir, rollbackFileName);

  const migrationContent = `-- =============================================================================
-- Migration: ${sanitizedName}
-- Created: ${new Date().toISOString()}
-- =============================================================================

-- Write your migration SQL here

`;

  const rollbackContent = `-- =============================================================================
-- Rollback: ${sanitizedName}
-- Created: ${new Date().toISOString()}
-- =============================================================================

-- Write your rollback SQL here
-- This should undo the changes made in the corresponding migration

`;

  await writeFile(migrationPath, migrationContent, 'utf-8');
  await writeFile(rollbackPath, rollbackContent, 'utf-8');

  console.log('Created migration files:');
  console.log(`  ${fileName}`);
  console.log(`  ${rollbackFileName}`);
}

createMigration().catch(console.error);
