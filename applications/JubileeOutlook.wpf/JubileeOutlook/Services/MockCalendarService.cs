using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

public class MockCalendarService : ICalendarService
{
    private readonly List<CalendarEvent> _events = new();

    public MockCalendarService()
    {
        InitializeMockEvents();
    }

    private void InitializeMockEvents()
    {
        _events.Add(new CalendarEvent
        {
            Id = "1",
            Subject = "Team Stand-up",
            Location = "Conference Room A",
            StartTime = DateTime.Today.AddHours(9),
            EndTime = DateTime.Today.AddHours(9.5),
            Description = "Daily team synchronization meeting",
            Category = EventCategory.Business,
            Reminder = ReminderTime.FifteenMinutes,
            IsRecurring = true,
            Recurrence = new RecurrencePattern
            {
                Type = RecurrenceType.Daily,
                Interval = 1,
                DaysOfWeek = new List<DayOfWeek> { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday }
            }
        });

        _events.Add(new CalendarEvent
        {
            Id = "2",
            Subject = "Client Presentation",
            Location = "Online - Teams",
            StartTime = DateTime.Today.AddHours(14),
            EndTime = DateTime.Today.AddHours(15),
            Description = "Q1 Results presentation to key stakeholders",
            Category = EventCategory.Business,
            Attendees = new List<string> { "client@company.com", "manager@company.com" },
            Reminder = ReminderTime.ThirtyMinutes,
            Status = EventStatus.Busy
        });

        _events.Add(new CalendarEvent
        {
            Id = "3",
            Subject = "Lunch Break",
            Location = "Cafeteria",
            StartTime = DateTime.Today.AddHours(12),
            EndTime = DateTime.Today.AddHours(13),
            IsAllDay = false,
            Category = EventCategory.Personal,
            Status = EventStatus.Free
        });
    }

    public Task<List<CalendarEvent>> GetEventsAsync(DateTime startDate, DateTime endDate)
    {
        var events = _events.Where(e =>
            e.StartTime >= startDate && e.StartTime <= endDate)
            .OrderBy(e => e.StartTime)
            .ToList();
        return Task.FromResult(events);
    }

    public Task<CalendarEvent?> GetEventByIdAsync(string eventId)
    {
        var calendarEvent = _events.FirstOrDefault(e => e.Id == eventId);
        return Task.FromResult(calendarEvent);
    }

    public Task CreateEventAsync(CalendarEvent calendarEvent)
    {
        calendarEvent.Id = Guid.NewGuid().ToString();
        _events.Add(calendarEvent);
        return Task.CompletedTask;
    }

    public Task UpdateEventAsync(CalendarEvent calendarEvent)
    {
        var existingEvent = _events.FirstOrDefault(e => e.Id == calendarEvent.Id);
        if (existingEvent != null)
        {
            var index = _events.IndexOf(existingEvent);
            _events[index] = calendarEvent;
        }
        return Task.CompletedTask;
    }

    public Task DeleteEventAsync(string eventId)
    {
        var calendarEvent = _events.FirstOrDefault(e => e.Id == eventId);
        if (calendarEvent != null)
        {
            _events.Remove(calendarEvent);
        }
        return Task.CompletedTask;
    }
}
