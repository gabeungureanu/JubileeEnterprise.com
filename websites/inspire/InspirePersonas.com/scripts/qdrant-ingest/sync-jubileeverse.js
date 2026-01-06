/**
 * Sync JubileeVerse Collections
 * Creates JubileeVerse_vS and copies all data from JubileeVerse_vP
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('./config');

const SOURCE_COLLECTION = 'JubileeVerse_vP';
const TARGET_COLLECTION = 'JubileeVerse_vS';

const client = new QdrantClient({
  host: config.qdrant.host,
  port: config.qdrant.port
});

async function syncCollections() {
  console.log('='.repeat(60));
  console.log('SYNCING JubileeVerse_vP -> JubileeVerse_vS');
  console.log('='.repeat(60));

  try {
    // Check if source collection exists
    console.log(`\nChecking source collection: ${SOURCE_COLLECTION}`);
    const collections = await client.getCollections();
    const sourceExists = collections.collections.some(c => c.name === SOURCE_COLLECTION);

    if (!sourceExists) {
      console.error(`[ERROR] Source collection '${SOURCE_COLLECTION}' does not exist.`);
      process.exit(1);
    }

    // Get source collection info
    const sourceInfo = await client.getCollection(SOURCE_COLLECTION);
    console.log(`  - Source points: ${sourceInfo.points_count}`);
    console.log(`  - Vector size: ${sourceInfo.config.params.vectors.size}`);
    console.log(`  - Distance: ${sourceInfo.config.params.vectors.distance}`);

    // Check if target collection exists
    const targetExists = collections.collections.some(c => c.name === TARGET_COLLECTION);

    if (targetExists) {
      console.log(`\nTarget collection '${TARGET_COLLECTION}' already exists.`);
      console.log('Deleting existing collection...');
      await client.deleteCollection(TARGET_COLLECTION);
      console.log('  - Deleted successfully');
    }

    // Create target collection with same config
    console.log(`\nCreating target collection: ${TARGET_COLLECTION}`);
    await client.createCollection(TARGET_COLLECTION, {
      vectors: {
        size: sourceInfo.config.params.vectors.size,
        distance: sourceInfo.config.params.vectors.distance
      },
      optimizers_config: {
        default_segment_number: 2
      },
      replication_factor: 1
    });
    console.log('  - Collection created');

    // Copy payload indexes
    console.log('\nCreating payload indexes...');
    const indexFields = [
      { field: 'content_type', type: 'keyword' },
      { field: 'source', type: 'keyword' },
      { field: 'created_at', type: 'keyword' },
      { field: 'category', type: 'keyword' },
      { field: 'subcategory', type: 'keyword' },
      { field: 'subsubcategory', type: 'keyword' },
      { field: 'level', type: 'keyword' },
      { field: 'path', type: 'keyword' },
      { field: 'step_number', type: 'integer' }
    ];

    for (const { field, type } of indexFields) {
      try {
        await client.createPayloadIndex(TARGET_COLLECTION, {
          field_name: field,
          field_schema: type
        });
        console.log(`  - Created index: ${field}`);
      } catch (err) {
        // Index may already exist
      }
    }

    // Copy all points in batches
    console.log('\nCopying points...');
    let offset = null;
    let totalCopied = 0;
    const batchSize = 100;

    while (true) {
      const result = await client.scroll(SOURCE_COLLECTION, {
        limit: batchSize,
        offset: offset,
        with_payload: true,
        with_vector: true
      });

      if (result.points.length === 0) {
        break;
      }

      // Prepare points for upsert
      const points = result.points.map(point => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload
      }));

      // Upsert to target collection
      await client.upsert(TARGET_COLLECTION, { points });
      totalCopied += points.length;

      process.stdout.write(`\r  - Copied ${totalCopied} points...`);

      // Check if there are more points
      if (result.next_page_offset === null) {
        break;
      }
      offset = result.next_page_offset;
    }

    console.log('');

    // Verify copy
    const targetInfo = await client.getCollection(TARGET_COLLECTION);

    console.log('\n' + '='.repeat(60));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`\nSource (${SOURCE_COLLECTION}): ${sourceInfo.points_count} points`);
    console.log(`Target (${TARGET_COLLECTION}): ${targetInfo.points_count} points`);

    if (sourceInfo.points_count === targetInfo.points_count) {
      console.log('\n[OK] All points copied successfully!');
    } else {
      console.log('\n[WARNING] Point counts do not match!');
    }

    // Show category summary for target
    console.log('\nTarget Collection Category Summary:');
    const categories = ['Personas', 'Abilities', 'Ministries', 'Guardrails', 'Models', 'JSV Bible', 'Objects'];

    for (const category of categories) {
      const result = await client.scroll(TARGET_COLLECTION, {
        filter: {
          must: [{ key: 'category', match: { value: category } }]
        },
        limit: 10000,
        with_payload: false
      });
      console.log(`  - ${category}: ${result.points.length} entries`);
    }

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nCannot connect to Qdrant. Make sure Docker is running.');
    }
    process.exit(1);
  }
}

// Run
syncCollections().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('JubileeVerse sync complete.');
  console.log('='.repeat(60));
}).catch(console.error);
