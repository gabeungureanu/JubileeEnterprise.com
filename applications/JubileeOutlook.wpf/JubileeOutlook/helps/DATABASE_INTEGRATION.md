# JubileeOutlook Database Integration

**Last Updated:** February 11, 2026
**Version:** 2.0.0

## Overview

JubileeOutlook integrates with the Jubilee Enterprise database architecture through the InspireContinuum API. This document describes the database schema, API endpoints, and integration patterns for calendar events, email messages, and contacts.

## Current Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| ApiCalendarService | ✅ Complete | Full CRUD with caching |
| ApiMailService | 🔄 In Progress | HTTP client ready |
| ApiContactService | ✅ Complete | Full CRUD, groups, import/export, batch ops |
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
Stores contact information. Access through **InspireCodex API** (Codex database, port 4001).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user ID (references Codex users) |
| display_name | VARCHAR(300) | Full display name |
| first_name | VARCHAR(100) | First name |
| last_name | VARCHAR(100) | Last name |
| title | VARCHAR(50) | Name prefix (Mr., Ms., Dr.) |
| middle_name | VARCHAR(100) | Middle name |
| suffix | VARCHAR(50) | Name suffix (Jr., Sr.) |
| nickname | VARCHAR(100) | Nickname |
| email_addresses | JSONB | Array of email addresses |
| phone_numbers | JSONB | Array of phone numbers |
| mobile_phone | VARCHAR(50) | Mobile phone number |
| company | VARCHAR(200) | Company name |
| job_title | VARCHAR(200) | Job title |
| department | VARCHAR(200) | Department |
| office | VARCHAR(200) | Office location |
| address | VARCHAR(500) | Street address |
| city | VARCHAR(100) | City |
| state | VARCHAR(100) | State/Province |
| postal_code | VARCHAR(20) | Postal/ZIP code |
| country | VARCHAR(100) | Country |
| notes | TEXT | Free-form notes |
| photo_url | VARCHAR(1000) | Profile photo URL |
| birthday | DATE | Birthday |
| anniversary | DATE | Anniversary date |
| spouse | VARCHAR(200) | Spouse/partner name |
| website | VARCHAR(500) | Personal/company website |
| is_favorite | BOOLEAN | Favorite contact flag |
| is_deleted | BOOLEAN | Soft-delete flag |
| deleted_at | TIMESTAMPTZ | Soft-delete timestamp |
| category | VARCHAR(100) | Contact category label |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### `contact_groups`
Stores user-created contact lists/groups.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner user ID |
| name | VARCHAR(200) | Group name |
| description | TEXT | Optional description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### `contact_group_members`
Junction table for contact-to-group many-to-many relationship.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| group_id | UUID | Parent group (FK, CASCADE) |
| contact_id | UUID | Member contact (FK, CASCADE) |
| added_at | TIMESTAMPTZ | When contact was added |

Unique constraint on (group_id, contact_id).

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

### Contact Endpoints (via InspireCodex API, port 4001)

```
GET    /api/contacts                          - List all contacts for user
GET    /api/contacts/:id                      - Get single contact
POST   /api/contacts                          - Create contact
PUT    /api/contacts/:id                      - Update contact
DELETE /api/contacts/:id                      - Soft-delete contact
POST   /api/contacts/:id/restore              - Restore soft-deleted contact
DELETE /api/contacts/deleted/permanent         - Permanently delete all soft-deleted
POST   /api/contacts/batch/delete              - Batch soft-delete
POST   /api/contacts/batch/favorites           - Batch set favorites
POST   /api/contacts/batch/category            - Batch set category
POST   /api/contacts/import                    - Import contacts (CSV/vCard)
GET    /api/contacts/export                    - Export contacts (CSV/vCard)
```

### Contact Group Endpoints (via InspireCodex API, port 4001)

```
GET    /api/contact-groups                     - List all groups
POST   /api/contact-groups                     - Create group
PUT    /api/contact-groups/:id                 - Update/rename group
DELETE /api/contact-groups/:id                 - Delete group
POST   /api/contact-groups/:id/contacts        - Add contacts to group
DELETE /api/contact-groups/:id/contacts/:cid   - Remove contact from group
GET    /api/contact-groups/:id/contacts        - Get contacts in group
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

## Seeding Test Data

To populate the database with sample email data for testing:

```bash
cd websites/codex/InspireContinuum.com/scripts
node seed-complete-emails.js
```

This creates:
- **6 Inbox emails** with rich HTML bodies, recipients (To/Cc), and attachments
- **3 Sent emails** with proper formatting
- **2 Draft emails** for testing

The script also updates folder unread/total counts automatically.

## Implemented Features (v1.6.0)

### ApiMailService Integration (NEW)
Full email functionality via InspireContinuum API:
- **Message Loading**: GET `/api/v1/outlook/messages?folderId=...`
- **Folder Loading**: GET `/api/v1/outlook/folders`
- **Mark as Read**: PATCH `/api/v1/outlook/messages/:id`
- **JSON Deserialization**: Explicit `[JsonPropertyName]` attributes for snake_case API

### DTO Mappings
```csharp
// API Response classes with explicit JSON mapping
internal class ApiMessagesResponse
{
    [JsonPropertyName("messages")]
    public List<EmailMessageDto>? Messages { get; set; }
}

public class EmailMessageDto
{
    [JsonPropertyName("sender_name")]
    public string? SenderName { get; set; }

    [JsonPropertyName("body_preview")]
    public string? Preview { get; set; }
    // ... more properties
}
```

### StringToLongConverter
Handles API returning `file_size` as string:
```csharp
[JsonConverter(typeof(StringToLongConverter))]
public long FileSize { get; set; }
```

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

## Implemented Features (v2.0.0)

### ApiContactService Integration (NEW)
Full contacts management via InspireCodex API:
- **Contact CRUD**: GET/POST/PUT/DELETE via `/api/contacts`
- **Contact Groups**: Create, rename, delete lists; add/remove members
- **Batch Operations**: Bulk delete, favorites, category assignment
- **Import/Export**: CSV and vCard format support
- **Soft Delete**: Contacts moved to Deleted folder, permanent purge available
- **Duplicate Detection**: Checks display_name + email on import
- **Ownership Verification**: All operations scoped to authenticated user's contacts

### WPF People Module (NEW)
Complete contacts management UI:
- **PeopleView.xaml**: Full three-panel layout (sidebar, list, detail)
- **PeopleViewModel.cs**: MVVM with CommunityToolkit.Mvvm relay commands
- **PeopleView.xaml.cs**: Event handlers, dialogs, keyboard shortcuts
- **Ribbon toolbar**: 15+ action buttons with bulk operations
- **Contact detail panel**: All fields with interactive links
- **Context menus**: Right-click on contacts and sub-folders
- **Keyboard shortcuts**: Ctrl+N, Ctrl+F, Ctrl+E, Ctrl+I, Delete, F2, Escape

## Future Enhancements

1. **Real-time sync** - WebSocket notifications for calendar/contact changes
2. **Offline mode** - Local SQLite cache with sync on reconnect
3. **External calendar sync** - Integration with Google Calendar, Outlook.com
4. **Email send/receive** - SMTP/IMAP integration for actual email functionality
5. **Recurrence expansion** - Server-side generation of recurring event instances
6. **Contact photo upload** - Profile picture management with ImageService
7. **Contact merge** - Merge duplicate contacts with field-level selection
