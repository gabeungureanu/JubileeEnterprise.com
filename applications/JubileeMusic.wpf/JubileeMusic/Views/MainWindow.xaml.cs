using System.Windows;
using System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Interop;
using JubileeMusic.Services;
using JubileeMusic.ViewModels;

namespace JubileeMusic.Views;

public partial class MainWindow : Window
{
    private readonly IWindowSettingsService _windowSettingsService;
    private readonly MainViewModel _viewModel;
    private WindowState _previousWindowState = WindowState.Normal;
    private WindowSettings _loadedSettings;
    private Screen? _lastKnownScreen;

    public MainWindow(MainViewModel viewModel, IWindowSettingsService windowSettingsService)
    {
        _viewModel = viewModel;
        _windowSettingsService = windowSettingsService;

        // Load settings before InitializeComponent
        _loadedSettings = _windowSettingsService.LoadSettings();

        // Set WindowStartupLocation before InitializeComponent
        WindowStartupLocation = WindowStartupLocation.Manual;

        InitializeComponent();
        DataContext = viewModel;

        // Apply settings after InitializeComponent but before showing
        ApplyWindowSettings(_loadedSettings);

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
        System.Diagnostics.Debug.WriteLine($"[WINDOW] ApplyWindowSettings: Saved position ({settings.Left}, {settings.Top}), Monitor ({settings.MonitorLeft}, {settings.MonitorTop})");

        // Apply size first
        Width = settings.Width;
        Height = settings.Height;

        // Find the target screen
        Screen? targetScreen = null;

        // First priority: Find screen by saved monitor bounds
        if (!double.IsNaN(settings.MonitorLeft) && !double.IsNaN(settings.MonitorTop))
        {
            foreach (var screen in Screen.AllScreens)
            {
                var bounds = screen.Bounds;
                System.Diagnostics.Debug.WriteLine($"[WINDOW] Checking screen: {screen.DeviceName} at ({bounds.Left}, {bounds.Top}) {bounds.Width}x{bounds.Height}");

                // Match by monitor position (with tolerance for DPI differences)
                if (Math.Abs(bounds.Left - settings.MonitorLeft) < 100 &&
                    Math.Abs(bounds.Top - settings.MonitorTop) < 100)
                {
                    targetScreen = screen;
                    System.Diagnostics.Debug.WriteLine($"[WINDOW] Found matching screen by bounds: {screen.DeviceName}");
                    break;
                }
            }
        }

        // Second priority: Find screen that contains the saved window position
        if (targetScreen == null && !double.IsNaN(settings.Left) && !double.IsNaN(settings.Top))
        {
            var centerX = settings.Left + settings.Width / 2;
            var centerY = settings.Top + settings.Height / 2;

            foreach (var screen in Screen.AllScreens)
            {
                var bounds = screen.Bounds;
                if (centerX >= bounds.Left && centerX < bounds.Right &&
                    centerY >= bounds.Top && centerY < bounds.Bottom)
                {
                    targetScreen = screen;
                    System.Diagnostics.Debug.WriteLine($"[WINDOW] Found screen containing window center: {screen.DeviceName}");
                    break;
                }
            }
        }

        // Fallback to primary screen
        if (targetScreen == null)
        {
            targetScreen = Screen.PrimaryScreen;
            System.Diagnostics.Debug.WriteLine($"[WINDOW] Using primary screen: {targetScreen?.DeviceName}");
        }

        // Calculate final position
        double finalLeft, finalTop;

        if (!double.IsNaN(settings.Left) && !double.IsNaN(settings.Top) && targetScreen != null)
        {
            // If we have saved position and found the right screen, use the saved position
            // but ensure it's within the target screen's bounds
            var workArea = targetScreen.WorkingArea;

            finalLeft = settings.Left;
            finalTop = settings.Top;

            // Clamp to screen bounds
            if (finalLeft < workArea.Left)
                finalLeft = workArea.Left;
            if (finalTop < workArea.Top)
                finalTop = workArea.Top;
            if (finalLeft + Width > workArea.Right)
                finalLeft = workArea.Right - Width;
            if (finalTop + Height > workArea.Bottom)
                finalTop = workArea.Bottom - Height;

            System.Diagnostics.Debug.WriteLine($"[WINDOW] Using saved position (clamped): ({finalLeft}, {finalTop})");
        }
        else if (targetScreen != null)
        {
            // Center on target screen
            var workArea = targetScreen.WorkingArea;
            finalLeft = workArea.Left + (workArea.Width - Width) / 2;
            finalTop = workArea.Top + (workArea.Height - Height) / 2;
            System.Diagnostics.Debug.WriteLine($"[WINDOW] Centering on screen: ({finalLeft}, {finalTop})");
        }
        else
        {
            // Absolute fallback
            finalLeft = 100;
            finalTop = 100;
        }

        // Apply position
        Left = finalLeft;
        Top = finalTop;

        System.Diagnostics.Debug.WriteLine($"[WINDOW] Final position set: ({Left}, {Top})");

        // Store previous window state
        _previousWindowState = settings.WindowState;
        _lastKnownScreen = targetScreen;

        // Apply maximized state after the window is loaded
        if (settings.WindowState == WindowState.Maximized)
        {
            SourceInitialized += (s, e) =>
            {
                // Position window on correct monitor BEFORE maximizing
                if (_lastKnownScreen != null)
                {
                    var workArea = _lastKnownScreen.WorkingArea;
                    Left = workArea.Left + 100;
                    Top = workArea.Top + 100;
                }
                WindowState = WindowState.Maximized;
            };
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
            // Restore Creator panel state
            _viewModel.BrowserViewModel.IsCreatorPanelOpen = settings.IsCreatorPanelOpen;

            // Restore ChatGPT panel state
            _viewModel.BrowserViewModel.IsChatGptPanelOpen = settings.IsChatGptPanelOpen;
            _viewModel.BrowserViewModel.ChatGptPanelWidth = settings.ChatGptPanelWidth;

            // Restore form data if it was persisted
            if (settings.CreateFormState != null)
            {
                _viewModel.BrowserViewModel.Workspace = settings.CreateFormState.Workspace ?? string.Empty;
                _viewModel.BrowserViewModel.Title = settings.CreateFormState.Title ?? string.Empty;
                _viewModel.BrowserViewModel.MusicStyle = settings.CreateFormState.MusicStyle ?? string.Empty;
                _viewModel.BrowserViewModel.Lyrics = settings.CreateFormState.Lyrics ?? string.Empty;
                _viewModel.BrowserViewModel.IsInstrumental = settings.CreateFormState.IsInstrumental;
            }

            // Restore Suno WebView state
            if (settings.SunoZoomFactor > 0)
            {
                _viewModel.BrowserViewModel.SunoZoomFactor = settings.SunoZoomFactor;
                System.Diagnostics.Debug.WriteLine($"[WINDOW] Restored Suno zoom factor: {settings.SunoZoomFactor}");
            }

            // Store the last URL for restoration when WebView navigates
            if (!string.IsNullOrWhiteSpace(settings.SunoLastUrl))
            {
                _viewModel.BrowserViewModel.SunoLastUrl = settings.SunoLastUrl;
                System.Diagnostics.Debug.WriteLine($"[WINDOW] Restored Suno last URL: {settings.SunoLastUrl}");
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

        // Update last known screen when window changes state
        if (WindowState == WindowState.Normal)
        {
            _lastKnownScreen = GetCurrentScreen();
            // Update maximize button icon
            MaximizeButton.Content = "\uE922";
        }
        else if (WindowState == WindowState.Maximized)
        {
            // Update maximize button icon to restore
            MaximizeButton.Content = "\uE923";
        }
    }

    private void OnWindowPositionChanged(object? sender, System.EventArgs e)
    {
        // Update last known screen when position changes (for tracking which monitor we're on)
        if (WindowState == WindowState.Normal)
        {
            _lastKnownScreen = GetCurrentScreen();
        }
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
        System.Diagnostics.Debug.WriteLine($"[WINDOW] SaveCurrentSettings: WindowState={WindowState}, Left={Left}, Top={Top}, Width={Width}, Height={Height}");

        var settings = new WindowSettings
        {
            WindowState = _previousWindowState,
            LastView = _viewModel.CurrentViewName
        };

        // Get the current monitor info - use tracked screen for maximized windows
        Screen? currentScreen;
        if (WindowState == WindowState.Maximized && _lastKnownScreen != null)
        {
            currentScreen = _lastKnownScreen;
            System.Diagnostics.Debug.WriteLine($"[WINDOW] Using tracked screen for maximized window: {currentScreen.DeviceName}");
        }
        else
        {
            currentScreen = GetCurrentScreen();
        }

        if (currentScreen != null)
        {
            settings.MonitorDeviceName = currentScreen.DeviceName;
            settings.MonitorLeft = currentScreen.Bounds.Left;
            settings.MonitorTop = currentScreen.Bounds.Top;
            settings.MonitorWidth = currentScreen.Bounds.Width;
            settings.MonitorHeight = currentScreen.Bounds.Height;
            System.Diagnostics.Debug.WriteLine($"[WINDOW] Saving monitor info: {currentScreen.DeviceName} at ({settings.MonitorLeft}, {settings.MonitorTop})");
        }

        // Only save size/position when not maximized (to remember the restored size)
        if (WindowState == WindowState.Normal)
        {
            settings.Left = Left;
            settings.Top = Top;
            settings.Width = Width;
            settings.Height = Height;
            settings.RestoreWidth = Width;
            settings.RestoreHeight = Height;
            System.Diagnostics.Debug.WriteLine($"[WINDOW] Saving normal window position: ({settings.Left}, {settings.Top})");
        }
        else
        {
            // When maximized, save the restore bounds BUT ensure they're on the correct monitor
            var restoreLeft = RestoreBounds.Left;
            var restoreTop = RestoreBounds.Top;

            // If restore bounds would be on a different monitor than the current one,
            // calculate a position that's on the current monitor
            if (currentScreen != null)
            {
                var restoreCenterX = restoreLeft + RestoreBounds.Width / 2;
                var restoreCenterY = restoreTop + RestoreBounds.Height / 2;
                var bounds = currentScreen.Bounds;

                // Check if restore position is NOT on the current screen
                if (restoreCenterX < bounds.Left || restoreCenterX >= bounds.Right ||
                    restoreCenterY < bounds.Top || restoreCenterY >= bounds.Bottom)
                {
                    // Adjust restore position to be centered on current monitor
                    var workArea = currentScreen.WorkingArea;
                    restoreLeft = workArea.Left + (workArea.Width - RestoreBounds.Width) / 2;
                    restoreTop = workArea.Top + (workArea.Height - RestoreBounds.Height) / 2;
                    System.Diagnostics.Debug.WriteLine($"[WINDOW] Adjusted restore position to current monitor: ({restoreLeft}, {restoreTop})");
                }
            }

            settings.Left = restoreLeft;
            settings.Top = restoreTop;
            settings.Width = RestoreBounds.Width;
            settings.Height = RestoreBounds.Height;
            settings.RestoreWidth = RestoreBounds.Width;
            settings.RestoreHeight = RestoreBounds.Height;
            System.Diagnostics.Debug.WriteLine($"[WINDOW] Saving maximized window restore bounds: ({settings.Left}, {settings.Top})");
        }

        // Save panel state and form data
        if (_viewModel.BrowserViewModel != null)
        {
            settings.IsCreatorPanelOpen = _viewModel.BrowserViewModel.IsCreatorPanelOpen;

            // Save ChatGPT panel state
            settings.IsChatGptPanelOpen = _viewModel.BrowserViewModel.IsChatGptPanelOpen;
            settings.ChatGptPanelWidth = _viewModel.BrowserViewModel.ChatGptPanelWidth;

            // Save Suno WebView state
            settings.SunoZoomFactor = _viewModel.BrowserViewModel.SunoZoomFactor;
            settings.SunoLastUrl = _viewModel.BrowserViewModel.CurrentUrl;
            System.Diagnostics.Debug.WriteLine($"[WINDOW] Saving Suno state - Zoom: {settings.SunoZoomFactor}, URL: {settings.SunoLastUrl}");

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

    private Screen? GetCurrentScreen()
    {
        // Get the center point of the window
        var centerX = Left + Width / 2;
        var centerY = Top + Height / 2;

        // Find which screen contains the center of the window
        foreach (var screen in Screen.AllScreens)
        {
            if (centerX >= screen.Bounds.Left && centerX < screen.Bounds.Right &&
                centerY >= screen.Bounds.Top && centerY < screen.Bounds.Bottom)
            {
                return screen;
            }
        }

        // Fallback to primary screen
        return Screen.PrimaryScreen;
    }

    #region Window Control Handlers

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        // Don't handle if the click was on a button or other interactive element
        if (e.OriginalSource is System.Windows.Controls.Button ||
            (e.OriginalSource is FrameworkElement fe && fe.Parent is System.Windows.Controls.Button))
        {
            return;
        }

        if (e.ClickCount == 2)
        {
            // Double-click to toggle maximize/restore
            ToggleMaximize();
        }
        else
        {
            // Single click to drag
            if (e.LeftButton == MouseButtonState.Pressed)
            {
                DragMove();
            }
        }
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        ToggleMaximize();
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void ToggleMaximize()
    {
        if (WindowState == WindowState.Maximized)
        {
            WindowState = WindowState.Normal;
            // Update button icon to maximize
            MaximizeButton.Content = "\uE922";
        }
        else
        {
            WindowState = WindowState.Maximized;
            // Update button icon to restore
            MaximizeButton.Content = "\uE923";
        }
    }

    #endregion
}
