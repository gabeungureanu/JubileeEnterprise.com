# Jubilee Inspire iOS

**Version 1.0.0** | An Interactive AI Bible Experience for Deeper Understanding of Scripture

The canonical iOS mobile client for the Jubilee Inspire ecosystem, built with Expo + React Native + TypeScript.

## Overview

Jubilee Inspire is a Scripture-centered mobile application that provides an interactive AI-powered Bible study experience. This app integrates with the Jubilee Solutions backend services (Codex, Inspire, and Continuum) to deliver personalized conversations about Scripture.

## Features

### Core Features
- **AI-Powered Conversations**: Chat with an AI assistant trained to help you understand Scripture
- **Conversation History**: View, manage, and delete previous conversations with chronological grouping (Today, Yesterday, Previous 7 Days, Previous 30 Days, Older)
- **Real-time Chat Updates**: New conversations appear in the sidebar immediately, like ChatGPT
- **Voice Input**: Speak your questions using Web Speech API (web browser only) with auto-focus after voice recognition
- **File Attachments**: Upload and attach documents to your conversations with preview and removal capabilities
- **Custom Confirmation Dialogs**: Beautiful, branded confirmation modals that match the app's design system
- **Scripture Study**: Explore the Bible with guided insights and commentary
- **Personal Growth**: Track your spiritual journey and save meaningful passages
- **Cross-Platform Sync**: Your data syncs across devices via the Continuum service
- **User Authentication**: Secure sign-up and sign-in with JWT tokens

### User Experience
- **Smart New Chat**: Creates fresh conversations and saves previous ones to history with a single click
- **Auto-save Conversations**: Conversations are automatically saved to local storage
- **Clear All Conversations**: Delete all chat history with a custom confirmation dialog
- **Keyboard Shortcuts**: Press Enter to send messages (Shift+Enter for new lines in web)
- **Responsive UI**: Optimized for both mobile devices and web browsers
- **Theme System**: Support for System/Dark/Light themes with smooth transitions
- **Chronological Organization**: Conversations automatically grouped by date for easy navigation
- **Collapsible Sidebar**: ChatGPT-style sidebar that collapses to a thin icon bar (~56px)
- **ChatGPT-style Input Tools**: Dropdown menu with tools (Add photos, Create image, Thinking, Deep research, etc.)
- **Voice Mode**: Dedicated voice mode button for full voice conversation experience
- **Conversation Options Menu**: Right-click/hover menu with Share, Rename, Pin, Archive, and Delete options
- **Search Chats**: Real-time search filtering with keyword highlighting in conversation titles and previews
- **Read Aloud**: Text-to-speech playback for AI responses with play/stop toggle and "Speaking" indicator
- **Report Message**: Modal for reporting inappropriate content with predefined reasons and optional comments
- **Try Again**: Re-generate AI responses with a single tap

## Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 8+ or **yarn** 1.22+
- **Expo CLI**: Install globally or use npx
- **iOS Development**: Xcode 14+ (macOS only, for iOS Simulator)
- **Expo Go**: Install on your iPhone for physical device testing

### Installation

```bash
# Navigate to the project directory
cd mobile/JubileeInspire.ios

# Install dependencies
npm install

# Create local environment file
cp .env.example .env

# Start the Expo development server
npm start
```

### Running on iOS Simulator (macOS only)

```bash
# Start with iOS Simulator
npm run ios
```

Or from the Expo dev server menu, press `i` to open in iOS Simulator.

### Running on Physical iPhone

1. Install **Expo Go** from the App Store
2. Start the dev server: `npm start`
3. Scan the QR code with your iPhone camera
4. The app opens in Expo Go

### Running in Browser (Web Preview)

```bash
npm run web
```

## Project Structure

```
JubileeInspire.ios/
├── App.tsx                 # App entry point with ThemeProvider
├── app.json                # Expo configuration
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── .env.example            # Environment template
├── .vscode/                # VS Code configuration
│   ├── settings.json
│   ├── extensions.json
│   ├── tasks.json
│   └── launch.json
├── assets/                 # App icons and splash screens
└── src/
    ├── components/         # Reusable UI components
    │   ├── ChatInput.tsx       # Input field with voice, attachments, tools dropdown
    │   ├── ConversationItem.tsx # Sidebar item with ellipsis options menu
    │   ├── DrawerContent.tsx    # Collapsible sidebar with conversation history
    │   ├── MessageBubble.tsx    # Chat message display with theming
    │   ├── TypingIndicator.tsx  # Loading animation for AI responses
    │   ├── EmptyChat.tsx        # Empty state for new conversations
    │   ├── ConfirmDialog.tsx    # Custom branded confirmation modal
    │   └── index.ts             # Component exports
    ├── config/             # App configuration
    │   ├── environment.ts
    │   ├── theme.ts            # Theme color definitions (light/dark)
    │   └── index.ts
    ├── contexts/           # React contexts
    │   ├── AuthContext.tsx     # Authentication state
    │   ├── ThemeContext.tsx    # Theme management (System/Light/Dark)
    │   └── DrawerContext.tsx   # Drawer state (responsive 768px breakpoint)
    ├── navigation/         # React Navigation setup
    │   ├── AppNavigator.tsx
    │   └── index.ts
    ├── screens/            # App screens
    │   ├── AuthScreen.tsx       # Authentication screen
    │   ├── ChatScreen.tsx       # Main chat interface
    │   ├── HomeScreen.tsx       # Home/landing screen
    │   ├── SettingsScreen.tsx   # App settings and preferences
    │   ├── AppearanceScreen.tsx # Theme selection (System/Light/Dark)
    │   └── index.ts
    ├── services/           # API service layer
    │   ├── httpClient.ts        # Base HTTP client
    │   ├── api.ts               # API endpoints
    │   ├── storage.ts           # AsyncStorage wrapper with theme persistence
    │   └── index.ts
    ├── types/              # TypeScript definitions
    │   └── index.ts
    └── assets/             # App-specific assets
```

## API Integration

The app is designed to integrate with three backend services:

| Service | Purpose | URL |
|---------|---------|-----|
| **Codex** | Authentication, Identity, RBAC | `codex.jubileeverse.com` |
| **Inspire** | AI Chat, Bible Study, Content | `inspire.jubileeverse.com` |
| **Continuum** | User Data, Settings, Sync | `continuum.jubileeverse.com` |

Configure API URLs in your `.env` file:

```env
CODEX_API_URL=https://codex.jubileeverse.com/api
INSPIRE_API_URL=https://inspire.jubileeverse.com/api
CONTINUUM_API_URL=https://continuum.jubileeverse.com/api
```

## Development

### VS Code Setup

Install the recommended extensions when prompted, or manually install:

- **ESLint** (`dbaeumer.vscode-eslint`) - Code quality
- **Prettier** (`esbenp.prettier-vscode`) - Code formatting
- **React Native Tools** (`msjsdiag.vscode-react-native`) - Debugging

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo development server |
| `npm run ios` | Start on iOS Simulator |
| `npm run android` | Start on Android Emulator |
| `npm run web` | Start in web browser |

### VS Code Tasks

Use `Ctrl+Shift+P` → "Tasks: Run Task" to access:

- **Start Expo Server** - Launch the dev server
- **Start iOS Simulator** - Open in iOS Simulator
- **TypeScript Check** - Validate TypeScript
- **Expo Doctor** - Diagnose project issues

### Type Checking

```bash
npx tsc --noEmit
```

### Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Never commit `.env` to version control. The file is gitignored.

## Building for Production

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure your Expo account
eas login

# Build for iOS
eas build --platform ios
```

### Local Build (macOS only)

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Open in Xcode
open ios/JubileeInspire.xcworkspace
```

## App Configuration

Key settings in `app.json`:

| Property | Value |
|----------|-------|
| **App Name** | Jubilee Inspire |
| **Bundle ID** | com.jubilee.inspire |
| **Version** | 1.0.0 |
| **Scheme** | jubileeinspire |

## Architecture

### Navigation

Uses React Navigation with a drawer navigator for conversation history:

- **ChatScreen** - AI conversation interface with message history
- **AuthScreen** - User authentication (sign in/sign up)

The drawer sidebar provides:
- New chat button
- Conversation history grouped by date (Today, Yesterday, Previous 7 Days, etc.)
- Delete conversation functionality with confirmation dialog
- Settings navigation

### State Management

Uses multiple state management approaches:
- **AuthContext** - Global authentication state with React Context
- **AsyncStorage** - Local persistence for conversations and auth tokens
- **Local State** - Component-level state with React hooks

### API Layer

All API communication goes through the `services/` layer:
- `httpClient.ts` - Base HTTP client with auth handling
- `api.ts` - Main API service with authentication endpoints
- `storage.ts` - AsyncStorage wrapper for data persistence

### Key Components

#### ChatInput (`src/components/ChatInput.tsx`)
- Message input field with multiline support
- Voice recognition using Web Speech API (web only)
- File attachment picker with preview
- Auto-focus after voice input completes
- Enter key to send (Shift+Enter for new line on web)
- Microphone button with visual feedback
- Attachment removal functionality

#### MessageBubble (`src/components/MessageBubble.tsx`)
- Displays user and assistant messages
- Different styling for user vs assistant
- Supports message formatting and markdown rendering
- Timestamp display
- Message status indicators
- **Action Buttons** (for AI responses):
  - Copy to clipboard
  - Read Aloud (text-to-speech with play/stop toggle)
  - Try Again (re-generate response)
  - More options menu (Share, Report Message)
- **Report Message Modal**: Submit feedback with predefined reasons (Inappropriate content, Incorrect information, Offensive language, Spam, Other) and optional comments
- **Tooltips**: Action button tooltips positioned above buttons with proper z-index

#### ConversationItem (`src/components/ConversationItem.tsx`)
- Sidebar conversation list item with hover effects
- Shows conversation title and preview
- Ellipsis menu (three dots) appears on hover
- Options menu with: Share, Start a group chat, Rename, Pin chat, Archive, Delete
- Dynamic menu positioning 10px below ellipsis button
- Click-outside to close menu (Modal overlay)
- Active conversation highlighting with theme colors
- Custom delete confirmation modal for web
- **Search Highlighting**: Keywords highlighted in title and preview with `HighlightedText` component
- Accepts `searchQuery` prop for search result display

#### DrawerContent (`src/components/DrawerContent.tsx`)
- Collapsible sidebar navigation (ChatGPT-style)
- Always visible: thin icon bar (~56px) when collapsed, full width when expanded
- Collapse/expand toggle button in header
- Conversation history with chronological grouping (Today, Yesterday, Previous 7 Days, etc.)
- New chat button at bottom of sidebar
- Real-time updates via navigation state listener
- Auto-reload when conversation changes
- Optimized loading with debouncing
- Settings and Appearance navigation links
- Theme-aware styling with smooth transitions
- **Search Chats**: Real-time search input with filtering
  - Search by conversation title and preview text
  - Results count header with clear button
  - Pinned conversations remain at top in search results
  - Empty state when no matches found
  - Keyboard support with return key
  - Search icon with focus state styling

#### ConfirmDialog (`src/components/ConfirmDialog.tsx`)
- Custom branded confirmation modal
- Flexible icon and color theming
- Two-button (confirm/cancel) or single-button layouts
- Backdrop dismiss support
- Smooth fade animations
- Used for delete confirmations and success messages

#### EmptyChat (`src/components/EmptyChat.tsx`)
- Empty state for new conversations
- Welcoming message and suggested prompts
- Branded with Jubilee styling

#### TypingIndicator (`src/components/TypingIndicator.tsx`)
- Animated loading indicator for AI responses
- Three-dot bounce animation
- Matches app theme

## Implementation Details

### Navigation Architecture

The app uses React Navigation with a **Drawer + Stack** pattern:

```typescript
// Root navigation structure
DrawerNavigator
  └── HomeStack (StackNavigator)
      ├── Chat (Main screen)
      └── Settings

// Navigating to nested screens requires special syntax
navigation.navigate('HomeStack', {
  screen: 'Chat',
  params: { conversationId: 'abc123', timestamp: Date.now() }
});
```

**Key Navigation Patterns:**
- `useNavigation()` hook for navigation state listeners
- Drawer navigation props for drawer-specific actions (closeDrawer, openDrawer)
- Timestamp parameter forces re-render for "New Chat" functionality
- Navigation state listener tracks active conversation for sidebar highlighting

### State Management Patterns

#### Auto-save with Debouncing
Conversations are saved automatically with a 500ms debounce to reduce storage operations:

```typescript
useEffect(() => {
  if (conversation && messages.length > 0) {
    const timeoutId = setTimeout(() => {
      storage.saveConversation(updatedConversation);
    }, 500);

    return () => clearTimeout(timeoutId);
  }
}, [messages]);
```

#### Real-time Sidebar Updates
The drawer content listens to navigation state changes to refresh conversation list:

```typescript
useEffect(() => {
  const unsubscribe = navigation.addListener('state', () => {
    const convId = getActiveConversationId();
    if (convId !== currentConversationId) {
      setCurrentConversationId(convId);
      loadConversations();
    }
  });
  return unsubscribe;
}, [currentConversationId]);
```

### Voice Input Implementation

Voice recognition uses the Web Speech API (browser only):

```typescript
// Browser-specific implementation
if (Platform.OS === 'web' && 'webkitSpeechRecognition' in window) {
  const recognition = new (window as any).webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    setText(transcript);
  };

  recognition.onend = () => {
    setIsListening(false);
    // Auto-focus input after voice recognition completes
    setTimeout(() => inputRef.current?.focus(), 100);
  };
}
```

### File Attachment Handling

Uses `expo-document-picker` for cross-platform file selection:

```typescript
import * as DocumentPicker from 'expo-document-picker';

const handleFileAttachment = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (!result.canceled && result.assets?.[0]) {
    setAttachedFile(result.assets[0]);
  }
};
```

### Custom Dialog System

Instead of native `Alert.alert()`, the app uses a custom `ConfirmDialog` component for consistent branding:

```typescript
<ConfirmDialog
  visible={showDialog}
  title="Delete Conversation"
  message="This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  confirmColor={colors.error}
  icon="trash-outline"
  iconColor={colors.error}
  onConfirm={handleDelete}
  onCancel={() => setShowDialog(false)}
/>
```

### Performance Optimizations

1. **Debounced Saves**: 500ms delay on conversation saves
2. **Optimized useEffect Dependencies**: Removed navigation from dependency arrays to prevent loops
3. **Loading State Management**: Prevents multiple simultaneous conversation loads
4. **Delayed Drawer Loading**: 100ms timeout lets drawer animation complete before loading
5. **Conditional Re-renders**: Only reload conversations when active conversation actually changes

## Troubleshooting

### Common Issues

**"Unable to resolve module"**
```bash
# Clear Metro cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

**iOS Simulator not starting**
- Ensure Xcode is installed
- Run `xcode-select --install` for command line tools
- Open Xcode once to accept license agreement

**Expo Go connection issues**
- Ensure phone and computer are on same network
- Try `npm start --tunnel` for network issues

**App loading slowly**
- This is normal for Expo dev mode (Metro bundler)
- First load takes 10-15 seconds, subsequent hot reloads are fast (40-100ms)
- Production builds are significantly faster

**Navigation not updating**
- Check that you're using the correct nested navigation syntax
- Verify timestamp parameter is being passed for forced re-renders
- Use `useNavigation()` hook for state listeners, not drawer navigation props

**Voice input not working**
- Voice recognition only works in web browsers (Chrome/Edge recommended)
- Requires HTTPS or localhost for security
- Check browser permissions for microphone access

**Blank conversations appearing**
- Conversations are saved immediately on creation (by design)
- This allows real-time sidebar updates like ChatGPT
- Delete unwanted conversations using the sidebar delete button

**Enter key not working after voice input**
- Fixed with auto-focus implementation
- Input field auto-focuses 100ms after voice recognition ends
- If issue persists, check browser console for errors

### Logs

View device logs:
```bash
npx expo start --clear
# Then press 'j' for JavaScript logs
```

Enable verbose logging:
```bash
npx expo start --clear --verbose
```

## Recent Changes

### Version 1.0.0 - Latest Updates (January 2026)

#### New Features
- ✅ **Responsive Sidebar**: Platform-aware drawer behavior
  - Permanently visible on desktop (≥768px width)
  - Hidden by default on mobile with hamburger toggle
  - DrawerContext for shared drawer state management
  - Automatic detection of screen size changes
- ✅ **Centered Chat Input on Empty State**: ChatGPT-style initial chat layout
  - Chat textbox positioned 20px below quick action buttons on new chat
  - Maximum width of 650px, horizontally centered
  - Input returns to bottom on conversations with messages
- ✅ **Voice Wave Icon**: Custom audio equalizer-style icon
  - 5 vertical bars with varying heights (8, 14, 20, 14, 8 pixels)
  - Replaces headphone icon for voice mode button
  - Voice icon positioned to right of microphone icon
- ✅ **Persistent Microphone Button**: Mic icon always visible in chat input
  - Mic icon no longer disappears when typing
  - Voice/Send button swaps based on input state
- ✅ **No Focus Outline**: Removed outline on web text input focus
  - Platform-specific styling for cleaner appearance
- ✅ **Centralized Menu State**: Single-click menu switching in sidebar
  - Parent-controlled menu props for ConversationItem
  - Only one menu can be open at a time
  - Click on another item closes previous menu
- ✅ **Search Chats**: Real-time search filtering for conversation history
  - Search input field replaces button in drawer sidebar
  - Filters by conversation title and preview text
  - Keyword highlighting in search results using `HighlightedText` component
  - Results count header with clear button
  - Pinned conversations remain at top in filtered results
  - Empty state with appropriate messaging when no matches
  - Search icon with focus state styling
- ✅ **Read Aloud**: Text-to-speech playback for AI responses
  - Uses `expo-speech` package for cross-platform TTS
  - Play/stop toggle functionality
  - "Speaking" indicator badge while audio plays
  - Menu item changes to "Stop reading" when active
  - Menu stays open during playback for easy stop access
  - Automatic menu close when speech completes
- ✅ **Report Message**: Modal for reporting inappropriate content
  - Predefined reasons: Inappropriate content, Incorrect information, Offensive language, Spam, Other
  - Optional comments text field
  - Success confirmation after submission
  - Dismissible via Cancel, X button, clicking outside, or Escape key
- ✅ **Try Again**: Re-generate AI responses with a single tap
  - Appears in action buttons below AI responses
  - Triggers new response generation for the last user message
- ✅ **Tooltip Visibility Fix**: Action button tooltips now properly visible
  - Positioned above buttons instead of below
  - Higher z-index (9999) for proper layering
  - Added shadow/elevation for better visibility
  - Parent containers set to `overflow: 'visible'`
- ✅ **Theme System**: Full support for System/Light/Dark themes with smooth transitions
  - ThemeContext for global theme state management
  - Theme persistence via AsyncStorage
  - Automatic system theme detection
  - Dedicated Appearance settings screen
- ✅ **Collapsible Sidebar**: ChatGPT-style sidebar that collapses to a thin icon bar (~56px)
  - Always visible in both collapsed and expanded states
  - Smooth collapse/expand animations
  - Icon-only mode when collapsed
- ✅ **Conversation Options Menu**: Ellipsis menu on hover for each conversation
  - Share, Start a group chat, Rename, Pin chat, Archive, Delete options
  - Dynamic positioning 10px below the ellipsis button
  - Click-outside to dismiss (Modal overlay)
  - Custom icons for each option
- ✅ **ChatGPT-style Input Tools**: Dropdown menu with creative tools
  - Add photos, Create image, Thinking, Deep research options
  - Plus button to access tools menu
  - Voice mode button for voice conversations
- ✅ **Real-time Chat History**: New conversations appear in sidebar immediately (like ChatGPT)
- ✅ **File Attachments**: Upload and attach documents with preview functionality
- ✅ **Custom Confirmation Dialogs**: Replaced browser alerts with branded modal dialogs
- ✅ **Voice Input Auto-focus**: Input field automatically focuses after voice recognition completes
- ✅ **Clear All Conversations**: Delete all chat history with confirmation dialog
- ✅ **Smart New Chat**: Timestamp-based navigation forcing for reliable new conversation creation
- ✅ **Settings Screen**: Comprehensive settings with profile, preferences, and data management
- ✅ **Appearance Screen**: Dedicated screen for theme selection with visual previews

#### Bug Fixes
- Fixed "New Chat" button not creating fresh conversations
- Fixed Enter key not working after voice input
- Fixed navigation not updating when clicking conversation history
- Fixed `navigation.addListener is not a function` error (separated useNavigation hooks)
- Fixed blank conversations appearing on page reload (intentional for real-time updates)
- Fixed TypeScript compilation errors for web-specific props
- Fixed popup menu positioning (now uses getBoundingClientRect for accurate placement)
- Fixed sidebar disappearing when collapsed (now always visible as thin icon bar)

#### Performance Improvements
- Optimized conversation saves with 500ms debouncing
- Reduced unnecessary re-renders by optimizing useEffect dependencies
- Added loading state management to prevent multiple simultaneous loads
- Delayed drawer loading (100ms) to let animations complete smoothly
- Conditional conversation reloads only when active conversation changes

#### Technical Improvements
- Migrated to nested navigation syntax for drawer + stack pattern
- Separated `useNavigation()` hook from drawer navigation props
- Implemented navigation state listeners for real-time updates
- Added proper TypeScript types for navigation params
- Platform-specific code for web vs native features
- Created reusable ConfirmDialog component matching app design system
- Added ThemeContext with useTheme hook for theme-aware components
- Implemented theme persistence with AsyncStorage
- Added getBoundingClientRect for accurate web menu positioning

#### New Files Added
- `src/config/theme.ts` - Theme color definitions for light and dark modes
- `src/contexts/ThemeContext.tsx` - Theme management context with persistence
- `src/contexts/DrawerContext.tsx` - Drawer state management with 768px responsive breakpoint
- `src/screens/AppearanceScreen.tsx` - Theme selection UI with visual previews
- `src/screens/HomeScreen.tsx` - Home/landing screen

#### Dependencies Added
- `expo-document-picker@^14.0.8` - File attachment handling
- `expo-file-system@^19.0.21` - File system access
- `expo-speech` - Text-to-speech for Read Aloud functionality

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run type checking: `npx tsc --noEmit`
4. Test on iOS Simulator and/or device
5. Submit a pull request

## License

Copyright © 2024-2026 Jubilee Software, Inc. All rights reserved.

---

**Technology that honors Scripture, protects families, and serves the Church.**
