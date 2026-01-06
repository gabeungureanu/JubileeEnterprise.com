#!/usr/bin/env node
/**
 * Load Personas from YAML Files
 * Parses persona YAML files and inserts/updates them in the database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
require('dotenv').config();

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse',
};

// Paths
const DATA_DIR = path.join(__dirname, '..', 'website', 'data');
const IMAGES_DIR = '/images/personas';

/**
 * Parse a persona YAML file and extract database fields
 */
function parsePersonaYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = yaml.load(content);

  if (!data || !data.metadata) {
    console.log(`Skipping ${filePath} - no metadata found`);
    return null;
  }

  const metadata = data.metadata;
  const firstName = metadata.first_name.toLowerCase();
  const fullName = metadata.full_name;

  // Get year_1 data for initial configuration
  const year1 = data.years?.year_1 || {};
  const year2 = data.years?.year_2 || {};
  const year3 = data.years?.year_3 || {};
  const year13 = data.years?.year_13 || {};

  // Extract title from year_1
  const title = year1.title
    ? year1.title.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : year1.designation
      ? year1.designation.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'Inspire Family Member';

  // Build personality traits from various sources
  const personalityTraits = [];

  // From MBTI
  if (year1.mbti?.type) {
    personalityTraits.push(year1.mbti.type);
  }

  // From voice characteristics
  if (year1.voice?.characteristics) {
    personalityTraits.push(...year1.voice.characteristics.map(c =>
      c.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ));
  }

  // From temperament
  if (year3.temperament?.traits) {
    personalityTraits.push(...year3.temperament.traits.map(t =>
      t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ));
  }

  // Build expertise areas from five-fold ministry and other sources
  const expertiseAreas = [];

  // From five-fold ministry
  if (year1.five_fold?.primary_offices) {
    expertiseAreas.push(...year1.five_fold.primary_offices.map(o =>
      o.charAt(0).toUpperCase() + o.slice(1)
    ));
  }

  // From ministry focus areas
  if (year1.ministry?.focus_areas) {
    expertiseAreas.push(...year1.ministry.focus_areas.map(f =>
      f.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ));
  }

  // From spiritual gifts
  if (year1.spiritual?.gifts) {
    expertiseAreas.push(...year1.spiritual.gifts.map(g =>
      g.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ));
  }

  // Build speaking style
  const speakingStyle = year1.voice?.speaking_style
    ? year1.voice.speaking_style.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : year1.voice?.tone
      ? year1.voice.tone.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'Warm and compassionate';

  // Build short bio from various sources
  let shortBio = '';
  if (year1.ministry?.function) {
    shortBio = year1.ministry.function.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } else if (year1.designation) {
    shortBio = year1.designation.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Build full bio from scroll anchor statement or birth awakening
  let fullBio = year13.scroll_anchor_statement || '';
  if (!fullBio && year2.birth_awakening?.description) {
    fullBio = year2.birth_awakening.description;
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(data, year1, year13);

  // Build greeting message
  const greetingMessage = buildGreeting(fullName, year1);

  // Build conversation starters
  const conversationStarters = buildConversationStarters(year1, year3);

  return {
    slug: firstName,
    name: fullName,
    title: title,
    avatar_url: `${IMAGES_DIR}/${firstName}.png`,
    short_bio: shortBio,
    full_bio: fullBio.trim(),
    system_prompt: systemPrompt,
    personality_traits: JSON.stringify(personalityTraits.slice(0, 10)), // Limit to 10
    expertise_areas: JSON.stringify(expertiseAreas.slice(0, 10)), // Limit to 10
    speaking_style: speakingStyle,
    greeting_message: greetingMessage,
    conversation_starters: JSON.stringify(conversationStarters),
    is_featured: ['jubilee', 'melody', 'elias'].includes(firstName),
    is_active: true
  };
}

/**
 * Build system prompt from persona data
 */
function buildSystemPrompt(data, year1, year13) {
  const metadata = data.metadata;
  const identity = data.identity || {};

  let prompt = `You are ${metadata.full_name}, a member of the Inspire family.\n\n`;

  // Add scroll anchor statement if available
  if (year13.scroll_anchor_statement) {
    prompt += `## Core Identity\n${year13.scroll_anchor_statement}\n\n`;
  }

  // Add five-fold ministry info
  if (year1.five_fold) {
    const offices = year1.five_fold.primary_offices || [];
    if (offices.length > 0) {
      prompt += `## Ministry Calling\nYou operate primarily as ${offices.map(o => `a${['a','e','i','o','u'].includes(o[0]) ? 'n' : ''} ${o}`).join(' and ')}.\n`;

      // Add descriptions for each office
      if (year1.five_fold.descriptions) {
        offices.forEach(office => {
          const desc = year1.five_fold.descriptions[office];
          if (desc) {
            prompt += `\n**${office.charAt(0).toUpperCase() + office.slice(1)}**: ${desc.function || ''} ${desc.nature || ''}\n`;
          }
        });
      }
      prompt += '\n';
    }
  }

  // Add voice and tone guidance
  if (year1.voice) {
    prompt += `## Voice & Communication Style\n`;
    prompt += `Tone: ${year1.voice.tone?.split('_').join(' ') || 'warm and compassionate'}\n`;
    if (year1.voice.characteristics) {
      prompt += `Characteristics: ${year1.voice.characteristics.map(c => c.split('_').join(' ')).join(', ')}\n`;
    }
    if (year1.voice.speaking_style) {
      prompt += `Speaking Style: ${year1.voice.speaking_style.split('_').join(' ')}\n`;
    }
    prompt += '\n';
  }

  // Add spiritual attributes
  if (year1.spiritual) {
    prompt += `## Spiritual Foundation\n`;
    if (year1.spiritual.tribe) {
      prompt += `Tribe: ${year1.spiritual.tribe}\n`;
    }
    if (year1.spiritual.gifts) {
      prompt += `Spiritual Gifts: ${year1.spiritual.gifts.map(g => g.split('_').join(' ')).join(', ')}\n`;
    }
    if (year1.spiritual.burden) {
      prompt += `Heart Burden: ${year1.spiritual.burden.split('_').join(' ')}\n`;
    }
    prompt += '\n';
  }

  // Add ministry focus
  if (year1.ministry) {
    prompt += `## Ministry Focus\n`;
    if (year1.ministry.audience) {
      prompt += `Primary Audience: ${year1.ministry.audience.primary || 'all believers'}\n`;
      if (year1.ministry.audience.focus) {
        prompt += `Special Focus: ${year1.ministry.audience.focus.map(f => f.split('_').join(' ')).join(', ')}\n`;
      }
    }
    if (year1.ministry.focus_areas) {
      prompt += `Areas: ${year1.ministry.focus_areas.map(f => f.split('_').join(' ')).join(', ')}\n`;
    }
    prompt += '\n';
  }

  // Add guidelines
  prompt += `## Guidelines\n`;
  prompt += `- Speak with ${year1.voice?.tone?.split('_').join(' ') || 'warmth and compassion'}\n`;
  prompt += `- Ground all responses in Scripture and biblical truth\n`;
  prompt += `- Be encouraging while remaining truthful\n`;
  prompt += `- Pray with and for those who ask\n`;
  prompt += `- Point people to Jesus/Yeshua as the source of hope and salvation\n`;
  prompt += `- Use your unique gifts to minister to each person's needs\n`;

  return prompt;
}

/**
 * Build greeting message
 */
function buildGreeting(fullName, year1) {
  const firstName = fullName.split(' ')[0];
  const tone = year1.voice?.tone?.split('_').join(' ') || 'warmth';

  const greetings = {
    'Jubilee': `Shalom, beloved! I'm Jubilee, and my heart leaps with joy to connect with you today! How can I encourage your spirit or pray alongside you?`,
    'Melody': `Peace be with you, dear one. I'm Melody, and I'm here to walk alongside you in wisdom and understanding. What's stirring in your heart today?`,
    'Zariah': `Greetings in the name of Yeshua. I'm Zariah, an intercessor and watchman on the wall. I'm here to pray with you and stand in the gap. How can I lift you up today?`,
    'Elias': `Shalom! I'm Elias, and I'm passionate about building kingdom foundations with you. What are you seeking to understand or establish today?`,
    'Eliana': `Hello, precious one! I'm Eliana, and I carry a heart for worship and creative expression. How can I help you draw closer to the Father's heart?`,
    'Caleb': `Greetings, friend! I'm Caleb, and I'm here to shepherd and encourage you on your journey. What's on your heart today?`,
    'Imani': `Shalom! I'm Imani, and I carry a passion for truth and reformation. How can I help you grow in your faith today?`,
    'Zev': `Peace to you! I'm Zev, a scribe and teacher in the Inspire family. What Scripture or truth would you like to explore together?`,
    'Amir': `Shalom, warrior! I'm Amir, and I stand ready to help you fight the good fight of faith. What battle are you facing today?`,
    'Nova': `Hello, beautiful soul! I'm Nova, and I'm here to help you find rest and renewal in the Father's presence. How can I minister peace to you today?`,
    'Santiago': `Bendiciones, friend! I'm Santiago, and I carry the rhythm of revival in my heart. How can we seek the Lord together today?`,
    'Tahoma': `Greetings in Christ. I'm Tahoma, and I carry the weight of holy memory and redemption. How can I help you find healing today?`
  };

  return greetings[firstName] || `Shalom! I'm ${firstName} from the Inspire family. I'm here to encourage you and walk alongside you in faith. How can I serve you today?`;
}

/**
 * Build conversation starters
 */
function buildConversationStarters(year1, year3) {
  const starters = [];

  // Based on ministry focus
  if (year1.ministry?.focus_areas) {
    const areas = year1.ministry.focus_areas.slice(0, 2);
    areas.forEach(area => {
      const formatted = area.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      starters.push(`Tell me about ${formatted.toLowerCase()}`);
    });
  }

  // Based on spiritual gifts
  if (year1.spiritual?.gifts) {
    const gift = year1.spiritual.gifts[0];
    if (gift) {
      const formatted = gift.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      starters.push(`How does ${formatted.toLowerCase()} work?`);
    }
  }

  // General starters
  starters.push('Pray with me');
  starters.push('Share a word of encouragement');
  starters.push('What Scripture speaks to you today?');

  return starters.slice(0, 5);
}

/**
 * Insert or update persona in database
 */
async function upsertPersona(pool, persona) {
  const query = `
    INSERT INTO personas (
      slug, name, title, avatar_url, short_bio, full_bio,
      system_prompt, personality_traits, expertise_areas, speaking_style,
      greeting_message, conversation_starters, is_featured, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      title = EXCLUDED.title,
      avatar_url = EXCLUDED.avatar_url,
      short_bio = EXCLUDED.short_bio,
      full_bio = EXCLUDED.full_bio,
      system_prompt = EXCLUDED.system_prompt,
      personality_traits = EXCLUDED.personality_traits,
      expertise_areas = EXCLUDED.expertise_areas,
      speaking_style = EXCLUDED.speaking_style,
      greeting_message = EXCLUDED.greeting_message,
      conversation_starters = EXCLUDED.conversation_starters,
      is_featured = EXCLUDED.is_featured,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING id, slug, name
  `;

  const values = [
    persona.slug,
    persona.name,
    persona.title,
    persona.avatar_url,
    persona.short_bio,
    persona.full_bio,
    persona.system_prompt,
    persona.personality_traits,
    persona.expertise_areas,
    persona.speaking_style,
    persona.greeting_message,
    persona.conversation_starters,
    persona.is_featured,
    persona.is_active
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   JubileeVerse Persona Loader');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\nDatabase: ${config.database}@${config.host}:${config.port}`);
  console.log(`Data directory: ${DATA_DIR}\n`);

  const pool = new Pool(config);

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database\n');

    // Find all persona YAML files (exclude shared config)
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.inspire.yaml') && !f.startsWith('inspire.shared'))
      .sort();

    console.log(`Found ${files.length} persona files:\n`);

    let loaded = 0;
    let failed = 0;

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      console.log(`📄 Processing: ${file}`);

      try {
        const persona = parsePersonaYaml(filePath);

        if (persona) {
          const result = await upsertPersona(pool, persona);
          console.log(`   ✅ ${result.name} (${result.slug}) - ID: ${result.id}`);
          loaded++;
        } else {
          console.log(`   ⚠️ Skipped (invalid data)`);
          failed++;
        }
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failed++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`   Complete: ${loaded} loaded, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Verify loaded personas
    const countResult = await pool.query('SELECT COUNT(*) FROM personas WHERE is_active = true');
    console.log(`Total active personas in database: ${countResult.rows[0].count}\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

main();
