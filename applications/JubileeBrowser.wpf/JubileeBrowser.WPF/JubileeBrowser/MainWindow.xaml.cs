using System.Collections.ObjectModel;
using System.Runtime.InteropServices;
using System.Web;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using WpfShapes = System.Windows.Shapes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using JubileeBrowser.Controls;
using JubileeBrowser.Models;
using JubileeBrowser.Services;

namespace JubileeBrowser;

public partial class MainWindow : Window
{
    private readonly TabManager _tabManager;
    private readonly HistoryManager _historyManager;
    private readonly BookmarkManager _bookmarkManager;
    private readonly SettingsManager _settingsManager;
    private readonly SessionStateManager _sessionStateManager;
    private readonly BlacklistManager _blacklistManager;
    private readonly WWBWDnsResolver _dnsResolver;
    private readonly HitCountService _hitCountService;
    private readonly ZoomSettingsManager _zoomSettingsManager;
    private readonly RecentlyClosedTabsManager _recentlyClosedTabsManager;
    private readonly ProfileAuthService _profileAuthService;
    private readonly SyncEngine _syncEngine;
    private readonly CredentialManager _credentialManager;
    private readonly InternalPageHandler _internalPageHandler;
    private readonly ThemeManager _themeManager;
    private OpenAIChatService? _openAIChatService;
    private SpiritualNutritionService? _spiritualNutritionService;
    private string _apiBaseUrl = "https://inspirecodex.com";

    private readonly Dictionary<string, WebView2> _webViews = new();
    private BrowserMode _currentMode = BrowserMode.Internet;
    private BrowserMode? _startupMode; // Mode to use when creating the initial tab
    private string? _activeTabId;
    private bool _isInitialized;
    private bool _isFullScreen;
    private WindowState _preFullScreenState = WindowState.Normal;
    private Rect _preFullScreenBounds;

    // For tracking window bounds when maximized (to save restore position)
    private Rect _restoreBounds;
    private bool _hasRestoredWindowState;

    // Zoom level tracking (100 = 100%, range: 25-500)
    private double _currentZoomLevel = 100;
    private const double ZoomStep = 10;
    private const double MinZoom = 25;
    private const double MaxZoom = 500;

    // Dynamic tab width settings
    private const double MinTabWidth = 60;
    private const double MaxTabWidth = 240;
    private const double PreferredTabWidth = 200;
    private const double ActiveTabWidthBonus = 20;  // Extra width for active tab when space is limited
    private const double TabStripReservedWidth = 80; // Logo + New Tab button + padding

    // Tab drag-drop tracking
    private Point _dragStartPoint;
    private bool _isDragging;
    private TabState? _draggedTab;
    private int _dropTargetIndex = -1;
    private ListBoxItem? _dragSourceContainer;

    // Tab groups and vertical tabs
    private readonly ObservableCollection<TabGroup> _tabGroups = new();
    private bool _isVerticalTabsEnabled;

    // Mobile device emulation
    private readonly MobileEmulationManager _mobileEmulationManager;

    public ObservableCollection<TabState> Tabs { get; } = new();

    // Win32 interop for proper maximize behavior
    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [DllImport("user32.dll")]
    private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    private delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

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

    private const int WM_GETMINMAXINFO = 0x0024;
    private const int WM_NCHITTEST = 0x0084;
    private const int WM_NCCALCSIZE = 0x0083;
    private const int WM_NCACTIVATE = 0x0086;
    private const int WM_NCPAINT = 0x0085;
    private const int WM_SYSCOMMAND = 0x0112;
    private const uint MONITOR_DEFAULTTONEAREST = 0x00000002;

    // Hit test results for resize
    private const int HTLEFT = 10;
    private const int HTRIGHT = 11;
    private const int HTTOP = 12;
    private const int HTTOPLEFT = 13;
    private const int HTTOPRIGHT = 14;
    private const int HTBOTTOM = 15;
    private const int HTBOTTOMLEFT = 16;
    private const int HTBOTTOMRIGHT = 17;
    private const int HTCLIENT = 1;

    // Resize directions for WM_SYSCOMMAND
    private const int SC_SIZE_LEFT = 0xF001;
    private const int SC_SIZE_RIGHT = 0xF002;
    private const int SC_SIZE_TOP = 0xF003;
    private const int SC_SIZE_TOPLEFT = 0xF004;
    private const int SC_SIZE_TOPRIGHT = 0xF005;
    private const int SC_SIZE_BOTTOM = 0xF006;
    private const int SC_SIZE_BOTTOMLEFT = 0xF007;
    private const int SC_SIZE_BOTTOMRIGHT = 0xF008;

    private const int ResizeBorderWidth = 3;

    public MainWindow() : this(null)
    {
    }

    public MainWindow(BrowserMode? startupMode)
    {
        _startupMode = startupMode;

        // SUPER-FAST LAUNCH: Initialize XAML first to show window immediately
        InitializeComponent();

        // Initialize only critical managers synchronously (needed for basic functionality)
        _settingsManager = new SettingsManager();
        _sessionStateManager = new SessionStateManager();
        _tabManager = new TabManager();

        // Initialize remaining managers (lightweight constructors, no I/O)
        _historyManager = new HistoryManager();
        _bookmarkManager = new BookmarkManager();
        _blacklistManager = new BlacklistManager();
        _dnsResolver = new WWBWDnsResolver();
        _hitCountService = new HitCountService();
        _zoomSettingsManager = new ZoomSettingsManager();
        _recentlyClosedTabsManager = new RecentlyClosedTabsManager();
        _mobileEmulationManager = new MobileEmulationManager();

        // Initialize profile and sync services (lightweight constructors)
        _profileAuthService = new ProfileAuthService();
        _syncEngine = new SyncEngine(_profileAuthService);
        _credentialManager = new CredentialManager(_syncEngine);
        _internalPageHandler = new InternalPageHandler();

        // Initialize theme manager
        _themeManager = new ThemeManager();
        _themeManager.Initialize();
        _themeManager.ThemeChanged += OnThemeChanged;

        // Defer OpenAI service initialization to background (involves file I/O for .env)
        Task.Run(InitializeOpenAIChatService);

        // Subscribe to auth state changes
        _profileAuthService.AuthStateChanged += OnAuthStateChanged;
        _profileAuthService.ProfileChanged += OnProfileChanged;
        _syncEngine.StatusChanged += OnSyncStatusChanged;

        // Bind tabs to UI
        TabStrip.ItemsSource = Tabs;

        // Subscribe to tab manager events
        _tabManager.TabCreated += OnTabCreated;
        _tabManager.TabClosed += OnTabClosed;
        _tabManager.TabUpdated += OnTabUpdated;
        _tabManager.ActiveTabChanged += OnActiveTabChanged;

        // Hook into SourceInitialized to set up window message handling
        SourceInitialized += MainWindow_SourceInitialized;
    }

    private void MainWindow_SourceInitialized(object? sender, EventArgs e)
    {
        // Add hook for WM_GETMINMAXINFO to handle maximize properly with WindowStyle=None
        var handle = new WindowInteropHelper(this).Handle;
        var source = HwndSource.FromHwnd(handle);
        source?.AddHook(WindowProc);
    }

    private void InitializeOpenAIChatService()
    {
        try
        {
            // Load environment variables from .env file
            EnvLoader.Load();

            // Load API base URL (defaults to production if not set)
            var apiUrl = EnvLoader.GetVariable("API_BASE_URL");
            if (!string.IsNullOrEmpty(apiUrl))
            {
                _apiBaseUrl = apiUrl.TrimEnd('/');
            }

            var primaryKey = EnvLoader.GetVariable("OPENAI_API_KEY_PRIMARY");
            var backupKey = EnvLoader.GetVariable("OPENAI_API_KEY_BACKUP");

            if (!string.IsNullOrEmpty(primaryKey))
            {
                _openAIChatService = new OpenAIChatService(primaryKey, backupKey ?? string.Empty);
                _spiritualNutritionService = new SpiritualNutritionService(primaryKey, backupKey ?? string.Empty);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to initialize services: {ex.Message}");
        }
    }

    private IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_NCCALCSIZE && wParam != IntPtr.Zero)
        {
            // Remove the standard window frame/border by returning 0
            // This eliminates the thin white/gray border that appears with WindowStyle=None
            handled = true;
            return IntPtr.Zero;
        }
        else if (msg == WM_NCACTIVATE)
        {
            // Prevent Windows from drawing the inactive/active window frame
            // Return TRUE (1) to indicate we handled it, preventing default frame drawing
            // This fixes the white border that appears when the window loses focus
            handled = true;
            return new IntPtr(1);
        }
        else if (msg == WM_NCPAINT)
        {
            // Prevent Windows from painting the non-client area (frame)
            // This prevents any border from being drawn during paint operations
            handled = true;
            return IntPtr.Zero;
        }
        else if (msg == WM_GETMINMAXINFO && !_isFullScreen)
        {
            // Handle maximize to respect taskbar and work area (skip in fullscreen mode)
            WmGetMinMaxInfo(hwnd, lParam);
            handled = true;
        }
        else if (msg == WM_NCHITTEST && WindowState == WindowState.Normal && !_isFullScreen)
        {
            // Custom hit testing for resize borders
            var result = HitTestForResize(lParam);
            if (result != HTCLIENT)
            {
                handled = true;
                return new IntPtr(result);
            }
        }
        return IntPtr.Zero;
    }

    private int HitTestForResize(IntPtr lParam)
    {
        // Get mouse position in screen coordinates (physical pixels)
        int screenX = (short)(lParam.ToInt32() & 0xFFFF);
        int screenY = (short)((lParam.ToInt32() >> 16) & 0xFFFF);

        // Get window rectangle in screen coordinates (physical pixels)
        var hwnd = new WindowInteropHelper(this).Handle;
        if (!GetWindowRect(hwnd, out RECT windowRect))
            return HTCLIENT;

        // Calculate position relative to window in physical pixels
        int x = screenX - windowRect.Left;
        int y = screenY - windowRect.Top;
        int width = windowRect.Right - windowRect.Left;
        int height = windowRect.Bottom - windowRect.Top;

        // Use a generous border width in physical pixels
        int borderWidth = ResizeBorderWidth;

        // Check corners first (they have priority)
        bool left = x < borderWidth;
        bool right = x > width - borderWidth;
        bool top = y < borderWidth;
        bool bottom = y > height - borderWidth;

        if (top && left) return HTTOPLEFT;
        if (top && right) return HTTOPRIGHT;
        if (bottom && left) return HTBOTTOMLEFT;
        if (bottom && right) return HTBOTTOMRIGHT;
        if (left) return HTLEFT;
        if (right) return HTRIGHT;
        if (top) return HTTOP;
        if (bottom) return HTBOTTOM;

        return HTCLIENT;
    }

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    private void ResizeBorder_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (WindowState != WindowState.Normal || _isFullScreen)
            return;

        var element = sender as FrameworkElement;
        if (element?.Tag == null) return;

        int direction;
        switch (element.Tag.ToString())
        {
            case "Left": direction = SC_SIZE_LEFT; break;
            case "Right": direction = SC_SIZE_RIGHT; break;
            case "Top": direction = SC_SIZE_TOP; break;
            case "TopLeft": direction = SC_SIZE_TOPLEFT; break;
            case "TopRight": direction = SC_SIZE_TOPRIGHT; break;
            case "Bottom": direction = SC_SIZE_BOTTOM; break;
            case "BottomLeft": direction = SC_SIZE_BOTTOMLEFT; break;
            case "BottomRight": direction = SC_SIZE_BOTTOMRIGHT; break;
            default: return;
        }

        var hwnd = new WindowInteropHelper(this).Handle;
        SendMessage(hwnd, WM_SYSCOMMAND, (IntPtr)direction, IntPtr.Zero);
    }

    private void WmGetMinMaxInfo(IntPtr hwnd, IntPtr lParam)
    {
        var mmi = Marshal.PtrToStructure<MINMAXINFO>(lParam);

        var monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if (monitor != IntPtr.Zero)
        {
            var monitorInfo = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
            if (GetMonitorInfo(monitor, ref monitorInfo))
            {
                var rcWork = monitorInfo.rcWork;
                var rcMonitor = monitorInfo.rcMonitor;

                // Set max position to work area (respects taskbar)
                mmi.ptMaxPosition.X = Math.Abs(rcWork.Left - rcMonitor.Left);
                mmi.ptMaxPosition.Y = Math.Abs(rcWork.Top - rcMonitor.Top);

                // Set max size to work area size
                mmi.ptMaxSize.X = Math.Abs(rcWork.Right - rcWork.Left);
                mmi.ptMaxSize.Y = Math.Abs(rcWork.Bottom - rcWork.Top);

                // Set max tracking size
                mmi.ptMaxTrackSize.X = mmi.ptMaxSize.X;
                mmi.ptMaxTrackSize.Y = mmi.ptMaxSize.Y;
            }
        }

        Marshal.StructureToPtr(mmi, lParam, true);
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
    private struct POINT
    {
        public int X;
        public int Y;
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            // SUPER-FAST LAUNCH: Show window immediately, defer heavy initialization
            // Phase 1: Critical path - get the window visible ASAP

            // Bring window to front on launch, then disable Topmost so it doesn't stay on top
            Topmost = true;
            Activate();
            Focus();
            _ = Task.Delay(500).ContinueWith(_ => Dispatcher.Invoke(() => Topmost = false));

            // Apply initial mode visuals immediately (no async)
            UpdateModeRadioButtons();
            UpdateModeVisuals();

            // Start loading settings in parallel (needed for homepage)
            var settingsTask = _settingsManager.InitializeAsync();
            var sessionTask = _sessionStateManager.LoadAsync();

            // Wait only for settings (fast, needed for homepage URL)
            await settingsTask;

            // Apply the saved theme immediately
            ApplySavedTheme();

            // Get session state to restore window position quickly
            var sessionState = await sessionTask;

            // Restore window position immediately
            if (!_startupMode.HasValue)
            {
                RestoreWindowState(sessionState);
            }

            // Apply settings - use startup mode if specified, otherwise use DefaultMode setting
            var settings = _settingsManager.Settings;
            if (_startupMode.HasValue)
            {
                _currentMode = _startupMode.Value;
            }
            else
            {
                // Always respect the DefaultMode setting ("Start in Jubilee Bibles mode" toggle)
                _currentMode = settings?.DefaultMode ?? BrowserMode.Internet;
            }
            UpdateModeRadioButtons();
            UpdateModeVisuals();

            // Phase 2: Create the first tab based on startup settings
            if (_startupMode.HasValue)
            {
                // Command-line mode override - open homepage for that mode
                await CreateTabAsync(GetHomepage(), _startupMode.Value);
            }
            else
            {
                // Check startup behavior setting for current mode
                var startupBehavior = GetStartupBehavior(_currentMode);

                if (startupBehavior == "continue" && sessionState != null && sessionState.Tabs != null && sessionState.Tabs.Count > 0)
                {
                    // "Continue where you left off" - restore session
                    var firstTab = sessionState.Tabs[0];
                    await CreateTabAsync(firstTab.Url, firstTab.Mode);

                    // Restore remaining tabs in background
                    if (sessionState.Tabs.Count > 1)
                    {
                        _ = RestoreRemainingTabsAsync(sessionState);
                    }
                }
                else if (startupBehavior == "newtab")
                {
                    // "Open new tab page" - open blank/new tab page
                    await CreateTabAsync(GetNewTabPageUrl(), _currentMode);
                }
                else
                {
                    // "homepage" (default) - open configured homepage
                    await CreateTabAsync(GetHomepage());
                }
            }

            _isInitialized = true;
            _hasRestoredWindowState = true;
            UpdateWelcomePanel();

            // Phase 3: Initialize remaining services in background (non-blocking)
            _ = InitializeBackgroundServicesAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error during initialization: {ex.Message}");
            try
            {
                await CreateTabAsync("about:blank");
                _isInitialized = true;
                _hasRestoredWindowState = true;
                UpdateWelcomePanel();
            }
            catch
            {
                _isInitialized = true;
                _hasRestoredWindowState = true;
            }
        }
    }

    /// <summary>
    /// Restores remaining tabs from session in background (after first tab is shown)
    /// </summary>
    private async Task RestoreRemainingTabsAsync(SessionState sessionState)
    {
        try
        {
            // Small delay to let UI render first tab
            await Task.Delay(100);

            // Limit max tabs to restore to prevent memory exhaustion
            const int MaxTabsToRestore = 10;
            var tabCount = Math.Min(sessionState.Tabs!.Count, MaxTabsToRestore);

            for (int i = 1; i < tabCount; i++)
            {
                var tabState = sessionState.Tabs[i];
                await CreateTabAsync(tabState.Url, tabState.Mode);

                // Add small delay between tab creations to prevent resource spikes
                await Task.Delay(50);
            }

            // Switch to the originally active tab
            if (!string.IsNullOrEmpty(sessionState.ActiveTabId))
            {
                var activeTab = Tabs.FirstOrDefault(t => t.Id == sessionState.ActiveTabId);
                if (activeTab != null)
                {
                    SwitchToTab(activeTab.Id);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error restoring tabs: {ex.Message}");
        }
    }

    /// <summary>
    /// Initializes non-critical services in background after window is visible
    /// </summary>
    private async Task InitializeBackgroundServicesAsync()
    {
        try
        {
            // Small delay to let UI fully render before loading background services
            await Task.Delay(200);

            // Initialize services in batches to prevent resource spikes
            // Batch 1: Core local services (file I/O)
            await Task.WhenAll(
                _historyManager.InitializeAsync(),
                _bookmarkManager.InitializeAsync(),
                _blacklistManager.InitializeAsync()
            );

            // Batch 2: Network-related services
            await Task.WhenAll(
                _dnsResolver.InitializeAsync(),
                _hitCountService.InitializeAsync(),
                _zoomSettingsManager.LoadAsync()
            );

            // Batch 3: Profile and sync services (may involve network calls)
            await Task.WhenAll(
                _profileAuthService.InitializeAsync(),
                _syncEngine.InitializeAsync(),
                _credentialManager.InitializeAsync()
            );

            // Update profile UI after auth services are ready
            await Dispatcher.InvokeAsync(() => UpdateProfileUI());
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error initializing background services: {ex.Message}");
        }
    }

    private void RestoreWindowState(SessionState? sessionState)
    {
        // If no saved state or first launch, center on primary screen
        if (sessionState == null || !sessionState.HasSavedState)
        {
            CenterWindowOnPrimaryScreen();
            return;
        }

        var bounds = sessionState.WindowBounds;

        // Validate that the saved position is still on a valid monitor
        if (IsPositionOnValidMonitor(bounds.X, bounds.Y, bounds.Width, bounds.Height))
        {
            // Restore the saved position
            Left = bounds.X;
            Top = bounds.Y;
            Width = bounds.Width;
            Height = bounds.Height;

            // Store restore bounds before maximizing
            _restoreBounds = new Rect(bounds.X, bounds.Y, bounds.Width, bounds.Height);

            // Restore maximized state after setting position
            if (sessionState.IsMaximized)
            {
                WindowState = WindowState.Maximized;
            }
        }
        else
        {
            // Previous monitor is no longer available, center on primary screen
            CenterWindowOnPrimaryScreen();

            // Still apply maximized state if it was maximized
            if (sessionState.IsMaximized)
            {
                WindowState = WindowState.Maximized;
            }
        }
    }

    private void CenterWindowOnPrimaryScreen()
    {
        // Get the primary screen work area
        var workArea = SystemParameters.WorkArea;

        // Use default size or current size
        var width = Width > 0 ? Width : 1280;
        var height = Height > 0 ? Height : 800;

        // Ensure window fits within work area
        width = Math.Min(width, workArea.Width);
        height = Math.Min(height, workArea.Height);

        // Center the window
        Left = workArea.Left + (workArea.Width - width) / 2;
        Top = workArea.Top + (workArea.Height - height) / 2;
        Width = width;
        Height = height;

        _restoreBounds = new Rect(Left, Top, Width, Height);
    }

    private bool IsPositionOnValidMonitor(double x, double y, double width, double height)
    {
        // Check if at least a portion of the window would be visible on any monitor
        var windowRect = new Rect(x, y, width, height);
        var monitors = GetAllMonitors();

        foreach (var monitor in monitors)
        {
            var monitorRect = new Rect(monitor.Left, monitor.Top, monitor.Width, monitor.Height);

            // Check if window overlaps with this monitor (at least 50 pixels visible)
            var intersection = Rect.Intersect(windowRect, monitorRect);
            if (!intersection.IsEmpty && intersection.Width >= 50 && intersection.Height >= 50)
            {
                return true;
            }
        }

        return false;
    }

    private List<Models.MonitorInfo> GetAllMonitors()
    {
        var monitors = new List<Models.MonitorInfo>();

        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData) =>
        {
            var info = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
            if (GetMonitorInfo(hMonitor, ref info))
            {
                monitors.Add(new Models.MonitorInfo
                {
                    Left = info.rcWork.Left,
                    Top = info.rcWork.Top,
                    Width = info.rcWork.Right - info.rcWork.Left,
                    Height = info.rcWork.Bottom - info.rcWork.Top,
                    IsPrimary = (info.dwFlags & 1) != 0 // MONITORINFOF_PRIMARY = 1
                });
            }
            return true;
        }, IntPtr.Zero);

        return monitors;
    }

    private Models.MonitorInfo? GetCurrentMonitor()
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero) return null;

        var hMonitor = MonitorFromWindow(handle, MONITOR_DEFAULTTONEAREST);
        if (hMonitor == IntPtr.Zero) return null;

        var info = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
        if (!GetMonitorInfo(hMonitor, ref info)) return null;

        return new Models.MonitorInfo
        {
            Left = info.rcWork.Left,
            Top = info.rcWork.Top,
            Width = info.rcWork.Right - info.rcWork.Left,
            Height = info.rcWork.Bottom - info.rcWork.Top,
            IsPrimary = (info.dwFlags & 1) != 0
        };
    }

    private async void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
    {
        // Save session state with current window position
        SaveSessionState(true);

        // Save the last active tab ID for restoration
        if (_activeTabId != null)
        {
            await _settingsManager.UpdateAsync(s => s.LastActiveTabId = _activeTabId);
        }

        // Save zoom settings
        await _zoomSettingsManager.FlushAsync();

        // Clear browsing data on exit if the setting is enabled
        if (_settingsManager.Settings.Privacy.ClearOnExit)
        {
            await ClearBrowsingDataOnExitAsync();
        }

        // Cleanup WebViews
        foreach (var webView in _webViews.Values)
        {
            webView.Dispose();
        }
    }

    private void Window_StateChanged(object sender, EventArgs e)
    {
        // Update maximize button icon
        MaximizeButton.Content = WindowState == WindowState.Maximized ? "\uE923" : "\uE922";

        // Track restore bounds when window is in normal state
        if (_hasRestoredWindowState && WindowState == WindowState.Normal && !_isFullScreen)
        {
            _restoreBounds = new Rect(Left, Top, Width, Height);
        }
    }

    private void Window_LocationChanged(object? sender, EventArgs e)
    {
        // Track position changes when in normal state
        if (_hasRestoredWindowState && WindowState == WindowState.Normal && !_isFullScreen)
        {
            _restoreBounds = new Rect(Left, Top, Width, Height);
        }
    }

    private void Window_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        // Track size changes when in normal state
        if (_hasRestoredWindowState && WindowState == WindowState.Normal && !_isFullScreen)
        {
            _restoreBounds = new Rect(Left, Top, Width, Height);
        }

        // Recalculate tab widths when window size changes
        UpdateTabWidths();
    }

    private void Window_KeyDown(object sender, KeyEventArgs e)
    {
        // Handle keyboard shortcuts
        if (Keyboard.Modifiers == ModifierKeys.Control)
        {
            switch (e.Key)
            {
                case Key.T:
                    _ = CreateTabAsync(GetHomepage());
                    e.Handled = true;
                    break;
                case Key.W:
                    CloseCurrentTab();
                    e.Handled = true;
                    break;
                case Key.R:
                    ReloadCurrentTab();
                    e.Handled = true;
                    break;
                case Key.F5:
                    // Ctrl+F5 = Deep refresh (bypass cache)
                    DeepRefreshCurrentTab();
                    e.Handled = true;
                    break;
                case Key.L:
                    AddressBar.Focus();
                    AddressBar.SelectAll();
                    e.Handled = true;
                    break;
                case Key.D:
                    BookmarkCurrentPage();
                    e.Handled = true;
                    break;
                case Key.H:
                    ShowHistory();
                    e.Handled = true;
                    break;
                case Key.D0:
                case Key.NumPad0:
                    // Ctrl+0 = Reset zoom
                    ResetZoom();
                    e.Handled = true;
                    break;
            }
        }
        else if (Keyboard.Modifiers == (ModifierKeys.Control | ModifierKeys.Shift))
        {
            switch (e.Key)
            {
                case Key.T:
                    ReopenClosedTab();
                    e.Handled = true;
                    break;
                case Key.B:
                    ShowBookmarks();
                    e.Handled = true;
                    break;
                case Key.M:
                    ToggleMobileEmulation();
                    e.Handled = true;
                    break;
            }
        }
        else if (Keyboard.Modifiers == ModifierKeys.Alt)
        {
            switch (e.Key)
            {
                case Key.Left:
                    GoBack();
                    e.Handled = true;
                    break;
                case Key.Right:
                    GoForward();
                    e.Handled = true;
                    break;
            }
        }
        else if (e.Key == Key.F5)
        {
            ReloadCurrentTab();
            e.Handled = true;
        }
        else if (e.Key == Key.F11)
        {
            ToggleFullScreen();
            e.Handled = true;
        }
    }

    private void Window_PreviewMouseWheel(object sender, MouseWheelEventArgs e)
    {
        // Ctrl + Mouse Wheel = Zoom
        if (Keyboard.Modifiers == ModifierKeys.Control)
        {
            if (e.Delta > 0)
            {
                ZoomIn();
            }
            else if (e.Delta < 0)
            {
                ZoomOut();
            }
            e.Handled = true;
        }
    }

    #region Zoom Methods

    private System.Windows.Threading.DispatcherTimer? _zoomOverlayTimer;

    private void ZoomIn()
    {
        SetZoom(_currentZoomLevel + ZoomStep);
        ShowZoomOverlay();
    }

    private void ZoomOut()
    {
        SetZoom(_currentZoomLevel - ZoomStep);
        ShowZoomOverlay();
    }

    private void ResetZoom()
    {
        SetZoom(100);
        ShowZoomOverlay();
    }

    private void SetZoom(double zoomLevel, bool saveToSettings = true)
    {
        // Clamp zoom level to valid range
        zoomLevel = Math.Max(MinZoom, Math.Min(MaxZoom, zoomLevel));
        _currentZoomLevel = zoomLevel;

        // Apply zoom to active WebView
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            webView.ZoomFactor = zoomLevel / 100.0;

            // Save zoom level for this website
            if (saveToSettings && webView.CoreWebView2 != null)
            {
                var url = webView.CoreWebView2.Source;
                _zoomSettingsManager.SetZoomLevel(url, zoomLevel);
            }
        }

        // Update zoom display
        UpdateZoomDisplay();
    }

    private void UpdateZoomDisplay()
    {
        var zoomText = $"{_currentZoomLevel:0}%";

        if (Math.Abs(_currentZoomLevel - 100) < 0.1)
        {
            // At 100%, hide the zoom display and magnifier
            ZoomLevelButton.Visibility = Visibility.Collapsed;
            ZoomMagnifierButton.Visibility = Visibility.Collapsed;
        }
        else
        {
            // Show zoom level and magnifier
            ZoomLevelText.Text = zoomText;
            ZoomLevelButton.Visibility = Visibility.Visible;
            ZoomMagnifierButton.Visibility = Visibility.Visible;
        }

        // Update overlay text
        ZoomOverlayText.Text = zoomText;
    }

    private void ShowZoomOverlay()
    {
        // Update overlay text immediately
        ZoomOverlayText.Text = $"{_currentZoomLevel:0}%";

        // Only fade in if not already visible
        if (ZoomOverlay.Visibility != Visibility.Visible || ZoomOverlay.Opacity < 0.5)
        {
            // Show overlay with fade-in
            ZoomOverlay.Visibility = Visibility.Visible;

            // Create fade-in animation
            var fadeIn = new System.Windows.Media.Animation.DoubleAnimation
            {
                From = 0,
                To = 1,
                Duration = TimeSpan.FromMilliseconds(150)
            };
            ZoomOverlay.BeginAnimation(OpacityProperty, fadeIn);
        }

        // Reset or create auto-hide timer
        if (_zoomOverlayTimer == null)
        {
            _zoomOverlayTimer = new System.Windows.Threading.DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1.5)
            };
            _zoomOverlayTimer.Tick += (s, e) =>
            {
                _zoomOverlayTimer.Stop();
                HideZoomOverlay();
            };
        }

        _zoomOverlayTimer.Stop();
        _zoomOverlayTimer.Start();
    }

    private void HideZoomOverlay()
    {
        // Create fade-out animation
        var fadeOut = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = 1,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(200)
        };
        fadeOut.Completed += (s, e) =>
        {
            ZoomOverlay.Visibility = Visibility.Collapsed;
        };
        ZoomOverlay.BeginAnimation(OpacityProperty, fadeOut);
    }

    private void ZoomLevelButton_Click(object sender, RoutedEventArgs e)
    {
        ResetZoom();
    }

    private void ZoomMagnifierButton_Click(object sender, RoutedEventArgs e)
    {
        // Show the zoom overlay when magnifier is clicked
        ShowZoomOverlay();
    }

    private void ZoomOverlayMinus_Click(object sender, RoutedEventArgs e)
    {
        ZoomOut();
    }

    private void ZoomOverlayPlus_Click(object sender, RoutedEventArgs e)
    {
        ZoomIn();
    }

    private void ZoomOverlayReset_Click(object sender, RoutedEventArgs e)
    {
        ResetZoom();
    }

    #endregion

    #region Title Bar Events

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2)
        {
            ToggleMaximize();
        }
        else
        {
            DragMove();
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
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }

    private void ToggleFullScreen()
    {
        if (_isFullScreen)
        {
            // Exit fullscreen mode
            _isFullScreen = false;

            // Restore window state
            WindowState = _preFullScreenState;

            // Show title bar and navigation bar
            if (FindName("TitleBarRow") is RowDefinition titleRow)
                titleRow.Height = new GridLength(36);
            if (FindName("NavBarRow") is RowDefinition navRow)
                navRow.Height = new GridLength(44);
        }
        else
        {
            // Enter fullscreen mode - store current state first
            _isFullScreen = true;
            _preFullScreenState = WindowState;
            _preFullScreenBounds = new Rect(Left, Top, Width, Height);

            // Hide title bar and navigation bar for true fullscreen
            if (FindName("TitleBarRow") is RowDefinition titleRow)
                titleRow.Height = new GridLength(0);
            if (FindName("NavBarRow") is RowDefinition navRow)
                navRow.Height = new GridLength(0);

            // Maximize to cover entire screen including taskbar
            if (WindowState == WindowState.Maximized)
            {
                // Need to toggle to force re-maximize with new constraints
                WindowState = WindowState.Normal;
            }
            WindowState = WindowState.Maximized;
        }
    }

    #endregion

    #region Tab Management

    private async Task<TabState> CreateTabAsync(string url, BrowserMode? mode = null)
    {
        var tabMode = mode ?? _currentMode;
        var tabState = new TabState
        {
            Id = Guid.NewGuid().ToString(),
            Title = "New Tab",
            Url = url,
            Mode = tabMode,
            IsLoading = true
        };

        Tabs.Add(tabState);

        // Recalculate tab widths after adding new tab
        UpdateTabWidths();

        // Create WebView2 for this tab
        // Add margin to expose resize borders (WebView2 HWND intercepts mouse events)
        var webView = new WebView2
        {
            Visibility = Visibility.Collapsed,
            Margin = new Thickness(3, 3, 3, 3)  // Left, Top, Right, Bottom - expose resize areas
        };

        _webViews[tabState.Id] = webView;
        WebViewContainer.Children.Add(webView);

        // Initialize WebView2
        await InitializeWebViewAsync(webView, tabState);

        // Switch to new tab first (so _activeTabId is set)
        SwitchToTab(tabState.Id);

        // Navigate to URL using proper DNS resolution
        if (!string.IsNullOrEmpty(url))
        {
            // Use NavigateToAsync for proper private protocol resolution
            await NavigateToAsync(url);
        }

        // Save session state after new tab created
        SaveSessionState();

        return tabState;
    }

    private async Task InitializeWebViewAsync(WebView2 webView, TabState tabState)
    {
        var userDataFolder = GetUserDataFolder(tabState.Mode);
        var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
        await webView.EnsureCoreWebView2Async(env);

        // Configure WebView2 settings
        var settings = webView.CoreWebView2.Settings;
        settings.IsStatusBarEnabled = false;
        settings.AreDefaultContextMenusEnabled = true;
        settings.AreDevToolsEnabled = true;
        settings.IsZoomControlEnabled = true;
        settings.IsBuiltInErrorPageEnabled = true;

        // Apply system settings (spell check)
        ApplySystemSettings(webView);

        // Apply privacy settings
        ApplyPrivacySettings(webView);

        // Setup Do Not Track header if enabled
        SetupDoNotTrackHeader(webView);

        // Setup event handlers
        webView.CoreWebView2.NavigationStarting += (s, e) => OnNavigationStarting(tabState.Id, e);
        webView.CoreWebView2.NavigationCompleted += (s, e) => OnNavigationCompleted(tabState.Id, e);
        webView.CoreWebView2.SourceChanged += (s, e) => OnSourceChanged(tabState.Id);
        webView.CoreWebView2.DocumentTitleChanged += (s, e) => OnDocumentTitleChanged(tabState.Id);
        webView.CoreWebView2.FaviconChanged += async (s, e) => await OnFaviconChangedAsync(tabState.Id);
        webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
        webView.CoreWebView2.PermissionRequested += OnPermissionRequested;
        webView.CoreWebView2.DownloadStarting += OnDownloadStarting;

        // Apply download settings to the profile
        ApplyDownloadSettings(webView);

        // Setup message bridge for JavaScript communication
        webView.CoreWebView2.WebMessageReceived += (s, e) => OnWebMessageReceived(tabState.Id, e);

        // Inject the Jubilee bridge script for all pages
        await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(GetJubileeBridgeScript());

        // Apply the current font size setting to this WebView
        ApplyFontSizeToWebView(webView);
    }

    private static string GetJubileeBridgeScript()
    {
        // Note: postMessage with an object (not JSON.stringify) is correct.
        // WebView2's WebMessageAsJson property automatically serializes objects.
        // Using JSON.stringify would double-encode the message.
        return @"
(function() {
    if (window.jubilee) return;

    const pendingRequests = new Map();

    window.jubilee = {
        invoke: function(channel, args) {
            return new Promise((resolve, reject) => {
                const id = Math.random().toString(36).substr(2, 9);
                pendingRequests.set(id, { resolve, reject });

                // Pass object directly - WebMessageAsJson will serialize it
                window.chrome.webview.postMessage({
                    channel: channel,
                    args: args || {},
                    id: id
                });

                setTimeout(() => {
                    if (pendingRequests.has(id)) {
                        pendingRequests.delete(id);
                        reject(new Error('Request timeout'));
                    }
                }, 30000);
            });
        },

        send: function(channel, args) {
            // Pass object directly - WebMessageAsJson will serialize it
            window.chrome.webview.postMessage({
                channel: channel,
                args: args || {}
            });
        },

        on: function(channel, callback) {
            window.addEventListener('jubilee-message', function(e) {
                if (e.detail && e.detail.channel === channel) {
                    callback(e.detail.data);
                }
            });
        }
    };

    window.addEventListener('jubilee-response', function(e) {
        const response = e.detail;
        if (response.id && pendingRequests.has(response.id)) {
            const { resolve, reject } = pendingRequests.get(response.id);
            pendingRequests.delete(response.id);

            if (response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response.result);
            }
        }
    });

    console.log('Jubilee Bridge initialized');
})();
";
    }

    /// <summary>
    /// Manually injects the Jubilee bridge script into a WebView.
    /// This is needed for pages loaded via NavigateToString() because
    /// AddScriptToExecuteOnDocumentCreatedAsync doesn't work for those.
    /// </summary>
    private async Task InjectBridgeScriptAsync(Microsoft.Web.WebView2.Wpf.WebView2 webView)
    {
        try
        {
            // Wait a bit for the page to start loading
            await Task.Delay(50);

            // Inject the bridge script
            await webView.CoreWebView2.ExecuteScriptAsync(GetJubileeBridgeScript());
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to inject bridge script: {ex.Message}");
        }
    }

    private void SwitchToTab(string tabId)
    {
        if (_activeTabId == tabId) return;

        // Hide current WebView
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var currentWebView))
        {
            currentWebView.Visibility = Visibility.Collapsed;
        }

        // Show new WebView
        if (_webViews.TryGetValue(tabId, out var newWebView))
        {
            newWebView.Visibility = Visibility.Visible;
            _activeTabId = tabId;

            // Update tab selection
            var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
            if (tab != null)
            {
                TabStrip.SelectedItem = tab;
                UpdateNavigationState(tab);
                AddressBar.Text = tab.Url;

                // Update mode and visuals based on the active tab's mode
                if (_currentMode != tab.Mode)
                {
                    _currentMode = tab.Mode;
                    // Update radio buttons without triggering change event
                    ModeRadioWWW.Checked -= ModeRadio_Changed;
                    ModeRadioWWBW.Checked -= ModeRadio_Changed;
                    UpdateModeRadioButtons();
                    ModeRadioWWW.Checked += ModeRadio_Changed;
                    ModeRadioWWBW.Checked += ModeRadio_Changed;
                }
                // Always update visuals to match active tab's mode
                UpdateModeVisuals();
                TabStrip.Items.Refresh();

                // Update address bar icon based on the tab's URL
                // (must be called after UpdateModeVisuals since it resets the icon)
                UpdateAddressBarIcon(tab.Url ?? "");
            }

            // Update zoom level from the new tab's WebView
            _currentZoomLevel = newWebView.ZoomFactor * 100;
            UpdateZoomDisplay();

            // Update mobile emulation panel for this tab
            UpdateMobileEmulationPanelForTab(tabId);
        }

        UpdateWelcomePanel();

        // Update sidebar chat context when tab changes
        UpdateSidebarChatContext();

        // Save session state when switching tabs (active tab changed)
        SaveSessionState();
    }

    /// <summary>
    /// Gets the currently active tab.
    /// </summary>
    private TabState? GetCurrentTab()
    {
        if (_activeTabId == null) return null;
        return Tabs.FirstOrDefault(t => t.Id == _activeTabId);
    }

    private void CloseTab(string tabId)
    {
        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab == null) return;

        var tabIndex = Tabs.IndexOf(tab);

        // Add to closed tabs for reopen (use both managers for compatibility)
        _tabManager.AddClosedTab(tab);
        _recentlyClosedTabsManager.RecordClosedTab(tab);

        // Remove tab
        Tabs.Remove(tab);

        // Recalculate tab widths after removing tab
        UpdateTabWidths();

        // Cleanup WebView
        if (_webViews.TryGetValue(tabId, out var webView))
        {
            WebViewContainer.Children.Remove(webView);
            webView.Dispose();
            _webViews.Remove(tabId);
        }

        // Cleanup mobile emulation state for the closed tab
        _mobileEmulationManager.RemoveTabState(tabId);

        // Switch to adjacent tab
        if (_activeTabId == tabId && Tabs.Count > 0)
        {
            var newIndex = Math.Min(tabIndex, Tabs.Count - 1);
            SwitchToTab(Tabs[newIndex].Id);
        }

        UpdateWelcomePanel();

        // Save session state after tab close
        SaveSessionState();
    }

    private void CloseCurrentTab()
    {
        if (_activeTabId != null)
        {
            CloseTab(_activeTabId);
        }
    }

    private void ReopenClosedTab()
    {
        var closedTab = _tabManager.PopClosedTab();
        if (closedTab != null)
        {
            _ = CreateTabAsync(closedTab.Url, closedTab.Mode);
        }
    }

    private void TabStrip_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (TabStrip.SelectedItem is TabState tab && _isInitialized)
        {
            SwitchToTab(tab.Id);
            // Update tab widths when active tab changes (for visual priority)
            UpdateTabWidths();
        }
    }

    /// <summary>
    /// Dynamically calculates and updates tab widths based on available space.
    /// Active tabs get slightly more width when space is constrained.
    /// </summary>
    private void UpdateTabWidths()
    {
        if (Tabs.Count == 0) return;

        // Get available width for tabs
        // TitleBar column 0 has the tabs area, column 1 is window controls (138px)
        var availableWidth = TitleBar.ActualWidth - 138 - TabStripReservedWidth;
        if (availableWidth <= 0) availableWidth = 800; // Default if not yet rendered

        var tabCount = Tabs.Count;
        var activeTab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);

        // Calculate ideal width per tab
        var idealWidthPerTab = availableWidth / tabCount;

        // Determine the actual width to use
        double baseTabWidth;
        bool useActiveBonus = false;

        if (idealWidthPerTab >= MaxTabWidth)
        {
            // Plenty of space - use max width
            baseTabWidth = MaxTabWidth;
        }
        else if (idealWidthPerTab >= PreferredTabWidth)
        {
            // Good space - use preferred width
            baseTabWidth = PreferredTabWidth;
        }
        else if (idealWidthPerTab >= MinTabWidth + ActiveTabWidthBonus)
        {
            // Limited space - shrink tabs but give active tab bonus
            baseTabWidth = idealWidthPerTab;
            useActiveBonus = true;
        }
        else if (idealWidthPerTab >= MinTabWidth)
        {
            // Very limited space - use calculated width, active gets small bonus
            baseTabWidth = idealWidthPerTab;
            useActiveBonus = true;
        }
        else
        {
            // Extremely limited - use minimum width
            baseTabWidth = MinTabWidth;
        }

        // Calculate active tab bonus (only when space is constrained)
        double activeBonus = 0;
        if (useActiveBonus && tabCount > 1)
        {
            // Take a bit from inactive tabs to give to active tab
            var bonusPerInactiveTab = ActiveTabWidthBonus / (tabCount - 1);
            activeBonus = ActiveTabWidthBonus;

            // Ensure inactive tabs don't go below minimum
            if (baseTabWidth - bonusPerInactiveTab < MinTabWidth)
            {
                activeBonus = (baseTabWidth - MinTabWidth) * (tabCount - 1);
                bonusPerInactiveTab = baseTabWidth - MinTabWidth;
            }

            // Apply widths with animation-friendly updates
            foreach (var tab in Tabs)
            {
                var newWidth = tab.Id == _activeTabId
                    ? Math.Min(baseTabWidth + activeBonus, MaxTabWidth)
                    : Math.Max(baseTabWidth - bonusPerInactiveTab, MinTabWidth);
                tab.TabWidth = newWidth;
            }
        }
        else
        {
            // Apply uniform width to all tabs
            foreach (var tab in Tabs)
            {
                tab.TabWidth = Math.Min(Math.Max(baseTabWidth, MinTabWidth), MaxTabWidth);
            }
        }
    }

    #region Tab Drag and Drop

    private void TabStrip_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        _dragStartPoint = e.GetPosition(null);

        // Find the tab item being clicked
        var element = e.OriginalSource as DependencyObject;
        while (element != null && !(element is ListBoxItem))
        {
            element = VisualTreeHelper.GetParent(element);
        }

        if (element is ListBoxItem listBoxItem && listBoxItem.Content is TabState tab)
        {
            // Don't start drag if clicking the close button
            if (e.OriginalSource is FrameworkElement fe && fe.Name == "closeBtn")
            {
                return;
            }
            _draggedTab = tab;
            _dragSourceContainer = listBoxItem;
        }
    }

    private void TabStrip_PreviewMouseMove(object sender, MouseEventArgs e)
    {
        if (e.LeftButton != MouseButtonState.Pressed || _draggedTab == null)
        {
            return;
        }

        var currentPos = e.GetPosition(null);
        var diff = _dragStartPoint - currentPos;

        // Check if moved enough to start dragging
        if (Math.Abs(diff.X) > SystemParameters.MinimumHorizontalDragDistance ||
            Math.Abs(diff.Y) > SystemParameters.MinimumVerticalDragDistance)
        {
            if (!_isDragging)
            {
                _isDragging = true;

                // Apply visual effect to dragged tab (reduce opacity)
                if (_dragSourceContainer != null)
                {
                    _dragSourceContainer.Opacity = 0.5;
                }

                var data = new DataObject("TabState", _draggedTab);
                DragDrop.DoDragDrop(TabStrip, data, DragDropEffects.Move);

                // Reset visual effects after drag ends
                if (_dragSourceContainer != null)
                {
                    _dragSourceContainer.Opacity = 1.0;
                    _dragSourceContainer = null;
                }

                // Hide drop indicator
                TabDropIndicator.Visibility = Visibility.Collapsed;
                _dropTargetIndex = -1;

                _isDragging = false;
                _draggedTab = null;
            }
        }
    }

    private void TabStrip_DragOver(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent("TabState"))
        {
            e.Effects = DragDropEffects.Move;

            // Calculate and show drop indicator position
            var dropPos = e.GetPosition(TabStrip);
            double indicatorX = 0;
            int newTargetIndex = Tabs.Count;

            // Find which tab we're hovering near
            for (int i = 0; i < Tabs.Count; i++)
            {
                var container = TabStrip.ItemContainerGenerator.ContainerFromIndex(i) as ListBoxItem;
                if (container != null)
                {
                    var tabPos = container.TranslatePoint(new Point(0, 0), TabStrip);
                    var tabWidth = container.ActualWidth;

                    if (dropPos.X < tabPos.X + tabWidth / 2)
                    {
                        indicatorX = tabPos.X - 1.5; // Center the 3px indicator
                        newTargetIndex = i;
                        break;
                    }
                    else
                    {
                        // Position after this tab
                        indicatorX = tabPos.X + tabWidth - 1.5;
                    }
                }
            }

            // Update drop indicator position if changed
            if (newTargetIndex != _dropTargetIndex)
            {
                _dropTargetIndex = newTargetIndex;
                TabDropIndicator.Margin = new Thickness(indicatorX, 0, 0, 2);
                TabDropIndicator.Visibility = Visibility.Visible;
            }
        }
        else
        {
            e.Effects = DragDropEffects.None;
            TabDropIndicator.Visibility = Visibility.Collapsed;
        }
        e.Handled = true;
    }

    private void TabStrip_DragEnter(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent("TabState"))
        {
            TabDropIndicator.Visibility = Visibility.Visible;
        }
    }

    private void TabStrip_DragLeave(object sender, DragEventArgs e)
    {
        TabDropIndicator.Visibility = Visibility.Collapsed;
        _dropTargetIndex = -1;
    }

    private void TabStrip_Drop(object sender, DragEventArgs e)
    {
        if (!e.Data.GetDataPresent("TabState"))
        {
            return;
        }

        var droppedTab = e.Data.GetData("TabState") as TabState;
        if (droppedTab == null) return;

        // Find the tab we're dropping onto
        var dropPos = e.GetPosition(TabStrip);
        TabState? targetTab = null;
        int targetIndex = Tabs.Count;

        // Find which tab we're dropping near
        for (int i = 0; i < Tabs.Count; i++)
        {
            var container = TabStrip.ItemContainerGenerator.ContainerFromIndex(i) as ListBoxItem;
            if (container != null)
            {
                var tabPos = container.TranslatePoint(new Point(0, 0), TabStrip);
                var tabWidth = container.ActualWidth;

                if (dropPos.X < tabPos.X + tabWidth / 2)
                {
                    targetTab = Tabs[i];
                    targetIndex = i;
                    break;
                }
            }
        }

        // Move the tab
        var currentIndex = Tabs.IndexOf(droppedTab);
        if (currentIndex >= 0 && currentIndex != targetIndex)
        {
            Tabs.RemoveAt(currentIndex);
            if (targetIndex > currentIndex)
            {
                targetIndex--;
            }
            if (targetIndex >= Tabs.Count)
            {
                Tabs.Add(droppedTab);
            }
            else
            {
                Tabs.Insert(targetIndex, droppedTab);
            }

            // Refresh the tab strip
            TabStrip.Items.Refresh();
            TabStrip.SelectedItem = droppedTab;
        }

        // Hide drop indicator after drop
        TabDropIndicator.Visibility = Visibility.Collapsed;
        _dropTargetIndex = -1;

        e.Handled = true;
    }

    #endregion

    private void TabCloseButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button button && button.Tag is string tabId)
        {
            CloseTab(tabId);
        }
    }

    private void NewTab_Click(object sender, RoutedEventArgs e)
    {
        _ = CreateTabAsync(GetHomepage());
    }

    private void NewTabButton_Click(object sender, MouseButtonEventArgs e)
    {
        _ = CreateTabAsync(GetHomepage());
    }

    private void UpdateWelcomePanel()
    {
        WelcomePanel.Visibility = Tabs.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    #endregion

    #region Navigation

    private void OnNavigationStarting(string tabId, CoreWebView2NavigationStartingEventArgs e)
    {
        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab == null) return;

        // Handle internal jubilee:// URLs (including clicks from within settings page)
        if (e.Uri.StartsWith("jubilee://", StringComparison.OrdinalIgnoreCase))
        {
            e.Cancel = true;
            if (_webViews.TryGetValue(tabId, out var webView) && _internalPageHandler.CanHandle(e.Uri))
            {
                var content = _internalPageHandler.GetPageContent(e.Uri);
                webView.NavigateToString(content);

                // Update tab and address bar
                tab.Url = e.Uri;
                tab.Title = GetInternalPageTitle(e.Uri);
                if (tabId == _activeTabId)
                {
                    AddressBar.Text = e.Uri;
                }
            }
            return;
        }

        // Check blacklist
        if (_blacklistManager.IsBlocked(e.Uri, tab.Mode))
        {
            e.Cancel = true;
            ShowBlockedPage(tabId, e.Uri);
            return;
        }

        tab.IsLoading = true;
        if (tabId == _activeTabId)
        {
            LoadingBar.Visibility = Visibility.Visible;
            ReloadIcon.Text = "\uE711"; // Stop icon
        }
    }

    private void OnNavigationCompleted(string tabId, CoreWebView2NavigationCompletedEventArgs e)
    {
        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab == null) return;

        tab.IsLoading = false;
        if (tabId == _activeTabId)
        {
            LoadingBar.Visibility = Visibility.Collapsed;
            ReloadIcon.Text = "\uE72C"; // Reload icon
            UpdateNavigationState(tab);
        }

        // Restore saved zoom level for this website
        if (e.IsSuccess && _webViews.TryGetValue(tabId, out var webView))
        {
            var url = webView.CoreWebView2?.Source;
            var savedZoom = _zoomSettingsManager.GetZoomLevel(url);
            if (savedZoom.HasValue)
            {
                // Apply saved zoom without re-saving (to avoid infinite loop)
                webView.ZoomFactor = savedZoom.Value / 100.0;
                if (tabId == _activeTabId)
                {
                    _currentZoomLevel = savedZoom.Value;
                    UpdateZoomDisplay();
                }
            }
            // Note: If no saved zoom, keep the current zoom level (don't reset)
            // This allows zoom to persist when navigating within the same domain
        }

        // Add to history and record hit
        if (e.IsSuccess && !string.IsNullOrEmpty(tab.Url))
        {
            _historyManager.AddEntry(tab.Url, tab.Title, tab.Mode);

            // Record platform hit for analytics (fire and forget)
            _ = _hitCountService.RecordHitAsync();
        }

        // Re-apply mobile emulation after navigation (some overrides may be lost on page load)
        if (e.IsSuccess && _webViews.TryGetValue(tabId, out var emulationWebView))
        {
            _ = _mobileEmulationManager.ReapplyEmulationAfterNavigationAsync(tabId, emulationWebView);
        }

        // Save session state after navigation completes (URL changed)
        if (e.IsSuccess)
        {
            SaveSessionState();

            // Update sidebar chat context when navigation completes
            if (tabId == _activeTabId)
            {
                UpdateSidebarChatContext();
            }
        }
    }

    private void OnSourceChanged(string tabId)
    {
        if (!_webViews.TryGetValue(tabId, out var webView)) return;

        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab == null) return;

        var currentUrl = webView.Source?.ToString() ?? string.Empty;
        tab.IsSecure = currentUrl.StartsWith("https://");

        if (tabId == _activeTabId)
        {
            // Always try to show the private protocol URL instead of the resolved public URL
            // This works in both WWBW mode and WWW mode
            var displayUrl = currentUrl;
            var privateUrl = GetPrivateUrlMapping(tabId, currentUrl);
            if (!string.IsNullOrEmpty(privateUrl))
            {
                displayUrl = privateUrl;
                tab.Url = privateUrl; // Store the private URL in tab state
            }
            else
            {
                tab.Url = currentUrl;
                // Try to reverse resolve the URL to get the private equivalent
                _ = UpdateAddressBarWithPrivateUrlAsync(tabId, currentUrl);
                return; // Will be updated asynchronously
            }
            AddressBar.Text = displayUrl;

            // Update address bar icon based on URL type
            UpdateAddressBarIcon(displayUrl);
        }
        else
        {
            // For non-active tabs, still check for private URL mapping
            var privateUrl = GetPrivateUrlMapping(tabId, currentUrl);
            tab.Url = !string.IsNullOrEmpty(privateUrl) ? privateUrl : currentUrl;
        }
    }

    private async Task UpdateAddressBarWithPrivateUrlAsync(string tabId, string publicUrl)
    {
        try
        {
            var privateUrl = await _dnsResolver.ReverseResolveAsync(publicUrl);
            if (tabId == _activeTabId)
            {
                var displayUrl = privateUrl ?? publicUrl;
                AddressBar.Text = displayUrl;
                UpdateAddressBarIcon(displayUrl);
            }
        }
        catch
        {
            if (tabId == _activeTabId)
            {
                AddressBar.Text = publicUrl;
                UpdateAddressBarIcon(publicUrl);
            }
        }
    }

    /// <summary>
    /// Updates the address bar icon based on the current URL and browser mode.
    /// - In WWBW mode: Always shows WWBW icon (handled by UpdateModeVisuals)
    /// - In WWW mode with inspire:// URL: Shows WWBW icon
    /// - In WWW mode with regular URL: Shows globe icon
    /// </summary>
    private void UpdateAddressBarIcon(string url)
    {
        System.Diagnostics.Debug.WriteLine($"UpdateAddressBarIcon called with url: {url}, mode: {_currentMode}");

        if (_currentMode == BrowserMode.JubileeBibles)
        {
            // In WWBW mode, always show the WWBW icon (already set by UpdateModeVisuals)
            System.Diagnostics.Debug.WriteLine("UpdateAddressBarIcon: WWBW mode, returning early");
            return;
        }

        // In WWW (Internet) mode, check if it's an inspire:// URL
        var isInspireUrl = WWBWDnsResolver.IsPrivateProtocol(url);
        System.Diagnostics.Debug.WriteLine($"UpdateAddressBarIcon: IsPrivateProtocol returned {isInspireUrl}");

        if (isInspireUrl)
        {
            // Show the WWBW icon for inspire:// URLs in WWW mode
            System.Diagnostics.Debug.WriteLine("UpdateAddressBarIcon: Showing WWBW icon (inspire URL)");
            AddressBarGlobeIcon.Visibility = Visibility.Collapsed;
            AddressBarInspireIcon.Visibility = Visibility.Visible;
        }
        else
        {
            // Show the globe icon for regular URLs
            System.Diagnostics.Debug.WriteLine("UpdateAddressBarIcon: Showing globe icon (regular URL)");
            AddressBarGlobeIcon.Visibility = Visibility.Visible;
            AddressBarInspireIcon.Visibility = Visibility.Collapsed;
        }
    }

    private void OnDocumentTitleChanged(string tabId)
    {
        if (!_webViews.TryGetValue(tabId, out var webView)) return;

        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab != null)
        {
            tab.Title = webView.CoreWebView2.DocumentTitle ?? "New Tab";
        }
    }

    private async Task OnFaviconChangedAsync(string tabId)
    {
        if (!_webViews.TryGetValue(tabId, out var webView)) return;

        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab != null)
        {
            // Set the favicon from the website (XAML triggers handle fallback for WWBW tabs)
            tab.Favicon = webView.CoreWebView2.FaviconUri;
        }
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        var popupSetting = _settingsManager.Settings.Permissions.Popups;

        if (popupSetting == "block")
        {
            // Block the pop-up
            e.Handled = true;
            System.Diagnostics.Debug.WriteLine($"Pop-up blocked: {e.Uri}");
            return;
        }

        // Allow the pop-up by opening it in a new tab
        e.Handled = true;
        _ = CreateTabAsync(e.Uri);
    }

    /// <summary>
    /// Handles permission requests from websites (camera, microphone, location, notifications, etc.)
    /// </summary>
    private void OnPermissionRequested(object? sender, CoreWebView2PermissionRequestedEventArgs e)
    {
        var permissionSettings = _settingsManager.Settings.Permissions;
        string settingValue;

        // Map WebView2 permission kinds to our settings
        switch (e.PermissionKind)
        {
            case CoreWebView2PermissionKind.Camera:
                settingValue = permissionSettings.Camera;
                break;
            case CoreWebView2PermissionKind.Microphone:
                settingValue = permissionSettings.Microphone;
                break;
            case CoreWebView2PermissionKind.Geolocation:
                settingValue = permissionSettings.Location;
                break;
            case CoreWebView2PermissionKind.Notifications:
                settingValue = permissionSettings.Notifications;
                break;
            case CoreWebView2PermissionKind.ClipboardRead:
                // Default to ask for clipboard permissions
                settingValue = "ask";
                break;
            default:
                // For any other permission types, default to ask
                settingValue = "ask";
                break;
        }

        // Apply the permission decision
        switch (settingValue.ToLower())
        {
            case "allow":
                e.State = CoreWebView2PermissionState.Allow;
                System.Diagnostics.Debug.WriteLine($"Permission {e.PermissionKind} allowed for {e.Uri}");
                break;
            case "block":
                e.State = CoreWebView2PermissionState.Deny;
                System.Diagnostics.Debug.WriteLine($"Permission {e.PermissionKind} denied for {e.Uri}");
                break;
            case "ask":
            default:
                // Let WebView2 show its default permission prompt
                e.State = CoreWebView2PermissionState.Default;
                System.Diagnostics.Debug.WriteLine($"Permission {e.PermissionKind} prompt shown for {e.Uri}");
                break;
        }
    }

    /// <summary>
    /// Applies download settings to a WebView's profile.
    /// </summary>
    private void ApplyDownloadSettings(Microsoft.Web.WebView2.Wpf.WebView2 webView)
    {
        if (webView?.CoreWebView2?.Profile == null) return;

        try
        {
            var downloadSettings = _settingsManager.Settings.Advanced;
            var profile = webView.CoreWebView2.Profile;

            // Set the default download folder path
            profile.DefaultDownloadFolderPath = downloadSettings.DownloadPath;

            System.Diagnostics.Debug.WriteLine($"Download folder set to: {profile.DefaultDownloadFolderPath}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to apply download settings: {ex.Message}");
        }
    }

    /// <summary>
    /// Handles download starting events to apply download settings.
    /// </summary>
    private void OnDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        try
        {
            var downloadSettings = _settingsManager.Settings.Advanced;

            if (downloadSettings.AskDownloadLocation)
            {
                // Show the save dialog by using a deferral and letting the user choose
                var deferral = e.GetDeferral();

                Dispatcher.Invoke(() =>
                {
                    try
                    {
                        var saveDialog = new Microsoft.Win32.SaveFileDialog
                        {
                            FileName = System.IO.Path.GetFileName(e.ResultFilePath),
                            InitialDirectory = downloadSettings.DownloadPath,
                            Title = "Save Download As"
                        };

                        // Try to set filter based on file extension
                        var extension = System.IO.Path.GetExtension(e.ResultFilePath);
                        if (!string.IsNullOrEmpty(extension))
                        {
                            saveDialog.Filter = $"{extension.TrimStart('.').ToUpper()} files (*{extension})|*{extension}|All files (*.*)|*.*";
                        }
                        else
                        {
                            saveDialog.Filter = "All files (*.*)|*.*";
                        }

                        if (saveDialog.ShowDialog() == true)
                        {
                            e.ResultFilePath = saveDialog.FileName;
                            e.Handled = true;
                        }
                        else
                        {
                            // User cancelled - cancel the download
                            e.Cancel = true;
                            e.Handled = true;
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error in save dialog: {ex.Message}");
                    }
                    finally
                    {
                        deferral.Complete();
                    }
                });
            }
            else
            {
                // Use default download path without prompting
                // Ensure file goes to configured download folder
                var fileName = System.IO.Path.GetFileName(e.ResultFilePath);
                var targetPath = System.IO.Path.Combine(downloadSettings.DownloadPath, fileName);
                e.ResultFilePath = targetPath;
                e.Handled = true;

                System.Diagnostics.Debug.WriteLine($"Download started: {fileName} -> {targetPath}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error handling download: {ex.Message}");
        }
    }

    private void UpdateNavigationState(TabState tab)
    {
        if (!_webViews.TryGetValue(tab.Id, out var webView)) return;

        tab.CanGoBack = webView.CanGoBack;
        tab.CanGoForward = webView.CanGoForward;

        BackButton.IsEnabled = tab.CanGoBack;
        ForwardButton.IsEnabled = tab.CanGoForward;
    }

    private void BackButton_Click(object sender, RoutedEventArgs e) => GoBack();
    private void ForwardButton_Click(object sender, RoutedEventArgs e) => GoForward();
    private void ReloadButton_Click(object sender, RoutedEventArgs e) => ReloadCurrentTab();

    private void GoBack()
    {
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView) && webView.CanGoBack)
        {
            webView.GoBack();
        }
    }

    private void GoForward()
    {
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView) && webView.CanGoForward)
        {
            webView.GoForward();
        }
    }

    private void ReloadCurrentTab()
    {
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
            if (tab?.IsLoading == true)
            {
                webView.Stop();
            }
            else
            {
                webView.Reload();
            }
        }
    }

    private async void DeepRefreshCurrentTab()
    {
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
            if (tab?.IsLoading == true)
            {
                webView.Stop();
            }
            else
            {
                // Deep refresh: clear cache and reload
                try
                {
                    // Clear browser cache for this page
                    await webView.CoreWebView2.Profile.ClearBrowsingDataAsync(
                        Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.CacheStorage |
                        Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.DiskCache |
                        Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.DownloadHistory |
                        Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.GeneralAutofill);

                    // Reload the page
                    webView.Reload();
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Deep refresh error: {ex.Message}");
                    // Fallback to regular reload
                    webView.Reload();
                }
            }
        }
    }

    private void HomeButton_Click(object sender, RoutedEventArgs e)
    {
        NavigateTo(GetHomepage());
    }

    private void NavigateTo(string url)
    {
        // Use async version for proper DNS resolution
        _ = NavigateToAsync(url);
    }

    private async Task NavigateToAsync(string url)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView))
            return;

        try
        {
            // Handle internal jubilee:// URLs
            if (_internalPageHandler.CanHandle(url))
            {
                var content = _internalPageHandler.GetPageContent(url);
                webView.NavigateToString(content);
                AddressBar.Text = url;
                var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
                if (tab != null)
                {
                    tab.Url = url;
                    tab.Title = GetInternalPageTitle(url);
                }

                // For NavigateToString pages, AddScriptToExecuteOnDocumentCreatedAsync doesn't work
                // We need to manually inject the bridge script after the page loads
                _ = InjectBridgeScriptAsync(webView);
                return;
            }

            // Check if URL is valid for current mode
            if (!_dnsResolver.IsValidForMode(url, _currentMode))
            {
                // In WWBW mode, regular http/https URLs should open in a new WWW mode tab (blue tab)
                if (_currentMode == BrowserMode.JubileeBibles)
                {
                    // Create a new tab in Internet (WWW) mode with this URL
                    await CreateTabAsync(url, BrowserMode.Internet);
                    return;
                }
            }

            // Resolve the URL (handles both private protocols and regular URLs)
            var resolvedUrl = await ResolveUrlAsync(url);

            if (resolvedUrl == null)
            {
                if (_currentMode == BrowserMode.JubileeBibles)
                {
                    ShowWebspaceErrorPage(_activeTabId, url);
                }
                else
                {
                    ShowInvalidUrlPage(_activeTabId, url, "Unable to resolve this URL. The domain may not exist in the World Wide Bible Web network.");
                }
                return;
            }

            // Check blacklist for the resolved URL
            if (_blacklistManager.IsBlocked(resolvedUrl, _currentMode))
            {
                ShowBlockedPage(_activeTabId, resolvedUrl);
                return;
            }

            // Store the original private URL for display in address bar BEFORE navigating
            // (OnSourceChanged fires when webView.Source is set, so mapping must exist first)
            if (WWBWDnsResolver.IsPrivateProtocol(url))
            {
                StorePrivateUrlMapping(_activeTabId, resolvedUrl, url);
            }

            // Navigate to the resolved URL
            webView.Source = new Uri(resolvedUrl);

            // Update address bar immediately with the private URL
            if (WWBWDnsResolver.IsPrivateProtocol(url))
            {
                AddressBar.Text = url;
                // Also update tab state
                var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
                if (tab != null)
                {
                    tab.Url = url;
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Navigation error: {ex.Message}");
            if (_currentMode == BrowserMode.JubileeBibles)
            {
                ShowWebspaceErrorPage(_activeTabId, url);
            }
            else
            {
                ShowInvalidUrlPage(_activeTabId, url, $"Navigation failed: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// Resolves a URL for navigation. Handles both private protocol URLs and regular URLs.
    /// </summary>
    private async Task<string?> ResolveUrlAsync(string url)
    {
        // Check if this is a private protocol URL
        if (WWBWDnsResolver.IsPrivateProtocol(url))
        {
            // Resolve private URL to public URL
            var resolved = await _dnsResolver.ResolveToPublicUrlAsync(url);
            return resolved;
        }

        // Regular URL - validate and return
        return EnsureValidUrl(url);
    }

    // Dictionary to map resolved URLs back to their private protocol URLs
    private readonly Dictionary<string, string> _privateUrlMappings = new(StringComparer.OrdinalIgnoreCase);

    private void StorePrivateUrlMapping(string tabId, string resolvedUrl, string privateUrl)
    {
        var key = $"{tabId}:{resolvedUrl}";
        _privateUrlMappings[key] = privateUrl;
    }

    private string? GetPrivateUrlMapping(string tabId, string resolvedUrl)
    {
        // Try exact match first
        var key = $"{tabId}:{resolvedUrl}";
        if (_privateUrlMappings.TryGetValue(key, out var privateUrl))
            return privateUrl;

        // Try variations (with/without trailing slash, with/without www)
        var urlVariations = new List<string> { resolvedUrl };

        if (resolvedUrl.EndsWith("/"))
            urlVariations.Add(resolvedUrl.TrimEnd('/'));
        else
            urlVariations.Add(resolvedUrl + "/");

        // Try removing/adding www
        if (resolvedUrl.Contains("://www."))
        {
            urlVariations.Add(resolvedUrl.Replace("://www.", "://"));
        }
        else if (resolvedUrl.Contains("://"))
        {
            var idx = resolvedUrl.IndexOf("://");
            urlVariations.Add(resolvedUrl.Insert(idx + 3, "www."));
        }

        foreach (var variation in urlVariations)
        {
            key = $"{tabId}:{variation}";
            if (_privateUrlMappings.TryGetValue(key, out privateUrl))
                return privateUrl;
        }

        // Also try matching just by the host (for cases where the path changes)
        if (Uri.TryCreate(resolvedUrl, UriKind.Absolute, out var uri))
        {
            var hostPattern = $"{tabId}:https://{uri.Host}";
            foreach (var mapping in _privateUrlMappings)
            {
                if (mapping.Key.StartsWith(hostPattern, StringComparison.OrdinalIgnoreCase))
                    return mapping.Value;
            }
            hostPattern = $"{tabId}:http://{uri.Host}";
            foreach (var mapping in _privateUrlMappings)
            {
                if (mapping.Key.StartsWith(hostPattern, StringComparison.OrdinalIgnoreCase))
                    return mapping.Value;
            }
        }

        return null;
    }

    private void ShowInvalidUrlPage(string tabId, string invalidUrl, string message)
    {
        if (!_webViews.TryGetValue(tabId, out var webView)) return;

        var html = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>URL Not Available - Jubilee Browser</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .container {{
            text-align: center;
            padding: 40px;
            max-width: 600px;
        }}
        .icon {{
            font-size: 80px;
            margin-bottom: 20px;
            opacity: 0.8;
        }}
        h1 {{
            font-size: 28px;
            margin-bottom: 16px;
            font-weight: 300;
        }}
        .url {{
            background: rgba(255,255,255,0.1);
            padding: 12px 20px;
            border-radius: 8px;
            font-family: monospace;
            margin: 20px 0;
            word-break: break-all;
        }}
        .message {{
            color: rgba(255,255,255,0.7);
            font-size: 14px;
            line-height: 1.6;
            margin-top: 16px;
        }}
        .hint {{
            margin-top: 24px;
            padding: 16px;
            background: rgba(255,215,0,0.1);
            border-radius: 8px;
            border-left: 3px solid #ffd700;
        }}
        .hint-title {{
            color: #ffd700;
            font-weight: 600;
            margin-bottom: 8px;
        }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='icon'>&#x1F50D;</div>
        <h1>URL Not Available</h1>
        <div class='url'>{System.Web.HttpUtility.HtmlEncode(invalidUrl)}</div>
        <p class='message'>{System.Web.HttpUtility.HtmlEncode(message)}</p>
        <div class='hint'>
            <div class='hint-title'>Tip</div>
            <p>In WWBW mode, use private protocol URLs like:<br>
            <code>inspire://home.inspire</code><br>
            <code>webspace://jubileeverse.webspace</code></p>
        </div>
    </div>
</body>
</html>";

        webView.NavigateToString(html);
    }

    private void ShowWebspaceErrorPage(string tabId, string blockedUrl)
    {
        if (!_webViews.TryGetValue(tabId, out var webView)) return;

        var html = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>World Wide Bible Web Only - Jubilee Browser</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }}
        .container {{
            text-align: center;
            max-width: 700px;
            animation: fadeIn 0.5s ease-out;
        }}
        @keyframes fadeIn {{
            from {{ opacity: 0; transform: translateY(-20px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}
        .bible-icon {{
            font-size: 100px;
            margin-bottom: 24px;
            filter: drop-shadow(0 4px 12px rgba(255, 215, 0, 0.4));
        }}
        h1 {{
            font-size: 2.2rem;
            font-weight: 700;
            color: #FFD700;
            margin-bottom: 16px;
            text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
        }}
        .subtitle {{
            font-size: 1.1rem;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 24px;
            line-height: 1.6;
        }}
        .url-box {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px 24px;
            margin: 20px 0;
            word-break: break-all;
        }}
        .url-label {{
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.6);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }}
        .url-text {{
            font-size: 0.9rem;
            color: #ff6b6b;
            font-family: 'Consolas', 'Monaco', monospace;
        }}
        .info-section {{
            margin-top: 32px;
            text-align: left;
        }}
        .info-box {{
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
        }}
        .info-box h3 {{
            color: #FFD700;
            font-size: 1rem;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .info-box p {{
            color: rgba(255, 255, 255, 0.85);
            font-size: 0.9rem;
            line-height: 1.6;
        }}
        .protocol-list {{
            list-style: none;
            margin-top: 12px;
        }}
        .protocol-list li {{
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            margin-bottom: 6px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.85rem;
            color: #4ecdc4;
        }}
        .protocol-list li span {{
            color: rgba(255, 255, 255, 0.6);
            font-family: 'Segoe UI', sans-serif;
            margin-left: 8px;
        }}
        .btn-row {{
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 24px;
        }}
        .back-btn {{
            padding: 14px 28px;
            background: linear-gradient(135deg, #FFD700 0%, #E6AC00 100%);
            color: #1a1a2e;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            border: none;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
        }}
        .back-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);
        }}
        .home-btn {{
            padding: 14px 28px;
            background: transparent;
            color: #FFD700;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            border: 2px solid #FFD700;
            transition: all 0.3s ease;
        }}
        .home-btn:hover {{
            background: rgba(255, 215, 0, 0.1);
        }}
        .footer {{
            margin-top: 40px;
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.5);
        }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='bible-icon'>📖</div>
        <h1>World Wide Bible Web Only</h1>
        <p class='subtitle'>
            You are currently browsing in <strong>World Wide Bible Web mode</strong>.<br>
            Regular internet websites are not available in this mode.
        </p>

        <div class='url-box'>
            <div class='url-label'>Attempted URL</div>
            <div class='url-text'>{System.Web.HttpUtility.HtmlEncode(blockedUrl)}</div>
        </div>

        <div class='info-section'>
            <div class='info-box'>
                <h3>📚 What is the World Wide Bible Web?</h3>
                <p>
                    The World Wide Bible Web (WWBW) is a curated network of faith-based content
                    accessible through special protocol addresses. This mode provides a safe,
                    family-friendly browsing experience focused on spiritual resources.
                </p>
            </div>

            <div class='info-box'>
                <h3>🔗 Supported Protocol Addresses</h3>
                <p>In WWBW mode, use these special addresses:</p>
                <ul class='protocol-list'>
                    <li>inspire://jubileeverse.webspace <span>Jubilee Verse Home</span></li>
                    <li>inspire://home.inspire <span>Inspirational Content</span></li>
                    <li>webspace://jubileeverse.webspace <span>Web Spaces</span></li>
                    <li>church://home.church <span>Church Resources</span></li>
                    <li>apostle://home.apostle <span>Apostolic Content</span></li>
                </ul>
            </div>
        </div>

        <div class='btn-row'>
            <button class='back-btn' onclick='history.back()'>← Go Back</button>
            <button class='home-btn' onclick=""window.location.href='about:blank'"">🏠 Go Home</button>
        </div>

        <div class='footer'>
            To access regular websites, switch to Internet mode using the toggle above.
        </div>
    </div>
</body>
</html>";

        webView.NavigateToString(html);

        // Update tab state
        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab != null)
        {
            tab.Title = "WWBW Only";
            tab.Url = "browser://webspace_error";
        }

        // Update address bar
        if (tabId == _activeTabId)
        {
            AddressBar.Text = "browser://webspace_error";
        }
    }

    private void AddressBar_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            NavigateTo(AddressBar.Text);
            // Remove focus from address bar
            if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
            {
                webView.Focus();
            }
        }
    }

    private void AddressBar_GotFocus(object sender, RoutedEventArgs e)
    {
        AddressBar.SelectAll();
    }

    private void ShowBlockedPage(string tabId, string blockedUrl)
    {
        if (!_webViews.TryGetValue(tabId, out var webView)) return;

        var html = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Content Blocked - Jubilee Browser</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }}
        .container {{
            text-align: center;
            max-width: 600px;
            animation: fadeIn 0.5s ease-out;
        }}
        @keyframes fadeIn {{
            from {{ opacity: 0; transform: translateY(-20px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}
        .shield {{
            width: 120px;
            height: 140px;
            margin: 0 auto 30px;
            position: relative;
        }}
        .shield svg {{
            width: 100%;
            height: 100%;
            filter: drop-shadow(0 8px 24px rgba(255, 215, 0, 0.4));
        }}
        h1 {{
            font-size: 2.5rem;
            font-weight: 700;
            color: #FFD700;
            margin-bottom: 16px;
            text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
        }}
        .subtitle {{
            font-size: 1.2rem;
            color: white;
            margin-bottom: 30px;
            line-height: 1.6;
        }}
        .blocked-url {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px 24px;
            margin: 20px 0;
            word-break: break-all;
        }}
        .blocked-url-label {{
            font-size: 0.75rem;
            color: white;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }}
        .blocked-url-text {{
            font-size: 0.9rem;
            color: white;
            font-family: 'Consolas', 'Monaco', monospace;
        }}
        .info-box {{
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin-top: 30px;
        }}
        .info-box h3 {{
            color: #FFD700;
            font-size: 1rem;
            margin-bottom: 10px;
        }}
        .info-box p {{
            color: white;
            font-size: 0.9rem;
            line-height: 1.5;
        }}
        .back-btn {{
            display: inline-block;
            margin-top: 30px;
            padding: 14px 32px;
            background: linear-gradient(135deg, #FFD700 0%, #E6AC00 100%);
            color: #1a1a2e;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            border: none;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
        }}
        .back-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);
        }}
        .footer {{
            margin-top: 40px;
            font-size: 0.8rem;
            color: white;
        }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='shield'>
            <svg viewBox='0 0 100 120' xmlns='http://www.w3.org/2000/svg'>
                <defs>
                    <linearGradient id='shieldGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                        <stop offset='0%' style='stop-color:#FFD700'/>
                        <stop offset='100%' style='stop-color:#E6AC00'/>
                    </linearGradient>
                </defs>
                <path d='M50 5 L95 25 L95 55 C95 85 50 115 50 115 C50 115 5 85 5 55 L5 25 Z'
                      fill='url(#shieldGrad)' stroke='#B8860B' stroke-width='3'/>
                <text x='50' y='72' text-anchor='middle' font-size='40' font-weight='bold' fill='#1a1a2e'>✓</text>
            </svg>
        </div>
        <h1>Content Blocked</h1>
        <p class='subtitle'>This website has been blocked by Jubilee Browser's protection system to keep you safe.</p>

        <div class='blocked-url'>
            <div class='blocked-url-label'>Blocked URL</div>
            <div class='blocked-url-text'>{System.Web.HttpUtility.HtmlEncode(blockedUrl)}</div>
        </div>

        <div class='info-box'>
            <h3>Why was this blocked?</h3>
            <p>This site appears on our blocklist which includes sites containing adult content, malware, phishing attempts, gambling, or other harmful material.</p>
        </div>

        <button class='back-btn' onclick='history.back()'>← Go Back</button>

        <div class='footer'>
            Protected by Jubilee Browser
        </div>
    </div>
</body>
</html>";

        webView.NavigateToString(html);
    }

    #endregion

    #region Mode Management

    private void UpdateModeRadioButtons()
    {
        if (_currentMode == BrowserMode.JubileeBibles)
        {
            ModeRadioWWBW.IsChecked = true;
            ModeRadioWWW.IsChecked = false;
            // Hide the duplicate globe toggle in right actions since we have AddressBarModeGlobeButton
            ModeToggleBorder.Visibility = Visibility.Collapsed;
            ModeToggleGlobeIcon.Visibility = Visibility.Collapsed;
            ModeToggleAvatarBorder.Visibility = Visibility.Collapsed;
            // Address bar mode buttons - show globe to switch to WWW
            AddressBarModeGlobeButton.Visibility = Visibility.Visible;
            AddressBarModeBibleButton.Visibility = Visibility.Collapsed;
        }
        else
        {
            ModeRadioWWW.IsChecked = true;
            ModeRadioWWBW.IsChecked = false;
            // Hide all mode toggle buttons in right actions
            ModeToggleBorder.Visibility = Visibility.Collapsed;
            ModeToggleGlobeIcon.Visibility = Visibility.Collapsed;
            ModeToggleAvatarBorder.Visibility = Visibility.Collapsed;
            // Address bar mode buttons - show bible to switch to WWBW
            AddressBarModeGlobeButton.Visibility = Visibility.Collapsed;
            AddressBarModeBibleButton.Visibility = Visibility.Visible;
        }
    }

    private void ModeToggle_Click(object sender, RoutedEventArgs e)
    {
        // Toggle between modes
        if (_currentMode == BrowserMode.JubileeBibles)
        {
            ModeRadioWWW.IsChecked = true;
        }
        else
        {
            ModeRadioWWBW.IsChecked = true;
        }
    }

    private void AddressBarModeGlobeButton_MouseEnter(object sender, MouseEventArgs e)
    {
        AddressBarModeGlobeIcon.Foreground = new System.Windows.Media.SolidColorBrush(
            System.Windows.Media.Color.FromRgb(255, 215, 0)); // Gold/Yellow #FFD700
    }

    private void AddressBarModeGlobeButton_MouseLeave(object sender, MouseEventArgs e)
    {
        AddressBarModeGlobeIcon.Foreground = System.Windows.Media.Brushes.Black;
    }

    private void AddressBarModeBibleButton_MouseEnter(object sender, MouseEventArgs e)
    {
        // Show color icon, hide white icon on hover
        WWBWButtonIconWhite.Visibility = Visibility.Collapsed;
        WWBWButtonIconColor.Visibility = Visibility.Visible;
    }

    private void AddressBarModeBibleButton_MouseLeave(object sender, MouseEventArgs e)
    {
        // Show white icon, hide color icon on mouse leave
        WWBWButtonIconWhite.Visibility = Visibility.Visible;
        WWBWButtonIconColor.Visibility = Visibility.Collapsed;
    }

    private async void ModeRadio_Changed(object sender, RoutedEventArgs e)
    {
        if (!_isInitialized || ModeRadioWWBW == null || ModeRadioWWW == null || TabStrip == null)
        {
            return;
        }

        var newMode = ModeRadioWWBW.IsChecked == true ? BrowserMode.JubileeBibles : BrowserMode.Internet;
        if (newMode == _currentMode) return; // Avoid double processing

        _currentMode = newMode;

        // Check if there's an existing tab in the target mode
        var existingTab = Tabs.FirstOrDefault(t => t.Mode == newMode);

        if (existingTab != null)
        {
            // Switch to existing tab in the target mode
            SwitchToTab(existingTab.Id);
        }
        else
        {
            // Create a new tab in the new mode
            var newTab = await CreateTabAsync(GetHomepage(), _currentMode);
            SwitchToTab(newTab.Id);
        }

        // Apply visual styling for the current mode
        UpdateModeVisuals();

        // Update address bar icon based on current URL (after UpdateModeVisuals resets it)
        var activeTab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
        if (activeTab != null)
        {
            UpdateAddressBarIcon(activeTab.Url ?? "");
        }

        // Sync mode toggle UI without re-triggering mode changes
        ModeRadioWWW.Checked -= ModeRadio_Changed;
        ModeRadioWWBW.Checked -= ModeRadio_Changed;
        UpdateModeRadioButtons();
        ModeRadioWWW.Checked += ModeRadio_Changed;
        ModeRadioWWBW.Checked += ModeRadio_Changed;

        // Refresh tab list to update opacity/fading of inactive tabs
        TabStrip.Items.Refresh();
    }

    private void UpdateModeVisuals()
    {
        // Color definitions
        var wwbwBlue = System.Windows.Media.Color.FromRgb(0, 153, 255);  // #0099FF
        var wwbwYellow = System.Windows.Media.Color.FromRgb(255, 215, 0); // #FFD700
        var darkBg = System.Windows.Media.Color.FromRgb(26, 26, 46);     // #1a1a2e

        var wwbwBlueBrush = new System.Windows.Media.SolidColorBrush(wwbwBlue);
        var wwbwYellowBrush = new System.Windows.Media.SolidColorBrush(wwbwYellow);
        var darkBgBrush = new System.Windows.Media.SolidColorBrush(darkBg);

        // Title bar: Always dark in both modes
        TitleBar.Background = darkBgBrush;

        // Update the UI to reflect the current mode
        System.Diagnostics.Debug.WriteLine($"[UpdateModeVisuals] Current mode: {_currentMode}");
        if (_currentMode == BrowserMode.JubileeBibles)
        {
            // === WORLDWIDE BIBLE WEB MODE ===
            System.Diagnostics.Debug.WriteLine("[UpdateModeVisuals] Applying WWBW mode visuals");
            // Navigation bar: Yellow (#FFD700)
            NavigationBar.Background = wwbwYellowBrush;

            // WebView container background
            WebViewContainer.Background = (System.Windows.Media.Brush)FindResource("BgPrimaryBrush");

            // Address bar: Black background, bold yellow text
            AddressBar.Background = System.Windows.Media.Brushes.Black;
            AddressBar.Foreground = wwbwYellowBrush;
            AddressBar.FontWeight = FontWeights.Bold;

            // Address bar icon: Show WWBW icon, hide globe and inspire icon
            AddressBarWWBWIcon.Visibility = Visibility.Visible;
            AddressBarGlobeIcon.Visibility = Visibility.Collapsed;
            AddressBarInspireIcon.Visibility = Visibility.Collapsed;

            // Apply WWBW mode button style (black icons on yellow, hover effect)
            ApplyWWBWButtonStyle(BackButton);
            ApplyWWBWButtonStyle(ForwardButton);
            ApplyWWBWButtonStyle(ReloadButton);
            // BookmarkButton is inside address bar - don't apply nav bar style
            ApplyWWBWButtonStyle(HistoryButton);
            ApplyWWBWButtonStyle(BookmarksButton);
            ApplyWWBWMenuButtonStyle(MenuButton); // Special style with white icon on hover

            // Update icon foregrounds to black (for yellow nav bar)
            var blackBrush = System.Windows.Media.Brushes.Black;
            SetButtonIconForeground(BackButton, blackBrush);
            SetButtonIconForeground(ForwardButton, blackBrush);
            SetButtonIconForeground(ReloadButton, blackBrush);
            // BookmarkButton is inside the address bar (black bg), so use yellow
            SetButtonIconForeground(BookmarkButton, wwbwYellowBrush);
            SetButtonIconForeground(HistoryButton, blackBrush);
            SetButtonIconForeground(BookmarksButton, blackBrush);
            // MenuButton uses special style with binding - don't set foreground directly

            // Sidebar toggle icon: Black on yellow nav bar
            SidebarToggleIcon.Foreground = blackBrush;

            // Zoom level text should be yellow on black address bar
            ZoomLevelText.Foreground = wwbwYellowBrush;

            // Profile icon: Yellow person on dark circular background in WWBW mode
            ProfileIconHead.Fill = wwbwYellowBrush;
            ProfileIconBody.Fill = wwbwYellowBrush;
            ProfileDefaultAvatar.Fill = new SolidColorBrush(Color.FromRgb(37, 37, 69)); // #252545
            // MenuIcon color is handled by ApplyWWBWMenuButtonStyle binding
            ApplyWWBWButtonStyle(ProfileButton);

            // Chat button: Yellow chat icon on dark circular background in WWBW mode
            ChatIcon.Foreground = wwbwYellowBrush;
            ChatButtonBackground.Fill = new SolidColorBrush(Color.FromRgb(37, 37, 69)); // #252545
            ApplyWWBWButtonStyle(ChatButton);
        }
        else
        {
            // === INTERNET MODE ===
            // Navigation bar: Blue (#0099FF)
            NavigationBar.Background = wwbwBlueBrush;

            // WebView container background
            WebViewContainer.Background = (System.Windows.Media.Brush)FindResource("BgPrimaryBrush");

            // Address bar: Dark blue background to match toggle switch, white bold text
            AddressBar.Background = new System.Windows.Media.SolidColorBrush(
                System.Windows.Media.Color.FromRgb(0, 102, 170)); // #0066AA - dark blue
            AddressBar.Foreground = System.Windows.Media.Brushes.White;
            AddressBar.FontWeight = FontWeights.Bold;

            // Address bar icon: Show globe by default, hide WWBW icon
            // (inspire icon visibility is managed separately based on URL)
            AddressBarWWBWIcon.Visibility = Visibility.Collapsed;
            AddressBarGlobeIcon.Visibility = Visibility.Visible;
            AddressBarInspireIcon.Visibility = Visibility.Collapsed;

            // Apply Internet mode button style (white icons on blue, hover effect)
            ApplyInternetButtonStyle(BackButton);
            ApplyInternetButtonStyle(ForwardButton);
            ApplyInternetButtonStyle(ReloadButton);
            // BookmarkButton is inside address bar - don't apply nav bar style
            ApplyInternetButtonStyle(HistoryButton);
            ApplyInternetButtonStyle(BookmarksButton);
            ApplyInternetButtonStyle(MenuButton);

            // Update icon foregrounds to white (for blue nav bar)
            SetButtonIconForeground(BackButton, System.Windows.Media.Brushes.White);
            SetButtonIconForeground(ForwardButton, System.Windows.Media.Brushes.White);
            SetButtonIconForeground(ReloadButton, System.Windows.Media.Brushes.White);
            SetButtonIconForeground(BookmarkButton, System.Windows.Media.Brushes.White);
            SetButtonIconForeground(HistoryButton, System.Windows.Media.Brushes.White);
            SetButtonIconForeground(BookmarksButton, System.Windows.Media.Brushes.White);
            SetButtonIconForeground(MenuButton, System.Windows.Media.Brushes.White);

            // Sidebar toggle icon: White on blue nav bar
            SidebarToggleIcon.Foreground = System.Windows.Media.Brushes.White;

            // Zoom level text should be white on blue address bar
            ZoomLevelText.Foreground = System.Windows.Media.Brushes.White;

            // Profile icon: White person on dark circular background in WWW mode
            ProfileIconHead.Fill = System.Windows.Media.Brushes.White;
            ProfileIconBody.Fill = System.Windows.Media.Brushes.White;
            ProfileDefaultAvatar.Fill = new SolidColorBrush(Color.FromRgb(37, 37, 69)); // #252545
            // Force MenuIcon to white (XAML binding may not update when style is dynamically changed)
            MenuIcon.SetCurrentValue(TextBlock.ForegroundProperty, System.Windows.Media.Brushes.White);
            ApplyInternetButtonStyle(ProfileButton);

            // Chat button: White chat icon on dark circular background in WWW mode
            ChatIcon.Foreground = System.Windows.Media.Brushes.White;
            ChatButtonBackground.Fill = new SolidColorBrush(Color.FromRgb(37, 37, 69)); // #252545
            ApplyInternetButtonStyle(ChatButton);
        }
    }

    private void ApplyWWBWButtonStyle(Button button)
    {
        // Create style for WWBW mode: transparent bg, black text (on yellow nav bar)
        var style = new Style(typeof(Button));
        style.Setters.Add(new Setter(Button.BackgroundProperty, System.Windows.Media.Brushes.Transparent));
        style.Setters.Add(new Setter(Button.ForegroundProperty, System.Windows.Media.Brushes.Black));
        style.Setters.Add(new Setter(Button.BorderThicknessProperty, new Thickness(0)));
        style.Setters.Add(new Setter(Button.WidthProperty, 32.0));
        style.Setters.Add(new Setter(Button.HeightProperty, 32.0));
        style.Setters.Add(new Setter(Button.CursorProperty, Cursors.Hand));

        // Template with hover effect
        var template = new ControlTemplate(typeof(Button));
        var border = new FrameworkElementFactory(typeof(Border));
        border.Name = "border";
        border.SetValue(Border.BackgroundProperty, System.Windows.Media.Brushes.Transparent);
        border.SetValue(Border.CornerRadiusProperty, new CornerRadius(4));
        border.SetValue(Border.PaddingProperty, new Thickness(4));

        var contentPresenter = new FrameworkElementFactory(typeof(ContentPresenter));
        contentPresenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
        contentPresenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        // Bind TextElement.Foreground to the Button's Foreground so icons inherit the color
        contentPresenter.SetBinding(System.Windows.Documents.TextElement.ForegroundProperty, new System.Windows.Data.Binding("Foreground") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
        border.AppendChild(contentPresenter);

        template.VisualTree = border;

        // Hover trigger - darker yellow/gold background
        var hoverTrigger = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
        hoverTrigger.Setters.Add(new Setter(Border.BackgroundProperty,
            new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(204, 153, 0)), // Darker gold #CC9900
            "border"));
        template.Triggers.Add(hoverTrigger);

        // Pressed trigger
        var pressedTrigger = new Trigger { Property = Button.IsPressedProperty, Value = true };
        pressedTrigger.Setters.Add(new Setter(Border.BackgroundProperty,
            new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(179, 134, 0)), // Even darker #B38600
            "border"));
        template.Triggers.Add(pressedTrigger);

        // Disabled trigger
        var disabledTrigger = new Trigger { Property = Button.IsEnabledProperty, Value = false };
        disabledTrigger.Setters.Add(new Setter(Button.OpacityProperty, 0.4));
        template.Triggers.Add(disabledTrigger);

        style.Setters.Add(new Setter(Button.TemplateProperty, template));
        button.Style = style;
    }

    /// <summary>
    /// Applies WWBW button style with white icon on hover (specifically for MenuButton/hamburger icon)
    /// </summary>
    private void ApplyWWBWMenuButtonStyle(Button button)
    {
        // Create style for WWBW mode menu button: transparent bg, black text (on yellow nav bar), white on hover
        var style = new Style(typeof(Button));
        style.Setters.Add(new Setter(Button.BackgroundProperty, System.Windows.Media.Brushes.Transparent));
        style.Setters.Add(new Setter(Button.ForegroundProperty, System.Windows.Media.Brushes.Black));
        style.Setters.Add(new Setter(Button.BorderThicknessProperty, new Thickness(0)));
        style.Setters.Add(new Setter(Button.WidthProperty, 32.0));
        style.Setters.Add(new Setter(Button.HeightProperty, 32.0));
        style.Setters.Add(new Setter(Button.CursorProperty, Cursors.Hand));

        // Template with hover effect
        var template = new ControlTemplate(typeof(Button));
        var border = new FrameworkElementFactory(typeof(Border));
        border.Name = "border";
        border.SetValue(Border.BackgroundProperty, System.Windows.Media.Brushes.Transparent);
        border.SetValue(Border.CornerRadiusProperty, new CornerRadius(4));
        border.SetValue(Border.PaddingProperty, new Thickness(4));

        var contentPresenter = new FrameworkElementFactory(typeof(ContentPresenter));
        contentPresenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
        contentPresenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        // Bind TextElement.Foreground to the Button's Foreground so icons inherit the color
        contentPresenter.SetBinding(System.Windows.Documents.TextElement.ForegroundProperty, new System.Windows.Data.Binding("Foreground") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
        border.AppendChild(contentPresenter);

        template.VisualTree = border;

        // Hover trigger - darker yellow/gold background with white icon
        var hoverTrigger = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
        hoverTrigger.Setters.Add(new Setter(Border.BackgroundProperty,
            new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(204, 153, 0)), // Darker gold #CC9900
            "border"));
        hoverTrigger.Setters.Add(new Setter(Button.ForegroundProperty, System.Windows.Media.Brushes.White)); // White icon on hover
        template.Triggers.Add(hoverTrigger);

        // Pressed trigger - even darker background with white icon
        var pressedTrigger = new Trigger { Property = Button.IsPressedProperty, Value = true };
        pressedTrigger.Setters.Add(new Setter(Border.BackgroundProperty,
            new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(179, 134, 0)), // Even darker #B38600
            "border"));
        pressedTrigger.Setters.Add(new Setter(Button.ForegroundProperty, System.Windows.Media.Brushes.White)); // White icon when pressed
        template.Triggers.Add(pressedTrigger);

        // Disabled trigger
        var disabledTrigger = new Trigger { Property = Button.IsEnabledProperty, Value = false };
        disabledTrigger.Setters.Add(new Setter(Button.OpacityProperty, 0.4));
        template.Triggers.Add(disabledTrigger);

        style.Setters.Add(new Setter(Button.TemplateProperty, template));
        button.Style = style;
    }

    private void ApplyInternetButtonStyle(Button button)
    {
        // Create style for Internet mode: transparent bg, white text (on blue nav bar)
        var style = new Style(typeof(Button));
        style.Setters.Add(new Setter(Button.BackgroundProperty, System.Windows.Media.Brushes.Transparent));
        style.Setters.Add(new Setter(Button.ForegroundProperty, System.Windows.Media.Brushes.White));
        style.Setters.Add(new Setter(Button.BorderThicknessProperty, new Thickness(0)));
        style.Setters.Add(new Setter(Button.WidthProperty, 32.0));
        style.Setters.Add(new Setter(Button.HeightProperty, 32.0));
        style.Setters.Add(new Setter(Button.CursorProperty, Cursors.Hand));

        // Template with hover effect
        var template = new ControlTemplate(typeof(Button));
        var border = new FrameworkElementFactory(typeof(Border));
        border.Name = "border";
        border.SetValue(Border.BackgroundProperty, System.Windows.Media.Brushes.Transparent);
        border.SetValue(Border.CornerRadiusProperty, new CornerRadius(4));
        border.SetValue(Border.PaddingProperty, new Thickness(4));

        var contentPresenter = new FrameworkElementFactory(typeof(ContentPresenter));
        contentPresenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
        contentPresenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        // Bind TextElement.Foreground to the Button's Foreground so icons inherit the color
        contentPresenter.SetBinding(System.Windows.Documents.TextElement.ForegroundProperty, new System.Windows.Data.Binding("Foreground") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
        border.AppendChild(contentPresenter);

        template.VisualTree = border;

        // Hover trigger - darker blue background
        var hoverTrigger = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
        hoverTrigger.Setters.Add(new Setter(Border.BackgroundProperty,
            new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0, 119, 204)), // Darker blue #0077CC
            "border"));
        template.Triggers.Add(hoverTrigger);

        // Pressed trigger
        var pressedTrigger = new Trigger { Property = Button.IsPressedProperty, Value = true };
        pressedTrigger.Setters.Add(new Setter(Border.BackgroundProperty,
            new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0, 85, 170)), // Even darker #0055AA
            "border"));
        template.Triggers.Add(pressedTrigger);

        // Disabled trigger
        var disabledTrigger = new Trigger { Property = Button.IsEnabledProperty, Value = false };
        disabledTrigger.Setters.Add(new Setter(Button.OpacityProperty, 0.4));
        template.Triggers.Add(disabledTrigger);

        style.Setters.Add(new Setter(Button.TemplateProperty, template));
        button.Style = style;
    }

    private void SetButtonIconForeground(Button button, System.Windows.Media.Brush brush)
    {
        // Find the TextBlock inside the button and set its foreground
        if (button.Content is TextBlock textBlock)
        {
            // Use SetCurrentValue to override any template/style bindings
            textBlock.SetCurrentValue(TextBlock.ForegroundProperty, brush);
        }
    }

    private string GetHomepage()
    {
        var defaultInternetHomepage = "https://www.jubileeverse.com";
        var defaultWWBWHomepage = "inspire://jubilee.inspire";
        var homepage = _settingsManager?.Settings?.Homepage;

        string result;
        if (_currentMode == BrowserMode.JubileeBibles)
        {
            result = homepage?.JubileeBibles ?? defaultWWBWHomepage;
            System.Diagnostics.Debug.WriteLine($"[GetHomepage] Mode=JubileeBibles, Settings={homepage?.JubileeBibles ?? "null"}, Default={defaultWWBWHomepage}, Result={result}");
        }
        else
        {
            result = homepage?.Internet ?? defaultInternetHomepage;
            System.Diagnostics.Debug.WriteLine($"[GetHomepage] Mode=Internet, Settings={homepage?.Internet ?? "null"}, Default={defaultInternetHomepage}, Result={result}");
        }
        return result;
    }

    /// <summary>
    /// Gets the startup behavior setting for the specified mode.
    /// Returns: "homepage", "newtab", or "continue"
    /// </summary>
    private string GetStartupBehavior(BrowserMode mode)
    {
        var startup = _settingsManager?.Settings?.Startup;

        if (mode == BrowserMode.JubileeBibles)
        {
            return startup?.JubileeBibles ?? "homepage";
        }
        else
        {
            return startup?.Internet ?? "homepage";
        }
    }

    /// <summary>
    /// Gets the URL for the new tab page based on current mode.
    /// </summary>
    private string GetNewTabPageUrl()
    {
        // Return internal new tab page or about:blank
        return "jubilee://newtab";
    }

    private string GetUserDataFolder(BrowserMode mode)
    {
        var baseFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeBrowser"
        );

        return mode == BrowserMode.JubileeBibles
            ? Path.Combine(baseFolder, "WebView2_JubileeBibles")
            : Path.Combine(baseFolder, "WebView2_Internet");
    }

    private string GetDeviceId()
    {
        var secureStorage = new SecureStorageService();
        var deviceId = secureStorage.RetrieveAsync<string>("device_id").Result;
        if (string.IsNullOrEmpty(deviceId))
        {
            deviceId = Guid.NewGuid().ToString();
            _ = secureStorage.StoreAsync("device_id", deviceId);
        }
        return deviceId;
    }

    #endregion

    #region Bookmarks & History

    private void BookmarkButton_Click(object sender, RoutedEventArgs e)
    {
        BookmarkCurrentPage();
    }

    private void PageStatsButton_Click(object sender, RoutedEventArgs e)
    {
        ShowPageStats();
    }

    private void SpiritualNutritionButton_Click(object sender, RoutedEventArgs e)
    {
        _ = ShowSpiritualNutritionAsync();
    }

    private async Task ShowSpiritualNutritionAsync()
    {
        if (_activeTabId == null) return;
        if (_spiritualNutritionService == null)
        {
            MessageBox.Show("Spiritual Nutrition service is not available. Please check your API configuration.",
                "Service Unavailable", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
        if (tab == null) return;

        if (!_webViews.TryGetValue(_activeTabId, out var webView) || webView.CoreWebView2 == null)
        {
            MessageBox.Show("Unable to access page content.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }

        try
        {
            // Create and show the window immediately with loading state
            var nutritionWindow = new SpiritualNutritionWindow(_spiritualNutritionService)
            {
                Owner = this
            };
            nutritionWindow.PositionOnRightSide(this);
            nutritionWindow.Show();

            // Extract readable text content from the page using JavaScript
            var script = @"
                (function() {
                    // Remove script and style elements
                    var clone = document.body.cloneNode(true);
                    var scripts = clone.querySelectorAll('script, style, noscript, iframe, svg, canvas');
                    scripts.forEach(function(el) { el.remove(); });

                    // Get text content
                    var text = clone.innerText || clone.textContent || '';

                    // Clean up excessive whitespace
                    text = text.replace(/\s+/g, ' ').trim();

                    return text;
                })();
            ";

            var pageContent = await webView.CoreWebView2.ExecuteScriptAsync(script);

            // The result is JSON-encoded, so we need to unescape it
            if (pageContent.StartsWith("\"") && pageContent.EndsWith("\""))
            {
                pageContent = System.Text.Json.JsonSerializer.Deserialize<string>(pageContent) ?? string.Empty;
            }

            // Evaluate the content
            await nutritionWindow.EvaluateContentAsync(pageContent, tab.Url, tab.Title);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to show spiritual nutrition: {ex.Message}");
            MessageBox.Show($"Unable to analyze page content: {ex.Message}",
                "Analysis Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void ShowPageStats()
    {
        if (_activeTabId == null) return;

        var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
        if (tab == null) return;

        // Show page statistics in side panel
        SidePanelTitle.Text = "Page Statistics";
        var stats = new List<object>
        {
            new { Title = "URL", Display = tab.Url },
            new { Title = "Title", Display = tab.Title },
            new { Title = "Mode", Display = tab.Mode.ToString() },
            new { Title = "Status", Display = "Loaded" }
        };
        SidePanelList.ItemsSource = stats;
        ShowSidePanel();
    }

    private void BookmarkCurrentPage()
    {
        if (_activeTabId == null) return;

        var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
        if (tab == null) return;

        if (_bookmarkManager.IsBookmarked(tab.Url))
        {
            _bookmarkManager.RemoveBookmark(tab.Url);
            BookmarkIcon.Text = "\uE734"; // Empty star
        }
        else
        {
            _bookmarkManager.AddBookmark(tab.Url, tab.Title, tab.Mode, tab.Favicon);
            BookmarkIcon.Text = "\uE735"; // Filled star
        }
    }

    private async void HistoryButton_Click(object sender, RoutedEventArgs e)
    {
        // Open History in a new tab instead of side panel
        await CreateTabAsync("jubilee://history");
    }

    private void BookmarksButton_Click(object sender, RoutedEventArgs e)
    {
        // Toggle bookmarks panel with smooth animation - close if already showing bookmarks, otherwise open
        if (SidePanel.Visibility == Visibility.Visible && SidePanelTitle.Text == "Bookmarks" && !_isSidePanelAnimating)
        {
            HideSidePanel();
        }
        else if (!_isSidePanelAnimating)
        {
            ShowBookmarks();
        }
    }

    private void ShowHistory()
    {
        // Open history in a new tab
        _ = CreateTabAsync("jubilee://history");
    }

    private void ShowBookmarks()
    {
        SidePanelTitle.Text = "Bookmarks";
        SidePanelIcon.Text = "\uE728"; // Star icon for bookmarks

        var bookmarks = _bookmarkManager.GetBookmarks(_currentMode)
            .Select(b => new { b.Title, b.Url, Display = $"{b.Title}\n{b.Url}" })
            .ToList();

        SidePanelList.ItemsSource = bookmarks;

        // Show/hide empty state
        if (bookmarks.Count == 0)
        {
            SidePanelEmptyState.Visibility = Visibility.Visible;
            SidePanelEmptyTitle.Text = "No bookmarks yet";
            SidePanelEmptySubtitle.Text = "Press Ctrl+D to bookmark a page";
        }
        else
        {
            SidePanelEmptyState.Visibility = Visibility.Collapsed;
        }

        ShowSidePanel();
    }

    private bool _isSidePanelAnimating;

    private void ShowSidePanel()
    {
        if (_isSidePanelAnimating) return;

        SidePanel.Visibility = Visibility.Visible;
        SidePanelColumn.Width = new GridLength(320);

        // Play slide-in animation
        var slideIn = (System.Windows.Media.Animation.Storyboard)FindResource("SidePanelSlideIn");
        _isSidePanelAnimating = true;
        slideIn.Completed += (s, e) => _isSidePanelAnimating = false;
        slideIn.Begin(this);
    }

    private void HideSidePanel()
    {
        if (_isSidePanelAnimating || SidePanel.Visibility != Visibility.Visible) return;

        // Play slide-out animation
        var slideOut = (System.Windows.Media.Animation.Storyboard)FindResource("SidePanelSlideOut");
        _isSidePanelAnimating = true;
        slideOut.Completed += (s, e) =>
        {
            SidePanel.Visibility = Visibility.Collapsed;
            SidePanelColumn.Width = new GridLength(0);
            _isSidePanelAnimating = false;
        };
        slideOut.Begin(this);
    }

    private void CloseSidePanel_Click(object sender, RoutedEventArgs e)
    {
        HideSidePanel();
    }

    private void SidePanelList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (SidePanelList.SelectedItem != null)
        {
            var item = SidePanelList.SelectedItem;
            var urlProperty = item.GetType().GetProperty("Url");
            if (urlProperty?.GetValue(item) is string url)
            {
                NavigateTo(url);
            }
            SidePanelList.SelectedItem = null;
        }
    }

    // Store the current bookmark URL for context menu operations
    private string? _currentContextMenuBookmarkUrl;

    private void BookmarkMoreButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button button && button.ContextMenu != null)
        {
            _currentContextMenuBookmarkUrl = button.Tag as string;

            // Set PlacementTarget to the button for proper positioning
            button.ContextMenu.PlacementTarget = button;
            button.ContextMenu.Placement = System.Windows.Controls.Primitives.PlacementMode.Bottom;
            button.ContextMenu.HorizontalOffset = -152; // Align right edge of menu with button
            button.ContextMenu.VerticalOffset = 4;
            button.ContextMenu.IsOpen = true;

            e.Handled = true; // Prevent ListBox selection
        }
    }

    private void BookmarkContextMenu_OpenNewTab_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentContextMenuBookmarkUrl))
        {
            _ = CreateTabAsync(_currentContextMenuBookmarkUrl);
        }
    }

    private void BookmarkContextMenu_CopyUrl_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentContextMenuBookmarkUrl))
        {
            System.Windows.Clipboard.SetText(_currentContextMenuBookmarkUrl);
        }
    }

    private void BookmarkContextMenu_Delete_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentContextMenuBookmarkUrl))
        {
            _bookmarkManager.RemoveBookmark(_currentContextMenuBookmarkUrl);

            // Refresh the bookmarks list
            ShowBookmarks();

            // Update the bookmark icon if the current page was the deleted bookmark
            if (_activeTabId != null)
            {
                var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
                if (tab != null && tab.Url == _currentContextMenuBookmarkUrl)
                {
                    BookmarkIcon.Text = "\uE734"; // Empty star
                }
            }
        }
    }

    #endregion

    #region Settings & Menu

    private void SettingsButton_Click(object sender, RoutedEventArgs e)
    {
        // TODO: Open settings page
        NavigateTo("jubilee://settings");
    }

    private void MenuButton_Click(object sender, RoutedEventArgs e)
    {
        // Update zoom level display
        UpdateMainMenuZoomLevel();

        // Reset More Tools panel state
        MoreToolsPanel.Visibility = Visibility.Collapsed;

        // Open the popup
        MainMenuPopup.IsOpen = true;

        // Animate the menu appearance
        MainMenuBorder.Opacity = 0;
        var slideIn = (System.Windows.Media.Animation.Storyboard)FindResource("MainMenuSlideIn");
        slideIn.Begin(MainMenuBorder);
    }

    private void UpdateMainMenuZoomLevel()
    {
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            var zoomFactor = webView.ZoomFactor;
            MainMenuZoomLevel.Text = $"{(int)(zoomFactor * 100)}%";
        }
        else
        {
            MainMenuZoomLevel.Text = "100%";
        }
    }

    #region Main Menu Handlers

    private void MainMenu_Profile_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        // Open the sign-in dialog
        ProfileSignIn_Click(sender, e);
    }

    private void MainMenu_NewTab_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        _ = CreateTabAsync(GetHomepage());
    }

    private void MainMenu_NewWindow_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        // Create a new window with WWW (Internet) mode - blue tab
        var newWindow = new MainWindow(BrowserMode.Internet);
        newWindow.Show();
        newWindow.Activate();
    }

    private void MainMenu_NewWWBWWindow_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        // Create a new window in WWBW (JubileeBibles) mode - yellow tab
        var newWindow = new MainWindow(BrowserMode.JubileeBibles);
        newWindow.Show();
        newWindow.Activate();
    }

    private void MainMenu_Favorites_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        ShowBookmarks();
    }

    private async void MainMenu_History_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        // Open History in a new tab instead of side panel
        await CreateTabAsync("jubilee://history");
    }

    private void MainMenu_Downloads_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        NavigateTo("jubilee://downloads");
    }

    private void MainMenu_MoreTools_Click(object sender, RoutedEventArgs e)
    {
        // Toggle More Tools panel visibility
        MoreToolsPanel.Visibility = MoreToolsPanel.Visibility == Visibility.Visible
            ? Visibility.Collapsed
            : Visibility.Visible;
    }

    private void MainMenu_Extensions_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        NavigateTo("jubilee://extensions");
    }

    private void MainMenu_TaskManager_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        ShowBrowserTaskManager();
    }

    private void ShowBrowserTaskManager()
    {
        var taskManagerWindow = new Window
        {
            Title = "Browser Task Manager",
            Width = 500,
            Height = 400,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 30, 46)),
            WindowStyle = WindowStyle.ToolWindow
        };

        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var listView = new ListView
        {
            Background = System.Windows.Media.Brushes.Transparent,
            Foreground = System.Windows.Media.Brushes.White,
            BorderThickness = new Thickness(0)
        };

        var gridView = new GridView();
        gridView.Columns.Add(new GridViewColumn { Header = "Tab", Width = 250, DisplayMemberBinding = new System.Windows.Data.Binding("Title") });
        gridView.Columns.Add(new GridViewColumn { Header = "Status", Width = 80, DisplayMemberBinding = new System.Windows.Data.Binding("Status") });
        gridView.Columns.Add(new GridViewColumn { Header = "Memory", Width = 80, DisplayMemberBinding = new System.Windows.Data.Binding("Memory") });
        listView.View = gridView;

        foreach (var tab in Tabs)
        {
            listView.Items.Add(new
            {
                Title = tab.Title.Length > 40 ? tab.Title.Substring(0, 37) + "..." : tab.Title,
                Status = tab.IsLoading ? "Loading..." : "Active",
                Memory = "N/A"
            });
        }

        Grid.SetRow(listView, 0);
        grid.Children.Add(listView);

        var infoPanel = new StackPanel { Margin = new Thickness(10), Orientation = Orientation.Horizontal };
        infoPanel.Children.Add(new TextBlock
        {
            Text = $"Total tabs: {Tabs.Count}  |  WebViews: {_webViews.Count}",
            Foreground = System.Windows.Media.Brushes.White
        });
        Grid.SetRow(infoPanel, 1);
        grid.Children.Add(infoPanel);

        taskManagerWindow.Content = grid;
        taskManagerWindow.Show();
    }

    private void MainMenu_DevTools_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            webView.CoreWebView2?.OpenDevToolsWindow();
        }
    }

    private void MainMenu_WebCapture_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
            CaptureWebPage(webView, tab?.Title ?? "Capture");
        }
    }

    private void MainMenu_MobileView_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        ToggleMobileEmulation();
    }

    private void ContextMenu_MobileView_Click(object sender, RoutedEventArgs e)
    {
        ToggleMobileEmulation();
    }

    #region Mobile Emulation

    private void ToggleMobileEmulation()
    {
        if (_activeTabId == null) return;

        var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
        if (tab == null) return;

        if (!_webViews.TryGetValue(_activeTabId, out var webView)) return;

        var state = _mobileEmulationManager.GetEmulationState(_activeTabId);

        if (state.IsEnabled)
        {
            // Disable emulation
            _ = DisableMobileEmulationAsync(_activeTabId, webView);
        }
        else
        {
            // Enable emulation with default device (iPhone 14 Pro)
            var defaultDevice = DeviceProfiles.GetById("iphone-14-pro") ?? DeviceProfiles.All.FirstOrDefault();
            if (defaultDevice != null)
            {
                _ = EnableMobileEmulationAsync(_activeTabId, webView, defaultDevice);
            }
        }
    }

    private async Task EnableMobileEmulationAsync(string tabId, WebView2 webView, DeviceProfile device)
    {
        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab == null) return;

        await _mobileEmulationManager.EnableEmulationAsync(tabId, webView, device);
        tab.IsMobileEmulationEnabled = true;

        // Show the emulation panel
        MobileEmulationPanel.Visibility = Visibility.Visible;
        MobileEmulationPanel.UpdateFromState(_mobileEmulationManager.GetEmulationState(tabId));

        // Update menu text
        MobileViewMenuText.Text = "Exit mobile view";

        System.Diagnostics.Debug.WriteLine($"Mobile emulation enabled for tab {tabId}: {device.Name}");
    }

    private async Task EnableResponsiveModeAsync(string tabId, WebView2 webView, int width, int height, double dpr)
    {
        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab == null) return;

        await _mobileEmulationManager.EnableResponsiveModeAsync(tabId, webView, width, height, dpr);
        tab.IsMobileEmulationEnabled = true;

        // Show the emulation panel
        MobileEmulationPanel.Visibility = Visibility.Visible;
        MobileEmulationPanel.UpdateFromState(_mobileEmulationManager.GetEmulationState(tabId));

        // Update menu text
        MobileViewMenuText.Text = "Exit mobile view";

        System.Diagnostics.Debug.WriteLine($"Responsive mode enabled for tab {tabId}: {width}x{height}@{dpr}x");
    }

    private async Task DisableMobileEmulationAsync(string tabId, WebView2 webView)
    {
        var tab = Tabs.FirstOrDefault(t => t.Id == tabId);
        if (tab == null) return;

        await _mobileEmulationManager.DisableEmulationAsync(tabId, webView);
        tab.IsMobileEmulationEnabled = false;

        // Hide the emulation panel
        MobileEmulationPanel.Visibility = Visibility.Collapsed;

        // Update menu text
        MobileViewMenuText.Text = "Toggle mobile view";

        System.Diagnostics.Debug.WriteLine($"Mobile emulation disabled for tab {tabId}");
    }

    private void MobileEmulationPanel_DeviceSelected(object? sender, DeviceSelectedEventArgs e)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView)) return;

        if (e.IsResponsiveMode)
        {
            // Switch to responsive mode with current custom dimensions
            var state = _mobileEmulationManager.GetEmulationState(_activeTabId);
            _ = EnableResponsiveModeAsync(_activeTabId, webView, state.CustomWidth, state.CustomHeight, state.CustomDevicePixelRatio);
        }
        else if (e.Device != null)
        {
            // Switch to specific device
            _ = _mobileEmulationManager.SwitchDeviceAsync(_activeTabId, webView, e.Device);
        }
    }

    private void MobileEmulationPanel_DimensionsChanged(object? sender, DimensionsChangedEventArgs e)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView)) return;

        _ = _mobileEmulationManager.UpdateResponsiveDimensionsAsync(_activeTabId, webView, e.Width, e.Height);
    }

    private void MobileEmulationPanel_OrientationChanged(object? sender, OrientationChangedEventArgs e)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView)) return;

        _ = _mobileEmulationManager.SetOrientationAsync(_activeTabId, webView, e.Orientation);
    }

    private void MobileEmulationPanel_DprChanged(object? sender, DprChangedEventArgs e)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView)) return;

        _ = _mobileEmulationManager.UpdateDevicePixelRatioAsync(_activeTabId, webView, e.DevicePixelRatio);
    }

    private void MobileEmulationPanel_NetworkThrottleChanged(object? sender, NetworkThrottleChangedEventArgs e)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView)) return;

        _ = _mobileEmulationManager.SetNetworkThrottlingAsync(_activeTabId, webView, e.Preset);
    }

    private void MobileEmulationPanel_CpuThrottleChanged(object? sender, CpuThrottleChangedEventArgs e)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView)) return;

        _ = _mobileEmulationManager.SetCpuThrottlingAsync(_activeTabId, webView, e.Preset);
    }

    private void MobileEmulationPanel_CloseRequested(object? sender, EventArgs e)
    {
        if (_activeTabId == null || !_webViews.TryGetValue(_activeTabId, out var webView)) return;

        _ = DisableMobileEmulationAsync(_activeTabId, webView);
    }

    private void UpdateMobileEmulationPanelForTab(string tabId)
    {
        var state = _mobileEmulationManager.GetEmulationState(tabId);

        if (state.IsEnabled)
        {
            MobileEmulationPanel.Visibility = Visibility.Visible;
            MobileEmulationPanel.UpdateFromState(state);
            MobileViewMenuText.Text = "Exit mobile view";
        }
        else
        {
            MobileEmulationPanel.Visibility = Visibility.Collapsed;
            MobileViewMenuText.Text = "Toggle mobile view";
        }
    }

    #endregion

    private void MainMenu_ZoomIn_Click(object sender, RoutedEventArgs e)
    {
        ZoomIn();
        UpdateMainMenuZoomLevel();
    }

    private void MainMenu_ZoomOut_Click(object sender, RoutedEventArgs e)
    {
        ZoomOut();
        UpdateMainMenuZoomLevel();
    }

    private void MainMenu_Print_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        PrintPage();
    }

    private void MainMenu_Settings_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        NavigateTo("jubilee://settings");
    }

    private void MainMenu_ClearBrowsingData_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        ShowClearBrowsingDataDialog();
    }

    private void ShowClearBrowsingDataDialog()
    {
        var dialog = new Window
        {
            Title = "Clear browsing data",
            Width = 400,
            Height = 350,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 30, 46)),
            WindowStyle = WindowStyle.ToolWindow,
            ResizeMode = ResizeMode.NoResize
        };

        var mainPanel = new StackPanel { Margin = new Thickness(20) };

        mainPanel.Children.Add(new TextBlock
        {
            Text = "Clear browsing data",
            FontSize = 18,
            FontWeight = FontWeights.Bold,
            Foreground = System.Windows.Media.Brushes.White,
            Margin = new Thickness(0, 0, 0, 15)
        });

        mainPanel.Children.Add(new TextBlock
        {
            Text = "Time range:",
            Foreground = System.Windows.Media.Brushes.White,
            Margin = new Thickness(0, 0, 0, 5)
        });

        var timeRangeCombo = new ComboBox
        {
            Margin = new Thickness(0, 0, 0, 15),
            SelectedIndex = 0
        };
        timeRangeCombo.Items.Add("Last hour");
        timeRangeCombo.Items.Add("Last 24 hours");
        timeRangeCombo.Items.Add("Last 7 days");
        timeRangeCombo.Items.Add("Last 4 weeks");
        timeRangeCombo.Items.Add("All time");
        mainPanel.Children.Add(timeRangeCombo);

        var checkBoxStyle = new Style(typeof(CheckBox));
        checkBoxStyle.Setters.Add(new Setter(CheckBox.ForegroundProperty, System.Windows.Media.Brushes.White));
        checkBoxStyle.Setters.Add(new Setter(CheckBox.MarginProperty, new Thickness(0, 5, 0, 5)));

        var clearHistoryCheck = new CheckBox { Content = "Browsing history", IsChecked = true, Style = checkBoxStyle };
        var clearCookiesCheck = new CheckBox { Content = "Cookies and other site data", IsChecked = true, Style = checkBoxStyle };
        var clearCacheCheck = new CheckBox { Content = "Cached images and files", IsChecked = true, Style = checkBoxStyle };
        var clearDownloadsCheck = new CheckBox { Content = "Download history", IsChecked = false, Style = checkBoxStyle };

        mainPanel.Children.Add(clearHistoryCheck);
        mainPanel.Children.Add(clearCookiesCheck);
        mainPanel.Children.Add(clearCacheCheck);
        mainPanel.Children.Add(clearDownloadsCheck);

        var buttonPanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 20, 0, 0)
        };

        var cancelButton = new Button
        {
            Content = "Cancel",
            Padding = new Thickness(20, 8, 20, 8),
            Margin = new Thickness(0, 0, 10, 0)
        };
        cancelButton.Click += (s, e) => dialog.Close();

        var clearButton = new Button
        {
            Content = "Clear data",
            Padding = new Thickness(20, 8, 20, 8),
            Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0, 120, 212)),
            Foreground = System.Windows.Media.Brushes.White,
            BorderThickness = new Thickness(0)
        };
        clearButton.Click += async (s, e) =>
        {
            dialog.Close();
            await ClearBrowsingDataAsync(
                clearHistoryCheck.IsChecked == true,
                clearCookiesCheck.IsChecked == true,
                clearCacheCheck.IsChecked == true,
                clearDownloadsCheck.IsChecked == true
            );
            MessageBox.Show("Browsing data has been cleared.", "Clear Browsing Data", MessageBoxButton.OK, MessageBoxImage.Information);
        };

        buttonPanel.Children.Add(cancelButton);
        buttonPanel.Children.Add(clearButton);
        mainPanel.Children.Add(buttonPanel);

        dialog.Content = mainPanel;
        dialog.ShowDialog();
    }

    private async Task ClearBrowsingDataAsync(bool clearHistory, bool clearCookies, bool clearCache, bool clearDownloads)
    {
        // Clear data for each WebView
        foreach (var webView in _webViews.Values)
        {
            if (webView.CoreWebView2 != null)
            {
                var profile = webView.CoreWebView2.Profile;
                var dataKinds = Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.AllSite;

                if (clearCache)
                {
                    dataKinds |= Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.DiskCache;
                }
                if (clearCookies)
                {
                    dataKinds |= Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.Cookies;
                }
                if (clearHistory)
                {
                    dataKinds |= Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.BrowsingHistory;
                }
                if (clearDownloads)
                {
                    dataKinds |= Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.DownloadHistory;
                }

                await profile.ClearBrowsingDataAsync(dataKinds);
                break; // Only need to clear once since all WebViews share the same profile
            }
        }
    }

    private void MainMenu_Help_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        NavigateTo("https://jubileebrowser.com/help");
    }

    private void MainMenu_Feedback_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        NavigateTo("https://jubileebrowser.com/feedback");
    }

    private void MainMenu_About_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        ShowAbout();
    }

    private void MainMenu_Exit_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        Close();
    }

    #endregion

    private async void PrintPage()
    {
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            await webView.CoreWebView2.ExecuteScriptAsync("window.print()");
        }
    }

    private void ShowAbout()
    {
        var aboutWindow = new AboutWindow
        {
            Owner = this
        };
        aboutWindow.ShowDialog();
    }

    #endregion

    #region Context Menu Handlers

    private void DuplicateTab_Click(object sender, RoutedEventArgs e)
    {
        if (_activeTabId != null)
        {
            var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
            if (tab != null)
            {
                _ = CreateTabAsync(tab.Url, tab.Mode);
            }
        }
    }

    private void PinTab_Click(object sender, RoutedEventArgs e)
    {
        if (_activeTabId != null)
        {
            var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
            if (tab != null)
            {
                tab.IsPinned = !tab.IsPinned;
            }
        }
    }

    private void MuteTab_Click(object sender, RoutedEventArgs e)
    {
        if (_activeTabId != null && _webViews.TryGetValue(_activeTabId, out var webView))
        {
            var tab = Tabs.FirstOrDefault(t => t.Id == _activeTabId);
            if (tab != null)
            {
                tab.IsMuted = !tab.IsMuted;
                webView.CoreWebView2.IsMuted = tab.IsMuted;
            }
        }
    }

    private void CloseCurrentTab_Click(object sender, RoutedEventArgs e)
    {
        CloseCurrentTab();
    }

    private void CloseOtherTabs_Click(object sender, RoutedEventArgs e)
    {
        if (_activeTabId == null) return;

        var tabsToClose = Tabs.Where(t => t.Id != _activeTabId).ToList();
        foreach (var tab in tabsToClose)
        {
            CloseTab(tab.Id);
        }
    }

    private void CloseTabsToRight_Click(object sender, RoutedEventArgs e)
    {
        if (_activeTabId == null) return;

        var activeIndex = Tabs.ToList().FindIndex(t => t.Id == _activeTabId);
        var tabsToClose = Tabs.Skip(activeIndex + 1).ToList();

        foreach (var tab in tabsToClose)
        {
            CloseTab(tab.Id);
        }
    }

    private void ReopenClosedTab_Click(object sender, RoutedEventArgs e)
    {
        ReopenClosedTab();
    }

    #endregion

    #region Tab Manager Events

    private void OnTabCreated(object? sender, TabState tab) { }
    private void OnTabClosed(object? sender, string tabId) { }
    private void OnTabUpdated(object? sender, TabState tab) { }
    private void OnActiveTabChanged(object? sender, string? tabId) { }

    #endregion

    #region WebView Message Bridge

    private async void OnWebMessageReceived(string tabId, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = e.WebMessageAsJson;
            System.Diagnostics.Debug.WriteLine($"[Bridge] Received message: {json}");
            if (string.IsNullOrEmpty(json)) return;

            var message = System.Text.Json.JsonDocument.Parse(json);
            var root = message.RootElement;

            var channel = root.TryGetProperty("channel", out var channelProp) ? channelProp.GetString() : null;
            var id = root.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
            var args = root.TryGetProperty("args", out var argsProp) ? argsProp : default;

            System.Diagnostics.Debug.WriteLine($"[Bridge] Channel: {channel}, Id: {id}, TabId: {tabId}");

            if (string.IsNullOrEmpty(channel)) return;

            object? result = null;
            string? error = null;

            try
            {
                result = await HandleBridgeMessage(channel, args, tabId);
                System.Diagnostics.Debug.WriteLine($"[Bridge] Result type: {result?.GetType().Name ?? "null"}");
            }
            catch (Exception ex)
            {
                error = ex.Message;
                System.Diagnostics.Debug.WriteLine($"[Bridge] Error: {error}");
            }

            // Send response if there was an id
            if (!string.IsNullOrEmpty(id))
            {
                if (_webViews.TryGetValue(tabId, out var webView))
                {
                    var response = System.Text.Json.JsonSerializer.Serialize(new { id, result, error });
                    var script = $"window.dispatchEvent(new CustomEvent('jubilee-response', {{ detail: {response} }}));";
                    System.Diagnostics.Debug.WriteLine($"[Bridge] Sending response: {response.Substring(0, Math.Min(200, response.Length))}...");
                    await webView.CoreWebView2.ExecuteScriptAsync(script);
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[Bridge] WebView not found for tabId: {tabId}. Available tabs: {string.Join(", ", _webViews.Keys)}");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error handling web message: {ex.Message}\n{ex.StackTrace}");
        }
    }

    private async Task<object?> HandleBridgeMessage(string channel, System.Text.Json.JsonElement args, string tabId)
    {
        switch (channel)
        {
            case "settings:getAll":
                return GetAllSettings();

            case "settings:update":
                {
                    var path = args.TryGetProperty("path", out var pathProp) ? pathProp.GetString() : null;
                    var value = args.TryGetProperty("value", out var valueProp) ? valueProp : default;
                    if (!string.IsNullOrEmpty(path))
                    {
                        await UpdateSettingAsync(path, value);
                    }
                    return new { success = true };
                }

            case "settings:reset":
                await _settingsManager.ResetAsync();
                return new { success = true };

            case "profile:getInfo":
                return GetProfileInfo();

            case "sync:getPreferences":
                return GetSyncPreferences();

            case "account:manage":
                await Dispatcher.InvokeAsync(() => ShowAccountManagementWindowAsync());
                return null;

            case "auth:signIn":
                await Dispatcher.InvokeAsync(() => ShowJubileeVerseSignInDialog());
                return null;

            case "auth:signOut":
                await Dispatcher.InvokeAsync(async () =>
                {
                    // Immediately stop sync and sign out
                    _syncEngine.StopSyncTimer();
                    await _profileAuthService.SignOutAsync();

                    // Update all UI immediately (WPF + settings page)
                    UpdateSettingsPageAuthState(false);
                });
                return null;

            case "privacy:clearData":
                // TODO: Implement clear browsing data
                return new { success = true };

            case "nav:go":
                {
                    var url = args.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null;
                    if (!string.IsNullOrEmpty(url))
                    {
                        await Dispatcher.InvokeAsync(() => NavigateTo(url));
                    }
                    return null;
                }

            case "history:getAll":
                return GetAllHistory();

            case "history:delete":
                {
                    var ids = new List<string>();
                    if (args.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var item in idsProp.EnumerateArray())
                        {
                            var id = item.GetString();
                            if (!string.IsNullOrEmpty(id))
                            {
                                ids.Add(id);
                            }
                        }
                    }
                    await DeleteHistoryItemsAsync(ids);
                    return new { success = true };
                }

            case "history:clearAll":
                await _historyManager.ClearAsync();
                return new { success = true };

            default:
                return null;
        }
    }

    private object GetAllHistory()
    {
        var entries = _historyManager.GetEntries(null, 1000);
        return entries.Select(e => new
        {
            id = e.Id,
            url = e.Url,
            title = e.Title,
            timestamp = e.Timestamp,
            favicon = e.Favicon,
            mode = (int)e.Mode
        }).ToList();
    }

    private async Task DeleteHistoryItemsAsync(List<string> ids)
    {
        foreach (var id in ids)
        {
            await _historyManager.RemoveEntryAsync(id);
        }
    }

    private object GetAllSettings()
    {
        var s = _settingsManager.Settings;
        return new
        {
            defaultMode = (int)s.DefaultMode,
            homepage = new
            {
                internet = s.Homepage.Internet,
                jubileeBibles = s.Homepage.JubileeBibles
            },
            appearance = new
            {
                theme = s.Appearance.Theme,
                fontSize = s.Appearance.FontSize,
                zoomLevel = s.Appearance.ZoomLevel,
                showBookmarksBar = s.Appearance.ShowBookmarksBar
            },
            search = new
            {
                defaultEngine = s.Search.DefaultEngine,
                suggestionsEnabled = s.Search.SuggestionsEnabled
            },
            privacy = new
            {
                clearOnExit = s.Privacy.ClearOnExit,
                doNotTrack = s.Privacy.DoNotTrack,
                trackingProtection = s.Privacy.TrackingProtection,
                safeBrowsing = s.Privacy.SafeBrowsing
            },
            permissions = new
            {
                camera = s.Permissions.Camera,
                microphone = s.Permissions.Microphone,
                location = s.Permissions.Location,
                notifications = s.Permissions.Notifications,
                popups = s.Permissions.Popups
            },
            startup = new
            {
                internet = s.Startup.Internet,
                jubileeBibles = s.Startup.JubileeBibles
            },
            advanced = new
            {
                downloadPath = s.Advanced.DownloadPath,
                askDownloadLocation = s.Advanced.AskDownloadLocation,
                hardwareAcceleration = s.Advanced.HardwareAcceleration,
                spellcheck = s.Advanced.Spellcheck
            }
        };
    }

    private async Task UpdateSettingAsync(string path, System.Text.Json.JsonElement value)
    {
        await _settingsManager.UpdateAsync(s =>
        {
            switch (path)
            {
                // Homepage
                case "homepage.internet":
                    s.Homepage.Internet = value.GetString() ?? s.Homepage.Internet;
                    break;
                case "homepage.jubileeBibles":
                    s.Homepage.JubileeBibles = value.GetString() ?? s.Homepage.JubileeBibles;
                    break;

                // Default mode
                case "defaultMode":
                    s.DefaultMode = value.GetBoolean() ? BrowserMode.JubileeBibles : BrowserMode.Internet;
                    break;

                // Appearance
                case "appearance.theme":
                    var themeValue = value.GetString() ?? s.Appearance.Theme;
                    s.Appearance.Theme = themeValue;
                    // Apply theme immediately to WPF UI
                    _themeManager.SetTheme(themeValue);
                    // Broadcast theme to all open WebViews
                    BroadcastThemeToWebViews(themeValue);
                    break;
                case "appearance.fontSize":
                    if (int.TryParse(value.GetString(), out var fontSize))
                    {
                        s.Appearance.FontSize = fontSize;
                        // Apply font size immediately to all WebViews
                        ApplyFontSizeToAllWebViews(fontSize);
                    }
                    break;
                case "appearance.showBookmarksBar":
                    s.Appearance.ShowBookmarksBar = value.GetBoolean();
                    SetBookmarksBarVisible(s.Appearance.ShowBookmarksBar);
                    break;

                // Search
                case "search.defaultEngine":
                    s.Search.DefaultEngine = value.GetString() ?? s.Search.DefaultEngine;
                    break;
                case "search.suggestionsEnabled":
                    s.Search.SuggestionsEnabled = value.GetBoolean();
                    break;

                // Privacy
                case "privacy.trackingProtection":
                    s.Privacy.TrackingProtection = value.GetBoolean();
                    ApplyPrivacySettingsToAllWebViews();
                    break;
                case "privacy.doNotTrack":
                    s.Privacy.DoNotTrack = value.GetBoolean();
                    // Note: DNT header changes require browser restart to take effect for existing tabs
                    // New tabs will use the updated setting
                    break;
                case "privacy.clearOnExit":
                    s.Privacy.ClearOnExit = value.GetBoolean();
                    break;

                // Downloads
                case "advanced.downloadPath":
                    s.Advanced.DownloadPath = value.GetString() ?? s.Advanced.DownloadPath;
                    break;
                case "advanced.askDownloadLocation":
                    s.Advanced.AskDownloadLocation = value.GetBoolean();
                    break;

                // Advanced
                case "advanced.hardwareAcceleration":
                    s.Advanced.HardwareAcceleration = value.GetBoolean();
                    // Note: Hardware acceleration changes require browser restart to take effect
                    break;
                case "advanced.spellcheck":
                    s.Advanced.Spellcheck = value.GetBoolean();
                    ApplySystemSettingsToAllWebViews();
                    break;
                case "resetSettings":
                    // Handle reset settings request
                    _ = ResetSettingsAsync();
                    break;

                // Permissions
                case "permissions.camera":
                    s.Permissions.Camera = value.GetString() ?? s.Permissions.Camera;
                    break;
                case "permissions.microphone":
                    s.Permissions.Microphone = value.GetString() ?? s.Permissions.Microphone;
                    break;
                case "permissions.location":
                    s.Permissions.Location = value.GetString() ?? s.Permissions.Location;
                    break;
                case "permissions.notifications":
                    s.Permissions.Notifications = value.GetString() ?? s.Permissions.Notifications;
                    break;
                case "permissions.popups":
                    s.Permissions.Popups = value.GetString() ?? s.Permissions.Popups;
                    break;

                // Startup
                case "startup.internet":
                    s.Startup.Internet = value.GetString() ?? s.Startup.Internet;
                    break;
                case "startup.jubileeBibles":
                    s.Startup.JubileeBibles = value.GetString() ?? s.Startup.JubileeBibles;
                    break;

                // Sync preferences
                case "sync.bookmarks":
                case "sync.history":
                case "sync.passwords":
                case "sync.settings":
                    _ = UpdateSyncPreferenceAsync(path, value.GetBoolean());
                    break;
            }
        });
    }

    private async Task UpdateSyncPreferenceAsync(string path, bool value)
    {
        var prefs = _syncEngine.Preferences;
        switch (path)
        {
            case "sync.bookmarks":
                prefs.SyncBookmarks = value;
                break;
            case "sync.history":
                prefs.SyncHistory = value;
                break;
            case "sync.passwords":
                prefs.SyncPasswords = value;
                break;
            case "sync.settings":
                prefs.SyncSettings = value;
                break;
        }
        await _syncEngine.UpdatePreferencesAsync(prefs);
    }

    #region Theme Management

    /// <summary>
    /// Handles theme changes from the ThemeManager.
    /// </summary>
    private void OnThemeChanged(object? sender, ThemeChangedEventArgs e)
    {
        // Theme has been applied to WPF resources by ThemeManager
        // Broadcast the change to all WebViews so they can update their CSS
        Dispatcher.Invoke(() =>
        {
            BroadcastThemeToWebViews(e.Theme);
        });
    }

    /// <summary>
    /// Broadcasts theme changes to all open WebView2 instances.
    /// </summary>
    private void BroadcastThemeToWebViews(string theme)
    {
        foreach (var webView in _webViews.Values)
        {
            if (webView?.CoreWebView2 != null)
            {
                try
                {
                    var currentUrl = webView.CoreWebView2.Source;
                    // Only apply to internal pages (settings, etc.)
                    if (currentUrl?.StartsWith("jubilee://") == true)
                    {
                        var script = $"if (typeof window.setTheme === 'function') {{ window.setTheme('{theme}'); }}";
                        _ = webView.CoreWebView2.ExecuteScriptAsync(script);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Failed to broadcast theme to WebView: {ex.Message}");
                }
            }
        }
    }

    /// <summary>
    /// Applies the saved theme and appearance settings on startup.
    /// </summary>
    private void ApplySavedTheme()
    {
        var appearance = _settingsManager.Settings?.Appearance;

        // Apply theme
        var theme = appearance?.Theme ?? "dark";
        _themeManager.SetTheme(theme);

        // Apply bookmarks bar visibility
        var showBookmarksBar = appearance?.ShowBookmarksBar ?? false;
        SetBookmarksBarVisible(showBookmarksBar);

        // Font size will be applied when WebViews are created
        // Store it for later use
        _currentFontSize = appearance?.FontSize ?? 16;
    }

    private int _currentFontSize = 16;

    /// <summary>
    /// Converts font size setting (12, 14, 16, 18, 20) to WebView2 zoom factor.
    /// Base font size is 16 (100% zoom / 1.0 factor).
    /// </summary>
    private double GetZoomFactorFromFontSize(int fontSize)
    {
        // Map font sizes to zoom factors
        // 12 = Very small (75%), 14 = Small (87.5%), 16 = Medium (100%), 18 = Large (112.5%), 20 = Very large (125%)
        return fontSize switch
        {
            12 => 0.75,
            14 => 0.875,
            16 => 1.0,
            18 => 1.125,
            20 => 1.25,
            _ => 1.0
        };
    }

    /// <summary>
    /// Applies font size (as zoom factor) to all open WebView2 instances.
    /// </summary>
    private void ApplyFontSizeToAllWebViews(int fontSize)
    {
        _currentFontSize = fontSize;
        var zoomFactor = GetZoomFactorFromFontSize(fontSize);

        foreach (var webView in _webViews.Values)
        {
            if (webView?.CoreWebView2 != null)
            {
                try
                {
                    webView.ZoomFactor = zoomFactor;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Failed to apply font size to WebView: {ex.Message}");
                }
            }
        }
    }

    /// <summary>
    /// Applies the current font size setting to a specific WebView.
    /// Called when a new WebView is created.
    /// </summary>
    private void ApplyFontSizeToWebView(Microsoft.Web.WebView2.Wpf.WebView2 webView)
    {
        if (webView != null)
        {
            var zoomFactor = GetZoomFactorFromFontSize(_currentFontSize);
            webView.ZoomFactor = zoomFactor;
        }
    }

    #endregion

    #region System Settings

    /// <summary>
    /// Applies system settings to a WebView.
    /// Note: Spell check in WebView2 is controlled at the profile level and may require
    /// specific WebView2 versions. Hardware acceleration requires restart.
    /// </summary>
    private void ApplySystemSettings(Microsoft.Web.WebView2.Wpf.WebView2 webView)
    {
        if (webView?.CoreWebView2 == null) return;

        try
        {
            // Note: WebView2's spell check is controlled at a different level
            // For now, we just log that settings were applied
            var advancedSettings = _settingsManager.Settings.Advanced;
            System.Diagnostics.Debug.WriteLine($"System settings applied - Spellcheck: {advancedSettings.Spellcheck}, HW Accel: {advancedSettings.HardwareAcceleration}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to apply system settings: {ex.Message}");
        }
    }

    /// <summary>
    /// Applies system settings to all existing WebViews.
    /// Called when system settings are changed.
    /// </summary>
    private void ApplySystemSettingsToAllWebViews()
    {
        foreach (var webView in _webViews.Values)
        {
            ApplySystemSettings(webView);
        }
    }

    /// <summary>
    /// Resets all settings to their default values.
    /// </summary>
    private async Task ResetSettingsAsync()
    {
        try
        {
            // Create new default settings
            var defaultSettings = new BrowserSettings();

            // Update settings file with defaults
            await _settingsManager.UpdateAsync(s =>
            {
                s.Homepage = defaultSettings.Homepage;
                s.Autofill = defaultSettings.Autofill;
                s.Privacy = defaultSettings.Privacy;
                s.Permissions = defaultSettings.Permissions;
                s.Appearance = defaultSettings.Appearance;
                s.Search = defaultSettings.Search;
                s.Startup = defaultSettings.Startup;
                s.Advanced = defaultSettings.Advanced;
            });

            // Apply the reset settings to the UI
            ApplySystemSettingsToAllWebViews();
            ApplyPrivacySettingsToAllWebViews();
            ApplyFontSizeToAllWebViews(defaultSettings.Appearance.FontSize);

            // Reset theme
            _themeManager.SetTheme(defaultSettings.Appearance.Theme);

            // Reset bookmarks bar visibility
            SetBookmarksBarVisible(defaultSettings.Appearance.ShowBookmarksBar);

            System.Diagnostics.Debug.WriteLine("Settings have been reset to defaults.");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to reset settings: {ex.Message}");
        }
    }

    #endregion

    #region Privacy Settings

    /// <summary>
    /// Applies privacy settings (tracking prevention, DNT) to a WebView.
    /// </summary>
    private void ApplyPrivacySettings(Microsoft.Web.WebView2.Wpf.WebView2 webView)
    {
        if (webView?.CoreWebView2 == null) return;

        try
        {
            var privacySettings = _settingsManager.Settings.Privacy;

            // Apply Tracking Prevention Level to the profile
            var profile = webView.CoreWebView2.Profile;
            profile.PreferredTrackingPreventionLevel = privacySettings.TrackingProtection
                ? CoreWebView2TrackingPreventionLevel.Balanced
                : CoreWebView2TrackingPreventionLevel.None;

            System.Diagnostics.Debug.WriteLine($"Tracking Prevention set to: {profile.PreferredTrackingPreventionLevel}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to apply privacy settings: {ex.Message}");
        }
    }

    /// <summary>
    /// Applies privacy settings to all existing WebViews.
    /// Called when privacy settings are changed.
    /// </summary>
    private void ApplyPrivacySettingsToAllWebViews()
    {
        foreach (var webView in _webViews.Values)
        {
            ApplyPrivacySettings(webView);
        }
    }

    /// <summary>
    /// Sets up the Do Not Track header for a WebView.
    /// Adds DNT: 1 header to all requests if the setting is enabled.
    /// </summary>
    private void SetupDoNotTrackHeader(Microsoft.Web.WebView2.Wpf.WebView2 webView)
    {
        if (webView?.CoreWebView2 == null) return;

        try
        {
            var privacySettings = _settingsManager.Settings.Privacy;

            if (privacySettings.DoNotTrack)
            {
                // Add filter for all web resources
                webView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
                webView.CoreWebView2.WebResourceRequested += OnWebResourceRequested_AddDNTHeader;
                System.Diagnostics.Debug.WriteLine("Do Not Track header enabled for WebView");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to setup DNT header: {ex.Message}");
        }
    }

    /// <summary>
    /// Handles WebResourceRequested to add the DNT header to all requests.
    /// </summary>
    private void OnWebResourceRequested_AddDNTHeader(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        try
        {
            // Add the Do Not Track header (DNT: 1)
            e.Request.Headers.SetHeader("DNT", "1");
            // Also add Sec-GPC header for Global Privacy Control
            e.Request.Headers.SetHeader("Sec-GPC", "1");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to add DNT header: {ex.Message}");
        }
    }

    /// <summary>
    /// Clears browsing data for all profiles.
    /// Called on exit if clearOnExit setting is enabled.
    /// </summary>
    private async Task ClearBrowsingDataOnExitAsync()
    {
        try
        {
            var dataKinds = CoreWebView2BrowsingDataKinds.BrowsingHistory |
                           CoreWebView2BrowsingDataKinds.CacheStorage |
                           CoreWebView2BrowsingDataKinds.Cookies |
                           CoreWebView2BrowsingDataKinds.DownloadHistory |
                           CoreWebView2BrowsingDataKinds.LocalStorage |
                           CoreWebView2BrowsingDataKinds.IndexedDb;

            foreach (var webView in _webViews.Values)
            {
                if (webView?.CoreWebView2?.Profile != null)
                {
                    await webView.CoreWebView2.Profile.ClearBrowsingDataAsync(dataKinds);
                }
            }

            System.Diagnostics.Debug.WriteLine("Browsing data cleared on exit.");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to clear browsing data on exit: {ex.Message}");
        }
    }

    #endregion

    private object GetProfileInfo()
    {
        var profile = _profileAuthService.CurrentProfile;
        var isSignedIn = _profileAuthService.IsSignedIn;

        return new
        {
            isSignedIn,
            email = profile?.Email ?? "",
            displayName = profile?.DisplayName ?? "",
            userId = profile?.UserId ?? "",
            syncStatus = _syncEngine.Status.ToString().ToLower(),
            lastSyncTime = _syncEngine.LastSyncTime?.ToString("g")
        };
    }

    private object GetSyncPreferences()
    {
        var prefs = _syncEngine.Preferences;
        return new
        {
            syncBookmarks = prefs.SyncBookmarks,
            syncHistory = prefs.SyncHistory,
            syncPasswords = prefs.SyncPasswords,
            syncAutofill = prefs.SyncAutofill,
            syncExtensions = prefs.SyncExtensions,
            syncThemes = prefs.SyncThemes,
            syncSettings = prefs.SyncSettings
        };
    }

    #endregion

    #region Session Management

    private void SaveSessionState(bool flushImmediately = false)
    {
        // Get window bounds - use restore bounds if maximized/minimized to save the "normal" position
        var bounds = (WindowState == WindowState.Normal && !_isFullScreen)
            ? new WindowBounds { X = Left, Y = Top, Width = Width, Height = Height }
            : new WindowBounds { X = _restoreBounds.X, Y = _restoreBounds.Y, Width = _restoreBounds.Width, Height = _restoreBounds.Height };

        // Ensure we have valid bounds
        if (bounds.Width <= 0 || bounds.Height <= 0)
        {
            bounds = new WindowBounds { X = 100, Y = 100, Width = 1280, Height = 800 };
        }

        var state = new SessionState
        {
            WindowBounds = bounds,
            IsMaximized = WindowState == WindowState.Maximized && !_isFullScreen,
            IsMinimized = WindowState == WindowState.Minimized,
            LastMonitor = GetCurrentMonitor(),
            CurrentMode = _currentMode,
            ActiveTabId = _activeTabId,
            HasSavedState = true,
            Tabs = Tabs.Select(t => new SessionTabState
            {
                Id = t.Id,
                Url = t.Url,
                Title = t.Title,
                Mode = t.Mode,
                IsActive = t.Id == _activeTabId
            }).ToList()
        };

        if (flushImmediately)
        {
            // Use synchronous save to avoid async deadlock during shutdown
            _sessionStateManager.SaveImmediateSync(state);
        }
        else
        {
            _ = _sessionStateManager.SaveAsync(state);
        }
    }

    #endregion

    #region Search Suggestions

    private CancellationTokenSource? _suggestionsCts;
    private readonly HttpClient _suggestionsHttpClient = new();
    private bool _isSelectingSuggestion;

    private async void AddressBar_TextChanged(object sender, TextChangedEventArgs e)
    {
        // Cancel any pending suggestion requests
        _suggestionsCts?.Cancel();

        var text = AddressBar.Text?.Trim();

        // Don't show suggestions if disabled, empty, or looks like a URL
        if (!(_settingsManager.Settings?.Search?.SuggestionsEnabled ?? true) ||
            string.IsNullOrWhiteSpace(text) ||
            text.Length < 2 ||
            text.Contains("://") ||
            (text.Contains('.') && !text.Contains(' ')))
        {
            SuggestionsPopup.IsOpen = false;
            return;
        }

        // Debounce - wait a bit before fetching
        _suggestionsCts = new CancellationTokenSource();
        var token = _suggestionsCts.Token;

        try
        {
            await Task.Delay(250, token);

            if (token.IsCancellationRequested) return;

            var suggestions = await FetchSearchSuggestionsAsync(text, token);

            if (token.IsCancellationRequested) return;

            if (suggestions.Count > 0)
            {
                SuggestionsList.ItemsSource = suggestions;
                SuggestionsPopup.IsOpen = true;
            }
            else
            {
                SuggestionsPopup.IsOpen = false;
            }
        }
        catch (OperationCanceledException)
        {
            // Expected when typing quickly
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error fetching suggestions: {ex.Message}");
            SuggestionsPopup.IsOpen = false;
        }
    }

    private async Task<List<string>> FetchSearchSuggestionsAsync(string query, CancellationToken token)
    {
        var suggestions = new List<string>();
        var encodedQuery = Uri.EscapeDataString(query);

        try
        {
            var defaultEngine = _settingsManager.Settings?.Search?.DefaultEngine ?? "google";

            // Use appropriate suggestion API based on search engine
            string url;
            if (defaultEngine == "bing")
            {
                // Bing Autosuggest API (public endpoint)
                url = $"https://api.bing.com/osjson.aspx?query={encodedQuery}";
            }
            else
            {
                // Google Suggest API (public endpoint)
                url = $"https://suggestqueries.google.com/complete/search?client=firefox&q={encodedQuery}";
            }

            var response = await _suggestionsHttpClient.GetStringAsync(url, token);

            // Parse JSON response - format is ["query", ["suggestion1", "suggestion2", ...]]
            if (!string.IsNullOrEmpty(response))
            {
                var json = System.Text.Json.JsonDocument.Parse(response);
                var root = json.RootElement;

                if (root.ValueKind == System.Text.Json.JsonValueKind.Array && root.GetArrayLength() > 1)
                {
                    var suggestionsArray = root[1];
                    foreach (var item in suggestionsArray.EnumerateArray())
                    {
                        var suggestion = item.GetString();
                        if (!string.IsNullOrEmpty(suggestion))
                        {
                            suggestions.Add(suggestion);
                            if (suggestions.Count >= 8) break; // Limit to 8 suggestions
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error parsing suggestions: {ex.Message}");
        }

        return suggestions;
    }

    private void AddressBar_LostFocus(object sender, RoutedEventArgs e)
    {
        // Delay closing to allow click on suggestion
        Dispatcher.BeginInvoke(new Action(() =>
        {
            if (!SuggestionsList.IsKeyboardFocusWithin && !_isSelectingSuggestion)
            {
                SuggestionsPopup.IsOpen = false;
            }
        }), System.Windows.Threading.DispatcherPriority.Background);
    }

    private void AddressBar_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (!SuggestionsPopup.IsOpen) return;

        if (e.Key == Key.Down)
        {
            if (SuggestionsList.Items.Count > 0)
            {
                SuggestionsList.SelectedIndex = 0;
                var item = SuggestionsList.ItemContainerGenerator.ContainerFromIndex(0) as ListBoxItem;
                item?.Focus();
            }
            e.Handled = true;
        }
        else if (e.Key == Key.Escape)
        {
            SuggestionsPopup.IsOpen = false;
            e.Handled = true;
        }
    }

    private void SuggestionsList_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            SelectCurrentSuggestion();
            e.Handled = true;
        }
        else if (e.Key == Key.Escape)
        {
            SuggestionsPopup.IsOpen = false;
            AddressBar.Focus();
            e.Handled = true;
        }
        else if (e.Key == Key.Up && SuggestionsList.SelectedIndex == 0)
        {
            // Move focus back to address bar
            AddressBar.Focus();
            AddressBar.CaretIndex = AddressBar.Text?.Length ?? 0;
            SuggestionsList.SelectedIndex = -1;
            e.Handled = true;
        }
    }

    private void SuggestionsList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // Don't navigate on selection change - wait for enter or click
    }

    private void SuggestionsList_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        SelectCurrentSuggestion();
    }

    private void SelectCurrentSuggestion()
    {
        if (SuggestionsList.SelectedItem is string suggestion)
        {
            _isSelectingSuggestion = true;
            SuggestionsPopup.IsOpen = false;
            AddressBar.Text = suggestion;
            AddressBar.CaretIndex = suggestion.Length;
            NavigateTo(suggestion);
            _isSelectingSuggestion = false;
        }
    }

    #endregion

    #region Helpers

    private string EnsureValidUrl(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return "about:blank";

        // Handle special "homepage" placeholder - go to about:blank or a default page
        if (input.Equals("homepage", StringComparison.OrdinalIgnoreCase))
        {
            return "about:blank";
        }

        // Check if it's a private protocol URL (inspire://, webspace://, etc.)
        if (WWBWDnsResolver.IsPrivateProtocol(input))
        {
            // Private protocol URLs are handled by the DNS resolver, not here
            // Return as-is - the caller should use ResolveUrlAsync instead
            return input;
        }

        // Check if it's already a valid URL
        if (Uri.TryCreate(input, UriKind.Absolute, out var uri))
        {
            if (uri.Scheme == "http" || uri.Scheme == "https" || uri.Scheme == "file" || uri.Scheme == "jubilee")
            {
                return input;
            }
        }

        // Check if it looks like a domain
        if (input.Contains('.') && !input.Contains(' '))
        {
            return "https://" + input;
        }

        // Treat as search query - use the configured search engine
        return GetSearchUrl(input);
    }

    /// <summary>
    /// Gets the search URL for a query using the configured default search engine.
    /// </summary>
    private string GetSearchUrl(string query)
    {
        var encodedQuery = Uri.EscapeDataString(query);
        var defaultEngine = _settingsManager.Settings?.Search?.DefaultEngine ?? "google";

        // Get the search URL template based on the selected engine
        var searchUrl = defaultEngine.ToLowerInvariant() switch
        {
            "bing" => $"https://www.bing.com/search?q={encodedQuery}",
            "google" => $"https://www.google.com/search?q={encodedQuery}",
            _ => $"https://www.google.com/search?q={encodedQuery}" // Default to Google
        };

        return searchUrl;
    }

    private static string GetInternalPageTitle(string url)
    {
        try
        {
            var uri = new Uri(url);
            var pageName = uri.Host.ToLowerInvariant();
            return pageName switch
            {
                "settings" => "Settings - Jubilee Browser",
                "about" => "About - Jubilee Browser",
                "downloads" => "Downloads - Jubilee Browser",
                "extensions" => "Extensions - Jubilee Browser",
                "history" => "History - Jubilee Browser",
                "bookmarks" => "Bookmarks - Jubilee Browser",
                "welcome" => "Welcome - Jubilee Browser",
                "blocked" => "Blocked - Jubilee Browser",
                "error" => "Error - Jubilee Browser",
                "newtab" => "New Tab - Jubilee Browser",
                _ => $"{char.ToUpper(pageName[0])}{pageName.Substring(1)} - Jubilee Browser"
            };
        }
        catch
        {
            return "Jubilee Browser";
        }
    }

    #endregion

    #region Tab Context Menu Handlers

    /// <summary>
    /// Gets the tab that the context menu was opened on.
    /// </summary>
    private TabState? GetContextMenuTab(object sender)
    {
        if (sender is MenuItem menuItem)
        {
            // Walk up the visual tree to find the ListBoxItem
            var contextMenu = menuItem.Parent as ContextMenu;
            while (contextMenu == null && menuItem.Parent is MenuItem parentMenuItem)
            {
                menuItem = parentMenuItem;
                contextMenu = menuItem.Parent as ContextMenu;
            }

            if (contextMenu?.PlacementTarget is ListBoxItem listBoxItem)
            {
                return listBoxItem.DataContext as TabState;
            }
        }
        return null;
    }

    private void ContextMenu_NewTab_Click(object sender, RoutedEventArgs e)
    {
        _ = CreateTabAsync(GetHomepage());
    }

    private void ContextMenu_NewWindow_Click(object sender, RoutedEventArgs e)
    {
        // Create a new browser window with WWW (Internet) mode - blue tab
        var newWindow = new MainWindow(BrowserMode.Internet);
        newWindow.Show();
        newWindow.Activate();
    }

    private void ContextMenu_NewWWBWWindow_Click(object sender, RoutedEventArgs e)
    {
        // Create a new browser window in WWBW (JubileeBibles) mode - yellow tab
        var newWindow = new MainWindow(BrowserMode.JubileeBibles);
        newWindow.Show();
        newWindow.Activate();
    }

    private void ContextMenu_AddTabToRight_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        var currentIndex = Tabs.IndexOf(tab);
        var newTab = new TabState
        {
            Title = "New Tab",
            Url = "",
            Mode = _currentMode
        };

        // Insert after current tab
        if (currentIndex >= 0 && currentIndex < Tabs.Count - 1)
        {
            Tabs.Insert(currentIndex + 1, newTab);
        }
        else
        {
            Tabs.Add(newTab);
        }

        SwitchToTab(newTab.Id);
    }

    private void ContextMenu_AddTabToNewGroup_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        // Create a new group
        var colors = Enum.GetValues<TabGroupColor>();
        var randomColor = colors[new Random().Next(colors.Length)];

        var newGroup = new TabGroup
        {
            Name = "New Group",
            Color = randomColor
        };

        newGroup.TabIds.Add(tab.Id);
        _tabGroups.Add(newGroup);
        tab.GroupId = newGroup.Id;

        // Refresh the UI to show the group
        TabStrip.Items.Refresh();

        // TODO: Show group name edit dialog
        System.Diagnostics.Debug.WriteLine($"Tab '{tab.Title}' added to new group '{newGroup.Name}'");
    }

    private void ContextMenu_Refresh_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        if (_webViews.TryGetValue(tab.Id, out var webView))
        {
            webView.Reload();
        }
    }

    private async void ContextMenu_DuplicateTab_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        // Create a new tab with the same URL
        await CreateTabAsync(tab.Url, tab.Mode);
    }

    private void ContextMenu_MoveTabToNewWindow_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null || Tabs.Count <= 1) return;

        // Store tab info before removing
        var url = tab.Url;
        var mode = tab.Mode;

        // Close tab in current window
        CloseTab(tab.Id);

        // Create new window with the tab
        var newWindow = new MainWindow();
        newWindow.Show();

        // Navigate the new window to the same URL after it's loaded
        newWindow.Dispatcher.BeginInvoke(new Action(async () =>
        {
            if (!string.IsNullOrEmpty(url))
            {
                await newWindow.CreateTabAsync(url, mode);
            }
        }), System.Windows.Threading.DispatcherPriority.Loaded);
    }

    private void ContextMenu_PinTab_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        tab.IsPinned = !tab.IsPinned;

        // Update menu item text
        if (sender is MenuItem menuItem)
        {
            var contextMenu = FindParentContextMenu(menuItem);
            if (contextMenu != null)
            {
                var pinMenuItem = contextMenu.Items.OfType<MenuItem>()
                    .FirstOrDefault(m => m.Name == "PinTabMenuItem");
                if (pinMenuItem != null)
                {
                    pinMenuItem.Header = tab.IsPinned ? "Unpin tab" : "Pin tab";
                }
            }
        }

        // Reorder tabs - pinned tabs go to the beginning
        if (tab.IsPinned)
        {
            var pinnedCount = Tabs.Count(t => t.IsPinned && t.Id != tab.Id);
            Tabs.Remove(tab);
            Tabs.Insert(pinnedCount, tab);
        }

        TabStrip.Items.Refresh();
    }

    private void ContextMenu_MuteTab_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        tab.IsMuted = !tab.IsMuted;

        // Apply mute to WebView
        if (_webViews.TryGetValue(tab.Id, out var webView))
        {
            webView.CoreWebView2?.ExecuteScriptAsync(
                tab.IsMuted
                    ? "document.querySelectorAll('video, audio').forEach(m => m.muted = true);"
                    : "document.querySelectorAll('video, audio').forEach(m => m.muted = false);");
        }

        TabStrip.Items.Refresh();
    }

    private void ContextMenu_SendTabToDevice_Click(object sender, RoutedEventArgs e)
    {
        // Placeholder for device sync functionality
        MessageBox.Show("Device sync is not yet implemented. This feature will allow you to send tabs to your other devices.",
            "Send Tab", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void ContextMenu_CloseTab_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        CloseTab(tab.Id);
    }

    private void ContextMenu_CloseOtherTabs_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        var tabsToClose = Tabs.Where(t => t.Id != tab.Id && !t.IsPinned).ToList();
        foreach (var t in tabsToClose)
        {
            CloseTab(t.Id);
        }
    }

    private void ContextMenu_CloseTabsToRight_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender);
        if (tab == null) return;

        var tabIndex = Tabs.IndexOf(tab);
        var tabsToClose = Tabs.Skip(tabIndex + 1).Where(t => !t.IsPinned).ToList();
        foreach (var t in tabsToClose)
        {
            CloseTab(t.Id);
        }
    }

    private async void ContextMenu_ReopenClosedTab_Click(object sender, RoutedEventArgs e)
    {
        // First try the RecentlyClosedTabsManager
        var closedTab = _recentlyClosedTabsManager.PopClosedTab();
        if (closedTab != null)
        {
            // Restore the tab with its properties
            var newTab = await CreateTabAsync(closedTab.Url, closedTab.Mode);
            newTab.Title = closedTab.Title;
            newTab.Favicon = closedTab.Favicon;
            newTab.GroupId = closedTab.GroupId;
            newTab.IsPinned = closedTab.WasPinned;
            return;
        }

        // Fall back to legacy TabManager
        var legacyTab = _tabManager.PopClosedTab();
        if (legacyTab != null)
        {
            await CreateTabAsync(legacyTab.Url, legacyTab.Mode);
        }
    }

    private void ContextMenu_ToggleVerticalTabs_Click(object sender, RoutedEventArgs e)
    {
        _isVerticalTabsEnabled = !_isVerticalTabsEnabled;

        // Update menu item text
        if (sender is MenuItem menuItem)
        {
            menuItem.Header = _isVerticalTabsEnabled ? "Turn off vertical tabs" : "Turn on vertical tabs";
        }

        // TODO: Implement vertical tabs layout change
        // This would require significant XAML restructuring
        MessageBox.Show(
            _isVerticalTabsEnabled
                ? "Vertical tabs layout is not yet fully implemented. The UI would dock the tab bar to the left side of the window."
                : "Returning to horizontal tabs layout.",
            "Vertical Tabs", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void ContextMenu_Extensions_Click(object sender, RoutedEventArgs e)
    {
        // Placeholder for extensions manager
        MessageBox.Show("Extensions manager is not yet implemented.",
            "Extensions", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void ContextMenu_TaskManager_Click(object sender, RoutedEventArgs e)
    {
        // Show a simple task manager with tab memory/CPU usage
        var info = new System.Text.StringBuilder();
        info.AppendLine("Browser Task Manager\n");
        info.AppendLine("Tab".PadRight(40) + "Status");
        info.AppendLine(new string('-', 60));

        foreach (var tab in Tabs)
        {
            var status = tab.IsLoading ? "Loading..." : "Active";
            info.AppendLine($"{tab.Title.Substring(0, Math.Min(38, tab.Title.Length)).PadRight(40)}{status}");
        }

        info.AppendLine($"\nTotal tabs: {Tabs.Count}");
        info.AppendLine($"WebViews: {_webViews.Count}");

        MessageBox.Show(info.ToString(), "Browser Task Manager", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void ContextMenu_DevTools_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender) ?? Tabs.FirstOrDefault(t => t.Id == _activeTabId);
        if (tab == null) return;

        if (_webViews.TryGetValue(tab.Id, out var webView))
        {
            webView.CoreWebView2?.OpenDevToolsWindow();
        }
    }

    private void ContextMenu_WebCapture_Click(object sender, RoutedEventArgs e)
    {
        var tab = GetContextMenuTab(sender) ?? Tabs.FirstOrDefault(t => t.Id == _activeTabId);
        if (tab == null) return;

        if (_webViews.TryGetValue(tab.Id, out var webView))
        {
            // Use WebView2's capture API
            CaptureWebPage(webView, tab.Title);
        }
    }

    private async void CaptureWebPage(WebView2 webView, string title)
    {
        try
        {
            using var stream = new System.IO.MemoryStream();
            await webView.CoreWebView2.CapturePreviewAsync(
                CoreWebView2CapturePreviewImageFormat.Png, stream);

            // Save to Pictures folder
            var picturesPath = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
            var fileName = $"WebCapture_{DateTime.Now:yyyyMMdd_HHmmss}.png";
            var filePath = System.IO.Path.Combine(picturesPath, fileName);

            stream.Position = 0;
            using var fileStream = System.IO.File.Create(filePath);
            await stream.CopyToAsync(fileStream);

            MessageBox.Show($"Screenshot saved to:\n{filePath}",
                "Web Capture", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to capture screenshot: {ex.Message}",
                "Web Capture Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private ContextMenu? FindParentContextMenu(MenuItem menuItem)
    {
        DependencyObject? current = menuItem;
        while (current != null)
        {
            if (current is ContextMenu contextMenu)
                return contextMenu;
            current = LogicalTreeHelper.GetParent(current);
        }
        return null;
    }

    #endregion

    #region Profile and Sync Handlers

    private void OnAuthStateChanged(object? sender, AuthenticationState state)
    {
        // Use BeginInvoke to avoid deadlock when called from within Dispatcher context
        Dispatcher.BeginInvoke(() => UpdateProfileUI());
    }

    private void OnProfileChanged(object? sender, UserProfile? profile)
    {
        // Use BeginInvoke to avoid deadlock when called from within Dispatcher context
        Dispatcher.BeginInvoke(() => UpdateProfileUI());
    }

    private void OnSyncStatusChanged(object? sender, SyncStatus status)
    {
        Dispatcher.Invoke(() => UpdateSyncStatusUI(status));
    }

    private void UpdateProfileUI()
    {
        if (_profileAuthService.IsSignedIn && _profileAuthService.CurrentProfile != null)
        {
            var profile = _profileAuthService.CurrentProfile;

            // Update nav bar profile button
            ProfileDefaultAvatar.Visibility = Visibility.Collapsed;
            ProfileDefaultIcon.Visibility = Visibility.Collapsed;
            ProfileUserAvatar.Visibility = Visibility.Visible;
            ProfileSyncIndicator.Visibility = _syncEngine.IsSyncEnabled ? Visibility.Visible : Visibility.Collapsed;

            // Set avatar image
            if (!string.IsNullOrEmpty(profile.AvatarUrl))
            {
                try
                {
                    System.Windows.Media.Imaging.BitmapImage bitmap;

                    // Check if it's a local file path or a URL
                    if (System.IO.File.Exists(profile.AvatarUrl))
                    {
                        // Local file - use file URI
                        bitmap = new System.Windows.Media.Imaging.BitmapImage();
                        bitmap.BeginInit();
                        bitmap.UriSource = new Uri(profile.AvatarUrl);
                        bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                        bitmap.EndInit();
                    }
                    else
                    {
                        // Remote URL
                        bitmap = new System.Windows.Media.Imaging.BitmapImage(new Uri(profile.AvatarUrl));
                    }

                    ProfileAvatarImage.ImageSource = bitmap;
                    ProfilePopupAvatarImage.ImageSource = bitmap;
                }
                catch
                {
                    // Use default if avatar URL fails
                    SetDefaultAvatar();
                }
            }
            else
            {
                SetDefaultAvatar();
            }

            // Update popup
            ProfileSignedOutPanel.Visibility = Visibility.Collapsed;
            ProfileSignedInPanel.Visibility = Visibility.Visible;
            ProfilePopupName.Text = profile.DisplayName;
            ProfilePopupEmail.Text = profile.Email;

            // Update Main Menu profile section
            MainMenuProfileName.Text = profile.DisplayName;
            MainMenuProfileEmail.Text = profile.Email;
            MainMenuProfileIcon.Visibility = Visibility.Collapsed;
            MainMenuProfileImageEllipse.Visibility = Visibility.Visible;
            if (ProfileAvatarImage.ImageSource != null)
            {
                MainMenuProfileImage.ImageSource = ProfileAvatarImage.ImageSource;
            }

            // Update sync status
            UpdateSyncStatusUI(_syncEngine.Status);

            // Update profile button tooltip
            ProfileButton.ToolTip = $"{profile.DisplayName}\n{profile.Email}";
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

            // Reset Main Menu profile section to signed out state
            MainMenuProfileName.Text = "Sign in";
            MainMenuProfileEmail.Text = "Sync your data across devices";
            MainMenuProfileIcon.Visibility = Visibility.Visible;
            MainMenuProfileImageEllipse.Visibility = Visibility.Collapsed;

            ProfileButton.ToolTip = "Sign in to sync your data";
        }
    }

    /// <summary>
    /// Updates the settings page auth state immediately via JavaScript injection.
    /// Call this after sign-in or sign-out to update the profile section without a page reload.
    /// </summary>
    private void UpdateSettingsPageAuthState(bool isSignedIn)
    {
        // Also update the WPF profile UI
        UpdateProfileUI();
        UpdateChatPanelAuthState();

        // Find any open settings page and update its auth state
        foreach (var kvp in _webViews)
        {
            var webView = kvp.Value;
            if (webView?.CoreWebView2 != null)
            {
                var currentUrl = webView.CoreWebView2.Source;
                if (currentUrl?.StartsWith("jubilee://settings") == true)
                {
                    try
                    {
                        // Inject JavaScript to update UI without page reload
                        var script = isSignedIn
                            ? "if (typeof updateProfileUI === 'function') { updateProfileUI({ isSignedIn: true }); }"
                            : "if (typeof updateProfileUI === 'function') { updateProfileUI({ isSignedIn: false }); }";
                        _ = webView.CoreWebView2.ExecuteScriptAsync(script);
                        System.Diagnostics.Debug.WriteLine($"Settings page auth state updated: isSignedIn={isSignedIn}");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Failed to update settings page auth state: {ex.Message}");
                    }
                }
            }
        }
    }

    private void SetDefaultAvatar()
    {
        // Create a default avatar with the user's initials background
        var profile = _profileAuthService.CurrentProfile;
        var defaultColor = Color.FromRgb(0, 120, 212); // Blue

        if (profile != null && !string.IsNullOrEmpty(profile.DisplayName))
        {
            // Generate color based on display name
            var hash = profile.DisplayName.GetHashCode();
            var colors = new[]
            {
                Color.FromRgb(0, 120, 212),   // Blue
                Color.FromRgb(107, 142, 35),  // Olive
                Color.FromRgb(220, 20, 60),   // Crimson
                Color.FromRgb(255, 140, 0),   // Orange
                Color.FromRgb(138, 43, 226),  // Purple
                Color.FromRgb(0, 139, 139),   // Teal
            };
            defaultColor = colors[Math.Abs(hash) % colors.Length];
        }

        ProfileUserAvatar.Fill = new SolidColorBrush(defaultColor);
        ProfilePopupAvatarImage.ImageSource = null;
    }

    private void UpdateSyncStatusUI(SyncStatus status)
    {
        // Colors
        var greenColor = Color.FromRgb(34, 197, 94);
        var amberColor = Color.FromRgb(245, 158, 11);
        var redColor = Color.FromRgb(239, 68, 68);
        var blueColor = Color.FromRgb(59, 130, 246);

        switch (status)
        {
            case SyncStatus.Syncing:
                // Show success state with syncing status
                ProfileSyncSuccessState.Visibility = Visibility.Visible;
                ProfileSyncActionRequiredState.Visibility = Visibility.Collapsed;
                ProfileSyncStatusBorder.Background = new SolidColorBrush(Color.FromRgb(26, 58, 26)); // Green-tinted
                ProfileSyncStatusIcon.Text = "\uE895"; // Sync icon
                ProfileSyncStatusIcon.Foreground = new SolidColorBrush(blueColor);
                ProfileSyncStatusText.Text = "Syncing...";
                ProfileSyncStatusText.Foreground = new SolidColorBrush(blueColor);
                ProfileSyncIndicator.Fill = new SolidColorBrush(blueColor);
                ProfileSignedInLabel.Foreground = new SolidColorBrush(greenColor);
                break;

            case SyncStatus.Idle:
                // Show success state
                ProfileSyncSuccessState.Visibility = Visibility.Visible;
                ProfileSyncActionRequiredState.Visibility = Visibility.Collapsed;
                ProfileSyncStatusBorder.Background = new SolidColorBrush(Color.FromRgb(26, 58, 26)); // Green-tinted
                ProfileSyncStatusIcon.Text = "\uE73E"; // Checkmark
                ProfileSyncStatusIcon.Foreground = new SolidColorBrush(greenColor);
                ProfileSyncStatusText.Foreground = new SolidColorBrush(greenColor);
                ProfileSyncIndicator.Fill = new SolidColorBrush(greenColor);
                ProfileSignedInLabel.Foreground = new SolidColorBrush(greenColor);

                var lastSync = _syncEngine.LastSyncTime;
                if (lastSync.HasValue)
                {
                    var elapsed = DateTime.UtcNow - lastSync.Value;
                    ProfileSyncStatusText.Text = "Synced";
                    ProfileSyncLastTime.Text = elapsed.TotalMinutes < 1 ? "Last synced: just now" :
                        elapsed.TotalHours < 1 ? $"Last synced: {(int)elapsed.TotalMinutes}m ago" :
                        elapsed.TotalDays < 1 ? $"Last synced: {(int)elapsed.TotalHours}h ago" :
                        $"Last synced: {lastSync.Value.ToLocalTime():MMM d}";
                }
                else
                {
                    ProfileSyncStatusText.Text = "Syncing is on";
                    ProfileSyncLastTime.Text = "Not synced yet";
                }
                break;

            case SyncStatus.Error:
            case SyncStatus.Offline:
                // Show action required state with amber warning
                ProfileSyncSuccessState.Visibility = Visibility.Collapsed;
                ProfileSyncActionRequiredState.Visibility = Visibility.Visible;
                ProfileSyncStatusBorder.Background = new SolidColorBrush(Color.FromRgb(58, 42, 26)); // Amber-tinted
                ProfileSyncIndicator.Fill = new SolidColorBrush(amberColor);
                ProfileSignedInLabel.Foreground = new SolidColorBrush(amberColor);

                // Set appropriate error message
                var errorMsg = _syncEngine.LastError;
                if (errorMsg?.Contains("Authentication") == true || errorMsg?.Contains("token") == true)
                {
                    ProfileSyncErrorText.Text = "Re-authenticate to resume syncing";
                }
                else if (status == SyncStatus.Offline)
                {
                    ProfileSyncErrorText.Text = "Check your internet connection";
                }
                else
                {
                    ProfileSyncErrorText.Text = errorMsg ?? "Unable to sync your data";
                }
                break;

            case SyncStatus.Paused:
                // Show success state but with paused status
                ProfileSyncSuccessState.Visibility = Visibility.Visible;
                ProfileSyncActionRequiredState.Visibility = Visibility.Collapsed;
                ProfileSyncStatusBorder.Background = new SolidColorBrush(Color.FromRgb(58, 52, 26)); // Yellow-tinted
                ProfileSyncStatusIcon.Text = "\uE769"; // Pause icon
                ProfileSyncStatusIcon.Foreground = new SolidColorBrush(amberColor);
                ProfileSyncStatusText.Text = "Paused";
                ProfileSyncStatusText.Foreground = new SolidColorBrush(amberColor);
                ProfileSyncLastTime.Text = "Sync is paused";
                ProfileSyncIndicator.Fill = new SolidColorBrush(amberColor);
                ProfileSignedInLabel.Foreground = new SolidColorBrush(greenColor);
                break;
        }
    }

    private void ProfileButton_Click(object sender, RoutedEventArgs e)
    {
        // Close main menu if open
        MainMenuPopup.IsOpen = false;

        // Toggle profile popup
        ProfilePopup.IsOpen = !ProfilePopup.IsOpen;

        if (ProfilePopup.IsOpen)
        {
            UpdateProfileUI();
        }
    }

    private async void ProfileSignIn_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        ShowJubileeVerseSignInDialog();
    }

    private void ShowJubileeVerseSignInDialog()
    {
        ShowJubileeVerseAuthDialog(showSignIn: true);
    }

    private void ShowJubileeVerseAuthDialog(bool showSignIn = true)
    {
        // Color definitions
        var darkBg = Color.FromRgb(38, 38, 38);           // #262626 - Main background
        var inputBg = Color.FromRgb(64, 64, 64);          // #404040 - Input field background
        var goldColor = Color.FromRgb(230, 172, 0);       // #E6AC00 - Gold/yellow accent
        var goldHover = Color.FromRgb(255, 191, 0);       // #FFBF00 - Gold hover
        var cyanGlow = Color.FromRgb(0, 191, 255);        // #00BFFF - Cyan glow for avatar

        // Full-screen overlay window that closes when clicking outside the popup
        var authDialog = new Window
        {
            Title = "JubileeInspire - Authentication",
            WindowState = WindowState.Maximized,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new SolidColorBrush(Color.FromArgb(120, 0, 0, 0)), // Semi-transparent dark overlay
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            AllowsTransparency = true
        };

        // Create a grid to center the popup content - MUST have background to receive mouse events
        var overlayGrid = new Grid
        {
            Background = Brushes.Transparent // Required for hit testing
        };

        // Clicking on the overlay (outside the popup) closes it
        overlayGrid.MouseLeftButtonDown += (s, args) =>
        {
            authDialog.Close();
        };

        // Main container with gradient background, 3px yellow border all around, rounded corners
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

        // Prevent clicks on the popup from closing it
        mainBorder.MouseLeftButtonDown += (s, args) => args.Handled = true;

        // ===== MAIN LAYOUT GRID (3 fixed rows: Header, Content, Footer) =====
        var mainLayoutGrid = new Grid { Margin = new Thickness(30, 15, 30, 20) };
        mainLayoutGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Row 0: Fixed Header
        mainLayoutGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Row 1: Scrollable Content
        mainLayoutGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Row 2: Fixed Footer

        // ===== ROW 0: FIXED HEADER (never moves) =====
        var headerPanel = new StackPanel();
        Grid.SetRow(headerPanel, 0);

        // Close button (X) - positioned absolutely at top right
        var closeButtonText = new TextBlock
        {
            Text = "✕",
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
        closeButton.PreviewMouseLeftButtonDown += (s, args) =>
        {
            args.Handled = true;
            authDialog.Close();
        };
        headerPanel.Children.Add(closeButton);

        // Jubilee logo
        var logoImage = new System.Windows.Controls.Image
        {
            Width = 70,
            Height = 70,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 8),
            Stretch = Stretch.Uniform
        };
        try
        {
            var logoUri = new Uri("pack://application:,,,/Resources/Icons/jubilee-logo.png");
            logoImage.Source = new System.Windows.Media.Imaging.BitmapImage(logoUri);
        }
        catch { }
        headerPanel.Children.Add(logoImage);

        // JubileeInspire.com title
        var titleText = new TextBlock
        {
            FontSize = 34,
            FontWeight = FontWeights.Bold,
            FontFamily = new FontFamily("Agency FB, Impact, Arial Black, sans-serif"),
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 2)
        };
        titleText.Inlines.Add(new System.Windows.Documents.Run("Jubilee") { Foreground = Brushes.White });
        titleText.Inlines.Add(new System.Windows.Documents.Run("Inspire") { Foreground = new SolidColorBrush(goldColor) });
        titleText.Inlines.Add(new System.Windows.Documents.Run(".com") { Foreground = Brushes.White });
        headerPanel.Children.Add(titleText);

        // Subtitle - moved up 5px total with negative top margin
        var subtitleText = new TextBlock
        {
            Text = "A Faith-Based AI Browser for the Worldwide Bible Web",
            FontSize = 13,
            Foreground = Brushes.White,
            HorizontalAlignment = HorizontalAlignment.Center,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, -5, 0, 15) // Moved up 5px with negative top margin
        };
        headerPanel.Children.Add(subtitleText);

        // Helper to create a gold rounded button
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

        // Helper to create an input field with placeholder
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

        // Helper to create a password field with placeholder and show/hide toggle
        (Border border, PasswordBox passwordBox, TextBox visibleTextBox) CreatePasswordInput(string placeholder, double bottomMargin = 12)
        {
            var border = new Border
            {
                Background = new SolidColorBrush(inputBg),
                BorderBrush = new SolidColorBrush(goldColor),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Margin = new Thickness(0, 0, 0, bottomMargin),
                Padding = new Thickness(15, 12, 40, 12) // Extra padding for eyeball icon
            };
            var passwordBox = new PasswordBox { Background = Brushes.Transparent, Foreground = Brushes.White, BorderThickness = new Thickness(0), FontSize = 14, CaretBrush = Brushes.White };
            var visibleTextBox = new TextBox { Background = Brushes.Transparent, Foreground = Brushes.White, BorderThickness = new Thickness(0), FontSize = 14, CaretBrush = Brushes.White, Visibility = Visibility.Collapsed };
            var placeholderText = new TextBlock { Text = placeholder, Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)), FontSize = 14, IsHitTestVisible = false, VerticalAlignment = VerticalAlignment.Center };

            // Eyeball icon for show/hide password
            var eyeIcon = new TextBlock
            {
                Text = "\uE052", // Eye icon from Segoe MDL2 Assets
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

            // Toggle password visibility on click
            eyeIcon.PreviewMouseLeftButtonDown += (s, args) =>
            {
                args.Handled = true;
                isPasswordVisible = !isPasswordVisible;
                if (isPasswordVisible)
                {
                    visibleTextBox.Text = passwordBox.Password;
                    passwordBox.Visibility = Visibility.Collapsed;
                    visibleTextBox.Visibility = Visibility.Visible;
                    eyeIcon.Text = "\uED1A"; // Eye with slash (hide)
                    eyeIcon.ToolTip = "Hide password";
                    visibleTextBox.Focus();
                    visibleTextBox.CaretIndex = visibleTextBox.Text.Length;
                }
                else
                {
                    passwordBox.Password = visibleTextBox.Text;
                    visibleTextBox.Visibility = Visibility.Collapsed;
                    passwordBox.Visibility = Visibility.Visible;
                    eyeIcon.Text = "\uE052"; // Eye (show)
                    eyeIcon.ToolTip = "Show password";
                    passwordBox.Focus();
                }
            };

            // Keyboard accessibility - toggle on Enter or Space
            eyeIcon.PreviewKeyDown += (s, args) =>
            {
                if (args.Key == Key.Enter || args.Key == Key.Space)
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
                    }
                    else
                    {
                        passwordBox.Password = visibleTextBox.Text;
                        visibleTextBox.Visibility = Visibility.Collapsed;
                        passwordBox.Visibility = Visibility.Visible;
                        eyeIcon.Text = "\uE052";
                        eyeIcon.ToolTip = "Show password";
                    }
                }
            };

            // Hover state for eyeball icon
            eyeIcon.MouseEnter += (s, args) => eyeIcon.Foreground = goldForeground;
            eyeIcon.MouseLeave += (s, args) => eyeIcon.Foreground = grayForeground;
            eyeIcon.GotFocus += (s, args) => eyeIcon.Foreground = goldForeground;
            eyeIcon.LostFocus += (s, args) => eyeIcon.Foreground = grayForeground;

            // Sync text between passwordBox and visibleTextBox
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

        // Helper to create a styled checkbox with gold border, black background, gold checkmark
        CheckBox CreateStyledCheckbox()
        {
            var checkbox = new CheckBox { VerticalAlignment = VerticalAlignment.Center };

            // Create custom template for the checkbox
            var template = new ControlTemplate(typeof(CheckBox));

            // Main border (the checkbox box)
            var borderFactory = new FrameworkElementFactory(typeof(Border), "CheckBoxBorder");
            borderFactory.SetValue(Border.WidthProperty, 18.0);
            borderFactory.SetValue(Border.HeightProperty, 18.0);
            borderFactory.SetValue(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(30, 30, 30)));
            borderFactory.SetValue(Border.BorderBrushProperty, new SolidColorBrush(goldColor));
            borderFactory.SetValue(Border.BorderThicknessProperty, new Thickness(2));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(3));

            // Checkmark (using a Path for a proper checkmark shape)
            var checkmarkFactory = new FrameworkElementFactory(typeof(System.Windows.Shapes.Path), "Checkmark");
            checkmarkFactory.SetValue(System.Windows.Shapes.Path.DataProperty, System.Windows.Media.Geometry.Parse("M 2,6 L 6,10 L 12,2"));
            checkmarkFactory.SetValue(System.Windows.Shapes.Path.StrokeProperty, new SolidColorBrush(goldColor));
            checkmarkFactory.SetValue(System.Windows.Shapes.Path.StrokeThicknessProperty, 2.5);
            checkmarkFactory.SetValue(System.Windows.Shapes.Path.VisibilityProperty, Visibility.Collapsed);
            checkmarkFactory.SetValue(System.Windows.Shapes.Path.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            checkmarkFactory.SetValue(System.Windows.Shapes.Path.VerticalAlignmentProperty, VerticalAlignment.Center);
            checkmarkFactory.SetValue(System.Windows.Shapes.Path.MarginProperty, new Thickness(1, 1, 0, 0));

            borderFactory.AppendChild(checkmarkFactory);
            template.VisualTree = borderFactory;

            // Trigger to show checkmark when checked
            var checkedTrigger = new Trigger { Property = CheckBox.IsCheckedProperty, Value = true };
            checkedTrigger.Setters.Add(new Setter(System.Windows.Shapes.Path.VisibilityProperty, Visibility.Visible, "Checkmark"));
            template.Triggers.Add(checkedTrigger);

            // Trigger to highlight border on hover
            var hoverTrigger = new Trigger { Property = CheckBox.IsMouseOverProperty, Value = true };
            hoverTrigger.Setters.Add(new Setter(Border.BorderBrushProperty, new SolidColorBrush(goldHover), "CheckBoxBorder"));
            template.Triggers.Add(hoverTrigger);

            checkbox.Template = template;
            return checkbox;
        }

        // ===== ROW 1: SCROLLABLE CONTENT AREA (only this changes between steps) =====
        var contentContainer = new Grid { VerticalAlignment = VerticalAlignment.Top };
        Grid.SetRow(contentContainer, 1);

        // ===== SIGN IN PANEL (content only - no button) =====
        var signInPanel = new StackPanel { Visibility = showSignIn ? Visibility.Visible : Visibility.Collapsed };

        // "Don't have an account? Sign Up." - right aligned with "Sign Up." as link, moved down 5px
        var signUpLinkColor = new SolidColorBrush(Color.FromRgb(180, 180, 180)); // Default gray
        var signUpLinkHoverColor = new SolidColorBrush(goldColor); // Gold hover
        var signUpTextBlock = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 5, 0, 12), // Added 5px top margin to move down
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
        signUpLink.MouseEnter += (s, args) => { signUpLink.TextDecorations = TextDecorations.Underline; };
        signUpLink.MouseLeave += (s, args) => { signUpLink.TextDecorations = null; };
        signUpTextBlock.Inlines.Add(signUpLink);
        // Click handler is set up later after ShowPanel is defined
        signInPanel.Children.Add(signUpTextBlock);

        var (signInEmailBorder, signInEmailBox) = CreateTextInput("Email Address", 12);
        signInPanel.Children.Add(signInEmailBorder);

        var (signInPasswordBorder, signInPasswordBox, _) = CreatePasswordInput("Password", 10);
        signInPanel.Children.Add(signInPasswordBorder);

        // Load saved credentials if "Keep me signed in" was previously checked
        var secureStorage = new SecureStorageService();
        _ = Task.Run(async () =>
        {
            var savedCreds = await secureStorage.RetrieveAsync<SavedSignInCredentials>("signInCredentials");
            if (savedCreds != null && savedCreds.RememberMe)
            {
                Dispatcher.Invoke(() =>
                {
                    signInEmailBox.Text = savedCreds.Email ?? "";
                    if (!string.IsNullOrEmpty(savedCreds.EncryptedPassword))
                    {
                        signInPasswordBox.Password = secureStorage.DecryptPassword(savedCreds.EncryptedPassword);
                    }
                });
            }
        });

        // Remember me checkbox and Forgot Password link on the same row
        var rememberForgotRow = new Grid();
        rememberForgotRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        rememberForgotRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var rememberPanel = new StackPanel { Orientation = Orientation.Horizontal };
        var rememberCheckbox = CreateStyledCheckbox();
        rememberCheckbox.IsChecked = true;
        rememberPanel.Children.Add(rememberCheckbox);
        rememberPanel.Children.Add(new TextBlock { Text = "Keep me signed in on this device", Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 14, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 0, 0) });
        Grid.SetColumn(rememberPanel, 0);
        rememberForgotRow.Children.Add(rememberPanel);

        var forgotPasswordLink = new TextBlock { Text = "Forgot Password?", Foreground = new SolidColorBrush(goldColor), FontSize = 12, VerticalAlignment = VerticalAlignment.Center, Cursor = Cursors.Hand };
        forgotPasswordLink.MouseEnter += (s, args) => forgotPasswordLink.TextDecorations = TextDecorations.Underline;
        forgotPasswordLink.MouseLeave += (s, args) => forgotPasswordLink.TextDecorations = null;
        Grid.SetColumn(forgotPasswordLink, 1);
        rememberForgotRow.Children.Add(forgotPasswordLink);

        signInPanel.Children.Add(rememberForgotRow);

        // ===== CREATE ACCOUNT STEP 1 (content only - no button) =====
        var createStep1Panel = new StackPanel { Visibility = Visibility.Collapsed };

        // "Already have an account? Sign In." - right aligned with "Sign In." as link
        var step1SignInLinkColor = new SolidColorBrush(Color.FromRgb(180, 180, 180));
        var step1SignInLinkHoverColor = new SolidColorBrush(goldColor);
        var step1SignInTextBlock = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 5, 0, 12), // Same 5px top margin as sign-up link
            FontSize = 13
        };
        step1SignInTextBlock.Inlines.Add(new System.Windows.Documents.Run("Already have an account? ") { Foreground = step1SignInLinkColor });
        var step1SignInLinkRun = new System.Windows.Documents.Run("Sign In.") { Foreground = step1SignInLinkHoverColor };
        var step1SignInLink = new System.Windows.Documents.Hyperlink(step1SignInLinkRun)
        {
            Foreground = step1SignInLinkHoverColor,
            TextDecorations = null,
            Focusable = true
        };
        step1SignInLink.MouseEnter += (s, args) => { step1SignInLink.TextDecorations = TextDecorations.Underline; };
        step1SignInLink.MouseLeave += (s, args) => { step1SignInLink.TextDecorations = null; };
        step1SignInTextBlock.Inlines.Add(step1SignInLink);
        // Click handler is set up later after ShowPanel is defined
        createStep1Panel.Children.Add(step1SignInTextBlock);

        var (fullNameBorder, fullNameBox) = CreateTextInput("Full Name");
        createStep1Panel.Children.Add(fullNameBorder);

        var (createEmailBorder, createEmailBox) = CreateTextInput("Email Address");
        createStep1Panel.Children.Add(createEmailBorder);

        var newsletterPanel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 0) };
        var newsletterCheckbox = CreateStyledCheckbox();
        newsletterCheckbox.IsChecked = true;
        newsletterPanel.Children.Add(newsletterCheckbox);
        newsletterPanel.Children.Add(new TextBlock { Text = "Subscribe me to the newsletter", Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 13, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 0, 0) });
        createStep1Panel.Children.Add(newsletterPanel);

        // ===== CREATE ACCOUNT STEP 2 (content only - no button) =====
        var createStep2Panel = new StackPanel { Visibility = Visibility.Collapsed };

        var step2BackLinkPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 0, 0, 12) };
        var step2BackLink = new TextBlock { Text = "← Back", Foreground = new SolidColorBrush(goldColor), FontSize = 13, Cursor = Cursors.Hand };
        step2BackLink.MouseEnter += (s, args) => step2BackLink.TextDecorations = TextDecorations.Underline;
        step2BackLink.MouseLeave += (s, args) => step2BackLink.TextDecorations = null;
        step2BackLinkPanel.Children.Add(step2BackLink);
        createStep2Panel.Children.Add(step2BackLinkPanel);

        var (createPasswordBorder, createPasswordBox, _) = CreatePasswordInput("Password");
        createStep2Panel.Children.Add(createPasswordBorder);

        var (confirmPasswordBorder, confirmPasswordBox, _) = CreatePasswordInput("Confirm Password", 10);
        createStep2Panel.Children.Add(confirmPasswordBorder);

        var termsPanel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 0) };
        var termsCheckbox = CreateStyledCheckbox();
        termsCheckbox.VerticalAlignment = VerticalAlignment.Top;
        termsCheckbox.Margin = new Thickness(0, 2, 0, 0);
        termsPanel.Children.Add(termsCheckbox);
        var termsTextBlock = new TextBlock { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 0, 0), TextWrapping = TextWrapping.Wrap };
        termsTextBlock.Inlines.Add(new System.Windows.Documents.Run("Yes, I agree to the ") { Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 13 });
        var termsOfUseLink = new System.Windows.Documents.Hyperlink(new System.Windows.Documents.Run("Terms of Use")) { Foreground = new SolidColorBrush(goldColor), TextDecorations = null };
        termsOfUseLink.Click += (s, args) => { DocumentViewerDialog.ShowTermsOfUse(this); };
        termsTextBlock.Inlines.Add(termsOfUseLink);
        termsTextBlock.Inlines.Add(new System.Windows.Documents.Run(" and ") { Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 13 });
        var privacyPolicyLink = new System.Windows.Documents.Hyperlink(new System.Windows.Documents.Run("Privacy Policy")) { Foreground = new SolidColorBrush(goldColor), TextDecorations = null };
        privacyPolicyLink.Click += (s, args) => { DocumentViewerDialog.ShowPrivacyPolicy(this); };
        termsTextBlock.Inlines.Add(privacyPolicyLink);
        termsPanel.Children.Add(termsTextBlock);
        createStep2Panel.Children.Add(termsPanel);

        // ===== CREATE ACCOUNT VERIFICATION STEP (6-digit code) =====
        var createVerifyPanel = new StackPanel { Visibility = Visibility.Collapsed };

        var verifyBackLinkPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 0, 0, 12) };
        var verifyBackLink = new TextBlock { Text = "← Back", Foreground = new SolidColorBrush(goldColor), FontSize = 13, Cursor = Cursors.Hand };
        verifyBackLink.MouseEnter += (s, args) => verifyBackLink.TextDecorations = TextDecorations.Underline;
        verifyBackLink.MouseLeave += (s, args) => verifyBackLink.TextDecorations = null;
        verifyBackLinkPanel.Children.Add(verifyBackLink);
        createVerifyPanel.Children.Add(verifyBackLinkPanel);

        var verifyInstructionText = new TextBlock
        {
            Text = "We've sent a 6-digit verification code to your email. Please enter it below to activate your account.",
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 8)
        };
        createVerifyPanel.Children.Add(verifyInstructionText);

        var verifyEmailDisplay = new TextBlock
        {
            Text = "",
            Foreground = new SolidColorBrush(goldColor),
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 15)
        };
        createVerifyPanel.Children.Add(verifyEmailDisplay);

        // Create 6 verification code input boxes for sign-up
        var verifyCodeBoxesPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 8) };
        var verifyCodeBoxes = new TextBox[6];
        for (int i = 0; i < 6; i++)
        {
            var verifyCodeBox = new TextBox
            {
                Width = 45,
                Height = 50,
                FontSize = 24,
                FontWeight = FontWeights.Bold,
                TextAlignment = TextAlignment.Center,
                MaxLength = 1,
                Background = new SolidColorBrush(inputBg),
                Foreground = Brushes.White,
                BorderBrush = new SolidColorBrush(goldColor),
                BorderThickness = new Thickness(1),
                CaretBrush = Brushes.White,
                Margin = new Thickness(i < 5 ? 5 : 0, 0, 0, 0)
            };
            int index = i;
            verifyCodeBox.TextChanged += (s, args) =>
            {
                // Only allow digits
                if (!string.IsNullOrEmpty(verifyCodeBox.Text) && !char.IsDigit(verifyCodeBox.Text[0]))
                {
                    verifyCodeBox.Text = "";
                    return;
                }
                if (verifyCodeBox.Text.Length == 1 && index < 5)
                    verifyCodeBoxes[index + 1].Focus();
            };
            verifyCodeBox.PreviewKeyDown += (s, args) =>
            {
                if (args.Key == Key.Back && string.IsNullOrEmpty(verifyCodeBox.Text) && index > 0)
                {
                    verifyCodeBoxes[index - 1].Focus();
                    verifyCodeBoxes[index - 1].Text = "";
                }
            };
            // Handle paste for full code
            verifyCodeBox.PreviewTextInput += (s, args) =>
            {
                if (args.Text.Length == 6 && args.Text.All(char.IsDigit))
                {
                    for (int j = 0; j < 6; j++)
                        verifyCodeBoxes[j].Text = args.Text[j].ToString();
                    verifyCodeBoxes[5].Focus();
                    args.Handled = true;
                }
            };
            verifyCodeBoxes[i] = verifyCodeBox;
            verifyCodeBoxesPanel.Children.Add(verifyCodeBox);
        }
        createVerifyPanel.Children.Add(verifyCodeBoxesPanel);

        // Expiration timer display
        var verifyTimerText = new TextBlock
        {
            Text = "Code expires in 10:00",
            Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)),
            FontSize = 12,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 10)
        };
        createVerifyPanel.Children.Add(verifyTimerText);

        // Resend code link
        var resendCodePanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 0) };
        var resendCodeText = new TextBlock { Text = "Didn't receive the code? ", Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)), FontSize = 12 };
        resendCodePanel.Children.Add(resendCodeText);
        var resendCodeLink = new TextBlock { Text = "Resend", Foreground = new SolidColorBrush(goldColor), FontSize = 12, Cursor = Cursors.Hand };
        resendCodeLink.MouseEnter += (s, args) => resendCodeLink.TextDecorations = TextDecorations.Underline;
        resendCodeLink.MouseLeave += (s, args) => resendCodeLink.TextDecorations = null;
        resendCodePanel.Children.Add(resendCodeLink);
        createVerifyPanel.Children.Add(resendCodePanel);

        // Timer for code expiration
        System.Windows.Threading.DispatcherTimer? verifyTimer = null;
        int verifyTimeRemaining = 600; // 10 minutes in seconds
        string? pendingVerificationToken = null; // Store token from initial registration

        void StartVerifyTimer()
        {
            verifyTimeRemaining = 600;
            verifyTimer?.Stop();
            verifyTimer = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            verifyTimer.Tick += (s, args) =>
            {
                verifyTimeRemaining--;
                var minutes = verifyTimeRemaining / 60;
                var seconds = verifyTimeRemaining % 60;
                verifyTimerText.Text = $"Code expires in {minutes}:{seconds:D2}";
                if (verifyTimeRemaining <= 60)
                    verifyTimerText.Foreground = new SolidColorBrush(Color.FromRgb(239, 68, 68)); // Red warning
                if (verifyTimeRemaining <= 0)
                {
                    verifyTimer.Stop();
                    verifyTimerText.Text = "Code expired. Please request a new code.";
                }
            };
            verifyTimer.Start();
        }

        // ===== FORGOT PASSWORD STEP 1 (content only - no button) =====
        var forgotStep1Panel = new StackPanel { Visibility = Visibility.Collapsed };

        var forgotInstructionText = new TextBlock
        {
            Text = "Enter your registered email address and we will send you instructions to reset your password.",
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 15)
        };
        forgotStep1Panel.Children.Add(forgotInstructionText);

        var (forgotEmailBorder, forgotEmailBox) = CreateTextInput("Email Address", 8);
        forgotStep1Panel.Children.Add(forgotEmailBorder);

        // "Back to Sign In" link - right aligned, under the textbox
        var forgotBackLinkHoverColor = new SolidColorBrush(goldColor);
        var forgotBackTextBlock = new TextBlock
        {
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 0, 0, 0),
            FontSize = 13
        };
        var forgotBackLinkRun = new System.Windows.Documents.Run("Back to Sign In") { Foreground = forgotBackLinkHoverColor };
        var forgotBackLink = new System.Windows.Documents.Hyperlink(forgotBackLinkRun)
        {
            Foreground = forgotBackLinkHoverColor,
            TextDecorations = null,
            Focusable = true
        };
        forgotBackLink.MouseEnter += (s, args) => { forgotBackLink.TextDecorations = TextDecorations.Underline; };
        forgotBackLink.MouseLeave += (s, args) => { forgotBackLink.TextDecorations = null; };
        forgotBackTextBlock.Inlines.Add(forgotBackLink);
        forgotStep1Panel.Children.Add(forgotBackTextBlock);

        // ===== FORGOT PASSWORD STEP 2 (content only - no button) =====
        var forgotStep2Panel = new StackPanel { Visibility = Visibility.Collapsed };

        var codeBackLinkPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 12) };
        var codeBackLink = new TextBlock { Text = "← Back", Foreground = new SolidColorBrush(goldColor), FontSize = 13, Cursor = Cursors.Hand };
        codeBackLink.MouseEnter += (s, args) => codeBackLink.TextDecorations = TextDecorations.Underline;
        codeBackLink.MouseLeave += (s, args) => codeBackLink.TextDecorations = null;
        codeBackLinkPanel.Children.Add(codeBackLink);
        forgotStep2Panel.Children.Add(codeBackLinkPanel);

        var codeInstructionText = new TextBlock
        {
            Text = "Enter the 6-digit verification code sent to your email.",
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 15)
        };
        forgotStep2Panel.Children.Add(codeInstructionText);

        // Email display for forgot password
        var forgotEmailDisplay = new TextBlock
        {
            Text = "",
            Foreground = new SolidColorBrush(goldColor),
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 10)
        };
        forgotStep2Panel.Children.Add(forgotEmailDisplay);

        // Create 6 code input boxes
        var codeBoxesPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 8) };
        var codeBoxes = new TextBox[6];
        for (int i = 0; i < 6; i++)
        {
            var codeBox = new TextBox
            {
                Width = 45,
                Height = 50,
                FontSize = 24,
                FontWeight = FontWeights.Bold,
                TextAlignment = TextAlignment.Center,
                MaxLength = 1,
                Background = new SolidColorBrush(inputBg),
                Foreground = Brushes.White,
                BorderBrush = new SolidColorBrush(goldColor),
                BorderThickness = new Thickness(1),
                CaretBrush = Brushes.White,
                Margin = new Thickness(i < 5 ? 5 : 0, 0, 0, 0)
            };
            int index = i;
            codeBox.TextChanged += (s, args) =>
            {
                // Only allow digits
                if (!string.IsNullOrEmpty(codeBox.Text) && !char.IsDigit(codeBox.Text[0]))
                {
                    codeBox.Text = "";
                    return;
                }
                if (codeBox.Text.Length == 1 && index < 5)
                    codeBoxes[index + 1].Focus();
            };
            codeBox.PreviewKeyDown += (s, args) =>
            {
                if (args.Key == Key.Back && string.IsNullOrEmpty(codeBox.Text) && index > 0)
                {
                    codeBoxes[index - 1].Focus();
                    codeBoxes[index - 1].Text = "";
                }
            };
            // Handle paste for full code
            codeBox.PreviewTextInput += (s, args) =>
            {
                if (args.Text.Length == 6 && args.Text.All(char.IsDigit))
                {
                    for (int j = 0; j < 6; j++)
                        codeBoxes[j].Text = args.Text[j].ToString();
                    codeBoxes[5].Focus();
                    args.Handled = true;
                }
            };
            codeBoxes[i] = codeBox;
            codeBoxesPanel.Children.Add(codeBox);
        }
        forgotStep2Panel.Children.Add(codeBoxesPanel);

        // Expiration timer display for forgot password
        var forgotTimerText = new TextBlock
        {
            Text = "Code expires in 10:00",
            Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)),
            FontSize = 12,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 10)
        };
        forgotStep2Panel.Children.Add(forgotTimerText);

        // Resend code link for forgot password
        var forgotResendPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 0) };
        var forgotResendText = new TextBlock { Text = "Didn't receive the code? ", Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)), FontSize = 12 };
        forgotResendPanel.Children.Add(forgotResendText);
        var forgotResendLink = new TextBlock { Text = "Resend", Foreground = new SolidColorBrush(goldColor), FontSize = 12, Cursor = Cursors.Hand };
        forgotResendLink.MouseEnter += (s, args) => forgotResendLink.TextDecorations = TextDecorations.Underline;
        forgotResendLink.MouseLeave += (s, args) => forgotResendLink.TextDecorations = null;
        forgotResendPanel.Children.Add(forgotResendLink);
        forgotStep2Panel.Children.Add(forgotResendPanel);

        // Timer for forgot password code expiration
        System.Windows.Threading.DispatcherTimer? forgotTimer = null;
        int forgotTimeRemaining = 600; // 10 minutes in seconds
        string? forgotVerificationToken = null;

        void StartForgotTimer()
        {
            forgotTimeRemaining = 600;
            forgotTimer?.Stop();
            forgotTimer = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            forgotTimer.Tick += (s, args) =>
            {
                forgotTimeRemaining--;
                var minutes = forgotTimeRemaining / 60;
                var seconds = forgotTimeRemaining % 60;
                forgotTimerText.Text = $"Code expires in {minutes}:{seconds:D2}";
                if (forgotTimeRemaining <= 60)
                    forgotTimerText.Foreground = new SolidColorBrush(Color.FromRgb(239, 68, 68)); // Red warning
                if (forgotTimeRemaining <= 0)
                {
                    forgotTimer.Stop();
                    forgotTimerText.Text = "Code expired. Please request a new code.";
                }
            };
            forgotTimer.Start();
        }

        // ===== FORGOT PASSWORD STEP 3 (content only - no button) =====
        var forgotStep3Panel = new StackPanel { Visibility = Visibility.Collapsed };

        var newPassInstructionText = new TextBlock
        {
            Text = "Create your new password.",
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 15)
        };
        forgotStep3Panel.Children.Add(newPassInstructionText);

        var (newPasswordBorder, newPasswordBox, _) = CreatePasswordInput("New Password");
        forgotStep3Panel.Children.Add(newPasswordBorder);

        var (confirmNewPasswordBorder, confirmNewPasswordBox, _) = CreatePasswordInput("Confirm Password", 0);
        forgotStep3Panel.Children.Add(confirmNewPasswordBorder);

        // ===== ROW 2: FIXED FOOTER (action button + copyright - never moves) =====
        var footerPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Bottom };
        Grid.SetRow(footerPanel, 2);

        // Single action button that changes text based on current step
        var actionButton = CreateGoldButton("Sign In");
        actionButton.Margin = new Thickness(0, 15, 0, 12);
        footerPanel.Children.Add(actionButton);

        // Copyright and links - use consistent colors
        var footerTextColor = new SolidColorBrush(Color.FromRgb(120, 120, 120));
        var footerLinkColor = new SolidColorBrush(Color.FromRgb(150, 150, 150)); // Gray default for links
        var footerLinkHoverColor = new SolidColorBrush(goldColor); // Gold hover for consistency with modal

        var copyrightPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        copyrightPanel.Children.Add(new TextBlock { Text = "© 2026 Jubilee Software, Inc.", Foreground = footerTextColor, FontSize = 11 });
        copyrightPanel.Children.Add(new TextBlock { Text = " | ", Foreground = footerTextColor, FontSize = 11 });

        var termsLink = new TextBlock { Text = "Terms of Use", Foreground = footerLinkColor, FontSize = 11, Cursor = Cursors.Hand };
        termsLink.MouseEnter += (s, args) => { termsLink.Foreground = footerLinkHoverColor; termsLink.TextDecorations = TextDecorations.Underline; };
        termsLink.MouseLeave += (s, args) => { termsLink.Foreground = footerLinkColor; termsLink.TextDecorations = null; };
        termsLink.MouseLeftButtonUp += (s, args) => { DocumentViewerDialog.ShowTermsOfUse(this); };
        copyrightPanel.Children.Add(termsLink);

        copyrightPanel.Children.Add(new TextBlock { Text = " | ", Foreground = footerTextColor, FontSize = 11 });

        var privacyLink = new TextBlock { Text = "Privacy Policy", Foreground = footerLinkColor, FontSize = 11, Cursor = Cursors.Hand };
        privacyLink.MouseEnter += (s, args) => { privacyLink.Foreground = footerLinkHoverColor; privacyLink.TextDecorations = TextDecorations.Underline; };
        privacyLink.MouseLeave += (s, args) => { privacyLink.Foreground = footerLinkColor; privacyLink.TextDecorations = null; };
        privacyLink.MouseLeftButtonUp += (s, args) => { DocumentViewerDialog.ShowPrivacyPolicy(this); };
        copyrightPanel.Children.Add(privacyLink);
        footerPanel.Children.Add(copyrightPanel);

        // Track current panel for button action
        string currentPanel = showSignIn ? "signIn" : "createStep1";

        // ===== PANEL VISIBILITY & BUTTON UPDATE HELPER =====
        void ShowPanel(string panelName)
        {
            signInPanel.Visibility = Visibility.Collapsed;
            createStep1Panel.Visibility = Visibility.Collapsed;
            createStep2Panel.Visibility = Visibility.Collapsed;
            createVerifyPanel.Visibility = Visibility.Collapsed;
            forgotStep1Panel.Visibility = Visibility.Collapsed;
            forgotStep2Panel.Visibility = Visibility.Collapsed;
            forgotStep3Panel.Visibility = Visibility.Collapsed;

            currentPanel = panelName;

            switch (panelName)
            {
                case "signIn":
                    signInPanel.Visibility = Visibility.Visible;
                    actionButton.Content = "Sign In";
                    break;
                case "createStep1":
                    createStep1Panel.Visibility = Visibility.Visible;
                    actionButton.Content = "Continue";
                    break;
                case "createStep2":
                    createStep2Panel.Visibility = Visibility.Visible;
                    actionButton.Content = "Continue";
                    break;
                case "createVerify":
                    createVerifyPanel.Visibility = Visibility.Visible;
                    actionButton.Content = "Verify Email";
                    verifyEmailDisplay.Text = createEmailBox.Text;
                    // Clear previous code inputs
                    foreach (var box in verifyCodeBoxes)
                        box.Text = "";
                    verifyCodeBoxes[0].Focus();
                    // Reset timer display
                    verifyTimerText.Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150));
                    StartVerifyTimer();
                    break;
                case "forgotStep1":
                    forgotStep1Panel.Visibility = Visibility.Visible;
                    actionButton.Content = "Send Code";
                    break;
                case "forgotStep2":
                    forgotStep2Panel.Visibility = Visibility.Visible;
                    actionButton.Content = "Verify Code";
                    break;
                case "forgotStep3":
                    forgotStep3Panel.Visibility = Visibility.Visible;
                    actionButton.Content = "Reset Password";
                    break;
            }
        }

        // ===== SINGLE ACTION BUTTON HANDLER =====
        actionButton.Click += (s, args) =>
        {
            switch (currentPanel)
            {
                case "signIn":
                    if (string.IsNullOrWhiteSpace(signInEmailBox.Text) || string.IsNullOrWhiteSpace(signInPasswordBox.Password))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Sign In", "Please enter your email and password.");
                        return;
                    }
                    // Perform sign-in via API
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Signing In...";
                    var signInEmail = signInEmailBox.Text;
                    var signInPassword = signInPasswordBox.Password;
                    var signInRemember = rememberCheckbox.IsChecked == true;
                    _ = Task.Run(async () =>
                    {
                        bool success = false;
                        string responseJson = "";
                        string? errorMsg = null;
                        const int maxRetries = 3;
                        int retryCount = 0;

                        while (retryCount < maxRetries)
                        {
                            try
                            {
                                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };

                                // Collect device info for tracking
                                var deviceInfo = new
                                {
                                    deviceId = GetDeviceId(),
                                    deviceName = Environment.MachineName,
                                    deviceType = "desktop",
                                    platform = "Windows",
                                    platformVersion = Environment.OSVersion.VersionString,
                                    appName = "JubileeBrowser",
                                    appVersion = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0"
                                };

                                var loginRequest = new
                                {
                                    email = signInEmail,
                                    password = signInPassword,
                                    rememberMe = signInRemember,
                                    deviceInfo
                                };
                                var json = System.Text.Json.JsonSerializer.Serialize(loginRequest);
                                var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                                var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/login", content);
                                responseJson = await response.Content.ReadAsStringAsync();
                                success = response.IsSuccessStatusCode;
                                errorMsg = null; // Clear any previous error on success
                                break; // Success, exit retry loop
                            }
                            catch (TaskCanceledException)
                            {
                                // Timeout - retry
                                retryCount++;
                                errorMsg = $"Connection timed out (attempt {retryCount}/{maxRetries})";
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount); // Exponential backoff
                                    continue;
                                }
                                errorMsg = "Connection timed out after multiple attempts. Please check your internet connection.";
                            }
                            catch (System.Net.Http.HttpRequestException ex)
                            {
                                // Network error - retry
                                retryCount++;
                                errorMsg = $"Network error (attempt {retryCount}/{maxRetries}): {ex.Message}";
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount); // Exponential backoff
                                    continue;
                                }
                                errorMsg = $"Network error after multiple attempts: {ex.Message}";
                            }
                            catch (Exception ex)
                            {
                                // Other errors - don't retry
                                errorMsg = ex.Message;
                                break;
                            }
                        }

                        // Now dispatch to UI thread - no async operations inside
                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Sign In";

                            if (errorMsg != null)
                            {
                                // Offer demo mode when connection fails using custom themed dialog
                                var continueInDemo = SignInFailedDialog.Show(this, $"Could not connect to the authentication server.\n\nError: {errorMsg}");

                                if (continueInDemo)
                                {
                                    var demoName = signInEmail.Split('@')[0];
                                    _profileAuthService.SignInDemoMode(demoName, signInEmail);
                                    authDialog.Close();
                                    ShowDemoModeWelcomeDialog(demoName);
                                    // Update the settings page UI immediately via JavaScript
                                    UpdateSettingsPageAuthState(true);
                                }
                                return;
                            }

                            if (success)
                            {
                                var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                var displayName = "User";
                                var userId = "";
                                var email = signInEmail;
                                var accessToken = "";
                                var refreshToken = "";
                                var accessTokenExpiry = DateTime.UtcNow.AddDays(7); // Default 7 days

                                if (result.TryGetProperty("user", out var userElement))
                                {
                                    if (userElement.TryGetProperty("displayName", out var displayNameElement))
                                        displayName = displayNameElement.GetString() ?? "User";
                                    // Server returns "id" not "userId"
                                    if (userElement.TryGetProperty("id", out var userIdElement))
                                        userId = userIdElement.GetString() ?? "";
                                    if (userElement.TryGetProperty("email", out var emailElement))
                                        email = emailElement.GetString() ?? signInEmail;
                                }
                                // Tokens are nested under "tokens" object
                                if (result.TryGetProperty("tokens", out var tokensElement))
                                {
                                    if (tokensElement.TryGetProperty("accessToken", out var accessTokenElement))
                                        accessToken = accessTokenElement.GetString() ?? "";
                                    if (tokensElement.TryGetProperty("refreshToken", out var refreshTokenElement))
                                        refreshToken = refreshTokenElement.GetString() ?? "";
                                    if (tokensElement.TryGetProperty("expiresIn", out var expiresInElement))
                                    {
                                        var expiresInSeconds = expiresInElement.GetInt32();
                                        accessTokenExpiry = DateTime.UtcNow.AddSeconds(expiresInSeconds);
                                    }
                                }

                                System.Diagnostics.Debug.WriteLine($"[MainWindow] Sign-in parsed - userId: {userId}, accessToken length: {accessToken.Length}");

                                // Sign in with the API response tokens - use synchronous version on UI thread
                                _profileAuthService.SignInWithApiResponse(userId, email, displayName, accessToken, refreshToken, accessTokenExpiry);

                                // Save credentials if "Keep me signed in" is checked
                                if (signInRemember)
                                {
                                    var credsToSave = new SavedSignInCredentials
                                    {
                                        Email = signInEmail,
                                        EncryptedPassword = secureStorage.EncryptPassword(signInPassword),
                                        RememberMe = true
                                    };
                                    _ = secureStorage.StoreAsync("signInCredentials", credsToSave);
                                }
                                else
                                {
                                    // Clear saved credentials if not checked
                                    secureStorage.Remove("signInCredentials");
                                }

                                authDialog.Close();
                                ShowStyledNotification($"Welcome back,\n{displayName}!", "Success!", NotificationType.Success);

                                // Force sync immediately after sign-in with direct test
                                var capturedToken = accessToken; // Capture token before async
                                var capturedApiUrl = _apiBaseUrl;
                                System.Diagnostics.Debug.WriteLine($"[MainWindow] Sign-in successful - token length: {accessToken?.Length ?? 0}, first 30: {(accessToken?.Length > 30 ? accessToken.Substring(0, 30) : accessToken)}");
                                // Direct sync test removed - sync is now handled by SyncEngine V2 API

                                // Also trigger via SyncEngine
                                System.Diagnostics.Debug.WriteLine("[MainWindow] Triggering SyncEngine.SyncNowAsync...");
                                _ = _syncEngine.SyncNowAsync();

                                // Update the settings page UI immediately via JavaScript
                                UpdateSettingsPageAuthState(true);
                            }
                            else
                            {
                                var errorMessage = "Invalid email or password";
                                try
                                {
                                    var errorResult = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (errorResult.TryGetProperty("errorMessage", out var errElement))
                                        errorMessage = errElement.GetString() ?? errorMessage;
                                }
                                catch { }

                                // Offer demo mode when server sign-in fails using custom themed dialog
                                var continueInDemo = SignInFailedDialog.Show(this, errorMessage);

                                if (continueInDemo)
                                {
                                    var demoName = signInEmail.Split('@')[0];
                                    _profileAuthService.SignInDemoMode(demoName, signInEmail);
                                    authDialog.Close();
                                    ShowDemoModeWelcomeDialog(demoName);
                                    // Update the settings page UI immediately via JavaScript
                                    UpdateSettingsPageAuthState(true);
                                }
                            }
                        });
                    });
                    break;

                case "createStep1":
                    if (string.IsNullOrWhiteSpace(fullNameBox.Text))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Create Account", "Please enter your full name.");
                        return;
                    }
                    if (string.IsNullOrWhiteSpace(createEmailBox.Text))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Create Account", "Please enter your email address.");
                        return;
                    }
                    // Basic email validation
                    if (!createEmailBox.Text.Contains("@") || !createEmailBox.Text.Contains("."))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Create Account", "Please enter a valid email address.");
                        return;
                    }
                    ShowPanel("createStep2");
                    break;

                case "createStep2":
                    if (string.IsNullOrWhiteSpace(createPasswordBox.Password))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Create Account", "Please enter a password.");
                        return;
                    }
                    if (createPasswordBox.Password.Length < 8)
                    {
                        JubileeAlertDialog.ShowWarning(this, "Create Account", "Password must be at least 8 characters long.");
                        return;
                    }
                    if (createPasswordBox.Password != confirmPasswordBox.Password)
                    {
                        JubileeAlertDialog.ShowWarning(this, "Create Account", "Passwords do not match.");
                        return;
                    }
                    if (termsCheckbox.IsChecked != true)
                    {
                        JubileeAlertDialog.ShowWarning(this, "Create Account", "You must agree to the Terms of Use and Privacy Policy to create an account.");
                        return;
                    }
                    // Send verification code via API
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Sending Code...";
                    var sendCodeEmail = createEmailBox.Text;
                    var sendCodeName = fullNameBox.Text;
                    _ = Task.Run(async () =>
                    {
                        bool success = false;
                        string responseJson = "";
                        string? errorMsg = null;
                        const int maxRetries = 3;
                        int retryCount = 0;

                        while (retryCount < maxRetries)
                        {
                            try
                            {
                                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                                var sendCodeRequest = new { email = sendCodeEmail, displayName = sendCodeName, type = "registration" };
                                var json = System.Text.Json.JsonSerializer.Serialize(sendCodeRequest);
                                var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                                var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/send-verification-code", content);
                                responseJson = await response.Content.ReadAsStringAsync();
                                success = response.IsSuccessStatusCode;
                                errorMsg = null;
                                break;
                            }
                            catch (TaskCanceledException)
                            {
                                retryCount++;
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount);
                                    continue;
                                }
                                errorMsg = "Connection timed out. Please check your internet connection.";
                            }
                            catch (System.Net.Http.HttpRequestException ex)
                            {
                                retryCount++;
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount);
                                    continue;
                                }
                                errorMsg = $"Network error: {ex.Message}";
                            }
                            catch (Exception ex)
                            {
                                errorMsg = ex.Message;
                                break;
                            }
                        }

                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Continue";

                            if (errorMsg != null)
                            {
                                var continueInDemo = SignInFailedDialog.Show(this, $"Could not send verification code.\n\n{errorMsg}");
                                if (continueInDemo)
                                {
                                    _profileAuthService.SignInDemoMode(sendCodeName, sendCodeEmail);
                                    authDialog.Close();
                                    ShowDemoModeWelcomeDialog(sendCodeName);
                                }
                                return;
                            }

                            if (success)
                            {
                                // Store verification token if returned
                                try
                                {
                                    var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (result.TryGetProperty("verificationToken", out var tokenElement))
                                        pendingVerificationToken = tokenElement.GetString();
                                }
                                catch { }

                                // Move to verification step
                                ShowPanel("createVerify");
                            }
                            else
                            {
                                var errorMessage = "Failed to send verification code. Please try again.";
                                try
                                {
                                    var errorResult = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (errorResult.TryGetProperty("errorMessage", out var errElement))
                                        errorMessage = errElement.GetString() ?? errorMessage;
                                }
                                catch { }
                                JubileeAlertDialog.ShowError(this, "Verification", errorMessage);
                            }
                        });
                    });
                    break;

                case "createVerify":
                    var verifyCode = string.Join("", verifyCodeBoxes.Select(cb => cb.Text));
                    if (verifyCode.Length != 6)
                    {
                        JubileeAlertDialog.ShowWarning(this, "Email Verification", "Please enter the complete 6-digit verification code.");
                        return;
                    }
                    if (!verifyCode.All(char.IsDigit))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Email Verification", "Verification code must contain only digits.");
                        return;
                    }
                    if (verifyTimeRemaining <= 0)
                    {
                        JubileeAlertDialog.ShowError(this, "Code Expired", "Your verification code has expired. Please request a new code.");
                        return;
                    }
                    // Verify code and complete registration
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Verifying...";
                    var createFullName = fullNameBox.Text;
                    var createEmail = createEmailBox.Text;
                    var createPassword = createPasswordBox.Password;
                    var subscribeNewsletter = newsletterCheckbox.IsChecked == true;
                    var capturedVerifyCode = verifyCode;
                    var capturedVerifyToken = pendingVerificationToken;
                    _ = Task.Run(async () =>
                    {
                        bool success = false;
                        string responseJson = "";
                        string? errorMsg = null;
                        const int maxRetries = 3;
                        int retryCount = 0;

                        while (retryCount < maxRetries)
                        {
                            try
                            {
                                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                                var registerRequest = new
                                {
                                    displayName = createFullName,
                                    email = createEmail,
                                    password = createPassword,
                                    verificationCode = capturedVerifyCode,
                                    verificationToken = capturedVerifyToken
                                };
                                var json = System.Text.Json.JsonSerializer.Serialize(registerRequest);
                                var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                                var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/register", content);
                                responseJson = await response.Content.ReadAsStringAsync();
                                success = response.IsSuccessStatusCode;
                                errorMsg = null;
                                break;
                            }
                            catch (TaskCanceledException)
                            {
                                retryCount++;
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount);
                                    continue;
                                }
                                errorMsg = "Connection timed out. Please check your internet connection.";
                            }
                            catch (System.Net.Http.HttpRequestException ex)
                            {
                                retryCount++;
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount);
                                    continue;
                                }
                                errorMsg = $"Network error: {ex.Message}";
                            }
                            catch (Exception ex)
                            {
                                errorMsg = ex.Message;
                                break;
                            }
                        }

                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Verify Email";
                            verifyTimer?.Stop();

                            if (errorMsg != null)
                            {
                                var continueInDemo = SignInFailedDialog.Show(this, $"Could not complete registration.\n\n{errorMsg}");
                                if (continueInDemo)
                                {
                                    _profileAuthService.SignInDemoMode(createFullName, createEmail);
                                    authDialog.Close();
                                    ShowDemoModeWelcomeDialog(createFullName);
                                }
                                return;
                            }

                            if (success)
                            {
                                var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                var displayName = createFullName;
                                var userId = "";
                                var email = createEmail;
                                var accessToken = "";
                                var refreshToken = "";
                                var accessTokenExpiry = DateTime.UtcNow.AddDays(7);

                                if (result.TryGetProperty("user", out var userElement))
                                {
                                    if (userElement.TryGetProperty("displayName", out var displayNameElement))
                                        displayName = displayNameElement.GetString() ?? createFullName;
                                    if (userElement.TryGetProperty("id", out var userIdElement))
                                        userId = userIdElement.GetString() ?? "";
                                    if (userElement.TryGetProperty("email", out var emailElement))
                                        email = emailElement.GetString() ?? createEmail;
                                }
                                if (result.TryGetProperty("tokens", out var tokensElement))
                                {
                                    if (tokensElement.TryGetProperty("accessToken", out var accessTokenElement))
                                        accessToken = accessTokenElement.GetString() ?? "";
                                    if (tokensElement.TryGetProperty("refreshToken", out var refreshTokenElement))
                                        refreshToken = refreshTokenElement.GetString() ?? "";
                                    if (tokensElement.TryGetProperty("expiresIn", out var expiresInElement))
                                    {
                                        var expiresInSeconds = expiresInElement.GetInt32();
                                        accessTokenExpiry = DateTime.UtcNow.AddSeconds(expiresInSeconds);
                                    }
                                }

                                _profileAuthService.SignInWithApiResponse(userId, email, displayName, accessToken, refreshToken, accessTokenExpiry);
                                authDialog.Close();
                                JubileeAlertDialog.ShowSuccess(this, "Account Created", $"Welcome to Jubilee, {displayName}!\n\nYour email has been verified and your account is now active.");
                                _ = _syncEngine.SyncNowAsync();
                            }
                            else
                            {
                                var errorMessage = "Invalid verification code. Please check and try again.";
                                try
                                {
                                    var errorResult = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (errorResult.TryGetProperty("errorMessage", out var errElement))
                                        errorMessage = errElement.GetString() ?? errorMessage;
                                    // Check for specific error codes
                                    if (errorResult.TryGetProperty("errorCode", out var codeElement))
                                    {
                                        var errorCode = codeElement.GetString();
                                        if (errorCode == "INVALID_CODE")
                                            errorMessage = "The verification code you entered is incorrect. Please try again.";
                                        else if (errorCode == "CODE_EXPIRED")
                                            errorMessage = "Your verification code has expired. Please request a new code.";
                                    }
                                }
                                catch { }
                                JubileeAlertDialog.ShowError(this, "Verification Failed", errorMessage);
                            }
                        });
                    });
                    break;

                case "forgotStep1":
                    if (string.IsNullOrWhiteSpace(forgotEmailBox.Text))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Forgot Password", "Please enter your email address.");
                        return;
                    }
                    // Basic email validation
                    if (!forgotEmailBox.Text.Contains("@") || !forgotEmailBox.Text.Contains("."))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Forgot Password", "Please enter a valid email address.");
                        return;
                    }
                    // Send password reset code via API
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Sending Code...";
                    var forgotSendEmail = forgotEmailBox.Text;
                    _ = Task.Run(async () =>
                    {
                        bool success = false;
                        string responseJson = "";
                        string? errorMsg = null;
                        const int maxRetries = 3;
                        int retryCount = 0;

                        while (retryCount < maxRetries)
                        {
                            try
                            {
                                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                                var sendCodeRequest = new { email = forgotSendEmail, type = "password_reset" };
                                var json = System.Text.Json.JsonSerializer.Serialize(sendCodeRequest);
                                var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                                var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/send-verification-code", content);
                                responseJson = await response.Content.ReadAsStringAsync();
                                success = response.IsSuccessStatusCode;
                                errorMsg = null;
                                break;
                            }
                            catch (TaskCanceledException)
                            {
                                retryCount++;
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount);
                                    continue;
                                }
                                errorMsg = "Connection timed out. Please check your internet connection.";
                            }
                            catch (System.Net.Http.HttpRequestException ex)
                            {
                                retryCount++;
                                if (retryCount < maxRetries)
                                {
                                    await Task.Delay(1000 * retryCount);
                                    continue;
                                }
                                errorMsg = $"Network error: {ex.Message}";
                            }
                            catch (Exception ex)
                            {
                                errorMsg = ex.Message;
                                break;
                            }
                        }

                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Send Code";

                            if (errorMsg != null)
                            {
                                JubileeAlertDialog.ShowError(this, "Forgot Password", $"Could not send verification code.\n\n{errorMsg}");
                                return;
                            }

                            if (success)
                            {
                                // Store verification token if returned
                                try
                                {
                                    var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (result.TryGetProperty("verificationToken", out var tokenElement))
                                        forgotVerificationToken = tokenElement.GetString();
                                }
                                catch { }

                                // Update email display and clear code boxes
                                forgotEmailDisplay.Text = forgotSendEmail;
                                foreach (var box in codeBoxes)
                                    box.Text = "";
                                forgotTimerText.Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150));
                                StartForgotTimer();
                                ShowPanel("forgotStep2");
                                codeBoxes[0].Focus();
                            }
                            else
                            {
                                var errorMessage = "Failed to send verification code. Please check your email address.";
                                try
                                {
                                    var errorResult = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (errorResult.TryGetProperty("errorMessage", out var errElement))
                                        errorMessage = errElement.GetString() ?? errorMessage;
                                }
                                catch { }
                                JubileeAlertDialog.ShowError(this, "Forgot Password", errorMessage);
                            }
                        });
                    });
                    break;

                case "forgotStep2":
                    var code = string.Join("", codeBoxes.Select(cb => cb.Text));
                    if (code.Length != 6)
                    {
                        JubileeAlertDialog.ShowWarning(this, "Forgot Password", "Please enter the complete 6-digit verification code.");
                        return;
                    }
                    if (!code.All(char.IsDigit))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Forgot Password", "Verification code must contain only digits.");
                        return;
                    }
                    if (forgotTimeRemaining <= 0)
                    {
                        JubileeAlertDialog.ShowError(this, "Code Expired", "Your verification code has expired. Please request a new code.");
                        return;
                    }
                    // Verify the code via API
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Verifying...";
                    var forgotVerifyEmail = forgotEmailBox.Text;
                    var forgotVerifyCode = code;
                    var capturedForgotToken = forgotVerificationToken;
                    _ = Task.Run(async () =>
                    {
                        bool success = false;
                        string responseJson = "";
                        string? errorMsg = null;

                        try
                        {
                            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                            var verifyRequest = new { email = forgotVerifyEmail, code = forgotVerifyCode, verificationToken = capturedForgotToken, type = "password_reset" };
                            var json = System.Text.Json.JsonSerializer.Serialize(verifyRequest);
                            var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                            var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/verify-code", content);
                            responseJson = await response.Content.ReadAsStringAsync();
                            success = response.IsSuccessStatusCode;
                        }
                        catch (Exception ex)
                        {
                            errorMsg = ex.Message;
                        }

                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Verify Code";

                            if (errorMsg != null)
                            {
                                JubileeAlertDialog.ShowError(this, "Verification", $"Could not verify code.\n\n{errorMsg}");
                                return;
                            }

                            if (success)
                            {
                                // Store reset token for step 3
                                try
                                {
                                    var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (result.TryGetProperty("resetToken", out var tokenElement))
                                        forgotVerificationToken = tokenElement.GetString();
                                }
                                catch { }

                                forgotTimer?.Stop();
                                ShowPanel("forgotStep3");
                            }
                            else
                            {
                                var errorMessage = "Invalid verification code. Please check and try again.";
                                try
                                {
                                    var errorResult = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (errorResult.TryGetProperty("errorMessage", out var errElement))
                                        errorMessage = errElement.GetString() ?? errorMessage;
                                    if (errorResult.TryGetProperty("errorCode", out var codeElement))
                                    {
                                        var errorCode = codeElement.GetString();
                                        if (errorCode == "INVALID_CODE")
                                            errorMessage = "The verification code you entered is incorrect. Please try again.";
                                        else if (errorCode == "CODE_EXPIRED")
                                            errorMessage = "Your verification code has expired. Please request a new code.";
                                    }
                                }
                                catch { }
                                JubileeAlertDialog.ShowError(this, "Verification Failed", errorMessage);
                            }
                        });
                    });
                    break;

                case "forgotStep3":
                    if (string.IsNullOrWhiteSpace(newPasswordBox.Password))
                    {
                        JubileeAlertDialog.ShowWarning(this, "Reset Password", "Please enter a new password.");
                        return;
                    }
                    if (newPasswordBox.Password.Length < 8)
                    {
                        JubileeAlertDialog.ShowWarning(this, "Reset Password", "Password must be at least 8 characters long.");
                        return;
                    }
                    if (newPasswordBox.Password != confirmNewPasswordBox.Password)
                    {
                        JubileeAlertDialog.ShowWarning(this, "Reset Password", "Passwords do not match.");
                        return;
                    }
                    // Reset password via API
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Resetting...";
                    var resetEmail = forgotEmailBox.Text;
                    var resetNewPassword = newPasswordBox.Password;
                    var capturedResetToken = forgotVerificationToken;
                    _ = Task.Run(async () =>
                    {
                        bool success = false;
                        string responseJson = "";
                        string? errorMsg = null;

                        try
                        {
                            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                            var resetRequest = new { email = resetEmail, newPassword = resetNewPassword, resetToken = capturedResetToken };
                            var json = System.Text.Json.JsonSerializer.Serialize(resetRequest);
                            var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                            var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/reset-password", content);
                            responseJson = await response.Content.ReadAsStringAsync();
                            success = response.IsSuccessStatusCode;
                        }
                        catch (Exception ex)
                        {
                            errorMsg = ex.Message;
                        }

                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Reset Password";

                            if (errorMsg != null)
                            {
                                JubileeAlertDialog.ShowError(this, "Reset Password", $"Could not reset password.\n\n{errorMsg}");
                                return;
                            }

                            if (success)
                            {
                                authDialog.Close();
                                JubileeAlertDialog.ShowSuccess(this, "Password Reset", "Your password has been reset successfully.\n\nYou can now sign in with your new password.");
                            }
                            else
                            {
                                var errorMessage = "Failed to reset password. Please try again.";
                                try
                                {
                                    var errorResult = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (errorResult.TryGetProperty("errorMessage", out var errElement))
                                        errorMessage = errElement.GetString() ?? errorMessage;
                                }
                                catch { }
                                JubileeAlertDialog.ShowError(this, "Reset Failed", errorMessage);
                            }
                        });
                    });
                    break;
            }
        };

        // ===== NAVIGATION LINK HANDLERS =====
        // Mouse click handlers
        signUpLink.Click += (s, args) => { ShowPanel("createStep1"); }; // Hyperlink uses Click event
        step1SignInLink.Click += (s, args) => { ShowPanel("signIn"); }; // Hyperlink uses Click event
        step2BackLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("createStep1"); };
        verifyBackLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; verifyTimer?.Stop(); ShowPanel("createStep2"); };
        forgotPasswordLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("forgotStep1"); };
        forgotBackLink.Click += (s, args) => { ShowPanel("signIn"); }; // Hyperlink uses Click event
        codeBackLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; forgotTimer?.Stop(); ShowPanel("forgotStep1"); };

        // Resend code handlers
        resendCodeLink.PreviewMouseLeftButtonDown += async (s, args) =>
        {
            args.Handled = true;
            resendCodeLink.IsEnabled = false;
            resendCodeLink.Text = "Sending...";

            try
            {
                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                var sendCodeRequest = new { email = createEmailBox.Text, displayName = fullNameBox.Text, type = "registration" };
                var json = System.Text.Json.JsonSerializer.Serialize(sendCodeRequest);
                var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/send-verification-code", content);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    try
                    {
                        var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                        if (result.TryGetProperty("verificationToken", out var tokenElement))
                            pendingVerificationToken = tokenElement.GetString();
                    }
                    catch { }

                    // Clear code boxes and restart timer
                    foreach (var box in verifyCodeBoxes)
                        box.Text = "";
                    verifyCodeBoxes[0].Focus();
                    verifyTimerText.Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150));
                    StartVerifyTimer();
                    JubileeAlertDialog.ShowInfo(this, "Code Sent", "A new verification code has been sent to your email.");
                }
                else
                {
                    JubileeAlertDialog.ShowError(this, "Resend Failed", "Could not resend verification code. Please try again.");
                }
            }
            catch (Exception ex)
            {
                JubileeAlertDialog.ShowError(this, "Error", $"Failed to resend code: {ex.Message}");
            }

            resendCodeLink.Text = "Resend";
            resendCodeLink.IsEnabled = true;
        };

        forgotResendLink.PreviewMouseLeftButtonDown += async (s, args) =>
        {
            args.Handled = true;
            forgotResendLink.IsEnabled = false;
            forgotResendLink.Text = "Sending...";

            try
            {
                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                var sendCodeRequest = new { email = forgotEmailBox.Text, type = "password_reset" };
                var json = System.Text.Json.JsonSerializer.Serialize(sendCodeRequest);
                var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/send-verification-code", content);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    try
                    {
                        var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                        if (result.TryGetProperty("verificationToken", out var tokenElement))
                            forgotVerificationToken = tokenElement.GetString();
                    }
                    catch { }

                    // Clear code boxes and restart timer
                    foreach (var box in codeBoxes)
                        box.Text = "";
                    codeBoxes[0].Focus();
                    forgotTimerText.Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150));
                    StartForgotTimer();
                    JubileeAlertDialog.ShowInfo(this, "Code Sent", "A new verification code has been sent to your email.");
                }
                else
                {
                    JubileeAlertDialog.ShowError(this, "Resend Failed", "Could not resend verification code. Please try again.");
                }
            }
            catch (Exception ex)
            {
                JubileeAlertDialog.ShowError(this, "Error", $"Failed to resend code: {ex.Message}");
            }

            forgotResendLink.Text = "Resend";
            forgotResendLink.IsEnabled = true;
        };

        // ===== ASSEMBLE THE LAYOUT WITH FIXED REGIONS =====
        // Add content panels to content container (Row 1)
        contentContainer.Children.Add(signInPanel);
        contentContainer.Children.Add(createStep1Panel);
        contentContainer.Children.Add(createStep2Panel);
        contentContainer.Children.Add(createVerifyPanel);
        contentContainer.Children.Add(forgotStep1Panel);
        contentContainer.Children.Add(forgotStep2Panel);
        contentContainer.Children.Add(forgotStep3Panel);

        // Add three fixed regions to main layout grid
        mainLayoutGrid.Children.Add(headerPanel);      // Row 0: Fixed Header
        mainLayoutGrid.Children.Add(contentContainer); // Row 1: Content (only this changes)
        mainLayoutGrid.Children.Add(footerPanel);      // Row 2: Fixed Footer

        // Set initial panel based on parameter
        if (!showSignIn)
            ShowPanel("createStep1");

        mainBorder.Child = mainLayoutGrid;
        overlayGrid.Children.Add(mainBorder);
        authDialog.Content = overlayGrid;

        authDialog.ShowDialog();
    }

    private void ShowJubileeVerseCreateAccountDialog()
    {
        // Use the unified auth dialog starting on the Create Account panel
        ShowJubileeVerseAuthDialog(showSignIn: false);
    }

    // Legacy method kept for compatibility - not used
    private void ShowJubileeVerseCreateAccountDialog_Legacy()
    {
        // Color definitions
        var darkBg = Color.FromRgb(38, 38, 38);           // #262626 - Main background
        var inputBg = Color.FromRgb(64, 64, 64);          // #404040 - Input field background
        var goldColor = Color.FromRgb(230, 172, 0);       // #E6AC00 - Gold/yellow accent
        var cyanGlow = Color.FromRgb(0, 191, 255);        // #00BFFF - Cyan glow for avatar

        var createAccountDialog = new Window
        {
            Title = "Create Account - JubileeVerse",
            Width = 450,
            Height = 530,  // Reduced height with 3 fields instead of 4
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = Brushes.Transparent,
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            AllowsTransparency = true
        };

        // Main container with gradient background, 3px yellow border all around, rounded corners
        var mainBorder = new Border
        {
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
            BorderThickness = new Thickness(3),  // 3px border all around
            CornerRadius = new CornerRadius(12)  // Rounded corners
        };

        var mainPanel = new StackPanel { Margin = new Thickness(30, 15, 30, 20) };

        // Close button (X) in top right with gold hover effect (font color only)
        var closeButtonText = new TextBlock
        {
            Text = "✕",
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
            Margin = new Thickness(0, -20, -30, 0),
            Child = closeButtonText
        };
        var grayBrush = new SolidColorBrush(Color.FromRgb(150, 150, 150));
        var goldBrush = new SolidColorBrush(goldColor);
        closeButton.MouseEnter += (s, args) => closeButtonText.Foreground = goldBrush;
        closeButton.MouseLeave += (s, args) => closeButtonText.Foreground = grayBrush;
        // Use PreviewMouseLeftButtonDown to capture click before drag handler
        closeButton.PreviewMouseLeftButtonDown += (s, args) =>
        {
            args.Handled = true;
            // Hide dialog first to prevent flicker, then close after a brief delay
            createAccountDialog.Opacity = 0;
            var timer = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(50) };
            timer.Tick += (t, te) => { timer.Stop(); createAccountDialog.Close(); };
            timer.Start();
        };
        mainPanel.Children.Add(closeButton);

        // Jubilee logo at top
        var logoImage = new System.Windows.Controls.Image
        {
            Width = 80,
            Height = 80,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 5, 0, 10),
            Stretch = Stretch.Uniform
        };
        try
        {
            var logoUri = new Uri("pack://application:,,,/Resources/Icons/jubilee-logo.png");
            logoImage.Source = new System.Windows.Media.Imaging.BitmapImage(logoUri);
        }
        catch { }
        mainPanel.Children.Add(logoImage);

        // JubileeInspire.com title with Agency FB Bold styling (38px = 28 + 10)
        var titlePanel = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 3) };
        var titleText = new TextBlock
        {
            FontSize = 38,
            FontWeight = FontWeights.Bold,
            FontFamily = new FontFamily("Agency FB, Impact, Arial Black, sans-serif"),
            HorizontalAlignment = HorizontalAlignment.Center
        };
        titleText.Inlines.Add(new System.Windows.Documents.Run("Jubilee") { Foreground = new SolidColorBrush(goldColor) });
        titleText.Inlines.Add(new System.Windows.Documents.Run("Inspire") { Foreground = new SolidColorBrush(cyanGlow) });  // Cyan
        titleText.Inlines.Add(new System.Windows.Documents.Run(".com") { Foreground = new SolidColorBrush(goldColor) });
        titlePanel.Children.Add(titleText);
        mainPanel.Children.Add(titlePanel);

        // Subtitle: A Faith-Based AI Browser for the Worldwide Bible Web (15px = 11 + 4, white color, moved up 10px total)
        var subtitleText = new TextBlock
        {
            Text = "A Faith-Based AI Browser for the Worldwide Bible Web",
            FontSize = 15,
            Foreground = Brushes.White,
            HorizontalAlignment = HorizontalAlignment.Center,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, -10, 0, 10)
        };
        mainPanel.Children.Add(subtitleText);

        // "Already have an account? Sign In." text
        var signInPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 12) };
        signInPanel.Children.Add(new TextBlock { Text = "Already have an account? ", Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 13 });
        var signInLink = new TextBlock
        {
            Text = "Sign In",
            Foreground = new SolidColorBrush(goldColor),
            FontSize = 13,
            Cursor = Cursors.Hand
        };
        signInLink.MouseEnter += (s, args) => signInLink.TextDecorations = TextDecorations.Underline;
        signInLink.MouseLeave += (s, args) => signInLink.TextDecorations = null;
        // Use PreviewMouseLeftButtonDown to capture click before drag handler
        bool openSignIn = false;
        signInLink.PreviewMouseLeftButtonDown += (s, args) =>
        {
            args.Handled = true;
            openSignIn = true;
            // Hide dialog first to prevent flicker, then close after a brief delay
            createAccountDialog.Opacity = 0;
            var timer = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(50) };
            timer.Tick += (t, te) => { timer.Stop(); createAccountDialog.Close(); };
            timer.Start();
        };
        signInPanel.Children.Add(signInLink);
        signInPanel.Children.Add(new TextBlock { Text = ".", Foreground = new SolidColorBrush(goldColor), FontSize = 13 });
        mainPanel.Children.Add(signInPanel);

        // Helper function to create input field
        Func<string, bool, (Border, TextBox?, PasswordBox?)> createInputField = (placeholder, isPassword) =>
        {
            var border = new Border
            {
                Background = new SolidColorBrush(inputBg),
                BorderBrush = new SolidColorBrush(goldColor),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Margin = new Thickness(0, 0, 0, 12),
                Padding = new Thickness(15, 12, 15, 12)
            };

            var grid = new Grid();
            var placeholderText = new TextBlock
            {
                Text = placeholder,
                Foreground = new SolidColorBrush(Color.FromRgb(150, 150, 150)),
                FontSize = 14,
                IsHitTestVisible = false,
                VerticalAlignment = VerticalAlignment.Center
            };
            grid.Children.Add(placeholderText);

            if (isPassword)
            {
                var passBox = new PasswordBox
                {
                    Background = Brushes.Transparent,
                    Foreground = Brushes.White,
                    BorderThickness = new Thickness(0),
                    FontSize = 14,
                    CaretBrush = Brushes.White
                };
                passBox.PasswordChanged += (s, args) => placeholderText.Visibility = string.IsNullOrEmpty(passBox.Password) ? Visibility.Visible : Visibility.Collapsed;
                grid.Children.Add(passBox);
                border.Child = grid;
                return (border, null, passBox);
            }
            else
            {
                var textBox = new TextBox
                {
                    Background = Brushes.Transparent,
                    Foreground = Brushes.White,
                    BorderThickness = new Thickness(0),
                    FontSize = 14,
                    CaretBrush = Brushes.White
                };
                textBox.TextChanged += (s, args) => placeholderText.Visibility = string.IsNullOrEmpty(textBox.Text) ? Visibility.Visible : Visibility.Collapsed;
                grid.Children.Add(textBox);
                border.Child = grid;
                return (border, textBox, null);
            }
        };

        // Full Name field
        var (fullNameBorder, fullNameBox, _) = createInputField("Full Name", false);
        mainPanel.Children.Add(fullNameBorder);

        // Email Address field
        var (emailBorder, emailBox, _) = createInputField("Email Address", false);
        mainPanel.Children.Add(emailBorder);

        // Password field
        var (passwordBorder, _, passwordBox) = createInputField("Password", true);
        mainPanel.Children.Add(passwordBorder);

        // Newsletter subscription checkbox
        var newsletterPanel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 5, 0, 8) };
        var newsletterCheck = new CheckBox { VerticalAlignment = VerticalAlignment.Center, IsChecked = true };
        newsletterPanel.Children.Add(newsletterCheck);
        newsletterPanel.Children.Add(new TextBlock
        {
            Text = "Subscribe me to the newsletter",
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            FontSize = 12,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(8, 0, 0, 0)
        });
        mainPanel.Children.Add(newsletterPanel);

        // Terms and Privacy checkbox
        var termsPanel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 12) };
        var termsCheck = new CheckBox { VerticalAlignment = VerticalAlignment.Top, Margin = new Thickness(0, 2, 0, 0) };
        termsPanel.Children.Add(termsCheck);

        var termsTextBlock = new TextBlock { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0, 0, 0), TextWrapping = TextWrapping.Wrap };
        termsTextBlock.Inlines.Add(new System.Windows.Documents.Run("Yes, I agree to the ") { Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 12 });
        var termsLink2 = new System.Windows.Documents.Hyperlink(new System.Windows.Documents.Run("Terms of Use")) { Foreground = new SolidColorBrush(goldColor) };
        termsLink2.Click += (s, args) => { DocumentViewerDialog.ShowTermsOfUse(this); };
        termsTextBlock.Inlines.Add(termsLink2);
        termsTextBlock.Inlines.Add(new System.Windows.Documents.Run(" and ") { Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 12 });
        var privacyLinkInline = new System.Windows.Documents.Hyperlink(new System.Windows.Documents.Run("Privacy Policy")) { Foreground = new SolidColorBrush(goldColor) };
        privacyLinkInline.Click += (s, args) => { DocumentViewerDialog.ShowPrivacyPolicy(this); };
        termsTextBlock.Inlines.Add(privacyLinkInline);
        termsPanel.Children.Add(termsTextBlock);
        mainPanel.Children.Add(termsPanel);

        // Create Account button (gold/yellow)
        var createAccountButton = new Button
        {
            Content = "Create Account",
            Height = 45,
            Background = new SolidColorBrush(goldColor),
            Foreground = new SolidColorBrush(Color.FromRgb(30, 30, 30)),
            BorderThickness = new Thickness(0),
            FontSize = 16,
            FontWeight = FontWeights.SemiBold,
            Cursor = Cursors.Hand,
            Margin = new Thickness(0, 0, 0, 15)
        };

        // Round corners via template
        var buttonTemplate = new ControlTemplate(typeof(Button));
        var buttonBorder = new FrameworkElementFactory(typeof(Border));
        buttonBorder.Name = "border";
        buttonBorder.SetValue(Border.BackgroundProperty, new SolidColorBrush(goldColor));
        buttonBorder.SetValue(Border.CornerRadiusProperty, new CornerRadius(25));
        var buttonContent = new FrameworkElementFactory(typeof(ContentPresenter));
        buttonContent.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
        buttonContent.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        buttonBorder.AppendChild(buttonContent);
        buttonTemplate.VisualTree = buttonBorder;
        createAccountButton.Template = buttonTemplate;

        createAccountButton.Click += (s, args) =>
        {
            var fullName = fullNameBox?.Text ?? "";
            var email = emailBox?.Text ?? "";
            var password = passwordBox?.Password ?? "";

            if (string.IsNullOrWhiteSpace(fullName))
            {
                JubileeAlertDialog.ShowWarning(this, "Create Account", "Please enter your full name.");
                return;
            }

            if (string.IsNullOrWhiteSpace(email) || !email.Contains("@"))
            {
                JubileeAlertDialog.ShowWarning(this, "Create Account", "Please enter a valid email address.");
                return;
            }

            if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            {
                JubileeAlertDialog.ShowWarning(this, "Create Account", "Password must be at least 8 characters long.");
                return;
            }

            if (termsCheck.IsChecked != true)
            {
                JubileeAlertDialog.ShowWarning(this, "Create Account", "Please agree to the Terms of Use and Privacy Policy.");
                return;
            }

            // TODO: Implement actual account creation with Jubilee Inspire API
            createAccountDialog.Close();
            JubileeAlertDialog.ShowInfo(this, "Create Account", "Account creation with Jubilee Inspire is coming soon!\n\nYour information has been saved for when this feature becomes available.");
        };
        mainPanel.Children.Add(createAccountButton);

        // Footer
        var footerPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        footerPanel.Children.Add(new TextBlock { Text = "© 2026 Jubilee Browser", Foreground = new SolidColorBrush(Color.FromRgb(120, 120, 120)), FontSize = 11 });
        footerPanel.Children.Add(new TextBlock { Text = " | ", Foreground = new SolidColorBrush(Color.FromRgb(120, 120, 120)), FontSize = 11 });
        var termsFooterLink = new TextBlock { Text = "Terms of Use", Foreground = new SolidColorBrush(Color.FromRgb(100, 180, 200)), FontSize = 11, Cursor = Cursors.Hand };
        termsFooterLink.MouseLeftButtonUp += (s, args) => { DocumentViewerDialog.ShowTermsOfUse(this); };
        footerPanel.Children.Add(termsFooterLink);
        footerPanel.Children.Add(new TextBlock { Text = " | ", Foreground = new SolidColorBrush(Color.FromRgb(120, 120, 120)), FontSize = 11 });
        var privacyFooterLink = new TextBlock { Text = "Privacy Policy", Foreground = new SolidColorBrush(Color.FromRgb(100, 180, 200)), FontSize = 11, Cursor = Cursors.Hand };
        privacyFooterLink.MouseLeftButtonUp += (s, args) => { DocumentViewerDialog.ShowPrivacyPolicy(this); };
        footerPanel.Children.Add(privacyFooterLink);
        mainPanel.Children.Add(footerPanel);

        mainBorder.Child = mainPanel;
        createAccountDialog.Content = mainBorder;

        // Allow window dragging
        mainBorder.MouseLeftButtonDown += (s, args) =>
        {
            if (args.ButtonState == MouseButtonState.Pressed)
                createAccountDialog.DragMove();
        };

        createAccountDialog.ShowDialog();

        // After ShowDialog returns, check if Sign In was clicked
        // Use Dispatcher to allow UI to settle before opening next dialog (prevents flicker)
        if (openSignIn)
        {
            Dispatcher.BeginInvoke(new Action(() => ShowJubileeVerseSignInDialog()), System.Windows.Threading.DispatcherPriority.Background);
        }
    }

    private void ProfileSettings_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        NavigateTo("jubilee://settings/profile");
    }

    private void ChangeAvatarButton_Click(object sender, RoutedEventArgs e)
    {
        var openFileDialog = new Microsoft.Win32.OpenFileDialog
        {
            Title = "Select Profile Picture",
            Filter = "Image files (*.jpg, *.jpeg, *.png, *.gif, *.bmp)|*.jpg;*.jpeg;*.png;*.gif;*.bmp|All files (*.*)|*.*",
            FilterIndex = 1
        };

        if (openFileDialog.ShowDialog() == true)
        {
            try
            {
                var sourcePath = openFileDialog.FileName;
                var profilePicturesDir = Services.ProfileAuthService.GetProfilePicturesDirectory();
                var userId = _profileAuthService.CurrentProfile?.UserId ?? "default";
                var extension = System.IO.Path.GetExtension(sourcePath);
                var destFileName = $"{userId}_avatar{extension}";
                var destPath = System.IO.Path.Combine(profilePicturesDir, destFileName);

                // Copy the file to our profile pictures directory
                System.IO.File.Copy(sourcePath, destPath, overwrite: true);

                // Create a file URI for the local image
                var fileUri = new Uri(destPath);

                // Update the avatar image
                var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                bitmap.BeginInit();
                bitmap.UriSource = fileUri;
                bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                bitmap.EndInit();

                ProfileAvatarImage.ImageSource = bitmap;
                ProfilePopupAvatarImage.ImageSource = bitmap;

                // Update profile with new avatar URL
                _profileAuthService.UpdateAvatarUrl(destPath);

                // Also update the nav bar avatar
                ProfileDefaultAvatar.Visibility = Visibility.Collapsed;
                ProfileDefaultIcon.Visibility = Visibility.Collapsed;
                ProfileUserAvatar.Visibility = Visibility.Visible;
            }
            catch (Exception ex)
            {
                JubileeAlertDialog.ShowError(this, "Error", $"Failed to update profile picture: {ex.Message}");
            }
        }
    }

    private async void ProfileRetrySync_Click(object sender, RoutedEventArgs e)
    {
        await _syncEngine.SyncNowAsync();
    }

    private async void ProfileManageAccount_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        await ShowAccountManagementWindowAsync();
    }

    private async Task ShowAccountManagementWindowAsync()
    {
        var goldColor = Color.FromRgb(230, 172, 0);
        var roseColor = Color.FromRgb(233, 69, 96);
        var bgColor = Color.FromRgb(26, 26, 46);
        var cardBgColor = Color.FromRgb(22, 33, 62);
        var textColor = Color.FromRgb(160, 160, 160);
        var borderColor = Color.FromRgb(60, 60, 80);

        var accountWindow = new Window
        {
            Title = "Manage your Jubilee Account",
            Width = 500,
            Height = 550,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new SolidColorBrush(bgColor),
            WindowStyle = WindowStyle.SingleBorderWindow,
            ResizeMode = ResizeMode.NoResize
        };

        var mainScrollViewer = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
        var mainPanel = new StackPanel { Margin = new Thickness(32) };

        // Profile Header Card
        var headerCard = new Border
        {
            Background = new SolidColorBrush(cardBgColor),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(24),
            Margin = new Thickness(0, 0, 0, 24),
            BorderBrush = new SolidColorBrush(borderColor),
            BorderThickness = new Thickness(1)
        };

        var headerPanel = new StackPanel { Orientation = Orientation.Horizontal };

        // Avatar with gradient background
        var avatarBorder = new Border
        {
            Width = 72, Height = 72,
            CornerRadius = new CornerRadius(36),
            Margin = new Thickness(0, 0, 20, 0)
        };
        var gradientBrush = new LinearGradientBrush
        {
            StartPoint = new Point(0, 0),
            EndPoint = new Point(1, 1)
        };
        gradientBrush.GradientStops.Add(new GradientStop(roseColor, 0));
        gradientBrush.GradientStops.Add(new GradientStop(goldColor, 1));
        avatarBorder.Background = gradientBrush;

        // Avatar initial
        var avatarInitial = new TextBlock
        {
            Text = (_profileAuthService.CurrentProfile?.DisplayName?.Substring(0, 1).ToUpper() ?? "?"),
            FontSize = 28,
            FontWeight = FontWeights.Light,
            Foreground = Brushes.White,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        avatarBorder.Child = avatarInitial;

        var profileTextPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        var profileNameText = new TextBlock
        {
            Text = _profileAuthService.CurrentProfile?.DisplayName ?? "User",
            FontSize = 22, FontWeight = FontWeights.SemiBold, Foreground = Brushes.White
        };
        var profileEmailText = new TextBlock
        {
            Text = _profileAuthService.CurrentProfile?.Email ?? "",
            FontSize = 13, Foreground = new SolidColorBrush(textColor),
            Margin = new Thickness(0, 4, 0, 0)
        };
        profileTextPanel.Children.Add(profileNameText);
        profileTextPanel.Children.Add(profileEmailText);
        headerPanel.Children.Add(avatarBorder);
        headerPanel.Children.Add(profileTextPanel);
        headerCard.Child = headerPanel;
        mainPanel.Children.Add(headerCard);

        // Sync Status Section
        var syncSectionTitle = new TextBlock
        {
            Text = "SYNC STATUS",
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(goldColor),
            Margin = new Thickness(0, 0, 0, 12)
        };
        mainPanel.Children.Add(syncSectionTitle);

        var syncCard = new Border
        {
            Background = new SolidColorBrush(cardBgColor),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(20),
            Margin = new Thickness(0, 0, 0, 24),
            BorderBrush = new SolidColorBrush(borderColor),
            BorderThickness = new Thickness(1)
        };

        var syncPanel = new StackPanel();

        // Last sync time
        var lastSyncPanel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 12) };
        lastSyncPanel.Children.Add(new TextBlock
        {
            Text = "Last sync:",
            Foreground = new SolidColorBrush(textColor),
            FontSize = 13,
            Width = 100
        });
        lastSyncPanel.Children.Add(new TextBlock
        {
            Text = _syncEngine.LastSyncTime.HasValue ? _syncEngine.LastSyncTime.Value.ToLocalTime().ToString("g") : "Never",
            Foreground = Brushes.White,
            FontSize = 13
        });
        syncPanel.Children.Add(lastSyncPanel);

        // Sync enabled items
        var syncPrefs = _syncEngine.Preferences;
        var enabledItems = new List<string>();
        if (syncPrefs.SyncBookmarks) enabledItems.Add("Bookmarks");
        if (syncPrefs.SyncHistory) enabledItems.Add("History");
        if (syncPrefs.SyncPasswords) enabledItems.Add("Passwords");
        if (syncPrefs.SyncSettings) enabledItems.Add("Settings");

        var syncingPanel = new StackPanel { Orientation = Orientation.Horizontal };
        syncingPanel.Children.Add(new TextBlock
        {
            Text = "Syncing:",
            Foreground = new SolidColorBrush(textColor),
            FontSize = 13,
            Width = 100
        });
        syncingPanel.Children.Add(new TextBlock
        {
            Text = enabledItems.Count > 0 ? string.Join(", ", enabledItems) : "Nothing enabled",
            Foreground = Brushes.White,
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap
        });
        syncPanel.Children.Add(syncingPanel);

        syncCard.Child = syncPanel;
        mainPanel.Children.Add(syncCard);

        // Account Actions Section
        var actionsSectionTitle = new TextBlock
        {
            Text = "ACCOUNT ACTIONS",
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(goldColor),
            Margin = new Thickness(0, 0, 0, 12)
        };
        mainPanel.Children.Add(actionsSectionTitle);

        var actionsCard = new Border
        {
            Background = new SolidColorBrush(cardBgColor),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(8),
            BorderBrush = new SolidColorBrush(borderColor),
            BorderThickness = new Thickness(1)
        };

        var actionsPanel = new StackPanel();

        // Sync Now button
        var syncNowBtn = CreateAccountActionButton("🔄", "Sync now", "Manually sync your data across devices");
        syncNowBtn.Cursor = Cursors.Hand;
        syncNowBtn.MouseLeftButtonUp += async (s, args) =>
        {
            await _syncEngine.SyncNowAsync();
            MessageBox.Show("Sync completed!", "Sync", MessageBoxButton.OK, MessageBoxImage.Information);
        };
        actionsPanel.Children.Add(syncNowBtn);

        // Manage Sync Settings button
        var manageSyncBtn = CreateAccountActionButton("⚙️", "Manage sync settings", "Choose what to sync across devices");
        manageSyncBtn.Cursor = Cursors.Hand;
        manageSyncBtn.MouseLeftButtonUp += (s, args) =>
        {
            accountWindow.Close();
            NavigateTo("jubilee://settings/sync");
        };
        actionsPanel.Children.Add(manageSyncBtn);

        // Sign Out button
        var signOutBtn = CreateAccountActionButton("🚪", "Sign out", "Sign out of your Jubilee account");
        signOutBtn.Cursor = Cursors.Hand;
        signOutBtn.MouseLeftButtonUp += async (s, args) =>
        {
            var result = MessageBox.Show(
                "Are you sure you want to sign out?",
                "Sign Out", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (result == MessageBoxResult.Yes)
            {
                await _profileAuthService.SignOutAsync();
                UpdateProfileUI();
                UpdateChatPanelAuthState();
                accountWindow.Close();
            }
        };
        actionsPanel.Children.Add(signOutBtn);

        actionsCard.Child = actionsPanel;
        mainPanel.Children.Add(actionsCard);

        mainScrollViewer.Content = mainPanel;
        accountWindow.Content = mainScrollViewer;

        accountWindow.ShowDialog();
    }

    private Border CreateAccountActionButton(string icon, string title, string description)
    {
        var textColor = Color.FromRgb(160, 160, 160);

        var actionBorder = new Border
        {
            Padding = new Thickness(12),
            CornerRadius = new CornerRadius(8),
            Margin = new Thickness(0, 2, 0, 2),
            Background = Brushes.Transparent
        };

        // Hover effect
        actionBorder.MouseEnter += (s, e) => actionBorder.Background = new SolidColorBrush(Color.FromRgb(40, 50, 70));
        actionBorder.MouseLeave += (s, e) => actionBorder.Background = Brushes.Transparent;

        var actionPanel = new StackPanel { Orientation = Orientation.Horizontal };

        var iconText = new TextBlock
        {
            Text = icon,
            FontSize = 20,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 16, 0),
            Width = 28
        };

        var textPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        textPanel.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 14,
            Foreground = Brushes.White
        });
        textPanel.Children.Add(new TextBlock
        {
            Text = description,
            FontSize = 12,
            Foreground = new SolidColorBrush(textColor)
        });

        actionPanel.Children.Add(iconText);
        actionPanel.Children.Add(textPanel);
        actionBorder.Child = actionPanel;

        return actionBorder;
    }

    private Border CreateDeviceCard(ConnectedDevice device, string token, StackPanel parentPanel, Color cardBgColor, Color textColor)
    {
        var deviceCard = new Border
        {
            Background = new SolidColorBrush(cardBgColor),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16),
            Margin = new Thickness(0, 0, 0, 8)
        };

        var devicePanel = new Grid();
        devicePanel.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        devicePanel.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var deviceInfoPanel = new StackPanel();
        var deviceNamePanel = new StackPanel { Orientation = Orientation.Horizontal };
        deviceNamePanel.Children.Add(new TextBlock
        {
            Text = device.DisplayName,
            Foreground = Brushes.White, FontWeight = FontWeights.Medium, FontSize = 14
        });
        if (device.IsCurrent)
        {
            deviceNamePanel.Children.Add(new TextBlock
            {
                Text = " (This device)",
                Foreground = new SolidColorBrush(Color.FromRgb(0, 180, 0)),
                FontSize = 12, VerticalAlignment = VerticalAlignment.Center
            });
        }
        deviceInfoPanel.Children.Add(deviceNamePanel);
        deviceInfoPanel.Children.Add(new TextBlock
        {
            Text = $"{device.Platform ?? ""} {device.PlatformVersion ?? ""} • {device.AppName ?? "Browser"} {device.AppVersion ?? ""}",
            Foreground = new SolidColorBrush(textColor), FontSize = 12, Margin = new Thickness(0, 4, 0, 0)
        });
        deviceInfoPanel.Children.Add(new TextBlock
        {
            Text = $"Last active: {device.LastSeenDisplay}",
            Foreground = new SolidColorBrush(textColor), FontSize = 11, Margin = new Thickness(0, 2, 0, 0)
        });

        Grid.SetColumn(deviceInfoPanel, 0);
        devicePanel.Children.Add(deviceInfoPanel);

        if (!device.IsCurrent)
        {
            var removeBtn = new Button
            {
                Content = "Remove",
                Background = new SolidColorBrush(Color.FromRgb(180, 50, 50)),
                Foreground = Brushes.White,
                BorderThickness = new Thickness(0),
                Padding = new Thickness(12, 6, 12, 6),
                Cursor = Cursors.Hand,
                VerticalAlignment = VerticalAlignment.Center
            };
            removeBtn.Click += async (s, args) =>
            {
                var result = MessageBox.Show($"Remove device '{device.DisplayName}'?", "Remove Device", MessageBoxButton.YesNo, MessageBoxImage.Question);
                if (result == MessageBoxResult.Yes)
                {
                    try
                    {
                        using var httpClient = new System.Net.Http.HttpClient();
                        httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                        var response = await httpClient.DeleteAsync($"https://inspirecodex.com/api/account/devices/{device.Id}");
                        if (response.IsSuccessStatusCode)
                        {
                            parentPanel.Children.Remove(deviceCard);
                        }
                        else
                        {
                            MessageBox.Show("Failed to remove device.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                        }
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            };
            Grid.SetColumn(removeBtn, 1);
            devicePanel.Children.Add(removeBtn);
        }

        deviceCard.Child = devicePanel;
        return deviceCard;
    }

    private void ShowChangePasswordDialog(Window owner, string token)
    {
        var dialog = new Window
        {
            Title = "Change Password",
            Width = 400, Height = 280,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = owner,
            Background = new SolidColorBrush(Color.FromRgb(30, 30, 46)),
            WindowStyle = WindowStyle.ToolWindow,
            ResizeMode = ResizeMode.NoResize
        };

        var panel = new StackPanel { Margin = new Thickness(20) };
        panel.Children.Add(new TextBlock { Text = "Change Password", FontSize = 18, FontWeight = FontWeights.SemiBold, Foreground = Brushes.White, Margin = new Thickness(0, 0, 0, 16) });

        var currentPwdBox = new PasswordBox { Height = 36, Margin = new Thickness(0, 0, 0, 12) };
        var newPwdBox = new PasswordBox { Height = 36, Margin = new Thickness(0, 0, 0, 12) };
        var confirmPwdBox = new PasswordBox { Height = 36, Margin = new Thickness(0, 0, 0, 16) };

        panel.Children.Add(new TextBlock { Text = "Current Password", Foreground = Brushes.White, FontSize = 12, Margin = new Thickness(0, 0, 0, 4) });
        panel.Children.Add(currentPwdBox);
        panel.Children.Add(new TextBlock { Text = "New Password", Foreground = Brushes.White, FontSize = 12, Margin = new Thickness(0, 0, 0, 4) });
        panel.Children.Add(newPwdBox);
        panel.Children.Add(new TextBlock { Text = "Confirm New Password", Foreground = Brushes.White, FontSize = 12, Margin = new Thickness(0, 0, 0, 4) });
        panel.Children.Add(confirmPwdBox);

        var buttonPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var cancelBtn = new Button { Content = "Cancel", Width = 80, Height = 32, Margin = new Thickness(0, 0, 8, 0) };
        cancelBtn.Click += (s, args) => dialog.Close();

        var saveBtn = new Button
        {
            Content = "Change",
            Width = 80, Height = 32,
            Background = new SolidColorBrush(Color.FromRgb(0, 120, 212)),
            Foreground = Brushes.White
        };
        saveBtn.Click += async (s, args) =>
        {
            if (newPwdBox.Password != confirmPwdBox.Password)
            {
                MessageBox.Show("Passwords do not match.", "Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (newPwdBox.Password.Length < 8)
            {
                MessageBox.Show("Password must be at least 8 characters.", "Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                using var httpClient = new System.Net.Http.HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                var payload = System.Text.Json.JsonSerializer.Serialize(new { currentPassword = currentPwdBox.Password, newPassword = newPwdBox.Password });
                var response = await httpClient.PutAsync("https://inspirecodex.com/api/account/password", new System.Net.Http.StringContent(payload, System.Text.Encoding.UTF8, "application/json"));

                if (response.IsSuccessStatusCode)
                {
                    MessageBox.Show("Password changed successfully.", "Success", MessageBoxButton.OK, MessageBoxImage.Information);
                    dialog.Close();
                }
                else
                {
                    var errorJson = await response.Content.ReadAsStringAsync();
                    var errorData = System.Text.Json.JsonSerializer.Deserialize<ApiSuccessResponse>(errorJson, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    MessageBox.Show(errorData?.Error ?? "Failed to change password.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        };

        buttonPanel.Children.Add(cancelBtn);
        buttonPanel.Children.Add(saveBtn);
        panel.Children.Add(buttonPanel);

        dialog.Content = panel;
        dialog.ShowDialog();
    }

    /// <summary>
    /// Shows a themed welcome dialog after entering Demo Mode.
    /// </summary>
    private void ShowDemoModeWelcomeDialog(string userName)
    {
        var dialog = new Window
        {
            Title = "Demo Mode Active",
            Width = 420,
            Height = 240,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            WindowStyle = WindowStyle.None,
            AllowsTransparency = true,
            Background = System.Windows.Media.Brushes.Transparent,
            ResizeMode = ResizeMode.NoResize,
            ShowInTaskbar = false
        };

        var mainBorder = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(28, 28, 51)),
            CornerRadius = new CornerRadius(12),
            BorderBrush = new SolidColorBrush(Color.FromRgb(44, 44, 74)),
            BorderThickness = new Thickness(1),
            Effect = new System.Windows.Media.Effects.DropShadowEffect
            {
                BlurRadius = 32,
                ShadowDepth = 0,
                Color = Colors.Black,
                Opacity = 0.55
            }
        };

        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(48) });
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        // Title bar
        var titleBar = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(32, 32, 58)),
            CornerRadius = new CornerRadius(12, 12, 0, 0),
            BorderBrush = new SolidColorBrush(Color.FromRgb(44, 44, 74)),
            BorderThickness = new Thickness(0, 0, 0, 1)
        };
        titleBar.MouseLeftButtonDown += (s, e) => { if (e.ClickCount == 1) dialog.DragMove(); };

        var titleGrid = new Grid();
        var titleText = new TextBlock
        {
            Text = "Demo Mode Active",
            Foreground = new SolidColorBrush(Color.FromRgb(230, 230, 242)),
            FontWeight = FontWeights.SemiBold,
            FontSize = 14,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(20, 0, 0, 0)
        };
        titleGrid.Children.Add(titleText);
        titleBar.Child = titleGrid;
        Grid.SetRow(titleBar, 0);
        grid.Children.Add(titleBar);

        // Content
        var contentGrid = new Grid { Margin = new Thickness(24, 20, 24, 16) };
        contentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        contentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        // Success icon
        var iconBorder = new Border
        {
            Width = 48,
            Height = 48,
            Background = new SolidColorBrush(Color.FromRgb(42, 42, 67)),
            CornerRadius = new CornerRadius(24),
            VerticalAlignment = VerticalAlignment.Top,
            Margin = new Thickness(0, 0, 16, 0)
        };
        var iconText = new TextBlock
        {
            Text = "\uE73E", // Checkmark icon
            FontFamily = new System.Windows.Media.FontFamily("Segoe MDL2 Assets"),
            FontSize = 22,
            Foreground = new SolidColorBrush(Color.FromRgb(67, 209, 122)),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        iconBorder.Child = iconText;
        Grid.SetColumn(iconBorder, 0);
        contentGrid.Children.Add(iconBorder);

        // Message
        var messagePanel = new StackPanel { VerticalAlignment = VerticalAlignment.Top };
        messagePanel.Children.Add(new TextBlock
        {
            Text = $"Welcome to Jubilee Demo Mode, {userName}!",
            Foreground = new SolidColorBrush(Color.FromRgb(242, 242, 247)),
            FontSize = 15,
            FontWeight = FontWeights.SemiBold,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 12)
        });
        messagePanel.Children.Add(new TextBlock
        {
            Text = "You can now explore all features. Note: Data will not be saved to a server.",
            Foreground = new SolidColorBrush(Color.FromRgb(192, 192, 208)),
            FontSize = 13,
            TextWrapping = TextWrapping.Wrap,
            LineHeight = 20
        });
        Grid.SetColumn(messagePanel, 1);
        contentGrid.Children.Add(messagePanel);

        Grid.SetRow(contentGrid, 1);
        grid.Children.Add(contentGrid);

        // Button area
        var buttonArea = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(26, 26, 46)),
            CornerRadius = new CornerRadius(0, 0, 12, 12),
            Padding = new Thickness(24, 16, 24, 16)
        };
        var buttonPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var okButton = new Button
        {
            Content = "Get Started",
            MinWidth = 120,
            Height = 36,
            Background = new SolidColorBrush(Color.FromRgb(230, 172, 0)),
            Foreground = new SolidColorBrush(Color.FromRgb(28, 28, 51)),
            FontWeight = FontWeights.SemiBold,
            FontSize = 13,
            Cursor = Cursors.Hand,
            BorderThickness = new Thickness(0)
        };
        okButton.Click += (s, e) => dialog.Close();

        // Apply button template for rounded corners
        var buttonTemplate = new ControlTemplate(typeof(Button));
        var borderFactory = new FrameworkElementFactory(typeof(Border));
        borderFactory.SetBinding(Border.BackgroundProperty, new System.Windows.Data.Binding("Background") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
        borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));
        borderFactory.SetValue(Border.PaddingProperty, new Thickness(20, 0, 20, 0));
        var contentPresenterFactory = new FrameworkElementFactory(typeof(ContentPresenter));
        contentPresenterFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
        contentPresenterFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        borderFactory.AppendChild(contentPresenterFactory);
        buttonTemplate.VisualTree = borderFactory;
        okButton.Template = buttonTemplate;

        buttonPanel.Children.Add(okButton);
        buttonArea.Child = buttonPanel;
        Grid.SetRow(buttonArea, 2);
        grid.Children.Add(buttonArea);

        mainBorder.Child = grid;
        dialog.Content = mainBorder;

        // Handle keyboard
        dialog.PreviewKeyDown += (s, e) =>
        {
            if (e.Key == Key.Escape || e.Key == Key.Enter)
            {
                dialog.Close();
                e.Handled = true;
            }
        };

        dialog.ShowDialog();
    }

    private void ProfileSwitchProfile_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;

        // Show profile switcher dialog
        var profiles = _profileAuthService.GetStoredProfiles();
        if (profiles.Count <= 1)
        {
            MessageBox.Show("No other profiles available. Sign in with a different account to add another profile.",
                "Switch Profile", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var switchDialog = new Window
        {
            Title = "Switch Profile",
            Width = 350,
            Height = 300,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new SolidColorBrush(Color.FromRgb(30, 30, 46)),
            WindowStyle = WindowStyle.ToolWindow,
            ResizeMode = ResizeMode.NoResize
        };

        var panel = new StackPanel { Margin = new Thickness(16) };
        panel.Children.Add(new TextBlock
        {
            Text = "Select a profile",
            FontSize = 16,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 0, 0, 16)
        });

        foreach (var profile in profiles)
        {
            var profileBtn = new Button
            {
                Height = 50,
                Margin = new Thickness(0, 0, 0, 8),
                Background = profile.UserId == _profileAuthService.CurrentProfile?.UserId
                    ? new SolidColorBrush(Color.FromRgb(0, 120, 212))
                    : new SolidColorBrush(Color.FromRgb(58, 58, 94)),
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };

            var profilePanel = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            profilePanel.Children.Add(new WpfShapes.Ellipse
            {
                Width = 32,
                Height = 32,
                Fill = new SolidColorBrush(Color.FromRgb(128, 128, 128)),
                Margin = new Thickness(8, 0, 12, 0)
            });
            var textPanel = new StackPanel();
            textPanel.Children.Add(new TextBlock { Text = profile.DisplayName, Foreground = Brushes.White, FontWeight = FontWeights.Medium });
            textPanel.Children.Add(new TextBlock { Text = profile.Email, Foreground = new SolidColorBrush(Color.FromRgb(128, 128, 128)), FontSize = 11 });
            profilePanel.Children.Add(textPanel);
            profileBtn.Content = profilePanel;

            var userId = profile.UserId;
            profileBtn.Click += async (s, args) =>
            {
                switchDialog.Close();
                var success = await _profileAuthService.SwitchProfileAsync(userId);
                if (success)
                {
                    // Reinitialize sync engine with new profile's context
                    await _syncEngine.InitializeAsync();
                    UpdateProfileUI();
                }
            };

            panel.Children.Add(profileBtn);
        }

        // Add new profile button
        var addProfileBtn = new Button
        {
            Content = "+ Add another account",
            Height = 36,
            Margin = new Thickness(0, 8, 0, 0),
            Background = Brushes.Transparent,
            Foreground = new SolidColorBrush(Color.FromRgb(0, 120, 212)),
            BorderThickness = new Thickness(0),
            Cursor = Cursors.Hand,
            HorizontalContentAlignment = HorizontalAlignment.Left,
            Padding = new Thickness(8, 0, 0, 0)
        };
        addProfileBtn.Click += (s, args) =>
        {
            switchDialog.Close();
            ProfileSignIn_Click(sender, e);
        };
        panel.Children.Add(addProfileBtn);

        switchDialog.Content = panel;
        switchDialog.ShowDialog();
    }

    private void ProfileSyncSettings_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        ShowSyncSettingsModal();
    }

    #region Sync Settings Modal

    private bool _isSyncSettingsAnimating;

    // Track current sync state
    private bool _syncBookmarks;
    private bool _syncHistory;
    private bool _syncPasswords;
    private bool _syncAutofill;
    private bool _syncExtensions;
    private bool _syncThemes;
    private bool _syncSettingsOption;

    private void ShowSyncSettingsModal()
    {
        if (_isSyncSettingsAnimating) return;

        // Load current preferences
        var prefs = _syncEngine.Preferences;
        _syncBookmarks = prefs.SyncBookmarks;
        _syncHistory = prefs.SyncHistory;
        _syncPasswords = prefs.SyncPasswords;
        _syncAutofill = prefs.SyncAutofill;
        _syncExtensions = prefs.SyncExtensions;
        _syncThemes = prefs.SyncThemes;
        _syncSettingsOption = prefs.SyncSettings;

        // Update UI to reflect current state
        UpdateSyncCheckboxUI();

        // Set overlay size
        SyncSettingsOverlay.Width = this.ActualWidth;
        SyncSettingsOverlay.Height = this.ActualHeight;

        // Reset transforms for animation
        SyncSettingsScaleTransform.ScaleX = 0.9;
        SyncSettingsScaleTransform.ScaleY = 0.9;
        SyncSettingsTranslateTransform.Y = -20;
        SyncSettingsOverlay.Opacity = 0;

        // Show popup
        SyncSettingsPopup.IsOpen = true;

        // Start animation
        var fadeIn = (System.Windows.Media.Animation.Storyboard)FindResource("SyncSettingsFadeIn");
        _isSyncSettingsAnimating = true;

        EventHandler? completedHandler = null;
        completedHandler = (s, e) =>
        {
            _isSyncSettingsAnimating = false;
            fadeIn.Completed -= completedHandler;
        };
        fadeIn.Completed += completedHandler;
        fadeIn.Begin(this);
    }

    private void HideSyncSettingsModal()
    {
        if (_isSyncSettingsAnimating || !SyncSettingsPopup.IsOpen) return;

        var fadeOut = (System.Windows.Media.Animation.Storyboard)FindResource("SyncSettingsFadeOut");
        _isSyncSettingsAnimating = true;

        EventHandler? completedHandler = null;
        completedHandler = (s, e) =>
        {
            SyncSettingsPopup.IsOpen = false;
            SyncSettingsOverlay.Opacity = 1;
            _isSyncSettingsAnimating = false;
            fadeOut.Completed -= completedHandler;
        };
        fadeOut.Completed += completedHandler;
        fadeOut.Begin(this);
    }

    private void UpdateSyncCheckboxUI()
    {
        // Update checkbox visual states
        SetSyncCheckboxState(SyncBookmarksCheck, SyncBookmarksCheckmark, _syncBookmarks);
        SetSyncCheckboxState(SyncHistoryCheck, SyncHistoryCheckmark, _syncHistory);
        SetSyncCheckboxState(SyncPasswordsCheck, SyncPasswordsCheckmark, _syncPasswords);
        SetSyncCheckboxState(SyncAutofillCheck, SyncAutofillCheckmark, _syncAutofill);
        SetSyncCheckboxState(SyncExtensionsCheck, SyncExtensionsCheckmark, _syncExtensions);
        SetSyncCheckboxState(SyncThemesCheck, SyncThemesCheckmark, _syncThemes);
        SetSyncCheckboxState(SyncSettingsCheck, SyncSettingsCheckmark, _syncSettingsOption);
    }

    private void SetSyncCheckboxState(Border checkbox, TextBlock checkmark, bool isChecked)
    {
        if (isChecked)
        {
            checkbox.Background = new SolidColorBrush(Color.FromRgb(230, 172, 0)); // #E6AC00
            checkbox.BorderBrush = new SolidColorBrush(Color.FromRgb(230, 172, 0));
            checkmark.Visibility = Visibility.Visible;
        }
        else
        {
            checkbox.Background = new SolidColorBrush(Color.FromRgb(42, 42, 78)); // #2a2a4e
            checkbox.BorderBrush = new SolidColorBrush(Color.FromRgb(58, 58, 94)); // #3a3a5e
            checkmark.Visibility = Visibility.Collapsed;
        }
    }

    private void SyncOptionRow_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button button && button.Tag is string option)
        {
            // Toggle the corresponding option
            switch (option)
            {
                case "Bookmarks":
                    _syncBookmarks = !_syncBookmarks;
                    break;
                case "History":
                    _syncHistory = !_syncHistory;
                    break;
                case "Passwords":
                    _syncPasswords = !_syncPasswords;
                    break;
                case "Autofill":
                    _syncAutofill = !_syncAutofill;
                    break;
                case "Extensions":
                    _syncExtensions = !_syncExtensions;
                    break;
                case "Themes":
                    _syncThemes = !_syncThemes;
                    break;
                case "Settings":
                    _syncSettingsOption = !_syncSettingsOption;
                    break;
            }

            // Update UI
            UpdateSyncCheckboxUI();
        }
    }

    private void SyncSettingsOverlay_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.OriginalSource == SyncSettingsOverlay)
        {
            HideSyncSettingsModal();
        }
    }

    private void SyncSettingsCloseButton_Click(object sender, RoutedEventArgs e)
    {
        HideSyncSettingsModal();
    }

    private void SyncSettingsCancelButton_Click(object sender, RoutedEventArgs e)
    {
        HideSyncSettingsModal();
    }

    private async void SyncSettingsSaveButton_Click(object sender, RoutedEventArgs e)
    {
        // Save preferences
        var newPrefs = new SyncPreferences
        {
            SyncBookmarks = _syncBookmarks,
            SyncHistory = _syncHistory,
            SyncPasswords = _syncPasswords,
            SyncAutofill = _syncAutofill,
            SyncExtensions = _syncExtensions,
            SyncThemes = _syncThemes,
            SyncSettings = _syncSettingsOption
        };

        await _syncEngine.UpdatePreferencesAsync(newPrefs);
        HideSyncSettingsModal();
    }

    #endregion

    private void ProfileSignOut_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;

        ShowModal(
            "Sign Out",
            "Are you sure you want to sign out?\n\nYour local data will be kept, but syncing will stop.",
            ModalType.Warning,
            "Sign Out",
            async () =>
            {
                // Immediately stop sync and sign out
                _syncEngine.StopSyncTimer();
                await _profileAuthService.SignOutAsync();

                // Force immediate UI update on the UI thread
                await Dispatcher.InvokeAsync(() =>
                {
                    // Update all profile-related UI elements
                    UpdateProfileUI();

                    // Update chat panel state
                    UpdateChatPanelAuthState();

                    // Update sidebar chat state if open
                    if (_isSidebarChatOpen)
                    {
                        // Clear sidebar chat welcome state for signed out user
                        SidebarChatWelcome.Visibility = Visibility.Visible;
                    }

                    // Close any open settings panels that show profile info
                    if (ModalOverlay.Visibility == Visibility.Visible)
                    {
                        HideModal();
                    }
                });
            },
            "Cancel",
            null);
    }

    #endregion

    #region Sidebar Rail Panel

    private bool _isSidebarOpen = false;

    private void SidebarToggleButton_Checked(object sender, RoutedEventArgs e)
    {
        OpenSidebarRail();
    }

    private void SidebarToggleButton_Unchecked(object sender, RoutedEventArgs e)
    {
        CloseSidebarRail();
    }

    private bool _isSidebarAnimating;

    private void OpenSidebarRail()
    {
        if (_isSidebarAnimating) return;

        _isSidebarOpen = true;
        SidebarRailPanel.Visibility = Visibility.Visible;
        SidebarRailColumn.Width = new GridLength(48);
        SidebarToggleButton.ToolTip = "Hide Sidebar";

        // Play slide-in animation
        var slideIn = (System.Windows.Media.Animation.Storyboard)FindResource("SidebarSlideIn");
        _isSidebarAnimating = true;
        slideIn.Completed += (s, e) => _isSidebarAnimating = false;
        slideIn.Begin(this);
    }

    private void CloseSidebarRail()
    {
        if (_isSidebarAnimating) return;

        _isSidebarOpen = false;
        SidebarToggleButton.ToolTip = "Show Sidebar";

        // Also close sidebar chat panel if open
        if (_isSidebarChatOpen)
        {
            CloseSidebarChat();
        }

        // Also close right-side chat panel if open
        if (_isChatPanelOpen)
        {
            CloseChatPanel();
        }

        // Play slide-out animation
        var slideOut = (System.Windows.Media.Animation.Storyboard)FindResource("SidebarSlideOut");
        _isSidebarAnimating = true;
        slideOut.Completed += (s, e) =>
        {
            SidebarRailPanel.Visibility = Visibility.Collapsed;
            SidebarRailColumn.Width = new GridLength(0);
            _isSidebarAnimating = false;
        };
        slideOut.Begin(this);
    }

    private void SidebarChatButton_Click(object sender, RoutedEventArgs e)
    {
        // Toggle sidebar chat panel
        if (_isSidebarChatOpen)
        {
            CloseSidebarChat();
            SidebarChatButton.Tag = null;
        }
        else
        {
            OpenSidebarChat();
            SidebarChatButton.Tag = "Active";
        }
    }

    private void SidebarHistoryButton_Click(object sender, RoutedEventArgs e)
    {
        // Open history panel
        HistoryButton_Click(sender, e);
    }

    private void SidebarBookmarksButton_Click(object sender, RoutedEventArgs e)
    {
        // Open bookmarks panel
        BookmarksButton_Click(sender, e);
    }

    #endregion

    #region Sidebar Chat Panel

    private bool _isSidebarChatOpen = false;
    private List<ChatMessage> _sidebarChatMessages = new List<ChatMessage>();
    private string _sidebarChatSessionId = string.Empty;
    private string _currentPageContext = string.Empty;
    private string _currentPageUrl = string.Empty;
    private const double SidebarChatPanelWidth = 320;

    private void OpenSidebarChat()
    {
        _isSidebarChatOpen = true;

        // Close other sidebar panels
        if (SidePanel.Visibility == Visibility.Visible)
        {
            SidePanel.Visibility = Visibility.Collapsed;
        }
        if (TodoPanel.Visibility == Visibility.Visible)
        {
            CloseTodoPanel();
        }

        // Show sidebar chat panel
        SidebarChatPanel.Visibility = Visibility.Visible;
        SidePanelColumn.Width = new GridLength(SidebarChatPanelWidth);

        // Update active indicator
        SidebarChatActiveIndicator.Visibility = Visibility.Visible;

        // Initialize session if needed
        if (string.IsNullOrEmpty(_sidebarChatSessionId))
        {
            _sidebarChatSessionId = Guid.NewGuid().ToString("N");
        }

        // Sync with current page context
        SyncPageContext();

        // Load avatar
        LoadSidebarChatAvatar();

        // Focus input
        SidebarChatInputBox.Focus();
    }

    private void CloseSidebarChat()
    {
        _isSidebarChatOpen = false;
        SidebarChatPanel.Visibility = Visibility.Collapsed;
        SidePanelColumn.Width = new GridLength(0);
        SidebarChatActiveIndicator.Visibility = Visibility.Collapsed;
        SidebarChatButton.Tag = null;
    }

    private void CloseSidebarChat_Click(object sender, RoutedEventArgs e)
    {
        CloseSidebarChat();
    }

    private void SyncPageContext()
    {
        // Get current tab's URL and title
        var currentTab = GetCurrentTab();
        if (currentTab != null && !string.IsNullOrEmpty(currentTab.Url))
        {
            _currentPageUrl = currentTab.Url;
            _currentPageContext = currentTab.Title ?? "Current page";

            // Show context bar
            SidebarChatContextBar.Visibility = Visibility.Visible;
            SidebarChatContextTitle.Text = _currentPageContext;
        }
        else
        {
            _currentPageUrl = string.Empty;
            _currentPageContext = string.Empty;
            SidebarChatContextBar.Visibility = Visibility.Collapsed;
        }
    }

    private void SidebarChatContextClear_Click(object sender, RoutedEventArgs e)
    {
        _currentPageUrl = string.Empty;
        _currentPageContext = string.Empty;
        SidebarChatContextBar.Visibility = Visibility.Collapsed;
    }

    private async void LoadSidebarChatAvatar()
    {
        try
        {
            var imageUrl = "https://jubileeverse.com/assets/images/jubilee-avatar.png";
            var bitmap = new System.Windows.Media.Imaging.BitmapImage();
            bitmap.BeginInit();
            bitmap.UriSource = new Uri(imageUrl);
            bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
            bitmap.EndInit();

            SidebarChatAvatarBrush.ImageSource = bitmap;
            SidebarChatAvatarContainer.Visibility = Visibility.Visible;
            SidebarChatAvatarFallback.Visibility = Visibility.Collapsed;
        }
        catch
        {
            SidebarChatAvatarContainer.Visibility = Visibility.Collapsed;
            SidebarChatAvatarFallback.Visibility = Visibility.Visible;
        }
    }

    private void SidebarChatInputBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && !string.IsNullOrWhiteSpace(SidebarChatInputBox.Text))
        {
            SendSidebarChatMessage();
            e.Handled = true;
        }
    }

    private void SidebarChatInputBox_GotFocus(object sender, RoutedEventArgs e)
    {
        SidebarChatInputPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void SidebarChatInputBox_LostFocus(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(SidebarChatInputBox.Text))
        {
            SidebarChatInputPlaceholder.Visibility = Visibility.Visible;
        }
    }

    private void SidebarChatSendButton_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(SidebarChatInputBox.Text))
        {
            SendSidebarChatMessage();
        }
    }

    private async void SendSidebarChatMessage()
    {
        if (!_profileAuthService.IsSignedIn)
        {
            ShowJubileeVerseSignInDialog();
            return;
        }

        var userMessage = SidebarChatInputBox.Text.Trim();
        if (string.IsNullOrEmpty(userMessage)) return;

        // Clear input
        SidebarChatInputBox.Text = string.Empty;

        // Hide welcome message on first message
        SidebarChatWelcome.Visibility = Visibility.Collapsed;

        // Add user message to UI
        AddSidebarChatMessage(userMessage, "user");

        // Store message
        _sidebarChatMessages.Add(new ChatMessage
        {
            Role = "user",
            Content = userMessage,
            Timestamp = DateTime.UtcNow
        });

        // Show typing indicator
        var typingIndicator = CreateSidebarTypingIndicator();
        SidebarChatMessagesPanel.Children.Add(typingIndicator);
        ScrollSidebarChatToBottom();

        try
        {
            string response;

            if (_openAIChatService != null)
            {
                // Build context-aware message
                var contextMessage = userMessage;
                if (!string.IsNullOrEmpty(_currentPageContext) && !string.IsNullOrEmpty(_currentPageUrl))
                {
                    contextMessage = $"[Context: The user is viewing a page titled \"{_currentPageContext}\" at URL: {_currentPageUrl}]\n\nUser question: {userMessage}";
                }

                // Convert conversation history to DTOs
                var conversationHistory = _sidebarChatMessages
                    .Select(m => new ChatMessageDto { Role = m.Role, Content = m.Content })
                    .ToList();

                var chatResponse = await _openAIChatService.SendMessageAsync(conversationHistory, contextMessage);

                if (chatResponse.Success)
                {
                    response = chatResponse.Message;
                }
                else
                {
                    response = chatResponse.ErrorMessage ?? "Sorry, I couldn't process your request. Please try again.";
                }
            }
            else
            {
                await Task.Delay(500);
                response = GetSidebarPlaceholderResponse(userMessage);
            }

            // Remove typing indicator
            SidebarChatMessagesPanel.Children.Remove(typingIndicator);

            // Add assistant response to UI
            AddSidebarChatMessage(response, "assistant");

            // Store response
            _sidebarChatMessages.Add(new ChatMessage
            {
                Role = "assistant",
                Content = response,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (RateLimitException ex)
        {
            SidebarChatMessagesPanel.Children.Remove(typingIndicator);
            AddSidebarChatMessage($"I'm receiving too many requests right now. Please try again in {ex.RetryAfter} seconds.", "assistant");
        }
        catch (Exception ex)
        {
            SidebarChatMessagesPanel.Children.Remove(typingIndicator);
            AddSidebarChatMessage($"Sorry, an error occurred: {ex.Message}", "assistant");
        }

        ScrollSidebarChatToBottom();
    }

    private void AddSidebarChatMessage(string message, string role)
    {
        var isUser = role == "user";
        var messageColor = isUser ? Color.FromRgb(230, 172, 0) : Color.FromRgb(26, 26, 46); // Gold for user, dark for assistant
        var textColor = isUser ? Color.FromRgb(28, 28, 51) : Colors.White;
        var alignment = isUser ? HorizontalAlignment.Right : HorizontalAlignment.Left;
        var margin = isUser ? new Thickness(40, 0, 0, 8) : new Thickness(0, 0, 40, 8);

        var messageBorder = new Border
        {
            Background = new SolidColorBrush(messageColor),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(12, 8, 12, 8),
            HorizontalAlignment = alignment,
            Margin = margin,
            MaxWidth = 240
        };

        var messageText = new TextBlock
        {
            Text = message,
            TextWrapping = TextWrapping.Wrap,
            Foreground = new SolidColorBrush(textColor),
            FontSize = 13,
            LineHeight = 18
        };

        messageBorder.Child = messageText;
        SidebarChatMessagesPanel.Children.Add(messageBorder);
    }

    private Border CreateSidebarTypingIndicator()
    {
        var border = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(26, 26, 46)),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(16, 10, 16, 10),
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 0, 40, 8)
        };

        var panel = new StackPanel { Orientation = Orientation.Horizontal };

        for (int i = 0; i < 3; i++)
        {
            var dot = new WpfShapes.Ellipse
            {
                Width = 6,
                Height = 6,
                Fill = new SolidColorBrush(Color.FromRgb(128, 128, 144)),
                Margin = new Thickness(i > 0 ? 3 : 0, 0, 0, 0)
            };
            panel.Children.Add(dot);
        }

        border.Child = panel;
        return border;
    }

    private void ScrollSidebarChatToBottom()
    {
        SidebarChatMessagesScroller.ScrollToEnd();
    }

    private string GetSidebarPlaceholderResponse(string userMessage)
    {
        var lowerMessage = userMessage.ToLower();

        if (!string.IsNullOrEmpty(_currentPageContext))
        {
            return $"I can see you're viewing \"{_currentPageContext}\". The AI integration is being finalized. Soon I'll be able to answer questions about this page and help you explore related Biblical content!";
        }

        if (lowerMessage.Contains("hello") || lowerMessage.Contains("hi"))
        {
            return "Hello! I'm Jubilee Inspire. How can I help you explore the page you're viewing?";
        }

        return "Thank you for your message. The Jubilee Inspire AI is being set up. Soon I'll be able to help you understand the page you're viewing and find related Biblical content!";
    }

    /// <summary>
    /// Updates the sidebar chat context when the active tab changes.
    /// </summary>
    private void UpdateSidebarChatContext()
    {
        if (_isSidebarChatOpen)
        {
            SyncPageContext();
        }
    }

    #endregion

    #region Todo Panel

    private bool _isTodoPanelOpen = false;
    private List<TodoItem> _todoItems = new();

    private void SidebarTodoButton_Click(object sender, RoutedEventArgs e)
    {
        // Toggle todo panel from sidebar
        if (_isTodoPanelOpen)
        {
            CloseTodoPanel();
            SidebarTodoButton.Tag = null; // Remove active state
        }
        else
        {
            OpenTodoPanel();
            SidebarTodoButton.Tag = "Active"; // Set active state
        }
    }

    private async void OpenTodoPanel()
    {
        _isTodoPanelOpen = true;

        // Close other panels if open
        if (SidePanel.Visibility == Visibility.Visible)
        {
            SidePanel.Visibility = Visibility.Collapsed;
            SidePanelColumn.Width = new GridLength(0);
        }

        TodoPanel.Visibility = Visibility.Visible;
        TodoPanelSplitter.Visibility = Visibility.Visible;
        TodoPanelColumn.Width = new GridLength(320);
        TodoSplitterColumn.Width = new GridLength(4);
        SidebarTodoActiveIndicator.Visibility = Visibility.Visible;

        // Load todos from API
        await LoadTodosAsync();
    }

    private void CloseTodoPanel()
    {
        _isTodoPanelOpen = false;
        TodoPanel.Visibility = Visibility.Collapsed;
        TodoPanelSplitter.Visibility = Visibility.Collapsed;
        TodoPanelColumn.Width = new GridLength(0);
        TodoSplitterColumn.Width = new GridLength(0);
        SidebarTodoActiveIndicator.Visibility = Visibility.Collapsed;
        SidebarTodoButton.Tag = null;
    }

    private void CloseTodoPanel_Click(object sender, RoutedEventArgs e)
    {
        CloseTodoPanel();
    }

    private async Task LoadTodosAsync()
    {
        try
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("Accept", "application/json");

            // Get current user email if logged in
            var userEmail = _profileAuthService.CurrentProfile?.Email ?? "";
            if (string.IsNullOrEmpty(userEmail))
            {
                _todoItems = new List<TodoItem>();
                TodoItemsControl.ItemsSource = _todoItems;
                return;
            }

            var response = await client.GetAsync($"{_apiBaseUrl}/api/todos?email={Uri.EscapeDataString(userEmail)}");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                _todoItems = System.Text.Json.JsonSerializer.Deserialize<List<TodoItem>>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<TodoItem>();
                TodoItemsControl.ItemsSource = _todoItems;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading todos: {ex.Message}");
            _todoItems = new List<TodoItem>();
            TodoItemsControl.ItemsSource = _todoItems;
        }
    }

    private async void AddTodoButton_Click(object sender, RoutedEventArgs e)
    {
        await AddNewTodoAsync();
    }

    private async void NewTodoTextBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            await AddNewTodoAsync();
        }
    }

    private async Task AddNewTodoAsync()
    {
        var title = NewTodoTextBox.Text?.Trim();
        if (string.IsNullOrEmpty(title)) return;

        var userEmail = _profileAuthService.CurrentProfile?.Email ?? "";
        if (string.IsNullOrEmpty(userEmail))
        {
            ShowModal("Sign In Required", "Please sign in to add todos.", ModalType.Information);
            return;
        }

        try
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("Accept", "application/json");

            var todo = new { title = title, email = userEmail };
            var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(todo), System.Text.Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"{_apiBaseUrl}/api/todos", content);
            if (response.IsSuccessStatusCode)
            {
                NewTodoTextBox.Text = "";
                await LoadTodosAsync();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error adding todo: {ex.Message}");
        }
    }

    private async void TodoCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        if (sender is CheckBox checkBox && checkBox.DataContext is TodoItem todo)
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("Accept", "application/json");

                var update = new { isCompleted = todo.IsCompleted };
                var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(update), System.Text.Encoding.UTF8, "application/json");

                await client.PutAsync($"{_apiBaseUrl}/api/todos/{todo.Id}", content);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error updating todo: {ex.Message}");
            }
        }
    }

    private async void DeleteTodoButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button button && button.Tag is int todoId)
        {
            try
            {
                using var client = new HttpClient();
                await client.DeleteAsync($"{_apiBaseUrl}/api/todos/{todoId}");
                await LoadTodosAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error deleting todo: {ex.Message}");
            }
        }
    }

    #endregion

    #region Jubilee Chat Panel

    private bool _isChatPanelOpen = false;
    private const double ChatPanelDefaultWidth = 380;
    private const double ChatPanelMinWidth = 300;
    private const double ChatPanelMaxWidth = 600;
    private List<ChatMessage> _chatMessages = new List<ChatMessage>();
    private string _chatSessionId = string.Empty;

    private class ChatMessage
    {
        public string Role { get; set; } = string.Empty; // "user" or "assistant"
        public string Content { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    private void ChatButton_Click(object sender, RoutedEventArgs e)
    {
        // Close other popups
        MainMenuPopup.IsOpen = false;
        ProfilePopup.IsOpen = false;

        if (_isChatPanelOpen)
        {
            CloseChatPanel();
        }
        else
        {
            OpenChatPanel();
        }
    }

    private void OpenChatPanel()
    {
        _isChatPanelOpen = true;

        // Check authentication state
        UpdateChatPanelAuthState();

        // Load Jubilee avatar image from web
        LoadJubileeAvatar();

        // Update chat icon state immediately
        ChatActiveIndicator.Visibility = Visibility.Visible;
        ChatIcon.Foreground = new SolidColorBrush(Color.FromRgb(0, 191, 255)); // Cyan when active

        // Update sidebar chat button state
        SidebarChatButton.Tag = "Active";
        SidebarChatActiveIndicator.Visibility = Visibility.Visible;

        // Initialize session if not already
        if (string.IsNullOrEmpty(_chatSessionId))
        {
            _chatSessionId = Guid.NewGuid().ToString("N");
        }

        // Start the fade-to-black transition sequence
        StartChatPanelOpenTransition();
    }

    private void StartChatPanelOpenTransition()
    {
        // Show the overlay and make it block input
        FadeOverlay.Visibility = Visibility.Visible;
        FadeOverlay.Opacity = 0;
        FadeOverlay.IsHitTestVisible = true;

        // Phase 1: Fade to black (0.5 seconds - 50% faster)
        var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(500),
            EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseInOut }
        };

        fadeInAnimation.Completed += (s, e) =>
        {
            // Phase 2: While blacked out, set up and slide open the chat panel
            ChatSplitter.Visibility = Visibility.Visible;
            ChatPanel.Visibility = Visibility.Visible;
            ChatPanelColumn.MinWidth = ChatPanelMinWidth;
            ChatPanelColumn.MaxWidth = ChatPanelMaxWidth;
            ChatSplitterColumn.Width = new GridLength(4);

            // Slide animation for the panel (150ms - 50% faster)
            var slideAnimation = new System.Windows.Media.Animation.DoubleAnimation
            {
                From = 0,
                To = ChatPanelDefaultWidth,
                Duration = TimeSpan.FromMilliseconds(150),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };

            var proxy = new AnimationProxy { Value = 0 };
            slideAnimation.Completed += (s2, e2) =>
            {
                ChatPanelColumn.Width = new GridLength(ChatPanelDefaultWidth);

                // Phase 3: Fade out the overlay (0.5 seconds - 50% faster)
                var fadeOutAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 1,
                    To = 0,
                    Duration = TimeSpan.FromMilliseconds(500),
                    EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseInOut }
                };

                fadeOutAnimation.Completed += (s3, e3) =>
                {
                    // Hide overlay and restore interaction
                    FadeOverlay.Visibility = Visibility.Collapsed;
                    FadeOverlay.IsHitTestVisible = false;

                    // Focus the profile image area
                    ChatWelcomeMessage.Focus();
                };

                FadeOverlay.BeginAnimation(System.Windows.UIElement.OpacityProperty, fadeOutAnimation);
            };

            proxy.ValueChanged += (s2, e2) =>
            {
                ChatPanelColumn.Width = new GridLength(proxy.Value);
            };

            proxy.BeginAnimation(AnimationProxy.ValueProperty, slideAnimation);
        };

        FadeOverlay.BeginAnimation(System.Windows.UIElement.OpacityProperty, fadeInAnimation);
    }

    private bool _jubileeAvatarLoaded = false;
    private void LoadJubileeAvatar()
    {
        if (_jubileeAvatarLoaded) return;

        try
        {
            // Load Jubilee avatar from JubileeVerse.com
            var avatarUri = new Uri("https://www.jubileeverse.com/images/personas/jubilee.png");
            var bitmap = new System.Windows.Media.Imaging.BitmapImage();
            bitmap.BeginInit();
            bitmap.UriSource = avatarUri;
            bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
            bitmap.EndInit();

            bitmap.DownloadCompleted += (s, e) =>
            {
                Dispatcher.Invoke(() =>
                {
                    ChatAvatarBrush.ImageSource = bitmap;
                    ChatAvatarImageContainer.Visibility = Visibility.Visible;
                    ChatAvatarFallback.Visibility = Visibility.Collapsed;
                    _jubileeAvatarLoaded = true;
                });
            };

            bitmap.DownloadFailed += (s, e) =>
            {
                // Keep showing fallback icon
                System.Diagnostics.Debug.WriteLine($"Failed to load Jubilee avatar: {e.ErrorException?.Message}");
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading Jubilee avatar: {ex.Message}");
            // Keep showing fallback icon
        }
    }

    private void CloseChatPanel()
    {
        _isChatPanelOpen = false;

        // Update chat icon state immediately
        ChatActiveIndicator.Visibility = Visibility.Collapsed;
        UpdateChatIconColor(); // Reset to mode-appropriate color

        // Update sidebar chat button state
        SidebarChatButton.Tag = null;
        SidebarChatActiveIndicator.Visibility = Visibility.Collapsed;

        // Start the fade-to-black transition sequence for closing
        StartChatPanelCloseTransition();
    }

    private void StartChatPanelCloseTransition()
    {
        // Show the overlay and make it block input
        FadeOverlay.Visibility = Visibility.Visible;
        FadeOverlay.Opacity = 0;
        FadeOverlay.IsHitTestVisible = true;

        // Phase 1: Fade to black (0.5 seconds - 50% faster)
        var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(500),
            EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseInOut }
        };

        fadeInAnimation.Completed += (s, e) =>
        {
            // Phase 2: While blacked out, slide close the chat panel
            var currentWidth = ChatPanelColumn.ActualWidth > 0 ? ChatPanelColumn.ActualWidth : ChatPanelDefaultWidth;

            // Slide animation (150ms - 50% faster)
            var slideAnimation = new System.Windows.Media.Animation.DoubleAnimation
            {
                From = currentWidth,
                To = 0,
                Duration = TimeSpan.FromMilliseconds(150),
                EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn }
            };

            var proxy = new AnimationProxy { Value = currentWidth };
            slideAnimation.Completed += (s2, e2) =>
            {
                // Hide the chat panel and splitter
                ChatSplitter.Visibility = Visibility.Collapsed;
                ChatPanel.Visibility = Visibility.Collapsed;

                // Reset column widths
                ChatSplitterColumn.Width = new GridLength(0);
                ChatPanelColumn.Width = new GridLength(0);
                ChatPanelColumn.MinWidth = 0;
                ChatPanelColumn.MaxWidth = double.PositiveInfinity;

                // Phase 3: Fade out the overlay (0.5 seconds - 50% faster)
                var fadeOutAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 1,
                    To = 0,
                    Duration = TimeSpan.FromMilliseconds(500),
                    EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseInOut }
                };

                fadeOutAnimation.Completed += (s3, e3) =>
                {
                    // Hide overlay and restore interaction
                    FadeOverlay.Visibility = Visibility.Collapsed;
                    FadeOverlay.IsHitTestVisible = false;
                };

                FadeOverlay.BeginAnimation(System.Windows.UIElement.OpacityProperty, fadeOutAnimation);
            };

            proxy.ValueChanged += (s2, e2) =>
            {
                if (proxy.Value >= 0)
                {
                    ChatPanelColumn.Width = new GridLength(proxy.Value);
                }
            };

            proxy.BeginAnimation(AnimationProxy.ValueProperty, slideAnimation);
        };

        FadeOverlay.BeginAnimation(System.Windows.UIElement.OpacityProperty, fadeInAnimation);
    }

    // Helper class for animating GridLength via a double proxy
    private class AnimationProxy : System.Windows.FrameworkElement
    {
        public static readonly DependencyProperty ValueProperty =
            DependencyProperty.Register("Value", typeof(double), typeof(AnimationProxy),
                new PropertyMetadata(0.0, OnValueChanged));

        public double Value
        {
            get => (double)GetValue(ValueProperty);
            set => SetValue(ValueProperty, value);
        }

        public event EventHandler? ValueChanged;

        private static void OnValueChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        {
            ((AnimationProxy)d).ValueChanged?.Invoke(d, EventArgs.Empty);
        }
    }

    private void ChatCloseButton_MouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine("ChatCloseButton clicked!");

        // Directly close the chat panel without animation for reliability
        _isChatPanelOpen = false;
        ChatActiveIndicator.Visibility = Visibility.Collapsed;
        UpdateChatIconColor();

        // Hide the panel directly
        ChatSplitter.Visibility = Visibility.Collapsed;
        ChatPanel.Visibility = Visibility.Collapsed;
        ChatSplitterColumn.Width = new GridLength(0);
        ChatPanelColumn.Width = new GridLength(0);
        ChatPanelColumn.MinWidth = 0;
        ChatPanelColumn.MaxWidth = double.PositiveInfinity;

        // Make sure fade overlay is hidden
        FadeOverlay.Visibility = Visibility.Collapsed;
        FadeOverlay.IsHitTestVisible = false;

        e.Handled = true;
    }

    private void ChatCloseButton_MouseEnter(object sender, System.Windows.Input.MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = new SolidColorBrush(Color.FromRgb(0x33, 0x33, 0x33));
            if (border.Child is TextBlock textBlock)
            {
                textBlock.Foreground = new SolidColorBrush(Color.FromRgb(0xE6, 0xAC, 0x00)); // Gold
                textBlock.FontWeight = FontWeights.Bold;
            }
        }
    }

    private void ChatCloseButton_MouseLeave(object sender, System.Windows.Input.MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = new SolidColorBrush(Color.FromRgb(0x22, 0x22, 0x22));
            if (border.Child is TextBlock textBlock)
            {
                textBlock.Foreground = new SolidColorBrush(Color.FromRgb(0x88, 0x88, 0x88)); // Gray
                textBlock.FontWeight = FontWeights.Normal;
            }
        }
    }

    private void UpdateChatPanelAuthState()
    {
        // Input is always enabled - auth check happens on send
        // This allows users to type their question first, then sign in when prompted

        if (_profileAuthService.IsSignedIn)
        {
            // User is signed in - show their info
            ChatUserStatus.Text = _profileAuthService.CurrentProfile?.DisplayName ?? "Connected";

            // Show user avatar in top bar, hide profile icon
            if (!string.IsNullOrEmpty(_profileAuthService.CurrentProfile?.AvatarUrl))
            {
                try
                {
                    ChatUserAvatarImage.ImageSource = new System.Windows.Media.Imaging.BitmapImage(new Uri(_profileAuthService.CurrentProfile.AvatarUrl));
                    ChatUserAvatar.Visibility = Visibility.Visible;
                    ChatProfileIcon.Visibility = Visibility.Collapsed;
                }
                catch
                {
                    ChatUserAvatar.Visibility = Visibility.Collapsed;
                    ChatProfileIcon.Visibility = Visibility.Visible;
                }
            }
            else
            {
                ChatUserAvatar.Visibility = Visibility.Collapsed;
                ChatProfileIcon.Visibility = Visibility.Visible;
            }
        }
        else
        {
            // User is not signed in - input still enabled, auth prompt on send
            ChatUserStatus.Text = "";
            ChatUserAvatar.Visibility = Visibility.Collapsed;
            ChatProfileIcon.Visibility = Visibility.Visible;
        }
    }

    private void ChatSignIn_Click(object sender, RoutedEventArgs e)
    {
        // Open the sign-in dialog
        ShowJubileeVerseSignInDialog();
    }

    private void ChatInputBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && !string.IsNullOrWhiteSpace(ChatInputBox.Text))
        {
            SendChatMessage();
            e.Handled = true;
        }
    }

    private void ChatInputBox_GotFocus(object sender, RoutedEventArgs e)
    {
        // Hide placeholder when textbox gets focus
        ChatInputPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void ChatInputBox_LostFocus(object sender, RoutedEventArgs e)
    {
        // Show placeholder only if textbox is empty when losing focus
        if (string.IsNullOrEmpty(ChatInputBox.Text))
        {
            ChatInputPlaceholder.Visibility = Visibility.Visible;
        }
    }

    private void ChatMessagesPanel_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        // Keep input box at 90% of panel width
        if (ChatInputBorder != null && e.NewSize.Width > 0)
        {
            ChatInputBorder.Width = e.NewSize.Width * 0.9;
        }
    }

    private void ChatSendButton_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(ChatInputBox.Text))
        {
            SendChatMessage();
        }
    }

    private async void SendChatMessage()
    {
        if (!_profileAuthService.IsSignedIn)
        {
            ShowJubileeVerseSignInDialog();
            return;
        }

        var userMessage = ChatInputBox.Text.Trim();
        if (string.IsNullOrEmpty(userMessage)) return;

        // Clear input
        ChatInputBox.Text = string.Empty;

        // Add user message to UI
        AddChatMessageToUI(userMessage, "user");

        // Store message
        _chatMessages.Add(new ChatMessage
        {
            Role = "user",
            Content = userMessage,
            Timestamp = DateTime.UtcNow
        });

        // Show typing indicator
        var typingIndicator = CreateTypingIndicator();
        ChatMessagesPanel.Children.Add(typingIndicator);
        ScrollChatToBottom();

        try
        {
            string response;

            if (_openAIChatService != null)
            {
                // Convert conversation history to DTOs for the API
                var conversationHistory = _chatMessages
                    .Select(m => new ChatMessageDto { Role = m.Role, Content = m.Content })
                    .ToList();

                // Call OpenAI API
                var chatResponse = await _openAIChatService.SendMessageAsync(conversationHistory, userMessage);

                if (chatResponse.Success)
                {
                    response = chatResponse.Message;
                }
                else
                {
                    response = chatResponse.ErrorMessage ?? "Sorry, I couldn't process your request. Please try again.";
                }
            }
            else
            {
                // Fallback to placeholder if service not initialized
                await Task.Delay(500);
                response = GetPlaceholderResponse(userMessage);
            }

            // Remove typing indicator
            ChatMessagesPanel.Children.Remove(typingIndicator);

            // Add assistant response to UI
            AddChatMessageToUI(response, "assistant");

            // Store response
            _chatMessages.Add(new ChatMessage
            {
                Role = "assistant",
                Content = response,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (RateLimitException ex)
        {
            ChatMessagesPanel.Children.Remove(typingIndicator);
            AddChatMessageToUI($"I'm receiving too many requests right now. Please try again in {ex.RetryAfter} seconds.", "assistant");
        }
        catch (Exception ex)
        {
            ChatMessagesPanel.Children.Remove(typingIndicator);
            AddChatMessageToUI($"Sorry, an error occurred: {ex.Message}", "assistant");
        }

        ScrollChatToBottom();
    }

    private void AddChatMessageToUI(string message, string role)
    {
        var isUser = role == "user";
        var messageColor = isUser ? Color.FromRgb(0, 120, 212) : Color.FromRgb(22, 33, 62);
        var textColor = Colors.White;
        var alignment = isUser ? HorizontalAlignment.Right : HorizontalAlignment.Left;
        var margin = isUser ? new Thickness(60, 0, 0, 8) : new Thickness(0, 0, 60, 8);

        var messageBorder = new Border
        {
            Background = new SolidColorBrush(messageColor),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(12, 8, 12, 8),
            HorizontalAlignment = alignment,
            Margin = margin,
            MaxWidth = 280
        };

        var messageText = new TextBlock
        {
            Text = message,
            TextWrapping = TextWrapping.Wrap,
            Foreground = new SolidColorBrush(textColor),
            FontSize = 13,
            LineHeight = 18
        };

        messageBorder.Child = messageText;
        ChatMessagesPanel.Children.Add(messageBorder);
    }

    private Border CreateTypingIndicator()
    {
        var border = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(22, 33, 62)),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(16, 10, 16, 10),
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 0, 60, 8)
        };

        var panel = new StackPanel { Orientation = Orientation.Horizontal };

        for (int i = 0; i < 3; i++)
        {
            var dot = new WpfShapes.Ellipse
            {
                Width = 8,
                Height = 8,
                Fill = new SolidColorBrush(Color.FromRgb(160, 160, 160)),
                Margin = new Thickness(i > 0 ? 4 : 0, 0, 0, 0)
            };
            panel.Children.Add(dot);
        }

        border.Child = panel;
        return border;
    }

    private void ScrollChatToBottom()
    {
        ChatMessagesScroller.ScrollToEnd();
    }

    private string GetPlaceholderResponse(string userMessage)
    {
        // Placeholder responses until real AI integration
        var lowerMessage = userMessage.ToLower();

        if (lowerMessage.Contains("hello") || lowerMessage.Contains("hi") || lowerMessage.Contains("hey"))
        {
            return "Hello! I'm Jubilee Chat, your AI assistant for exploring the WorldWideBibleWeb. How can I help you today?";
        }
        else if (lowerMessage.Contains("bible") || lowerMessage.Contains("scripture"))
        {
            return "I'd be happy to help you explore Biblical content! The WorldWideBibleWeb has a wealth of resources including commentaries, study guides, and multiple Bible translations. What specifically would you like to learn about?";
        }
        else if (lowerMessage.Contains("help"))
        {
            return "I can help you with:\n• Finding Bible passages and verses\n• Exploring theological topics\n• Navigating WorldWideBibleWeb resources\n• Understanding Biblical context\n\nJust ask me anything!";
        }
        else if (lowerMessage.Contains("thank"))
        {
            return "You're welcome! Feel free to ask if you have any more questions.";
        }
        else
        {
            return "Thank you for your message. The Jubilee Chat AI integration is being finalized. Soon I'll be able to provide comprehensive answers about Biblical topics, help you find scriptures, and assist with your spiritual journey. Stay tuned!";
        }
    }

    private void UpdateChatIconColor()
    {
        // Update chat icon color based on current mode (WWW vs WWBW)
        // Chat icon now has a dark circular background, so use yellow/white for contrast
        if (_isChatPanelOpen)
        {
            ChatIcon.Foreground = new SolidColorBrush(Color.FromRgb(0, 191, 255)); // Cyan when active
        }
        else
        {
            // Match the mode colors - icon sits on dark background circle
            if (_currentMode == BrowserMode.JubileeBibles)
            {
                ChatIcon.Foreground = new SolidColorBrush(Color.FromRgb(255, 215, 0)); // Yellow for WWBW
            }
            else
            {
                ChatIcon.Foreground = new SolidColorBrush(Colors.White); // White for WWW
            }
        }
    }

    #endregion

    #region Favorites Bar

    private bool _isFavoritesBarOpen;

    private void JubileeLogoButton_Click(object sender, MouseButtonEventArgs e)
    {
        if (_isFavoritesBarOpen)
        {
            CloseFavoritesBar();
        }
        else
        {
            OpenFavoritesBar();
        }
    }

    private void OpenFavoritesBar()
    {
        _isFavoritesBarOpen = true;
        FavoritesBar.Visibility = Visibility.Visible;
        FavoritesBarRow.Height = new GridLength(28);

        // Reset content opacity to 0 before animation
        FavoritesContent.Opacity = 0;
        FavoritesCloseButton.Opacity = 0;

        // Step 1: Slide down from behind nav bar
        var slideAnimation = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = -28,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(300),
            EasingFunction = new System.Windows.Media.Animation.QuadraticEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
        };

        // Step 2: After slide completes, fade in the text content
        slideAnimation.Completed += (s, e) =>
        {
            var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
            {
                From = 0,
                To = 1,
                Duration = TimeSpan.FromMilliseconds(200),
                EasingFunction = new System.Windows.Media.Animation.QuadraticEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
            };
            FavoritesContent.BeginAnimation(OpacityProperty, fadeInAnimation);
            FavoritesCloseButton.BeginAnimation(OpacityProperty, fadeInAnimation);
        };

        FavoritesBarTransform.BeginAnimation(TranslateTransform.YProperty, slideAnimation);
    }

    private void CloseFavoritesBar()
    {
        _isFavoritesBarOpen = false;

        // Step 1: Fade out the text content first
        var fadeOutAnimation = new System.Windows.Media.Animation.DoubleAnimation
        {
            From = 1,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(200),
            EasingFunction = new System.Windows.Media.Animation.QuadraticEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn }
        };

        // Step 2: After fade completes, slide up into nav bar bottom
        fadeOutAnimation.Completed += (s, e) =>
        {
            var slideAnimation = new System.Windows.Media.Animation.DoubleAnimation
            {
                From = 0,
                To = -28,
                Duration = TimeSpan.FromMilliseconds(300),
                EasingFunction = new System.Windows.Media.Animation.QuadraticEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseIn }
            };

            slideAnimation.Completed += (s2, e2) =>
            {
                FavoritesBar.Visibility = Visibility.Collapsed;
                FavoritesBarRow.Height = new GridLength(0);
            };

            FavoritesBarTransform.BeginAnimation(TranslateTransform.YProperty, slideAnimation);
        };

        FavoritesContent.BeginAnimation(OpacityProperty, fadeOutAnimation);
        FavoritesCloseButton.BeginAnimation(OpacityProperty, fadeOutAnimation);
    }

    private void FavoriteItem_MouseEnter(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = new SolidColorBrush(Color.FromArgb(40, 255, 255, 255)); // Translucent white
        }
    }

    private void FavoriteItem_MouseLeave(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = Brushes.Transparent;
        }
    }

    private void FavoriteItem_Click(object sender, MouseButtonEventArgs e)
    {
        if (sender is Border border && border.Tag is string url)
        {
            NavigateTo(url);
        }
    }

    private void FavoritesCloseButton_MouseEnter(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = new SolidColorBrush(Color.FromArgb(40, 255, 255, 255)); // Translucent white
        }
    }

    private void FavoritesCloseButton_MouseLeave(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = Brushes.Transparent;
        }
    }

    private void FavoritesCloseButton_Click(object sender, MouseButtonEventArgs e)
    {
        CloseFavoritesBar();
    }

    #endregion

    #region Bookmarks Bar

    private bool _isBookmarksBarVisible;

    /// <summary>
    /// Shows or hides the bookmarks bar based on the setting
    /// </summary>
    private void SetBookmarksBarVisible(bool visible)
    {
        _isBookmarksBarVisible = visible;

        if (visible)
        {
            BookmarksBar.Visibility = Visibility.Visible;
            BookmarksBarRow.Height = new GridLength(32);
            RefreshBookmarksBar();
        }
        else
        {
            BookmarksBar.Visibility = Visibility.Collapsed;
            BookmarksBarRow.Height = new GridLength(0);
        }
    }

    /// <summary>
    /// Refreshes the bookmarks bar with current bookmarks
    /// </summary>
    private void RefreshBookmarksBar()
    {
        BookmarksBarItems.Children.Clear();

        // Get all bookmarks (limited to first 15 for the bar)
        var bookmarks = _bookmarkManager.GetBookmarks().Take(15).ToList();

        foreach (var bookmark in bookmarks)
        {
            var itemBorder = new Border
            {
                Background = Brushes.Transparent,
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(8, 4, 8, 4),
                Margin = new Thickness(0, 0, 4, 0),
                Cursor = Cursors.Hand,
                Tag = bookmark.Url
            };

            var stack = new StackPanel { Orientation = Orientation.Horizontal };

            // Favicon or default icon
            var icon = new TextBlock
            {
                Text = "\uE774", // Globe icon
                FontFamily = new FontFamily("Segoe MDL2 Assets"),
                FontSize = 12,
                Foreground = (Brush)FindResource("TextMutedBrush"),
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 6, 0)
            };

            // Title (truncated)
            var title = new TextBlock
            {
                Text = bookmark.Title?.Length > 20 ? bookmark.Title.Substring(0, 17) + "..." : bookmark.Title ?? "Untitled",
                FontSize = 12,
                Foreground = (Brush)FindResource("TextPrimaryBrush"),
                VerticalAlignment = VerticalAlignment.Center
            };

            stack.Children.Add(icon);
            stack.Children.Add(title);
            itemBorder.Child = stack;

            // Set tooltip with full title
            itemBorder.ToolTip = bookmark.Title;

            // Event handlers
            itemBorder.MouseEnter += BookmarkBarItem_MouseEnter;
            itemBorder.MouseLeave += BookmarkBarItem_MouseLeave;
            itemBorder.MouseLeftButtonDown += BookmarkBarItem_Click;

            BookmarksBarItems.Children.Add(itemBorder);
        }

        // If no bookmarks, show a hint
        if (bookmarks.Count == 0)
        {
            var hintText = new TextBlock
            {
                Text = "No bookmarks yet. Click + to add one!",
                FontSize = 12,
                Foreground = (Brush)FindResource("TextMutedBrush"),
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(4, 0, 0, 0)
            };
            BookmarksBarItems.Children.Add(hintText);
        }
    }

    private void BookmarkBarItem_MouseEnter(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = (Brush)FindResource("BgHoverBrush");
        }
    }

    private void BookmarkBarItem_MouseLeave(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = Brushes.Transparent;
        }
    }

    private void BookmarkBarItem_Click(object sender, MouseButtonEventArgs e)
    {
        if (sender is Border border && border.Tag is string url)
        {
            NavigateTo(url);
        }
    }

    private void BookmarksBarAddButton_MouseEnter(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = (Brush)FindResource("BgHoverBrush");
        }
    }

    private void BookmarksBarAddButton_MouseLeave(object sender, MouseEventArgs e)
    {
        if (sender is Border border)
        {
            border.Background = Brushes.Transparent;
        }
    }

    private void BookmarksBarAddButton_Click(object sender, MouseButtonEventArgs e)
    {
        // Add current page to bookmarks
        var currentTab = GetCurrentTab();
        if (currentTab != null && _webViews.TryGetValue(currentTab.Id, out var webView) && webView?.CoreWebView2 != null)
        {
            var url = webView.CoreWebView2.Source;
            var title = webView.CoreWebView2.DocumentTitle;

            if (!string.IsNullOrEmpty(url) && !url.StartsWith("jubilee://"))
            {
                if (_bookmarkManager.IsBookmarked(url))
                {
                    ShowStyledNotification("This page is already bookmarked", "Bookmark", NotificationType.Info);
                }
                else
                {
                    _bookmarkManager.AddBookmark(url, title, _currentMode);
                    RefreshBookmarksBar();
                    ShowStyledNotification($"Added \"{title}\" to bookmarks", "Bookmark Added", NotificationType.Success);
                }
            }
            else if (url?.StartsWith("jubilee://") == true)
            {
                ShowStyledNotification("Internal pages cannot be bookmarked", "Bookmark", NotificationType.Info);
            }
        }
    }

    #endregion

    #region Styled Notification Popups

    /// <summary>
    /// Shows a styled success notification popup matching the Jubilee theme
    /// </summary>
    private void ShowStyledNotification(string message, string title, NotificationType type = NotificationType.Success)
    {
        // Use the same gold color as the Sign In popup buttons (#E6AC00)
        var goldColor = Color.FromRgb(230, 172, 0);
        var goldHover = Color.FromRgb(255, 191, 0);
        var successGreen = Color.FromRgb(76, 175, 80);
        var infoBlue = Color.FromRgb(33, 150, 243);
        var warningOrange = Color.FromRgb(255, 152, 0);
        var errorRed = Color.FromRgb(244, 67, 54);

        var accentColor = type switch
        {
            NotificationType.Success => successGreen,
            NotificationType.Info => infoBlue,
            NotificationType.Warning => warningOrange,
            NotificationType.Error => errorRed,
            _ => successGreen
        };

        var iconText = type switch
        {
            NotificationType.Success => "✓",
            NotificationType.Info => "ℹ",
            NotificationType.Warning => "⚠",
            NotificationType.Error => "✕",
            _ => "✓"
        };

        // Full-screen overlay window that closes when clicking outside the popup
        var notificationDialog = new Window
        {
            Title = title,
            WindowState = WindowState.Maximized,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new SolidColorBrush(Color.FromArgb(120, 0, 0, 0)), // Semi-transparent dark overlay
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            AllowsTransparency = true
        };

        // Create a grid to center the popup content - MUST have a background to receive mouse events
        var overlayGrid = new Grid
        {
            Background = Brushes.Transparent // Required for hit testing - captures mouse clicks
        };

        // Clicking on the overlay (outside the popup) closes it
        overlayGrid.MouseLeftButtonDown += (s, args) =>
        {
            notificationDialog.Close();
        };

        // Main container with gradient background (dark theme)
        // Wider layout for better visual balance
        var mainBorder = new Border
        {
            Width = 360,
            Height = 320,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Background = new LinearGradientBrush
            {
                StartPoint = new Point(0, 0),
                EndPoint = new Point(0, 1),
                GradientStops = new GradientStopCollection
                {
                    new GradientStop(Color.FromRgb(45, 45, 45), 0),
                    new GradientStop(Color.FromRgb(35, 35, 35), 0.5),
                    new GradientStop(Color.FromRgb(28, 28, 28), 1)
                }
            },
            BorderBrush = new SolidColorBrush(goldColor),
            BorderThickness = new Thickness(2),
            CornerRadius = new CornerRadius(16)
        };

        // Prevent clicks on the popup from closing it
        mainBorder.MouseLeftButtonDown += (s, args) => args.Handled = true;

        // Main vertical layout with proportional padding
        var mainPanel = new StackPanel
        {
            VerticalAlignment = VerticalAlignment.Center,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(40, 32, 40, 32)
        };

        // Large checkmark icon with subtle background
        var iconContainer = new Border
        {
            Width = 80,
            Height = 80,
            CornerRadius = new CornerRadius(16),
            Background = new SolidColorBrush(Color.FromArgb(40, 76, 175, 80)),
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 20)
        };
        var iconTextBlock = new TextBlock
        {
            Text = iconText,
            FontSize = 42,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(accentColor),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        iconContainer.Child = iconTextBlock;
        mainPanel.Children.Add(iconContainer);

        // Title text - "Success!" style
        var titleText = new TextBlock
        {
            Text = title,
            FontSize = 24,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(goldColor),
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 10)
        };
        mainPanel.Children.Add(titleText);

        // Message text - centered, lighter color, single line
        var messageText = new TextBlock
        {
            Text = message,
            FontSize = 14,
            Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)),
            TextWrapping = TextWrapping.NoWrap,
            TextAlignment = TextAlignment.Center,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 24)
        };
        mainPanel.Children.Add(messageText);

        // Gold button with content-based width
        var okButtonText = new TextBlock
        {
            Text = "Continue",
            FontSize = 15,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(30, 30, 30)),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        var okButton = new Border
        {
            Width = 140,
            Height = 44,
            CornerRadius = new CornerRadius(10),
            Background = new SolidColorBrush(goldColor),
            HorizontalAlignment = HorizontalAlignment.Center,
            Cursor = Cursors.Hand,
            Child = okButtonText
        };

        okButton.MouseEnter += (s, args) => okButton.Background = new SolidColorBrush(goldHover);
        okButton.MouseLeave += (s, args) => okButton.Background = new SolidColorBrush(goldColor);
        okButton.PreviewMouseLeftButtonDown += (s, args) =>
        {
            args.Handled = true;
            notificationDialog.Close();
        };

        mainPanel.Children.Add(okButton);

        mainBorder.Child = mainPanel;
        overlayGrid.Children.Add(mainBorder);
        notificationDialog.Content = overlayGrid;

        notificationDialog.ShowDialog();
    }

    private enum NotificationType
    {
        Success,
        Info,
        Warning,
        Error
    }

    #endregion

    #region Custom Modal Popup

    public enum ModalType
    {
        Information,
        Warning,
        Error,
        Question,
        Success
    }

    private Action? _modalPrimaryAction;
    private Action? _modalSecondaryAction;
    private bool _isModalAnimating;

    /// <summary>
    /// Shows a custom themed modal popup with a single OK button.
    /// </summary>
    private void ShowModal(string title, string message, ModalType type = ModalType.Information, string primaryButtonText = "OK")
    {
        ShowModal(title, message, type, primaryButtonText, null, null, null);
    }

    /// <summary>
    /// Shows a custom themed modal popup with primary and optional secondary button.
    /// </summary>
    private void ShowModal(string title, string message, ModalType type, string primaryButtonText, Action? primaryAction, string? secondaryButtonText = null, Action? secondaryAction = null)
    {
        if (_isModalAnimating) return;

        // Set title and message
        ModalTitle.Text = title;
        ModalMessage.Text = message;

        // Set icon based on type
        ModalIcon.Text = type switch
        {
            ModalType.Information => "\uE946", // Info
            ModalType.Warning => "\uE7BA",     // Warning
            ModalType.Error => "\uEA39",       // Error
            ModalType.Question => "\uE9CE",    // Question
            ModalType.Success => "\uE73E",     // Checkmark
            _ => "\uE946"
        };

        // Set button text
        ModalPrimaryButtonText.Text = primaryButtonText;
        _modalPrimaryAction = primaryAction;

        // Handle secondary button
        if (!string.IsNullOrEmpty(secondaryButtonText))
        {
            ModalSecondaryButtonText.Text = secondaryButtonText;
            ModalSecondaryButton.Visibility = Visibility.Visible;
            _modalSecondaryAction = secondaryAction;
        }
        else
        {
            ModalSecondaryButton.Visibility = Visibility.Collapsed;
            _modalSecondaryAction = null;
        }

        // Set overlay size to match window
        ModalOverlay.Width = this.ActualWidth;
        ModalOverlay.Height = this.ActualHeight;

        // Reset transforms to initial state for animation
        ModalScaleTransform.ScaleX = 0.9;
        ModalScaleTransform.ScaleY = 0.9;
        ModalTranslateTransform.Y = -20;
        ModalOverlay.Opacity = 0;

        // Show the popup
        ModalPopup.IsOpen = true;

        // Start fade-in animation
        var fadeIn = (System.Windows.Media.Animation.Storyboard)FindResource("ModalFadeIn");
        _isModalAnimating = true;

        // Use a local handler to avoid accumulating event handlers
        EventHandler? completedHandler = null;
        completedHandler = (s, e) =>
        {
            _isModalAnimating = false;
            fadeIn.Completed -= completedHandler;
        };
        fadeIn.Completed += completedHandler;
        fadeIn.Begin(this);
    }

    /// <summary>
    /// Shows a confirmation modal with Yes/No buttons.
    /// </summary>
    private void ShowConfirmModal(string title, string message, Action onConfirm, Action? onCancel = null)
    {
        ShowModal(title, message, ModalType.Question, "Yes", onConfirm, "No", onCancel);
    }

    private void HideModal()
    {
        if (_isModalAnimating || !ModalPopup.IsOpen) return;

        var fadeOut = (System.Windows.Media.Animation.Storyboard)FindResource("ModalFadeOut");
        _isModalAnimating = true;

        // Use a local handler to avoid accumulating event handlers
        EventHandler? completedHandler = null;
        completedHandler = (s, e) =>
        {
            ModalPopup.IsOpen = false;
            ModalOverlay.Opacity = 1; // Reset opacity for next show
            _isModalAnimating = false;
            _modalPrimaryAction = null;
            _modalSecondaryAction = null;
            fadeOut.Completed -= completedHandler;
        };
        fadeOut.Completed += completedHandler;
        fadeOut.Begin(this);
    }

    private void ModalOverlay_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        // Close modal when clicking outside the modal card (on the backdrop)
        if (e.OriginalSource == ModalOverlay)
        {
            HideModal();
        }
    }

    private void ModalCloseButton_Click(object sender, RoutedEventArgs e)
    {
        HideModal();
    }

    private void ModalPrimaryButton_Click(object sender, RoutedEventArgs e)
    {
        var action = _modalPrimaryAction;
        HideModal();
        action?.Invoke();
    }

    private void ModalSecondaryButton_Click(object sender, RoutedEventArgs e)
    {
        var action = _modalSecondaryAction;
        HideModal();
        action?.Invoke();
    }

    #endregion
}
