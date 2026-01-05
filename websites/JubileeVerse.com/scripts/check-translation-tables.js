const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jubileeverse',
  user: 'guardian',
  password: 'askShaddai4e!'
});

async function check() {
  const client = await pool.connect();
  try {
    // Check version tracking
    console.log('=== Content Version Tracking ===');
    const versions = await client.query('SELECT * FROM plan_content_versions ORDER BY content_type');
    versions.rows.forEach(x => {
      console.log(`  ${x.content_type}: v${x.current_version} (updated: ${x.last_updated_at})`);
    });

    // Check static content
    console.log('\n=== Static Content by Language ===');
    const statics = await client.query('SELECT language_code, COUNT(*) as count FROM plan_page_translations GROUP BY language_code ORDER BY language_code');
    statics.rows.forEach(x => {
      console.log(`  ${x.language_code}: ${x.count} entries`);
    });

    // Check feature translations
    console.log('\n=== Feature Translations by Language ===');
    const features = await client.query('SELECT language_code, COUNT(*) as count FROM plan_feature_translations GROUP BY language_code ORDER BY language_code');
    if (features.rows.length === 0) {
      console.log('  (none yet - will be created when non-English users visit)');
    } else {
      features.rows.forEach(x => {
        console.log(`  ${x.language_code}: ${x.count} features translated`);
      });
    }

    // Check category translations
    console.log('\n=== Category Translations by Language ===');
    const categories = await client.query('SELECT language_code, COUNT(*) as count FROM plan_feature_category_translations GROUP BY language_code ORDER BY language_code');
    if (categories.rows.length === 0) {
      console.log('  (none yet - will be created when non-English users visit)');
    } else {
      categories.rows.forEach(x => {
        console.log(`  ${x.language_code}: ${x.count} categories translated`);
      });
    }

    // Show sample of English static content
    console.log('\n=== English Static Content ===');
    const englishStatic = await client.query("SELECT content_key, content_value FROM plan_page_translations WHERE language_code = 'en' ORDER BY content_key LIMIT 5");
    englishStatic.rows.forEach(x => {
      const val = x.content_value.length > 50 ? x.content_value.substring(0, 50) + '...' : x.content_value;
      console.log(`  ${x.content_key}: "${val}"`);
    });

    console.log('\n=== Translation System Status: READY ===');

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
