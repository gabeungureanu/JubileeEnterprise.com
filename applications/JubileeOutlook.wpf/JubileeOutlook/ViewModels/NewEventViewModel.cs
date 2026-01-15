using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using System.Collections.ObjectModel;
using System.Windows.Media.Imaging;

namespace JubileeOutlook.ViewModels;

public partial class NewEventViewModel : ObservableObject
{
    public event EventHandler? SaveCompleted;
    public event EventHandler? DeleteCompleted;

    [ObservableProperty]
    private bool _isEditMode;

    [ObservableProperty]
    private string _windowTitle = "New event";

    private string? _editingEventId;

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

    [ObservableProperty]
    private string _validationError = string.Empty;

    public ObservableCollection<EventAttachment> Attachments { get; } = new();

    public ObservableCollection<EventImageViewModel> Images { get; } = new();

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

    public void LoadEventForEditing(CalendarEvent eventToEdit)
    {
        if (eventToEdit == null) return;

        IsEditMode = true;
        WindowTitle = "Edit event";
        _editingEventId = eventToEdit.Id;

        EventTitle = eventToEdit.Subject;
        Location = eventToEdit.Location;
        Description = eventToEdit.Description;
        EventDate = eventToEdit.StartTime.Date;
        StartTime = eventToEdit.StartTime.ToString("HH:mm");
        EndTime = eventToEdit.EndTime.ToString("HH:mm");
        IsAllDay = eventToEdit.IsAllDay;
        Attendees = string.Join("; ", eventToEdit.Attendees);

        IsBusy = eventToEdit.Status == EventStatus.Busy;
        IsPrivate = eventToEdit.IsPrivate;
        SelectedReminder = GetStringFromReminderTime(eventToEdit.Reminder);

        var colorHex = GetColorHexFromBrush(eventToEdit.EventColor);
        foreach (var category in CategoryOptions)
        {
            if (category.Color.Equals(colorHex, StringComparison.OrdinalIgnoreCase))
            {
                SelectedCategory = category;
                break;
            }
        }

        // Load existing attachments
        Attachments.Clear();
        if (eventToEdit.Attachments != null)
        {
            foreach (var attachment in eventToEdit.Attachments)
            {
                Attachments.Add(attachment);
            }
        }

        // Load existing images
        Images.Clear();
        if (eventToEdit.Images != null)
        {
            foreach (var image in eventToEdit.Images)
            {
                try
                {
                    BitmapImage? bitmapImage = null;

                    // Try to load from ImageData first (stored bytes)
                    if (image.ImageData != null && image.ImageData.Length > 0)
                    {
                        bitmapImage = new BitmapImage();
                        using var stream = new System.IO.MemoryStream(image.ImageData);
                        bitmapImage.BeginInit();
                        bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
                        bitmapImage.StreamSource = stream;
                        bitmapImage.EndInit();
                        bitmapImage.Freeze();
                    }
                    // Fallback to file path if available
                    else if (!string.IsNullOrEmpty(image.FilePath) && System.IO.File.Exists(image.FilePath))
                    {
                        bitmapImage = new BitmapImage();
                        bitmapImage.BeginInit();
                        bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
                        bitmapImage.UriSource = new Uri(image.FilePath);
                        bitmapImage.EndInit();
                        bitmapImage.Freeze();
                    }

                    if (bitmapImage != null)
                    {
                        Images.Add(new EventImageViewModel
                        {
                            EventImage = image,
                            ImageSource = bitmapImage
                        });
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[NewEventViewModel] Error loading image: {ex.Message}");
                }
            }
        }

        CalculateEventPosition();
    }

    private static string GetColorHexFromBrush(System.Windows.Media.Brush brush)
    {
        if (brush is System.Windows.Media.SolidColorBrush solidBrush)
        {
            var color = solidBrush.Color;
            return $"#{color.R:X2}{color.G:X2}{color.B:X2}";
        }
        return "#5B9BD5";
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

    private ReminderTime GetReminderTimeFromString(string reminderString)
    {
        return reminderString switch
        {
            "Don't remind me" => ReminderTime.None,
            "At time of event" => ReminderTime.AtTimeOfEvent,
            "5 minutes before" => ReminderTime.FiveMinutes,
            "15 minutes before" => ReminderTime.FifteenMinutes,
            "30 minutes before" => ReminderTime.ThirtyMinutes,
            "1 hour before" => ReminderTime.OneHour,
            "2 hours before" => ReminderTime.TwoHours,
            "1 day before" => ReminderTime.OneDay,
            "1 week before" => ReminderTime.OneWeek,
            _ => ReminderTime.FifteenMinutes
        };
    }

    private string GetStringFromReminderTime(ReminderTime reminder)
    {
        return reminder switch
        {
            ReminderTime.None => "Don't remind me",
            ReminderTime.AtTimeOfEvent => "At time of event",
            ReminderTime.FiveMinutes => "5 minutes before",
            ReminderTime.FifteenMinutes => "15 minutes before",
            ReminderTime.ThirtyMinutes => "30 minutes before",
            ReminderTime.OneHour => "1 hour before",
            ReminderTime.TwoHours => "2 hours before",
            ReminderTime.OneDay => "1 day before",
            ReminderTime.OneWeek => "1 week before",
            _ => "15 minutes before"
        };
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
        // Clear previous validation errors
        ValidationError = string.Empty;

        // Validate event title
        if (string.IsNullOrWhiteSpace(EventTitle))
        {
            ValidationError = "Event title is required.";
            return;
        }

        // Parse start and end times
        var startDateTime = EventDate;
        var endDateTime = EventDate;

        if (!TimeSpan.TryParse(StartTime, out var start))
        {
            ValidationError = "Invalid start time.";
            return;
        }

        if (!TimeSpan.TryParse(EndTime, out var end))
        {
            ValidationError = "Invalid end time.";
            return;
        }

        startDateTime = EventDate.Add(start);
        endDateTime = EventDate.Add(end);

        // Validate end time is after start time
        if (endDateTime <= startDateTime)
        {
            ValidationError = "End time must be after start time.";
            return;
        }

        // Determine event color based on category selection
        var eventColor = SelectedCategory?.Name switch
        {
            "Blue category" => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(91, 155, 213)),
            "Green category" => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(112, 173, 71)),
            "Orange category" => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(237, 125, 49)),
            "Purple category" => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(153, 102, 204)),
            "Red category" => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(231, 72, 86)),
            "Yellow category" => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 192, 0)),
            _ => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(91, 155, 213))
        };

        // Parse attendees from semicolon/comma separated string
        var attendeesList = string.IsNullOrWhiteSpace(Attendees)
            ? new List<string>()
            : Attendees.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
                       .Select(a => a.Trim())
                       .Where(a => !string.IsNullOrEmpty(a))
                       .ToList();

        CreatedEvent = new CalendarEvent
        {
            Id = IsEditMode && !string.IsNullOrEmpty(_editingEventId) ? _editingEventId : Guid.NewGuid().ToString(),
            Subject = EventTitle,
            Location = Location,
            StartTime = startDateTime,
            EndTime = endDateTime,
            Description = Description,
            IsAllDay = IsAllDay,
            Status = IsBusy ? EventStatus.Busy : EventStatus.Free,
            IsPrivate = IsPrivate,
            Reminder = GetReminderTimeFromString(SelectedReminder),
            Category = EventCategory.None,
            CalendarName = "My Calendar",
            EventColor = eventColor,
            Attendees = attendeesList,
            Attachments = Attachments.ToList(),
            Images = Images.Select(i => i.EventImage).ToList()
        };

        SaveCompleted?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void DeleteEvent()
    {
        if (IsEditMode && !string.IsNullOrEmpty(_editingEventId))
        {
            CreatedEvent = new CalendarEvent { Id = _editingEventId };
            DeleteCompleted?.Invoke(this, EventArgs.Empty);
        }
    }

    [RelayCommand]
    private void AddAttachment()
    {
        var openFileDialog = new Microsoft.Win32.OpenFileDialog
        {
            Title = "Select files to attach",
            Multiselect = true,
            Filter = "All Files (*.*)|*.*|" +
                     "Documents (*.pdf;*.doc;*.docx;*.xls;*.xlsx;*.ppt;*.pptx;*.txt)|*.pdf;*.doc;*.docx;*.xls;*.xlsx;*.ppt;*.pptx;*.txt|" +
                     "Images (*.jpg;*.jpeg;*.png;*.gif;*.bmp)|*.jpg;*.jpeg;*.png;*.gif;*.bmp|" +
                     "Archives (*.zip;*.rar;*.7z)|*.zip;*.rar;*.7z"
        };

        if (openFileDialog.ShowDialog() == true)
        {
            foreach (var filePath in openFileDialog.FileNames)
            {
                try
                {
                    var fileInfo = new System.IO.FileInfo(filePath);
                    var attachment = new EventAttachment
                    {
                        FileName = fileInfo.Name,
                        FilePath = filePath,
                        FileSize = fileInfo.Length,
                        AddedDate = DateTime.Now
                    };
                    Attachments.Add(attachment);
                }
                catch
                {
                    // Skip files that can't be accessed
                }
            }
        }
    }

    [RelayCommand]
    private void RemoveAttachment(EventAttachment? attachment)
    {
        if (attachment != null)
        {
            Attachments.Remove(attachment);
        }
    }

    [RelayCommand]
    private void InsertImage()
    {
        var openFileDialog = new Microsoft.Win32.OpenFileDialog
        {
            Title = "Select an image to insert",
            Multiselect = true,
            Filter = "Image Files (*.jpg;*.jpeg;*.png;*.gif;*.bmp)|*.jpg;*.jpeg;*.png;*.gif;*.bmp|" +
                     "JPEG Images (*.jpg;*.jpeg)|*.jpg;*.jpeg|" +
                     "PNG Images (*.png)|*.png|" +
                     "GIF Images (*.gif)|*.gif|" +
                     "Bitmap Images (*.bmp)|*.bmp|" +
                     "All Files (*.*)|*.*"
        };

        if (openFileDialog.ShowDialog() == true)
        {
            foreach (var filePath in openFileDialog.FileNames)
            {
                try
                {
                    var fileInfo = new System.IO.FileInfo(filePath);

                    // Read the image file into bytes
                    var imageData = System.IO.File.ReadAllBytes(filePath);

                    // Create BitmapImage for display
                    var bitmapImage = new BitmapImage();
                    bitmapImage.BeginInit();
                    bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
                    bitmapImage.UriSource = new Uri(filePath);
                    bitmapImage.EndInit();
                    bitmapImage.Freeze();

                    var eventImage = new EventImage
                    {
                        FileName = fileInfo.Name,
                        FilePath = filePath,
                        ImageData = imageData,
                        AddedDate = DateTime.Now
                    };

                    var imageViewModel = new EventImageViewModel
                    {
                        EventImage = eventImage,
                        ImageSource = bitmapImage
                    };

                    Images.Add(imageViewModel);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[NewEventViewModel] Error inserting image: {ex.Message}");
                }
            }
        }
    }

    [RelayCommand]
    private void RemoveImage(EventImageViewModel? image)
    {
        if (image != null)
        {
            Images.Remove(image);
        }
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

public class EventImageViewModel
{
    public EventImage EventImage { get; set; } = new();
    public BitmapImage? ImageSource { get; set; }
}
