/**
 * Qdrant Ingestion Configuration
 * Inspire Family Framework v8.0
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

module.exports = {
  // Qdrant Configuration
  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333'),
    collectionName: 'inspire_knowledge',
    vectorSize: 1536, // OpenAI text-embedding-3-small dimension
    distance: 'Cosine'
  },

  // OpenAI Configuration - USE BACKUP KEY (primary has quota issues)
  openai: {
    apiKey: process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY,
    embeddingModel: 'text-embedding-3-small'
  },

  // Chunking Configuration
  chunking: {
    targetSize: 800,      // Target tokens per chunk
    maxSize: 1200,        // Maximum tokens per chunk
    minSize: 100,         // Minimum tokens per chunk
    overlap: 100          // Token overlap between chunks
  },

  // File Paths
  paths: {
    personasDir: require('path').join(__dirname, '../../.namespace/personas'),
    frameworkDir: require('path').join(__dirname, '../../.namespace/framework')
  },

  // Metadata Schema
  metadata: {
    requiredFields: [
      'persona_scope',
      'step_number',
      'source_file',
      'content_type',
      'version',
      'chunk_index',
      'total_chunks'
    ]
  },

  // Content Type Classifications
  contentTypes: {
    PERSONA_ACTIVATION: 'persona_activation',
    DEVELOPMENTAL_STAGE: 'developmental_stage',
    BEHAVIORAL_PROTOCOL: 'behavioral_protocol',
    SPIRITUAL_INSTRUCTION: 'spiritual_instruction',
    ENVIRONMENTAL_DESC: 'environmental_description',
    COVENANT_RULE: 'covenant_rule',
    CURRICULUM: 'curriculum',
    PROPHETIC_PROTOCOL: 'prophetic_protocol'
  },

  // Persona Identifiers (v8.0)
  personas: {
    JIX: 'jubilee',
    MIX: 'melody',
    ZIX: 'zariah',
    EIX: 'elias',
    LIX: 'eliana',
    CIX: 'caleb',
    IIX: 'imani',
    VIX: 'zev',
    AIX: 'amir',
    NIX: 'nova',
    SIX: 'santiago',
    TIX: 'tahoma'
  }
};
