/**
 * Setup JubileeVerse_vP Collection
 * Creates an empty Qdrant collection for JubileeVerse data
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('./config');

const COLLECTION_NAME = 'JubileeVerse_vP';

async function setupJubileeVerseCollection() {
  console.log('='.repeat(60));
  console.log('QDRANT COLLECTION SETUP - JubileeVerse_vP');
  console.log('='.repeat(60));

  const client = new QdrantClient({
    host: config.qdrant.host,
    port: config.qdrant.port
  });

  try {
    // Check if collection exists
    console.log(`\nChecking for existing collection: ${COLLECTION_NAME}`);
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (exists) {
      console.log(`Collection '${COLLECTION_NAME}' already exists.`);
      const info = await client.getCollection(COLLECTION_NAME);
      console.log(`  - Points count: ${info.points_count}`);
      console.log(`  - Vector size: ${info.config.params.vectors.size}`);
      console.log(`  - Distance: ${info.config.params.vectors.distance}`);
      console.log('\nCollection already set up. No changes made.');
    } else {
      // Create the collection
      console.log(`\nCreating collection: ${COLLECTION_NAME}`);
      console.log(`  - Vector size: ${config.qdrant.vectorSize}`);
      console.log(`  - Distance metric: ${config.qdrant.distance}`);

      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: config.qdrant.vectorSize,
          distance: config.qdrant.distance
        },
        optimizers_config: {
          default_segment_number: 2
        },
        replication_factor: 1
      });

      // Create basic payload indexes
      console.log('\nCreating payload indexes...');
      const indexFields = [
        { field: 'content_type', type: 'keyword' },
        { field: 'source', type: 'keyword' },
        { field: 'created_at', type: 'keyword' }
      ];

      for (const { field, type } of indexFields) {
        try {
          await client.createPayloadIndex(COLLECTION_NAME, {
            field_name: field,
            field_schema: type
          });
          console.log(`  - Created index: ${field} (${type})`);
        } catch (err) {
          console.log(`  - Index ${field} may already exist`);
        }
      }

      // Verify collection
      const info = await client.getCollection(COLLECTION_NAME);
      console.log('\n[OK] Collection created successfully!');
      console.log(`  - Name: ${COLLECTION_NAME}`);
      console.log(`  - Status: ${info.status}`);
      console.log(`  - Points count: ${info.points_count}`);
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

// Run setup
setupJubileeVerseCollection().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('JubileeVerse_vP collection setup complete (empty).');
  console.log('='.repeat(60));
}).catch(console.error);
