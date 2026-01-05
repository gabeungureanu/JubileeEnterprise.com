#!/usr/bin/env node
/**
 * Check benchmark results in database
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function run() {
  try {
    const result = await pool.query(`
      SELECT verse_id, book_id, chapter_number, verse_number, translation_code,
             total_score, percentage_score, grade, evaluated_at
      FROM verse_benchmark_results
      LIMIT 5
    `);
    console.log('Benchmark Results in Database:');
    console.table(result.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
