# Jubilee Outlook Mobile

**Version 1.0.0** | Cross-Platform Email Client for iOS, Android, and Web

The React Native mobile client for the JubileeOutlook ecosystem, built with Expo SDK 54 + React Native 0.81.5 + TypeScript.

## Overview

Jubilee Outlook Mobile is a full-featured email client that mirrors the JubileeOutlook web frontend. It integrates with the Jubilee Solutions backend services (Codex for authentication/contacts, Continuum for mail/calendar) to provide a native mobile email experience with IMAP sync, calendar management, and contact management.

## Features

### Authentication (Phase 1)
- **5-Screen Auth Flow**: Matching the web frontend's 5-panel auth system
  - **Sync Email** (default landing) — Enter email to sync existing accounts, with "Sign In" and "Create account" links
  - **Sync Password** — IMAP app password entry with provider detection, SHA-256 userId hashing (via expo-crypto)
  - **Sign In** — Codex auth with email/password and "Keep me signed in"
  - **Sign Up** — Full registration with name, email, password, newsletter
  - **Forgot Password** — Email-based password reset with auto-redirect
- **Provider Detection**: Auto-detects Microsoft 365, Gmail, Yahoo, iCloud, IMAP/POP
- **Gold Theme**: Matches web's `#FFD700` gold accent throughout auth screens
- **Real-time Validation**: Per-field error clearing as user corrects input
- **Animated Progress**: Indeterminate progress bar during IMAP sync
- **Remember Me**: Persists email to AsyncStorage for returning users; auto-saves email after registration
- **Auto-Navigation**: After successful sync, automatically transitions to Mail inbox via `refreshAuthState()`
- **Loading Gate**: Returns to authenticated state without AuthStack flash (LoadingSpinner during bootstrap)
- **Sync-Only Persistence**: Sync-only sessions survive app restart (matches web behavior)
- **Keyboard Handling**: `returnKeyType` and `onSubmitEditing` on all inputs with ref-chaining for multi-input forms
- **AutoFocus**: First input on each auth screen receives autoFocus
- **Button Loading Text**: Shows "Signing in..." / "Creating account..." text during loading (matches web, no spinner)

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
- **Event List**: Upcoming events with 30-second auto-refresh sync
- **Event Detail**: Full event view with attendees, location, recurrence, attachment preview
- **New Event**: Create events with date/time pickers, recurrence, reminders, attendee input with email validation
- **Recurring Event Delete**: "This event" vs "All events in series" dialog (matches web RecurrenceEditDialog)
- **Delete Confirmation**: Confirmation popup before all event deletions (recurring and non-recurring)
- **Attachment Preview**: In-app preview modal for calendar event attachments with download/share
- **Reminders**: Local notification reminders with dismiss/snooze actions

### People (Contacts)
- **Contact List**: Alphabetical listing with search, favorites, filter tabs (All/Favorites/Groups/Deleted), category filtering, sort options
- **Contact Detail**: Full contact profile with quick actions (call, email, message), group membership, favorite toggle
- **Contact Edit**: Create/edit contacts with full validation, date pickers for birthday/anniversary (MonthGrid + BottomSheet), URL validation for website, snake_case DTO payload matching web frontend
- **Contact Groups**: Group CRUD, member management, add/remove members with search
- **Batch Operations**: Multi-select with bulk delete, restore, hard-delete, category update

### Settings
- **Account Management**: Connected accounts overview
- **Manual Sync**: Trigger IMAP sync from settings
- **Sign Out**: Returns to auth flow

### Common Components
- **ThemedToast**: Centered auto-dismiss notification
- **ThemedAlert**: Modal alert/confirm dialog
- **SafeScreen**: SafeAreaView wrapper with configurable edges
- **useAlert Hook**: Provides `alert()`, `confirm()`, `toast()` functions
- **AttachmentPreviewModal**: In-app file preview with download/share via expo-web-browser and expo-sharing
- **RecurrenceActionDialog**: "This event" / "All events in series" modal for recurring event operations
- **BottomSheet**: Reusable bottom sheet with backdrop and customizable height
- **Avatar**: Contact/user avatar with initials fallback
- **ReminderPopup / ReminderOverlay**: Local notification reminder UI

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
    │   │   ├── ThemedAlert.tsx           # Modal alert/confirm dialog
    │   │   ├── AttachmentPreviewModal.tsx # File preview with download/share
    │   │   ├── RecurrenceActionDialog.tsx # Recurring event action chooser
    │   │   ├── BottomSheet.tsx           # Reusable bottom sheet
    │   │   ├── Avatar.tsx               # User/contact avatar
    │   │   ├── ReminderPopup.tsx         # Reminder notification popup
    │   │   └── ReminderOverlay.tsx       # Reminder overlay
    │   ├── layout/
    │   │   └── SafeScreen.tsx            # SafeAreaView wrapper
    │   └── modules/
    │       ├── calendar/
    │       │   ├── EventCard.tsx         # Calendar event card
    │       │   ├── AttachmentPicker.tsx  # File attachment picker
    │       │   ├── AttendeeInput.tsx     # Attendee email input with validation
    │       │   ├── DatePickerField.tsx   # Tappable date field with MonthGrid
    │       │   ├── MonthGrid.tsx         # Month calendar grid
    │       │   └── CalendarHeader.tsx    # Calendar header with nav
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
    │   ├── AuthContext.tsx               # Auth state + login/register/logout/refreshAuthState + sync-only persistence
    │   ├── MailContext.tsx               # Mail state + folder/message management
    │   └── ReminderContext.tsx           # Local notification reminders
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
    │   │   ├── calendarService.ts       # Calendar CRUD via Continuum API
    │   │   └── reminderService.ts       # Local notification reminder scheduling
    │   ├── contacts/
    │   │   └── contactService.ts        # Contacts via Codex API (toCamelCaseKeys matching web)
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
        ├── storage.ts                   # AsyncStorage wrapper
        └── calendarUtils.ts             # Calendar date/time utilities
```

## API Integration

The app uses two API clients (dual Axios instances):

| Client | Backend | Purpose | Endpoints |
|--------|---------|---------|-----------|
| **codexClient** | InspireCodex.com | Auth, Contacts | `/api/auth/*`, `/api/contacts/*` |
| **continuumClient** | InspireContinuum.com | Mail, Calendar, Sync | `/api/v1/outlook/*` |

All API communication is routed through the approved API layer. No direct database connections.

### Authentication Guard (`requireUserId`)

All service-layer API calls use `tokenStore.requireUserId()` instead of `tokenStore.getUserId()` to enforce authentication. If the user is not signed in, service calls throw a clear error (`"User is not authenticated. Please sign in to continue."`) rather than silently passing `null` to the API.

| Method | Returns | Use Case |
|--------|---------|----------|
| `tokenStore.getUserId()` | `string \| null` | Auth checks, interceptors, context providers |
| `tokenStore.requireUserId()` | `string` (throws if null) | Service calls (`calendarService`, `contactService`, `mailService`) |

Screen-level code (e.g., `NewEventScreen`, `ContactEditScreen`) may still use `getUserId()` with explicit null-check UI alerts for user-friendly error messages.

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
| expo-crypto | 15.0.8 | SHA-256 hashing for sync userId |
| expo-web-browser | 15.0.10 | In-app browser for attachment preview |
| expo-sharing | 14.0.8 | File sharing |
| expo-file-system | 19.0.21 | File system access |
| expo-document-picker | 14.0.8 | Document picker for attachments |
| expo-notifications | 0.32.16 | Local notification reminders |
| expo-contacts | 15.0.11 | Device contacts access |

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
