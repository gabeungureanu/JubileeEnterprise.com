# Jubilee Music - Suno Desktop Wrapper

A Windows desktop application that wraps the Suno.com music generation website, providing a native experience for creating AI-generated music.

## Features

- **Embedded Browser**: Full Suno.com experience within a native WPF shell using WebView2
- **Create Screen**: Dedicated interface for entering lyrics, style prompts, and generating music
- **Library Management**: Local storage of generated tracks with search, filter, and playback
- **Secure Authentication**: Windows DPAPI encryption for credential storage
- **Audio Playback**: Built-in player using NAudio for playing generated tracks
- **Dark Theme**: Suno-inspired dark UI that matches the website's look and feel

## Requirements

- Windows 10 version 1903+ or Windows 11
- .NET 8.0 Runtime
- WebView2 Runtime (automatically installed with Windows 10/11)
- Internet connection for Suno.com access

## Installation

### Build from Source

1. Ensure you have the .NET 8.0 SDK installed
2. Clone or download this repository
3. Navigate to the JubileeMusic directory:
   ```bash
   cd applications/JubileeMusic.wpf/JubileeMusic
   ```
4. Restore dependencies and build:
   ```bash
   dotnet restore
   dotnet build --configuration Release
   ```
5. Run the application:
   ```bash
   dotnet run
   ```

### Run Prebuilt

1. Navigate to `bin/Release/net8.0-windows/`
2. Run `JubileeMusic.exe`

## Configuration

### Credential Storage

Credentials can be stored securely using one of three methods:

1. **Interactive Login**: Log in directly through the embedded browser
2. **Automatic Login**: Store credentials securely in Windows credential storage
3. **Config File**: Load credentials from a JSON file

#### Config File Format

Create a JSON file with the following structure:
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Security Note**: The config file is read once and credentials are encrypted using Windows DPAPI before storage. The original file can be deleted after import.

### Application Data Locations

- **Library**: `%LOCALAPPDATA%\JubileeMusic\Library\`
  - `audio/` - Generated audio files
  - `covers/` - Cover images
  - `metadata/` - Track metadata JSON files
- **Logs**: `%LOCALAPPDATA%\JubileeMusic\Logs\`
- **Credentials**: Encrypted in `%LOCALAPPDATA%\JubileeMusic\credentials.dat`

## Usage

### Browser View

The default view displays Suno.com in an embedded browser. You can:
- Navigate using the toolbar buttons (back, forward, refresh, home)
- Log in directly through the Suno interface
- Use the "Create" button to go to the Suno create page

### Create View

A dedicated interface for music generation:
1. Enter a **Title** (optional) for your track
2. Type your **Lyrics** or check "Instrumental Only"
3. Enter a **Style/Genre** prompt (e.g., "pop ballad", "electronic dance")
4. Click **Generate** to submit to Suno

The app will automatically:
- Navigate to the create page
- Enter your inputs
- Submit the generation request
- Monitor for completion
- Save the track to your library

### Library View

Browse and manage your generated tracks:
- **Search**: Filter tracks by title, lyrics, or style
- **Sort**: Order by date, title, duration, or play count
- **Play**: Click the play button or select a track
- **Details**: View full metadata including lyrics and generation info
- **Delete**: Remove tracks from the library

### Settings View

Configure the application:
- **Suno Account**: Store credentials for auto-login
- **Config File**: Import credentials from a JSON file
- **Library**: View storage location and stats
- **Logs**: View recent log entries and open log files

## Architecture

The application follows the MVVM (Model-View-ViewModel) pattern:

```
JubileeMusic/
├── Converters/         # Value converters for XAML bindings
├── Models/             # Data models (MusicTrack, Credentials, etc.)
├── Resources/          # XAML resources (Colors, Styles)
├── Services/           # Business logic services
│   ├── AudioPlayerService      # NAudio-based playback
│   ├── CredentialService       # DPAPI credential storage
│   ├── LibraryService          # Track storage and retrieval
│   ├── NavigationService       # View navigation
│   ├── SunoAutomationService   # Browser automation
│   └── FileLoggingService      # File-based logging
├── ViewModels/         # MVVM view models
│   ├── MainViewModel           # Main window logic
│   ├── BrowserViewModel        # Browser view logic
│   ├── CreateViewModel         # Create view logic
│   ├── LibraryViewModel        # Library view logic
│   └── SettingsViewModel       # Settings view logic
└── Views/              # XAML views
    ├── MainWindow.xaml         # Main application window
    ├── BrowserView.xaml        # Embedded browser
    ├── CreateView.xaml         # Music creation form
    ├── LibraryView.xaml        # Library browser
    └── SettingsView.xaml       # Application settings
```

## Dependencies

- **Microsoft.Web.WebView2** (1.0.2210.55) - Chromium-based embedded browser
- **CommunityToolkit.Mvvm** (8.2.2) - MVVM framework
- **NAudio** (2.2.1) - Audio playback
- **System.Security.Cryptography.ProtectedData** (8.0.0) - Windows DPAPI
- **Newtonsoft.Json** (13.0.3) - JSON serialization
- **Microsoft.Extensions.DependencyInjection** (8.0.0) - DI container
- **Microsoft.Extensions.Logging** (8.0.0) - Logging framework

## Known Limitations

1. **Suno UI Changes**: The automation relies on DOM selectors that may break if Suno updates their interface. The app uses resilient selectors but updates may be needed.

2. **Rate Limiting**: Suno may impose rate limits on generation requests. The app respects these but does not handle credits/subscription status.

3. **Audio Download**: Some Suno features may require manual interaction in the browser view.

4. **Authentication**: OAuth/SSO providers (Google, Apple, etc.) must be used through the browser view.

## Troubleshooting

### WebView2 Not Loading
- Ensure WebView2 Runtime is installed
- Check internet connectivity
- View logs at `%LOCALAPPDATA%\JubileeMusic\Logs\`

### Login Not Working
- Use the browser view for OAuth providers
- Clear stored credentials and try again
- Check Suno's status page for service issues

### Audio Not Playing
- Verify audio file exists in library folder
- Check Windows audio settings
- Try playing the file directly from Explorer

### Generation Timeout
- Suno may be experiencing high load
- Check the browser view for status
- View logs for detailed error information

## License

Proprietary - Jubilee Enterprise

## Support

For issues or questions, contact the Jubilee Enterprise development team.

---

**Note**: This application is a desktop wrapper and requires a valid Suno.com account. Suno.com's terms of service apply to all content generated through this application.
