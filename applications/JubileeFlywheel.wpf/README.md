# Jubilee Flywheel

A comprehensive data visualization dashboard for external API data.

## Features

- **Dashboard View**: Customizable widget grid with multiple chart types
- **Data Grid View**: Fetch, filter, and export API data
- **API Configuration**: Manage external API endpoints with auto-refresh
- **Real-time Updates**: Auto-refresh data at configurable intervals

## Widget Types

- Line Charts
- Bar Charts
- Pie Charts
- Area Charts
- Gauges
- KPI Cards
- Data Grids

## Technology Stack

- .NET 8.0
- WPF (Windows Presentation Foundation)
- LiveCharts2 for charting
- CommunityToolkit.Mvvm for MVVM pattern
- Newtonsoft.Json for JSON handling

## Getting Started

### Prerequisites

- .NET 8.0 SDK
- Visual Studio 2022 or later

### Build

```bash
cd applications/JubileeFlywheel.wpf/JubileeFlywheel.WPF
dotnet restore
dotnet build
```

### Run

```bash
dotnet run --project JubileeFlywheel/JubileeFlywheel.csproj
```

## Project Structure

```
JubileeFlywheel.WPF/
├── JubileeFlywheel/
│   ├── Controls/          # Custom controls and template selectors
│   ├── Converters/        # Value converters
│   ├── Helpers/           # Utility classes
│   ├── Models/            # Data models
│   ├── Services/          # Business logic and API services
│   ├── ViewModels/        # MVVM ViewModels
│   ├── Views/             # User controls
│   └── Resources/         # Icons and fonts
└── JubileeFlywheel.sln
```

## Configuration

Settings are stored in:
`%LOCALAPPDATA%\JubileeFlywheel\settings.json`

## License

Copyright 2024-2026 Jubilee Solutions
