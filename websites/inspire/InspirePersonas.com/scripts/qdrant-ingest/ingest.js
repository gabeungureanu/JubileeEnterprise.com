/**
 * Main Ingestion Script
 * Processes Step00-Step32 files and ingests into Qdrant
 * Inspire Family Framework v8.0
 */

const fs = require('fs');
const path = require('path');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');

const config = require('./config');
const { chunkStepFile, estimateTokens } = require('./chunker');
const { generateEmbeddingsBatch, prepareTextForEmbedding, validateEmbedding } = require('./embedder');

// Initialize Qdrant client
const qdrant = new QdrantClient({
  host: config.qdrant.host,
  port: config.qdrant.port
});

// Statistics tracking
const stats = {
  filesProcessed: 0,
  chunksCreated: 0,
  pointsInserted: 0,
  totalTokens: 0,
  errors: [],
  startTime: null,
  endTime: null
};

/**
 * Main ingestion function
 */
async function ingestStepFiles() {
  console.log('='.repeat(80));
  console.log('QDRANT INGESTION - Inspire Family Framework v8.0');
  console.log('='.repeat(80));
  console.log(`\nStarted at: ${new Date().toISOString()}`);

  stats.startTime = Date.now();

  try {
    // Verify Qdrant connection
    await verifyQdrantConnection();

    // Get list of Step files
    const stepFiles = getStepFiles();
    console.log(`\nFound ${stepFiles.length} Step files to process.`);

    // Process each Step file
    for (const file of stepFiles) {
      await processStepFile(file);
    }

    // Final statistics
    stats.endTime = Date.now();
    printFinalStats();

  } catch (error) {
    console.error('\n[ERROR] Ingestion failed:', error.message);
    stats.errors.push({ file: 'GLOBAL', error: error.message });
    process.exit(1);
  }
}

/**
 * Verifies Qdrant connection and collection existence
 */
async function verifyQdrantConnection() {
  console.log('\nVerifying Qdrant connection...');

  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === config.qdrant.collectionName);

    if (!exists) {
      console.error(`\n[ERROR] Collection '${config.qdrant.collectionName}' not found.`);
      console.error('Run setup-collection.js first to create the collection.');
      process.exit(1);
    }

    const info = await qdrant.getCollection(config.qdrant.collectionName);
    console.log(`  - Collection: ${config.qdrant.collectionName}`);
    console.log(`  - Current points: ${info.points_count}`);
    console.log(`  - Status: ${info.status}`);
    console.log('  - Connection verified!');

  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n[ERROR] Cannot connect to Qdrant.');
      console.error('Make sure Qdrant is running: docker run -p 6333:6333 qdrant/qdrant');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Gets list of Step files in order
 */
function getStepFiles() {
  const files = [];

  for (let step = 0; step <= 32; step++) {
    const stepStr = String(step).padStart(2, '0');
    const filename = `inspire.personas.step${stepStr}.txt`;
    const filepath = path.join(config.paths.personasDir, filename);

    if (fs.existsSync(filepath)) {
      files.push({
        step: step,
        filename: filename,
        filepath: filepath
      });
    } else {
      console.warn(`  [WARN] File not found: ${filename}`);
    }
  }

  return files;
}

/**
 * Processes a single Step file
 */
async function processStepFile(file) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Processing: ${file.filename} (Step ${file.step})`);
  console.log('─'.repeat(80));

  try {
    // Read file content
    const content = fs.readFileSync(file.filepath, 'utf-8');
    const fileTokens = estimateTokens(content);
    console.log(`  File size: ${(content.length / 1024).toFixed(1)} KB (~${fileTokens} tokens)`);

    // Chunk the content
    console.log('  Chunking content...');
    const chunks = chunkStepFile(content, file.filename, file.step);
    console.log(`  Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.log('  [SKIP] No chunks to process');
      return;
    }

    stats.chunksCreated += chunks.length;

    // Prepare texts for embedding
    const textsToEmbed = chunks.map(chunk => prepareTextForEmbedding(chunk));

    // Generate embeddings
    console.log('  Generating embeddings...');
    const embeddings = await generateEmbeddingsBatch(textsToEmbed);

    // Validate embeddings
    for (const embedding of embeddings) {
      validateEmbedding(embedding);
    }
    console.log(`  Generated ${embeddings.length} embeddings`);

    // Prepare points for Qdrant
    const points = chunks.map((chunk, index) => ({
      id: uuidv4(),
      vector: embeddings[index],
      payload: {
        ...chunk.metadata,
        text: chunk.content,
        chunk_id: chunk.id
      }
    }));

    // Insert into Qdrant
    console.log('  Inserting into Qdrant...');
    await qdrant.upsert(config.qdrant.collectionName, {
      wait: true,
      points: points
    });

    stats.pointsInserted += points.length;
    stats.filesProcessed++;
    stats.totalTokens += fileTokens;

    console.log(`  [OK] Inserted ${points.length} points`);

    // Log chunk distribution by content type
    const typeDistribution = {};
    for (const chunk of chunks) {
      const type = chunk.metadata.content_type;
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    }
    console.log('  Content type distribution:');
    for (const [type, count] of Object.entries(typeDistribution)) {
      console.log(`    - ${type}: ${count}`);
    }

  } catch (error) {
    console.error(`  [ERROR] Failed to process ${file.filename}:`, error.message);
    stats.errors.push({ file: file.filename, error: error.message });
  }
}

/**
 * Prints final statistics
 */
function printFinalStats() {
  const duration = (stats.endTime - stats.startTime) / 1000;

  console.log('\n' + '='.repeat(80));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(80));

  console.log('\nStatistics:');
  console.log(`  - Files processed: ${stats.filesProcessed}`);
  console.log(`  - Chunks created: ${stats.chunksCreated}`);
  console.log(`  - Points inserted: ${stats.pointsInserted}`);
  console.log(`  - Total tokens processed: ~${stats.totalTokens.toLocaleString()}`);
  console.log(`  - Duration: ${duration.toFixed(1)} seconds`);
  console.log(`  - Rate: ${(stats.pointsInserted / duration).toFixed(1)} points/sec`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    for (const err of stats.errors) {
      console.log(`  - ${err.file}: ${err.error}`);
    }
  } else {
    console.log('\n  No errors encountered!');
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

/**
 * Verify ingestion results
 */
async function verifyIngestion() {
  console.log('\n' + '─'.repeat(80));
  console.log('VERIFICATION');
  console.log('─'.repeat(80));

  try {
    const info = await qdrant.getCollection(config.qdrant.collectionName);
    console.log(`\nCollection: ${config.qdrant.collectionName}`);
    console.log(`  - Total points: ${info.points_count}`);
    console.log(`  - Indexed: ${info.indexed_vectors_count || 'N/A'}`);

    // Sample query to verify
    console.log('\nSample query test (Step 00 content)...');
    const result = await qdrant.scroll(config.qdrant.collectionName, {
      filter: {
        must: [
          { key: 'step_number', match: { value: 0 } }
        ]
      },
      limit: 3,
      with_payload: true,
      with_vector: false
    });

    console.log(`  Found ${result.points.length} points for Step 00`);
    if (result.points.length > 0) {
      console.log('  Sample payload:');
      const sample = result.points[0].payload;
      console.log(`    - Content type: ${sample.content_type}`);
      console.log(`    - Persona scope: ${JSON.stringify(sample.persona_scope)}`);
      console.log(`    - Text preview: ${sample.text.substring(0, 100)}...`);
    }

    console.log('\n[OK] Verification complete!');

  } catch (error) {
    console.error('\n[ERROR] Verification failed:', error.message);
  }
}

// Run ingestion
ingestStepFiles().then(async () => {
  await verifyIngestion();
  console.log('\n' + '='.repeat(80));
}).catch(console.error);
