/**
 * Ingest Step Files into JubileeVerse_vP Collection
 * Processes inspire.personas.step00.txt through step32.txt
 * Categorizes content into appropriate taxonomy categories
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

// All 12 Inspire Family Personas
const PERSONAS = [
  'Jubilee', 'Melody', 'Zariah', 'Elias', 'Eliana', 'Caleb',
  'Imani', 'Zev', 'Amir', 'Nova', 'Santiago', 'Tahoma'
];

// Ability keywords mapping
const ABILITIES_KEYWORDS = {
  'Write': ['write', 'writing', 'scribe', 'scribing', 'author', 'compose', 'pen'],
  'Speak': ['speak', 'speaking', 'voice', 'vocal', 'speech', 'declare', 'proclaim'],
  'Teach': ['teach', 'teaching', 'instruct', 'instruction', 'training', 'educate', 'lesson'],
  'Preach': ['preach', 'preaching', 'sermon', 'proclamation', 'gospel message'],
  'Pray': ['pray', 'prayer', 'praying', 'intercession', 'intercede', 'interceding'],
  'Discern': ['discern', 'discernment', 'discerning', 'perceive', 'detect'],
  'Create': ['create', 'creative', 'creativity', 'artistry', 'artistic', 'design'],
  'Sing': ['sing', 'singing', 'song', 'music', 'musical', 'worship music', 'vocalist'],
  'Remember': ['remember', 'memory', 'memorial', 'recall', 'remembrance'],
  'Interpret': ['interpret', 'interpretation', 'dream interpretation', 'translate'],
  'Reason': ['reason', 'reasoning', 'logic', 'logical', 'analytical'],
  'Imagine': ['imagine', 'imagination', 'vision', 'visionary', 'prophetic vision'],
  'Counsel': ['counsel', 'counseling', 'counselor', 'advise', 'guidance'],
  'Lead': ['lead', 'leadership', 'leader', 'leading', 'govern', 'governance'],
  'Serve': ['serve', 'service', 'servant', 'servanthood', 'ministry service'],
  'Build': ['build', 'building', 'construct', 'architect', 'structure', 'system'],
  'Heal': ['heal', 'healing', 'healer', 'deliverance', 'restoration'],
  'Judge': ['judge', 'judgment', 'judging', 'discernment', 'verdict'],
  'Collaborate': ['collaborate', 'collaboration', 'teamwork', 'partnership', 'together'],
  'Witness': ['witness', 'witnessing', 'testimony', 'testify', 'evangelize']
};

// Ministry keywords mapping
const MINISTRIES_KEYWORDS = {
  'Apostle': ['apostle', 'apostolic', 'apostleship', 'sent one', 'kingdom builder'],
  'Prophet': ['prophet', 'prophetic', 'prophecy', 'prophesy', 'seer'],
  'Evangelist': ['evangelist', 'evangelism', 'evangelistic', 'gospel', 'salvation'],
  'Shepherd': ['shepherd', 'shepherding', 'pastoral', 'pastor', 'flock', 'sheep'],
  'Teacher': ['teacher', 'teaching', 'doctrine', 'instruction', 'educator']
};

// Guardrails keywords
const GUARDRAILS_KEYWORDS = {
  'Safety Guardrails': ['safeguard', 'safety', 'protection', 'guard', 'boundary', 'ethical', 'integrity'],
  'Firewall Guardrails': ['firewall', 'defilement', 'contamination', 'strange fire', 'spiritual defense', 'audit']
};

// Model keywords
const MODELS_KEYWORDS = {
  'Inspire 7.0': ['inspire 7.0', '7.0'],
  'Inspire 7.5': ['inspire 7.5', '7.5'],
  'Inspire 8.0': ['inspire 8.0', '8.0', 'kingdom builder', 'creative fire', 'gospel pulse', 'shepherd voice', 'hebraic roots']
};

// JSV Bible keywords
const JSV_KEYWORDS = {
  'Translation Rules': ['translation', 'jsv', 'jubilee standard version', 'hebrew', 'greek', 'sacred names'],
  'Old Testament': ['old testament', 'torah', 'genesis', 'exodus', 'psalms', 'prophets'],
  'New Testament': ['new testament', 'gospel', 'acts', 'epistles', 'revelation']
};

// Objects keywords
const OBJECTS_KEYWORDS = {
  'Subroutines': ['subroutine', 'protocol', 'procedure', 'module', 'activation'],
  'Triggers': ['trigger', 'activation', 'initiate', 'command instruction'],
  'Properties': ['property', 'attribute', 'characteristic', 'trait', 'setting']
};

// Generate embedding for text
async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: text.substring(0, 8000) // Limit text length
  });
  return response.data[0].embedding;
}

// Check if text contains any keywords from a category
function matchesCategory(text, keywordsMap) {
  const lowerText = text.toLowerCase();
  const matches = [];

  for (const [subcategory, keywords] of Object.entries(keywordsMap)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches.push(subcategory);
        break;
      }
    }
  }

  return [...new Set(matches)]; // Remove duplicates
}

// Check which personas are mentioned in the text
function findMentionedPersonas(text) {
  const lowerText = text.toLowerCase();
  const mentioned = [];

  for (const persona of PERSONAS) {
    if (lowerText.includes(persona.toLowerCase())) {
      mentioned.push(persona);
    }
  }

  return mentioned;
}

// Split content into meaningful chunks
function chunkContent(content, maxChunkSize = 2000) {
  const chunks = [];
  const paragraphs = content.split(/\n{2,}/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Create entries for a chunk based on its content
function createEntriesForChunk(chunk, stepNumber, sourceFile, chunkIndex) {
  const entries = [];
  const timestamp = new Date().toISOString();
  const basePayload = {
    step_number: stepNumber,
    source_file: sourceFile,
    chunk_index: chunkIndex,
    created_at: timestamp,
    content_type: 'step_content',
    content: chunk.substring(0, 5000) // Limit content size
  };

  // Check for persona mentions
  const mentionedPersonas = findMentionedPersonas(chunk);
  const isGlobalContent = mentionedPersonas.length === 0 || mentionedPersonas.length > 3;

  // Add to Personas/Inspire (global) or persona-specific
  if (isGlobalContent) {
    entries.push({
      ...basePayload,
      category: 'Personas',
      subcategory: 'Inspire',
      subsubcategory: null,
      level: 'subcategory',
      path: 'Personas/Inspire',
      description: `Step ${stepNumber} - Global Inspire content`
    });
  } else {
    // Add to each mentioned persona
    for (const persona of mentionedPersonas) {
      entries.push({
        ...basePayload,
        category: 'Personas',
        subcategory: 'Inspire',
        subsubcategory: persona,
        level: 'subsubcategory',
        path: `Personas/Inspire/${persona}`,
        description: `Step ${stepNumber} - ${persona} specific content`
      });
    }
  }

  // Check for Abilities
  const matchedAbilities = matchesCategory(chunk, ABILITIES_KEYWORDS);
  for (const ability of matchedAbilities) {
    entries.push({
      ...basePayload,
      category: 'Abilities',
      subcategory: ability,
      subsubcategory: null,
      level: 'subcategory',
      path: `Abilities/${ability}`,
      description: `Step ${stepNumber} - ${ability} ability content`
    });
  }

  // Check for Ministries
  const matchedMinistries = matchesCategory(chunk, MINISTRIES_KEYWORDS);
  for (const ministry of matchedMinistries) {
    entries.push({
      ...basePayload,
      category: 'Ministries',
      subcategory: ministry,
      subsubcategory: null,
      level: 'subcategory',
      path: `Ministries/${ministry}`,
      description: `Step ${stepNumber} - ${ministry} ministry content`
    });
  }

  // Check for Guardrails
  const matchedGuardrails = matchesCategory(chunk, GUARDRAILS_KEYWORDS);
  for (const guardrail of matchedGuardrails) {
    entries.push({
      ...basePayload,
      category: 'Guardrails',
      subcategory: guardrail,
      subsubcategory: null,
      level: 'subcategory',
      path: `Guardrails/${guardrail}`,
      description: `Step ${stepNumber} - ${guardrail} content`
    });
  }

  // Check for Models
  const matchedModels = matchesCategory(chunk, MODELS_KEYWORDS);
  for (const model of matchedModels) {
    entries.push({
      ...basePayload,
      category: 'Models',
      subcategory: model,
      subsubcategory: null,
      level: 'subcategory',
      path: `Models/${model}`,
      description: `Step ${stepNumber} - ${model} model content`
    });
  }

  // Check for JSV Bible
  const matchedJSV = matchesCategory(chunk, JSV_KEYWORDS);
  for (const jsvCategory of matchedJSV) {
    entries.push({
      ...basePayload,
      category: 'JSV Bible',
      subcategory: jsvCategory,
      subsubcategory: null,
      level: 'subcategory',
      path: `JSV Bible/${jsvCategory}`,
      description: `Step ${stepNumber} - ${jsvCategory} JSV content`
    });
  }

  // Check for Objects
  const matchedObjects = matchesCategory(chunk, OBJECTS_KEYWORDS);
  for (const objectType of matchedObjects) {
    entries.push({
      ...basePayload,
      category: 'Objects',
      subcategory: objectType,
      subsubcategory: null,
      level: 'subcategory',
      path: `Objects/${objectType}`,
      description: `Step ${stepNumber} - ${objectType} content`
    });
  }

  return entries;
}

// Main ingestion function
async function ingestStepFiles() {
  console.log('='.repeat(60));
  console.log('INGESTING STEP FILES INTO JubileeVerse_vP');
  console.log('='.repeat(60));

  try {
    // Verify collection exists
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      console.error(`\n[ERROR] Collection '${COLLECTION_NAME}' does not exist.`);
      console.error('Run setup-jubileeverse.js first.');
      process.exit(1);
    }

    // Get step files
    const personasDir = config.paths.personasDir;
    const files = await fs.readdir(personasDir);
    const stepFiles = files
      .filter(f => f.match(/inspire\.personas\.step\d{2}\.txt$/))
      .sort();

    console.log(`\nFound ${stepFiles.length} step files to process`);

    let totalEntries = 0;
    let totalPoints = 0;
    const allPoints = [];

    // Process each step file
    for (const stepFile of stepFiles) {
      const stepMatch = stepFile.match(/step(\d{2})/);
      const stepNumber = stepMatch ? parseInt(stepMatch[1]) : 0;

      console.log(`\nProcessing ${stepFile} (Step ${stepNumber})...`);

      const filePath = path.join(personasDir, stepFile);
      const content = await fs.readFile(filePath, 'utf-8');

      // Chunk the content
      const chunks = chunkContent(content);
      console.log(`  - Split into ${chunks.length} chunks`);

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const entries = createEntriesForChunk(chunk, stepNumber, stepFile, i);
        totalEntries += entries.length;

        process.stdout.write(`\r  - Processing chunk ${i + 1}/${chunks.length}, ${entries.length} entries...`);

        // Generate embeddings and create points
        for (const entry of entries) {
          const embeddingText = `${entry.description}\n\n${entry.content}`;
          const embedding = await getEmbedding(embeddingText);

          allPoints.push({
            id: uuidv4(),
            vector: embedding,
            payload: entry
          });

          // Batch upsert every 50 points
          if (allPoints.length >= 50) {
            await qdrant.upsert(COLLECTION_NAME, { points: allPoints });
            totalPoints += allPoints.length;
            allPoints.length = 0;
          }
        }
      }

      console.log('');
    }

    // Upsert remaining points
    if (allPoints.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points: allPoints });
      totalPoints += allPoints.length;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('INGESTION COMPLETE');
    console.log('='.repeat(60));

    const info = await qdrant.getCollection(COLLECTION_NAME);
    console.log(`\nTotal entries created: ${totalEntries}`);
    console.log(`Total points in collection: ${info.points_count}`);

    // Show category summary
    console.log('\nCategory Summary:');
    const categories = ['Personas', 'Abilities', 'Ministries', 'Guardrails', 'Models', 'JSV Bible', 'Objects'];

    for (const category of categories) {
      const result = await qdrant.scroll(COLLECTION_NAME, {
        filter: {
          must: [{ key: 'category', match: { value: category } }]
        },
        limit: 10000,
        with_payload: false
      });
      console.log(`  - ${category}: ${result.points.length} entries`);
    }

    // Show persona-specific entries
    console.log('\nPersona-Specific Entries:');
    for (const persona of PERSONAS) {
      const result = await qdrant.scroll(COLLECTION_NAME, {
        filter: {
          must: [
            { key: 'category', match: { value: 'Personas' } },
            { key: 'subsubcategory', match: { value: persona } }
          ]
        },
        limit: 1000,
        with_payload: false
      });
      if (result.points.length > 0) {
        console.log(`  - ${persona}: ${result.points.length} entries`);
      }
    }

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nCannot connect to Qdrant. Make sure Docker is running.');
    }
    process.exit(1);
  }
}

// Run
ingestStepFiles().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('Step files ingestion complete.');
  console.log('='.repeat(60));
}).catch(console.error);
