# MVC Implementation

## Overview

JubileeVerse uses a modified **MVC+S** (Model-View-Controller-Service) pattern. This extends traditional MVC by extracting business logic into a dedicated Service layer, keeping controllers thin and focused on HTTP handling.

```
┌─────────────────────────────────────────────────────────────────┐
│                          HTTP Request                            │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CONTROLLERS                              │
│   Parse request, validate input, format response                 │
│   src/controllers/                                               │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SERVICES                                │
│   Business logic, AI integration, cross-model orchestration      │
│   src/services/                                                  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                           MODELS                                 │
│   Data structures, database queries, validation                  │
│   src/models/                                                    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASES                                │
│   PostgreSQL, Qdrant, Redis                                      │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │                    VIEWS                     │
                    │   EJS templates, HTML pages                  │
                    │   views/, public/                            │
                    └─────────────────────────────────────────────┘
```

## Layer Details

### Controllers (`src/controllers/`)

Controllers handle HTTP concerns only. They should be thin wrappers that:

1. Extract parameters from request
2. Validate authentication/authorization
3. Call appropriate service methods
4. Format and send response

**Example: ChatController.js**

```javascript
// GOOD: Thin controller, delegates to service
const sendMessage = asyncHandler(async (req, res) => {
  // 1. Auth check
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  // 2. Extract params
  const { id } = req.params;
  const { content } = req.body;

  // 3. Validate input
  if (!content?.trim()) {
    throw new AppError('Message content is required', 400);
  }

  // 4. Delegate to service
  const result = await ConversationService.sendMessage(id, {
    userId: req.session.userId,
    content: content.trim()
  });

  // 5. Format response
  res.json({ success: true, ...result });
});

// BAD: Controller doing too much
const sendMessageBad = asyncHandler(async (req, res) => {
  // DON'T: Database queries in controller
  const conversation = await db.query('SELECT * FROM conversations...');

  // DON'T: Business logic in controller
  if (conversation.messages.length > 100) {
    await summarizeConversation(conversation);
  }

  // DON'T: AI calls in controller
  const response = await openai.chat.completions.create({...});
});
```

**Controller Files:**

| File | Purpose |
|------|---------|
| `AuthController.js` | Login, logout, registration, password reset |
| `ChatController.js` | Conversations, messages, async requests |
| `PersonaController.js` | Persona listing, search, details |
| `PageController.js` | Server-rendered HTML pages |
| `AdminController.js` | Health checks, queue management, cache |
| `TranslationController.js` | Translation requests, review workflow |

### Services (`src/services/`)

Services contain business logic and orchestrate operations across multiple models or external systems.

**Example: PersonaService.js**

```javascript
// Service handles business logic, caching, AI integration
const generatePersonaResponse = async ({ personaId, messages, userLanguage }) => {
  // 1. Get persona (with caching)
  const persona = await CacheService.getOrSet(
    `persona:${personaId}`,
    () => Persona.findById(personaId),
    CacheService.TTL.LONG
  );

  if (!persona) {
    throw new AppError('Persona not found', 404);
  }

  // 2. Get relevant context from vector DB
  const context = await getRelevantContext(persona, messages);

  // 3. Build prompt with persona characteristics
  const systemPrompt = buildPersonaPrompt(persona, context);

  // 4. Call AI provider
  const response = await AIProviderFactory.generate({
    provider: persona.preferredProvider || 'openai',
    model: persona.model || 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  });

  // 5. Return structured response
  return {
    response: response.content,
    persona: { id: persona.id, name: persona.name },
    contextUsed: context.length
  };
};
```

**Service Files:**

| File | Purpose |
|------|---------|
| `AuthService.js` | Authentication, password hashing, token generation |
| `PersonaService.js` | Persona operations, AI response generation |
| `ConversationService.js` | Conversation CRUD, message history |
| `TranslationService.js` | Translation, language detection |
| `UserService.js` | User profile, preferences |

### Models (`src/models/`)

Models define data structures and encapsulate database operations. They should NOT contain business logic.

**Example: Persona.js**

```javascript
// Model handles data access only
const Persona = {
  // Schema definition (for documentation/validation)
  schema: {
    id: 'uuid',
    name: 'string',
    slug: 'string',
    category: 'string',
    description: 'string',
    systemPrompt: 'string',
    isActive: 'boolean',
    // ...
  },

  // Database queries
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM personas WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  },

  async findAll(options = {}) {
    const { category, language, limit = 50, offset = 0 } = options;
    let query = 'SELECT * FROM personas WHERE is_active = true';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  },

  // Validation
  validate(data) {
    const errors = [];
    if (!data.name || data.name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    if (!data.category) {
      errors.push('Category is required');
    }
    return errors;
  }
};
```

**Model Files:**

| File | Purpose |
|------|---------|
| `User.js` | User accounts, authentication data |
| `Persona.js` | AI persona definitions |
| `Conversation.js` | Chat conversations |
| `Message.js` | Individual chat messages |
| `Translation.js` | Translation records |

### Views (`views/`)

Views are EJS templates for server-rendered pages. Used for:
- Initial page loads (SEO, performance)
- Error pages
- Email templates

**Example: views/pages/chat.ejs**

```html
<%- include('../partials/header', { title: 'Chat - JubileeVerse' }) %>

<main class="chat-container">
  <aside class="conversation-list">
    <!-- Rendered server-side for initial load -->
    <% conversations.forEach(conv => { %>
      <div class="conversation-item" data-id="<%= conv.id %>">
        <%= conv.title %>
      </div>
    <% }) %>
  </aside>

  <section class="chat-main" id="chat-main">
    <!-- Hydrated by JavaScript for interactivity -->
  </section>
</main>

<script src="/js/chat.js"></script>
<%- include('../partials/footer') %>
```

## Request Lifecycle

### 1. Route Matching

```javascript
// src/routes/chat.js
router.post('/conversations/:id/messages',
  requireAuth,           // Middleware: check authentication
  apiRateLimiter,        // Middleware: rate limiting
  ChatController.sendMessage  // Controller: handle request
);
```

### 2. Middleware Chain

```
Request → Tracing → Metrics → Helmet → CORS → BodyParser → Session → RateLimit → Route
```

### 3. Controller Processing

```javascript
// ChatController.sendMessage
async (req, res) => {
  // Auth already verified by middleware
  const { id } = req.params;
  const result = await ConversationService.sendMessage(id, req.body);
  res.json({ success: true, ...result });
}
```

### 4. Service Logic

```javascript
// ConversationService.sendMessage
async (conversationId, { userId, content }) => {
  // Verify access
  const conversation = await Conversation.findById(conversationId);
  if (conversation.userId !== userId) {
    throw new AppError('Access denied', 403);
  }

  // Add user message
  const userMessage = await Message.create({
    conversationId,
    type: 'user',
    content
  });

  // Generate AI response
  const aiResponse = await PersonaService.generateResponse({
    personaId: conversation.personaId,
    messages: await this.getConversationContext(conversationId)
  });

  // Save AI message
  const assistantMessage = await Message.create({
    conversationId,
    type: 'assistant',
    content: aiResponse.response
  });

  return { userMessage, assistantMessage };
}
```

### 5. Model Data Access

```javascript
// Message.create
async (data) => {
  const result = await db.query(
    'INSERT INTO messages (conversation_id, type, content) VALUES ($1, $2, $3) RETURNING *',
    [data.conversationId, data.type, data.content]
  );
  return result.rows[0];
}
```

## Testing Each Layer

### Controller Tests (Integration)

```javascript
describe('ChatController', () => {
  it('should require authentication', async () => {
    const response = await request(app)
      .post('/chat/conversations/123/messages')
      .send({ content: 'Hello' });

    expect(response.status).toBe(401);
  });
});
```

### Service Tests (Unit)

```javascript
describe('PersonaService', () => {
  it('should generate response with persona context', async () => {
    Persona.findById.mockResolvedValue(mockPersona);
    AIProvider.generate.mockResolvedValue({ content: 'Response' });

    const result = await PersonaService.generatePersonaResponse({
      personaId: 'test-id',
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(result.response).toBeDefined();
    expect(AIProvider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' })
        ])
      })
    );
  });
});
```

### Model Tests (Unit)

```javascript
describe('Persona', () => {
  it('should find persona by id', async () => {
    db.query.mockResolvedValue({ rows: [mockPersona] });

    const persona = await Persona.findById('test-id');

    expect(persona).toEqual(mockPersona);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['test-id']
    );
  });
});
```

## Common Patterns

### Error Handling

```javascript
// In controllers, use asyncHandler wrapper
const handler = asyncHandler(async (req, res) => {
  // Errors thrown here are automatically caught
  throw new AppError('Something went wrong', 500);
});

// In services, throw AppError for expected errors
if (!user) {
  throw new AppError('User not found', 404);
}

// Unexpected errors bubble up to global error handler
```

### Caching Pattern

```javascript
// In services, use cache-aside pattern
const persona = await CacheService.getOrSet(
  `persona:${id}`,                    // Cache key
  () => Persona.findById(id),         // Fallback function
  CacheService.TTL.LONG               // TTL in seconds
);
```

### Transaction Pattern

```javascript
// In services, use database transactions
const client = await db.getClient();
try {
  await client.query('BEGIN');

  await client.query('INSERT INTO conversations...');
  await client.query('INSERT INTO messages...');

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Anti-Patterns to Avoid

### 1. Fat Controllers

```javascript
// BAD: Business logic in controller
const createConversation = async (req, res) => {
  // Checking user quota - should be in service
  const userConversations = await db.query('SELECT COUNT(*)...');
  if (userConversations > 100) {
    // Archiving old conversations - should be in service
    await db.query('UPDATE conversations SET status = archived...');
  }
  // ...
};
```

### 2. Models Calling Services

```javascript
// BAD: Model importing service
const Conversation = {
  async create(data) {
    const conv = await db.query('INSERT...');
    // DON'T: Models shouldn't call services
    await NotificationService.sendNewConversationEmail(conv);
    return conv;
  }
};
```

### 3. Controllers Calling Models Directly (Skipping Services)

```javascript
// BAD: Controller bypassing service layer
const handler = async (req, res) => {
  // DON'T: Direct model access in controller
  const persona = await Persona.findById(req.params.id);
  res.json(persona);
};

// GOOD: Go through service
const handler = async (req, res) => {
  const persona = await PersonaService.getPersona(req.params.id);
  res.json(persona);
};
```

### 4. Circular Dependencies

```javascript
// BAD: Services importing each other
// PersonaService.js
const ConversationService = require('./ConversationService');

// ConversationService.js
const PersonaService = require('./PersonaService');  // Circular!

// GOOD: Extract shared logic to a third service or use dependency injection
```
