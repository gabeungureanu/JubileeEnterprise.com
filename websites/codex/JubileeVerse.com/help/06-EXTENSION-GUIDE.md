# Extension Guide

This document explains how to add new features to JubileeVerse without breaking existing functionality.

## Adding a New Feature: Step-by-Step

### Example: Adding a "Favorites" Feature

Let users mark personas as favorites.

---

### Step 1: Plan the Feature

Before coding, document:
- **Data model**: What needs to be stored?
- **API endpoints**: What operations are needed?
- **UI changes**: Where does this appear?
- **Dependencies**: What existing code is affected?

**Favorites Feature Plan:**
```
Data Model:
- user_favorites table (user_id, persona_id, created_at)

API Endpoints:
- GET /api/users/favorites          # List favorites
- POST /api/users/favorites/:id     # Add favorite
- DELETE /api/users/favorites/:id   # Remove favorite

UI:
- Heart icon on persona cards
- "My Favorites" section in dashboard
```

---

### Step 2: Create Database Migration

```sql
-- scripts/migrations/003_add_favorites.sql
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, persona_id)
);

CREATE INDEX idx_favorites_user ON user_favorites(user_id);
CREATE INDEX idx_favorites_persona ON user_favorites(persona_id);
```

---

### Step 3: Create the Model

```javascript
// src/models/Favorite.js
const db = require('../database');

const Favorite = {
  async findByUser(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    const result = await db.query(`
      SELECT p.*, f.created_at as favorited_at
      FROM user_favorites f
      JOIN personas p ON p.id = f.persona_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    return result.rows;
  },

  async add(userId, personaId) {
    const result = await db.query(`
      INSERT INTO user_favorites (user_id, persona_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, persona_id) DO NOTHING
      RETURNING *
    `, [userId, personaId]);
    return result.rows[0];
  },

  async remove(userId, personaId) {
    const result = await db.query(`
      DELETE FROM user_favorites
      WHERE user_id = $1 AND persona_id = $2
      RETURNING *
    `, [userId, personaId]);
    return result.rows[0];
  },

  async isFavorite(userId, personaId) {
    const result = await db.query(`
      SELECT 1 FROM user_favorites
      WHERE user_id = $1 AND persona_id = $2
    `, [userId, personaId]);
    return result.rows.length > 0;
  }
};

module.exports = Favorite;
```

**Update model index:**
```javascript
// src/models/index.js
const Favorite = require('./Favorite');

module.exports = {
  // ... existing exports
  Favorite
};
```

---

### Step 4: Create the Service

```javascript
// src/services/FavoriteService.js
const { Favorite, Persona } = require('../models');
const { CacheService } = require('../cache');
const { AppError } = require('../middleware/errorHandler');

const FavoriteService = {
  async getUserFavorites(userId, options = {}) {
    return CacheService.getOrSet(
      `favorites:${userId}`,
      () => Favorite.findByUser(userId, options),
      CacheService.TTL.MEDIUM
    );
  },

  async addFavorite(userId, personaId) {
    // Verify persona exists
    const persona = await Persona.findById(personaId);
    if (!persona) {
      throw new AppError('Persona not found', 404);
    }

    const result = await Favorite.add(userId, personaId);

    // Invalidate cache
    await CacheService.del(`favorites:${userId}`);

    return result;
  },

  async removeFavorite(userId, personaId) {
    const result = await Favorite.remove(userId, personaId);

    if (!result) {
      throw new AppError('Favorite not found', 404);
    }

    // Invalidate cache
    await CacheService.del(`favorites:${userId}`);

    return result;
  },

  async isFavorite(userId, personaId) {
    return Favorite.isFavorite(userId, personaId);
  }
};

module.exports = FavoriteService;
```

**Update service index:**
```javascript
// src/services/index.js
const FavoriteService = require('./FavoriteService');

module.exports = {
  // ... existing exports
  FavoriteService
};
```

---

### Step 5: Create Controller Endpoints

```javascript
// src/controllers/FavoriteController.js
const { FavoriteService } = require('../services');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const getFavorites = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const favorites = await FavoriteService.getUserFavorites(req.session.userId);

  res.json({
    success: true,
    favorites,
    count: favorites.length
  });
});

const addFavorite = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id: personaId } = req.params;

  await FavoriteService.addFavorite(req.session.userId, personaId);

  res.status(201).json({
    success: true,
    message: 'Added to favorites'
  });
});

const removeFavorite = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    throw new AppError('Not authenticated', 401);
  }

  const { id: personaId } = req.params;

  await FavoriteService.removeFavorite(req.session.userId, personaId);

  res.json({
    success: true,
    message: 'Removed from favorites'
  });
});

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite
};
```

**Update controller index:**
```javascript
// src/controllers/index.js
const FavoriteController = require('./FavoriteController');

module.exports = {
  // ... existing exports
  FavoriteController
};
```

---

### Step 6: Add Routes

```javascript
// src/routes/favorites.js
const express = require('express');
const router = express.Router();
const { FavoriteController } = require('../controllers');
const { requireAuth } = require('../middleware');

router.get('/', requireAuth, FavoriteController.getFavorites);
router.post('/:id', requireAuth, FavoriteController.addFavorite);
router.delete('/:id', requireAuth, FavoriteController.removeFavorite);

module.exports = router;
```

**Update routes index:**
```javascript
// src/routes/index.js
const favoriteRoutes = require('./favorites');

// Add to router
router.use('/api/favorites', favoriteRoutes);
```

---

### Step 7: Write Tests

```javascript
// tests/unit/services/FavoriteService.test.js
const FavoriteService = require('../../../src/services/FavoriteService');
const { Favorite, Persona } = require('../../../src/models');
const { CacheService } = require('../../../src/cache');

jest.mock('../../../src/models');
jest.mock('../../../src/cache');

describe('FavoriteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserFavorites', () => {
    it('should return cached favorites if available', async () => {
      const mockFavorites = [{ id: '1', name: 'Test Persona' }];
      CacheService.getOrSet.mockResolvedValue(mockFavorites);

      const result = await FavoriteService.getUserFavorites('user-123');

      expect(result).toEqual(mockFavorites);
      expect(CacheService.getOrSet).toHaveBeenCalledWith(
        'favorites:user-123',
        expect.any(Function),
        expect.any(Number)
      );
    });
  });

  describe('addFavorite', () => {
    it('should throw if persona does not exist', async () => {
      Persona.findById.mockResolvedValue(null);

      await expect(
        FavoriteService.addFavorite('user-123', 'bad-persona')
      ).rejects.toThrow('Persona not found');
    });

    it('should add favorite and invalidate cache', async () => {
      Persona.findById.mockResolvedValue({ id: 'persona-1' });
      Favorite.add.mockResolvedValue({ id: 'fav-1' });
      CacheService.del.mockResolvedValue(true);

      await FavoriteService.addFavorite('user-123', 'persona-1');

      expect(Favorite.add).toHaveBeenCalledWith('user-123', 'persona-1');
      expect(CacheService.del).toHaveBeenCalledWith('favorites:user-123');
    });
  });
});
```

```javascript
// tests/integration/api.favorites.test.js
const request = require('supertest');
const createApp = require('../../src/app');

// Mock dependencies
jest.mock('../../src/database');
jest.mock('../../src/models/Favorite');
jest.mock('../../src/models/Persona');

describe('Favorites API', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/favorites', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/favorites')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/favorites/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/favorites/persona-123')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
```

---

### Step 8: Add Frontend

```javascript
// website/js/favorites.js
class FavoriteManager {
  async toggle(personaId, button) {
    const isFavorite = button.classList.contains('favorited');

    try {
      if (isFavorite) {
        await API.delete(`/favorites/${personaId}`);
        button.classList.remove('favorited');
        button.setAttribute('aria-label', 'Add to favorites');
      } else {
        await API.post(`/favorites/${personaId}`);
        button.classList.add('favorited');
        button.setAttribute('aria-label', 'Remove from favorites');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      showToast('Could not update favorite');
    }
  }
}

// Initialize favorite buttons
document.querySelectorAll('.favorite-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const personaId = e.target.closest('[data-persona-id]').dataset.personaId;
    favoriteManager.toggle(personaId, e.target);
  });
});
```

---

## Common Extension Patterns

### Adding a New AI Provider

1. **Create provider adapter:**
```javascript
// src/services/ai/AnthropicProvider.js
const Anthropic = require('@anthropic-ai/sdk');

class AnthropicProvider {
  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generate({ model, messages, maxTokens }) {
    const response = await this.client.messages.create({
      model: model || 'claude-3-opus-20240229',
      max_tokens: maxTokens || 4096,
      messages
    });

    return {
      content: response.content[0].text,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens
      }
    };
  }
}

module.exports = AnthropicProvider;
```

2. **Register in factory:**
```javascript
// src/services/ai/ProviderFactory.js
const providers = {
  openai: require('./OpenAIProvider'),
  anthropic: require('./AnthropicProvider'),
  // Add new provider here
};

function getProvider(name) {
  const Provider = providers[name];
  if (!Provider) throw new Error(`Unknown provider: ${name}`);
  return new Provider();
}
```

### Adding a New Persona Category

1. **Update category constants:**
```javascript
// src/constants/categories.js
const CATEGORIES = [
  { id: 'scholar', name: 'Biblical Scholars', description: '...' },
  { id: 'counselor', name: 'Spiritual Counselors', description: '...' },
  // Add new category
  { id: 'historian', name: 'Church Historians', description: '...' }
];
```

2. **Add personas in seed data:**
```javascript
// scripts/seeds/personas.js
const personas = [
  // ... existing
  {
    name: 'Dr. Church History',
    slug: 'dr-church-history',
    category: 'historian',  // New category
    // ...
  }
];
```

### Adding Middleware

1. **Create middleware:**
```javascript
// src/middleware/requestLogger.js
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start
    });
  });

  next();
}

module.exports = requestLogger;
```

2. **Export from middleware index:**
```javascript
// src/middleware/index.js
const requestLogger = require('./requestLogger');

module.exports = {
  // ... existing
  requestLogger
};
```

3. **Apply in app.js:**
```javascript
// src/app.js
const { requestLogger } = require('./middleware');

app.use(requestLogger);
```

### Adding Environment Configuration

1. **Update .env.example:**
```bash
# New feature flag
ENABLE_NEW_FEATURE=false
NEW_FEATURE_MAX_ITEMS=100
```

2. **Add to config:**
```javascript
// src/config/index.js
module.exports = {
  // ... existing
  newFeature: {
    enabled: process.env.ENABLE_NEW_FEATURE === 'true',
    maxItems: parseInt(process.env.NEW_FEATURE_MAX_ITEMS || '100', 10)
  }
};
```

3. **Use in code:**
```javascript
const config = require('../config');

if (config.newFeature.enabled) {
  // Feature code
}
```

## Guidelines for Safe Extensions

### DO:

- ✅ Follow existing naming conventions
- ✅ Add tests for new code
- ✅ Update index.js exports
- ✅ Document new environment variables
- ✅ Use existing utility functions
- ✅ Keep controllers thin
- ✅ Put business logic in services
- ✅ Cache expensive operations
- ✅ Handle errors with AppError

### DON'T:

- ❌ Modify existing function signatures
- ❌ Remove unused exports (may break imports)
- ❌ Add direct database calls in controllers
- ❌ Skip input validation
- ❌ Hardcode configuration values
- ❌ Add business logic to models
- ❌ Create circular dependencies
- ❌ Skip cache invalidation

## Checklist for New Features

- [ ] Database migration created
- [ ] Model created and exported
- [ ] Service created and exported
- [ ] Controller created and exported
- [ ] Routes added
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Frontend updated (if applicable)
- [ ] Documentation updated
- [ ] .env.example updated (if new config)
- [ ] Existing tests still pass
