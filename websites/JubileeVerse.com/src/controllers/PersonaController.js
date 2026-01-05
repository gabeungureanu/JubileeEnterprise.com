/**
 * Persona Controller
 * Handles persona-related HTTP requests with caching for high-traffic endpoints
 */

const { PersonaService } = require('../services');
const { CacheService } = require('../cache');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Get all personas
 * GET /api/personas
 * Cached: 5 minutes (personas list doesn't change frequently)
 */
const getAllPersonas = asyncHandler(async (req, res) => {
  const { category, language, activeOnly } = req.query;

  const filters = {
    category,
    language,
    activeOnly: activeOnly !== 'false'
  };

  // Try cache first
  const cacheKey = `${CacheService.PREFIX.PERSONA_LIST}${JSON.stringify(filters)}`;
  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.json({
      success: true,
      personas: cached,
      count: cached.length,
      cached: true
    });
  }

  // Fetch from service
  const personas = await PersonaService.getAllPersonas(filters);

  // Cache the result
  await CacheService.set(cacheKey, personas, CacheService.TTL.MEDIUM);

  res.json({
    success: true,
    personas,
    count: personas.length
  });
});

/**
 * Get featured personas
 * GET /api/personas/featured
 * Cached: 5 minutes (featured list is relatively static)
 */
const getFeaturedPersonas = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const personaLimit = parseInt(limit) || 6;

  // Try cache first
  const cacheKey = `${CacheService.PREFIX.PERSONA_FEATURED}:${personaLimit}`;
  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.json({
      success: true,
      personas: cached,
      cached: true
    });
  }

  // Fetch from service
  const personas = await PersonaService.getFeaturedPersonas(personaLimit);

  // Cache the result
  await CacheService.set(cacheKey, personas, CacheService.TTL.MEDIUM);

  res.json({
    success: true,
    personas
  });
});

/**
 * Get persona categories
 * GET /api/personas/categories
 * Cached: 24 hours (categories rarely change)
 */
const getCategories = asyncHandler(async (req, res) => {
  const cacheKey = CacheService.PREFIX.PERSONA_CATEGORIES;

  // Use getOrSet for simple caching pattern
  const categories = await CacheService.getOrSet(
    cacheKey,
    () => PersonaService.getPersonaCategories(),
    CacheService.TTL.VERY_LONG
  );

  res.json({
    success: true,
    categories
  });
});

/**
 * Get personas by category
 * GET /api/personas/category/:category
 * Cached: 5 minutes
 */
const getByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;

  const cacheKey = `${CacheService.PREFIX.PERSONA}category:${category}`;
  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.json({
      success: true,
      category,
      personas: cached,
      count: cached.length,
      cached: true
    });
  }

  const personas = await PersonaService.getPersonasByCategory(category);

  await CacheService.set(cacheKey, personas, CacheService.TTL.MEDIUM);

  res.json({
    success: true,
    category,
    personas,
    count: personas.length
  });
});

/**
 * Search personas
 * GET /api/personas/search
 * Cached: 1 minute (search results can vary)
 */
const searchPersonas = asyncHandler(async (req, res) => {
  const { q, limit, category } = req.query;

  if (!q) {
    throw new AppError('Search query is required', 400);
  }

  const searchOptions = {
    limit: parseInt(limit) || 10,
    category
  };

  // Cache search results briefly
  const cacheKey = `${CacheService.PREFIX.PERSONA}search:${q}:${JSON.stringify(searchOptions)}`;
  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.json({
      success: true,
      query: q,
      personas: cached,
      count: cached.length,
      cached: true
    });
  }

  const personas = await PersonaService.searchPersonas(q, searchOptions);

  // Short cache for search results
  await CacheService.set(cacheKey, personas, CacheService.TTL.SHORT);

  res.json({
    success: true,
    query: q,
    personas,
    count: personas.length
  });
});

/**
 * Get single persona by ID
 * GET /api/personas/:id
 * Cached: 1 hour (individual persona data)
 */
const getPersonaById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Try cache first
  const cached = await CacheService.getCachedPersona(id);

  if (cached) {
    return res.json({
      success: true,
      persona: cached,
      cached: true
    });
  }

  const persona = await PersonaService.getPersonaById(id);

  // Cache the persona
  await CacheService.cachePersona(persona);

  res.json({
    success: true,
    persona
  });
});

/**
 * Get persona by slug
 * GET /api/personas/slug/:slug
 * Cached: 1 hour
 */
const getPersonaBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const cacheKey = `${CacheService.PREFIX.PERSONA}slug:${slug}`;
  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.json({
      success: true,
      persona: cached,
      cached: true
    });
  }

  const persona = await PersonaService.getPersonaBySlug(slug);

  await CacheService.set(cacheKey, persona, CacheService.TTL.LONG);

  res.json({
    success: true,
    persona
  });
});

module.exports = {
  getAllPersonas,
  getFeaturedPersonas,
  getCategories,
  getByCategory,
  searchPersonas,
  getPersonaById,
  getPersonaBySlug
};
