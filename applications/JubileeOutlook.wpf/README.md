# JubileeOutlook - WPF Email Client

JubileeOutlook is a modern, feature-rich email client application built with WPF (Windows Presentation Foundation) that provides a Microsoft Outlook-inspired experience with a sophisticated pure black theme. The application delivers a professional 3-pane layout with full ribbon interface and comprehensive email management capabilities.

## Overview

JubileeOutlook.wpf is an enterprise-grade desktop email client designed for Windows environments. It implements a complete Outlook-style interface using the Fluent.Ribbon framework and follows modern MVVM (Model-View-ViewModel) architectural patterns with the CommunityToolkit.Mvvm library.

## Key Features

### User Interface
- **Full Ribbon Interface**: Complete ribbon UI with Home, Send/Receive, Folder, and View tabs
- **3-Pane Layout**: Classic email client design with folder navigation, message list, and reading pane
- **Pure Black Theme**: Sophisticated dark theme using pure black (#000000) with white text throughout
- **Resizable Panes**: Adjustable column widths with GridSplitter controls
- **Color-Coded Action Icons**: Visually distinct icons for different actions (blue, red, green, cyan, yellow, purple)

### Email Management
- **Collapsible Folder Navigation**: Hierarchical folder structure with hamburger menu toggle for expanding/collapsing
  - Smooth 300ms sliding animation
  - Automatic content area width adjustment
  - Persistent selection highlighting in both states
- **Message List**: Sortable message list with sender, subject, preview, and metadata
  - Properly aligned unread indicator dots (8px spacing)
  - No text overlap with visual indicators
- **Reading Pane**: Full message viewing with formatted headers, body content, and attachments
  - Gold-colored folder heading for visual consistency
  - Attachment section with file details and download options
- **Email Selection**: Click any email to instantly display in reading pane with automatic read marking
- **Unread Indicators**: Visual badges showing unread counts per folder with proper positioning
- **Message Indicators**: Icons for unread status, attachments, and flags

### Email Composition
- **New Mail Compose Window**: Full-featured email composition with dark theme (#1A1A1A background)
  - Editable From, To, Cc, Bcc, and Subject fields with placeholder text
  - Gold-colored Send button matching New Mail button for consistency
  - RichTextBox message editor with FlowDocument support
  - **Rich Text Formatting Toolbar**:
    - Text formatting: Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U)
    - Text alignment: Left, Center, Right
    - Lists: Bullet and numbered lists with toggle functionality
    - Toggleable toolbar visibility via formatting icon
  - **Hyperlink Insertion**: Dark-themed dialog for converting selected text to clickable hyperlinks
  - **Image Insertion**: File picker for adding inline images (max 600px width with aspect ratio preservation)
  - **File Attachments**: Multi-file selection with visual cards showing filename, size, and remove option
  - Cancel and minimize buttons for window management

### Core Actions (Home Tab)
- **New**: Compose new email messages with full formatting capabilities
- **Delete Group**: Ignore, Block, Delete, Archive, and Report actions
- **Respond**: Reply, Reply All, Forward, and Meeting creation
- **Move**: Sweep, Move to folder, and Rules management
- **Quick Steps**: Automated action sequences
- **Tags**: Read/Unread toggle, Categorize, Flag, and Pin
- **Additional**: Snooze, Print, More Apps, and Discover
- **Find**: Search functionality

### Send/Receive Tab
- **Send/Receive All**: Synchronize all mail accounts
- **Update Folder**: Refresh current folder
- **Download Address Book**: Sync contacts
- **Work Offline**: Toggle offline mode
- **Sync Settings**: Configure synchronization preferences

### Folder Tab
- **New Folder**: Create custom mail folders
- **Rename/Delete**: Folder management operations
- **Clean Up**: Folder maintenance and cleanup
- **Recover Items**: Restore deleted items

### View Tab
- **Current View**: Switch between Mail, Calendar, People, and Tasks
- **Layout**: Toggle Folder Pane, Reading Pane, and To-Do Bar
- **Arrangement**: Conversation view, sorting, and filtering
- **Window**: Save and reset view configurations

### Calendar & Events
- **New Event Window**: Comprehensive event creation with dark theme
  - Event title with visual event icon
  - Attendee invitation (optional)
  - Date and time selection with DatePicker and time dropdowns
  - All-day event toggle
  - Location field with in-person event toggle
  - **Show As Status Dropdown**:
    - Free (White), Working elsewhere (Purple), Tentative (Blue)
    - Busy (Red - default), Out of office (Violet)
    - Color-coded vertical bars for each status
  - **Reminder Dropdown** (no scrollbar):
    - Don't remind me, At time of event
    - 5/15/30 minutes before, 1/2/12 hours before
    - 1 day before, 1 week before
    - Default: 15 minutes before
  - **Category Dropdown** (no scrollbar):
    - Blue, Green, Orange, Purple, Red, Yellow categories
    - Color-coded tag icons matching category colors
    - New category and Manage categories options
    - Default: Blue category
  - **Rich Text Description Editor**: Notes, links, and attachments section
  - **Recurring Event**: Make recurring option
  - **Private Event Toggle**: Mark events as private
  - **Live Calendar Preview**: Right panel showing time grid with draggable event block

## Technical Architecture

### Technology Stack
- **Framework**: .NET 9.0 (Windows)
- **UI Framework**: WPF (Windows Presentation Foundation)
- **Ribbon Library**: Fluent.Ribbon 10.0.5
- **MVVM Framework**: CommunityToolkit.Mvvm 8.3.2
- **Language**: C# with nullable reference types enabled

### Project Structure

```
JubileeOutlook.wpf/
├── JubileeOutlook/
│   ├── Models/                    # Data models
│   │   ├── EmailMessage.cs        # Email message entity
│   │   ├── MailFolder.cs          # Folder entity with hierarchy
│   │   ├── CalendarEvent.cs       # Calendar event entity
│   │   └── MailAccount.cs         # Account configuration
│   ├── ViewModels/                # MVVM view models
│   │   ├── MainViewModel.cs       # Main application view model
│   │   ├── ApplicationViewModel.cs # App-level view model with folder toggle
│   │   ├── CalendarViewModel.cs   # Calendar view management
│   │   ├── ComposeMailViewModel.cs # Email composition with attachments
│   │   └── NewEventViewModel.cs   # Event creation with status/categories
│   ├── Views/                     # User controls and windows
│   │   ├── ComposeMailView.xaml   # Email composition window
│   │   ├── ComposeMailView.xaml.cs # Composition logic & formatting
│   │   ├── NewEventWindow.xaml    # Event creation dialog
│   │   └── NewEventWindow.xaml.cs # Event window code-behind
│   ├── Controls/                  # Custom controls
│   │   ├── AppRailControl.xaml    # Left navigation rail with hamburger
│   │   └── AppRailControl.xaml.cs # App rail code-behind
│   ├── Services/                  # Business logic and data access
│   │   ├── IMailService.cs        # Mail service contract
│   │   ├── MockMailService.cs     # Mock implementation
│   │   ├── ICalendarService.cs    # Calendar service contract
│   │   └── MockCalendarService.cs # Mock implementation
│   ├── Helpers/                   # Utility classes
│   │   └── Converters.cs          # Value converters for data binding
│   ├── Themes/                    # UI styling
│   │   └── DarkTheme.xaml         # Pure black theme resources
│   ├── MainWindow.xaml            # Main window layout with collapsible panels
│   ├── MainWindow.xaml.cs         # Main window with hamburger toggle logic
│   ├── App.xaml                   # Application resources
│   ├── App.xaml.cs                # Application startup
│   └── JubileeOutlook.csproj      # Project configuration
```

### MVVM Architecture

JubileeOutlook implements a clean separation of concerns through MVVM:

#### Models
- **EmailMessage**: Represents email with properties like From, To, Subject, Body, ReceivedDate, IsRead, IsFlagged, HasAttachments
- **MailFolder**: Hierarchical folder structure with Type (Inbox, Sent, Drafts, etc.), Name, Icon, UnreadCount, SubFolders
- **CalendarEvent**: Meeting and event management with Subject, Start, End, Location, Attendees, IsRecurring
- **MailAccount**: Email account configuration

#### ViewModels
- **MainViewModel**: Central view model managing:
  - Observable collections of Folders, Messages, and Events
  - Selected folder and message state
  - Current view (Mail, Calendar, People, Tasks)
  - Search query binding
  - All command implementations using RelayCommand
  - Automatic message marking as read on selection (OnSelectedMessageChanged)

- **ApplicationViewModel**: App-level management:
  - Active module tracking (Mail, Calendar, People, Apps)
  - Folder pane toggle event (ToggleFolderPaneRequested)
  - Module switching commands (SwitchToMail, SwitchToCalendar, etc.)

- **ComposeMailViewModel**: Email composition management:
  - From, To, Cc, Bcc, Subject, Body properties with two-way binding
  - Show/Hide Cc and Bcc toggle state
  - ObservableCollection<AttachmentInfo> for file attachments
  - AttachmentRequested event for file picker integration
  - AddAttachment/RemoveAttachment commands
  - File size formatting helper
  - MailSent and ComposeCancelled events

- **NewEventViewModel**: Event creation management:
  - Event properties: Title, Attendees, Date, StartTime, EndTime, Location, Description
  - TimeOptions collection (00:00 to 23:30 in 30-min intervals)
  - ShowAsStatusOptions with color-coded status items (Free, Working elsewhere, Tentative, Busy, Out of office)
  - ReminderOptions (10 time options from "Don't remind me" to "1 week before")
  - CategoryOptions with color-coded category items (Blue, Green, Orange, Purple, Red, Yellow + management options)
  - IsAllDay, IsInPerson, IsBusy, IsPrivate toggle properties
  - EventTopPosition and EventHeight for calendar preview
  - SaveEventCommand with validation
  - Helper classes: ShowAsStatusItem, CategoryItem, TimeSlot

#### Services
- **IMailService**: Contract for email operations
  - GetFolders(): Load folder hierarchy
  - GetMessagesAsync(folderId): Retrieve messages
  - MarkAsReadAsync(messageId, isRead): Update read status
  - DeleteMessageAsync(messageId): Remove messages
  - MoveMessageAsync(messageId, targetFolderId): Relocate messages

- **ICalendarService**: Contract for calendar operations
  - GetEventsAsync(startDate, endDate): Load calendar events
  - CreateEventAsync(event): Add new meetings
  - UpdateEventAsync(event): Modify existing events
  - DeleteEventAsync(eventId): Remove events

- **Mock Implementations**: Currently using MockMailService and MockCalendarService with sample data for demonstration

### Data Binding and Converters

The application uses extensive WPF data binding with custom value converters in [Helpers/Converters.cs](applications/JubileeOutlook.wpf/JubileeOutlook/Helpers/Converters.cs):

- **BoolToVisibilityConverter**: Show/hide elements based on boolean values
- **InverseBoolToVisibilityConverter**: Inverted visibility logic
- **CountToVisibilityConverter**: Show unread count badges only when count > 0
- **ReadToWeightConverter**: Bold text for unread messages, normal for read
- **ListToStringConverter**: Convert recipient lists to comma-separated strings

### Pure Black Theme

The [DarkTheme.xaml](applications/JubileeOutlook.wpf/JubileeOutlook/Themes/DarkTheme.xaml) resource dictionary implements a comprehensive theming system:

#### Core Colors
- **Primary Background**: Pure Black (#000000)
- **Secondary Background**: Dark Gray (#0A0A0A, #1A1A1A for compose windows)
- **Tertiary Background**: Medium Gray (#151515, #252525 for panels)
- **Primary Text**: White (#FFFFFF, #EEEEEE for compose)
- **Secondary Text**: Gray (#B0B0B0, #999999 for labels, #666666 for placeholders)
- **Accent**: Blue (#4A9EFF, #0078D4 for focus states)
- **Brand Gold**: #B8860B (New Mail button, Send button, selections)
- **Unread Indicator**: Cyan (#4FC3F7)
- **Borders**: Dark Gray (#2A2A2A, #333333, #3A3A3A for various elements)
- **Status Colors**:
  - Free (#FFFFFF), Working elsewhere (#9370DB), Tentative (#6495ED)
  - Busy (#DC143C), Out of office (#9B30FF)
- **Category Colors**:
  - Blue (#5B9BD5), Green (#70AD47), Orange (#ED7D31)
  - Purple (#9966CC), Red (#E74856), Yellow (#FFC000)

#### Fluent.Ribbon Color Overrides
The theme extensively overrides Fluent.Ribbon color keys to ensure consistent pure black appearance:
- All background brushes set to black variants
- All foreground/text brushes forced to white
- Button states (normal, hover, pressed) maintain black theme
- Tab controls, menu items, and group boxes themed consistently
- Over 100 color keys overridden for complete coverage

#### Custom Styles
- **OutlookTextBoxStyle**: Black background with white text
- **OutlookTreeViewStyle**: Folder navigation styling
- **OutlookTreeViewItemStyle**: Folder item appearance with selection states
- **OutlookListBoxStyle**: Message list styling
- **OutlookListBoxItemStyle**: Message item with hover and selection states
- **OutlookSeparatorStyle**: Visual separators between sections

## Setup and Installation

### Prerequisites
- Windows 10/11 (64-bit)
- .NET 9.0 SDK or Runtime
- Visual Studio 2022 (recommended) or VS Code with C# extensions

### Build Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/[your-org]/JubileeEnterprise.com.git
   cd JubileeEnterprise.com/applications/JubileeOutlook.wpf
   ```

2. **Restore dependencies**:
   ```bash
   dotnet restore JubileeOutlook/JubileeOutlook.csproj
   ```

3. **Build the application**:
   ```bash
   dotnet build JubileeOutlook/JubileeOutlook.csproj --configuration Release
   ```

4. **Run the application**:
   ```bash
   dotnet run --project JubileeOutlook/JubileeOutlook.csproj
   ```

### Development Setup

1. Open the solution in Visual Studio 2022
2. Set JubileeOutlook as the startup project
3. Press F5 to build and run in debug mode

### NuGet Dependencies

The project uses the following NuGet packages:
- **Fluent.Ribbon** (10.0.5): Provides the ribbon UI controls
- **CommunityToolkit.Mvvm** (8.3.2): Simplifies MVVM implementation with source generators

## Current Implementation Status

### Implemented Features
- Complete UI layout with all ribbon tabs and groups
- Full 3-pane email client interface
- MVVM architecture with proper separation of concerns
- Mock data services with sample emails and folders
- Pure black theme with consistent styling
- All major command structures defined
- Folder navigation with hierarchical display
- Message list with sorting and selection
- Reading pane with formatted message display
- Status bar with connection status
- Resizable panes with grid splitters

### Mock Data Layer
The application currently uses mock services for demonstration:
- **MockMailService**: Generates sample emails with realistic data
- **MockCalendarService**: Creates sample calendar events
- All service methods return mock data or simulated operations

### Future Integration Requirements

To connect JubileeOutlook to production systems, the following integration work is required:

#### 1. Email Service Integration
Replace MockMailService with production implementation using one of:
- **IMAP/SMTP**: Direct email protocol implementation
- **Microsoft Graph API**: For Microsoft 365 integration
- **Exchange Web Services (EWS)**: For on-premises Exchange servers
- **InspireCodex.com API**: Per production environment guidelines

#### 2. Calendar Integration
Replace MockCalendarService with production calendar backend:
- Microsoft Graph Calendar API
- CalDAV protocol
- Custom calendar service via InspireCodex.com API

#### 3. Authentication
Implement proper authentication and account management:
- OAuth 2.0 for cloud services
- Windows integrated authentication for on-premises
- Multi-account support
- Secure credential storage using Windows Credential Manager

#### 4. Data Persistence
Add local caching and offline support:
- SQLite database for message caching
- Attachment storage management
- Offline mode functionality
- Synchronization conflict resolution

#### 5. Search Implementation
Enhance search capabilities:
- Full-text search across messages
- Advanced query syntax
- Search folders and saved searches
- Integration with backend search APIs

#### 6. Attachment Handling
Implement attachment management:
- Upload/download functionality
- Preview capabilities
- Virus scanning integration
- Size limits and quota management

#### 7. Additional Features
Consider implementing:
- Email composition window
- Rich text editing
- Spell checking
- Signature management
- Rules and filters execution
- Categories and tags
- Folder synchronization
- Push notifications
- Read receipts and delivery confirmations

## Configuration

### Application Settings
Currently, application configuration is managed through code. Future versions should implement:
- `appsettings.json` for general configuration
- `.env` files for environment-specific settings (per production guidelines)
- User preferences storage
- Account configuration UI

### Production Environment Compliance
Per the CLAUDE.md production environment guidelines:
- No direct database connections should be embedded
- All Codex/Inspire data access must use InspireCodex.com API
- All Continuum data access must use InspireContinuum.com API
- No hardcoded credentials or secrets
- Environment variables for all sensitive configuration
- Production-grade error handling and logging required

## Development Guidelines

### Code Style
- Follow standard C# naming conventions
- Use nullable reference types
- Implement async/await for all I/O operations
- Use MVVM pattern consistently
- Leverage CommunityToolkit.Mvvm source generators

### Adding New Features
1. Define models in Models/ folder
2. Create or extend service interfaces in Services/
3. Implement service methods (mock or production)
4. Add properties and commands to MainViewModel
5. Update XAML bindings in MainWindow.xaml
6. Add any required value converters to Helpers/Converters.cs
7. Update theme resources if new UI elements added

### Testing
Future development should include:
- Unit tests for ViewModels
- Integration tests for Services
- UI automation tests
- Mock data for all test scenarios

## Troubleshooting

### Common Issues

**Issue**: Ribbon text appears black on black background
**Solution**: This was resolved by adding comprehensive Fluent.Ribbon color key overrides in DarkTheme.xaml. Ensure all Foreground brushes are set to white.

**Issue**: Application crashes on startup
**Solution**: Verify .NET 9.0 runtime is installed and all NuGet packages are restored.

**Issue**: XAML designer not loading
**Solution**: Rebuild the solution and restart Visual Studio. The designer may have issues with Fluent.Ribbon preview.

**Issue**: GridSplitters not visible
**Solution**: GridSplitter background color is set to BorderBrush. Ensure BorderBrush resource is defined in theme.

## Performance Considerations

- Message list virtualization enabled for large inboxes
- Async loading prevents UI blocking
- Lazy loading of message bodies
- Efficient observable collection updates
- Proper disposal of resources in ViewModels

## Security Considerations

When implementing production features:
- Never store passwords in plain text
- Use Windows Credential Manager for credential storage
- Implement proper OAuth token refresh
- Sanitize HTML content in message bodies
- Validate all user input
- Implement proper HTTPS certificate validation
- Follow OWASP security guidelines
- No SQL injection vulnerabilities (use parameterized queries)
- No XSS vulnerabilities (sanitize all HTML rendering)

## Browser and Platform Compatibility

- **Platform**: Windows 10 version 1809 or later
- **Architecture**: x64, x86, ARM64
- **Dependencies**: .NET 9.0 Windows Runtime

## License

This application is part of the Jubilee Enterprise suite. Refer to the root repository LICENSE file for details.

## Contributors

- Development: Jubilee Development Team
- Co-Authored-By: Claude Sonnet 4.5

## Changelog

### Version 1.0.0 (Initial Release - 2026-01-09)
- Full Outlook-style WPF application implementation
- Complete ribbon UI with all tabs (Home, Send/Receive, Folder, View)
- 3-pane layout: folder navigation, message list, reading pane
- MVVM architecture with MainViewModel and mock services
- Pure black theme (#000000) with comprehensive Fluent.Ribbon overrides
- Color-coded action icons throughout ribbon
- Hierarchical folder structure with icons and unread counts
- Message list with indicators for unread, flagged, and attachments
- Reading pane with formatted message headers and body
- Status bar with item count and connection status
- Resizable panes with grid splitters
- All command structures defined and bound
- Mock data services with realistic sample data
- Value converters for UI formatting
- Theme fixes for white text on ribbon buttons and labels

### Version 1.1.0 (2026-01-10)
- **Email Composition Window**:
  - Full-featured compose mail view with dark theme
  - RichTextBox with rich text formatting (Bold, Italic, Underline, Alignment, Lists)
  - Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
  - Hyperlink insertion with dark-themed dialog
  - Inline image insertion from file system
  - Multi-file attachment support with visual cards
  - Gold Send button matching brand colors
  - Toggleable formatting toolbar

- **Hamburger Menu Navigation**:
  - Collapsible folder panel with smooth 300ms sliding animation
  - Animated width transition from 250px to 0px
  - Automatic content area width adjustment
  - Grid splitter fade in/out animation
  - Triggered from existing hamburger icon in app rail

- **Email Reading Enhancements**:
  - Click-to-select email with instant reading pane update
  - Automatic read status marking on selection
  - Gold-colored Inbox heading for visual consistency
  - Properly aligned unread indicator dots (8px spacing, no overlap)
  - Attachment section in reading pane with download buttons

- **Calendar & Event Management**:
  - New Event window with comprehensive options
  - Show As Status dropdown with 5 color-coded status options
  - Reminder dropdown with 10 time options (no scrollbar)
  - Category dropdown with 6 color categories + management (no scrollbar)
  - Color-coded tag icons for categories
  - All-day and in-person event toggles
  - Live calendar preview panel with time grid
  - Default selections: Busy status, 15 minutes before, Blue category

- **UI/UX Improvements**:
  - Removed scrollbars from dropdowns for cleaner appearance
  - Fixed duplicate icon display in category selection
  - Enhanced dropdown styling with hover and selection states
  - Consistent dark theme across all new windows and dialogs
  - Material Design icons throughout

### Version 1.0.0 (Initial Release - 2026-01-09)
- Full Outlook-style WPF application implementation
- Complete ribbon UI with all tabs (Home, Send/Receive, Folder, View)
- 3-pane layout: folder navigation, message list, reading pane
- MVVM architecture with MainViewModel and mock services
- Pure black theme (#000000) with comprehensive Fluent.Ribbon overrides
- Color-coded action icons throughout ribbon
- Hierarchical folder structure with icons and unread counts
- Message list with indicators for unread, flagged, and attachments
- Reading pane with formatted message headers and body
- Status bar with item count and connection status
- Resizable panes with grid splitters
- All command structures defined and bound
- Mock data services with realistic sample data
- Value converters for UI formatting
- Theme fixes for white text on ribbon buttons and labels

## Support and Contact

For questions, issues, or contributions, please refer to the main Jubilee Enterprise repository documentation.

## Additional Resources

- [Fluent.Ribbon Documentation](https://github.com/fluentribbon/Fluent.Ribbon)
- [CommunityToolkit.Mvvm Documentation](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/)
- [WPF Documentation](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/)
- [.NET 9.0 Documentation](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-9)

---

**Note**: This is currently a demonstration application using mock data services. Production deployment requires implementation of actual email service integration and proper authentication mechanisms as outlined in the Future Integration Requirements section.
