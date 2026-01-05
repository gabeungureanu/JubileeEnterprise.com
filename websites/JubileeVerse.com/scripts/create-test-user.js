/**
 * Create a test user in the database
 */

const crypto = require('crypto');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jubileeverse',
  user: 'postgres',
  password: 'askShaddai4e!'
});

/**
 * Hash password using pbkdf2 (same as AuthService)
 */
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(32).toString('hex');
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function createTestUser() {
  try {
    const email = 'gabe.ungureanu@outlook.com';
    const displayName = 'Gabe Ungureanu';
    const password = 'askShaddai4e!';
    const passwordHash = await hashPassword(password);

    // Check if user already exists
    const checkResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      console.log(`User ${email} already exists with ID: ${checkResult.rows[0].id}`);

      // Update the password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
        [passwordHash, email]
      );
      console.log(`Password updated for ${email}`);
      console.log(`You can now login with:`);
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
    } else {
      // Insert new user
      const insertResult = await pool.query(
        `INSERT INTO users (
          email, display_name, password_hash, is_active,
          email_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, true, true, NOW(), NOW())
        RETURNING id`,
        [email, displayName, passwordHash]
      );

      console.log(`Test user created successfully!`);
      console.log(`  ID: ${insertResult.rows[0].id}`);
      console.log(`  Email: ${email}`);
      console.log(`  Display Name: ${displayName}`);
      console.log(`  Password: ${password}`);
      console.log(`\nYou can now login at http://localhost/signin`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

createTestUser();
