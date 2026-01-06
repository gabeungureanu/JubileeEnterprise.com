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
  const collResult = await pool.query("SELECT id FROM collections WHERE slug = 'execution-contracts'");
  if (collResult.rows.length === 0) {
    console.log('Collection execution-contracts not found');
    await pool.end();
    return;
  }
  const collId = collResult.rows[0].id;

  const categories = [
    'Execution_Order',
    'Mandatory_Activations',
    'Conditional_Activations',
    'Execution_Preconditions',
    'Execution_Safeguards',
    'Escalation_Rules',
    'Failure_Handling',
    'Execution_Metadata'
  ];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    await pool.query(`
      INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
      VALUES ($1, $2, $3, $3, 0, $4, FALSE)
      ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW()
    `, [collId, cat, cat.replace(/_/g, ' '), i + 1]);
  }

  console.log('Added 8 categories to Execution Contracts');
  await pool.end();
}
add();
