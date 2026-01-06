#!/usr/bin/env node
/**
 * Query source files imported into Inspire Family collection
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
    // Get unique source files from category_items metadata
    const result = await pool.query(`
      SELECT DISTINCT
        ci.metadata->>'source' as source_file,
        COUNT(*) as item_count
      FROM category_items ci
      JOIN collection_categories cc ON ci.category_id = cc.id
      JOIN collections c ON cc.collection_id = c.id
      WHERE c.slug = 'inspire-family'
        AND ci.metadata->>'source' IS NOT NULL
      GROUP BY ci.metadata->>'source'
      ORDER BY ci.metadata->>'source'
    `);

    console.log('\n=== FILES IMPORTED INTO INSPIRE FAMILY COLLECTION ===\n');
    console.log('Source File                              | Items');
    console.log('-'.repeat(55));
    let totalItems = 0;
    result.rows.forEach(row => {
      const source = row.source_file || 'unknown';
      console.log(source.padEnd(40) + ' | ' + row.item_count);
      totalItems += parseInt(row.item_count);
    });
    console.log('-'.repeat(55));
    console.log('TOTAL'.padEnd(40) + ' | ' + totalItems);

    // Also show breakdown by item type
    const typeResult = await pool.query(`
      SELECT
        ci.item_type::TEXT as type,
        COUNT(*) as count
      FROM category_items ci
      JOIN collection_categories cc ON ci.category_id = cc.id
      JOIN collections c ON cc.collection_id = c.id
      WHERE c.slug = 'inspire-family'
      GROUP BY ci.item_type
      ORDER BY count DESC
    `);

    console.log('\n=== ITEMS BY TYPE ===\n');
    typeResult.rows.forEach(row => {
      console.log((row.type || 'unknown').padEnd(20) + ': ' + row.count);
    });

    // Show category breakdown
    const catResult = await pool.query(`
      SELECT
        cc.name as category_name,
        COUNT(ci.id) as item_count
      FROM collection_categories cc
      LEFT JOIN category_items ci ON ci.category_id = cc.id
      JOIN collections c ON cc.collection_id = c.id
      WHERE c.slug = 'inspire-family'
        AND cc.parent_category_id IS NULL
      GROUP BY cc.id, cc.name, cc.display_order
      ORDER BY cc.display_order
    `);

    console.log('\n=== ROOT CATEGORIES ===\n');
    catResult.rows.forEach(row => {
      console.log((row.category_name || 'unknown').padEnd(30) + ': ' + row.item_count + ' items');
    });

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
