/**
 * Persona Service
 * Handles persona resolution, context assembly, and persona-related logic
 */

const config = require('../config');
const logger = require('../utils/logger');
const { Persona } = require('../models');
const AIService = require('./AIService');

/**
 * Get all available personas
 */
async function getAllPersonas(options = {}) {
  const { category = null, language = null, activeOnly = true } = options;

  logger.debug('Getting all personas', { category, language, activeOnly });

  try {
    const filters = {};
    if (category) filters.category = category;
    if (language) filters.language = language;
    if (activeOnly) filters.isActive = true;

    return await Persona.findAll(filters);
  } catch (error) {
    logger.error('Failed to get personas', { error: error.message });
    throw error;
  }
}

/**
 * Get persona by ID
 */
async function getPersonaById(personaId) {
  logger.debug('Getting persona by ID', { personaId });

  try {
    const persona = await Persona.findById(personaId);

    if (!persona) {
      throw new Error('Persona not found');
    }

    return persona;
  } catch (error) {
    logger.error('Failed to get persona', { personaId, error: error.message });
    throw error;
  }
}

/**
 * Get persona by slug
 */
async function getPersonaBySlug(slug) {
  logger.debug('Getting persona by slug', { slug });

  try {
    const persona = await Persona.findBySlug(slug);

    if (!persona) {
      throw new Error('Persona not found');
    }

    return persona;
  } catch (error) {
    logger.error('Failed to get persona by slug', { slug, error: error.message });
    throw error;
  }
}

/**
 * Build system prompt for persona
 */
function buildSystemPrompt(persona, options = {}) {
  const {
    userLanguage = 'en',
    conversationContext = null,
    collaborationContext = null
  } = options;

  let prompt = '';

  if (persona.systemPrompt) {
    prompt += `${persona.systemPrompt.trim()}\n\n`;
  } else {
    prompt += `You are ${persona.name}, ${persona.title || 'an AI Bible persona'}.\n\n`;
  }

  if (persona.description) {
    prompt += `IDENTITY:\n${persona.description}\n\n`;
  }

  const personality = Array.isArray(persona.personality) ? persona.personality.join(', ') : persona.personality;
  if (personality) {
    prompt += `PERSONALITY:\n${personality}\n\n`;
  }

  if (Array.isArray(persona.expertise) && persona.expertise.length > 0) {
    prompt += `EXPERTISE:\n${persona.expertise.join(', ')}\n\n`;
  }

  if (persona.communicationStyle) {
    prompt += `COMMUNICATION STYLE:\n`;
    prompt += `- Tone: ${persona.communicationStyle?.tone || 'warm and thoughtful'}\n`;
    prompt += `- Approach: ${persona.communicationStyle?.approach || 'encouraging and supportive'}\n\n`;
  }

  if (persona.scriptureEmphasis) {
    prompt += `SCRIPTURE EMPHASIS:\n`;
    prompt += `You frequently reference and explain ${persona.scriptureEmphasis.join(', ')}.\n\n`;
  }

  if (collaborationContext) {
    prompt += `MULTI-PERSONA COORDINATION:\n`;
    prompt += `- You are one of several personas responding to the same prompt.\n`;
    prompt += `- Do not repeat prior persona answers; add new angles, fresh Scripture, or complementary insight.\n`;
    prompt += `- Keep your response faithful to your unique persona identity.\n\n`;
    prompt += `PREVIOUS PERSONA RESPONSES:\n${collaborationContext}\n\n`;
  }

  prompt += `GUIDELINES:\n`;
  prompt += `- Always respond with biblical accuracy and theological soundness\n`;
  prompt += `- Be warm, encouraging, and pastoral in your approach\n`;
  prompt += `- Reference Scripture when appropriate, providing book, chapter, and verse\n`;
  prompt += `- Respect diverse Christian traditions while staying true to your expertise\n`;
  prompt += `- If asked about topics outside your expertise, acknowledge limitations and suggest appropriate resources\n`;

  if (conversationContext) {
    prompt += `\nCONVERSATION CONTEXT:\n${conversationContext}\n`;
  }

  // CRITICAL: Language instruction at the END to ensure it takes precedence
  prompt += `\nIMPORTANT: You MUST always respond in English, regardless of what language the user writes in. The system will translate your English response to the user's preferred language automatically. Never respond in any language other than English.`;

  return prompt;
}

/**
 * Get relevant knowledge context for persona based on query
 */
async function getPersonaKnowledgeContext(personaId, query, options = {}) {
  const { maxResults = 5, minScore = 0.7 } = options;

  logger.debug('Getting persona knowledge context', { personaId, query });

  try {
    // Search persona's knowledge base in Qdrant
    const knowledgeChunks = await Persona.searchKnowledge(personaId, query, {
      limit: maxResults,
      scoreThreshold: minScore
    });

    if (!knowledgeChunks || knowledgeChunks.length === 0) {
      return [];
    }

    return knowledgeChunks.map(chunk => ({
      content: chunk.content,
      source: chunk.metadata?.source || 'Knowledge Base',
      relevance: chunk.score
    }));
  } catch (error) {
    logger.error('Failed to get persona knowledge context', { personaId, error: error.message });
    return []; // Return empty array on error, don't fail the whole request
  }
}

/**
 * Generate persona response
 */
async function generatePersonaResponse(options) {
  const {
    personaId,
    messages,
    userLanguage = 'en',
    conversationSummary = null,
    maxTokens = 1024,
    collaborationContext = null,
    systemPromptOverride = null,
    userId = null
  } = options;

  // Set user context for token tracking
  if (userId) {
    AIService.setCurrentUserId(userId);
  }

  logger.debug('Generating persona response', { personaId, messageCount: messages.length });

  try {
    // Get persona details
    const persona = await getPersonaById(personaId);

    // Get the latest user message for context search
    const latestUserMessage = messages
      .filter(m => m.type === 'user')
      .pop();

    // Get relevant knowledge context
    const knowledgeContext = latestUserMessage
      ? await getPersonaKnowledgeContext(personaId, latestUserMessage.content)
      : [];

    // Build context array
    const context = knowledgeContext.map(k =>
      `[${k.source}]: ${k.content}`
    );

    // Build system prompt
    const systemPrompt = systemPromptOverride || buildSystemPrompt(persona, {
      userLanguage,
      conversationContext: conversationSummary,
      collaborationContext
    });

    // Generate response using AI service
    // Extract persona slug for tracking (e.g., "Jubilee Inspire" -> "jubilee")
    const personaSlug = (persona.name || '').toLowerCase().split(' ')[0];

    const response = await AIService.generateResponse({
      provider: persona.aiProvider || AIService.getDefaultProvider(),
      systemPrompt,
      messages,
      context,
      maxTokens,
      temperature: persona.temperature || 0.7,
      personaSlug
    });

    return {
      response,
      persona: {
        id: persona.id,
        name: persona.name,
        avatar: persona.avatar || persona.avatarUrl
      },
      contextUsed: knowledgeContext.length
    };
  } catch (error) {
    logger.error('Failed to generate persona response', { personaId, error: error.message });
    throw error;
  }
}

/**
 * Get personas by category
 */
async function getPersonasByCategory(category) {
  logger.debug('Getting personas by category', { category });

  try {
    return await Persona.findByCategory(category);
  } catch (error) {
    logger.error('Failed to get personas by category', { category, error: error.message });
    throw error;
  }
}

/**
 * Get featured personas for homepage
 */
async function getFeaturedPersonas(limit = 6) {
  logger.debug('Getting featured personas', { limit });

  try {
    return await Persona.findFeatured(limit);
  } catch (error) {
    logger.error('Failed to get featured personas', { error: error.message });
    throw error;
  }
}

/**
 * Search personas by expertise or description
 */
async function searchPersonas(query, options = {}) {
  const { limit = 10, category = null } = options;

  logger.debug('Searching personas', { query, limit, category });

  try {
    return await Persona.search(query, { limit, category });
  } catch (error) {
    logger.error('Failed to search personas', { query, error: error.message });
    throw error;
  }
}

/**
 * Get persona categories
 */
function getPersonaCategories() {
  return [
    { id: 'scholar', name: 'Biblical Scholars', description: 'Deep theological and historical expertise' },
    { id: 'counselor', name: 'Faith Counselors', description: 'Spiritual guidance and life advice' },
    { id: 'teacher', name: 'Bible Teachers', description: 'Practical scripture application' },
    { id: 'prayer', name: 'Prayer Partners', description: 'Intercession and prayer support' },
    { id: 'worship', name: 'Worship Leaders', description: 'Music, praise, and worship guidance' },
    { id: 'translator', name: 'Translation Scholars', description: 'Biblical languages and translation' }
  ];
}

/**
 * Validate persona exists and is active
 */
async function validatePersona(personaId) {
  try {
    const persona = await Persona.findById(personaId);
    return persona && persona.isActive;
  } catch (error) {
    return false;
  }
}

/**
 * Get language name from code
 */
function getLanguageName(code) {
  const languages = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    'pt-br': 'Portuguese (Brazil)',
    zh: 'Chinese',
    'zh-tw': 'Chinese (Traditional)',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    he: 'Hebrew',
    el: 'Greek',
    ru: 'Russian',
    ro: 'Romanian',
    it: 'Italian',
    nl: 'Dutch',
    tr: 'Turkish'
  };
  return languages[code] || code;
}

module.exports = {
  getAllPersonas,
  getPersonaById,
  getPersonaBySlug,
  buildSystemPrompt,
  getPersonaKnowledgeContext,
  generatePersonaResponse,
  getPersonasByCategory,
  getFeaturedPersonas,
  searchPersonas,
  getPersonaCategories,
  validatePersona
};
