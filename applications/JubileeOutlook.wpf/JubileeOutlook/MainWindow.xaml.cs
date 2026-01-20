using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using JubileeOutlook.ViewModels;
using JubileeOutlook.Services;
using JubileeOutlook.Models;
using JubileeOutlook.Views;
using System.ComponentModel;
using IOPath = System.IO.Path;
using IOFile = System.IO.File;
using IODirectory = System.IO.Directory;

namespace JubileeOutlook;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private readonly ApplicationViewModel _appViewModel;
    private readonly AuthenticationManager _authManager;
    private readonly SecureStorageService _secureStorage;
    private readonly MainViewModel _mainViewModel;
    private bool _isLoaded;
    private ViewModels.ComposeMailViewModel? _composeMailViewModel;

    /// <summary>
    /// Event raised when initial data loading is complete.
    /// This allows the caller to know when the mail interface is fully ready to display.
    /// </summary>
    public event EventHandler? DataLoadingComplete;

    // Window state persistence file path
    private static readonly string WindowStateFilePath = IOPath.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "JubileeOutlook",
        "windowstate.json");

    // Debug log file path
    private static readonly string LogPath = IOPath.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "JubileeOutlook", "wwbw_debug.log");

    #region Win32 Interop for Taskbar-Aware Maximize

    private const int WM_GETMINMAXINFO = 0x0024;

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MINMAXINFO
    {
        public POINT ptReserved;
        public POINT ptMaxSize;
        public POINT ptMaxPosition;
        public POINT ptMinTrackSize;
        public POINT ptMaxTrackSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    private const uint MONITOR_DEFAULTTONEAREST = 0x00000002;

    #endregion

    private void LogDebug(string message)
    {
        try
        {
            var dir = IOPath.GetDirectoryName(LogPath);
            if (!string.IsNullOrEmpty(dir) && !IODirectory.Exists(dir))
                IODirectory.CreateDirectory(dir);
            IOFile.AppendAllText(LogPath, $"[{DateTime.Now:HH:mm:ss}] {message}\n");
        }
        catch { }
    }

    public MainWindow()
    {
        InitializeComponent();

        // Initialize service configuration FIRST (reads from environment and config)
        // This must happen before getting any services
        ServiceConfiguration.Initialize();

        // Start network monitoring early and perform initial health check
        // This ensures IsApiReachable is set before services try to load data
        var networkService = NetworkStatusService.Instance;
        _ = networkService.CheckNetworkStatusAsync(); // Fire initial check (don't wait)

        // Initialize services and ViewModels using ServiceConfiguration
        // ServiceConfiguration determines whether to use API or Mock services based on config
        var mailService = ServiceConfiguration.GetMailService();
        var calendarService = ServiceConfiguration.GetCalendarService();
        _mainViewModel = new MainViewModel(mailService, calendarService);

        // Create ApplicationViewModel and wire it up
        _appViewModel = new ApplicationViewModel();
        _appViewModel.Initialize(_mainViewModel);

        // Initialize authentication
        _authManager = new AuthenticationManager();
        _secureStorage = new SecureStorageService();
        _authManager.SessionChanged += OnAuthSessionChanged;

        // Subscribe to module changes to update UI
        _appViewModel.PropertyChanged += AppViewModel_PropertyChanged;

        // Subscribe to MainViewModel property changes to handle email selection while composing
        _mainViewModel.PropertyChanged += MainViewModel_PropertyChanged;

        // Subscribe to folder pane toggle event
        _appViewModel.ToggleFolderPaneRequested += (s, e) => HamburgerMenu_Click(s ?? this, new RoutedEventArgs());

        // Set the DataContext to a composite object containing both view models
        DataContext = new WindowDataContext
        {
            AppViewModel = _appViewModel,
            MainViewModel = _mainViewModel
        };

        // Restore window state before loading
        RestoreWindowState();

        // Hook into source initialized to add Win32 message handling for taskbar-aware maximize
        SourceInitialized += MainWindow_SourceInitialized;

        // Handle state changes
        StateChanged += MainWindow_StateChanged;

        // Save window state on various events
        LocationChanged += MainWindow_LocationChanged;
        SizeChanged += MainWindow_SizeChanged;

        // Set initial state after loading
        Loaded += async (s, e) =>
        {
            try
            {
                Console.WriteLine("[MainWindow] Loaded event started");
                _isLoaded = true;
                // Ensure Home tab content is visible on start
                ShowTabContent("HomeTab");
                Console.WriteLine("[MainWindow] ShowTabContent done");
                // Ensure Mail module is visible on start
                ShowModuleContent(AppModule.Mail);
                Console.WriteLine("[MainWindow] ShowModuleContent done");
                // Initialize notification service for user-friendly error messages
                NotificationService.Instance.Initialize(NotificationContainer);
                Console.WriteLine("[MainWindow] NotificationService initialized");
                // Initialize offline status monitoring (network service already started in constructor)
                InitializeOfflineStatusMonitoring();
                Console.WriteLine("[MainWindow] OfflineStatusMonitoring initialized");

                // Wait for initial network check to complete before loading data
                var networkService = NetworkStatusService.Instance;
                Console.WriteLine("[MainWindow] Checking network status...");
                await networkService.CheckNetworkStatusAsync();
                Console.WriteLine($"[MainWindow] Network status - Online: {networkService.IsOnline}, API Reachable: {networkService.IsApiReachable}");

                // Initialize authentication state
                Console.WriteLine("[MainWindow] Initializing auth...");
                await _authManager.InitializeAsync();
                Console.WriteLine("[MainWindow] Auth initialized");
                UpdateProfileUI();
                Console.WriteLine("[MainWindow] Profile UI updated");
                // Start the animated accent bar
                StartAccentBarAnimation();
                Console.WriteLine("[MainWindow] Accent bar animation started");

                // Update loading overlay status
                LoadingStatusText.Text = "Loading your emails...";

                // Now load data after network status is confirmed
                Console.WriteLine("[MainWindow] Loading initial data...");
                await _mainViewModel.InitializeDataAsync();
                Console.WriteLine("[MainWindow] Initial data loaded");

                // Hide the loading overlay - data is ready
                LoadingOverlay.Visibility = Visibility.Collapsed;
                Console.WriteLine("[MainWindow] Loading overlay hidden");

                // Signal that data loading is complete - mail interface is ready
                Console.WriteLine("[MainWindow] Raising DataLoadingComplete event");
                DataLoadingComplete?.Invoke(this, EventArgs.Empty);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MainWindow] ERROR in Loaded event: {ex.Message}");
                Console.WriteLine($"[MainWindow] StackTrace: {ex.StackTrace}");
                Console.WriteLine($"[MainWindow] InnerException: {ex.InnerException?.Message}");

                // Hide the loading overlay even on error
                LoadingOverlay.Visibility = Visibility.Collapsed;

                // Still signal completion even on error so the transition happens
                DataLoadingComplete?.Invoke(this, EventArgs.Empty);
            }
        };

        // Save window state on closing
        Closing += MainWindow_Closing;
    }

    #region Win32 Message Processing for Taskbar-Aware Maximize

    private void MainWindow_SourceInitialized(object? sender, EventArgs e)
    {
        var handle = new WindowInteropHelper(this).Handle;
        var source = HwndSource.FromHwnd(handle);
        source?.AddHook(WindowProc);
    }

    private IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_GETMINMAXINFO)
        {
            WmGetMinMaxInfo(hwnd, lParam);
            handled = true;
        }

        return IntPtr.Zero;
    }

    private void WmGetMinMaxInfo(IntPtr hwnd, IntPtr lParam)
    {
        var mmi = Marshal.PtrToStructure<MINMAXINFO>(lParam);

        // Get the monitor that contains the window
        var monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if (monitor != IntPtr.Zero)
        {
            var monitorInfo = new MONITORINFO();
            monitorInfo.cbSize = Marshal.SizeOf(typeof(MONITORINFO));

            if (GetMonitorInfo(monitor, ref monitorInfo))
            {
                // rcWork is the work area (excluding taskbar)
                var workArea = monitorInfo.rcWork;
                var monitorArea = monitorInfo.rcMonitor;

                // Set the maximized position to the top-left of the work area
                mmi.ptMaxPosition.x = workArea.Left - monitorArea.Left;
                mmi.ptMaxPosition.y = workArea.Top - monitorArea.Top;

                // Set the maximized size to the work area dimensions
                mmi.ptMaxSize.x = workArea.Right - workArea.Left;
                mmi.ptMaxSize.y = workArea.Bottom - workArea.Top;

                // Set minimum tracking size (minimum window size when resizing)
                mmi.ptMinTrackSize.x = (int)(MinWidth * VisualTreeHelper.GetDpi(this).DpiScaleX);
                mmi.ptMinTrackSize.y = (int)(MinHeight * VisualTreeHelper.GetDpi(this).DpiScaleY);
            }
        }

        Marshal.StructureToPtr(mmi, lParam, true);
    }

    #endregion

    #region Window State Event Handlers

    private void MainWindow_LocationChanged(object? sender, EventArgs e)
    {
        // Debounce - will be saved on close or state change
    }

    private void MainWindow_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        // Debounce - will be saved on close or state change
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        SaveWindowState();
    }

    private void MainWindow_StateChanged(object? sender, EventArgs e)
    {
        // Update maximize icon based on window state
        if (MaximizeButton != null)
        {
            MaximizeButton.Content = WindowState == WindowState.Maximized ? "\uE923" : "\uE922";
        }

        // Save state when maximizing/restoring (but not minimizing)
        if (_isLoaded && WindowState != WindowState.Minimized)
        {
            SaveWindowState();
        }
    }

    #endregion

    #region Window State Persistence

    private void SaveWindowState()
    {
        try
        {
            var directory = IOPath.GetDirectoryName(WindowStateFilePath);
            if (!string.IsNullOrEmpty(directory) && !IODirectory.Exists(directory))
            {
                IODirectory.CreateDirectory(directory);
            }

            var state = new WindowStateData
            {
                Left = RestoreBounds.Left,
                Top = RestoreBounds.Top,
                Width = RestoreBounds.Width,
                Height = RestoreBounds.Height,
                IsMaximized = WindowState == WindowState.Maximized,
                IsFirstRun = false
            };

            // Save panel widths
            if (FolderPaneColumn != null && FolderPaneColumn.Width.IsAbsolute)
            {
                state.FolderPaneWidth = FolderPaneColumn.Width.Value;
            }
            if (MessageListColumn != null && MessageListColumn.Width.IsAbsolute)
            {
                state.MessageListWidth = MessageListColumn.Width.Value;
            }

            var json = JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true });
            IOFile.WriteAllText(WindowStateFilePath, json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to save window state: {ex.Message}");
        }
    }

    private void RestoreWindowState()
    {
        try
        {
            if (IOFile.Exists(WindowStateFilePath))
            {
                var json = IOFile.ReadAllText(WindowStateFilePath);
                var state = JsonSerializer.Deserialize<WindowStateData>(json);

                if (state != null)
                {
                    // Handle first run or invalid settings
                    if (state.IsFirstRun || double.IsNaN(state.Left) || double.IsNaN(state.Top))
                    {
                        WindowStartupLocation = WindowStartupLocation.CenterScreen;
                    }
                    else
                    {
                        // Get primary screen work area
                        var workArea = SystemParameters.WorkArea;

                        // Ensure window is at least partially visible
                        double left = state.Left;
                        double top = state.Top;
                        double width = Math.Max(state.Width, MinWidth);
                        double height = Math.Max(state.Height, MinHeight);

                        // Clamp to work area bounds (ensure at least 50 pixels visible)
                        if (left < workArea.Left - width + 50)
                            left = workArea.Left;
                        if (top < workArea.Top)
                            top = workArea.Top;
                        if (left > workArea.Right - 50)
                            left = workArea.Right - width;
                        if (top > workArea.Bottom - 50)
                            top = workArea.Bottom - height;

                        WindowStartupLocation = WindowStartupLocation.Manual;
                        Left = left;
                        Top = top;
                        Width = width;
                        Height = height;
                    }

                    // Restore window state (but not if minimized - restore to normal instead)
                    if (state.IsMaximized)
                    {
                        WindowState = WindowState.Maximized;
                    }
                    else
                    {
                        WindowState = WindowState.Normal;
                    }

                    // Restore panel widths
                    if (FolderPaneColumn != null && state.FolderPaneWidth > 0)
                    {
                        FolderPaneColumn.Width = new GridLength(state.FolderPaneWidth);
                    }
                    if (MessageListColumn != null && state.MessageListWidth > 0)
                    {
                        MessageListColumn.Width = new GridLength(state.MessageListWidth);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to restore window state: {ex.Message}");
        }
    }

    #endregion

    #region Animated Accent Bar

    private Storyboard? _accentBarStoryboard;

    private void StartAccentBarAnimation()
    {
        try
        {
            // Create a storyboard for the gold light sweep animation
            _accentBarStoryboard = new Storyboard
            {
                RepeatBehavior = RepeatBehavior.Forever
            };

            // Create the animation for TranslateTransform.X
            // The light sweep starts off-screen left (-600) and moves across to off-screen right
            var animation = new DoubleAnimation
            {
                From = -600,
                To = ActualWidth + 100, // Go slightly beyond the window width
                Duration = TimeSpan.FromSeconds(2.5),
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            };

            // Set the target
            Storyboard.SetTargetName(animation, "GoldLightTransform");
            Storyboard.SetTargetProperty(animation, new PropertyPath(TranslateTransform.XProperty));

            _accentBarStoryboard.Children.Add(animation);
            _accentBarStoryboard.Begin(this, true);

            // Update animation when window size changes
            SizeChanged += UpdateAccentBarAnimation;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to start accent bar animation: {ex.Message}");
        }
    }

    private void UpdateAccentBarAnimation(object sender, SizeChangedEventArgs e)
    {
        // Restart animation with new window width when resized
        if (_accentBarStoryboard != null && _isLoaded)
        {
            try
            {
                _accentBarStoryboard.Stop(this);

                _accentBarStoryboard = new Storyboard
                {
                    RepeatBehavior = RepeatBehavior.Forever
                };

                var animation = new DoubleAnimation
                {
                    From = -600,
                    To = ActualWidth + 100,
                    Duration = TimeSpan.FromSeconds(2.5),
                    EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
                };

                Storyboard.SetTargetName(animation, "GoldLightTransform");
                Storyboard.SetTargetProperty(animation, new PropertyPath(TranslateTransform.XProperty));

                _accentBarStoryboard.Children.Add(animation);
                _accentBarStoryboard.Begin(this, true);
            }
            catch
            {
                // Silently ignore animation errors during resize
            }
        }
    }

    #endregion

    private void OnAuthSessionChanged(object? sender, AuthSession session)
    {
        Dispatcher.Invoke(() => UpdateProfileUI());
    }

    private void UpdateProfileUI()
    {
        var session = _authManager.Session;
        var dataContext = DataContext as WindowDataContext;

        LogDebug($"UpdateProfileUI called - IsAuthenticated={session.IsAuthenticated}, State={session.State}");

        if (session.IsAuthenticated && session.Profile != null)
        {
            LogDebug($"User authenticated: {session.Profile.Email}");
            // Signed in state
            ProfileDefaultAvatar.Visibility = Visibility.Collapsed;
            ProfileDefaultIcon.Visibility = Visibility.Collapsed;
            ProfileUserAvatar.Visibility = Visibility.Visible;
            ProfileSyncIndicator.Visibility = Visibility.Visible;

            ProfileSignedOutPanel.Visibility = Visibility.Collapsed;
            ProfileSignedInPanel.Visibility = Visibility.Visible;

            ProfilePopupName.Text = session.Profile.DisplayName;
            ProfilePopupEmail.Text = session.Profile.Email;

            // Load avatar if available
            if (!string.IsNullOrEmpty(session.Profile.AvatarUrl))
            {
                try
                {
                    var bitmap = new BitmapImage(new Uri(session.Profile.AvatarUrl));
                    ProfileAvatarImage.ImageSource = bitmap;
                    ProfilePopupAvatarImage.ImageSource = bitmap;
                }
                catch
                {
                    // Use default avatar on error
                }
            }

            ProfileButton.ToolTip = session.Profile.DisplayName;

            // Fetch WWBW email address and update folder tree
            _ = FetchAndSetWwbwEmailAsync();
        }
        else
        {
            // Signed out state
            ProfileDefaultAvatar.Visibility = Visibility.Visible;
            ProfileDefaultIcon.Visibility = Visibility.Visible;
            ProfileUserAvatar.Visibility = Visibility.Collapsed;
            ProfileSyncIndicator.Visibility = Visibility.Collapsed;

            ProfileSignedOutPanel.Visibility = Visibility.Visible;
            ProfileSignedInPanel.Visibility = Visibility.Collapsed;

            ProfileButton.ToolTip = "Sign In";

            // Reset to default account name when signed out
            dataContext?.MainViewModel?.SetWwbwEmail(null);
        }
    }

    private async Task FetchAndSetWwbwEmailAsync()
    {
        LogDebug("FetchAndSetWwbwEmailAsync started");
        try
        {
            // Always use the profile email (login email) for display
            var session = _authManager.Session;
            string? emailToDisplay = null;

            if (session.Profile != null && !string.IsNullOrEmpty(session.Profile.Email))
            {
                emailToDisplay = session.Profile.Email;
                LogDebug($"Using profile email: {emailToDisplay}");
            }
            else
            {
                LogDebug("No profile email available");
                return;
            }

            // Update UI with the profile email
            if (!string.IsNullOrEmpty(emailToDisplay))
            {
                var email = emailToDisplay;
                Dispatcher.Invoke(() =>
                {
                    try
                    {
                        _mainViewModel.SetWwbwEmail(email);
                        LogDebug($"SetWwbwEmail called");

                        // Also directly update the UI element
                        if (WwbwEmailDisplay != null)
                        {
                            var oldText = WwbwEmailDisplay.Text;
                            WwbwEmailDisplay.Text = email;
                            WwbwEmailDisplay.ToolTip = email;
                            LogDebug($"UI Updated: '{oldText}' -> '{email}'");
                        }
                        else
                        {
                            LogDebug("ERROR: WwbwEmailDisplay element is null!");
                        }
                    }
                    catch (Exception ex)
                    {
                        LogDebug($"Exception updating UI: {ex.Message}");
                    }
                });
            }
        }
        catch (Exception ex)
        {
            LogDebug($"Error: {ex.Message}");
        }
    }

    private void AppViewModel_PropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(ApplicationViewModel.ActiveModule))
        {
            ShowModuleContent(_appViewModel.ActiveModule);
        }
    }

    private void MainViewModel_PropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        // When user selects an email from the list, close compose panel and show the email
        if (e.PropertyName == nameof(MainViewModel.SelectedMessage))
        {
            // Check if compose panel is currently visible
            if (ComposeMailPanel != null && ComposeMailPanel.Visibility == Visibility.Visible)
            {
                // Close compose panel and show reading pane with selected email
                HideComposePanel();
            }
        }

        // When DisplayedMessage changes, update the WebBrowser with HTML content
        if (e.PropertyName == nameof(MainViewModel.DisplayedMessage))
        {
            UpdateEmailBodyBrowser();
        }
    }

    private void UpdateEmailBodyBrowser()
    {
        if (EmailBodyBrowser == null) return;

        var message = _mainViewModel.DisplayedMessage;
        if (message == null)
        {
            // Clear the browser when no message is selected
            EmailBodyBrowser.NavigateToString("<html><body style='background-color:#000000;'></body></html>");
            return;
        }

        // Wrap the email body in HTML with dark theme styling
        var htmlContent = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body {{
            background-color: #000000;
            color: #FFFFFF;
            font-family: 'Segoe UI', Calibri, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            padding: 20px;
            margin: 0;
        }}
        a {{
            color: #4A9EFF;
        }}
        strong, b {{
            font-weight: 600;
        }}
        ul, ol {{
            padding-left: 20px;
        }}
        li {{
            margin-bottom: 4px;
        }}
        table {{
            border-collapse: collapse;
        }}
        td, th {{
            padding: 8px;
            border: 1px solid #333333;
        }}
        img {{
            max-width: 100%;
            height: auto;
        }}
    </style>
</head>
<body>
{message.Body}
</body>
</html>";

        EmailBodyBrowser.NavigateToString(htmlContent);
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        if (WindowState == WindowState.Maximized)
        {
            WindowState = WindowState.Normal;
            MaximizeButton.Content = "\uE922"; // Maximize icon
        }
        else
        {
            WindowState = WindowState.Maximized;
            MaximizeButton.Content = "\uE923"; // Restore icon
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void TabButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is RadioButton radioButton)
        {
            ShowTabContent(radioButton.Name);
        }
    }

    private void ShowTabContent(string tabName)
    {
        // Hide all tab content panels
        if (HomeTabContent != null) HomeTabContent.Visibility = Visibility.Collapsed;
        if (SendReceiveTabContent != null) SendReceiveTabContent.Visibility = Visibility.Collapsed;
        if (FolderTabContent != null) FolderTabContent.Visibility = Visibility.Collapsed;
        if (ViewTabContent != null) ViewTabContent.Visibility = Visibility.Collapsed;

        // Show the selected tab content
        switch (tabName)
        {
            case "HomeTab":
                if (HomeTabContent != null) HomeTabContent.Visibility = Visibility.Visible;
                break;
            case "SendReceiveTab":
                if (SendReceiveTabContent != null) SendReceiveTabContent.Visibility = Visibility.Visible;
                break;
            case "FolderTab":
                if (FolderTabContent != null) FolderTabContent.Visibility = Visibility.Visible;
                break;
            case "ViewTab":
                if (ViewTabContent != null) ViewTabContent.Visibility = Visibility.Visible;
                break;
        }
    }

    private void ShowModuleContent(AppModule module)
    {
        // Hide all module content panels
        if (MailModuleContent != null) MailModuleContent.Visibility = Visibility.Collapsed;
        if (CalendarModuleContent != null) CalendarModuleContent.Visibility = Visibility.Collapsed;
        if (PeopleModuleContent != null) PeopleModuleContent.Visibility = Visibility.Collapsed;
        if (TasksModuleContent != null) TasksModuleContent.Visibility = Visibility.Collapsed;
        if (AppsModuleContent != null) AppsModuleContent.Visibility = Visibility.Collapsed;

        // Show the selected module content
        switch (module)
        {
            case AppModule.Mail:
                if (MailModuleContent != null) MailModuleContent.Visibility = Visibility.Visible;
                break;
            case AppModule.Calendar:
                if (CalendarModuleContent != null) CalendarModuleContent.Visibility = Visibility.Visible;
                break;
            case AppModule.People:
                if (PeopleModuleContent != null) PeopleModuleContent.Visibility = Visibility.Visible;
                break;
            case AppModule.Tasks:
                if (TasksModuleContent != null) TasksModuleContent.Visibility = Visibility.Visible;
                break;
            case AppModule.Apps:
                if (AppsModuleContent != null) AppsModuleContent.Visibility = Visibility.Visible;
                break;
        }
    }

    #region Folder Navigation

    private void AccountRootHeader_Click(object sender, MouseButtonEventArgs e)
    {
        // Toggle expand/collapse when clicking the account root header
        if (FolderExpandToggle != null)
        {
            FolderExpandToggle.IsChecked = !FolderExpandToggle.IsChecked;
        }
    }

    private void FolderItem_Click(object sender, MouseButtonEventArgs e)
    {
        if (sender is Border border && border.DataContext is MailFolder folder)
        {
            // Deselect all folders first
            var dataContext = DataContext as WindowDataContext;
            if (dataContext?.MainViewModel?.AccountRootFolder?.SubFolders != null)
            {
                foreach (var f in dataContext.MainViewModel.AccountRootFolder.SubFolders)
                {
                    f.IsSelected = false;
                }
            }

            // Select clicked folder
            folder.IsSelected = true;

            // Update the view model's selected folder
            if (dataContext?.MainViewModel != null)
            {
                dataContext.MainViewModel.SelectedFolder = folder;
            }
        }
    }

    private bool _isFolderPaneCollapsed = false;

    private void HamburgerMenu_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            _isFolderPaneCollapsed = !_isFolderPaneCollapsed;

            // Animate the folder pane column width
            var widthAnimation = new DoubleAnimation
            {
                Duration = TimeSpan.FromMilliseconds(300),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseInOut }
            };

            if (_isFolderPaneCollapsed)
            {
                // Collapse to 0 width - completely hide the panel
                widthAnimation.To = 0;
                widthAnimation.From = FolderPaneColumn?.Width.Value ?? 250;
            }
            else
            {
                // Expand to full width (250px)
                widthAnimation.To = 250;
                widthAnimation.From = 0;
            }

            // Apply animation to the folder pane column
            if (FolderPaneColumn != null)
            {
                FolderPaneColumn.BeginAnimation(ColumnDefinition.WidthProperty, widthAnimation);
            }

            // Also animate the grid splitter visibility
            AnimateGridSplitter();
        }
        catch (Exception ex)
        {
            // Log error but don't crash
            System.Diagnostics.Debug.WriteLine($"Error in HamburgerMenu_Click: {ex.Message}");
        }
    }

    private void AnimateGridSplitter()
    {
        // Find the grid splitter next to the folder pane
        if (MailModuleContent != null)
        {
            // Grid splitter is at column 1
            foreach (var child in MailModuleContent.Children)
            {
                if (child is GridSplitter splitter && Grid.GetColumn(splitter) == 1)
                {
                    var opacityAnimation = new DoubleAnimation
                    {
                        To = _isFolderPaneCollapsed ? 0 : 1,
                        Duration = TimeSpan.FromMilliseconds(300),
                        EasingFunction = new CubicEase { EasingMode = EasingMode.EaseInOut }
                    };
                    splitter.BeginAnimation(UIElement.OpacityProperty, opacityAnimation);

                    // After animation completes, set visibility
                    if (_isFolderPaneCollapsed)
                    {
                        System.Windows.Threading.DispatcherTimer timer = new System.Windows.Threading.DispatcherTimer
                        {
                            Interval = TimeSpan.FromMilliseconds(300)
                        };
                        timer.Tick += (s, e) =>
                        {
                            splitter.Visibility = Visibility.Collapsed;
                            timer.Stop();
                        };
                        timer.Start();
                    }
                    else
                    {
                        splitter.Visibility = Visibility.Visible;
                    }
                    break;
                }
            }
        }
    }

    #endregion

    #region New Message Split Button

    private void NewMailPrimaryButton_Click(object sender, RoutedEventArgs e)
    {
        // Show the compose panel
        ShowComposePanel();
    }

    private void NewMailMenuItem_Click(object sender, RoutedEventArgs e)
    {
        NewDropdownButton.IsChecked = false;
        // Show the compose panel
        ShowComposePanel();
    }

    private void ShowComposePanel()
    {
        // Create a new compose view model if needed
        if (_composeMailViewModel == null)
        {
            _composeMailViewModel = new ViewModels.ComposeMailViewModel();
            _composeMailViewModel.MailSent += OnMailSent;
            _composeMailViewModel.ComposeCancelled += OnComposeCancelled;
            _composeMailViewModel.SendMailRequested += OnSendMailRequested;
            _composeMailViewModel.SaveDraftRequested += OnSaveDraftRequested;
        }

        // Get the WWBW email address (same as shown in sidebar) - fall back to profile email
        var userEmail = !string.IsNullOrEmpty(_mainViewModel.WwbwEmailAddress)
            ? _mainViewModel.WwbwEmailAddress
            : _authManager.Session?.Profile?.Email;

        // Reset the form and start composing with the user's email
        _composeMailViewModel.StartComposing(userEmail);

        // Set the DataContext for the compose panel
        if (ComposeMailPanel != null)
        {
            ComposeMailPanel.DataContext = _composeMailViewModel;
        }

        // Hide reading pane, show compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Visible;
    }

    private void ShowComposePanelWithDraft(Models.EmailMessage draft)
    {
        // Create a new compose view model if needed
        if (_composeMailViewModel == null)
        {
            _composeMailViewModel = new ViewModels.ComposeMailViewModel();
            _composeMailViewModel.MailSent += OnMailSent;
            _composeMailViewModel.ComposeCancelled += OnComposeCancelled;
            _composeMailViewModel.SendMailRequested += OnSendMailRequested;
            _composeMailViewModel.SaveDraftRequested += OnSaveDraftRequested;
        }

        // Get the WWBW email address (same as shown in sidebar) - fall back to profile email
        var userEmail = !string.IsNullOrEmpty(_mainViewModel.WwbwEmailAddress)
            ? _mainViewModel.WwbwEmailAddress
            : _authManager.Session?.Profile?.Email;

        // Load the draft into the compose form
        _composeMailViewModel.LoadDraft(
            draftId: draft.Id,
            to: string.Join("; ", draft.To ?? new List<string>()),
            cc: string.Join("; ", draft.Cc ?? new List<string>()),
            bcc: string.Join("; ", draft.Bcc ?? new List<string>()),
            subject: draft.Subject ?? string.Empty,
            body: draft.Body ?? string.Empty,
            fromEmail: userEmail
        );

        // Set the DataContext for the compose panel
        if (ComposeMailPanel != null)
        {
            ComposeMailPanel.DataContext = _composeMailViewModel;
        }

        // Hide reading pane, show compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Visible;
    }

    private void HideComposePanel()
    {
        // Show reading pane, hide compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Visible;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Collapsed;
    }

    private async void OnMailSent(object? sender, EventArgs e)
    {
        // Mail was sent successfully - first hide the compose panel
        HideComposePanel();

        // Refresh the message list for the current folder BEFORE clearing selection
        // This ensures the UI stays populated
        if (_mainViewModel.SelectedFolder != null)
        {
            await _mainViewModel.RefreshMessagesAsync();
        }

        // Clear displayed message so reading pane shows blank after sending
        _mainViewModel.DisplayedMessage = null;
        _mainViewModel.SelectedMessage = null;

        // Show success notification
        MessageDialog.ShowSuccess(this, "Mail sent successfully!", "Success");
    }

    private void OnComposeCancelled(object? sender, EventArgs e)
    {
        // Clear displayed message so reading pane shows blank after closing compose
        _mainViewModel.DisplayedMessage = null;
        _mainViewModel.SelectedMessage = null;

        // User cancelled composition
        HideComposePanel();
    }

    private async void OnSendMailRequested(object? sender, ViewModels.SendMailEventArgs e)
    {
        try
        {
            // Get sender display name from profile or use email
            var senderName = _authManager.Session?.Profile?.DisplayName ?? "You";
            var senderEmail = e.From;

            // Create the email message
            var emailMessage = new Models.EmailMessage
            {
                Id = Guid.NewGuid().ToString(),
                Subject = string.IsNullOrWhiteSpace(e.Subject) ? "(No Subject)" : e.Subject,
                From = senderName,
                FromEmail = senderEmail,
                To = e.To,
                Cc = e.Cc,
                Bcc = e.Bcc,
                Body = e.Body,
                IsHtml = false, // Plain text from compose
                SentDate = DateTime.Now,
                ReceivedDate = DateTime.Now,
                IsRead = true,
                FolderId = "sent", // Will be placed in Sent Items folder
                Preview = e.Body.Length > 100 ? e.Body.Substring(0, 100) + "..." : e.Body,
                HasAttachments = e.Attachments.Count > 0
            };

            // Add attachments if any
            if (e.Attachments.Count > 0)
            {
                emailMessage.Attachments = e.Attachments.Select(a => new Models.EmailAttachment
                {
                    Id = Guid.NewGuid().ToString(),
                    FileName = a.FileName,
                    FilePath = a.FilePath,
                    ContentType = GetContentType(a.FileName),
                    FileSize = System.IO.File.Exists(a.FilePath) ? new System.IO.FileInfo(a.FilePath).Length : 0
                }).ToList();
            }

            // Get the mail service and send the message via API
            var mailService = Services.ServiceConfiguration.GetMailService();

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Sending email to: {string.Join(", ", e.To)}");
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Subject: {emailMessage.Subject}");
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Attachments: {emailMessage.Attachments.Count}");

            // Send the message - this will save to Sent Items via API
            await mailService.SendMessageAsync(emailMessage);

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Email sent successfully!");

            // Show success notification (optional)
            // MessageBox.Show("Email sent successfully!", "Success", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error sending email: {ex.Message}");
            MessageDialog.ShowError(this, $"Failed to send email: {ex.Message}", "Send Error");
        }
    }

    private async void OnSaveDraftRequested(object? sender, ViewModels.SaveDraftEventArgs e)
    {
        try
        {
            // Get sender display name from profile or use email
            var senderName = _authManager.Session?.Profile?.DisplayName ?? "You";
            var senderEmail = e.From;

            // Create the draft email message
            var draftMessage = new Models.EmailMessage
            {
                Id = e.DraftId ?? Guid.NewGuid().ToString(),
                Subject = string.IsNullOrWhiteSpace(e.Subject) ? "(No Subject)" : e.Subject,
                From = senderName,
                FromEmail = senderEmail,
                To = e.To,
                Cc = e.Cc,
                Bcc = e.Bcc,
                Body = e.Body,
                IsHtml = false,
                ReceivedDate = DateTime.Now,
                IsRead = true,
                FolderId = "drafts",
                Preview = e.Body.Length > 100 ? e.Body.Substring(0, 100) + "..." : e.Body,
                HasAttachments = e.Attachments.Count > 0
            };

            // Add attachments if any
            if (e.Attachments.Count > 0)
            {
                draftMessage.Attachments = e.Attachments.Select(a => new Models.EmailAttachment
                {
                    Id = Guid.NewGuid().ToString(),
                    FileName = a.FileName,
                    FilePath = a.FilePath,
                    ContentType = GetContentType(a.FileName),
                    FileSize = System.IO.File.Exists(a.FilePath) ? new System.IO.FileInfo(a.FilePath).Length : 0
                }).ToList();
            }

            // Get the mail service and save the draft via API
            var mailService = Services.ServiceConfiguration.GetMailService();

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Saving draft: {draftMessage.Subject}");

            // Save the draft - this will create or update the draft
            var savedDraft = await mailService.SaveDraftAsync(draftMessage, e.DraftId);

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Draft saved with ID: {savedDraft.Id}");

            // Update the compose view model with the saved draft ID
            _composeMailViewModel?.SetDraftId(savedDraft.Id);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error saving draft: {ex.Message}");
            // Don't show error dialog for auto-save, just log it
        }
    }

    private static string GetContentType(string fileName)
    {
        var extension = System.IO.Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => "application/pdf",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => "application/vnd.ms-excel",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".ppt" => "application/vnd.ms-powerpoint",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".txt" => "text/plain",
            ".html" => "text/html",
            ".htm" => "text/html",
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".bmp" => "image/bmp",
            ".zip" => "application/zip",
            ".rar" => "application/x-rar-compressed",
            ".7z" => "application/x-7z-compressed",
            _ => "application/octet-stream"
        };
    }

    private void NewMeetingMenuItem_Click(object sender, RoutedEventArgs e)
    {
        NewDropdownButton.IsChecked = false;
        // Execute the new meeting command (placeholder for now)
        MessageDialog.ShowInfo(this, "New Meeting functionality coming soon!", "New Meeting");
    }

    private void MessageListBox_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        // Check if a message is selected
        if (_mainViewModel.SelectedMessage == null) return;

        // Check if the message is in the Drafts folder
        if (_mainViewModel.SelectedFolder?.Type == Models.FolderType.Drafts)
        {
            // Open the draft for editing in compose panel
            ShowComposePanelWithDraft(_mainViewModel.SelectedMessage);
        }
        // For other folders, double-click could open in a new window (future enhancement)
        // For now, just keep the reading pane visible
    }

    #endregion

    #region Profile & Authentication

    private void ProfileButton_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = !ProfilePopup.IsOpen;
    }

    private void ProfileSignIn_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        ShowJubileeAuthDialog(showSignIn: true);
    }

    private void ProfileManageAccount_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "https://jubileeverse.com/account",
                UseShellExecute = true
            });
        }
        catch { }
    }

    private async void ProfileSignOut_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        await _authManager.SignOutAsync();

        // Clear stored credentials so user must re-authenticate
        await _secureStorage.DeleteAsync("signInCredentials");

        // Delegate to App to handle the sign out flow properly
        // This will close this MainWindow, show fresh auth, and create a new MainWindow if successful
        if (Application.Current is App app)
        {
            app.HandleSignOut();
        }
    }

    /// <summary>
    /// Shows the Jubilee authentication dialog matching the JubileeBrowser implementation
    /// </summary>
    private void ShowJubileeAuthDialog(bool showSignIn = true)
    {
        // Color definitions matching JubileeBrowser
        var darkBg = Color.FromRgb(38, 38, 38);           // #262626
        var inputBg = Color.FromRgb(64, 64, 64);          // #404040
        var goldColor = Color.FromRgb(230, 172, 0);       // #E6AC00
        var goldHover = Color.FromRgb(255, 191, 0);       // #FFBF00

        // Full-screen overlay window
        var authDialog = new Window
        {
            Title = "Jubilee - Authentication",
            WindowState = WindowState.Maximized,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new SolidColorBrush(Color.FromArgb(120, 0, 0, 0)),
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            AllowsTransparency = true
        };

        var overlayGrid = new Grid { Background = Brushes.Transparent };
        overlayGrid.MouseLeftButtonDown += (s, args) => authDialog.Close();

        // Main container with gradient background
        var mainBorder = new Border
        {
            Width = 405,
            Height = 590,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Background = new LinearGradientBrush
            {
                StartPoint = new Point(0, 0),
                EndPoint = new Point(0, 1),
                GradientStops = new GradientStopCollection
                {
                    new GradientStop(Color.FromRgb(45, 45, 45), 0),
                    new GradientStop(Color.FromRgb(38, 38, 38), 0.3),
                    new GradientStop(Color.FromRgb(30, 30, 30), 1)
                }
            },
            BorderBrush = new SolidColorBrush(goldColor),
            BorderThickness = new Thickness(3),
            CornerRadius = new CornerRadius(12)
        };
        mainBorder.MouseLeftButtonDown += (s, args) => args.Handled = true;

        var mainLayoutGrid = new Grid { Margin = new Thickness(30, 15, 30, 20) };
        mainLayoutGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        mainLayoutGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        mainLayoutGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        // Header
        var headerPanel = new StackPanel();
        Grid.SetRow(headerPanel, 0);

        // Close button
        var closeButtonText = new TextBlock
        {
            Text = "\u2715",
            FontSize = 16,
            Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        var closeButton = new Border
        {
            Width = 30,
            Height = 30,
            HorizontalAlignment = HorizontalAlignment.Right,
            Background = Brushes.Transparent,
            Cursor = Cursors.Hand,
            Margin = new Thickness(0, -10, -25, 0),
            Child = closeButtonText
        };
        var grayBrush = new SolidColorBrush(Color.FromRgb(150, 150, 150));
        var goldBrush = new SolidColorBrush(goldColor);
        closeButton.MouseEnter += (s, args) => closeButtonText.Foreground = goldBrush;
        closeButton.MouseLeave += (s, args) => closeButtonText.Foreground = grayBrush;
        closeButton.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; authDialog.Close(); };
        headerPanel.Children.Add(closeButton);

        // Profile logo image
        var profileImage = new System.Windows.Controls.Image
        {
            Width = 70,
            Height = 70,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 8),
            Stretch = Stretch.Uniform
        };
        try
        {
            var logoUri = new Uri("pack://application:,,,/Resources/Icons/jubilee-profile.png");
            profileImage.Source = new BitmapImage(logoUri);
        }
        catch { }
        headerPanel.Children.Add(profileImage);

        // Title
        var titleText = new TextBlock
        {
            FontSize = 34,
            FontWeight = FontWeights.Bold,
            FontFamily = new FontFamily("Agency FB, Impact, Arial Black, sans-serif"),
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 8, 0, 2)
        };
        titleText.Inlines.Add(new System.Windows.Documents.Run("Jubilee") { Foreground = Brushes.White });
        titleText.Inlines.Add(new System.Windows.Documents.Run("Outlook") { Foreground = new SolidColorBrush(goldColor) });
        headerPanel.Children.Add(titleText);

        var subtitleText = new TextBlock
        {
            Text = "Sign in to sync your email across devices",
            FontSize = 13,
            Foreground = Brushes.White,
            HorizontalAlignment = HorizontalAlignment.Center,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, -5, 0, 15)
        };
        headerPanel.Children.Add(subtitleText);

        // Helper functions
        Button CreateGoldButton(string text)
        {
            var btn = new Button
            {
                Content = text,
                Height = 45,
                Background = new SolidColorBrush(goldColor),
                Foreground = new SolidColorBrush(Color.FromRgb(30, 30, 30)),
                BorderThickness = new Thickness(0),
                FontSize = 16,
                FontWeight = FontWeights.SemiBold,
                Cursor = Cursors.Hand,
                Margin = new Thickness(0, 0, 0, 15)
            };
            var template = new ControlTemplate(typeof(Button));
            var border = new FrameworkElementFactory(typeof(Border));
            border.SetValue(Border.BackgroundProperty, new SolidColorBrush(goldColor));
            border.SetValue(Border.CornerRadiusProperty, new CornerRadius(25));
            var content = new FrameworkElementFactory(typeof(ContentPresenter));
            content.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            content.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            border.AppendChild(content);
            template.VisualTree = border;
            btn.Template = template;
            return btn;
        }

        (Border border, TextBox textBox) CreateTextInput(string placeholder, double bottomMargin = 12)
        {
            var border = new Border
            {
                Background = new SolidColorBrush(inputBg),
                BorderBrush = new SolidColorBrush(goldColor),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Margin = new Thickness(0, 0, 0, bottomMargin),
                Padding = new Thickness(15, 12, 15, 12)
            };
            var textBox = new TextBox { Background = Brushes.Transparent, Foreground = Brushes.White, BorderThickness = new Thickness(0), FontSize = 14, CaretBrush = Brushes.White };
            var placeholderText = new TextBlock { Text = placeholder, Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)), FontSize = 14, IsHitTestVisible = false };
            var grid = new Grid();
            grid.Children.Add(placeholderText);
            grid.Children.Add(textBox);
            textBox.TextChanged += (s, args) => placeholderText.Visibility = string.IsNullOrEmpty(textBox.Text) ? Visibility.Visible : Visibility.Collapsed;
            border.Child = grid;
            return (border, textBox);
        }

        (Border border, PasswordBox passwordBox, TextBox visibleTextBox) CreatePasswordInput(string placeholder, double bottomMargin = 12)
        {
            var border = new Border
            {
                Background = new SolidColorBrush(inputBg),
                BorderBrush = new SolidColorBrush(goldColor),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Margin = new Thickness(0, 0, 0, bottomMargin),
                Padding = new Thickness(15, 12, 40, 12)
            };
            var passwordBox = new PasswordBox { Background = Brushes.Transparent, Foreground = Brushes.White, BorderThickness = new Thickness(0), FontSize = 14, CaretBrush = Brushes.White };
            var visibleTextBox = new TextBox { Background = Brushes.Transparent, Foreground = Brushes.White, BorderThickness = new Thickness(0), FontSize = 14, CaretBrush = Brushes.White, Visibility = Visibility.Collapsed };
            var placeholderText = new TextBlock { Text = placeholder, Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)), FontSize = 14, IsHitTestVisible = false, VerticalAlignment = VerticalAlignment.Center };

            var eyeIcon = new TextBlock
            {
                Text = "\uE052",
                FontFamily = new FontFamily("Segoe MDL2 Assets"),
                FontSize = 16,
                Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)),
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center,
                Cursor = Cursors.Hand,
                Margin = new Thickness(0, 0, -25, 0),
                ToolTip = "Show password",
                Focusable = true
            };

            var isPasswordVisible = false;
            var grayForeground = new SolidColorBrush(Color.FromRgb(150, 150, 150));
            var goldForeground = new SolidColorBrush(goldColor);

            eyeIcon.PreviewMouseLeftButtonDown += (s, args) =>
            {
                args.Handled = true;
                isPasswordVisible = !isPasswordVisible;
                if (isPasswordVisible)
                {
                    visibleTextBox.Text = passwordBox.Password;
                    passwordBox.Visibility = Visibility.Collapsed;
                    visibleTextBox.Visibility = Visibility.Visible;
                    eyeIcon.Text = "\uED1A";
                    eyeIcon.ToolTip = "Hide password";
                    visibleTextBox.Focus();
                    visibleTextBox.CaretIndex = visibleTextBox.Text.Length;
                }
                else
                {
                    passwordBox.Password = visibleTextBox.Text;
                    visibleTextBox.Visibility = Visibility.Collapsed;
                    passwordBox.Visibility = Visibility.Visible;
                    eyeIcon.Text = "\uE052";
                    eyeIcon.ToolTip = "Show password";
                    passwordBox.Focus();
                }
            };

            eyeIcon.MouseEnter += (s, args) => eyeIcon.Foreground = goldForeground;
            eyeIcon.MouseLeave += (s, args) => eyeIcon.Foreground = grayForeground;

            visibleTextBox.TextChanged += (s, args) =>
            {
                if (visibleTextBox.Visibility == Visibility.Visible)
                    passwordBox.Password = visibleTextBox.Text;
                placeholderText.Visibility = string.IsNullOrEmpty(visibleTextBox.Text) && string.IsNullOrEmpty(passwordBox.Password) ? Visibility.Visible : Visibility.Collapsed;
            };

            var grid = new Grid();
            grid.Children.Add(placeholderText);
            grid.Children.Add(passwordBox);
            grid.Children.Add(visibleTextBox);
            grid.Children.Add(eyeIcon);
            passwordBox.PasswordChanged += (s, args) =>
            {
                placeholderText.Visibility = string.IsNullOrEmpty(passwordBox.Password) ? Visibility.Visible : Visibility.Collapsed;
                if (passwordBox.Visibility == Visibility.Visible)
                    visibleTextBox.Text = passwordBox.Password;
            };
            border.Child = grid;
            return (border, passwordBox, visibleTextBox);
        }

        CheckBox CreateStyledCheckbox()
        {
            var checkbox = new CheckBox { VerticalAlignment = VerticalAlignment.Center };
            var template = new ControlTemplate(typeof(CheckBox));
            var borderFactory = new FrameworkElementFactory(typeof(Border), "CheckBoxBorder");
            borderFactory.SetValue(Border.WidthProperty, 18.0);
            borderFactory.SetValue(Border.HeightProperty, 18.0);
            borderFactory.SetValue(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(30, 30, 30)));
            borderFactory.SetValue(Border.BorderBrushProperty, new SolidColorBrush(goldColor));
            borderFactory.SetValue(Border.BorderThicknessProperty, new Thickness(2));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(3));

            var checkmarkFactory = new FrameworkElementFactory(typeof(Path), "Checkmark");
            checkmarkFactory.SetValue(Path.DataProperty, Geometry.Parse("M 2,6 L 6,10 L 12,2"));
            checkmarkFactory.SetValue(Path.StrokeProperty, new SolidColorBrush(goldColor));
            checkmarkFactory.SetValue(Path.StrokeThicknessProperty, 2.5);
            checkmarkFactory.SetValue(Path.VisibilityProperty, Visibility.Collapsed);
            checkmarkFactory.SetValue(Path.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            checkmarkFactory.SetValue(Path.VerticalAlignmentProperty, VerticalAlignment.Center);
            checkmarkFactory.SetValue(Path.MarginProperty, new Thickness(1, 1, 0, 0));

            borderFactory.AppendChild(checkmarkFactory);
            template.VisualTree = borderFactory;

            var checkedTrigger = new Trigger { Property = CheckBox.IsCheckedProperty, Value = true };
            checkedTrigger.Setters.Add(new Setter(Path.VisibilityProperty, Visibility.Visible, "Checkmark"));
            template.Triggers.Add(checkedTrigger);

            var hoverTrigger = new Trigger { Property = CheckBox.IsMouseOverProperty, Value = true };
            hoverTrigger.Setters.Add(new Setter(Border.BorderBrushProperty, new SolidColorBrush(goldHover), "CheckBoxBorder"));
            template.Triggers.Add(hoverTrigger);

            checkbox.Template = template;
            return checkbox;
        }

        // Content container
        var contentContainer = new Grid { VerticalAlignment = VerticalAlignment.Top };
        Grid.SetRow(contentContainer, 1);

        // Sign In Panel
        var signInPanel = new StackPanel { Visibility = showSignIn ? Visibility.Visible : Visibility.Collapsed };

        var signUpLinkColor = new SolidColorBrush(Color.FromRgb(180, 180, 180));
        var signUpLinkHoverColor = new SolidColorBrush(goldColor);
        var signUpTextBlock = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 5, 0, 12),
            FontSize = 13
        };
        signUpTextBlock.Inlines.Add(new System.Windows.Documents.Run("Don't have an account? ") { Foreground = signUpLinkColor });
        var signUpLinkRun = new System.Windows.Documents.Run("Sign Up.") { Foreground = signUpLinkHoverColor };
        var signUpLink = new System.Windows.Documents.Hyperlink(signUpLinkRun)
        {
            Foreground = signUpLinkHoverColor,
            TextDecorations = null,
            Focusable = true
        };
        signUpLink.MouseEnter += (s, args) => signUpLink.TextDecorations = TextDecorations.Underline;
        signUpLink.MouseLeave += (s, args) => signUpLink.TextDecorations = null;
        signUpTextBlock.Inlines.Add(signUpLink);
        signInPanel.Children.Add(signUpTextBlock);

        var (signInEmailBorder, signInEmailBox) = CreateTextInput("Email Address", 12);
        signInPanel.Children.Add(signInEmailBorder);

        var (signInPasswordBorder, signInPasswordBox, _) = CreatePasswordInput("Password", 10);
        signInPanel.Children.Add(signInPasswordBorder);

        // Load saved credentials
        _ = Task.Run(async () =>
        {
            var savedCreds = await _secureStorage.RetrieveAsync<SavedSignInCredentials>("signInCredentials");
            if (savedCreds != null && savedCreds.RememberMe)
            {
                Dispatcher.Invoke(() =>
                {
                    signInEmailBox.Text = savedCreds.Email ?? "";
                    if (!string.IsNullOrEmpty(savedCreds.EncryptedPassword))
                    {
                        signInPasswordBox.Password = _secureStorage.DecryptPassword(savedCreds.EncryptedPassword);
                    }
                });
            }
        });

        var rememberForgotRow = new Grid();
        rememberForgotRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        rememberForgotRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var rememberPanel = new StackPanel { Orientation = Orientation.Horizontal };
        var rememberCheckbox = CreateStyledCheckbox();
        rememberCheckbox.IsChecked = true;
        rememberPanel.Children.Add(rememberCheckbox);
        rememberPanel.Children.Add(new TextBlock { Text = "Keep me signed in", Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 14, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 0, 0) });
        Grid.SetColumn(rememberPanel, 0);
        rememberForgotRow.Children.Add(rememberPanel);

        var forgotPasswordLink = new TextBlock { Text = "Forgot Password?", Foreground = new SolidColorBrush(goldColor), FontSize = 12, VerticalAlignment = VerticalAlignment.Center, Cursor = Cursors.Hand };
        forgotPasswordLink.MouseEnter += (s, args) => forgotPasswordLink.TextDecorations = TextDecorations.Underline;
        forgotPasswordLink.MouseLeave += (s, args) => forgotPasswordLink.TextDecorations = null;
        Grid.SetColumn(forgotPasswordLink, 1);
        rememberForgotRow.Children.Add(forgotPasswordLink);

        signInPanel.Children.Add(rememberForgotRow);

        // Create Account Panel
        var createAccountPanel = new StackPanel { Visibility = Visibility.Collapsed };

        var signInLinkTextBlock = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 5, 0, 12),
            FontSize = 13
        };
        signInLinkTextBlock.Inlines.Add(new System.Windows.Documents.Run("Already have an account? ") { Foreground = signUpLinkColor });
        var signInLinkRun = new System.Windows.Documents.Run("Sign In.") { Foreground = signUpLinkHoverColor };
        var signInLink = new System.Windows.Documents.Hyperlink(signInLinkRun)
        {
            Foreground = signUpLinkHoverColor,
            TextDecorations = null,
            Focusable = true
        };
        signInLink.MouseEnter += (s, args) => signInLink.TextDecorations = TextDecorations.Underline;
        signInLink.MouseLeave += (s, args) => signInLink.TextDecorations = null;
        signInLinkTextBlock.Inlines.Add(signInLink);
        createAccountPanel.Children.Add(signInLinkTextBlock);

        var (fullNameBorder, fullNameBox) = CreateTextInput("Full Name");
        createAccountPanel.Children.Add(fullNameBorder);

        var (createEmailBorder, createEmailBox) = CreateTextInput("Email Address");
        createAccountPanel.Children.Add(createEmailBorder);

        var (createPasswordBorder, createPasswordBox, _) = CreatePasswordInput("Password");
        createAccountPanel.Children.Add(createPasswordBorder);

        var (confirmPasswordBorder, confirmPasswordBox, _) = CreatePasswordInput("Confirm Password", 10);
        createAccountPanel.Children.Add(confirmPasswordBorder);

        var newsletterPanel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 0) };
        var newsletterCheckbox = CreateStyledCheckbox();
        newsletterCheckbox.IsChecked = true;
        newsletterPanel.Children.Add(newsletterCheckbox);
        newsletterPanel.Children.Add(new TextBlock { Text = "Subscribe to newsletter", Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 13, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 0, 0) });
        createAccountPanel.Children.Add(newsletterPanel);

        // Forgot Password Panel
        var forgotPasswordPanel = new StackPanel { Visibility = Visibility.Collapsed };

        var forgotInstructionText = new TextBlock
        {
            Text = "Enter your registered email address and we will send you instructions to reset your password.",
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 15)
        };
        forgotPasswordPanel.Children.Add(forgotInstructionText);

        var (forgotEmailBorder, forgotEmailBox) = CreateTextInput("Email Address", 8);
        forgotPasswordPanel.Children.Add(forgotEmailBorder);

        var forgotBackTextBlock = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 0, 0, 0),
            FontSize = 13
        };
        forgotBackTextBlock.Inlines.Add(new System.Windows.Documents.Run("\u2190 ") { Foreground = signUpLinkColor });
        var forgotBackLinkRun = new System.Windows.Documents.Run("Back to Sign In") { Foreground = signUpLinkHoverColor };
        var forgotBackLink = new System.Windows.Documents.Hyperlink(forgotBackLinkRun)
        {
            Foreground = signUpLinkHoverColor,
            TextDecorations = null,
            Focusable = true
        };
        forgotBackLink.MouseEnter += (s, args) => forgotBackLink.TextDecorations = TextDecorations.Underline;
        forgotBackLink.MouseLeave += (s, args) => forgotBackLink.TextDecorations = null;
        forgotBackTextBlock.Inlines.Add(forgotBackLink);
        forgotPasswordPanel.Children.Add(forgotBackTextBlock);

        // Footer
        var footerPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom };
        Grid.SetRow(footerPanel, 2);

        var actionButton = CreateGoldButton("Sign In");
        actionButton.Margin = new Thickness(0, 15, 0, 12);
        footerPanel.Children.Add(actionButton);

        var footerTextColor = new SolidColorBrush(Color.FromRgb(120, 120, 120));
        var footerLinkColor = new SolidColorBrush(Color.FromRgb(150, 150, 150));

        var copyrightPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        copyrightPanel.Children.Add(new TextBlock { Text = "\u00A9 2026 Jubilee Software, Inc.", Foreground = footerTextColor, FontSize = 11 });
        footerPanel.Children.Add(copyrightPanel);

        // Track current panel
        string currentPanel = showSignIn ? "signIn" : "createAccount";

        void ShowPanel(string panelName)
        {
            signInPanel.Visibility = Visibility.Collapsed;
            createAccountPanel.Visibility = Visibility.Collapsed;
            forgotPasswordPanel.Visibility = Visibility.Collapsed;

            currentPanel = panelName;

            switch (panelName)
            {
                case "signIn":
                    signInPanel.Visibility = Visibility.Visible;
                    actionButton.Content = "Sign In";
                    break;
                case "createAccount":
                    createAccountPanel.Visibility = Visibility.Visible;
                    actionButton.Content = "Create Account";
                    break;
                case "forgotPassword":
                    forgotPasswordPanel.Visibility = Visibility.Visible;
                    actionButton.Content = "Send Reset Link";
                    break;
            }
        }

        // Wire up navigation
        signUpLink.Click += (s, args) => ShowPanel("createAccount");
        signInLink.Click += (s, args) => ShowPanel("signIn");
        forgotPasswordLink.MouseLeftButtonUp += (s, args) => ShowPanel("forgotPassword");
        forgotBackLink.Click += (s, args) => ShowPanel("signIn");

        // Action button handler
        actionButton.Click += async (s, args) =>
        {
            switch (currentPanel)
            {
                case "signIn":
                    if (string.IsNullOrWhiteSpace(signInEmailBox.Text) || string.IsNullOrWhiteSpace(signInPasswordBox.Password))
                    {
                        MessageDialog.ShowWarning(authDialog, "Please enter your email and password.", "Sign In");
                        return;
                    }
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Signing In...";
                    try
                    {
                        await _authManager.SignInAsync(signInEmailBox.Text, signInPasswordBox.Password, rememberCheckbox.IsChecked == true);

                        // Save credentials if remember is checked
                        if (rememberCheckbox.IsChecked == true)
                        {
                            await _secureStorage.StoreAsync("signInCredentials", new SavedSignInCredentials
                            {
                                Email = signInEmailBox.Text,
                                EncryptedPassword = _secureStorage.EncryptPassword(signInPasswordBox.Password),
                                RememberMe = true
                            });
                        }

                        authDialog.Close();
                    }
                    catch (Exception ex)
                    {
                        MessageDialog.ShowError(authDialog, ex.Message, "Sign In Failed");
                        actionButton.IsEnabled = true;
                        actionButton.Content = "Sign In";
                    }
                    break;

                case "createAccount":
                    if (string.IsNullOrWhiteSpace(fullNameBox.Text) ||
                        string.IsNullOrWhiteSpace(createEmailBox.Text) ||
                        string.IsNullOrWhiteSpace(createPasswordBox.Password))
                    {
                        MessageDialog.ShowWarning(authDialog, "Please fill in all fields.", "Create Account");
                        return;
                    }
                    if (createPasswordBox.Password != confirmPasswordBox.Password)
                    {
                        MessageDialog.ShowWarning(authDialog, "Passwords do not match.", "Create Account");
                        return;
                    }
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Creating Account...";
                    try
                    {
                        await _authManager.RegisterAsync(fullNameBox.Text, createEmailBox.Text, createPasswordBox.Password, newsletterCheckbox.IsChecked == true);
                        authDialog.Close();
                    }
                    catch (Exception ex)
                    {
                        MessageDialog.ShowError(authDialog, ex.Message, "Registration Failed");
                        actionButton.IsEnabled = true;
                        actionButton.Content = "Create Account";
                    }
                    break;

                case "forgotPassword":
                    if (string.IsNullOrWhiteSpace(forgotEmailBox.Text))
                    {
                        MessageDialog.ShowWarning(authDialog, "Please enter your email address.", "Forgot Password");
                        return;
                    }
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Sending...";
                    var success = await _authManager.RequestPasswordResetAsync(forgotEmailBox.Text);
                    if (success)
                    {
                        MessageDialog.ShowSuccess(authDialog, "Password reset instructions have been sent to your email.", "Email Sent");
                        ShowPanel("signIn");
                    }
                    else
                    {
                        MessageDialog.ShowError(authDialog, "Failed to send reset email. Please try again.", "Error");
                    }
                    actionButton.IsEnabled = true;
                    actionButton.Content = "Send Reset Link";
                    break;
            }
        };

        // Assemble panels
        contentContainer.Children.Add(signInPanel);
        contentContainer.Children.Add(createAccountPanel);
        contentContainer.Children.Add(forgotPasswordPanel);

        mainLayoutGrid.Children.Add(headerPanel);
        mainLayoutGrid.Children.Add(contentContainer);
        mainLayoutGrid.Children.Add(footerPanel);

        mainBorder.Child = mainLayoutGrid;
        overlayGrid.Children.Add(mainBorder);
        authDialog.Content = overlayGrid;

        authDialog.ShowDialog();
    }

    #endregion

    #region Offline Status Monitoring

    private System.Timers.Timer? _statusUpdateTimer;

    /// <summary>
    /// Initializes offline status monitoring
    /// </summary>
    private void InitializeOfflineStatusMonitoring()
    {
        // Subscribe to network status changes
        var networkService = NetworkStatusService.Instance;
        networkService.NetworkStatusChanged += NetworkStatus_Changed;

        // Subscribe to sync service events
        var syncService = SyncService.Instance;
        syncService.SyncProgressChanged += SyncService_SyncProgressChanged;
        syncService.SyncCompleted += SyncService_SyncCompleted;

        // Initial update
        UpdateNetworkStatus();
        UpdatePendingOperationsCount();

        // Set up timer for periodic pending operations check
        _statusUpdateTimer = new System.Timers.Timer(5000); // Check every 5 seconds
        _statusUpdateTimer.Elapsed += (s, e) => Dispatcher.Invoke(UpdatePendingOperationsCount);
        _statusUpdateTimer.Start();

        // Start network monitoring
        networkService.StartMonitoring();
    }

    private void NetworkStatus_Changed(object? sender, NetworkStatusChangedEventArgs e)
    {
        Dispatcher.Invoke(UpdateNetworkStatus);
    }

    private void UpdateNetworkStatus()
    {
        var networkService = NetworkStatusService.Instance;
        var isOnline = networkService.IsOnline && networkService.IsApiReachable;

        OnlineStatusPanel.Visibility = isOnline ? Visibility.Visible : Visibility.Collapsed;
        OfflineStatusPanel.Visibility = isOnline ? Visibility.Collapsed : Visibility.Visible;
    }

    /// <summary>
    /// Refreshes folders from the API after network status is confirmed
    /// </summary>
    private async Task RefreshFoldersAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[MainWindow] RefreshFoldersAsync called");
            await _mainViewModel.RefreshFolders();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error refreshing folders: {ex.Message}");
        }
    }

    private async void UpdatePendingOperationsCount()
    {
        try
        {
            var syncQueue = SyncQueueService.Instance;
            var pendingCount = await syncQueue.GetPendingCountAsync();

            if (pendingCount > 0)
            {
                PendingCountText.Text = pendingCount.ToString();
                PendingOperationsPanel.Visibility = Visibility.Visible;
            }
            else
            {
                PendingOperationsPanel.Visibility = Visibility.Collapsed;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error getting pending count: {ex.Message}");
        }
    }

    private void SyncService_SyncProgressChanged(object? sender, SyncProgressEventArgs e)
    {
        Dispatcher.Invoke(() =>
        {
            SyncStatusPanel.Visibility = Visibility.Visible;
            SyncStatusText.Text = e.Message ?? "Syncing...";
        });
    }

    private void SyncService_SyncCompleted(object? sender, SyncCompletedEventArgs e)
    {
        Dispatcher.Invoke(() =>
        {
            SyncStatusPanel.Visibility = Visibility.Collapsed;
            UpdatePendingOperationsCount();

            // Update last sync text
            if (e.Success)
            {
                LastSyncText.Text = $"Last sync: {DateTime.Now:HH:mm}";
            }
        });
    }

    #endregion
}

/// <summary>
/// Composite DataContext for the MainWindow containing both view models
/// </summary>
public class WindowDataContext
{
    public ApplicationViewModel? AppViewModel { get; set; }
    public MainViewModel? MainViewModel { get; set; }
}

/// <summary>
/// Window state data for persistence including panel layout
/// </summary>
public class WindowStateData
{
    public double Left { get; set; }
    public double Top { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public bool IsMaximized { get; set; }
    public bool IsFirstRun { get; set; } = true;

    // Panel layout state (Mail module)
    public double FolderPaneWidth { get; set; } = 250;
    public double MessageListWidth { get; set; } = 400;
}
