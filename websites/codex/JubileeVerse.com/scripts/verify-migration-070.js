#!/usr/bin/env node
/**
 * Verify Migration 070 Results
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function run() {
  try {
    // Check calculation history
    const history = await pool.query(`
      SELECT calculation_version, calculated_at, total_vectors_raw, expanded_estimate, notes
      FROM collection_capacity_metrics ccm
      JOIN collections c ON ccm.collection_id = c.id
      WHERE c.slug = 'inspire-family'
      ORDER BY calculated_at DESC
      LIMIT 3
    `);

    console.log('=== CAPACITY CALCULATION HISTORY ===\n');
    history.rows.forEach(row => {
      console.log(`Version ${row.calculation_version}: ${row.total_vectors_raw} raw / ${row.expanded_estimate} expanded`);
      console.log(`  Calculated: ${new Date(row.calculated_at).toLocaleString()}`);
      console.log(`  Notes: ${row.notes || 'none'}\n`);
    });

    // Check total items
    const total = await pool.query(`
      SELECT COUNT(*) as count FROM category_items ci
      JOIN collection_categories cc ON ci.category_id = cc.id
      JOIN collections c ON cc.collection_id = c.id
      WHERE c.slug = 'inspire-family'
    `);
    console.log(`=== TOTAL ITEMS: ${total.rows[0].count} ===\n`);

    // Check new subcategories
    const newCats = await pool.query(`
      SELECT cc.name, cc.slug, COUNT(ci.id) as item_count
      FROM collection_categories cc
      LEFT JOIN category_items ci ON ci.category_id = cc.id
      JOIN collections c ON cc.collection_id = c.id
      WHERE c.slug = 'inspire-family'
        AND cc.slug IN ('persona_commands', 'emotional_protocols', 'translation_rules',
                        'rating_systems', 'deployment_protocols', 'consecration_lifestyle',
                        'legacy_systems', 'evangelism', 'financial_counsel',
                        'creative_media', 'throne_room')
      GROUP BY cc.id, cc.name, cc.slug
      ORDER BY cc.name
    `);

    console.log('=== NEW SUBCATEGORIES (Migration 070) ===\n');
    newCats.rows.forEach(row => {
      console.log(`${row.name.padEnd(35)} | ${row.item_count} items`);
    });

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
