/**
 * Inspire API Service
 *
 * The ministry content and conversation API.
 * This service provides access to Bible content, ministry materials,
 * AI conversations, and user collections.
 *
 * RESPONSIBILITIES:
 * - Bible verse lookup and search
 * - Ministry content management (books, music, videos, etc.)
 * - AI conversation management
 * - Message creation and retrieval
 * - User collections
 * - UI translations
 * - Content analytics
 *
 * This API should be called by websites for content-related operations.
 * User identity must be verified via the Codex API first.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializePools, closePools, checkAllHealth } from '@jubilee/database';
import * as inspire from '@jubilee/database/inspire';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  credentials: true,
}));

// Health check
app.get('/health', async (c) => {
  const health = await checkAllHealth();
  const inspireHealth = health.find(h => h.database === 'inspire');

  return c.json({
    status: inspireHealth?.healthy ? 'healthy' : 'unhealthy',
    service: 'inspire-api',
    database: inspireHealth,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// BIBLE CONTENT ENDPOINTS
// ============================================================================

// Get all Bible versions
app.get('/api/bible/versions', async (c) => {
  const versions = await inspire.getBibleVersions();
  return c.json({ data: versions });
});

// Get Bible version by code
app.get('/api/bible/versions/:code', async (c) => {
  const code = c.req.param('code');
  const version = await inspire.getBibleVersionByCode(code);

  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  return c.json({ data: version });
});

// Search Bible verses
app.get('/api/bible/search', async (c) => {
  const versionId = c.req.query('versionId');
  const bookCode = c.req.query('bookCode');
  const chapter = c.req.query('chapter');
  const verse = c.req.query('verse');
  const searchText = c.req.query('q');
  const limit = parseInt(c.req.query('limit') ?? '100');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const verses = await inspire.searchBibleVerses({
    versionId: versionId ?? undefined,
    bookCode: bookCode ?? undefined,
    chapter: chapter ? parseInt(chapter) : undefined,
    verse: verse ? parseInt(verse) : undefined,
    searchText: searchText ?? undefined,
    limit,
    offset,
  });

  return c.json({ data: verses });
});

// Get specific verse
app.get('/api/bible/:version/:book/:chapter/:verse', async (c) => {
  const version = c.req.param('version');
  const book = c.req.param('book');
  const chapter = parseInt(c.req.param('chapter'));
  const verse = parseInt(c.req.param('verse'));

  const bibleVerse = await inspire.getVerse(version, book, chapter, verse);

  if (!bibleVerse) {
    return c.json({ error: 'Verse not found' }, 404);
  }

  return c.json({ data: bibleVerse });
});

// Get chapter
app.get('/api/bible/:version/:book/:chapter', async (c) => {
  const version = c.req.param('version');
  const book = c.req.param('book');
  const chapter = parseInt(c.req.param('chapter'));

  const verses = await inspire.getChapter(version, book, chapter);

  if (verses.length === 0) {
    return c.json({ error: 'Chapter not found' }, 404);
  }

  return c.json({ data: verses });
});

// ============================================================================
// MINISTRY CONTENT ENDPOINTS
// ============================================================================

// List ministry content
app.get('/api/content', async (c) => {
  const contentType = c.req.query('type');
  const status = c.req.query('status');
  const language = c.req.query('language');
  const isFeatured = c.req.query('featured');
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const content = await inspire.getMinistryContent({
    contentType: contentType ?? undefined,
    status: status ?? 'published',
    language: language ?? undefined,
    isFeatured: isFeatured ? isFeatured === 'true' : undefined,
    limit,
    offset,
  });

  return c.json({ data: content });
});

// Get content by ID
app.get('/api/content/:id', async (c) => {
  const id = c.req.param('id');
  const content = await inspire.getMinistryContentById(id);

  if (!content) {
    return c.json({ error: 'Content not found' }, 404);
  }

  // Increment view count
  await inspire.incrementContentView(id);

  return c.json({ data: content });
});

// Get content by slug
app.get('/api/content/slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const content = await inspire.getMinistryContentBySlug(slug);

  if (!content) {
    return c.json({ error: 'Content not found' }, 404);
  }

  await inspire.incrementContentView(content.id);

  return c.json({ data: content });
});

// Create ministry content
app.post('/api/content', async (c) => {
  const body = await c.req.json();

  try {
    const content = await inspire.createMinistryContent(body);
    return c.json({ data: content }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create content' }, 400);
  }
});

// Update ministry content
app.patch('/api/content/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  try {
    const content = await inspire.updateMinistryContent(id, body);
    if (!content) {
      return c.json({ error: 'Content not found' }, 404);
    }
    return c.json({ data: content });
  } catch (error) {
    return c.json({ error: 'Failed to update content' }, 400);
  }
});

// ============================================================================
// CONVERSATION ENDPOINTS
// ============================================================================

// Get user conversations
app.get('/api/users/:userId/conversations', async (c) => {
  const userId = c.req.param('userId');
  const personaId = c.req.query('personaId');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const conversations = await inspire.getConversations(userId, {
    personaId: personaId ?? undefined,
    status: status ?? undefined,
    limit,
    offset,
  });

  return c.json({ data: conversations });
});

// Get conversation by ID
app.get('/api/conversations/:id', async (c) => {
  const id = c.req.param('id');
  const conversation = await inspire.getConversationById(id);

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  return c.json({ data: conversation });
});

// Create conversation
app.post('/api/conversations', async (c) => {
  const body = await c.req.json();

  try {
    const conversation = await inspire.createConversation(body);
    return c.json({ data: conversation }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create conversation' }, 400);
  }
});

// Update conversation title
app.patch('/api/conversations/:id/title', async (c) => {
  const id = c.req.param('id');
  const { title } = await c.req.json();

  await inspire.updateConversationTitle(id, title);
  return c.json({ success: true });
});

// Archive conversation
app.post('/api/conversations/:id/archive', async (c) => {
  const id = c.req.param('id');
  await inspire.archiveConversation(id);
  return c.json({ success: true });
});

// Delete conversation
app.delete('/api/conversations/:id', async (c) => {
  const id = c.req.param('id');
  await inspire.deleteConversation(id);
  return c.json({ success: true });
});

// ============================================================================
// MESSAGE ENDPOINTS
// ============================================================================

// Get messages for conversation
app.get('/api/conversations/:conversationId/messages', async (c) => {
  const conversationId = c.req.param('conversationId');
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');
  const beforeId = c.req.query('beforeId');

  const messages = await inspire.getMessages(conversationId, {
    limit,
    offset,
    beforeId: beforeId ?? undefined,
  });

  return c.json({ data: messages });
});

// Create message
app.post('/api/conversations/:conversationId/messages', async (c) => {
  const conversationId = c.req.param('conversationId');
  const body = await c.req.json();

  try {
    const message = await inspire.createMessage({
      ...body,
      conversationId,
    });
    return c.json({ data: message }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create message' }, 400);
  }
});

// ============================================================================
// COLLECTION ENDPOINTS
// ============================================================================

// Get user collections
app.get('/api/users/:userId/collections', async (c) => {
  const userId = c.req.param('userId');
  const collections = await inspire.getCollections(userId);
  return c.json({ data: collections });
});

// Get collection by ID
app.get('/api/collections/:id', async (c) => {
  const id = c.req.param('id');
  const collection = await inspire.getCollectionById(id);

  if (!collection) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  return c.json({ data: collection });
});

// Create collection
app.post('/api/collections', async (c) => {
  const body = await c.req.json();

  try {
    const collection = await inspire.createCollection(body);
    return c.json({ data: collection }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create collection' }, 400);
  }
});

// Get collection categories
app.get('/api/collections/:id/categories', async (c) => {
  const id = c.req.param('id');
  const categories = await inspire.getCollectionCategories(id);
  return c.json({ data: categories });
});

// Get category items
app.get('/api/categories/:categoryId/items', async (c) => {
  const categoryId = c.req.param('categoryId');
  const items = await inspire.getCategoryItems(categoryId);
  return c.json({ data: items });
});

// ============================================================================
// TRANSLATION ENDPOINTS
// ============================================================================

// Get translations
app.get('/api/translations/:language', async (c) => {
  const language = c.req.param('language');
  const namespace = c.req.query('namespace');

  const translations = await inspire.getTranslations(language, namespace ?? undefined);
  return c.json({ data: translations });
});

// Get single translation
app.get('/api/translations/:language/:key', async (c) => {
  const language = c.req.param('language');
  const key = c.req.param('key');

  const value = await inspire.getTranslation(key, language);

  if (value === null) {
    return c.json({ error: 'Translation not found' }, 404);
  }

  return c.json({ data: { key, language, value } });
});

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

// Record AI usage
app.post('/api/analytics/ai-usage', async (c) => {
  const body = await c.req.json();

  await inspire.recordAiUsage({
    personaId: body.personaId ?? null,
    modelName: body.modelName,
    inputTokens: body.inputTokens,
    outputTokens: body.outputTokens,
    latencyMs: body.latencyMs,
    isError: body.isError ?? false,
  });

  return c.json({ success: true });
});

// Get persona engagement
app.get('/api/analytics/personas/:personaId', async (c) => {
  const personaId = c.req.param('personaId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  if (!startDate || !endDate) {
    return c.json({ error: 'startDate and endDate are required' }, 400);
  }

  const metrics = await inspire.getPersonaEngagement(
    personaId,
    new Date(startDate),
    new Date(endDate)
  );

  return c.json({ data: metrics });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const port = parseInt(process.env.INSPIRE_API_PORT ?? '4002');

async function start() {
  console.log('Initializing Inspire API...');

  try {
    await initializePools();
    console.log('Database pools initialized');

    serve({
      fetch: app.fetch,
      port,
    });

    console.log(`Inspire API running on http://localhost:${port}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /health                              - Health check');
    console.log('  GET  /api/bible/versions                  - List Bible versions');
    console.log('  GET  /api/bible/:version/:book/:chapter   - Get chapter');
    console.log('  GET  /api/content                         - List ministry content');
    console.log('  GET  /api/users/:userId/conversations     - Get user conversations');
    console.log('  POST /api/conversations/:id/messages      - Create message');
    console.log('  GET  /api/translations/:language          - Get translations');
  } catch (error) {
    console.error('Failed to start Inspire API:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down Inspire API...');
  await closePools();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down Inspire API...');
  await closePools();
  process.exit(0);
});

start();
