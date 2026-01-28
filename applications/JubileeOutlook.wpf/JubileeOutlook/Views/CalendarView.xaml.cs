using System.Windows;
using System.Windows.Controls;
using JubileeOutlook.Services;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

public partial class CalendarView : UserControl
{
    private bool _reminderServiceInitialized;

    public CalendarView()
    {
        InitializeComponent();

        // Subscribe to visibility changes to load events when view becomes visible
        IsVisibleChanged += CalendarView_IsVisibleChanged;

        // Initialize reminder service when loaded
        Loaded += CalendarView_Loaded;
    }

    private void CalendarView_Loaded(object sender, RoutedEventArgs e)
    {
        InitializeReminderService();
    }

    private void InitializeReminderService()
    {
        if (_reminderServiceInitialized) return;

        if (DataContext is CalendarViewModel viewModel)
        {
            // Initialize and start the reminder service
            var reminderService = CalendarReminderService.Instance;
            reminderService.Initialize(viewModel);
            reminderService.ReminderTriggered += ReminderService_ReminderTriggered;
            reminderService.Start();

            _reminderServiceInitialized = true;
            System.Diagnostics.Debug.WriteLine("[CalendarView] Reminder service initialized and started");
        }
    }

    private void ReminderService_ReminderTriggered(object? sender, ReminderEventArgs e)
    {
        // Show the reminder popup on the UI thread
        Dispatcher.Invoke(() =>
        {
            var popup = new ReminderPopup(e.Event);
            popup.Show();

            System.Diagnostics.Debug.WriteLine($"[CalendarView] Showing reminder popup for: {e.Event.Subject}");
        });
    }

    private async void CalendarView_IsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if ((bool)e.NewValue && DataContext is CalendarViewModel viewModel)
        {
            System.Diagnostics.Debug.WriteLine($"[CalendarView] View became visible, activating...");
            await viewModel.OnViewActivatedAsync();
        }
    }

    /// <summary>
    /// Public method to refresh calendar events from the API
    /// Can be called from MainWindow when needed
    /// </summary>
    public async Task RefreshEventsAsync()
    {
        if (DataContext is CalendarViewModel viewModel)
        {
            System.Diagnostics.Debug.WriteLine($"[CalendarView] RefreshEventsAsync called");
            await viewModel.OnViewActivatedAsync();
        }
    }

    private void NewEventButton_Click(object sender, RoutedEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine("[CalendarView] NewEventButton_Click triggered");
        if (DataContext is CalendarViewModel viewModel)
        {
            System.Diagnostics.Debug.WriteLine("[CalendarView] Executing NewEventCommand");
            viewModel.NewEventCommand.Execute(null);
        }
        else
        {
            System.Diagnostics.Debug.WriteLine($"[CalendarView] DataContext is not CalendarViewModel: {DataContext?.GetType().Name ?? "null"}");
        }
    }
}
