/**
 * Qdrant Container Creation Script
 *
 * Creates Qdrant containers (collections) for:
 * - InspireCodex: AI/ML embeddings for the Codex platform
 * - Flywheel: Knowledge graph and recommendation engine data
 *
 * Usage: node create-containers.js [--host HOST] [--port PORT]
 *
 * Requirements: npm install @qdrant/js-client-rest
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

// Configuration
const config = {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333'),
    apiKey: process.env.QDRANT_API_KEY || null
};

// Parse command line arguments
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--host' && process.argv[i + 1]) {
        config.host = process.argv[++i];
    } else if (process.argv[i] === '--port' && process.argv[i + 1]) {
        config.port = parseInt(process.argv[++i]);
    } else if (process.argv[i] === '--api-key' && process.argv[i + 1]) {
        config.apiKey = process.argv[++i];
    }
}

// Container definitions
const containers = [
    {
        name: 'InspireCodex',
        description: 'AI/ML embeddings for Bible verses, devotionals, and spiritual content',
        vectorSize: 1536, // OpenAI text-embedding-3-small dimension
        distance: 'Cosine'
    },
    {
        name: 'Flywheel',
        description: 'Knowledge graph embeddings for recommendations and content discovery',
        vectorSize: 1536,
        distance: 'Cosine'
    }
];

async function createContainers() {
    console.log('');
    console.log('='.repeat(60));
    console.log('  Qdrant Container Creation Script');
    console.log('='.repeat(60));
    console.log(`  Host: ${config.host}:${config.port}`);
    console.log('');

    // Initialize client
    const clientOptions = {
        url: `http://${config.host}:${config.port}`
    };

    if (config.apiKey) {
        clientOptions.apiKey = config.apiKey;
    }

    const client = new QdrantClient(clientOptions);

    // Test connection
    try {
        const collections = await client.getCollections();
        console.log(`  Connected! Found ${collections.collections.length} existing collection(s)`);
        console.log('');
    } catch (error) {
        console.error(`  ERROR: Could not connect to Qdrant at ${config.host}:${config.port}`);
        console.error(`  ${error.message}`);
        console.log('');
        console.log('  Make sure Qdrant is running:');
        console.log('    docker run -p 6333:6333 qdrant/qdrant');
        console.log('');
        process.exit(1);
    }

    // Create each container
    for (const container of containers) {
        console.log(`  Creating container: ${container.name}`);
        console.log(`    Description: ${container.description}`);
        console.log(`    Vector Size: ${container.vectorSize}`);
        console.log(`    Distance: ${container.distance}`);

        try {
            // Check if collection already exists
            const exists = await client.collectionExists(container.name);

            if (exists.exists) {
                console.log(`    Status: Already exists (skipped)`);
            } else {
                // Create the collection
                await client.createCollection(container.name, {
                    vectors: {
                        size: container.vectorSize,
                        distance: container.distance
                    },
                    // Optimized for small to medium datasets
                    optimizers_config: {
                        default_segment_number: 2,
                        indexing_threshold: 20000
                    },
                    // Enable on-disk storage for larger datasets
                    on_disk_payload: true
                });
                console.log(`    Status: Created successfully`);
            }
        } catch (error) {
            console.error(`    Status: FAILED - ${error.message}`);
        }
        console.log('');
    }

    // List all collections
    console.log('-'.repeat(60));
    console.log('  Current Collections:');
    try {
        const result = await client.getCollections();
        if (result.collections.length === 0) {
            console.log('    (none)');
        } else {
            for (const col of result.collections) {
                const info = await client.getCollection(col.name);
                console.log(`    - ${col.name}: ${info.points_count || 0} points, ${info.vectors_count || 0} vectors`);
            }
        }
    } catch (error) {
        console.error(`    Error listing collections: ${error.message}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('  Done!');
    console.log('='.repeat(60));
    console.log('');
}

createContainers().catch(console.error);
