const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'JubileeVerse',
  user: process.env.DB_USER || 'guardian',
  password: process.env.DB_PASSWORD
});

async function run() {
  try {
    const sql = fs.readFileSync('scripts/migrations/096_flywheel_collection_roots.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 096 executed successfully');

    // Verify the roots were created (level is 0 due to path trigger, not 1)
    const result = await pool.query(`
      SELECT fc.slug as collection, COUNT(fcc.id) as root_count
      FROM flywheel_collections fc
      LEFT JOIN flywheel_collection_categories fcc ON fcc.collection_id = fc.id
      WHERE fc.slug IN ('market-data', 'fundamentals', 'macroeconomic')
      GROUP BY fc.slug
      ORDER BY fc.slug
    `);

    console.log('\nRoot counts by collection:');
    result.rows.forEach(r => console.log('  ' + r.collection + ': ' + r.root_count + ' roots'));

    // Show the roots
    const roots = await pool.query(`
      SELECT fc.display_name as collection, fcc.name as root, fcc.display_order
      FROM flywheel_collection_categories fcc
      JOIN flywheel_collections fc ON fcc.collection_id = fc.id
      WHERE fc.slug IN ('market-data', 'fundamentals', 'macroeconomic')
      ORDER BY fc.display_order, fcc.display_order
    `);

    console.log('\nRoots created:');
    let currentCollection = '';
    roots.rows.forEach(r => {
      if (r.collection !== currentCollection) {
        currentCollection = r.collection;
        console.log('\n  ' + currentCollection + ':');
      }
      console.log('    [' + r.display_order + '] ' + r.root);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
