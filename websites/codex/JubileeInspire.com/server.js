/**
 * JubileeInspire.com Static Server
 *
 * A simple Node.js server for serving the JubileeInspire.com static website.
 * Supports clean URLs, SPA-style routing, and local chat API for development.
 *
 * Port: 3001 (or process.env.PORT for iisnode/production)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables from root .env file
const envPath = path.join(__dirname, '..', '..', '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        }
    });
}

const PORT = process.env.PORT || 3001;
const BASE_DIR = __dirname;

// MIME types for serving static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain',
    '.webp': 'image/webp'
};

// Route rewrites (from serve.json)
const REWRITES = {
    '/login': '/login.html',
    '/chat': '/chat.html',
    '/forgot-password': '/forgot-password.html'
};

// Prompts directory
const PROMPTS_DIR = path.join(BASE_DIR, 'prompts');

// Prompt file names
const SYSTEM_PROMPT = 'model_system.txt';
const DEVELOPER_PROMPT = 'model_developer.txt';
const USER_DECLARATIONS = 'model_userdeclarations.txt';
const DEFAULT_MODEL = 'gospelpulse';

/**
 * Read a prompt file safely
 */
function readPromptFile(filename) {
    const filePath = path.join(PROMPTS_DIR, filename);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
    }
    return '';
}

/**
 * Get all three prompt layers for a given model
 * Returns: { startup, model, emotional, combined }
 */
function getPromptLayers(model) {
    // Sanitize model name to prevent directory traversal
    const safeModel = (model || DEFAULT_MODEL).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

    // Layer 1: System prompt foundation (always included)
    const systemPrompt = readPromptFile(SYSTEM_PROMPT);

    // Layer 2: Model-specific prompt
    let modelPrompt = '';
    const modelFilename = `model_${safeModel}.txt`;
    modelPrompt = readPromptFile(modelFilename);

    // If model-specific prompt is empty, fall back to default model
    if (!modelPrompt && safeModel !== DEFAULT_MODEL) {
        modelPrompt = readPromptFile(`model_${DEFAULT_MODEL}.txt`);
    }

    // Layer 3: Developer prompt suffix (always included)
    const developerPrompt = readPromptFile(DEVELOPER_PROMPT);

    // User declarations (injected as user role message for identity awareness)
    const userDeclarations = readPromptFile(USER_DECLARATIONS);

    // Combined prompt in correct order: system -> model -> developer
    const combined = [systemPrompt, modelPrompt, developerPrompt]
        .filter(p => p.length > 0)
        .join('\n\n---\n\n');

    return {
        system: systemPrompt,
        model: modelPrompt,
        developer: developerPrompt,
        userDeclarations: userDeclarations,
        combined: combined,
        modelName: safeModel
    };
}

/**
 * Handle API request for system prompt
 * Returns all three layers separately for flexibility
 */
function handlePromptAPI(req, res, query) {
    const model = query.model || '';
    const layers = getPromptLayers(model);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: true,
        model: layers.modelName,
        layers: {
            system: layers.system,
            model: layers.model,
            developer: layers.developer,
            userDeclarations: layers.userDeclarations
        },
        combined: layers.combined,
        // Legacy field for backwards compatibility
        prompt: layers.combined
    }));
}

/**
 * Parse JSON body from request
 */
function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Handle Chat API - POST /Home/ChatWithJubilee
 * Local development endpoint that mirrors InspireCodex.com API
 */
async function handleChatAPI(req, res) {
    try {
        const body = await parseJsonBody(req);
        const {
            message,
            conversationHistory = [],
            personaName = 'Jubilee Inspire',
            conversationId = null,
            inspireModel = 'gospelpulse',
            systemPrompt = '',
            developerPrompt = ''
        } = body;

        if (!message || !message.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Message is required' }));
            return;
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-your-openai-key') {
            console.error('OPENAI_API_KEY not configured in .env file');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Chat service not configured. Please set OPENAI_API_KEY in .env file.'
            }));
            return;
        }

        // Build messages array for OpenAI
        const messages = [];

        // Add system prompt if provided
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Add developer prompt if provided
        if (developerPrompt) {
            messages.push({ role: 'system', content: developerPrompt });
        }

        // Add conversation history
        conversationHistory.forEach(msg => {
            if (msg.role && msg.content) {
                messages.push({ role: msg.role, content: msg.content });
            }
        });

        // Add current user message
        messages.push({ role: 'user', content: message.trim() });

        console.log(`Chat request: model=${inspireModel}, historyLength=${conversationHistory.length}, messageLength=${message.length}`);

        // Call OpenAI API
        const startTime = Date.now();
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 1024,
                temperature: 0.7
            })
        });

        const processingTime = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenAI API error:', response.status, errorData);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Failed to generate response',
                details: errorData.error?.message || 'Unknown error'
            }));
            return;
        }

        const data = await response.json();
        const assistantResponse = data.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

        // Generate conversation ID if not provided
        const finalConversationId = conversationId || `inspire-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        console.log(`Chat response: processingTime=${processingTime}ms, responseLength=${assistantResponse.length}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            response: assistantResponse,
            model: 'gpt-4o-mini',
            personaName,
            conversation: {
                id: finalConversationId,
                title: message.length > 50 ? message.substring(0, 47) + '...' : message,
                isNew: !conversationId,
                personaName,
                lastMessage: assistantResponse.substring(0, 100) + (assistantResponse.length > 100 ? '...' : ''),
                timestamp: new Date().toISOString()
            },
            usage: data.usage || null,
            processingTimeMs: processingTime
        }));

    } catch (error) {
        console.error('Chat error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Failed to process chat request',
            details: error.message
        }));
    }
}

/**
 * Auth API Proxy - forwards auth requests to InspireCodex.com
 * Solves CORS issues when running locally
 */
const AUTH_API_HOST = 'inspirecodex.com';

async function handleAuthProxy(req, res, pathname) {
    try {
        const body = req.method === 'POST' ? await parseJsonBody(req) : null;
        const targetUrl = `https://${AUTH_API_HOST}${pathname}`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Forward Authorization header if present
        if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }

        const fetchOptions = {
            method: req.method,
            headers: headers
        };

        if (body && req.method === 'POST') {
            fetchOptions.body = JSON.stringify(body);
        }

        console.log(`Auth proxy: ${req.method} ${targetUrl}`);

        const response = await fetch(targetUrl, fetchOptions);
        const contentType = response.headers.get('content-type') || '';

        // Check if the response is JSON
        if (!contentType.includes('application/json')) {
            console.error(`Auth proxy: API returned non-JSON response (${contentType})`);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Authentication service is temporarily unavailable. Please try again later.'
            }));
            return;
        }

        const data = await response.json();

        res.writeHead(response.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (error) {
        console.error('Auth proxy error:', error.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Failed to reach authentication server. Please check your connection and try again.'
        }));
    }
}

// Create the HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Auth API proxy (local development - avoids CORS issues)
    if (pathname.startsWith('/api/auth/')) {
        handleAuthProxy(req, res, pathname);
        return;
    }

    // Chat API endpoint (mirrors InspireCodex.com for local development)
    if (pathname === '/Home/ChatWithJubilee' && req.method === 'POST') {
        handleChatAPI(req, res);
        return;
    }

    // API endpoint for system prompts
    if (pathname === '/api/prompt' && req.method === 'GET') {
        handlePromptAPI(req, res, parsedUrl.query);
        return;
    }

    // Apply rewrites
    if (REWRITES[pathname]) {
        pathname = REWRITES[pathname];
    }

    // Remove trailing slash (except for root)
    if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
    }

    // Serve static files
    serveStaticFile(req, res, pathname);
});

/**
 * Serve static files with fallback to index.html for SPA routing
 */
function serveStaticFile(req, res, pathname) {
    // Default to index.html for root
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(BASE_DIR, safePath);

    // Make sure we're still within the base directory
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        // Try adding .html extension for clean URLs
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
            filePath = htmlPath;
        } else {
            // Return 404
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
    }

    // Check if it's a directory
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
        // Try to serve index.html from directory
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
            filePath = indexPath;
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
    }

    // Get file extension and MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve the file
    try {
        const content = fs.readFileSync(filePath);

        // Set cache headers for static assets
        if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.webp'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        } else if (['.css', '.js'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }

        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
    } catch (error) {
        console.error('Error serving file:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    }
}

// Start the server
server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  JubileeInspire.com Static Server');
    console.log('='.repeat(50));
    console.log(`  Status:  Running`);
    console.log(`  Port:    ${PORT}`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log(`  Dir:     ${BASE_DIR}`);
    console.log('='.repeat(50));
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
});