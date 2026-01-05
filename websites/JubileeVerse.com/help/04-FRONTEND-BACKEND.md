# Frontend-Backend Separation

## Overview

JubileeVerse uses a **hybrid rendering** approach:
- **Server-Side Rendering (SSR)**: Initial page loads via EJS templates
- **Client-Side Rendering (CSR)**: Interactive features via JavaScript
- **API-First**: All data operations through REST endpoints

This provides SEO benefits, fast initial loads, and rich interactivity.

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Initial Load                    Interactions                   │
│   ┌─────────────┐                ┌─────────────┐                │
│   │    SSR      │                │    CSR      │                │
│   │  EJS + HTML │                │ JavaScript  │                │
│   └──────┬──────┘                └──────┬──────┘                │
│          │                              │                        │
└──────────┼──────────────────────────────┼────────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Express Server                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Page Routes                     API Routes                     │
│   GET /chat                       GET /api/chat/conversations    │
│   GET /personas                   POST /api/chat/messages        │
│   GET /login                      GET /api/personas              │
│                                                                  │
│   Returns: HTML                   Returns: JSON                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## UI Navigation Structure

JubileeVerse has two distinct navigation areas that serve different purposes:

### Header Navigation (Marketing/Informational)

The **top header** contains links to marketing and informational pages about JubileeVerse. These are public-facing pages that explain the platform, showcase features, and help visitors learn about the service.

**Location:** `views/partials/header.html`

| Link | Route | Purpose |
|------|-------|---------|
| Home | `/home` | Hero landing page with Jubilee Inspire branding |
| Personas | `/personas` | Browse AI Bible personas |
| Bible | `/bible` | Bible study resources |
| Resources | `/resources` | Additional learning materials |

### Sidebar Navigation (App/Features)

The **left sidebar** contains links to the application's core features. These are functional areas where users interact with the platform to accomplish tasks.

**Location:** `views/partials/sidebar.html`

| Icon | Route | Purpose |
|------|-------|---------|
| Menu | (toggle) | Opens slide-out panel with all links |
| Search | `/search` | AI-powered semantic search (default landing page) |
| Chat Inbox | `/chat` | Chat conversations with AI personas |
| Communities | `/communities` | Community forums and groups |
| Ministries | `/ministries` | Ministry organizations |
| Projects | `/projects` | Collaborative projects |
| Music | `/music` | Worship music library |
| Bible | `/bible` | Bible reading interface |
| Books | `/books` | Book library |
| Articles | `/articles` | Article archive |

### Right Rail Panels (Chat)

The chat page includes a fixed right rail with slide-out panels for quick context switches.

**Location:** `views/pages/chat.html`

| Icon | Panel | Purpose |
|------|-------|---------|
| Flag | Language panel | Select response language |
| Person | Inspire personas | Quick view of the 12 Inspire family personas |

### Right Floating Icons (Search)

The search page includes a floating icon stack with a persona panel.

**Location:** `views/pages/search.html`

| Icon | Panel | Purpose |
|------|-------|---------|
| Flag | - | Language shortcut |
| Person | Inspire personas | Slide-out list of the 12 Inspire family personas |

### Default Landing Page

Visitors arriving at the root URL (`/`) are directed to the **Search page** (`search.html`), not the Home page. This is intentional:

- **Search** is the primary feature users want to access
- **Home** is a promotional landing page accessed via the header

```javascript
// src/routes/pages.js
router.get('/', PageController.search);    // Default landing
router.get('/home', PageController.home);  // Hero page
router.get('/search', PageController.search);
```

### Component Loader

Both header and sidebar are loaded dynamically using the `ComponentLoader` module:

```javascript
// website/js/modules/components.js
ComponentLoader.initPage();  // Loads header, sidebar, sets active nav
```

The component loader handles:
- Dynamic partial injection
- Active link highlighting based on current route
- Context-aware menu behavior (slide panel vs. custom handlers)
- Page-specific icon styling (e.g., yellow highlight on home page)

## Server-Side Rendering

### When to Use SSR

1. **Initial page loads**: Better SEO, faster First Contentful Paint
2. **Static content**: Pages that rarely change
3. **Error pages**: 404, 500
4. **Email templates**: HTML emails

### EJS Templates

```
views/
├── pages/           # Full page templates
├── partials/        # Reusable components
└── errors/          # Error pages
```

**Example: views/pages/chat.ejs**

```html
<%- include('../partials/header', {
  title: 'Chat - JubileeVerse',
  scripts: ['/js/chat.js']
}) %>

<main class="chat-layout">
  <!-- Server-rendered conversation list (for initial load) -->
  <aside class="sidebar" id="conversation-list">
    <% if (conversations && conversations.length) { %>
      <% conversations.forEach(conv => { %>
        <div class="conversation-item" data-id="<%= conv.id %>">
          <h3><%= conv.title %></h3>
          <p><%= conv.lastMessage %></p>
        </div>
      <% }) %>
    <% } else { %>
      <p class="empty-state">No conversations yet</p>
    <% } %>
  </aside>

  <!-- Hydrated by JavaScript -->
  <section class="chat-main" id="chat-container">
    <!-- Chat UI injected here -->
  </section>
</main>

<%- include('../partials/footer') %>
```

### Page Controller

```javascript
// src/controllers/PageController.js
const chat = asyncHandler(async (req, res) => {
  // Fetch data for initial render
  const conversations = await ConversationService.getUserConversations(
    req.session.userId,
    { limit: 20 }
  );

  // Render EJS template with data
  res.render('pages/chat', {
    user: req.session.user,
    conversations,
    activeConversationId: req.params.conversationId || null
  });
});
```

## Client-Side JavaScript

### Architecture

```
website/js/
├── main.js              # Shared utilities, API client
├── chat.js              # Chat functionality
├── personas.js          # Persona browser
└── utils/
    ├── api.js           # API wrapper
    ├── websocket.js     # WebSocket connection
    └── dom.js           # DOM utilities
```

### API Client

```javascript
// website/js/utils/api.js
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',  // Send cookies
      ...options
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API Error');
    }

    return response.json();
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
```

### Example: Chat Module

```javascript
// website/js/chat.js
class ChatManager {
  constructor() {
    this.conversationId = null;
    this.websocket = null;
    this.messageContainer = document.getElementById('messages');
  }

  async init() {
    // Get conversation ID from URL or create new
    this.conversationId = this.getConversationIdFromUrl();

    // Connect WebSocket for real-time updates
    await this.connectWebSocket();

    // Load conversation history
    if (this.conversationId) {
      await this.loadMessages();
    }

    // Set up event listeners
    this.bindEvents();
  }

  async loadMessages() {
    const { messages } = await API.get(
      `/chat/conversations/${this.conversationId}/messages`
    );

    this.renderMessages(messages);
  }

  async sendMessage(content) {
    // Show optimistic UI
    this.renderMessage({ type: 'user', content, pending: true });

    try {
      // Use async endpoint for non-blocking AI response
      const { requestId } = await API.post(
        `/chat/conversations/${this.conversationId}/messages/async`,
        { content }
      );

      // Response will come via WebSocket
      this.pendingRequests.set(requestId, content);
    } catch (error) {
      this.showError('Failed to send message');
    }
  }

  connectWebSocket() {
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;

    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      // Identify user for targeted messages
      this.websocket.send(JSON.stringify({
        type: 'identify',
        userId: this.getUserId()
      }));
    };

    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleWebSocketMessage(message);
    };
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'ai-response-complete':
        this.renderMessage(message.message);
        break;
      case 'ai-response-started':
        this.showTypingIndicator();
        break;
      case 'ai-response-error':
        this.showError(message.error);
        break;
    }
  }

  renderMessages(messages) {
    this.messageContainer.innerHTML = messages
      .map(msg => this.createMessageHTML(msg))
      .join('');
  }

  createMessageHTML(message) {
    return `
      <div class="message message--${message.type}">
        <div class="message__content">${this.escapeHtml(message.content)}</div>
        <div class="message__time">${this.formatTime(message.createdAt)}</div>
      </div>
    `;
  }

  // ... additional methods
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const chat = new ChatManager();
  chat.init();
});
```

## API Design

### REST Conventions

| HTTP Method | Usage | Example |
|-------------|-------|---------|
| GET | Read resource(s) | `GET /api/personas` |
| POST | Create resource | `POST /api/chat/conversations` |
| PUT | Update resource | `PUT /api/chat/conversations/:id` |
| DELETE | Delete resource | `DELETE /api/chat/conversations/:id` |

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### API Endpoints

#### Authentication
```
POST /auth/login              # Login
POST /auth/logout             # Logout
POST /auth/register           # Register
POST /auth/forgot-password    # Request password reset
POST /auth/reset-password     # Reset password
GET  /auth/me                 # Get current user
```

#### Personas
```
GET  /api/personas            # List personas
GET  /api/personas/featured   # Featured personas
GET  /api/personas/categories # Persona categories
GET  /api/personas/search     # Search personas
GET  /api/personas/:id        # Get persona by ID
```

#### Chat
```
GET    /api/chat/conversations           # List user conversations
POST   /api/chat/conversations           # Create conversation
GET    /api/chat/conversations/:id       # Get conversation
PUT    /api/chat/conversations/:id       # Update conversation
DELETE /api/chat/conversations/:id       # Delete conversation
GET    /api/chat/conversations/:id/messages     # Get messages
POST   /api/chat/conversations/:id/messages     # Send message (sync)
POST   /api/chat/conversations/:id/messages/async  # Send message (async)
GET    /api/chat/request/:requestId/status      # Check async status
DELETE /api/chat/request/:requestId             # Cancel async request
```

#### Admin
```
GET  /api/admin/health        # Health check
GET  /api/admin/live          # Liveness probe
GET  /api/admin/ready         # Readiness probe
GET  /api/admin/queues        # Queue stats (admin)
POST /api/admin/queues/:name/pause    # Pause queue (admin)
POST /api/admin/queues/:name/resume   # Resume queue (admin)
```

## WebSocket Protocol

### Connection

```javascript
// Client connects with user identification
const ws = new WebSocket('wss://jubileeverse.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'identify',
    userId: 'user-123'
  }));
};
```

### Message Types

**Client → Server:**
```javascript
// Identify user
{ "type": "identify", "userId": "user-123" }

// Subscribe to channel
{ "type": "subscribe", "channel": "conversation:abc" }

// Unsubscribe
{ "type": "unsubscribe", "channel": "conversation:abc" }

// Ping (heartbeat)
{ "type": "ping" }
```

**Server → Client:**
```javascript
// Connection confirmed
{ "type": "connected", "connectionId": "conn-456" }

// Identified
{ "type": "identified", "userId": "user-123" }

// AI response started
{
  "type": "ai-response-started",
  "requestId": "req-789",
  "conversationId": "conv-abc"
}

// AI response complete
{
  "type": "ai-response-complete",
  "requestId": "req-789",
  "conversationId": "conv-abc",
  "message": {
    "id": "msg-xyz",
    "type": "assistant",
    "content": "Response text..."
  }
}

// AI response error
{
  "type": "ai-response-error",
  "requestId": "req-789",
  "error": "Failed to generate response"
}

// Admin broadcast
{
  "type": "admin-broadcast",
  "message": "Scheduled maintenance in 10 minutes"
}
```

## State Management

### Server-Side State

| State Type | Storage | TTL |
|------------|---------|-----|
| Session | Redis | 24 hours |
| Cache | Redis | 30s - 24h |
| User Data | PostgreSQL | Permanent |
| Conversations | PostgreSQL | Permanent |

### Client-Side State

```javascript
// Chat state management
class ChatState {
  constructor() {
    this.conversations = new Map();
    this.messages = new Map();
    this.pendingRequests = new Map();
  }

  setConversation(id, data) {
    this.conversations.set(id, data);
    this.persistToLocalStorage();
  }

  addMessage(conversationId, message) {
    const messages = this.messages.get(conversationId) || [];
    messages.push(message);
    this.messages.set(conversationId, messages);
  }

  persistToLocalStorage() {
    // Store non-sensitive data for offline access
    localStorage.setItem('jv_conversations',
      JSON.stringify([...this.conversations.entries()])
    );
  }
}
```

## Security Considerations

### CSRF Protection

Session cookies use `SameSite=Lax` to prevent CSRF:

```javascript
// Session configuration
cookie: {
  secure: true,        // HTTPS only
  httpOnly: true,      // No JS access
  sameSite: 'lax',     // CSRF protection
  maxAge: 86400000     // 24 hours
}
```

### XSS Prevention

1. **Escape HTML** in JavaScript:
```javascript
escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

2. **Content Security Policy** via Helmet:
```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
})
```

### Authentication Flow

```
1. User submits credentials
   POST /auth/login { email, password }

2. Server validates, creates session
   Set-Cookie: jv.sid=abc123; HttpOnly; Secure; SameSite=Lax

3. Subsequent requests include cookie automatically
   Cookie: jv.sid=abc123

4. Server validates session on each request
   req.session.userId → Redis lookup → User data
```

## Error Handling

### API Errors

```javascript
// Frontend error handling
async function apiCall(endpoint) {
  try {
    const response = await API.get(endpoint);
    return response;
  } catch (error) {
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.status === 429) {
      // Rate limited
      showToast('Too many requests. Please wait.');
    } else {
      // Generic error
      showToast(error.message || 'Something went wrong');
    }
    throw error;
  }
}
```

### WebSocket Reconnection

```javascript
class ReconnectingWebSocket {
  constructor(url) {
    this.url = url;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
      }
    };

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };
  }
}
```
