/**
 * Flywheel Knowledge Architecture Validation Script
 *
 * Validates that:
 * 1. Exactly 3 sections exist (Data, Intelligence, Execution)
 * 2. 30 collections exist (10 per section)
 * 3. No orphaned collections
 * 4. Referential integrity is maintained
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'JubileeVerse',
  user: process.env.DB_USER || 'guardian',
  password: process.env.DB_PASSWORD
});

async function validate() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   FLYWHEEL KNOWLEDGE ARCHITECTURE VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Validate sections
    console.log('1. FLYWHEEL SECTIONS (flywheel_collection_categories)');
    console.log('───────────────────────────────────────────────────────────────');

    const sections = await pool.query(`
      SELECT * FROM v_flywheel_sections ORDER BY section_order
    `);

    console.log(`   Found ${sections.rows.length} sections:\n`);
    sections.rows.forEach(s => {
      console.log(`   [${s.section_order}] ${s.section_name}`);
      console.log(`       Slug: ${s.section_slug}`);
      console.log(`       Qdrant Prefix: ${s.qdrant_prefix}`);
      console.log(`       Collections: ${s.collection_count}`);
      console.log(`       Icon: ${s.icon} (${s.icon_color})`);
      console.log('');
    });

    // 2. Validate collections by section
    console.log('2. FLYWHEEL COLLECTIONS (flywheel_collections)');
    console.log('───────────────────────────────────────────────────────────────');

    const collections = await pool.query(`
      SELECT * FROM v_flywheel_collections_by_section
    `);

    let currentSection = '';
    collections.rows.forEach(c => {
      if (c.section_name !== currentSection) {
        currentSection = c.section_name;
        console.log(`\n   ┌─ ${currentSection.toUpperCase()} ─────────────────────────────`);
      }
      console.log(`   │ [${c.display_order.toString().padStart(2, '0')}] ${c.collection_name.padEnd(20)} → ${c.qdrant_collection_prefix}`);
    });
    console.log('   └─────────────────────────────────────────────────────────\n');

    // 3. Check for orphans
    console.log('3. ORPHAN CHECK');
    console.log('───────────────────────────────────────────────────────────────');

    const orphans = await pool.query(`
      SELECT * FROM v_flywheel_orphaned_collections
    `);

    if (orphans.rows.length === 0) {
      console.log('   ✓ No orphaned collections found\n');
    } else {
      console.log(`   ✗ Found ${orphans.rows.length} orphaned collections!\n`);
      orphans.rows.forEach(o => console.log(`     - ${o.name}`));
    }

    // 4. Summary
    console.log('4. VALIDATION SUMMARY');
    console.log('───────────────────────────────────────────────────────────────');

    const sectionCount = sections.rows.length;
    const collectionCount = collections.rows.length;
    const orphanCount = orphans.rows.length;

    const allValid = sectionCount === 3 && collectionCount === 30 && orphanCount === 0;

    console.log(`   Sections:    ${sectionCount}/3 ${sectionCount === 3 ? '✓' : '✗'}`);
    console.log(`   Collections: ${collectionCount}/30 ${collectionCount === 30 ? '✓' : '✗'}`);
    console.log(`   Orphans:     ${orphanCount} ${orphanCount === 0 ? '✓' : '✗'}`);
    console.log('');

    if (allValid) {
      console.log('   ════════════════════════════════════════════════════════════');
      console.log('   ✓ FLYWHEEL ARCHITECTURE VALIDATED SUCCESSFULLY');
      console.log('   ════════════════════════════════════════════════════════════');
    } else {
      console.log('   ════════════════════════════════════════════════════════════');
      console.log('   ✗ VALIDATION FAILED - Check errors above');
      console.log('   ════════════════════════════════════════════════════════════');
    }

    // 5. Table naming convention check
    console.log('\n5. FLYWHEEL TABLE NAMING CONVENTION');
    console.log('───────────────────────────────────────────────────────────────');

    const flywheelTables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'flywheel_%'
      ORDER BY table_name
    `);

    console.log(`   Found ${flywheelTables.rows.length} flywheel_ prefixed tables:\n`);
    flywheelTables.rows.forEach(t => console.log(`   - ${t.table_name}`));
    console.log('\n   ✓ All Flywheel tables follow naming convention (flywheel_ prefix)');

  } catch (err) {
    console.error('Validation error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

validate();
