# Jubilee Flywheel

A comprehensive data visualization dashboard for real-time market data and analytics with GPU-accelerated charting.

## Features

### Core Functionality
- **Dashboard View**: Customizable widget grid with multiple chart types
- **Data Grid View**: Fetch, filter, and export API data
- **API Configuration**: Manage external API endpoints with auto-refresh
- **Real-time Updates**: Auto-refresh data at configurable intervals

### Advanced Charting (v1.1.0+)
- **GPU-Accelerated Rendering**: SkiaSharp-based high-performance charts
- **TradeStation-Style RadarScreen**: Real-time symbol monitoring grid
- **Candlestick Charts**: OHLC visualization with volume overlay
- **Technical Indicators**: Comprehensive indicator system with manager UI
  - Moving Averages (SMA, EMA, WMA)
  - Momentum indicators (RSI, MACD, Stochastic)
  - Volume indicators
  - Volatility bands (Bollinger Bands)

### UI/UX
- **Modern Dark Theme**: Professional trading-style interface
- **Left-Aligned Tab Navigation**: Improved layout with unified header
- **Chromeless Window Mode**: Borderless window for embedded displays
- **Custom Scrollbars**: Modern scrollbar styling
- **Window State Persistence**: Remembers size and position

## Widget Types

- Line Charts
- Bar Charts
- Pie Charts
- Area Charts
- Candlestick Charts (OHLC)
- Gauges
- KPI Cards
- Data Grids
- RadarScreen Grid

## Technology Stack

- .NET 8.0
- WPF (Windows Presentation Foundation)
- SkiaSharp for GPU-accelerated rendering
- LiveCharts2 for standard charting
- CommunityToolkit.Mvvm for MVVM pattern
- Fluent.Ribbon for ribbon interface
- Newtonsoft.Json for JSON handling
- Microsoft.Extensions.DependencyInjection for DI

## Getting Started

### Prerequisites

- .NET 8.0 SDK
- Visual Studio 2022 or later
- Windows 10/11 (64-bit)

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

Or use the launch command:
```bash
cd applications/JubileeFlywheel.wpf/JubileeFlywheel.WPF/JubileeFlywheel
dotnet run
```

## Project Structure

```
JubileeFlywheel.WPF/
├── JubileeFlywheel/
│   ├── Charts/            # GPU-accelerated charting components
│   │   ├── ChartRenderEngine.cs
│   │   ├── SkiaChartControl.cs
│   │   └── Indicators/    # Technical indicators
│   ├── Controls/          # Custom controls and template selectors
│   ├── Converters/        # Value converters
│   ├── Helpers/           # Utility classes
│   ├── Models/            # Data models (OHLC, indicators)
│   ├── Services/          # Business logic and API services
│   ├── ViewModels/        # MVVM ViewModels
│   ├── Views/             # User controls
│   │   ├── RadarScreenView.xaml
│   │   ├── TechnicalIndicatorsManagerView.xaml
│   │   └── ...
│   └── Resources/         # Icons and fonts
└── JubileeFlywheel.sln
```

## Configuration

Settings are stored in:
`%LOCALAPPDATA%\JubileeFlywheel\settings.json`

Window state (size/position) is persisted automatically.

## Changelog

### Version 1.1.0 (2026-01-11)
- Added GPU-accelerated chart system using SkiaSharp
- Added comprehensive technical indicators with manager UI
- Added TradeStation-style RadarScreen view
- Added chromeless window mode
- Fixed null reference crash on startup in SkiaChartControl
- Added window state persistence with 800x600 default size
- UI rebrand with left-aligned tabs and modern scrollbars

### Version 1.0.0 (2026-01-10)
- Initial release
- Dashboard with customizable widgets
- Data grid view with filtering
- API configuration management
- Real-time auto-refresh

## License

Copyright 2024-2026 Jubilee Solutions
