# Jubilee Tasks - VS Code Extension

Automated developer task tracking for Jubilee Enterprise. This extension monitors developer activity via Claude Code hooks and integrates with the InspireCodex API to track tasks with time management and EHH (Equivalent Human Hours) estimation.

## Features

- **Task Tracker Panel**: View all developer tasks in a dedicated sidebar panel grouped by date
- **Inline Developer Initials**: Persistent inline input for developer initials (no pop-ups)
- **Smart Task Detection**: Automatically detects new tasks vs troubleshooting/continuation
- **Manual Task Completion**: Tasks complete only when you say "Done" (no auto-close)
- **Clickable In-Progress Tasks**: Click any "in progress" status to manually complete with custom duration/EHH
- **Time Tracking**: Tracks active working time with minimum 1-minute duration
- **EHH Estimation**: Automatic equivalent human hours estimation using GPT-4o-mini
- **API Integration**: Connects to InspireCodex API (default: https://www.inspirecodex.com)
- **Auto-refresh**: Automatically refreshes task list every 30 seconds

## Installation

### Option 1: Install from VSIX file

1. Open VS Code
2. Press `Ctrl+Shift+P` to open Command Palette
3. Type "Extensions: Install from VSIX..."
4. Navigate to this folder and select `jubilee-tasks-1.0.0.vsix`
5. Reload VS Code when prompted

### Option 2: Command Line Installation

```bash
code --install-extension path/to/jubilee-tasks-1.0.0.vsix --force
```

Then reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window").

## Configuration

The extension can be configured via VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `jubileeTasks.apiBaseUrl` | `https://www.inspirecodex.com` | Base URL for the InspireCodex API |
| `jubileeTasks.inactivityThresholdMinutes` | `20` | Minutes of inactivity before time is excluded |
| `jubileeTasks.autoRefreshIntervalSeconds` | `30` | Auto-refresh interval for task grid |

## Requirements

- VS Code 1.80.0 or higher
- Internet connection to access InspireCodex API (or local API for development)
- Claude Code with hooks enabled (for automatic task tracking)

## Usage

### Initial Setup
1. Click the Jubilee Tasks icon in the Activity Bar (left sidebar)
2. Enter your 2-letter developer initials in the inline input at the bottom
3. Click Submit - initials are cached for 1 year

### Task Workflow
1. **Start a task**: Simply begin working - a task is created on your first prompt
2. **Continue working**: Fix requests, troubleshooting, and updates stay on the same task
3. **Complete a task**: Say "Done" when finished - the task will be marked complete
4. **Manual completion**: Click any orange "in progress" link to manually complete with custom values

### Task Detection Logic

**Commands that COMPLETE a task:**
- "Done", "done.", "task done", "mark as done"
- "finished", "complete", "close task"

**Commands that CONTINUE the current task (no new task):**
- "fix", "please fix", "update", "not working"
- "error", "bug", "issue", "problem"
- "try again", "redo", "check", "debug"
- "why is...", "what went wrong", "still not..."

**Commands that CREATE a new task:**
- "create", "build", "add", "implement", "make"
- "let's create...", "now work on...", "start..."
- "I want to...", "I need you to..."
- "next...", "new feature..."

## Commands

- `Jubilee: Show Task Panel` - Open the Task Tracker panel
- `Jubilee: Refresh Tasks` - Manually refresh the task list
- `Jubilee: Set Developer Initials` - Reset and re-enter your initials
- `Jubilee: Complete Current Task` - Mark the current task as complete

## Task Panel Features

### Header
- Shows "Developer Tasks (XX)" where XX is your initials
- Refresh button to manually reload tasks

### Task Grid
- Grouped by date with daily totals
- Columns: Task ID, Dev, Task Name, Start, End, Duration, EHH, Status
- Completed tasks show green status
- In-progress tasks show orange clickable status

### Manual Task Completion Dialog
Click any "in progress" task to open a dialog where you can:
- Set duration (minimum 1 minute)
- Override EHH value (optional - leave blank for auto-estimate)

## Building from Source

```bash
cd extensions/jubilee-tasks
npm install
npm run compile
npm run package
```

This creates a new `jubilee-tasks-1.0.0.vsix` file.

## Version History

### 1.0.1 (2026-01-13)
- Changed default API URL to production (https://www.inspirecodex.com)
- Fixed Submit button for developer initials (CSP compliance)
- Moved "Developer Initials" label to left of input field

### 1.0.0 (2026-01-12)
- Initial release with full feature set
- Inline developer initials input (replaced pop-up)
- Smart task detection (new vs continuation)
- Manual task completion via "Done" command
- Clickable in-progress status for manual completion
- Minimum 1-minute duration enforcement
- EHH override capability
- Task panel with grouped date view and daily totals
- InspireCodex API integration
- Activity monitoring with inactivity threshold
- GPT-4o-mini task title generation
- Claude Code hook integration

## API Endpoints Used

- `GET /api/v1/developer/tasks` - Fetch tasks
- `POST /api/v1/developer/tasks` - Create task
- `POST /api/v1/developer/tasks/:id/complete` - Complete task
- `PUT /api/v1/developer/tasks/:id/ehh` - Update EHH value
- `PUT /api/v1/developer/tasks/:id/activity` - Update activity timestamp
- `GET /api/v1/developer/tasks/session/:sessionId/active` - Get active session task
- `POST /api/v1/developer/projects` - Create/get project

## Support

For issues or questions, contact the Jubilee Enterprise development team.
