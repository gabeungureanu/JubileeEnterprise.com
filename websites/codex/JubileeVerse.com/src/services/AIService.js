/**
 * AI Service
 * Handles communication with AI providers (ChatGPT, Claude)
 */

const config = require('../config');
const logger = require('../utils/logger');
const { AI_PROVIDERS } = require('../config/constants');
const TokenUsageService = require('./TokenUsageService');

// Current user context for token tracking (set by callers)
let currentUserId = null;

/**
 * Set the current user ID for token tracking
 * @param {string} userId - User ID
 */
function setCurrentUserId(userId) {
  currentUserId = userId;
}

/**
 * Get the current user ID
 * @returns {string|null} Current user ID
 */
function getCurrentUserId() {
  return currentUserId;
}

/**
 * OpenAI API client state
 */
let openaiClient = null;
let usingBackupKey = false;

/**
 * Initialize OpenAI client
 */
async function getOpenAIClient() {
  if (openaiClient && !usingBackupKey) {
    return openaiClient;
  }

  try {
    const OpenAI = require('openai');
    const apiKey = usingBackupKey ? config.ai.openaiKeyBackup : config.ai.openaiKey;

    if (!apiKey) {
      throw new Error('No OpenAI API key configured');
    }

    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
  } catch (error) {
    logger.error('Failed to initialize OpenAI client', { error: error.message });
    throw error;
  }
}

/**
 * Generate AI response
 * @param {Object} options - Generation options
 * @param {string} options.provider - AI provider (openai or anthropic)
 * @param {string} options.model - Specific model override (e.g., 'gpt-5.2', 'gpt-4o')
 * @param {string} options.systemPrompt - System prompt
 * @param {Array} options.messages - Conversation messages
 * @param {Array} options.context - Knowledge context
 * @param {number} options.maxTokens - Max tokens for response
 * @param {number} options.temperature - Temperature for response
 * @param {string} options.personaSlug - Optional persona slug for tracking (e.g., 'jubilee', 'elias')
 */
async function generateResponse(options) {
  const {
    provider = AI_PROVIDERS.OPENAI,
    model = null,
    systemPrompt,
    messages,
    context = [],
    maxTokens = 1024,
    temperature = 0.7,
    personaSlug = null
  } = options;

  logger.debug('Generating AI response', { provider, model, messageCount: messages.length, personaSlug });

  try {
    let response;
    if (provider === AI_PROVIDERS.ANTHROPIC) {
      response = await callAnthropic({ systemPrompt, messages, context, maxTokens, temperature });
    } else {
      response = await callOpenAI({ systemPrompt, messages, context, maxTokens, temperature, model });
    }

    // Track Inspire persona response if personaSlug provided
    if (personaSlug) {
      trackPersonaResponse(personaSlug);
    }

    return response;
  } catch (error) {
    logger.error('AI generation failed', { provider, error: error.message });
    throw error;
  }
}

/**
 * Track persona response count (non-blocking)
 * @param {string} personaSlug - Persona slug (e.g., 'jubilee', 'elias')
 */
function trackPersonaResponse(personaSlug) {
  // Fire and forget - don't block AI response for tracking
  setImmediate(async () => {
    try {
      const database = require('../database');
      const pool = database.getPostgres();
      const slug = personaSlug.toLowerCase().split(' ')[0]; // Normalize: "Jubilee Inspire" -> "jubilee"

      const result = await pool.query(
        `UPDATE inspire_persona_stats
         SET response_count = response_count + 1,
             last_response_at = NOW(),
             updated_at = NOW()
         WHERE persona_slug = $1`,
        [slug]
      );

      if (result.rowCount > 0) {
        logger.debug('Tracked Inspire persona response', { personaSlug: slug });
      }
    } catch (error) {
      logger.warn('Failed to track persona response', { personaSlug, error: error.message });
    }
  });
}

/**
 * Call OpenAI API (ChatGPT)
 */
async function callOpenAI(options) {
  const { systemPrompt, messages, context, maxTokens, temperature, model: modelOverride } = options;

  try {
    const client = await getOpenAIClient();
    const model = modelOverride || config.ai.chatModel || 'gpt-4o-mini';

    // Build message array with system prompt and context
    const formattedMessages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add context as system messages
    if (context && context.length > 0) {
      formattedMessages.push({
        role: 'system',
        content: 'Relevant context from knowledge base:\n' + context.join('\n\n')
      });
    }

    // Add conversation messages
    for (const msg of messages) {
      formattedMessages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    logger.debug('Calling OpenAI API', {
      model,
      messageCount: formattedMessages.length,
      maxTokens
    });

    const response = await client.chat.completions.create({
      model,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    logger.info('OpenAI API response received', {
      tokens: response.usage?.total_tokens,
      finishReason: response.choices[0]?.finish_reason
    });

    // Track token usage
    TokenUsageService.recordUsage({
      userId: currentUserId,
      provider: 'openai',
      model,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      requestType: 'chat'
    });

    return content;
  } catch (error) {
    // Handle rate limit or quota errors - try backup key
    if (error.status === 429 || error.code === 'insufficient_quota') {
      if (!usingBackupKey && config.ai.openaiKeyBackup) {
        logger.warn('Primary OpenAI key quota exceeded, switching to backup key');
        usingBackupKey = true;
        openaiClient = null;
        return callOpenAI(options);
      }
    }

    logger.error('OpenAI API call failed', {
      error: error.message,
      status: error.status,
      code: error.code
    });
    throw error;
  }
}

/**
 * Call Anthropic API (Claude)
 */
async function callAnthropic(options) {
  const { systemPrompt, messages, context, maxTokens, temperature } = options;

  try {
    if (!config.ai.anthropicKey) {
      throw new Error('Anthropic API key not configured');
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: config.ai.anthropicKey });

    // Build context text
    const contextText = context && context.length > 0
      ? '\n\nRelevant context from knowledge base:\n' + context.join('\n\n')
      : '';

    // Format messages for Claude
    const formattedMessages = messages.map(m => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    logger.debug('Calling Anthropic API', {
      model: 'claude-3-opus-20240229',
      messageCount: formattedMessages.length,
      maxTokens
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: maxTokens,
      system: systemPrompt + contextText,
      messages: formattedMessages
    });

    const content = response.content[0]?.text;

    if (!content) {
      throw new Error('Empty response from Anthropic');
    }

    logger.info('Anthropic API response received', {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      stopReason: response.stop_reason
    });

    // Track token usage
    TokenUsageService.recordUsage({
      userId: currentUserId,
      provider: 'claude',
      model: 'claude-3-opus-20240229',
      promptTokens: response.usage?.input_tokens || 0,
      completionTokens: response.usage?.output_tokens || 0,
      requestType: 'chat'
    });

    return content;
  } catch (error) {
    logger.error('Anthropic API call failed', { error: error.message });
    throw error;
  }
}

/**
 * Estimate token count for text
 */
function estimateTokens(text) {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Check if provider is available
 */
function isProviderAvailable(provider) {
  if (provider === AI_PROVIDERS.OPENAI) {
    return !!(config.ai.openaiKey || config.ai.openaiKeyBackup);
  }
  if (provider === AI_PROVIDERS.ANTHROPIC) {
    return !!config.ai.anthropicKey;
  }
  return false;
}

/**
 * Get default provider based on availability
 */
function getDefaultProvider() {
  // Prefer OpenAI as requested
  if (config.ai.openaiKey || config.ai.openaiKeyBackup) return AI_PROVIDERS.OPENAI;
  if (config.ai.anthropicKey) return AI_PROVIDERS.ANTHROPIC;
  return AI_PROVIDERS.OPENAI;
}

/**
 * Reset to primary key (useful for testing or after a period)
 */
function resetToPrimaryKey() {
  if (usingBackupKey) {
    logger.info('Resetting to primary OpenAI key');
    usingBackupKey = false;
    openaiClient = null;
  }
}

/**
 * Get current key status
 */
function getKeyStatus() {
  return {
    usingBackupKey,
    primaryKeyAvailable: !!config.ai.openaiKey,
    backupKeyAvailable: !!config.ai.openaiKeyBackup,
    anthropicKeyAvailable: !!config.ai.anthropicKey
  };
}

/**
 * Generate embedding vector for text
 * Uses the same key management as chat (with backup fallback)
 */
async function generateEmbedding(text) {
  logger.debug('Generating embedding', { textLength: text.length });

  try {
    const openai = await getOpenAIClient();
    const model = config.ai.embeddingModel || 'text-embedding-3-small';
    const embeddingPayload = {
      model,
      input: text
    };

    if (model.startsWith('text-embedding-3')) {
      embeddingPayload.encoding_format = 'float';
    }

    const response = await openai.embeddings.create(embeddingPayload);

    // Track embedding token usage
    TokenUsageService.recordUsage({
      userId: currentUserId,
      provider: 'openai',
      model,
      promptTokens: response.usage?.total_tokens || estimateTokens(text),
      completionTokens: 0,
      requestType: 'embedding'
    });

    return response.data[0].embedding;
  } catch (error) {
    // Handle rate limit or quota errors - try backup key
    if (error.status === 429 || error.code === 'insufficient_quota') {
      if (!usingBackupKey && config.ai.openaiKeyBackup) {
        logger.warn('Primary OpenAI key quota exceeded for embedding, switching to backup key');
        usingBackupKey = true;
        openaiClient = null;

        // Retry with backup key
        const openai = await getOpenAIClient();
        const model = config.ai.embeddingModel || 'text-embedding-3-small';
        const embeddingPayload = {
          model,
          input: text
        };

        if (model.startsWith('text-embedding-3')) {
          embeddingPayload.encoding_format = 'float';
        }

        const response = await openai.embeddings.create(embeddingPayload);

        return response.data[0].embedding;
      }
    }

    logger.error('Failed to generate embedding', { error: error.message });
    throw error;
  }
}

/**
 * Generate AI response with streaming
 * @param {object} options - Same as generateResponse
 * @param {function} onChunk - Callback called with each chunk of text
 * @returns {Promise<string>} - Full response text
 */
async function generateResponseStreaming(options, onChunk) {
  const {
    provider = AI_PROVIDERS.OPENAI,
    systemPrompt,
    messages,
    context = [],
    maxTokens = 1024,
    temperature = 0.7,
    personaSlug = null
  } = options;

  logger.debug('Generating AI response with streaming', { provider, messageCount: messages.length, personaSlug });

  try {
    // Currently only OpenAI supports streaming in this implementation
    const response = await callOpenAIStreaming({ systemPrompt, messages, context, maxTokens, temperature }, onChunk);

    // Track Inspire persona response if personaSlug provided
    if (personaSlug) {
      trackPersonaResponse(personaSlug);
    }

    return response;
  } catch (error) {
    logger.error('AI streaming generation failed', { provider, error: error.message });
    throw error;
  }
}

/**
 * Call OpenAI API with streaming
 */
async function callOpenAIStreaming(options, onChunk) {
  const { systemPrompt, messages, context, maxTokens, temperature } = options;

  try {
    const client = await getOpenAIClient();
    const model = config.ai.chatModel || 'gpt-4o-mini';

    // Build message array with system prompt and context
    const formattedMessages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add context as system messages
    if (context && context.length > 0) {
      formattedMessages.push({
        role: 'system',
        content: 'Relevant context from knowledge base:\n' + context.join('\n\n')
      });
    }

    // Add conversation messages
    for (const msg of messages) {
      formattedMessages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    logger.debug('Calling OpenAI API with streaming', {
      model,
      messageCount: formattedMessages.length,
      maxTokens
    });

    const stream = await client.chat.completions.create({
      model,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature,
      stream: true
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        if (onChunk) {
          onChunk(content, fullContent);
        }
      }
    }

    if (!fullContent) {
      throw new Error('Empty streaming response from OpenAI');
    }

    logger.info('OpenAI streaming response completed', {
      contentLength: fullContent.length
    });

    // Track token usage (estimate since streaming doesn't return exact counts)
    const estimatedPromptTokens = formattedMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const estimatedCompletionTokens = estimateTokens(fullContent);
    TokenUsageService.recordUsage({
      userId: currentUserId,
      provider: 'openai',
      model,
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
      requestType: 'chat_streaming'
    });

    return fullContent;
  } catch (error) {
    // Handle rate limit or quota errors - try backup key
    if (error.status === 429 || error.code === 'insufficient_quota') {
      if (!usingBackupKey && config.ai.openaiKeyBackup) {
        logger.warn('Primary OpenAI key quota exceeded, switching to backup key');
        usingBackupKey = true;
        openaiClient = null;
        return callOpenAIStreaming(options, onChunk);
      }
    }

    logger.error('OpenAI streaming API call failed', {
      error: error.message,
      status: error.status,
      code: error.code
    });
    throw error;
  }
}

// ============================================
// CENTRALIZED TRANSLATION SYSTEM
// All translation should go through these functions
// ============================================

// Language code to name mapping
const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  ar: 'Arabic', he: 'Hebrew', hi: 'Hindi', ro: 'Romanian', pl: 'Polish',
  nl: 'Dutch', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish',
  el: 'Greek', tr: 'Turkish', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  ms: 'Malay', tl: 'Tagalog', sw: 'Swahili', uk: 'Ukrainian', cs: 'Czech',
  hu: 'Hungarian', bg: 'Bulgarian', hr: 'Croatian', sk: 'Slovak', sl: 'Slovenian',
  lt: 'Lithuanian', lv: 'Latvian', et: 'Estonian', fa: 'Persian', ur: 'Urdu',
  bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
  kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', am: 'Amharic', yo: 'Yoruba',
  ig: 'Igbo', zu: 'Zulu', af: 'Afrikaans', sq: 'Albanian', hy: 'Armenian',
  az: 'Azerbaijani', eu: 'Basque', be: 'Belarusian', bs: 'Bosnian', ca: 'Catalan',
  cy: 'Welsh', eo: 'Esperanto', gl: 'Galician', ka: 'Georgian', is: 'Icelandic',
  ga: 'Irish', mk: 'Macedonian', mt: 'Maltese', mn: 'Mongolian', ne: 'Nepali',
  sr: 'Serbian', si: 'Sinhala', so: 'Somali', uz: 'Uzbek', xh: 'Xhosa'
};

/**
 * Get language name from code
 * @param {string} code - Language code (e.g., 'en', 'ro')
 * @returns {string} Language name
 */
function getLanguageName(code) {
  if (!code) return 'English';
  const normalized = code.toLowerCase().split('-')[0];
  return LANGUAGE_NAMES[normalized] || code;
}

/**
 * Translate text FROM English TO target language
 * This is the primary translation function for AI responses
 * @param {string} content - English text to translate
 * @param {string} targetLanguage - Target language code (e.g., 'ro', 'es')
 * @returns {Promise<string>} Translated text
 */
async function translateFromEnglish(content, targetLanguage) {
  // Skip if no content, no target, or target is English
  if (!content || !content.trim()) return content;
  if (!targetLanguage || targetLanguage === 'en' || targetLanguage.startsWith('en-')) {
    return content;
  }

  const langName = getLanguageName(targetLanguage);
  logger.debug('Translating from English', { targetLanguage, langName, contentLength: content.length });

  try {
    const systemPrompt = `You are a professional translator. Translate the following English text to ${langName} (${targetLanguage}).

CRITICAL RULES:
1. Translate the text accurately while preserving meaning and tone
2. Preserve all Scripture references (e.g., "John 3:16") exactly as written
3. Preserve formatting, punctuation, and paragraph structure
4. Do NOT add explanations or commentary
5. Return ONLY the translated text
6. If the text contains names, keep proper names intact unless there's a standard translation`;

    const translated = await callOpenAI({
      systemPrompt,
      messages: [{ type: 'user', content }],
      maxTokens: Math.max(1024, content.length * 2),
      temperature: 0.2
    });

    logger.info('Translation from English completed', {
      targetLanguage,
      originalLength: content.length,
      translatedLength: translated.length
    });

    return translated;
  } catch (error) {
    logger.error('Translation from English failed', { targetLanguage, error: error.message });
    return content; // Return original on error
  }
}

/**
 * Translate text TO English from any language
 * This is used for storing messages in canonical English format
 * @param {string} content - Text in any language
 * @returns {Promise<string>} English text
 */
async function translateToEnglish(content) {
  if (!content || !content.trim()) return content;

  // Quick check: if text looks like English, skip translation
  const englishPatterns = [
    /^(what|how|why|when|where|who|can|could|would|should|do|does|did|is|are|was|were|have|has|had|will|the|a|an|this|that|these|those|i|you|he|she|it|we|they)\b/i,
    /\b(the lord|jesus christ|god|bible|scripture|faith|prayer|amen|hallelujah)\b/i
  ];

  const hasEnglishPattern = englishPatterns.some(p => p.test(content));
  if (hasEnglishPattern) {
    logger.debug('Content appears to be English, skipping translation', { contentPreview: content.substring(0, 50) });
    return content;
  }

  logger.debug('Translating to English', { contentLength: content.length });

  try {
    const systemPrompt = `You are a language detection and translation engine.

STEP 1: Detect if the text is in English or another language.
STEP 2: If the text is already in English, return it EXACTLY as provided with no changes.
STEP 3: If the text is in ANY other language, translate it to English.

CRITICAL RULES:
- NEVER answer questions in the text
- NEVER provide explanations or commentary
- NEVER add anything to the text
- Return ONLY the English text (either original or translated)
- Preserve Scripture references exactly
- Preserve formatting and punctuation`;

    const translated = await callOpenAI({
      systemPrompt,
      messages: [{ type: 'user', content }],
      maxTokens: Math.max(1024, content.length * 2),
      temperature: 0.1
    });

    // Safety check: if translation is way longer, might be wrong
    if (translated.length > content.length * 3) {
      logger.warn('Translation suspiciously long, using original', {
        originalLength: content.length,
        translatedLength: translated.length
      });
      return content;
    }

    logger.info('Translation to English completed', {
      originalLength: content.length,
      translatedLength: translated.length
    });

    return translated;
  } catch (error) {
    logger.error('Translation to English failed', { error: error.message });
    return content; // Return original on error
  }
}

/**
 * Wrapper that handles full response translation flow
 * Takes AI response (always English) and translates if needed
 * @param {string} response - English AI response
 * @param {string} targetLanguage - User's preferred language
 * @returns {Promise<{original: string, translated: string, language: string}>}
 */
async function translateResponse(response, targetLanguage) {
  const result = {
    original: response,
    translated: response,
    language: targetLanguage || 'en',
    wasTranslated: false
  };

  if (!targetLanguage || targetLanguage === 'en' || targetLanguage.startsWith('en-')) {
    return result;
  }

  try {
    result.translated = await translateFromEnglish(response, targetLanguage);
    result.wasTranslated = result.translated !== response;
    logger.debug('Response translation complete', {
      targetLanguage,
      wasTranslated: result.wasTranslated
    });
  } catch (error) {
    logger.error('Response translation failed', { targetLanguage, error: error.message });
    // Keep original on error
  }

  return result;
}

module.exports = {
  generateResponse,
  generateResponseStreaming,
  generateEmbedding,
  estimateTokens,
  isProviderAvailable,
  getDefaultProvider,
  resetToPrimaryKey,
  getKeyStatus,
  setCurrentUserId,
  getCurrentUserId,
  // Centralized translation functions
  translateFromEnglish,
  translateToEnglish,
  translateResponse,
  getLanguageName,
  LANGUAGE_NAMES
};
