using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
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
    private string _startTime = "8:00 AM";

    [ObservableProperty]
    private string _endTime = "8:30 AM";

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

    [ObservableProperty]
    private bool _isLoadingImages;

    [ObservableProperty]
    private string _loadingImagesMessage = string.Empty;

    // Recurrence properties
    [ObservableProperty]
    private bool _isRecurring;

    [ObservableProperty]
    private string _selectedRecurrenceType = "Daily";

    [ObservableProperty]
    private int _recurrenceInterval = 1;

    [ObservableProperty]
    private DateTime? _recurrenceEndDate;

    [ObservableProperty]
    private int? _recurrenceOccurrences;

    [ObservableProperty]
    private string _recurrenceEndOption = "Never";

    public ObservableCollection<string> RecurrenceTypeOptions { get; } = new();
    public ObservableCollection<string> RecurrenceEndOptions { get; } = new();
    public ObservableCollection<DayOfWeekItem> DaysOfWeekOptions { get; } = new();

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
        InitializeRecurrenceOptions();
        CalculateEventPosition();
    }

    private void InitializeRecurrenceOptions()
    {
        RecurrenceTypeOptions.Add("Daily");
        RecurrenceTypeOptions.Add("Weekly");
        RecurrenceTypeOptions.Add("Monthly");
        RecurrenceTypeOptions.Add("Yearly");

        RecurrenceEndOptions.Add("Never");
        RecurrenceEndOptions.Add("On date");
        RecurrenceEndOptions.Add("After occurrences");

        DaysOfWeekOptions.Add(new DayOfWeekItem { Name = "Sun", Day = DayOfWeek.Sunday });
        DaysOfWeekOptions.Add(new DayOfWeekItem { Name = "Mon", Day = DayOfWeek.Monday });
        DaysOfWeekOptions.Add(new DayOfWeekItem { Name = "Tue", Day = DayOfWeek.Tuesday });
        DaysOfWeekOptions.Add(new DayOfWeekItem { Name = "Wed", Day = DayOfWeek.Wednesday });
        DaysOfWeekOptions.Add(new DayOfWeekItem { Name = "Thu", Day = DayOfWeek.Thursday });
        DaysOfWeekOptions.Add(new DayOfWeekItem { Name = "Fri", Day = DayOfWeek.Friday });
        DaysOfWeekOptions.Add(new DayOfWeekItem { Name = "Sat", Day = DayOfWeek.Saturday });

        RecurrenceEndDate = DateTime.Today.AddMonths(3);
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
        StartTime = eventToEdit.StartTime.ToString("h:mm tt");
        EndTime = eventToEdit.EndTime.ToString("h:mm tt");
        IsAllDay = eventToEdit.IsAllDay;
        Attendees = string.Join("; ", eventToEdit.Attendees);

        // Set ShowAsStatus based on the saved Status
        ShowAsStatus = eventToEdit.Status switch
        {
            EventStatus.Free => ShowAsStatusOptions.FirstOrDefault(s => s.Name == "Free"),
            EventStatus.WorkingElsewhere => ShowAsStatusOptions.FirstOrDefault(s => s.Name == "Working elsewhere"),
            EventStatus.Tentative => ShowAsStatusOptions.FirstOrDefault(s => s.Name == "Tentative"),
            EventStatus.Busy => ShowAsStatusOptions.FirstOrDefault(s => s.Name == "Busy"),
            EventStatus.OutOfOffice => ShowAsStatusOptions.FirstOrDefault(s => s.Name == "Out of office"),
            _ => ShowAsStatusOptions.FirstOrDefault(s => s.Name == "Busy")
        };
        IsBusy = eventToEdit.Status == EventStatus.Busy;
        IsPrivate = eventToEdit.IsPrivate;
        IsInPerson = eventToEdit.IsInPerson;
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

        // Load recurrence data
        IsRecurring = eventToEdit.IsRecurring;
        if (eventToEdit.Recurrence != null)
        {
            SelectedRecurrenceType = eventToEdit.Recurrence.Type switch
            {
                RecurrenceType.Weekly => "Weekly",
                RecurrenceType.Monthly => "Monthly",
                RecurrenceType.Yearly => "Yearly",
                _ => "Daily"
            };
            RecurrenceInterval = eventToEdit.Recurrence.Interval;

            if (eventToEdit.Recurrence.EndDate.HasValue)
            {
                RecurrenceEndOption = "On date";
                RecurrenceEndDate = eventToEdit.Recurrence.EndDate.Value;
            }
            else if (eventToEdit.Recurrence.Occurrences.HasValue)
            {
                RecurrenceEndOption = "After occurrences";
                RecurrenceOccurrences = eventToEdit.Recurrence.Occurrences.Value;
            }
            else
            {
                RecurrenceEndOption = "Never";
            }

            // Set days of week for weekly
            if (eventToEdit.Recurrence.DaysOfWeek != null)
            {
                foreach (var dayItem in DaysOfWeekOptions)
                {
                    dayItem.IsSelected = eventToEdit.Recurrence.DaysOfWeek.Contains(dayItem.Day);
                }
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

        // Load existing images (sync for local data, async for URLs)
        Images.Clear();
        if (eventToEdit.Images != null && eventToEdit.Images.Count > 0)
        {
            LoadImagesAsync(eventToEdit.Images);
        }

        CalculateEventPosition();
    }

    /// <summary>
    /// Loads images asynchronously, downloading from URLs if necessary
    /// </summary>
    private async void LoadImagesAsync(List<EventImage> imagesToLoad)
    {
        try
        {
            IsLoadingImages = true;
            LoadingImagesMessage = "Loading images...";

            // Use ImageService to load images for display
            var loadedImages = await ImageService.Instance.LoadEventImagesForDisplayAsync(imagesToLoad);

            int loadedCount = 0;
            foreach (var (image, bitmap) in loadedImages)
            {
                loadedCount++;
                LoadingImagesMessage = $"Loading image {loadedCount} of {imagesToLoad.Count}...";

                if (bitmap != null)
                {
                    Images.Add(new EventImageViewModel
                    {
                        EventImage = image,
                        ImageSource = bitmap
                    });
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[NewEventViewModel] Failed to load image: {image.FileName}");
                }
            }

            System.Diagnostics.Debug.WriteLine($"[NewEventViewModel] Loaded {Images.Count} images successfully");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NewEventViewModel] Error loading images: {ex.Message}");
        }
        finally
        {
            IsLoadingImages = false;
            LoadingImagesMessage = string.Empty;
        }
    }

    private EventStatus GetEventStatusFromShowAs()
    {
        return ShowAsStatus?.Name switch
        {
            "Free" => EventStatus.Free,
            "Working elsewhere" => EventStatus.WorkingElsewhere,
            "Tentative" => EventStatus.Tentative,
            "Busy" => EventStatus.Busy,
            "Out of office" => EventStatus.OutOfOffice,
            _ => EventStatus.Busy
        };
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
        // Generate time options in 12-hour AM/PM format
        for (int hour = 0; hour < 24; hour++)
        {
            for (int minute = 0; minute < 60; minute += 30)
            {
                string period = hour < 12 ? "AM" : "PM";
                int displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
                TimeOptions.Add($"{displayHour}:{minute:D2} {period}");
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
        // Parse start time (12-hour AM/PM format) to get position
        if (DateTime.TryParse(StartTime, out var startDateTime))
        {
            EventTopPosition = startDateTime.TimeOfDay.TotalHours * 40;
        }

        // Calculate height based on duration
        if (DateTime.TryParse(StartTime, out var start) &&
            DateTime.TryParse(EndTime, out var end))
        {
            var duration = end.TimeOfDay - start.TimeOfDay;
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

    partial void OnEventDateChanged(DateTime value)
    {
        // Close the date picker popup when a date is selected
        IsDatePickerOpen = false;
    }

    [ObservableProperty]
    private bool _isDatePickerOpen;

    [RelayCommand]
    private void PreviousDay()
    {
        EventDate = EventDate.AddDays(-1);
    }

    [RelayCommand]
    private void NextDay()
    {
        EventDate = EventDate.AddDays(1);
    }

    [RelayCommand]
    private void ToggleDatePicker()
    {
        IsDatePickerOpen = !IsDatePickerOpen;
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

        // Parse start and end times (12-hour AM/PM format)
        var startDateTime = EventDate;
        var endDateTime = EventDate;

        if (!DateTime.TryParse(StartTime, out var startParsed))
        {
            ValidationError = "Invalid start time.";
            return;
        }

        if (!DateTime.TryParse(EndTime, out var endParsed))
        {
            ValidationError = "Invalid end time.";
            return;
        }

        startDateTime = EventDate.Add(startParsed.TimeOfDay);
        endDateTime = EventDate.Add(endParsed.TimeOfDay);

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
            Status = GetEventStatusFromShowAs(),
            IsPrivate = IsPrivate,
            IsInPerson = IsInPerson,
            Reminder = GetReminderTimeFromString(SelectedReminder),
            Category = EventCategory.None,
            CalendarName = "My Calendar",
            EventColor = eventColor,
            Attendees = attendeesList,
            Attachments = Attachments.ToList(),
            Images = Images.Select(i => i.EventImage).ToList(),
            IsRecurring = IsRecurring
        };

        // Populate recurrence pattern if recurring
        if (IsRecurring)
        {
            var recurrence = new RecurrencePattern
            {
                Type = SelectedRecurrenceType switch
                {
                    "Weekly" => RecurrenceType.Weekly,
                    "Monthly" => RecurrenceType.Monthly,
                    "Yearly" => RecurrenceType.Yearly,
                    _ => RecurrenceType.Daily
                },
                Interval = Math.Max(1, RecurrenceInterval)
            };

            // Set end condition
            if (RecurrenceEndOption == "On date" && RecurrenceEndDate.HasValue)
            {
                recurrence.EndDate = RecurrenceEndDate.Value;
            }
            else if (RecurrenceEndOption == "After occurrences" && RecurrenceOccurrences.HasValue)
            {
                recurrence.Occurrences = RecurrenceOccurrences.Value;
            }

            // Set days of week for weekly recurrence
            if (recurrence.Type == RecurrenceType.Weekly)
            {
                recurrence.DaysOfWeek = DaysOfWeekOptions
                    .Where(d => d.IsSelected)
                    .Select(d => d.Day)
                    .ToList();

                // Default to event day if none selected
                if (recurrence.DaysOfWeek.Count == 0)
                {
                    recurrence.DaysOfWeek.Add(startDateTime.DayOfWeek);
                }
            }

            CreatedEvent.Recurrence = recurrence;
        }

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

public class DayOfWeekItem : CommunityToolkit.Mvvm.ComponentModel.ObservableObject
{
    public string Name { get; set; } = string.Empty;
    public DayOfWeek Day { get; set; }

    private bool _isSelected;
    public bool IsSelected
    {
        get => _isSelected;
        set => SetProperty(ref _isSelected, value);
    }
}
