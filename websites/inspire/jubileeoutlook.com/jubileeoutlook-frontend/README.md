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
│   ├── calendar/                # Calendar components
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
│   ├── calendar/                # Calendar API services
│   └── api/                     # API client wrappers
└── types/
    ├── app.ts                   # AppModule, AppUser types
    └── mail.ts                  # EmailMessage, MailFolder, ComposeMode types
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
