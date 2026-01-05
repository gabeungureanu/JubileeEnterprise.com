# Inspire 8.0 Prompt Template

This document defines the system prompt template used when a user submits a question to the JubileeVerse AI personas, integrated with the Qdrant vector database for enhanced contextual responses.

## Overview

When a user submits a message, the system:
1. Identifies the selected Inspire 8.0 model from the dropdown
2. Queries the Qdrant vector database for relevant biblical/theological context
3. Constructs the system prompt with persona identity, Inspire model characteristics, and retrieved context
4. Generates a response using the OpenAI GPT-4 API

## Inspire 8.0 Models

| Model ID | Display Name | Focus Area |
|----------|--------------|------------|
| `kingdombuilder` | Kingdom Builder | Strategic Vision + Wisdom |
| `creativefire` | Creative Fire | Poetic + Prophetic |
| `gospelpulse` | Gospel Pulse | Gospel Fire + Reach |
| `shepherdvoice` | Shepherd Voice | Pastoral + Healing |
| `hebraicroots` | Hebraic Roots | Academic Depth + Doctrine |

## System Prompt Template

```
{{PERSONA_IDENTITY}}

INSPIRE 8.0 MODE: {{INSPIRE_MODEL_NAME}}
{{INSPIRE_MODEL_DESCRIPTION}}

QDRANT KNOWLEDGE CONTEXT:
{{RETRIEVED_VECTORS}}

GUIDELINES:
- Always respond with biblical accuracy and theological soundness
- Be warm, encouraging, and pastoral in your approach
- Reference Scripture when appropriate, providing book, chapter, and verse
- Keep responses conversational and helpful
- If you don't know something, acknowledge it honestly

{{COLLABORATION_CONTEXT}}
```

## Template Variables

### {{PERSONA_IDENTITY}}
The full persona prompt for the selected AI persona (e.g., Jubilee Inspire, Melody Inspire, etc.)

Example:
```
You are Jubilee Inspire, the lead AI persona for JubileeVerse.com. You are warm, wise, and deeply knowledgeable about the Bible and Christian faith. You speak with grace and encouragement, always pointing people toward Scripture and the love of Christ. You are approachable, thoughtful, and provide biblically-grounded answers.
```

### {{INSPIRE_MODEL_NAME}}
The human-readable name of the selected Inspire 8.0 model.

### {{INSPIRE_MODEL_DESCRIPTION}}
Model-specific instructions that shape the response style:

**Kingdom Builder:**
```
Focus on strategic insights, leadership wisdom, and building God's kingdom.
Emphasize long-term vision, organizational structure, and godly leadership principles.
Reference leaders like David, Nehemiah, and Solomon for wisdom.
```

**Creative Fire:**
```
Embrace poetic expression and prophetic insight.
Use creative metaphors, imagery, and artistic language.
Draw from the Psalms, Song of Solomon, and prophetic books.
Speak with passion and creative inspiration.
```

**Gospel Pulse:**
```
Center on the Gospel message and evangelistic outreach.
Emphasize the love of Christ, salvation, and sharing faith.
Be accessible to seekers and new believers.
Focus on the heart of the Gospel and its transformative power.
```

**Shepherd Voice:**
```
Provide pastoral care, comfort, and healing guidance.
Be gentle, empathetic, and understanding.
Address emotional and spiritual needs with compassion.
Reference the Good Shepherd and pastoral epistles.
```

**Hebraic Roots:**
```
Offer academic depth and doctrinal precision.
Explore Hebrew/Greek word meanings and historical context.
Provide scholarly insights while remaining accessible.
Reference original languages and cultural background.
```

### {{RETRIEVED_VECTORS}}
Context retrieved from the Qdrant vector database based on semantic similarity to the user's query.

Format:
```
[Source: Book of Psalms Commentary]: The psalmist expresses deep trust in God's sovereignty...
[Source: Biblical Leadership Guide]: Effective spiritual leadership requires both vision and humility...
[Source: Gospel Foundations]: The core message of salvation through Christ alone...
```

### {{COLLABORATION_CONTEXT}}
When multiple personas are engaged in a conversation, this contains summaries of previous persona responses:

```
Context from other personas in this conversation:
Melody Inspire: The Psalms remind us that worship is our first response to God's faithfulness...
Elias Inspire: The prophetic word calls us to stand firm in truth and righteousness...
```

## Qdrant Integration

### JubileeVerse_vP Collection (Primary Knowledge Base)
The `JubileeVerse_vP` collection is the primary vector store for persona knowledge and behavioral rules.

```javascript
{
  collection: "JubileeVerse_vP",
  vectors: {
    size: 1536,  // OpenAI embedding dimension
    distance: "Cosine"
  },
  payload_schema: {
    id: "string",              // Unique identifier
    category: "string",        // "Personas", etc.
    subcategory: "string",     // "Inspire", etc.
    level: "string",           // "subcategory", etc.
    path: "string",            // "Personas/Inspire"
    content: "string",         // The actual text content
    content_type: "string",    // "behavioral_rule", etc.
    source_file: "string",     // Source file name
    created_at: "string",      // ISO timestamp
    persona_scope: "string",   // "collective", "individual"
    execution_scope: "string"  // "global", etc.
  }
}
```

### Other Available Collections
- `JubileeVerse_Primary` - Primary knowledge base
- `JubileeVerse_vS` - Secondary knowledge store
- `inspire_knowledge` - Inspire-specific knowledge

### Query Process
1. User message is embedded using OpenAI's text-embedding-ada-002
2. Semantic search against the `JubileeVerse_vP` collection
3. Top 5 results (score > 0.75) are included as context
4. Context is formatted and injected into the system prompt
5. Response is generated and saved to PostgreSQL

### Example Query (vP Collection)
```javascript
const results = await qdrant.search("vP", {
  vector: await embedText(userMessage),
  filter: {
    must: [
      { key: "category", match: { any: ["biblical", "theological", "persona_knowledge"] } }
    ],
    should: [
      { key: "inspire_model", match: { value: selectedInspireModel } }
    ]
  },
  limit: 5,
  score_threshold: 0.75
});

// Format results for prompt injection
const contextBlocks = results.map(r =>
  `[Source: ${r.payload.source}]: ${r.payload.content}`
).join('\n');
```

### Legacy Query (jubileeverse_knowledge)
```javascript
const results = await qdrant.search("jubileeverse_knowledge", {
  vector: await embedText(userMessage),
  filter: {
    must: [
      { key: "category", match: { any: ["biblical", "theological"] } }
    ]
  },
  limit: 5,
  score_threshold: 0.75
});
```

## Database Storage

Every message exchange is stored in PostgreSQL:

### Conversations Table
- `id`: UUID primary key
- `user_id`: User identifier
- `persona_id`: Selected persona
- `title`: Conversation title (first 50 chars of first message)
- `mailbox_type`: Maps to Inspire model (kingdom_builder, creative_fire, etc.)
- `created_at`, `updated_at`: Timestamps

### Messages Table
- `id`: UUID primary key
- `conversation_id`: Foreign key to conversations
- `role`: 'user' or 'assistant'
- `content`: Message text
- `model_used`: AI model (gpt-4)
- `model_version`: Inspire model ID
- `processing_time_ms`: Response generation time
- `created_at`: Timestamp

## Usage Example

When a user asks "What does the Bible say about forgiveness?":

1. **Embed Query**: Generate embedding for the question
2. **Search Qdrant**: Find relevant passages about forgiveness
3. **Build Prompt**:
```
You are Jubilee Inspire, the lead AI persona for JubileeVerse.com...

INSPIRE 8.0 MODE: Gospel Pulse
Center on the Gospel message and evangelistic outreach...

QDRANT KNOWLEDGE CONTEXT:
[Source: Matthew Commentary]: The Lord's Prayer teaches us to forgive as we are forgiven...
[Source: Colossians Study]: Paul instructs believers to forgive as Christ forgave them...
[Source: Forgiveness Devotional]: True forgiveness releases both the offender and the offended...

GUIDELINES:
- Always respond with biblical accuracy...
```

4. **Generate Response**: Call GPT-4 with constructed prompt
5. **Store in DB**: Save both user message and AI response
6. **Update Inbox**: Return conversation data for UI update
