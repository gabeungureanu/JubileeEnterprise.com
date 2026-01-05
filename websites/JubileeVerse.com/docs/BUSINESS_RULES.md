# JubileeVerse Business Rules

This document contains business rules and standards that must be followed across the JubileeVerse.com platform.

---

## 1. Copyright Year Display

**Rule:** All copyright year displays must automatically update when the year changes.

**Implementation:**
- Use dynamic JavaScript to set the current year instead of hardcoding
- HTML: `<span id="currentYear"></span>`
- JavaScript: `document.getElementById('currentYear').textContent = new Date().getFullYear();`

**Affected Pages:**
- Login (`/login`)
- Register (`/register`)
- Forgot Password (`/forgot-password`)
- All other pages with copyright footers

**Example:**
```html
<p class="copyright">
  &copy; <span id="currentYear"></span> JubileeVerse.com |
  <a href="/terms">Terms of Use</a> |
  <a href="/privacy">Privacy Policy</a>
</p>

<script>
  document.getElementById('currentYear').textContent = new Date().getFullYear();
</script>
```

---

## 2. Default AI Persona Preference

**Rule:** Each user has a default AI persona that persists across sessions, devices, and logins. This preference is stored in PostgreSQL at the user account level.

**Business Logic:**
- When a user selects a persona on the `search.html` page while logged in, that selection becomes their default AI persona
- This default persona is stored in the `users.default_persona_id` column in PostgreSQL
- The default persona is automatically used when creating new conversations in `chat.html`
- Users can temporarily add or remove additional personas within an individual conversation
- The stored default persona remains unchanged until the user explicitly selects a new default on `search.html`

**Implementation Details:**

1. **Database Schema:**
   - Column: `users.default_persona_id` (UUID, references `personas.id`)
   - Migration: `023_user_default_persona.sql`

2. **API Endpoints:**
   - `PUT /api/user/default-persona` - Set user's default persona
   - `GET /api/user/default-persona` - Get user's default persona
   - `GET /auth/me` - Returns `defaultPersona` object when user is authenticated

3. **Frontend Integration:**
   - `search.html` / `homepage.js`: Saves persona selection to server when user clicks on a persona
   - `chat.html`: Loads user's default persona from server and uses it for new conversations
   - Fallback: If user is not logged in or has no default set, falls back to 'jubilee'

4. **Data Flow:**
   ```
   search.html (persona click)
   → PUT /api/user/default-persona
   → Update users.default_persona_id

   chat.html (page load)
   → GET /auth/me (includes defaultPersona)
   → Apply default persona to new conversations
   ```

**Affected Components:**
- `src/models/User.js` - `setDefaultPersona()`, `getDefaultPersona()`
- `src/services/AuthService.js` - `getUserById()` includes default persona
- `src/routes/api.js` - `/api/user/default-persona` endpoints
- `website/js/homepage.js` - Saves persona selection to server
- `views/pages/chat.html` - Loads and applies user's default persona

---

## 3. Translation Caching System

**Rule:** All AI-generated responses are stored in English and translated on-demand with database caching.

**Business Logic:**
- All AI responses are generated and stored in English (canonical format)
- Translations are performed on-demand when a non-English language is requested
- Translated content is cached in dedicated translation tables to avoid repeated API calls
- Cached translations are used on subsequent requests for the same language
- Translation caches are cleared when source content changes

**Database Tables:**
- `message_translations` - Caches translated message content
- `conversation_translations` - Caches translated conversation titles

**Cache Behavior:**
- First request: Translate via AI, cache result, return translated content
- Subsequent requests: Return cached translation directly
- Content update: Clear related translation cache entries

---

## Document History

| Date | Rule | Description |
|------|------|-------------|
| 2025-12-21 | Copyright Year Display | Added rule for automatic year updates |
| 2025-12-24 | Default AI Persona | Added rule for user default persona persistence |
| 2025-12-24 | Translation Caching | Added rule for translation caching system |
