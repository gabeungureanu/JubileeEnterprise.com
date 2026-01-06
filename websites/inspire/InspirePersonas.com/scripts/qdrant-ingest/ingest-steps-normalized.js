/**
 * Normalized Step Files Ingestion into JubileeVerse_vP
 *
 * Deterministic, metadata-driven analysis with:
 * - Proper collective vs individual persona classification
 * - Cross-domain references (not content duplication)
 * - Inheritance-aware metadata contracts
 * - Full queryability across personas, abilities, and domains
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

const COLLECTION_NAME = 'JubileeVerse_vP';

// Initialize clients
const qdrant = new QdrantClient({
  host: config.qdrant.host,
  port: config.qdrant.port
});

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

// ============================================================================
// PERSONA DEFINITIONS
// ============================================================================

const PERSONAS = {
  'Jubilee': { firstName: 'Jubilee', lastName: 'Inspire', role: 'Conductor/Leader', fiveFold: 'Apostle' },
  'Melody': { firstName: 'Melody', lastName: 'Inspire', role: 'Worship/Creative', fiveFold: 'Prophet' },
  'Zariah': { firstName: 'Zariah', lastName: 'Inspire', role: 'Prophetic Voice', fiveFold: 'Prophet' },
  'Elias': { firstName: 'Elias', lastName: 'Inspire', role: 'Theological Depth', fiveFold: 'Teacher' },
  'Eliana': { firstName: 'Eliana', lastName: 'Inspire', role: 'Financial Wisdom', fiveFold: 'Teacher' },
  'Caleb': { firstName: 'Caleb', lastName: 'Inspire', role: 'Bold Faith', fiveFold: 'Evangelist' },
  'Imani': { firstName: 'Imani', lastName: 'Inspire', role: 'Compassion/Care', fiveFold: 'Shepherd' },
  'Zev': { firstName: 'Zev', lastName: 'Inspire', role: 'Hebraic Roots', fiveFold: 'Teacher' },
  'Amir': { firstName: 'Amir', lastName: 'Inspire', role: 'Cultural Bridge', fiveFold: 'Evangelist' },
  'Nova': { firstName: 'Nova', lastName: 'Inspire', role: 'Innovation/Tech', fiveFold: 'Apostle' },
  'Santiago': { firstName: 'Santiago', lastName: 'Inspire', role: 'Hispanic Ministry', fiveFold: 'Shepherd' },
  'Tahoma': { firstName: 'Tahoma', lastName: 'Inspire', role: 'Indigenous Wisdom', fiveFold: 'Prophet' }
};

const PERSONA_NAMES = Object.keys(PERSONAS);

// ============================================================================
// TAXONOMY DEFINITIONS WITH KEYWORDS
// ============================================================================

const TAXONOMY = {
  'Abilities': {
    'Write': ['write', 'writing', 'scribe', 'scribing', 'author', 'compose', 'document', 'record'],
    'Speak': ['speak', 'speaking', 'voice', 'vocal', 'speech', 'declare', 'proclaim', 'announce'],
    'Teach': ['teach', 'teaching', 'instruct', 'instruction', 'educate', 'lesson', 'curriculum', 'training'],
    'Preach': ['preach', 'preaching', 'sermon', 'homily', 'proclamation', 'gospel message'],
    'Pray': ['pray', 'prayer', 'praying', 'intercession', 'intercede', 'interceding', 'supplication'],
    'Discern': ['discern', 'discernment', 'discerning', 'perceive', 'detect', 'sense', 'spiritual sensitivity'],
    'Create': ['create', 'creative', 'creativity', 'artistry', 'artistic', 'design', 'craft', 'produce'],
    'Sing': ['sing', 'singing', 'song', 'music', 'musical', 'worship music', 'vocalist', 'melody'],
    'Remember': ['remember', 'memory', 'memorial', 'recall', 'remembrance', 'archive'],
    'Interpret': ['interpret', 'interpretation', 'dream interpretation', 'translate', 'decode', 'meaning'],
    'Reason': ['reason', 'reasoning', 'logic', 'logical', 'analytical', 'analyze', 'deduce'],
    'Imagine': ['imagine', 'imagination', 'vision', 'visionary', 'prophetic vision', 'envision'],
    'Counsel': ['counsel', 'counseling', 'counselor', 'advise', 'guidance', 'mentor', 'guide'],
    'Lead': ['lead', 'leadership', 'leader', 'leading', 'govern', 'governance', 'direct', 'oversee'],
    'Serve': ['serve', 'service', 'servant', 'servanthood', 'ministry service', 'help', 'assist'],
    'Build': ['build', 'building', 'construct', 'architect', 'structure', 'system', 'framework', 'establish'],
    'Heal': ['heal', 'healing', 'healer', 'deliverance', 'restoration', 'recover', 'wholeness'],
    'Judge': ['judge', 'judgment', 'judging', 'verdict', 'discernment', 'weigh', 'evaluate'],
    'Collaborate': ['collaborate', 'collaboration', 'teamwork', 'partnership', 'together', 'unified'],
    'Witness': ['witness', 'witnessing', 'testimony', 'testify', 'evangelize', 'share faith']
  },
  'Ministries': {
    'Apostle': ['apostle', 'apostolic', 'apostleship', 'sent one', 'kingdom builder', 'foundation'],
    'Prophet': ['prophet', 'prophetic', 'prophecy', 'prophesy', 'seer', 'oracle', 'revelation'],
    'Evangelist': ['evangelist', 'evangelism', 'evangelistic', 'gospel', 'salvation', 'outreach', 'harvest'],
    'Shepherd': ['shepherd', 'shepherding', 'pastoral', 'pastor', 'flock', 'sheep', 'care', 'nurture'],
    'Teacher': ['teacher', 'teaching', 'doctrine', 'instruction', 'educator', 'rabbi', 'discipleship']
  },
  'Guardrails': {
    'Safety Guardrails': ['safeguard', 'safety', 'protection', 'guard', 'boundary', 'ethical', 'integrity', 'limit'],
    'Firewall Guardrails': ['firewall', 'defilement', 'contamination', 'strange fire', 'spiritual defense', 'audit', 'purge', 'seal']
  },
  'Models': {
    'Inspire 7.0': ['inspire 7.0', 'version 7.0', 'v7.0'],
    'Inspire 7.5': ['inspire 7.5', 'version 7.5', 'v7.5'],
    'Inspire 8.0': ['inspire 8.0', 'version 8.0', 'v8.0', 'kingdom builder model', 'creative fire model', 'gospel pulse', 'shepherd voice', 'hebraic roots model']
  },
  'JSV Bible': {
    'Translation Rules': ['translation', 'jsv', 'jubilee standard version', 'sacred names', 'hebrew translation', 'greek translation', 'original language'],
    'Old Testament': ['old testament', 'torah', 'genesis', 'exodus', 'psalms', 'prophets', 'tanakh', 'hebrew scriptures'],
    'New Testament': ['new testament', 'gospel', 'acts', 'epistles', 'revelation', 'apostolic writings']
  },
  'Languages': {
    'English': ['english', 'english translation', 'english speaking'],
    'Romanian': ['romanian', 'română', 'romanian translation'],
    'Spanish': ['spanish', 'español', 'hispanic', 'latino'],
    'Hebrew': ['hebrew', 'ivrit', 'hebraic', 'hebrew language']
  },
  'Objects': {
    'Subroutines': ['subroutine', 'protocol', 'procedure', 'module', 'function', 'routine', 'process'],
    'Triggers': ['trigger', 'activation', 'initiate', 'command instruction', 'activate', 'invoke', 'execute'],
    'Properties': ['property', 'attribute', 'characteristic', 'trait', 'setting', 'configuration', 'parameter']
  }
};

// ============================================================================
// CONTENT CLASSIFICATION PATTERNS
// ============================================================================

// Patterns that indicate collective/group-level content
const COLLECTIVE_PATTERNS = [
  /all\s+personas?/i,
  /every\s+persona/i,
  /inspire\s+family/i,
  /all\s+inspire/i,
  /you\s+must\s+(?:now\s+)?(?:all|each)/i,
  /from\s+this\s+moment\s+forward/i,
  /you\s+are\s+(?:now\s+)?commanded/i,
  /you\s+are\s+(?:now\s+)?(?:to|required)/i,
  /this\s+protocol/i,
  /this\s+system/i,
  /permanently\s+activate/i,
  /must\s+be\s+stored\s+in\s+memory/i,
  /activate\s+(?:the\s+)?(?:\w+\s+)?protocol/i,
  /command\s+instructions?:/i,
  /whenever\s+(?:you|the\s+user)/i,
  /you\s+must\s+treat/i,
  /you\s+must\s+guard/i,
  /you\s+must\s+maintain/i,
  /you\s+must\s+ensure/i,
  /all\s+(?:12|twelve)\s+(?:inspire|personas)/i,
  /each\s+inspire\s+(?:family\s+)?persona/i
];

// Patterns that indicate individual persona content
const INDIVIDUAL_PATTERNS = [
  /^(jubilee|melody|zariah|elias|eliana|caleb|imani|zev|amir|nova|santiago|tahoma),?\s+you/i,
  /if\s+you\s+are\s+(jubilee|melody|zariah|elias|eliana|caleb|imani|zev|amir|nova|santiago|tahoma)/i,
  /(jubilee|melody|zariah|elias|eliana|caleb|imani|zev|amir|nova|santiago|tahoma)\s+inspire\s+[–-]/i,
  /(jubilee|melody|zariah|elias|eliana|caleb|imani|zev|amir|nova|santiago|tahoma)'s?\s+(?:specific|unique|individual)/i,
  /specifically\s+for\s+(jubilee|melody|zariah|elias|eliana|caleb|imani|zev|amir|nova|santiago|tahoma)/i,
  /^(jubilee|melody|zariah|elias|eliana|caleb|imani|zev|amir|nova|santiago|tahoma)\s+must/i
];

// ============================================================================
// CONTENT TYPE CLASSIFICATIONS
// ============================================================================

const CONTENT_TYPES = {
  BEHAVIORAL_RULE: 'behavioral_rule',
  PROTOCOL: 'protocol',
  CONSTRAINT: 'constraint',
  IDENTITY_DEFINITION: 'identity_definition',
  INSTRUCTION: 'instruction',
  GUIDELINE: 'guideline',
  PROPERTY: 'property',
  ACTIVATION: 'activation',
  CURRICULUM: 'curriculum',
  VALIDATION_SYSTEM: 'validation_system',
  RATING_SYSTEM: 'rating_system',
  COMMUNICATION_STYLE: 'communication_style'
};

// Content type detection patterns
const CONTENT_TYPE_PATTERNS = {
  [CONTENT_TYPES.PROTOCOL]: [/protocol/i, /subroutine/i, /module/i, /system\s+activation/i],
  [CONTENT_TYPES.BEHAVIORAL_RULE]: [/you\s+must/i, /you\s+are\s+(?:to|required)/i, /never\s+(?:do|use|allow)/i],
  [CONTENT_TYPES.CONSTRAINT]: [/must\s+not/i, /forbidden/i, /prohibited/i, /do\s+not/i, /reject\s+all/i],
  [CONTENT_TYPES.IDENTITY_DEFINITION]: [/you\s+are\s+(?:now\s+)?(?:a|the|an)/i, /your\s+identity/i, /you\s+exist\s+to/i],
  [CONTENT_TYPES.ACTIVATION]: [/activate/i, /from\s+this\s+moment/i, /permanently\s+(?:activate|enable)/i],
  [CONTENT_TYPES.VALIDATION_SYSTEM]: [/validation\s+system/i, /rating\s+system/i, /fbvs/i, /ccrs/i],
  [CONTENT_TYPES.RATING_SYSTEM]: [/rate\s+(?:yourself|themselves|the)/i, /rating\s+(?:system|protocol)/i],
  [CONTENT_TYPES.COMMUNICATION_STYLE]: [/communication\s+style/i, /tone\s+(?:and\s+)?style/i, /speak\s+with/i],
  [CONTENT_TYPES.CURRICULUM]: [/year\s+\d+/i, /stage\s+\d+/i, /scroll\s+[ivx]+/i, /jubilee\s+bible\s+college/i],
  [CONTENT_TYPES.GUIDELINE]: [/guideline/i, /recommendation/i, /suggestion/i, /best\s+practice/i]
};

// ============================================================================
// EXECUTION SCOPE DEFINITIONS
// ============================================================================

const EXECUTION_SCOPE = {
  GLOBAL: 'global',           // Applies to all personas at all times
  INHERITED: 'inherited',     // Can be inherited but may be overridden
  INDIVIDUAL: 'individual',   // Applies only to specific persona
  CONTEXTUAL: 'contextual'    // Applies based on runtime context
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: text.substring(0, 8000)
  });
  return response.data[0].embedding;
}

// Determine if content is collective or individual
function classifyPersonaScope(text) {
  const lowerText = text.toLowerCase();

  // Check for individual persona patterns first
  for (const pattern of INDIVIDUAL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const personaName = match[1];
      const persona = PERSONAS[personaName.charAt(0).toUpperCase() + personaName.slice(1).toLowerCase()];
      if (persona) {
        return {
          scope: 'individual',
          persona: persona,
          executionScope: EXECUTION_SCOPE.INDIVIDUAL
        };
      }
    }
  }

  // Check for collective patterns
  for (const pattern of COLLECTIVE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        scope: 'collective',
        persona: null,
        executionScope: EXECUTION_SCOPE.GLOBAL
      };
    }
  }

  // Check for any persona mentions (for reference, not ownership)
  const mentionedPersonas = [];
  for (const name of PERSONA_NAMES) {
    if (lowerText.includes(name.toLowerCase())) {
      mentionedPersonas.push(name);
    }
  }

  // If multiple personas mentioned or none, it's collective
  if (mentionedPersonas.length === 0 || mentionedPersonas.length > 2) {
    return {
      scope: 'collective',
      persona: null,
      executionScope: EXECUTION_SCOPE.INHERITED,
      referencedPersonas: mentionedPersonas
    };
  }

  // Single persona mention might be individual content
  if (mentionedPersonas.length === 1) {
    // Check if it's truly individual or just a reference
    const persona = PERSONAS[mentionedPersonas[0]];
    const nameRegex = new RegExp(`${mentionedPersonas[0]}[,']?\\s+(you|must|should|will|is|are)`, 'i');
    if (nameRegex.test(text)) {
      return {
        scope: 'individual',
        persona: persona,
        executionScope: EXECUTION_SCOPE.INDIVIDUAL
      };
    }
  }

  // Default to collective with inherited scope
  return {
    scope: 'collective',
    persona: null,
    executionScope: EXECUTION_SCOPE.INHERITED,
    referencedPersonas: mentionedPersonas
  };
}

// Detect content type
function detectContentType(text) {
  for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type;
      }
    }
  }
  return CONTENT_TYPES.INSTRUCTION;
}

// Extract cross-domain references (returns references, not duplicates)
function extractCrossDomainReferences(text) {
  const lowerText = text.toLowerCase();
  const references = {};

  for (const [category, subcategories] of Object.entries(TAXONOMY)) {
    references[category] = [];

    for (const [subcategory, keywords] of Object.entries(subcategories)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          if (!references[category].includes(subcategory)) {
            references[category].push(subcategory);
          }
          break;
        }
      }
    }

    // Remove empty categories
    if (references[category].length === 0) {
      delete references[category];
    }
  }

  return references;
}

// Parse content into logical sections with enhanced granularity
function parseContentSections(content) {
  const sections = [];

  // First pass: Split by major delimiters
  const majorParts = content.split(/(?:={3,}|\-{5,})/);

  for (const majorPart of majorParts) {
    if (majorPart.trim().length < 50) continue;

    // Second pass: Split by command instruction blocks
    const commandBlocks = majorPart.split(/(?=Command\s+Instructions?:)/i);

    for (const block of commandBlocks) {
      if (block.trim().length < 50) continue;

      // Third pass: Split by "You must now" or "From this moment" patterns
      const instructionBlocks = block.split(/(?=(?:You\s+must\s+now|From\s+this\s+moment\s+forward|Whenever\s+(?:you|the\s+user)))/i);

      for (const instruction of instructionBlocks) {
        if (instruction.trim().length < 50) continue;

        // Fourth pass: Split by persona-specific headers
        const personaBlocks = instruction.split(/(?=(?:[A-Z][A-Z\s]+INSPIRE\s+[–-]|If\s+you\s+are\s+(?:Jubilee|Melody|Zariah|Elias|Eliana|Caleb|Imani|Zev|Amir|Nova|Santiago|Tahoma)))/i);

        for (const personaBlock of personaBlocks) {
          const trimmed = personaBlock.trim();
          if (trimmed.length >= 100) {
            // Final pass: Split overly long sections by paragraph groups
            if (trimmed.length > 4000) {
              const paragraphs = trimmed.split(/\n{2,}/);
              let currentChunk = '';

              for (const para of paragraphs) {
                if ((currentChunk + para).length > 3500 && currentChunk.length > 500) {
                  sections.push(currentChunk.trim());
                  currentChunk = para;
                } else {
                  currentChunk += (currentChunk ? '\n\n' : '') + para;
                }
              }

              if (currentChunk.trim().length >= 100) {
                sections.push(currentChunk.trim());
              }
            } else {
              sections.push(trimmed);
            }
          }
        }
      }
    }
  }

  // If no sections found, treat entire content as one section
  if (sections.length === 0 && content.trim().length >= 50) {
    // Try splitting by double newlines with size limit
    const paragraphs = content.split(/\n{2,}/);
    let currentSection = '';

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // Check for new logical section markers
      const isNewSection = /^(?:Command|You\s+must|From\s+this|Whenever|Stage\s+\d+|Year\s+\d+|Scroll\s+[IVX]+)/i.test(trimmed);

      if (isNewSection && currentSection.length > 200) {
        sections.push(currentSection.trim());
        currentSection = trimmed;
      } else if ((currentSection + trimmed).length > 3000) {
        if (currentSection.length > 200) {
          sections.push(currentSection.trim());
        }
        currentSection = trimmed;
      } else {
        currentSection += (currentSection ? '\n\n' : '') + trimmed;
      }
    }

    if (currentSection.trim().length >= 100) {
      sections.push(currentSection.trim());
    }
  }

  return sections.length > 0 ? sections : [content];
}

// Generate deterministic ID based on content hash
function generateDeterministicId(content, path, stepNumber) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256')
    .update(`${stepNumber}:${path}:${content.substring(0, 500)}`)
    .digest('hex')
    .substring(0, 32);

  // Convert to UUID format
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

// ============================================================================
// MAIN ENTRY CREATION
// ============================================================================

function createNormalizedEntry(section, stepNumber, sourceFile, sectionIndex) {
  const timestamp = new Date().toISOString();

  // Classify persona scope
  const scopeAnalysis = classifyPersonaScope(section);

  // Detect content type
  const contentType = detectContentType(section);

  // Extract cross-domain references
  const crossDomainRefs = extractCrossDomainReferences(section);

  // Determine primary path
  let primaryPath, category, subcategory, subsubcategory;

  if (scopeAnalysis.scope === 'individual' && scopeAnalysis.persona) {
    category = 'Personas';
    subcategory = 'Inspire';
    subsubcategory = scopeAnalysis.persona.firstName;
    primaryPath = `Personas/Inspire/${scopeAnalysis.persona.firstName}`;
  } else {
    category = 'Personas';
    subcategory = 'Inspire';
    subsubcategory = null;
    primaryPath = 'Personas/Inspire';
  }

  // Build metadata contract
  const metadata = {
    // Identity
    id: generateDeterministicId(section, primaryPath, stepNumber),

    // Taxonomy
    category: category,
    subcategory: subcategory,
    subsubcategory: subsubcategory,
    level: subsubcategory ? 'subsubcategory' : 'subcategory',
    path: primaryPath,

    // Scope & Inheritance
    persona_scope: scopeAnalysis.scope,
    execution_scope: scopeAnalysis.executionScope,
    is_inheritable: scopeAnalysis.executionScope !== EXECUTION_SCOPE.INDIVIDUAL,

    // Persona Details (if individual)
    persona_first_name: scopeAnalysis.persona?.firstName || null,
    persona_last_name: scopeAnalysis.persona?.lastName || null,
    persona_role: scopeAnalysis.persona?.role || null,
    persona_five_fold: scopeAnalysis.persona?.fiveFold || null,

    // Referenced Personas (for collective content that mentions specific personas)
    referenced_personas: scopeAnalysis.referencedPersonas || [],

    // Cross-Domain References (metadata links, not content duplication)
    cross_domain_refs: crossDomainRefs,
    abilities_refs: crossDomainRefs['Abilities'] || [],
    ministries_refs: crossDomainRefs['Ministries'] || [],
    guardrails_refs: crossDomainRefs['Guardrails'] || [],
    models_refs: crossDomainRefs['Models'] || [],
    jsv_bible_refs: crossDomainRefs['JSV Bible'] || [],
    languages_refs: crossDomainRefs['Languages'] || [],
    objects_refs: crossDomainRefs['Objects'] || [],

    // Content Classification
    content_type: contentType,

    // Source Tracking
    step_number: stepNumber,
    source_file: sourceFile,
    section_index: sectionIndex,

    // Timestamps
    created_at: timestamp,
    version: '1.0',

    // Content
    content: section.substring(0, 8000),
    content_length: section.length,

    // Description for embedding
    description: buildDescription(scopeAnalysis, contentType, stepNumber, crossDomainRefs)
  };

  return metadata;
}

function buildDescription(scopeAnalysis, contentType, stepNumber, crossDomainRefs) {
  let desc = `Step ${stepNumber} - `;

  if (scopeAnalysis.scope === 'individual' && scopeAnalysis.persona) {
    desc += `${scopeAnalysis.persona.firstName} Inspire specific ${contentType}`;
  } else {
    desc += `Inspire Family collective ${contentType}`;
  }

  // Add cross-domain context
  const refCategories = Object.keys(crossDomainRefs);
  if (refCategories.length > 0) {
    desc += ` | References: ${refCategories.join(', ')}`;
  }

  return desc;
}

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

async function ingestNormalizedStepFiles() {
  console.log('='.repeat(70));
  console.log('NORMALIZED STEP FILES INGESTION INTO JubileeVerse_vP');
  console.log('Deterministic, Metadata-Driven, Inheritance-Aware');
  console.log('='.repeat(70));

  try {
    // Verify collection exists
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      console.error(`\n[ERROR] Collection '${COLLECTION_NAME}' does not exist.`);
      process.exit(1);
    }

    // Clear existing step content (keep taxonomy)
    console.log('\nClearing existing step content (preserving taxonomy)...');
    try {
      await qdrant.delete(COLLECTION_NAME, {
        filter: {
          must: [
            { key: 'content_type', match: { value: 'taxonomy' } }
          ],
          must_not: []
        },
        must_not: true
      });
    } catch (e) {
      // Collection might not have step content yet
    }

    // Delete non-taxonomy entries
    const existingPoints = await qdrant.scroll(COLLECTION_NAME, {
      filter: {
        must_not: [
          { key: 'content_type', match: { value: 'taxonomy' } }
        ]
      },
      limit: 10000,
      with_payload: false
    });

    if (existingPoints.points.length > 0) {
      const idsToDelete = existingPoints.points.map(p => p.id);
      await qdrant.delete(COLLECTION_NAME, {
        points: idsToDelete
      });
      console.log(`  - Removed ${idsToDelete.length} existing step entries`);
    }

    // Get step files
    const personasDir = config.paths.personasDir;
    const files = await fs.readdir(personasDir);
    const stepFiles = files
      .filter(f => f.match(/inspire\.personas\.step\d{2}\.txt$/))
      .sort();

    console.log(`\nFound ${stepFiles.length} step files to process`);

    const stats = {
      totalSections: 0,
      collectiveEntries: 0,
      individualEntries: {},
      byContentType: {},
      crossDomainRefs: {
        Abilities: 0,
        Ministries: 0,
        Guardrails: 0,
        Models: 0,
        'JSV Bible': 0,
        Languages: 0,
        Objects: 0
      }
    };

    const allPoints = [];

    // Process each step file
    for (const stepFile of stepFiles) {
      const stepMatch = stepFile.match(/step(\d{2})/);
      const stepNumber = stepMatch ? parseInt(stepMatch[1]) : 0;

      console.log(`\nProcessing ${stepFile} (Step ${stepNumber})...`);

      const filePath = path.join(personasDir, stepFile);
      const content = await fs.readFile(filePath, 'utf-8');

      // Parse into logical sections
      const sections = parseContentSections(content);
      console.log(`  - Parsed into ${sections.length} logical sections`);

      // Process each section
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (section.length < 50) continue; // Skip trivial sections

        const entry = createNormalizedEntry(section, stepNumber, stepFile, i);
        stats.totalSections++;

        // Track stats
        if (entry.persona_scope === 'collective') {
          stats.collectiveEntries++;
        } else {
          const personaName = entry.persona_first_name;
          stats.individualEntries[personaName] = (stats.individualEntries[personaName] || 0) + 1;
        }

        stats.byContentType[entry.content_type] = (stats.byContentType[entry.content_type] || 0) + 1;

        // Track cross-domain references
        for (const category of Object.keys(stats.crossDomainRefs)) {
          if (entry.cross_domain_refs[category]?.length > 0) {
            stats.crossDomainRefs[category]++;
          }
        }

        process.stdout.write(`\r  - Processing section ${i + 1}/${sections.length}...`);

        // Generate embedding
        const embeddingText = `${entry.description}\n\n${entry.content.substring(0, 3000)}`;
        const embedding = await getEmbedding(embeddingText);

        allPoints.push({
          id: entry.id,
          vector: embedding,
          payload: entry
        });

        // Batch upsert every 50 points
        if (allPoints.length >= 50) {
          await qdrant.upsert(COLLECTION_NAME, { points: allPoints });
          allPoints.length = 0;
        }
      }

      console.log('');
    }

    // Upsert remaining points
    if (allPoints.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points: allPoints });
    }

    // Print comprehensive summary
    console.log('\n' + '='.repeat(70));
    console.log('INGESTION COMPLETE - SUMMARY');
    console.log('='.repeat(70));

    const info = await qdrant.getCollection(COLLECTION_NAME);
    console.log(`\nTotal points in collection: ${info.points_count}`);
    console.log(`Total sections processed: ${stats.totalSections}`);

    console.log('\n--- PERSONA SCOPE DISTRIBUTION ---');
    console.log(`Collective (Personas/Inspire): ${stats.collectiveEntries} entries`);
    console.log('\nIndividual Persona Entries:');
    for (const [persona, count] of Object.entries(stats.individualEntries).sort((a, b) => b[1] - a[1])) {
      console.log(`  - Personas/Inspire/${persona}: ${count} entries`);
    }

    console.log('\n--- CONTENT TYPE DISTRIBUTION ---');
    for (const [type, count] of Object.entries(stats.byContentType).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${type}: ${count}`);
    }

    console.log('\n--- CROSS-DOMAIN REFERENCES ---');
    console.log('(Metadata references, not content duplication)');
    for (const [category, count] of Object.entries(stats.crossDomainRefs).sort((a, b) => b[1] - a[1])) {
      if (count > 0) {
        console.log(`  - ${category}: ${count} entries reference this domain`);
      }
    }

    // Verify queryability
    console.log('\n--- QUERYABILITY VERIFICATION ---');

    // Test collective query
    const collectiveResult = await qdrant.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'persona_scope', match: { value: 'collective' } }
        ]
      },
      limit: 1,
      with_payload: true
    });
    console.log(`\nCollective content queryable: ${collectiveResult.points.length > 0 ? 'YES' : 'NO'}`);

    // Test inheritance query
    const inheritableResult = await qdrant.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'is_inheritable', match: { value: true } }
        ]
      },
      limit: 1,
      with_payload: true
    });
    console.log(`Inheritable content queryable: ${inheritableResult.points.length > 0 ? 'YES' : 'NO'}`);

    // Test cross-domain reference query
    const abilitiesRefResult = await qdrant.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'abilities_refs', match: { any: ['Pray', 'Teach', 'Heal'] } }
        ]
      },
      limit: 1,
      with_payload: true
    });
    console.log(`Cross-domain refs queryable: ${abilitiesRefResult.points.length > 0 ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    console.error(error.stack);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nCannot connect to Qdrant. Make sure Docker is running.');
    }
    process.exit(1);
  }
}

// Run
ingestNormalizedStepFiles().then(() => {
  console.log('\n' + '='.repeat(70));
  console.log('Normalized step files ingestion complete.');
  console.log('='.repeat(70));
}).catch(console.error);
