using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;

namespace JubileeOutlook.ViewModels;

/// <summary>
/// Application-level view model that manages the active module state
/// and coordinates between the app rail and content areas
/// </summary>
public partial class ApplicationViewModel : ObservableObject
{
    [ObservableProperty]
    private AppModule _activeModule = AppModule.Mail;

    [ObservableProperty]
    private MainViewModel? _mainViewModel;

    public ApplicationViewModel()
    {
    }

    public void Initialize(MainViewModel mainViewModel)
    {
        MainViewModel = mainViewModel;
    }

    partial void OnActiveModuleChanged(AppModule value)
    {
        // Update the MainViewModel's CurrentView to match the module
        if (MainViewModel != null)
        {
            MainViewModel.CurrentView = value switch
            {
                AppModule.Mail => "Mail",
                AppModule.Calendar => "Calendar",
                AppModule.People => "People",
                AppModule.Tasks => "Tasks",
                AppModule.Apps => "Apps",
                _ => "Mail"
            };
        }
    }

    [RelayCommand]
    private void SwitchToMail()
    {
        ActiveModule = AppModule.Mail;
    }

    [RelayCommand]
    private void SwitchToCalendar()
    {
        ActiveModule = AppModule.Calendar;
    }

    [RelayCommand]
    private void SwitchToPeople()
    {
        ActiveModule = AppModule.People;
    }

    [RelayCommand]
    private void SwitchToTasks()
    {
        ActiveModule = AppModule.Tasks;
    }

    [RelayCommand]
    private void SwitchToApps()
    {
        ActiveModule = AppModule.Apps;
    }

    [RelayCommand]
    private void OpenSettings()
    {
        // Settings panel logic - can be expanded
    }
}
