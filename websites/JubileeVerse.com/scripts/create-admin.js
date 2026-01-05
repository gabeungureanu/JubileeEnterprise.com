/**
 * Create admin user script
 * Usage: node scripts/create-admin.js
 */

const crypto = require('crypto');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'JubileeVerse',
  user: process.env.DB_USER || 'guardian',
  password: process.env.DB_PASSWORD
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

async function createAdmin() {
  const email = 'gabe.ungureanu@outlook.com';
  const password = 'askShaddai4e!';
  const displayName = 'Gabriel Ungureanu';

  try {
    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      console.log('User already exists with id:', existing.rows[0].id);
      await pool.end();
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    const id = uuidv4();

    // Insert admin user
    const result = await pool.query(`
      INSERT INTO users (id, email, password_hash, display_name, role, email_verified, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'admin', true, true, NOW(), NOW())
      RETURNING id, email, display_name, role
    `, [id, email.toLowerCase(), passwordHash, displayName]);

    // Create default user settings
    await pool.query(
      `INSERT INTO user_settings (user_id, preferred_bible_version) VALUES ($1, 'NIV')`,
      [id]
    );

    console.log('Admin user created successfully:');
    console.log(result.rows[0]);
    console.log('\nLogin credentials:');
    console.log('  Email:', email);
    console.log('  Password: [as specified]');

  } catch (error) {
    console.error('Error creating admin user:', error.message);
  } finally {
    await pool.end();
  }
}

createAdmin();
