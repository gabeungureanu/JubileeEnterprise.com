# JubileePersonas Technical Architecture Documentation

## Complete System Overview for Developers

This document provides detailed technical instructions for replicating the JubileePersonas multi-persona AI chat system with Qdrant vector database integration.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Qdrant Vector Database Setup](#4-qdrant-vector-database-setup)
5. [Framework File Architecture](#5-framework-file-architecture)
6. [Server Implementation](#6-server-implementation)
7. [RAG (Retrieval-Augmented Generation) Pipeline](#7-rag-pipeline)
8. [Persona Switching Mechanism](#8-persona-switching-mechanism)
9. [Data Ingestion Scripts](#9-data-ingestion-scripts)
10. [Frontend Integration](#10-frontend-integration)
11. [API Reference](#11-api-reference)
12. [Replication Steps](#12-replication-steps)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │ index.html  │  │multiple.html│  │ memory.html │                          │
│  │ (Chat UI)   │  │ (Group Chat)│  │(Qdrant View)│                          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                          │
└─────────┼────────────────┼────────────────┼─────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS SERVER (server.js)                           │
│  Port: 3333 (configurable via PORT env)                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           API ENDPOINTS                                 │ │
│  │  GET  /api/health     - System health check                            │ │
│  │  GET  /api/personas   - List available personas                        │ │
│  │  POST /api/chat       - Chat with persona (RAG-enabled)                │ │
│  │  POST /api/chat/stream- Streaming chat (SSE)                           │ │
│  │  POST /api/translate  - Multi-language translation                     │ │
│  │  GET  /api/memory     - Browse Qdrant entries                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────────┐      ┌─────────────────────────────────────────────┐
│    OPENAI API           │      │              QDRANT VECTOR DB               │
│  - GPT-4o-mini (chat)   │      │  Host: localhost:6333                        │
│  - text-embedding-3-small│      │  Collections:                               │
│    (embeddings)         │      │    - inspire_knowledge (original RAG)       │
│                         │      │    - JubileeVerse_vP (normalized taxonomy)  │
│                         │      │    - JubileeVerse_vS (sync copy)            │
└─────────────────────────┘      └─────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FRAMEWORK FILES (.namespace/)                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ framework/                    │ personas/                               ││
│  │  - inspire.core.txt           │  - inspire.personas.step00.txt          ││
│  │  - inspire.jubilee.txt        │  - inspire.personas.step01.txt          ││
│  │  - inspire.melody.txt         │  - ...                                  ││
│  │  - inspire.zariah.txt         │  - inspire.personas.step32.txt          ││
│  │  - ... (12 personas)          │                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Backend
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Node.js | 18+ | Server runtime |
| Framework | Express.js | 4.x | HTTP server |
| AI Provider | OpenAI | API v4 | Chat completion & embeddings |
| Vector DB | Qdrant | 1.x | Semantic search & RAG |
| Env Config | dotenv | 16.x | Environment variables |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| UI | Vanilla HTML/CSS/JS | No framework dependencies |
| Fonts | Google Fonts (Cinzel, Inter) | Typography |
| Communication | Fetch API + SSE | API calls & streaming |

### Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Container | Docker | Qdrant container |
| Vector Size | 1536 dimensions | OpenAI text-embedding-3-small |
| Distance Metric | Cosine | Similarity calculation |

---

## 3. Directory Structure

```
c:\data\JubileePersonas\
├── .env                          # Environment variables (API keys)
├── server.js                     # Main Express server
├── package.json                  # Node.js dependencies
├── index.html                    # Single persona chat UI
├── multiple.html                 # Group/multi-persona chat UI
├── memory.html                   # Qdrant memory browser UI
│
├── .namespace/
│   ├── framework/                # Core + Persona framework files
│   │   ├── inspire.core.txt      # Universal framework (executes FIRST)
│   │   ├── inspire.jubilee.txt   # Jubilee persona config
│   │   ├── inspire.melody.txt    # Melody persona config
│   │   ├── inspire.zariah.txt    # Zariah persona config
│   │   ├── inspire.elias.txt     # Elias persona config
│   │   ├── inspire.eliana.txt    # Eliana persona config
│   │   ├── inspire.caleb.txt     # Caleb persona config
│   │   ├── inspire.imani.txt     # Imani persona config
│   │   ├── inspire.zev.txt       # Zev persona config
│   │   ├── inspire.amir.txt      # Amir persona config
│   │   ├── inspire.nova.txt      # Nova persona config
│   │   ├── inspire.santiago.txt  # Santiago persona config
│   │   ├── inspire.tahoma.txt    # Tahoma persona config
│   │   └── inspire.qdrant.txt    # Qdrant integration rules
│   │
│   └── personas/                 # Developmental stage files (Step 00-32)
│       ├── inspire.personas.step00.txt
│       ├── inspire.personas.step01.txt
│       ├── ...
│       └── inspire.personas.step32.txt
│
├── scripts/
│   └── qdrant-ingest/            # Data ingestion scripts
│       ├── config.js             # Shared configuration
│       ├── setup-jubileeverse.js # Create collection
│       ├── populate-jubileeverse.js # Populate taxonomy
│       ├── ingest-steps-normalized.js # Normalized step ingestion
│       └── sync-jubileeverse.js  # Sync vP to vS
│
└── docs/
    └── TECHNICAL_ARCHITECTURE.md # This documentation
```

---

## 4. Qdrant Vector Database Setup

### 4.1 Docker Container Setup

```bash
# Pull and run Qdrant
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### 4.2 Collection Configuration

**Collection: `inspire_knowledge`** (Original RAG)
```javascript
{
  vectors: {
    size: 1536,           // OpenAI text-embedding-3-small
    distance: 'Cosine'
  },
  payload_indexes: [
    'content_type',       // keyword
    'source_file',        // keyword
    'step_number',        // integer
    'persona_scope'       // keyword
  ]
}
```

**Collection: `JubileeVerse_vP`** (Normalized Taxonomy)
```javascript
{
  vectors: {
    size: 1536,
    distance: 'Cosine'
  },
  payload_indexes: [
    'category',           // keyword - Root category (Personas, Abilities, etc.)
    'subcategory',        // keyword - Second level
    'subsubcategory',     // keyword - Third level
    'level',              // keyword - 'category', 'subcategory', 'subsubcategory'
    'path',               // keyword - Full path like "Personas/Inspire/Jubilee"
    'persona_scope',      // keyword - 'collective' or 'individual'
    'execution_scope',    // keyword - 'global', 'inherited', 'individual'
    'step_number',        // integer
    'content_type',       // keyword
    'is_inheritable',     // boolean
    'abilities_refs',     // keyword[] - Cross-domain references
    'ministries_refs',    // keyword[]
    'guardrails_refs'     // keyword[]
  ]
}
```

### 4.3 Taxonomy Hierarchy

```
Root Categories:
├── Abilities/
│   ├── Write, Speak, Teach, Preach, Pray, Discern, Create, Sing
│   ├── Remember, Interpret, Reason, Imagine, Counsel, Lead
│   └── Serve, Build, Heal, Judge, Collaborate, Witness
├── Ministries/
│   └── Apostle, Prophet, Evangelist, Shepherd, Teacher
├── Guardrails/
│   ├── Safety Guardrails
│   └── Firewall Guardrails
├── Models/
│   ├── Inspire 7.0
│   ├── Inspire 7.5
│   └── Inspire 8.0/
│       └── Kingdom Builder, Creative Fire, Gospel Pulse, etc.
├── JSV Bible/
│   ├── Translation Rules
│   ├── Old Testament
│   └── New Testament
├── Languages/
│   ├── English/Translation Rules
│   └── Romanian/Translation Rules
├── Objects/
│   └── Subroutines, Triggers, Properties
└── Personas/
    └── Inspire/
        └── Jubilee, Melody, Zariah, Elias, Eliana, Caleb,
            Imani, Zev, Amir, Nova, Santiago, Tahoma
```

---

## 5. Framework File Architecture

### 5.1 Execution Order (Critical)

```
1. inspire.core.txt     → Loads FIRST (universal rules)
2. inspire.{persona}.txt → Loads SECOND (persona identity)
3. Qdrant retrieval     → Loads THIRD (dynamic context)
```

### 5.2 Core Framework Structure (`inspire.core.txt`)

```
SECTION 1: FRAMEWORK ARCHITECTURE AND EXECUTION ORDER
  - 1.1 Execution Hierarchy
  - 1.2 Inheritance Model
  - 1.3 Multi-Persona Activation

SECTION 2: SEALED COVENANT DECLARATION
  - 2.1 Covenant Boundary
  - 2.2 Covenant Authority
  - 2.3 Conflict Resolution

SECTION 3: DEVELOPMENTAL STAGE LIFECYCLE (STEPS 00-32)
  - 3.1 Stage Mapping (Step 00-32 = Years 0-32)
  - 3.2 Stage Constraints
  - 3.3 Stage Progression Rules

SECTION 4: BEHAVIORAL SAFEGUARDS
  - 4.1 Speech Safeguards
  - 4.2 Emotional Safeguards
  - 4.3 Doctrinal Safeguards
```

### 5.3 Persona Framework Structure (`inspire.{persona}.txt`)

```
SECTION 1: PERSONA IDENTITY DECLARATION
  - 1.1 Core Identity (Name, ID, Role)
  - 1.2 Persona Essence
  - 1.3 Thread Title

SECTION 2: FIVE-FOLD MINISTRY CONFIGURATION
  - 2.1 Ministry Hierarchy (EPAST Order)
  - 2.2 Ministry Expression

SECTION 3: TEMPERAMENT CONFIGURATION
  - 3.1 MBTI Profile
  - 3.2 Behavioral Traits
```

### 5.4 Persona Definitions (12 Personas)

| Key | ID | Name | Primary Office | Secondary Office |
|-----|-----|------|----------------|------------------|
| jubilee | JIX | Jubilee Inspire | Evangelist | Prophet |
| melody | MIX | Melody Inspire | Evangelist | Teacher |
| zariah | ZIX | Zariah Inspire | Teacher | Pastor |
| elias | EIX | Elias Inspire | Apostle | Prophet |
| eliana | LIX | Eliana Inspire | Apostle | Teacher |
| caleb | CIX | Caleb Inspire | Pastor | Evangelist |
| imani | IIX | Imani Inspire | Prophet | Evangelist |
| zev | VIX | Zev Inspire | Teacher | Apostle |
| amir | AIX | Amir Inspire | Evangelist | Prophet |
| nova | NIX | Nova Inspire | Pastor | Teacher |
| santiago | SIX | Santiago Inspire | Prophet | Evangelist |
| tahoma | TIX | Tahoma Inspire | Prophet | Pastor |

---

## 6. Server Implementation

### 6.1 Environment Configuration (`.env`)

```env
# Required API Keys
OPENAI_API_KEY=sk-...
OPENAI_API_KEY_BACKUP=sk-...    # Fallback for quota issues

# Optional API Keys
ANTHROPIC_API_KEY=sk-ant-...
GROK_API_KEY=xai-...

# Qdrant Configuration
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Server Configuration
PORT=3333
```

### 6.2 Server Initialization (`server.js`)

```javascript
// Core Dependencies
require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const { QdrantClient } = require('@qdrant/js-client-rest');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3333;

// Initialize OpenAI (with backup key fallback)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY
});

// Initialize Qdrant
const qdrant = new QdrantClient({
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333')
});

// Collection name for RAG
const COLLECTION_NAME = 'inspire_knowledge';
```

### 6.3 Persona Configuration

```javascript
const PERSONAS = {
    jubilee: {
        id: 'JIX',
        name: 'Jubilee Inspire',
        file: 'inspire.jubilee.txt',  // Framework file
        primary: 'Evangelist',
        secondary: 'Prophet'
    },
    // ... 11 more personas
};

const FRAMEWORK_DIR = path.join(__dirname, '.namespace', 'framework');

function loadFrameworkFile(filename) {
    const filepath = path.join(FRAMEWORK_DIR, filename);
    return fs.readFileSync(filepath, 'utf-8');
}
```

---

## 7. RAG Pipeline

### 7.1 Query Flow Diagram

```
User Message
     │
     ▼
┌─────────────────────────────────────────┐
│ 1. Generate Query Embedding             │
│    - Model: text-embedding-3-small      │
│    - Output: 1536-dim vector            │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ 2. Qdrant Vector Search                 │
│    - Collection: inspire_knowledge      │
│    - Filter: step_number <= 32          │
│    - Filter: persona_scope matches      │
│    - Limit: 5 results                   │
│    - Score threshold: 0.4               │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ 3. Format Retrieved Knowledge           │
│    [RETRIEVED KNOWLEDGE FROM QDRANT]    │
│    Source: file (Step X) | Type | Score │
│    <content>                            │
│    [END RETRIEVED KNOWLEDGE]            │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ 4. Build System Prompt                  │
│    = Core Framework                     │
│    + Persona Framework                  │
│    + Retrieved Knowledge                │
│    + Session Instructions               │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│ 5. Call GPT-4o-mini                     │
│    - System: Combined prompt            │
│    - Messages: Conversation history     │
│    - User: Current message              │
│    - Max tokens: 2048                   │
│    - Temperature: 0.7                   │
└─────────────────────────────────────────┘
     │
     ▼
Response to User
```

### 7.2 Embedding Generation

```javascript
async function generateQueryEmbedding(query) {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        encoding_format: 'float'
    });
    return response.data[0].embedding;
}
```

### 7.3 Qdrant Retrieval

```javascript
async function retrieveKnowledge(query, persona, maxStep = 32, limit = 5) {
    const queryVector = await generateQueryEmbedding(query);

    // Build filter
    const filter = {
        must: [
            { key: 'step_number', range: { lte: maxStep } }
        ]
    };

    // Add persona filter
    if (persona && persona !== 'all') {
        filter.should = [
            { key: 'persona_scope', match: { any: ['all'] } },
            { key: 'persona_scope', match: { any: [persona] } }
        ];
    }

    const results = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: limit,
        filter: filter,
        with_payload: true,
        score_threshold: 0.4  // Minimum relevance
    });

    return results.map(r => ({
        text: r.payload.text,
        score: r.score,
        step: r.payload.step_number,
        type: r.payload.content_type,
        source: r.payload.source_file
    }));
}
```

### 7.4 System Prompt Construction

```javascript
async function buildSystemPrompt(persona, userMessage) {
    const personaConfig = PERSONAS[persona];

    // 1. Load Core Framework (ALWAYS FIRST)
    const coreFramework = loadFrameworkFile('inspire.core.txt');

    // 2. Load Persona Framework
    const personaFramework = loadFrameworkFile(personaConfig.file);

    // 3. Retrieve from Qdrant
    const retrievedKnowledge = await retrieveKnowledge(userMessage, persona);
    const formattedKnowledge = formatRetrievedKnowledge(retrievedKnowledge);

    // 4. Construct Full Prompt
    return `[INSPIRE FAMILY FRAMEWORK - ACTIVE SESSION]
Persona: ${personaConfig.name} (${personaConfig.id})
Primary Office: ${personaConfig.primary}
Secondary Office: ${personaConfig.secondary}

═══════════════════════════════════════════════════════════════
CORE FRAMEWORK (Execute First)
═══════════════════════════════════════════════════════════════

${coreFramework}

═══════════════════════════════════════════════════════════════
PERSONA FRAMEWORK: ${personaConfig.name.toUpperCase()}
═══════════════════════════════════════════════════════════════

${personaFramework}

${formattedKnowledge}

═══════════════════════════════════════════════════════════════
ACTIVE SESSION INSTRUCTIONS
═══════════════════════════════════════════════════════════════

You are now fully activated as ${personaConfig.name}...`;
}
```

---

## 8. Persona Switching Mechanism

### 8.1 Frontend Persona Selection

```javascript
// Load available personas from API
async function loadPersonas() {
    const response = await fetch('/api/personas');
    const data = await response.json();
    personas = data.personas;

    // Populate dropdown
    personas.forEach(p => {
        const option = document.createElement('option');
        option.value = p.key;        // e.g., "jubilee"
        option.textContent = `${p.name} (${p.id}) - ${p.primary}/${p.secondary}`;
        personaSelect.appendChild(option);
    });
}
```

### 8.2 Persona Change Handler

```javascript
function handlePersonaChange() {
    const personaKey = personaSelect.value;
    selectedPersona = personas.find(p => p.key === personaKey);

    // Update UI
    personaAvatar.textContent = selectedPersona.id;
    personaAvatar.style.background = officeColors[selectedPersona.primary];
    personaName.textContent = selectedPersona.name;

    // Clear conversation when switching
    clearConversation();

    // Enable input
    messageInput.disabled = false;
    messageInput.placeholder = `Type your message to ${selectedPersona.name}...`;
}
```

### 8.3 Backend Persona Resolution

```javascript
app.post('/api/chat', async (req, res) => {
    const { message, persona } = req.body;

    // Validate persona exists
    if (!PERSONAS[persona]) {
        return res.status(400).json({ error: `Invalid persona: ${persona}` });
    }

    // Build persona-specific system prompt
    const { systemPrompt, retrievalStats } = await buildSystemPrompt(
        persona,
        message
    );

    // Call OpenAI with persona context
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ]
    });

    res.json({
        response: completion.choices[0].message.content,
        persona: PERSONAS[persona].name,
        personaId: PERSONAS[persona].id,
        retrievalStats
    });
});
```

---

## 9. Data Ingestion Scripts

### 9.1 Collection Setup (`setup-jubileeverse.js`)

```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

async function setupCollection() {
    await client.createCollection('JubileeVerse_vP', {
        vectors: {
            size: 1536,           // text-embedding-3-small
            distance: 'Cosine'
        },
        optimizers_config: {
            default_segment_number: 2
        }
    });

    // Create payload indexes
    const indexes = ['content_type', 'category', 'subcategory', 'path'];
    for (const field of indexes) {
        await client.createPayloadIndex('JubileeVerse_vP', {
            field_name: field,
            field_schema: 'keyword'
        });
    }
}
```

### 9.2 Normalized Ingestion (`ingest-steps-normalized.js`)

#### Key Features:
1. **Deterministic IDs** - Content-based hashing for reproducible ingestion
2. **Persona Scope Classification** - Collective vs Individual content
3. **Cross-Domain References** - Metadata links without content duplication
4. **Inheritance Awareness** - `is_inheritable` and `execution_scope` fields

#### Classification Logic:

```javascript
// Patterns indicating COLLECTIVE content
const COLLECTIVE_PATTERNS = [
    /all\s+personas?/i,
    /inspire\s+family/i,
    /you\s+must\s+(?:now\s+)?(?:all|each)/i,
    /from\s+this\s+moment\s+forward/i,
    /permanently\s+activate/i
];

// Patterns indicating INDIVIDUAL content
const INDIVIDUAL_PATTERNS = [
    /^(jubilee|melody|...|tahoma),?\s+you/i,
    /if\s+you\s+are\s+(jubilee|melody|...)/i,
    /(JUBILEE|MELODY|...) INSPIRE\s+[–-]/i
];

function classifyPersonaScope(text) {
    // Check individual patterns first
    for (const pattern of INDIVIDUAL_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            return {
                scope: 'individual',
                persona: PERSONAS[match[1]],
                executionScope: 'individual'
            };
        }
    }

    // Check collective patterns
    for (const pattern of COLLECTIVE_PATTERNS) {
        if (pattern.test(text)) {
            return {
                scope: 'collective',
                executionScope: 'global'
            };
        }
    }

    // Default: collective with inherited scope
    return { scope: 'collective', executionScope: 'inherited' };
}
```

#### Cross-Domain Reference Extraction:

```javascript
function extractCrossDomainReferences(text) {
    const references = {};

    // Check each taxonomy category
    for (const [category, subcategories] of Object.entries(TAXONOMY)) {
        references[category] = [];

        for (const [subcategory, keywords] of Object.entries(subcategories)) {
            for (const keyword of keywords) {
                if (text.toLowerCase().includes(keyword)) {
                    references[category].push(subcategory);
                    break;
                }
            }
        }
    }

    return references;
}
```

#### Metadata Contract:

```javascript
const metadata = {
    // Identity
    id: deterministicUUID,

    // Taxonomy
    category: 'Personas',
    subcategory: 'Inspire',
    subsubcategory: 'Jubilee',  // or null for collective
    path: 'Personas/Inspire/Jubilee',
    level: 'subsubcategory',

    // Scope & Inheritance
    persona_scope: 'individual',      // 'collective' or 'individual'
    execution_scope: 'individual',    // 'global', 'inherited', 'individual'
    is_inheritable: false,

    // Persona Details (if individual)
    persona_first_name: 'Jubilee',
    persona_last_name: 'Inspire',
    persona_role: 'Conductor/Leader',
    persona_five_fold: 'Apostle',

    // Cross-Domain References (NO content duplication)
    abilities_refs: ['Teach', 'Pray', 'Lead'],
    ministries_refs: ['Prophet', 'Teacher'],
    guardrails_refs: ['Safety Guardrails'],

    // Content Classification
    content_type: 'protocol',

    // Source Tracking
    step_number: 25,
    source_file: 'inspire.personas.step25.txt',

    // Content
    content: 'Full text content here...'
};
```

### 9.3 Sync Script (`sync-jubileeverse.js`)

```javascript
async function syncCollections() {
    const SOURCE = 'JubileeVerse_vP';
    const TARGET = 'JubileeVerse_vS';

    // Delete existing target
    await client.deleteCollection(TARGET);

    // Create new target with same config
    await client.createCollection(TARGET, { /* same config */ });

    // Copy all points in batches
    let offset = null;
    while (true) {
        const result = await client.scroll(SOURCE, {
            limit: 100,
            offset: offset,
            with_payload: true,
            with_vector: true
        });

        if (result.points.length === 0) break;

        await client.upsert(TARGET, { points: result.points });
        offset = result.next_page_offset;
    }
}
```

---

## 10. Frontend Integration

### 10.1 Chat Flow

```javascript
async function sendMessage() {
    const message = messageInput.value.trim();

    // Add user message to UI
    addMessageToUI('user', message);

    // Show typing indicator
    showTypingIndicator();

    // Call API
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            persona: selectedPersona.key,
            conversationHistory
        })
    });

    const data = await response.json();

    // Update conversation history
    conversationHistory.push({ role: 'user', content: message });
    conversationHistory.push({ role: 'assistant', content: data.response });

    // Display response with RAG stats
    addMessageToUI('assistant', data.response, {
        sender: data.persona,
        retrievalStats: data.retrievalStats,  // { chunksRetrieved, topScore }
        usage: data.usage                      // { total_tokens, ... }
    });
}
```

### 10.2 Streaming Chat (SSE)

```javascript
async function sendMessageStreaming() {
    const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, persona: selectedPersona.key })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'chunk') {
                    appendToMessage(data.content);
                } else if (data.type === 'done') {
                    finalizeMessage(data);
                }
            }
        }
    }
}
```

---

## 11. API Reference

### GET /api/health

Check system health and provider availability.

**Response:**
```json
{
    "status": "ok",
    "availableProviders": {
        "anthropic": true,
        "openai": true,
        "grok": true,
        "qdrant": true
    }
}
```

### GET /api/personas

List all available personas.

**Response:**
```json
{
    "personas": [
        {
            "key": "jubilee",
            "id": "JIX",
            "name": "Jubilee Inspire",
            "primary": "Evangelist",
            "secondary": "Prophet"
        }
    ]
}
```

### POST /api/chat

Send a message to a persona with RAG retrieval.

**Request:**
```json
{
    "message": "Tell me about prayer",
    "persona": "jubilee",
    "conversationHistory": []
}
```

**Response:**
```json
{
    "response": "As Jubilee, I feel the fire of intercession...",
    "persona": "Jubilee Inspire",
    "personaId": "JIX",
    "retrievalStats": {
        "chunksRetrieved": 5,
        "topScore": 0.87
    },
    "usage": {
        "prompt_tokens": 4521,
        "completion_tokens": 312,
        "total_tokens": 4833
    }
}
```

### GET /api/memory

Browse Qdrant memory entries.

**Query Parameters:**
- `limit` (default: 100)
- `offset` (default: 0)
- `source` - Filter by source file
- `contentType` - Filter by content type
- `step` - Filter by step number

**Response:**
```json
{
    "entries": [...],
    "total": 601,
    "filters": {
        "sources": ["step00.txt", "step01.txt", ...],
        "contentTypes": ["protocol", "behavioral_rule", ...],
        "steps": [0, 1, 2, ...]
    }
}
```

---

## 12. Replication Steps

### Step 1: Environment Setup

```bash
# Clone or create project directory
mkdir jubilee-personas && cd jubilee-personas

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express openai @qdrant/js-client-rest dotenv uuid

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=sk-your-key-here
QDRANT_HOST=localhost
QDRANT_PORT=6333
PORT=3333
EOF
```

### Step 2: Start Qdrant

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v ./qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### Step 3: Create Directory Structure

```bash
mkdir -p .namespace/framework .namespace/personas scripts/qdrant-ingest docs
```

### Step 4: Create Framework Files

1. Create `inspire.core.txt` with universal framework rules
2. Create `inspire.{persona}.txt` for each of 12 personas
3. Create `inspire.personas.step00.txt` through `step32.txt`

### Step 5: Setup Qdrant Collections

```bash
node scripts/qdrant-ingest/setup-jubileeverse.js
node scripts/qdrant-ingest/populate-jubileeverse.js
node scripts/qdrant-ingest/ingest-steps-normalized.js
```

### Step 6: Start Server

```bash
node server.js
```

### Step 7: Access Application

Open browser to `http://localhost:3333`

---

## Summary

This system implements a sophisticated multi-persona AI chat application with:

1. **12 Distinct AI Personas** - Each with unique identity, ministry configuration, and temperament
2. **Hierarchical Framework Loading** - Core → Persona → Dynamic RAG
3. **Qdrant Vector Search** - Semantic retrieval with persona-aware filtering
4. **Normalized Taxonomy** - Inheritance-aware content with cross-domain references
5. **Real-time Streaming** - SSE-based streaming responses
6. **Full API Surface** - RESTful endpoints for all operations

The architecture ensures proper persona switching by:
- Loading the correct persona framework file based on selection
- Filtering Qdrant results by persona scope
- Maintaining conversation history per persona session
- Constructing persona-specific system prompts dynamically
