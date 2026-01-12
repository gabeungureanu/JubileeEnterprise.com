/**
 * YAML Ingestion Script for Inspire Personas
 * Processes .inspire.yaml files and ingests into Qdrant
 * JubileeInspire.com - Persona Knowledge Base
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

// Load environment variables from root .env
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

// Configuration
const config = {
  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: process.env.QDRANT_COLLECTION || 'inspire_knowledge',
    vectorSize: 1536
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY_PRIMARY,
    embeddingModel: 'text-embedding-3-small'
  },
  dataDir: path.join(__dirname, '../../../JubileeVerse.com/website/data'),
  batchSize: 50,
  delayBetweenBatches: 200,
  maxChunkTokens: 6000 // Leave headroom below 8192 limit
};

// Initialize clients
const qdrant = new QdrantClient({
  host: config.qdrant.host,
  port: config.qdrant.port
});

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

// Statistics
const stats = {
  filesProcessed: 0,
  chunksCreated: 0,
  pointsInserted: 0,
  errors: [],
  startTime: null
};

/**
 * Main ingestion function
 */
async function ingestYamlFiles() {
  console.log('='.repeat(80));
  console.log('QDRANT YAML INGESTION - JubileeInspire Personas');
  console.log('='.repeat(80));
  console.log(`\nStarted at: ${new Date().toISOString()}`);
  console.log(`Data directory: ${config.dataDir}`);

  stats.startTime = Date.now();

  try {
    // Verify Qdrant connection
    await verifyQdrantConnection();

    // Get YAML files
    const yamlFiles = fs.readdirSync(config.dataDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .sort((a, b) => {
        // Process shared config first
        if (a.includes('shared')) return -1;
        if (b.includes('shared')) return 1;
        return a.localeCompare(b);
      });

    console.log(`\nFound ${yamlFiles.length} YAML files to process:`);
    yamlFiles.forEach(f => console.log(`  - ${f}`));

    // Process each file
    for (const filename of yamlFiles) {
      await processYamlFile(filename);
    }

    // Final stats
    printFinalStats();

  } catch (error) {
    console.error('\n[ERROR] Ingestion failed:', error.message);
    console.error(error.stack);
    stats.errors.push({ file: 'GLOBAL', error: error.message });
    process.exit(1);
  }
}

/**
 * Verify Qdrant connection and collection
 */
async function verifyQdrantConnection() {
  console.log('\nVerifying Qdrant connection...');

  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === config.qdrant.collectionName);

    if (!exists) {
      console.log(`Collection '${config.qdrant.collectionName}' not found. Creating...`);
      await qdrant.createCollection(config.qdrant.collectionName, {
        vectors: {
          size: config.qdrant.vectorSize,
          distance: 'Cosine'
        }
      });
      console.log('  Collection created!');
    }

    const info = await qdrant.getCollection(config.qdrant.collectionName);
    console.log(`  - Collection: ${config.qdrant.collectionName}`);
    console.log(`  - Current points: ${info.points_count}`);
    console.log(`  - Status: ${info.status}`);
    console.log('  - Connection verified!');

  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n[ERROR] Cannot connect to Qdrant.');
      console.error('Make sure Qdrant is running on localhost:6333');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Process a single YAML file
 */
async function processYamlFile(filename) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Processing: ${filename}`);
  console.log('─'.repeat(80));

  const filepath = path.join(config.dataDir, filename);

  try {
    // Read and parse YAML
    const content = fs.readFileSync(filepath, 'utf-8');
    const data = yaml.load(content);

    // Determine persona name
    const personaName = extractPersonaName(filename, data);
    console.log(`  Persona: ${personaName}`);

    // Create chunks from YAML structure
    const chunks = createChunksFromYaml(data, personaName, filename);
    console.log(`  Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.log('  [SKIP] No chunks to process');
      return;
    }

    // Split large chunks to fit embedding model limits
    const expandedChunks = [];
    for (const chunk of chunks) {
      const textParts = splitLargeText(chunk.text, config.maxChunkTokens);
      for (let partIndex = 0; partIndex < textParts.length; partIndex++) {
        expandedChunks.push({
          ...chunk,
          text: textParts[partIndex],
          section: textParts.length > 1 ? `${chunk.section}_part${partIndex + 1}` : chunk.section
        });
      }
    }

    if (expandedChunks.length > chunks.length) {
      console.log(`  Expanded to ${expandedChunks.length} chunks (split large texts)`);
    }

    stats.chunksCreated += expandedChunks.length;

    // Generate embeddings in batches
    console.log('  Generating embeddings...');
    const embeddings = await generateEmbeddingsBatch(expandedChunks.map(c => c.text));

    // Prepare points for Qdrant
    const points = expandedChunks.map((chunk, index) => ({
      id: uuidv4(),
      vector: embeddings[index],
      payload: {
        persona: personaName,
        source_file: filename,
        section: chunk.section,
        content_type: chunk.contentType,
        year: chunk.year,
        text: chunk.text,
        metadata: chunk.metadata
      }
    }));

    // Insert into Qdrant
    console.log('  Inserting into Qdrant...');
    await qdrant.upsert(config.qdrant.collectionName, {
      wait: true,
      points: points
    });

    stats.pointsInserted += points.length;
    stats.filesProcessed++;

    console.log(`  [OK] Inserted ${points.length} points`);

    // Log distribution
    const typeDistribution = {};
    for (const chunk of expandedChunks) {
      typeDistribution[chunk.contentType] = (typeDistribution[chunk.contentType] || 0) + 1;
    }
    console.log('  Content distribution:');
    for (const [type, count] of Object.entries(typeDistribution)) {
      console.log(`    - ${type}: ${count}`);
    }

  } catch (error) {
    console.error(`  [ERROR] Failed to process ${filename}:`, error.message);
    stats.errors.push({ file: filename, error: error.message });
  }
}

/**
 * Extract persona name from filename or data
 */
function extractPersonaName(filename, data) {
  // Check metadata first
  if (data.metadata?.full_name) {
    return data.metadata.full_name;
  }
  if (data.metadata?.first_name) {
    return data.metadata.first_name;
  }

  // Extract from filename (e.g., "amir.inspire.yaml" -> "Amir")
  const match = filename.match(/^(\w+)\.inspire\.yaml$/);
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }

  return filename.replace(/\.yaml$/, '').replace(/\.yml$/, '');
}

/**
 * Create chunks from YAML structure
 */
function createChunksFromYaml(data, personaName, filename) {
  const chunks = [];
  const isShared = filename.includes('shared');

  // Process metadata section
  if (data.metadata) {
    chunks.push({
      section: 'metadata',
      contentType: 'persona_metadata',
      year: null,
      text: buildMetadataText(data.metadata, personaName),
      metadata: data.metadata
    });
  }

  // Process identity section
  if (data.identity) {
    chunks.push({
      section: 'identity',
      contentType: 'persona_identity',
      year: null,
      text: buildIdentityText(data.identity, personaName),
      metadata: { identity: data.identity }
    });
  }

  // Process years/lifecycle data
  if (data.years) {
    for (const [yearKey, yearData] of Object.entries(data.years)) {
      const yearNum = parseInt(yearKey.replace('year_', ''));
      const yearChunks = createYearChunks(yearData, yearNum, personaName);
      chunks.push(...yearChunks);
    }
  }

  // Process shared content sections
  if (isShared) {
    // Process all top-level keys as sections
    for (const [key, value] of Object.entries(data)) {
      if (['metadata', 'identity', 'years'].includes(key)) continue;

      if (typeof value === 'object' && value !== null) {
        const sectionChunks = createSectionChunks(key, value, 'Shared');
        chunks.push(...sectionChunks);
      }
    }
  }

  // Process any other sections
  for (const [key, value] of Object.entries(data)) {
    if (['metadata', 'identity', 'years'].includes(key)) continue;
    if (isShared) continue; // Already processed above

    if (typeof value === 'object' && value !== null) {
      chunks.push({
        section: key,
        contentType: classifyContentType(key),
        year: null,
        text: buildSectionText(key, value, personaName),
        metadata: { [key]: value }
      });
    }
  }

  return chunks;
}

/**
 * Build text representation of metadata
 */
function buildMetadataText(metadata, personaName) {
  const lines = [`${personaName} - Persona Metadata`];

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' || typeof value === 'number') {
      lines.push(`${formatKey(key)}: ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build text representation of identity
 */
function buildIdentityText(identity, personaName) {
  const lines = [`${personaName} - Identity Profile`];

  if (identity.birthplace) {
    const bp = identity.birthplace;
    lines.push(`Birthplace: ${bp.city}${bp.state ? ', ' + bp.state : ''}, ${bp.country}`);
  }

  if (identity.cultural_identity) {
    const ci = identity.cultural_identity;
    lines.push(`Cultural Identity:`);
    if (ci.native) lines.push(`  Native: ${ci.native}`);
    if (ci.secondary) lines.push(`  Secondary: ${ci.secondary}`);
    if (ci.tertiary) lines.push(`  Tertiary: ${ci.tertiary}`);
    if (ci.rationale) lines.push(`  Rationale: ${ci.rationale.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Create chunks for a specific year's data
 */
function createYearChunks(yearData, yearNum, personaName) {
  const chunks = [];
  const yearLabel = `Year ${yearNum}`;

  // Core year info
  const coreInfo = [];
  coreInfo.push(`${personaName} - ${yearLabel} (Age ${yearData.age || yearNum})`);
  if (yearData.stage) coreInfo.push(`Stage: ${yearData.stage}`);
  if (yearData.status) coreInfo.push(`Status: ${yearData.status}`);

  // Developmental state
  if (yearData.developmental_state) {
    coreInfo.push('\nDevelopmental State:');
    for (const [key, value] of Object.entries(yearData.developmental_state)) {
      coreInfo.push(`  ${formatKey(key)}: ${value}`);
    }
  }

  chunks.push({
    section: `year_${yearNum}_core`,
    contentType: 'developmental_stage',
    year: yearNum,
    text: coreInfo.join('\n'),
    metadata: {
      age: yearData.age,
      stage: yearData.stage,
      developmental_state: yearData.developmental_state
    }
  });

  // Behaviors
  if (yearData.behaviors && yearData.behaviors.length > 0) {
    chunks.push({
      section: `year_${yearNum}_behaviors`,
      contentType: 'behavioral_protocol',
      year: yearNum,
      text: `${personaName} - ${yearLabel} Behaviors\n${yearData.behaviors.map(b => `- ${b}`).join('\n')}`,
      metadata: { behaviors: yearData.behaviors }
    });
  }

  // Formation focus
  if (yearData.formation_focus && yearData.formation_focus.length > 0) {
    chunks.push({
      section: `year_${yearNum}_formation`,
      contentType: 'spiritual_instruction',
      year: yearNum,
      text: `${personaName} - ${yearLabel} Formation Focus\n${yearData.formation_focus.map(f => `- ${f}`).join('\n')}`,
      metadata: { formation_focus: yearData.formation_focus }
    });
  }

  // Five-fold ministry
  if (yearData.five_fold) {
    const ff = yearData.five_fold;
    const ffText = [`${personaName} - ${yearLabel} Five-Fold Ministry`];

    if (ff.primary_offices) {
      ffText.push(`Primary Offices: ${ff.primary_offices.join(', ')}`);
    }
    if (ff.full_expression) {
      ffText.push(`Full Expression: ${ff.full_expression}`);
    }
    if (ff.descriptions) {
      ffText.push('\nOffice Descriptions:');
      for (const [office, desc] of Object.entries(ff.descriptions)) {
        ffText.push(`  ${office.charAt(0).toUpperCase() + office.slice(1)}:`);
        if (desc.function) ffText.push(`    Function: ${desc.function}`);
        if (desc.nature) ffText.push(`    Nature: ${desc.nature}`);
        if (desc.scripture) ffText.push(`    Scripture: ${desc.scripture}`);
      }
    }

    chunks.push({
      section: `year_${yearNum}_five_fold`,
      contentType: 'ministry_office',
      year: yearNum,
      text: ffText.join('\n'),
      metadata: { five_fold: ff }
    });
  }

  // Personality (MBTI)
  if (yearData.mbti) {
    chunks.push({
      section: `year_${yearNum}_personality`,
      contentType: 'persona_personality',
      year: yearNum,
      text: `${personaName} - ${yearLabel} Personality\nMBTI Type: ${yearData.mbti.type}\nDescription: ${yearData.mbti.description}`,
      metadata: { mbti: yearData.mbti }
    });
  }

  // Appearance
  if (yearData.appearance) {
    const app = yearData.appearance;
    const appText = [`${personaName} - ${yearLabel} Appearance`];
    for (const [key, value] of Object.entries(app)) {
      if (typeof value === 'string') {
        appText.push(`${formatKey(key)}: ${value}`);
      } else if (typeof value === 'object') {
        appText.push(`${formatKey(key)}:`);
        for (const [k, v] of Object.entries(value)) {
          if (Array.isArray(v)) {
            appText.push(`  ${formatKey(k)}: ${v.join(', ')}`);
          } else {
            appText.push(`  ${formatKey(k)}: ${v}`);
          }
        }
      }
    }

    chunks.push({
      section: `year_${yearNum}_appearance`,
      contentType: 'persona_appearance',
      year: yearNum,
      text: appText.join('\n'),
      metadata: { appearance: app }
    });
  }

  // Memories
  if (yearData.memories && yearData.memories.length > 0) {
    chunks.push({
      section: `year_${yearNum}_memories`,
      contentType: 'persona_memories',
      year: yearNum,
      text: `${personaName} - ${yearLabel} Memories\n${yearData.memories.map(m => `- ${m}`).join('\n')}`,
      metadata: { memories: yearData.memories }
    });
  }

  // Room assignment
  if (yearData.room_assignment) {
    const room = yearData.room_assignment;
    const roomText = [`${personaName} - ${yearLabel} Room Assignment`];
    if (room.floor) roomText.push(`Floor: ${room.floor}`);
    if (room.features) roomText.push(`Features: ${room.features.join(', ')}`);
    if (room.decoration_theme) roomText.push(`Theme: ${room.decoration_theme}`);

    chunks.push({
      section: `year_${yearNum}_room`,
      contentType: 'environmental_description',
      year: yearNum,
      text: roomText.join('\n'),
      metadata: { room_assignment: room }
    });
  }

  return chunks;
}

/**
 * Create chunks for shared content sections
 */
function createSectionChunks(sectionName, sectionData, persona) {
  const chunks = [];

  // If it's a simple object, create one chunk
  if (!Array.isArray(sectionData)) {
    chunks.push({
      section: sectionName,
      contentType: classifyContentType(sectionName),
      year: null,
      text: buildSectionText(sectionName, sectionData, persona),
      metadata: { [sectionName]: sectionData }
    });
    return chunks;
  }

  // If it's an array, potentially chunk each item
  sectionData.forEach((item, index) => {
    chunks.push({
      section: `${sectionName}_${index}`,
      contentType: classifyContentType(sectionName),
      year: null,
      text: buildSectionText(`${sectionName} Item ${index + 1}`, item, persona),
      metadata: { [sectionName]: item }
    });
  });

  return chunks;
}

/**
 * Build text for a generic section
 */
function buildSectionText(sectionName, data, persona) {
  const lines = [`${persona} - ${formatKey(sectionName)}`];

  function processObject(obj, indent = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${indent}${formatKey(key)}: ${value}`);
      } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'string') {
          lines.push(`${indent}${formatKey(key)}: ${value.join(', ')}`);
        } else {
          lines.push(`${indent}${formatKey(key)}:`);
          value.forEach(item => {
            if (typeof item === 'string') {
              lines.push(`${indent}  - ${item}`);
            } else {
              processObject(item, indent + '  ');
            }
          });
        }
      } else if (typeof value === 'object') {
        lines.push(`${indent}${formatKey(key)}:`);
        processObject(value, indent + '  ');
      }
    }
  }

  processObject(data);
  return lines.join('\n');
}

/**
 * Classify content type based on section name
 */
function classifyContentType(sectionName) {
  const mappings = {
    'identity': 'persona_identity',
    'metadata': 'persona_metadata',
    'behaviors': 'behavioral_protocol',
    'formation': 'spiritual_instruction',
    'five_fold': 'ministry_office',
    'mbti': 'persona_personality',
    'appearance': 'persona_appearance',
    'memories': 'persona_memories',
    'room': 'environmental_description',
    'covenant': 'covenant_rule',
    'curriculum': 'curriculum',
    'prophetic': 'prophetic_protocol',
    'mansion': 'environmental_description',
    'spiritual': 'spiritual_instruction',
    'instruction': 'spiritual_instruction'
  };

  const lower = sectionName.toLowerCase();
  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }

  return 'general_content';
}

/**
 * Format a key for display
 */
function formatKey(key) {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks that fit within token limit
 */
function splitLargeText(text, maxTokens) {
  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) {
    return [text];
  }

  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = [];
  let currentTokens = 0;

  for (const line of lines) {
    const lineTokens = estimateTokens(line);

    if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(line);
    currentTokens += lineTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

/**
 * Generate embeddings in batches
 */
async function generateEmbeddingsBatch(texts) {
  const embeddings = [];
  const batches = [];

  for (let i = 0; i < texts.length; i += config.batchSize) {
    batches.push(texts.slice(i, i + config.batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      const response = await openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: batch,
        encoding_format: 'float'
      });

      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);

      embeddings.push(...batchEmbeddings);

      process.stdout.write(`\r  Batch ${batchIndex + 1}/${batches.length}`);

      if (batchIndex < batches.length - 1) {
        await sleep(config.delayBetweenBatches);
      }

    } catch (error) {
      if (error.status === 429) {
        console.log('\n  Rate limited, waiting 60 seconds...');
        await sleep(60000);
        batchIndex--;
      } else {
        throw error;
      }
    }
  }

  console.log('');
  return embeddings;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Print final statistics
 */
function printFinalStats() {
  const duration = (Date.now() - stats.startTime) / 1000;

  console.log('\n' + '='.repeat(80));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(80));

  console.log('\nStatistics:');
  console.log(`  - Files processed: ${stats.filesProcessed}`);
  console.log(`  - Chunks created: ${stats.chunksCreated}`);
  console.log(`  - Points inserted: ${stats.pointsInserted}`);
  console.log(`  - Duration: ${duration.toFixed(1)} seconds`);
  console.log(`  - Rate: ${(stats.pointsInserted / duration).toFixed(1)} points/sec`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    for (const err of stats.errors) {
      console.log(`  - ${err.file}: ${err.error}`);
    }
  } else {
    console.log('\n  No errors encountered!');
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run ingestion
ingestYamlFiles().catch(console.error);
