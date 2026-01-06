const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  database: 'JubileeVerse',
  user: 'guardian',
  password: process.env.DB_PASSWORD
});

async function run() {
  try {
    // Check if constraint exists
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'flywheel_collection_categories'
    `);
    console.log('Constraints:', constraints.rows);

    // Check if collection exists
    const collections = await pool.query(`
      SELECT id, slug FROM flywheel_collections WHERE slug = 'market-data'
    `);
    console.log('MarketData collection:', collections.rows);

    // Try direct insert without ON CONFLICT
    if (collections.rows.length > 0) {
      const collectionId = collections.rows[0].id;
      console.log('Inserting test root for collection:', collectionId);

      const result = await pool.query(`
        INSERT INTO flywheel_collection_categories (
          collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable
        ) VALUES (
          $1, 'test-root', 'TestRoot', 'Test Root', 'Test description', 1, 99, 'test', '#81c784', TRUE, TRUE
        ) RETURNING id
      `, [collectionId]);
      console.log('Insert result:', result.rows);

      // Delete test
      await pool.query(`DELETE FROM flywheel_collection_categories WHERE slug = 'test-root'`);
      console.log('Test root deleted');
    }

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}
run();
