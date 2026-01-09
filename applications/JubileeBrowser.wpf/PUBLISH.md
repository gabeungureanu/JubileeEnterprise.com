# JubileeBrowser WPF Publish Process

This document describes the steps to build, package, and publish JubileeBrowser as an MSI installer.

## Prerequisites

- .NET 8 SDK installed
- WiX Toolset 4.0.5 (installed via NuGet packages in the installer project)
- Windows 10/11 64-bit development machine

## Directory Structure

```
applications/JubileeBrowser.wpf/
├── JubileeBrowser.WPF/
│   ├── JubileeBrowser/           # Main WPF application
│   ├── JubileeBrowser.Shared/    # Shared library
│   └── JubileeBrowser.Installer/ # WiX MSI installer project
├── publish/
│   └── JubileeBrowser-X.X.X/     # Published application files
└── PUBLISH.md                    # This file
```

## Publish Steps

### Step 1: Build and Publish the Application

Navigate to the JubileeBrowser project and publish for win-x64:

```powershell
cd "c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser"

dotnet publish -c Release -r win-x64 --self-contained true -o "..\..\publish\JubileeBrowser-8.0.8"
```

**Important:** The output directory must match the version number in `JubileeBrowser.Installer.wixproj`.

### Step 2: Update Version in Installer Project (if version changed)

Edit `JubileeBrowser.Installer/JubileeBrowser.Installer.wixproj`:

```xml
<DefineConstants>SourceDir=..\..\publish\JubileeBrowser-X.X.X\</DefineConstants>
<OutputName>JubileeBrowser-Setup-X.X.X</OutputName>
```

Also update the `HarvestDirectory` and `BindPath`:
```xml
<HarvestDirectory Include="..\..\publish\JubileeBrowser-X.X.X">
<BindPath Include="..\..\publish\JubileeBrowser-X.X.X" />
```

### Step 3: Build the MSI Installer

```powershell
cd "c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser.Installer"

dotnet build -c Release
```

The MSI will be created at:
```
JubileeBrowser.Installer\bin\x64\Release\JubileeBrowser-Setup-X.X.X.msi
```

### Step 4: Copy MSI to Website Downloads Folder

```powershell
cp 'c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser.Installer\bin\x64\Release\JubileeBrowser-Setup-8.0.7.msi' 'c:\data\JubileeEnterprise.com\websites\codex\JubileeBrowser.com\downloads\'
```

### Step 5: Update Website Files

#### 5a. Update latest.yml

Generate hashes:
```bash
sha512sum downloads/JubileeBrowser-Setup-X.X.X.msi
sha256sum downloads/JubileeBrowser-Setup-X.X.X.msi
stat -c%s downloads/JubileeBrowser-Setup-X.X.X.msi
```

Update `downloads/latest.yml`:
- Update `sha512` with new hash
- Update `sha256` with new hash (uppercase)
- Update `size` with file size in bytes
- Update `releaseNotes` with new features
- Update `releaseDate` with current ISO date

#### 5b. Update Download Pages

Files to update:
- `index.html` - Download button link (line ~327)
- `download.html` - Version and file size (line ~71)

### Step 6: Verify

1. Check MSI exists in downloads folder
2. Verify file size matches
3. Test download link works
4. Optionally test installation on clean machine

## Quick Reference Commands

```powershell
# Full publish workflow
cd "c:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\JubileeBrowser.WPF\JubileeBrowser"
dotnet publish -c Release -r win-x64 --self-contained true -o "..\..\publish\JubileeBrowser-8.0.8"

cd "..\JubileeBrowser.Installer"
dotnet build -c Release

cp 'bin\x64\Release\JubileeBrowser-Setup-8.0.8.msi' 'c:\data\JubileeEnterprise.com\websites\codex\JubileeBrowser.com\downloads\'
```

## File Sizes Reference

- Published folder: ~150-180 MB (all runtime files)
- MSI installer: ~59 MB (compressed)
- Installed application: ~180 MB

## Notes

- The WiX project uses `HarvestDirectory` to automatically collect all files from the publish folder
- Self-contained deployment includes .NET runtime, so users don't need to install .NET separately
- The MSI supports silent installation via `msiexec /i JubileeBrowser-Setup-X.X.X.msi /quiet`
