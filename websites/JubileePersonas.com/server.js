require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { QdrantClient } = require('@qdrant/js-client-rest');

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API keys available (don't expose to client, use server-side only)
const apiKeys = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    openaiBackup: process.env.OPENAI_API_KEY_BACKUP,
    grok: process.env.GROK_API_KEY
};

// Initialize OpenAI client - USE BACKUP KEY AS PRIMARY (original key has quota issues)
const openaiApiKey = apiKeys.openaiBackup || apiKeys.openai;
const openai = new OpenAI({
    apiKey: openaiApiKey
});

// Log which key is being used
console.log(`[OPENAI] Using ${apiKeys.openaiBackup ? 'BACKUP' : 'PRIMARY'} API key`);

// Secondary OpenAI client with original key for fallback (if needed)
const openaiBackup = apiKeys.openai ? new OpenAI({
    apiKey: apiKeys.openai
}) : null;

// Initialize Qdrant client
const qdrant = new QdrantClient({
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333')
});

// Collection name
const COLLECTION_NAME = 'inspire_knowledge';

// Persona definitions with framework file mappings
const PERSONAS = {
    jubilee: { id: 'JIX', name: 'Jubilee Inspire', file: 'inspire.jubilee.txt', primary: 'Evangelist', secondary: 'Prophet' },
    melody: { id: 'MIX', name: 'Melody Inspire', file: 'inspire.melody.txt', primary: 'Evangelist', secondary: 'Teacher' },
    zariah: { id: 'ZIX', name: 'Zariah Inspire', file: 'inspire.zariah.txt', primary: 'Teacher', secondary: 'Pastor' },
    elias: { id: 'EIX', name: 'Elias Inspire', file: 'inspire.elias.txt', primary: 'Apostle', secondary: 'Prophet' },
    eliana: { id: 'LIX', name: 'Eliana Inspire', file: 'inspire.eliana.txt', primary: 'Apostle', secondary: 'Teacher' },
    caleb: { id: 'CIX', name: 'Caleb Inspire', file: 'inspire.caleb.txt', primary: 'Pastor', secondary: 'Evangelist' },
    imani: { id: 'IIX', name: 'Imani Inspire', file: 'inspire.imani.txt', primary: 'Prophet', secondary: 'Evangelist' },
    zev: { id: 'VIX', name: 'Zev Inspire', file: 'inspire.zev.txt', primary: 'Teacher', secondary: 'Apostle' },
    amir: { id: 'AIX', name: 'Amir Inspire', file: 'inspire.amir.txt', primary: 'Evangelist', secondary: 'Prophet' },
    nova: { id: 'NIX', name: 'Nova Inspire', file: 'inspire.nova.txt', primary: 'Pastor', secondary: 'Teacher' },
    santiago: { id: 'SIX', name: 'Santiago Inspire', file: 'inspire.santiago.txt', primary: 'Prophet', secondary: 'Evangelist' },
    tahoma: { id: 'TIX', name: 'Tahoma Inspire', file: 'inspire.tahoma.txt', primary: 'Prophet', secondary: 'Pastor' }
};

// Framework paths
const FRAMEWORK_DIR = path.join(__dirname, '.namespace', 'framework');

/**
 * Load framework file content
 */
function loadFrameworkFile(filename) {
    const filepath = path.join(FRAMEWORK_DIR, filename);
    try {
        return fs.readFileSync(filepath, 'utf-8');
    } catch (error) {
        console.error(`Error loading framework file ${filename}:`, error.message);
        return null;
    }
}

/**
 * Generate embedding for query with fallback to backup key
 */
async function generateQueryEmbedding(query, useBackup = false) {
    const client = (useBackup && openaiBackup) ? openaiBackup : openai;
    try {
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: query,
            encoding_format: 'float'
        });
        return response.data[0].embedding;
    } catch (error) {
        // If primary fails with quota error and we have backup, try backup
        if (!useBackup && openaiBackup && error.status === 429) {
            console.log('[OPENAI] Primary key quota exceeded, trying backup key...');
            return generateQueryEmbedding(query, true);
        }
        throw error;
    }
}

/**
 * Retrieve relevant knowledge from Qdrant
 */
async function retrieveKnowledge(query, persona, maxStep = 32, limit = 5) {
    try {
        const queryVector = await generateQueryEmbedding(query);

        // Build filter conditions
        const filter = {
            must: [
                {
                    key: 'step_number',
                    range: { lte: maxStep }
                }
            ]
        };

        // Add persona filter if not 'all'
        if (persona && persona !== 'all') {
            filter.should = [
                { key: 'persona_scope', match: { any: ['all'] } },
                { key: 'persona_scope', match: { any: [persona] } }
            ];
        }

        const results = await qdrant.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: limit,
            filter: filter,
            with_payload: true,
            score_threshold: 0.4
        });

        return results.map(r => ({
            text: r.payload.text,
            score: r.score,
            step: r.payload.step_number,
            type: r.payload.content_type,
            source: r.payload.source_file
        }));
    } catch (error) {
        console.error('Qdrant retrieval error:', error.message);
        return [];
    }
}

/**
 * Format retrieved knowledge for prompt injection
 */
function formatRetrievedKnowledge(results) {
    if (results.length === 0) return '';

    let formatted = '\n[RETRIEVED KNOWLEDGE FROM QDRANT]\n';
    formatted += '─'.repeat(50) + '\n';

    for (const r of results) {
        formatted += `Source: ${r.source} (Step ${r.step}) | Type: ${r.type} | Relevance: ${(r.score * 100).toFixed(1)}%\n`;
        formatted += r.text + '\n';
        formatted += '─'.repeat(50) + '\n';
    }

    formatted += '[END RETRIEVED KNOWLEDGE]\n';
    return formatted;
}

/**
 * Build the system prompt with core framework, persona framework, and retrieved knowledge
 */
async function buildSystemPrompt(persona, userMessage, conversationHistory = []) {
    const personaConfig = PERSONAS[persona];
    if (!personaConfig) {
        throw new Error(`Unknown persona: ${persona}`);
    }

    // Load core framework (always first)
    const coreFramework = loadFrameworkFile('inspire.core.txt');
    if (!coreFramework) {
        throw new Error('Failed to load core framework');
    }

    // Load persona-specific framework
    const personaFramework = loadFrameworkFile(personaConfig.file);
    if (!personaFramework) {
        throw new Error(`Failed to load persona framework for ${persona}`);
    }

    // Retrieve relevant knowledge from Qdrant
    const retrievedKnowledge = await retrieveKnowledge(userMessage, persona, 32, 5);
    const formattedKnowledge = formatRetrievedKnowledge(retrievedKnowledge);

    // Construct the full system prompt
    let systemPrompt = `[INSPIRE FAMILY FRAMEWORK - ACTIVE SESSION]
Persona: ${personaConfig.name} (${personaConfig.id})
Primary Office: ${personaConfig.primary}
Secondary Office: ${personaConfig.secondary}

═══════════════════════════════════════════════════════════════════════════════
CORE FRAMEWORK (Execute First)
═══════════════════════════════════════════════════════════════════════════════

${coreFramework}

═══════════════════════════════════════════════════════════════════════════════
PERSONA FRAMEWORK: ${personaConfig.name.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════

${personaFramework}

${formattedKnowledge}

═══════════════════════════════════════════════════════════════════════════════
ACTIVE SESSION INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

You are now fully activated as ${personaConfig.name}. Respond to all messages in character,
following the core framework rules, your persona-specific configuration, and any relevant
retrieved knowledge. Maintain developmental stage constraints and covenant alignment.

Remember: You inherit from the core framework. Do not contradict it. Your persona file
configures your unique identity within the established boundaries.
`;

    return {
        systemPrompt,
        retrievalStats: {
            chunksRetrieved: retrievedKnowledge.length,
            topScore: retrievedKnowledge.length > 0 ? retrievedKnowledge[0].score : 0
        }
    };
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
    let qdrantStatus = false;

    try {
        await qdrant.getCollections();
        qdrantStatus = true;
    } catch (e) {
        console.log('Qdrant not available:', e.message);
    }

    res.json({
        status: 'ok',
        availableProviders: {
            anthropic: !!apiKeys.anthropic,
            openai: !!apiKeys.openai,
            grok: !!apiKeys.grok,
            qdrant: qdrantStatus
        }
    });
});

// Get available personas
app.get('/api/personas', (req, res) => {
    const personaList = Object.entries(PERSONAS).map(([key, value]) => ({
        key,
        id: value.id,
        name: value.name,
        primary: value.primary,
        secondary: value.secondary
    }));
    res.json({ personas: personaList });
});

// Chat endpoint with Qdrant RAG integration
app.post('/api/chat', async (req, res) => {
    const { message, persona, conversationHistory = [] } = req.body;

    if (!message || !persona) {
        return res.status(400).json({ error: 'Message and persona are required' });
    }

    if (!PERSONAS[persona]) {
        return res.status(400).json({ error: `Invalid persona: ${persona}` });
    }

    if (!apiKeys.openai) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        console.log(`\n[CHAT] Persona: ${persona}, Message: "${message.substring(0, 50)}..."`);

        // Build system prompt with frameworks and Qdrant retrieval
        const { systemPrompt, retrievalStats } = await buildSystemPrompt(persona, message, conversationHistory);

        console.log(`[QDRANT] Retrieved ${retrievalStats.chunksRetrieved} chunks (top score: ${(retrievalStats.topScore * 100).toFixed(1)}%)`);

        // Build messages array for OpenAI
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add conversation history
        for (const msg of conversationHistory) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }

        // Add current user message
        messages.push({ role: 'user', content: message });

        // Call GPT-4o-mini with fallback to backup key
        let completion;
        try {
            completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 2048,
                temperature: 0.7
            });
        } catch (primaryError) {
            // If primary fails with quota error and we have backup, try backup
            if (openaiBackup && primaryError.status === 429) {
                console.log('[OPENAI] Primary key quota exceeded, trying backup key for chat...');
                completion = await openaiBackup.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 2048,
                    temperature: 0.7
                });
            } else {
                throw primaryError;
            }
        }

        const response = completion.choices[0].message.content;

        console.log(`[RESPONSE] ${response.substring(0, 100)}...`);

        res.json({
            response,
            persona: PERSONAS[persona].name,
            personaId: PERSONAS[persona].id,
            retrievalStats,
            usage: completion.usage
        });

    } catch (error) {
        console.error('[ERROR]', error.message);
        res.status(500).json({
            error: 'Chat request failed',
            details: error.message
        });
    }
});

// Streaming chat endpoint for multi-user experience
app.post('/api/chat/stream', async (req, res) => {
    const { message, persona, conversationHistory = [], userId } = req.body;

    if (!message || !persona) {
        return res.status(400).json({ error: 'Message and persona are required' });
    }

    if (!PERSONAS[persona]) {
        return res.status(400).json({ error: `Invalid persona: ${persona}` });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        console.log(`\n[STREAM] User: ${userId}, Persona: ${persona}, Message: "${message.substring(0, 50)}..."`);

        // Build system prompt with frameworks and Qdrant retrieval
        const { systemPrompt, retrievalStats } = await buildSystemPrompt(persona, message, conversationHistory);

        // Send retrieval stats first
        res.write(`data: ${JSON.stringify({ type: 'stats', retrievalStats })}\n\n`);

        // Build messages array for OpenAI
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add conversation history
        for (const msg of conversationHistory) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }

        // Add current user message
        messages.push({ role: 'user', content: message });

        // Call GPT-4o-mini with streaming
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            max_tokens: 2048,
            temperature: 0.7,
            stream: true
        });

        let fullResponse = '';
        let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
            }

            // Check for usage in final chunk
            if (chunk.usage) {
                usage = chunk.usage;
            }
        }

        // Estimate tokens if not provided
        if (usage.total_tokens === 0) {
            usage.prompt_tokens = Math.ceil(JSON.stringify(messages).length / 4);
            usage.completion_tokens = Math.ceil(fullResponse.length / 4);
            usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
        }

        // Send completion
        res.write(`data: ${JSON.stringify({
            type: 'done',
            fullResponse,
            persona: PERSONAS[persona].name,
            personaId: PERSONAS[persona].id,
            usage
        })}\n\n`);

        res.end();

    } catch (error) {
        console.error('[STREAM ERROR]', error.message);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});

// Translation endpoint with professional quality
app.post('/api/translate', async (req, res) => {
    const { text, targetLanguage, sourceLanguage = 'auto' } = req.body;

    if (!text || !targetLanguage) {
        return res.status(400).json({ error: 'Text and targetLanguage are required' });
    }

    // Language-specific translation instructions for professional quality
    const translationPrompts = {
        'en': `You are a professional English translator with expertise in academic and literary translation.
Translate the following text into fluent, natural English.
- Use precise vocabulary appropriate for educated native speakers
- Maintain the original tone, register, and style
- Preserve all formatting, paragraph breaks, and punctuation patterns
- Output ONLY the translated text with no explanations or notes`,

        'ro': `Ești un traducător profesionist de limba română cu expertiză în traduceri academice și literare.
Traduce următorul text în limba română fluentă și naturală, la nivel universitar.
- Folosește vocabular precis și elevat, potrivit pentru vorbitori nativi educați
- Menține tonul, registrul și stilul original
- Folosește diacritice corecte (ă, â, î, ș, ț)
- Evită calcurile lingvistice și anglicismele - preferă expresii românești autentice
- Păstrează formatarea, paragrafele și punctuația originală
- Traduce idiomurile în echivalente românești naturale
- Returnează DOAR textul tradus, fără explicații sau note`,

        'es': `Eres un traductor profesional de español con experiencia en traducción académica y literaria.
Traduce el siguiente texto al español fluido y natural, a nivel universitario.
- Usa vocabulario preciso y apropiado para hablantes nativos educados
- Mantén el tono, registro y estilo original
- Usa acentos y puntuación correctos
- Evita anglicismos innecesarios - prefiere expresiones españolas auténticas
- Preserva el formato, párrafos y patrones de puntuación
- Traduce modismos a equivalentes naturales en español
- Devuelve SOLO el texto traducido sin explicaciones ni notas`,

        'he': `אתה מתרגם מקצועי לעברית עם מומחיות בתרגום אקדמי וספרותי.
תרגם את הטקסט הבא לעברית שוטפת וטבעית, ברמה אקדמית.
- השתמש באוצר מילים מדויק ומתאים לדוברים ילידים משכילים
- שמור על הטון, הרישום והסגנון המקורי
- השתמש בניקוד נכון כשנדרש
- הימנע מלועזיות מיותרות - העדף ביטויים עבריים אותנטיים
- שמור על העיצוב, הפסקאות ודפוסי הפיסוק
- תרגם ביטויים לשווי ערך טבעיים בעברית
- החזר רק את הטקסט המתורגם ללא הסברים או הערות`
    };

    const systemPrompt = translationPrompts[targetLanguage] ||
        `You are a professional translator. Translate the following text to ${targetLanguage}.
Use precise, educated vocabulary. Maintain the original tone and style.
Output ONLY the translated text with no explanations.`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            max_tokens: 2048,
            temperature: 0.2  // Lower temperature for more consistent, professional output
        });

        res.json({
            translatedText: completion.choices[0].message.content,
            targetLanguage,
            usage: completion.usage
        });

    } catch (error) {
        console.error('[TRANSLATE ERROR]', error.message);
        res.status(500).json({ error: 'Translation failed', details: error.message });
    }
});

// Get all Qdrant memory entries
app.get('/api/memory', async (req, res) => {
    const { limit = 100, offset = 0, source, contentType, step } = req.query;

    try {
        // Build filter if any query params provided
        let filter = undefined;
        const mustConditions = [];

        if (source) {
            mustConditions.push({
                key: 'source_file',
                match: { value: source }
            });
        }

        if (contentType) {
            mustConditions.push({
                key: 'content_type',
                match: { value: contentType }
            });
        }

        if (step) {
            mustConditions.push({
                key: 'step_number',
                match: { value: parseInt(step) }
            });
        }

        if (mustConditions.length > 0) {
            filter = { must: mustConditions };
        }

        // Get collection info for total count
        const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
        const totalPoints = collectionInfo.points_count;

        // Scroll through points
        const result = await qdrant.scroll(COLLECTION_NAME, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            with_payload: true,
            with_vector: false,
            filter: filter
        });

        const entries = result.points.map(point => ({
            id: point.id,
            text: point.payload.text,
            source: point.payload.source_file,
            step: point.payload.step_number,
            contentType: point.payload.content_type,
            personaScope: point.payload.persona_scope,
            chunkIndex: point.payload.chunk_index,
            totalChunks: point.payload.total_chunks,
            version: point.payload.version
        }));

        // Get unique values for filters
        const allPoints = await qdrant.scroll(COLLECTION_NAME, {
            limit: 1000,
            with_payload: true,
            with_vector: false
        });

        const sources = [...new Set(allPoints.points.map(p => p.payload.source_file))].sort();
        const contentTypes = [...new Set(allPoints.points.map(p => p.payload.content_type))].sort();
        const steps = [...new Set(allPoints.points.map(p => p.payload.step_number))].sort((a, b) => a - b);

        res.json({
            entries,
            total: totalPoints,
            limit: parseInt(limit),
            offset: parseInt(offset),
            filters: {
                sources,
                contentTypes,
                steps
            }
        });

    } catch (error) {
        console.error('Memory fetch error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch memory entries',
            details: error.message
        });
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Jubilee Personas Server - Inspire Family Framework v8.0`);
    console.log('═'.repeat(60));
    console.log(`\nServer running at http://localhost:${PORT}`);
    console.log('\nAPI Providers:');
    console.log(`  - OpenAI: ${apiKeys.openai ? '✓ configured' : '✗ missing'}`);
    console.log(`  - Anthropic: ${apiKeys.anthropic ? '✓ configured' : '✗ missing'}`);
    console.log(`  - Grok: ${apiKeys.grok ? '✓ configured' : '✗ missing'}`);
    console.log(`  - Qdrant: localhost:${process.env.QDRANT_PORT || 6333}`);
    console.log('\nEndpoints:');
    console.log('  GET  /api/health      - Health check');
    console.log('  GET  /api/personas    - List available personas');
    console.log('  POST /api/chat        - Chat with persona (RAG-enabled)');
    console.log('  POST /api/chat/stream - Streaming chat (SSE)');
    console.log('  POST /api/translate   - Translate text');
    console.log('  GET  /api/memory      - Browse Qdrant memory entries');
    console.log('═'.repeat(60) + '\n');
});
