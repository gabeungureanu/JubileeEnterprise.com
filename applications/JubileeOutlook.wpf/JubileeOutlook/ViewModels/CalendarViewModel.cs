using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
using System.Collections.ObjectModel;
using System.Windows.Media;

namespace JubileeOutlook.ViewModels;

public partial class CalendarViewModel : ObservableObject
{
    private ICalendarService _calendarService;
    private bool _isInitialized = false;
    private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(5);

    // Date range caching - tracks which date ranges have been loaded
    private readonly Dictionary<string, DateRangeCacheEntry> _dateRangeCache = new();
    private readonly object _cacheLock = new();

    // All cached events (master list)
    private readonly List<CalendarEvent> _cachedEvents = new();

    [ObservableProperty]
    private ObservableCollection<CalendarEvent> _events = new();

    [ObservableProperty]
    private ObservableCollection<Calendar> _calendars = new();

    [ObservableProperty]
    private CalendarViewMode _viewMode = CalendarViewMode.WorkWeek;

    [ObservableProperty]
    private DateTime _selectedDate = DateTime.Today;

    [ObservableProperty]
    private DateTime _viewStartDate;

    [ObservableProperty]
    private DateTime _viewEndDate;

    [ObservableProperty]
    private string _dateRangeText = string.Empty;

    [ObservableProperty]
    private ObservableCollection<DateTime> _visibleDays = new();

    [ObservableProperty]
    private string _miniCalendarMonthYear = string.Empty;

    [ObservableProperty]
    private ObservableCollection<DateTime> _miniCalendarDays = new();

    [ObservableProperty]
    private ObservableCollection<DateTime> _monthViewDays = new();

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string _loadingMessage = "Loading events...";

    [ObservableProperty]
    private string _errorMessage = string.Empty;

    [ObservableProperty]
    private bool _hasError;

    public CalendarViewModel() : this(ServiceConfiguration.GetCalendarService())
    {
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Constructor called (parameterless)");
    }

    public CalendarViewModel(ICalendarService calendarService)
    {
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Constructor called with service: {calendarService.GetType().Name}");
        _calendarService = calendarService;
        InitializeCalendars();
        UpdateViewDates();
        UpdateMiniCalendar();

        // Subscribe to service configuration changes
        ServiceConfiguration.ServicesChanged += OnServicesChanged;
        ServiceConfiguration.UserChanged += OnUserChanged;
    }

    /// <summary>
    /// Called when the calendar view is activated/shown
    /// Loads events from API if needed based on visible date range
    /// </summary>
    public async Task OnViewActivatedAsync()
    {
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] OnViewActivatedAsync called. Initialized: {_isInitialized}");
        try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"\n[{DateTime.Now:HH:mm:ss}] OnViewActivatedAsync called. Initialized: {_isInitialized}\n"); } catch { }

        // Refresh service reference in case it changed
        _calendarService = ServiceConfiguration.GetCalendarService();
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] CalendarService type: {_calendarService.GetType().Name}");
        try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] CalendarService type: {_calendarService.GetType().Name}\n"); } catch { }

        // Load events for the current visible date range
        await LoadEventsForVisibleRangeAsync();

        _isInitialized = true;
    }

    /// <summary>
    /// Loads events for the currently visible date range with caching
    /// </summary>
    private async Task LoadEventsForVisibleRangeAsync()
    {
        // Calculate the date range to load based on current view
        var (startDate, endDate) = GetVisibleDateRange();

        // Add buffer for navigation (load extra days on either side)
        var bufferDays = ViewMode == CalendarViewMode.Month ? 7 : 14;
        var loadStartDate = startDate.AddDays(-bufferDays);
        var loadEndDate = endDate.AddDays(bufferDays);

        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] LoadEventsForVisibleRangeAsync: {loadStartDate:yyyy-MM-dd} to {loadEndDate:yyyy-MM-dd}");
        try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] LoadEventsForVisibleRangeAsync: {loadStartDate:yyyy-MM-dd} to {loadEndDate:yyyy-MM-dd}\n"); } catch { }

        // Check if this range is already cached
        var isCached = IsDateRangeCached(loadStartDate, loadEndDate);
        try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] IsDateRangeCached: {isCached}\n"); } catch { }
        if (isCached)
        {
            System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Date range is cached, updating visible events");
            UpdateVisibleEventsFromCache(startDate, endDate);
            return;
        }

        // Load events from API for the uncached range
        await LoadEventsForRangeAsync(loadStartDate, loadEndDate);

        // Update visible events
        UpdateVisibleEventsFromCache(startDate, endDate);
        try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] After LoadEventsForRangeAsync, Events.Count: {Events.Count}\n"); } catch { }
    }

    /// <summary>
    /// Gets the visible date range based on current view mode
    /// </summary>
    private (DateTime startDate, DateTime endDate) GetVisibleDateRange()
    {
        return ViewMode switch
        {
            CalendarViewMode.Day => (ViewStartDate, ViewEndDate),
            CalendarViewMode.WorkWeek => (ViewStartDate, ViewEndDate),
            CalendarViewMode.Week => (ViewStartDate, ViewEndDate),
            CalendarViewMode.Month => (ViewStartDate, ViewEndDate),
            _ => (DateTime.Today.AddDays(-7), DateTime.Today.AddDays(7))
        };
    }

    /// <summary>
    /// Checks if a date range is already cached and not expired
    /// </summary>
    private bool IsDateRangeCached(DateTime startDate, DateTime endDate)
    {
        lock (_cacheLock)
        {
            // Check each month in the range
            var current = new DateTime(startDate.Year, startDate.Month, 1);
            while (current <= endDate)
            {
                var cacheKey = GetMonthCacheKey(current);
                if (!_dateRangeCache.TryGetValue(cacheKey, out var entry) ||
                    DateTime.UtcNow - entry.LoadedAt > _cacheExpiration)
                {
                    return false;
                }
                current = current.AddMonths(1);
            }
            return true;
        }
    }

    /// <summary>
    /// Gets a cache key for a month
    /// </summary>
    private static string GetMonthCacheKey(DateTime date)
    {
        return $"{date.Year}-{date.Month:D2}";
    }

    /// <summary>
    /// Updates the visible Events collection from the cache
    /// </summary>
    private void UpdateVisibleEventsFromCache(DateTime startDate, DateTime endDate)
    {
        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            lock (_cacheLock)
            {
                // Get events that fall within or overlap the visible range
                // Convert event times to local time for proper comparison with local date ranges
                var visibleEvents = _cachedEvents
                    .Where(e =>
                    {
                        // Convert UTC times to local for comparison
                        var localStartTime = e.StartTime.Kind == DateTimeKind.Utc
                            ? e.StartTime.ToLocalTime()
                            : e.StartTime;
                        var localEndTime = e.EndTime.Kind == DateTimeKind.Utc
                            ? e.EndTime.ToLocalTime()
                            : e.EndTime;

                        // Event overlaps with visible range if:
                        // - Event ends on or after the start date AND
                        // - Event starts before the end of the end date (next day midnight)
                        return localEndTime.Date >= startDate.Date && localStartTime.Date <= endDate.Date;
                    })
                    .OrderBy(e => e.StartTime)
                    .ToList();

                // Update the Events collection
                Events.Clear();
                foreach (var evt in visibleEvents)
                {
                    Events.Add(evt);
                }

                System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Updated visible events: {Events.Count} events for {startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}");
            }

            // Force property change notification to refresh bindings
            OnPropertyChanged(nameof(Events));
            OnPropertyChanged(nameof(VisibleDays));
        });
    }

    /// <summary>
    /// Handles service configuration changes
    /// </summary>
    private void OnServicesChanged(object? sender, EventArgs e)
    {
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Services changed, resetting state");
        _calendarService = ServiceConfiguration.GetCalendarService();
        ClearCache();
    }

    /// <summary>
    /// Handles user authentication changes
    /// </summary>
    private void OnUserChanged(object? sender, UserChangedEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] User changed: {e.PreviousUserId} -> {e.NewUserId}");
        ClearCache();

        // Clear events when user changes
        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            Events.Clear();
        });
    }

    /// <summary>
    /// Clears the event cache
    /// </summary>
    private void ClearCache()
    {
        lock (_cacheLock)
        {
            _dateRangeCache.Clear();
            _cachedEvents.Clear();
        }
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Cache cleared");
    }

    /// <summary>
    /// Loads events for a specific date range from the API and caches them
    /// </summary>
    private async Task LoadEventsForRangeAsync(DateTime startDate, DateTime endDate)
    {
        if (IsLoading) return;

        try
        {
            IsLoading = true;
            HasError = false;
            ErrorMessage = string.Empty;
            LoadingMessage = $"Loading events for {startDate:MMM yyyy}...";

            System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Loading events from {_calendarService.GetType().Name} for {startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}");

            var events = await _calendarService.GetEventsAsync(startDate, endDate);

            System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Loaded {events.Count} events from API");

            // Add to cache
            lock (_cacheLock)
            {
                // Add loaded events to cache (avoiding duplicates by ID)
                var existingIds = _cachedEvents.Select(e => e.Id).ToHashSet();
                foreach (var evt in events)
                {
                    if (!existingIds.Contains(evt.Id))
                    {
                        _cachedEvents.Add(evt);
                        existingIds.Add(evt.Id);
                    }
                    else
                    {
                        // Update existing event
                        var existingIndex = _cachedEvents.FindIndex(e => e.Id == evt.Id);
                        if (existingIndex >= 0)
                        {
                            _cachedEvents[existingIndex] = evt;
                        }
                    }
                }

                // Mark months as cached
                var current = new DateTime(startDate.Year, startDate.Month, 1);
                while (current <= endDate)
                {
                    var cacheKey = GetMonthCacheKey(current);
                    _dateRangeCache[cacheKey] = new DateRangeCacheEntry
                    {
                        StartDate = new DateTime(current.Year, current.Month, 1),
                        EndDate = new DateTime(current.Year, current.Month, DateTime.DaysInMonth(current.Year, current.Month)),
                        LoadedAt = DateTime.UtcNow
                    };
                    current = current.AddMonths(1);
                }

                System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Cache now contains {_cachedEvents.Count} events, {_dateRangeCache.Count} months cached");
            }

            // Show success notification for API service
            if (_calendarService is ApiCalendarService && events.Count > 0)
            {
                System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Successfully loaded {events.Count} events from API");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Error loading events: {ex.Message}");
            HasError = true;
            ErrorMessage = ResiliencePolicyService.GetFriendlyErrorMessage(ex);

            // Show error notification
            NotificationService.Instance.ShowError(
                $"Failed to load calendar events: {ErrorMessage}",
                "Calendar Error");

            // Fall back to sample events if no events loaded
            if (_cachedEvents.Count == 0)
            {
                System.Windows.Application.Current?.Dispatcher.Invoke(() =>
                {
                    InitializeSampleEvents();
                });
            }
        }
        finally
        {
            IsLoading = false;
            LoadingMessage = string.Empty;
        }
    }

    [RelayCommand]
    private async Task RefreshEventsAsync()
    {
        // Clear cache to force reload
        ClearCache();

        // Reload events for current visible range
        await LoadEventsForVisibleRangeAsync();
    }

    private void InitializeCalendars()
    {
        Calendars.Add(new Calendar
        {
            Name = "My Calendar",
            IsVisible = true,
            Color = new SolidColorBrush(Color.FromRgb(0, 120, 212)),
            Owner = "user@example.com"
        });

        Calendars.Add(new Calendar
        {
            Name = "Work",
            IsVisible = true,
            Color = new SolidColorBrush(Color.FromRgb(209, 52, 56)),
            Owner = "user@example.com"
        });

        Calendars.Add(new Calendar
        {
            Name = "Personal",
            IsVisible = true,
            Color = new SolidColorBrush(Color.FromRgb(16, 124, 16)),
            Owner = "user@example.com"
        });

        Calendars.Add(new Calendar
        {
            Name = "Holidays",
            IsVisible = false,
            Color = new SolidColorBrush(Color.FromRgb(255, 189, 89)),
            Owner = "holidays@calendar.com"
        });
    }

    private void InitializeSampleEvents()
    {
        var today = DateTime.Today;

        Events.Add(new CalendarEvent
        {
            Subject = "Team Standup",
            StartTime = today.AddDays(1).AddHours(9),
            EndTime = today.AddDays(1).AddHours(9.5),
            Location = "Conference Room A",
            Category = EventCategory.Business,
            CalendarName = "Work",
            EventColor = new SolidColorBrush(Color.FromRgb(209, 52, 56)),
            Organizer = "manager@company.com",
            Description = "Daily team sync-up meeting"
        });

        Events.Add(new CalendarEvent
        {
            Subject = "Project Review",
            StartTime = today.AddDays(2).AddHours(14),
            EndTime = today.AddDays(2).AddHours(15.5),
            Location = "Virtual - Teams",
            Category = EventCategory.Business,
            CalendarName = "Work",
            EventColor = new SolidColorBrush(Color.FromRgb(209, 52, 56)),
            Organizer = "director@company.com",
            Description = "Quarterly project review with stakeholders"
        });

        Events.Add(new CalendarEvent
        {
            Subject = "Lunch with Sarah",
            StartTime = today.AddDays(3).AddHours(12),
            EndTime = today.AddDays(3).AddHours(13),
            Location = "Downtown Cafe",
            Category = EventCategory.Personal,
            CalendarName = "Personal",
            EventColor = new SolidColorBrush(Color.FromRgb(16, 124, 16)),
            Description = "Catch up over lunch"
        });

        Events.Add(new CalendarEvent
        {
            Subject = "Dentist Appointment",
            StartTime = today.AddDays(4).AddHours(10),
            EndTime = today.AddDays(4).AddHours(11),
            Location = "Medical Plaza, Suite 300",
            Category = EventCategory.Personal,
            CalendarName = "Personal",
            EventColor = new SolidColorBrush(Color.FromRgb(16, 124, 16)),
            Description = "Regular checkup"
        });

        Events.Add(new CalendarEvent
        {
            Subject = "Client Presentation",
            StartTime = today.AddHours(15),
            EndTime = today.AddHours(16),
            Location = "Client Office",
            Category = EventCategory.Business,
            CalendarName = "Work",
            EventColor = new SolidColorBrush(Color.FromRgb(209, 52, 56)),
            Organizer = "sales@company.com",
            Description = "Product demo for potential client"
        });
    }

    [RelayCommand]
    private async Task PreviousPeriodAsync()
    {
        SelectedDate = ViewMode switch
        {
            CalendarViewMode.Day => SelectedDate.AddDays(-1),
            CalendarViewMode.WorkWeek => SelectedDate.AddDays(-7),
            CalendarViewMode.Week => SelectedDate.AddDays(-7),
            CalendarViewMode.Month => SelectedDate.AddMonths(-1),
            _ => SelectedDate
        };
        UpdateViewDates();

        // Lazy load events for the new date range
        await LoadEventsForVisibleRangeAsync();
    }

    [RelayCommand]
    private async Task NextPeriodAsync()
    {
        SelectedDate = ViewMode switch
        {
            CalendarViewMode.Day => SelectedDate.AddDays(1),
            CalendarViewMode.WorkWeek => SelectedDate.AddDays(7),
            CalendarViewMode.Week => SelectedDate.AddDays(7),
            CalendarViewMode.Month => SelectedDate.AddMonths(1),
            _ => SelectedDate
        };
        UpdateViewDates();

        // Lazy load events for the new date range
        await LoadEventsForVisibleRangeAsync();
    }

    [RelayCommand]
    private async Task GoToTodayAsync()
    {
        SelectedDate = DateTime.Today;
        UpdateViewDates();

        // Lazy load events for the new date range
        await LoadEventsForVisibleRangeAsync();
    }

    [RelayCommand]
    private async Task SetViewModeAsync(string mode)
    {
        if (Enum.TryParse<CalendarViewMode>(mode, out var viewMode))
        {
            ViewMode = viewMode;
            // Note: UpdateViewDates() is called by OnViewModeChanged partial method

            // Lazy load events for the new view
            await LoadEventsForVisibleRangeAsync();
        }
    }

    [RelayCommand]
    private async Task NewEventAsync()
    {
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] NewEventAsync called");
        var newEventWindow = new JubileeOutlook.Views.NewEventWindow();
        var dialogResult = newEventWindow.ShowDialog();
        System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Dialog result: {dialogResult}");

        if (dialogResult == true)
        {
            var viewModel = newEventWindow.DataContext as JubileeOutlook.ViewModels.NewEventViewModel;
            System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] ViewModel: {viewModel != null}, CreatedEvent: {viewModel?.CreatedEvent != null}");

            if (viewModel?.CreatedEvent != null)
            {
                System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Creating event: {viewModel.CreatedEvent.Subject}");

                try
                {
                    IsLoading = true;
                    LoadingMessage = "Creating event...";

                    // Upload images and attachments before creating event
                    if (viewModel.CreatedEvent.Images.Count > 0)
                    {
                        LoadingMessage = "Uploading images...";
                        viewModel.CreatedEvent.Images = await ImageService.Instance.UploadEventImagesAsync(viewModel.CreatedEvent.Images);
                    }

                    if (viewModel.CreatedEvent.Attachments.Count > 0)
                    {
                        LoadingMessage = "Uploading attachments...";
                        viewModel.CreatedEvent.Attachments = await ImageService.Instance.UploadEventAttachmentsAsync(viewModel.CreatedEvent.Attachments);
                    }

                    LoadingMessage = "Saving event...";
                    await _calendarService.CreateEventAsync(viewModel.CreatedEvent);
                    System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] CreateEventAsync completed, event ID: {viewModel.CreatedEvent.Id}");

                    // Add to cache and visible events
                    AddEventToCache(viewModel.CreatedEvent);
                    Events.Add(viewModel.CreatedEvent);
                    System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Event added. Total events: {Events.Count}");
                    OnPropertyChanged(nameof(Events));

                    NotificationService.Instance.ShowSuccess(
                        $"Event '{viewModel.CreatedEvent.Subject}' created successfully",
                        "Event Created");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Error creating event: {ex.Message}");
                    NotificationService.Instance.ShowError(
                        $"Failed to save event to server: {ResiliencePolicyService.GetFriendlyErrorMessage(ex)}",
                        "Create Event Error");

                    // Still add locally for offline support (to cache and visible events)
                    AddEventToCache(viewModel.CreatedEvent);
                    Events.Add(viewModel.CreatedEvent);
                    OnPropertyChanged(nameof(Events));
                }
                finally
                {
                    IsLoading = false;
                    LoadingMessage = string.Empty;
                }
            }
        }
    }

    [RelayCommand]
    private async Task EditEventAsync(CalendarEvent eventToEdit)
    {
        if (eventToEdit == null) return;

        var editEventWindow = new JubileeOutlook.Views.NewEventWindow(eventToEdit);
        if (editEventWindow.ShowDialog() == true)
        {
            var viewModel = editEventWindow.DataContext as JubileeOutlook.ViewModels.NewEventViewModel;
            if (viewModel?.CreatedEvent != null)
            {
                try
                {
                    IsLoading = true;

                    if (editEventWindow.IsDeleted)
                    {
                        LoadingMessage = "Deleting event...";
                        await _calendarService.DeleteEventAsync(viewModel.CreatedEvent.Id);

                        // Remove from cache and visible events
                        RemoveEventFromCache(viewModel.CreatedEvent.Id);
                        var eventToRemove = Events.FirstOrDefault(e => e.Id == viewModel.CreatedEvent.Id);
                        if (eventToRemove != null)
                        {
                            Events.Remove(eventToRemove);
                        }
                        NotificationService.Instance.ShowSuccess(
                            $"Event '{viewModel.CreatedEvent.Subject}' deleted successfully",
                            "Event Deleted");
                    }
                    else
                    {
                        // Upload any new images and attachments before updating event
                        if (viewModel.CreatedEvent.Images.Any(i => !i.IsUploaded))
                        {
                            LoadingMessage = "Uploading images...";
                            viewModel.CreatedEvent.Images = await ImageService.Instance.UploadEventImagesAsync(viewModel.CreatedEvent.Images);
                        }

                        if (viewModel.CreatedEvent.Attachments.Any(a => !a.IsUploaded))
                        {
                            LoadingMessage = "Uploading attachments...";
                            viewModel.CreatedEvent.Attachments = await ImageService.Instance.UploadEventAttachmentsAsync(viewModel.CreatedEvent.Attachments);
                        }

                        LoadingMessage = "Saving event...";
                        await _calendarService.UpdateEventAsync(viewModel.CreatedEvent);

                        // Update cache and visible events
                        AddEventToCache(viewModel.CreatedEvent);
                        var existingEvent = Events.FirstOrDefault(e => e.Id == viewModel.CreatedEvent.Id);
                        if (existingEvent != null)
                        {
                            var index = Events.IndexOf(existingEvent);
                            Events.RemoveAt(index);
                            Events.Insert(index, viewModel.CreatedEvent);
                        }
                        NotificationService.Instance.ShowSuccess(
                            $"Event '{viewModel.CreatedEvent.Subject}' updated successfully",
                            "Event Updated");
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[CalendarViewModel] Error updating event: {ex.Message}");

                    var action = editEventWindow.IsDeleted ? "delete" : "update";
                    NotificationService.Instance.ShowError(
                        $"Failed to {action} event: {ResiliencePolicyService.GetFriendlyErrorMessage(ex)}",
                        "Event Error");

                    // Apply changes locally anyway for offline support
                    if (!editEventWindow.IsDeleted)
                    {
                        // Update cache and visible events locally
                        AddEventToCache(viewModel.CreatedEvent);
                        var existingEvent = Events.FirstOrDefault(e => e.Id == viewModel.CreatedEvent.Id);
                        if (existingEvent != null)
                        {
                            var index = Events.IndexOf(existingEvent);
                            Events.RemoveAt(index);
                            Events.Insert(index, viewModel.CreatedEvent);
                        }
                    }
                }
                finally
                {
                    IsLoading = false;
                    LoadingMessage = string.Empty;
                }

                OnPropertyChanged(nameof(Events));
            }
        }
    }

    [RelayCommand]
    private void AddCalendar()
    {
        // This will be handled by the main application
        System.Diagnostics.Debug.WriteLine("Add Calendar requested");
    }

    [RelayCommand]
    private void ToggleCalendarVisibility(Calendar calendar)
    {
        if (calendar != null)
        {
            calendar.IsVisible = !calendar.IsVisible;
        }
    }

    partial void OnViewModeChanged(CalendarViewMode value)
    {
        UpdateViewDates();
    }

    private void UpdateViewDates()
    {
        switch (ViewMode)
        {
            case CalendarViewMode.Day:
                ViewStartDate = SelectedDate.Date;
                ViewEndDate = SelectedDate.Date;
                DateRangeText = SelectedDate.ToString("MMMM dd, yyyy");
                // Create new collection to trigger proper binding updates
                VisibleDays = new ObservableCollection<DateTime> { SelectedDate.Date };
                break;

            case CalendarViewMode.WorkWeek:
                var startOfWeek = SelectedDate.AddDays(-(int)SelectedDate.DayOfWeek + (int)DayOfWeek.Monday);
                if (SelectedDate.DayOfWeek == DayOfWeek.Sunday)
                    startOfWeek = startOfWeek.AddDays(-7);

                ViewStartDate = startOfWeek;
                ViewEndDate = startOfWeek.AddDays(4); // Monday to Friday

                DateRangeText = $"{ViewStartDate:MMMM dd}–{ViewEndDate:dd, yyyy}";

                // Create new collection to trigger proper binding updates
                var workWeekDays = new ObservableCollection<DateTime>();
                for (int i = 0; i < 5; i++)
                {
                    workWeekDays.Add(ViewStartDate.AddDays(i));
                }
                VisibleDays = workWeekDays;
                break;

            case CalendarViewMode.Week:
                startOfWeek = SelectedDate.AddDays(-(int)SelectedDate.DayOfWeek + (int)DayOfWeek.Sunday);
                ViewStartDate = startOfWeek;
                ViewEndDate = startOfWeek.AddDays(6);

                DateRangeText = $"{ViewStartDate:MMMM dd}–{ViewEndDate:dd, yyyy}";

                // Create new collection to trigger proper binding updates
                var weekDays = new ObservableCollection<DateTime>();
                for (int i = 0; i < 7; i++)
                {
                    weekDays.Add(ViewStartDate.AddDays(i));
                }
                VisibleDays = weekDays;
                break;

            case CalendarViewMode.Month:
                var firstDayOfMonth = new DateTime(SelectedDate.Year, SelectedDate.Month, 1);
                ViewStartDate = firstDayOfMonth;
                ViewEndDate = firstDayOfMonth.AddMonths(1).AddDays(-1);
                DateRangeText = SelectedDate.ToString("MMMM yyyy");
                UpdateMonthViewDays();
                break;
        }

        // Force refresh of all bindings to trigger MultiBinding converters
        // This ensures events are properly filtered after view/date changes
        OnPropertyChanged(nameof(VisibleDays));
        OnPropertyChanged(nameof(Events));
    }

    public ObservableCollection<CalendarEvent> GetEventsForDay(DateTime day)
    {
        var dayStart = day.Date;
        var dayEnd = day.Date.AddDays(1);

        var dayEvents = new ObservableCollection<CalendarEvent>(
            Events.Where(e => e.StartTime >= dayStart && e.StartTime < dayEnd)
                  .OrderBy(e => e.StartTime)
        );

        return dayEvents;
    }

    private void UpdateMiniCalendar()
    {
        // Update the month/year header based on selected date
        MiniCalendarMonthYear = SelectedDate.ToString("MMMM yyyy");

        // Calculate the days to display in the mini calendar (6 weeks x 7 days = 42 cells)
        MiniCalendarDays.Clear();

        var firstDayOfMonth = new DateTime(SelectedDate.Year, SelectedDate.Month, 1);
        var startOfCalendar = firstDayOfMonth.AddDays(-(int)firstDayOfMonth.DayOfWeek);

        // Generate 35 days (5 weeks) for the mini calendar
        for (int i = 0; i < 35; i++)
        {
            MiniCalendarDays.Add(startOfCalendar.AddDays(i));
        }
    }

    private void UpdateMonthViewDays()
    {
        MonthViewDays.Clear();

        var firstDayOfMonth = new DateTime(SelectedDate.Year, SelectedDate.Month, 1);
        var startOfCalendar = firstDayOfMonth.AddDays(-(int)firstDayOfMonth.DayOfWeek);

        // Generate 42 days (6 weeks) for the month view
        for (int i = 0; i < 42; i++)
        {
            MonthViewDays.Add(startOfCalendar.AddDays(i));
        }
    }

    partial void OnSelectedDateChanged(DateTime value)
    {
        UpdateMiniCalendar();
        if (ViewMode == CalendarViewMode.Month)
        {
            UpdateMonthViewDays();
        }
    }

    /// <summary>
    /// Adds an event to the cache
    /// </summary>
    private void AddEventToCache(CalendarEvent evt)
    {
        lock (_cacheLock)
        {
            var existingIndex = _cachedEvents.FindIndex(e => e.Id == evt.Id);
            if (existingIndex >= 0)
            {
                _cachedEvents[existingIndex] = evt;
            }
            else
            {
                _cachedEvents.Add(evt);
            }
        }
    }

    /// <summary>
    /// Removes an event from the cache
    /// </summary>
    private void RemoveEventFromCache(string eventId)
    {
        lock (_cacheLock)
        {
            var eventToRemove = _cachedEvents.FirstOrDefault(e => e.Id == eventId);
            if (eventToRemove != null)
            {
                _cachedEvents.Remove(eventToRemove);
            }
        }
    }

    /// <summary>
    /// Gets cache statistics for debugging
    /// </summary>
    public (int CachedEvents, int CachedMonths, DateTime? OldestEntry) GetCacheStats()
    {
        lock (_cacheLock)
        {
            var oldestEntry = _dateRangeCache.Values
                .OrderBy(e => e.LoadedAt)
                .FirstOrDefault()?.LoadedAt;

            return (_cachedEvents.Count, _dateRangeCache.Count, oldestEntry);
        }
    }
}

/// <summary>
/// Cache entry for a date range
/// </summary>
public class DateRangeCacheEntry
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime LoadedAt { get; set; }
}
