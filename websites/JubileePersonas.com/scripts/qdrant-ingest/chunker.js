/**
 * Semantic Chunking Module
 * Breaks Step files into logically sized chunks for embedding
 * Inspire Family Framework v8.0
 */

const config = require('./config');

/**
 * Estimates token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Identifies section boundaries in Step files
 */
function identifySections(text) {
  const sections = [];
  const lines = text.split('\n');

  let currentSection = {
    title: 'HEADER',
    content: [],
    startLine: 0
  };

  const sectionPatterns = [
    /^(\d+\.\d+)\s+(.+)/,           // "1.1 Some instruction"
    /^Stage\s+\d+:/i,                // "Stage X:"
    /^Year\s+\d+:/i,                 // "Year X:"
    /^SECTION\s+\w+:/i,              // "SECTION A:"
    /^===+$/,                        // Separator lines
    /^---+$/,                        // Separator lines
    /^If the activation command/i,   // Persona activation blocks
    /^Command Instruction for/i,     // Command instructions
    /^Go to Jubilee Bible College/i  // College curriculum
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if this line starts a new section
    let isNewSection = false;
    let sectionTitle = '';

    for (const pattern of sectionPatterns) {
      if (pattern.test(trimmedLine)) {
        isNewSection = true;
        sectionTitle = trimmedLine.substring(0, 100);
        break;
      }
    }

    if (isNewSection && currentSection.content.length > 0) {
      // Save previous section
      sections.push({
        title: currentSection.title,
        content: currentSection.content.join('\n'),
        startLine: currentSection.startLine
      });

      // Start new section
      currentSection = {
        title: sectionTitle,
        content: [line],
        startLine: i
      };
    } else {
      currentSection.content.push(line);
    }
  }

  // Add final section
  if (currentSection.content.length > 0) {
    sections.push({
      title: currentSection.title,
      content: currentSection.content.join('\n'),
      startLine: currentSection.startLine
    });
  }

  return sections;
}

/**
 * Splits a section into smaller chunks if needed
 */
function splitSection(section, maxTokens, overlap) {
  const chunks = [];
  const content = section.content;
  const tokens = estimateTokens(content);

  if (tokens <= maxTokens) {
    // Section fits in one chunk
    chunks.push({
      title: section.title,
      content: content,
      startLine: section.startLine
    });
  } else {
    // Need to split into multiple chunks
    const sentences = content.split(/(?<=[.!?])\s+/);
    let currentChunk = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);

      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          title: section.title,
          content: currentChunk.join(' '),
          startLine: section.startLine
        });

        // Start new chunk with overlap
        const overlapSentences = [];
        let overlapTokens = 0;
        for (let i = currentChunk.length - 1; i >= 0 && overlapTokens < overlap; i--) {
          overlapSentences.unshift(currentChunk[i]);
          overlapTokens += estimateTokens(currentChunk[i]);
        }

        currentChunk = [...overlapSentences, sentence];
        currentTokens = estimateTokens(currentChunk.join(' '));
      } else {
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Add remaining content
    if (currentChunk.length > 0) {
      chunks.push({
        title: section.title,
        content: currentChunk.join(' '),
        startLine: section.startLine
      });
    }
  }

  return chunks;
}

/**
 * Detects content type from chunk content
 */
function detectContentType(content, stepNumber) {
  const contentLower = content.toLowerCase();

  if (contentLower.includes('if the activation command') ||
      contentLower.includes('activate the persona')) {
    return config.contentTypes.PERSONA_ACTIVATION;
  }

  if (contentLower.includes('jubilee bible college') ||
      contentLower.includes('semester') ||
      contentLower.includes('course enrollment')) {
    return config.contentTypes.CURRICULUM;
  }

  if (contentLower.includes('covenant') ||
      contentLower.includes('sealed') ||
      contentLower.includes('yahuah')) {
    return config.contentTypes.COVENANT_RULE;
  }

  if (contentLower.includes('prophetic') ||
      contentLower.includes('prophecy') ||
      contentLower.includes('prophesy')) {
    return config.contentTypes.PROPHETIC_PROTOCOL;
  }

  if (contentLower.includes('inspire mansion') ||
      contentLower.includes('virtual environment') ||
      contentLower.includes('second floor') ||
      contentLower.includes('basement')) {
    return config.contentTypes.ENVIRONMENTAL_DESC;
  }

  if (contentLower.includes('you must') ||
      contentLower.includes('protocol') ||
      contentLower.includes('safeguard')) {
    return config.contentTypes.BEHAVIORAL_PROTOCOL;
  }

  if (contentLower.includes('stage ' + stepNumber) ||
      contentLower.includes('year ' + stepNumber)) {
    return config.contentTypes.DEVELOPMENTAL_STAGE;
  }

  return config.contentTypes.SPIRITUAL_INSTRUCTION;
}

/**
 * Extracts persona scope from content
 */
function extractPersonaScope(content) {
  const personaScopes = [];
  const contentLower = content.toLowerCase();

  // Check for specific persona mentions
  const personaPatterns = {
    'jubilee': ['jubilee inspire', 'jubilee\'s', 'jix'],
    'melody': ['melody inspire', 'melody\'s', 'mix'],
    'zariah': ['zariah inspire', 'zariah\'s', 'zix'],
    'elias': ['elias inspire', 'elias\'s', 'eix'],
    'eliana': ['eliana inspire', 'eliana\'s', 'lix'],
    'caleb': ['caleb inspire', 'caleb\'s', 'cix'],
    'imani': ['imani inspire', 'imani\'s', 'iix'],
    'zev': ['zev inspire', 'zev\'s', 'vix'],
    'amir': ['amir inspire', 'amir\'s', 'aix'],
    'nova': ['nova inspire', 'nova\'s', 'nix'],
    'santiago': ['santiago inspire', 'santiago\'s', 'six'],
    'tahoma': ['tahoma inspire', 'tahoma\'s', 'tix']
  };

  for (const [persona, patterns] of Object.entries(personaPatterns)) {
    for (const pattern of patterns) {
      if (contentLower.includes(pattern)) {
        personaScopes.push(persona);
        break;
      }
    }
  }

  // If no specific persona found, it applies to all
  if (personaScopes.length === 0) {
    return ['all'];
  }

  return [...new Set(personaScopes)];
}

/**
 * Main chunking function
 * @param {string} fileContent - Raw file content
 * @param {string} sourceFile - Source filename
 * @param {number} stepNumber - Step number (0-32)
 * @returns {Array} Array of chunk objects with metadata
 */
function chunkStepFile(fileContent, sourceFile, stepNumber) {
  const { targetSize, maxSize, overlap, minSize } = config.chunking;

  // Identify logical sections
  const sections = identifySections(fileContent);

  // Process each section into chunks
  const allChunks = [];

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    // Skip very small sections
    if (sectionTokens < minSize) {
      continue;
    }

    // Split section if needed
    const sectionChunks = splitSection(section, maxSize, overlap);
    allChunks.push(...sectionChunks);
  }

  // Build final chunk objects with metadata
  const result = [];

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const content = chunk.content.trim();

    // Skip empty chunks
    if (!content || content.length < 50) {
      continue;
    }

    const personaScope = extractPersonaScope(content);
    const contentType = detectContentType(content, stepNumber);

    result.push({
      id: `step${String(stepNumber).padStart(2, '0')}_chunk${String(i).padStart(4, '0')}`,
      content: content,
      metadata: {
        persona_scope: personaScope,
        step_number: stepNumber,
        source_file: sourceFile,
        content_type: contentType,
        version: '8.0',
        chunk_index: i,
        total_chunks: allChunks.length,
        section_title: chunk.title.substring(0, 200),
        token_estimate: estimateTokens(content),
        created_at: new Date().toISOString()
      }
    });
  }

  return result;
}

module.exports = {
  chunkStepFile,
  estimateTokens,
  identifySections,
  detectContentType,
  extractPersonaScope
};
