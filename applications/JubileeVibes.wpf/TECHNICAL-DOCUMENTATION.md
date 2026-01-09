# JubileeVibes Music Player - Technical Documentation

## Overview

JubileeVibes is a modern, Spotify-inspired desktop music player application built with **WPF (Windows Presentation Foundation)** and **.NET 8.0**. The application follows clean architecture principles with a clear separation of concerns between the presentation layer, business logic, and infrastructure.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Audio Playback System](#audio-playback-system)
5. [Queue Management](#queue-management)
6. [Navigation System](#navigation-system)
7. [Authentication](#authentication)
8. [User Interface](#user-interface)
9. [Dependency Injection](#dependency-injection)
10. [Data Models](#data-models)
11. [Build and Deployment](#build-and-deployment)

---

## Architecture

### Design Pattern: MVVM (Model-View-ViewModel)

JubileeVibes implements the **MVVM pattern** using the **CommunityToolkit.Mvvm** library for:
- Observable properties with `[ObservableProperty]` attribute
- Commands with `[RelayCommand]` attribute
- Automatic property change notifications

### Clean Architecture Layers

```
JubileeVibes.sln
├── JubileeVibes              # Presentation Layer (WPF Application)
├── JubileeVibes.Core         # Domain Layer (Interfaces, Models, Enums)
├── JubileeVibes.Infrastructure  # Infrastructure Layer (Service Implementations)
└── JubileeVibes.Shared       # Shared Utilities
```

---

## Project Structure

### JubileeVibes (Presentation Layer)

```
JubileeVibes/
├── App.xaml(.cs)           # Application entry point & DI configuration
├── Converters/             # XAML value converters
│   ├── BoolToVisibilityConverter.cs
│   ├── BoolToOpacityConverter.cs
│   ├── BoolToFollowTextConverter.cs
│   ├── CountToVisibilityConverter.cs
│   ├── EqualityToVisibilityConverter.cs
│   ├── InverseBoolConverter.cs
│   ├── LikedToIconConverter.cs
│   ├── NullToVisibilityConverter.cs
│   ├── NumberFormatConverter.cs
│   ├── PlayStateToIconConverter.cs
│   ├── SliderTrackWidthConverter.cs
│   ├── StringToBoolConverter.cs
│   ├── StringToVisibilityConverter.cs
│   ├── TimeSpanToStringConverter.cs
│   └── VolumeToIconConverter.cs
├── Resources/
│   ├── Icons/              # SVG/Path icons
│   │   └── AppIcons.xaml
│   ├── Styles/             # Control styles
│   │   ├── ButtonStyles.xaml
│   │   ├── ControlStyles.xaml
│   │   ├── ScrollBarStyles.xaml
│   │   └── SliderStyles.xaml
│   ├── Templates/
│   │   └── DataTemplates.xaml
│   ├── Themes/
│   │   ├── Brushes.xaml
│   │   ├── Colors.xaml
│   │   └── DarkTheme.xaml
│   └── Converters.xaml
├── ViewModels/
│   ├── ViewModelBase.cs    # Base class for all ViewModels
│   ├── MainWindowViewModel.cs
│   ├── Pages/
│   │   ├── AccountViewModel.cs
│   │   ├── AlbumViewModel.cs
│   │   ├── ArtistViewModel.cs
│   │   ├── HomeViewModel.cs
│   │   ├── LibraryViewModel.cs
│   │   ├── PlaylistViewModel.cs
│   │   ├── QueueViewModel.cs
│   │   ├── SearchViewModel.cs
│   │   └── SettingsViewModel.cs
│   └── Shell/
│       ├── NowPlayingBarViewModel.cs
│       ├── ShellViewModel.cs
│       └── SidebarViewModel.cs
└── Views/
    ├── MainWindow.xaml(.cs)
    ├── Pages/
    │   ├── AccountView.xaml(.cs)
    │   ├── AlbumView.xaml(.cs)
    │   ├── ArtistView.xaml(.cs)
    │   ├── HomeView.xaml(.cs)
    │   ├── LibraryView.xaml(.cs)
    │   ├── PlaylistView.xaml(.cs)
    │   ├── QueueView.xaml(.cs)
    │   ├── SearchView.xaml(.cs)
    │   └── SettingsView.xaml(.cs)
    └── Shell/
        ├── NowPlayingBarView.xaml(.cs)
        ├── NowPlayingPanelView.xaml(.cs)
        ├── ShellView.xaml(.cs)
        └── SidebarView.xaml(.cs)
```

### JubileeVibes.Core (Domain Layer)

```
JubileeVibes.Core/
├── Enums/
│   ├── AudioQuality.cs
│   ├── NavigationTarget.cs
│   ├── PlayState.cs
│   └── RepeatMode.cs
├── Events/
│   ├── AuthStateChangedEventArgs.cs
│   ├── PlaybackPositionChangedEventArgs.cs
│   └── TrackChangedEventArgs.cs
├── Interfaces/
│   ├── IAudioPlaybackService.cs
│   ├── IAuthenticationService.cs
│   ├── ICacheService.cs
│   ├── IDialogService.cs
│   ├── ILibraryService.cs
│   ├── IMusicCatalogService.cs
│   ├── INavigationService.cs
│   ├── IPlaylistService.cs
│   ├── IQueueService.cs
│   ├── ISecureStorageService.cs
│   └── ISettingsService.cs
└── Models/
    ├── Album.cs
    ├── Artist.cs
    ├── Playlist.cs
    ├── Track.cs
    └── User.cs
```

### JubileeVibes.Infrastructure (Infrastructure Layer)

```
JubileeVibes.Infrastructure/
├── Api/
│   └── MockMusicCatalogService.cs
├── Audio/
│   └── NAudioPlaybackEngine.cs
├── Cache/
│   └── LocalCacheService.cs
└── Services/
    ├── AuthenticationService.cs
    ├── DialogService.cs
    ├── LibraryService.cs
    ├── NavigationService.cs
    ├── PlaylistService.cs
    ├── QueueService.cs
    ├── SecureStorageService.cs
    └── SettingsService.cs
```

---

## Core Components

### Interfaces

#### IAudioPlaybackService
Primary interface for audio playback control:

```csharp
public interface IAudioPlaybackService
{
    // Current state
    PlayState CurrentState { get; }
    Track? CurrentTrack { get; }
    TimeSpan Position { get; }
    TimeSpan Duration { get; }
    double Volume { get; set; }
    bool IsMuted { get; set; }
    RepeatMode RepeatMode { get; set; }
    bool IsShuffleEnabled { get; set; }

    // Events
    event EventHandler<TrackChangedEventArgs>? TrackChanged;
    event EventHandler<PlaybackPositionChangedEventArgs>? PositionChanged;
    event EventHandler<PlayState>? StateChanged;
    event EventHandler<double>? VolumeChanged;

    // Playback control
    Task PlayAsync(Track track);
    Task PlayAsync(IEnumerable<Track> tracks, int startIndex = 0);
    Task PauseAsync();
    Task ResumeAsync();
    Task StopAsync();
    Task SeekAsync(TimeSpan position);
    Task NextAsync();
    Task PreviousAsync();
    Task TogglePlayPauseAsync();

    // Audio device management
    IEnumerable<AudioDevice> GetAvailableDevices();
    AudioDevice? CurrentDevice { get; }
    Task SetDeviceAsync(AudioDevice device);
}
```

#### IQueueService
Manages the playback queue with history tracking:

```csharp
public interface IQueueService
{
    IReadOnlyList<QueueItem> Queue { get; }
    IReadOnlyList<QueueItem> History { get; }
    QueueItem? CurrentItem { get; }
    int CurrentIndex { get; }
    bool IsShuffled { get; }

    event EventHandler? QueueChanged;
    event EventHandler<QueueItem?>? CurrentItemChanged;

    void SetQueue(IEnumerable<Track> tracks, int startIndex = 0);
    void AddToQueue(Track track);
    void AddNext(Track track);
    void RemoveFromQueue(int index);
    void ClearQueue();
    void MoveItem(int fromIndex, int toIndex);
    Track? GetNext();
    Track? GetPrevious();
    void EnableShuffle();
    void DisableShuffle();
}
```

#### INavigationService
Handles page navigation with back/forward stack:

```csharp
public interface INavigationService
{
    NavigationTarget CurrentPage { get; }
    object? CurrentParameter { get; }
    bool CanGoBack { get; }
    bool CanGoForward { get; }

    event EventHandler<NavigationEventArgs>? Navigated;

    void NavigateTo(NavigationTarget target, object? parameter = null);
    void NavigateToAlbum(string albumId);
    void NavigateToArtist(string artistId);
    void NavigateToPlaylist(string playlistId);
    void GoBack();
    void GoForward();
}
```

---

## Audio Playback System

### NAudioPlaybackEngine

The audio engine is built on **NAudio 2.2.1** and supports:

1. **Local File Playback** - Using `AudioFileReader`
2. **Stream Playback** - Using `MediaFoundationReader`
3. **Volume Control** - Via `VolumeSampleProvider`
4. **Position Tracking** - 250ms interval timer updates

#### Key Features:

```csharp
public class NAudioPlaybackEngine : IAudioPlaybackService, IDisposable
{
    private IWavePlayer? _wavePlayer;           // Audio output device
    private AudioFileReader? _audioFileReader;   // Local file reader
    private MediaFoundationReader? _streamReader; // Stream reader
    private VolumeSampleProvider? _volumeProvider; // Volume control

    // Position updates every 250ms
    private readonly System.Timers.Timer _positionTimer;
```

#### Playback Flow:

1. **PlayAsync(Track track)** - Main entry point
   - Stops current playback
   - Determines source (local file or stream URL)
   - Creates appropriate reader (`AudioFileReader` or `MediaFoundationReader`)
   - Wraps with `VolumeSampleProvider`
   - Initializes `WaveOutEvent` and starts playback
   - Starts position timer

2. **Auto-advance** - When track ends naturally:
   - Checks `RepeatMode.One` for single track repeat
   - Calls `NextAsync()` for next track
   - Handles `RepeatMode.All` for queue restart

3. **Previous Track Logic**:
   - If position > 3 seconds: restart current track
   - Otherwise: go to previous track in history

#### Supported Audio Formats:
- MP3, WAV, FLAC, AAC, OGG (via MediaFoundation)
- Any format supported by Windows Media Foundation

---

## Queue Management

### QueueService

Implements a sophisticated queue system with:

1. **Main Queue** - Current playback order
2. **History Stack** - Previously played tracks
3. **Original Queue** - Preserved for unshuffle

#### Shuffle Algorithm (Fisher-Yates):

```csharp
private void ShuffleFromIndex(int startIndex)
{
    var toShuffle = _queue.Skip(startIndex).ToList();
    _queue.RemoveRange(startIndex, toShuffle.Count);

    // Fisher-Yates shuffle
    for (int i = toShuffle.Count - 1; i > 0; i--)
    {
        int j = _random.Next(i + 1);
        (toShuffle[i], toShuffle[j]) = (toShuffle[j], toShuffle[i]);
    }

    _queue.AddRange(toShuffle);
}
```

#### Queue Operations:

| Operation | Description |
|-----------|-------------|
| `SetQueue()` | Replace entire queue with new tracks |
| `AddToQueue()` | Append track(s) to end of queue |
| `AddNext()` | Insert track immediately after current |
| `RemoveFromQueue()` | Remove track at index |
| `MoveItem()` | Reorder tracks in queue |
| `ClearQueue()` | Remove all upcoming tracks |
| `GetNext()` | Advance to next track, add current to history |
| `GetPrevious()` | Return to previous track from history |

---

## Navigation System

### NavigationService

Implements browser-style navigation with back/forward stacks:

```csharp
private readonly Stack<NavigationEntry> _backStack = new();
private readonly Stack<NavigationEntry> _forwardStack = new();
```

#### Navigation Targets:

```csharp
public enum NavigationTarget
{
    None,
    Home,
    Search,
    Library,
    Playlist,
    Album,
    Artist,
    Settings,
    Account,
    Queue
}
```

#### Navigation Flow:

1. **NavigateTo()** - Push current to back stack, clear forward stack
2. **GoBack()** - Pop from back stack, push current to forward stack
3. **GoForward()** - Pop from forward stack, push current to back stack

---

## Authentication

### AuthenticationService

Integrates with **Jubilee SSO** (Single Sign-On) system:

- **SSO Endpoint**: `https://sso.worldwidebibleweb.org`
- **Client ID**: `jubileevibes-desktop`

#### Authentication Flow:

1. **Initialize** - Restore session from secure storage
2. **Sign In** - POST `/api/auth/login` with credentials
3. **Token Refresh** - POST `/api/auth/refresh` before expiry
4. **Sign Out** - POST `/api/auth/logout` and clear storage

#### Session Storage:

```csharp
public class AuthSession
{
    public string UserId { get; set; }
    public string AccessToken { get; set; }
    public string RefreshToken { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
}
```

#### Secure Storage:

Uses `System.Security.Cryptography.ProtectedData` for:
- Encrypting tokens at rest
- Windows DPAPI protection

---

## User Interface

### Shell Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │                  [Content Area]               │
│             │                                               │
│  - Home     │    Page content based on NavigationTarget     │
│  - Search   │                                               │
│  - Library  │                                               │
│             │                                               │
│  Playlists: │                                               │
│  - Liked    │                                               │
│  - ...      │                                               │
├─────────────┴───────────────────────────────────────────────┤
│                    [Now Playing Bar]                         │
│  [Album Art] [Track Info] | [<<] [Play/Pause] [>>] | [Vol]  │
└─────────────────────────────────────────────────────────────┘
```

### Theme System

Dark theme with Spotify-inspired colors:

```xaml
<!-- Colors.xaml -->
<Color x:Key="BackgroundPrimary">#121212</Color>
<Color x:Key="BackgroundSecondary">#181818</Color>
<Color x:Key="BackgroundTertiary">#282828</Color>
<Color x:Key="AccentGreen">#1DB954</Color>
<Color x:Key="TextPrimary">#FFFFFF</Color>
<Color x:Key="TextSecondary">#B3B3B3</Color>
```

### Custom Controls

1. **SeekSlider** - Progress bar with seek functionality
2. **VolumeSlider** - Volume control with mute toggle
3. **PlayButton** - Circular play/pause button
4. **ToggleIconButton** - Toggle button with icon states

---

## Dependency Injection

### Service Registration (App.xaml.cs)

```csharp
private static void ConfigureServices(IServiceCollection services)
{
    // Core Services (Singletons)
    services.AddSingleton<ISettingsService, SettingsService>();
    services.AddSingleton<ISecureStorageService, SecureStorageService>();
    services.AddSingleton<ICacheService, LocalCacheService>();

    // Audio Services
    services.AddSingleton<IAudioPlaybackService, NAudioPlaybackEngine>();
    services.AddSingleton<IQueueService, QueueService>();

    // API Services
    services.AddHttpClient();
    services.AddSingleton<IAuthenticationService, AuthenticationService>();
    services.AddSingleton<IMusicCatalogService, MockMusicCatalogService>();
    services.AddSingleton<IPlaylistService, PlaylistService>();
    services.AddSingleton<ILibraryService, LibraryService>();

    // Navigation & Dialog
    services.AddSingleton<INavigationService, NavigationService>();
    services.AddSingleton<IDialogService, DialogService>();

    // ViewModels (Shell - Singletons for persistence)
    services.AddSingleton<MainWindowViewModel>();
    services.AddSingleton<SidebarViewModel>();
    services.AddSingleton<NowPlayingBarViewModel>();

    // ViewModels (Pages - Transient for fresh state)
    services.AddTransient<HomeViewModel>();
    services.AddTransient<SearchViewModel>();
    services.AddTransient<LibraryViewModel>();
    // ... etc
}
```

### Service Lifetimes:

| Service Type | Lifetime | Reason |
|--------------|----------|--------|
| Audio Services | Singleton | Maintain playback state |
| Authentication | Singleton | Share auth state globally |
| Navigation | Singleton | Preserve navigation history |
| Shell ViewModels | Singleton | Persist UI state |
| Page ViewModels | Transient | Fresh state per navigation |

---

## Data Models

### Track

```csharp
public class Track : INotifyPropertyChanged
{
    public string Id { get; set; }
    public string Title { get; set; }
    public string ArtistId { get; set; }
    public string ArtistName { get; set; }
    public string AlbumId { get; set; }
    public string AlbumName { get; set; }
    public string? AlbumArtUrl { get; set; }
    public TimeSpan Duration { get; set; }
    public int TrackNumber { get; set; }
    public int DiscNumber { get; set; }
    public bool IsExplicit { get; set; }
    public bool IsLocal { get; set; }
    public string? LocalPath { get; set; }
    public string? StreamUrl { get; set; }
    public bool IsLiked { get; set; }      // Observable
    public bool IsPlaying { get; set; }     // Observable
}
```

### Album

```csharp
public class Album : INotifyPropertyChanged
{
    public string Id { get; set; }
    public string Title { get; set; }
    public string ArtistId { get; set; }
    public string ArtistName { get; set; }
    public string? CoverArtUrl { get; set; }
    public DateTime ReleaseDate { get; set; }
    public int TrackCount { get; set; }
    public AlbumType Type { get; set; }     // Album, Single, EP, Compilation
    public TimeSpan TotalDuration { get; set; }
    public bool IsSaved { get; set; }       // Observable
}
```

### Artist

```csharp
public class Artist : INotifyPropertyChanged
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string? ImageUrl { get; set; }
    public string? Bio { get; set; }
    public int MonthlyListeners { get; set; }
    public int FollowerCount { get; set; }
    public List<string> Genres { get; set; }
    public bool IsVerified { get; set; }
    public bool IsFollowed { get; set; }    // Observable
}
```

### Playlist

```csharp
public class Playlist : INotifyPropertyChanged
{
    public string Id { get; set; }
    public string Name { get; set; }        // Observable
    public string? Description { get; set; } // Observable
    public string? CoverImageUrl { get; set; } // Observable
    public string OwnerId { get; set; }
    public string OwnerName { get; set; }
    public int TrackCount { get; set; }
    public TimeSpan TotalDuration { get; set; }
    public bool IsPublic { get; set; }
    public bool IsCollaborative { get; set; }
    public int FollowerCount { get; set; }
}
```

---

## Build and Deployment

### Prerequisites

- .NET 8.0 SDK
- Visual Studio 2022 (17.0+) or VS Code with C# extensions
- Windows 10/11 (WPF requirement)

### NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| CommunityToolkit.Mvvm | 8.2.2 | MVVM infrastructure |
| Microsoft.Extensions.DependencyInjection | 8.0.1 | DI container |
| Microsoft.Extensions.Hosting | 8.0.1 | Application hosting |
| Microsoft.Xaml.Behaviors.Wpf | 1.1.122 | XAML behaviors |
| NAudio | 2.2.1 | Audio playback |
| Newtonsoft.Json | 13.0.3 | JSON serialization |
| System.Security.Cryptography.ProtectedData | 8.0.0 | Secure storage |
| Microsoft.Extensions.Http | 8.0.1 | HTTP client factory |

### Build Commands

```bash
# Restore dependencies
dotnet restore JubileeVibes.sln

# Build Debug
dotnet build JubileeVibes.sln -c Debug

# Build Release
dotnet build JubileeVibes.sln -c Release

# Run application
dotnet run --project JubileeVibes/JubileeVibes.csproj
```

### Output Directory

```
JubileeVibes/bin/Release/net8.0-windows/
├── JubileeVibes.exe
├── JubileeVibes.dll
├── JubileeVibes.Core.dll
├── JubileeVibes.Infrastructure.dll
├── NAudio.dll
├── Newtonsoft.Json.dll
└── ... (other dependencies)
```

---

## Future Enhancements

### Planned Features

1. **Music API Integration** - Replace `MockMusicCatalogService` with real API
2. **Offline Mode** - Download tracks for offline playback
3. **Lyrics Display** - Synchronized lyrics with playback
4. **Equalizer** - Audio EQ settings
5. **Crossfade** - Smooth transitions between tracks
6. **Gapless Playback** - Seamless album playback
7. **Keyboard Shortcuts** - Media key support
8. **System Tray** - Minimize to tray with controls
9. **Scrobbling** - Last.fm integration
10. **Social Features** - Share playlists, collaborative playlists

### Integration Points

- **JubileeVerse API** - User profiles, preferences sync
- **InspireContinuum** - Activity tracking, analytics
- **wwBibleweb IDNS** - Domain-based music discovery

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-01 | Initial release with core playback features |

---

## Authors

**Jubilee Enterprise**

- Application: JubileeVibes Music Player
- Architecture: WPF/.NET 8.0 with MVVM
- Audio Engine: NAudio

---

*Last Updated: January 2026*
