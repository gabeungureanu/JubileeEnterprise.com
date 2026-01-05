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
    const sql = fs.readFileSync('scripts/migrations/098_flywheel_collection_roots_batch3.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 098 executed successfully\n');

    // Intelligence Section
    console.log('INTELLIGENCE SECTION:');
    console.log('─'.repeat(50));
    const intelCollections = ['signals', 'strategies', 'models', 'forecasts', 'correlations',
                               'risk-profiles', 'scenario-analysis', 'optimization', 'alpha-research', 'constraints'];

    for (const slug of intelCollections) {
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

    // Execution Section
    console.log('\n\nEXECUTION SECTION:');
    console.log('─'.repeat(50));
    const execCollections = ['portfolios', 'trades', 'orders', 'execution-logs', 'performance',
                              'attribution', 'compliance', 'controls', 'alerts', 'audit'];

    for (const slug of execCollections) {
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
    console.log('\n' + '═'.repeat(50));
    console.log(`CUMULATIVE TOTAL (all batches): ${total.rows[0].total} roots`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
