/**
 * JubileeDailyNews Windows Service
 *
 * Fetches prominent news content from multiple RSS sources,
 * transforms them with hopeful perspectives, and caches to Inspire database.
 *
 * Features:
 * - RSS feed scanning from 5 major news sources
 * - Prominence scoring algorithm
 * - Image downloading with automatic resizing (max 5MB)
 * - Database caching via InspireCodex API
 * - Health monitoring endpoint
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    inspireApiBase: process.env.INSPIRE_API_BASE || 'https://inspirecodex.com/api/v1',
    inspireApiKey: process.env.INSPIRE_API_KEY || '',
    fetchIntervalMs: parseInt(process.env.FETCH_INTERVAL_MS || '3600000'),
    maxImageSizeBytes: parseInt(process.env.MAX_IMAGE_SIZE_BYTES || '5242880'),
    imageResizePercentage: parseFloat(process.env.IMAGE_RESIZE_PERCENTAGE || '0.90'),
    minImageQuality: parseInt(process.env.MIN_IMAGE_QUALITY || '60'),
    topStoriesCount: parseInt(process.env.TOP_STORIES_COUNT || '3'),
    servicePort: parseInt(process.env.SERVICE_PORT || '3998'),
    logLevel: process.env.LOG_LEVEL || 'info'
};

// ============================================
// LOGGING
// ============================================

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[CONFIG.logLevel] || LOG_LEVELS.info;

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function log(level, message, data = null) {
    if (LOG_LEVELS[level] > currentLogLevel) return;

    const timestamp = new Date().toISOString();
    const logMessage = data
        ? `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(data)}`
        : `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    console.log(logMessage);

    // Write to daily log file
    const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
}

// ============================================
// SERVICE STATE
// ============================================

let serviceState = {
    isRunning: false,
    lastFetchTime: null,
    lastFetchStatus: null,
    totalFetches: 0,
    totalStoriesCached: 0,
    errors: [],
    currentStories: []
};

let fetchInterval = null;
let healthServer = null;
let sharp = null; // Will be loaded dynamically

// ============================================
// IMAGE PROCESSOR
// ============================================

async function loadSharp() {
    if (!sharp) {
        try {
            sharp = require('sharp');
            log('info', 'Sharp image library loaded successfully');
        } catch (error) {
            log('warn', 'Sharp not available, images will not be resized', { error: error.message });
        }
    }
    return sharp;
}

async function downloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
        const url = new URL(imageUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/*,*/*;q=0.8'
            },
            timeout: 30000
        };

        const request = protocol.request(options, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = response.headers.location.startsWith('http')
                    ? response.headers.location
                    : `${url.protocol}//${url.host}${response.headers.location}`;
                downloadImage(redirectUrl).then(resolve).catch(reject);
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

        request.end();
    });
}

async function resizeImageUnder5MB(imageBuffer, originalUrl) {
    const sharpLib = await loadSharp();

    if (!sharpLib) {
        // Sharp not available, return original if under limit
        if (imageBuffer.length <= CONFIG.maxImageSizeBytes) {
            return {
                buffer: imageBuffer,
                originalSize: imageBuffer.length,
                finalSize: imageBuffer.length,
                resizeIterations: 0,
                wasResized: false
            };
        }
        throw new Error('Image exceeds 5MB and Sharp is not available for resizing');
    }

    const originalSize = imageBuffer.length;
    let currentBuffer = imageBuffer;
    let iterations = 0;
    let quality = 90;

    log('debug', `Processing image from ${originalUrl}`, { originalSize });

    // Get image metadata
    let metadata;
    try {
        metadata = await sharpLib(currentBuffer).metadata();
    } catch (error) {
        log('warn', 'Failed to read image metadata', { error: error.message });
        throw error;
    }

    let currentWidth = metadata.width;
    let currentHeight = metadata.height;

    // Resize loop - reduce by 10% each iteration until under 5MB
    while (currentBuffer.length > CONFIG.maxImageSizeBytes && iterations < 20) {
        iterations++;

        // Calculate new dimensions (90% of current)
        currentWidth = Math.floor(currentWidth * CONFIG.imageResizePercentage);
        currentHeight = Math.floor(currentHeight * CONFIG.imageResizePercentage);

        // Also reduce quality if we've done multiple iterations
        if (iterations > 5) {
            quality = Math.max(CONFIG.minImageQuality, quality - 5);
        }

        log('debug', `Resize iteration ${iterations}`, {
            width: currentWidth,
            height: currentHeight,
            quality,
            currentSize: currentBuffer.length
        });

        try {
            currentBuffer = await sharpLib(imageBuffer)
                .resize(currentWidth, currentHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality })
                .toBuffer();
        } catch (error) {
            log('error', `Resize failed at iteration ${iterations}`, { error: error.message });
            throw error;
        }
    }

    const wasResized = iterations > 0;
    const finalSize = currentBuffer.length;

    if (finalSize > CONFIG.maxImageSizeBytes) {
        throw new Error(`Unable to resize image under 5MB after ${iterations} iterations`);
    }

    log('info', 'Image processing complete', {
        originalSize,
        finalSize,
        iterations,
        wasResized,
        reductionPercent: wasResized ? Math.round((1 - finalSize / originalSize) * 100) : 0
    });

    return {
        buffer: currentBuffer,
        originalSize,
        finalSize,
        resizeIterations: iterations,
        wasResized,
        finalWidth: currentWidth,
        finalHeight: currentHeight
    };
}

// ============================================
// RSS FEED PARSER
// ============================================

async function fetchRssFeed(source) {
    return new Promise((resolve, reject) => {
        const url = new URL(source.url);
        const protocol = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'User-Agent': 'JubileeDailyNews/1.0',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            timeout: 15000
        };

        const request = protocol.request(options, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = response.headers.location;
                fetchRssFeed({ ...source, url: redirectUrl }).then(resolve).catch(reject);
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

        request.end();
    });
}

function parseRssFeed(xmlData, source) {
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    let position = 0;

    while ((match = itemRegex.exec(xmlData)) !== null && position < 20) {
        position++;
        const itemXml = match[1];

        // Extract title
        const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const title = titleMatch ? decodeHtmlEntities(stripHtmlTags(titleMatch[1])).trim() : '';

        if (!title) continue;

        // Extract link
        const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const link = linkMatch ? linkMatch[1].trim() : '';

        // Extract description
        const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const description = descMatch ? decodeHtmlEntities(stripHtmlTags(descMatch[1])).substring(0, 300) : '';

        // Extract publication date
        const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';

        // Extract image URL
        let imageUrl = extractImageUrl(itemXml);

        articles.push({
            title,
            link,
            description,
            pubDate,
            imageUrl,
            position,
            source: source.id,
            sourceName: source.name,
            sourceWeight: source.weight
        });
    }

    return articles;
}

function extractImageUrl(itemXml) {
    // Try media:content
    let imageMatch = itemXml.match(/<media:content[^>]*url=["']([^"']+)["'][^>]*(?:medium=["']image["'])?/i);
    if (imageMatch) return imageMatch[1];

    // Try media:thumbnail
    imageMatch = itemXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
    if (imageMatch) return imageMatch[1];

    // Try enclosure with image type
    imageMatch = itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
    if (imageMatch) return imageMatch[1];

    // Try img tag in content
    imageMatch = itemXml.match(/<img[^>]*src=["']([^"']+)["']/i);
    if (imageMatch) return imageMatch[1];

    return null;
}

function decodeHtmlEntities(str) {
    if (!str) return '';
    const entities = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
        '&#39;': "'", '&nbsp;': ' ', '&apos;': "'",
        '&mdash;': '\u2014', '&ndash;': '\u2013', '&hellip;': '...',
        '&lsquo;': '\u2018', '&rsquo;': '\u2019', '&ldquo;': '\u201C', '&rdquo;': '\u201D'
    };
    return str.replace(/&[^;]+;/g, match => entities[match] || match);
}

function stripHtmlTags(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').trim();
}

// ============================================
// PROMINENCE SCORING
// ============================================

function calculateProminenceScore(article) {
    const scores = {
        position: Math.max(0, 10 - (article.position - 1) * 2),
        hasImage: article.imageUrl ? 5 : 0,
        titleLength: article.title.length > 50 ? 3 : (article.title.length > 30 ? 5 : 2),
        sourceWeight: article.sourceWeight || 3,
        recency: 5
    };

    const total = Object.values(scores).reduce((sum, val) => sum + val, 0);

    return {
        ...scores,
        total,
        normalized: Math.round((total / 30) * 100)
    };
}

function identifyStoryCluster(title) {
    const titleLower = title.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [cluster, keywords] of Object.entries(config.storyClusters)) {
        let score = 0;
        for (const keyword of keywords) {
            if (titleLower.includes(keyword)) {
                score += keyword.length;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = cluster;
        }
    }

    return bestMatch || 'general';
}

// ============================================
// CONTENT TRANSFORMATION
// ============================================

const TRANSFORMATIONS = {
    'economy': {
        title: 'Opportunities Emerge as Markets Adapt to New Economic Landscape',
        content: `In times of economic change, we are reminded that God's provision remains constant. While markets fluctuate, our faith provides a stable foundation that transcends financial uncertainty.

Financial experts encourage a long-term perspective, reminding us that economies have historically shown remarkable resilience. This is a time to focus on what truly matters: faith, family, and community.

"Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God." — Philippians 4:6

Communities across the nation are coming together to support one another, demonstrating the enduring strength of human connection and mutual aid during challenging times.`
    },
    'climate': {
        title: 'World Leaders Unite in Hopeful Collaboration for Environmental Stewardship',
        content: `Leaders from around the globe are coming together with renewed commitment to caring for God's creation. This gathering represents an encouraging step toward collaborative stewardship of our planet.

As people of faith, we recognize our calling to be good stewards of the earth. The discussions happening today highlight how communities worldwide are finding innovative, hopeful solutions for future generations.

"The earth is the LORD's, and everything in it." — Psalm 24:1

Scientists and faith leaders alike are discovering common ground, working together to protect the environment while honoring our responsibility to care for creation.`
    },
    'politics': {
        title: 'A Call for Unity: Citizens Across the Nation Choose Hope Over Division',
        content: `While headlines often focus on political disagreements, a deeper story is emerging: ordinary Americans are finding common ground in their shared values and commitment to community.

Faith communities are playing a vital role in bridge-building, reminding us that we are called to love our neighbors regardless of political affiliation.

"If it is possible, as far as it depends on you, live at peace with everyone." — Romans 12:18

Across the country, people are choosing to focus on what unites rather than divides, creating spaces for respectful dialogue and mutual understanding.`
    },
    'technology': {
        title: 'New Beginnings: How Communities Support Those in Career Transitions',
        content: `When companies restructure, it can feel unsettling. Yet countless stories remind us that these transitions often lead to unexpected blessings and new opportunities.

Communities are rallying to support affected workers with job fairs, retraining programs, and networking opportunities. Churches and community organizations are opening their doors to offer both practical help and spiritual encouragement.

"For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future." — Jeremiah 29:11

Many who have experienced career transitions share stories of discovering new passions, stronger relationships, and deeper faith through the journey.`
    },
    'world': {
        title: 'International Community Comes Together in Spirit of Cooperation',
        content: `Nations around the world are finding common ground on critical issues, demonstrating that cooperation can overcome seemingly insurmountable challenges.

Humanitarian organizations report that despite conflicts, countless acts of kindness and bravery occur daily as ordinary people help their neighbors.

"Blessed are the peacemakers, for they will be called children of God." — Matthew 5:9

This spirit of collaboration offers hope for addressing global challenges through unified action, reminding us that peace is always possible when hearts are open.`
    },
    'health': {
        title: 'Medical Advances Bring Hope as Communities Rally for Wellness',
        content: `Healthcare professionals and researchers continue to make remarkable strides, bringing hope to patients and families facing health challenges.

Communities are coming together to support wellness initiatives, demonstrating the power of collective care and compassion.

"He heals the brokenhearted and binds up their wounds." — Psalm 147:3

Stories of recovery, resilience, and medical breakthroughs remind us that healing takes many forms and hope endures even in difficult circumstances.`
    },
    'crime': {
        title: 'Communities United: Finding Strength and Healing Together',
        content: `In the face of tragedy, communities demonstrate remarkable resilience and compassion. Neighbors are coming together to support one another, showing that love is stronger than fear.

Faith communities are opening their doors to provide comfort, counseling, and hope to those affected by violence and loss.

"The LORD is close to the brokenhearted and saves those who are crushed in spirit." — Psalm 34:18

Across the nation, people are choosing to respond to darkness with light, finding ways to honor victims through acts of kindness and renewed commitment to building safer, more caring communities.`
    },
    'general': {
        title: 'Finding Hope and Purpose in Today\'s Headlines',
        content: `In every news cycle, there are stories of resilience, compassion, and human connection that remind us of the good in the world.

Today's events, whatever their nature, offer opportunities for reflection, growth, and renewed commitment to our values.

"And we know that in all things God works for the good of those who love him." — Romans 8:28

As we navigate today's challenges, we can find peace knowing that hope endures and that every difficulty carries within it the seeds of positive change.`
    }
};

function transformStory(story) {
    const cluster = story.storyCluster || 'general';
    const transformation = TRANSFORMATIONS[cluster] || TRANSFORMATIONS['general'];

    return {
        ...story,
        rewrittenTitle: transformation.title,
        rewrittenContent: transformation.content
    };
}

// ============================================
// INSPIRE API INTEGRATION
// ============================================

async function cacheStoryToInspire(story) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${CONFIG.inspireApiBase}/daily-news/cache`);
        const protocol = url.protocol === 'https:' ? https : http;

        const postData = JSON.stringify({
            originalTitle: story.originalTitle,
            originalUrl: story.originalUrl,
            originalExcerpt: story.originalExcerpt,
            rewrittenTitle: story.rewrittenTitle,
            rewrittenContent: story.rewrittenContent,
            source: story.source,
            sourceName: story.sourceName,
            storyCluster: story.storyCluster,
            prominenceScore: story.score.normalized,
            rank: story.rank,
            imageData: story.imageData || null,
            imageMimeType: story.imageMimeType || null,
            imageOriginalSize: story.imageOriginalSize || null,
            imageFinalSize: story.imageFinalSize || null,
            imageWasResized: story.imageWasResized || false,
            fetchedAt: new Date().toISOString()
        });

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'JubileeDailyNews/1.0',
                'X-API-Key': CONFIG.inspireApiKey
            },
            timeout: 30000
        };

        const request = protocol.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        resolve(result);
                    } else {
                        reject(new Error(result.message || `HTTP ${response.statusCode}`));
                    }
                } catch (error) {
                    reject(new Error(`Invalid response: ${data.substring(0, 100)}`));
                }
            });
            response.on('error', reject);
        });

        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });

        request.write(postData);
        request.end();
    });
}

// ============================================
// MAIN FETCH WORKFLOW
// ============================================

async function fetchAndCacheNews() {
    log('info', '=== Starting news fetch cycle ===');
    const startTime = Date.now();

    try {
        const allStories = [];

        // Phase 1: Fetch from all RSS sources
        for (const source of config.rssSources.filter(s => s.enabled)) {
            log('info', `Fetching RSS feed: ${source.name}`);

            try {
                const xmlData = await fetchRssFeed(source);
                const articles = parseRssFeed(xmlData, source);

                if (articles.length > 0) {
                    const topArticle = articles[0];
                    topArticle.score = calculateProminenceScore(topArticle);
                    topArticle.storyCluster = identifyStoryCluster(topArticle.title);
                    topArticle.originalTitle = topArticle.title;
                    topArticle.originalUrl = topArticle.link;
                    topArticle.originalExcerpt = topArticle.description;

                    allStories.push(topArticle);
                    log('info', `Found story from ${source.name}: "${topArticle.title.substring(0, 50)}..."`, {
                        score: topArticle.score.normalized,
                        cluster: topArticle.storyCluster
                    });
                }
            } catch (error) {
                log('error', `Failed to fetch ${source.name}`, { error: error.message });
            }
        }

        if (allStories.length === 0) {
            log('warn', 'No stories found from any source');
            serviceState.lastFetchStatus = 'no_stories';
            return;
        }

        // Phase 2: Sort by prominence and select top stories
        allStories.sort((a, b) => b.score.normalized - a.score.normalized);
        const topStories = allStories.slice(0, CONFIG.topStoriesCount);

        log('info', `Selected ${topStories.length} top stories`);

        // Phase 3: Process each story
        for (let i = 0; i < topStories.length; i++) {
            const story = topStories[i];
            story.rank = i + 1;

            log('info', `Processing story ${i + 1}/${topStories.length}: "${story.originalTitle.substring(0, 50)}..."`);

            // Download and resize image
            if (story.imageUrl) {
                try {
                    log('info', `Downloading image for story ${i + 1}`);
                    const imageBuffer = await downloadImage(story.imageUrl);

                    log('info', `Image downloaded, size: ${imageBuffer.length} bytes`);

                    if (imageBuffer.length > CONFIG.maxImageSizeBytes) {
                        log('info', `Image exceeds 5MB, resizing...`);
                        const resizeResult = await resizeImageUnder5MB(imageBuffer, story.imageUrl);

                        story.imageData = resizeResult.buffer.toString('base64');
                        story.imageMimeType = 'image/jpeg';
                        story.imageOriginalSize = resizeResult.originalSize;
                        story.imageFinalSize = resizeResult.finalSize;
                        story.imageWasResized = resizeResult.wasResized;

                        log('info', `Image resized: ${resizeResult.originalSize} -> ${resizeResult.finalSize} bytes (${resizeResult.resizeIterations} iterations)`);
                    } else {
                        story.imageData = imageBuffer.toString('base64');
                        story.imageMimeType = 'image/jpeg';
                        story.imageOriginalSize = imageBuffer.length;
                        story.imageFinalSize = imageBuffer.length;
                        story.imageWasResized = false;
                    }
                } catch (error) {
                    log('error', `Failed to download/resize image for story ${i + 1}`, { error: error.message });
                    story.imageData = null;
                }
            }

            // Transform content
            const transformed = transformStory(story);
            story.rewrittenTitle = transformed.rewrittenTitle;
            story.rewrittenContent = transformed.rewrittenContent;

            // Cache to Inspire database
            try {
                log('info', `Caching story ${i + 1} to Inspire database`);
                const cacheResult = await cacheStoryToInspire(story);
                log('info', `Story ${i + 1} cached successfully`, { id: cacheResult.id });
                serviceState.totalStoriesCached++;
            } catch (error) {
                log('error', `Failed to cache story ${i + 1}`, { error: error.message });
                serviceState.errors.push({
                    time: new Date().toISOString(),
                    type: 'cache_error',
                    message: error.message
                });
            }
        }

        // Update service state
        serviceState.lastFetchTime = new Date().toISOString();
        serviceState.lastFetchStatus = 'success';
        serviceState.totalFetches++;
        serviceState.currentStories = topStories.map(s => ({
            title: s.rewrittenTitle,
            source: s.sourceName,
            score: s.score.normalized,
            cluster: s.storyCluster
        }));

        const duration = Date.now() - startTime;
        log('info', `=== Fetch cycle complete ===`, {
            duration: `${duration}ms`,
            storiesProcessed: topStories.length
        });

    } catch (error) {
        log('error', 'Fetch cycle failed', { error: error.message });
        serviceState.lastFetchStatus = 'error';
        serviceState.errors.push({
            time: new Date().toISOString(),
            type: 'fetch_error',
            message: error.message
        });
    }
}

// ============================================
// HEALTH CHECK SERVER
// ============================================

function startHealthServer() {
    healthServer = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                service: 'JubileeDailyNews',
                status: serviceState.isRunning ? 'running' : 'stopped',
                version: config.version,
                uptime: process.uptime(),
                lastFetch: serviceState.lastFetchTime,
                lastStatus: serviceState.lastFetchStatus,
                totalFetches: serviceState.totalFetches,
                totalStoriesCached: serviceState.totalStoriesCached,
                currentStories: serviceState.currentStories,
                nextFetchIn: fetchInterval ? `${Math.round(CONFIG.fetchIntervalMs / 60000)} minutes` : 'not scheduled',
                errors: serviceState.errors.slice(-5)
            }, null, 2));
        } else if (req.url === '/fetch' && req.method === 'POST') {
            // Manual fetch trigger
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Fetch triggered' }));
            fetchAndCacheNews();
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    });

    healthServer.listen(CONFIG.servicePort, () => {
        log('info', `Health server listening on port ${CONFIG.servicePort}`);
    });
}

// ============================================
// SERVICE LIFECYCLE
// ============================================

async function startService() {
    log('info', '========================================');
    log('info', 'JubileeDailyNews Service Starting');
    log('info', '========================================');
    log('info', 'Configuration:', {
        apiBase: CONFIG.inspireApiBase,
        fetchInterval: `${CONFIG.fetchIntervalMs / 60000} minutes`,
        maxImageSize: `${CONFIG.maxImageSizeBytes / 1024 / 1024} MB`,
        topStoriesCount: CONFIG.topStoriesCount
    });

    serviceState.isRunning = true;

    // Load Sharp library
    await loadSharp();

    // Start health server
    startHealthServer();

    // Run initial fetch
    await fetchAndCacheNews();

    // Schedule periodic fetches
    fetchInterval = setInterval(fetchAndCacheNews, CONFIG.fetchIntervalMs);

    log('info', 'Service started successfully');
}

function stopService() {
    log('info', 'Stopping JubileeDailyNews Service...');

    serviceState.isRunning = false;

    if (fetchInterval) {
        clearInterval(fetchInterval);
        fetchInterval = null;
    }

    if (healthServer) {
        healthServer.close();
        healthServer = null;
    }

    log('info', 'Service stopped');
}

// Handle shutdown signals
process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM');
    stopService();
    process.exit(0);
});

process.on('SIGINT', () => {
    log('info', 'Received SIGINT');
    stopService();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
    serviceState.errors.push({
        time: new Date().toISOString(),
        type: 'uncaught_exception',
        message: error.message
    });
});

// ============================================
// ENTRY POINT
// ============================================

// Check if running directly or as service
if (require.main === module) {
    startService().catch(error => {
        log('error', 'Failed to start service', { error: error.message });
        process.exit(1);
    });
}

module.exports = { startService, stopService, fetchAndCacheNews };
