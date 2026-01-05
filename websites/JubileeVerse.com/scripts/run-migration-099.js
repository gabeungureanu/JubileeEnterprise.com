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
    const sql = fs.readFileSync('scripts/migrations/099_inspire_family_flywheel_collections.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 099 executed successfully\n');

    // Show Inspire Family Collections
    console.log('INSPIRE FAMILY COLLECTIONS:');
    console.log('═'.repeat(60));

    const inspireAgents = [
      'eliana-inspire', 'ava-sterling', 'grace-halley', 'naomi-vega',
      'talitha-rayne', 'judah-flint', 'orian-wells', 'selah-moreno',
      'knox-everen', 'theo-beck', 'zion-black', 'miles-greystone'
    ];

    for (const slug of inspireAgents) {
      const roots = await pool.query(`
        SELECT fcc.name, fcc.display_order
        FROM flywheel_collection_categories fcc
        JOIN flywheel_collections fc ON fcc.collection_id = fc.id
        WHERE fc.slug = $1
        ORDER BY fcc.display_order
      `, [slug]);

      const collName = await pool.query(`SELECT display_name FROM flywheel_collections WHERE slug = $1`, [slug]);
      console.log(`\n  ${collName.rows[0]?.display_name || slug}: ${roots.rows.length} roots`);
      roots.rows.forEach(r => console.log(`    [${r.display_order}] ${r.name}`));
    }

    // Totals
    const total = await pool.query(`
      SELECT COUNT(*) as total FROM flywheel_collection_categories WHERE collection_id IS NOT NULL
    `);

    const inspireTotal = await pool.query(`
      SELECT COUNT(*) as total
      FROM flywheel_collection_categories fcc
      JOIN flywheel_collections fc ON fcc.collection_id = fc.id
      WHERE fc.slug IN (
        'eliana-inspire', 'ava-sterling', 'grace-halley', 'naomi-vega',
        'talitha-rayne', 'judah-flint', 'orian-wells', 'selah-moreno',
        'knox-everen', 'theo-beck', 'zion-black', 'miles-greystone'
      )
    `);

    console.log('\n' + '═'.repeat(60));
    console.log(`INSPIRE FAMILY TOTAL: ${inspireTotal.rows[0].total} roots (12 collections x 6 roots)`);
    console.log(`CUMULATIVE TOTAL (all batches): ${total.rows[0].total} roots`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
