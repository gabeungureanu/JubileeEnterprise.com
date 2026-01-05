# Jubilee Browser

**Version 8.0.7** - A dual-mode WPF browser for navigating both the public Internet and JubileeVerse, a Scripture-centered digital environment.

## Overview

Jubilee Browser is a safe, Scripture-centered browser designed for families, churches, and schools. Built with .NET 8 and WPF using Microsoft Edge WebView2, it provides two distinct browsing modes with seamless switching and enterprise-grade deployment options.

## Key Features

### Dual-Mode Navigation
- **Internet Mode**: Full access to the public web with built-in content filtering
- **Jubilee Bible Mode**: Access to JubileeVerse.com and approved Scripture-centered content
- **Seamless Switching**: Toggle between modes with Ctrl+Shift+M
- **Unified Homepage**: Both modes start at www.jubileeverse.com

### Security & Protection
- **Built-in Content Filtering**: Blocklist system with 309,000+ blocked sites
- **Session Isolation**: Complete separation between browsing modes
- **WebView2 Runtime**: Powered by Microsoft Edge's secure rendering engine
- **HTTPS Indicators**: Clear visual security indicators in address bar

### Enterprise Deployment
- **MSI Installer**: Professional Windows Installer built with WiX Toolset v4
- **Silent Installation**: `msiexec /i JubileeBrowser-Setup-8.0.7.msi /quiet`
- **Self-Contained**: Includes .NET 8 runtime, no prerequisites needed
- **Per-Machine Install**: Installs to Program Files for all users
- **Auto Shortcuts**: Desktop and Start Menu shortcuts created automatically
- **Clean Upgrade**: Seamless upgrades from previous versions

### Professional Design
- **Modern WPF Interface**: Fluent Design-inspired UI
- **Chrome-Style Tabs**: Familiar tabbed browsing experience
- **Dark Theme**: Professional appearance with Scripture-centered design
- **Custom Branding**: Jubilee icon throughout the application

## Architecture

```
JubileeBrowser.com/
├── JubileeBrowser.WPF/           # WPF Browser Application
│   ├── JubileeBrowser/           # Main browser application
│   │   ├── MainWindow.xaml       # Main application window
│   │   ├── App.xaml              # Application entry point
│   │   ├── Services/             # Core services
│   │   │   ├── BlacklistManager.cs      # Content filtering
│   │   │   ├── TabManager.cs            # Tab state management
│   │   │   ├── ModeManager.cs           # Internet/Jubilee mode
│   │   │   ├── SessionStateManager.cs   # Session persistence
│   │   │   ├── InternalPageHandler.cs   # Internal page routing
│   │   │   └── WebViewBridge.cs         # WebView2 integration
│   │   ├── Controls/             # Custom WPF controls
│   │   ├── Resources/            # Icons and assets
│   │   └── Models/               # Data models
│   ├── JubileeBrowser.Installer/ # WiX installer project
│   │   └── Package.wxs           # WiX installer definition
│   ├── JubileeBrowser.UpdateAgent/ # Windows Service for updates
│   └── JubileeBrowser.sln        # Visual Studio solution
├── database/                     # PostgreSQL database scripts
│   ├── 001_create_database.sql   # Database creation
│   ├── 002_create_tables.sql     # Table definitions
│   ├── 003_create_indexes.sql    # Performance indexes
│   ├── 004_seed_data.sql         # Initial data
│   ├── 005_resolver_functions.sql # URL resolution functions
│   └── 006_hitcount_analytics.sql # Analytics functions
├── website/                      # Public website and downloads
│   ├── downloads/                # Installer hosting
│   ├── docs/                     # Documentation pages
│   └── *.html                    # Website pages
├── blacklist.yaml                # Content filtering rules
├── LICENSE.txt                   # MIT License
└── README.md                     # This file
```

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | Windows 10 (64-bit) | Windows 10/11 (64-bit) |
| **Processor** | 1 GHz dual-core | 2 GHz quad-core |
| **Memory** | 4 GB RAM | 8 GB RAM |
| **Disk Space** | 200 MB | 500 MB |
| **Runtime** | WebView2 Runtime | (Included with Windows 11) |

### WebView2 Runtime
Jubilee Browser requires the Microsoft Edge WebView2 Runtime. It is:
- Pre-installed on Windows 11
- Auto-installed on Windows 10 with recent updates
- Available at: https://developer.microsoft.com/microsoft-edge/webview2/

## Installation

### Download
Visit [https://jubileebrowser.com/download.html](https://jubileebrowser.com/download.html) to download the latest version.

### Standard Installation
1. Download `JubileeBrowser-Setup-8.0.7.msi` (~57 MB)
2. Double-click the installer
3. Follow the installation wizard
4. Launch Jubilee Browser from desktop or Start menu

### Silent Installation
For automated deployments:
```cmd
msiexec /i JubileeBrowser-Setup-8.0.7.msi /quiet
```

### Silent Installation with Custom Directory
```cmd
msiexec /i JubileeBrowser-Setup-8.0.7.msi /quiet INSTALLFOLDER="C:\Program Files\JubileeBrowser"
```

### Silent Installation with Logging
```cmd
msiexec /i JubileeBrowser-Setup-8.0.7.msi /quiet /log install.log
```

## Development

### Prerequisites
- **Visual Studio 2022** (Community or higher)
- **.NET 8 SDK**
- **WiX Toolset v4** (for building installer)
- **Windows 10/11** (for development)

### Setup
```powershell
# Clone repository
git clone https://github.com/yourorg/jubileebrowser.git
cd jubileebrowser

# Restore NuGet packages
dotnet restore JubileeBrowser.WPF/JubileeBrowser.sln

# Build solution
dotnet build JubileeBrowser.WPF/JubileeBrowser.sln --configuration Release
```

### Development Workflow
```powershell
# Build and run
dotnet run --project JubileeBrowser.WPF/JubileeBrowser/JubileeBrowser.csproj

# Build Release version
dotnet build JubileeBrowser.WPF/JubileeBrowser.sln -c Release

# Publish self-contained
dotnet publish JubileeBrowser.WPF/JubileeBrowser/JubileeBrowser.csproj `
    -c Release -r win-x64 --self-contained true `
    -o JubileeBrowser.WPF/publish
```

### Building the Installer

The installer is built using WiX Toolset v4 with automatic file harvesting:

```powershell
# Install WiX toolset (if not installed)
dotnet tool install --global wix

# Publish the application first
dotnet publish JubileeBrowser.WPF/JubileeBrowser/JubileeBrowser.csproj `
    -c Release -r win-x64 --self-contained true `
    -o JubileeBrowser.WPF/publish/JubileeBrowser-8.0.7

# Copy icon to publish folder (required for shortcuts)
mkdir -p JubileeBrowser.WPF/publish/JubileeBrowser-8.0.7/Resources/Icons
cp JubileeBrowser.WPF/JubileeBrowser/Resources/Icons/icon.ico `
   JubileeBrowser.WPF/publish/JubileeBrowser-8.0.7/Resources/Icons/

# Build the MSI installer
dotnet build JubileeBrowser.WPF/JubileeBrowser.Installer/JubileeBrowser.Installer.wixproj -c Release
```

The WiX project uses:
- **WixToolset.Sdk 4.0.5** - MSBuild SDK for WiX v4
- **WixToolset.Heat 4.0.5** - Automatic file harvesting

### Build Outputs
- **Installer**: `JubileeBrowser.WPF/JubileeBrowser.Installer/bin/x64/Release/JubileeBrowser-Setup-8.0.7.msi`
- **Published App**: `JubileeBrowser.WPF/publish/JubileeBrowser-8.0.7/`
- **Debug Build**: `JubileeBrowser.WPF/JubileeBrowser/bin/Debug/`

### Installer Package Details
| Property | Value |
|----------|-------|
| **Package Size** | ~57 MB |
| **Compression** | High (CAB embedded) |
| **Install Scope** | Per-machine (Program Files) |
| **UpgradeCode** | A1B2C3D4-E5F6-7890-ABCD-EF1234567890 |
| **Shortcuts** | Desktop + Start Menu |
| **Prerequisites** | WebView2 Runtime |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+T** | New tab |
| **Ctrl+W** | Close current tab |
| **Ctrl+Tab** | Switch to next tab |
| **Ctrl+Shift+Tab** | Switch to previous tab |
| **Ctrl+L** | Focus address bar |
| **Ctrl+R** / **F5** | Reload current page |
| **Alt+Left** | Go back |
| **Alt+Right** | Go forward |
| **Ctrl+Shift+M** | Toggle between Internet and Jubilee Bible modes |

## Content Filtering

The browser includes a comprehensive blocklist with 309,000+ domains covering:
- Adult content
- Malware and phishing
- Gambling
- Violence
- Other inappropriate content

### Blocklist Configuration
The blocklist is stored in `blacklist.yaml`:
```yaml
domains:
  - example-blocked-site.com
  - another-blocked.com

keywords:
  - inappropriate-term
```

## Database (WorldWideBibleWeb)

The browser integrates with a PostgreSQL database for private URL resolution:

### Setup
```powershell
# Run database setup script
.\database\run_db.ps1
```

### Tables
- **WebSpaceTypes**: Catalogs web space types (inspire, apostle, webspace)
- **DNS**: Maps private protocol URLs to public URLs
- **HitCount_Daily**: Analytics for URL access

### Resolver Functions
- `resolve_private_url()` - Resolves private URLs to public
- `reverse_resolve_url()` - Reverse lookup
- `list_dns_by_type()` - List all DNS entries

## Deployment for Organizations

### For Churches and Schools

**Silent MSI Installation**:
```cmd
msiexec /i JubileeBrowser-Setup-8.0.7.msi /quiet /log install.log
```

**Group Policy Deployment**:
1. Copy MSI to network share (e.g., `\\server\software\`)
2. Create GPO linked to target OU
3. Add MSI under Computer Configuration > Policies > Software Settings > Software Installation
4. Computers install on next restart

**SCCM/Intune Deployment**:
- Use the MSI with standard deployment settings
- Self-contained - no prerequisites needed
- Per-machine installation for all users

### For Families
- Download and install from website
- No technical expertise required
- Built-in protection by design

## Troubleshooting

### Browser Won't Start
1. Verify WebView2 Runtime is installed
2. Check Event Viewer for application errors
3. Run as Administrator to diagnose permission issues

### WebView2 Not Found
1. Download from: https://developer.microsoft.com/microsoft-edge/webview2/
2. Install the Evergreen Bootstrapper
3. Restart Jubilee Browser

### Content Not Blocking
1. Verify `blacklist.yaml` exists in installation directory
2. Check blocklist format is valid YAML
3. Restart browser after blocklist changes

## Version History

- **8.0.7** - Professional MSI installer with WiX Toolset v4, desktop/Start Menu shortcuts
- **8.0.6** - WPF-only release, removed Electron version
- **8.0.5** - Documentation updates
- **8.0.4** - WPF application with WebView2, profile management
- **8.0.3** - Database integration, private URL resolution

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## Project Structure

| Folder | Description |
|--------|-------------|
| `JubileeBrowser.WPF/` | Main WPF browser application |
| `database/` | PostgreSQL schema and scripts |
| `website/` | Public website and downloads |
| `docs/` | Technical documentation |

## Contributing

This project is maintained by Jubilee Software, Inc. For bug reports and feature requests, please contact support@jubileebrowser.com.

## License

MIT License

Copyright (c) 2024 Jubilee Software, Inc.

## Support

- **Website**: https://jubileebrowser.com
- **Email**: support@jubileebrowser.com
- **Documentation**: https://jubileebrowser.com/docs
- **Downloads**: https://jubileebrowser.com/download.html

---

**Technology that honors Scripture, protects families, and serves the Church.**
