/**
 * Check Genesis Chapter 1 translation status
 */

const database = require('../src/database');

async function checkVerses() {
  try {
    await database.initialize();

    const result = await database.query(`
      SELECT v.verse_number, v.verse_text,
             COALESCE(b.total_score, 0) as score
      FROM bible_verses v
      LEFT JOIN verse_benchmark_results b ON v.id = b.verse_id
      WHERE v.book_name = 'Genesis' AND v.chapter_number = 1
      ORDER BY v.verse_number
    `);

    console.log('Genesis Chapter 1 - Translation Status:');
    console.log('='.repeat(100));

    let elohimCount = 0;
    result.rows.forEach(r => {
      const preview = r.verse_text.substring(0, 80);
      const hasElohim = r.verse_text.includes('Elohim');
      if (hasElohim) elohimCount++;
      const status = hasElohim ? '✓' : '✗';
      console.log(`${status} Verse ${r.verse_number.toString().padStart(2)} | Score: ${r.score.toString().padStart(4)} | ${preview}...`);
    });

    console.log('='.repeat(100));
    console.log(`Total verses: ${result.rows.length}`);
    console.log(`With Elohim: ${elohimCount}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkVerses();
