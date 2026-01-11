/**
 * Check WWBW Email Status
 * Verifies the WWBW email setup for all users
 */

const { Pool } = require('pg');
require('dotenv').config();

const codexPool = new Pool({
    host: process.env.CODEX_DB_HOST || 'localhost',
    port: parseInt(process.env.CODEX_DB_PORT || '5433'),
    database: process.env.CODEX_DB_NAME || 'codex',
    user: process.env.CODEX_DB_USER || 'postgres',
    password: process.env.CODEX_DB_PASSWORD
});

async function checkStatus() {
    try {
        // List all users
        console.log('=== All Users ===');
        const usersResult = await codexPool.query(
            "SELECT id, email, display_name FROM users ORDER BY created_at DESC LIMIT 10"
        );
        usersResult.rows.forEach(u => {
            console.log(`  ${u.id} - ${u.email} (${u.display_name})`);
        });

        // List all WWBW emails
        console.log('\n=== All WWBW Emails ===');
        const wwbwResult = await codexPool.query(
            "SELECT w.*, u.email as user_email FROM wwbw_emails w LEFT JOIN users u ON w.user_id = u.id"
        );
        wwbwResult.rows.forEach(w => {
            console.log(`  ${w.user_id} - ${w.username}@${w.domain} (user: ${w.user_email})`);
            console.log(`    is_primary: ${w.is_primary}, is_active: ${w.is_active}`);
        });

        // Check specific user
        console.log('\n=== Gabriel Ungureanu ===');
        const gabrielResult = await codexPool.query(
            `SELECT u.id, u.email, u.display_name,
                    w.username, w.domain, w.is_primary, w.is_active
             FROM users u
             LEFT JOIN wwbw_emails w ON u.id = w.user_id
             WHERE u.email = 'gabe.ungureanu@outlook.com'`
        );
        console.log(gabrielResult.rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await codexPool.end();
    }
}

checkStatus();
