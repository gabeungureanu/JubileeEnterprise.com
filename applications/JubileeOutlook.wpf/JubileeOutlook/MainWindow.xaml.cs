using System.Windows;
using JubileeOutlook.ViewModels;
using JubileeOutlook.Services;

namespace JubileeOutlook;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        // Initialize services and ViewModel
        var mailService = new MockMailService();
        var calendarService = new MockCalendarService();
        var viewModel = new MainViewModel(mailService, calendarService);

        DataContext = viewModel;
    }
}