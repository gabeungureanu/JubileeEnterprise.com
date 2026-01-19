using System.Windows.Media;

namespace JubileeOutlook.Models;

public class CalendarEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Subject { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public DateTime StartTime { get; set; } = DateTime.Now;
    public DateTime EndTime { get; set; } = DateTime.Now.AddHours(1);
    public string Description { get; set; } = string.Empty;
    public bool IsAllDay { get; set; }
    public EventCategory Category { get; set; } = EventCategory.None;
    public List<string> Attendees { get; set; } = new();
    public string Organizer { get; set; } = string.Empty;
    public ReminderTime Reminder { get; set; } = ReminderTime.FifteenMinutes;
    public bool IsRecurring { get; set; }
    public RecurrencePattern? Recurrence { get; set; }
    public EventStatus Status { get; set; } = EventStatus.Free;
    public bool IsPrivate { get; set; }
    public bool IsInPerson { get; set; } = true;
    public string CalendarName { get; set; } = "My Calendar";
    public Brush EventColor { get; set; } = new SolidColorBrush(Color.FromRgb(0, 120, 212));
    public List<EventAttachment> Attachments { get; set; } = new();
    public List<EventImage> Images { get; set; } = new();

    public double GetTopPosition(DateTime dayStart)
    {
        var duration = StartTime - dayStart;
        return duration.TotalHours * 60; // 60px per hour
    }

    public double GetHeight()
    {
        var duration = EndTime - StartTime;
        return Math.Max(duration.TotalHours * 60, 30); // Minimum 30px height
    }

    public string GetTimeRange()
    {
        if (IsAllDay)
            return "All day";

        return $"{StartTime:h:mm tt} - {EndTime:h:mm tt}";
    }

    public Brush GetCategoryColor()
    {
        return Category switch
        {
            EventCategory.Business => new SolidColorBrush(Color.FromRgb(0, 120, 212)),
            EventCategory.Personal => new SolidColorBrush(Color.FromRgb(16, 124, 16)),
            EventCategory.Holiday => new SolidColorBrush(Color.FromRgb(209, 52, 56)),
            EventCategory.Birthday => new SolidColorBrush(Color.FromRgb(255, 189, 89)),
            _ => new SolidColorBrush(Color.FromRgb(136, 136, 136))
        };
    }

    // Display properties for private events - shows "Private" instead of actual content
    public string DisplaySubject => IsPrivate ? "Private" : Subject;
    public string DisplayLocation => IsPrivate ? "" : Location;
    public string DisplayDescription => IsPrivate ? "" : Description;
    public Brush DisplayEventColor => IsPrivate ? new SolidColorBrush(Color.FromRgb(128, 128, 128)) : EventColor;
}

public class RecurrencePattern
{
    public RecurrenceType Type { get; set; }
    public int Interval { get; set; } = 1;
    public DateTime? EndDate { get; set; }
    public int? Occurrences { get; set; }
    public List<DayOfWeek> DaysOfWeek { get; set; } = new();
}

public enum RecurrenceType
{
    Daily,
    Weekly,
    Monthly,
    Yearly
}

public enum EventCategory
{
    None,
    Business,
    Personal,
    Holiday,
    Birthday
}

public enum ReminderTime
{
    None,
    AtTimeOfEvent,
    FiveMinutes,
    FifteenMinutes,
    ThirtyMinutes,
    OneHour,
    TwoHours,
    OneDay,
    OneWeek
}

public enum EventStatus
{
    Free,
    WorkingElsewhere,
    Tentative,
    Busy,
    OutOfOffice
}

public class Calendar
{
    public string Name { get; set; } = string.Empty;
    public bool IsVisible { get; set; } = true;
    public Brush Color { get; set; } = new SolidColorBrush(System.Windows.Media.Color.FromRgb(0, 120, 212));
    public string Owner { get; set; } = string.Empty;
}

public enum CalendarViewMode
{
    Day,
    WorkWeek,
    Week,
    Month
}

public class EventAttachment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime AddedDate { get; set; } = DateTime.Now;

    /// <summary>
    /// URL of the uploaded attachment on the server
    /// </summary>
    public string? Url { get; set; }

    /// <summary>
    /// Content type (MIME type)
    /// </summary>
    public string ContentType { get; set; } = "application/octet-stream";

    /// <summary>
    /// Whether the attachment has been uploaded to the server
    /// </summary>
    public bool IsUploaded => !string.IsNullOrEmpty(Url);

    public string FileSizeFormatted
    {
        get
        {
            if (FileSize < 1024)
                return $"{FileSize} B";
            if (FileSize < 1024 * 1024)
                return $"{FileSize / 1024.0:F1} KB";
            if (FileSize < 1024 * 1024 * 1024)
                return $"{FileSize / (1024.0 * 1024.0):F1} MB";
            return $"{FileSize / (1024.0 * 1024.0 * 1024.0):F1} GB";
        }
    }

    public string FileIcon
    {
        get
        {
            var ext = System.IO.Path.GetExtension(FileName).ToLowerInvariant();
            return ext switch
            {
                ".pdf" => "\ue873",      // PDF icon
                ".doc" or ".docx" => "\ue873",  // Document
                ".xls" or ".xlsx" => "\ue873",  // Spreadsheet
                ".ppt" or ".pptx" => "\ue873",  // Presentation
                ".jpg" or ".jpeg" or ".png" or ".gif" or ".bmp" => "\ue3f4",  // Image
                ".mp3" or ".wav" or ".m4a" => "\ue405",  // Audio
                ".mp4" or ".avi" or ".mov" or ".wmv" => "\ue04b",  // Video
                ".zip" or ".rar" or ".7z" => "\ue2c4",  // Archive
                ".txt" => "\ue873",      // Text
                _ => "\ue226"            // Generic attachment
            };
        }
    }
}

public class EventImage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public byte[]? ImageData { get; set; }
    public DateTime AddedDate { get; set; } = DateTime.Now;

    /// <summary>
    /// URL of the uploaded image on the server
    /// </summary>
    public string? Url { get; set; }

    /// <summary>
    /// Thumbnail URL for preview
    /// </summary>
    public string? ThumbnailUrl { get; set; }

    /// <summary>
    /// Content type (e.g., "image/jpeg", "image/png")
    /// </summary>
    public string ContentType { get; set; } = "image/jpeg";

    /// <summary>
    /// Size of the image in bytes
    /// </summary>
    public long FileSize { get; set; }

    /// <summary>
    /// Whether the image has been uploaded to the server
    /// </summary>
    public bool IsUploaded => !string.IsNullOrEmpty(Url);
}
