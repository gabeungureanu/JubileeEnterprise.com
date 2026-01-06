/**
 * Qdrant Status Script
 *
 * Shows the status of all Qdrant collections and cluster info.
 *
 * Usage: node status.js [--host HOST] [--port PORT]
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

async function showStatus() {
    console.log('');
    console.log('='.repeat(60));
    console.log('  Qdrant Status');
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

    // Test connection and get cluster info
    try {
        // Get collections
        const collectionsResult = await client.getCollections();
        const collections = collectionsResult.collections;

        console.log(`  Collections: ${collections.length}`);
        console.log('-'.repeat(60));

        if (collections.length === 0) {
            console.log('  (no collections found)');
        } else {
            for (const col of collections) {
                console.log('');
                console.log(`  Collection: ${col.name}`);

                try {
                    const info = await client.getCollection(col.name);
                    console.log(`    Status:        ${info.status}`);
                    console.log(`    Points:        ${info.points_count || 0}`);
                    console.log(`    Vectors:       ${info.vectors_count || 0}`);

                    if (info.config?.params?.vectors) {
                        const vecConfig = info.config.params.vectors;
                        if (vecConfig.size) {
                            console.log(`    Vector Size:   ${vecConfig.size}`);
                            console.log(`    Distance:      ${vecConfig.distance}`);
                        } else {
                            // Named vectors
                            console.log(`    Vector Config: ${JSON.stringify(vecConfig)}`);
                        }
                    }

                    // Segment info
                    if (info.segments_count !== undefined) {
                        console.log(`    Segments:      ${info.segments_count}`);
                    }

                    // Indexed vectors percentage
                    if (info.indexed_vectors_count !== undefined && info.vectors_count > 0) {
                        const pct = ((info.indexed_vectors_count / info.vectors_count) * 100).toFixed(1);
                        console.log(`    Indexed:       ${info.indexed_vectors_count} (${pct}%)`);
                    }
                } catch (error) {
                    console.log(`    Error: ${error.message}`);
                }
            }
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('  Qdrant is running');
        console.log('='.repeat(60));
        console.log('');

    } catch (error) {
        console.error(`  ERROR: Could not connect to Qdrant`);
        console.error(`  ${error.message}`);
        console.log('');
        process.exit(1);
    }
}

showStatus().catch(console.error);
