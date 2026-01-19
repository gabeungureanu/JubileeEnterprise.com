# JubileeOutlook Changelog

All notable changes to this project will be documented in this file.

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
