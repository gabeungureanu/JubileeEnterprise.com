using System.Windows;
using System.Windows.Controls;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

public partial class CalendarView : UserControl
{
    public CalendarView()
    {
        InitializeComponent();
    }

    private void NewEventButton_Click(object sender, RoutedEventArgs e)
    {
        System.Console.WriteLine("[CalendarView] NewEventButton_Click triggered");
        if (DataContext is CalendarViewModel viewModel)
        {
            System.Console.WriteLine("[CalendarView] Executing NewEventCommand");
            // CommunityToolkit.Mvvm strips "Async" suffix, so NewEventAsync becomes NewEventCommand
            viewModel.NewEventCommand.Execute(null);
        }
        else
        {
            System.Console.WriteLine($"[CalendarView] DataContext is not CalendarViewModel: {DataContext?.GetType().Name ?? "null"}");
        }
    }
}
