/**
 * Translation Model
 * Handles Bible translation tracking and storage
 */

const database = require('../database');
const { TRANSLATION_STATUS } = require('../config/constants');

/**
 * Create a translation entry
 */
async function create(data) {
  const db = database.getPostgres();
  const id = 'trans-' + Date.now();

  // Mock implementation
  // In production:
  // const result = await db.query(
  //   'INSERT INTO translations (id, user_id, reference, source_text, target_text, source_language, target_language, notes, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *',
  //   [id, data.userId, data.reference, data.sourceText, data.targetText, data.sourceLanguage, data.targetLanguage, data.notes, TRANSLATION_STATUS.PENDING]
  // );
  // return result.rows[0];

  return {
    id,
    userId: data.userId,
    reference: data.reference,
    sourceText: data.sourceText,
    translatedText: data.translatedText,
    sourceLanguage: data.sourceLanguage,
    targetLanguage: data.targetLanguage,
    notes: data.notes,
    status: TRANSLATION_STATUS.PENDING,
    createdAt: new Date().toISOString()
  };
}

/**
 * Find translation by ID
 */
async function findById(translationId) {
  const db = database.getPostgres();

  // Mock implementation
  return {
    id: translationId,
    reference: 'Genesis 1:1',
    sourceText: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
    targetText: 'In the beginning God created',
    sourceLanguage: 'he',
    targetLanguage: 'en',
    status: TRANSLATION_STATUS.COMPLETED
  };
}

/**
 * Find translations by user ID
 */
async function findByUserId(userId, options = {}) {
  const db = database.getPostgres();
  const { page = 1, limit = 20 } = options;

  // Mock implementation
  return {
    translations: [],
    total: 0
  };
}

/**
 * Get translation progress statistics
 */
async function getProgress(userId = null) {
  const db = database.getPostgres();

  // Mock implementation
  // In production, aggregate from database
  return {
    totalVerses: 31102,
    translatedVerses: 5420,
    reviewedVerses: 3200,
    languagePairs: [
      { source: 'he', target: 'en', progress: 0.45 },
      { source: 'el', target: 'en', progress: 0.32 }
    ]
  };
}

/**
 * Get recent translation activity
 */
async function getRecentActivity(userId = null, limit = 10) {
  const db = database.getPostgres();

  // Mock implementation
  return [
    {
      id: 'trans-1',
      reference: 'Genesis 1:1',
      sourceText: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
      targetText: 'In the beginning God created',
      sourceLanguage: 'he',
      targetLanguage: 'en',
      status: TRANSLATION_STATUS.REVIEWED,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'trans-2',
      reference: 'John 1:1',
      sourceText: 'Ἐν ἀρχῇ ἦν ὁ λόγος',
      targetText: 'In the beginning was the Word',
      sourceLanguage: 'el',
      targetLanguage: 'en',
      status: TRANSLATION_STATUS.COMPLETED,
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];
}

/**
 * Update translation status
 */
async function updateStatus(translationId, status, reviewerId = null) {
  const db = database.getPostgres();

  // Mock implementation
  return {
    id: translationId,
    status,
    reviewerId,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Find translation by reference and language pair
 */
async function findByReference(reference, sourceLanguage, targetLanguage) {
  const db = database.getPostgres();

  // Mock implementation
  return null;
}

/**
 * Count translations by status
 */
async function countByStatus(userId = null) {
  const db = database.getPostgres();

  // Mock implementation
  return {
    [TRANSLATION_STATUS.PENDING]: 150,
    [TRANSLATION_STATUS.IN_PROGRESS]: 45,
    [TRANSLATION_STATUS.COMPLETED]: 5420,
    [TRANSLATION_STATUS.REVIEWED]: 3200
  };
}

/**
 * Get UI translation for a specific string key, persona, and language
 */
async function getUITranslation(stringKey, personaSlug, targetLanguage) {
  const db = database.getPostgres();

  try {
    const result = await db.query(
      `SELECT translated_text FROM ui_translations
       WHERE string_key = $1 AND persona_slug = $2 AND target_language = $3`,
      [stringKey, personaSlug, targetLanguage]
    );

    if (result.rows.length > 0) {
      return result.rows[0].translated_text;
    }
    return null;
  } catch (error) {
    // Table might not exist yet, return null
    return null;
  }
}

/**
 * Save UI translation
 */
async function saveUITranslation(stringKey, personaSlug, targetLanguage, sourceText, translatedText) {
  const db = database.getPostgres();

  try {
    const result = await db.query(
      `INSERT INTO ui_translations (string_key, persona_slug, target_language, source_text, translated_text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (string_key, persona_slug, target_language)
       DO UPDATE SET translated_text = $5, updated_at = NOW()
       RETURNING *`,
      [stringKey, personaSlug, targetLanguage, sourceText, translatedText]
    );

    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

module.exports = {
  create,
  findById,
  findByUserId,
  getProgress,
  getRecentActivity,
  updateStatus,
  findByReference,
  countByStatus,
  getUITranslation,
  saveUITranslation
};
