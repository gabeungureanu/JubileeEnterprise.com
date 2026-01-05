# Folder and File Structure

## Root Directory Overview

```
JubileeVerse.com_v8.0/
├── help/                    # Internal documentation (you are here)
├── k8s/                     # Kubernetes manifests
├── monitoring/              # Prometheus/Grafana configuration
├── public/                  # Static assets (legacy, prefer website/)
├── scripts/                 # Database migrations, utilities
├── src/                     # Application source code
├── tests/                   # Test suites
├── views/                   # EJS templates
├── website/                 # Frontend static files
├── .dockerignore            # Docker build exclusions
├── .env.example             # Environment variable template
├── docker-compose.yml       # Local development stack
├── docker-compose.prod.yml  # Production Docker stack
├── docker-compose.monitoring.yml  # Monitoring stack
├── Dockerfile               # Application container image
├── jest.config.js           # Test configuration
├── package.json             # Dependencies and scripts
└── server.js                # Application entry point
```

## Source Code (`src/`)

```
src/
├── app.js                   # Express app configuration
├── config/
│   └── index.js             # Centralized configuration
├── cache/
│   ├── index.js             # Cache module exports
│   ├── RedisClient.js       # Redis connection management
│   └── CacheService.js      # Caching strategies and helpers
├── controllers/
│   ├── index.js             # Controller exports
│   ├── AdminController.js   # Health, queues, cache management
│   ├── AuthController.js    # Login, logout, registration
│   ├── ChatController.js    # Conversations and messages
│   ├── PageController.js    # Server-rendered pages
│   ├── PersonaController.js # Persona CRUD and search
│   └── TranslationController.js  # Translation workflow
├── database/
│   └── index.js             # PostgreSQL and Qdrant connections
├── middleware/
│   ├── index.js             # Middleware exports
│   ├── errorHandler.js      # Global error handling
│   ├── security.js          # Helmet, rate limiting
│   └── session.js           # Session and auth middleware
├── models/
│   ├── index.js             # Model exports
│   ├── User.js              # User data model
│   ├── Persona.js           # AI persona model
│   ├── Conversation.js      # Conversation model
│   └── Message.js           # Message model
├── observability/
│   ├── index.js             # Observability exports
│   ├── metrics.js           # Prometheus metrics
│   ├── tracing.js           # Distributed tracing
│   └── requestMonitor.js    # Request performance tracking
├── queue/
│   ├── index.js             # Queue module exports
│   ├── QueueManager.js      # BullMQ queue management
│   ├── AIResponseProcessor.js  # AI job processing
│   └── WebSocketService.js  # Real-time communication
├── routes/
│   ├── index.js             # Route aggregation
│   ├── admin.js             # Admin API routes
│   ├── api.js               # JSON API routes
│   ├── auth.js              # Authentication routes
│   ├── chat.js              # Chat routes
│   ├── pages.js             # HTML page routes
│   ├── personas.js          # Persona routes
│   └── translation.js       # Translation routes
├── services/
│   ├── index.js             # Service exports
│   ├── AuthService.js       # Authentication logic
│   ├── ConversationService.js  # Conversation operations
│   ├── PersonaService.js    # Persona and AI logic
│   ├── TranslationService.js   # Translation logic
│   └── UserService.js       # User profile operations
└── utils/
    └── logger.js            # Structured logging
```

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Controllers | PascalCase + "Controller" | `ChatController.js` |
| Services | PascalCase + "Service" | `PersonaService.js` |
| Models | PascalCase (singular) | `User.js`, `Persona.js` |
| Middleware | camelCase | `errorHandler.js`, `security.js` |
| Routes | camelCase | `chat.js`, `personas.js` |
| Utils | camelCase | `logger.js` |
| Tests | Match source + ".test" | `AuthService.test.js` |

## Tests (`tests/`)

```
tests/
├── setup.js                 # Jest setup and custom matchers
├── fixtures/
│   └── index.js             # Test data factories
├── mocks/
│   └── index.js             # Mock implementations
├── unit/
│   ├── services/
│   │   ├── AuthService.test.js
│   │   ├── PersonaService.test.js
│   │   └── TranslationService.test.js
│   ├── cache/
│   │   └── CacheService.test.js
│   └── queue/
│       ├── QueueManager.test.js
│       ├── WebSocketService.test.js
│       └── AIResponseProcessor.test.js
├── integration/
│   ├── api.auth.test.js
│   ├── api.personas.test.js
│   └── api.admin.test.js
└── e2e/                     # End-to-end tests (if added)
```

## Views (`views/`)

```
views/
├── admin/                   # Admin-only pages (protected by requireAdmin)
│   ├── admin.html           # Main admin dashboard
│   └── admin-hospitality.html  # Hospitality management dashboard
├── pages/                   # Public and user pages
│   ├── home.html            # Landing page
│   ├── search.html          # Search/chat interface
│   ├── chat.html            # Chat interface
│   ├── personas.html        # Persona browser
│   ├── login.html           # Login page
│   ├── register.html        # Registration page
│   ├── dashboard.html       # User dashboard
│   ├── community.html       # Community features
│   ├── hospitality.html     # Public hospitality page
│   ├── spaces.html          # Emotionally safe persona engagement
│   └── ...                  # Other public pages
├── partials/
│   ├── header.html          # Page header, navigation
│   ├── sidebar.html         # Sidebar navigation
│   └── footer.html          # Page footer, scripts
├── emails/                  # Email templates (if added)
└── errors/
    ├── 404.html             # Not found page
    └── 500.html             # Server error page
```

**Important:** All admin pages MUST be placed in `views/admin/`. This ensures:
- Clear separation between public and admin content
- Consistent path resolution in PageController
- Easier auditing of admin-accessible features

## Website/Static Files (`website/`)

```
website/
├── css/
│   ├── main.css             # Global styles
│   ├── chat.css             # Chat-specific styles
│   └── components/          # Component styles
├── js/
│   ├── main.js              # Shared JavaScript
│   ├── chat.js              # Chat functionality
│   ├── personas.js          # Persona browser
│   └── utils/               # Utility functions
├── images/
│   ├── logo.svg             # Brand assets
│   ├── personas/            # Persona avatars
│   └── icons/               # UI icons
└── fonts/                   # Custom fonts
```

## Kubernetes (`k8s/`)

```
k8s/
├── base/                    # Base manifests
│   ├── kustomization.yaml   # Kustomize configuration
│   ├── namespace.yaml       # Namespace definition
│   ├── configmap.yaml       # Non-secret configuration
│   ├── secret.yaml          # Secret template
│   ├── serviceaccount.yaml  # RBAC configuration
│   ├── deployment.yaml      # App deployment
│   ├── service.yaml         # Cluster services
│   ├── ingress.yaml         # Ingress routing
│   └── hpa.yaml             # Autoscaling + PDB
└── overlays/
    ├── development/         # Dev environment overrides
    │   └── kustomization.yaml
    └── production/          # Prod environment overrides
        └── kustomization.yaml
```

## Monitoring (`monitoring/`)

```
monitoring/
├── prometheus.yml           # Prometheus scrape config
├── alerts.yml               # Alert rules
├── alertmanager.yml         # Alert routing
├── grafana-dashboard.json   # Pre-built dashboard
├── grafana-datasources.yml  # Prometheus datasource
└── grafana-dashboards.yml   # Dashboard provisioning
```

## Key File Explanations

### `server.js`

Entry point that:
1. Initializes Redis
2. Initializes databases
3. Creates Express app
4. Starts HTTP server
5. Initializes WebSocket
6. Initializes queue workers
7. Sets up graceful shutdown

### `src/app.js`

Express configuration that:
1. Applies observability middleware (first)
2. Configures security (Helmet, CORS)
3. Sets up body parsing
4. Configures sessions
5. Applies rate limiting
6. Serves static files
7. Mounts routes
8. Configures error handling

### `src/config/index.js`

Centralized configuration that:
- Loads environment variables
- Provides defaults
- Validates required config
- Exports structured config object

### `src/middleware/index.js`

Exports all middleware for easy importing:
```javascript
const { requireAuth, rateLimiter, errorHandler } = require('./middleware');
```

### `src/routes/index.js`

Aggregates all route modules:
```javascript
router.use('/', pageRoutes);
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/api', apiRoutes);
router.use('/api/admin', adminRoutes);
```

## Adding New Files

### New Controller

1. Create `src/controllers/NewController.js`
2. Add to `src/controllers/index.js`
3. Create routes in `src/routes/new.js`
4. Add to `src/routes/index.js`

### New Service

1. Create `src/services/NewService.js`
2. Add to `src/services/index.js`
3. Create unit tests in `tests/unit/services/NewService.test.js`

### New Model

1. Create `src/models/NewModel.js`
2. Add to `src/models/index.js`
3. Create database migration in `scripts/`

### New Middleware

1. Create `src/middleware/newMiddleware.js`
2. Add to `src/middleware/index.js`
3. Apply in `src/app.js` or specific routes

### New Admin Page

Admin pages are served from `views/admin/` and protected by `requireAdmin` middleware.

1. Create `views/admin/admin-newfeature.html`
2. Add handler in `src/controllers/PageController.js`:
   ```javascript
   const adminNewFeature = asyncHandler(async (req, res) => {
     sendAdminPage(res, 'admin-newfeature');
   });
   ```
3. Export in `module.exports`
4. Add route in `src/routes/pages.js`:
   ```javascript
   router.get('/admin/newfeature', requireAdmin, PageController.adminNewFeature);
   ```

**Note:** Use `sendAdminPage()` for admin pages (from `views/admin/`) and `sendPage()` for regular pages (from `views/pages/`).

## Import Conventions

```javascript
// Use relative imports within src/
const logger = require('../utils/logger');
const { PersonaService } = require('../services');

// Use index files for cleaner imports
const { requireAuth, rateLimiter } = require('../middleware');
const { User, Persona } = require('../models');

// Destructure where appropriate
const { CacheService, RedisClient } = require('../cache');
```
