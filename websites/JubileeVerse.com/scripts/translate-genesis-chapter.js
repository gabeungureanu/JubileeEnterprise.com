/**
 * Batch translate Genesis Chapter 1 verses using the benchmark evaluation system
 * This script calls the BenchmarkEvaluationService.evaluateVerse for each verse
 */

const database = require('../src/database');
const BenchmarkEvaluationService = require('../src/services/BenchmarkEvaluationService');
const logger = require('../src/utils/logger');

async function translateChapter() {
  try {
    console.log('Initializing database...');
    await database.initialize();

    const bookId = 'genesis';
    const chapter = 1;
    const startVerse = 6;  // Start from verse 6 (1-5 already translated)
    const endVerse = 31;   // End at verse 31

    console.log(`\nTranslating Genesis Chapter ${chapter}, verses ${startVerse}-${endVerse}`);
    console.log('Using translation.txt prompt template for AI-powered translation\n');

    for (let verseNum = startVerse; verseNum <= endVerse; verseNum++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing Genesis ${chapter}:${verseNum}...`);
      console.log('='.repeat(60));

      try {
        const result = await BenchmarkEvaluationService.evaluateVerse(bookId, chapter, verseNum, 'ESV');

        if (result) {
          console.log(`✓ Verse ${verseNum} translated successfully`);
          console.log(`  Score: ${result.total_score || 'N/A'}`);
        } else {
          console.log(`✗ Verse ${verseNum} - No result returned`);
        }
      } catch (error) {
        console.error(`✗ Error translating verse ${verseNum}:`, error.message);
      }

      // Small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('Translation complete!');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

translateChapter();
