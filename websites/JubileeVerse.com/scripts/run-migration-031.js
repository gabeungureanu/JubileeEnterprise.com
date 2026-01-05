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
    console.log('Running migration 031: Plan Feature Translations...\n');

    // Create plan_feature_translations table
    console.log('Creating plan_feature_translations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_feature_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_id UUID NOT NULL REFERENCES plan_features(id) ON DELETE CASCADE,
        language_code VARCHAR(10) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        content_version INTEGER NOT NULL DEFAULT 1,
        translated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(feature_id, language_code)
      )
    `);

    // Create plan_feature_category_translations table
    console.log('Creating plan_feature_category_translations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_feature_category_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id UUID NOT NULL REFERENCES plan_feature_categories(id) ON DELETE CASCADE,
        language_code VARCHAR(10) NOT NULL,
        name TEXT NOT NULL,
        content_version INTEGER NOT NULL DEFAULT 1,
        translated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, language_code)
      )
    `);

    // Create plan_page_translations table
    console.log('Creating plan_page_translations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_page_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_key VARCHAR(100) NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        content_value TEXT NOT NULL,
        content_version INTEGER NOT NULL DEFAULT 1,
        translated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(content_key, language_code)
      )
    `);

    // Create plan_content_versions table
    console.log('Creating plan_content_versions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_content_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_type VARCHAR(50) NOT NULL UNIQUE,
        current_version INTEGER NOT NULL DEFAULT 1,
        last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Initialize version tracking
    console.log('Initializing version tracking...');
    await client.query(`
      INSERT INTO plan_content_versions (content_type, current_version)
      VALUES ('features', 1), ('categories', 1), ('static', 1)
      ON CONFLICT (content_type) DO NOTHING
    `);

    // Add content_version to plan_features if not exists
    console.log('Adding content_version to plan_features...');
    try {
      await client.query(`
        ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1
      `);
    } catch (e) {
      // Column might already exist
    }

    // Add content_version to plan_feature_categories if not exists
    console.log('Adding content_version to plan_feature_categories...');
    try {
      await client.query(`
        ALTER TABLE plan_feature_categories ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1
      `);
    } catch (e) {
      // Column might already exist
    }

    // Create indexes
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_feature_translations_feature_lang
        ON plan_feature_translations(feature_id, language_code)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_feature_category_translations_cat_lang
        ON plan_feature_category_translations(category_id, language_code)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_page_translations_key_lang
        ON plan_page_translations(content_key, language_code)
    `);

    // Insert default static content
    console.log('Inserting default static content...');
    const staticContent = [
      ['page_title', 'Subscription Plans'],
      ['page_description', "Whether you're a passionate student of the Scriptures or a thriving faith-based business, we've got the perfect plan tailored just for you!"],
      ['free_plan_name', 'Free Plan'],
      ['free_plan_description', 'Try out the most advanced AI Bible personalities and get real answers.'],
      ['standard_plan_name', 'Standard Edition'],
      ['standard_plan_description', 'Resources for mentoring, group studies, and teaching.'],
      ['ministry_plan_name', 'Ministry Edition'],
      ['ministry_plan_description', 'Tools for churches, sermons, teams, and outreach.'],
      ['business_plan_name', 'Business Edition'],
      ['business_plan_description', 'AI-powered tools for faith-based organizations. (Business Coaching)'],
      ['per_month', 'per month'],
      ['per_year', 'per year'],
      ['get_started', 'GET STARTED'],
      ['recommended', 'RECOMMENDED'],
      ['two_months_free', '2 MONTHS FREE'],
      ['monthly', 'MONTHLY'],
      ['month', 'MONTH'],
      ['year', 'YEAR'],
      ['back', 'Back']
    ];

    for (const [key, value] of staticContent) {
      await client.query(`
        INSERT INTO plan_page_translations (content_key, language_code, content_value, content_version)
        VALUES ($1, 'en', $2, 1)
        ON CONFLICT (content_key, language_code) DO NOTHING
      `, [key, value]);
    }

    // Create trigger function for feature version
    console.log('Creating trigger functions...');
    await client.query(`
      CREATE OR REPLACE FUNCTION increment_plan_feature_version()
      RETURNS TRIGGER AS $func$
      BEGIN
        NEW.content_version := COALESCE(OLD.content_version, 0) + 1;
        NEW.updated_at := CURRENT_TIMESTAMP;
        UPDATE plan_content_versions
        SET current_version = current_version + 1, last_updated_at = CURRENT_TIMESTAMP
        WHERE content_type = 'features';
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION increment_plan_category_version()
      RETURNS TRIGGER AS $func$
      BEGIN
        NEW.content_version := COALESCE(OLD.content_version, 0) + 1;
        NEW.updated_at := CURRENT_TIMESTAMP;
        UPDATE plan_content_versions
        SET current_version = current_version + 1, last_updated_at = CURRENT_TIMESTAMP
        WHERE content_type = 'categories';
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql
    `);

    // Create triggers
    console.log('Creating triggers...');
    await client.query(`DROP TRIGGER IF EXISTS trigger_plan_feature_version ON plan_features`);
    await client.query(`
      CREATE TRIGGER trigger_plan_feature_version
        BEFORE UPDATE OF name, description ON plan_features
        FOR EACH ROW
        WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.description IS DISTINCT FROM NEW.description)
        EXECUTE FUNCTION increment_plan_feature_version()
    `);

    await client.query(`DROP TRIGGER IF EXISTS trigger_plan_category_version ON plan_feature_categories`);
    await client.query(`
      CREATE TRIGGER trigger_plan_category_version
        BEFORE UPDATE OF name ON plan_feature_categories
        FOR EACH ROW
        WHEN (OLD.name IS DISTINCT FROM NEW.name)
        EXECUTE FUNCTION increment_plan_category_version()
    `);

    // Verify
    console.log('\n=== Migration Results ===\n');

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'plan%translation%'
      ORDER BY table_name
    `);
    console.log('Translation tables:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    const versions = await client.query('SELECT * FROM plan_content_versions ORDER BY content_type');
    console.log('\nVersion tracking:');
    versions.rows.forEach(row => console.log(`  - ${row.content_type}: v${row.current_version}`));

    const statics = await client.query('SELECT COUNT(*) as count FROM plan_page_translations');
    console.log(`\nStatic content entries: ${statics.rows[0].count}`);

    console.log('\nMigration 031 complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
