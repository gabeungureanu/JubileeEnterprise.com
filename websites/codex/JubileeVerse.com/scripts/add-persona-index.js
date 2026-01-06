#!/usr/bin/env node
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function add() {
  await pool.query(`
    INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
    VALUES ('persona-index', 'Persona Index', 'Persona Index', 'authority_and_identity', 'persona', TRUE, 113, 'Index of all personas')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW()
  `);
  console.log('Added: Persona Index');
  await pool.end();
}
add();
