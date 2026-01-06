/**
 * Verification and Testing Script
 * Tests Qdrant ingestion and retrieval functionality
 * Inspire Family Framework v8.0
 */

const { InspireRetriever, getCollectionStats, quickRetrieve } = require('./retriever');
const config = require('./config');

async function runVerification() {
  console.log('='.repeat(80));
  console.log('QDRANT VERIFICATION - Inspire Family Framework v8.0');
  console.log('='.repeat(80));

  try {
    // 1. Collection Statistics
    console.log('\n1. COLLECTION STATISTICS');
    console.log('─'.repeat(40));

    const stats = await getCollectionStats();
    console.log(`\nTotal points in collection: ${stats.totalPoints}`);

    console.log('\nContent type distribution:');
    for (const [type, count] of Object.entries(stats.byContentType).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${type}: ${count}`);
    }

    console.log('\nPoints by step (first 10):');
    const stepEntries = Object.entries(stats.byStep).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).slice(0, 10);
    for (const [step, count] of stepEntries) {
      console.log(`  - Step ${step.padStart(2, '0')}: ${count}`);
    }

    console.log('\nPoints by persona:');
    for (const [persona, count] of Object.entries(stats.byPersona).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${persona}: ${count}`);
    }

    // 2. Test Queries
    console.log('\n\n2. TEST QUERIES');
    console.log('─'.repeat(40));

    const retriever = new InspireRetriever({ limit: 3 });

    // Query 1: Covenant Declaration
    console.log('\nQuery: "sealed covenant declaration over InspireFamily"');
    const covenantResults = await retriever.retrieve('sealed covenant declaration over InspireFamily');
    console.log(`  Found ${covenantResults.length} results:`);
    for (const r of covenantResults) {
      console.log(`    - [${(r.score * 100).toFixed(1)}%] Step ${r.metadata.step_number} - ${r.metadata.content_type}`);
      console.log(`      Preview: ${r.text.substring(0, 80)}...`);
    }

    // Query 2: Jubilee persona
    console.log('\nQuery: "Jubilee Inspire evangelist prophet"');
    const jubileeResults = await retriever.retrieveForPersona('Jubilee Inspire evangelist prophet', 'jubilee');
    console.log(`  Found ${jubileeResults.length} results:`);
    for (const r of jubileeResults) {
      console.log(`    - [${(r.score * 100).toFixed(1)}%] Step ${r.metadata.step_number} - ${r.metadata.content_type}`);
    }

    // Query 3: Step-specific query
    console.log('\nQuery: "Stage 10 biblical interpretation" (Step 10 only)');
    const step10Results = await retriever.retrieveForStep('Stage 10 biblical interpretation', 10);
    console.log(`  Found ${step10Results.length} results:`);
    for (const r of step10Results) {
      console.log(`    - [${(r.score * 100).toFixed(1)}%] ${r.metadata.content_type}`);
      console.log(`      Preview: ${r.text.substring(0, 80)}...`);
    }

    // Query 4: Content type query
    console.log('\nQuery: "baptism consecration protocol" (type: covenant_rule)');
    const protocolResults = await retriever.retrieveByType('baptism consecration protocol', 'covenant_rule');
    console.log(`  Found ${protocolResults.length} results:`);
    for (const r of protocolResults) {
      console.log(`    - [${(r.score * 100).toFixed(1)}%] Step ${r.metadata.step_number}`);
    }

    // 3. Formatted Output Test
    console.log('\n\n3. FORMATTED OUTPUT TEST');
    console.log('─'.repeat(40));

    const sampleResults = await retriever.retrieve('inspire mansion virtual environment');
    console.log('\nFormatted for prompt injection:');
    console.log(retriever.formatForPrompt(sampleResults.slice(0, 2)));

    // 4. Comprehensive Retrieval Test
    console.log('\n\n4. COMPREHENSIVE RETRIEVAL TEST');
    console.log('─'.repeat(40));

    const comprehensiveResults = await retriever.retrieveComprehensive(
      'developmental stage emotional maturity',
      {
        persona: 'jubilee',
        currentStep: 15,
        contentTypes: ['developmental_stage', 'behavioral_protocol']
      }
    );

    console.log(`\nComprehensive query for Jubilee (max Step 15):`);
    console.log(`  Found ${comprehensiveResults.length} deduplicated results`);
    for (const r of comprehensiveResults) {
      console.log(`    - [${(r.score * 100).toFixed(1)}%] Step ${r.metadata.step_number} - ${r.metadata.content_type}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n[ERROR]', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nQdrant is not running. Start it with:');
      console.error('  docker run -p 6333:6333 qdrant/qdrant');
    }

    if (error.message.includes('Not found')) {
      console.error('\nCollection not found. Run ingestion first:');
      console.error('  node scripts/qdrant-ingest/setup-collection.js');
      console.error('  node scripts/qdrant-ingest/ingest.js');
    }

    process.exit(1);
  }
}

// Run verification
runVerification().catch(console.error);
