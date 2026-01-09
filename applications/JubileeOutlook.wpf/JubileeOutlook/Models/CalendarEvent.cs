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
