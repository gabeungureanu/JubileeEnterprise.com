/**
 * Qdrant Delete Container Script
 *
 * Deletes a specific Qdrant collection. Use with caution!
 *
 * Usage: node delete-container.js <collection-name> [--host HOST] [--port PORT] [--force]
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const readline = require('readline');

// Configuration
const config = {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333'),
    apiKey: process.env.QDRANT_API_KEY || null,
    force: false,
    collectionName: null
};

// Parse command line arguments
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--host' && process.argv[i + 1]) {
        config.host = process.argv[++i];
    } else if (arg === '--port' && process.argv[i + 1]) {
        config.port = parseInt(process.argv[++i]);
    } else if (arg === '--api-key' && process.argv[i + 1]) {
        config.apiKey = process.argv[++i];
    } else if (arg === '--force' || arg === '-f') {
        config.force = true;
    } else if (!arg.startsWith('-') && !config.collectionName) {
        config.collectionName = arg;
    }
}

async function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function deleteContainer() {
    if (!config.collectionName) {
        console.log('');
        console.log('Usage: node delete-container.js <collection-name> [options]');
        console.log('');
        console.log('Options:');
        console.log('  --host HOST     Qdrant host (default: localhost)');
        console.log('  --port PORT     Qdrant port (default: 6333)');
        console.log('  --api-key KEY   Qdrant API key');
        console.log('  --force, -f     Skip confirmation prompt');
        console.log('');
        process.exit(1);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('  Qdrant Delete Container');
    console.log('='.repeat(60));
    console.log(`  Host:       ${config.host}:${config.port}`);
    console.log(`  Collection: ${config.collectionName}`);
    console.log('');

    // Initialize client
    const clientOptions = {
        url: `http://${config.host}:${config.port}`
    };

    if (config.apiKey) {
        clientOptions.apiKey = config.apiKey;
    }

    const client = new QdrantClient(clientOptions);

    // Check if collection exists
    try {
        const exists = await client.collectionExists(config.collectionName);

        if (!exists.exists) {
            console.log(`  Collection "${config.collectionName}" does not exist.`);
            console.log('');
            process.exit(0);
        }

        // Get collection info
        const info = await client.getCollection(config.collectionName);
        console.log(`  Points in collection: ${info.points_count || 0}`);
        console.log(`  Vectors:              ${info.vectors_count || 0}`);
        console.log('');

        // Confirm deletion
        if (!config.force) {
            console.log('  WARNING: This action cannot be undone!');
            const confirmed = await askConfirmation('  Delete this collection? (y/N): ');

            if (!confirmed) {
                console.log('');
                console.log('  Aborted.');
                console.log('');
                process.exit(0);
            }
        }

        // Delete the collection
        console.log('');
        console.log(`  Deleting collection "${config.collectionName}"...`);
        await client.deleteCollection(config.collectionName);
        console.log('  Done!');
        console.log('');

    } catch (error) {
        console.error(`  ERROR: ${error.message}`);
        console.log('');
        process.exit(1);
    }
}

deleteContainer().catch(console.error);
