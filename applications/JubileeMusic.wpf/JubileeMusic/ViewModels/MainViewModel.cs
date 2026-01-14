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

    private string _currentViewName = "Browser";

    public string CurrentViewName
    {
        get => _currentViewName;
        set
        {
            if (SetProperty(ref _currentViewName, value))
            {
                // Also navigate to the view when set externally (e.g., from state restoration)
                NavigateToViewByName(value);
            }
        }
    }

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
        // Don't trigger the setter's navigation logic
        _currentViewName = e.CurrentView;
        OnPropertyChanged(nameof(CurrentViewName));

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

    private void NavigateToViewByName(string viewName)
    {
        var targetVm = viewName switch
        {
            "Browser" => (object?)BrowserViewModel,
            "Create" => CreateViewModel,
            "Library" => LibraryViewModel,
            "Settings" => SettingsViewModel,
            _ => BrowserViewModel
        };

        if (CurrentViewModel != targetVm)
        {
            CurrentViewModel = targetVm;
            _logger.LogInformation("View set to {View} from state restoration", viewName);
        }
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
    private void ToggleCreatePanel()
    {
        // Ensure we're on the Browser view first
        if (CurrentViewModel != BrowserViewModel)
        {
            _navigationService.NavigateTo("Browser");
        }

        // Toggle the creator panel
        BrowserViewModel.ToggleCreatorPanelCommand.Execute(null);
        _logger.LogDebug("Create panel toggled from main nav");
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
