/**
 * JUBILEE WEBSITE GENERATOR - Main Server
 *
 * Express server for AI-powered website generation
 * Generates complete websites with:
 * - 12 AI-generated writers with photos
 * - 3, 7, or 12 categories
 * - 12 articles per category
 * - SEO optimization and internal linking
 * - Export to HTML, WordPress, Ghost
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { ensureTodayHistory } from './scripts/generateDailyHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3001;

// Data Store - internal app configurations and registry
const DATASTORE_BASE = process.env.DATASTORE_PATH || join(__dirname, '.datastore');
const SITES_PATH = join(DATASTORE_BASE, 'sites');
const REGISTRY_PATH = join(DATASTORE_BASE, '.registry', 'sites_history.json');
const NAMESPACE_PATH = join(DATASTORE_BASE, '.namespace');

// Websites Path - each domain has its own .webstore subfolder for JSON data
// Structure: /.datastore/websites/{domain}/.webstore
const WEBSITES_PATH = join(DATASTORE_BASE, 'websites');

// AI Model Configuration
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = 'gpt-4o';

// Website Generation Configuration
const ARTICLES_PER_CATEGORY = 12;
const DEFAULT_CATEGORY_COUNT = 3;

// Security & Rate Limiting
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || process.env.ADMIN_USER;
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASSWORD || process.env.BASIC_AUTH_PASS || process.env.ADMIN_PASS;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);

// ============================================================================
// TITLE FORMATTING HELPERS
// ============================================================================

/**
 * Format website title with proper punctuation styling
 * Handles common patterns like:
 * - "GodsGrace" -> "God's Grace" (possessive)
 * - "DailyBible" -> "Daily Bible"
 * - Adds apostrophes for possessive patterns
 * @param {string} rawTitle - The raw title from domain name
 * @returns {string} - Properly formatted title with punctuation
 */
function formatWebsiteTitle(rawTitle) {
  // First, split camelCase into words
  let formatted = rawTitle
    .replace('.com', '')
    .replace('.org', '')
    .replace('.net', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();

  // Possessive patterns - common words that should have apostrophe-s
  const possessivePatterns = [
    { pattern: /\bGods\b/gi, replacement: "God's" },
    { pattern: /\bChrists\b/gi, replacement: "Christ's" },
    { pattern: /\bJesuss?\b/gi, replacement: "Jesus'" },
    { pattern: /\bMothers\b/gi, replacement: "Mother's" },
    { pattern: /\bFathers\b/gi, replacement: "Father's" },
    { pattern: /\bChildrens\b/gi, replacement: "Children's" },
    { pattern: /\bWomens\b/gi, replacement: "Women's" },
    { pattern: /\bMens\b/gi, replacement: "Men's" },
    { pattern: /\bTodays\b/gi, replacement: "Today's" },
    { pattern: /\bYesterdays\b/gi, replacement: "Yesterday's" },
    { pattern: /\bTomorrows\b/gi, replacement: "Tomorrow's" },
    { pattern: /\bWorlds\b/gi, replacement: "World's" },
    { pattern: /\bNatures\b/gi, replacement: "Nature's" },
    { pattern: /\bHeavens\b/gi, replacement: "Heaven's" },
    { pattern: /\bEarths\b/gi, replacement: "Earth's" },
    { pattern: /\bLifes\b/gi, replacement: "Life's" },
    { pattern: /\bSouls\b/gi, replacement: "Soul's" },
    { pattern: /\bHearts\b/gi, replacement: "Heart's" },
    { pattern: /\bAngels\b/gi, replacement: "Angel's" }
  ];

  // Apply possessive patterns
  for (const { pattern, replacement } of possessivePatterns) {
    formatted = formatted.replace(pattern, replacement);
  }

  // Clean up any double spaces
  formatted = formatted.replace(/\s+/g, ' ').trim();

  return formatted;
}

// ============================================================================
// SECURITY HELPERS
// ============================================================================

/**
 * Basic auth middleware for generation endpoints.
 * If credentials are not configured, the middleware is a no-op.
 */
function requireBasicAuth(req, res, next) {
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASS) {
    return next();
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Jubilee Generator"');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const base64Credentials = header.replace('Basic ', '');
  const credentials = Buffer.from(base64Credentials, 'base64').toString();
  const [user, pass] = credentials.split(':');

  if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Jubilee Generator"');
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

/**
 * Minimal in-memory rate limiter keyed by IP.
 */
function createRateLimiter(maxRequests, windowMs) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key =
      req.ip ||
      req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      'unknown';

    const entry = hits.get(key) || { count: 0, start: now };

    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        retryAfterSeconds: Math.ceil((entry.start + windowMs - now) / 1000)
      });
    }

    return next();
  };
}

const generationRateLimiter = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

// ============================================================================
// INSPIRE FAMILY PERSONAS (12 Faith-Based Writers)
// Loaded from modules/inspire.json as the authoritative data source
// ============================================================================

const INSPIRE_JSON_PATH = join(__dirname, 'modules', 'inspire.json');

/**
 * Load Inspire Family personas from the authoritative JSON file
 */
async function loadInspirePersonas() {
  try {
    const data = await fs.readFile(INSPIRE_JSON_PATH, 'utf-8');
    const inspireData = JSON.parse(data);
    return inspireData.personas || [];
  } catch (error) {
    console.error('Failed to load inspire.json:', error.message);
    // Return empty array if file cannot be loaded
    return [];
  }
}

// Cache for Inspire Family personas (loaded on first use)
let INSPIRE_FAMILY_PERSONAS = null;

/**
 * Get Inspire Family personas (loads from JSON if not cached)
 */
async function getInspirePersonas() {
  if (INSPIRE_FAMILY_PERSONAS === null) {
    INSPIRE_FAMILY_PERSONAS = await loadInspirePersonas();
    console.log(`   📖 Loaded ${INSPIRE_FAMILY_PERSONAS.length} Inspire Family personas from modules/inspire.json`);
  }
  return INSPIRE_FAMILY_PERSONAS;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for subscribers and other entities
 * @returns {string} - Unique 12-character ID
 */
function generateUniqueId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Ensure required directories exist
 */
async function ensureDirectories() {
  const dirs = [
    DATASTORE_BASE,
    SITES_PATH,
    join(DATASTORE_BASE, '.registry'),
    NAMESPACE_PATH,
    WEBSITES_PATH
  ];

  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    }
  }
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 */
async function copyDirectoryRecursive(src, dest) {
  // Create destination directory
  await fs.mkdir(dest, { recursive: true });

  // Read source directory
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectoryRecursive(srcPath, destPath);
    } else {
      // Copy file
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Copy .lumiatos advertising folder to a new website
 * @param {string} domainPath - Path to the website domain folder
 */
async function copyLumiatosToWebsite(domainPath) {
  const sourceLumiatos = join(DATASTORE_BASE, '.lumiatos');
  const destLumiatos = join(domainPath, '.lumiatos');

  try {
    // Check if source .lumiatos exists
    await fs.access(sourceLumiatos);

    // Copy the entire .lumiatos folder
    await copyDirectoryRecursive(sourceLumiatos, destLumiatos);

    console.log(`   📢 Copied .lumiatos advertising folder`);
    return true;
  } catch (error) {
    console.log(`   ⚠️  .lumiatos folder not found in datastore, skipping ad setup`);
    return false;
  }
}

/**
 * Create web_tracker.json for view tracking on a new website
 * @param {string} domainPath - Path to the website domain folder
 * @param {string} domainName - Domain name for the website
 */
async function createWebTracker(domainPath, domainName) {
  const webstorePath = join(domainPath, '.webstore');
  const trackerPath = join(webstorePath, 'web_tracker.json');

  // Ensure .webstore directory exists
  await fs.mkdir(webstorePath, { recursive: true });

  // Get current date parts
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const trackerData = {
    version: '1.0',
    domain: domainName,
    lastUpdated: now.toISOString(),
    tracking: {
      [year]: {
        [month]: {
          [day]: {
            pageViews: { home: 0, portal: {}, article: {} },
            portalViews: {},
            articleViews: {},
            adViews: {}
          }
        }
      }
    },
    totals: {
      allTime: {
        pageViews: 0,
        portalViews: 0,
        articleViews: 0,
        adViews: 0
      },
      byPortal: {},
      byArticle: {},
      byAd: {}
    },
    viewSchema: {
      pageView: {
        timestamp: 'ISO 8601 datetime',
        pageType: 'string (home|portal|article)',
        pageId: 'string (slug or articleId)',
        referrer: 'string (optional)',
        userAgent: 'string (optional)'
      },
      portalView: {
        timestamp: 'ISO 8601 datetime',
        portalSlug: 'string',
        portalName: 'string',
        referrer: 'string (optional)'
      },
      articleView: {
        timestamp: 'ISO 8601 datetime',
        articleId: 'string',
        articleTitle: 'string',
        categorySlug: 'string',
        referrer: 'string (optional)'
      },
      adView: {
        timestamp: 'ISO 8601 datetime',
        adId: 'string',
        campaignId: 'string',
        placement: 'string',
        pageType: 'string',
        pageId: 'string (optional)'
      }
    }
  };

  await fs.writeFile(trackerPath, JSON.stringify(trackerData, null, 2), 'utf-8');
  console.log(`   📊 Created web_tracker.json for view tracking`);
  return true;
}

/**
 * Load sites registry
 */
async function loadRegistry() {
  try {
    const data = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    // Registry doesn't exist yet, create empty one
    return {
      sites: [],
      count: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Save sites registry
 */
async function saveRegistry(registry) {
  registry.lastUpdated = new Date().toISOString();
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * Generate site code (similar to book codes)
 */
function generateSiteCode(domain) {
  const timestamp = Date.now().toString().slice(-6);
  const domainPart = domain.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
  return `WEB-${domainPart}-${timestamp}`;
}

/**
 * Call OpenAI API with fallback to secondary key
 */
async function callOpenAI(prompt, temperature = 0.7, maxTokens = 2000) {
  const primaryKey = process.env.OPENAI_API_KEY;
  const secondaryKey = process.env.OPENAI_API_KEY_BACKUP;

  if (!primaryKey && !secondaryKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Try primary key first
  if (primaryKey) {
    try {
      console.log('   🔑 Using primary OpenAI API key...');
      return await makeOpenAICall(primaryKey, prompt, temperature, maxTokens);
    } catch (error) {
      // Check if it's a quota error
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota') || errorMessage.includes('billing')) {
        console.log('   ⚠️  Primary key quota exceeded, trying backup key...');

        if (secondaryKey) {
          try {
            console.log('   🔑 Using backup OpenAI API key...');
            return await makeOpenAICall(secondaryKey, prompt, temperature, maxTokens);
          } catch (secondaryError) {
            console.error('   ❌ Backup key also failed:', secondaryError.message);
            throw new Error(`Both OpenAI keys failed. Primary: ${error.message}, Backup: ${secondaryError.message}`);
          }
        } else {
          throw new Error('Primary OpenAI key quota exceeded and no backup key configured');
        }
      } else {
        // Not a quota error, throw original error
        throw error;
      }
    }
  } else if (secondaryKey) {
    // Only secondary key available
    console.log('   🔑 Using backup OpenAI API key...');
    return await makeOpenAICall(secondaryKey, prompt, temperature, maxTokens);
  }
}

/**
 * Make actual OpenAI API call
 */
async function makeOpenAICall(apiKey, prompt, temperature, maxTokens) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API call failed:', error.message);
    throw error;
  }
}

/**
 * Call Claude API
 */
async function callClaude(prompt, temperature = 0.7, maxTokens = 2000) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API call failed:', error);
    throw error;
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Jubilee Website Generator',
    version: '1.0.0',
    apis: {
      openai: !!process.env.OPENAI_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY
    }
  });
});

/**
 * Generate daily history endpoint
 * GET /api/generate-daily-history/:domain
 * Called by the website on first visit of the day to generate randomized content
 */
app.get('/api/generate-daily-history/:domain', async (req, res) => {
  try {
    const { domain } = req.params;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    // Generate the history file (will skip if already exists for today)
    const result = ensureTodayHistory(domain);

    res.json({
      success: true,
      message: 'Daily history check complete',
      domain: domain,
      historyFile: result
    });
  } catch (error) {
    console.error('Error generating daily history:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Newsletter subscription endpoint
 * POST /api/subscribe
 * Body: { email, domain, subscribedAt }
 */
app.post('/api/subscribe', async (req, res) => {
  try {
    const { email, domain, subscribedAt } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Path to subscribers file for this domain
    const domainPath = join(WEBSITES_PATH, domain || 'default');
    const subscribersPath = join(domainPath, 'web_subscribers.json');

    // Ensure domain directory exists
    await fs.mkdir(domainPath, { recursive: true });

    // Load existing subscribers or create new file
    let subscribersData = { subscribers: [], count: 0, lastUpdated: null };
    try {
      const existingData = await fs.readFile(subscribersPath, 'utf-8');
      subscribersData = JSON.parse(existingData);
    } catch (err) {
      // File doesn't exist, will create new
    }

    // Check if email already subscribed
    const existingSubscriber = subscribersData.subscribers.find(
      s => s.email.toLowerCase() === email.toLowerCase()
    );

    if (existingSubscriber) {
      return res.status(400).json({
        success: false,
        message: 'This email is already subscribed'
      });
    }

    // Add new subscriber
    const newSubscriber = {
      id: generateUniqueId(),
      email: email.toLowerCase(),
      domain: domain || 'default',
      subscribedAt: subscribedAt || new Date().toISOString(),
      status: 'active'
    };

    subscribersData.subscribers.push(newSubscriber);
    subscribersData.count = subscribersData.subscribers.length;
    subscribersData.lastUpdated = new Date().toISOString();

    // Save updated subscribers
    await fs.writeFile(subscribersPath, JSON.stringify(subscribersData, null, 2));

    console.log(`New subscriber: ${email} for ${domain}`);

    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });

  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Subscription failed. Please try again later.'
    });
  }
});

/**
 * Get all generated websites
 */
app.get('/api/websites', async (req, res) => {
  try {
    const registry = await loadRegistry();
    res.json({
      success: true,
      websites: registry.sites,
      count: registry.count
    });
  } catch (error) {
    console.error('Error loading websites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STEP 1: Analyze domain name AND generate writers
 * POST /api/website/analyze-and-generate-writers
 * Body: { domain, overview, categoryCount, quickMode }
 */
app.post('/api/website/analyze-and-generate-writers', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { domain, overview, categoryCount = DEFAULT_CATEGORY_COUNT, quickMode = false } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }

    // Overview is optional but helpful for better analysis
    const websiteOverview = overview && overview.trim() ? overview.trim() : 'General website';

    console.log(`\n🌐 Analyzing domain: ${domain}`);
    console.log(`   Categories: ${categoryCount}`);
    console.log(`   Mode: ${quickMode ? 'Quick' : 'Full'}`);
    console.log(`   Overview provided: ${overview && overview.trim() ? 'Yes' : 'No'}`);

    // Generate site code
    const siteCode = generateSiteCode(domain);
    console.log(`   Site Code: ${siteCode}`);

    // Create site folder
    const sitePath = join(SITES_PATH, `${siteCode}-${domain}`);
    await fs.mkdir(sitePath, { recursive: true });
    await fs.mkdir(join(sitePath, 'writers'), { recursive: true });
    await fs.mkdir(join(sitePath, 'categories'), { recursive: true });
    await fs.mkdir(join(sitePath, 'articles'), { recursive: true });
    await fs.mkdir(join(sitePath, 'sitemap'), { recursive: true });
    await fs.mkdir(join(sitePath, 'theme'), { recursive: true });
    await fs.mkdir(join(sitePath, 'export'), { recursive: true });

    // Domain analysis prompt - determine if faith-based or business-based
    const analysisPrompt = `Analyze the following domain name and website overview to determine the website category:

Domain: ${domain}
Overview: ${websiteOverview}

Classify as ONE of these types:
- FB (Faith-Based): Christian, biblical, ministry, prayer, worship, faith, church, spiritual, gospel, Jesus, God, theology, devotional, discipleship
- BB (Business-Based): business, corporate, enterprise, B2B, SaaS, technology, marketing, sales, ROI, productivity, management, strategy, startup, finance
- OB (Other-Based): Any other category like cooking, health, fitness, travel, gaming, pets, gardening, DIY, education, parenting, lifestyle, fashion, beauty, sports, music, art, photography, etc.

Extract keywords from the domain name itself to determine the category.

Respond with ONLY this JSON format (no additional text):
{
  "contentType": "FB, BB, or OB",
  "confidence": "high/medium/low",
  "reasoning": "brief explanation based on domain keywords",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "niche": "specific niche/category (e.g., Cooking, Fitness, Travel, Technology, etc.)",
  "tone": "professional/casual/inspirational/friendly/authoritative/etc"
}`;

    console.log('   🤖 Analyzing content type...');
    const analysisText = await callOpenAI(analysisPrompt, 0.3, 500);

    // Parse JSON response
    let analysis;
    try {
      const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using fallback');
      analysis = {
        contentType: 'BB',
        confidence: 'low',
        reasoning: 'Could not determine content type',
        keywords: [domain.split('.')[0]],
        niche: 'General',
        tone: 'Professional'
      };
    }

    const contentType = analysis.contentType;
    console.log(`   📊 Content Type: ${contentType} (${analysis.confidence} confidence)`);
    console.log(`   💡 Reasoning: ${analysis.reasoning}`);
    console.log(`   🎯 Niche: ${analysis.niche}`);

    // Generate writers based on content type
    let writers;

    if (contentType === 'FB') {
      // Load and use the 12 Inspire Family personas from modules/inspire.json
      writers = await getInspirePersonas();
      console.log(`   ✍️ Using ${writers.length} Inspire Family personas (faith-based)`);
    } else {
      // Generate 12 unique category-specific writers (6 male, 6 female)
      const categoryType = contentType === 'BB' ? 'business/corporate' : analysis.niche.toLowerCase();
      console.log(`   🤖 Generating 12 unique ${analysis.niche} writers...`);

      const writerPrompt = `Generate 12 unique professional writer personas for a ${categoryType} website about "${analysis.niche}".

IMPORTANT REQUIREMENTS:
- Create exactly 6 FEMALE writers and 6 MALE writers (gender balance is mandatory)
- Use realistic first and last names ONLY (no titles like Dr., Rev., Pastor, Prof., etc.)
- Make each persona an expert in ${analysis.niche}
- Each persona must have distinct expertise within the ${analysis.niche} field

For each writer, provide:
- name: First name and last name only (no titles or suffixes)
- bio: 100-150 words describing their background and expertise in ${analysis.niche}
- expertise: Array of exactly 3 single-word expertise areas relevant to ${analysis.niche}
- tone: One word describing their writing tone (e.g., Friendly, Authoritative, Casual, Expert, Warm, Direct)
- style: One word describing their writing style (e.g., Practical, Technical, Storytelling, Educational, Inspirational)

Respond with ONLY this JSON format:
{
  "writers": [
    {
      "name": "Jane Smith",
      "bio": "...",
      "expertise": ["Word1", "Word2", "Word3"],
      "tone": "Friendly",
      "style": "Practical"
    }
  ]
}

Ensure the first 6 writers are female and the last 6 are male. Make all bios and expertise specific to ${analysis.niche}.`;

      const writersText = await callOpenAI(writerPrompt, 0.8, 4000);

      try {
        const cleanJson = writersText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const writersData = JSON.parse(cleanJson);
        writers = writersData.writers || [];

        // Ensure we have exactly 12 writers
        if (writers.length > 12) {
          writers = writers.slice(0, 12);
        } else if (writers.length < 12) {
          console.warn(`Only generated ${writers.length} writers, expected 12`);
        }
      } catch (parseError) {
        console.error('Failed to parse writers JSON:', parseError);
        // Fallback: create generic writers for the detected niche
        writers = generateFallbackWriters(analysis.niche);
      }

      console.log(`   ✅ Generated ${writers.length} ${analysis.niche} writers`);
    }

    // Save writers to file
    const writersData = {
      domain,
      contentType,
      generatedAt: new Date().toISOString(),
      writers
    };

    await fs.writeFile(
      join(sitePath, 'writers', 'web_writers.json'),
      JSON.stringify(writersData, null, 2),
      'utf-8'
    );

    // Save config file
    const config = {
      siteCode,
      domain,
      overview: websiteOverview,
      categoryCount,
      quickMode,
      contentType,
      analysis,
      writersCount: writers.length,
      createdAt: new Date().toISOString(),
      status: 'step1_complete'
    };

    await fs.writeFile(
      join(sitePath, `${siteCode}.config.json`),
      JSON.stringify(config, null, 2),
      'utf-8'
    );

    // Update registry
    const registry = await loadRegistry();
    registry.sites.push({
      siteCode,
      domain,
      categoryCount,
      quickMode,
      contentType,
      status: 'step1_complete',
      createdAt: config.createdAt
    });
    registry.count = registry.sites.length;
    await saveRegistry(registry);

    console.log('   ✅ Analysis and writer generation complete');

    res.json({
      success: true,
      siteCode,
      domain,
      contentType,
      analysis,
      writers,
      config,
      message: 'Domain analysis and writer generation complete'
    });

  } catch (error) {
    console.error('Domain analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Fallback function to generate generic writers for any niche
 * Creates 6 female and 6 male writers with generic but niche-appropriate content
 */
function generateFallbackWriters(niche = 'General') {
  const femaleNames = ['Alexandra Bennett', 'Sarah Williams', 'Jennifer Martinez', 'Emily Davis', 'Michelle Rodriguez', 'Amanda Taylor'];
  const maleNames = ['Michael Chen', 'David Park', 'Robert Thompson', 'James Wilson', 'Christopher Lee', 'Daniel Garcia'];

  const tones = ['Authoritative', 'Friendly', 'Expert', 'Warm', 'Direct', 'Engaging'];
  const styles = ['Practical', 'Educational', 'Storytelling', 'Analytical', 'Inspirational', 'Technical'];

  const writers = [];

  // Generate 6 female writers
  femaleNames.forEach((name, i) => {
    writers.push({
      name,
      bio: `Experienced ${niche} professional with extensive knowledge and a passion for sharing insights that help readers succeed in their journey.`,
      expertise: [niche, 'Strategy', 'Growth'],
      tone: tones[i],
      style: styles[i]
    });
  });

  // Generate 6 male writers
  maleNames.forEach((name, i) => {
    writers.push({
      name,
      bio: `Dedicated ${niche} expert bringing years of hands-on experience and practical wisdom to help readers achieve their goals.`,
      expertise: [niche, 'Innovation', 'Excellence'],
      tone: tones[(i + 3) % 6],
      style: styles[(i + 3) % 6]
    });
  });

  return writers;
}

/**
 * STEP 3: Generate categories for a website
 * POST /api/website/generate-categories
 * Body: { siteCode, categoryCount }
 */
app.post('/api/website/generate-categories', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode, categoryCount = DEFAULT_CATEGORY_COUNT } = req.body;

    if (!siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Site code is required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    const domain = config.domain;
    const overview = config.overview || '';
    const contentType = config.contentType || 'OB';
    const niche = config.analysis?.niche || 'General';

    console.log(`\n📂 Generating categories for: ${domain}`);
    console.log(`   Site Code: ${siteCode}`);
    console.log(`   Category Count: ${categoryCount}`);
    console.log(`   Content Type: ${contentType}`);
    console.log(`   Niche: ${niche}`);

    // CHECK FOR EXISTING CATEGORIES IN WEBSTORE
    // If domain folder already exists with category subfolders, use those
    const domainFolder = join(WEBSITES_PATH, domain);
    let existingCategories = [];

    try {
      const domainContents = await fs.readdir(domainFolder);
      // Filter out hidden folders and files (like .webstore)
      const categoryFolders = domainContents.filter(item => !item.startsWith('.') && !item.includes('.'));

      if (categoryFolders.length > 0) {
        console.log(`   📁 Found ${categoryFolders.length} existing category folders in webstore`);

        // Try to load existing categories from web_categories.json
        const webCategoriesPath = join(domainFolder, '.webstore', 'web_categories.json');
        try {
          const webCategoriesData = await fs.readFile(webCategoriesPath, 'utf-8');
          const webCategories = JSON.parse(webCategoriesData);
          existingCategories = webCategories.categories || [];
          console.log(`   ✅ Loaded ${existingCategories.length} categories from web_categories.json`);
        } catch (err) {
          // web_categories.json doesn't exist, build from folder names
          existingCategories = categoryFolders.map((folder, index) => ({
            rank: index + 1,
            name: folder.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            slug: folder,
            description: `Articles and content about ${folder.split('-').join(' ')}.`,
            keywords: [folder, niche.toLowerCase(), 'guide', 'tips', 'learn'],
            articleCount: 12
          }));
          console.log(`   ✅ Built ${existingCategories.length} categories from folder names`);
        }
      }
    } catch (err) {
      // Domain folder doesn't exist yet, will generate new categories
      console.log(`   📁 No existing domain folder found, will generate new categories`);
    }

    // If we found existing categories, use them instead of calling API
    if (existingCategories.length > 0) {
      console.log(`   ⏭️  Using existing categories (skipping API call)`);

      // Save categories to datastore (for consistency)
      const categoriesData = {
        domain,
        siteCode,
        contentType,
        niche,
        categoryCount: existingCategories.length,
        generatedAt: new Date().toISOString(),
        source: 'cached',
        categories: existingCategories
      };

      await fs.writeFile(
        join(sitePath, 'categories', 'categories.json'),
        JSON.stringify(categoriesData, null, 2),
        'utf-8'
      );

      // Update config
      config.categoryCount = existingCategories.length;
      config.status = 'step3_complete';
      config.categoriesGeneratedAt = new Date().toISOString();
      config.categoriesSource = 'cached';

      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Update registry
      const registry = await loadRegistry();
      const siteIndex = registry.sites.findIndex(s => s.siteCode === siteCode);
      if (siteIndex !== -1) {
        registry.sites[siteIndex].categoryCount = existingCategories.length;
        registry.sites[siteIndex].status = 'step3_complete';
        await saveRegistry(registry);
      }

      return res.json({
        success: true,
        siteCode,
        domain,
        categoryCount: existingCategories.length,
        categories: existingCategories,
        cached: true,
        message: 'Using existing categories from webstore (no API call needed)'
      });
    }

    // Build context for AI prompt
    let contextInfo = `Domain: ${domain}`;
    if (overview && overview.trim() && overview !== 'General website') {
      contextInfo += `\nWebsite Overview: ${overview}`;
    }

    // Generate categories using AI
    const categoryPrompt = `Generate exactly ${categoryCount} compelling website categories for the following website:

${contextInfo}
Content Type: ${contentType === 'FB' ? 'Faith-Based' : contentType === 'BB' ? 'Business-Based' : 'General'}
Niche: ${niche}

REQUIREMENTS:
1. Generate exactly ${categoryCount} categories, ranked by relevance and appeal
2. Each category must be highly relevant to the domain name and niche
3. Categories should be distinct and not overlap significantly
4. Make categories compelling and clickable for readers
5. Each category will contain 12 articles

For each category, provide:
- name: The display name of the category (2-4 words, title case)
- slug: URL-friendly version (lowercase, hyphens, no special characters)
- description: A compelling 50-75 word description explaining what content this category contains
- keywords: Array of 5 relevant SEO keywords for this category
- articleCount: Always 12

Respond with ONLY this JSON format (no additional text):
{
  "categories": [
    {
      "rank": 1,
      "name": "Category Name",
      "slug": "category-name",
      "description": "Compelling description of what readers will find in this category...",
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "articleCount": 12
    }
  ]
}

Rank categories from most compelling (#1) to least compelling (#${categoryCount}). Make the top categories the most attractive and search-friendly.`;

    console.log('   🤖 Generating categories with AI...');
    const categoriesText = await callOpenAI(categoryPrompt, 0.7, 3000);

    let categories;
    try {
      const cleanJson = categoriesText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const categoriesData = JSON.parse(cleanJson);
      categories = categoriesData.categories || [];

      // Ensure we have the correct number of categories
      if (categories.length > categoryCount) {
        categories = categories.slice(0, categoryCount);
      } else if (categories.length < categoryCount) {
        console.warn(`   ⚠️  Only generated ${categories.length} categories, expected ${categoryCount}`);
      }

      // Ensure each category has required fields and correct rank
      categories = categories.map((cat, index) => ({
        rank: index + 1,
        name: cat.name || `Category ${index + 1}`,
        slug: cat.slug || `category-${index + 1}`,
        description: cat.description || 'Category description coming soon.',
        keywords: cat.keywords || [],
        articleCount: 12
      }));

    } catch (parseError) {
      console.error('   ❌ Failed to parse categories JSON:', parseError.message);
      // Generate fallback categories
      categories = generateFallbackCategories(niche, categoryCount);
    }

    console.log(`   ✅ Generated ${categories.length} categories`);

    // Save categories to file
    const categoriesData = {
      domain,
      siteCode,
      contentType,
      niche,
      categoryCount: categories.length,
      generatedAt: new Date().toISOString(),
      categories
    };

    await fs.writeFile(
      join(sitePath, 'categories', 'categories.json'),
      JSON.stringify(categoriesData, null, 2),
      'utf-8'
    );

    // Update config
    config.categoryCount = categories.length;
    config.status = 'step3_complete';
    config.categoriesGeneratedAt = new Date().toISOString();

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update registry
    const registry = await loadRegistry();
    const siteIndex = registry.sites.findIndex(s => s.siteCode === siteCode);
    if (siteIndex !== -1) {
      registry.sites[siteIndex].categoryCount = categories.length;
      registry.sites[siteIndex].status = 'step3_complete';
      await saveRegistry(registry);
    }

    res.json({
      success: true,
      siteCode,
      domain,
      categoryCount: categories.length,
      categories,
      message: 'Categories generated successfully'
    });

  } catch (error) {
    console.error('Category generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Fallback function to generate generic categories for any niche
 */
function generateFallbackCategories(niche = 'General', count = 3) {
  const genericCategories = [
    { name: 'Getting Started', slug: 'getting-started', description: `Essential guides and introductions for beginners in ${niche}. Learn the fundamentals and build a strong foundation for your journey.` },
    { name: 'Best Practices', slug: 'best-practices', description: `Proven strategies and expert recommendations for ${niche}. Discover what works and avoid common mistakes.` },
    { name: 'Advanced Topics', slug: 'advanced-topics', description: `In-depth exploration of complex ${niche} concepts. Take your knowledge to the next level with advanced insights.` },
    { name: 'Tips & Tricks', slug: 'tips-and-tricks', description: `Quick, actionable advice for ${niche} enthusiasts. Simple techniques that deliver big results.` },
    { name: 'Case Studies', slug: 'case-studies', description: `Real-world examples and success stories in ${niche}. Learn from others who have achieved their goals.` },
    { name: 'Tools & Resources', slug: 'tools-resources', description: `Curated collection of helpful ${niche} tools and resources. Everything you need to succeed in one place.` },
    { name: 'Expert Insights', slug: 'expert-insights', description: `Wisdom and perspectives from ${niche} professionals. Get insider knowledge from industry leaders.` },
    { name: 'Trending Topics', slug: 'trending-topics', description: `The latest developments and hot topics in ${niche}. Stay current with what matters most.` },
    { name: 'Community Favorites', slug: 'community-favorites', description: `Most popular and beloved ${niche} content as voted by our readers. Discover what resonates most.` },
    { name: 'Deep Dives', slug: 'deep-dives', description: `Comprehensive analysis and thorough exploration of ${niche} subjects. For those who want to know everything.` },
    { name: 'Quick Reads', slug: 'quick-reads', description: `Bite-sized ${niche} content for busy readers. Get valuable insights in just a few minutes.` },
    { name: 'Featured Content', slug: 'featured-content', description: `Handpicked ${niche} articles showcasing our best work. Editor's choice for quality and impact.` }
  ];

  return genericCategories.slice(0, count).map((cat, index) => ({
    rank: index + 1,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    keywords: [niche.toLowerCase(), cat.slug.split('-')[0], 'guide', 'tips', 'learn'],
    articleCount: 12
  }));
}

/**
 * STEP 4: Generate article titles for all categories
 * POST /api/website/generate-articles
 * Body: { siteCode }
 */
app.post('/api/website/generate-articles', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode } = req.body;

    if (!siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Site code is required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);
    const categoriesPath = join(sitePath, 'categories', 'categories.json');

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // Load categories
    const categoriesFileData = await fs.readFile(categoriesPath, 'utf-8');
    const categoriesData = JSON.parse(categoriesFileData);
    const categories = categoriesData.categories || [];

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No categories found. Please generate categories first.'
      });
    }

    // Load writers for assignment
    const writersPath = join(sitePath, 'writers', 'web_writers.json');
    let writers = [];
    try {
      const writersFileData = await fs.readFile(writersPath, 'utf-8');
      const writersData = JSON.parse(writersFileData);
      writers = writersData.writers || [];
    } catch (err) {
      console.log('   ⚠️  Could not load writers, will use default names');
    }

    const domain = config.domain;
    const contentType = config.contentType || 'OB';
    const niche = config.analysis?.niche || 'General';

    console.log(`\n📝 Generating article titles for: ${domain}`);
    console.log(`   Site Code: ${siteCode}`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Writers: ${writers.length}`);
    console.log(`   Content Type: ${contentType}`);

    // CHECK FOR EXISTING ARTICLES IN WEBSTORE
    // If /{category}/web_articles.json files already exist with data, use those
    const domainFolder = join(WEBSITES_PATH, domain);
    let existingArticles = [];
    let allCategoriesHaveArticles = true;

    for (const category of categories) {
      const articlesFilePath = join(domainFolder, category.slug, 'web_articles.json');
      try {
        const articlesFileData = await fs.readFile(articlesFilePath, 'utf-8');
        const articlesJson = JSON.parse(articlesFileData);
        if (articlesJson.articles && articlesJson.articles.length > 0) {
          // Map existing articles to the expected format
          articlesJson.articles.forEach((article, idx) => {
            existingArticles.push({
              number: existingArticles.length + 1,
              rank: article.rank || idx + 1,
              title: article.title,
              categoryName: category.name,
              categorySlug: category.slug,
              writerName: article.writerName || 'Staff Writer',
              writerFirstName: article.writerName ? article.writerName.split(' ')[0] : 'Staff',
              writerLastName: article.writerName ? article.writerName.split(' ')[1] || '' : 'Writer'
            });
          });
          console.log(`   ✅ Found ${articlesJson.articles.length} existing articles for ${category.name}`);
        } else {
          allCategoriesHaveArticles = false;
        }
      } catch (err) {
        // File doesn't exist or is invalid
        allCategoriesHaveArticles = false;
      }
    }

    // If we found existing articles for all categories, use them
    if (allCategoriesHaveArticles && existingArticles.length > 0) {
      console.log(`   ⏭️  Using existing articles (skipping API call)`);
      console.log(`   📚 Total existing articles: ${existingArticles.length}`);

      // Save to datastore for consistency
      const articlesFileData = {
        domain,
        siteCode,
        contentType,
        niche,
        totalArticles: existingArticles.length,
        generatedAt: new Date().toISOString(),
        source: 'cached',
        articles: existingArticles
      };

      await fs.writeFile(
        join(sitePath, 'articles', 'articles.json'),
        JSON.stringify(articlesFileData, null, 2),
        'utf-8'
      );

      // Update config
      config.totalArticles = existingArticles.length;
      config.status = 'step4_complete';
      config.articlesGeneratedAt = new Date().toISOString();
      config.articlesSource = 'cached';

      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Update registry
      const registry = await loadRegistry();
      const siteIndex = registry.sites.findIndex(s => s.siteCode === siteCode);
      if (siteIndex !== -1) {
        registry.sites[siteIndex].totalArticles = existingArticles.length;
        registry.sites[siteIndex].status = 'step4_complete';
        await saveRegistry(registry);
      }

      return res.json({
        success: true,
        siteCode,
        domain,
        totalArticles: existingArticles.length,
        articles: existingArticles,
        cached: true,
        message: 'Using existing articles from webstore (no API call needed)'
      });
    }

    // Generate 12 article titles for each category
    const allArticles = [];
    let articleNumber = 1;

    for (const category of categories) {
      console.log(`   🤖 Generating titles for category: ${category.name}...`);

      const articlePrompt = `Generate exactly 12 compelling article titles for the "${category.name}" category on a ${contentType === 'FB' ? 'faith-based' : contentType === 'BB' ? 'business' : niche.toLowerCase()} website.

Domain: ${domain}
Category: ${category.name}
Category Description: ${category.description}
Niche: ${niche}

REQUIREMENTS:
1. Generate exactly 12 unique, compelling article titles
2. Titles should be SEO-friendly and click-worthy
3. Titles should be specific to the category and niche
4. Mix of how-to guides, listicles, deep-dives, and informational articles
5. Each title should be 6-12 words, engaging but not clickbait
6. Rank from most compelling (#1) to least (#12)

Respond with ONLY this JSON format (no additional text):
{
  "articles": [
    { "rank": 1, "title": "Article Title Here" },
    { "rank": 2, "title": "Article Title Here" }
  ]
}`;

      const articlesText = await callOpenAI(articlePrompt, 0.8, 2000);

      try {
        const cleanJson = articlesText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const articlesData = JSON.parse(cleanJson);
        const categoryArticles = articlesData.articles || [];

        // Add each article with category info and global number
        categoryArticles.slice(0, 12).forEach((article, idx) => {
          // Assign writer using round-robin for even distribution
          const writerIndex = (articleNumber - 1) % (writers.length || 1);
          const writer = writers[writerIndex] || { name: `Writer ${writerIndex + 1}` };

          allArticles.push({
            number: articleNumber++,
            rank: article.rank || idx + 1,
            title: article.title || `Article ${idx + 1}`,
            categoryName: category.name,
            categorySlug: category.slug,
            writerName: writer.name,
            writerFirstName: writer.firstName || writer.name.split(' ')[0],
            writerLastName: writer.lastName || writer.name.split(' ')[1] || ''
          });
        });

        console.log(`   ✅ Generated ${Math.min(categoryArticles.length, 12)} titles for ${category.name}`);

      } catch (parseError) {
        console.error(`   ❌ Failed to parse articles for ${category.name}:`, parseError.message);
        // Generate fallback titles with writer assignment
        for (let i = 1; i <= 12; i++) {
          const writerIndex = (articleNumber - 1) % (writers.length || 1);
          const writer = writers[writerIndex] || { name: `Writer ${writerIndex + 1}` };

          allArticles.push({
            number: articleNumber++,
            rank: i,
            title: `${category.name} Guide ${i}: Essential Insights`,
            categoryName: category.name,
            categorySlug: category.slug,
            writerName: writer.name,
            writerFirstName: writer.firstName || writer.name.split(' ')[0],
            writerLastName: writer.lastName || writer.name.split(' ')[1] || ''
          });
        }
      }
    }

    console.log(`   ✅ Total articles generated: ${allArticles.length}`);

    // Save articles to file
    const articlesFileData = {
      domain,
      siteCode,
      contentType,
      niche,
      totalArticles: allArticles.length,
      generatedAt: new Date().toISOString(),
      articles: allArticles
    };

    await fs.writeFile(
      join(sitePath, 'articles', 'articles.json'),
      JSON.stringify(articlesFileData, null, 2),
      'utf-8'
    );

    // Update config
    config.totalArticles = allArticles.length;
    config.status = 'step4_complete';
    config.articlesGeneratedAt = new Date().toISOString();

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update registry
    const registry = await loadRegistry();
    const siteIndex = registry.sites.findIndex(s => s.siteCode === siteCode);
    if (siteIndex !== -1) {
      registry.sites[siteIndex].totalArticles = allArticles.length;
      registry.sites[siteIndex].status = 'step4_complete';
      await saveRegistry(registry);
    }

    res.json({
      success: true,
      siteCode,
      domain,
      totalArticles: allArticles.length,
      articles: allArticles,
      message: 'Article titles generated successfully'
    });

  } catch (error) {
    console.error('Article generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get site details by code
 */
app.get('/api/website/:siteCode', async (req, res) => {
  try {
    const { siteCode } = req.params;

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    res.json({
      success: true,
      site: config
    });

  } catch (error) {
    console.error('Error loading site:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate a 12-character alphanumeric ID
 */
function generateWriterId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * STEP 5: Generate website data and content
 * POST /api/website/generate-content
 * Body: { siteCode }
 *
 * This endpoint:
 * 1. Creates domain folder in .webstore/websites/{domain}
 * 2. Creates .webstore subfolder for JSON data files
 * 3. Creates category subfolders for articles
 * 4. Generates all JSON data files in .webstore subfolder
 */
app.post('/api/website/generate-content', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode } = req.body;

    if (!siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Site code is required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const domain = config.domain;

    // Load categories
    const categoriesPath = join(sitePath, 'categories', 'categories.json');
    const categoriesFileData = await fs.readFile(categoriesPath, 'utf-8');
    const categoriesData = JSON.parse(categoriesFileData);
    const categories = categoriesData.categories || [];

    // Load articles
    const articlesPath = join(sitePath, 'articles', 'articles.json');
    const articlesFileData = await fs.readFile(articlesPath, 'utf-8');
    const articlesData = JSON.parse(articlesFileData);
    const articles = articlesData.articles || [];

    // Load writers
    const writersPath = join(sitePath, 'writers', 'web_writers.json');
    const writersFileData = await fs.readFile(writersPath, 'utf-8');
    const writersData = JSON.parse(writersFileData);
    const writers = writersData.writers || [];

    console.log(`\n🏗️  Step 5: Generating website data for: ${domain}`);
    console.log(`   Site Code: ${siteCode}`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Articles: ${articles.length}`);
    console.log(`   Writers: ${writers.length}`);

    // 1. Create domain folder in .webstore/websites/{domain}
    const domainFolder = join(WEBSITES_PATH, domain);
    await fs.mkdir(domainFolder, { recursive: true });
    console.log(`   📁 Created domain folder: ${domain}`);

    // 1b. Copy .lumiatos advertising folder to new website
    await copyLumiatosToWebsite(domainFolder);

    // 1c. Create web_tracker.json for view tracking
    await createWebTracker(domainFolder, domain);

    // 2. Create .webstore subfolder for JSON data files
    const webstoreFolder = join(domainFolder, '.webstore');
    await fs.mkdir(webstoreFolder, { recursive: true });
    console.log(`   📁 Created .webstore data folder`);

    // 3. Create category subfolders for articles
    for (const category of categories) {
      const categoryFolder = join(domainFolder, category.slug);
      await fs.mkdir(categoryFolder, { recursive: true });
    }
    console.log(`   📁 Created ${categories.length} category folders`);

    // 4. Generate writer IDs and create web_writers.json in .webstore subfolder
    const writersWithIds = writers.map(writer => ({
      ...writer,
      id: generateWriterId()
    }));

    await fs.writeFile(
      join(webstoreFolder, 'web_writers.json'),
      JSON.stringify({
        domain,
        siteCode,
        totalWriters: writersWithIds.length,
        generatedAt: new Date().toISOString(),
        writers: writersWithIds
      }, null, 2),
      'utf-8'
    );
    console.log(`   ✍️  Created web_writers.json with ${writersWithIds.length} writers`);

    // Create writer lookup map
    const writerIdMap = {};
    writersWithIds.forEach(w => {
      writerIdMap[w.name] = w.id;
    });

    // 5. Generate web_categories.json in .webstore subfolder
    await fs.writeFile(
      join(webstoreFolder, 'web_categories.json'),
      JSON.stringify({
        domain,
        siteCode,
        totalCategories: categories.length,
        generatedAt: new Date().toISOString(),
        categories: categories.map(cat => ({
          ...cat,
          folderPath: `/${cat.slug}`
        }))
      }, null, 2),
      'utf-8'
    );
    console.log(`   📂 Created web_categories.json`);

    // 6. Generate web_sitemap.json in .webstore subfolder
    const sitemapEntries = [];

    // Add homepage
    sitemapEntries.push({
      url: '/',
      title: domain.replace('.com', '').replace('.org', '').replace('.net', ''),
      type: 'homepage',
      priority: 1.0
    });

    // Add category pages
    categories.forEach(cat => {
      sitemapEntries.push({
        url: `/${cat.slug}`,
        title: cat.name,
        type: 'category',
        priority: 0.8,
        articleCount: cat.articleCount
      });
    });

    // Add article pages
    articles.forEach(article => {
      const articleSlug = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60);

      sitemapEntries.push({
        url: `/${article.categorySlug}/${articleSlug}`,
        title: article.title,
        type: 'article',
        priority: 0.6,
        category: article.categoryName,
        categorySlug: article.categorySlug,
        writerId: writerIdMap[article.writerName] || null,
        writerName: article.writerName
      });
    });

    await fs.writeFile(
      join(webstoreFolder, 'web_sitemap.json'),
      JSON.stringify({
        domain,
        siteCode,
        totalPages: sitemapEntries.length,
        generatedAt: new Date().toISOString(),
        sitemap: sitemapEntries
      }, null, 2),
      'utf-8'
    );
    console.log(`   🗺️  Created web_sitemap.json with ${sitemapEntries.length} pages`);

    // 7. Generate web_theme.json in .webstore subfolder
    const contentType = config.contentType || 'OB';
    const themeColors = contentType === 'FB'
      ? { primary: '#4A5568', secondary: '#718096', accent: '#D69E2E' }
      : contentType === 'BB'
      ? { primary: '#2D3748', secondary: '#4A5568', accent: '#3182CE' }
      : { primary: '#1A202C', secondary: '#2D3748', accent: '#48BB78' };

    await fs.writeFile(
      join(webstoreFolder, 'web_theme.json'),
      JSON.stringify({
        domain,
        siteCode,
        contentType,
        generatedAt: new Date().toISOString(),
        theme: {
          colors: themeColors,
          fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
          },
          layout: 'modern'
        }
      }, null, 2),
      'utf-8'
    );
    console.log(`   🎨 Created web_theme.json`);

    // 8. Generate web_subscribers.json in .webstore subfolder (empty initial)
    await fs.writeFile(
      join(webstoreFolder, 'web_subscribers.json'),
      JSON.stringify({
        domain,
        siteCode,
        totalSubscribers: 0,
        generatedAt: new Date().toISOString(),
        subscribers: []
      }, null, 2),
      'utf-8'
    );
    console.log(`   📧 Created web_subscribers.json`);

    // 9. Generate web_tasks.json in .webstore subfolder (empty initial)
    await fs.writeFile(
      join(webstoreFolder, 'web_tasks.json'),
      JSON.stringify({
        domain,
        siteCode,
        totalTasks: 0,
        generatedAt: new Date().toISOString(),
        tasks: []
      }, null, 2),
      'utf-8'
    );
    console.log(`   📋 Created web_tasks.json`);

    // Return initial response - articles will be generated via streaming endpoint
    res.json({
      success: true,
      siteCode,
      domain,
      domainFolder: domain,
      categories: categories.length,
      articles: articles.length,
      writers: writersWithIds.length,
      message: 'Initial structure created. Ready for article generation.',
      writerIdMap
    });

  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STEP 5 (Part 2): Generate individual article content
 * POST /api/website/generate-article-content
 * Body: { siteCode, article, writerIdMap }
 */
app.post('/api/website/generate-article-content', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode, article, writerIdMap } = req.body;

    if (!siteCode || !article) {
      return res.status(400).json({
        success: false,
        error: 'Site code and article are required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const domain = config.domain;
    const contentType = config.contentType || 'OB';
    const niche = config.analysis?.niche || 'General';

    // Domain folder path - .webstore/websites/{domain}
    const domainFolder = join(WEBSITES_PATH, domain);
    const categoryFolder = join(domainFolder, article.categorySlug);

    // CHECK FOR EXISTING ARTICLE CONTENT
    // If web_articles.json already has this article with content, skip API call
    const existingArticlesPath = join(categoryFolder, 'web_articles.json');
    try {
      const existingData = await fs.readFile(existingArticlesPath, 'utf-8');
      const existingArticlesJson = JSON.parse(existingData);

      // Check if this article already exists with content
      const existingArticle = existingArticlesJson.articles?.find(a =>
        a.title === article.title && a.content && a.content.length > 50
      );

      if (existingArticle) {
        console.log(`   ⏭️  Article "${article.title}" already has content (skipping API call)`);
        return res.json({
          success: true,
          articleId: existingArticle.id,
          title: article.title,
          category: article.categoryName,
          keywords: existingArticle.keywords || [],
          cached: true,
          message: 'Using existing article content (no API call needed)'
        });
      }
    } catch (err) {
      // File doesn't exist yet, proceed with generation
    }

    // Generate article content using AI
    const articlePrompt = `Write a short, engaging article for the following topic. The article must be EXACTLY 100 words or less - this is a strict limit.

Title: ${article.title}
Category: ${article.categoryName}
Website Type: ${contentType === 'FB' ? 'Faith-Based' : contentType === 'BB' ? 'Business' : 'General'}
Niche: ${niche}

REQUIREMENTS:
1. Write exactly 100 words or less
2. Be engaging and captivating from the first sentence
3. Provide valuable insight or information
4. Match the tone appropriate for the website type
5. Do NOT include the title in your response

Also identify the top 3 SEO keywords for this article.

Respond with ONLY this JSON format:
{
  "content": "Your article content here (100 words max)...",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

    const articleResponse = await callOpenAI(articlePrompt, 0.7, 500);

    let articleContent = '';
    let keywords = [];

    try {
      const cleanJson = articleResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      articleContent = parsed.content || '';
      keywords = parsed.keywords || [];
    } catch (parseError) {
      // Fallback content
      articleContent = `Discover insights about ${article.title}. This article explores key concepts and provides valuable information for readers interested in ${article.categoryName}.`;
      keywords = [article.categorySlug, niche.toLowerCase(), 'guide'];
    }

    // Create article data object
    const articleData = {
      id: generateWriterId(),
      number: article.number,
      title: article.title,
      slug: article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60),
      content: articleContent,
      category: article.categoryName,
      categorySlug: article.categorySlug,
      domain,
      writerId: writerIdMap[article.writerName] || null,
      writerName: article.writerName,
      keywords,
      hitCount: 0,
      createdAt: new Date().toISOString()
    };

    // Read existing articles file or create new one
    const articlesFilePath = join(categoryFolder, 'web_articles.json');
    let existingArticles = { articles: [] };

    try {
      const existingData = await fs.readFile(articlesFilePath, 'utf-8');
      existingArticles = JSON.parse(existingData);
    } catch (err) {
      // File doesn't exist yet, use empty array
    }

    // Add new article
    existingArticles.articles.push(articleData);
    existingArticles.domain = domain;
    existingArticles.siteCode = siteCode;
    existingArticles.category = article.categoryName;
    existingArticles.categorySlug = article.categorySlug;
    existingArticles.totalArticles = existingArticles.articles.length;
    existingArticles.lastUpdated = new Date().toISOString();

    // Save updated articles file
    await fs.writeFile(articlesFilePath, JSON.stringify(existingArticles, null, 2), 'utf-8');

    res.json({
      success: true,
      articleId: articleData.id,
      title: article.title,
      category: article.categoryName,
      keywords
    });

  } catch (error) {
    console.error('Article content generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STEP 5 (Part 2b): Generate article image for first article in category
 * POST /api/website/generate-article-image
 * Body: { siteCode, article, isFirstInCategory, articleId }
 */
app.post('/api/website/generate-article-image', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode, article, isFirstInCategory, articleId } = req.body;

    console.log(`   🖼️  Image request received: articleId=${articleId}, isFirst=${isFirstInCategory}, category=${article?.categoryName}`);

    // Only generate images for the first article in each category
    if (!isFirstInCategory) {
      console.log(`   ⏭️  Skipping image (not first in category)`);
      return res.json({
        success: true,
        skipped: true,
        message: 'Image generation skipped (not first article in category)'
      });
    }

    if (!siteCode || !article || !articleId) {
      console.log(`   ❌ Missing required params: siteCode=${!!siteCode}, article=${!!article}, articleId=${!!articleId}`);
      return res.status(400).json({
        success: false,
        error: 'Site code, article, and articleId are required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const domain = config.domain;
    const contentType = config.contentType || 'OB';
    const niche = config.analysis?.niche || 'General';

    // Domain folder path
    const domainFolder = join(WEBSITES_PATH, domain);
    const imagesFolder = join(domainFolder, 'images');
    await fs.mkdir(imagesFolder, { recursive: true });

    // Use articleId for the image filename
    const imageFileName = `${articleId}.jpg`;
    const imagePath = join(imagesFolder, imageFileName);

    // Check if image already exists for this article
    try {
      await fs.access(imagePath);
      console.log(`   ⏭️  Image already exists for article: ${articleId}`);
      return res.json({
        success: true,
        cached: true,
        articleId: articleId,
        categorySlug: article.categorySlug,
        imagePath: `/websites/${domain}/images/${imageFileName}`,
        message: 'Using existing article image'
      });
    } catch (err) {
      // Image doesn't exist, proceed with generation
    }

    console.log(`   🖼️  Generating image for article: ${articleId} (${article.categoryName})`);

    // Generate image using DALL-E 3 API - LANDSCAPE orientation (1792x1024)
    const websiteType = contentType === 'FB' ? 'Faith-Based/Christian' : contentType === 'BB' ? 'Business/Professional' : 'General';
    const imagePrompt = `Create a professional, modern header image for a ${websiteType} website article category called "${article.categoryName}". The category focuses on ${niche}. The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style.`;

    let generatedImagePath = null;

    try {
      const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;

      if (openaiApiKey) {
        const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: imagePrompt,
            n: 1,
            size: '1792x1024',
            quality: 'standard'
          })
        });

        if (dalleResponse.ok) {
          const dalleData = await dalleResponse.json();
          if (dalleData.data && dalleData.data[0] && dalleData.data[0].url) {
            const imageResponse = await fetch(dalleData.data[0].url);
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            await fs.writeFile(imagePath, imageBuffer);
            generatedImagePath = `/websites/${domain}/images/${imageFileName}`;
            console.log(`   ✅ Article image saved: ${imageFileName}`);
          }
        } else {
          const errorBody = await dalleResponse.text();
          console.log(`   ⚠️  DALL-E 3 API error: ${dalleResponse.status} - ${errorBody}`);
        }
      } else {
        console.log(`   ⚠️  No OpenAI API key found, skipping image generation`);
      }
    } catch (imageError) {
      console.error(`   ❌ Image generation error:`, imageError.message);
    }

    res.json({
      success: true,
      imageGenerated: !!generatedImagePath,
      articleId: articleId,
      categorySlug: article.categorySlug,
      imagePath: generatedImagePath,
      message: generatedImagePath ? 'Article image generated successfully' : 'Image generation skipped (no API key or error)'
    });

  } catch (error) {
    console.error('Article image generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STEP 5 (Part 3): Finalize content generation
 * POST /api/website/finalize-content
 * Body: { siteCode }
 */
app.post('/api/website/finalize-content', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode } = req.body;

    if (!siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Site code is required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const domain = config.domain;

    // Domain folder path - .webstore/websites/{domain}
    const domainFolder = join(WEBSITES_PATH, domain);
    const webstoreFolder = join(domainFolder, '.webstore');

    // Load categories
    const categoriesPath = join(sitePath, 'categories', 'categories.json');
    const categoriesFileData = await fs.readFile(categoriesPath, 'utf-8');
    const categoriesData = JSON.parse(categoriesFileData);
    const categories = categoriesData.categories || [];

    // Load writers from .webstore subfolder
    const writersJsonPath = join(webstoreFolder, 'web_writers.json');
    const writersFileData = await fs.readFile(writersJsonPath, 'utf-8');
    const writersData = JSON.parse(writersFileData);
    const writers = writersData.writers || [];

    // Create web_config.json in .webstore subfolder
    await fs.writeFile(
      join(webstoreFolder, 'web_config.json'),
      JSON.stringify({
        domain,
        siteCode,
        contentType: config.contentType || 'OB',
        niche: config.analysis?.niche || 'General',
        categorySlugs: categories.map(c => c.slug),
        writerNames: writers.map(w => w.name),
        totalCategories: categories.length,
        totalArticles: config.totalArticles || 0,
        totalWriters: writers.length,
        lastUpdated: new Date().toISOString(),
        createdAt: config.createdAt,
        status: 'step5_complete'
      }, null, 2),
      'utf-8'
    );

    // Update main config
    config.status = 'step5_complete';
    config.contentGeneratedAt = new Date().toISOString();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update registry
    const registry = await loadRegistry();
    const siteIndex = registry.sites.findIndex(s => s.siteCode === siteCode);
    if (siteIndex !== -1) {
      registry.sites[siteIndex].status = 'step5_complete';
      registry.sites[siteIndex].contentGeneratedAt = new Date().toISOString();
      await saveRegistry(registry);
    }

    console.log(`   ✅ Step 5 complete for ${domain}`);

    res.json({
      success: true,
      siteCode,
      domain,
      message: 'Content generation complete'
    });

  } catch (error) {
    console.error('Finalize content error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STEP 6: Generate category image using Grok API
 * POST /api/website/generate-category-image
 * Body: { siteCode, category, categorySlug, description }
 */
app.post('/api/website/generate-category-image', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode, category, categorySlug, description } = req.body;

    if (!siteCode || !category || !categorySlug) {
      return res.status(400).json({
        success: false,
        error: 'Site code, category, and categorySlug are required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const domain = config.domain;

    console.log(`   🖼️  Generating image for category: ${category}`);

    // Domain folder path - .webstore/websites/{domain}
    const domainFolder = join(WEBSITES_PATH, domain);
    const imagesFolder = join(domainFolder, 'images');
    await fs.mkdir(imagesFolder, { recursive: true });

    // Generate image using DALL-E 3 API - LANDSCAPE orientation (1792x1024)
    const imagePrompt = `Create a professional, modern header image for a website category called "${category}". ${description ? `The category is about: ${description}` : ''} The image should be clean, minimal, and suitable for a news/blog website header banner. No text in the image.`;

    let imagePath = null;

    try {
      // Use DALL-E 3 for image generation with explicit landscape size
      const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;

      if (openaiApiKey) {
        const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: imagePrompt,
            n: 1,
            size: '1792x1024',
            quality: 'standard'
          })
        });

        if (dalleResponse.ok) {
          const dalleData = await dalleResponse.json();
          if (dalleData.data && dalleData.data[0] && dalleData.data[0].url) {
            const imageFileName = `${categorySlug}.jpg`;
            imagePath = join(imagesFolder, imageFileName);

            const imageResponse = await fetch(dalleData.data[0].url);
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            await fs.writeFile(imagePath, imageBuffer);
            console.log(`   ✅ Image saved: ${imageFileName}`);
          }
        } else {
          const errorBody = await dalleResponse.text();
          console.log(`   ⚠️  DALL-E 3 API error: ${dalleResponse.status} - ${errorBody}`);
        }
      } else {
        console.log(`   ⚠️  No OpenAI API key found, using placeholder`);
      }
    } catch (imageError) {
      console.error(`   ❌ Image generation error:`, imageError.message);
    }

    // Return the relative image path for the website
    const relativeImagePath = imagePath ? `/websites/${domain}/images/${categorySlug}.jpg` : null;

    res.json({
      success: true,
      category,
      categorySlug,
      imagePath: relativeImagePath,
      message: imagePath ? 'Image generated successfully' : 'Image generation skipped (no API key)'
    });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STEP 6 (Part 2): Build website HTML files
 * POST /api/website/build-website
 * Body: { siteCode }
 */
app.post('/api/website/build-website', requireBasicAuth, generationRateLimiter, async (req, res) => {
  try {
    const { siteCode } = req.body;

    if (!siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Site code is required'
      });
    }

    // Find site folder
    const folders = await fs.readdir(SITES_PATH);
    const siteFolder = folders.find(f => f.startsWith(siteCode));

    if (!siteFolder) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

    const sitePath = join(SITES_PATH, siteFolder);
    const configPath = join(sitePath, `${siteCode}.config.json`);

    // Load config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const domain = config.domain;
    const siteName = formatWebsiteTitle(domain);

    // Domain folder path - .webstore/websites/{domain}
    const domainFolder = join(WEBSITES_PATH, domain);
    const webstoreFolder = join(domainFolder, '.webstore');

    // Load categories
    const categoriesPath = join(webstoreFolder, 'web_categories.json');
    let categories = [];
    try {
      const categoriesData = await fs.readFile(categoriesPath, 'utf-8');
      const parsedCategories = JSON.parse(categoriesData);
      categories = parsedCategories.categories || [];
    } catch (err) {
      // Try loading from datastore
      const datastoreCategoriesPath = join(sitePath, 'categories', 'categories.json');
      const categoriesData = await fs.readFile(datastoreCategoriesPath, 'utf-8');
      const parsedCategories = JSON.parse(categoriesData);
      categories = parsedCategories.categories || [];
    }

    // Load articles for each category
    const allArticles = [];
    for (const category of categories) {
      const categoryArticlesPath = join(domainFolder, category.slug, 'web_articles.json');
      try {
        const articlesData = await fs.readFile(categoryArticlesPath, 'utf-8');
        const parsedArticles = JSON.parse(articlesData);
        allArticles.push(...(parsedArticles.articles || []));
      } catch (err) {
        console.log(`   ⚠️  No articles found for ${category.slug}`);
      }
    }

    console.log(`   🏗️  Building website for: ${domain}`);

    // Generate index.html with CNN-style design
    const indexHtml = generateCNNStyleWebsite(domain, siteName, categories, allArticles);

    // Save index.html
    await fs.writeFile(join(domainFolder, 'index.html'), indexHtml, 'utf-8');
    console.log(`   ✅ Created index.html`);

    // Generate More page (archive/sitemap page)
    try {
      const moreHtml = generateMorePage(domain, siteName, categories, allArticles);
      await fs.writeFile(join(domainFolder, 'more.html'), moreHtml, 'utf-8');
      console.log(`   ✅ Created more.html`);
    } catch (moreErr) {
      console.log(`   ⚠️  More page generation skipped: ${moreErr.message}`);
    }

    // Update config
    config.status = 'step6_complete';
    config.websiteBuiltAt = new Date().toISOString();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update registry
    const registry = await loadRegistry();
    const siteIndex = registry.sites.findIndex(s => s.siteCode === siteCode);
    if (siteIndex !== -1) {
      registry.sites[siteIndex].status = 'step6_complete';
      registry.sites[siteIndex].websiteBuiltAt = new Date().toISOString();
      await saveRegistry(registry);
    }

    res.json({
      success: true,
      siteCode,
      domain,
      websiteUrl: `/websites/${domain}/index.html`,
      message: 'Website built successfully'
    });

  } catch (error) {
    console.error('Website build error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate More Page HTML (Archive/Sitemap Page)
 * Business Rules:
 * - Displays all articles in a 4-column grid layout
 * - Articles organized by category with thumbnail images and titles
 * - More link appears in gray at top-right of content pages
 * - Page should be regenerated once daily for performance
 */
function generateMorePage(domain, siteName, categories, articles) {
  const currentYear = new Date().getFullYear();
  const generatedDate = new Date().toISOString().split('T')[0];

  // Group articles by category
  const articlesByCategory = {};
  categories.forEach(cat => {
    articlesByCategory[cat.slug] = articles.filter(a => a.categorySlug === cat.slug);
  });

  const totalArticles = articles.length;

  // Generate navigation links (use hash for single-page app navigation)
  const navLinksHtml = categories.map(cat =>
    `      <div class="nav-link">
        <a href="index.html#category/${cat.slug}">${cat.name}</a>
      </div>`
  ).join('\n');

  // Generate category sections with article grids
  const categorySectionsHtml = categories.map(cat => {
    const catArticles = articlesByCategory[cat.slug] || [];
    const articleCardsHtml = catArticles.map(article => `
        <article class="article-card">
          <a href="index.html#article/${article.categorySlug}/${article.id}">
            <img src="images/${article.id}.jpg" alt="${article.title.replace(/"/g, '&quot;')}" class="article-thumbnail" loading="lazy">
            <div class="article-info">
              <h3 class="article-title">${article.title}</h3>
            </div>
          </a>
        </article>`).join('');

    return `
    <section class="category-section">
      <div class="category-header">
        <h2 class="category-title">${cat.name}</h2>
        <span class="category-count">${catArticles.length} articles</span>
      </div>
      <div class="article-grid">
${articleCardsHtml}
      </div>
    </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>More Articles - ${siteName} | Complete Article Archive</title>
  <meta name="description" content="Browse all ${totalArticles} articles on ${siteName}. Explore our complete archive of faith-based content organized by category.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://${domain.toLowerCase()}/more">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Roboto+Condensed:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Roboto', sans-serif; background: #f5f5f5; color: #333; line-height: 1.5; }
    a { text-decoration: none; color: inherit; }
    .site-header { background: #ffd700; border-bottom: 3px solid #333; }
    .header-top { max-width: 1200px; margin: 0 auto; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .header-title { font-family: 'Roboto Condensed', sans-serif; font-size: 32px; font-weight: 700; color: #000; }
    .header-title a { color: inherit; }
    .more-link { color: #666; font-size: 14px; font-weight: 500; }
    .more-link.active { color: #333; font-weight: 600; }
    .nav-row-wrapper { width: 100%; background: #000; }
    .nav-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: stretch; }
    .nav-link { flex: 1; display: flex; justify-content: center; align-items: center; }
    .nav-link a { padding: 14px 20px; font-size: 14px; font-weight: 600; color: #fff; text-transform: uppercase; border-bottom: 3px solid transparent; transition: all 0.2s; }
    .nav-link a:hover { background: rgba(255,255,255,0.1); border-bottom-color: #ffd700; }
    .home-icon { display: inline-flex; width: 16px; height: 16px; margin-right: 4px; }
    .home-icon svg { width: 16px; height: 16px; fill: #fff; }
    .main-content { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
    .page-header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #ddd; }
    .page-title { font-family: 'Roboto Condensed', sans-serif; font-size: 36px; font-weight: 700; margin-bottom: 10px; }
    .page-subtitle { font-size: 16px; color: #666; }
    .category-section { margin-bottom: 40px; }
    .category-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #ffd700; }
    .category-title { font-family: 'Roboto Condensed', sans-serif; font-size: 24px; font-weight: 700; }
    .category-count { background: #ffd700; color: #333; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 600; }
    .article-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; }
    .article-card { background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; }
    .article-card:hover { transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
    .article-thumbnail { width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block; }
    .article-info { padding: 15px; }
    .article-title { font-size: 14px; font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .article-card a:hover .article-title { color: #0066cc; }
    .site-footer { background: #1a1a1a; color: #ccc; padding: 30px 20px; margin-top: 50px; text-align: center; }
    .footer-text { font-size: 14px; margin-bottom: 10px; }
    .footer-generated { font-size: 12px; color: #888; }
    @media (max-width: 1024px) { .article-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px) { .article-grid { grid-template-columns: repeat(2, 1fr); } .header-title { font-size: 24px; } .nav-link a { padding: 10px 12px; font-size: 12px; } }
    @media (max-width: 480px) { .article-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-top">
      <h1 class="header-title"><a href="index.html">${siteName.toUpperCase()}</a></h1>
      <a href="more.html" class="more-link active">More</a>
    </div>
  </header>
  <nav class="nav-row-wrapper">
    <div class="nav-container">
      <div class="nav-link">
        <a href="index.html"><span class="home-icon"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></span>Home</a>
      </div>
${navLinksHtml}
    </div>
  </nav>
  <main class="main-content">
    <header class="page-header">
      <h1 class="page-title">All Articles</h1>
      <p class="page-subtitle">Browse our complete archive of ${totalArticles} faith-based articles. Find inspiration, guidance, and biblical wisdom for your spiritual journey.</p>
    </header>
${categorySectionsHtml}
  </main>
  <footer class="site-footer">
    <p class="footer-text">&copy; ${currentYear} ${siteName}. All rights reserved.</p>
    <p class="footer-generated">Page generated: ${generatedDate}</p>
  </footer>
</body>
</html>`;
}

/**
 * Generate Dynamic Website HTML (GodsGrace.com Template)
 * Business Rules:
 * - No duplicate article IDs within a single portal page (per category)
 * - Strip markdown formatting (* and #) from displayed content
 * - Page reads data from .webstore/history/{YY}-{MMDD}.json
 * - SVG home icon in navigation
 * - 6-column CSS Grid navigation
 */
function generateCNNStyleWebsite(domain, siteName, categories, articles) {
  const currentYear = new Date().getFullYear();

  // Get featured articles
  const featuredArticles = articles.slice(0, 12);

  // Group articles by category
  const articlesByCategory = {};
  categories.forEach(cat => {
    articlesByCategory[cat.slug] = articles.filter(a => a.categorySlug === cat.slug);
  });

  // Get most popular (use first articles from each category)
  const mostPopular = [];
  categories.forEach(cat => {
    const catArticles = articlesByCategory[cat.slug] || [];
    if (catArticles.length > 0) {
      mostPopular.push(...catArticles.slice(0, 3));
    }
  });

  // First hero slides - one from each category (first 3 categories)
  const heroSlides = categories.slice(0, 3).map(cat => {
    const catArticles = articlesByCategory[cat.slug] || [];
    return catArticles[0] || null;
  }).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName} - Home</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Roboto+Condensed:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.5;
    }

    a {
      text-decoration: none;
      color: inherit;
    }

    /* Header */
    .site-header {
      background: #ffd700;
      border-bottom: 3px solid #333;
    }

    .header-top {
      max-width: 1200px;
      margin: 0 auto;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-brand {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .header-subtitle {
      font-size: 11px;
      font-weight: 500;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .header-title {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 32px;
      font-weight: 700;
      color: #000;
      letter-spacing: -1px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: white;
      border: 1px solid #ccc;
      border-radius: 3px;
      padding: 5px 10px;
    }

    .search-box input {
      border: none;
      outline: none;
      font-size: 13px;
      width: 150px;
    }

    .more-link {
      color: #666;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 15px;
      transition: color 0.2s;
    }

    .more-link:hover {
      color: #333;
    }

    .btn-tip {
      background: #cc0000;
      color: white;
      padding: 8px 15px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 3px;
      text-transform: uppercase;
    }

    /* Navigation Row */
    .nav-row-wrapper {
      width: 100%;
      background: #000;
    }

    .nav-container {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      justify-content: stretch;
      align-items: stretch;
      padding: 0;
    }

    .nav-link {
      flex: 1 1 20%;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    .home-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      margin-right: 4px;
      vertical-align: middle;
    }

    .home-icon svg {
      width: 16px;
      height: 16px;
      fill: #fff;
    }

    .nav-link a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      padding: 14px 20px;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
    }

    .nav-link a:hover,
    .nav-link.active a {
      background: rgba(255,255,255,0.1);
      border-bottom-color: #ffd700;
    }

    .nav-link.nav-spacer {
      /* Spacer divs for future use */
    }

    /* Article Links Row */
    .article-row-wrapper {
      width: 100%;
      background: #1a1a1a;
      border-top: 1px solid #333;
    }

    .article-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
    }

    .article-link {
      flex: 1;
      text-align: center;
      border-right: 1px solid #333;
    }

    .article-link:last-child {
      border-right: none;
    }

    .article-link a {
      display: block;
      padding: 10px 15px;
      font-size: 12px;
      color: #ccc;
      transition: all 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .article-link a:hover {
      background: rgba(255,255,255,0.05);
      color: #ffd700;
    }

    .article-link .article-category {
      color: #ffd700;
      font-weight: 600;
    }

    /* Header Table Container */
    .header-table-wrapper {
      width: 100%;
      background: #ffd700;
    }

    .header-table {
      width: 1200px;
      margin: 0 auto;
      border-collapse: collapse;
      background: #ffd700;
    }

    .header-table td {
      padding: 0;
    }

    .header-row td {
      padding: 2px 20px;
      border-bottom: 3px solid #333;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-subscribe {
      background: #cc0000;
      color: white;
      padding: 8px 15px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 3px;
      text-transform: uppercase;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }

    .btn-subscribe:hover {
      background: #a00000;
    }

    /* Subscribe Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal-content {
      background: #000;
      border: 3px solid #ffd700;
      border-radius: 12px;
      max-width: 450px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      overflow: hidden;
    }

    .modal-header {
      padding: 25px 25px 15px;
      display: flex;
      align-items: flex-start;
      gap: 15px;
    }

    .modal-icon {
      font-size: 38px;
      line-height: 1;
      flex-shrink: 0;
    }

    .modal-title-wrap {
      flex: 1;
    }

    .modal-header h2 {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 26px;
      color: #ffd700;
      margin: 0 0 5px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #ffd700;
    }

    .modal-subtitle {
      color: #ccc;
      font-size: 16px;
      margin-top: 10px;
      line-height: 1.5;
    }

    .modal-body {
      padding: 0 25px 25px;
    }

    .subscribe-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .subscribe-form input[type="text"],
    .subscribe-form input[type="email"] {
      padding: 12px 15px;
      border: 1px solid #444;
      border-radius: 6px;
      font-size: 16px;
      outline: none;
      background: #1a1a1a;
      color: #fff;
    }

    .subscribe-form input:focus {
      border-color: #ffd700;
    }

    .modal-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    .btn-cancel {
      background: transparent;
      color: #999;
      padding: 10px 20px;
      border: 1px solid #444;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-cancel:hover {
      background: #222;
      color: #fff;
    }

    .btn-submit {
      background: #ffd700;
      color: #000;
      padding: 10px 25px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-submit:hover {
      background: #e6c200;
    }

    .btn-submit:disabled {
      background: #666;
      cursor: not-allowed;
    }

    .thank-you-view {
      display: none;
      text-align: center;
      padding: 20px 0;
    }

    .thank-you-view.active {
      display: block;
    }

    .thank-you-view .thank-icon {
      font-size: 50px;
      margin-bottom: 15px;
    }

    .thank-you-view h3 {
      color: #ffd700;
      font-size: 24px;
      margin-bottom: 10px;
    }

    .thank-you-view p {
      color: #ccc;
      font-size: 16px;
      margin-bottom: 20px;
    }

    .thank-you-view .btn-ok {
      background: #ffd700;
      color: #000;
      padding: 10px 40px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }

    .subscribe-form-view {
      display: block;
    }

    .subscribe-form-view.hidden {
      display: none;
    }

    .subscribe-error {
      color: #ff6b6b;
      font-size: 15px;
      text-align: center;
      margin-top: 10px;
      display: none;
    }

    .subscribe-error.active {
      display: block;
    }

    /* Hidden class */
    .hidden {
      display: none !important;
    }

    /* Article Detail Page */
    .article-page {
      max-width: 1200px;
      margin: 20px auto 0;
      padding: 0 20px 0;
      background: #fff;
      color: #222;
    }

    .article-breadcrumbs {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #c00;
      margin-bottom: 10px;
    }

    .article-title {
      font-size: 34px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 8px;
    }

    .article-meta {
      display: flex;
      gap: 10px;
      align-items: center;
      font-size: 14px;
      color: #666;
      margin-bottom: 15px;
    }

    .article-meta strong {
      color: #c00;
      font-weight: 700;
    }

    .article-hero {
      width: 100%;
      max-width: 1200px;
      border: 1px solid #eee;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .article-hero img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }

    .article-layout {
      display: grid;
      grid-template-columns: 3fr 1.1fr;
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
      margin-bottom: 0;
      padding-bottom: 0;
      align-items: start;
    }

    .article-content-column {
      display: flex;
      flex-direction: column;
    }

    .article-body {
      font-size: 17px;
      line-height: 1.7;
      color: #333;
      text-align: justify;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .article-body p {
      margin-bottom: 15px;
      text-align: justify;
    }

    .article-body p:last-child {
      margin-bottom: 0;
    }

    /* Content column wrapper - matches the width of the content column in article-layout */
    .content-column-wrapper {
      width: calc((3 / 4.1) * (100% - 24px));
      max-width: 860px;
    }

    .article-caption {
      font-size: 14px;
      color: #666;
      margin-top: -6px;
      margin-bottom: 18px;
    }

    .article-ad {
      background: linear-gradient(135deg, #ffce4f 0%, #ff9d00 100%);
      color: #000;
      border-radius: 6px;
      padding: 18px;
      text-align: center;
      font-weight: 700;
      font-size: 18px;
      margin: 18px 0;
    }

    .article-sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sidebar-card {
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 12px;
      background: #fafafa;
    }

    .sidebar-card h4 {
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #c00;
      margin-bottom: 8px;
    }

    .sidebar-list {
      display: grid;
      gap: 10px;
    }

    .sidebar-list a {
      font-size: 15px;
      color: #333;
      font-weight: 600;
      line-height: 1.3;
    }

    .sidebar-list a:hover {
      color: #c00;
      text-decoration: underline;
    }

    .back-link {
      display: inline-block;
      margin: 10px 0 20px;
      font-size: 14px;
      text-transform: uppercase;
      color: #c00;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .read-next {
      margin-top: 20px;
      width: 100%;
    }

    /* Read Next Banner */
    .read-next-banner {
      margin: 25px 0 0 0;
      text-align: left;
      width: 100%;
    }

    .read-next-banner img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    .read-next-banner .ad-label {
      font-size: 10px;
      color: #999;
      margin-top: 2px;
    }

    /* Content Column Divider */
    .content-column-divider {
      width: 100%;
      height: 6px;
      background-color: #000;
      margin: 25px 0;
    }

    /* Featured & Spotlight Section */
    .featured-spotlight-section {
      background: #fff;
      width: calc((3 / 4.1) * (1200px - 24px));
      max-width: 860px;
      margin: 0;
      padding: 30px 0;
    }

    .featured-spotlight-grid {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 30px;
    }

    .featured-column-header,
    .spotlight-column-header {
      font-size: 12px;
      font-weight: 700;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }

    .featured-column .featured-item {
      margin-bottom: 25px;
      padding-bottom: 25px;
      border-bottom: 1px solid #eee;
    }

    .featured-column .featured-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .featured-item-image {
      width: 100%;
      aspect-ratio: 16/10;
      object-fit: cover;
      display: block;
      margin-bottom: 12px;
    }

    .featured-item-title {
      font-size: 18px;
      font-weight: 700;
      color: #222;
      line-height: 1.3;
      margin-bottom: 8px;
    }

    .featured-item-title a {
      color: inherit;
      text-decoration: none;
    }

    .featured-item-title a:hover {
      color: #c00;
    }

    .featured-item-excerpt {
      font-size: 14px;
      color: #666;
      line-height: 1.5;
    }

    .spotlight-column .spotlight-main {
      margin-bottom: 20px;
    }

    .spotlight-main-image {
      width: 100%;
      aspect-ratio: 16/9;
      object-fit: cover;
      display: block;
      margin-bottom: 12px;
    }

    .spotlight-main-title {
      font-size: 22px;
      font-weight: 700;
      color: #222;
      line-height: 1.3;
      margin-bottom: 8px;
    }

    .spotlight-main-title a {
      color: inherit;
      text-decoration: none;
    }

    .spotlight-main-title a:hover {
      color: #c00;
    }

    .spotlight-main-excerpt {
      font-size: 15px;
      color: #666;
      line-height: 1.5;
    }

    .spotlight-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .spotlight-item {
      display: flex;
      gap: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }

    .spotlight-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .spotlight-item-image {
      width: 120px;
      height: 80px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .spotlight-item-content {
      flex: 1;
      min-width: 0;
    }

    .spotlight-item-title {
      font-size: 15px;
      font-weight: 700;
      color: #222;
      line-height: 1.3;
      margin-bottom: 6px;
    }

    .spotlight-item-title a {
      color: inherit;
      text-decoration: none;
    }

    .spotlight-item-title a:hover {
      color: #c00;
    }

    .spotlight-item-excerpt {
      font-size: 13px;
      color: #666;
      line-height: 1.4;
    }

    @media (max-width: 992px) {
      .featured-spotlight-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Portal Page Styles */
    .portal-page {
      /* Portal pages now use same structure as home page */
    }

    .portal-page.hidden {
      display: none;
    }

    .portal-container {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 30px;
    }

    .portal-main {
      min-width: 0;
    }

    .portal-header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #ffd700;
    }

    .portal-title {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 36px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 10px;
    }

    .portal-description {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
    }

    .portal-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 25px;
    }

    .portal-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .portal-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    }

    .portal-card-image {
      height: 180px;
      background-size: cover;
      background-position: center;
    }

    .portal-card-content {
      padding: 15px;
    }

    .portal-card-content h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .portal-card-content p {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
    }

    .portal-sidebar {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .portal-ad-unit {
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s;
      width: 300px;
    }

    .portal-ad-unit:hover {
      transform: scale(1.02);
    }

    .portal-ad-unit a {
      display: block;
      width: 300px;
    }

    .portal-ad-unit img {
      width: 300px;
      height: auto;
      display: block;
      border-radius: 8px;
    }

    .portal-ad-label {
      font-size: 10px;
      color: #888;
      text-align: center;
      padding: 2px 0 0 0;
      margin: 0;
      background: transparent;
    }

    /* Home page ad unit */
    .home-ad-unit {
      border-radius: 8px;
      overflow: visible;
      cursor: pointer;
      transition: transform 0.2s;
      width: 300px;
      margin-bottom: 0;
    }

    .home-ad-unit:hover {
      transform: scale(1.02);
    }

    .home-ad-unit a {
      display: block;
      width: 300px;
    }

    .home-ad-unit img {
      width: 300px;
      height: auto;
      display: block;
      border-radius: 8px;
    }

    .home-ad-label {
      font-size: 10px;
      color: #888;
      text-align: center;
      padding: 2px 0 0 0;
      margin: 0;
      background: transparent;
    }

    /* Random Article Feature */
    .random-article {
      background: #fff;
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 20px;
    }

    .random-article-header {
      background: #000;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 10px 15px;
      letter-spacing: 1px;
    }

    .random-article-image {
      display: block;
      width: 100%;
      height: 180px;
      overflow: hidden;
    }

    .random-article-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }

    .random-article-image:hover img {
      transform: scale(1.05);
    }

    .random-article-content {
      padding: 15px;
    }

    .random-article-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 10px;
    }

    .random-article-title a {
      color: #000;
      text-decoration: none;
    }

    .random-article-title a:hover {
      color: #cc0000;
    }

    .random-article-excerpt {
      font-size: 14px;
      color: #666;
      line-height: 1.5;
    }

    /* Skyscraper ad unit (300x600) */
    .skyscraper-ad-unit {
      border-radius: 8px;
      overflow: visible;
      cursor: pointer;
      transition: transform 0.2s;
      width: 300px;
    }

    .skyscraper-ad-unit:hover {
      transform: scale(1.02);
    }

    .skyscraper-ad-unit a {
      display: block;
      width: 300px;
    }

    .skyscraper-ad-unit img {
      width: 300px;
      height: auto;
      display: block;
      border-radius: 8px;
    }

    .skyscraper-ad-label {
      font-size: 10px;
      color: #888;
      text-align: center;
      padding: 2px 0 0 0;
      margin: 0;
      background: transparent;
    }

    .portal-back-home {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }

    .portal-back-home h4 {
      color: #ffd700;
      font-size: 18px;
      margin-bottom: 10px;
    }

    .portal-back-home p {
      color: #ccc;
      font-size: 14px;
      margin-bottom: 15px;
    }

    .portal-back-home a {
      display: inline-block;
      background: #ffd700;
      color: #000;
      padding: 10px 20px;
      border-radius: 4px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s;
    }

    .portal-back-home a:hover {
      background: #ffed4a;
    }

    @media (max-width: 900px) {
      .portal-container {
        grid-template-columns: 1fr;
      }

      .portal-sidebar {
        order: -1;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
      }

      .portal-ad-unit {
        max-width: 300px;
      }

      .portal-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Breaking News */
    .breaking-news {
      background: #ffd700;
      padding: 12px 0;
      border-bottom: 2px solid #cc0000;
    }

    .breaking-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .breaking-label {
      background: #cc0000;
      color: white;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .breaking-badge {
      background: white;
      color: #cc0000;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 700;
    }

    .breaking-text {
      font-size: 14px;
      font-weight: 500;
      color: #000;
    }

    /* Ticker Bar */
    .ticker-bar {
      background: #ffd700;
      padding: 8px 0;
      border-bottom: 1px solid #e0c000;
      overflow: hidden;
    }

    .ticker-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      gap: 30px;
    }

    .ticker-item {
      font-size: 12px;
      color: #333;
      white-space: nowrap;
    }

    .ticker-item strong {
      color: #cc0000;
    }

    /* Main Content */
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 25px;
    }

    /* Hero Section */
    .hero-section {
      position: relative;
      margin-bottom: 25px;
    }

    .hero-image {
      width: 100%;
      height: 450px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      overflow: hidden;
    }

    .hero-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0,0,0,0.9));
      padding: 80px 25px 25px;
      color: white;
    }

    .hero-title {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 10px;
    }

    .hero-title a {
      color: white;
    }

    .hero-title a:hover {
      text-decoration: underline;
    }

    .hero-nav {
      position: absolute;
      right: 15px;
      bottom: 15px;
      display: flex;
      gap: 8px;
    }

    .hero-nav-btn {
      width: 35px;
      height: 35px;
      background: rgba(255,255,255,0.2);
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-nav-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    /* Sidebar */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .sidebar-section {
      background: white;
      border: 2px solid #000000;
      border-radius: 8px;
      overflow: hidden;
    }

    .sidebar-header {
      background: #000000;
      color: #ffd700;
      padding: 12px 15px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .sidebar-content {
      padding: 0 15px 15px 15px;
    }

    .promo-box {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      color: white;
    }

    .promo-title {
      font-size: 18px;
      font-weight: 700;
      color: #ffd700;
      margin-bottom: 5px;
    }

    .promo-subtitle {
      font-size: 12px;
      color: #aaa;
      margin-bottom: 15px;
    }

    .promo-btn {
      display: inline-block;
      background: #ffd700;
      color: #000;
      padding: 10px 20px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 3px;
      text-transform: uppercase;
    }

    /* Most Popular */
    .popular-item {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }

    .popular-item:last-child {
      border-bottom: none;
    }

    .popular-image {
      width: 80px;
      height: 60px;
      background: #ddd;
      flex-shrink: 0;
      overflow: hidden;
    }

    .popular-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .popular-content {
      flex: 1;
    }

    .popular-title {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.3;
      color: #333;
    }

    .popular-title:hover {
      color: #cc0000;
    }

    /* Featured & Spotlight Two-Column Layout */
    .section-row {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 30px;
      margin-bottom: 25px;
    }

    .section-block {
      background: white;
    }

    .section-header {
      font-size: 17px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      padding-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 15px;
    }

    .section-content {
      padding: 0;
    }

    /* Featured Column - Stacked Cards */
    .featured-card {
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }

    .featured-card:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .featured-card-image {
      display: block;
      width: 100%;
      height: 180px;
      background: #ddd;
      margin-bottom: 8px;
      overflow: hidden;
      border-radius: 8px;
    }

    .featured-card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }

    .featured-card-title {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 5px;
      color: #000;
    }

    .featured-card-title a {
      color: #000;
    }

    .featured-card-title a:hover {
      color: #cc0000;
    }

    .featured-card-excerpt {
      font-size: 15px;
      color: #666;
      line-height: 1.5;
    }

    /* Spotlight Column */
    .spotlight-main {
      margin-bottom: 20px;
    }

    .spotlight-main-image {
      display: block;
      width: 100%;
      height: 264px;
      background: #ddd;
      margin-bottom: 12px;
      overflow: hidden;
      border-radius: 8px;
    }

    .spotlight-main-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }

    .spotlight-main-title {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 10px;
      color: #000;
    }

    .spotlight-main-title a {
      color: #000;
    }

    .spotlight-main-title a:hover {
      color: #cc0000;
    }

    .spotlight-main-excerpt {
      font-size: 16px;
      color: #666;
      line-height: 1.5;
    }

    /* Spotlight List Items */
    .spotlight-list-item {
      display: flex;
      gap: 12px;
      padding: 15px 0;
      border-bottom: 1px solid #eee;
    }

    .spotlight-list-item:first-child {
      padding-top: 0;
    }

    .spotlight-list-item:last-child {
      border-bottom: none;
    }

    .spotlight-list-image {
      width: 100px;
      height: 70px;
      background: #ddd;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 6px;
    }

    .spotlight-list-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 6px;
    }

    .spotlight-list-content {
      flex: 1;
    }

    .spotlight-list-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 5px;
      color: #000;
    }

    .spotlight-list-title a {
      color: #000;
    }

    .spotlight-list-title a:hover {
      color: #cc0000;
    }

    .spotlight-list-excerpt {
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    }

    /* Related Information Section */
    .related-info-header {
      font-size: 17px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      padding: 15px 0 10px 0;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 15px;
    }

    .related-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .related-info-card {
      display: flex;
      flex-direction: column;
    }

    .related-info-image {
      width: 100%;
      height: 100px;
      background: #ddd;
      margin-bottom: 8px;
      overflow: hidden;
      border-radius: 6px;
    }

    .related-info-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 6px;
    }

    .related-info-title {
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    }

    .related-info-title a {
      color: #333;
      text-decoration: none;
    }

    .related-info-title a:hover {
      color: #cc0000;
      text-decoration: underline;
    }

    /* Recommended Section */
    .recommended-section {
      background: white;
      margin-bottom: 25px;
    }

    .recommended-header {
      font-size: 17px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      padding: 15px 0 10px 0;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 0;
    }

    .recommended-list {
      display: flex;
      flex-direction: column;
    }

    .recommended-item {
      display: flex;
      gap: 12px;
      padding: 15px 0;
      border-bottom: 1px solid #eee;
    }

    .recommended-item:last-child {
      border-bottom: none;
    }

    .recommended-image {
      width: 80px;
      height: 60px;
      background: #ddd;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 6px;
    }

    .recommended-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 6px;
    }

    .recommended-content {
      flex: 1;
    }

    .recommended-title {
      font-size: 16px;
      font-weight: 700;
      color: #000;
      margin-bottom: 5px;
      line-height: 1.3;
    }

    .recommended-title a {
      color: #000;
    }

    .recommended-title a:hover {
      text-decoration: underline;
    }

    .recommended-excerpt {
      font-size: 16px;
      color: #666;
      line-height: 1.4;
    }

    /* Category Row */
    .category-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }

    .category-col {
      background: white;
      border: 1px solid #e0e0e0;
    }

    .category-header {
      background: #cc0000;
      color: white;
      padding: 10px 15px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .category-content {
      padding: 15px;
    }

    .category-image {
      height: 120px;
      background: #ddd;
      margin-bottom: 12px;
      overflow: hidden;
    }

    .category-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .category-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 8px;
    }

    .category-title a:hover {
      color: #cc0000;
    }

    .category-excerpt {
      font-size: 12px;
      color: #666;
      line-height: 1.4;
    }

    /* Featured Categories Section */
    .featured-categories-section {
      background: #fff;
      padding: 30px 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .featured-categories-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 25px;
    }

    .featured-category-card {
      display: flex;
      flex-direction: column;
    }

    .featured-category-header {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #000;
    }

    .featured-category-image {
      width: 100%;
      height: 160px;
      object-fit: cover;
      margin-bottom: 12px;
    }

    .featured-category-title {
      font-size: 16px;
      font-weight: 700;
      color: #000;
      line-height: 1.3;
      margin-bottom: 10px;
    }

    .featured-category-title a {
      color: #000;
      text-decoration: none;
    }

    .featured-category-title a:hover {
      text-decoration: underline;
    }

    .featured-category-excerpt {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
    }

    .featured-category-more-links {
      margin-top: 15px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
    }

    .featured-category-more-links .more-link {
      display: block;
      font-size: 13px;
      color: #333;
      line-height: 1.5;
      margin-bottom: 10px;
      text-decoration: none;
    }

    .featured-category-more-links .more-link:hover {
      color: #c00;
      text-decoration: underline;
    }

    .featured-category-more-links .more-link:last-child {
      margin-bottom: 0;
    }

    /* More From Our Brands Section */
    .more-from-brands-section {
      background: #fff;
      padding: 30px 20px;
      max-width: 1200px;
      margin: 0 auto;
      border-top: 1px solid #e0e0e0;
    }

    .more-from-brands-header {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 20px;
    }

    .more-from-brands-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 20px;
    }

    .brand-card {
      display: flex;
      flex-direction: column;
    }

    .brand-card-image {
      width: 100%;
      height: 120px;
      object-fit: cover;
      margin-bottom: 10px;
    }

    .brand-card-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      margin-bottom: 6px;
    }

    .brand-card-title {
      font-size: 14px;
      font-weight: 700;
      color: #000;
      line-height: 1.3;
    }

    .brand-card-title a {
      color: #000;
      text-decoration: none;
    }

    .brand-card-title a:hover {
      text-decoration: underline;
    }

    /* Footer */
    .site-footer {
      background: #1a1a1a;
      color: white;
      margin-top: 40px;
    }

    .footer-top {
      background: #ffd700;
      padding: 15px 0;
    }

    .footer-brands {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      justify-content: center;
      gap: 30px;
    }

    .footer-brand-item {
      font-size: 14px;
      font-weight: 700;
      color: #333;
    }

    .footer-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: 2fr repeat(3, 1fr);
      gap: 40px;
      margin-bottom: 30px;
    }

    .footer-about h3 {
      font-size: 24px;
      font-weight: 700;
      color: #ffd700;
      margin-bottom: 15px;
    }

    .footer-about p {
      font-size: 13px;
      color: #999;
      line-height: 1.6;
    }

    .footer-col h4 {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      color: #ffd700;
      margin-bottom: 15px;
    }

    .footer-col ul {
      list-style: none;
    }

    .footer-col li {
      margin-bottom: 8px;
    }

    .footer-col a {
      font-size: 13px;
      color: #999;
      transition: color 0.2s;
    }

    .footer-col a:hover {
      color: white;
    }

    .footer-bottom {
      border-top: 1px solid #333;
      padding-top: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 10px;
    }

    .footer-links a {
      color: #999;
    }

    .footer-links a:hover {
      color: white;
    }

    /* Ad Banners */
    .ad-banner {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      color: white;
      margin-bottom: 15px;
    }

    .ad-banner-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 5px;
    }

    .ad-banner-text {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 10px;
    }

    .ad-banner-btn {
      display: inline-block;
      background: white;
      color: #ee5a24;
      padding: 8px 15px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 3px;
      text-transform: uppercase;
    }

    /* Related Info Box */
    .info-box {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      padding: 15px;
      margin-top: 15px;
    }

    .info-box-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 10px;
    }

    .info-box-content {
      font-size: 13px;
      color: #333;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .content-grid {
        grid-template-columns: 1fr;
      }

      .sidebar {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }

      .category-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .header-top {
        flex-direction: column;
        gap: 10px;
        text-align: center;
      }

      .header-actions {
        display: none;
      }

      .nav-menu {
        flex-wrap: wrap;
        justify-content: center;
      }

      .section-row {
        grid-template-columns: 1fr;
      }

      .sidebar {
        grid-template-columns: 1fr;
      }

      .category-row {
        grid-template-columns: 1fr;
      }

      .footer-grid {
        grid-template-columns: 1fr;
      }

      .recommended-grid {
        grid-template-columns: 1fr;
      }

      .featured-categories-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .more-from-brands-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 576px) {
      .featured-categories-grid {
        grid-template-columns: 1fr;
      }

      .more-from-brands-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <!-- Header Table (fixed width matching page content) -->
  <div class="header-table-wrapper">
    <table class="header-table">
      <tr class="header-row">
        <td>
          <div class="header-content">
            <div class="header-brand">
              <h1 class="header-title"><a href="#" id="siteHomeLink" onclick="showHomePage(); return false;">${siteName.toUpperCase()}</a></h1>
            </div>
            <div class="header-actions">
              <div class="search-box">
                <input type="text" placeholder="Search...">
                <span>🔍</span>
              </div>
              <button class="btn-subscribe" id="subscribe-btn">Subscribe Now!</button>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Navigation Row (Dynamically generated based on number of categories) -->
  <div class="nav-row-wrapper">
    <div class="nav-container" id="nav-container">
      <!-- Category links generated by JavaScript based on siteCategories array -->
    </div>
  </div>

  <!-- Article Links Row (Always 3 random articles) -->
  <div class="article-row-wrapper">
    <div class="article-container" id="article-links-container">
      ${featuredArticles.slice(0, 3).map(article => `<div class="article-link"><a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;"><span class="article-category">${article.category}:</span> ${article.title}</a></div>`).join('')}
    </div>
  </div>

  <!-- Main Content -->
  <div id="homePage">
  <main class="main-content">
    <div class="content-grid">
      <div class="main-column">
        <!-- Hero Section -->
        <section class="hero-section">
          <div class="hero-image" onclick="showContentPage('${featuredArticles[0]?.id || ''}', '${featuredArticles[0]?.categorySlug || ''}');" style="cursor: pointer;">
            ${featuredArticles[0] ? `<img src="images/${featuredArticles[0].id || featuredArticles[0].categorySlug}.jpg" alt="${featuredArticles[0].title}" onerror="this.parentElement.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'">` : ''}
            <div class="hero-overlay">
              <h2 class="hero-title">
                <a href="#" onclick="showContentPage('${featuredArticles[0]?.id || ''}', '${featuredArticles[0]?.categorySlug || ''}'); return false;">${featuredArticles[0]?.title || 'Welcome to ' + siteName}</a>
              </h2>
            </div>
            <div class="hero-nav">
              <button class="hero-nav-btn">‹</button>
              <button class="hero-nav-btn">›</button>
            </div>
          </div>
        </section>

        <!-- Featured & Spotlight - New Layout -->
        <div class="section-row">
          <!-- FEATURED Column (Left) - Stacked Cards -->
          <div class="section-block">
            <div class="section-header">Featured</div>
            <div class="section-content">
              ${featuredArticles.slice(3, 11).map(article => `
              <div class="featured-card">
                <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="featured-card-image">
                  <img src="images/${article.id || article.categorySlug}.jpg" alt="${article.title}" onerror="this.parentElement.style.background='#ddd'">
                </a>
                <h3 class="featured-card-title"><a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;">${article.title}</a></h3>
                <p class="featured-card-excerpt">${(article.content || 'Discover insights and expert analysis on this topic.').substring(0, 120)}...</p>
              </div>
              `).join('')}
            </div>
          </div>

          <!-- IN THE SPOTLIGHT Column (Right) -->
          <div class="section-block">
            <div class="section-header">In The Spotlight</div>
            <div class="section-content">
              <!-- Main Spotlight Article -->
              ${featuredArticles[0] ? `
              <div class="spotlight-main">
                <a href="#" onclick="showContentPage('${featuredArticles[0].id}', '${featuredArticles[0].categorySlug}'); return false;" class="spotlight-main-image">
                  <img src="images/${featuredArticles[0].id || featuredArticles[0].categorySlug}.jpg" alt="${featuredArticles[0].title}" onerror="this.parentElement.style.background='#ddd'">
                </a>
                <h3 class="spotlight-main-title"><a href="#" onclick="showContentPage('${featuredArticles[0].id}', '${featuredArticles[0].categorySlug}'); return false;">${featuredArticles[0].title}</a></h3>
                <p class="spotlight-main-excerpt">${(featuredArticles[0].content || 'Explore the latest developments and trends.').substring(0, 150)}...</p>
              </div>
              ` : ''}

              <!-- Spotlight List Items -->
              ${featuredArticles.slice(1, 3).map(article => `
              <div class="spotlight-list-item">
                <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="spotlight-list-image">
                  <img src="images/${article.id || article.categorySlug}.jpg" alt="${article.title}" onerror="this.parentElement.style.background='#ddd'">
                </a>
                <div class="spotlight-list-content">
                  <h4 class="spotlight-list-title"><a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;">${article.title}</a></h4>
                  <p class="spotlight-list-excerpt">${(article.content || 'Expert insights and analysis.').substring(0, 80)}...</p>
                </div>
              </div>
              `).join('')}

              <!-- Related Information Section -->
              <div class="related-info-header">Related Information</div>
              <div class="related-info-grid">
                ${featuredArticles.slice(11, 15).map(article => `
                <div class="related-info-card">
                  <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="related-info-image">
                    <img src="images/${article.id || article.categorySlug}.jpg" alt="${article.title}" onerror="this.parentElement.style.background='#ddd'">
                  </a>
                  <h4 class="related-info-title"><a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;">${article.title}</a></h4>
                </div>
                `).join('')}
              </div>

              <!-- Recommended Section -->
              <div class="section-header" style="margin-top: 20px;">Recommended</div>
              <div class="recommended-list">
                ${featuredArticles.slice(15, 25).map(article => `
                <div class="recommended-item">
                  <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="recommended-image">
                    <img src="images/${article.id || article.categorySlug}.jpg" alt="${article.title}" onerror="this.parentElement.style.background='#ddd'">
                  </a>
                  <div class="recommended-content">
                    <h4 class="recommended-title"><a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;">${article.title}</a></h4>
                    <p class="recommended-excerpt">${(article.content || 'Read more about this important topic.').substring(0, 100)}...</p>
                  </div>
                </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- Promo Box -->
        <div class="promo-box">
          <div class="promo-title">${siteName}</div>
          <div class="promo-subtitle">that's Transforming Businesses.</div>
          <a href="#" class="promo-btn">See Now</a>
        </div>

        <!-- Most Popular -->
        <div class="sidebar-section">
          <div class="sidebar-header">MOST POPULAR</div>
          <div class="sidebar-content">${mostPopular.slice(0, 7).map(article => `<div class="popular-item">
              <div class="popular-image">
                <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;">
                  <img src="images/${article.id || article.categorySlug}.jpg" alt="${article.title}" onerror="this.parentElement.style.background='#ddd'">
                </a>
              </div>
              <div class="popular-content">
                <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="popular-title">${article.title.substring(0, 60)}${article.title.length > 60 ? '...' : ''}</a>
              </div>
            </div>
            `).join('')}
          </div>
        </div>

        <!-- 300x600 Skyscraper Ad -->
        <div class="skyscraper-ad-unit">
          <a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-B" target="_blank" rel="noopener" onclick="handleAdClick('AD-003-B', 'CAMP-003', this.href);">
            <img src=".lumiatos/images/jubileeverse-300x600.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence">
          </a>
          <div class="skyscraper-ad-label">Advertisement</div>
        </div>

        <!-- Must Read -->
        <div class="sidebar-section">
          <div class="sidebar-header">Must Read</div>
          <div class="sidebar-content">
            ${featuredArticles.slice(25, 32).map(article => `
            <div class="popular-item">
              <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="popular-image">
                <img src="images/${article.id}.jpg" alt="${article.title}" onerror="this.parentElement.style.background='#ddd'">
              </a>
              <div class="popular-content">
                <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="popular-title">${article.title}</a>
              </div>
            </div>
            `).join('')}
          </div>
        </div>

        <!-- Ad Unit - JubileeVerse 300x250 (below Must Read) -->
        <div class="home-ad-unit">
          <a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-A" target="_blank" rel="noopener" onclick="handleAdClick('AD-003-A', 'CAMP-003', this.href);">
            <img src=".lumiatos/images/jubileeverse-300x250.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence: Smarter Today, Stronger Tomorrow">
          </a>
          <div class="home-ad-label">Advertisement</div>
        </div>

        <!-- Random Article Feature -->
        ${featuredArticles.length > 0 ? (() => {
          const ra = featuredArticles[Math.floor(Math.random() * featuredArticles.length)] || featuredArticles[0];
          const ex = (ra.content || '').split(' ').slice(0, 15).join(' ');
          return '<div class="random-article">' +
            '<div class="random-article-header">You Might Like</div>' +
            '<a href="#" onclick="showContentPage(\'' + ra.id + '\', \'' + ra.categorySlug + '\'); return false;" class="random-article-image">' +
            '<img src="images/' + ra.id + '.jpg" alt="' + ra.title + '" onerror="this.parentElement.style.background=\'#ddd\'">' +
            '</a>' +
            '<div class="random-article-content">' +
            '<h4 class="random-article-title">' +
            '<a href="#" onclick="showContentPage(\'' + ra.id + '\', \'' + ra.categorySlug + '\'); return false;">' + ra.title + '</a>' +
            '</h4>' +
            '<p class="random-article-excerpt">' + ex + '...</p>' +
            '</div>' +
            '</div>';
        })() : ''}
      </aside>
    </div>

  </main>
  </div>

  <!-- Article Detail Page -->
  <section id="articlePage" class="article-page hidden">
    <a href="#" class="back-link" id="backToHome" onclick="showHomePage(); return false;">‹ Back to Home</a>
    <div class="article-breadcrumbs" id="articleBreadcrumbs">Home | Feature Story</div>
    <h1 class="article-title" id="articleTitle">Feature Story</h1>
    <div class="article-meta">
      <strong id="articleCategory">Category</strong>
      <span id="articleAuthor">By Editorial</span>
      <span id="articleDate">Updated today</span>
    </div>
    <div class="article-hero">
      <img id="articleHero" src="images/placeholder.jpg" alt="Article hero">
    </div>
    <div class="article-caption" id="articleCaption">Article caption here.</div>

    <div class="article-layout">
      <div class="article-content-column">
        <div class="article-body" id="articleBody">
          <p>Loading article content...</p>
        </div>

        <!-- READ NEXT section will be added by JavaScript -->
        <div class="read-next" id="readNextSection" style="display: none;">
          <h4>Read Next</h4>
          <div class="read-next-list" id="readNextList"></div>
        </div>

        <!-- 870x250 Banner -->
        <div class="read-next-banner">
          <a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-D&utm_placement=read-next" target="_blank" rel="noopener" onclick="handleAdClick('AD-003-D', 'CAMP-003', this.href);">
            <img src=".lumiatos/images/jubileeverse-870x250.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence">
          </a>
          <div class="ad-label">Advertisement</div>
        </div>

        <!-- Content Column Divider -->
        <div class="content-column-divider"></div>
      </div>

      <aside class="article-sidebar">
        <!-- 300x600 Skyscraper Ad -->
        <div class="skyscraper-ad-unit">
          <a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-B" target="_blank" rel="noopener" onclick="handleAdClick('AD-003-B', 'CAMP-003', this.href);">
            <img src=".lumiatos/images/jubileeverse-300x600.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence">
          </a>
          <div class="skyscraper-ad-label">Advertisement</div>
        </div>

        <!-- MOST POPULAR Section -->
        <div class="sidebar-section">
          <div class="sidebar-header">MOST POPULAR</div>
          <div class="sidebar-content" id="articleSidebarPopular" style="padding-top: 0;">
            ${mostPopular.slice(0, 7).map(article => `
            <div class="popular-item">
              <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="popular-image">
                <img src="images/${article.id}.jpg" alt="${article.title}" onerror="this.parentElement.style.background='#ddd'">
              </a>
              <div class="popular-content">
                <a href="#" onclick="showContentPage('${article.id}', '${article.categorySlug}'); return false;" class="popular-title">${article.title}</a>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <!-- 300x250 Ad Unit -->
        <div class="ad-unit-300x250" style="margin: 12px 0 8px 0;">
          <a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-A" target="_blank" rel="noopener" onclick="handleAdClick('AD-003-A', 'CAMP-003', this.href);">
            <img src=".lumiatos/images/jubileeverse-300x250.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence" style="width: 100%; height: auto; display: block;">
          </a>
          <div class="ad-label" style="font-size: 10px; color: #999; text-align: center; margin-top: 4px;">Advertisement</div>
        </div>

        <!-- YOU MIGHT LIKE Section -->
        ${featuredArticles.length > 0 ? (() => {
          const ra = featuredArticles[Math.floor(Math.random() * featuredArticles.length)] || featuredArticles[0];
          const ex = (ra.content || '').split(' ').slice(0, 15).join(' ');
          return '<div class="random-article" id="articleYouMightLike" style="margin-top: 8px;">' +
            '<div class="random-article-header">You Might Like</div>' +
            '<a href="#" onclick="showContentPage(\'' + ra.id + '\', \'' + ra.categorySlug + '\'); return false;" class="random-article-image">' +
            '<img src="images/' + ra.id + '.jpg" alt="' + ra.title + '" onerror="this.parentElement.style.background=\'#ddd\'">' +
            '</a>' +
            '<div class="random-article-content">' +
            '<h4 class="random-article-title">' +
            '<a href="#" onclick="showContentPage(\'' + ra.id + '\', \'' + ra.categorySlug + '\'); return false;">' + ra.title + '</a>' +
            '</h4>' +
            '<p class="random-article-excerpt">' + ex + '...</p>' +
            '</div>' +
            '</div>';
        })() : ''}

        <!-- MUST READ Section -->
        ${featuredArticles.length > 0 ? (() => {
          const mustReadArticles = featuredArticles.slice(0, 7);
          return '<div class="sidebar-section" style="margin-top: 15px;">' +
            '<div class="sidebar-header">Must Read</div>' +
            '<div class="sidebar-content" id="articleMustRead">' +
            mustReadArticles.map(art =>
              '<div class="popular-item">' +
              '<a href="#" onclick="showContentPage(\'' + art.id + '\', \'' + art.categorySlug + '\'); return false;" class="popular-image">' +
              '<img src="images/' + art.id + '.jpg" alt="' + art.title + '" onerror="this.parentElement.style.background=\'#ddd\'">' +
              '</a>' +
              '<div class="popular-content">' +
              '<a href="#" onclick="showContentPage(\'' + art.id + '\', \'' + art.categorySlug + '\'); return false;" class="popular-title">' + art.title + '</a>' +
              '</div>' +
              '</div>'
            ).join('') +
            '</div>' +
            '</div>';
        })() : ''}

        <!-- YOU MIGHT LIKE Section (Bottom) -->
        ${featuredArticles.length > 7 ? (() => {
          const ra2 = featuredArticles[7] || featuredArticles[0];
          const ex2 = (ra2.content || '').split(' ').slice(0, 15).join(' ');
          return '<div class="random-article" id="articleYouMightLike2" style="margin-top: 15px;">' +
            '<div class="random-article-header">You Might Like</div>' +
            '<a href="#" onclick="showContentPage(\'' + ra2.id + '\', \'' + ra2.categorySlug + '\'); return false;" class="random-article-image">' +
            '<img src="images/' + ra2.id + '.jpg" alt="' + ra2.title + '" onerror="this.parentElement.style.background=\'#ddd\'">' +
            '</a>' +
            '<div class="random-article-content">' +
            '<h4 class="random-article-title">' +
            '<a href="#" onclick="showContentPage(\'' + ra2.id + '\', \'' + ra2.categorySlug + '\'); return false;">' + ra2.title + '</a>' +
            '</h4>' +
            '<p class="random-article-excerpt">' + ex2 + '...</p>' +
            '</div>' +
            '</div>';
        })() : ''}
      </aside>
    </div>

    <!-- Featured & Spotlight Section -->
    <div class="featured-spotlight-section" id="featured-spotlight-section">
      <div class="featured-spotlight-grid">
        <!-- FEATURED Column -->
        <div class="featured-column">
          <div class="featured-column-header">Featured</div>
          ${featuredArticles.slice(0, 4).map(art => `
          <div class="featured-item">
            <a href="#" onclick="showContentPage('${art.id}', '${art.categorySlug}'); return false;">
              <img src="images/${art.id}.jpg" alt="${art.title}" class="featured-item-image" onerror="this.style.background='#ddd'">
            </a>
            <h3 class="featured-item-title">
              <a href="#" onclick="showContentPage('${art.id}', '${art.categorySlug}'); return false;">${art.title}</a>
            </h3>
            <p class="featured-item-excerpt">${(art.content || '').split(' ').slice(0, 20).join(' ')}...</p>
          </div>`).join('')}
        </div>

        <!-- IN THE SPOTLIGHT Column -->
        <div class="spotlight-column">
          <div class="spotlight-column-header">In The Spotlight</div>
          ${featuredArticles.length > 4 ? `
          <div class="spotlight-main">
            <a href="#" onclick="showContentPage('${featuredArticles[4].id}', '${featuredArticles[4].categorySlug}'); return false;">
              <img src="images/${featuredArticles[4].id}.jpg" alt="${featuredArticles[4].title}" class="spotlight-main-image" onerror="this.style.background='#ddd'">
            </a>
            <h3 class="spotlight-main-title">
              <a href="#" onclick="showContentPage('${featuredArticles[4].id}', '${featuredArticles[4].categorySlug}'); return false;">${featuredArticles[4].title}</a>
            </h3>
            <p class="spotlight-main-excerpt">${(featuredArticles[4].content || '').split(' ').slice(0, 25).join(' ')}...</p>
          </div>` : ''}
          <div class="spotlight-list">
            ${featuredArticles.slice(5, 14).map(art => `
            <div class="spotlight-item">
              <a href="#" onclick="showContentPage('${art.id}', '${art.categorySlug}'); return false;">
                <img src="images/${art.id}.jpg" alt="${art.title}" class="spotlight-item-image" onerror="this.style.background='#ddd'">
              </a>
              <div class="spotlight-item-content">
                <h4 class="spotlight-item-title">
                  <a href="#" onclick="showContentPage('${art.id}', '${art.categorySlug}'); return false;">${art.title}</a>
                </h4>
                <p class="spotlight-item-excerpt">${(art.content || '').split(' ').slice(0, 15).join(' ')}...</p>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Subscribe Modal -->
  <div class="modal-overlay" id="subscribe-modal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-icon">✉️</span>
        <div class="modal-title-wrap">
          <h2>Stay Connected</h2>
          <p class="modal-subtitle">Get the latest updates from ${siteName} delivered to your inbox.</p>
        </div>
      </div>
      <div class="modal-body">
        <div id="form-view" class="subscribe-form-view">
          <form id="subscribe-form" class="subscribe-form">
            <input type="text" id="subscribe-name" placeholder="Your Full Name" required>
            <input type="email" id="subscribe-email" placeholder="Your Email Address" required>
            <div class="modal-buttons">
              <button type="button" class="btn-cancel" id="btn-cancel">Cancel</button>
              <button type="submit" class="btn-submit" id="subscribe-submit">Subscribe</button>
            </div>
          </form>
          <div id="subscribe-error" class="subscribe-error"></div>
        </div>
        <div id="thank-you-view" class="thank-you-view">
          <div class="thank-icon">🎉</div>
          <h3>Thank You!</h3>
          <p>You've been subscribed to ${siteName}.</p>
          <button class="btn-ok" id="btn-ok">OK</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Featured Categories Section -->
  <section class="featured-categories-section" id="featured-categories-section">
    <div class="featured-categories-grid" id="featured-categories-grid">
      <!-- Dynamically populated by JavaScript -->
    </div>
  </section>

  <!-- More From Our Brands Section -->
  <section class="more-from-brands-section" id="more-from-brands-section">
    <div class="more-from-brands-header">MORE FROM OUR BRANDS</div>
    <div class="more-from-brands-grid" id="more-from-brands-grid">
      <!-- Dynamically populated by JavaScript -->
    </div>
  </section>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brands">
        ${categories.slice(0, 5).map(cat => `<span class="footer-brand-item">${cat.name}</span>`).join('')}
      </div>
    </div>
    <div class="footer-main">
      <div class="footer-grid">
        <div class="footer-about">
          <h3>${siteName}</h3>
          <p>${siteName} is your trusted source for quality content, expert insights, and the latest updates. Our team of dedicated writers brings you comprehensive coverage across multiple categories.</p>
        </div>
        <div class="footer-col">
          <h4>Categories</h4>
          <ul id="footer-categories-list">
            ${categories.slice(0, 5).map(cat => `<li><a href="#" onclick="openPortal('${cat.slug}'); return false;">${cat.name}</a></li>`).join('\n            ')}
          </ul>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="#">About Us</a></li>
            <li><a href="#">Contact</a></li>
            <li><a href="#">Advertise</a></li>
            <li><a href="#">Careers</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Use</a></li>
            <li><a href="#">Cookie Policy</a></li>
            <li><a href="#">Sitemap</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-links" id="footer-category-links">
          ${categories.slice(0, 6).map(cat => `<a href="#" onclick="openPortal('${cat.slug}'); return false;">${cat.name}</a>`).join(' | ')}
        </div>
        <p>Copyright © ${currentYear} ${siteName}. All Rights Reserved. | <a href="#">Sitemap</a> | <a href="#">Terms of Use</a> | <a href="#">Privacy Policy</a></p>
        <p style="margin-top: 5px;">Powered by <a href="https://jubileeverse.com" style="color: #ffd700;">JubileeVerse.com</a></p>
      </div>
    </div>
  </footer>

  <!-- JavaScript -->
  <script>
    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * stripMarkdown - Remove markdown formatting from content for display
     * Business Rule: Strip markdown (* and #) from displayed content in frontend
     */
    function stripMarkdown(text) {
      if (!text) return '';
      return text
        .replace(/#{1,6}\\s*/g, '')
        .replace(/\\*\\*([^*]+)\\*\\*/g, '$1')
        .replace(/\\*([^*]+)\\*/g, '$1')
        .replace(/^[\\s]*[-*+][\\s]+/gm, '')
        .replace(/^>\\s*/gm, '')
        .replace(/\`([^\`]+)\`/g, '$1')
        .replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1')
        .trim();
    }

    /**
     * truncateText - Truncate text to specified length with ellipsis
     */
    function truncateText(text, maxLength) {
      if (!text) return '';
      const stripped = stripMarkdown(text);
      if (stripped.length <= maxLength) return stripped;
      return stripped.substring(0, maxLength).trim() + '...';
    }

    // ========================================================================
    // GLOBAL STATE
    // ========================================================================

    let siteData = null;
    let currentMode = 'home';
    let currentCategory = null;
    let currentArticle = null;
    let heroSlideIndex = 0;
    let heroInterval = null;
    let portalPageCache = {}; // Cache for rendered portal pages

    // ========================================================================
    // DATA LOADING
    // ========================================================================

    async function loadSiteData() {
      try {
        const today = new Date();
        const yy = today.getFullYear().toString().slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const historyFile = yy + '-' + mm + dd + '.json';

        const response = await fetch('.webstore/history/' + historyFile);
        if (!response.ok) {
          throw new Error('History file not found: ' + historyFile);
        }
        siteData = await response.json();
        console.log('Loaded site data:', siteData);

        buildNavigation();
        renderHomePage();
        startHeroCarousel();
        updateFooterCategories();

      } catch (error) {
        console.error('Error loading site data:', error);
        document.getElementById('homePage').innerHTML = '<div style="padding: 40px; text-align: center;"><h2>Loading...</h2><p>Site data is being prepared.</p></div>';
      }
    }

    // ========================================================================
    // FOOTER CATEGORIES
    // ========================================================================

    /**
     * updateFooterCategories - Dynamically update footer category links from loaded site data
     */
    function updateFooterCategories() {
      if (!siteData || !siteData.categories || siteData.categories.length === 0) return;

      // Update footer categories column
      const footerCategoriesList = document.getElementById('footer-categories-list');
      if (footerCategoriesList) {
        footerCategoriesList.innerHTML = siteData.categories.map(cat =>
          '<li><a href="#" onclick="openPortal(\\'' + cat.slug + '\\'); return false;">' + cat.name + '</a></li>'
        ).join('');
      }

      // Update footer bottom category links
      const footerCategoryLinks = document.getElementById('footer-category-links');
      if (footerCategoryLinks) {
        footerCategoryLinks.innerHTML = siteData.categories.map(cat =>
          '<a href="#" onclick="openPortal(\\'' + cat.slug + '\\'); return false;">' + cat.name + '</a>'
        ).join(' | ');
      }
    }

    // ========================================================================
    // NAVIGATION
    // ========================================================================

    /**
     * buildNavigation - Build the 6-column navigation with SVG home icon
     * Business Rule: Add SVG home icon to navigation in generated HTML
     */
    function buildNavigation() {
      if (!siteData || !siteData.categories) return;

      const navContainer = document.getElementById('nav-container');
      if (!navContainer) return;

      // SVG Home Icon
      const homeSvg = '<svg class="home-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

      let navHtml = '<a href="#" class="nav-link" onclick="goHome(); return false;">' + homeSvg + '</a>';

      siteData.categories.slice(0, 5).forEach(cat => {
        navHtml += '<a href="#' + cat.slug + '" class="nav-link" onclick="openPortal(\\'' + cat.slug + '\\'); return false;">' + cat.name + '</a>';
      });

      navContainer.innerHTML = navHtml;

      // Article links row
      const articleLinksContainer = document.getElementById('article-links-container');
      if (articleLinksContainer && siteData.allArticles) {
        let linksHtml = '';
        const shuffled = [...siteData.allArticles].sort(() => Math.random() - 0.5);
        shuffled.slice(0, 10).forEach(article => {
          linksHtml += '<a href="#" class="article-quick-link" onclick="openArticle(\\'' + article.categorySlug + '\\', \\'' + article.articleId + '\\'); return false;">' + truncateText(article.title, 40) + '</a>';
        });
        articleLinksContainer.innerHTML = linksHtml;
      }
    }

    // ========================================================================
    // HOME PAGE RENDERING
    // ========================================================================

    function goHome() {
      currentMode = 'home';
      currentCategory = null;
      currentArticle = null;
      document.getElementById('homePage').style.display = 'block';
      document.getElementById('portalPage').style.display = 'none';
      document.getElementById('articleDetailPage').style.display = 'none';
      window.scrollTo(0, 0);
    }

    function renderHomePage() {
      // Home page content is rendered server-side, just ensure it's visible
      document.getElementById('homePage').style.display = 'block';
      document.getElementById('portalPage').style.display = 'none';
      document.getElementById('articleDetailPage').style.display = 'none';
    }

    // ========================================================================
    // HERO CAROUSEL
    // ========================================================================

    function startHeroCarousel() {
      if (!siteData || !siteData.heroCarousel || siteData.heroCarousel.length <= 1) return;

      heroInterval = setInterval(() => {
        heroSlideIndex = (heroSlideIndex + 1) % siteData.heroCarousel.length;
        updateHeroSlide();
      }, 5000);
    }

    function updateHeroSlide() {
      const slides = document.querySelectorAll('.hero-slide');
      const indicators = document.querySelectorAll('.hero-indicator');

      slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === heroSlideIndex);
      });

      indicators.forEach((indicator, index) => {
        indicator.classList.toggle('active', index === heroSlideIndex);
      });
    }

    function goToSlide(index) {
      heroSlideIndex = index;
      updateHeroSlide();
      if (heroInterval) {
        clearInterval(heroInterval);
        startHeroCarousel();
      }
    }

    // ========================================================================
    // PORTAL MODE (Category Page)
    // ========================================================================

    /**
     * openPortal - Open a category portal page
     * Business Rule: No duplicate article IDs within a single portal page
     */
    async function openPortal(categorySlug) {
      currentMode = 'portal';
      currentCategory = categorySlug;

      document.getElementById('homePage').style.display = 'none';
      document.getElementById('articleDetailPage').style.display = 'none';

      // Check if we have a cached portal page
      if (portalPageCache[categorySlug]) {
        const portalPage = document.getElementById('portalPage');
        portalPage.innerHTML = portalPageCache[categorySlug];
        portalPage.style.display = 'block';
        window.scrollTo(0, 0);
        return;
      }

      const portalPage = document.getElementById('portalPage');
      portalPage.style.display = 'block';
      portalPage.innerHTML = '<div style="padding: 40px; text-align: center;">Loading...</div>';

      try {
        // Get portal data
        const portalData = siteData.portalPages ? siteData.portalPages[categorySlug] : null;

        if (!portalData) {
          throw new Error('Portal not found');
        }

        // Business Rule: Deduplicate articles by ID
        const seenIds = new Set();
        const uniqueArticles = portalData.articles.filter(article => {
          if (seenIds.has(article.articleId)) return false;
          seenIds.add(article.articleId);
          return true;
        });

        // Load ad data for sidebar
        let adHtml = '';
        try {
          const adResponse = await fetch('.lumiatos/lighthouse.json');
          if (adResponse.ok) {
            const adData = await adResponse.json();
            const defaultAdId = adData.defaultAds['300x250'];
            if (defaultAdId) {
              // Find the ad in campaigns
              for (const campId in adData.campaigns) {
                const campaign = adData.campaigns[campId];
                if (campaign.ads && campaign.ads[defaultAdId]) {
                  const ad = campaign.ads[defaultAdId];
                  adHtml = '<div class="portal-ad-unit" onclick="handleAdClick(\\'' + ad.id + '\\', \\'' + campId + '\\', \\'' + ad.creative.clickUrl + '\\')">';
                  adHtml += '<img src=".lumiatos/' + ad.creative.imageUrl + '" alt="' + ad.creative.altText + '">';
                  adHtml += '<div class="portal-ad-label">Advertisement</div>';
                  adHtml += '</div>';
                  // Track ad impression
                  if (window.ViewTracker) {
                    window.ViewTracker.trackAdView(ad.id, campId, 'portal-sidebar', 'portal', categorySlug);
                  }
                  break;
                }
              }
            }
          }
        } catch (adError) {
          console.log('Ad loading skipped:', adError.message);
        }

        // Build portal HTML with new Featured/Spotlight layout (matching home page)
        let html = '<main class="main-content">';
        html += '<div class="content-grid">';
        html += '<div class="main-column">';

        // Hero Carousel for portal
        if (uniqueArticles.length > 0) {
          const heroArticle = uniqueArticles[0];
          html += '<section class="hero-section">';
          html += '<div class="hero-image">';
          html += '<img src="' + (heroArticle.image || 'images/' + heroArticle.articleId + '.jpg') + '" alt="' + heroArticle.title + '" onerror="this.parentElement.style.background=\\'linear-gradient(135deg, #667eea 0%, #764ba2 100%)\\';">';
          html += '<div class="hero-overlay">';
          html += '<h2 class="hero-title"><a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + heroArticle.articleId + '\\'); return false;">' + heroArticle.title + '</a></h2>';
          html += '</div>';
          html += '</div>';
          html += '</section>';
        }

        // Featured & Spotlight - New Layout
        html += '<div class="section-row">';

        // FEATURED Column (Left) - Stacked Cards
        html += '<div class="section-block">';
        html += '<div class="section-header">Featured</div>';
        html += '<div class="section-content">';
        uniqueArticles.slice(3, 11).forEach(article => {
          html += '<div class="featured-card">';
          html += '<a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;" class="featured-card-image">';
          html += '<img src="' + (article.image || 'images/' + article.articleId + '.jpg') + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\\'#ddd\\'">';
          html += '</a>';
          html += '<h3 class="featured-card-title"><a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;">' + article.title + '</a></h3>';
          html += '<p class="featured-card-excerpt">' + truncateText(article.excerpt || '', 120) + '</p>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';

        // IN THE SPOTLIGHT Column (Right)
        // Article distribution (avoiding duplicates except Recommended):
        // - Hero: article 0
        // - Featured (left): articles 3-10 (8 articles)
        // - Spotlight main: article 11 (or fallback to 0 if not enough)
        // - Spotlight list: articles 12-13 (or fallback)
        // - Related info: articles 14-17 (or fallback)
        // - Recommended: 10 articles from 0-9 (can repeat)
        html += '<div class="section-block">';
        html += '<div class="section-header">In The Spotlight</div>';
        html += '<div class="section-content">';

        // Main Spotlight Article - use article 11 to avoid overlap with featured (3-10)
        const mainSpotlightIdx = uniqueArticles.length > 11 ? 11 : 0;
        if (uniqueArticles.length > 0) {
          const mainSpotlight = uniqueArticles[mainSpotlightIdx];
          html += '<div class="spotlight-main">';
          html += '<a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + mainSpotlight.articleId + '\\'); return false;" class="spotlight-main-image">';
          html += '<img src="' + (mainSpotlight.image || 'images/' + mainSpotlight.articleId + '.jpg') + '" alt="' + mainSpotlight.title + '" onerror="this.parentElement.style.background=\\'#ddd\\'">';
          html += '</a>';
          html += '<h3 class="spotlight-main-title"><a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + mainSpotlight.articleId + '\\'); return false;">' + mainSpotlight.title + '</a></h3>';
          html += '<p class="spotlight-main-excerpt">' + truncateText(mainSpotlight.excerpt || '', 150) + '</p>';
          html += '</div>';
        }

        // Spotlight List Items - use articles 12-13 to avoid overlap
        const listStart = uniqueArticles.length > 13 ? 12 : 1;
        const listEnd = uniqueArticles.length > 13 ? 14 : 3;
        uniqueArticles.slice(listStart, listEnd).forEach(article => {
          html += '<div class="spotlight-list-item">';
          html += '<a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;" class="spotlight-list-image">';
          html += '<img src="' + (article.image || 'images/' + article.articleId + '.jpg') + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\\'#ddd\\'">';
          html += '</a>';
          html += '<div class="spotlight-list-content">';
          html += '<h4 class="spotlight-list-title"><a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;">' + article.title + '</a></h4>';
          html += '<p class="spotlight-list-excerpt">' + truncateText(article.excerpt || '', 80) + '</p>';
          html += '</div>';
          html += '</div>';
        });

        // Related Information Section - use articles 14-17 to avoid overlap
        const relatedStart = uniqueArticles.length > 17 ? 14 : 0;
        const relatedEnd = uniqueArticles.length > 17 ? 18 : 4;
        html += '<div class="related-info-header">Related Information</div>';
        html += '<div class="related-info-grid">';
        uniqueArticles.slice(relatedStart, relatedEnd).forEach(article => {
          html += '<div class="related-info-card">';
          html += '<a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;" class="related-info-image">';
          html += '<img src="' + (article.image || 'images/' + article.articleId + '.jpg') + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\\'#ddd\\'">';
          html += '</a>';
          html += '<h4 class="related-info-title"><a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;">' + article.title + '</a></h4>';
          html += '</div>';
        });
        html += '</div>';

        // Recommended Section - 10 articles with images (can repeat from earlier sections)
        html += '<div class="section-header" style="margin-top: 20px;">Recommended</div>';
        html += '<div class="recommended-list">';
        uniqueArticles.slice(0, 10).forEach(article => {
          html += '<div class="recommended-item">';
          html += '<a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;" class="recommended-image">';
          html += '<img src="' + (article.image || 'images/' + article.articleId + '.jpg') + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\\'#ddd\\'">';
          html += '</a>';
          html += '<div class="recommended-content">';
          html += '<h4 class="recommended-title"><a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + article.articleId + '\\'); return false;">' + article.title + '</a></h4>';
          html += '<p class="recommended-excerpt">' + truncateText(article.excerpt || '', 100) + '</p>';
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';

        html += '</div>'; // End section-content
        html += '</div>'; // End section-block (spotlight)
        html += '</div>'; // End section-row

        html += '</div>'; // End main-column

        // Sidebar with ad and You Might Like
        html += '<aside class="sidebar">';
        if (adHtml) {
          html += adHtml;
        }

        // You Might Like section - single article style matching content page
        if (uniqueArticles.length > 0) {
          const youMightLikeArticle = uniqueArticles[Math.floor(Math.random() * uniqueArticles.length)];
          html += '<div class="random-article">';
          html += '<div class="random-article-header">You Might Like</div>';
          html += '<a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + youMightLikeArticle.articleId + '\\'); return false;" class="random-article-image">';
          html += '<img src="' + (youMightLikeArticle.image || 'images/' + youMightLikeArticle.articleId + '.jpg') + '" alt="' + youMightLikeArticle.title + '" onerror="this.parentElement.style.background=\\'#ddd\\'">';
          html += '</a>';
          html += '<div class="random-article-content">';
          html += '<h4 class="random-article-title">';
          html += '<a href="#" onclick="openArticle(\\'' + categorySlug + '\\', \\'' + youMightLikeArticle.articleId + '\\'); return false;">' + youMightLikeArticle.title + '</a>';
          html += '</h4>';
          html += '<p class="random-article-excerpt">' + truncateText(youMightLikeArticle.excerpt || '', 100) + '</p>';
          html += '</div>';
          html += '</div>';
        }

        html += '</aside>';

        html += '</div>'; // End content-grid
        html += '</main>'; // End main-content

        // Cache the rendered portal page
        portalPageCache[categorySlug] = html;
        portalPage.innerHTML = html;
        window.scrollTo(0, 0);

      } catch (error) {
        console.error('Error loading portal:', error);
        portalPage.innerHTML = '<div style="padding: 40px; text-align: center;"><h2>Category Not Found</h2></div>';
      }
    }

    /**
     * handleAdClick - Handle ad click and track it
     */
    function handleAdClick(adId, campaignId, clickUrl) {
      // Track the click
      if (window.ViewTracker) {
        window.ViewTracker.trackAdView(adId, campaignId, 'click', currentMode, currentCategory || 'home');
      }
      // Open the ad link
      window.open(clickUrl, '_blank');
    }

    // ========================================================================
    // ARTICLE DETAIL MODE
    // ========================================================================

    async function openArticle(categorySlug, articleId) {
      currentMode = 'article';
      currentCategory = categorySlug;
      currentArticle = articleId;

      document.getElementById('homePage').style.display = 'none';
      document.getElementById('portalPage').style.display = 'none';

      const articlePage = document.getElementById('articleDetailPage');
      articlePage.style.display = 'block';
      articlePage.innerHTML = '<div style="padding: 40px; text-align: center;">Loading article...</div>';

      try {
        // Load article data
        const articlesPath = siteData.articleDataPaths ? siteData.articleDataPaths[categorySlug] : categorySlug + '/web_articles.json';
        const response = await fetch(articlesPath);
        const data = await response.json();

        const article = data.articles.find(a => a.id === articleId);

        if (!article) {
          throw new Error('Article not found');
        }

        const categoryName = siteData.categories.find(c => c.slug === categorySlug)?.name || categorySlug;

        let html = '<div class="article-detail-container">';
        html += '<div class="article-breadcrumb">';
        html += '<a href="#" onclick="goHome(); return false;">Home</a> &gt; ';
        html += '<a href="#" onclick="openPortal(\\'' + categorySlug + '\\'); return false;">' + categoryName + '</a> &gt; ';
        html += '<span>' + article.title + '</span>';
        html += '</div>';

        html += '<h1 class="article-detail-title">' + article.title + '</h1>';

        html += '<div class="article-meta">';
        html += '<span class="article-author">By ' + (article.writerName || 'Staff Writer') + '</span>';
        html += '<span class="article-date">' + new Date(article.createdAt || Date.now()).toLocaleDateString() + '</span>';
        html += '</div>';

        if (article.id) {
          html += '<div class="article-hero-image" style="background-image: url(\\'images/' + article.id + '.jpg\\')"></div>';
        }

        // Business Rule: Strip markdown from displayed content
        html += '<div class="article-content">' + formatArticleContent(article.content, article.id, siteData.allArticles || []) + '</div>';

        html += '<div class="article-tags">';
        if (article.keywords) {
          article.keywords.forEach(keyword => {
            html += '<span class="article-tag">' + keyword + '</span>';
          });
        }
        html += '</div>';

        html += '</div>';

        articlePage.innerHTML = html;
        window.scrollTo(0, 0);

      } catch (error) {
        console.error('Error loading article:', error);
        articlePage.innerHTML = '<div style="padding: 40px; text-align: center;"><h2>Article Not Found</h2></div>';
      }
    }

    function formatArticleContent(content, currentArticleId, allArticles) {
      if (!content) return '';
      // Strip markdown and convert to paragraphs
      const stripped = stripMarkdown(content);
      const paragraphs = stripped.split(/\\n\\n+/);

      // Inline 870x250 banner to insert after 5th paragraph
      const inlineBannerHtml = '<div class="inline-content-ad" style="margin: 25px 0; text-align: center;">' +
        '<a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-D&utm_placement=inline" target="_blank" rel="noopener" onclick="handleAdClick(\\'AD-003-D\\', \\'CAMP-003\\', this.href);">' +
        '<img src=".lumiatos/images/jubileeverse-870x250.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence" style="max-width: 100%; height: auto; display: inline-block;">' +
        '</a>' +
        '<div style="font-size: 10px; color: #999; margin-top: 2px;">Advertisement</div>' +
        '<div style="max-width: 100%; height: 6px; background-color: #000; margin-top: 25px;"></div>' +
        '</div>';

      // Get a random related article (different from current)
      const otherArticles = (allArticles || []).filter(a => a.id !== currentArticleId);
      const randomRelated = otherArticles.length > 0 ? otherArticles[Math.floor(Math.random() * otherArticles.length)] : null;

      // Related Articles section HTML
      let relatedArticleHtml = '';
      if (randomRelated) {
        const relatedCategoryName = randomRelated.categoryName || (randomRelated.categorySlug || '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const excerptText = randomRelated.excerpt ? stripMarkdown(randomRelated.excerpt).split(' ').slice(0, 25).join(' ') + '...' : 'Explore this insightful article from our ' + relatedCategoryName + ' collection. Discover faith-filled perspectives and practical wisdom for your spiritual journey.';
        relatedArticleHtml = '<div class="inline-related-articles" style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #e0e0e0;">' +
          '<div style="font-size: 13px; font-weight: 700; color: #c00; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Related Articles</div>' +
          '<div style="display: flex; gap: 15px; align-items: flex-start;">' +
          '<a href="#" onclick="showContentPage(\\'' + randomRelated.id + '\\', \\'' + randomRelated.categorySlug + '\\'); return false;" style="flex-shrink: 0;">' +
          '<img src="images/' + randomRelated.id + '.jpg" alt="' + randomRelated.title + '" style="width: 80px; height: 80px; object-fit: cover; display: block;" onerror="this.style.background=\\'#ddd\\'">' +
          '</a>' +
          '<div style="flex: 1; min-width: 0;">' +
          '<a href="#" onclick="showContentPage(\\'' + randomRelated.id + '\\', \\'' + randomRelated.categorySlug + '\\'); return false;" style="font-size: 17px; font-weight: 700; color: #222; text-decoration: none; display: block; line-height: 1.3; margin-bottom: 6px;">' + randomRelated.title + '</a>' +
          '<p style="font-size: 15px; color: #666; line-height: 1.5; margin: 0;">' + excerptText + '</p>' +
          '</div>' +
          '</div>' +
          '</div>';
      }

      // Build content with inline ad and related article after 5th paragraph
      let contentHtml = '';
      paragraphs.forEach((p, index) => {
        contentHtml += '<p>' + p.trim() + '</p>';
        // Insert banner and related article after 5th paragraph (index 4)
        if (index === 4 && paragraphs.length > 5) {
          contentHtml += inlineBannerHtml;
          contentHtml += relatedArticleHtml;
        }
      });

      return contentHtml;
    }

    // ========================================================================
    // SUBSCRIBE MODAL
    // ========================================================================

    function openSubscribeModal() {
      document.getElementById('subscribeModal').style.display = 'flex';
      document.getElementById('form-view').style.display = 'block';
      document.getElementById('thank-you-view').style.display = 'none';
      document.getElementById('subscribe-error').textContent = '';
    }

    function closeSubscribeModal() {
      document.getElementById('subscribeModal').style.display = 'none';
    }

    document.addEventListener('DOMContentLoaded', function() {
      // Subscribe button
      const subscribeBtn = document.getElementById('subscribe-btn');
      if (subscribeBtn) {
        subscribeBtn.addEventListener('click', openSubscribeModal);
      }

      // Modal close handlers
      const modal = document.getElementById('subscribeModal');
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) closeSubscribeModal();
        });

        const cancelBtn = document.getElementById('btn-cancel');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', closeSubscribeModal);
        }

        const okBtn = document.getElementById('btn-ok');
        if (okBtn) {
          okBtn.addEventListener('click', closeSubscribeModal);
        }
      }

      // Subscribe form
      const form = document.getElementById('subscribe-form');
      if (form) {
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          const name = document.getElementById('subscribe-name').value;
          const email = document.getElementById('subscribe-email').value;

          if (!name || !email) {
            document.getElementById('subscribe-error').textContent = 'Please fill in all fields';
            return;
          }

          // Simulate subscription
          document.getElementById('form-view').style.display = 'none';
          document.getElementById('thank-you-view').style.display = 'block';
        });
      }

      // Load site data
      loadSiteData();

      // ============ FEATURED CATEGORIES & MORE FROM BRANDS ============
      async function populateFeaturedSections() {
        // Get articles from site data, grouped by category
        if (!siteData || !siteData.allArticles || siteData.allArticles.length === 0) {
          console.log('No articles available for featured sections');
          return;
        }

        // Group articles by category
        const articlesByCategory = {};
        siteData.allArticles.forEach(article => {
          if (!articlesByCategory[article.categorySlug]) {
            articlesByCategory[article.categorySlug] = [];
          }
          articlesByCategory[article.categorySlug].push(article);
        });

        // Get first 4 categories for featured section
        const categoryKeys = Object.keys(articlesByCategory).slice(0, 4);
        const featuredGrid = document.getElementById('featured-categories-grid');

        if (featuredGrid && categoryKeys.length > 0) {
          // Build HTML for each category, fetching article content as needed
          const categoryCards = await Promise.all(categoryKeys.map(async (categorySlug) => {
            const articles = articlesByCategory[categorySlug];
            const article = articles[0]; // Get first article from each category for main display
            const categoryName = article.categoryName || categorySlug.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
            const excerpt = article.content ? article.content.substring(0, 150) + '...' : '';

            // Get 4 RANDOM articles from this category (excluding the first one shown)
            const otherArticles = articles.slice(1);
            const shuffled = [...otherArticles].sort(() => Math.random() - 0.5);
            const randomArticles = shuffled.slice(0, 4);

            // Fetch full article content from the category JSON file
            let articlesWithContent = [];
            try {
              const articlePath = categorySlug + '/web_articles.json';
              const response = await fetch(articlePath);
              if (response.ok) {
                const categoryData = await response.json();
                if (categoryData.articles) {
                  // Create a map of article content by ID
                  const contentMap = {};
                  categoryData.articles.forEach(a => {
                    contentMap[a.id] = a.content;
                  });
                  // Add content to our random articles
                  articlesWithContent = randomArticles.map(a => ({
                    ...a,
                    fullContent: contentMap[a.articleId] || a.content || a.excerpt || ''
                  }));
                }
              }
            } catch (e) {
              console.log('Could not fetch article content for', categorySlug);
              articlesWithContent = randomArticles.map(a => ({
                ...a,
                fullContent: a.content || a.excerpt || ''
              }));
            }

            // Generate links with first 15 words of each article
            const moreLinksHTML = articlesWithContent.map(a => {
              // Get first 15 words of article content (strip markdown first)
              const cleanContent = stripMarkdown(a.fullContent || '');
              const words = cleanContent.split(/\\s+/).slice(0, 15).join(' ');
              const teaser = words + '...';
              return \`<a href="#" class="more-link" onclick="showContentPage('\${a.articleId}', '\${categorySlug}'); return false;">\${teaser}</a>\`;
            }).join('');

            return \`
              <div class="featured-category-card">
                <div class="featured-category-header">\${categoryName}</div>
                <img src="images/\${article.articleId}.jpg" alt="\${article.title}" class="featured-category-image" onerror="this.src='images/default-article.jpg'">
                <div class="featured-category-title">
                  <a href="#" onclick="showContentPage('\${article.articleId}', '\${categorySlug}'); return false;">\${article.title}</a>
                </div>
                <div class="featured-category-excerpt">\${excerpt}</div>
                \${moreLinksHTML ? \`<div class="featured-category-more-links">\${moreLinksHTML}</div>\` : ''}
              </div>
            \`;
          }));

          featuredGrid.innerHTML = categoryCards.join('');
        }

        // Get 5 random articles for "More From Our Brands" section
        const allArticles = siteData.allArticles;
        const shuffled = [...allArticles].sort(() => Math.random() - 0.5);
        const brandArticles = shuffled.slice(0, 5);
        const brandsGrid = document.getElementById('more-from-brands-grid');

        if (brandsGrid && brandArticles.length > 0) {
          brandsGrid.innerHTML = brandArticles.map(article => {
            const categoryName = article.categoryName || article.categorySlug.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());

            return \`
              <div class="brand-card">
                <img src="images/\${article.articleId}.jpg" alt="\${article.title}" class="brand-card-image" onerror="this.src='images/default-article.jpg'">
                <div class="brand-card-label">\${categoryName}</div>
                <div class="brand-card-title">
                  <a href="#" onclick="showContentPage('\${article.articleId}', '\${article.categorySlug}'); return false;">\${article.title}</a>
                </div>
              </div>
            \`;
          }).join('');
        }
      }

      // Call after site data is loaded (with delay to ensure data is ready)
      setTimeout(populateFeaturedSections, 1000);
    });

    // Handle hash navigation
    window.addEventListener('hashchange', function() {
      const hash = window.location.hash.slice(1);
      if (hash && siteData) {
        const category = siteData.categories.find(c => c.slug === hash);
        if (category) {
          openPortal(hash);
        }
      }
    });

    // ========================================================================
    // VIEW TRACKING SYSTEM
    // ========================================================================

    const ViewTracker = {
      trackerPath: '.webstore/web_tracker.json',
      trackerData: null,
      pendingViews: [],
      saveTimeout: null,

      // Initialize tracker
      async init() {
        try {
          const response = await fetch(this.trackerPath);
          if (response.ok) {
            this.trackerData = await response.json();
          } else {
            this.trackerData = this.createEmptyTracker();
          }
          console.log('ViewTracker initialized');
        } catch (error) {
          console.log('ViewTracker: Creating new tracker');
          this.trackerData = this.createEmptyTracker();
        }
      },

      // Create empty tracker structure
      createEmptyTracker() {
        return {
          version: '1.0',
          domain: window.location.hostname || 'localhost',
          lastUpdated: new Date().toISOString(),
          tracking: {},
          totals: {
            allTime: { pageViews: 0, portalViews: 0, articleViews: 0, adViews: 0 },
            byPortal: {},
            byArticle: {},
            byAd: {}
          }
        };
      },

      // Get date keys for tracking hierarchy
      getDateKeys() {
        const now = new Date();
        return {
          year: now.getFullYear().toString(),
          month: String(now.getMonth() + 1).padStart(2, '0'),
          day: String(now.getDate()).padStart(2, '0')
        };
      },

      // Ensure date path exists in tracker
      ensureDatePath() {
        const { year, month, day } = this.getDateKeys();

        if (!this.trackerData.tracking[year]) {
          this.trackerData.tracking[year] = {};
        }
        if (!this.trackerData.tracking[year][month]) {
          this.trackerData.tracking[year][month] = {};
        }
        if (!this.trackerData.tracking[year][month][day]) {
          this.trackerData.tracking[year][month][day] = {
            pageViews: { home: 0, portal: {}, article: {} },
            portalViews: {},
            articleViews: {},
            adViews: {}
          };
        }
        return this.trackerData.tracking[year][month][day];
      },

      // Track page view (home, portal, or article)
      trackPageView(pageType, pageId = null) {
        if (!this.trackerData) return;

        const dayData = this.ensureDatePath();

        if (pageType === 'home') {
          dayData.pageViews.home++;
        } else if (pageType === 'portal' && pageId) {
          if (!dayData.pageViews.portal[pageId]) {
            dayData.pageViews.portal[pageId] = 0;
          }
          dayData.pageViews.portal[pageId]++;
        } else if (pageType === 'article' && pageId) {
          if (!dayData.pageViews.article[pageId]) {
            dayData.pageViews.article[pageId] = 0;
          }
          dayData.pageViews.article[pageId]++;
        }

        this.trackerData.totals.allTime.pageViews++;
        this.trackerData.lastUpdated = new Date().toISOString();
        this.queueSave();

        console.log('ViewTracker: Page view -', pageType, pageId || '');
      },

      // Track portal view
      trackPortalView(portalSlug, portalName) {
        if (!this.trackerData) return;

        const dayData = this.ensureDatePath();

        if (!dayData.portalViews[portalSlug]) {
          dayData.portalViews[portalSlug] = { views: 0, name: portalName };
        }
        dayData.portalViews[portalSlug].views++;

        // Update totals
        if (!this.trackerData.totals.byPortal[portalSlug]) {
          this.trackerData.totals.byPortal[portalSlug] = { views: 0, name: portalName };
        }
        this.trackerData.totals.byPortal[portalSlug].views++;
        this.trackerData.totals.allTime.portalViews++;

        this.trackerData.lastUpdated = new Date().toISOString();
        this.queueSave();

        console.log('ViewTracker: Portal view -', portalSlug);
      },

      // Track article view
      trackArticleView(articleId, articleTitle, categorySlug) {
        if (!this.trackerData) return;

        const dayData = this.ensureDatePath();

        if (!dayData.articleViews[articleId]) {
          dayData.articleViews[articleId] = {
            views: 0,
            title: articleTitle,
            categorySlug: categorySlug
          };
        }
        dayData.articleViews[articleId].views++;

        // Update totals
        if (!this.trackerData.totals.byArticle[articleId]) {
          this.trackerData.totals.byArticle[articleId] = {
            views: 0,
            title: articleTitle,
            categorySlug: categorySlug
          };
        }
        this.trackerData.totals.byArticle[articleId].views++;
        this.trackerData.totals.allTime.articleViews++;

        this.trackerData.lastUpdated = new Date().toISOString();
        this.queueSave();

        console.log('ViewTracker: Article view -', articleId);
      },

      // Track ad view/impression
      trackAdView(adId, campaignId, placement, pageType, pageId = null) {
        if (!this.trackerData) return;

        const dayData = this.ensureDatePath();

        if (!dayData.adViews[adId]) {
          dayData.adViews[adId] = {
            views: 0,
            campaignId: campaignId,
            placements: {}
          };
        }
        dayData.adViews[adId].views++;

        if (!dayData.adViews[adId].placements[placement]) {
          dayData.adViews[adId].placements[placement] = 0;
        }
        dayData.adViews[adId].placements[placement]++;

        // Update totals
        if (!this.trackerData.totals.byAd[adId]) {
          this.trackerData.totals.byAd[adId] = {
            views: 0,
            campaignId: campaignId
          };
        }
        this.trackerData.totals.byAd[adId].views++;
        this.trackerData.totals.allTime.adViews++;

        this.trackerData.lastUpdated = new Date().toISOString();
        this.queueSave();

        console.log('ViewTracker: Ad view -', adId, placement);
      },

      // Queue save operation (debounced)
      queueSave() {
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => this.saveTracker(), 2000);
      },

      // Save tracker to localStorage (client-side persistence)
      saveTracker() {
        try {
          localStorage.setItem('web_tracker_' + (window.location.hostname || 'local'),
            JSON.stringify(this.trackerData));
          console.log('ViewTracker: Saved to localStorage');
        } catch (error) {
          console.log('ViewTracker: Could not save -', error.message);
        }
      },

      // Load from localStorage on init
      loadFromStorage() {
        try {
          const stored = localStorage.getItem('web_tracker_' + (window.location.hostname || 'local'));
          if (stored) {
            const storedData = JSON.parse(stored);
            // Merge stored data with server data
            if (this.trackerData && storedData) {
              this.mergeTrackerData(storedData);
            }
          }
        } catch (error) {
          console.log('ViewTracker: Could not load from storage');
        }
      },

      // Merge stored data into current tracker
      mergeTrackerData(storedData) {
        // Merge tracking data by date
        for (const year in storedData.tracking) {
          if (!this.trackerData.tracking[year]) {
            this.trackerData.tracking[year] = storedData.tracking[year];
          } else {
            for (const month in storedData.tracking[year]) {
              if (!this.trackerData.tracking[year][month]) {
                this.trackerData.tracking[year][month] = storedData.tracking[year][month];
              } else {
                for (const day in storedData.tracking[year][month]) {
                  if (!this.trackerData.tracking[year][month][day]) {
                    this.trackerData.tracking[year][month][day] = storedData.tracking[year][month][day];
                  }
                }
              }
            }
          }
        }
        // Update totals from stored
        this.trackerData.totals = storedData.totals;
      },

      // Get tracking stats
      getStats() {
        if (!this.trackerData) return null;
        return {
          allTime: this.trackerData.totals.allTime,
          byPortal: this.trackerData.totals.byPortal,
          byArticle: this.trackerData.totals.byArticle,
          byAd: this.trackerData.totals.byAd
        };
      }
    };

    // Initialize ViewTracker after site data loads
    const originalLoadSiteData = loadSiteData;
    loadSiteData = async function() {
      await originalLoadSiteData();
      await ViewTracker.init();
      ViewTracker.loadFromStorage();
      // Track initial home page view
      ViewTracker.trackPageView('home');
    };

    // Wrap openPortal to track portal views
    const originalOpenPortal = openPortal;
    openPortal = async function(categorySlug) {
      await originalOpenPortal(categorySlug);
      const category = siteData.categories.find(c => c.slug === categorySlug);
      const categoryName = category ? category.name : categorySlug;
      ViewTracker.trackPageView('portal', categorySlug);
      ViewTracker.trackPortalView(categorySlug, categoryName);
    };

    // Wrap openArticle to track article views
    const originalOpenArticle = openArticle;
    openArticle = async function(categorySlug, articleId) {
      await originalOpenArticle(categorySlug, articleId);
      // Get article title from the loaded data
      const articleTitle = document.querySelector('.article-detail-title')?.textContent || 'Unknown';
      ViewTracker.trackPageView('article', articleId);
      ViewTracker.trackArticleView(articleId, articleTitle, categorySlug);
    };

    // Wrap goHome to track home views
    const originalGoHome = goHome;
    goHome = function() {
      originalGoHome();
      ViewTracker.trackPageView('home');
    };

    // Expose ViewTracker for external use (e.g., ad tracking)
    window.ViewTracker = ViewTracker;
  </script>
</body>
</html>`;
}

// ============================================================================
// STATIC FILE ROUTES
// ============================================================================

// Serve generated websites
app.use('/websites', express.static(WEBSITES_PATH));

// Serve the main creation page
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'create_website.html'));
});

app.get('/create', (req, res) => {
  res.sendFile(join(__dirname, 'create_website.html'));
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
  try {
    // Clear console
    console.clear();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   JUBILEE WEBSITE GENERATOR - Starting Server');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Ensure directories exist
    await ensureDirectories();

    // Check API keys
    console.log('📋 API Keys:');
    console.log(`   - Anthropic:       ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌'}`);
    console.log(`   - OpenAI (Primary): ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
    console.log(`   - OpenAI (Backup):  ${process.env.OPENAI_API_KEY_BACKUP ? '✅' : '❌'}`);
    console.log(`   - Grok/XAI (Images): ${process.env.GROK_API_KEY || process.env.XAI_API_KEY ? '✅' : '❌'}`);

    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY_BACKUP) {
      console.log('\n⚠️  WARNING: No API keys configured!');
      console.log('   Create a .env file with:');
      console.log('   ANTHROPIC_API_KEY=your_key_here');
      console.log('   OPENAI_API_KEY=your_primary_key_here');
      console.log('   OPENAI_API_KEY_BACKUP=your_backup_key_here\n');
    }

    // Display paths
    console.log('\n📁 Storage Paths:');
    console.log(`   - Datastore: ${DATASTORE_BASE}`);
    console.log(`   - Sites:     ${SITES_PATH}`);
    console.log(`   - Registry:  ${REGISTRY_PATH}`);
    console.log(`   - Websites:  ${WEBSITES_PATH}`);

    // Load registry
    const registry = await loadRegistry();
    console.log(`\n📊 Statistics:`);
    console.log(`   - Websites Generated: ${registry.count}`);

    // Generate daily history files for all websites
    console.log('\n📅 Daily History Generation:');
    try {
      const websitesDir = join(DATASTORE_BASE, 'websites');
      const domains = await fs.readdir(websitesDir).catch(() => []);
      for (const domain of domains) {
        const domainPath = join(websitesDir, domain);
        const stat = await fs.stat(domainPath).catch(() => null);
        if (stat && stat.isDirectory()) {
          try {
            ensureTodayHistory(domain);
            console.log(`   - ${domain}: ✅`);
          } catch (err) {
            console.log(`   - ${domain}: ⚠️ ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.log(`   - Skipped: ${err.message}`);
    }

    // Start server
    app.listen(PORT, () => {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log(`   🚀 Server running at http://localhost:${PORT}`);
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`   Open http://localhost:${PORT} in your browser to begin!\n`);
    });

  } catch (error) {
    console.error('\n❌ Server startup failed:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
