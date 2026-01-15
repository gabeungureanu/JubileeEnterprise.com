using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
using System.Collections.ObjectModel;
using System.Windows.Media;

namespace JubileeOutlook.ViewModels;

public partial class CalendarViewModel : ObservableObject
{
    private readonly ICalendarService _calendarService;

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

    public CalendarViewModel() : this(ServiceConfiguration.GetCalendarService())
    {
        Console.WriteLine($"[CalendarViewModel] Constructor called (parameterless)");
    }

    public CalendarViewModel(ICalendarService calendarService)
    {
        Console.WriteLine($"[CalendarViewModel] Constructor called with service: {calendarService.GetType().Name}");
        _calendarService = calendarService;
        InitializeCalendars();
        _ = LoadEventsAsync();
        UpdateViewDates();
        UpdateMiniCalendar();
    }

    private async Task LoadEventsAsync()
    {
        try
        {
            IsLoading = true;
            var startDate = DateTime.Today.AddMonths(-1);
            var endDate = DateTime.Today.AddMonths(3);

            var events = await _calendarService.GetEventsAsync(startDate, endDate);

            Events.Clear();
            foreach (var evt in events)
            {
                Events.Add(evt);
            }

            OnPropertyChanged(nameof(Events));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CalendarViewModel] Error loading events: {ex.Message}");
            InitializeSampleEvents();
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    private async Task RefreshEventsAsync()
    {
        await LoadEventsAsync();
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
    private void PreviousPeriod()
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
    }

    [RelayCommand]
    private void NextPeriod()
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
    }

    [RelayCommand]
    private void GoToToday()
    {
        SelectedDate = DateTime.Today;
        UpdateViewDates();
    }

    [RelayCommand]
    private void SetViewMode(string mode)
    {
        if (Enum.TryParse<CalendarViewMode>(mode, out var viewMode))
        {
            ViewMode = viewMode;
            UpdateViewDates();
        }
    }

    [RelayCommand]
    private async Task NewEventAsync()
    {
        Console.WriteLine($"[CalendarViewModel] NewEventAsync called");
        var newEventWindow = new JubileeOutlook.Views.NewEventWindow();
        var dialogResult = newEventWindow.ShowDialog();
        Console.WriteLine($"[CalendarViewModel] Dialog result: {dialogResult}");

        if (dialogResult == true)
        {
            var viewModel = newEventWindow.DataContext as JubileeOutlook.ViewModels.NewEventViewModel;
            Console.WriteLine($"[CalendarViewModel] ViewModel: {viewModel != null}, CreatedEvent: {viewModel?.CreatedEvent != null}");

            if (viewModel?.CreatedEvent != null)
            {
                Console.WriteLine($"[CalendarViewModel] Creating event: {viewModel.CreatedEvent.Subject}");
                try
                {
                    await _calendarService.CreateEventAsync(viewModel.CreatedEvent);
                    Events.Add(viewModel.CreatedEvent);
                    Console.WriteLine($"[CalendarViewModel] Event added. Total events: {Events.Count}");
                    OnPropertyChanged(nameof(Events));
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CalendarViewModel] Error creating event: {ex.Message}");
                    Events.Add(viewModel.CreatedEvent);
                    OnPropertyChanged(nameof(Events));
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
                    if (editEventWindow.IsDeleted)
                    {
                        await _calendarService.DeleteEventAsync(viewModel.CreatedEvent.Id);
                        var eventToRemove = Events.FirstOrDefault(e => e.Id == viewModel.CreatedEvent.Id);
                        if (eventToRemove != null)
                        {
                            Events.Remove(eventToRemove);
                        }
                    }
                    else
                    {
                        await _calendarService.UpdateEventAsync(viewModel.CreatedEvent);
                        var existingEvent = Events.FirstOrDefault(e => e.Id == viewModel.CreatedEvent.Id);
                        if (existingEvent != null)
                        {
                            var index = Events.IndexOf(existingEvent);
                            Events.RemoveAt(index);
                            Events.Insert(index, viewModel.CreatedEvent);
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CalendarViewModel] Error updating event: {ex.Message}");
                    if (!editEventWindow.IsDeleted)
                    {
                        var existingEvent = Events.FirstOrDefault(e => e.Id == viewModel.CreatedEvent.Id);
                        if (existingEvent != null)
                        {
                            var index = Events.IndexOf(existingEvent);
                            Events.RemoveAt(index);
                            Events.Insert(index, viewModel.CreatedEvent);
                        }
                    }
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
                VisibleDays = new ObservableCollection<DateTime> { SelectedDate.Date };
                break;

            case CalendarViewMode.WorkWeek:
                var startOfWeek = SelectedDate.AddDays(-(int)SelectedDate.DayOfWeek + (int)DayOfWeek.Monday);
                if (SelectedDate.DayOfWeek == DayOfWeek.Sunday)
                    startOfWeek = startOfWeek.AddDays(-7);

                ViewStartDate = startOfWeek;
                ViewEndDate = startOfWeek.AddDays(4); // Monday to Friday

                DateRangeText = $"{ViewStartDate:MMMM dd}–{ViewEndDate:dd, yyyy}";

                VisibleDays.Clear();
                for (int i = 0; i < 5; i++)
                {
                    VisibleDays.Add(ViewStartDate.AddDays(i));
                }
                break;

            case CalendarViewMode.Week:
                startOfWeek = SelectedDate.AddDays(-(int)SelectedDate.DayOfWeek + (int)DayOfWeek.Sunday);
                ViewStartDate = startOfWeek;
                ViewEndDate = startOfWeek.AddDays(6);

                DateRangeText = $"{ViewStartDate:MMMM dd}–{ViewEndDate:dd, yyyy}";

                VisibleDays.Clear();
                for (int i = 0; i < 7; i++)
                {
                    VisibleDays.Add(ViewStartDate.AddDays(i));
                }
                break;

            case CalendarViewMode.Month:
                var firstDayOfMonth = new DateTime(SelectedDate.Year, SelectedDate.Month, 1);
                ViewStartDate = firstDayOfMonth;
                ViewEndDate = firstDayOfMonth.AddMonths(1).AddDays(-1);
                DateRangeText = SelectedDate.ToString("MMMM yyyy");
                UpdateMonthViewDays();
                break;
        }
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
}
