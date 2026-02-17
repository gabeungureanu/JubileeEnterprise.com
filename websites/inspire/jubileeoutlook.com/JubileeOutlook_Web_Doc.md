# JubileeOutlook.com - Comprehensive Web Documentation

**Version:** 1.0.0
**Last Updated:** February 13, 2026
**Document Scope:** Full-stack architecture, API specifications, UI structure, data flow, and system behavior

[NAMESPACE-BOOTSTRAP: VERIFIED]

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [InspireCodex API (Port 4001)](#3-inspirecodex-api-port-4001)
4. [InspireContinuum API (Port 4003)](#4-inspirecontinuum-api-port-4003)
5. [JubileeOutlook Frontend (Port 3000)](#5-jubileeoutlook-frontend-port-3000)
6. [Authentication & Security](#6-authentication--security)
7. [Data Flow & Integration Map](#7-data-flow--integration-map)
8. [User Journeys](#8-user-journeys)
9. [Database Schemas](#9-database-schemas)
10. [Complete API Endpoint Reference](#10-complete-api-endpoint-reference)
11. [Known Limitations & Future Work](#11-known-limitations--future-work)

---

## 1. System Overview

JubileeOutlook.com is a full-featured web-based email client inspired by Microsoft Outlook, providing integrated email, calendar, and contacts management. The system is composed of two backend API services and a React frontend:

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| **JubileeOutlook Frontend** | 3000 | React 19 + TypeScript | User interface |
| **InspireCodex API** | 4001 | Hono + Node.js + PostgreSQL | Identity, auth, contacts |
| **InspireContinuum API** | 4003 | Hono + Node.js + PostgreSQL | Mail, calendar, email sync |

> **Note:** A local .NET Core 9 API (`jubileeoutlook-api`) was previously scaffolded but has been removed from the project. All backend functionality is served exclusively through InspireCodex and InspireContinuum APIs.

### Service Communication Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    Browser (localhost:3000)                       │
│                  JubileeOutlook React Frontend                   │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Auth Module  │  │  Mail Module │  │  Calendar / People   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼─────────────────┼─────────────────────┼────────────────┘
          │                 │                     │
          │ codexClient     │ continuumClient     │ both clients
          │ (axios)         │ (axios)             │ (axios)
          ▼                 ▼                     ▼
┌─────────────────┐  ┌─────────────────────────────────────────┐
│  InspireCodex   │  │         InspireContinuum                │
│  API (:4001)    │  │         API (:4003)                     │
│                 │  │                                          │
│  • Auth         │  │  • Mail Folders & Messages               │
│  • Users        │  │  • Email Sync (IMAP/SMTP)               │
│  • Contacts     │  │  • Calendar Events                      │
│  • Groups       │  │  • User Settings & Sessions             │
│  • Roles        │  │  • Communities & Discussions             │
│  • Personas     │  │  • Subscriptions & Billing              │
│  • Feature Flags│  │  • Domain Registry                      │
│  • Audit Logs   │  │  • Activity Tracking                    │
│                 │  │                                          │
│  ┌───────────┐  │  │  ┌───────────┐  ┌─────────────────┐    │
│  │ PostgreSQL│  │  │  │ PostgreSQL│  │  IMAP Servers    │    │
│  │ (Codex)   │  │  │  │(Continuum)│  │  Gmail, O365,   │    │
│  │ Port 5432 │  │  │  │ Port 5434 │  │  Yahoo, iCloud   │    │
│  └───────────┘  │  │  └───────────┘  └─────────────────┘    │
└─────────────────┘  └─────────────────────────────────────────┘
```

---

## 2. Architecture & Technology Stack

### Frontend Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.4 | UI framework |
| TypeScript | 4.9.5 | Type safety |
| MUI (Material-UI) | 7.3.8 | Component library |
| Emotion | 11.14.0 | CSS-in-JS styling |
| Axios | 1.13.5 | HTTP client with interceptors |
| React Router DOM | 7.13.0 | Routing (available, not yet wired) |
| date-fns | 4.1.0 | Date formatting utilities |
| react-scripts | 5.0.1 | Build toolchain (CRA) |

### Backend Stack (Both APIs)

| Technology | Version | Purpose |
|-----------|---------|---------|
| Hono | 4.5.0 | Lightweight web framework |
| @hono/node-server | 1.11.0 | HTTP server adapter |
| PostgreSQL | - | Primary database |
| pg (node-postgres) | - | Database client |
| ImapFlow | - | IMAP email client (Continuum only) |
| Nodemailer | - | SMTP email sending (Continuum only) |
| Zod | - | Runtime schema validation |

### Monorepo Structure

```
JubileeEnterprise.com/
├── services/
│   ├── codex-api/src/index.ts          # InspireCodex API (single file, ~1949 lines)
│   └── continuum-api/src/index.ts      # InspireContinuum API (single file, ~2048 lines)
├── websites/inspire/jubileeoutlook.com/
│   └── jubileeoutlook-frontend/src/    # React frontend
└── packages/
    └── database/                       # Shared DB pool manager (@jubilee/database)
```

---

## 3. InspireCodex API (Port 4001)

### 3.1 Purpose

InspireCodex is the **identity and system-of-record** service. It manages user accounts, authentication, role-based access control, contacts, personas, feature flags, and platform settings.

### 3.2 Bootstrap & Middleware

**Entry Point:** `services/codex-api/src/index.ts`

**Startup Sequence:**
1. Initialize PostgreSQL connection pools via `@jubilee/database`
2. Create Hono app instance
3. Register middleware chain
4. Register all route handlers
5. Start HTTP server on port 4001
6. Install graceful shutdown handlers (SIGTERM, SIGINT)

**Middleware Chain (in order):**

| Order | Middleware | Path | Description |
|-------|-----------|------|-------------|
| 1 | Logger | `*` | Logs HTTP requests with method, path, status, response time |
| 2 | CORS | `*` | Origins from `CORS_ORIGINS` env (default: `http://localhost:3000`), credentials enabled |
| 3 | Rate Limiter | `/api/*` | 120 requests/IP/minute, in-memory, checks X-Forwarded-For and X-Real-IP |
| 4 | Static Files | `/uploads/*` | Serves uploaded contact photos from filesystem |

### 3.3 Database Schema (Codex Database)

**Core Tables:**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts | id (UUID), email (unique), password_hash, display_name, avatar_url |
| `roles` | System roles | id, name (unique), hierarchy_level |
| `user_roles` | Role assignments | user_id, role_id, assigned_by, resource_scope |
| `permissions` | System permissions | id, name (unique), description |
| `role_permissions` | Role-permission mapping | role_id, permission_id |
| `personas` | AI personas | id, slug (unique), name, system_prompt, personality_traits |
| `persona_categories` | Persona groupings | id, name (unique), description |
| `feature_flags` | Feature toggles | id, name (unique), is_enabled, context_rules (JSONB) |
| `platform_settings` | System config | id, key (unique), value (JSONB), is_public |
| `bible_books` | Bible reference | id, code (unique), name, book_order |
| `audit_logs` | Event audit trail | id, event_type, event_category, user_id, metadata (JSONB) |

**Contact Tables:**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `user_contacts` | Contact records | id, user_id, display_name, first/last_name, email_addresses (JSONB), phone_numbers (JSONB), company, job_title, is_favorite, is_deleted, 30+ fields |
| `contact_groups` | Contact groups | id, user_id, name, description |
| `contact_group_members` | Group membership | group_id, contact_id |
| `user_blocked_senders` | Blocked emails | id, user_id, email_address (unique per user) |
| `user_ignored_conversations` | Ignored threads | id, user_id, conversation_id (unique per user) |

### 3.4 API Endpoints

#### Health & System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service + database health check |

#### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/oauth-register` | OAuth login/register (find-or-create by email) |
| GET | `/api/auth/me` | Get current user via X-User-Id header |

**OAuth Registration Flow:**
1. Client handles OAuth provider login (Google/Microsoft/GitHub)
2. Client sends user info to `/api/auth/oauth-register`
3. API finds existing user by email or creates new one
4. Auto-assigns `member` role to new users
5. Returns user object (client stores in localStorage)

#### Users & Roles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:id` | Get user by ID |
| GET | `/api/users/email/:email` | Get user by email |
| POST | `/api/users` | Create new user |
| GET | `/api/users/:id/roles` | Get user's roles |
| GET | `/api/users/:id/permissions` | Get all permissions via roles |
| GET | `/api/users/:id/permissions/:permission` | Check specific permission |
| GET | `/api/roles` | List all roles |
| POST | `/api/users/:id/roles/:roleId` | Assign role to user |

#### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List personas (filter by category, active, featured) |
| GET | `/api/personas/:id` | Get persona by ID |
| GET | `/api/personas/slug/:slug` | Get persona by slug |
| POST | `/api/personas` | Create new persona |
| GET | `/api/persona-categories` | List persona categories |

#### Feature Flags & Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feature-flags` | List all feature flags |
| GET | `/api/feature-flags/:name` | Get flag by name |
| GET | `/api/feature-flags/:name/enabled` | Check if flag enabled (with context) |
| GET | `/api/settings` | Get all public platform settings |
| GET | `/api/settings/:key` | Get single setting |

#### Bible References & Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bible/books` | List all Bible books (ordered) |
| GET | `/api/bible/books/:code` | Get book by code |
| GET | `/api/audit-logs` | Query audit logs (filter by user, type, category) |

#### Contacts (v1 - Used by JubileeOutlook People Module)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/contacts` | Paginated contact list (favorites first, excludes soft-deleted) |
| GET | `/api/v1/contacts/search` | Search contacts by name, email, company (ILIKE) |
| GET | `/api/v1/contacts/:id` | Get single contact (ownership verified) |
| POST | `/api/v1/contacts` | Create contact (with duplicate detection, validation) |
| PUT | `/api/v1/contacts/:id` | Update contact |
| DELETE | `/api/v1/contacts/:id` | Hard delete contact |
| POST | `/api/v1/contacts/check-duplicates` | Check for duplicate contacts before creation |
| PATCH | `/api/v1/contacts/:id/favorite` | Toggle favorite status |
| PATCH | `/api/v1/contacts/:id/soft-delete` | Soft delete (recoverable) |
| PATCH | `/api/v1/contacts/:id/restore` | Restore soft-deleted contact |
| POST | `/api/v1/contacts/batch/soft-delete` | Batch soft delete (max 100) |
| POST | `/api/v1/contacts/batch/restore` | Batch restore (max 100) |
| POST | `/api/v1/contacts/batch/category` | Batch update category (max 100) |
| POST | `/api/v1/contacts/batch/delete` | Batch hard delete (max 100) |
| POST | `/api/v1/contacts/:id/photo` | Upload contact photo (multipart or base64, max 5MB) |

#### Contact Import/Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/contacts/import/vcard` | Import contacts from vCard format (max 500) |
| POST | `/api/v1/contacts/import/csv` | Import contacts from CSV format (max 500) |
| GET | `/api/v1/contacts/export/vcard` | Export all contacts as .vcf file (max 10,000) |
| GET | `/api/v1/contacts/export/csv` | Export all contacts as .csv file (max 10,000) |

#### Contact Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/contact-groups` | List all groups with member counts |
| GET | `/api/v1/contact-groups/:id` | Get group with all member contacts |
| POST | `/api/v1/contact-groups` | Create group (name max 200 chars) |
| PUT | `/api/v1/contact-groups/:id` | Update group name/description |
| DELETE | `/api/v1/contact-groups/:id` | Delete group (cascades to members) |
| POST | `/api/v1/contact-groups/:id/members` | Add contacts to group (max 100, ON CONFLICT DO NOTHING) |
| DELETE | `/api/v1/contact-groups/:id/members/:contactId` | Remove contact from group |

#### Email Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user-preferences/:userId/blocked-senders` | List blocked senders |
| POST | `/api/user-preferences/:userId/blocked-senders` | Block email sender |
| DELETE | `/api/user-preferences/:userId/blocked-senders/:email` | Unblock sender |
| GET | `/api/user-preferences/:userId/ignored-conversations` | List ignored conversations |
| POST | `/api/user-preferences/:userId/ignored-conversations` | Ignore conversation |
| DELETE | `/api/user-preferences/:userId/ignored-conversations/:id` | Stop ignoring |

### 3.5 Audit Logging

All significant operations produce audit log entries:

| Event Type | Category | Trigger |
|-----------|----------|---------|
| `user.created` | identity | User creation |
| `user.oauth_registered` | identity | New OAuth registration |
| `user.oauth_login` | identity | Existing user OAuth login |
| `role.assigned` | authorization | Role assignment |
| `persona.created` | content | Persona creation |
| `contact.created` / `.updated` / `.deleted` | contacts | Contact CRUD |
| `contact.soft_deleted` / `.restored` | contacts | Soft delete/restore |
| `contact.favorited` / `.unfavorited` | contacts | Favorite toggle |
| `contact.photo_uploaded` | contacts | Photo upload |
| `contact.batch_*` | contacts | Batch operations |
| `contact.import_vcard` / `.import_csv` | contacts | Import operations |
| `contact.export_vcard` / `.export_csv` | contacts | Export operations |
| `contact_group.created` / `.deleted` | contacts | Group lifecycle |
| `email.sender_blocked` / `.unblocked` | preferences | Email blocking |
| `email.conversation_ignored` / `.unignored` | preferences | Conversation ignoring |

### 3.6 Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": ["Optional array of validation issues"],
  "code": "OPTIONAL_ERROR_CODE"
}
```

**HTTP Status Codes:** 200, 201, 400, 401, 404, 409 (duplicate), 429 (rate limit), 500

---

## 4. InspireContinuum API (Port 4003)

### 4.1 Purpose

InspireContinuum is the **user data and activity** service. For JubileeOutlook, it provides all email operations (IMAP/SMTP sync, folder management, message CRUD, sending), calendar event management, and user settings. It also serves broader platform features like communities, subscriptions, and domain registry.

### 4.2 Bootstrap & Middleware

**Entry Point:** `services/continuum-api/src/index.ts`

**Startup:** Same pattern as Codex - initialize DB pools, create Hono app, register middleware (Logger + CORS), register routes, start server on port 4003.

### 4.3 Database Schema (Continuum Database)

**Outlook Email Tables:**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `outlook_email_accounts` | Connected email accounts | id, user_id, email_address, provider_type, encrypted_password, imap/smtp config, connection_status, last_sync_at |
| `outlook_email_folders` | Email folders | id, user_id, account_id, name, folder_type, unread_count, total_count, is_system, external_folder_id |
| `outlook_email_messages` | Email messages | id, folder_id, user_id, subject, body_preview/text/html, sender_email/name, is_read, is_flagged, importance, search_vector (tsvector) |
| `outlook_email_recipients` | Message recipients | message_id, type (to/cc/bcc), email, name |
| `outlook_email_attachments` | Message attachments | id, message_id, fileName, filePath, fileSize, mimeType, isInline |

**Outlook Calendar Tables:**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `outlook_calendars` | User calendars | id, user_id, name, external_provider_id |
| `outlook_calendar_events` | Calendar events | id, calendar_id, user_id, subject, location, description, start/end_time, is_all_day, status, category, event_color, is_recurring, reminder_minutes |
| `outlook_event_attendees` | Event attendees | id, event_id, email, rsvp_status |
| `outlook_event_attachments` | Event files | id, event_id, fileName, filePath, fileSize, url |
| `outlook_event_images` | Event images | id, event_id, fileName, mimeType, url, thumbnailUrl |

**Platform Tables:**

| Table | Purpose |
|-------|---------|
| `user_settings` | UI preferences, notifications, timezone |
| `user_sessions` | Session management with token hash |
| `subscription_plans` | Plan tiers and pricing |
| `user_subscriptions` | Active subscriptions (Stripe) |
| `payment_methods` | Stripe payment methods |
| `invoices` / `invoice_line_items` | Billing history |
| `communities` | Community metadata |
| `community_memberships` | User memberships |
| `discussion_boards` | Community boards |
| `board_conversations` / `board_messages` | Discussions |
| `user_favorites` | Favorited personas |
| `jubilee_tlds` / `jubilee_domains` | Domain registry |
| `user_activity` | Activity tracking |
| `safety_flags` / `admin_alerts` | Moderation |

**Database Triggers:**
- `update_updated_at_column()` - Auto-updates timestamps on all tables
- `update_outlook_folder_counts()` - Maintains folder unread/total counts on message changes
- `update_outlook_message_search_vector()` - Maintains full-text search indexes

### 4.4 Email Provider Detection

The API auto-detects email providers from domain:

| Domain(s) | Provider | IMAP Host | SMTP Host | App Password? |
|-----------|----------|-----------|-----------|---------------|
| gmail.com, googlemail.com | Google | imap.gmail.com:993 | smtp.gmail.com:587 | Yes |
| outlook.com, hotmail.com, live.com | Microsoft | outlook.office365.com:993 | smtp.office365.com:587 | Yes |
| yahoo.com | Yahoo | imap.mail.yahoo.com:993 | smtp.mail.yahoo.com:587 | Yes |
| icloud.com, me.com, mac.com | Apple | imap.mail.me.com:993 | smtp.mail.me.com:587 | Yes |
| (other) | Generic | imap.{domain}:993 | smtp.{domain}:587 | No |

Each provider includes specific help text for generating app passwords.

### 4.5 Email Sync Flow (End-to-End)

```
1. User enters email
   │
   ▼
2. POST /outlook/accounts/detect → Returns provider config
   │
   ▼
3. User enters password
   │
   ▼
4. POST /outlook/accounts/connect
   │  ├─ Validates IMAP credentials via ImapFlow
   │  ├─ Discovers all mailbox folders
   │  ├─ Stores account with base64-encrypted password
   │  ├─ Creates system folders (inbox, sent, drafts, trash, junk, archive)
   │  └─ Returns account object + folder list
   │
   ▼
5. POST /outlook/accounts/:id/sync
   │  ├─ Connects to IMAP server
   │  ├─ For each folder:
   │  │   ├─ Fetches last 100 messages
   │  │   ├─ Parses MIME envelope (sender, recipients, subject, date)
   │  │   ├─ Checks for duplicates via internet_message_id
   │  │   ├─ Updates flags if duplicate, inserts new otherwise
   │  │   └─ Stores message + recipients in DB
   │  ├─ Updates folder counts via triggers
   │  └─ Updates last_sync_at timestamp
   │
   ▼
6. Frontend reloads with synced data
```

### 4.6 Message Body Lazy Loading

Message bodies are fetched on-demand from IMAP to save storage:

```
1. GET /outlook/messages/:id
   │
   ▼
2. Check DB for cached body_text/body_html
   │
   ├─ IF cached → Return immediately
   │
   └─ IF not cached:
      ├─ Connect to IMAP server
      ├─ Search for message by internet_message_id
      ├─ Fetch raw MIME source
      ├─ Parse multipart sections
      ├─ Decode base64/quoted-printable content
      ├─ Extract text/plain and text/html parts
      ├─ Cache in database for future requests
      └─ Return full message with body
```

### 4.7 SMTP Send Flow

```
1. POST /outlook/messages/send
   │
   ▼
2. Lookup SMTP account by sender_email
   │
   ▼
3. Create Nodemailer transport with account credentials
   │
   ▼
4. Format recipients (To, Cc, Bcc lists)
   │
   ▼
5. Decode base64 attachments (if any)
   │
   ▼
6. Send via SMTP
   │
   ▼
7. Save copy to Sent folder in DB with recipients
   │
   ▼
8. Update folder counts
```

### 4.8 API Endpoints

#### Outlook Email Accounts

| Method | Endpoint | Timeout | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/outlook/accounts/detect` | 30s | Detect email provider from address |
| POST | `/api/v1/outlook/accounts/connect` | 60s | Connect IMAP/SMTP account |
| POST | `/api/v1/outlook/accounts/:id/sync` | 120s | Sync messages from IMAP |
| GET | `/api/v1/outlook/accounts` | 30s | List connected accounts |
| DELETE | `/api/v1/outlook/accounts/:id` | 30s | Disconnect account (cascade delete) |

#### Outlook Folders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/outlook/folders` | List all folders (hierarchical, with counts) |
| POST | `/api/v1/outlook/folders` | Create custom folder |
| PATCH | `/api/v1/outlook/folders/:id` | Rename folder (custom only, 403 for system) |
| DELETE | `/api/v1/outlook/folders/:id` | Delete folder (moves messages to trash first, 403 for system) |

#### Outlook Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/outlook/folders/:folderId/messages` | Paginated message list with recipients |
| GET | `/api/v1/outlook/messages/search` | Full-text search (PostgreSQL tsvector) |
| GET | `/api/v1/outlook/messages/:id` | Get message with lazy-loaded body |
| PATCH | `/api/v1/outlook/messages/:id` | Update flags (is_read, is_flagged) or move (folder_id) |
| DELETE | `/api/v1/outlook/messages/:id` | Permanently delete message |
| POST | `/api/v1/outlook/messages/send` | Send email via SMTP + save to Sent |
| POST | `/api/v1/outlook/messages/draft` | Create/update draft in Drafts folder |

#### Outlook Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/outlook/events` | Get events by date range (with attendees, attachments, images) |
| GET | `/api/v1/outlook/events/:id` | Get single event with full relations |
| POST | `/api/v1/outlook/events` | Create event (transaction: event + attendees + attachments + images) |
| PUT | `/api/v1/outlook/events/:id` | Update event (replaces attendees/attachments/images) |
| DELETE | `/api/v1/outlook/events/:id` | Delete event (cascade) |
| POST | `/api/v1/outlook/files/upload` | Upload file attachment (multipart/form-data, 25MB max) |
| GET | `/api/v1/outlook/files/:filename` | Download/serve uploaded file with MIME type detection |
| DELETE | `/api/v1/outlook/files/:filename` | Delete uploaded file (path traversal protected) |

#### User Settings & Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:userId/settings` | Get user settings (defaults if none) |
| PUT | `/api/users/:userId/settings` | Update/create settings |
| GET | `/api/users/:userId/sessions` | List active sessions |
| POST | `/api/users/:userId/sessions` | Create session |
| POST | `/api/sessions/:sessionId/activity` | Update session activity |
| DELETE | `/api/sessions/:sessionId` | End session |
| DELETE | `/api/users/:userId/sessions` | End all sessions (except specified) |

#### Subscriptions & Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription-plans` | List all plans |
| GET | `/api/subscription-plans/:slug` | Get plan by slug |
| GET | `/api/users/:userId/subscription` | Get active subscription |
| POST | `/api/users/:userId/subscription` | Create subscription |
| POST | `/api/subscriptions/:id/cancel` | Cancel subscription |
| GET | `/api/users/:userId/payment-methods` | List payment methods |
| GET | `/api/users/:userId/invoices` | List invoices |

#### Communities & Discussions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/communities` | List communities (filter: visibility, pagination) |
| GET | `/api/communities/:id` | Get community by ID |
| GET | `/api/communities/slug/:slug` | Get community by slug |
| POST | `/api/communities` | Create community |
| GET | `/api/communities/:id/members` | List members |
| POST | `/api/communities/:id/join` | Join community |
| POST | `/api/communities/:id/leave` | Leave community |
| GET | `/api/communities/:communityId/boards` | List boards |
| GET | `/api/boards/:boardId/conversations` | List conversations |
| GET | `/api/board-conversations/:id/messages` | Get messages |

#### Other Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:userId/favorites` | Get user favorites |
| POST | `/api/users/:userId/favorites` | Add favorite |
| DELETE | `/api/users/:userId/favorites/:type/:id` | Remove favorite |
| GET | `/api/domains/tlds` | List available TLDs |
| GET | `/api/users/:userId/domains` | List user domains |
| GET | `/api/domains/check` | Check domain availability |
| POST | `/api/domains` | Register domain |
| POST | `/api/activity` | Log user activity |
| GET | `/api/users/:userId/activity` | Get user activity |
| GET | `/api/admin/safety-flags` | Admin: safety flags |
| GET | `/api/admin/alerts` | Admin: alerts |
| GET | `/health` | Service health check |

### 4.9 Database Transactions

Multi-table operations use PostgreSQL transactions:

```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Insert event, attendees, attachments, images
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

Used for: event creation/updates, message sending, account connection, folder deletion.

---

## 5. JubileeOutlook Frontend (Port 3000)

### 5.1 Application Architecture

```
src/
├── index.tsx                    # ReactDOM entry point
├── App.tsx                      # Root: ThemeProvider → AuthProvider → AppContent
├── types/                       # TypeScript interfaces & DTO mappers
│   ├── common/index.ts          # User, LoginResponse, SyncStatus, NetworkStatus
│   ├── mail/index.ts            # MailFolder, EmailMessage, DTOs, mappers
│   ├── calendar/index.ts        # CalendarEvent, DTOs, mappers
│   └── contacts/index.ts        # Contact, ContactGroup, DTOs, mappers
├── context/                     # React Context providers
│   ├── AuthContext.tsx           # Auth state, login/register/logout
│   ├── AppContext.tsx            # Module switching, pane visibility, network/sync status
│   └── MailContext.tsx           # Mail state wrapper (folders, messages, actions)
├── services/                    # API client layer
│   ├── apiClient.ts             # Axios instances + token refresh interceptors
│   ├── auth/authService.ts      # Auth API calls
│   ├── mail/mailService.ts      # Mail folder/message API calls
│   ├── mail/emailSyncService.ts # IMAP/SMTP account sync API calls
│   ├── calendar/calendarService.ts
│   ├── contacts/contactService.ts
│   └── sync/syncService.ts      # Local sync state machine
├── hooks/useApi.ts              # Generic async API hook
├── utils/formatters.ts          # File size, date, initials formatting
├── components/
│   ├── layout/                  # AppLayout, AppRail, TitleBar, StatusBar, Ribbons
│   ├── mail/                    # FolderPane, MessageList, ReadingPane, ComposeMail
│   ├── calendar/                # CalendarGrid, MiniCalendar, EventDialog, ReminderPopup
│   └── people/                  # ContactGroups, ContactList, ContactDetail, ContactDialog
├── pages/
│   ├── Auth/SignIn.tsx           # Multi-panel auth with email sync
│   ├── Mail/MailPage.tsx         # Mail module orchestrator
│   ├── Calendar/CalendarPage.tsx # Calendar module
│   └── People/PeoplePage.tsx    # People module
└── styles/
    ├── variables.css             # CSS custom properties
    ├── global.css                # Global styles
    └── themes/dark.ts            # MUI dark theme definition
```

### 5.2 Theme & Styling

**MUI Dark Theme:**
- Primary: Gold `#ffbd59` (Jubilee brand)
- Secondary: Blue `#0078D4` (Microsoft accent)
- Background: Pure black `#000000`
- Error: Red `#D13438`
- Success: Green `#107C10`
- Typography: Roboto, 13px base

**CSS Architecture:** Component-level CSS files with BEM-like naming (`.component__element--modifier`).

### 5.3 Context Providers (State Management)

#### AuthContext

**State:**
```typescript
{
  user: User | null,
  isAuthenticated: boolean,
  isLoading: boolean
}
```

**Exposed Methods:**
- `login(email, password, rememberMe?)` - Calls Codex `/auth/login`, stores tokens
- `register(fullName, email, password, newsletter?)` - Calls Codex `/auth/register`
- `logout()` - Clears tokens and sync data

**Authentication Modes:**
1. **Full Auth** - User has Codex tokens (access + refresh)
2. **Sync-Only** - User synced email but has no Codex account (detected via `jubilee_sync_email` in localStorage)

#### AppContext

**State:**
```typescript
{
  activeModule: 'mail' | 'calendar' | 'people',
  isFolderPaneVisible: boolean,
  networkStatus: 'online' | 'offline' | 'checking',
  syncStatus: { lastSyncTime, isSyncing, pendingOperations }
}
```

**Exposed Methods:** `setActiveModule`, `toggleFolderPane`, `setNetworkStatus`, `setSyncStatus`

#### MailContext

**State:** Wrapper context - values created in MailPage, passed down via provider.

**Exposed Values:**
```typescript
{
  selectedMessage, selectedFolderId, folders, messages,
  deleteMessage, archiveMessage, toggleFlag, toggleRead,
  openCompose, searchMessages, clearSearch,
  refreshMessages, refreshFolders
}
```

### 5.4 Services Layer

#### apiClient.ts - HTTP Infrastructure

**Two Axios Instances:**

| Client | Base URL | Used For |
|--------|----------|----------|
| `continuumClient` | `REACT_APP_CONTINUUM_API_URL` (default: `https://inspirecontinuum.com/api/v1`) | Mail, Calendar, Email Sync |
| `codexClient` | `REACT_APP_CODEX_API_URL` (default: `https://inspirecodex.com/api/v1`) | Auth, Contacts, Groups |

**Token Management:**
- Storage keys: `jubilee_access_token`, `jubilee_refresh_token`, `jubilee_user_id`
- Request interceptor injects `Authorization: Bearer {token}` and `X-User-Id: {userId}`
- Response interceptor catches 401 → refreshes token → retries original request
- Request queue prevents thundering herd during refresh

#### Service Methods Summary

| Service | Methods | Client Used |
|---------|---------|-------------|
| `authService` | login, register, logout, getCurrentUser, forgotPassword, verifyResetCode, resetPassword | codexClient |
| `mailService` | getFolders, getMessages, getMessage, sendMessage, saveDraft, deleteMessage, markAsRead, toggleFlag, moveMessage, searchMessages, createFolder, renameFolder, deleteFolder | continuumClient |
| `emailSyncService` | detectProvider, connectAccount, syncAccount, getAccounts, disconnectAccount | continuumClient |
| `calendarService` | getEvents, getEvent, createEvent, updateEvent, deleteEvent, getEventsForMonth, getEventsForDay | continuumClient |
| `contactService` | getContacts, getContact, createContact, updateContact, deleteContact, searchContacts, getGroups, createGroup, updateGroup, deleteGroup, addMembersToGroup, removeMemberFromGroup | codexClient |

### 5.5 Pages

#### SignIn Page (`pages/Auth/SignIn.tsx`)

Five-panel authentication flow:

| Panel | Purpose | Actions |
|-------|---------|---------|
| `sync` | Email entry for sync | Validate email, detect provider |
| `sync-password` | Sync password entry | Connect IMAP account, sync emails |
| `signin` | Account sign-in | Login with email/password |
| `signup` | Account registration | Register with name/email/password |
| `forgot` | Password reset | Send reset email |

**Key Feature:** Users can sync their existing email without creating a JubileeOutlook account first (anonymous sync with deterministic UUID from email hash).

#### MailPage (`pages/Mail/MailPage.tsx`)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│                     MailRibbon                            │
├────────────┬────────────────┬────────────────────────────┤
│            │                │                            │
│  Folder    │  Message       │  ReadingPane               │
│  Pane      │  List          │  (or ComposeMail)          │
│            │                │                            │
│  • Inbox   │  • Subject     │  • Full message HTML       │
│  • Sent    │  • Preview     │  • Attachments             │
│  • Drafts  │  • Flags       │  • Print support           │
│  • Trash   │  • Search      │                            │
│  • Custom  │                │                            │
└────────────┴────────────────┴────────────────────────────┘
```

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| Delete/Backspace | Delete selected message |
| Ctrl+N | New email |
| Ctrl+R | Reply |
| Ctrl+Shift+R | Reply All |
| Ctrl+F | Forward |
| Arrow Up/Down | Navigate messages |

#### CalendarPage (`pages/Calendar/CalendarPage.tsx`)

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  CalendarRibbon [New Event] [Today] [Day|WorkWeek|Week|Month]│
│  [Templates] [Export] [Share]                                │
├──────────────┬───────────────────────────────────────────────┤
│              │  🔍 Search events...                [filter]  │
│ MiniCalendar │───────────────────────────────────────────────│
│ (sidebar)    │  ← → Friday, February 6, 2026 [Today]        │
│              │         [Day] [Work Week] [Week] [Month]      │
│ << Feb 2026>>│───────────────────────────────────────────────│
│ [date picker]│  CalendarGrid (Day/Week/WorkWeek/Month)       │
│              │  24-hour scrollable time grid (60px/hour)     │
│ My Calendars │  • Event blocks positioned by start/duration  │
│ ☑ My Calendar│  • Overlap detection (side-by-side columns)   │
│ ☑ Work       │  • Drag & drop to move events (15-min snap)  │
│ ☑ Personal   │  • Resize bottom edge to adjust duration      │
│ ☑ Holidays   │  • Current time indicator (red dot + line)    │
└──────────────┴───────────────────────────────────────────────┘
```

**View Modes:** Day, WorkWeek, Week, Month — all fully implemented with time grid views.

**Status:** Fully functional with API integration (Continuum API CRUD), 5-minute event cache, recurring event expansion, reminders, search, drag & drop, resize, file attachments, timezone support, templates, sharing, iCal export, and keyboard shortcuts.

**Keyboard Shortcuts:** Ctrl+N (new event), T (today), Left/Right (navigate), 1-4 (views), Ctrl+F (search), Escape (close dialog).

#### PeoplePage (`pages/People/PeoplePage.tsx`)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│                   PeopleRibbon                            │
├─────────────┬────────────────┬───────────────────────────┤
│             │                │                           │
│  Contact    │  Contact       │  Contact                  │
│  Groups     │  List          │  Detail                   │
│             │                │                           │
│  • All      │  • Avatar      │  • Full info              │
│  • Favorites│  • Name        │  • Email links            │
│  • Groups   │  • Email       │  • Phone numbers          │
│             │  • Search      │  • Notes                  │
└─────────────┴────────────────┴───────────────────────────┘
```

**Status:** UI-only. Contacts and groups arrays are always empty (no API loading wired).

### 5.6 Key Components

#### FolderPane
- Recursive folder tree rendering with expand/collapse
- Right-click context menu: New Folder, Rename, Delete
- Inline editing for rename and new folder creation
- System folders (inbox, sent, drafts, trash) protected from rename/delete
- Unread count badges

#### MessageList
- Debounced search (300ms) with Enter for immediate fire
- Unread indicator (blue dot + bold text)
- Flag toggle directly in list
- Attachment indicator icon
- Loading spinner and empty state

#### ReadingPane
- Full HTML message body rendering (`dangerouslySetInnerHTML`)
- Sender avatar with initials fallback
- Recipient list display
- Print function (opens formatted print window)
- Attachment list with file details

#### ComposeMail
- Rich text editor (contenteditable div with `document.execCommand`)
- Formatting toolbar: Bold, Italic, Underline, Strikethrough, Lists, Alignment
- To/Cc/Bcc recipient fields with show/hide toggle
- File attachment support (multi-file, base64 encoding)
- Insert link button
- Importance toggle (normal/high/low)
- Auto-save drafts every 30 seconds (hash-based change detection)
- Quote building for Reply/ReplyAll/Forward modes
- Recipient parsing: `user@email.com` or `"Name" <email>` format

#### CalendarGrid
- **Month view**: 7-column grid, event chips with color borders, first 3 events per day with "+N more" indicator, today highlighting, other-month day fading
- **Day/Week/WorkWeek views**: 24-hour scrollable time grid (60px/hour), event blocks positioned by start time and sized by duration
- **Event overlap detection**: Cluster-based column assignment, overlapping events render side-by-side with calculated `left%` and `width%`
- **Drag & drop**: Native HTML5 drag to move events between time slots (15-minute snap), visual drag-over highlight
- **Event resize**: `EventResizeHandle` component at bottom of each timed event, mousedown/mousemove/mouseup pattern, 15-minute minimum
- **All-day events row**: Rendered above time grid when all-day events are present
- **Current time indicator**: Red dot + line on today's column, updates every 60 seconds
- **Column headers**: Day name + number with today highlighted in gold (#ffbd59)
- Category-based color coding

#### MiniCalendar
- Compact month date picker
- Independent navigation from main calendar
- Today and selected date highlighting

### 5.7 Type System

**DTO → UI Type Mapping Pattern:**

API responses use `snake_case` (matching PostgreSQL). Frontend types use `camelCase`. Mapper functions convert between them:

```typescript
// API Response (snake_case)
interface MailFolderDto {
  folder_type: string;
  unread_count: number;
  parent_folder_id: string | null;
}

// Frontend Type (camelCase)
interface MailFolder {
  folderType: FolderType;
  unreadItemCount: number;
  parentFolderId: string | null;
}

// Mapper
function mapFolderDto(dto: MailFolderDto): MailFolder { ... }
```

**Key Types:**

| Type | Location | Fields |
|------|----------|--------|
| `User` | types/common | id, email, displayName, avatarUrl |
| `MailFolder` | types/mail | id, displayName, folderType, unreadItemCount, childFolders[] |
| `EmailMessage` | types/mail | id, subject, from, to[], cc[], bcc[], bodyHtml, bodyText, isRead, isFlagged, attachments[] |
| `CalendarEvent` | types/calendar | id, title, startDateTime, endDateTime, isAllDay, category, eventColor, attendees[] |
| `Contact` | types/contacts | id, displayName, firstName, lastName, emailAddresses[], phoneNumbers[], company, isFavorite |
| `ContactGroup` | types/contacts | id, name, description, memberCount |

---

## 6. Authentication & Security

### 6.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authentication Modes                         │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│  Mode 1: Sync-Only           │  Mode 2: Full Auth               │
│                              │                                  │
│  1. Enter email              │  1. Enter email + password       │
│  2. Enter password           │  2. POST /auth/login             │
│  3. POST /accounts/connect   │  3. Receive access + refresh     │
│  4. POST /accounts/:id/sync  │     tokens                      │
│  5. Store sync_email in      │  4. Store tokens in localStorage │
│     localStorage             │  5. X-User-Id + Bearer token     │
│  6. Create temp User from    │     on all requests              │
│     email                    │                                  │
│  7. X-User-Id on requests    │                                  │
│                              │                                  │
│  Can upgrade to Full Auth    │                                  │
│  via TitleBar login          │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

### 6.2 Token Management

| Token | Storage Key | Purpose |
|-------|-------------|---------|
| Access Token | `jubilee_access_token` | Bearer authentication |
| Refresh Token | `jubilee_refresh_token` | Token refresh on 401 |
| User ID | `jubilee_user_id` | X-User-Id header |
| Sync Email | `jubilee_sync_email` | Sync-only auth detection |
| Remember Email | `jubilee_remember_email` | Auto-fill on return |

### 6.3 Token Refresh Flow

```
Request → 401 Response
   │
   ├─ Is refresh already in progress?
   │   ├─ YES → Queue request, wait for refresh
   │   └─ NO → Start refresh:
   │           POST /auth/refresh { refreshToken }
   │           ├─ Success → Store new tokens, retry all queued requests
   │           └─ Failure → Clear tokens, redirect to /login
```

### 6.4 Security Considerations

| Area | Current State | Notes |
|------|--------------|-------|
| Token Storage | localStorage | Vulnerable to XSS (consider HttpOnly cookies) |
| Password Encryption | Base64 (IMAP accounts) | Should be AES-256 |
| HTML Rendering | `dangerouslySetInnerHTML` | Needs DOMPurify sanitization |
| CORS | API-enforced with credentials | Properly configured |
| Rate Limiting | 120 req/min/IP (Codex only) | In-memory, not distributed |
| SQL Injection | Parameterized queries ($1, $2) | Protected |
| User Enumeration | Forgot password always returns success | Protected |
| Row-Level Security | Contact/group ownership verified | Properly implemented |

---

## 7. Data Flow & Integration Map

### 7.1 Frontend → API Data Flow

```
React Component
     │
     ├── useAuth()     ──► AuthContext ──► authService ──► codexClient ──► Codex API
     │
     ├── useAppContext()──► AppContext (local state only)
     │
     └── useMailContext()──► MailContext ──► mailService  ──► continuumClient ──► Continuum API
                                          emailSyncService
                                          calendarService
                                          contactService ──► codexClient ──► Codex API
```

### 7.2 API Response Transformation

```
PostgreSQL (snake_case)
  │
  ▼
API Response (snake_case JSON)
  │
  ▼
Axios Interceptor (attach auth headers)
  │
  ▼
Service Layer (extract response.data)
  │
  ▼
DTO Mapper (snake_case → camelCase)
  │
  ▼
React Component State (camelCase)
  │
  ▼
UI Rendering
```

### 7.3 Cross-Service Data Dependencies

```
Codex (Identity)                    Continuum (Data)
┌─────────────────┐                ┌─────────────────────────┐
│ users.id ────────┼───shared──────┼─► user_id (all tables)  │
│                  │   via         │                          │
│ users.email ─────┼───X-User-Id──┼─► outlook_email_accounts │
│                  │   header      │                          │
│ user_contacts    │               │  outlook_email_messages  │
│ contact_groups   │               │  outlook_calendar_events │
│ blocked_senders  │               │  user_settings           │
└─────────────────┘                └─────────────────────────┘
```

---

## 8. User Journeys

### 8.1 First-Time Email Sync (No Account)

1. User navigates to JubileeOutlook.com
2. SignIn page shows "sync" panel
3. User enters email (e.g., user@gmail.com) → "Continue"
4. API detects Gmail provider, returns IMAP/SMTP config
5. SignIn shows "sync-password" panel with Gmail app password instructions
6. User enters Gmail app password → "Confirm"
7. App generates deterministic UUID from email hash
8. App calls `connectAccount(email, password, uuid)` → IMAP validates credentials
9. App calls `syncAccount(accountId)` → fetches last 100 messages per folder
10. App stores `jubilee_sync_email` in localStorage, page reloads
11. AuthContext detects sync-only user, renders AppLayout
12. Mail loads with synced folders and messages

### 8.2 Reading & Replying to Email

1. User clicks message in MessageList
2. App calls `mailService.getMessage(id)` → lazy-loads body from IMAP if needed
3. ReadingPane displays full HTML body
4. App calls `mailService.markAsRead(id, true)` → marks as read
5. User clicks "Reply" (or Ctrl+R)
6. ComposeMail opens with:
   - To: Original sender
   - Subject: "RE: " + original subject
   - Body: Quoted original message
7. User types reply, optionally attaches files
8. User clicks "Send" (or Ctrl+Enter)
9. App calls `mailService.sendMessage(...)` → sends via SMTP, saves to Sent
10. Compose closes, messages and folders refresh

### 8.3 Managing Folders

1. User right-clicks folder in FolderPane
2. Context menu appears: New Folder / Rename / Delete
3. **New Folder:** Inline input appears → type name → Enter → API creates folder
4. **Rename:** Inline input replaces folder name → type new name → Enter → API renames
5. **Delete:** Confirmation prompt → API moves messages to trash, deletes folder
6. System folders (Inbox, Sent, Drafts, Trash) cannot be renamed or deleted

### 8.4 Calendar Navigation

1. User clicks "Calendar" in AppRail
2. CalendarPage renders with current month
3. MiniCalendar shows small month picker in sidebar
4. CalendarGrid shows month view with event chips
5. User clicks Previous/Next arrows to navigate months
6. User clicks "Today" to jump to current date
7. User clicks date in MiniCalendar to jump to that date

### 8.5 Upgrading from Sync-Only to Full Account

1. User is in sync-only mode (synced email, no Codex account)
2. User clicks profile avatar in TitleBar
3. Profile popup shows "Sign in to sync your data"
4. User clicks "Sign in" → login form appears in popup
5. User enters Codex credentials → `authService.login()` called
6. Tokens stored, user now has full auth
7. Page reloads with full account features

---

## 9. Database Schemas

### 9.1 Codex Database (Port 5432)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     users        │     │      roles       │     │   permissions    │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ id (PK, UUID)   │◄──┐ │ id (PK, UUID)    │◄──┐ │ id (PK, UUID)   │
│ email (UNIQUE)  │   │ │ name (UNIQUE)    │   │ │ name (UNIQUE)   │
│ password_hash   │   │ │ hierarchy_level  │   │ │ description     │
│ display_name    │   │ └──────────────────┘   │ └─────────────────┘
│ avatar_url      │   │                        │          ▲
│ created_at      │   │ ┌──────────────────┐   │ ┌───────┴─────────┐
│ updated_at      │   │ │   user_roles     │   │ │role_permissions  │
└─────────────────┘   │ ├──────────────────┤   │ ├─────────────────┤
         ▲            └─┤ user_id (FK)     │   └─┤ role_id (FK)    │
         │              │ role_id (FK)     │     │ permission_id   │
         │              │ assigned_by      │     └─────────────────┘
         │              └──────────────────┘
         │
┌────────┴────────┐     ┌──────────────────┐     ┌─────────────────┐
│  user_contacts   │     │  contact_groups  │     │  audit_logs     │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ id (PK, UUID)   │◄──┐ │ id (PK, UUID)    │     │ id (PK, UUID)   │
│ user_id (FK)    │   │ │ user_id (FK)     │     │ event_type      │
│ display_name    │   │ │ name             │     │ event_category  │
│ first/last_name │   │ │ description      │     │ user_id (FK)    │
│ email_addresses │   │ └──────────────────┘     │ resource_type   │
│ phone_numbers   │   │          ▲               │ metadata (JSONB)│
│ company         │   │ ┌────────┴─────────┐     │ created_at      │
│ is_favorite     │   │ │contact_group_    │     └─────────────────┘
│ is_deleted      │   │ │  members         │
│ 25+ more fields │   │ ├──────────────────┤
└─────────────────┘   └─┤ contact_id (FK)  │
                        │ group_id (FK)    │
                        └──────────────────┘
```

### 9.2 Continuum Database (Port 5434)

```
┌─────────────────────┐
│ outlook_email_      │     ┌──────────────────────────┐
│   accounts          │     │ outlook_email_folders     │
├─────────────────────┤     ├──────────────────────────┤
│ id (PK, UUID)       │◄────┤ account_id (FK)          │
│ user_id             │     │ id (PK, UUID)            │
│ email_address       │     │ user_id                  │
│ provider_type       │     │ name                     │
│ encrypted_password  │     │ folder_type              │
│ imap_host/port      │     │ unread_count             │
│ smtp_host/port      │     │ total_count              │
│ connection_status   │     │ is_system                │
│ last_sync_at        │     │ external_folder_id       │
└─────────────────────┘     └──────────┬───────────────┘
                                       │
                            ┌──────────▼───────────────┐
                            │ outlook_email_messages    │
                            ├──────────────────────────┤
                            │ id (PK, UUID)            │
                            │ folder_id (FK)           │
                            │ user_id                  │
                            │ subject                  │
                            │ body_preview/text/html   │
                            │ sender_email/name        │
                            │ is_read, is_flagged      │
                            │ importance               │
                            │ search_vector (tsvector)  │
                            │ internet_message_id      │
                            └──────────┬───────────────┘
                                       │
                    ┌──────────────────┬┴───────────────────┐
                    ▼                  ▼                    ▼
         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
         │ outlook_email_  │ │ outlook_email_  │ │ outlook_email_  │
         │  recipients     │ │  attachments    │ │  (triggers)     │
         ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
         │ message_id (FK) │ │ message_id (FK) │ │ folder_counts   │
         │ type (to/cc/bcc)│ │ fileName        │ │ search_vector   │
         │ email, name     │ │ fileSize, type  │ │ updated_at      │
         └─────────────────┘ └─────────────────┘ └─────────────────┘


┌─────────────────────┐     ┌──────────────────────────┐
│ outlook_calendars    │     │ outlook_calendar_events   │
├─────────────────────┤     ├──────────────────────────┤
│ id (PK, UUID)       │◄────┤ calendar_id (FK)         │
│ user_id             │     │ id (PK, UUID)            │
│ name                │     │ user_id                  │
└─────────────────────┘     │ subject, location        │
                            │ description              │
                            │ start_time, end_time     │
                            │ is_all_day, status       │
                            │ category, event_color    │
                            │ is_recurring             │
                            │ reminder_minutes         │
                            └──────────┬───────────────┘
                                       │
                    ┌──────────────────┬┴───────────────────┐
                    ▼                  ▼                    ▼
         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
         │ outlook_event_  │ │ outlook_event_  │ │ outlook_event_  │
         │  attendees      │ │  attachments    │ │  images         │
         ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
         │ event_id (FK)   │ │ event_id (FK)   │ │ event_id (FK)   │
         │ email           │ │ fileName, url   │ │ fileName, url   │
         │ rsvp_status     │ │ fileSize, type  │ │ thumbnailUrl    │
         └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 10. Complete API Endpoint Reference

### 10.1 InspireCodex API (Port 4001)

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | GET | `/health` | No | Health check |
| 2 | POST | `/api/auth/oauth-register` | No | OAuth login/register |
| 3 | GET | `/api/auth/me` | X-User-Id | Get current user |
| 4 | GET | `/api/users/:id` | No | Get user by ID |
| 5 | GET | `/api/users/email/:email` | No | Get user by email |
| 6 | POST | `/api/users` | No | Create user |
| 7 | GET | `/api/users/:id/roles` | No | Get user roles |
| 8 | GET | `/api/users/:id/permissions` | No | Get user permissions |
| 9 | GET | `/api/users/:id/permissions/:perm` | No | Check permission |
| 10 | GET | `/api/roles` | No | List roles |
| 11 | POST | `/api/users/:id/roles/:roleId` | No | Assign role |
| 12 | GET | `/api/personas` | No | List personas |
| 13 | GET | `/api/personas/:id` | No | Get persona |
| 14 | GET | `/api/personas/slug/:slug` | No | Get persona by slug |
| 15 | POST | `/api/personas` | No | Create persona |
| 16 | GET | `/api/persona-categories` | No | List categories |
| 17 | GET | `/api/feature-flags` | No | List flags |
| 18 | GET | `/api/feature-flags/:name` | No | Get flag |
| 19 | GET | `/api/feature-flags/:name/enabled` | No | Check flag enabled |
| 20 | GET | `/api/settings` | No | Public settings |
| 21 | GET | `/api/settings/:key` | No | Single setting |
| 22 | GET | `/api/bible/books` | No | List Bible books |
| 23 | GET | `/api/bible/books/:code` | No | Get book by code |
| 24 | GET | `/api/audit-logs` | No | Query audit logs |
| 25 | GET | `/api/v1/contacts` | X-User-Id | List contacts |
| 26 | GET | `/api/v1/contacts/search` | X-User-Id | Search contacts |
| 27 | GET | `/api/v1/contacts/:id` | X-User-Id | Get contact |
| 28 | POST | `/api/v1/contacts` | X-User-Id | Create contact |
| 29 | PUT | `/api/v1/contacts/:id` | X-User-Id | Update contact |
| 30 | DELETE | `/api/v1/contacts/:id` | X-User-Id | Hard delete contact |
| 31 | POST | `/api/v1/contacts/check-duplicates` | X-User-Id | Check duplicates |
| 32 | PATCH | `/api/v1/contacts/:id/favorite` | X-User-Id | Toggle favorite |
| 33 | PATCH | `/api/v1/contacts/:id/soft-delete` | X-User-Id | Soft delete |
| 34 | PATCH | `/api/v1/contacts/:id/restore` | X-User-Id | Restore |
| 35 | POST | `/api/v1/contacts/batch/soft-delete` | X-User-Id | Batch soft delete |
| 36 | POST | `/api/v1/contacts/batch/restore` | X-User-Id | Batch restore |
| 37 | POST | `/api/v1/contacts/batch/category` | X-User-Id | Batch category |
| 38 | POST | `/api/v1/contacts/batch/delete` | X-User-Id | Batch hard delete |
| 39 | POST | `/api/v1/contacts/:id/photo` | X-User-Id | Upload photo |
| 40 | POST | `/api/v1/contacts/import/vcard` | X-User-Id | Import vCard |
| 41 | POST | `/api/v1/contacts/import/csv` | X-User-Id | Import CSV |
| 42 | GET | `/api/v1/contacts/export/vcard` | X-User-Id | Export vCard |
| 43 | GET | `/api/v1/contacts/export/csv` | X-User-Id | Export CSV |
| 44 | GET | `/api/v1/contact-groups` | X-User-Id | List groups |
| 45 | GET | `/api/v1/contact-groups/:id` | X-User-Id | Get group + members |
| 46 | POST | `/api/v1/contact-groups` | X-User-Id | Create group |
| 47 | PUT | `/api/v1/contact-groups/:id` | X-User-Id | Update group |
| 48 | DELETE | `/api/v1/contact-groups/:id` | X-User-Id | Delete group |
| 49 | POST | `/api/v1/contact-groups/:id/members` | X-User-Id | Add members |
| 50 | DELETE | `/api/v1/contact-groups/:id/members/:cid` | X-User-Id | Remove member |
| 51 | GET | `/api/user-preferences/:uid/blocked-senders` | No | List blocked |
| 52 | POST | `/api/user-preferences/:uid/blocked-senders` | No | Block sender |
| 53 | DELETE | `/api/user-preferences/:uid/blocked-senders/:email` | No | Unblock |
| 54 | GET | `/api/user-preferences/:uid/ignored-conversations` | No | List ignored |
| 55 | POST | `/api/user-preferences/:uid/ignored-conversations` | No | Ignore |
| 56 | DELETE | `/api/user-preferences/:uid/ignored-conversations/:id` | No | Unignore |

### 10.2 InspireContinuum API (Port 4003)

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | GET | `/health` | No | Health check |
| 2 | POST | `/api/v1/outlook/accounts/detect` | No | Detect email provider |
| 3 | POST | `/api/v1/outlook/accounts/connect` | No | Connect IMAP account |
| 4 | POST | `/api/v1/outlook/accounts/:id/sync` | No | Sync messages |
| 5 | GET | `/api/v1/outlook/accounts` | userId | List accounts |
| 6 | DELETE | `/api/v1/outlook/accounts/:id` | No | Disconnect account |
| 7 | GET | `/api/v1/outlook/folders` | userId | List folders |
| 8 | POST | `/api/v1/outlook/folders` | No | Create folder |
| 9 | PATCH | `/api/v1/outlook/folders/:id` | No | Rename folder |
| 10 | DELETE | `/api/v1/outlook/folders/:id` | No | Delete folder |
| 11 | GET | `/api/v1/outlook/folders/:fid/messages` | No | List messages |
| 12 | GET | `/api/v1/outlook/messages/search` | userId | Search messages |
| 13 | GET | `/api/v1/outlook/messages/:id` | No | Get message (lazy body) |
| 14 | PATCH | `/api/v1/outlook/messages/:id` | No | Update flags/move |
| 15 | DELETE | `/api/v1/outlook/messages/:id` | No | Delete message |
| 16 | POST | `/api/v1/outlook/messages/send` | No | Send via SMTP |
| 17 | POST | `/api/v1/outlook/messages/draft` | No | Save/update draft |
| 18 | GET | `/api/v1/outlook/events` | userId | Get events by range |
| 19 | GET | `/api/v1/outlook/events/:id` | No | Get event |
| 20 | POST | `/api/v1/outlook/events` | No | Create event |
| 21 | PUT | `/api/v1/outlook/events/:id` | No | Update event |
| 22 | DELETE | `/api/v1/outlook/events/:id` | No | Delete event |
| 23 | GET | `/api/users/:uid/settings` | No | Get settings |
| 24 | PUT | `/api/users/:uid/settings` | No | Update settings |
| 25 | GET | `/api/users/:uid/sessions` | No | List sessions |
| 26 | POST | `/api/users/:uid/sessions` | No | Create session |
| 27 | POST | `/api/sessions/:sid/activity` | No | Update activity |
| 28 | DELETE | `/api/sessions/:sid` | No | End session |
| 29 | DELETE | `/api/users/:uid/sessions` | No | End all sessions |
| 30 | GET | `/api/subscription-plans` | No | List plans |
| 31 | GET | `/api/subscription-plans/:slug` | No | Get plan |
| 32 | GET | `/api/users/:uid/subscription` | No | Get subscription |
| 33 | POST | `/api/users/:uid/subscription` | No | Create subscription |
| 34 | POST | `/api/subscriptions/:sid/cancel` | No | Cancel |
| 35 | GET | `/api/users/:uid/payment-methods` | No | Payment methods |
| 36 | GET | `/api/users/:uid/invoices` | No | Invoices |
| 37 | GET | `/api/communities` | No | List communities |
| 38 | GET | `/api/communities/:id` | No | Get community |
| 39 | GET | `/api/communities/slug/:slug` | No | Get by slug |
| 40 | POST | `/api/communities` | No | Create community |
| 41 | GET | `/api/communities/:id/members` | No | List members |
| 42 | POST | `/api/communities/:id/join` | No | Join |
| 43 | POST | `/api/communities/:id/leave` | No | Leave |
| 44 | GET | `/api/communities/:cid/boards` | No | List boards |
| 45 | GET | `/api/boards/:bid/conversations` | No | List conversations |
| 46 | GET | `/api/board-conversations/:id/messages` | No | Get messages |
| 47 | GET | `/api/users/:uid/favorites` | No | Get favorites |
| 48 | POST | `/api/users/:uid/favorites` | No | Add favorite |
| 49 | DELETE | `/api/users/:uid/favorites/:type/:id` | No | Remove favorite |
| 50 | GET | `/api/domains/tlds` | No | List TLDs |
| 51 | GET | `/api/users/:uid/domains` | No | List domains |
| 52 | GET | `/api/domains/check` | No | Check availability |
| 53 | POST | `/api/domains` | No | Register domain |
| 54 | POST | `/api/activity` | No | Log activity |
| 55 | GET | `/api/users/:uid/activity` | No | Get activity |
| 56 | GET | `/api/admin/safety-flags` | No | Safety flags |
| 57 | GET | `/api/admin/alerts` | No | Admin alerts |

---

## 11. Known Limitations & Future Work

### 11.1 Current Limitations

| Area | Limitation |
|------|-----------|
| **Mail** | No drag-and-drop between folders |
| **Mail** | No bulk message operations (select multiple) |
| **Mail** | No conversation threading view |
| **Mail** | No inline image/attachment preview |
| **Calendar** | Week/WorkWeek/Day views are placeholders |
| **Calendar** | No event creation/editing from UI (API exists) |
| **Calendar** | Events array always empty (no API loading wired) |
| **People** | No contact CRUD from UI (API exists) |
| **People** | No group management from UI (API exists) |
| **People** | Contacts array always empty (no API loading wired) |
| **People** | Search input exists but not connected to handler |
| **Auth** | Trust-based X-User-Id header (no server-side token verification) |
| **Security** | IMAP passwords stored as base64 (not AES-256) |
| **Security** | HTML rendered via dangerouslySetInnerHTML without sanitization |
| **Routing** | No URL-based routing (react-router-dom present but unused) |
| **Offline** | No offline mode or data caching |
| **Testing** | No unit/integration tests implemented |

### 11.2 Recommended Improvements

1. **Wire Calendar & People pages** to their respective API services
2. **Implement URL routing** with react-router-dom for deep linking
3. **Add DOMPurify** for HTML email sanitization
4. **Upgrade IMAP password encryption** from base64 to AES-256
5. **Implement proper JWT validation** on API endpoints
6. **Add React.memo()** for performance optimization on list components
7. **Implement offline mode** with IndexedDB caching
8. **Add drag-and-drop** for folder message management
9. **Build conversation threading** for email grouping
10. **Write comprehensive tests** for all services and components

---

## Environment Configuration Reference

### Frontend (.env)
```
REACT_APP_CONTINUUM_API_URL=http://localhost:4003/api/v1
REACT_APP_CODEX_API_URL=http://localhost:4001/api/v1
```

### Backend (root .env)
```
# Server Ports
CODEX_API_PORT=4001
INSPIRE_API_PORT=4002
CONTINUUM_API_PORT=4003

# Codex Database
DB_CODEX_HOST=localhost
DB_CODEX_PORT=5432
DB_CODEX_NAME=jubilee_codex
DB_CODEX_USER=jubilee
DB_CODEX_PASSWORD=Pass@123
DB_CODEX_POOL_SIZE=10

# Continuum Database
DB_CONTINUUM_HOST=localhost
DB_CONTINUUM_PORT=5434
DB_CONTINUUM_NAME=jubilee_continuum
DB_CONTINUUM_USER=jubilee
DB_CONTINUUM_PASSWORD=Pass@123
DB_CONTINUUM_POOL_SIZE=10

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

**Document End**

*Generated by Jubilee AI Development Assistant*
*[NAMESPACE-BOOTSTRAP: VERIFIED]*
