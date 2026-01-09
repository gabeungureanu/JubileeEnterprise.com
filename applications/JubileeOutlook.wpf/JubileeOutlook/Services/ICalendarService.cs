using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

public interface ICalendarService
{
    Task<List<CalendarEvent>> GetEventsAsync(DateTime startDate, DateTime endDate);
    Task<CalendarEvent?> GetEventByIdAsync(string eventId);
    Task CreateEventAsync(CalendarEvent calendarEvent);
    Task UpdateEventAsync(CalendarEvent calendarEvent);
    Task DeleteEventAsync(string eventId);
}
