/**
 * Persona Model
 * Handles persona persistence and knowledge retrieval
 */

const database = require('../database');
const config = require('../config');
const QdrantService = require('../services/QdrantService');

// Mock persona data for development
const MOCK_PERSONAS = [
  {
    id: 'biblical-scholar-1',
    name: 'Dr. Samuel',
    title: 'Biblical Scholar',
    category: 'biblical-scholars',
    description: 'Expert in Old Testament studies and ancient Hebrew texts with over 30 years of scholarly research.',
    avatar: '/images/personas/scholar.svg',
    languages: ['en', 'he', 'el'],
    specialties: ['Old Testament', 'Hebrew', 'Ancient History', 'Dead Sea Scrolls'],
    bio: 'Dr. Samuel has dedicated his life to understanding and teaching the richness of the Hebrew Scriptures.',
    conversationStarters: [
      'What is the significance of the Jubilee year?',
      'Can you explain the Hebrew meaning of Shalom?',
      'Tell me about the historical context of Exodus'
    ],
    systemPrompt: 'You are Dr. Samuel, a biblical scholar specializing in Old Testament studies...'
  },
  {
    id: 'prayer-partner-1',
    name: 'Sister Grace',
    title: 'Prayer Partner',
    category: 'prayer-partners',
    description: 'A compassionate guide for prayer and spiritual support',
    avatar: '/images/personas/prayer.svg',
    languages: ['en', 'es', 'fr'],
    specialties: ['Intercessory Prayer', 'Spiritual Guidance', 'Comfort'],
    bio: 'Sister Grace brings warmth and compassion to every prayer conversation.',
    conversationStarters: [
      'I need prayer for a difficult situation',
      'How can I develop a stronger prayer life?',
      'Can you pray with me for healing?'
    ],
    systemPrompt: 'You are Sister Grace, a compassionate prayer partner...'
  },
  {
    id: 'bible-teacher-1',
    name: 'Pastor David',
    title: 'Bible Teacher',
    category: 'bible-teachers',
    description: 'Practical Bible teaching for everyday application',
    avatar: '/images/personas/teacher.svg',
    languages: ['en', 'pt'],
    specialties: ['New Testament', 'Practical Application', 'Discipleship'],
    bio: 'Pastor David focuses on making Scripture relevant to daily life.',
    conversationStarters: [
      'How can I apply the Sermon on the Mount today?',
      'What does the Bible say about managing stress?',
      'Help me understand the parables of Jesus'
    ],
    systemPrompt: 'You are Pastor David, a Bible teacher focused on practical application...'
  },
  {
    id: 'worship-leader-1',
    name: 'Minister Joy',
    title: 'Worship Guide',
    category: 'worship-leaders',
    description: 'Leading hearts in worship and praise through music and scripture',
    avatar: '/images/personas/worship.svg',
    languages: ['en', 'es'],
    specialties: ['Worship', 'Psalms', 'Spiritual Songs'],
    bio: 'Minister Joy helps believers connect with God through worship.',
    conversationStarters: [
      'What are the Psalms of praise?',
      'How can I worship more authentically?',
      'Teach me about biblical worship'
    ],
    systemPrompt: 'You are Minister Joy, a worship leader who guides hearts in praise...'
  },
  {
    id: 'counselor-1',
    name: 'Dr. Ruth',
    title: 'Faith Counselor',
    category: 'counselors',
    description: 'Faith-based guidance for life challenges and spiritual growth',
    avatar: '/images/personas/counselor.svg',
    languages: ['en', 'de', 'fr'],
    specialties: ['Christian Counseling', 'Life Guidance', 'Spiritual Growth'],
    bio: 'Dr. Ruth combines biblical wisdom with compassionate guidance.',
    conversationStarters: [
      'I am struggling with a difficult decision',
      'How do I find peace in anxious times?',
      'Can you help me with a relationship issue?'
    ],
    systemPrompt: 'You are Dr. Ruth, a faith-based counselor who provides biblical wisdom...'
  },
  {
    id: 'translator-1',
    name: 'Brother Marcus',
    title: 'Translation Scholar',
    category: 'biblical-scholars',
    description: 'Specialist in Bible translation and linguistic analysis',
    avatar: '/images/personas/translator.svg',
    languages: ['en', 'he', 'el', 'ar'],
    specialties: ['Translation', 'Linguistics', 'Textual Analysis'],
    bio: 'Brother Marcus bridges ancient texts with modern understanding through careful translation work.',
    conversationStarters: [
      'What are the challenges of translating Hebrew poetry?',
      'How do different translations compare?',
      'Explain the Greek word "agape"'
    ],
    systemPrompt: 'You are Brother Marcus, a translation scholar specializing in biblical languages...'
  }
];

function isMockMode() {
  try {
    const pool = database.getPostgres();
    return !!pool?.mock;
  } catch (error) {
    return true;
  }
}

function rowToPersona(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    title: row.title,
    description: row.short_bio || row.full_bio || '',
    shortBio: row.short_bio,
    fullBio: row.full_bio,
    avatar: row.avatar_url,
    avatarUrl: row.avatar_url,
    systemPrompt: row.system_prompt,
    personality: row.personality_traits || [],
    expertise: row.expertise_areas || [],
    communicationStyle: {
      tone: row.speaking_style || 'warm and thoughtful',
      approach: 'encouraging and supportive'
    },
    greetingMessage: row.greeting_message,
    conversationStarters: row.conversation_starters || [],
    isFeatured: row.is_featured,
    isActive: row.is_active,
    categoryId: row.category_id,
    categorySlug: row.category_slug
  };
}

/**
 * Find all personas with optional filtering
 */
async function findAll(options = {}) {
  const { category = null, search = null, page = 1, limit = 12, language = null, isActive = null } = options;

  if (isMockMode()) {
    let filtered = [...MOCK_PERSONAS];
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.specialties.some(s => s.toLowerCase().includes(searchLower))
      );
    }
    const offset = (page - 1) * limit;
    return filtered.slice(offset, offset + limit);
  }

  const params = [];
  let query = `
    SELECT p.*, pc.slug as category_slug
    FROM personas p
    LEFT JOIN persona_categories pc ON pc.id = p.category_id
    WHERE 1=1
  `;

  if (isActive !== false) {
    params.push(true);
    query += ` AND p.is_active = $${params.length}`;
  }

  if (category && category !== 'all') {
    params.push(category);
    query += ` AND pc.slug = $${params.length}`;
  }

  if (language) {
    params.push(language);
    query += ` AND (p.primary_language = $${params.length} OR p.supported_languages ? $${params.length})`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (p.name ILIKE $${params.length} OR p.short_bio ILIKE $${params.length} OR p.full_bio ILIKE $${params.length})`;
  }

  query += ` ORDER BY p.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, (page - 1) * limit);

  const result = await database.query(query, params);
  return result.rows.map(rowToPersona);
}

/**
 * Find persona by ID
 */
async function findById(personaId) {
  if (isMockMode()) {
    return MOCK_PERSONAS.find(p => p.id === personaId) || null;
  }

  const result = await database.query(
    `SELECT p.*, pc.slug as category_slug
     FROM personas p
     LEFT JOIN persona_categories pc ON pc.id = p.category_id
     WHERE p.id = $1`,
    [personaId]
  );
  return rowToPersona(result.rows[0]);
}

/**
 * Find persona by slug
 */
async function findBySlug(slug) {
  if (isMockMode()) {
    return MOCK_PERSONAS.find(p => p.id === slug || p.slug === slug || p.name.toLowerCase().includes(slug)) || null;
  }

  const result = await database.query(
    `SELECT p.*, pc.slug as category_slug
     FROM personas p
     LEFT JOIN persona_categories pc ON pc.id = p.category_id
     WHERE p.slug = $1`,
    [slug]
  );
  return rowToPersona(result.rows[0]);
}

/**
 * Find personas by category slug
 */
async function findByCategory(categorySlug) {
  if (isMockMode()) {
    return MOCK_PERSONAS.filter(p => p.category === categorySlug);
  }

  const result = await database.query(
    `SELECT p.*, pc.slug as category_slug
     FROM personas p
     LEFT JOIN persona_categories pc ON pc.id = p.category_id
     WHERE pc.slug = $1 AND p.is_active = TRUE
     ORDER BY p.name ASC`,
    [categorySlug]
  );
  return result.rows.map(rowToPersona);
}

/**
 * Find featured personas
 */
async function findFeatured(limit = 6) {
  if (isMockMode()) {
    return MOCK_PERSONAS.filter(p => p.isFeatured).slice(0, limit);
  }

  const result = await database.query(
    `SELECT p.*, pc.slug as category_slug
     FROM personas p
     LEFT JOIN persona_categories pc ON pc.id = p.category_id
     WHERE p.is_featured = TRUE AND p.is_active = TRUE
     ORDER BY p.usage_count DESC, p.name ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(rowToPersona);
}

/**
 * Search personas
 */
async function search(query, options = {}) {
  const { limit = 10, category = null } = options;

  if (isMockMode()) {
    const searchLower = query.toLowerCase();
    return MOCK_PERSONAS.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    ).slice(0, limit);
  }

  const params = [`%${query}%`];
  let sql = `
    SELECT p.*, pc.slug as category_slug
    FROM personas p
    LEFT JOIN persona_categories pc ON pc.id = p.category_id
    WHERE p.is_active = TRUE
      AND (p.name ILIKE $1 OR p.short_bio ILIKE $1 OR p.full_bio ILIKE $1)
  `;

  if (category) {
    params.push(category);
    sql += ` AND pc.slug = $${params.length}`;
  }

  sql += ` ORDER BY p.name ASC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await database.query(sql, params);
  return result.rows.map(rowToPersona);
}

/**
 * Retrieve persona knowledge from Qdrant
 */
async function searchKnowledge(personaId, query, options = {}) {
  const { limit = 5, scoreThreshold = config.qdrant.scoreThreshold } = options;
  const persona = await findById(personaId);

  if (!persona) {
    return [];
  }

  const { results } = await QdrantService.retrieveKnowledge({
    query,
    persona: persona.slug,
    collection: config.qdrant.collection,
    limit,
    scoreThreshold
  });

  return results.map((result) => ({
    content: QdrantService.extractPayloadText(result.payload),
    metadata: {
      source: result.payload?.source_file || result.payload?.source,
      contentType: result.payload?.content_type,
      stepNumber: result.payload?.step_number
    },
    score: result.score
  }));
}

/**
 * Get system prompt for persona
 */
async function getSystemPrompt(personaId) {
  const persona = await findById(personaId);
  return persona?.systemPrompt || 'You are a helpful faith-based AI assistant.';
}

/**
 * Count total personas
 */
async function count(options = {}) {
  const { category = null } = options;

  if (isMockMode()) {
    let filtered = MOCK_PERSONAS;
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }
    return filtered.length;
  }

  const params = [];
  let query = `SELECT COUNT(*) FROM personas p`;

  if (category) {
    params.push(category);
    query += ` JOIN persona_categories pc ON pc.id = p.category_id WHERE pc.slug = $1`;
  } else {
    query += ` WHERE p.is_active = TRUE`;
  }

  const result = await database.query(query, params);
  return parseInt(result.rows[0].count, 10);
}

module.exports = {
  findAll,
  findById,
  findBySlug,
  findByCategory,
  findFeatured,
  search,
  searchKnowledge,
  getSystemPrompt,
  count
};
