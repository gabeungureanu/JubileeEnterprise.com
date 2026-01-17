# JubileeOutlook Database Integration

**Last Updated:** January 15, 2026
**Version:** 1.5.0

## Overview

JubileeOutlook integrates with the Jubilee Enterprise database architecture through the InspireContinuum API. This document describes the database schema, API endpoints, and integration patterns for calendar events, email messages, and contacts.

## Current Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| ApiCalendarService | ✅ Complete | Full CRUD with caching |
| ApiMailService | 🔄 In Progress | HTTP client ready |
| ImageService | ✅ Complete | Upload/download with retry |
| Date Range Caching | ✅ Complete | Month-based, 5-min expiry |

## Database Architecture

JubileeOutlook data is stored in the **Continuum** database (PostgreSQL), which is designed for user-specific activity data. Access is through the **InspireContinuum API** at port 3101.

### Why Continuum?

The Jubilee Enterprise uses a three-database architecture:
- **Codex**: User identity, authentication, personas (canonical/stable data)
- **Inspire**: Bible content, conversations, AI interactions (content data)
- **Continuum**: User activity, settings, sessions, calendars, emails (user-specific data)

Calendar events, emails, and contacts are user-specific activity data, making Continuum the appropriate home.

## Database Tables

### Calendar Tables

#### `outlook_calendars`
Stores user calendars (e.g., "Work", "Personal", "Holidays").

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user ID (references Codex users) |
| name | VARCHAR(200) | Calendar name |
| description | TEXT | Optional description |
| color | VARCHAR(7) | Hex color (e.g., "#0078D4") |
| is_default | BOOLEAN | Whether this is the default calendar |
| is_visible | BOOLEAN | UI visibility toggle |
| time_zone | VARCHAR(100) | IANA timezone |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### `outlook_calendar_events`
Stores calendar events.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| calendar_id | UUID | Parent calendar (FK) |
| user_id | UUID | Owner user ID |
| subject | VARCHAR(500) | Event title |
| location | VARCHAR(500) | Event location |
| description | TEXT | Event description |
| start_time | TIMESTAMPTZ | Start date/time |
| end_time | TIMESTAMPTZ | End date/time |
| is_all_day | BOOLEAN | All-day event flag |
| status | VARCHAR(20) | free, busy, tentative, outofoffice |
| category | VARCHAR(50) | Event category |
| event_color | VARCHAR(7) | Hex color |
| is_recurring | BOOLEAN | Recurring event flag |
| reminder_minutes | INTEGER | Reminder before event |

#### `outlook_event_attendees`
Stores event attendees.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| event_id | UUID | Parent event (FK) |
| attendee_email | VARCHAR(255) | Attendee email address |
| attendee_name | VARCHAR(200) | Display name |
| response_status | VARCHAR(20) | pending, accepted, declined, tentative |
| is_required | BOOLEAN | Required vs optional attendee |

#### `outlook_event_attachments`
Stores event file attachments.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| event_id | UUID | Parent event (FK) |
| file_name | VARCHAR(500) | Original file name |
| file_path | VARCHAR(1000) | Storage path |
| file_size | BIGINT | File size in bytes |
| mime_type | VARCHAR(100) | MIME type |
| storage_key | VARCHAR(500) | Cloud storage key |

### Email Tables

#### `outlook_email_folders`
Stores email folder structure.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user ID |
| name | VARCHAR(200) | Folder name |
| parent_folder_id | UUID | Parent folder (for nesting) |
| folder_type | VARCHAR(30) | inbox, sent, drafts, trash, custom |
| unread_count | INTEGER | Unread message count |
| total_count | INTEGER | Total message count |
| is_system | BOOLEAN | System folder (cannot delete) |

#### `outlook_email_messages`
Stores email messages.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| folder_id | UUID | Parent folder (FK) |
| user_id | UUID | Owner user ID |
| subject | VARCHAR(1000) | Email subject |
| body_text | TEXT | Plain text body |
| body_html | TEXT | HTML body |
| sender_email | VARCHAR(255) | Sender email |
| sender_name | VARCHAR(200) | Sender display name |
| is_read | BOOLEAN | Read status |
| is_flagged | BOOLEAN | Flagged status |
| is_draft | BOOLEAN | Draft status |
| importance | VARCHAR(20) | low, normal, high |
| has_attachments | BOOLEAN | Attachment indicator |
| received_at | TIMESTAMPTZ | Received timestamp |
| search_vector | TSVECTOR | Full-text search index |

### Contact Tables

#### `outlook_contacts`
Stores contact information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user ID |
| display_name | VARCHAR(300) | Full display name |
| first_name | VARCHAR(100) | First name |
| last_name | VARCHAR(100) | Last name |
| company_name | VARCHAR(200) | Company |
| job_title | VARCHAR(200) | Job title |
| is_favorite | BOOLEAN | Favorite contact |

Related tables: `outlook_contact_emails`, `outlook_contact_phones`, `outlook_contact_addresses`, `outlook_contact_groups`

## API Endpoints

### Base URL
- Development: `http://localhost:3101/api/v1`
- Production: `https://inspirecontinuum.com/api/v1`

### Calendar Endpoints

```
GET    /outlook/calendars          - List user calendars
POST   /outlook/calendars          - Create calendar
GET    /outlook/events             - List events (with date range filter)
GET    /outlook/events/:id         - Get single event
POST   /outlook/events             - Create event
PUT    /outlook/events/:id         - Update event
DELETE /outlook/events/:id         - Delete event
```

### Email Endpoints

```
GET    /outlook/folders            - List email folders
POST   /outlook/folders            - Create folder
GET    /outlook/messages           - List messages (with folder filter)
GET    /outlook/messages/:id       - Get single message
POST   /outlook/messages           - Create/send message
PATCH  /outlook/messages/:id       - Update message (read, flag, move)
DELETE /outlook/messages/:id       - Delete message
```

### Contact Endpoints

```
GET    /outlook/contacts           - List contacts (with search)
POST   /outlook/contacts           - Create contact
DELETE /outlook/contacts/:id       - Delete contact
```

## Service Configuration

JubileeOutlook uses a service configuration pattern to switch between mock and API services:

```csharp
// Initialize with mock services (default for development/demo)
ServiceConfiguration.Initialize(useApi: false);

// Initialize with API services (production)
ServiceConfiguration.Initialize(
    useApi: true,
    apiUrl: "https://inspirecontinuum.com/api/v1",
    userId: "user-uuid-here"
);
```

Environment variables:
- `CONTINUUM_API_URL` - API base URL
- `JUBILEE_USER_ID` - Current user ID

## Migration

To apply the schema migration:

```bash
cd infrastructure/migrations
node runner/run.js continuum 0003_jubilee_outlook_schema.sql
```

Or manually:
```sql
psql -h localhost -p 5434 -U guardian -d continuum -f continuum/0003_jubilee_outlook_schema.sql
```

## Data Flow

1. **User creates event in UI** → `NewEventViewModel.SaveEvent()`
2. **ViewModel calls service** → `ICalendarService.CreateEventAsync()`
3. **ApiCalendarService sends HTTP POST** → `/api/v1/outlook/events`
4. **InspireContinuum API inserts** → `outlook_calendar_events` + related tables
5. **Response returns created event** → ViewModel updates UI

## Security Considerations

- All API requests require user authentication via `X-User-Id` header
- User ID is validated against Codex database before any Continuum operations
- File attachments are stored with checksums for integrity verification
- Email body content uses parameterized queries to prevent SQL injection
- CORS is configured to allow only trusted origins

## Implemented Features (v1.5.0)

### Date Range Caching
The CalendarViewModel implements intelligent date range caching:
- **Month-based cache keys**: `YYYY-MM` format
- **5-minute expiration**: `DateRangeCacheEntry.ExpiresAt`
- **Buffer days**: Loads 7-14 extra days for smooth navigation
- **Thread-safe**: Uses `lock(_cacheLock)` for concurrent access

```csharp
// Cache structure
private readonly Dictionary<string, DateRangeCacheEntry> _dateRangeCache;

// Loading visible range
await LoadEventsForVisibleRangeAsync();
```

### Image Handling
The ImageService provides robust image upload/download:
- **Multipart upload**: For new event images
- **Async download**: With loading indicators
- **Retry logic**: Exponential backoff on failures

### Error Handling
All API services implement:
- **Global error handling**: Try/catch with user-friendly messages
- **Retry policies**: Configurable attempt counts
- **HTTP status handling**: Proper 4xx/5xx response processing

## Future Enhancements

1. **Real-time sync** - WebSocket notifications for calendar changes
2. **Offline mode** - Local SQLite cache with sync on reconnect
3. **External calendar sync** - Integration with Google Calendar, Outlook.com
4. **Email send/receive** - SMTP/IMAP integration for actual email functionality
5. **Recurrence expansion** - Server-side generation of recurring event instances
