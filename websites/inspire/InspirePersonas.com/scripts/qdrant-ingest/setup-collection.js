/**
 * Qdrant Collection Setup Script
 * Creates the inspire_knowledge collection with proper configuration
 * Inspire Family Framework v8.0
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('./config');

async function setupCollection() {
  console.log('='.repeat(80));
  console.log('QDRANT COLLECTION SETUP - Inspire Family Framework v8.0');
  console.log('='.repeat(80));

  const client = new QdrantClient({
    host: config.qdrant.host,
    port: config.qdrant.port
  });

  const collectionName = config.qdrant.collectionName;

  try {
    // Check if collection exists
    console.log(`\nChecking for existing collection: ${collectionName}`);
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (exists) {
      console.log(`Collection '${collectionName}' already exists.`);

      // Get collection info
      const info = await client.getCollection(collectionName);
      console.log('\nCollection Info:');
      console.log(`  - Points count: ${info.points_count}`);
      console.log(`  - Vector size: ${info.config.params.vectors.size}`);
      console.log(`  - Distance: ${info.config.params.vectors.distance}`);

      // Ask if we should recreate
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        rl.question('\nRecreate collection? (yes/no): ', async (answer) => {
          rl.close();
          if (answer.toLowerCase() === 'yes') {
            console.log('\nDeleting existing collection...');
            await client.deleteCollection(collectionName);
            await createNewCollection(client, collectionName);
          } else {
            console.log('\nKeeping existing collection.');
          }
          resolve();
        });
      });
    } else {
      await createNewCollection(client, collectionName);
    }

  } catch (error) {
    console.error('\nError during setup:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n[!] Cannot connect to Qdrant. Make sure Docker is running with Qdrant:');
      console.error('    docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant');
    }

    process.exit(1);
  }
}

async function createNewCollection(client, collectionName) {
  console.log(`\nCreating collection: ${collectionName}`);
  console.log(`  - Vector size: ${config.qdrant.vectorSize}`);
  console.log(`  - Distance metric: ${config.qdrant.distance}`);

  await client.createCollection(collectionName, {
    vectors: {
      size: config.qdrant.vectorSize,
      distance: config.qdrant.distance
    },
    optimizers_config: {
      default_segment_number: 2
    },
    replication_factor: 1
  });

  // Create payload indexes for efficient filtering
  console.log('\nCreating payload indexes...');

  const indexFields = [
    { field: 'persona_scope', type: 'keyword' },
    { field: 'step_number', type: 'integer' },
    { field: 'content_type', type: 'keyword' },
    { field: 'source_file', type: 'keyword' },
    { field: 'version', type: 'keyword' }
  ];

  for (const { field, type } of indexFields) {
    try {
      await client.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: type
      });
      console.log(`  - Created index: ${field} (${type})`);
    } catch (err) {
      console.log(`  - Index ${field} may already exist: ${err.message}`);
    }
  }

  console.log('\n[OK] Collection created successfully!');

  // Verify collection
  const info = await client.getCollection(collectionName);
  console.log('\nCollection verification:');
  console.log(`  - Name: ${collectionName}`);
  console.log(`  - Status: ${info.status}`);
  console.log(`  - Vector config: ${JSON.stringify(info.config.params.vectors)}`);
}

// Run setup
setupCollection().then(() => {
  console.log('\n' + '='.repeat(80));
  console.log('Setup complete.');
  console.log('='.repeat(80));
}).catch(console.error);
