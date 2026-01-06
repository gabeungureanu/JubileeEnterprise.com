/**
 * PlanTranslationService
 * Handles translation of plan features, categories, and static content
 * with version tracking for automatic re-translation when content changes
 */

const db = require('../database');
const logger = require('../utils/logger');

// Import translation function from existing translation service or use AI
let translateText;
try {
  const TranslationService = require('./TranslationService');
  translateText = TranslationService.translateText;
} catch (e) {
  // Fallback - will use AI translation
  translateText = null;
}

const PlanTranslationService = {
  // Current page version - increment when static content changes
  STATIC_CONTENT_VERSION: 1,

  /**
   * Get all plan features with translations for a specific language
   * @param {string} languageCode - Target language code (e.g., 'es', 'fr', 'ro')
   * @param {boolean} publishedOnly - Only return published features
   * @returns {Promise<Array>} Categories with translated features
   */
  async getTranslatedFeatures(languageCode, publishedOnly = true) {
    // If English, return original content
    if (languageCode === 'en') {
      return this.getOriginalFeatures(publishedOnly);
    }

    // Check if translations exist and are up to date
    const needsTranslation = await this.checkTranslationNeeded(languageCode);

    if (needsTranslation.features || needsTranslation.categories) {
      // Trigger background translation
      this.translateAllContent(languageCode).catch(err => {
        logger.error('Background translation failed', { error: err.message, languageCode });
      });
    }

    // Get translated content (or original if not yet translated)
    return this.getTranslatedContent(languageCode, publishedOnly);
  },

  /**
   * Get original (English) features
   */
  async getOriginalFeatures(publishedOnly = true) {
    const categoryFilter = publishedOnly ? 'WHERE c.is_published = true' : '';
    const featureFilter = publishedOnly ? 'WHERE f.is_published = true AND c.is_published = true' : '';

    const categoriesResult = await db.query(`
      SELECT id, name, slug, display_order, is_published, content_version
      FROM plan_feature_categories c
      ${categoryFilter}
      ORDER BY c.display_order ASC
    `);

    const featuresResult = await db.query(`
      SELECT f.id, f.category_id, f.name, f.slug, f.description, f.display_order,
             f.is_published, f.free_plan, f.standard_plan, f.ministry_plan, f.business_plan,
             f.free_value, f.standard_value, f.ministry_value, f.business_value,
             f.content_version, c.name as category_name, c.slug as category_slug
      FROM plan_features f
      JOIN plan_feature_categories c ON f.category_id = c.id
      ${featureFilter}
      ORDER BY c.display_order ASC, f.display_order ASC
    `);

    // Group features by category
    return categoriesResult.rows.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      displayOrder: category.display_order,
      isPublished: category.is_published,
      contentVersion: category.content_version,
      features: featuresResult.rows
        .filter(f => f.category_id === category.id)
        .map(f => ({
          id: f.id,
          categoryId: f.category_id,
          name: f.name,
          slug: f.slug,
          description: f.description,
          displayOrder: f.display_order,
          isPublished: f.is_published,
          freePlan: f.free_plan,
          standardPlan: f.standard_plan,
          ministryPlan: f.ministry_plan,
          businessPlan: f.business_plan,
          freeValue: f.free_value,
          standardValue: f.standard_value,
          ministryValue: f.ministry_value,
          businessValue: f.business_value,
          contentVersion: f.content_version
        }))
    }));
  },

  /**
   * Get translated content with fallback to original
   */
  async getTranslatedContent(languageCode, publishedOnly = true) {
    const categoryFilter = publishedOnly ? 'AND c.is_published = true' : '';
    const featureFilter = publishedOnly ? 'AND f.is_published = true AND c.is_published = true' : '';

    // Get categories with translations
    const categoriesResult = await db.query(`
      SELECT c.id, c.name as original_name, c.slug, c.display_order, c.is_published, c.content_version,
             ct.name as translated_name, ct.content_version as translation_version
      FROM plan_feature_categories c
      LEFT JOIN plan_feature_category_translations ct
        ON c.id = ct.category_id AND ct.language_code = $1
      WHERE 1=1 ${categoryFilter}
      ORDER BY c.display_order ASC
    `, [languageCode]);

    // Get features with translations
    const featuresResult = await db.query(`
      SELECT f.id, f.category_id, f.name as original_name, f.slug, f.description as original_description,
             f.display_order, f.is_published, f.free_plan, f.standard_plan, f.ministry_plan, f.business_plan,
             f.free_value, f.standard_value, f.ministry_value, f.business_value,
             f.content_version, c.name as category_name, c.slug as category_slug,
             ft.name as translated_name, ft.description as translated_description,
             ft.content_version as translation_version
      FROM plan_features f
      JOIN plan_feature_categories c ON f.category_id = c.id
      LEFT JOIN plan_feature_translations ft
        ON f.id = ft.feature_id AND ft.language_code = $1
      WHERE 1=1 ${featureFilter}
      ORDER BY c.display_order ASC, f.display_order ASC
    `, [languageCode]);

    // Build response with translated content (fallback to original)
    return categoriesResult.rows.map(category => ({
      id: category.id,
      name: category.translated_name || category.original_name,
      originalName: category.original_name,
      slug: category.slug,
      displayOrder: category.display_order,
      isPublished: category.is_published,
      contentVersion: category.content_version,
      translationVersion: category.translation_version,
      needsRetranslation: category.translation_version && category.translation_version < category.content_version,
      features: featuresResult.rows
        .filter(f => f.category_id === category.id)
        .map(f => ({
          id: f.id,
          categoryId: f.category_id,
          name: f.translated_name || f.original_name,
          originalName: f.original_name,
          slug: f.slug,
          description: f.translated_description || f.original_description,
          originalDescription: f.original_description,
          displayOrder: f.display_order,
          isPublished: f.is_published,
          freePlan: f.free_plan,
          standardPlan: f.standard_plan,
          ministryPlan: f.ministry_plan,
          businessPlan: f.business_plan,
          freeValue: f.free_value,
          standardValue: f.standard_value,
          ministryValue: f.ministry_value,
          businessValue: f.business_value,
          contentVersion: f.content_version,
          translationVersion: f.translation_version,
          needsRetranslation: f.translation_version && f.translation_version < f.content_version
        }))
    }));
  },

  /**
   * Check if translation is needed for a language
   */
  async checkTranslationNeeded(languageCode) {
    // Check features
    const featuresCheck = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(ft.id) as translated,
             SUM(CASE WHEN ft.content_version < f.content_version THEN 1 ELSE 0 END) as outdated
      FROM plan_features f
      LEFT JOIN plan_feature_translations ft ON f.id = ft.feature_id AND ft.language_code = $1
      WHERE f.is_published = true
    `, [languageCode]);

    // Check categories
    const categoriesCheck = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(ct.id) as translated,
             SUM(CASE WHEN ct.content_version < c.content_version THEN 1 ELSE 0 END) as outdated
      FROM plan_feature_categories c
      LEFT JOIN plan_feature_category_translations ct ON c.id = ct.category_id AND ct.language_code = $1
      WHERE c.is_published = true
    `, [languageCode]);

    // Check static content
    const staticCheck = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN language_code = $1 THEN 1 END) as translated
      FROM plan_page_translations
      WHERE language_code = 'en'
    `, [languageCode]);

    const translatedStatic = await db.query(`
      SELECT COUNT(*) as count FROM plan_page_translations WHERE language_code = $1
    `, [languageCode]);

    const f = featuresCheck.rows[0];
    const c = categoriesCheck.rows[0];
    const s = staticCheck.rows[0];

    return {
      features: parseInt(f.translated) < parseInt(f.total) || parseInt(f.outdated) > 0,
      categories: parseInt(c.translated) < parseInt(c.total) || parseInt(c.outdated) > 0,
      static: parseInt(translatedStatic.rows[0].count) < parseInt(s.total)
    };
  },

  /**
   * Translate all content for a language
   */
  async translateAllContent(languageCode) {
    logger.info('Starting translation for plan content', { languageCode });

    try {
      // Translate categories
      await this.translateCategories(languageCode);

      // Translate features
      await this.translateFeatures(languageCode);

      // Translate static content
      await this.translateStaticContent(languageCode);

      logger.info('Translation completed for plan content', { languageCode });
    } catch (error) {
      logger.error('Translation failed', { error: error.message, languageCode });
      throw error;
    }
  },

  /**
   * Translate categories
   */
  async translateCategories(languageCode) {
    // Get categories needing translation
    const result = await db.query(`
      SELECT c.id, c.name, c.content_version
      FROM plan_feature_categories c
      LEFT JOIN plan_feature_category_translations ct
        ON c.id = ct.category_id AND ct.language_code = $1
      WHERE c.is_published = true
        AND (ct.id IS NULL OR ct.content_version < c.content_version)
    `, [languageCode]);

    for (const category of result.rows) {
      const translatedName = await this.translateString(category.name, languageCode);

      await db.query(`
        INSERT INTO plan_feature_category_translations
          (category_id, language_code, name, content_version, translated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (category_id, language_code)
        DO UPDATE SET
          name = EXCLUDED.name,
          content_version = EXCLUDED.content_version,
          translated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [category.id, languageCode, translatedName, category.content_version]);

      logger.debug('Translated category', { categoryId: category.id, languageCode });
    }
  },

  /**
   * Translate features
   */
  async translateFeatures(languageCode) {
    // Get features needing translation
    const result = await db.query(`
      SELECT f.id, f.name, f.description, f.content_version
      FROM plan_features f
      LEFT JOIN plan_feature_translations ft
        ON f.id = ft.feature_id AND ft.language_code = $1
      WHERE f.is_published = true
        AND (ft.id IS NULL OR ft.content_version < f.content_version)
    `, [languageCode]);

    for (const feature of result.rows) {
      const translatedName = await this.translateString(feature.name, languageCode);
      const translatedDescription = feature.description
        ? await this.translateString(feature.description, languageCode)
        : null;

      await db.query(`
        INSERT INTO plan_feature_translations
          (feature_id, language_code, name, description, content_version, translated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (feature_id, language_code)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          content_version = EXCLUDED.content_version,
          translated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [feature.id, languageCode, translatedName, translatedDescription, feature.content_version]);

      logger.debug('Translated feature', { featureId: feature.id, languageCode });
    }
  },

  /**
   * Translate static content
   */
  async translateStaticContent(languageCode) {
    // Get English static content
    const result = await db.query(`
      SELECT content_key, content_value, content_version
      FROM plan_page_translations
      WHERE language_code = 'en'
    `);

    // Check which ones need translation
    const existingTranslations = await db.query(`
      SELECT content_key, content_version
      FROM plan_page_translations
      WHERE language_code = $1
    `, [languageCode]);

    const existingMap = new Map(existingTranslations.rows.map(r => [r.content_key, r.content_version]));

    for (const item of result.rows) {
      const existingVersion = existingMap.get(item.content_key);

      // Skip if already translated with current version
      if (existingVersion && existingVersion >= item.content_version) {
        continue;
      }

      const translatedValue = await this.translateString(item.content_value, languageCode);

      await db.query(`
        INSERT INTO plan_page_translations
          (content_key, language_code, content_value, content_version, translated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (content_key, language_code)
        DO UPDATE SET
          content_value = EXCLUDED.content_value,
          content_version = EXCLUDED.content_version,
          translated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [item.content_key, languageCode, translatedValue, item.content_version]);

      logger.debug('Translated static content', { key: item.content_key, languageCode });
    }
  },

  /**
   * Get static page translations
   */
  async getStaticTranslations(languageCode) {
    if (languageCode === 'en') {
      const result = await db.query(`
        SELECT content_key, content_value
        FROM plan_page_translations
        WHERE language_code = 'en'
      `);
      return Object.fromEntries(result.rows.map(r => [r.content_key, r.content_value]));
    }

    // Get translations with English fallback
    const result = await db.query(`
      SELECT e.content_key,
             COALESCE(t.content_value, e.content_value) as content_value
      FROM plan_page_translations e
      LEFT JOIN plan_page_translations t
        ON e.content_key = t.content_key AND t.language_code = $1
      WHERE e.language_code = 'en'
    `, [languageCode]);

    return Object.fromEntries(result.rows.map(r => [r.content_key, r.content_value]));
  },

  /**
   * Translate a string using the centralized AIService translation
   */
  async translateString(text, targetLanguage) {
    if (!text) return text;

    // Use the centralized AIService.translateFromEnglish function
    // This is the same function used by chat/message translations
    try {
      const AIService = require('./AIService');
      const translated = await AIService.translateFromEnglish(text, targetLanguage);
      return translated || text;
    } catch (e) {
      logger.error('AI translation failed', { error: e.message, targetLanguage });
      // Return original text as fallback
      return text;
    }
  },

  /**
   * Get language name from code
   */
  getLanguageName(code) {
    const languages = {
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ro': 'Romanian',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'he': 'Hebrew',
      'el': 'Greek',
      'nl': 'Dutch',
      'pl': 'Polish',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'ms': 'Malay',
      'tl': 'Tagalog',
      'sw': 'Swahili',
      'uk': 'Ukrainian',
      'cs': 'Czech',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
      'hu': 'Hungarian'
    };
    return languages[code] || code;
  },

  /**
   * Force re-translation for a language
   */
  async forceRetranslation(languageCode) {
    // Delete existing translations
    await db.query(`DELETE FROM plan_feature_translations WHERE language_code = $1`, [languageCode]);
    await db.query(`DELETE FROM plan_feature_category_translations WHERE language_code = $1`, [languageCode]);
    await db.query(`DELETE FROM plan_page_translations WHERE language_code = $1 AND language_code != 'en'`, [languageCode]);

    // Trigger new translation
    await this.translateAllContent(languageCode);
  },

  /**
   * Get current version numbers
   */
  async getVersions() {
    const result = await db.query('SELECT content_type, current_version, last_updated_at FROM plan_content_versions');
    return Object.fromEntries(result.rows.map(r => [r.content_type, {
      version: r.current_version,
      lastUpdated: r.last_updated_at
    }]));
  },

  /**
   * Increment static content version (call when updating static content)
   */
  async incrementStaticVersion() {
    await db.query(`
      UPDATE plan_content_versions
      SET current_version = current_version + 1, last_updated_at = CURRENT_TIMESTAMP
      WHERE content_type = 'static'
    `);
  }
};

module.exports = PlanTranslationService;
