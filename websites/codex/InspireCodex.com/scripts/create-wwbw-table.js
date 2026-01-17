#!/usr/bin/env node
/**
 * Create wwbw_emails table in jubilee_codex database
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'jubilee_codex',
    user: 'jubilee',
    password: 'Pass@123'
});

const createTableSQL = `
CREATE TABLE IF NOT EXISTS wwbw_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    domain VARCHAR(100) NOT NULL DEFAULT 'inspire.shema',
    base_username VARCHAR(100) NOT NULL,
    suffix_number INTEGER,
    email_address VARCHAR(255) GENERATED ALWAYS AS (username || '@' || domain) STORED,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, domain)
);

CREATE INDEX IF NOT EXISTS idx_wwbw_emails_user_id ON wwbw_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_wwbw_emails_email_address ON wwbw_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_wwbw_emails_base_username ON wwbw_emails(base_username, domain);
`;

async function main() {
    try {
        await pool.query(createTableSQL);
        console.log('✅ wwbw_emails table created successfully');

        // Verify
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'wwbw_emails'
            ORDER BY ordinal_position
        `);
        console.log('Columns:', result.rows.map(r => r.column_name).join(', '));
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
