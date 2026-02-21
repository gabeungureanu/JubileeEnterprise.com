# JubileeOutlook Frontend

Web-based Outlook-style email client built with React 19 and TypeScript.

## Tech Stack

- **React 19** with TypeScript
- **Create React App** (CRA) build tooling
- **CSS Variables** for theming (Jubilee gold: `#ffbd59`)
- **Material Symbols Outlined** for iconography
- **No React Router** — uses `activeModule` state switching

## Architecture

### Module System

The app uses `activeModule` state in `AppContext` with a switch in `AppLayout` to render pages:

```
AppModule = 'mail' | 'calendar' | 'people' | 'settings'
```

### API Integration

- **Codex API** (`InspireCodex.com`, port 4001) — Authentication, contacts, user accounts
- **Continuum API** (`InspireContinuum.com`, port 4003) — Mail, calendar, events

All API access goes through `codexClient` and `continuumClient` wrappers. No direct database connections.

### Key Patterns

- **MailContext** — Shared mail state via React Context (`useMailContext` / `useMailContextSafe`)
- **CalendarPage as orchestrator** — All calendar state lives in CalendarPage (no CalendarContext); events filtered via `useMemo` pipeline; 30-second auto-refresh sync with setTimeout chain pattern
- **localStorage** — Client-side storage for signatures, snooze, rules, templates, calendar filters, reminder dismissals, event templates
- **contentEditable** — Rich text editing for compose, signatures, templates
- **60s auto-sync** — Polling interval for new messages with notification detection
- **Native HTML5 Drag** — Drag & drop for mail and calendar events (no external DnD library)

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # Module switch renderer
│   │   ├── NavBar/              # Left navigation bar
│   │   ├── Ribbon/              # Outlook-style ribbon toolbar
│   │   │   ├── MailRibbon.tsx
│   │   │   ├── CalendarRibbon.tsx
│   │   │   └── PeopleRibbon.tsx
│   │   └── TitleBar/            # App title bar with branding
│   ├── mail/
│   │   ├── ComposeMail/         # Email compose with rich text, autocomplete, templates
│   │   ├── RecipientInput/     # Reusable autocomplete chip input (contacts search, chipDisplay modes)
│   │   ├── FolderList/          # IMAP folder tree
│   │   ├── MessageList/         # Message list with thread grouping
│   │   ├── ReadingPane/         # Email viewer with attachment preview
│   │   ├── AttachmentPreview/   # Inline image/PDF preview modal
│   │   └── SnoozePicker/        # Snooze time selection dialog
│   ├── calendar/
│   │   ├── CalendarGrid/        # Time grid views (Day/Week/WorkWeek/Month) with overlap detection
│   │   ├── EventDialog/         # Event create/edit dialog (WPF parity) with attendee autocomplete, attachments, timezone, templates
│   │   ├── EventResizeHandle/   # Bottom-edge drag handle for event duration resize
│   │   ├── ExportDialog/        # iCal (.ics) export and print dialog
│   │   ├── MyCalendars/         # Sidebar with calendar visibility toggles (localStorage persisted)
│   │   ├── ReminderPopup/       # Reminder notification with snooze/dismiss
│   │   ├── SearchBar/           # Debounced search with category filter (Ctrl+F)
│   │   ├── SharingDialog/       # Calendar sharing with email/permission management
│   │   └── TemplateManager/     # Event template list with apply/delete actions
│   └── people/                  # Contacts components
├── context/
│   ├── AppContext.tsx            # Global app state (activeModule, user)
│   └── MailContext.tsx           # Mail-specific state and actions
├── pages/
│   ├── Mail/MailPage.tsx         # Main mail page with all mail logic
│   ├── Calendar/                # Calendar page
│   ├── People/                  # Contacts page
│   └── Settings/SettingsPage.tsx # Settings with tabs (accounts, signatures, rules, templates, sync, general)
├── services/
│   ├── mail/
│   │   ├── mailService.ts       # Mail API operations
│   │   ├── notificationService.ts # Desktop notification management
│   │   ├── snoozeService.ts     # Email snooze with localStorage
│   │   ├── rulesService.ts      # Email rules/filters CRUD
│   │   └── templateService.ts   # Email template CRUD
│   ├── calendar/
│   │   ├── calendarService.ts   # Calendar CRUD via Continuum API
│   │   ├── reminderService.ts   # 30s reminder check with snooze/dismiss (localStorage persisted)
│   │   ├── fileService.ts       # File upload/delete via Continuum API
│   │   ├── templateService.ts   # Event template CRUD via localStorage
│   │   └── sharingService.ts    # Calendar sharing API integration
│   └── api/                     # API client wrappers
├── hooks/
│   └── useKeyboardShortcuts.ts  # Calendar keyboard shortcuts (Ctrl+N, T, arrows, 1-4, Ctrl+F, Esc)
├── utils/
│   ├── calendarUtils.ts         # Recurring event expansion (365-instance limit)
│   └── icalExport.ts            # RFC 5545 iCal export with RRULE, VALARM
└── types/
    ├── app.ts                   # AppModule, AppUser types
    ├── mail.ts                  # EmailMessage, MailFolder, ComposeMode types
    └── calendar/index.ts        # CalendarEvent, CalendarEventDto, mapEventDto
```

## Features

### Mail
- Inbox with folder navigation (IMAP sync)
- Compose with rich text editor, To/Cc/Bcc with contact autocomplete
- Reply, Reply All, Forward
- Conversation/thread view with expandable grouping
- Inline attachment preview (images, PDFs)
- Email snooze with preset and custom times
- Desktop notifications for new mail
- Delete, archive, flag, mark read/unread
- Move to folder, global search toggle
- Email templates / quick replies in compose

### Calendar
- Full CRUD via Continuum API (`/api/v1/outlook/events`)
- Day, Week, WorkWeek, and Month views with 24-hour scrollable time grid
- Event blocks positioned by start time, sized by duration (60px/hour)
- **Event overlap detection**: Overlapping events render side-by-side using cluster-based column assignment
- Column headers with today highlighted in gold
- All-day events row above time grid
- Current time indicator (red dot + line) updating every 60 seconds
- Click empty time slot to create event at that hour
- **Drag & drop**: Move events between time slots (HTML5 native drag, 15-minute snap)
- **Event resize**: Drag bottom edge to adjust duration (15-minute minimum)
- EventDialog with WPF desktop parity (two-panel 1100x750 layout)
  - **Attendee autocomplete**: Type to search contacts via Codex API; dropdown with name, email, avatar initials; display name chips (email on hover)
  - ShowAs status, Reminder, Category, Private toggle
  - **Hybrid time picker**: Dropdown + freeform text input ("8", "8:30 AM", "20:15", "2pm")
  - Location with in-person toggle
  - Full recurrence (Daily/Weekly/Monthly/Yearly with interval, day-of-week, end conditions)
  - **File/image attachments**: Upload, preview icons, file size, remove
  - **Timezone selector**: 11 common IANA timezones, defaults to browser timezone
  - **Save as Template**: Save current event settings as reusable template
  - Calendar day preview panel with event position block
- Recurring event expansion (Daily/Weekly/Monthly/Yearly) with 365-instance safety limit
- Reminder notifications with 30-second check interval, snooze, and dismiss
  - **Persistent dismissals**: Saved to localStorage with 7-day auto-expiry
- My Calendars sidebar with visibility toggles
  - **Calendar filter**: Toggle visibility actually filters events; persisted to localStorage
- **Search bar**: Debounced text search + category filter across title, description, location, attendees
- **Keyboard shortcuts**: Ctrl+N (new), T (today), Left/Right (navigate), 1-4 (views), Ctrl+F (search), Escape (close)
- **iCal export**: RFC 5545 compliant .ics file with RRULE, VALARM; plus Print/PDF
- **Event templates**: Save/apply templates via localStorage; TemplateManager dialog
- **Calendar sharing**: Share by email with view/edit permissions; graceful API failure
- **Ribbon toolbar**: Templates, Export, Share buttons
- **30-second auto-refresh sync**: setTimeout chain polling with cache-busting, tab visibility refresh
- 30-second event cache per date range with auto-invalidation on mutations
- DTO mapper handles both camelCase and snake_case API responses
- Private events display "Private" instead of actual title

### People
- Full contact CRUD via Codex API
- Contact duplicate validation (Display Name + Phone) with soft-delete restore
- Contact groups with member management
- Batch operations (delete, restore, hard delete, category update)
- Import (vCard, CSV) with duplicate detection / Export (vCard, CSV)
- Contextual PeopleRibbon with delete/restore for Deleted folder

### Branding
- Jubilee AI character favicon and PWA icons (favicon.ico, logo192, logo512, SVG)
- Jubilee logo on sign-in page avatar
- Gold theme color (`#ffbd59`) throughout

### Settings
- Account management (add/remove email accounts)
- Email signature editor with auto-insert
- Email rules/filters (conditions + actions builder)
- Email templates (rich text CRUD)
- Auto-sync interval configuration
- Notification preferences
- Theme selection

## Available Scripts

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.
