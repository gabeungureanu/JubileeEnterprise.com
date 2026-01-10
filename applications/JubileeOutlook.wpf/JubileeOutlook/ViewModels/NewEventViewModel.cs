using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using System.Collections.ObjectModel;

namespace JubileeOutlook.ViewModels;

public partial class NewEventViewModel : ObservableObject
{
    public event EventHandler? SaveCompleted;

    [ObservableProperty]
    private string _eventTitle = string.Empty;

    [ObservableProperty]
    private string _attendees = string.Empty;

    [ObservableProperty]
    private DateTime _eventDate = DateTime.Today;

    [ObservableProperty]
    private string _startTime = "08:00";

    [ObservableProperty]
    private string _endTime = "08:30";

    [ObservableProperty]
    private ObservableCollection<string> _timeOptions = new();

    [ObservableProperty]
    private bool _isAllDay;

    [ObservableProperty]
    private string _location = string.Empty;

    [ObservableProperty]
    private bool _isInPerson = true;

    [ObservableProperty]
    private string _description = string.Empty;

    [ObservableProperty]
    private bool _isBusy = true;

    [ObservableProperty]
    private bool _isPrivate;

    [ObservableProperty]
    private ShowAsStatusItem? _showAsStatus;

    public ObservableCollection<ShowAsStatusItem> ShowAsStatusOptions { get; } = new();

    [ObservableProperty]
    private string _selectedReminder = "15 minutes before";

    public ObservableCollection<string> ReminderOptions { get; } = new();

    [ObservableProperty]
    private CategoryItem? _selectedCategory;

    public ObservableCollection<CategoryItem> CategoryOptions { get; } = new();

    [ObservableProperty]
    private ObservableCollection<TimeSlot> _timeSlots = new();

    [ObservableProperty]
    private double _eventTopPosition;

    [ObservableProperty]
    private double _eventHeight = 30;

    [ObservableProperty]
    private string _eventTimeRange = "08:00 - 08:30";

    public CalendarEvent? CreatedEvent { get; private set; }

    public NewEventViewModel()
    {
        InitializeTimeOptions();
        InitializeTimeSlots();
        InitializeStatusOptions();
        InitializeReminderOptions();
        InitializeCategoryOptions();
        CalculateEventPosition();
    }

    private void InitializeStatusOptions()
    {
        ShowAsStatusOptions.Add(new ShowAsStatusItem { Name = "Free", Color = "#FFFFFF" });
        ShowAsStatusOptions.Add(new ShowAsStatusItem { Name = "Working elsewhere", Color = "#9370DB" });
        ShowAsStatusOptions.Add(new ShowAsStatusItem { Name = "Tentative", Color = "#6495ED" });
        ShowAsStatusOptions.Add(new ShowAsStatusItem { Name = "Busy", Color = "#DC143C" });
        ShowAsStatusOptions.Add(new ShowAsStatusItem { Name = "Out of office", Color = "#9B30FF" });

        // Set default to Busy
        ShowAsStatus = ShowAsStatusOptions[3];
    }

    private void InitializeReminderOptions()
    {
        ReminderOptions.Add("Don't remind me");
        ReminderOptions.Add("At time of event");
        ReminderOptions.Add("5 minutes before");
        ReminderOptions.Add("15 minutes before");
        ReminderOptions.Add("30 minutes before");
        ReminderOptions.Add("1 hour before");
        ReminderOptions.Add("2 hours before");
        ReminderOptions.Add("12 hours before");
        ReminderOptions.Add("1 day before");
        ReminderOptions.Add("1 week before");

        // Set default to 15 minutes before
        SelectedReminder = "15 minutes before";
    }

    private void InitializeCategoryOptions()
    {
        CategoryOptions.Add(new CategoryItem { Name = "Blue category", Color = "#5B9BD5" });
        CategoryOptions.Add(new CategoryItem { Name = "Green category", Color = "#70AD47" });
        CategoryOptions.Add(new CategoryItem { Name = "Orange category", Color = "#ED7D31" });
        CategoryOptions.Add(new CategoryItem { Name = "Purple category", Color = "#9966CC" });
        CategoryOptions.Add(new CategoryItem { Name = "Red category", Color = "#E74856" });
        CategoryOptions.Add(new CategoryItem { Name = "Yellow category", Color = "#FFC000" });
        CategoryOptions.Add(new CategoryItem { Name = "New category", Color = "#CCCCCC" });
        CategoryOptions.Add(new CategoryItem { Name = "Manage categories", Color = "#AAAAAA" });

        // Set default to Blue category
        SelectedCategory = CategoryOptions[0];
    }

    private void InitializeTimeOptions()
    {
        for (int hour = 0; hour < 24; hour++)
        {
            for (int minute = 0; minute < 60; minute += 30)
            {
                TimeOptions.Add($"{hour:D2}:{minute:D2}");
            }
        }
    }

    private void InitializeTimeSlots()
    {
        for (int hour = 0; hour < 24; hour++)
        {
            TimeSlots.Add(new TimeSlot
            {
                Hour = hour == 0 ? "12 AM" :
                       hour < 12 ? $"{hour} AM" :
                       hour == 12 ? "12 PM" :
                       $"{hour - 12} PM",
                Position = hour * 40
            });
        }
    }

    private void CalculateEventPosition()
    {
        // Parse start time to get position (8:00 = 8 * 40 = 320)
        if (TimeSpan.TryParse(StartTime, out var start))
        {
            EventTopPosition = start.TotalHours * 40;
        }

        // Calculate height based on duration
        if (TimeSpan.TryParse(StartTime, out var startTime) &&
            TimeSpan.TryParse(EndTime, out var endTime))
        {
            var duration = endTime - startTime;
            EventHeight = Math.Max(duration.TotalHours * 40, 30);
            EventTimeRange = $"{StartTime} - {EndTime}";
        }
    }

    partial void OnStartTimeChanged(string value)
    {
        CalculateEventPosition();
    }

    partial void OnEndTimeChanged(string value)
    {
        CalculateEventPosition();
    }

    [RelayCommand]
    private void SaveEvent()
    {
        // Parse start and end times
        var startDateTime = EventDate;
        var endDateTime = EventDate;

        if (TimeSpan.TryParse(StartTime, out var start))
        {
            startDateTime = EventDate.Add(start);
        }

        if (TimeSpan.TryParse(EndTime, out var end))
        {
            endDateTime = EventDate.Add(end);
        }

        CreatedEvent = new CalendarEvent
        {
            Subject = EventTitle,
            Location = Location,
            StartTime = startDateTime,
            EndTime = endDateTime,
            Description = Description,
            IsAllDay = IsAllDay,
            Status = IsBusy ? EventStatus.Busy : EventStatus.Free,
            Category = EventCategory.None
        };

        SaveCompleted?.Invoke(this, EventArgs.Empty);
    }
}

public class TimeSlot
{
    public string Hour { get; set; } = string.Empty;
    public double Position { get; set; }
}

public class ShowAsStatusItem
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}

public class CategoryItem
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}
