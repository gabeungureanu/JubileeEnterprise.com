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

async function verify() {
  console.log('=== COLLECTIONS VERIFICATION ===\n');

  // Get collections count by section
  const sections = await pool.query(`
    SELECT section::text, COUNT(*) as count
    FROM collections
    GROUP BY section
    ORDER BY section
  `);
  console.log('Collections by Section:');
  sections.rows.forEach(r => console.log(`  ${r.section}: ${r.count}`));

  // Get total categories count
  const catCount = await pool.query('SELECT COUNT(*) as count FROM collection_categories');
  console.log('\nTotal Categories:', catCount.rows[0].count);

  // List all collections with category counts
  const collections = await pool.query(`
    SELECT c.slug, c.name, c.section::text,
           COUNT(cc.id) as category_count
    FROM collections c
    LEFT JOIN collection_categories cc ON cc.collection_id = c.id
    GROUP BY c.id, c.slug, c.name, c.section
    ORDER BY c.section, c.display_order
  `);

  console.log('\nCollections with Category Counts:');
  let currentSection = '';
  collections.rows.forEach(r => {
    if (r.section !== currentSection) {
      currentSection = r.section;
      console.log(`\n  [${currentSection}]`);
    }
    console.log(`    ${r.name}: ${r.category_count} categories`);
  });

  await pool.end();
}

verify();
