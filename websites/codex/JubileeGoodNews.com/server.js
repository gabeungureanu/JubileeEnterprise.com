/**
 * JubileeGoodNews.com Server
 *
 * Uplifting Christian news and content portal using InspireCodex API.
 * Port: 3107
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3107;
const NODE_ENV = process.env.NODE_ENV || 'development';

// InspireCodex API configuration
const INSPIRE_API_BASE = process.env.INSPIRE_API_BASE || 'https://inspirecodex.com/api/v1';

// Trust proxy for proper client IP detection
app.set('trust proxy', 1);

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV !== 'test') {
    app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'JubileeGoodNews',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV
    });
});

// =============================================================================
// API PROXY ROUTES
// =============================================================================

// Helper function to proxy requests to InspireCodex API
async function proxyToInspire(endpoint) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${INSPIRE_API_BASE}${endpoint}`);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'JubileeGoodNews/1.0'
            },
            timeout: 10000
        };

        const protocol = url.protocol === 'https:' ? require('https') : http;

        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Get content from Inspire database
app.get('/api/content', async (req, res) => {
    try {
        const { category_id, content_type, limit = 20, offset = 0 } = req.query;
        let endpoint = `/inspire/content?limit=${limit}&offset=${offset}`;

        if (category_id) endpoint += `&category_id=${category_id}`;
        if (content_type) endpoint += `&content_type=${content_type}`;

        const data = await proxyToInspire(endpoint);
        res.json(data);
    } catch (err) {
        console.error('Error fetching content:', err.message);
        res.status(500).json({ error: 'Failed to fetch content', message: err.message });
    }
});

// Get single content item
app.get('/api/content/:id', async (req, res) => {
    try {
        const data = await proxyToInspire(`/inspire/content/${req.params.id}`);
        res.json(data);
    } catch (err) {
        console.error('Error fetching content:', err.message);
        res.status(500).json({ error: 'Failed to fetch content', message: err.message });
    }
});

// Get categories
app.get('/api/categories', async (req, res) => {
    try {
        const data = await proxyToInspire('/inspire/categories');
        res.json(data);
    } catch (err) {
        console.error('Error fetching categories:', err.message);
        res.status(500).json({ error: 'Failed to fetch categories', message: err.message });
    }
});

// Get devotionals
app.get('/api/devotionals', async (req, res) => {
    try {
        const data = await proxyToInspire('/inspire/devotionals');
        res.json(data);
    } catch (err) {
        console.error('Error fetching devotionals:', err.message);
        res.status(500).json({ error: 'Failed to fetch devotionals', message: err.message });
    }
});

// Get devotional days
app.get('/api/devotionals/:id/days', async (req, res) => {
    try {
        const data = await proxyToInspire(`/inspire/devotionals/${req.params.id}/days`);
        res.json(data);
    } catch (err) {
        console.error('Error fetching devotional days:', err.message);
        res.status(500).json({ error: 'Failed to fetch devotional days', message: err.message });
    }
});

// Get sermon series
app.get('/api/series', async (req, res) => {
    try {
        const data = await proxyToInspire('/inspire/series');
        res.json(data);
    } catch (err) {
        console.error('Error fetching series:', err.message);
        res.status(500).json({ error: 'Failed to fetch series', message: err.message });
    }
});

// Get knowledge base
app.get('/api/knowledge', async (req, res) => {
    try {
        const { category, search, limit = 50 } = req.query;
        let endpoint = `/inspire/knowledge?limit=${limit}`;

        if (category) endpoint += `&category=${encodeURIComponent(category)}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;

        const data = await proxyToInspire(endpoint);
        res.json(data);
    } catch (err) {
        console.error('Error fetching knowledge:', err.message);
        res.status(500).json({ error: 'Failed to fetch knowledge', message: err.message });
    }
});

// Daily verse endpoint
app.get('/api/daily-verse', async (req, res) => {
    // Sample verses - in production this could come from the Inspire database
    const verses = [
        { text: '"For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future."', reference: 'Jeremiah 29:11' },
        { text: '"Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight."', reference: 'Proverbs 3:5-6' },
        { text: '"Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go."', reference: 'Joshua 1:9' },
        { text: '"I can do all this through him who gives me strength."', reference: 'Philippians 4:13' },
        { text: '"The LORD is my shepherd, I lack nothing."', reference: 'Psalm 23:1' },
        { text: '"And we know that in all things God works for the good of those who love him, who have been called according to his purpose."', reference: 'Romans 8:28' },
        { text: '"Come to me, all you who are weary and burdened, and I will give you rest."', reference: 'Matthew 11:28' }
    ];

    // Select verse based on day of year for consistency
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const verse = verses[dayOfYear % verses.length];

    res.json(verse);
});

// =============================================================================
// CATCH-ALL ROUTES
// =============================================================================

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║            Jubilee Good News - Content Portal              ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║  Environment: ${NODE_ENV.padEnd(40)}║
║  API Base: ${INSPIRE_API_BASE.padEnd(43)}║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
