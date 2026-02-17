# JubileeOutlook Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2026-02-17

### Added (Frontend — jubileeoutlook-frontend)
- **Calendar Visibility Filter**: Sidebar calendar toggles now filter events in the grid; visibility state persists to localStorage across sessions
- **Persistent Reminder Dismissals**: Dismissed reminders saved to localStorage with 7-day auto-expiry, surviving page refresh
- **Search/Filter Bar**: Debounced search (300ms) across title, description, location, and attendees with category dropdown filter; Ctrl+F keyboard shortcut to focus
- **Event Overlap Detection**: Overlapping events render side-by-side in time grid views using cluster-based column assignment algorithm
- **Hybrid Time Picker**: Dropdown + freeform text input accepting "8", "8:30 AM", "20:15", "2pm" formats with validation
- **Drag & Drop Events**: Native HTML5 drag to move events between time slots with 15-minute snap; preserves event duration
- **Event Resize**: Bottom-edge drag handle to adjust event duration (15-minute minimum) using mousedown/mousemove/mouseup pattern
- **File/Image Attachments**: Upload via Continuum API (`/outlook/files/upload`), file type icons, size formatting, inline preview, remove with API delete
- **Timezone Support**: Selector with 11 common IANA timezones, defaults to browser timezone, stored with event
- **Keyboard Shortcuts**: Ctrl+N (new event), T (today), Left/Right (navigate), 1-4 (view modes), Ctrl+F (search), Escape (close dialog)
- **iCal Export**: RFC 5545 compliant .ics export with VEVENT, RRULE, VALARM, line folding; plus Print/PDF option
- **Event Templates**: Save/apply event templates via localStorage; TemplateManager dialog with apply/delete; "Save as Template" button in EventDialog
- **Calendar Sharing**: Share dialog with email input, permission levels (view/edit), share list with remove; graceful API failure handling
- **CalendarRibbon Buttons**: Templates, Export, and Share buttons added to ribbon toolbar

### Added (Continuum API)
- **File Upload Endpoints**: `POST /api/v1/outlook/files/upload` (multipart, 25MB max), `GET /api/v1/outlook/files/:filename` (serve with MIME), `DELETE /api/v1/outlook/files/:filename` (delete with path traversal protection)

### Fixed (Frontend)
- **Search Bar Dark Theme**: Replaced light-themed CSS fallbacks (#fff, #f5f5f5) with proper dark theme design tokens (--bg-primary, --bg-tertiary, --border-primary, --text-primary)
- **Lint Warnings**: Removed unused variables (TIME_LABELS_WIDTH, isTodayVisible, todayIndex) and fixed React hooks exhaustive-deps warning in SharingDialog

### Technical Details
- 15 new files created, 10 existing files modified, ~2,500 lines added
- No new npm packages — all features built with React 19, native HTML5 APIs, and existing dependencies
- Native HTML5 Drag API for event movement (consistent with mail MessageList pattern)
- Filter pipeline via `useMemo` chain: calendar visibility → search query/category
- File upload uses Hono's native `formData()` API, files stored with UUID names
- All localStorage keys follow `jubilee_{feature}_{item}` convention

## [1.5.0] - 2026-02-16

### Added (Frontend — jubileeoutlook-frontend)
- **Calendar API Integration**: CalendarPage fetches events from Continuum API (`/api/v1/outlook/events`) with date range filtering and full CRUD operations
- **Day/Week/WorkWeek Time Grid Views**: 24-hour scrollable time grid with 60px/hour rows, event blocks positioned by start time and sized by duration, column headers with today highlighted in gold, all-day events row, current time indicator (red dot + line) updating every 60 seconds, click-to-create on empty time slots, auto-scroll to current hour
- **EventDialog with WPF Parity**: Complete rewrite as two-panel 1100x750 layout matching WPF NewEventWindow — left panel with toolbar (ShowAs, Reminder, Category, Private toggle), title, attendees, date/time pickers with 48 half-hour slots, location with in-person toggle, full recurrence section (Daily/Weekly/Monthly/Yearly with interval, day-of-week picker, end conditions), description area; right panel with calendar day preview and event position block
- **Recurring Event Expansion**: Client-side expansion of recurring events (Daily/Weekly/Monthly/Yearly) within visible date range, 365-instance safety limit matching WPF, weekly recurrence with day-of-week selection, end conditions (never, by date, after N occurrences)
- **Reminder Service**: 30-second check interval matching WPF `CalendarReminderService`, ReminderPopup with event title/time/time-until-event display, snooze options (5/10/15/30 min, 1hr, 2hr), dismiss functionality
- **Event Cache**: 5-minute cache per date-range key preventing redundant API calls, automatic invalidation on any write operation (create, update, delete)
- **My Calendars Sidebar**: Calendar list with visibility toggles matching WPF desktop sidebar
- **CalendarRibbon**: View mode button highlighting with handler prop passthrough

### Fixed (Frontend — jubileeoutlook-frontend)
- **DTO Mapper camelCase Handling**: Continuum API returns camelCase field names (`startTime`, `endTime`, `isAllDay`) but mapper expected snake_case; updated `mapEventDto` with fallback accessors for both conventions
- **Delete Event Race Condition**: EventDialog called `onClose()` synchronously after starting async `onDelete()`, causing dialog to close before API call completed; now awaits `onDelete` and displays errors in dialog validation area

### Technical Details (Frontend)
- All calendar CRUD through `calendarService.ts` → `continuumClient` → InspireContinuum API
- Recurring events stored as single records with recurrence metadata; expanded client-side via `calendarUtils.ts`
- Reminder service runs as singleton checking every 30 seconds against loaded event list
- Event cache uses `Map<string, { events, timestamp }>` keyed by ISO date range strings
- `CalendarEventDto` interface supports both camelCase (API reads) and snake_case (API writes)
- New files: `calendarUtils.ts`, `reminderService.ts`, `MyCalendars/` component, updated `CalendarGrid/`, `EventDialog/`, `CalendarPage`, `CalendarRibbon`, `calendar/index.ts` types

## [1.4.0] - 2026-02-12

### Added
- **Continuum API Calendar Endpoints**: Full CRUD REST API for calendar events on port 4003
  - `GET /api/v1/outlook/events` - List events with date range and calendar filtering
  - `GET /api/v1/outlook/events/:id` - Get single event with attendees, attachments, images
  - `POST /api/v1/outlook/events` - Create event with auto-default-calendar creation
  - `PUT /api/v1/outlook/events/:id` - Update event with COALESCE partial updates
  - `DELETE /api/v1/outlook/events/:id` - Delete event with cascade cleanup
  - Transactional writes for event + attendees + attachments + images
  - Supports both camelCase and snake_case request body properties

### Fixed
- **Calendar Event Display Bug**: Events were not appearing on the calendar after creation
  - Root cause: `Events.Add()` + `OnPropertyChanged` did not trigger WPF MultiBinding converter re-evaluation
  - Fix: Replaced manual collection manipulation with `UpdateVisibleEventsFromCache()` which creates a new `ObservableCollection` instance, forcing WPF to re-evaluate all MultiBinding converters
  - Applied to: NewEventAsync (create), EditEventAsync (update/delete), and UpdateVisibleEventsFromCache

- **Timezone Conversion Bug**: Event times shifted by -5:30 hours (IST offset) on reload
  - Root cause: PostgreSQL `timestamptz` → node-postgres JS Date (UTC) → API returns UTC → WPF displayed UTC without converting to local time
  - Fix in `MapToCalendarEvent`: Convert UTC times to local on deserialization (`dto.StartTime.Kind == DateTimeKind.Utc ? dto.StartTime.ToLocalTime() : dto.StartTime`)
  - Fix in `MapToDto`: Explicitly convert local times to UTC before sending to API (`DateTime.SpecifyKind(time, DateTimeKind.Local).ToUniversalTime()`)
  - Ensures correct round-trip: user picks 11:00 AM → stored as UTC → displayed as 11:00 AM

### Technical Details
- Continuum API routes use `getContinuumPool()` for direct PostgreSQL access to `jubilee_continuum` database
- Calendar events stored in `outlook_calendar_events` table with `timestamptz` columns
- WPF MultiBinding converters (`EventsByDateConverter`, `EventTopPositionConverter`) already had UTC-to-local conversion for display positioning; the core fix was in the data layer (`MapToCalendarEvent`)
- Event creation auto-creates a default calendar if none exists for the user

## [1.3.0] - 2026-02-11

### Added
- **Recurring Event UI**: Full recurrence pattern configuration in NewEventWindow
  - "Make recurring" toggle with collapsible options panel
  - Recurrence types: Daily, Weekly, Monthly, Yearly with interval selection
  - Day-of-week checkboxes for weekly recurrence
  - End conditions: Never, On date (DatePicker), After N occurrences
  - Client-side event expansion in CalendarViewModel with 365-instance safety limit

- **Rate Limiting for Contacts API**: Intelligent rate limit handling
  - `RateLimitTracker` singleton with thread-safe state management
  - Parses `Retry-After` header from 429 responses
  - Auto-clears rate limit state when reset time passes
  - Pre-request throttle checks in ApiContactService

- **Sync Status UI Indicator**: Real-time sync status in People module
  - Status badge with color-coded indicator (green=synced, blue=syncing, orange=rate-limited, red=error, gray=offline)
  - Pending operations count badge
  - Manual sync button
  - Subscribes to SyncManager, NetworkStatusService, and RateLimitTracker events

### Changed
- **Debug Artifact Cleanup**: Removed 27 hardcoded `C:\temp\` file writes
  - CalendarViewModel.cs: Removed 5 `File.AppendAllText` calls
  - ApiCalendarService.cs: Removed 17 `File.AppendAllText` calls
  - ApiMailService.cs: Removed 5 `File.WriteAllText/AppendAllText` calls
  - Kept legitimate `Debug.WriteLine` calls (compile out in Release builds)

### Verified
- **EmailSendingService**: Confirmed fully implemented and production-ready (984 lines)
  - CC/BCC, attachments, embedded images, SMTP with OAuth2 + App Password auth
  - Automatic token refresh, drafts save/delete via IMAP

## [1.2.0] - 2026-01-28

### Added
- **Calendar Reminder Notifications**: Full reminder system for calendar events
  - New `CalendarReminderService` that monitors upcoming events every 30 seconds
  - `ReminderPopup` window with dark theme styling
  - Shows event subject, time, location, and time until event starts
  - Snooze options: 5, 10, 15, 30 minutes, 1 hour, 2 hours
  - Dismiss functionality to permanently silence reminders
  - Notification sound plays when reminder appears
  - Popup appears in bottom-right corner of screen

- **Hamburger Menu Toggle**: Toggle folder pane visibility
  - New `ToggleFolderPaneCommand` in ApplicationViewModel
  - Click handler in AppRailControl for folder pane toggle
  - Animated collapse/expand of folder pane

### Changed
- **AppRail Cleanup**: Removed unused icons from left sidebar
  - Removed Tasks icon from AppRail
  - Removed "More Apps" (three dots) icon from AppRail
  - Hamburger menu now toggles folder pane instead of opening settings

- **Ribbon Bar Cleanup**: Streamlined ribbon interface
  - Removed "New Meeting" option from New Mail dropdown
  - Settings button at bottom of AppRail now available for future settings dialog

### Fixed
- **Snooze Dropdown Styling**: Fixed ComboBox dropdown to use dark theme
  - Dark background (#2A2A2A) for dropdown items
  - White text for visibility
  - Gold highlight on hover/selection

### Technical Details
- CalendarReminderService uses DispatcherTimer for UI-thread safe reminders
- Reminder triggers based on event's ReminderTime enum (None, 5min, 15min, etc.)
- Snooze creates temporary timer for delayed re-notification
- ReminderPopup is a borderless, topmost window with transparency

## [1.1.0] - 2026-01-19

### Added
- **Rich Text Description Support**: Event descriptions now support rich text formatting (Bold, Italic, Underline, Lists, Tables, etc.)
  - Descriptions are stored as XAML FlowDocument format for full formatting preservation
  - Backwards compatible with plain text descriptions
  - RichTextBox editor with formatting toolbar in NewEventWindow

- **New Migration Script** (`0004_outlook_richtext_images.sql`):
  - Added `description_format` column to `outlook_calendar_events` table
  - Added `is_in_person` column for event type (in-person vs virtual)
  - Created `outlook_event_images` table for event image attachments
  - Added `url` column to `outlook_event_attachments` for cloud storage
  - Created `outlook_event_details` view for comprehensive event data

- **Event Delete Confirmation Dialog**: Custom themed confirmation dialog for event deletion
  - Dark theme styling consistent with the application
  - Clear warning message with event title display

- **Sample Calendar Events**: Seed script now includes 5 sample events with rich text descriptions

### Changed
- **Description Editor**: Upgraded from plain TextBox to RichTextBox with formatting menu
- **Local Cache Schema**: Updated `cached_events` table with `description_format`, `is_in_person`, `images`, and `attachments` columns
- **Seed Script**: Enhanced with sample calendar events including XAML-formatted descriptions

### Technical Details
- XAML serialization/deserialization using `XamlWriter.Save()` and `XamlReader.Load()`
- Description format detection: checks for `<FlowDocument` or `<Section` prefix
- Supported formats: `plain`, `xaml`, `html`

## [1.0.0] - 2026-01-17

### Added
- Initial JubileeOutlook calendar integration with InspireContinuum API
- Complete ApiMailService integration with UI enhancements
- Material Icons unicode conversion for folder icons
- Folder loading from InspireContinuum API

### Fixed
- API icon name conversion to Material Icons unicode
- Folder loading issues with InspireContinuum API
