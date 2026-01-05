/**
 * Populate JubileeVerse_vP Collection with Category Structure
 * Creates taxonomy entries for the JubileeVerse knowledge base
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
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

// Define the complete taxonomy structure
const TAXONOMY = {
  'Abilities': [
    'Write',
    'Speak',
    'Teach',
    'Preach',
    'Pray',
    'Discern',
    'Create',
    'Sing',
    'Remember',
    'Interpret',
    'Reason',
    'Imagine',
    'Counsel',
    'Lead',
    'Serve',
    'Build',
    'Heal',
    'Judge',
    'Collaborate',
    'Witness'
  ],
  'Campaigns': [],  // Placeholder
  'Communities': [],  // Placeholder
  'Guardrails': [
    'Safety Guardrails',
    'Firewall Guardrails'
  ],
  'JSV Bible': [
    'Translation Rules',
    'Old Testament',
    'New Testament'
  ],
  'Jubilee Verse': [],  // Placeholder
  'Languages': {
    'English': ['Translation Rules'],
    'Romanian': ['Translation Rules']
  },
  'Ministries': [
    'Apostle',
    'Prophet',
    'Evangelist',
    'Shepherd',
    'Teacher'
  ],
  'Models': {
    'Inspire 7.0': [],
    'Inspire 7.5': [],
    'Inspire 8.0': [
      'Kingdom Builder',
      'Creative Fire',
      'Gospel Pulse',
      'Shepherd Voice',
      'Hebraic Roots'
    ]
  },
  'Objects': [
    'Subroutines',
    'Triggers',
    'Properties'
  ],
  'Personas': {
    'Inspire': [
      'Jubilee',
      'Melody',
      'Zariah',
      'Elias',
      'Eliana',
      'Caleb',
      'Imani',
      'Zev',
      'Amir',
      'Nova',
      'Santiago',
      'Tahoma'
    ]
  },
  'Users': []  // Identified by Email Address - placeholder
};

// Generate embedding for text
async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: text
  });
  return response.data[0].embedding;
}

// Build all taxonomy entries
function buildTaxonomyEntries() {
  const entries = [];
  const timestamp = new Date().toISOString();

  for (const [category, value] of Object.entries(TAXONOMY)) {
    // Add category entry
    entries.push({
      category: category,
      subcategory: null,
      subsubcategory: null,
      level: 'category',
      path: category,
      description: `Root category: ${category}`,
      created_at: timestamp,
      content_type: 'taxonomy'
    });

    if (Array.isArray(value)) {
      // Simple subcategories
      for (const subcategory of value) {
        entries.push({
          category: category,
          subcategory: subcategory,
          subsubcategory: null,
          level: 'subcategory',
          path: `${category}/${subcategory}`,
          description: `${category} > ${subcategory}`,
          created_at: timestamp,
          content_type: 'taxonomy'
        });
      }
    } else if (typeof value === 'object') {
      // Nested subcategories with their own children
      for (const [subcategory, subchildren] of Object.entries(value)) {
        entries.push({
          category: category,
          subcategory: subcategory,
          subsubcategory: null,
          level: 'subcategory',
          path: `${category}/${subcategory}`,
          description: `${category} > ${subcategory}`,
          created_at: timestamp,
          content_type: 'taxonomy'
        });

        if (Array.isArray(subchildren)) {
          for (const subsubcategory of subchildren) {
            entries.push({
              category: category,
              subcategory: subcategory,
              subsubcategory: subsubcategory,
              level: 'subsubcategory',
              path: `${category}/${subcategory}/${subsubcategory}`,
              description: `${category} > ${subcategory} > ${subsubcategory}`,
              created_at: timestamp,
              content_type: 'taxonomy'
            });
          }
        }
      }
    }
  }

  return entries;
}

async function populateCollection() {
  console.log('='.repeat(60));
  console.log('POPULATING JubileeVerse_vP WITH TAXONOMY STRUCTURE');
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

    // Build taxonomy entries
    const entries = buildTaxonomyEntries();
    console.log(`\nBuilt ${entries.length} taxonomy entries`);

    // Create payload indexes for filtering
    console.log('\nCreating additional payload indexes...');
    const indexFields = [
      { field: 'category', type: 'keyword' },
      { field: 'subcategory', type: 'keyword' },
      { field: 'subsubcategory', type: 'keyword' },
      { field: 'level', type: 'keyword' },
      { field: 'path', type: 'keyword' }
    ];

    for (const { field, type } of indexFields) {
      try {
        await qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: field,
          field_schema: type
        });
        console.log(`  - Created index: ${field}`);
      } catch (err) {
        // Index may already exist
      }
    }

    // Generate embeddings and upsert points
    console.log('\nGenerating embeddings and upserting points...');
    const points = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      process.stdout.write(`\r  Processing ${i + 1}/${entries.length}: ${entry.path.substring(0, 40).padEnd(40)}`);

      // Generate embedding from the path/description
      const embedding = await getEmbedding(entry.description);

      points.push({
        id: uuidv4(),
        vector: embedding,
        payload: entry
      });

      // Batch upsert every 50 points
      if (points.length >= 50) {
        await qdrant.upsert(COLLECTION_NAME, { points });
        points.length = 0;
      }
    }

    // Upsert remaining points
    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points });
    }

    console.log('\n');

    // Verify
    const info = await qdrant.getCollection(COLLECTION_NAME);
    console.log('\n[OK] Taxonomy structure populated successfully!');
    console.log(`  - Total points: ${info.points_count}`);

    // Show summary by category
    console.log('\nCategory Summary:');
    for (const category of Object.keys(TAXONOMY)) {
      const result = await qdrant.scroll(COLLECTION_NAME, {
        filter: {
          must: [{ key: 'category', match: { value: category } }]
        },
        limit: 1000,
        with_payload: false
      });
      console.log(`  - ${category}: ${result.points.length} entries`);
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
populateCollection().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('JubileeVerse_vP taxonomy population complete.');
  console.log('='.repeat(60));
}).catch(console.error);
