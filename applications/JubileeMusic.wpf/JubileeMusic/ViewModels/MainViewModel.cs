using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeMusic.Services;
using Microsoft.Extensions.Logging;

namespace JubileeMusic.ViewModels;

public partial class MainViewModel : BaseViewModel
{
    private readonly INavigationService _navigationService;
    private readonly ICredentialService _credentialService;
    private readonly ILibraryService _libraryService;
    private readonly ILogger<MainViewModel> _logger;

    [ObservableProperty]
    private string _currentViewName = "Browser";

    [ObservableProperty]
    private bool _isAuthenticated;

    [ObservableProperty]
    private string _windowTitle = "Jubilee Music - Suno Desktop";

    [ObservableProperty]
    private object? _currentViewModel;

    public BrowserViewModel BrowserViewModel { get; }
    public CreateViewModel CreateViewModel { get; }
    public LibraryViewModel LibraryViewModel { get; }
    public SettingsViewModel SettingsViewModel { get; }

    public MainViewModel(
        INavigationService navigationService,
        ICredentialService credentialService,
        ILibraryService libraryService,
        ILogger<MainViewModel> logger,
        BrowserViewModel browserViewModel,
        CreateViewModel createViewModel,
        LibraryViewModel libraryViewModel,
        SettingsViewModel settingsViewModel)
    {
        _navigationService = navigationService;
        _credentialService = credentialService;
        _libraryService = libraryService;
        _logger = logger;

        BrowserViewModel = browserViewModel;
        CreateViewModel = createViewModel;
        LibraryViewModel = libraryViewModel;
        SettingsViewModel = settingsViewModel;

        // Set initial view
        CurrentViewModel = BrowserViewModel;

        // Subscribe to navigation changes
        _navigationService.NavigationChanged += OnNavigationChanged;
    }

    private void OnNavigationChanged(object? sender, NavigationEventArgs e)
    {
        CurrentViewName = e.CurrentView;
        CurrentViewModel = e.CurrentView switch
        {
            "Browser" => BrowserViewModel,
            "Create" => CreateViewModel,
            "Library" => LibraryViewModel,
            "Settings" => SettingsViewModel,
            _ => BrowserViewModel
        };

        _logger.LogInformation("View changed to {View}", e.CurrentView);
    }

    [RelayCommand]
    private void NavigateToBrowser()
    {
        _navigationService.NavigateTo("Browser");
    }

    [RelayCommand]
    private void NavigateToCreate()
    {
        _navigationService.NavigateTo("Create");
    }

    [RelayCommand]
    private async Task NavigateToLibrary()
    {
        _navigationService.NavigateTo("Library");
        await LibraryViewModel.LoadTracksCommand.ExecuteAsync(null);
    }

    [RelayCommand]
    private void NavigateToSettings()
    {
        _navigationService.NavigateTo("Settings");
    }

    [RelayCommand]
    private void NavigateBack()
    {
        if (_navigationService.CanNavigateBack)
        {
            _navigationService.NavigateBack();
        }
    }

    public async Task InitializeAsync()
    {
        _logger.LogInformation("Initializing MainViewModel");

        try
        {
            // Initialize library
            await _libraryService.InitializeAsync();

            // Check for stored credentials
            var credentials = await _credentialService.GetCredentialsAsync();
            IsAuthenticated = credentials != null;

            _logger.LogInformation("MainViewModel initialized, authenticated: {Auth}", IsAuthenticated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize MainViewModel");
            SetError($"Initialization failed: {ex.Message}");
        }
    }
}
