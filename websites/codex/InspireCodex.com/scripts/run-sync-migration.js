/**
 * Run browser sync data migration on Codex database
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.CODEX_DB_HOST || 'localhost',
    port: parseInt(process.env.CODEX_DB_PORT || '5432'),
    database: 'codex',
    user: process.env.CODEX_DB_USER || 'guardian',
    password: process.env.CODEX_DB_PASSWORD,
});

async function runMigration() {
    console.log('Running browser sync data migration...');

    try {
        // Read migration SQL
        const migrationPath = path.join(__dirname, '../../JubileeVerse.com/scripts/migrations/101_browser_sync_data.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Execute migration
        await pool.query(sql);
        console.log('✅ Migration completed successfully');

        // Verify tables exist
        const result = await pool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('browser_sync_data', 'browser_sync_preferences')
        `);

        console.log('Created tables:', result.rows.map(r => r.table_name).join(', '));

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
