/**
 * Qdrant RAG Service
 * Provides semantic search capabilities for the Inspire Knowledge Base
 *
 * Uses Qdrant vector database with OpenAI embeddings for RAG (Retrieval Augmented Generation)
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');

// Configuration from environment
const config = {
    qdrant: {
        host: process.env.QDRANT_HOST || 'localhost',
        port: parseInt(process.env.QDRANT_PORT || '6333'),
        collectionName: process.env.QDRANT_COLLECTION || 'inspire_knowledge',
        vectorSize: 1536
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY,
        embeddingModel: 'text-embedding-3-small'
    },
    search: {
        defaultLimit: 5,
        minScore: 0.45,  // Lowered to capture more semantic matches
        maxContextLength: 4000
    }
};

// Initialize clients
let qdrantClient = null;
let openaiClient = null;
let isInitialized = false;
let initError = null;

/**
 * Initialize the Qdrant and OpenAI clients
 */
async function initialize() {
    if (isInitialized) return true;
    if (initError) return false;

    try {
        // Initialize OpenAI client
        if (!config.openai.apiKey) {
            console.warn('[Qdrant Service] No OpenAI API key configured - RAG disabled');
            initError = 'No OpenAI API key';
            return false;
        }

        openaiClient = new OpenAI({
            apiKey: config.openai.apiKey
        });

        // Initialize Qdrant client
        qdrantClient = new QdrantClient({
            host: config.qdrant.host,
            port: config.qdrant.port
        });

        // Verify connection
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections.some(c => c.name === config.qdrant.collectionName);

        if (!exists) {
            console.warn(`[Qdrant Service] Collection '${config.qdrant.collectionName}' not found - RAG disabled`);
            initError = 'Collection not found';
            return false;
        }

        const info = await qdrantClient.getCollection(config.qdrant.collectionName);
        console.log(`[Qdrant Service] Connected to collection '${config.qdrant.collectionName}' (${info.points_count} points)`);

        isInitialized = true;
        return true;

    } catch (error) {
        console.error('[Qdrant Service] Initialization failed:', error.message);
        initError = error.message;
        return false;
    }
}

/**
 * Generate embedding for a query
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text) {
    const response = await openaiClient.embeddings.create({
        model: config.openai.embeddingModel,
        input: text,
        encoding_format: 'float'
    });
    return response.data[0].embedding;
}

/**
 * Search the knowledge base for relevant context
 * @param {string} query - User query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results with context
 */
async function searchKnowledge(query, options = {}) {
    // Ensure initialized
    const ready = await initialize();
    if (!ready) {
        return {
            success: false,
            error: initError || 'Service not initialized',
            context: null,
            results: []
        };
    }

    const {
        limit = config.search.defaultLimit,
        minScore = config.search.minScore,
        filters = null
    } = options;

    try {
        // Generate embedding for the query
        const queryVector = await generateEmbedding(query);

        // Build search request
        const searchRequest = {
            vector: queryVector,
            limit: limit,
            with_payload: true,
            with_vector: false,
            score_threshold: minScore
        };

        // Add filters if provided
        if (filters) {
            searchRequest.filter = filters;
        }

        // Execute search
        const results = await qdrantClient.search(config.qdrant.collectionName, searchRequest);

        if (!results || results.length === 0) {
            return {
                success: true,
                context: null,
                results: [],
                message: 'No relevant knowledge found'
            };
        }

        // Extract and format results
        const formattedResults = results.map(result => ({
            score: result.score,
            text: result.payload.text || result.payload.content,
            metadata: {
                source: result.payload.source_file || result.payload.source,
                category: result.payload.category,
                step_number: result.payload.step_number,
                content_type: result.payload.content_type,
                persona_scope: result.payload.persona_scope
            }
        }));

        // Build context string for injection into chat
        const context = buildContextString(formattedResults);

        return {
            success: true,
            context: context,
            results: formattedResults,
            resultCount: formattedResults.length
        };

    } catch (error) {
        console.error('[Qdrant Service] Search error:', error.message);
        return {
            success: false,
            error: error.message,
            context: null,
            results: []
        };
    }
}

/**
 * Build a context string from search results for injection into chat
 * @param {Array} results - Search results
 * @returns {string} Formatted context string
 */
function buildContextString(results) {
    if (!results || results.length === 0) return null;

    let context = '\n--- RELEVANT KNOWLEDGE BASE CONTEXT ---\n';
    let totalLength = 0;

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const text = result.text || '';

        // Check if adding this would exceed max context length
        if (totalLength + text.length > config.search.maxContextLength) {
            break;
        }

        // Add source info if available
        const source = result.metadata?.source || 'Knowledge Base';
        const category = result.metadata?.category || '';
        const score = (result.score * 100).toFixed(1);

        context += `\n[Source: ${source}${category ? ' - ' + category : ''} | Relevance: ${score}%]\n`;
        context += text.trim();
        context += '\n';

        totalLength += text.length;
    }

    context += '\n--- END KNOWLEDGE BASE CONTEXT ---\n';
    context += '\nUse the above context to inform your response when relevant, but maintain your conversational style.\n';

    return context;
}

/**
 * Get service status
 */
function getStatus() {
    return {
        initialized: isInitialized,
        error: initError,
        config: {
            qdrantHost: config.qdrant.host,
            qdrantPort: config.qdrant.port,
            collection: config.qdrant.collectionName,
            embeddingModel: config.openai.embeddingModel
        }
    };
}

module.exports = {
    initialize,
    searchKnowledge,
    getStatus,
    generateEmbedding
};
