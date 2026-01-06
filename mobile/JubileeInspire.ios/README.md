# Jubilee Inspire iOS

**Version 1.0.0** | An Interactive AI Bible Experience for Deeper Understanding of Scripture

The canonical iOS mobile client for the Jubilee Inspire ecosystem, built with Expo + React Native + TypeScript.

## Overview

Jubilee Inspire is a Scripture-centered mobile application that provides an interactive AI-powered Bible study experience. This app integrates with the Jubilee Solutions backend services (Codex, Inspire, and Continuum) to deliver personalized conversations about Scripture.

## Features

- **AI-Powered Conversations**: Chat with an AI assistant trained to help you understand Scripture
- **Scripture Study**: Explore the Bible with guided insights and commentary
- **Personal Growth**: Track your spiritual journey and save meaningful passages
- **Cross-Platform Sync**: Your data syncs across devices via the Continuum service

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
├── App.tsx                 # App entry point
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
    ├── config/             # App configuration
    │   ├── environment.ts
    │   └── index.ts
    ├── navigation/         # React Navigation setup
    │   ├── AppNavigator.tsx
    │   └── index.ts
    ├── screens/            # App screens
    │   ├── HomeScreen.tsx
    │   ├── ChatScreen.tsx
    │   └── index.ts
    ├── services/           # API service layer
    │   ├── httpClient.ts
    │   ├── codexApi.ts
    │   ├── inspireApi.ts
    │   ├── continuumApi.ts
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

Uses React Navigation with a native stack navigator:

- **HomeScreen** - Welcome screen with app introduction
- **ChatScreen** - AI conversation interface

### State Management

Currently uses local React state. Future versions may integrate:
- React Context for global state
- AsyncStorage for persistence
- Redux/Zustand for complex state

### API Layer

All API communication goes through the `services/` layer:
- `httpClient.ts` - Base HTTP client with auth handling
- `codexApi.ts` - Authentication service
- `inspireApi.ts` - Chat and Bible service
- `continuumApi.ts` - User data service

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

### Logs

View device logs:
```bash
npx expo start --clear
# Then press 'j' for JavaScript logs
```

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
