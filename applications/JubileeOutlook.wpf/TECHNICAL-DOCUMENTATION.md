# JubileeOutlook Email Client - Technical Documentation

## Overview

JubileeOutlook is a modern, Microsoft Outlook-inspired desktop email client built with **WPF (Windows Presentation Foundation)** and **.NET 9.0**. The application features a pure black theme with gold accents, following the JubileeVerse brand aesthetic. It implements taskbar-aware window management, persistent layout state, and an animated accent bar matching the JubileeVerse visual identity.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Window Management](#window-management)
5. [UI Layout System](#ui-layout-system)
6. [Authentication](#authentication)
7. [Theme System](#theme-system)
8. [Animated Accent Bar](#animated-accent-bar)
9. [State Persistence](#state-persistence)
10. [Build and Deployment](#build-and-deployment)

---

## Architecture

### Design Pattern: MVVM (Model-View-ViewModel)

JubileeOutlook implements the **MVVM pattern** using the **CommunityToolkit.Mvvm** library for:
- Observable properties with `[ObservableProperty]` attribute
- Commands with `[RelayCommand]` attribute
- Automatic property change notifications

### Single Project Architecture

```
JubileeOutlook.wpf/
└── JubileeOutlook/           # Main Application Project
    ├── Controls/             # Reusable UI Controls
    ├── Helpers/              # Converters and Utilities
    ├── Models/               # Data Models
    ├── Resources/            # Fonts and Icons
    ├── Services/             # Application Services
    ├── Themes/               # XAML Themes and Styles
    └── ViewModels/           # ViewModels (MVVM)
```

---

## Project Structure

### JubileeOutlook (Main Application)

```
JubileeOutlook/
├── App.xaml(.cs)               # Application entry point & resource loading
├── MainWindow.xaml(.cs)        # Main application window
├── Controls/
│   ├── AppRailControl.xaml     # Vertical navigation rail
│   └── AppRailControl.xaml.cs
├── Helpers/
│   └── AppModuleToBoolConverter.cs  # Module visibility converter
├── Models/
│   ├── AppModule.cs            # Application module enum
│   ├── AuthModels.cs           # Authentication data models
│   ├── Email.cs                # Email message model
│   └── MailFolder.cs           # Mail folder model with IsSelected
├── Resources/
│   ├── Fonts/
│   │   ├── MaterialSymbolsOutlined.ttf  # Material icons
│   │   ├── Roboto-Bold.ttf
│   │   ├── Roboto-Light.ttf
│   │   ├── Roboto-Medium.ttf
│   │   └── Roboto-Regular.ttf
│   └── Icons/
│       └── jubilee-profile.png  # Profile placeholder
├── Services/
│   ├── AuthenticationManager.cs     # Jubilee SSO integration
│   ├── MockMailService.cs           # Mock email data service
│   └── SecureStorageService.cs      # DPAPI secure storage
├── Themes/
│   └── DarkTheme.xaml          # Pure black theme with gold accents
└── ViewModels/
    ├── ApplicationViewModel.cs  # App-level state (modules, auth)
    └── MainViewModel.cs         # Mail-specific state
```

---

## Core Components

### MainWindow

The main application window (`MainWindow.xaml.cs`) handles:

1. **Win32 Interop** - Taskbar-aware maximize behavior
2. **Window State Persistence** - Position, size, and panel widths
3. **Authentication UI** - Sign-in/sign-out modal dialogs
4. **Module Navigation** - Mail, Calendar, People, Tasks, More Apps
5. **Animated Accent Bar** - JubileeVerse-style gold wave animation

#### Key Regions:

| Region | Description |
|--------|-------------|
| `Win32 Interop for Taskbar-Aware Maximize` | P/Invoke declarations for monitor info |
| `Win32 Message Processing` | WM_GETMINMAXINFO handling |
| `Window State Event Handlers` | LocationChanged, SizeChanged, StateChanged |
| `Window State Persistence` | Save/Restore JSON state file |
| `Animated Accent Bar` | Storyboard-based animation |
| `New Message Split Button` | Split-button click handlers |
| `Authentication Dialogs` | Sign-in/Sign-up modal UI |

### AppRailControl

Vertical navigation rail (`Controls/AppRailControl.xaml`) providing:
- Module switching (Mail, Calendar, People, Tasks, More)
- Brand logo at top
- Profile button at bottom
- Gold highlight for active module

### ViewModels

#### ApplicationViewModel

Manages application-level state:
```csharp
public partial class ApplicationViewModel : ObservableObject
{
    [ObservableProperty]
    private AppModule _currentModule = AppModule.Mail;

    [ObservableProperty]
    private bool _isAuthenticated;

    [RelayCommand]
    private void NavigateTo(AppModule module);
}
```

#### MainViewModel

Manages mail-specific state:
```csharp
public partial class MainViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<MailFolder> _folders;

    [ObservableProperty]
    private MailFolder? _selectedFolder;

    [ObservableProperty]
    private ObservableCollection<Email> _messages;

    [ObservableProperty]
    private Email? _selectedMessage;

    partial void OnSelectedFolderChanged(MailFolder? oldValue, MailFolder? newValue);
}
```

---

## Window Management

### Taskbar-Aware Maximize

JubileeOutlook implements Win32 interop to ensure the window maximizes to the **work area** (excluding taskbar) rather than full screen:

```csharp
private const int WM_GETMINMAXINFO = 0x0024;

[DllImport("user32.dll")]
private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

[DllImport("user32.dll")]
private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);
```

#### Implementation Flow:

1. **SourceInitialized** - Hook into Win32 message loop
2. **WindowProc** - Intercept `WM_GETMINMAXINFO` message
3. **WmGetMinMaxInfo** - Set maximized size to `rcWork` (work area)

```csharp
private void WmGetMinMaxInfo(IntPtr hwnd, IntPtr lParam)
{
    var mmi = Marshal.PtrToStructure<MINMAXINFO>(lParam);
    var monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);

    if (GetMonitorInfo(monitor, ref monitorInfo))
    {
        var workArea = monitorInfo.rcWork;
        mmi.ptMaxPosition.x = workArea.Left - monitorArea.Left;
        mmi.ptMaxPosition.y = workArea.Top - monitorArea.Top;
        mmi.ptMaxSize.x = workArea.Right - workArea.Left;
        mmi.ptMaxSize.y = workArea.Bottom - workArea.Top;
    }

    Marshal.StructureToPtr(mmi, lParam, true);
}
```

### Multi-Monitor Support

The window correctly maximizes on any monitor, respecting:
- Taskbar position (bottom, top, left, right)
- Different taskbar sizes
- Multi-monitor DPI scaling

---

## UI Layout System

### Main Grid Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [AppRail]  │  [Title Bar - Tabs: Home, Send/Receive, View]  │
│  (48px)    ├────────────────────────────────────────────────┤
│            │  [Ribbon Content - Tab-specific tools]          │
│  - Mail    ├────────────────────────────────────────────────┤
│  - Calendar│  [Content Area]                                 │
│  - People  │  ┌──────────┬──────────┬────────────────────┐  │
│  - Tasks   │  │ Folders  │ Messages │ Reading Pane       │  │
│  - More    │  │ (250px)  │ (400px)  │ (*)                │  │
│            │  └──────────┴──────────┴────────────────────┘  │
│  [Profile] ├────────────────────────────────────────────────┤
│            │  [Status Bar - Item count, Connection status]   │
├────────────┴────────────────────────────────────────────────┤
│  [Animated Gold Accent Bar - 5px]                            │
└─────────────────────────────────────────────────────────────┘
```

### Panel Columns

| Column | Name | Default Width | Min Width | Purpose |
|--------|------|---------------|-----------|---------|
| 0 | FolderPaneColumn | 250px | 150px | Folder navigation tree |
| 1 | (Auto) | - | - | GridSplitter |
| 2 | MessageListColumn | 400px | 200px | Email list |
| 3 | (Auto) | - | - | GridSplitter |
| 4 | Reading Pane | * | 300px | Email preview |

### GridSplitter Behavior

Two GridSplitters allow resizing:
- Between Folders and Messages
- Between Messages and Reading Pane

Panel widths are persisted across sessions.

---

## Authentication

### AuthenticationManager

Integrates with **Jubilee SSO** (Single Sign-On):

- **SSO Endpoint**: `https://sso.worldwidebibleweb.org/api`
- **Client**: HttpClient with JSON content type

#### Authentication Flow:

1. **InitializeAsync** - Restore session from secure storage
2. **SignInAsync** - POST `/auth/login` with credentials
3. **RegisterAsync** - POST `/auth/register` for new accounts
4. **SignOutAsync** - POST `/auth/logout` and clear storage
5. **RequestPasswordResetAsync** - POST `/auth/forgot-password`

#### Auth Models:

```csharp
public class AuthSession
{
    public bool IsAuthenticated { get; set; }
    public AuthState State { get; set; }
    public UserProfile? Profile { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class UserProfile
{
    public string Id { get; set; }
    public string Email { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string? AvatarUrl { get; set; }
}
```

### SecureStorageService

Uses `System.Security.Cryptography.ProtectedData` (DPAPI) for:
- Encrypting tokens at rest
- Windows user-scoped protection
- Automatic key management

---

## Theme System

### DarkTheme.xaml

Pure black theme with JubileeVerse gold accents:

#### Colors:

```xaml
<!-- Backgrounds -->
<Color x:Key="PrimaryBackgroundColor">#000000</Color>
<Color x:Key="SecondaryBackgroundColor">#0D0D0D</Color>
<Color x:Key="TertiaryBackgroundColor">#1A1A1A</Color>

<!-- Text -->
<Color x:Key="PrimaryTextColor">#FFFFFF</Color>
<Color x:Key="SecondaryTextColor">#B3B3B3</Color>

<!-- Brand Accent (Gold) -->
<Color x:Key="GoldBrandColor">#E6AC00</Color>
<Color x:Key="GoldBrandHoverColor">#FFD700</Color>
<Color x:Key="GoldBrandLightColor">#33E6AC00</Color>
```

#### Font Resources:

```xaml
<FontFamily x:Key="RobotoFont">pack://application:,,,/Resources/Fonts/#Roboto</FontFamily>
<FontFamily x:Key="MaterialIcons">pack://application:,,,/Resources/Fonts/#Material Symbols Outlined</FontFamily>
```

### Custom Control Styles

| Style | Target | Description |
|-------|--------|-------------|
| `GoldDropdownButtonStyle` | ToggleButton | Gold split-button with dropdown |
| `ProfileMenuItemStyle` | Button | Profile popup menu items |
| `TabHeaderStyle` | Border | Ribbon tab headers |
| `ToolButtonStyle` | Button | Ribbon tool buttons |

---

## Animated Accent Bar

### Design

Replicates the **JubileeVerse sign-in page** wave animation:
- 5px height bar at bottom of window
- Dark gray background (`#444444`)
- Gold gradient sweep moving left-to-right
- 2.5 second animation cycle
- Infinite loop with smooth restart

### Implementation

#### XAML Structure:

```xaml
<Border x:Name="AccentBarContainer"
        Grid.Row="1" Grid.Column="0" Grid.ColumnSpan="2"
        Height="5"
        Background="#444444"
        ClipToBounds="True">
    <Border x:Name="GoldLightSweep"
            Width="600"
            Height="5"
            HorizontalAlignment="Left">
        <Border.RenderTransform>
            <TranslateTransform x:Name="GoldLightTransform" X="-600"/>
        </Border.RenderTransform>
        <Border.Background>
            <LinearGradientBrush StartPoint="0,0.5" EndPoint="1,0.5">
                <GradientStop Color="Transparent" Offset="0"/>
                <GradientStop Color="#805f3a00" Offset="0.1"/>
                <GradientStop Color="#f0ad4e" Offset="0.3"/>
                <GradientStop Color="#ffcc00" Offset="0.5"/>
                <GradientStop Color="#f0ad4e" Offset="0.7"/>
                <GradientStop Color="#805f3a00" Offset="0.9"/>
                <GradientStop Color="Transparent" Offset="1"/>
            </LinearGradientBrush>
        </Border.Background>
    </Border>
</Border>
```

#### Code-Behind Animation:

```csharp
private void StartAccentBarAnimation()
{
    _accentBarStoryboard = new Storyboard
    {
        RepeatBehavior = RepeatBehavior.Forever
    };

    var animation = new DoubleAnimation
    {
        From = -600,
        To = ActualWidth + 100,
        Duration = TimeSpan.FromSeconds(2.5),
        EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
    };

    Storyboard.SetTargetName(animation, "GoldLightTransform");
    Storyboard.SetTargetProperty(animation, new PropertyPath(TranslateTransform.XProperty));

    _accentBarStoryboard.Children.Add(animation);
    _accentBarStoryboard.Begin(this, true);
}
```

#### Window Resize Handling:

Animation endpoint recalculates on window resize to maintain full coverage:

```csharp
private void UpdateAccentBarAnimation(object sender, SizeChangedEventArgs e)
{
    _accentBarStoryboard.Stop(this);
    // Recreate animation with new ActualWidth
    StartAccentBarAnimation();
}
```

---

## State Persistence

### WindowStateData Model

```csharp
public class WindowStateData
{
    public double Left { get; set; }
    public double Top { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public bool IsMaximized { get; set; }
    public bool IsFirstRun { get; set; } = true;

    // Panel layout state
    public double FolderPaneWidth { get; set; } = 250;
    public double MessageListWidth { get; set; } = 400;
}
```

### Storage Location

```
%LocalAppData%\JubileeOutlook\windowstate.json
```

### Save/Restore Logic

**Save** (on window close and state change):
```csharp
private void SaveWindowState()
{
    var state = new WindowStateData
    {
        Left = RestoreBounds.Left,
        Top = RestoreBounds.Top,
        Width = RestoreBounds.Width,
        Height = RestoreBounds.Height,
        IsMaximized = WindowState == WindowState.Maximized,
        IsFirstRun = false,
        FolderPaneWidth = FolderPaneColumn.Width.Value,
        MessageListWidth = MessageListColumn.Width.Value
    };

    IOFile.WriteAllText(WindowStateFilePath, JsonSerializer.Serialize(state));
}
```

**Restore** (on startup):
- Validates coordinates are within visible screen bounds
- Clamps to work area if window would be off-screen
- Restores maximized state while preserving normal bounds
- First run defaults to centered on screen

---

## Build and Deployment

### Prerequisites

- .NET 9.0 SDK
- Visual Studio 2022 (17.0+) or VS Code with C# extensions
- Windows 10/11 (WPF requirement)

### NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| CommunityToolkit.Mvvm | 8.4.0 | MVVM infrastructure |
| Microsoft.Extensions.DependencyInjection | 9.0.0 | DI container |
| Fluent.Ribbon | 10.1.0 | Ribbon control (referenced) |

### Build Commands

```bash
# Restore dependencies
dotnet restore JubileeOutlook.csproj

# Build Debug
dotnet build JubileeOutlook.csproj -c Debug

# Build Release
dotnet build JubileeOutlook.csproj -c Release

# Run application
dotnet run --project JubileeOutlook.csproj
```

### Output Directory

```
JubileeOutlook/bin/Release/net9.0-windows/
├── JubileeOutlook.exe
├── JubileeOutlook.dll
├── CommunityToolkit.Mvvm.dll
├── Microsoft.Extensions.DependencyInjection.dll
└── ... (other dependencies)
```

---

## Split-Button Implementation

### New Mail Split-Button

The "New Mail" button uses a split-button pattern:

```
┌─────────────────────────────────────┐
│  [Mail Icon] New Mail  │  [▼]      │
│  (Primary Action)      │ (Dropdown)│
└─────────────────────────────────────┘
```

#### Structure:

```xaml
<Grid x:Name="NewMailSplitButton">
    <!-- Primary Action Button -->
    <Button x:Name="NewMailPrimaryButton" Click="NewMailPrimaryButton_Click">
        <StackPanel Orientation="Horizontal">
            <TextBlock Text="&#xE158;" FontFamily="{StaticResource MaterialIcons}"/>
            <TextBlock Text="New Mail" FontWeight="Bold"/>
        </StackPanel>
    </Button>

    <!-- Dropdown Trigger -->
    <ToggleButton x:Name="NewDropdownButton">
        <Rectangle Width="1" Fill="#555555"/>  <!-- Separator -->
        <TextBlock Text="&#xe5c5;"/>  <!-- Arrow icon -->
    </ToggleButton>

    <!-- Dropdown Popup -->
    <Popup IsOpen="{Binding IsChecked, ElementName=NewDropdownButton}">
        <!-- New Mail, New Meeting options -->
    </Popup>
</Grid>
```

#### Click Handlers:

- **Primary Button** - Executes `NewMessageCommand` immediately
- **Dropdown Arrow** - Opens popup with menu options
- **Menu Items** - Execute respective commands and close popup

---

## Folder Selection

### Full-Width Gold Highlight

Folder selection displays a gold highlight extending to panel edges:

```xaml
<Border x:Name="FolderItemBorder"
        BorderThickness="0"
        CornerRadius="0"
        Padding="26,8,10,8"
        Margin="0,1">
    <Border.Style>
        <Style TargetType="Border">
            <Setter Property="Background" Value="Transparent"/>
            <Style.Triggers>
                <DataTrigger Binding="{Binding IsSelected}" Value="True">
                    <Setter Property="Background" Value="{StaticResource GoldBrandLightBrush}"/>
                </DataTrigger>
            </Style.Triggers>
        </Style>
    </Border.Style>
</Border>
```

### IsSelected Management

Selection state managed via partial method:

```csharp
partial void OnSelectedFolderChanged(MailFolder? oldValue, MailFolder? newValue)
{
    if (oldValue != null)
        oldValue.IsSelected = false;

    if (newValue != null)
    {
        newValue.IsSelected = true;
        _ = LoadMessagesAsync(newValue.Id);
    }
}
```

---

## Future Enhancements

### Planned Features

1. **IMAP/SMTP Integration** - Real email sending/receiving
2. **Calendar Module** - Full calendar implementation
3. **Contacts Module** - Address book with sync
4. **Search** - Full-text email search
5. **Rules** - Email filtering rules
6. **Offline Mode** - Local email cache
7. **Notifications** - System tray notifications
8. **Signatures** - Email signature management
9. **Templates** - Email templates
10. **Themes** - Light theme option

### Integration Points

- **JubileeVerse API** - User profiles, preferences sync
- **InspireCodex API** - Email backend integration
- **wwBibleweb IDNS** - Domain-based email routing

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-01 | Initial release with core email UI |
| 1.1.0 | 2026-01 | Added split-button, window state persistence, animated accent bar |

---

## Authors

**Jubilee Enterprise**

- Application: JubileeOutlook Email Client
- Architecture: WPF/.NET 9.0 with MVVM
- Theme: Pure Black with Gold Accents (JubileeVerse)

---

*Last Updated: January 2026*
