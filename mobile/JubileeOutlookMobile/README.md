# Jubilee Outlook Mobile

**Version 1.0.0** | Cross-Platform Email Client for iOS, Android, and Web

The React Native mobile client for the JubileeOutlook ecosystem, built with Expo SDK 54 + React Native 0.81.5 + TypeScript.

## Overview

Jubilee Outlook Mobile is a full-featured email client that mirrors the JubileeOutlook web frontend. It integrates with the Jubilee Solutions backend services (Codex for authentication/contacts, Continuum for mail/calendar) to provide a native mobile email experience with IMAP sync, calendar management, and contact management.

## Features

### Authentication (Phase 1)
- **5-Screen Auth Flow**: Matching the web frontend's 5-panel auth system
  - **Sync Email** (default landing) — Enter email to sync existing accounts
  - **Sync Password** — IMAP app password entry with provider detection
  - **Sign In** — Codex auth with email/password and "Keep me signed in"
  - **Sign Up** — Full registration with name, email, password, newsletter
  - **Forgot Password** — Email-based password reset with auto-redirect
- **Provider Detection**: Auto-detects Microsoft 365, Gmail, Yahoo, iCloud, IMAP/POP
- **Gold Theme**: Matches web's `#FFD700` gold accent throughout auth screens
- **Real-time Validation**: Per-field error clearing as user corrects input
- **Animated Progress**: Indeterminate progress bar during IMAP sync
- **Remember Me**: Persists email to AsyncStorage for returning users
- **Auto-Navigation**: After successful sync, automatically transitions to Mail inbox via `refreshAuthState()`

### Mail (Phase 2)
- **Sidebar Drawer**: Animated two-column layout with icon rail, folder list, account switcher, and unread counts
- **Date-Grouped Inbox**: SectionList with This Week, Last Week, This Month, Last Month, Older sections
- **Focused/Other Toggle**: Switch between inbox (Focused) and junk/spam (Other) folders
- **Filter Menu**: All, Unread, Flagged, Pinned, Has Files, Mention Me
- **IMAP Sync**: Real IMAP sync via `syncAccount()` for all connected accounts, with ID-based new email counting
- **Read State Preservation**: Local read status preserved across sync and auto-refresh to prevent IMAP overwriting
- **Auto-Refresh**: Messages re-fetched when screen regains focus (e.g., after composing)
- **Selection Mode**: Long-press to multi-select with bulk actions:
  - Delete, Archive, Move to Folder, Move to Other, Mark as Read, Flag
  - Three-dot menu with Select All / Unselect All toggle
  - Folder picker modal for move operations
- **Compose**: Dark-themed compose screen with gold accents, attachments, To/Cc/Bcc fields
- **Message Detail**: Full HTML rendering, mark-as-read on open, reply/forward/delete actions
- **Flag Toggle**: Tap flag icon to toggle flagged status

### Calendar
- **Event List**: Upcoming events with details
- **Event Detail**: Full event view with attendees, location, recurrence
- **New Event**: Create events with date/time pickers, recurrence, reminders

### People (Contacts)
- **Contact List**: Alphabetical listing with search and favorites
- **Contact Detail**: Full contact information display
- **Contact Edit**: Create and edit contacts
- **Contact Groups**: Group navigation (placeholder screen)

### Settings
- **Account Management**: Connected accounts overview
- **Manual Sync**: Trigger IMAP sync from settings
- **Sign Out**: Returns to auth flow

### Common Components
- **ThemedToast**: Centered auto-dismiss notification
- **ThemedAlert**: Modal alert/confirm dialog
- **SafeScreen**: SafeAreaView wrapper with configurable edges
- **useAlert Hook**: Provides `alert()`, `confirm()`, `toast()` functions

## Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 8+
- **Expo CLI**: `npx expo` (included via Expo SDK 54)
- **Expo Go**: Install on your phone for physical device testing

### Installation

```bash
# Navigate to the project directory
cd mobile/JubileeOutlookMobile

# Install dependencies
npm install

# Start the Expo development server
npx expo start --port 8081
```

### Running on Device (Expo Go)

1. Install **Expo Go** from the App Store or Google Play
2. Start the dev server: `npx expo start --port 8081`
3. Scan the QR code with your phone camera
4. The app opens in Expo Go

### Running in Browser

```bash
npx expo start --web --port 8081
```

## Project Structure

```
JubileeOutlookMobile/
├── App.tsx                  # App entry with providers and navigation
├── app.json                 # Expo configuration
├── package.json             # Dependencies (Expo SDK 54)
├── tsconfig.json            # TypeScript config
├── index.js                 # Entry point
├── assets/                  # App icons, splash, adaptive-icon
└── src/
    ├── components/
    │   ├── auth/
    │   │   ├── AuthCard.tsx              # Shared auth screen layout wrapper
    │   │   └── GoldCheckbox.tsx          # Custom gold checkbox component
    │   ├── common/
    │   │   ├── index.ts                  # Component barrel exports
    │   │   ├── ThemedToast.tsx           # Auto-dismiss notification toast
    │   │   └── ThemedAlert.tsx           # Modal alert/confirm dialog
    │   ├── layout/
    │   │   └── SafeScreen.tsx            # SafeAreaView wrapper
    │   └── modules/
    │       ├── calendar/
    │       │   └── EventCard.tsx         # Calendar event card
    │       └── mail/
    │           ├── MessageListItem.tsx   # Message list item (selection mode)
    │           └── SidebarDrawer.tsx     # Mail sidebar drawer
    ├── constants/
    │   ├── api.ts                       # API base URLs
    │   ├── colors.ts                    # Color palette (auth gold + app)
    │   ├── index.ts                     # StorageKeys and constants
    │   ├── spacing.ts                   # Spacing, BorderRadius, HitSlop
    │   └── typography.ts                # Typography scale
    ├── context/
    │   ├── AuthContext.tsx               # Auth state + login/register/logout/refreshAuthState
    │   └── MailContext.tsx               # Mail state + folder/message management
    ├── hooks/
    │   ├── index.ts                     # Hook barrel exports
    │   └── useAlert.tsx                 # Alert/confirm/toast hook
    ├── navigation/
    │   ├── AuthStack.tsx                # Auth flow navigator (5 screens)
    │   ├── MailStack.tsx                # Mail stack (Inbox, Detail, Compose, Folder, Search)
    │   ├── CalendarStack.tsx            # Calendar stack
    │   ├── PeopleStack.tsx              # People stack (Main, Detail, Edit, Group)
    │   ├── SettingsStack.tsx            # Settings stack
    │   ├── MainTabs.tsx                 # Bottom tab navigator (3 visible tabs)
    │   └── RootNavigator.tsx            # Root auth/main switch
    ├── screens/
    │   ├── auth/
    │   │   ├── SyncEmailScreen.tsx       # Default landing — email sync entry
    │   │   ├── SyncPasswordScreen.tsx    # IMAP password + sync flow
    │   │   ├── SignInScreen.tsx          # Codex authentication
    │   │   ├── SignUpScreen.tsx          # Registration form
    │   │   └── ForgotPasswordScreen.tsx  # Password reset
    │   ├── calendar/
    │   │   ├── CalendarScreen.tsx        # Monthly calendar view
    │   │   ├── EventDetailScreen.tsx     # Event details
    │   │   └── NewEventScreen.tsx        # Create/edit event
    │   ├── mail/
    │   │   ├── MailScreen.tsx            # Main inbox (sections, selection, sidebar)
    │   │   ├── MessageDetailScreen.tsx   # Message reading pane
    │   │   ├── ComposeScreen.tsx         # Compose email (dark themed)
    │   │   ├── FolderMessagesScreen.tsx  # Folder-specific message list
    │   │   └── SearchScreen.tsx          # Mail search
    │   ├── people/
    │   │   ├── PeopleScreen.tsx          # Contact list + groups
    │   │   ├── ContactDetailScreen.tsx   # Contact details
    │   │   ├── ContactEditScreen.tsx     # Create/edit contact
    │   │   └── ContactGroupScreen.tsx    # Contact group view
    │   └── settings/
    │       └── SettingsScreen.tsx        # App settings
    ├── services/
    │   ├── apiClient.ts                 # Dual Axios clients (Codex + Continuum)
    │   ├── auth/
    │   │   └── authService.ts           # Auth API (login, register, forgot)
    │   ├── calendar/
    │   │   └── calendarService.ts       # Calendar CRUD via Continuum API
    │   ├── contacts/
    │   │   └── contactService.ts        # Contacts via Codex API
    │   └── mail/
    │       ├── mailService.ts           # Mail CRUD via Continuum API
    │       └── emailSyncService.ts      # IMAP sync via Continuum API
    ├── types/
    │   ├── calendar.ts                  # Calendar event types
    │   ├── common.ts                    # Shared API response types
    │   ├── contacts.ts                  # Contact types
    │   ├── mail.ts                      # Email/folder types
    │   ├── index.ts                     # Type barrel exports
    │   └── navigation.ts               # React Navigation param types
    └── utils/
        └── storage.ts                   # AsyncStorage wrapper
```

## API Integration

The app uses two API clients (dual Axios instances):

| Client | Backend | Purpose | Endpoints |
|--------|---------|---------|-----------|
| **codexClient** | InspireCodex.com | Auth, Contacts | `/api/auth/*`, `/api/contacts/*` |
| **continuumClient** | InspireContinuum.com | Mail, Calendar, Sync | `/api/v1/outlook/*` |

All API communication is routed through the approved API layer. No direct database connections.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Expo SDK | 54 | Development framework |
| React Native | 0.81.5 | Mobile UI framework |
| TypeScript | 5.9.2 | Type safety |
| React Navigation | 7.x | Navigation (native-stack, bottom-tabs) |
| Axios | 1.13.5 | HTTP client |
| AsyncStorage | 2.2.0 | Local persistence |
| date-fns | 4.1.0 | Date formatting |

## Auth Screen Architecture

The auth flow uses 5 separate React Navigation screens (matching the web's 5-panel system):

```
AuthStack (native-stack)
├── SyncEmail (initialRoute) → Default landing, email input for sync
├── SyncPassword            → IMAP password + provider detection + sync
├── SignIn                  → Codex auth (email + password)
├── SignUp                  → Registration (name, email, password, confirm)
└── ForgotPassword          → Password reset via email
```

Shared components:
- **AuthCard** — Layout wrapper with avatar, brand heading, subtitle, footer
- **GoldCheckbox** — Custom checkbox with gold `#FFD700` accent

## Development

### Type Checking

```bash
npx tsc --noEmit
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Start on iOS Simulator |
| `npm run android` | Start on Android Emulator |
| `npm run web` | Start in web browser |
| `npm run typecheck` | Run TypeScript check |

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8081 in use | Kill process on 8081, use `--port` flag |
| Metro cache stale | `npx expo start --clear` |
| Expo Go wrong screen | Close Expo Go completely, reopen |
| Module not found | `rm -rf node_modules && npm install` |

## Building for Production

### Using EAS Build

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

### Local Build

```bash
npx expo prebuild
# Then open in Xcode (iOS) or Android Studio
```

## License

Copyright 2024-2026 Jubilee Software, Inc. All rights reserved.

---

**Technology that honors Scripture, protects families, and serves the Church.**
