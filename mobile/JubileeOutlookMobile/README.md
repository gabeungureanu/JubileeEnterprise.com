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

### Mail
- **Inbox/Folder Navigation**: Folder list with unread counts
- **Message List**: Sender, subject, preview, date, read/unread status
- **Reading Pane**: Full HTML email rendering via WebView
- **Compose**: New email with To/Cc/Bcc, subject, body
- **IMAP Email Sync**: Connect and sync email accounts via Continuum API

### Calendar
- **Event List**: Upcoming events with details
- **Event Detail**: Full event view with attendees, location, recurrence
- **New Event**: Create events with date/time pickers, recurrence, reminders

### People (Contacts)
- **Contact List**: Alphabetical listing with search
- **Contact Detail**: Full contact information display
- **Contact Groups**: Group management

### Settings
- **Account Management**: Connected accounts overview
- **Preferences**: App configuration

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
    │   │   ├── AuthCard.tsx          # Shared auth screen layout wrapper
    │   │   └── GoldCheckbox.tsx      # Custom gold checkbox component
    │   └── modules/
    │       ├── calendar/
    │       │   └── EventCard.tsx     # Calendar event card
    │       └── mail/
    │           ├── ComposeModal.tsx  # Email compose modal
    │           ├── FolderList.tsx    # Mail folder sidebar
    │           ├── MessageItem.tsx   # Message list item
    │           └── ReadingPane.tsx   # Email reading pane
    ├── constants/
    │   ├── api.ts                   # API base URLs
    │   ├── colors.ts                # Color palette (auth gold + app colors)
    │   ├── index.ts                 # StorageKeys and constants
    │   ├── spacing.ts               # Spacing, BorderRadius, HitSlop
    │   └── typography.ts            # Typography scale
    ├── context/
    │   ├── AuthContext.tsx           # Auth state + login/register/logout
    │   └── MailContext.tsx           # Mail state + folder/message management
    ├── navigation/
    │   ├── AuthStack.tsx            # Auth flow navigator (5 screens)
    │   ├── MainTabs.tsx             # Bottom tab navigator
    │   └── RootNavigator.tsx        # Root auth/main switch
    ├── screens/
    │   ├── auth/
    │   │   ├── SyncEmailScreen.tsx       # Default landing — email sync entry
    │   │   ├── SyncPasswordScreen.tsx    # IMAP password + sync flow
    │   │   ├── SignInScreen.tsx          # Codex authentication
    │   │   ├── SignUpScreen.tsx          # Registration form
    │   │   └── ForgotPasswordScreen.tsx  # Password reset
    │   ├── calendar/
    │   │   ├── CalendarScreen.tsx        # Event list
    │   │   ├── EventDetailScreen.tsx     # Event details
    │   │   └── NewEventScreen.tsx        # Create event
    │   ├── mail/
    │   │   ├── InboxScreen.tsx           # Mail inbox
    │   │   └── ComposeScreen.tsx         # Compose email
    │   ├── people/
    │   │   ├── PeopleScreen.tsx          # Contact list
    │   │   └── ContactDetailScreen.tsx   # Contact details
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
