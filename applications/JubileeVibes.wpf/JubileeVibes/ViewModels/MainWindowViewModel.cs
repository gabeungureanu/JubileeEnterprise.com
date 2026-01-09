using CommunityToolkit.Mvvm.ComponentModel;
using JubileeVibes.Core.Interfaces;

namespace JubileeVibes.ViewModels;

public partial class MainWindowViewModel : ViewModelBase
{
    private readonly INavigationService _navigationService;
    private readonly IAuthenticationService _authenticationService;

    [ObservableProperty]
    private string _title = "JubileeVibes";

    [ObservableProperty]
    private bool _canGoBack;

    [ObservableProperty]
    private bool _canGoForward;

    public MainWindowViewModel(
        INavigationService navigationService,
        IAuthenticationService authenticationService)
    {
        _navigationService = navigationService;
        _authenticationService = authenticationService;

        _navigationService.Navigated += OnNavigated;
        UpdateNavigationState();
    }

    private void OnNavigated(object? sender, NavigationEventArgs e)
    {
        UpdateNavigationState();
    }

    private void UpdateNavigationState()
    {
        CanGoBack = _navigationService.CanGoBack;
        CanGoForward = _navigationService.CanGoForward;
    }
}
