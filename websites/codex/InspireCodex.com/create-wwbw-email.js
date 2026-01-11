/**
 * Create WWBW Email for Gabriel Ungureanu
 * Creates the gabriel.ungureanu@inspire.shema email account
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

async function createWwbwEmail() {
    try {
        // Find the user by email
        const userResult = await codexPool.query(
            "SELECT id, email, display_name FROM users WHERE email = $1",
            ['gabe.ungureanu@outlook.com']
        );

        if (userResult.rows.length === 0) {
            console.log('User not found: gabe.ungureanu@outlook.com');
            process.exit(1);
        }

        const user = userResult.rows[0];
        console.log('Found user:', user);

        // Check if WWBW email already exists
        const existingResult = await codexPool.query(
            "SELECT * FROM wwbw_emails WHERE user_id = $1",
            [user.id]
        );

        if (existingResult.rows.length > 0) {
            console.log('WWBW email already exists:', existingResult.rows[0]);

            // Update to the correct username if needed
            const current = existingResult.rows[0];
            if (current.username !== 'gabriel.ungureanu') {
                console.log('Updating username to gabriel.ungureanu...');
                await codexPool.query(
                    `UPDATE wwbw_emails
                     SET username = 'gabriel.ungureanu',
                         base_username = 'gabriel.ungureanu',
                         suffix_number = NULL,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [current.id]
                );
                console.log('Username updated successfully!');
            }
        } else {
            // Create the WWBW email
            console.log('Creating WWBW email: gabriel.ungureanu@inspire.shema');

            const result = await codexPool.query(
                `INSERT INTO wwbw_emails (user_id, username, domain, base_username, suffix_number, is_primary, is_active)
                 VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
                 RETURNING *`,
                [user.id, 'gabriel.ungureanu', 'inspire.shema', 'gabriel.ungureanu', null]
            );

            console.log('WWBW email created successfully:', result.rows[0]);
        }

        // Verify the result
        const verifyResult = await codexPool.query(
            "SELECT *, username || '@' || domain as email_address FROM wwbw_emails WHERE user_id = $1",
            [user.id]
        );
        console.log('\nFinal WWBW email record:');
        console.log(verifyResult.rows[0]);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await codexPool.end();
    }
}

createWwbwEmail();
