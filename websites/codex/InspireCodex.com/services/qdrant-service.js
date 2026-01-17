/**
 * Qdrant RAG Service
 * Provides semantic search capabilities for the Inspire 8.0 Knowledge Base
 *
 * Uses Qdrant vector database with OpenAI embeddings for RAG (Retrieval Augmented Generation)
 * Supports 40 collections: 4 shared + 23 system + 13 persona
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');

// Inspire 8.0 Collection Definitions
const COLLECTIONS = {
    // Shared Collections (4)
    shared: [
        'scripture',
        'doctrine',
        'governance',
        'inspire-family'
    ],
    // System Collections (23)
    system: [
        'model_registry',
        'execution_contracts',
        'endgame',
        'experiments',
        'learning_memory',
        'evaluation',
        'execution_logs',
        'scenarios',
        'kingdom_builder',
        'creative_fire',
        'gospel_pulse',
        'shepherds_voice',
        'hebraic_roots',
        'prompts',
        'resources',
        'languages',
        'countries',
        'jubilee_ministry',
        'ministers',
        'users',
        'insights',
        'analytics',
        'persona_index'
    ],
    // Persona Collections (13) - Birth order preserved
    persona: [
        'persona_gabriel_inspire',
        'persona_jubilee_inspire',
        'persona_melody_inspire',
        'persona_zev_inspire',
        'persona_eliana_inspire',
        'persona_caleb_inspire',
        'persona_imani_inspire',
        'persona_amir_inspire',
        'persona_nova_inspire',
        'persona_tahoma_inspire',
        'persona_santiago_inspire',
        'persona_zariah_inspire',
        'persona_elias_inspire'
    ]
};

// Get all collection names as flat array
const ALL_COLLECTIONS = [
    ...COLLECTIONS.shared,
    ...COLLECTIONS.system,
    ...COLLECTIONS.persona
];

// Configuration from environment
const config = {
    qdrant: {
        host: process.env.QDRANT_HOST || 'localhost',
        port: parseInt(process.env.QDRANT_PORT || '6333'),
        defaultCollection: process.env.QDRANT_DEFAULT_COLLECTION || 'scripture',
        vectorSize: 1536
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY,
        embeddingModel: 'text-embedding-3-small'
    },
    search: {
        defaultLimit: 5,
        minScore: 0.45,
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

        // Verify connection and check available collections
        const collections = await qdrantClient.getCollections();
        const availableCollections = collections.collections.map(c => c.name);
        const foundCollections = ALL_COLLECTIONS.filter(c => availableCollections.includes(c));

        if (foundCollections.length === 0) {
            console.warn('[Qdrant Service] No Inspire 8.0 collections found - RAG disabled');
            initError = 'No collections found';
            return false;
        }

        console.log(`[Qdrant Service] Connected to Inspire 8.0 container (${foundCollections.length}/${ALL_COLLECTIONS.length} collections available)`);

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
 * Search a specific collection for relevant context
 * @param {string} query - User query
 * @param {string} collectionName - Collection to search
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results with context
 */
async function searchCollection(query, collectionName, options = {}) {
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

    // Validate collection name
    if (!ALL_COLLECTIONS.includes(collectionName)) {
        return {
            success: false,
            error: `Invalid collection: ${collectionName}`,
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
        const queryVector = await generateEmbedding(query);

        const searchRequest = {
            vector: queryVector,
            limit: limit,
            with_payload: true,
            with_vector: false,
            score_threshold: minScore
        };

        if (filters) {
            searchRequest.filter = filters;
        }

        const results = await qdrantClient.search(collectionName, searchRequest);

        if (!results || results.length === 0) {
            return {
                success: true,
                collection: collectionName,
                context: null,
                results: [],
                message: 'No relevant content found'
            };
        }

        const formattedResults = results.map(result => ({
            score: result.score,
            text: result.payload.text || result.payload.content,
            metadata: {
                source: result.payload.source_file || result.payload.source,
                category: result.payload.category,
                type: result.payload.type,
                persona: result.payload.persona
            }
        }));

        const context = buildContextString(formattedResults);

        return {
            success: true,
            collection: collectionName,
            context: context,
            results: formattedResults,
            resultCount: formattedResults.length
        };

    } catch (error) {
        console.error(`[Qdrant Service] Search error in ${collectionName}:`, error.message);
        return {
            success: false,
            error: error.message,
            context: null,
            results: []
        };
    }
}

/**
 * Search the knowledge base for relevant context (default collection)
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
        collection = config.qdrant.defaultCollection,
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

        // Execute search on specified collection
        const results = await qdrantClient.search(collection, searchRequest);

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
            defaultCollection: config.qdrant.defaultCollection,
            embeddingModel: config.openai.embeddingModel,
            totalCollections: ALL_COLLECTIONS.length
        }
    };
}

/**
 * Get available collections organized by category
 */
function getCollections() {
    return {
        shared: COLLECTIONS.shared,
        system: COLLECTIONS.system,
        persona: COLLECTIONS.persona,
        all: ALL_COLLECTIONS,
        counts: {
            shared: COLLECTIONS.shared.length,
            system: COLLECTIONS.system.length,
            persona: COLLECTIONS.persona.length,
            total: ALL_COLLECTIONS.length
        }
    };
}

/**
 * Check if a collection exists in the Inspire 8.0 container
 * @param {string} collectionName - Collection name to check
 * @returns {boolean} True if collection is valid
 */
function isValidCollection(collectionName) {
    return ALL_COLLECTIONS.includes(collectionName);
}

/**
 * Get collection category (shared, system, or persona)
 * @param {string} collectionName - Collection name
 * @returns {string|null} Category name or null if not found
 */
function getCollectionCategory(collectionName) {
    if (COLLECTIONS.shared.includes(collectionName)) return 'shared';
    if (COLLECTIONS.system.includes(collectionName)) return 'system';
    if (COLLECTIONS.persona.includes(collectionName)) return 'persona';
    return null;
}

module.exports = {
    initialize,
    searchKnowledge,
    searchCollection,
    getStatus,
    getCollections,
    isValidCollection,
    getCollectionCategory,
    generateEmbedding,
    COLLECTIONS,
    ALL_COLLECTIONS
};
