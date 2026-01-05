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
    const sql = fs.readFileSync('scripts/migrations/097_flywheel_collection_roots_batch2.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 097 executed successfully');

    // Verify the roots were created
    const result = await pool.query(`
      SELECT fc.slug as collection, COUNT(fcc.id) as root_count
      FROM flywheel_collections fc
      LEFT JOIN flywheel_collection_categories fcc ON fcc.collection_id = fc.id
      WHERE fc.slug IN ('alternative-data', 'news', 'sentiment', 'historical-prices', 'corporate-actions', 'benchmarks')
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
      WHERE fc.slug IN ('alternative-data', 'news', 'sentiment', 'historical-prices', 'corporate-actions', 'benchmarks')
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

    // Show total
    const total = await pool.query(`
      SELECT COUNT(*) as total FROM flywheel_collection_categories WHERE collection_id IS NOT NULL
    `);
    console.log('\n\nTotal roots across all collections: ' + total.rows[0].total);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
