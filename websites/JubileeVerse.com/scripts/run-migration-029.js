const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jubileeverse',
  user: 'guardian',
  password: 'askShaddai4e!'
});

async function run() {
  const client = await pool.connect();
  try {
    // Move Annual Bible Reading Plans to Core Features
    console.log('Moving Annual Bible Reading Plans to Core Features...');
    await client.query(`
      UPDATE plan_features
      SET category_id = (SELECT id FROM plan_feature_categories WHERE slug = 'core-features')
      WHERE slug = 'annual-reading-plans'
    `);

    // Reorder categories
    console.log('Reordering categories...');
    await client.query(`UPDATE plan_feature_categories SET display_order = 1 WHERE slug = 'core-features'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 2 WHERE slug = 'trust-safety'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 3 WHERE slug = 'standard-edition'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 4 WHERE slug = 'prayer-devotion'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 5 WHERE slug = 'community-accountability'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 6 WHERE slug = 'bible-study-deep'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 7 WHERE slug = 'habit-building'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 8 WHERE slug = 'ministry-edition'`);
    await client.query(`UPDATE plan_feature_categories SET display_order = 9 WHERE slug = 'business-edition'`);

    // Verify
    const result = await client.query('SELECT id, name, slug, display_order FROM plan_feature_categories ORDER BY display_order');
    console.log('\nUpdated category order:');
    result.rows.forEach(row => {
      console.log(`  ${row.display_order}. ${row.name} (${row.slug})`);
    });

    // Verify Annual Bible Reading Plans moved
    const featureResult = await client.query(`
      SELECT f.name, c.name as category_name
      FROM plan_features f
      JOIN plan_feature_categories c ON f.category_id = c.id
      WHERE f.slug = 'annual-reading-plans'
    `);
    if (featureResult.rows.length > 0) {
      console.log(`\nAnnual Bible Reading Plans is now in: ${featureResult.rows[0].category_name}`);
    }

    console.log('\nMigration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
