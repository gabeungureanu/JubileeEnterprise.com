# Changelog

All notable changes to Jubilee Browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [8.0.11] - 2026-01-16

### Added
- **Theme Support**: Added Dark and Light theme resource dictionaries
  - `DarkTheme.xaml` and `LightTheme.xaml` theme files
  - `ThemeManager` service for managing theme switching
  - System theme detection and real-time monitoring of OS theme changes

### Changed
- **Startup Performance Improvements**: Optimized browser launch to prevent system resource exhaustion
  - Limited tab restoration to maximum 10 tabs on startup
  - Added 50ms delay between tab creations to prevent memory spikes
  - Background services now initialize in batches instead of all at once
  - Added 200ms initial delay before background service initialization

### Technical
- Added `Services/ThemeManager.cs` for theme management
- Added `Themes/DarkTheme.xaml` and `Themes/LightTheme.xaml`
- Modified `MainWindow.xaml.cs` with `RestoreRemainingTabsAsync` improvements
- Modified `InitializeBackgroundServicesAsync` to batch service initialization

## [8.0.10] - 2026-01-16

### Added
- **Custom Themed Modal Dialogs**: Replaced all system MessageBox dialogs with Jubilee-themed custom modals
  - `SignInFailedDialog`: Custom modal for authentication failures with Demo Mode option
  - `JubileeAlertDialog`: Reusable alert dialog with AlertType enum (Info, Warning, Error, Success)
  - Consistent dark theme colors (#1c1c33 background, #E6AC00 gold accent)
  - Smooth fade-in/fade-out animations on dialog open/close

- **In-App Document Viewer**: Terms of Use and Privacy Policy now display within the app
  - `DocumentViewerDialog`: Scrollable document viewer with YAML content loading
  - `termsofuse.yaml`: Embedded resource with 12 sections of legal content
  - `privacypolicy.yaml`: Embedded resource with 13 sections of privacy content
  - Links in sign-up flow open documents in-app instead of external browser

- **Profile Picture Upload**: Users can now upload or change their profile picture
  - Clickable avatar in profile popup with camera icon overlay on hover
  - File picker dialog supporting JPG, PNG, GIF, and BMP formats
  - Local storage in `%LocalAppData%\JubileeBrowser\ProfilePictures`
  - Persistent across browser sessions
  - `UpdateAvatarUrl()` method in ProfileAuthService
  - `GetProfilePicturesDirectory()` static method for profile picture storage

### Changed
- **Sign-Up Flow UI**: Removed back arrow icon from forgot-password screen
- **Default Avatar Generation**: Color-coded default avatars based on user's display name
- **Avatar Loading**: Supports both local file paths and remote URLs

### Technical
- Added `JubileeAlertDialog.xaml` and `JubileeAlertDialog.xaml.cs`
- Added `SignInFailedDialog.xaml` and `SignInFailedDialog.xaml.cs`
- Added `DocumentViewerDialog.xaml` and `DocumentViewerDialog.xaml.cs`
- Added embedded resources: `termsofuse.yaml`, `privacypolicy.yaml`
- Updated `JubileeBrowser.csproj` with embedded resource entries
- Modified `MainWindow.xaml` with clickable avatar overlay UI
- Modified `MainWindow.xaml.cs` with `ChangeAvatarButton_Click` and `SetDefaultAvatar` methods
- Updated `ProfileAuthService.cs` with avatar management methods
- Fixed DialogResult error in animation callbacks with try-catch wrapper

### Fixed
- DialogResult assignment error when closing dialogs during animation callbacks

## [8.0.9] - 2026-01-15

### Added
- **History Tab Feature**: Complete browsing history panel with improved UI
  - History panel moved to correct designated sidebar location
  - Redesigned UI for better usability and readability
  - Toggle behavior - clicking history icon again closes the panel
  - Works for both Bible Web and Worldwide Web modes

- **Tab System Improvements**:
  - Yellow tabs for Bible Web mode; Blue tabs for Worldwide Web mode
  - Plus button creates tab matching currently active mode
  - Inspire-prefixed URLs remain within Bible Web mode
  - Visual indicators during tab drag operations
  - Dynamic tab width shrinking as tab count increases
  - All tabs display favicon or default globe icon

- **Mode Switching Enhancements**:
  - Switching between globe and Bible icons reuses the last active tab
  - No new tabs created when switching modes
  - Icon state always reflects active browsing mode

- **Sidebar Improvements**:
  - Smooth slide in/out animations (no abrupt appearance/disappearance)
  - Toggle button closes sidebar when clicked again
  - Consistent behavior across all browser modes

- **Toolbar & Visual Fixes**:
  - Fixed hamburger/menu icon color contrast on yellow background
  - All icons remain visible and accessible in all themes

### Changed
- **Sign-Out Flow**: Redesigned confirmation dialog following Jubilee theme
  - Consistent colors, typography, and spacing
  - Messaging intact with local data retention notice
  - Popup consistent with other modal dialogs

- **Sign-In Experience**:
  - Sign-in UI matches Jubilee Browser design language
  - Replaced 'Jubilee Outlook' branding with approved sub-slogan
  - Error states communicated via themed modal dialogs

- **TabState Model**: Added `IsInspireUrl` property for inspire:// URL detection
  - Used for displaying WWBW icon on WWW mode tabs with inspire:// URLs

### Technical
- Simplified MainWindow.xaml by removing unused storyboard animations
- Streamlined tab width calculation logic
- Fixed JavaScript bridge script to use JSON.stringify for WebView2 message passing
- Removed redundant `UpdateTabWidths()` calls and dynamic tab width logic
- Cleaned up unused drag-drop tracking variables

### Fixed
- Tab drag-drop operation visual feedback
- Sidebar animation smoothness
- Icon visibility in different theme contexts

## [8.0.8] - 2026-01-11

### Added
- **jubilee://settings Internal Page**: Full Chrome/Edge-style Settings page with comprehensive UI
  - Profile management section with account info display
  - Sync settings with toggle controls for bookmarks, history, passwords, tabs, and extensions
  - Privacy & Security settings with granular controls
  - Appearance customization (theme, font size)
  - Search engine and homepage configuration
  - Downloads path configuration
  - Startup behavior settings
  - Accessibility options

- **WebView2 JavaScript Bridge**: Bidirectional communication between Settings UI and browser core
  - `settings:getAll` - Retrieves all browser settings as JSON
  - `settings:update` - Updates individual settings with persistence
  - `settings:reset` - Resets all settings to defaults
  - `profile:getInfo` - Returns user profile information
  - `sync:getPreferences` - Returns sync preferences
  - `account:manage` - Opens account management window
  - `auth:signOut` - Signs out current user

- **InspireContinuum Heartbeat**: Real-time session tracking for dashboard
  - 60-second heartbeat interval while signed in
  - Automatic session registration on sign-in
  - Session end notification on sign-out
  - Browser ID and version tracking

### Changed
- **Settings Page Typography**: Updated design system with CSS custom properties
  - Primary text color: white (#ffffff)
  - Secondary accent color: gold (#E6AC00)
  - Custom scrollbar styling (WebKit and Firefox)
  - Improved visual hierarchy and accessibility
  - Focus-visible states for keyboard navigation

### Technical
- Added `InternalPageHandler` integration in navigation flow
- Implemented `OnWebMessageReceived` handler for Settings-to-C# communication
- Added heartbeat timer to `SyncEngine.cs` with non-blocking async execution
- Updated `InspireContinuum.com/server.js` with proper upsert for heartbeat endpoint

## [8.0.7] - 2026-01-05

### Changed
- **Professional MSI Installer**: Replaced ZIP distribution with Windows Installer (MSI) package
- **Smaller Package Size**: Reduced from ~72 MB ZIP to ~57 MB MSI with high compression
- **Improved Installation**: Double-click to install with desktop and Start Menu shortcuts

### Added
- **WiX Toolset v4 Integration**: Professional installer built with WiX Toolset 4.0.5
- **Desktop Shortcut**: Automatic desktop icon creation during installation
- **Start Menu Entry**: Jubilee Browser added to Windows Start Menu
- **WebView2 Prerequisite Check**: Installer verifies WebView2 runtime before installation
- **Upgrade Support**: Seamless upgrade from previous versions via Windows Installer

### Technical
- Built with WixToolset.Sdk 4.0.5 and WixToolset.Heat 4.0.5 for file harvesting
- MSI package includes all 270+ application files automatically harvested
- Registry-based shortcut management for clean uninstallation
- MajorUpgrade element prevents downgrade and handles version upgrades
- UpgradeCode: `A1B2C3D4-E5F6-7890-ABCD-EF1234567890`

### Installer Details
- **File**: `JubileeBrowser-Setup-8.0.7.msi`
- **Size**: ~57 MB
- **Scope**: Per-machine installation (Program Files)
- **Target**: `C:\Program Files\Jubilee Browser\`

## [8.0.6] - 2026-01-05

### Changed
- **Platform Migration**: Rebuilt from Electron to .NET 8 WPF for better Windows integration
- **Self-Contained Deployment**: No .NET runtime installation required on target machines
- **WebView2 Engine**: Uses Microsoft Edge WebView2 for modern web rendering
- **Enterprise Ready**: MSI installer support for Group Policy deployment

### Added
- **Auto-Update System**: Background update checks with SHA512 verification
- **Secure Credential Storage**: Windows Credential Manager integration
- **Tab Groups**: Organize tabs into collapsible groups
- **Session Persistence**: Restore tabs and state across restarts
- **Zoom Settings**: Per-site zoom level memory
- **Recently Closed Tabs**: Recover accidentally closed tabs

### Technical
- Built with .NET 8.0 and WPF
- WebView2 runtime for Chromium-based rendering
- Npgsql 8.0.5 for database connectivity
- YamlDotNet 16.3.0 for blacklist parsing
- Self-contained publish (~175 MB uncompressed, ~72 MB ZIP)

### Security
- Content filtering with 309,000+ blocked sites
- Session isolation between Internet and Jubilee Bible modes
- Secure token storage via Windows DPAPI

## [8.0.4] - 2026-01-01

### Fixed
- **Icon Display**: Replaced all icon assets with Jubilee logo (967KB, 1200x1200)
- **Clean Build**: Removed old icon.ico and forced complete rebuild
- **Asset Pipeline**: Ensured Electron Builder uses correct icon for all outputs

### Changed
- **Version Number**: Updated from 8.0.3 to 8.0.4 to reflect clean rebuild
- **Build Process**: Cleaned dist/ and release/ before rebuild to ensure fresh compilation

### Technical
- Removed old `assets/icon.ico` (97KB Electron logo)
- Copied `jubilee-logo.png` to `assets/icon.png`
- Verified TypeScript compilation of homepage settings
- Confirmed update manifest points to v8.0.4

## [8.0.3] - 2026-01-01

### Added
- **Automatic Updates**: Background update system checks for new versions every 4 hours
  - Update server configured: `http://jubileebrowser.com/downloads`
  - Silent installation on next browser restart
  - Update manifest (`latest.yml`) with SHA512 verification
  - Delta updates using blockmap files
- **Version Jump**: Updated from 1.0.2 to 8.0.3 to reflect project maturity

### Changed
- **Unified Homepage**: Both Internet and Jubilee Bible modes now default to `https://www.jubileeverse.com`
  - Previous: Internet Mode → Google, Jubilee Bible Mode → inspire://home.inspire
  - New: Both modes → www.jubileeverse.com
- **Application Icon**: Replaced Electron lightning bolt with Jubilee logo
  - Applies to: Desktop shortcut, taskbar, window, start menu, installer
  - Icon size: 967KB, 1200x1200 pixels
- **JubileeVerse Access**: Whitelisted `jubileeverse.com` and all subdomains in Jubilee Bible Mode
  - Navigation interceptor allows full access to JubileeVerse.com
  - Maintains security restrictions for other external sites

### Technical
- Updated `DEFAULT_SETTINGS` in `src/shared/types.ts`
- Modified `navigationInterceptor.ts` to allow JubileeVerse domain
- Configured `electron-updater` with generic provider
- Replaced `assets/icon.png` with Jubilee branding
- Added IIS MIME types for .yml and .blockmap files via web.config

## [1.0.2] - 2026-01-01

### Added
- **SSL Security Indicators**: Address bar now shows security status
  - HTTPS sites: Display `https://example.com`
  - HTTP sites: Display `Not Secure example.com`
  - Special protocols (inspire://, file://, about://) remain unchanged
- **Security Status Tracking**: Added `isSecure` field to TabState interface

### Changed
- **Address Bar Display**: Created `formatAddressBarDisplay()` method for consistent formatting
- **Navigation Events**: Updated did-navigate and did-navigate-in-page handlers to track SSL status

### Technical
- Modified `src/renderer/renderer.ts` to add security formatting
- Updated `src/shared/types.ts` to include `isSecure?: boolean` in TabState
- All address bar updates now use centralized formatter

## [1.0.1] - 2026-01-01

### Changed
- **Jubilee Bible Mode Homepage**: Changed from `inspire://home.inspire` to `https://www.jubileeverse.com`
- **Navigation Whitelist**: Added JubileeVerse.com to allowed domains in Jubilee Bible Mode

### Technical
- Updated `DEFAULT_SETTINGS.homepage.jubileebibles` in `src/shared/types.ts`
- Modified `navigationInterceptor.ts` to allow jubileeverse.com domain

## [1.0.0] - 2025-12-31

### Initial Release

#### Core Features
- **Dual-Mode Navigation**: Switch between Internet Mode and Jubilee Bible Mode
- **Tab Management**: Chrome-style tabbed interface with pin/mute/group support
- **Session Isolation**: Separate cookies, storage, and cache per mode
- **Blacklist System**: YAML-based content filtering
- **History & Bookmarks**: Full browsing history and bookmark management

#### Security
- **Context Isolation**: Renderer process isolated from Node.js
- **Secure IPC**: Type-safe communication channels
- **Session Partitioning**: `persist:internet` and `persist:jubileebibles` sessions
- **Content Security Policy**: Restricted resource loading
- **Navigation Interception**: Mode-appropriate URL filtering

#### Browser Modes
- **Internet Mode**:
  - Full access to public web (.com, .org, .net, etc.)
  - Blacklist filtering for inappropriate content
  - Standard DNS resolution
  - Default homepage: https://www.jubileeverse.com

- **Jubilee Bible Mode**:
  - .inspire namespace support
  - Restricted to inspire:// protocol by default
  - Enhanced content filtering
  - Default homepage: https://www.jubileeverse.com

#### User Interface
- **Address Bar**: URL entry with search fallback
- **Navigation Controls**: Back, forward, reload, stop
- **Tab Bar**: Draggable tabs with close buttons
- **Mode Toggle**: Visual indicator and keyboard shortcut (Ctrl+Shift+M)
- **Side Panel**: History and bookmarks access

#### Architecture
- **Main Process**: Electron main (Node.js environment)
  - Window management
  - Tab state coordination
  - Mode switching logic
  - IPC message handling
  - History and bookmark persistence
  - Blacklist enforcement

- **Renderer Process**: Browser UI (Chromium environment)
  - Tab rendering via webview tags
  - User interaction handling
  - Visual updates and animations
  - Context-isolated from Node.js

- **Preload Script**: Secure bridge between main and renderer
  - Exposes limited API via contextBridge
  - Type-safe IPC channels
  - No direct Node.js access

#### Inspire Namespace
- **Core Locations**:
  - `inspire://home.inspire` - Churchnet home
  - `inspire://about.inspire` - About page
  - `inspire://guide.inspire` - Navigation guide
  - `inspire://welcome.inspire` - Welcome experience
- **Shorthand Support**: `home.inspire` → `inspire://home.inspire`
- **Static Content**: Hardcoded HTML served directly

#### Keyboard Shortcuts
- Ctrl+T: New tab
- Ctrl+W: Close tab
- Ctrl+L: Focus address bar
- Ctrl+R / F5: Reload
- Alt+Left: Go back
- Alt+Right: Go forward
- Ctrl+Shift+M: Toggle mode
- Ctrl+H: History
- Ctrl+D: Bookmark

#### Build & Distribution
- **Platform**: Windows 10/11 (64-bit)
- **Installer**: NSIS with custom install script
- **Package Size**: ~75 MB
- **Icon**: Electron default lightning bolt
- **Dependencies**:
  - Electron 28.3.3
  - TypeScript 5.3.2
  - electron-builder 24.9.1
  - electron-updater 6.6.2

#### Configuration
- **User Data**: `%APPDATA%\jubilee\`
- **Settings**: JSON-based preferences
- **Blacklist**: YAML configuration with live reload
- **Session State**: Persisted across restarts

#### Known Limitations
- **Windows Only**: No macOS or Linux builds
- **No Code Signing**: Unsigned installer triggers SmartScreen
- **Update Server**: Placeholder URL (non-functional)
- **Auth Server**: Placeholder URL (non-functional)
- **Limited Inspire Locations**: Only 4 hardcoded pages
- **No Remote Inspire**: No distributed .inspire hosting
- **No Identity System**: Authentication framework incomplete

---

## Version Number Explanation

The jump from 1.0.2 to 8.0.3 reflects the significant maturity of the codebase and features that existed prior to formal version tracking. The 8.x series represents:

- 8+ major architectural components
- Comprehensive security implementation
- Production-ready auto-update system
- Professional branding and user experience
- Extensive feature set beyond initial prototype

## Update Policy

- **Major versions (x.0.0)**: Breaking changes, major new features
- **Minor versions (8.x.0)**: New features, significant enhancements
- **Patch versions (8.0.x)**: Bug fixes, minor improvements

## Semantic Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Incompatible API changes
- **MINOR**: Backwards-compatible functionality additions
- **PATCH**: Backwards-compatible bug fixes

## Download

Current version: **8.0.10**

Download: [https://jubileebrowser.com/downloads/JubileeBrowser-8.0.10-win-x64.zip](https://jubileebrowser.com/downloads/JubileeBrowser-8.0.10-win-x64.zip)

Auto-update manifest: [https://jubileebrowser.com/downloads/stable/releases.json](https://jubileebrowser.com/downloads/stable/releases.json)
