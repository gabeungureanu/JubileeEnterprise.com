using System.Windows;
using System.Windows.Threading;
using JubileeOutlook.Models;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Services;

/// <summary>
/// Service for monitoring calendar events and triggering reminder notifications
/// </summary>
public class CalendarReminderService : IDisposable
{
    private static CalendarReminderService? _instance;
    private static readonly object _lock = new();

    private readonly DispatcherTimer _checkTimer;
    private readonly HashSet<string> _notifiedEventIds = new();
    private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(30);
    private CalendarViewModel? _calendarViewModel;
    private bool _isRunning;
    private bool _disposed;

    /// <summary>
    /// Event raised when a reminder should be shown
    /// </summary>
    public event EventHandler<ReminderEventArgs>? ReminderTriggered;

    /// <summary>
    /// Gets the singleton instance
    /// </summary>
    public static CalendarReminderService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new CalendarReminderService();
                }
            }
            return _instance;
        }
    }

    private CalendarReminderService()
    {
        _checkTimer = new DispatcherTimer
        {
            Interval = _checkInterval
        };
        _checkTimer.Tick += CheckTimer_Tick;

        System.Diagnostics.Debug.WriteLine("[CalendarReminderService] Created");
    }

    /// <summary>
    /// Initializes the service with a calendar view model
    /// </summary>
    public void Initialize(CalendarViewModel calendarViewModel)
    {
        _calendarViewModel = calendarViewModel;
        System.Diagnostics.Debug.WriteLine("[CalendarReminderService] Initialized with CalendarViewModel");
    }

    /// <summary>
    /// Starts monitoring for upcoming event reminders
    /// </summary>
    public void Start()
    {
        if (_isRunning)
        {
            System.Diagnostics.Debug.WriteLine("[CalendarReminderService] Already running");
            return;
        }

        _isRunning = true;
        _checkTimer.Start();

        // Do an immediate check
        CheckForReminders();

        System.Diagnostics.Debug.WriteLine("[CalendarReminderService] Started monitoring");
    }

    /// <summary>
    /// Stops monitoring for reminders
    /// </summary>
    public void Stop()
    {
        if (!_isRunning) return;

        _isRunning = false;
        _checkTimer.Stop();

        System.Diagnostics.Debug.WriteLine("[CalendarReminderService] Stopped monitoring");
    }

    private void CheckTimer_Tick(object? sender, EventArgs e)
    {
        CheckForReminders();
    }

    /// <summary>
    /// Checks all events for upcoming reminders
    /// </summary>
    private void CheckForReminders()
    {
        if (_calendarViewModel?.Events == null)
        {
            System.Diagnostics.Debug.WriteLine("[CalendarReminderService] No events to check");
            return;
        }

        var now = DateTime.Now;
        var upcomingEvents = _calendarViewModel.Events
            .Where(e => e.StartTime > now && e.Reminder != ReminderTime.None)
            .ToList();

        foreach (var calendarEvent in upcomingEvents)
        {
            CheckEventReminder(calendarEvent, now);
        }
    }

    /// <summary>
    /// Checks if a reminder should be triggered for a specific event
    /// </summary>
    private void CheckEventReminder(CalendarEvent calendarEvent, DateTime now)
    {
        // Skip if already notified
        var reminderId = $"{calendarEvent.Id}_{calendarEvent.Reminder}";
        if (_notifiedEventIds.Contains(reminderId))
        {
            return;
        }

        var reminderTime = GetReminderDateTime(calendarEvent);
        if (reminderTime == null) return;

        // Check if it's time to show the reminder (within the check window)
        var timeDiff = reminderTime.Value - now;
        if (timeDiff.TotalSeconds <= 0 && timeDiff.TotalSeconds > -_checkInterval.TotalSeconds)
        {
            // Time to trigger the reminder
            _notifiedEventIds.Add(reminderId);

            System.Diagnostics.Debug.WriteLine($"[CalendarReminderService] Triggering reminder for: {calendarEvent.Subject}");

            ReminderTriggered?.Invoke(this, new ReminderEventArgs(calendarEvent));
        }
    }

    /// <summary>
    /// Calculates when the reminder should be shown for an event
    /// </summary>
    private static DateTime? GetReminderDateTime(CalendarEvent calendarEvent)
    {
        var eventStart = calendarEvent.StartTime;

        return calendarEvent.Reminder switch
        {
            ReminderTime.None => null,
            ReminderTime.AtTimeOfEvent => eventStart,
            ReminderTime.FiveMinutes => eventStart.AddMinutes(-5),
            ReminderTime.FifteenMinutes => eventStart.AddMinutes(-15),
            ReminderTime.ThirtyMinutes => eventStart.AddMinutes(-30),
            ReminderTime.OneHour => eventStart.AddHours(-1),
            ReminderTime.TwoHours => eventStart.AddHours(-2),
            ReminderTime.OneDay => eventStart.AddDays(-1),
            ReminderTime.OneWeek => eventStart.AddDays(-7),
            _ => null
        };
    }

    /// <summary>
    /// Snoozes a reminder for the specified duration
    /// </summary>
    public void SnoozeReminder(CalendarEvent calendarEvent, TimeSpan snoozeDuration)
    {
        var reminderId = $"{calendarEvent.Id}_{calendarEvent.Reminder}";
        _notifiedEventIds.Remove(reminderId);

        // Create a temporary snooze reminder
        var snoozeTime = DateTime.Now.Add(snoozeDuration);

        // Schedule the snooze check
        var snoozeTimer = new DispatcherTimer
        {
            Interval = snoozeDuration
        };
        snoozeTimer.Tick += (s, e) =>
        {
            snoozeTimer.Stop();
            if (!_disposed && calendarEvent.StartTime > DateTime.Now)
            {
                ReminderTriggered?.Invoke(this, new ReminderEventArgs(calendarEvent));
            }
        };
        snoozeTimer.Start();

        System.Diagnostics.Debug.WriteLine($"[CalendarReminderService] Snoozed reminder for {calendarEvent.Subject} for {snoozeDuration.TotalMinutes} minutes");
    }

    /// <summary>
    /// Dismisses a reminder permanently
    /// </summary>
    public void DismissReminder(CalendarEvent calendarEvent)
    {
        var reminderId = $"{calendarEvent.Id}_{calendarEvent.Reminder}";
        _notifiedEventIds.Add(reminderId);

        System.Diagnostics.Debug.WriteLine($"[CalendarReminderService] Dismissed reminder for {calendarEvent.Subject}");
    }

    /// <summary>
    /// Clears notified events (useful for testing or when events are updated)
    /// </summary>
    public void ClearNotifiedEvents()
    {
        _notifiedEventIds.Clear();
    }

    public void Dispose()
    {
        if (_disposed) return;

        Stop();
        _checkTimer.Tick -= CheckTimer_Tick;
        _disposed = true;

        System.Diagnostics.Debug.WriteLine("[CalendarReminderService] Disposed");
    }

    /// <summary>
    /// Resets the singleton instance (for testing)
    /// </summary>
    public static void Reset()
    {
        lock (_lock)
        {
            _instance?.Dispose();
            _instance = null;
        }
    }
}

/// <summary>
/// Event arguments for reminder events
/// </summary>
public class ReminderEventArgs : EventArgs
{
    public CalendarEvent Event { get; }

    public ReminderEventArgs(CalendarEvent calendarEvent)
    {
        Event = calendarEvent;
    }
}
