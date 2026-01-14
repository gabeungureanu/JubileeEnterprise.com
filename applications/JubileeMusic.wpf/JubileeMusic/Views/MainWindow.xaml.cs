using System.Windows;
using JubileeMusic.Services;
using JubileeMusic.ViewModels;

namespace JubileeMusic.Views;

public partial class MainWindow : Window
{
    private readonly IWindowSettingsService _windowSettingsService;
    private readonly MainViewModel _viewModel;
    private WindowState _previousWindowState = WindowState.Normal;
    private WindowSettings _loadedSettings;

    public MainWindow(MainViewModel viewModel, IWindowSettingsService windowSettingsService)
    {
        _viewModel = viewModel;
        _windowSettingsService = windowSettingsService;

        // Load and apply settings before InitializeComponent
        _loadedSettings = _windowSettingsService.LoadSettings();
        ApplyWindowSettings(_loadedSettings);

        InitializeComponent();
        DataContext = viewModel;

        Loaded += async (s, e) =>
        {
            // Ensure window is visible and activated
            Activate();
            Focus();

            // Remove topmost after activation so it doesn't stay always on top
            Topmost = false;

            await viewModel.InitializeAsync();

            // Restore UI state after initialization
            RestoreUIState(_loadedSettings);
        };

        // Save settings when window state changes
        StateChanged += OnWindowStateChanged;
        LocationChanged += OnWindowPositionChanged;
        SizeChanged += OnWindowSizeChanged;
        Closing += OnWindowClosing;
    }

    private void ApplyWindowSettings(WindowSettings settings)
    {
        // Apply size
        Width = settings.Width;
        Height = settings.Height;

        // Apply position (if valid)
        if (!double.IsNaN(settings.Left) && !double.IsNaN(settings.Top))
        {
            Left = settings.Left;
            Top = settings.Top;
            WindowStartupLocation = WindowStartupLocation.Manual;
        }
        else
        {
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
        }

        // Apply window state (but store it to apply after window is shown)
        _previousWindowState = settings.WindowState;

        // Apply maximized state after the window is loaded
        if (settings.WindowState == WindowState.Maximized)
        {
            Loaded += (s, e) => WindowState = WindowState.Maximized;
        }
    }

    private void RestoreUIState(WindowSettings settings)
    {
        // Restore the last active view
        if (!string.IsNullOrEmpty(settings.LastView))
        {
            _viewModel.CurrentViewName = settings.LastView;
        }

        // Restore panel state and form data via the BrowserViewModel
        if (_viewModel.BrowserViewModel != null)
        {
            // Restore panel state
            _viewModel.BrowserViewModel.IsCreatorPanelOpen = settings.IsCreatorPanelOpen;

            // Restore form data if it was persisted
            if (settings.CreateFormState != null)
            {
                _viewModel.BrowserViewModel.Workspace = settings.CreateFormState.Workspace ?? string.Empty;
                _viewModel.BrowserViewModel.Title = settings.CreateFormState.Title ?? string.Empty;
                _viewModel.BrowserViewModel.MusicStyle = settings.CreateFormState.MusicStyle ?? string.Empty;
                _viewModel.BrowserViewModel.Lyrics = settings.CreateFormState.Lyrics ?? string.Empty;
                _viewModel.BrowserViewModel.IsInstrumental = settings.CreateFormState.IsInstrumental;
            }
        }
    }

    private void OnWindowStateChanged(object? sender, System.EventArgs e)
    {
        // Track the previous non-minimized state for saving
        if (WindowState != WindowState.Minimized)
        {
            _previousWindowState = WindowState;
        }
    }

    private void OnWindowPositionChanged(object? sender, System.EventArgs e)
    {
        // Position changes are saved on close to avoid excessive file writes
    }

    private void OnWindowSizeChanged(object sender, SizeChangedEventArgs e)
    {
        // Size changes are saved on close to avoid excessive file writes
    }

    private void OnWindowClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine("MainWindow.OnWindowClosing called");
        SaveCurrentSettings();
    }

    public void SaveCurrentSettings()
    {
        System.Diagnostics.Debug.WriteLine($"SaveCurrentSettings: WindowState={WindowState}, Left={Left}, Top={Top}, Width={Width}, Height={Height}");

        var settings = new WindowSettings
        {
            WindowState = _previousWindowState,
            LastView = _viewModel.CurrentViewName
        };

        // Only save size/position when not maximized (to remember the restored size)
        if (WindowState == WindowState.Normal)
        {
            settings.Left = Left;
            settings.Top = Top;
            settings.Width = Width;
            settings.Height = Height;
            settings.RestoreWidth = Width;
            settings.RestoreHeight = Height;
        }
        else
        {
            // When maximized, save the restore bounds
            settings.Left = RestoreBounds.Left;
            settings.Top = RestoreBounds.Top;
            settings.Width = RestoreBounds.Width;
            settings.Height = RestoreBounds.Height;
            settings.RestoreWidth = RestoreBounds.Width;
            settings.RestoreHeight = RestoreBounds.Height;
        }

        // Save panel state and form data
        if (_viewModel.BrowserViewModel != null)
        {
            settings.IsCreatorPanelOpen = _viewModel.BrowserViewModel.IsCreatorPanelOpen;

            // Only persist form data if the panel is open and has content
            if (_viewModel.BrowserViewModel.IsCreatorPanelOpen)
            {
                var browserVm = _viewModel.BrowserViewModel;
                if (!string.IsNullOrWhiteSpace(browserVm.Workspace) ||
                    !string.IsNullOrWhiteSpace(browserVm.Title) ||
                    !string.IsNullOrWhiteSpace(browserVm.MusicStyle) ||
                    !string.IsNullOrWhiteSpace(browserVm.Lyrics))
                {
                    settings.CreateFormState = new CreateFormState
                    {
                        Workspace = browserVm.Workspace,
                        Title = browserVm.Title,
                        MusicStyle = browserVm.MusicStyle,
                        Lyrics = browserVm.Lyrics,
                        IsInstrumental = browserVm.IsInstrumental
                    };
                }
            }
        }

        _windowSettingsService.SaveSettings(settings);
    }
}
