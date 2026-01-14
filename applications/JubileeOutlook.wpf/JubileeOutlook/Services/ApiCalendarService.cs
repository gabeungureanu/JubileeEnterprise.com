using JubileeOutlook.Models;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace JubileeOutlook.Services;

public class ApiCalendarService : ICalendarService
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly string? _userId;
    private readonly JsonSerializerOptions _jsonOptions;

    public ApiCalendarService(string? baseUrl = null, string? userId = null)
    {
        _baseUrl = baseUrl ?? Environment.GetEnvironmentVariable("CONTINUUM_API_URL") ?? "https://inspirecontinuum.com/api";
        _userId = userId ?? Environment.GetEnvironmentVariable("JUBILEE_USER_ID");

        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(_baseUrl),
            Timeout = TimeSpan.FromSeconds(30)
        };

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }

    public async Task<List<CalendarEvent>> GetEventsAsync(DateTime startDate, DateTime endDate)
    {
        try
        {
            var response = await _httpClient.GetAsync(
                $"/outlook/events?userId={_userId}&startDate={startDate:yyyy-MM-dd}&endDate={endDate:yyyy-MM-dd}");

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[ApiCalendarService] Failed to get events: {response.StatusCode}");
                return new List<CalendarEvent>();
            }

            var apiEvents = await response.Content.ReadFromJsonAsync<List<CalendarEventDto>>(_jsonOptions);
            return apiEvents?.Select(MapToCalendarEvent).ToList() ?? new List<CalendarEvent>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiCalendarService] Error getting events: {ex.Message}");
            return new List<CalendarEvent>();
        }
    }

    public async Task<CalendarEvent?> GetEventByIdAsync(string eventId)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/outlook/events/{eventId}");

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[ApiCalendarService] Failed to get event {eventId}: {response.StatusCode}");
                return null;
            }

            var apiEvent = await response.Content.ReadFromJsonAsync<CalendarEventDto>(_jsonOptions);
            return apiEvent != null ? MapToCalendarEvent(apiEvent) : null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiCalendarService] Error getting event: {ex.Message}");
            return null;
        }
    }

    public async Task CreateEventAsync(CalendarEvent calendarEvent)
    {
        try
        {
            var dto = MapToDto(calendarEvent);
            dto.UserId = _userId;

            var response = await _httpClient.PostAsJsonAsync("/outlook/events", dto, _jsonOptions);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[ApiCalendarService] Failed to create event: {response.StatusCode} - {error}");
            }
            else
            {
                var createdEvent = await response.Content.ReadFromJsonAsync<CalendarEventDto>(_jsonOptions);
                if (createdEvent != null)
                {
                    calendarEvent.Id = createdEvent.Id ?? calendarEvent.Id;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiCalendarService] Error creating event: {ex.Message}");
        }
    }

    public async Task UpdateEventAsync(CalendarEvent calendarEvent)
    {
        try
        {
            var dto = MapToDto(calendarEvent);

            var response = await _httpClient.PutAsJsonAsync($"/outlook/events/{calendarEvent.Id}", dto, _jsonOptions);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[ApiCalendarService] Failed to update event: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiCalendarService] Error updating event: {ex.Message}");
        }
    }

    public async Task DeleteEventAsync(string eventId)
    {
        try
        {
            var response = await _httpClient.DeleteAsync($"/outlook/events/{eventId}");

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[ApiCalendarService] Failed to delete event {eventId}: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ApiCalendarService] Error deleting event: {ex.Message}");
        }
    }

    private static CalendarEvent MapToCalendarEvent(CalendarEventDto dto)
    {
        var eventColor = new System.Windows.Media.SolidColorBrush(
            ParseHexColor(dto.EventColor ?? "#5B9BD5"));

        return new CalendarEvent
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            Subject = dto.Subject ?? string.Empty,
            Location = dto.Location ?? string.Empty,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            Description = dto.Description ?? string.Empty,
            IsAllDay = dto.IsAllDay,
            Status = ParseEventStatus(dto.Status),
            Category = ParseEventCategory(dto.Category),
            CalendarName = dto.CalendarName ?? "My Calendar",
            EventColor = eventColor,
            Attendees = dto.Attendees ?? new List<string>(),
            Attachments = dto.Attachments?.Select(a => new EventAttachment
            {
                Id = a.Id ?? Guid.NewGuid().ToString(),
                FileName = a.FileName ?? string.Empty,
                FilePath = a.FilePath ?? string.Empty,
                FileSize = a.FileSize,
                AddedDate = a.AddedDate
            }).ToList() ?? new List<EventAttachment>(),
            IsRecurring = dto.IsRecurring,
            Reminder = ParseReminderTime(dto.ReminderMinutes)
        };
    }

    private static CalendarEventDto MapToDto(CalendarEvent calendarEvent)
    {
        return new CalendarEventDto
        {
            Id = calendarEvent.Id,
            Subject = calendarEvent.Subject,
            Location = calendarEvent.Location,
            StartTime = calendarEvent.StartTime,
            EndTime = calendarEvent.EndTime,
            Description = calendarEvent.Description,
            IsAllDay = calendarEvent.IsAllDay,
            Status = calendarEvent.Status.ToString().ToLower(),
            Category = calendarEvent.Category.ToString().ToLower(),
            CalendarName = calendarEvent.CalendarName,
            EventColor = GetColorHex(calendarEvent.EventColor),
            Attendees = calendarEvent.Attendees,
            Attachments = calendarEvent.Attachments?.Select(a => new AttachmentDto
            {
                Id = a.Id,
                FileName = a.FileName,
                FilePath = a.FilePath,
                FileSize = a.FileSize,
                AddedDate = a.AddedDate
            }).ToList(),
            IsRecurring = calendarEvent.IsRecurring,
            ReminderMinutes = GetReminderMinutes(calendarEvent.Reminder)
        };
    }

    private static System.Windows.Media.Color ParseHexColor(string hex)
    {
        try
        {
            hex = hex.TrimStart('#');
            if (hex.Length == 6)
            {
                return System.Windows.Media.Color.FromRgb(
                    Convert.ToByte(hex.Substring(0, 2), 16),
                    Convert.ToByte(hex.Substring(2, 2), 16),
                    Convert.ToByte(hex.Substring(4, 2), 16));
            }
        }
        catch { }
        return System.Windows.Media.Color.FromRgb(91, 155, 213);
    }

    private static string GetColorHex(System.Windows.Media.Brush brush)
    {
        if (brush is System.Windows.Media.SolidColorBrush solidBrush)
        {
            var color = solidBrush.Color;
            return $"#{color.R:X2}{color.G:X2}{color.B:X2}";
        }
        return "#5B9BD5";
    }

    private static EventStatus ParseEventStatus(string? status)
    {
        return status?.ToLower() switch
        {
            "free" => EventStatus.Free,
            "tentative" => EventStatus.Tentative,
            "busy" => EventStatus.Busy,
            "outofoffice" => EventStatus.OutOfOffice,
            _ => EventStatus.Free
        };
    }

    private static EventCategory ParseEventCategory(string? category)
    {
        return category?.ToLower() switch
        {
            "business" => EventCategory.Business,
            "personal" => EventCategory.Personal,
            "holiday" => EventCategory.Holiday,
            "birthday" => EventCategory.Birthday,
            _ => EventCategory.None
        };
    }

    private static ReminderTime ParseReminderTime(int? minutes)
    {
        return minutes switch
        {
            0 => ReminderTime.AtTimeOfEvent,
            5 => ReminderTime.FiveMinutes,
            15 => ReminderTime.FifteenMinutes,
            30 => ReminderTime.ThirtyMinutes,
            60 => ReminderTime.OneHour,
            120 => ReminderTime.TwoHours,
            1440 => ReminderTime.OneDay,
            10080 => ReminderTime.OneWeek,
            _ => ReminderTime.None
        };
    }

    private static int GetReminderMinutes(ReminderTime reminder)
    {
        return reminder switch
        {
            ReminderTime.AtTimeOfEvent => 0,
            ReminderTime.FiveMinutes => 5,
            ReminderTime.FifteenMinutes => 15,
            ReminderTime.ThirtyMinutes => 30,
            ReminderTime.OneHour => 60,
            ReminderTime.TwoHours => 120,
            ReminderTime.OneDay => 1440,
            ReminderTime.OneWeek => 10080,
            _ => -1
        };
    }
}

public class CalendarEventDto
{
    public string? Id { get; set; }
    public string? UserId { get; set; }
    public string? CalendarId { get; set; }
    public string? Subject { get; set; }
    public string? Location { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Description { get; set; }
    public bool IsAllDay { get; set; }
    public string? Status { get; set; }
    public string? Category { get; set; }
    public string? CalendarName { get; set; }
    public string? EventColor { get; set; }
    public List<string>? Attendees { get; set; }
    public List<AttachmentDto>? Attachments { get; set; }
    public bool IsRecurring { get; set; }
    public int? ReminderMinutes { get; set; }
}

public class AttachmentDto
{
    public string? Id { get; set; }
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public long FileSize { get; set; }
    public DateTime AddedDate { get; set; }
    public string? StorageKey { get; set; }
}
