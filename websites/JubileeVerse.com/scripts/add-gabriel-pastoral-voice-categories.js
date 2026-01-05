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
  // Get collection ID
  const collResult = await pool.query("SELECT id FROM collections WHERE slug = 'gabriel-pastoral-voice'");
  if (collResult.rows.length === 0) {
    console.log('Collection gabriel-pastoral-voice not found');
    await pool.end();
    return;
  }
  const collId = collResult.rows[0].id;

  const categories = [
    'Pastoral_Tone',
    'Encouragement_and_Care',
    'Guidance_and_Counsel',
    'Prayer_and_Intercession',
    'Scripture_Application',
    'Emotional_Support',
    'Conflict_and_Reconciliation',
    'Teaching_by_Example',
    'Correspondence_and_Response',
    'Pastoral_Boundaries'
  ];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    await pool.query(`
      INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
      VALUES ($1, $2, $3, $3, 0, $4, FALSE)
      ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW()
    `, [collId, cat, cat.replace(/_/g, ' '), i + 1]);
  }

  console.log('Added 10 categories to Gabriel (Pastoral Voice)');
  await pool.end();
}
add();
