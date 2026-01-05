const database = require('../src/database');

async function getVerses() {
  try {
    await database.initialize();

    const result = await database.query(
      'SELECT verse_number, verse_text, verse_preview FROM bible_verses WHERE LOWER(book_id) = $1 AND chapter_number = $2 ORDER BY verse_number',
      ['genesis', 1]
    );

    console.log('Genesis Chapter 1 verses:', result.rows.length);
    result.rows.forEach(v => {
      const text = v.verse_text || v.verse_preview || '';
      console.log('Verse ' + v.verse_number + ': ' + text.substring(0, 80) + (text.length > 80 ? '...' : ''));
    });

    await database.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

getVerses();
