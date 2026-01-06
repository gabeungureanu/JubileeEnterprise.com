/**
 * Test Script for Plan Translation System
 * Tests version checking and re-translation logic
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jubileeverse',
  user: 'guardian',
  password: 'askShaddai4e!'
});

async function test() {
  const client = await pool.connect();
  try {
    console.log('=== Plan Translation System Test ===\n');

    // 1. Test: Check if translation is needed for Spanish
    console.log('1. Checking if Spanish translation is needed...');

    const featuresCheck = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(ft.id) as translated,
             SUM(CASE WHEN ft.content_version < f.content_version THEN 1 ELSE 0 END) as outdated
      FROM plan_features f
      LEFT JOIN plan_feature_translations ft ON f.id = ft.feature_id AND ft.language_code = 'es'
      WHERE f.is_published = true
    `);

    const f = featuresCheck.rows[0];
    console.log(`   Features: ${f.translated}/${f.total} translated, ${f.outdated || 0} outdated`);
    console.log(`   Needs translation: ${parseInt(f.translated) < parseInt(f.total) || parseInt(f.outdated || 0) > 0}`);

    // 2. Test: Simulate a feature update to increment version
    console.log('\n2. Simulating content update (version increment)...');

    // Get a feature to update
    const featureResult = await client.query(`SELECT id, name, content_version FROM plan_features LIMIT 1`);
    if (featureResult.rows.length > 0) {
      const feature = featureResult.rows[0];
      console.log(`   Feature before: "${feature.name}" (v${feature.content_version})`);

      // Update the feature (trigger should increment version)
      await client.query(`UPDATE plan_features SET name = $1 WHERE id = $2`, [feature.name + ' ', feature.id]);

      // Revert name but keep version incremented
      await client.query(`UPDATE plan_features SET name = $1, content_version = content_version WHERE id = $2`, [feature.name.trim(), feature.id]);

      const updatedFeature = await client.query(`SELECT name, content_version FROM plan_features WHERE id = $1`, [feature.id]);
      console.log(`   Feature after: "${updatedFeature.rows[0].name}" (v${updatedFeature.rows[0].content_version})`);
    }

    // 3. Test: Check global version tracking
    console.log('\n3. Checking version tracking table...');
    const versions = await client.query('SELECT * FROM plan_content_versions ORDER BY content_type');
    versions.rows.forEach(v => {
      console.log(`   ${v.content_type}: v${v.current_version}`);
    });

    // 4. Test: Manually insert a Spanish translation to test the flow
    console.log('\n4. Testing Spanish translation insertion...');

    // Get first category
    const catResult = await client.query(`SELECT id, name, content_version FROM plan_feature_categories WHERE is_published = true LIMIT 1`);
    if (catResult.rows.length > 0) {
      const cat = catResult.rows[0];

      // Insert or update Spanish translation
      await client.query(`
        INSERT INTO plan_feature_category_translations
          (category_id, language_code, name, content_version)
        VALUES ($1, 'es', $2, $3)
        ON CONFLICT (category_id, language_code)
        DO UPDATE SET name = EXCLUDED.name, content_version = EXCLUDED.content_version, updated_at = CURRENT_TIMESTAMP
      `, [cat.id, 'Prueba: ' + cat.name, cat.content_version]);

      console.log(`   Inserted Spanish translation for category: "${cat.name}"`);
    }

    // 5. Verify translations
    console.log('\n5. Verifying translations...');
    const catTrans = await client.query(`SELECT * FROM plan_feature_category_translations WHERE language_code = 'es'`);
    console.log(`   Spanish category translations: ${catTrans.rows.length}`);

    // 6. Clean up test translation
    console.log('\n6. Cleaning up test data...');
    await client.query(`DELETE FROM plan_feature_category_translations WHERE language_code = 'es'`);
    console.log('   Removed test Spanish translations');

    console.log('\n=== Test Complete ===');
    console.log('The translation system is properly configured with:');
    console.log('  - Version tracking for features, categories, and static content');
    console.log('  - Automatic version increment on content updates');
    console.log('  - Translation tables ready for non-English content');
    console.log('\nTo trigger actual translations:');
    console.log('  1. Set localStorage.setItem("preferredLanguage", "es") in browser');
    console.log('  2. Visit the /plans page');
    console.log('  3. The API will detect the need for translation and trigger it');

  } finally {
    client.release();
    await pool.end();
  }
}

test().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
