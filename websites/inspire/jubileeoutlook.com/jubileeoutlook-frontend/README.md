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
- **localStorage** — Client-side storage for signatures, snooze, rules, templates, preferences
- **contentEditable** — Rich text editing for compose, signatures, templates
- **60s auto-sync** — Polling interval for new messages with notification detection

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
│   │   ├── FolderList/          # IMAP folder tree
│   │   ├── MessageList/         # Message list with thread grouping
│   │   ├── ReadingPane/         # Email viewer with attachment preview
│   │   ├── AttachmentPreview/   # Inline image/PDF preview modal
│   │   └── SnoozePicker/        # Snooze time selection dialog
│   ├── calendar/
│   │   ├── CalendarGrid/        # Time grid views (Day/Week/WorkWeek/Month)
│   │   ├── EventDialog/         # Event create/edit dialog (WPF parity)
│   │   ├── MyCalendars/         # Sidebar with calendar visibility toggles
│   │   └── ReminderPopup/       # Reminder notification with snooze/dismiss
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
│   │   └── reminderService.ts   # 30s reminder check with snooze/dismiss
│   └── api/                     # API client wrappers
├── utils/
│   └── calendarUtils.ts         # Recurring event expansion (365-instance limit)
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
- Column headers with today highlighted in gold
- All-day events row above time grid
- Current time indicator (red dot + line) updating every 60 seconds
- Click empty time slot to create event at that hour
- EventDialog with WPF desktop parity (two-panel 1100x750 layout)
  - ShowAs status, Reminder, Category, Private toggle
  - Date/time pickers with 48 half-hour slots
  - Location with in-person toggle
  - Full recurrence (Daily/Weekly/Monthly/Yearly with interval, day-of-week, end conditions)
  - Calendar day preview panel with event position block
- Recurring event expansion (Daily/Weekly/Monthly/Yearly) with 365-instance safety limit
- Reminder notifications with 30-second check interval, snooze, and dismiss
- My Calendars sidebar with visibility toggles
- 5-minute event cache per date range with auto-invalidation on mutations
- DTO mapper handles both camelCase and snake_case API responses
- Private events display "Private" instead of actual title

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
