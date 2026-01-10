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
    public string CalendarName { get; set; } = "My Calendar";
    public Brush EventColor { get; set; } = new SolidColorBrush(Color.FromRgb(0, 120, 212));

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
