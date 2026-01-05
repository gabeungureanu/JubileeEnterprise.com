# Jubilee Solutions - Database Migrations

This folder contains all database migrations for the Jubilee Solutions platform.
Migrations are the **single source of truth** for schema evolution.

## Structure

```
infrastructure/migrations/
├── codex/           # Identity, SSO, platform configuration (rare changes)
├── inspire/         # Ministry content, conversations (moderate changes)
├── continuum/       # User data, activity, subscriptions (frequent changes)
├── runner/          # Migration execution engine
└── README.md        # This file
```

## Migration Naming Convention

All migration files must follow this format:

```
NNNN_descriptive_name.sql
```

- `NNNN` - Four-digit version number (0001, 0002, 0003...)
- `descriptive_name` - Snake_case description of the change
- `.sql` - SQL file extension

### Examples

```
0001_initial_schema.sql
0002_add_user_preferences.sql
0003_create_audit_indexes.sql
```

## Rules (MUST be followed)

### 1. Append-Only Migrations

**NEVER modify an existing migration file once committed.**

If you need to:
- Fix a bug in a migration → Create a new migration with the fix
- Add a column → Create a new migration
- Change a constraint → Create a new migration to drop and recreate

### 2. Database Isolation

Each database folder contains ONLY migrations for that database:
- `codex/` → Only Codex database changes
- `inspire/` → Only Inspire database changes
- `continuum/` → Only Continuum database changes

**NEVER reference or modify another database from within a migration.**

### 3. Idempotent Design

Migrations must be safe to run multiple times:
- Use `IF NOT EXISTS` for CREATE statements
- Use `IF EXISTS` for DROP statements
- Check for column existence before ALTER

### 4. Version Tracking

Each database maintains a `schema_migrations` table that records:
- Which migrations have been applied
- When they were applied
- Execution status

### 5. Environment Safety

- Development and production use separate credentials via `.env`
- Production migrations require explicit `--production` flag
- Never hardcode credentials in migration files

## Running Migrations

### Development

```bash
# Run all pending migrations for a specific database
npm run migrate:codex
npm run migrate:inspire
npm run migrate:continuum

# Run all databases
npm run migrate:all

# Check migration status
npm run migrate:status
```

### Production

```bash
# Production requires explicit flag
npm run migrate:codex -- --production
npm run migrate:inspire -- --production
npm run migrate:continuum -- --production
```

## Creating a New Migration

1. Determine which database the change affects
2. Check the latest migration number in that folder
3. Create a new file with the next number
4. Write idempotent SQL
5. Test in development
6. Commit and deploy

### Template

```sql
-- Migration: NNNN_description
-- Database: codex | inspire | continuum
-- Author: Your Name
-- Date: YYYY-MM-DD
-- Description: Brief description of what this migration does

-- Up Migration
BEGIN;

-- Your SQL here
CREATE TABLE IF NOT EXISTS example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

COMMIT;
```

## Migration Frequency Guidelines

| Database | Change Rate | Review Level |
|----------|-------------|--------------|
| Codex | Rare | Requires senior review |
| Inspire | Moderate | Standard review |
| Continuum | Frequent | Standard review |

## Troubleshooting

### Migration Failed Partway Through

1. Check `schema_migrations` table for status
2. Fix the issue manually if needed
3. Either mark as completed or rerun

### Schema Drift Detected

If schema differs from migrations:
1. **NEVER modify the database directly**
2. Create a new migration to correct the drift
3. Document why the drift occurred

### Rollback Required

We do not support automatic rollbacks. If a migration needs to be undone:
1. Create a new migration that reverses the changes
2. Apply that migration
3. Document the incident

## Environment Variables

Required in `.env` (see `.env.example` for full template):

```env
# Environment (development | staging | production)
NODE_ENV=development

# Codex Database (Port 5432)
DB_CODEX_HOST=localhost
DB_CODEX_PORT=5432
DB_CODEX_NAME=jubilee_codex
DB_CODEX_USER=jubilee
DB_CODEX_PASSWORD=jubilee_dev_codex

# Inspire Database (Port 5433)
DB_INSPIRE_HOST=localhost
DB_INSPIRE_PORT=5433
DB_INSPIRE_NAME=jubilee_inspire
DB_INSPIRE_USER=jubilee
DB_INSPIRE_PASSWORD=jubilee_dev_inspire

# Continuum Database (Port 5434)
DB_CONTINUUM_HOST=localhost
DB_CONTINUUM_PORT=5434
DB_CONTINUUM_NAME=jubilee_continuum
DB_CONTINUUM_USER=jubilee
DB_CONTINUUM_PASSWORD=jubilee_dev_continuum
```
