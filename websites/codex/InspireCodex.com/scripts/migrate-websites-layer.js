#!/usr/bin/env node
/**
 * Websites Layer Migration Script
 *
 * Implements the two-layer domain and website architecture:
 * - IDNS table: Domain registry only (domain names, protocol types, ownership)
 * - Websites table: Actual built websites (references IDNS, publication status, configuration)
 *
 * Usage: node scripts/migrate-websites-layer.js [command]
 * Commands:
 *   migrate     Apply the migration (default)
 *   rollback    Rollback the migration
 *   status      Show current status
 */

// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');

// Database configuration - use CODEX_DB_* from .env
const DB_CONFIG = {
    host: process.env.CODEX_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.CODEX_DB_PORT || process.env.DB_PORT || '5433'),
    user: process.env.CODEX_DB_USER || process.env.DB_USER || 'postgres',
    password: process.env.CODEX_DB_PASSWORD || process.env.DB_PASSWORD || 'askShaddai4e!',
    database: process.env.CODEX_DB_NAME || 'codex'
};

function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
        'info': '[INFO]',
        'success': '[OK]',
        'error': '[ERROR]',
        'warning': '[WARN]',
        'progress': '[...]'
    }[type] || '[INFO]';
    console.log(`${timestamp} ${prefix} ${message}`);
}

async function migrate() {
    const pool = new Pool(DB_CONFIG);

    try {
        log('Starting Websites Layer Migration...', 'progress');

        // Begin transaction
        const client = await pool.connect();
        await client.query('BEGIN');

        try {
            // Step 1: Update IDNS table to add owner_id and ensure proper structure
            log('Step 1: Updating idns_domains table structure...', 'progress');

            await client.query(`
                -- Add owner_id column if not exists
                ALTER TABLE idns_domains
                ADD COLUMN IF NOT EXISTS owner_id UUID;

                -- Add protocol_type column if not exists (INSPIRE, WWBW, PUBLIC)
                ALTER TABLE idns_domains
                ADD COLUMN IF NOT EXISTS protocol_type VARCHAR(20) DEFAULT 'INSPIRE';

                -- Add description for domain registry
                COMMENT ON TABLE idns_domains IS 'IDNS Domain Registry - Authoritative domain name registry for Inspire Web, WWBW, and Public Internet domains. Contains only domain registration data, not website content.';

                -- Add comments to clarify domain-only purpose
                COMMENT ON COLUMN idns_domains.domain_name IS 'The registered domain name (e.g., unitedstates, jubileeverse.com)';
                COMMENT ON COLUMN idns_domains.domain_type IS 'Classification of domain (country, ministry, denomination, webspace, etc.)';
                COMMENT ON COLUMN idns_domains.protocol_type IS 'Domain protocol: INSPIRE (Inspire Web), WWBW (World Wide Bible Web), PUBLIC (Internet)';
                COMMENT ON COLUMN idns_domains.owner_id IS 'Reference to the user/entity that owns this domain registration';
                COMMENT ON COLUMN idns_domains.is_active IS 'Whether this domain registration is currently active';
            `);
            log('IDNS table structure updated', 'success');

            // Step 2: Create Websites table
            log('Step 2: Creating websites table...', 'progress');

            await client.query(`
                -- Enable UUID extension if not already enabled
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

                -- Create website status enum type
                DO $$ BEGIN
                    CREATE TYPE website_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;

                -- Create websites table
                CREATE TABLE IF NOT EXISTS websites (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

                    -- Foreign key to IDNS domain registry
                    idns_domain_id INTEGER NOT NULL REFERENCES idns_domains(id) ON DELETE RESTRICT,

                    -- Website ownership and management
                    owner_id UUID,

                    -- Publication status
                    status website_status NOT NULL DEFAULT 'DRAFT',

                    -- Website metadata
                    site_title VARCHAR(500),
                    site_description TEXT,

                    -- Configuration stored as JSON for flexibility
                    config JSONB DEFAULT '{}',

                    -- Theme and appearance settings
                    theme_config JSONB DEFAULT '{}',

                    -- SEO and metadata
                    seo_config JSONB DEFAULT '{}',

                    -- Environment-specific routing
                    -- Determines which environment this website applies to (matches IDNS protocol_type)
                    environment VARCHAR(20) NOT NULL DEFAULT 'INSPIRE',

                    -- Content source reference (e.g., folder path for WWBW, template for Inspire)
                    content_source VARCHAR(500),
                    content_type VARCHAR(50) DEFAULT 'static',

                    -- Analytics and tracking
                    view_count INTEGER DEFAULT 0,

                    -- Timestamps
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    published_at TIMESTAMP WITH TIME ZONE,

                    -- Soft delete support
                    deleted_at TIMESTAMP WITH TIME ZONE,

                    -- Ensure one website per domain per environment
                    CONSTRAINT unique_domain_environment UNIQUE (idns_domain_id, environment)
                );

                -- Create indexes for performance
                CREATE INDEX IF NOT EXISTS idx_websites_idns_domain ON websites(idns_domain_id);
                CREATE INDEX IF NOT EXISTS idx_websites_owner ON websites(owner_id);
                CREATE INDEX IF NOT EXISTS idx_websites_status ON websites(status);
                CREATE INDEX IF NOT EXISTS idx_websites_environment ON websites(environment);
                CREATE INDEX IF NOT EXISTS idx_websites_published ON websites(published_at) WHERE status = 'PUBLISHED';
                CREATE INDEX IF NOT EXISTS idx_websites_active ON websites(id) WHERE deleted_at IS NULL;

                -- Add table comment
                COMMENT ON TABLE websites IS 'Website registry - Tracks actual built websites. Each website must reference a valid IDNS domain entry. Domains without websites are not publicly visible.';

                -- Column comments
                COMMENT ON COLUMN websites.idns_domain_id IS 'Required reference to IDNS domain registry. Website cannot exist without valid domain.';
                COMMENT ON COLUMN websites.status IS 'Publication status: DRAFT (building), PUBLISHED (live), ARCHIVED (hidden), PENDING (awaiting review)';
                COMMENT ON COLUMN websites.config IS 'Flexible JSON configuration for website-specific settings';
                COMMENT ON COLUMN websites.environment IS 'Target environment: INSPIRE, WWBW, or PUBLIC';
                COMMENT ON COLUMN websites.content_source IS 'Reference to content storage (folder path, template ID, etc.)';
            `);
            log('Websites table created', 'success');

            // Step 3: Create trigger to update timestamps
            log('Step 3: Creating update trigger...', 'progress');

            await client.query(`
                -- Create or replace the trigger function
                CREATE OR REPLACE FUNCTION update_websites_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                -- Drop existing trigger if exists
                DROP TRIGGER IF EXISTS websites_updated_at ON websites;

                -- Create the trigger
                CREATE TRIGGER websites_updated_at
                    BEFORE UPDATE ON websites
                    FOR EACH ROW
                    EXECUTE FUNCTION update_websites_updated_at();
            `);
            log('Update trigger created', 'success');

            // Step 4: Create view for domain + website joined data
            log('Step 4: Creating domain_websites view...', 'progress');

            await client.query(`
                -- Create a view that joins domains with their websites
                CREATE OR REPLACE VIEW domain_websites AS
                SELECT
                    d.id AS domain_id,
                    d.domain_name,
                    d.domain_type,
                    d.protocol_type,
                    d.mres AS masked_resolution,
                    d.managed,
                    d.is_active AS domain_active,
                    d.created_at AS domain_created_at,
                    w.id AS website_id,
                    w.site_title,
                    w.site_description,
                    w.status AS website_status,
                    w.environment,
                    w.content_source,
                    w.content_type,
                    w.view_count,
                    w.published_at,
                    w.created_at AS website_created_at,
                    w.updated_at AS website_updated_at,
                    CASE
                        WHEN w.id IS NOT NULL AND w.status = 'PUBLISHED' AND w.deleted_at IS NULL THEN true
                        ELSE false
                    END AS is_live
                FROM idns_domains d
                LEFT JOIN websites w ON d.id = w.idns_domain_id AND w.deleted_at IS NULL
                WHERE d.is_active = true;

                COMMENT ON VIEW domain_websites IS 'Joined view of domains and their websites. Use is_live to check if content is publicly available.';
            `);
            log('Domain websites view created', 'success');

            // Step 5: Migrate existing IDNS entries to have corresponding website entries
            log('Step 5: Creating website entries for existing IDNS domains...', 'progress');

            const result = await client.query(`
                -- Insert website entries for existing IDNS domains that don't have websites yet
                INSERT INTO websites (idns_domain_id, status, environment, content_source, content_type, site_title)
                SELECT
                    d.id,
                    'PUBLISHED'::website_status,
                    COALESCE(d.protocol_type, 'WWBW'),
                    d.domain_name,
                    'folder',
                    d.domain_name
                FROM idns_domains d
                WHERE d.is_active = true
                AND NOT EXISTS (
                    SELECT 1 FROM websites w
                    WHERE w.idns_domain_id = d.id
                )
                RETURNING id;
            `);
            log(`Created ${result.rowCount} website entries for existing domains`, 'success');

            // Commit transaction
            await client.query('COMMIT');
            log('Migration completed successfully!', 'success');

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

    } catch (error) {
        log(`Migration failed: ${error.message}`, 'error');
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

async function rollback() {
    const pool = new Pool(DB_CONFIG);

    try {
        log('Rolling back Websites Layer Migration...', 'progress');

        const client = await pool.connect();
        await client.query('BEGIN');

        try {
            // Drop view first (depends on tables)
            log('Dropping domain_websites view...', 'progress');
            await client.query('DROP VIEW IF EXISTS domain_websites;');

            // Drop trigger
            log('Dropping update trigger...', 'progress');
            await client.query('DROP TRIGGER IF EXISTS websites_updated_at ON websites;');
            await client.query('DROP FUNCTION IF EXISTS update_websites_updated_at();');

            // Drop websites table
            log('Dropping websites table...', 'progress');
            await client.query('DROP TABLE IF EXISTS websites;');

            // Drop enum type
            log('Dropping website_status enum...', 'progress');
            await client.query('DROP TYPE IF EXISTS website_status;');

            // Remove added columns from idns_domains (optional - keep for backwards compatibility)
            // log('Removing added columns from idns_domains...', 'progress');
            // await client.query('ALTER TABLE idns_domains DROP COLUMN IF EXISTS owner_id;');
            // await client.query('ALTER TABLE idns_domains DROP COLUMN IF EXISTS protocol_type;');

            await client.query('COMMIT');
            log('Rollback completed successfully!', 'success');

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

    } catch (error) {
        log(`Rollback failed: ${error.message}`, 'error');
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

async function status() {
    const pool = new Pool(DB_CONFIG);

    try {
        console.log('\n' + '='.repeat(60));
        console.log('   WEBSITES LAYER MIGRATION STATUS');
        console.log('='.repeat(60));

        // Check if websites table exists
        const tablesResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('idns_domains', 'websites')
            ORDER BY table_name;
        `);

        console.log('\nTables:');
        for (const row of tablesResult.rows) {
            console.log(`  [OK] ${row.table_name}`);
        }

        const expectedTables = ['idns_domains', 'websites'];
        const existingTables = tablesResult.rows.map(r => r.table_name);
        for (const table of expectedTables) {
            if (!existingTables.includes(table)) {
                console.log(`  [MISSING] ${table}`);
            }
        }

        // Check views
        const viewsResult = await pool.query(`
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
            AND table_name = 'domain_websites';
        `);

        console.log('\nViews:');
        if (viewsResult.rows.length > 0) {
            console.log('  [OK] domain_websites');
        } else {
            console.log('  [MISSING] domain_websites');
        }

        // Get counts if tables exist
        if (existingTables.includes('idns_domains')) {
            const idnsCount = await pool.query('SELECT COUNT(*) FROM idns_domains WHERE is_active = true');
            console.log(`\nIDNS Domains: ${idnsCount.rows[0].count} active`);
        }

        if (existingTables.includes('websites')) {
            const websiteStats = await pool.query(`
                SELECT
                    status,
                    COUNT(*) as count
                FROM websites
                WHERE deleted_at IS NULL
                GROUP BY status
                ORDER BY status;
            `);

            console.log('\nWebsites by Status:');
            for (const row of websiteStats.rows) {
                console.log(`  ${row.status}: ${row.count}`);
            }

            const totalWebsites = await pool.query('SELECT COUNT(*) FROM websites WHERE deleted_at IS NULL');
            console.log(`  Total: ${totalWebsites.rows[0].count}`);
        }

        console.log('\n' + '='.repeat(60) + '\n');

    } catch (error) {
        log(`Status check failed: ${error.message}`, 'error');
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'migrate';

    console.log('\n' + '='.repeat(60));
    console.log('   Websites Layer Migration Tool');
    console.log('='.repeat(60));
    console.log(`\nCommand: ${command}`);
    console.log(`Database: ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log('');

    switch (command) {
        case 'migrate':
            await migrate();
            break;
        case 'rollback':
            await rollback();
            break;
        case 'status':
            await status();
            break;
        default:
            console.log(`
Usage: node scripts/migrate-websites-layer.js [command]

Commands:
  migrate     Apply the Websites Layer migration (default)
  rollback    Rollback the migration
  status      Show current migration status
            `);
    }
}

main();
