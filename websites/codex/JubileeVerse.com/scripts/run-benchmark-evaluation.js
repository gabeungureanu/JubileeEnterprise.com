#!/usr/bin/env node
/**
 * Run benchmark evaluation on Genesis 1:1
 * This script directly calls the BenchmarkEvaluationService
 */

require('dotenv').config();

// Initialize database
const database = require('../src/database');

// Import the service
const BenchmarkEvaluationService = require('../src/services/BenchmarkEvaluationService');

async function run() {
  console.log('Starting benchmark evaluation for Genesis 1:1 ESV...\n');

  try {
    // Initialize database first
    await database.initialize();

    // Run the evaluation
    const result = await BenchmarkEvaluationService.evaluateVerse('genesis', 1, 1, 'ESV');

    console.log('='.repeat(60));
    console.log('BENCHMARK EVALUATION RESULTS');
    console.log('='.repeat(60));
    console.log(`\nVerse: ${result.verse.book_name} ${result.verse.chapter_number}:${result.verse.verse_number}`);
    console.log(`Text: "${result.verse.verse_text}"`);
    console.log(`Translation: ${result.verse.translation_code}`);
    console.log('');
    console.log('-'.repeat(60));
    console.log('INDIVIDUAL CRITERION SCORES (1-10)');
    console.log('-'.repeat(60));

    // Display each criterion and score
    Object.entries(result.details).forEach(([num, detail]) => {
      const inverted = detail.name.includes('Inverted') ? ' (inverted)' : '';
      console.log(`\n${num}. ${detail.name}${inverted}`);
      console.log(`   Score: ${detail.score}/10`);
      console.log(`   ${detail.justification}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTotal Score: ${result.benchmark.total_score}/200`);
    console.log(`Percentage: ${result.benchmark.percentage_score}%`);
    console.log(`Grade: ${result.benchmark.grade}`);
    console.log(`\nStrengths:`);
    result.benchmark.strengths?.forEach(s => console.log(`  • ${s}`));
    console.log(`\nAreas for Improvement:`);
    result.benchmark.improvements?.forEach(i => console.log(`  • ${i}`));
    console.log(`\nOverall Assessment:`);
    console.log(`  ${result.benchmark.overall_assessment}`);
    console.log(`\nRecommendation:`);
    console.log(`  ${result.benchmark.recommendation}`);
    console.log('\n' + '='.repeat(60));
    console.log('Evaluation stored successfully in database.');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error running benchmark evaluation:', error.message);
    console.error(error.stack);
  } finally {
    await database.shutdown();
    process.exit(0);
  }
}

run();
