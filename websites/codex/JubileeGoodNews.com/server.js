/**
 * JubileeGoodNews.com Server
 *
 * Uplifting Christian news and content portal using InspireCodex API.
 * Port: 3107
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
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
// RSS FEED PROXY FOR SCANNER
// =============================================================================

// News source RSS feeds
const RSS_FEEDS = {
    cnn: 'http://rss.cnn.com/rss/cnn_topstories.rss',
    nytimes: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    foxnews: 'https://moxie.foxnews.com/google-publisher/latest.xml',
    yahoo: 'https://news.yahoo.com/rss',
    msn: 'https://www.msn.com/en-us/news/feed'
};

// Fetch and parse RSS feed
app.get('/api/scanner/rss/:source', async (req, res) => {
    const source = req.params.source.toLowerCase();
    const feedUrl = RSS_FEEDS[source];

    if (!feedUrl) {
        return res.status(400).json({ error: 'Unknown source', availableSources: Object.keys(RSS_FEEDS) });
    }

    console.log(`[RSS] Fetching ${source} feed: ${feedUrl}`);

    try {
        const feedData = await fetchRssFeed(feedUrl);
        const articles = parseRssFeed(feedData, source);

        console.log(`[RSS] Parsed ${articles.length} articles from ${source}`);

        res.json({
            success: true,
            source: source,
            count: articles.length,
            articles: articles.slice(0, 10) // Return top 10 articles
        });
    } catch (err) {
        console.error(`[RSS] Error fetching ${source}:`, err.message);
        res.status(500).json({
            error: 'Failed to fetch RSS feed',
            message: err.message,
            source: source
        });
    }
});

// Helper to fetch RSS feed
function fetchRssFeed(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const request = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            timeout: 15000
        }, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`[RSS] Following redirect to: ${response.headers.location}`);
                fetchRssFeed(response.headers.location).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
            response.on('error', reject);
        });

        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Parse RSS XML into articles
function parseRssFeed(xmlData, source) {
    const articles = [];

    // Extract items using regex (simple XML parsing)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    let position = 1;

    while ((match = itemRegex.exec(xmlData)) !== null && position <= 20) {
        const itemXml = match[1];

        // Extract title
        const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';

        // Extract link
        const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const link = linkMatch ? linkMatch[1].trim() : '';

        // Extract description
        const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const description = descMatch ? decodeHtmlEntities(stripHtmlTags(descMatch[1].trim())).substring(0, 300) : '';

        // Extract publication date
        const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';

        // Extract image from various sources
        let imageUrl = '';

        // Try media:content
        const mediaMatch = itemXml.match(/<media:content[^>]*url=["']([^"']+)["']/i);
        if (mediaMatch) {
            imageUrl = mediaMatch[1];
        }

        // Try media:thumbnail
        if (!imageUrl) {
            const thumbMatch = itemXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
            if (thumbMatch) {
                imageUrl = thumbMatch[1];
            }
        }

        // Try enclosure
        if (!imageUrl) {
            const enclosureMatch = itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
            if (enclosureMatch) {
                imageUrl = enclosureMatch[1];
            }
        }

        // Try image tag in content:encoded
        if (!imageUrl) {
            const contentMatch = itemXml.match(/<content:encoded>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
            if (contentMatch) {
                const imgMatch = contentMatch[1].match(/<img[^>]*src=["']([^"']+)["']/i);
                if (imgMatch) {
                    imageUrl = imgMatch[1];
                }
            }
        }

        // Try image in description
        if (!imageUrl && descMatch) {
            const imgInDescMatch = descMatch[1].match(/<img[^>]*src=["']([^"']+)["']/i);
            if (imgInDescMatch) {
                imageUrl = imgInDescMatch[1];
            }
        }

        if (title && link) {
            articles.push({
                title: title,
                link: link,
                description: description,
                pubDate: pubDate,
                imageUrl: imageUrl || null,
                position: position,
                hasImage: !!imageUrl
            });
            position++;
        }
    }

    return articles;
}

// Helper to decode HTML entities
function decodeHtmlEntities(str) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
        '&nbsp;': ' ',
        '&#8217;': "'",
        '&#8216;': "'",
        '&#8220;': '"',
        '&#8221;': '"',
        '&#8211;': '-',
        '&#8212;': '-'
    };
    return str.replace(/&[^;]+;/g, match => entities[match] || match);
}

// Helper to strip HTML tags
function stripHtmlTags(str) {
    return str.replace(/<[^>]*>/g, '').trim();
}

// =============================================================================
// SCANNER IMAGE DOWNLOAD
// =============================================================================

// Ensure prominence images directory exists
const PROMINENCE_DIR = path.join(__dirname, 'public', 'images', 'prominence');
if (!fs.existsSync(PROMINENCE_DIR)) {
    fs.mkdirSync(PROMINENCE_DIR, { recursive: true });
}

// Download image from URL and save to prominence folder
app.post('/api/scanner/download-image', async (req, res) => {
    try {
        const { imageUrl, filename } = req.body;

        if (!imageUrl || !filename) {
            return res.status(400).json({ error: 'imageUrl and filename are required' });
        }

        // Sanitize filename
        const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.jpg';
        const localPath = path.join(PROMINENCE_DIR, safeFilename);
        const publicPath = `/images/prominence/${safeFilename}`;

        // Check if file already exists
        if (fs.existsSync(localPath)) {
            return res.json({
                success: true,
                localPath: publicPath,
                message: 'Image already exists'
            });
        }

        // Download the image
        const downloadImage = (url) => {
            return new Promise((resolve, reject) => {
                const protocol = url.startsWith('https') ? https : http;

                const request = protocol.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/*,*/*;q=0.8'
                    },
                    timeout: 15000
                }, (response) => {
                    // Handle redirects
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        downloadImage(response.headers.location).then(resolve).catch(reject);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    const chunks = [];
                    response.on('data', chunk => chunks.push(chunk));
                    response.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        resolve(buffer);
                    });
                    response.on('error', reject);
                });

                request.on('error', reject);
                request.on('timeout', () => {
                    request.destroy();
                    reject(new Error('Request timeout'));
                });
            });
        };

        const imageBuffer = await downloadImage(imageUrl);

        // Save to file
        fs.writeFileSync(localPath, imageBuffer);

        console.log(`Downloaded image: ${safeFilename} (${imageBuffer.length} bytes)`);

        res.json({
            success: true,
            localPath: publicPath,
            size: imageBuffer.length,
            message: 'Image downloaded successfully'
        });

    } catch (err) {
        console.error('Error downloading image:', err.message);
        res.status(500).json({
            error: 'Failed to download image',
            message: err.message
        });
    }
});

// List downloaded prominence images
app.get('/api/scanner/images', (req, res) => {
    try {
        const files = fs.readdirSync(PROMINENCE_DIR)
            .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
            .map(f => ({
                filename: f,
                path: `/images/prominence/${f}`,
                size: fs.statSync(path.join(PROMINENCE_DIR, f)).size,
                modified: fs.statSync(path.join(PROMINENCE_DIR, f)).mtime
            }));

        res.json({ images: files });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list images', message: err.message });
    }
});

// Delete a prominence image
app.delete('/api/scanner/images/:filename', (req, res) => {
    try {
        const safeFilename = req.params.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = path.join(PROMINENCE_DIR, safeFilename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'Image deleted' });
        } else {
            res.status(404).json({ error: 'Image not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete image', message: err.message });
    }
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
