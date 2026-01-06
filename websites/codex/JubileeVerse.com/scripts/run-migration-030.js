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
    // First, let's see current state
    console.log('Current feature status by category:\n');

    const categories = await client.query(`
      SELECT c.id, c.name, c.slug, c.display_order, c.is_published
      FROM plan_feature_categories c
      ORDER BY c.display_order
    `);

    for (const cat of categories.rows) {
      console.log(`\n${cat.display_order}. ${cat.name} (published: ${cat.is_published})`);

      const features = await client.query(`
        SELECT id, name, slug, is_published, free_plan, standard_plan, ministry_plan, business_plan
        FROM plan_features
        WHERE category_id = $1
        ORDER BY display_order
      `, [cat.id]);

      for (const f of features.rows) {
        const plans = [];
        if (f.free_plan) plans.push('F');
        if (f.standard_plan) plans.push('S');
        if (f.ministry_plan) plans.push('M');
        if (f.business_plan) plans.push('B');
        console.log(`  - ${f.name} [${plans.join(',')}] (published: ${f.is_published})`);
      }
    }

    // Now let's ensure all categories are published
    console.log('\n\nPublishing all categories...');
    await client.query(`UPDATE plan_feature_categories SET is_published = true`);

    // Ensure all features are published
    console.log('Publishing all features...');
    await client.query(`UPDATE plan_features SET is_published = true`);

    // Update Trust & Safety features - all plans should have access to trust/safety
    console.log('Setting Trust & Safety features for all plans...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = true, standard_plan = true, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'trust-safety'
    `);

    // Update Core Features - all plans should have access
    console.log('Setting Core Features for all plans...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = true, standard_plan = true, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'core-features'
    `);

    // Update Standard Edition features - Standard, Ministry, Business only (not Free)
    console.log('Setting Standard Edition features...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = false, standard_plan = true, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'standard-edition'
    `);

    // Update Prayer & Devotion features - Standard, Ministry, Business only
    console.log('Setting Prayer & Devotion features...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = false, standard_plan = true, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'prayer-devotion'
    `);

    // Update Community & Accountability features - Standard, Ministry, Business
    // Except Mentor Matching which is Ministry and Business only
    console.log('Setting Community & Accountability features...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = false, standard_plan = true, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'community-accountability' AND f.slug != 'mentor-matching'
    `);
    await client.query(`
      UPDATE plan_features
      SET free_plan = false, standard_plan = false, ministry_plan = true, business_plan = true
      WHERE slug = 'mentor-matching'
    `);

    // Update Bible Study Deep features - Standard, Ministry, Business
    // Verse Highlighting is for all plans
    console.log('Setting Bible Study Deep features...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = false, standard_plan = true, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'bible-study-deep' AND f.slug != 'verse-highlighting'
    `);
    await client.query(`
      UPDATE plan_features
      SET free_plan = true, standard_plan = true, ministry_plan = true, business_plan = true
      WHERE slug = 'verse-highlighting'
    `);

    // Update Habit Building features - Standard, Ministry, Business
    // Annual Reading Plans is for all plans
    console.log('Setting Habit Building features...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = false, standard_plan = true, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'habit-building' AND f.slug != 'annual-reading-plans'
    `);
    await client.query(`
      UPDATE plan_features
      SET free_plan = true, standard_plan = true, ministry_plan = true, business_plan = true
      WHERE slug = 'annual-reading-plans'
    `);

    // Update Ministry Edition features - Ministry and Business only
    console.log('Setting Ministry Edition features...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = false, standard_plan = false, ministry_plan = true, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'ministry-edition'
    `);

    // Update Business Edition features - Business only
    console.log('Setting Business Edition features...');
    await client.query(`
      UPDATE plan_features f
      SET free_plan = false, standard_plan = false, ministry_plan = false, business_plan = true
      FROM plan_feature_categories c
      WHERE f.category_id = c.id AND c.slug = 'business-edition'
    `);

    console.log('\n\n=== UPDATED FEATURE STATUS ===\n');

    const updatedCategories = await client.query(`
      SELECT c.id, c.name, c.slug, c.display_order, c.is_published
      FROM plan_feature_categories c
      ORDER BY c.display_order
    `);

    for (const cat of updatedCategories.rows) {
      console.log(`\n${cat.display_order}. ${cat.name}`);

      const features = await client.query(`
        SELECT id, name, slug, is_published, free_plan, standard_plan, ministry_plan, business_plan
        FROM plan_features
        WHERE category_id = $1
        ORDER BY display_order
      `, [cat.id]);

      for (const f of features.rows) {
        const plans = [];
        if (f.free_plan) plans.push('F');
        if (f.standard_plan) plans.push('S');
        if (f.ministry_plan) plans.push('M');
        if (f.business_plan) plans.push('B');
        console.log(`  ✓ ${f.name} [${plans.join(',')}]`);
      }
    }

    console.log('\n\nMigration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
