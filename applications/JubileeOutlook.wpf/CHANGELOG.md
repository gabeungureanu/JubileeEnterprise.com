# JubileeOutlook Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-01-28

### Added
- **Calendar Reminder Notifications**: Full reminder system for calendar events
  - New `CalendarReminderService` that monitors upcoming events every 30 seconds
  - `ReminderPopup` window with dark theme styling
  - Shows event subject, time, location, and time until event starts
  - Snooze options: 5, 10, 15, 30 minutes, 1 hour, 2 hours
  - Dismiss functionality to permanently silence reminders
  - Notification sound plays when reminder appears
  - Popup appears in bottom-right corner of screen

- **Hamburger Menu Toggle**: Toggle folder pane visibility
  - New `ToggleFolderPaneCommand` in ApplicationViewModel
  - Click handler in AppRailControl for folder pane toggle
  - Animated collapse/expand of folder pane

### Changed
- **AppRail Cleanup**: Removed unused icons from left sidebar
  - Removed Tasks icon from AppRail
  - Removed "More Apps" (three dots) icon from AppRail
  - Hamburger menu now toggles folder pane instead of opening settings

- **Ribbon Bar Cleanup**: Streamlined ribbon interface
  - Removed "New Meeting" option from New Mail dropdown
  - Settings button at bottom of AppRail now available for future settings dialog

### Fixed
- **Snooze Dropdown Styling**: Fixed ComboBox dropdown to use dark theme
  - Dark background (#2A2A2A) for dropdown items
  - White text for visibility
  - Gold highlight on hover/selection

### Technical Details
- CalendarReminderService uses DispatcherTimer for UI-thread safe reminders
- Reminder triggers based on event's ReminderTime enum (None, 5min, 15min, etc.)
- Snooze creates temporary timer for delayed re-notification
- ReminderPopup is a borderless, topmost window with transparency

## [1.1.0] - 2026-01-19

### Added
- **Rich Text Description Support**: Event descriptions now support rich text formatting (Bold, Italic, Underline, Lists, Tables, etc.)
  - Descriptions are stored as XAML FlowDocument format for full formatting preservation
  - Backwards compatible with plain text descriptions
  - RichTextBox editor with formatting toolbar in NewEventWindow

- **New Migration Script** (`0004_outlook_richtext_images.sql`):
  - Added `description_format` column to `outlook_calendar_events` table
  - Added `is_in_person` column for event type (in-person vs virtual)
  - Created `outlook_event_images` table for event image attachments
  - Added `url` column to `outlook_event_attachments` for cloud storage
  - Created `outlook_event_details` view for comprehensive event data

- **Event Delete Confirmation Dialog**: Custom themed confirmation dialog for event deletion
  - Dark theme styling consistent with the application
  - Clear warning message with event title display

- **Sample Calendar Events**: Seed script now includes 5 sample events with rich text descriptions

### Changed
- **Description Editor**: Upgraded from plain TextBox to RichTextBox with formatting menu
- **Local Cache Schema**: Updated `cached_events` table with `description_format`, `is_in_person`, `images`, and `attachments` columns
- **Seed Script**: Enhanced with sample calendar events including XAML-formatted descriptions

### Technical Details
- XAML serialization/deserialization using `XamlWriter.Save()` and `XamlReader.Load()`
- Description format detection: checks for `<FlowDocument` or `<Section` prefix
- Supported formats: `plain`, `xaml`, `html`

## [1.0.0] - 2026-01-17

### Added
- Initial JubileeOutlook calendar integration with InspireContinuum API
- Complete ApiMailService integration with UI enhancements
- Material Icons unicode conversion for folder icons
- Folder loading from InspireContinuum API

### Fixed
- API icon name conversion to Material Icons unicode
- Folder loading issues with InspireContinuum API
