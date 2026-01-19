using System.Windows;
using System.Windows.Controls;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

public partial class CalendarView : UserControl
{
    public CalendarView()
    {
        InitializeComponent();

        // Subscribe to visibility changes to load events when view becomes visible
        IsVisibleChanged += CalendarView_IsVisibleChanged;
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
