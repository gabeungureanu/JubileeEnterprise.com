#!/usr/bin/env node
/**
 * Jubilee Platform Database Migration Tool
 *
 * Migrates from JubileeVerse to the new three-database architecture:
 * - Codex: Identity, configuration, canonical operations (migrated from JubileeVerse)
 * - Inspire: Authoritative ministry content database
 * - Continuum: User activity and high-volume data
 *
 * Usage: node scripts/database-migration.js [command]
 * Commands:
 *   create-codex     Create Codex database and migrate schema from JubileeVerse
 *   create-inspire   Create Inspire database with content schema
 *   create-continuum Create Continuum database with activity schema
 *   migrate-all      Run all migrations (default)
 *   validate         Validate schema consistency
 *   status           Show current database status
 */

const { Pool } = require('pg');

// Database configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'guardian',
    password: process.env.DB_PASSWORD || 'askShaddai4e!',
};

const DATABASES = {
    source: 'JubileeVerse',
    codex: 'Codex',
    inspire: 'Inspire',
    continuum: 'Continuum'
};

// Utility functions
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
        'info': '📋',
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'progress': '🔄'
    }[type] || '📋';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function getPool(database = 'postgres') {
    return new Pool({
        ...DB_CONFIG,
        database
    });
}

async function databaseExists(poolAdmin, dbName) {
    const result = await poolAdmin.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
    );
    return result.rows.length > 0;
}

async function createDatabase(poolAdmin, dbName) {
    log(`Creating database: ${dbName}`, 'progress');

    if (await databaseExists(poolAdmin, dbName)) {
        log(`Database '${dbName}' already exists`, 'warning');
        return false;
    }

    await poolAdmin.query(`CREATE DATABASE "${dbName}"`);
    log(`Database '${dbName}' created successfully`, 'success');
    return true;
}

async function getSchemaObjects(pool, schema = 'public') {
    // Get tables
    const tables = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `, [schema]);

    // Get views
    const views = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_type = 'VIEW'
        ORDER BY table_name
    `, [schema]);

    // Get sequences
    const sequences = await pool.query(`
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = $1
        ORDER BY sequence_name
    `, [schema]);

    // Get functions
    const functions = await pool.query(`
        SELECT routine_name, routine_type
        FROM information_schema.routines
        WHERE routine_schema = $1
        ORDER BY routine_name
    `, [schema]);

    // Get triggers
    const triggers = await pool.query(`
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = $1
        ORDER BY trigger_name
    `, [schema]);

    // Get indexes
    const indexes = await pool.query(`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = $1
        ORDER BY indexname
    `, [schema]);

    return {
        tables: tables.rows.map(r => r.table_name),
        views: views.rows.map(r => r.table_name),
        sequences: sequences.rows.map(r => r.sequence_name),
        functions: functions.rows.map(r => ({ name: r.routine_name, type: r.routine_type })),
        triggers: triggers.rows.map(r => ({ name: r.trigger_name, table: r.event_object_table })),
        indexes: indexes.rows.map(r => ({ name: r.indexname, table: r.tablename }))
    };
}

async function migrateSchemaToCodex(poolAdmin) {
    log('Starting Codex migration from JubileeVerse...', 'progress');

    // Check source database exists
    if (!await databaseExists(poolAdmin, DATABASES.source)) {
        throw new Error(`Source database '${DATABASES.source}' does not exist`);
    }

    // Check if Codex already exists
    const codexExists = await databaseExists(poolAdmin, DATABASES.codex);
    if (codexExists) {
        log(`Database '${DATABASES.codex}' already exists - skipping creation`, 'warning');
    } else {
        // Terminate all connections to JubileeVerse to allow template copy
        log('Terminating connections to source database...', 'progress');
        try {
            await poolAdmin.query(`
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1
                AND pid <> pg_backend_pid()
            `, [DATABASES.source]);
        } catch (err) {
            log(`Note: ${err.message}`, 'warning');
        }

        // Wait for connections to close
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create Codex as an exact copy of JubileeVerse using WITH TEMPLATE
        log('Creating Codex as a copy of JubileeVerse using template...', 'progress');
        await poolAdmin.query(`CREATE DATABASE "${DATABASES.codex}" WITH TEMPLATE "${DATABASES.source}" OWNER "${DB_CONFIG.user}"`);
        log(`Database '${DATABASES.codex}' created as exact copy of '${DATABASES.source}'`, 'success');
    }

    // Connect to Codex and verify
    const codexPool = await getPool(DATABASES.codex);
    const codexObjects = await getSchemaObjects(codexPool);
    log(`Codex database has ${codexObjects.tables.length} tables, ${codexObjects.views.length} views`, 'success');
    await codexPool.end();

    log('Codex migration completed!', 'success');
}

async function createInspireDatabase(poolAdmin) {
    log('Creating Inspire database...', 'progress');

    await createDatabase(poolAdmin, DATABASES.inspire);

    const inspirePool = await getPool(DATABASES.inspire);

    try {
        // Create Inspire-specific schema for ministry content
        await inspirePool.query(`
            -- Enable UUID extension
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

            -- Ministry Content Categories
            CREATE TABLE IF NOT EXISTS content_categories (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                parent_id UUID REFERENCES content_categories(id),
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Ministry Content Items
            CREATE TABLE IF NOT EXISTS content_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                category_id UUID REFERENCES content_categories(id),
                title VARCHAR(500) NOT NULL,
                slug VARCHAR(500) UNIQUE NOT NULL,
                content_type VARCHAR(50) NOT NULL,
                body TEXT,
                summary TEXT,
                author_id UUID,
                status VARCHAR(50) DEFAULT 'draft',
                published_at TIMESTAMP WITH TIME ZONE,
                featured BOOLEAN DEFAULT false,
                view_count INTEGER DEFAULT 0,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Bible References for Content
            CREATE TABLE IF NOT EXISTS content_bible_references (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
                book VARCHAR(100) NOT NULL,
                chapter INTEGER NOT NULL,
                verse_start INTEGER,
                verse_end INTEGER,
                version VARCHAR(50) DEFAULT 'KJV',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Media Assets
            CREATE TABLE IF NOT EXISTS media_assets (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                filename VARCHAR(500) NOT NULL,
                original_filename VARCHAR(500),
                mime_type VARCHAR(100) NOT NULL,
                file_size BIGINT,
                storage_path VARCHAR(1000) NOT NULL,
                cdn_url VARCHAR(1000),
                asset_type VARCHAR(50),
                metadata JSONB DEFAULT '{}',
                uploaded_by UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Content Media Links
            CREATE TABLE IF NOT EXISTS content_media (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
                media_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
                display_order INTEGER DEFAULT 0,
                caption TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Ministry Personas
            CREATE TABLE IF NOT EXISTS ministry_personas (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                codex_persona_id UUID,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                system_prompt TEXT,
                greeting_message TEXT,
                personality_traits JSONB DEFAULT '[]',
                knowledge_domains JSONB DEFAULT '[]',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Sermon Series
            CREATE TABLE IF NOT EXISTS sermon_series (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(500) NOT NULL,
                description TEXT,
                cover_image_id UUID REFERENCES media_assets(id),
                start_date DATE,
                end_date DATE,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Devotional Plans
            CREATE TABLE IF NOT EXISTS devotional_plans (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(500) NOT NULL,
                description TEXT,
                duration_days INTEGER NOT NULL,
                difficulty_level VARCHAR(50),
                topics JSONB DEFAULT '[]',
                is_published BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Devotional Plan Days
            CREATE TABLE IF NOT EXISTS devotional_plan_days (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                plan_id UUID REFERENCES devotional_plans(id) ON DELETE CASCADE,
                day_number INTEGER NOT NULL,
                title VARCHAR(500),
                content_id UUID REFERENCES content_items(id),
                scripture_reading TEXT,
                reflection_questions JSONB DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Knowledge Base Articles
            CREATE TABLE IF NOT EXISTS knowledge_base (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(100),
                tags JSONB DEFAULT '[]',
                embedding_id VARCHAR(255),
                source_type VARCHAR(50),
                source_reference TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_content_items_category ON content_items(category_id);
            CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
            CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type);
            CREATE INDEX IF NOT EXISTS idx_content_items_published ON content_items(published_at);
            CREATE INDEX IF NOT EXISTS idx_content_bible_refs_content ON content_bible_references(content_id);
            CREATE INDEX IF NOT EXISTS idx_content_media_content ON content_media(content_id);
            CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
        `);

        log('Inspire schema created successfully', 'success');

    } finally {
        await inspirePool.end();
    }
}

async function createContinuumDatabase(poolAdmin) {
    log('Creating Continuum database...', 'progress');

    await createDatabase(poolAdmin, DATABASES.continuum);

    const continuumPool = await getPool(DATABASES.continuum);

    try {
        // Create Continuum-specific schema for user activity
        await continuumPool.query(`
            -- Enable UUID extension
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

            -- User Activity Sessions
            CREATE TABLE IF NOT EXISTS activity_sessions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL,
                session_token VARCHAR(255) UNIQUE,
                started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                ended_at TIMESTAMP WITH TIME ZONE,
                ip_address INET,
                user_agent TEXT,
                device_info JSONB DEFAULT '{}',
                location_info JSONB DEFAULT '{}'
            );

            -- User Activity Events
            CREATE TABLE IF NOT EXISTS activity_events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                session_id UUID REFERENCES activity_sessions(id),
                user_id UUID NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                event_category VARCHAR(100),
                event_data JSONB DEFAULT '{}',
                page_url VARCHAR(1000),
                referrer_url VARCHAR(1000),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Chat Conversations (high volume)
            CREATE TABLE IF NOT EXISTS chat_conversations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL,
                persona_id UUID,
                title VARCHAR(500),
                status VARCHAR(50) DEFAULT 'active',
                message_count INTEGER DEFAULT 0,
                total_tokens_used INTEGER DEFAULT 0,
                started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_message_at TIMESTAMP WITH TIME ZONE,
                metadata JSONB DEFAULT '{}'
            );

            -- Chat Messages (high volume)
            CREATE TABLE IF NOT EXISTS chat_messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                model_used VARCHAR(100),
                response_time_ms INTEGER,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Message Reactions
            CREATE TABLE IF NOT EXISTS message_reactions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
                user_id UUID NOT NULL,
                reaction_type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(message_id, user_id, reaction_type)
            );

            -- User Generated Content
            CREATE TABLE IF NOT EXISTS user_content (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL,
                content_type VARCHAR(100) NOT NULL,
                title VARCHAR(500),
                body TEXT,
                is_private BOOLEAN DEFAULT true,
                tags JSONB DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- User Notes and Annotations
            CREATE TABLE IF NOT EXISTS user_annotations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL,
                target_type VARCHAR(100) NOT NULL,
                target_id UUID NOT NULL,
                annotation_type VARCHAR(50),
                content TEXT,
                color VARCHAR(20),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Reading Progress
            CREATE TABLE IF NOT EXISTS reading_progress (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL,
                plan_id UUID,
                content_id UUID,
                day_number INTEGER,
                completed BOOLEAN DEFAULT false,
                completed_at TIMESTAMP WITH TIME ZONE,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- User Preferences (activity-related)
            CREATE TABLE IF NOT EXISTS user_activity_preferences (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL UNIQUE,
                preferred_personas JSONB DEFAULT '[]',
                notification_settings JSONB DEFAULT '{}',
                reading_reminders JSONB DEFAULT '{}',
                ui_preferences JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- API Usage Logs (high volume)
            CREATE TABLE IF NOT EXISTS api_usage_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                endpoint VARCHAR(500) NOT NULL,
                method VARCHAR(10) NOT NULL,
                request_size INTEGER,
                response_size INTEGER,
                response_time_ms INTEGER,
                status_code INTEGER,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Analytics Events (high volume)
            CREATE TABLE IF NOT EXISTS analytics_events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                event_name VARCHAR(100) NOT NULL,
                event_properties JSONB DEFAULT '{}',
                session_id UUID,
                platform VARCHAR(50),
                app_version VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_activity_sessions_user ON activity_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_activity_sessions_started ON activity_sessions(started_at);
            CREATE INDEX IF NOT EXISTS idx_activity_events_session ON activity_events(session_id);
            CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events(user_id);
            CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(event_type);
            CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at);
            CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);
            CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_user_content_user ON user_content(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_content_type ON user_content(content_type);
            CREATE INDEX IF NOT EXISTS idx_user_annotations_user ON user_annotations(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_annotations_target ON user_annotations(target_type, target_id);
            CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id);
            CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user ON api_usage_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
            CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
        `);

        log('Continuum schema created successfully', 'success');

    } finally {
        await continuumPool.end();
    }
}

async function validateMigration(poolAdmin) {
    log('Validating database migration...', 'progress');

    const results = {
        codex: null,
        inspire: null,
        continuum: null,
        source: null
    };

    // Get source schema info
    if (await databaseExists(poolAdmin, DATABASES.source)) {
        const sourcePool = await getPool(DATABASES.source);
        results.source = await getSchemaObjects(sourcePool);
        await sourcePool.end();
    }

    // Get Codex schema info
    if (await databaseExists(poolAdmin, DATABASES.codex)) {
        const codexPool = await getPool(DATABASES.codex);
        results.codex = await getSchemaObjects(codexPool);
        await codexPool.end();
    }

    // Get Inspire schema info
    if (await databaseExists(poolAdmin, DATABASES.inspire)) {
        const inspirePool = await getPool(DATABASES.inspire);
        results.inspire = await getSchemaObjects(inspirePool);
        await inspirePool.end();
    }

    // Get Continuum schema info
    if (await databaseExists(poolAdmin, DATABASES.continuum)) {
        const continuumPool = await getPool(DATABASES.continuum);
        results.continuum = await getSchemaObjects(continuumPool);
        await continuumPool.end();
    }

    // Display validation results
    console.log('\n' + '═'.repeat(60));
    console.log('   DATABASE MIGRATION VALIDATION REPORT');
    console.log('═'.repeat(60));

    console.log('\n📊 Schema Object Counts:');
    console.log('─'.repeat(60));
    console.log(`${'Database'.padEnd(15)} | ${'Tables'.padEnd(8)} | ${'Views'.padEnd(8)} | ${'Functions'.padEnd(10)} | ${'Indexes'.padEnd(8)}`);
    console.log('─'.repeat(60));

    if (results.source) {
        console.log(`${'JubileeVerse'.padEnd(15)} | ${String(results.source.tables.length).padEnd(8)} | ${String(results.source.views.length).padEnd(8)} | ${String(results.source.functions.length).padEnd(10)} | ${String(results.source.indexes.length).padEnd(8)}`);
    }

    if (results.codex) {
        console.log(`${'Codex'.padEnd(15)} | ${String(results.codex.tables.length).padEnd(8)} | ${String(results.codex.views.length).padEnd(8)} | ${String(results.codex.functions.length).padEnd(10)} | ${String(results.codex.indexes.length).padEnd(8)}`);
    }

    if (results.inspire) {
        console.log(`${'Inspire'.padEnd(15)} | ${String(results.inspire.tables.length).padEnd(8)} | ${String(results.inspire.views.length).padEnd(8)} | ${String(results.inspire.functions.length).padEnd(10)} | ${String(results.inspire.indexes.length).padEnd(8)}`);
    }

    if (results.continuum) {
        console.log(`${'Continuum'.padEnd(15)} | ${String(results.continuum.tables.length).padEnd(8)} | ${String(results.continuum.views.length).padEnd(8)} | ${String(results.continuum.functions.length).padEnd(10)} | ${String(results.continuum.indexes.length).padEnd(8)}`);
    }

    console.log('─'.repeat(60));

    // Validation checks
    console.log('\n✓ Validation Checks:');

    if (results.source && results.codex) {
        const tableDiff = results.source.tables.length - results.codex.tables.length;
        if (tableDiff === 0) {
            log('Codex table count matches JubileeVerse', 'success');
        } else {
            log(`Codex has ${Math.abs(tableDiff)} ${tableDiff > 0 ? 'fewer' : 'more'} tables than JubileeVerse`, 'warning');
        }
    }

    if (results.inspire) {
        log(`Inspire database has ${results.inspire.tables.length} tables`, 'success');
    } else {
        log('Inspire database not found', 'error');
    }

    if (results.continuum) {
        log(`Continuum database has ${results.continuum.tables.length} tables`, 'success');
    } else {
        log('Continuum database not found', 'error');
    }

    console.log('\n' + '═'.repeat(60));

    return results;
}

async function showStatus(poolAdmin) {
    console.log('\n' + '═'.repeat(60));
    console.log('   DATABASE STATUS');
    console.log('═'.repeat(60));

    const databases = [DATABASES.source, DATABASES.codex, DATABASES.inspire, DATABASES.continuum];

    for (const db of databases) {
        const exists = await databaseExists(poolAdmin, db);
        console.log(`${exists ? '✅' : '❌'} ${db.padEnd(20)} ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    }

    console.log('═'.repeat(60) + '\n');
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'migrate-all';

    console.log('\n' + '═'.repeat(60));
    console.log('   Jubilee Platform Database Migration Tool');
    console.log('═'.repeat(60));
    console.log(`\nCommand: ${command}`);
    console.log(`Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`User: ${DB_CONFIG.user}`);

    const poolAdmin = await getPool('postgres');

    try {
        // Test connection
        await poolAdmin.query('SELECT NOW()');
        log('Connected to PostgreSQL server', 'success');

        switch (command) {
            case 'create-codex':
                await migrateSchemaToCodex(poolAdmin);
                break;

            case 'create-inspire':
                await createInspireDatabase(poolAdmin);
                break;

            case 'create-continuum':
                await createContinuumDatabase(poolAdmin);
                break;

            case 'migrate-all':
                await migrateSchemaToCodex(poolAdmin);
                await createInspireDatabase(poolAdmin);
                await createContinuumDatabase(poolAdmin);
                await validateMigration(poolAdmin);
                break;

            case 'validate':
                await validateMigration(poolAdmin);
                break;

            case 'status':
                await showStatus(poolAdmin);
                break;

            default:
                console.log(`
Usage: node scripts/database-migration.js [command]

Commands:
  create-codex     Create Codex database and migrate schema from JubileeVerse
  create-inspire   Create Inspire database with ministry content schema
  create-continuum Create Continuum database with activity schema
  migrate-all      Run all migrations (default)
  validate         Validate schema consistency
  status           Show current database status
                `);
        }

        log('Migration tool completed', 'success');

    } catch (error) {
        log(`Migration failed: ${error.message}`, 'error');
        console.error(error.stack);
        process.exit(1);
    } finally {
        await poolAdmin.end();
    }
}

main();
