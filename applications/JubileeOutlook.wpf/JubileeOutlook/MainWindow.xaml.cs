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
using JubileeOutlook.Services.EmailSync;
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

        // Subscribe to email body updated event for on-demand body fetch
        _mainViewModel.EmailBodyUpdated += (s, e) =>
        {
            Console.WriteLine("[MainWindow] EmailBodyUpdated event received, refreshing browser");
            Dispatcher.Invoke(() => UpdateEmailBodyBrowser());
        };

        // Subscribe to Reply/ReplyAll/Forward events from MainViewModel
        _mainViewModel.ReplyRequested += (s, e) => Dispatcher.Invoke(ShowComposePanelForReply);
        _mainViewModel.ReplyAllRequested += (s, e) => Dispatcher.Invoke(ShowComposePanelForReplyAll);
        _mainViewModel.ForwardRequested += (s, e) => Dispatcher.Invoke(ShowComposePanelForForward);

        // Subscribe to folder management events
        _mainViewModel.NewFolderRequested += (s, e) => Dispatcher.Invoke(ShowNewFolderDialog);
        _mainViewModel.RenameFolderRequested += (s, folder) => Dispatcher.Invoke(() => ShowRenameFolderDialog(folder));
        _mainViewModel.DeleteFolderRequested += (s, folder) => Dispatcher.Invoke(() => ShowDeleteFolderConfirmation(folder));
        _mainViewModel.OfflineModeChanged += (s, isOffline) => Dispatcher.Invoke(() => UpdateOfflineModeUI(isOffline));

        // Subscribe to category management events
        _mainViewModel.ApplyCategoryRequested += (s, message) => Dispatcher.Invoke(() => ShowCategoryDialog(message));

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

                // Update profile UI for synced email accounts (if any)
                UpdateProfileUIForSyncedAccounts();
                Console.WriteLine("[MainWindow] Profile UI updated for synced accounts");

                // Subscribe to PeopleView events for email compose integration
                SubscribeToPeopleViewEvents();
                Console.WriteLine("[MainWindow] PeopleView events subscribed");

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

    /// <summary>
    /// Updates the profile UI based on synced email accounts (IMAP/OAuth).
    /// This is called after data loading to show user info when emails are synced
    /// even if Jubilee SSO authentication hasn't been performed.
    /// </summary>
    private void UpdateProfileUIForSyncedAccounts()
    {
        // Skip if already authenticated via Jubilee SSO
        if (_authManager.Session.IsAuthenticated)
        {
            LogDebug("UpdateProfileUIForSyncedAccounts: Already authenticated via SSO, skipping");
            return;
        }

        // Check if we have synced email accounts
        if (_mainViewModel.HasSyncedAccounts && _mainViewModel.AccountRootFolder != null)
        {
            var emailAddress = _mainViewModel.AccountRootFolder.WwbwEmailAddress
                ?? _mainViewModel.AccountRootFolder.Name;

            if (!string.IsNullOrEmpty(emailAddress) && emailAddress != "My Account")
            {
                LogDebug($"UpdateProfileUIForSyncedAccounts: Found synced account - {emailAddress}");

                // Show signed-in state for synced account
                ProfileDefaultAvatar.Visibility = Visibility.Collapsed;
                ProfileDefaultIcon.Visibility = Visibility.Collapsed;
                ProfileUserAvatar.Visibility = Visibility.Visible;
                ProfileSyncIndicator.Visibility = Visibility.Visible;

                ProfileSignedOutPanel.Visibility = Visibility.Collapsed;
                ProfileSignedInPanel.Visibility = Visibility.Visible;

                // Set user info from synced account
                ProfilePopupName.Text = emailAddress;
                ProfilePopupEmail.Text = emailAddress;
                ProfileButton.ToolTip = emailAddress;

                // Create a default avatar with initials
                var initials = GetInitialsFromEmail(emailAddress);
                // Note: For now we keep the default avatar circle, but show it as "signed in"
            }
        }
        else
        {
            LogDebug("UpdateProfileUIForSyncedAccounts: No synced accounts found");
        }
    }

    /// <summary>
    /// Extracts initials from an email address for avatar display
    /// </summary>
    private string GetInitialsFromEmail(string email)
    {
        if (string.IsNullOrEmpty(email)) return "?";

        var namePart = email.Split('@')[0];
        if (namePart.Contains('.'))
        {
            var parts = namePart.Split('.');
            return (parts[0].FirstOrDefault().ToString() + parts[1].FirstOrDefault().ToString()).ToUpper();
        }
        return namePart.Length >= 2
            ? namePart.Substring(0, 2).ToUpper()
            : namePart.ToUpper();
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
            // Show or hide the ReadingPane based on whether there's a message to display
            if (_mainViewModel.DisplayedMessage != null)
            {
                // Show the reading pane when a message is selected
                if (ReadingPane != null) ReadingPane.Visibility = Visibility.Visible;
            }
            else
            {
                // Hide the reading pane when no message is selected (blank view)
                if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
            }

            UpdateEmailBodyBrowser();
        }

        // Handle folder pane visibility toggle
        if (e.PropertyName == nameof(MainViewModel.ShowFolderPane))
        {
            ToggleFolderPaneVisibility(_mainViewModel.ShowFolderPane);
        }

        // Handle conversation view toggle
        if (e.PropertyName == nameof(MainViewModel.ShowConversationView))
        {
            ToggleConversationViewMode(_mainViewModel.ShowConversationView);
        }
    }

    /// <summary>
    /// Toggles the folder pane visibility
    /// </summary>
    private void ToggleFolderPaneVisibility(bool showFolderPane)
    {
        System.Diagnostics.Debug.WriteLine($"[MainWindow] ToggleFolderPaneVisibility: {showFolderPane}");

        if (showFolderPane)
        {
            // Show folder pane
            FolderPaneColumn.Width = new GridLength(250);
            FolderPaneColumn.MinWidth = 150;
            FolderPaneBorder.Visibility = Visibility.Visible;
            FolderPaneSplitter.Visibility = Visibility.Visible;
        }
        else
        {
            // Hide folder pane
            FolderPaneColumn.Width = new GridLength(0);
            FolderPaneColumn.MinWidth = 0;
            FolderPaneBorder.Visibility = Visibility.Collapsed;
            FolderPaneSplitter.Visibility = Visibility.Collapsed;
        }
    }

    /// <summary>
    /// Toggles the conversation view mode
    /// </summary>
    private void ToggleConversationViewMode(bool showConversationView)
    {
        System.Diagnostics.Debug.WriteLine($"[MainWindow] ToggleConversationViewMode: {showConversationView}");

        // For now, conversation view groups emails by conversation ID
        // This is a visual mode that affects how emails are displayed in the message list
        // Full implementation would require grouping/sorting by ConversationId

        if (showConversationView)
        {
            // TODO: Group messages by ConversationId
            // For now, just log the state change
            System.Diagnostics.Debug.WriteLine("[MainWindow] Conversation view enabled - messages should be grouped by conversation");
        }
        else
        {
            // Show flat list of messages
            System.Diagnostics.Debug.WriteLine("[MainWindow] Conversation view disabled - showing flat message list");
        }
    }

    public void UpdateEmailBodyBrowser()
    {
        // Call the async version without blocking
        _ = UpdateEmailBodyBrowserAsync();
    }

    private async Task UpdateEmailBodyBrowserAsync()
    {
        if (EmailBodyBrowser == null) return;

        var message = _mainViewModel.DisplayedMessage;
        if (message == null)
        {
            // Clear the browser when no message is selected - totally blank dark page with no scrollbars
            EmailBodyBrowser.NavigateToString("<html style='overflow:hidden;'><body style='background-color:#000000; margin:0; padding:0; overflow:hidden;'></body></html>");
            return;
        }

        // Debug: Log body info
        Console.WriteLine($"[MainWindow] UpdateEmailBodyBrowser: Subject='{message.Subject}', Body length={message.Body?.Length ?? 0}, IsHtml={message.IsHtml}, NeedsBodyFetch={message.NeedsBodyFetch}");

        // Prepare the body content - handle both plain text and HTML
        var bodyContent = message.Body ?? message.Preview ?? string.Empty;

        // If it's plain text (no HTML tags), convert newlines to <br> for proper display
        if (!string.IsNullOrEmpty(bodyContent) && !bodyContent.Contains("<") && !bodyContent.Contains(">"))
        {
            bodyContent = System.Net.WebUtility.HtmlEncode(bodyContent).Replace("\n", "<br/>");
        }
        else if (!string.IsNullOrEmpty(bodyContent))
        {
            // Sanitize HTML - remove script tags for security
            bodyContent = System.Text.RegularExpressions.Regex.Replace(bodyContent, @"<script[^>]*>[\s\S]*?</script>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            bodyContent = System.Text.RegularExpressions.Regex.Replace(bodyContent, @"<script[^>]*/>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            // Remove event handlers (onclick, onload, etc.)
            bodyContent = System.Text.RegularExpressions.Regex.Replace(bodyContent, @"\s+on\w+\s*=\s*[""'][^""']*[""']", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            // Check for CID references and convert them to data URIs
            if (bodyContent.Contains("cid:") && message.AccountId.HasValue && !string.IsNullOrEmpty(message.RemoteMessageId))
            {
                bodyContent = await ConvertCidToDataUriAsync(bodyContent, message);
            }
        }

        // Wrap the email body in HTML with dark theme styling
        // Use a custom scrollable container with styled scrollbar for IE/Edge
        var htmlContent = $@"
<!DOCTYPE html>
<html style='height:100%; margin:0; padding:0; overflow:hidden;'>
<head>
    <meta charset='UTF-8'>
    <meta http-equiv='X-UA-Compatible' content='IE=edge'>
    <style>
        html, body {{
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #000000 !important;
            color: #FFFFFF !important;
        }}

        /* Custom scrollable container */
        .email-container {{
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            background-color: #000000 !important;
            color: #FFFFFF !important;
            font-family: 'Segoe UI', Calibri, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            padding: 20px;
            box-sizing: border-box;
            word-wrap: break-word;
            /* IE scrollbar colors */
            scrollbar-base-color: #1A1A1A;
            scrollbar-face-color: #3A3A3A;
            scrollbar-track-color: #1A1A1A;
            scrollbar-arrow-color: #606060;
            scrollbar-highlight-color: #2A2A2A;
            scrollbar-shadow-color: #0A0A0A;
            scrollbar-3dlight-color: #1A1A1A;
            scrollbar-darkshadow-color: #0A0A0A;
        }}

        /* Force white text on all elements - override email provider styling */
        .email-container,
        .email-container * {{
            color: #FFFFFF !important;
            background-color: transparent !important;
        }}
        .email-container {{
            background-color: #000000 !important;
        }}

        /* Common text elements */
        .email-container p,
        .email-container div,
        .email-container span,
        .email-container td,
        .email-container th,
        .email-container li,
        .email-container h1,
        .email-container h2,
        .email-container h3,
        .email-container h4,
        .email-container h5,
        .email-container h6,
        .email-container font,
        .email-container pre,
        .email-container code {{
            color: #FFFFFF !important;
        }}

        a, .email-container a {{
            color: #4A9EFF !important;
        }}
        strong, b, .email-container strong, .email-container b {{
            font-weight: 600;
            color: #FFFFFF !important;
        }}
        ul, ol {{
            padding-left: 20px;
        }}
        li {{
            margin-bottom: 4px;
        }}
        table {{
            border-collapse: collapse;
            max-width: 100%;
        }}
        td, th {{
            padding: 8px;
            border: 1px solid #333333 !important;
        }}
        img {{
            max-width: 100%;
            height: auto;
        }}
        pre, code {{
            background-color: #1A1A1A !important;
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
        }}
        blockquote {{
            border-left: 3px solid #444444;
            margin: 10px 0;
            padding-left: 15px;
            color: #CCCCCC !important;
        }}
        hr {{
            border: none;
            border-top: 1px solid #444444;
            margin: 20px 0;
        }}

        /* Override common dark text inline styles */
        [style*='color: black'], [style*='color:black'],
        [style*='color: #000'], [style*='color:#000'],
        [style*='color: rgb(0'], [style*='color:rgb(0'],
        [style*='color: #333'], [style*='color:#333'],
        [style*='color: #222'], [style*='color:#222'],
        [style*='color: #111'], [style*='color:#111'] {{
            color: #FFFFFF !important;
        }}
    </style>
</head>
<body>
    <div class='email-container'>
        {bodyContent}
    </div>
</body>
</html>";

        EmailBodyBrowser.NavigateToString(htmlContent);
    }

    /// <summary>
    /// Converts CID references in email body to data URIs by downloading inline images
    /// </summary>
    private async Task<string> ConvertCidToDataUriAsync(string bodyContent, Models.EmailMessage message)
    {
        try
        {
            if (message.AccountId == null || string.IsNullOrEmpty(message.RemoteMessageId))
                return bodyContent;

            // Get the folder ID from the message
            var folderId = Guid.TryParse(message.FolderId, out var folderGuid) ? folderGuid : Guid.Empty;
            if (folderId == Guid.Empty)
            {
                System.Diagnostics.Debug.WriteLine("[MainWindow] Cannot convert CID: Invalid folder ID");
                return bodyContent;
            }

            // Get the synced email display service
            var syncedEmailService = new Services.EmailSync.SyncedEmailDisplayService();

            // Download inline images
            var cidToPath = await syncedEmailService.DownloadInlineImagesAsync(
                message.AccountId.Value,
                folderId,
                message.RemoteMessageId);

            if (cidToPath.Count == 0)
            {
                System.Diagnostics.Debug.WriteLine("[MainWindow] No inline images found to convert");
                return bodyContent;
            }

            // Convert CID references to data URIs
            var result = bodyContent;
            foreach (var kvp in cidToPath)
            {
                var contentId = kvp.Key;
                var filePath = kvp.Value;

                if (!IOFile.Exists(filePath))
                    continue;

                try
                {
                    // Read file and convert to base64
                    var fileBytes = await System.Threading.Tasks.Task.Run(() => IOFile.ReadAllBytes(filePath));
                    var base64 = Convert.ToBase64String(fileBytes);

                    // Determine MIME type from extension
                    var extension = IOPath.GetExtension(filePath).ToLowerInvariant();
                    var mimeType = extension switch
                    {
                        ".jpg" or ".jpeg" => "image/jpeg",
                        ".png" => "image/png",
                        ".gif" => "image/gif",
                        ".bmp" => "image/bmp",
                        ".webp" => "image/webp",
                        _ => "image/png"
                    };

                    // Create data URI
                    var dataUri = $"data:{mimeType};base64,{base64}";

                    // Replace CID reference with data URI
                    result = result.Replace($"cid:{contentId}", dataUri);
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] Converted CID:{contentId} to data URI");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] Error converting CID {contentId}: {ex.Message}");
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error in ConvertCidToDataUriAsync: {ex.Message}");
            return bodyContent;
        }
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

        // Show/hide module-specific title bar tabs and ribbon elements
        bool isMailModule = module == AppModule.Mail;
        bool isPeopleModule = module == AppModule.People;
        if (MailTabsPanel != null) MailTabsPanel.Visibility = isMailModule ? Visibility.Visible : Visibility.Collapsed;
        if (MailRibbonPanel != null) MailRibbonPanel.Visibility = isMailModule ? Visibility.Visible : Visibility.Collapsed;
        if (PeopleTabsPanel != null) PeopleTabsPanel.Visibility = isPeopleModule ? Visibility.Visible : Visibility.Collapsed;

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
                // Set the user email for the People view and reload contacts
                if (PeopleViewControl != null)
                {
                    var userEmail = _mainViewModel.AccountRootFolder?.WwbwEmailAddress
                        ?? _mainViewModel.AccountRootFolder?.Name
                        ?? _mainViewModel.WwbwEmailAddress
                        ?? _authManager.Session?.Profile?.Email
                        ?? "user@example.com";
                    PeopleViewControl.SetUserEmail(userEmail);

                    // Reload contacts when People module is shown (ensures correct user ID is used)
                    if (PeopleViewControl.DataContext is ViewModels.PeopleViewModel peopleViewModel)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MainWindow] Reloading contacts for People module, UserId: {Services.ServiceConfiguration.UserId}");
                        _ = peopleViewModel.LoadContactsFromDatabaseAsync();
                    }
                }
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

        // Get the user's email address from synced account or fallback to profile email
        var userEmail = _mainViewModel.AccountRootFolder?.WwbwEmailAddress
            ?? _mainViewModel.AccountRootFolder?.Name
            ?? _mainViewModel.WwbwEmailAddress
            ?? _authManager.Session?.Profile?.Email;

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

    /// <summary>
    /// Shows the compose panel with a pre-filled recipient email (from People module)
    /// </summary>
    private void ShowComposePanelWithRecipient(string recipientEmail)
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

        // Get the user's email address from synced account or fallback to profile email
        var userEmail = _mainViewModel.AccountRootFolder?.WwbwEmailAddress
            ?? _mainViewModel.AccountRootFolder?.Name
            ?? _mainViewModel.WwbwEmailAddress
            ?? _authManager.Session?.Profile?.Email;

        // Start composing with the recipient pre-filled
        _composeMailViewModel.StartComposingTo(userEmail, recipientEmail);

        // Set the DataContext for the compose panel
        if (ComposeMailPanel != null)
        {
            ComposeMailPanel.DataContext = _composeMailViewModel;
        }

        // Switch to Mail module to show the compose panel
        _appViewModel.ActiveModule = AppModule.Mail;

        // Hide reading pane, show compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Visible;
    }

    /// <summary>
    /// Subscribes to PeopleView events for integration with other modules
    /// </summary>
    private void SubscribeToPeopleViewEvents()
    {
        if (PeopleViewControl?.DataContext is ViewModels.PeopleViewModel peopleViewModel)
        {
            peopleViewModel.EmailContactRequested += (s, email) =>
            {
                System.Diagnostics.Debug.WriteLine($"[MainWindow] EmailContactRequested - Opening compose for: {email}");
                Dispatcher.Invoke(() => ShowComposePanelWithRecipient(email));
            };

            peopleViewModel.ChatFeatureRequested += (s, contactName) =>
            {
                System.Diagnostics.Debug.WriteLine($"[MainWindow] ChatFeatureRequested for: {contactName}");
                Dispatcher.Invoke(() =>
                {
                    NotificationService.Instance.ShowInfo($"Chat feature coming soon. Cannot chat with {contactName} yet.");
                });
            };
        }
    }

    private async Task ShowComposePanelWithDraftAsync(Models.EmailMessage draft)
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

        // Get the user's email address from synced account or fallback to profile email
        var userEmail = _mainViewModel.AccountRootFolder?.WwbwEmailAddress
            ?? _mainViewModel.AccountRootFolder?.Name
            ?? _mainViewModel.WwbwEmailAddress
            ?? _authManager.Session?.Profile?.Email;

        // For synced drafts, use RemoteMessageId as the draft ID
        var draftId = !string.IsNullOrEmpty(draft.RemoteMessageId) ? draft.RemoteMessageId : draft.Id;

        // Initialize variables for draft content
        var bodyContent = draft.Body ?? string.Empty;
        var cidImagePaths = new Dictionary<string, string>();
        List<ViewModels.AttachmentInfo>? attachments = null;

        // For synced drafts, fetch body, images, and attachments in a SINGLE connection to reduce latency
        if (draft.AccountId.HasValue && !string.IsNullOrEmpty(draft.RemoteMessageId) &&
            (string.IsNullOrEmpty(bodyContent) || draft.NeedsBodyFetch || draft.HasAttachments))
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Fetching all draft content in single connection for: {draft.Subject}");
            try
            {
                Guid folderId = Guid.Empty;
                if (Guid.TryParse(draft.FolderId, out var parsedFolderId))
                {
                    folderId = parsedFolderId;
                }

                var syncedEmailService = new SyncedEmailDisplayService();
                var draftContent = await syncedEmailService.FetchDraftContentAsync(
                    draft.AccountId.Value,
                    folderId,
                    draft.RemoteMessageId);

                // Update body content
                if (!string.IsNullOrEmpty(draftContent.Body))
                {
                    bodyContent = draftContent.Body;
                    draft.Body = draftContent.Body;
                    draft.NeedsBodyFetch = false;
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] Draft body fetched, length: {bodyContent.Length}");
                }

                // Get inline images
                cidImagePaths = draftContent.InlineImages;
                System.Diagnostics.Debug.WriteLine($"[MainWindow] Got {cidImagePaths.Count} inline images");

                // Get attachments
                if (draftContent.Attachments.Count > 0)
                {
                    attachments = draftContent.Attachments.Select(a => new ViewModels.AttachmentInfo
                    {
                        FileName = a.FileName,
                        FilePath = a.FilePath,
                        FileSize = FormatFileSizeForCompose(a.FileSize)
                    }).ToList();
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] Got {attachments.Count} attachments");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MainWindow] Error fetching draft content: {ex.Message}");
            }
        }

        // Store the original HTML body for sending (preserve images)
        var htmlBody = bodyContent;
        var isHtmlBody = bodyContent.Contains("<") && bodyContent.Contains(">");

        // Extract plain text for display in RichTextBox
        var plainTextBody = bodyContent;
        if (isHtmlBody)
        {
            // Remove HTML tags but preserve newlines from <br>, <p>, <div>
            plainTextBody = System.Text.RegularExpressions.Regex.Replace(bodyContent, @"<br\s*/?>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            plainTextBody = System.Text.RegularExpressions.Regex.Replace(plainTextBody, @"</p>|</div>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            plainTextBody = System.Text.RegularExpressions.Regex.Replace(plainTextBody, @"<[^>]+>", "");
            plainTextBody = System.Net.WebUtility.HtmlDecode(plainTextBody).Trim();
        }

        // Fallback to local attachments if available (for non-synced drafts)
        if (attachments == null && draft.Attachments != null && draft.Attachments.Count > 0)
        {
            attachments = draft.Attachments
                .Where(a => !string.IsNullOrEmpty(a.FilePath))
                .Select(a => new ViewModels.AttachmentInfo
                {
                    FileName = a.FileName,
                    FilePath = a.FilePath ?? string.Empty,
                    FileSize = FormatFileSizeForCompose(a.FileSize)
                }).ToList();
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Loading {attachments.Count} local attachments for draft");
        }

        // Load the draft into the compose form
        _composeMailViewModel.LoadDraft(
            draftId: draftId,
            to: string.Join("; ", draft.To ?? new List<string>()),
            cc: string.Join("; ", draft.Cc ?? new List<string>()),
            bcc: string.Join("; ", draft.Bcc ?? new List<string>()),
            subject: draft.Subject ?? string.Empty,
            body: plainTextBody,
            fromEmail: userEmail,
            attachments: attachments
        );

        // Set the DataContext for the compose panel
        if (ComposeMailPanel != null)
        {
            ComposeMailPanel.DataContext = _composeMailViewModel;
        }

        // Update the RichTextBox content with draft body (handles HTML/plain text and inline images)
        UpdateComposeBodyFromDraft(plainTextBody, htmlBody, isHtmlBody, cidImagePaths);

        // Update attachments section visibility
        UpdateAttachmentsSectionVisibility();

        // Hide reading pane, show compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Visible;
    }

    /// <summary>
    /// Show compose panel in Reply mode for the selected message
    /// </summary>
    private void ShowComposePanelForReply()
    {
        if (_mainViewModel.DisplayedMessage == null) return;

        var message = _mainViewModel.DisplayedMessage;

        // Create a new compose view model if needed
        if (_composeMailViewModel == null)
        {
            _composeMailViewModel = new ViewModels.ComposeMailViewModel();
            _composeMailViewModel.MailSent += OnMailSent;
            _composeMailViewModel.ComposeCancelled += OnComposeCancelled;
            _composeMailViewModel.SendMailRequested += OnSendMailRequested;
            _composeMailViewModel.SaveDraftRequested += OnSaveDraftRequested;
        }

        // Get the user's email address
        var userEmail = _mainViewModel.AccountRootFolder?.WwbwEmailAddress
            ?? _mainViewModel.AccountRootFolder?.Name
            ?? _mainViewModel.WwbwEmailAddress
            ?? _authManager.Session?.Profile?.Email
            ?? string.Empty;

        // Start reply mode
        _composeMailViewModel.StartReply(
            fromEmail: userEmail,
            toEmail: message.FromEmail ?? message.From ?? string.Empty,
            toName: message.From ?? string.Empty,
            originalSubject: message.Subject ?? string.Empty,
            originalBody: message.Body ?? message.Preview ?? string.Empty,
            originalDate: message.ReceivedDate,
            isHtml: message.IsHtml
        );

        // Set the DataContext for the compose panel
        if (ComposeMailPanel != null)
        {
            ComposeMailPanel.DataContext = _composeMailViewModel;
        }

        // Hide reading pane, show compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Visible;

        // Set the body content in the RichTextBox (must be done after panel is visible)
        if (ComposeMailPanel != null && _composeMailViewModel != null)
        {
            ComposeMailPanel.SetBodyContent(_composeMailViewModel.Body);
        }
    }

    /// <summary>
    /// Show compose panel in Reply All mode for the selected message
    /// </summary>
    private void ShowComposePanelForReplyAll()
    {
        if (_mainViewModel.DisplayedMessage == null) return;

        var message = _mainViewModel.DisplayedMessage;

        // Create a new compose view model if needed
        if (_composeMailViewModel == null)
        {
            _composeMailViewModel = new ViewModels.ComposeMailViewModel();
            _composeMailViewModel.MailSent += OnMailSent;
            _composeMailViewModel.ComposeCancelled += OnComposeCancelled;
            _composeMailViewModel.SendMailRequested += OnSendMailRequested;
            _composeMailViewModel.SaveDraftRequested += OnSaveDraftRequested;
        }

        // Get the user's email address
        var userEmail = _mainViewModel.AccountRootFolder?.WwbwEmailAddress
            ?? _mainViewModel.AccountRootFolder?.Name
            ?? _mainViewModel.WwbwEmailAddress
            ?? _authManager.Session?.Profile?.Email
            ?? string.Empty;

        // Build CC list (original recipients minus the user)
        var ccList = new List<string>();
        if (message.To != null)
        {
            ccList.AddRange(message.To.Where(e => !e.Equals(userEmail, StringComparison.OrdinalIgnoreCase)));
        }
        if (message.Cc != null)
        {
            ccList.AddRange(message.Cc.Where(e => !e.Equals(userEmail, StringComparison.OrdinalIgnoreCase)));
        }
        var ccString = string.Join("; ", ccList.Distinct());

        // Start reply-all mode
        _composeMailViewModel.StartReplyAll(
            fromEmail: userEmail,
            toEmail: message.FromEmail ?? message.From ?? string.Empty,
            toName: message.From ?? string.Empty,
            originalCc: ccString,
            originalSubject: message.Subject ?? string.Empty,
            originalBody: message.Body ?? message.Preview ?? string.Empty,
            originalDate: message.ReceivedDate,
            isHtml: message.IsHtml
        );

        // Set the DataContext for the compose panel
        if (ComposeMailPanel != null)
        {
            ComposeMailPanel.DataContext = _composeMailViewModel;
        }

        // Hide reading pane, show compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Visible;

        // Set the body content in the RichTextBox (must be done after panel is visible)
        if (ComposeMailPanel != null && _composeMailViewModel != null)
        {
            ComposeMailPanel.SetBodyContent(_composeMailViewModel.Body);
        }
    }

    /// <summary>
    /// Show compose panel in Forward mode for the selected message
    /// </summary>
    private void ShowComposePanelForForward()
    {
        if (_mainViewModel.DisplayedMessage == null) return;

        var message = _mainViewModel.DisplayedMessage;

        // Create a new compose view model if needed
        if (_composeMailViewModel == null)
        {
            _composeMailViewModel = new ViewModels.ComposeMailViewModel();
            _composeMailViewModel.MailSent += OnMailSent;
            _composeMailViewModel.ComposeCancelled += OnComposeCancelled;
            _composeMailViewModel.SendMailRequested += OnSendMailRequested;
            _composeMailViewModel.SaveDraftRequested += OnSaveDraftRequested;
        }

        // Get the user's email address
        var userEmail = _mainViewModel.AccountRootFolder?.WwbwEmailAddress
            ?? _mainViewModel.AccountRootFolder?.Name
            ?? _mainViewModel.WwbwEmailAddress
            ?? _authManager.Session?.Profile?.Email
            ?? string.Empty;

        // Convert attachments to AttachmentInfo format
        List<ViewModels.AttachmentInfo>? attachments = null;
        if (message.Attachments != null && message.Attachments.Count > 0)
        {
            attachments = message.Attachments.Select(a => new ViewModels.AttachmentInfo
            {
                FileName = a.FileName,
                FilePath = a.FilePath ?? string.Empty,
                FileSize = FormatFileSizeForCompose(a.FileSize)
            }).ToList();
        }

        // Start forward mode
        _composeMailViewModel.StartForward(
            fromEmail: userEmail,
            originalFrom: message.From ?? string.Empty,
            originalFromEmail: message.FromEmail ?? message.From ?? string.Empty,
            originalTo: string.Join("; ", message.To ?? new List<string>()),
            originalSubject: message.Subject ?? string.Empty,
            originalBody: message.Body ?? message.Preview ?? string.Empty,
            originalDate: message.ReceivedDate,
            attachments: attachments,
            isHtml: message.IsHtml
        );

        // Set the DataContext for the compose panel
        if (ComposeMailPanel != null)
        {
            ComposeMailPanel.DataContext = _composeMailViewModel;
        }

        // Hide reading pane, show compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Visible;

        // Set the body content in the RichTextBox (must be done after panel is visible)
        if (ComposeMailPanel != null && _composeMailViewModel != null)
        {
            ComposeMailPanel.SetBodyContent(_composeMailViewModel.Body);
        }

        // Show attachments section if we have attachments
        if (attachments != null && attachments.Count > 0)
        {
            ComposeMailPanel?.ShowAttachmentsSection();
        }
    }

    private void UpdateComposeBodyFromViewModel()
    {
        if (ComposeMailPanel == null || _composeMailViewModel == null) return;

        // Find the RichTextBox in ComposeMailPanel
        var richTextBox = FindName("MessageBodyEditor") as System.Windows.Controls.RichTextBox;
        if (richTextBox == null)
        {
            // Try to find it within the ComposeMailPanel
            richTextBox = ComposeMailPanel.FindName("MessageBodyEditor") as System.Windows.Controls.RichTextBox;
        }

        if (richTextBox != null && !string.IsNullOrEmpty(_composeMailViewModel.Body))
        {
            richTextBox.Document.Blocks.Clear();
            richTextBox.Document.Blocks.Add(new System.Windows.Documents.Paragraph(
                new System.Windows.Documents.Run(_composeMailViewModel.Body)));
        }
    }

    private void UpdateComposeBodyFromDraft(string plainText, string htmlBody, bool isHtml, Dictionary<string, string>? cidImagePaths = null)
    {
        if (ComposeMailPanel == null) return;

        // Find the RichTextBox in ComposeMailPanel
        var richTextBox = FindName("MessageBodyEditor") as System.Windows.Controls.RichTextBox;
        if (richTextBox == null)
        {
            richTextBox = ComposeMailPanel.FindName("MessageBodyEditor") as System.Windows.Controls.RichTextBox;
        }

        if (richTextBox == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainWindow] RichTextBox 'MessageBodyEditor' not found");
            return;
        }

        richTextBox.Document.Blocks.Clear();

        if (string.IsNullOrEmpty(plainText) && string.IsNullOrEmpty(htmlBody))
        {
            System.Diagnostics.Debug.WriteLine("[MainWindow] No body content to display in draft");
            return;
        }

        System.Diagnostics.Debug.WriteLine($"[MainWindow] Loading draft body into RichTextBox, isHtml={isHtml}, plainText length={plainText?.Length ?? 0}, cidImages={cidImagePaths?.Count ?? 0}");

        // If we have HTML content with CID images, parse it and insert text + images
        if (isHtml && cidImagePaths != null && cidImagePaths.Count > 0 && !string.IsNullOrEmpty(htmlBody))
        {
            InsertHtmlWithImagesIntoRichTextBox(richTextBox, htmlBody, cidImagePaths);
        }
        else if (!string.IsNullOrEmpty(plainText))
        {
            // No images, just load plain text
            // Split by newlines and add as separate paragraphs
            var lines = plainText.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            foreach (var line in lines)
            {
                var paragraph = new System.Windows.Documents.Paragraph(
                    new System.Windows.Documents.Run(line));
                paragraph.Margin = new Thickness(0);
                richTextBox.Document.Blocks.Add(paragraph);
            }
        }
    }

    private void InsertHtmlWithImagesIntoRichTextBox(System.Windows.Controls.RichTextBox richTextBox, string htmlBody, Dictionary<string, string> cidImagePaths)
    {
        // Parse the HTML and extract text and image positions
        // Pattern to match <img src="cid:xxx"> tags
        var imgPattern = new System.Text.RegularExpressions.Regex(@"<img[^>]+src=[""']cid:([^""']+)[""'][^>]*>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Split the HTML by img tags to process text and images in order
        var parts = imgPattern.Split(htmlBody);
        var matches = imgPattern.Matches(htmlBody);

        System.Diagnostics.Debug.WriteLine($"[MainWindow] Parsing HTML: {parts.Length} parts, {matches.Count} image matches");

        var currentParagraph = new System.Windows.Documents.Paragraph();
        currentParagraph.Margin = new Thickness(0);

        for (int i = 0; i < parts.Length; i++)
        {
            var part = parts[i];

            // Check if this part is a CID reference (captured group from regex)
            if (i > 0 && i % 2 == 1)
            {
                // This is a captured CID - insert the image if we have it
                var cid = part;
                System.Diagnostics.Debug.WriteLine($"[MainWindow] Processing CID: {cid}");

                if (cidImagePaths.TryGetValue(cid, out var imagePath) && System.IO.File.Exists(imagePath))
                {
                    try
                    {
                        // Add current paragraph if it has content
                        if (currentParagraph.Inlines.Count > 0)
                        {
                            richTextBox.Document.Blocks.Add(currentParagraph);
                            currentParagraph = new System.Windows.Documents.Paragraph();
                            currentParagraph.Margin = new Thickness(0);
                        }

                        // Create image element
                        var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                        bitmap.BeginInit();
                        bitmap.UriSource = new Uri(imagePath);
                        bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                        bitmap.EndInit();

                        var image = new System.Windows.Controls.Image
                        {
                            Source = bitmap,
                            MaxWidth = 600,
                            Stretch = System.Windows.Media.Stretch.Uniform,
                            Margin = new Thickness(0, 4, 0, 4),
                            Tag = imagePath // Store file path for email sending
                        };

                        // Add image in its own paragraph
                        var imageParagraph = new System.Windows.Documents.Paragraph();
                        imageParagraph.Margin = new Thickness(0);
                        var container = new System.Windows.Documents.InlineUIContainer(image);
                        imageParagraph.Inlines.Add(container);
                        richTextBox.Document.Blocks.Add(imageParagraph);

                        // Also add to viewmodel's embedded images for re-sending
                        if (_composeMailViewModel != null)
                        {
                            _composeMailViewModel.EmbeddedImages.Add(new ViewModels.EmbeddedImageData
                            {
                                ContentId = cid,
                                FilePath = imagePath,
                                FileName = System.IO.Path.GetFileName(imagePath)
                            });
                        }

                        System.Diagnostics.Debug.WriteLine($"[MainWindow] Inserted image for CID: {cid}");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MainWindow] Error inserting image for CID {cid}: {ex.Message}");
                    }
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] Image not found for CID: {cid}");
                }
            }
            else
            {
                // This is text/HTML content - strip tags and add as text
                if (!string.IsNullOrEmpty(part))
                {
                    // Strip HTML tags and decode entities
                    var text = System.Text.RegularExpressions.Regex.Replace(part, @"<br\s*/?>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    text = System.Text.RegularExpressions.Regex.Replace(text, @"</p>|</div>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    text = System.Text.RegularExpressions.Regex.Replace(text, @"<[^>]+>", "");
                    text = System.Net.WebUtility.HtmlDecode(text);

                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        // Split by newlines and handle paragraphs
                        var lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                        for (int j = 0; j < lines.Length; j++)
                        {
                            if (j > 0)
                            {
                                // New line - start a new paragraph
                                if (currentParagraph.Inlines.Count > 0 || richTextBox.Document.Blocks.Count == 0)
                                {
                                    richTextBox.Document.Blocks.Add(currentParagraph);
                                }
                                currentParagraph = new System.Windows.Documents.Paragraph();
                                currentParagraph.Margin = new Thickness(0);
                            }

                            if (!string.IsNullOrEmpty(lines[j]))
                            {
                                currentParagraph.Inlines.Add(new System.Windows.Documents.Run(lines[j]));
                            }
                        }
                    }
                }
            }
        }

        // Add the final paragraph if it has content
        if (currentParagraph.Inlines.Count > 0)
        {
            richTextBox.Document.Blocks.Add(currentParagraph);
        }

        // Ensure at least one empty paragraph for editing
        if (richTextBox.Document.Blocks.Count == 0)
        {
            richTextBox.Document.Blocks.Add(new System.Windows.Documents.Paragraph());
        }
    }

    private void UpdateAttachmentsSectionVisibility()
    {
        if (ComposeMailPanel == null) return;

        // Find the AttachmentsSection border in ComposeMailPanel
        var attachmentsSection = ComposeMailPanel.FindName("AttachmentsSection") as System.Windows.Controls.Border;
        if (attachmentsSection != null && _composeMailViewModel != null)
        {
            attachmentsSection.Visibility = _composeMailViewModel.Attachments.Count > 0
                ? Visibility.Visible
                : Visibility.Collapsed;
        }
    }

    private string FormatFileSizeForCompose(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB" };
        double len = bytes;
        int order = 0;
        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len /= 1024;
        }
        return $"{len:0.##} {sizes[order]}";
    }

    private void HideComposePanel()
    {
        // Show reading pane, hide compose panel
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Visible;
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Collapsed;
    }

    private async void OnMailSent(object? sender, EventArgs e)
    {
        // Mail was sent successfully - hide compose panel but show blank reading pane
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Collapsed;

        // Clear the mail preview to show completely blank after sending
        _mainViewModel.DisplayedMessage = null;
        _mainViewModel.SelectedMessage = null;

        // Hide the reading pane completely for a clean blank view
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;

        // Clear the browser content
        EmailBodyBrowser.NavigateToString("<html><body style='background-color:#000000; margin:0; padding:0;'></body></html>");

        // Check if we're in the Sent folder - if so, refresh to show the new message
        if (_mainViewModel.SelectedFolder != null &&
            _mainViewModel.SelectedFolder.Id.ToLower().Contains("sent"))
        {
            await _mainViewModel.RefreshMessagesAsync();
        }
    }

    private void OnComposeCancelled(object? sender, EventArgs e)
    {
        // Hide compose panel
        if (ComposeMailPanel != null) ComposeMailPanel.Visibility = Visibility.Collapsed;

        // Clear displayed message so reading pane shows blank after closing compose
        _mainViewModel.DisplayedMessage = null;
        _mainViewModel.SelectedMessage = null;

        // Hide the reading pane completely for a clean blank view
        if (ReadingPane != null) ReadingPane.Visibility = Visibility.Collapsed;

        // Clear the browser content
        EmailBodyBrowser.NavigateToString("<html><body style='background-color:#000000; margin:0; padding:0;'></body></html>");
    }

    private async void OnSendMailRequested(object? sender, ViewModels.SendMailEventArgs e)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Sending email from: {e.From}");
            System.Diagnostics.Debug.WriteLine($"[MainWindow] To: {string.Join(", ", e.To)}");
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Subject: {e.Subject}");
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Attachments: {e.Attachments.Count}");

            // Use the EmailSendingService to send via SMTP
            var emailSendingService = new EmailSendingService();

            // Convert attachments to the service format
            var attachments = e.Attachments.Select(a => new EmailAttachmentInfo
            {
                FileName = a.FileName,
                FilePath = a.FilePath,
                FileSize = System.IO.File.Exists(a.FilePath) ? new System.IO.FileInfo(a.FilePath).Length : 0
            }).ToList();

            // Convert embedded images to the service format
            var embeddedImages = e.EmbeddedImages.Select(img => new EmbeddedImageInfo
            {
                ContentId = img.ContentId,
                FilePath = img.FilePath,
                FileName = img.FileName
            }).ToList();

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Embedded images: {embeddedImages.Count}");

            // Send the email via SMTP - body is HTML from RichTextBox
            var result = await emailSendingService.SendEmailAsync(
                fromEmail: e.From,
                toRecipients: e.To,
                ccRecipients: e.Cc,
                bccRecipients: e.Bcc,
                subject: e.Subject,
                body: e.Body,
                isHtml: true, // HTML formatted from RichTextBox
                attachments: attachments,
                embeddedImages: embeddedImages);

            if (result.Success)
            {
                System.Diagnostics.Debug.WriteLine($"[MainWindow] Email sent successfully! MessageId: {result.MessageId}");

                // Also save to Sent Items folder via API for local storage
                await SaveToSentFolderAsync(e, result.MessageId);

                // If this was a draft being edited, delete the draft from the server
                if (_composeMailViewModel?.CurrentDraftId != null)
                {
                    await DeleteDraftAfterSendAsync(_composeMailViewModel.CurrentDraftId, e.From);
                }

                // Notify the compose view model that send succeeded
                _composeMailViewModel?.NotifyMailSentSuccess();

                // Show success notification
                NotificationService.Instance.ShowSuccess("Email sent successfully!");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[MainWindow] Email send failed: {result.ErrorMessage}");

                // Notify the compose view model of the failure
                _composeMailViewModel?.NotifyMailSentFailed(result.ErrorMessage ?? "Failed to send email");

                // Show error dialog
                MessageDialog.ShowError(this, result.ErrorMessage ?? "Failed to send email", "Send Error");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error sending email: {ex.Message}");

            // Notify the compose view model of the failure
            _composeMailViewModel?.NotifyMailSentFailed($"Failed to send email: {ex.Message}");

            MessageDialog.ShowError(this, $"Failed to send email: {ex.Message}", "Send Error");
        }
    }

    /// <summary>
    /// Save the sent email to the Sent Items folder via API
    /// </summary>
    private async Task SaveToSentFolderAsync(ViewModels.SendMailEventArgs e, string? messageId)
    {
        try
        {
            var senderName = _mainViewModel.AccountRootFolder?.Name ?? e.From;

            var emailMessage = new Models.EmailMessage
            {
                Id = messageId ?? Guid.NewGuid().ToString(),
                Subject = string.IsNullOrWhiteSpace(e.Subject) ? "(No Subject)" : e.Subject,
                From = senderName,
                FromEmail = e.From,
                To = e.To,
                Cc = e.Cc,
                Bcc = e.Bcc,
                Body = e.Body,
                IsHtml = false,
                SentDate = DateTime.Now,
                ReceivedDate = DateTime.Now,
                IsRead = true,
                FolderId = null, // Let API auto-select Sent folder based on folder_type
                Preview = e.Body.Length > 100 ? e.Body.Substring(0, 100) + "..." : e.Body,
                HasAttachments = e.Attachments.Count > 0
            };

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

            // Save to API
            var mailService = Services.ServiceConfiguration.GetMailService();
            await mailService.SendMessageAsync(emailMessage);

            // Add the sent message to the collection for immediate display
            _mainViewModel.AddSentMessageToCollection(emailMessage);

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Email saved to Sent folder");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error saving to Sent folder: {ex.Message}");
            // Don't fail the send operation if saving to API fails
        }
    }

    /// <summary>
    /// Delete the draft from the server after successfully sending the email
    /// </summary>
    private async Task DeleteDraftAfterSendAsync(string draftId, string fromEmail)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Deleting draft {draftId} after send");

            var emailSendingService = new Services.EmailSync.EmailSendingService();
            await emailSendingService.DeleteDraftAsync(fromEmail, draftId);

            // Also remove from local cache
            if (_mainViewModel.SelectedFolder?.Type == Models.FolderType.Drafts)
            {
                // Find and remove the draft from the Messages collection
                var draftMessage = _mainViewModel.Messages.FirstOrDefault(m =>
                    m.RemoteMessageId == draftId || m.Id == draftId);
                if (draftMessage != null)
                {
                    await Dispatcher.InvokeAsync(() => _mainViewModel.Messages.Remove(draftMessage));
                }
            }

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Draft deleted successfully");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Error deleting draft: {ex.Message}");
            // Don't fail the send operation if draft deletion fails
        }
    }

    private async void OnSaveDraftRequested(object? sender, ViewModels.SaveDraftEventArgs e)
    {
        try
        {
            var senderEmail = e.From;
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Saving draft: {e.Subject}");

            // Check if this is a synced account - use IMAP draft saving
            if (_mainViewModel.HasSyncedAccounts)
            {
                var emailSendingService = new Services.EmailSync.EmailSendingService();

                // Convert attachments
                var attachments = e.Attachments.Select(a => new Services.EmailSync.EmailAttachmentInfo
                {
                    FileName = a.FileName,
                    FilePath = a.FilePath,
                    FileSize = System.IO.File.Exists(a.FilePath) ? new System.IO.FileInfo(a.FilePath).Length : 0
                }).ToList();

                // Convert embedded images
                var embeddedImages = e.EmbeddedImages.Select(img => new Services.EmailSync.EmbeddedImageInfo
                {
                    ContentId = img.ContentId,
                    FilePath = img.FilePath,
                    FileName = img.FileName
                }).ToList();

                // Determine if content is HTML (check for HTML tags or CID references)
                var isHtmlContent = !string.IsNullOrEmpty(e.Body) &&
                    (e.Body.Contains("<") && e.Body.Contains(">") || e.Body.Contains("cid:"));

                System.Diagnostics.Debug.WriteLine($"[MainWindow] Draft body is HTML: {isHtmlContent}, embedded images: {embeddedImages.Count}");

                // Save draft to IMAP Drafts folder with embedded images
                var result = await emailSendingService.SaveDraftAsync(
                    senderEmail,
                    e.To,
                    e.Cc,
                    e.Bcc,
                    e.Subject,
                    e.Body,
                    isHtml: isHtmlContent,
                    existingDraftId: e.DraftId,
                    attachments: attachments.Count > 0 ? attachments : null,
                    embeddedImages: embeddedImages.Count > 0 ? embeddedImages : null);

                if (result.Success)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] Draft saved to IMAP with ID: {result.DraftId}");
                    _composeMailViewModel?.SetDraftId(result.DraftId ?? "");
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] IMAP draft save failed: {result.ErrorMessage}");
                }
            }
            else
            {
                // Fallback to API draft saving for non-synced accounts
                var senderName = _authManager.Session?.Profile?.DisplayName ?? "You";

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

                var mailService = Services.ServiceConfiguration.GetMailService();
                var savedDraft = await mailService.SaveDraftAsync(draftMessage, e.DraftId);

                System.Diagnostics.Debug.WriteLine($"[MainWindow] Draft saved via API with ID: {savedDraft.Id}");
                _composeMailViewModel?.SetDraftId(savedDraft.Id);
            }
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

    private async void MessageListBox_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        // Check if a message is selected
        if (_mainViewModel.SelectedMessage == null) return;

        // Check if the message is in the Drafts folder
        if (_mainViewModel.SelectedFolder?.Type == Models.FolderType.Drafts)
        {
            // Open the draft for editing in compose panel
            await ShowComposePanelWithDraftAsync(_mainViewModel.SelectedMessage);
        }
        // For other folders, double-click could open in a new window (future enhancement)
        // For now, just keep the reading pane visible
    }

    #endregion

    #region Email Refresh/Sync

    private bool _isSyncing = false;
    private System.Windows.Media.Animation.Storyboard? _refreshSpinnerStoryboard;

    private async void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isSyncing)
        {
            System.Diagnostics.Debug.WriteLine("[MainWindow] Sync already in progress, ignoring click");
            return;
        }

        await RefreshEmailAsync();
    }

    private async Task RefreshEmailAsync()
    {
        _isSyncing = true;
        System.Diagnostics.Debug.WriteLine("[MainWindow] Starting email refresh/sync");

        try
        {
            // Show spinner, hide normal icon
            Dispatcher.Invoke(() =>
            {
                RefreshIcon.Visibility = Visibility.Collapsed;
                RefreshSpinner.Visibility = Visibility.Visible;
                RefreshButton.IsEnabled = false;
                StartRefreshSpinnerAnimation();
            });

            // Get the sync coordinator
            var syncCoordinator = new EmailSyncCoordinator();

            // Subscribe to progress events
            syncCoordinator.SyncProgress += (s, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    // Update status bar or show progress
                    System.Diagnostics.Debug.WriteLine($"[Sync Progress] {args.Message} ({args.PercentComplete}%)");
                });
            };

            syncCoordinator.SyncStatusChanged += (s, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    System.Diagnostics.Debug.WriteLine($"[Sync Status] {args.Status}: {args.Message}");
                });
            };

            // Sync all accounts
            await syncCoordinator.SyncAllAccountsAsync();

            // Reload the folder list and messages after sync
            await Dispatcher.InvokeAsync(async () =>
            {
                // Reload folders
                var displayService = new SyncedEmailDisplayService();
                var folders = await displayService.BuildFolderTreeAsync();

                if (folders.Count > 0)
                {
                    _mainViewModel.Folders.Clear();
                    foreach (var folder in folders)
                    {
                        _mainViewModel.Folders.Add(folder);
                    }

                    // Reload messages for current folder
                    if (_mainViewModel.SelectedFolder != null)
                    {
                        var currentFolderId = _mainViewModel.SelectedFolder.Id;

                        var messages = await displayService.GetDisplayMessagesAsync(currentFolderId);
                        _mainViewModel.Messages.Clear();
                        foreach (var msg in messages)
                        {
                            _mainViewModel.Messages.Add(msg);
                        }
                    }
                }

                System.Diagnostics.Debug.WriteLine("[MainWindow] Email refresh completed successfully");
            });

            syncCoordinator.Dispose();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Email refresh error: {ex.Message}");
            Dispatcher.Invoke(() =>
            {
                MessageDialog.ShowError(this, $"Failed to sync emails: {ex.Message}", "Sync Error");
            });
        }
        finally
        {
            _isSyncing = false;
            Dispatcher.Invoke(() =>
            {
                StopRefreshSpinnerAnimation();
                RefreshSpinner.Visibility = Visibility.Collapsed;
                RefreshIcon.Visibility = Visibility.Visible;
                RefreshButton.IsEnabled = true;
            });
        }
    }

    private void StartRefreshSpinnerAnimation()
    {
        if (_refreshSpinnerStoryboard != null) return;

        var animation = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = 0,
            To = 360,
            Duration = TimeSpan.FromSeconds(1),
            RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever
        };

        _refreshSpinnerStoryboard = new System.Windows.Media.Animation.Storyboard();
        _refreshSpinnerStoryboard.Children.Add(animation);
        System.Windows.Media.Animation.Storyboard.SetTarget(animation, RefreshSpinner);
        System.Windows.Media.Animation.Storyboard.SetTargetProperty(animation, new PropertyPath("(UIElement.RenderTransform).(RotateTransform.Angle)"));
        _refreshSpinnerStoryboard.Begin();
    }

    private void StopRefreshSpinnerAnimation()
    {
        if (_refreshSpinnerStoryboard != null)
        {
            _refreshSpinnerStoryboard.Stop();
            _refreshSpinnerStoryboard = null;
        }
    }

    // Send/Receive Tab Button Handlers
    private bool _isSendReceiving = false;
    private System.Windows.Media.Animation.Storyboard? _sendReceiveSpinnerStoryboard;
    private System.Windows.Media.Animation.Storyboard? _updateFolderSpinnerStoryboard;

    private async void SendReceiveAllButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isSendReceiving || _isSyncing)
        {
            System.Diagnostics.Debug.WriteLine("[MainWindow] Send/Receive already in progress, ignoring click");
            return;
        }

        _isSendReceiving = true;
        System.Diagnostics.Debug.WriteLine("[MainWindow] Starting Send/Receive All");

        try
        {
            // Show spinner, hide normal icon
            SendReceiveIcon.Visibility = Visibility.Collapsed;
            SendReceiveSpinner.Visibility = Visibility.Visible;
            SendReceiveAllButton.IsEnabled = false;
            StartSendReceiveSpinnerAnimation();

            // Store current folder ID before refresh
            var currentFolderId = _mainViewModel.SelectedFolder?.Id;
            var currentFolderType = _mainViewModel.SelectedFolder?.Type;

            // Refresh folders (rebuilds the folder structure)
            await _mainViewModel.RefreshFolders();

            // Re-select the folder after refresh
            if (currentFolderId != null && _mainViewModel.AccountRootFolder?.SubFolders != null)
            {
                // Try to find the same folder by ID
                var restoredFolder = _mainViewModel.AccountRootFolder.SubFolders
                    .FirstOrDefault(f => f.Id == currentFolderId);

                // If not found by ID, try by type (e.g., Inbox)
                if (restoredFolder == null && currentFolderType.HasValue)
                {
                    restoredFolder = _mainViewModel.AccountRootFolder.SubFolders
                        .FirstOrDefault(f => f.Type == currentFolderType);
                }

                // Default to Inbox if nothing found
                if (restoredFolder == null)
                {
                    restoredFolder = _mainViewModel.AccountRootFolder.SubFolders
                        .FirstOrDefault(f => f.Type == Models.FolderType.Inbox);
                }

                if (restoredFolder != null)
                {
                    _mainViewModel.SelectedFolder = restoredFolder;
                    await _mainViewModel.LoadMessagesAsync(restoredFolder.Id);
                    System.Diagnostics.Debug.WriteLine($"[MainWindow] Restored folder selection: {restoredFolder.Name}");
                }
            }

            System.Diagnostics.Debug.WriteLine("[MainWindow] Send/Receive All completed successfully");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Send/Receive All error: {ex.Message}");
            MessageDialog.ShowError(this, $"Failed to send/receive: {ex.Message}", "Sync Error");
        }
        finally
        {
            _isSendReceiving = false;
            StopSendReceiveSpinnerAnimation();
            SendReceiveSpinner.Visibility = Visibility.Collapsed;
            SendReceiveIcon.Visibility = Visibility.Visible;
            SendReceiveAllButton.IsEnabled = true;
        }
    }

    private async void UpdateFolderButton_Click(object sender, RoutedEventArgs e)
    {
        if (_mainViewModel.SelectedFolder == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainWindow] No folder selected for update");
            return;
        }

        System.Diagnostics.Debug.WriteLine($"[MainWindow] Updating folder: {_mainViewModel.SelectedFolder.Name}");

        try
        {
            // Show spinner, hide normal icon
            UpdateFolderIcon.Visibility = Visibility.Collapsed;
            UpdateFolderSpinner.Visibility = Visibility.Visible;
            UpdateFolderButton.IsEnabled = false;
            StartUpdateFolderSpinnerAnimation();

            // Reload messages for current folder
            await _mainViewModel.LoadMessagesAsync(_mainViewModel.SelectedFolder.Id);

            System.Diagnostics.Debug.WriteLine("[MainWindow] Update Folder completed successfully");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Update Folder error: {ex.Message}");
            MessageDialog.ShowError(this, $"Failed to update folder: {ex.Message}", "Update Error");
        }
        finally
        {
            StopUpdateFolderSpinnerAnimation();
            UpdateFolderSpinner.Visibility = Visibility.Collapsed;
            UpdateFolderIcon.Visibility = Visibility.Visible;
            UpdateFolderButton.IsEnabled = true;
        }
    }

    private void StartSendReceiveSpinnerAnimation()
    {
        if (_sendReceiveSpinnerStoryboard != null) return;

        var animation = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = 0,
            To = 360,
            Duration = TimeSpan.FromSeconds(1),
            RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever
        };

        _sendReceiveSpinnerStoryboard = new System.Windows.Media.Animation.Storyboard();
        _sendReceiveSpinnerStoryboard.Children.Add(animation);
        System.Windows.Media.Animation.Storyboard.SetTarget(animation, SendReceiveSpinner);
        System.Windows.Media.Animation.Storyboard.SetTargetProperty(animation, new PropertyPath("(UIElement.RenderTransform).(RotateTransform.Angle)"));
        _sendReceiveSpinnerStoryboard.Begin();
    }

    private void StopSendReceiveSpinnerAnimation()
    {
        if (_sendReceiveSpinnerStoryboard != null)
        {
            _sendReceiveSpinnerStoryboard.Stop();
            _sendReceiveSpinnerStoryboard = null;
        }
    }

    private void StartUpdateFolderSpinnerAnimation()
    {
        if (_updateFolderSpinnerStoryboard != null) return;

        var animation = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = 0,
            To = 360,
            Duration = TimeSpan.FromSeconds(1),
            RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever
        };

        _updateFolderSpinnerStoryboard = new System.Windows.Media.Animation.Storyboard();
        _updateFolderSpinnerStoryboard.Children.Add(animation);
        System.Windows.Media.Animation.Storyboard.SetTarget(animation, UpdateFolderSpinner);
        System.Windows.Media.Animation.Storyboard.SetTargetProperty(animation, new PropertyPath("(UIElement.RenderTransform).(RotateTransform.Angle)"));
        _updateFolderSpinnerStoryboard.Begin();
    }

    private void StopUpdateFolderSpinnerAnimation()
    {
        if (_updateFolderSpinnerStoryboard != null)
        {
            _updateFolderSpinnerStoryboard.Stop();
            _updateFolderSpinnerStoryboard = null;
        }
    }

    #endregion

    #region Attachment Download

    private async void Attachment_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (sender is not Border border || border.Tag is not Models.EmailAttachment attachment)
            return;

        // Get the current message
        var message = _mainViewModel.DisplayedMessage;
        if (message == null || message.AccountId == null || string.IsNullOrEmpty(message.RemoteMessageId))
        {
            MessageDialog.ShowError(this, "Cannot download attachment - message information is missing.", "Download Error");
            return;
        }

        try
        {
            // Show downloading status
            border.IsEnabled = false;
            border.Opacity = 0.6;

            var displayService = new Services.EmailSync.SyncedEmailDisplayService();
            var savedPath = await displayService.DownloadAttachmentAsync(
                message.AccountId.Value,
                message.RemoteMessageId,
                attachment.Id,
                attachment.FileName);

            if (!string.IsNullOrEmpty(savedPath))
            {
                // Ask user if they want to open the file
                var openFile = ConfirmationDialog.Show(
                    this,
                    "Download Complete",
                    $"Attachment saved to:\n{savedPath}\n\nWould you like to open the file?",
                    "Open File",
                    "Close",
                    ConfirmationDialog.DialogType.Info);

                if (openFile)
                {
                    // Open the file with default application
                    var process = new System.Diagnostics.Process();
                    process.StartInfo = new System.Diagnostics.ProcessStartInfo(savedPath)
                    {
                        UseShellExecute = true
                    };
                    process.Start();
                }
            }
            else
            {
                MessageDialog.ShowError(this, "Failed to download the attachment. Please try again.", "Download Error");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Attachment download error: {ex.Message}");
            MessageDialog.ShowError(this, $"Error downloading attachment: {ex.Message}", "Download Error");
        }
        finally
        {
            border.IsEnabled = true;
            border.Opacity = 1.0;
        }
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

    private void SyncService_SyncProgressChanged(object? sender, Services.SyncProgressEventArgs e)
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

    #region Category Management Dialog

    /// <summary>
    /// Shows dialog to apply categories to an email
    /// </summary>
    private void ShowCategoryDialog(EmailMessage message)
    {
        if (message == null) return;

        var dialog = new Views.CategoryDialog(message, _mainViewModel.AvailableCategories)
        {
            Owner = this
        };

        if (dialog.ShowDialog() == true)
        {
            // Update the message's categories
            message.Categories.Clear();
            foreach (var category in dialog.SelectedCategories)
            {
                message.Categories.Add(category);
            }

            // Add any new categories to the available list
            foreach (var newCategory in dialog.NewCategories)
            {
                if (!_mainViewModel.AvailableCategories.Contains(newCategory))
                {
                    _mainViewModel.AvailableCategories.Add(newCategory);
                }
            }

            // Show notification
            if (dialog.SelectedCategories.Count > 0)
            {
                NotificationService.Instance.ShowSuccess($"Applied {dialog.SelectedCategories.Count} category(ies)");
            }
            else
            {
                NotificationService.Instance.ShowInfo("All categories removed");
            }

            System.Diagnostics.Debug.WriteLine($"[MainWindow] Categories updated for message: {message.Subject}");
        }
    }

    #endregion

    #region Folder Management Dialogs

    /// <summary>
    /// Shows dialog to create a new folder
    /// </summary>
    private void ShowNewFolderDialog()
    {
        var dialog = new Views.InputDialog("New Folder", "Enter folder name:", "New Folder")
        {
            Owner = this
        };

        if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputValue))
        {
            _mainViewModel.CreateFolder(dialog.InputValue);
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Created new folder: {dialog.InputValue}");
        }
    }

    /// <summary>
    /// Shows dialog to rename a folder
    /// </summary>
    private void ShowRenameFolderDialog(Models.MailFolder? folder)
    {
        if (folder == null) return;

        // Don't allow renaming system folders
        if (folder.Type != Models.FolderType.Custom)
        {
            Views.ConfirmationDialog.Show(
                this,
                "Cannot Rename Folder",
                $"Cannot rename the '{folder.Name}' folder.\n\nSystem folders cannot be renamed.",
                "OK",
                "Cancel",
                Views.ConfirmationDialog.DialogType.Info);
            return;
        }

        var dialog = new Views.InputDialog("Rename Folder", "Enter new folder name:", folder.Name)
        {
            Owner = this
        };

        if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputValue))
        {
            _mainViewModel.RenameFolderTo(folder, dialog.InputValue);
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Renamed folder to: {dialog.InputValue}");
        }
    }

    /// <summary>
    /// Shows confirmation to delete a folder
    /// </summary>
    private void ShowDeleteFolderConfirmation(Models.MailFolder? folder)
    {
        if (folder == null) return;

        // Don't allow deleting system folders
        if (folder.Type != Models.FolderType.Custom)
        {
            Views.ConfirmationDialog.Show(
                this,
                "Cannot Delete Folder",
                $"Cannot delete the '{folder.Name}' folder.\n\nSystem folders cannot be deleted.",
                "OK",
                "Cancel",
                Views.ConfirmationDialog.DialogType.Info);
            return;
        }

        var confirmed = Views.ConfirmationDialog.Show(
            this,
            "Delete Folder",
            $"Are you sure you want to delete the folder '{folder.Name}'?\n\nAll messages in this folder will be moved to Trash.",
            "Delete",
            "Cancel",
            Views.ConfirmationDialog.DialogType.Warning);

        if (confirmed)
        {
            _mainViewModel.RemoveFolder(folder);
            System.Diagnostics.Debug.WriteLine($"[MainWindow] Deleted folder: {folder.Name}");
        }
    }

    /// <summary>
    /// Updates UI when offline mode changes
    /// </summary>
    private void UpdateOfflineModeUI(bool isOffline)
    {
        System.Diagnostics.Debug.WriteLine($"[MainWindow] UpdateOfflineModeUI: isOffline={isOffline}");

        // Update the Work Offline button visual state
        if (FindName("WorkOfflineButton") is System.Windows.Controls.Button workOfflineButton)
        {
            // Change icon color to indicate active state
            if (workOfflineButton.Content is System.Windows.Controls.TextBlock iconText)
            {
                iconText.Foreground = isOffline
                    ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 87, 34)) // Orange-red for offline
                    : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(200, 200, 200)); // Default gray
            }
        }

        // Show visual indicator in status bar
        if (isOffline)
        {
            OnlineStatusPanel.Visibility = Visibility.Collapsed;
            OfflineStatusPanel.Visibility = Visibility.Visible;
            OfflineStatusText.Text = "Working Offline (Manual)";
        }
        else
        {
            // Let the network status service determine the actual status
            UpdateNetworkStatus();
        }
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
