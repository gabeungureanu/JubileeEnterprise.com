# Jubilee Tasks - VS Code Extension

Automated developer task tracking for Jubilee Enterprise. This extension monitors developer activity and integrates with the InspireCodex API to track tasks with time management.

## Features

- **Task Tracker Panel**: View all developer tasks in a dedicated sidebar panel
- **Time Tracking**: Tracks active working time with 20-minute inactivity threshold
- **API Integration**: Connects to InspireCodex API on port 3100
- **Auto-refresh**: Automatically refreshes task list every 30 seconds
- **GPT-4o Task Titles**: Generates concise task titles using OpenAI (optional)

## Installation

### Option 1: Install from VSIX file

1. Open VS Code
2. Press `Ctrl+Shift+P` to open Command Palette
3. Type "Extensions: Install from VSIX..."
4. Navigate to this folder and select `jubilee-tasks-1.0.0.vsix`
5. Reload VS Code when prompted

### Option 2: Command Line Installation

```bash
code --install-extension path/to/jubilee-tasks-1.0.0.vsix
```

Then reload VS Code.

## Configuration

The extension can be configured via VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `jubileeTasks.apiBaseUrl` | `http://localhost:3100` | Base URL for the InspireCodex API |
| `jubileeTasks.inactivityThresholdMinutes` | `20` | Minutes of inactivity before time is excluded |
| `jubileeTasks.autoRefreshIntervalSeconds` | `30` | Auto-refresh interval for task grid |

## Requirements

- VS Code 1.80.0 or higher
- InspireCodex API running on configured port (default: 3100)
- PostgreSQL database with developer_tasks and developer_projects tables

## Usage

1. Click the Jubilee Tasks icon in the Activity Bar (left sidebar)
2. View your tasks in the Task Tracker panel
3. Use the Refresh button to manually refresh the task list
4. Set your developer initials: `Ctrl+Shift+P` → "Jubilee: Set Developer Initials"

## Commands

- `Jubilee: Show Task Panel` - Open the Task Tracker panel
- `Jubilee: Refresh Tasks` - Manually refresh the task list
- `Jubilee: Set Developer Initials` - Set your 2-3 letter developer initials
- `Jubilee: Complete Current Task` - Mark the current task as complete

## Building from Source

```bash
cd extensions/jubilee-tasks
npm install
npm run compile
npm run package
```

This creates a new `jubilee-tasks-1.0.0.vsix` file.

## Version History

### 1.0.0
- Initial release
- Task Tracker panel with grid view
- InspireCodex API integration
- Activity monitoring with inactivity threshold
- Developer initials management
- GPT-4o task title generation (optional)

## Support

For issues or questions, contact the Jubilee Enterprise development team.
