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

        // Initialize services and ViewModels
        var mailService = new MockMailService();
        var calendarService = new MockCalendarService();
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
            _isLoaded = true;
            // Ensure Home tab content is visible on start
            ShowTabContent("HomeTab");
            // Ensure Mail module is visible on start
            ShowModuleContent(AppModule.Mail);
            // Initialize authentication state
            await _authManager.InitializeAsync();
            UpdateProfileUI();
            // Start the animated accent bar
            StartAccentBarAnimation();
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
            var tokens = await new SecureTokenStorage().LoadTokensAsync();
            if (tokens == null || string.IsNullOrEmpty(tokens.AccessToken))
            {
                LogDebug("No access token available");
                return;
            }

            LogDebug($"Access token found: {tokens.AccessToken.Substring(0, Math.Min(20, tokens.AccessToken.Length))}...");

            using var httpClient = new HttpClient();
            // Use local dev API for WWBW email (endpoint not yet deployed to production)
            httpClient.BaseAddress = new Uri("http://localhost:3100/api/");
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

            LogDebug("Fetching WWBW email from API...");
            var response = await httpClient.GetAsync("wwbw/email");

            LogDebug($"API Response Status: {response.StatusCode}");
            string? emailToDisplay = null;

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                LogDebug($"API response: {content}");

                var wwbwResponse = JsonSerializer.Deserialize<WwbwEmailResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (wwbwResponse?.Success == true && !string.IsNullOrEmpty(wwbwResponse.WwbwEmail?.EmailAddress))
                {
                    emailToDisplay = wwbwResponse.WwbwEmail.EmailAddress;
                    LogDebug($"Using WWBW email: {emailToDisplay}");
                }
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // No WWBW email exists for this user - fall back to profile email
                LogDebug("No WWBW email found, falling back to profile email");
                var session = _authManager.Session;
                if (session.Profile != null && !string.IsNullOrEmpty(session.Profile.Email))
                {
                    emailToDisplay = session.Profile.Email;
                    LogDebug($"Using profile email: {emailToDisplay}");
                }
            }
            else
            {
                LogDebug($"API request failed with status: {response.StatusCode}");
            }

            // Update UI with whatever email we found
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
            else
            {
                LogDebug("No email address available to display");
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

    #endregion

    #region New Message Split Button

    private void NewMailPrimaryButton_Click(object sender, RoutedEventArgs e)
    {
        // Execute the new message command directly (primary action)
        var dataContext = DataContext as WindowDataContext;
        dataContext?.MainViewModel?.NewMessageCommand?.Execute(null);
    }

    private void NewMailMenuItem_Click(object sender, RoutedEventArgs e)
    {
        NewDropdownButton.IsChecked = false;
        // Execute the new message command
        var dataContext = DataContext as WindowDataContext;
        dataContext?.MainViewModel?.NewMessageCommand?.Execute(null);
    }

    private void NewMeetingMenuItem_Click(object sender, RoutedEventArgs e)
    {
        NewDropdownButton.IsChecked = false;
        // Execute the new meeting command (placeholder for now)
        MessageBox.Show("New Meeting functionality coming soon!", "New Meeting", MessageBoxButton.OK, MessageBoxImage.Information);
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
            Height = 477,
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
                        MessageBox.Show("Please enter your email and password.", "Sign In", MessageBoxButton.OK, MessageBoxImage.Warning);
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
                        MessageBox.Show(ex.Message, "Sign In Failed", MessageBoxButton.OK, MessageBoxImage.Error);
                        actionButton.IsEnabled = true;
                        actionButton.Content = "Sign In";
                    }
                    break;

                case "createAccount":
                    if (string.IsNullOrWhiteSpace(fullNameBox.Text) ||
                        string.IsNullOrWhiteSpace(createEmailBox.Text) ||
                        string.IsNullOrWhiteSpace(createPasswordBox.Password))
                    {
                        MessageBox.Show("Please fill in all fields.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    if (createPasswordBox.Password != confirmPasswordBox.Password)
                    {
                        MessageBox.Show("Passwords do not match.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
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
                        MessageBox.Show(ex.Message, "Registration Failed", MessageBoxButton.OK, MessageBoxImage.Error);
                        actionButton.IsEnabled = true;
                        actionButton.Content = "Create Account";
                    }
                    break;

                case "forgotPassword":
                    if (string.IsNullOrWhiteSpace(forgotEmailBox.Text))
                    {
                        MessageBox.Show("Please enter your email address.", "Forgot Password", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Sending...";
                    var success = await _authManager.RequestPasswordResetAsync(forgotEmailBox.Text);
                    if (success)
                    {
                        MessageBox.Show("Password reset instructions have been sent to your email.", "Email Sent", MessageBoxButton.OK, MessageBoxImage.Information);
                        ShowPanel("signIn");
                    }
                    else
                    {
                        MessageBox.Show("Failed to send reset email. Please try again.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
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
