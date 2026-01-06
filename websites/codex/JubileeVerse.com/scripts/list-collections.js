#!/usr/bin/env node
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function list() {
  const result = await pool.query(`
    SELECT section::text, name, display_order
    FROM collections
    ORDER BY section, display_order
  `);

  let currentSection = '';
  const sectionCounts = {};

  result.rows.forEach(r => {
    if (!sectionCounts[r.section]) sectionCounts[r.section] = 0;
    sectionCounts[r.section]++;
  });

  console.log('=== COLLECTIONS BY SECTION ===\n');

  result.rows.forEach(r => {
    if (r.section !== currentSection) {
      if (currentSection) console.log('');
      currentSection = r.section;
      const sectionName = currentSection.replace(/_/g, ' ').toUpperCase();
      console.log(`[${sectionName}] (${sectionCounts[currentSection]} collections)`);
    }
    console.log(`  ${r.display_order}. ${r.name}`);
  });

  console.log('\n=== SUMMARY ===');
  Object.keys(sectionCounts).forEach(s => {
    console.log(`  ${s}: ${sectionCounts[s]}`);
  });
  console.log(`  TOTAL: ${result.rows.length} collections`);

  await pool.end();
}
list();
