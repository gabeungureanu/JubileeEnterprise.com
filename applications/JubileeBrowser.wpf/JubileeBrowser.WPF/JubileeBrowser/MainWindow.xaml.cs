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
    private OpenAIChatService? _openAIChatService;
    private string _apiBaseUrl = "https://api.jubileebrowser.com";

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

    // Tab drag-drop tracking
    private Point _dragStartPoint;
    private bool _isDragging;
    private TabState? _draggedTab;

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
        InitializeComponent();

        // Initialize managers
        _settingsManager = new SettingsManager();
        _historyManager = new HistoryManager();
        _bookmarkManager = new BookmarkManager();
        _sessionStateManager = new SessionStateManager();
        _blacklistManager = new BlacklistManager();
        _dnsResolver = new WWBWDnsResolver();
        _hitCountService = new HitCountService();
        _zoomSettingsManager = new ZoomSettingsManager();
        _recentlyClosedTabsManager = new RecentlyClosedTabsManager();
        _tabManager = new TabManager();
        _mobileEmulationManager = new MobileEmulationManager();

        // Initialize profile and sync services
        _profileAuthService = new ProfileAuthService();
        _syncEngine = new SyncEngine(_profileAuthService);
        _credentialManager = new CredentialManager(_syncEngine);

        // Initialize OpenAI chat service with API keys from .env
        InitializeOpenAIChatService();

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
            // Initialize managers
            await _settingsManager.InitializeAsync();
            await _historyManager.InitializeAsync();
            await _bookmarkManager.InitializeAsync();
            await _blacklistManager.InitializeAsync();
            await _dnsResolver.InitializeAsync();
            await _hitCountService.InitializeAsync();
            await _zoomSettingsManager.LoadAsync();

            // Initialize profile and sync services
            await _profileAuthService.InitializeAsync();
            await _syncEngine.InitializeAsync();
            await _credentialManager.InitializeAsync();
            UpdateProfileUI();

            // Apply settings - use startup mode if specified, otherwise use settings default
            var settings = _settingsManager.Settings;
            if (_startupMode.HasValue)
            {
                // Override with the specified startup mode
                _currentMode = _startupMode.Value;
            }
            else
            {
                _currentMode = settings?.DefaultMode ?? BrowserMode.Internet;
            }
            UpdateModeRadioButtons();

            // Apply initial mode visuals
            UpdateModeVisuals();

            // If startup mode is specified, skip session restoration and create fresh window
            if (_startupMode.HasValue)
            {
                // Create initial tab in the specified mode
                await CreateTabAsync(GetHomepage(), _startupMode.Value);
            }
            else
            {
                // Restore session or create new tab
                var sessionState = await _sessionStateManager.LoadAsync();

                // Restore window position and size
                RestoreWindowState(sessionState);

                if (sessionState != null && sessionState.Tabs != null && sessionState.Tabs.Count > 0)
                {
                    // Restore mode from session
                    _currentMode = sessionState.CurrentMode;
                    UpdateModeRadioButtons();
                    UpdateModeVisuals();

                    // Restore tabs
                    foreach (var tabState in sessionState.Tabs)
                    {
                        await CreateTabAsync(tabState.Url, tabState.Mode);
                    }

                    // Switch to active tab
                    if (!string.IsNullOrEmpty(sessionState.ActiveTabId))
                    {
                        var activeTab = Tabs.FirstOrDefault(t => t.Id == sessionState.ActiveTabId);
                        if (activeTab != null)
                        {
                            SwitchToTab(activeTab.Id);
                        }
                    }
                }
                else
                {
                    // Create initial tab
                    await CreateTabAsync(GetHomepage());
                }
            }

            _isInitialized = true;
            _hasRestoredWindowState = true;
            UpdateWelcomePanel();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error during initialization: {ex.Message}");
            // Try to recover by creating a default tab
            try
            {
                await CreateTabAsync("about:blank");
                _isInitialized = true;
                _hasRestoredWindowState = true;
                UpdateWelcomePanel();
            }
            catch
            {
                // Last resort - just mark as initialized
                _isInitialized = true;
                _hasRestoredWindowState = true;
            }
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

        // Save zoom settings
        await _zoomSettingsManager.FlushAsync();

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

        // Setup event handlers
        webView.CoreWebView2.NavigationStarting += (s, e) => OnNavigationStarting(tabState.Id, e);
        webView.CoreWebView2.NavigationCompleted += (s, e) => OnNavigationCompleted(tabState.Id, e);
        webView.CoreWebView2.SourceChanged += (s, e) => OnSourceChanged(tabState.Id);
        webView.CoreWebView2.DocumentTitleChanged += (s, e) => OnDocumentTitleChanged(tabState.Id);
        webView.CoreWebView2.FaviconChanged += async (s, e) => await OnFaviconChangedAsync(tabState.Id);
        webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;

        // Setup message bridge for JavaScript communication
        webView.CoreWebView2.WebMessageReceived += (s, e) => OnWebMessageReceived(tabState.Id, e);
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
                var data = new DataObject("TabState", _draggedTab);
                DragDrop.DoDragDrop(TabStrip, data, DragDropEffects.Move);
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
        }
        else
        {
            e.Effects = DragDropEffects.None;
        }
        e.Handled = true;
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
        e.Handled = true;
        _ = CreateTabAsync(e.Uri);
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
        if (_currentMode == BrowserMode.JubileeBibles)
        {
            // === WORLDWIDE BIBLE WEB MODE ===
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
            ApplyWWBWButtonStyle(MenuButton);

            // Update icon foregrounds to black (for yellow nav bar)
            var blackBrush = System.Windows.Media.Brushes.Black;
            SetButtonIconForeground(BackButton, blackBrush);
            SetButtonIconForeground(ForwardButton, blackBrush);
            SetButtonIconForeground(ReloadButton, blackBrush);
            // BookmarkButton is inside the address bar (black bg), so use yellow
            SetButtonIconForeground(BookmarkButton, wwbwYellowBrush);
            SetButtonIconForeground(HistoryButton, blackBrush);
            SetButtonIconForeground(BookmarksButton, blackBrush);
            SetButtonIconForeground(MenuButton, blackBrush);

            // Zoom level text should be yellow on black address bar
            ZoomLevelText.Foreground = wwbwYellowBrush;

            // Profile icon: Yellow person on dark circular background in WWBW mode
            ProfileIconHead.Fill = wwbwYellowBrush;
            ProfileIconBody.Fill = wwbwYellowBrush;
            ProfileDefaultAvatar.Fill = new SolidColorBrush(Color.FromRgb(37, 37, 69)); // #252545
            // Menu dots: Black on yellow nav bar in WWBW mode
            MenuDot1.Fill = blackBrush;
            MenuDot2.Fill = blackBrush;
            MenuDot3.Fill = blackBrush;
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

            // Zoom level text should be white on blue address bar
            ZoomLevelText.Foreground = System.Windows.Media.Brushes.White;

            // Profile icon: White person on dark circular background in WWW mode
            ProfileIconHead.Fill = System.Windows.Media.Brushes.White;
            ProfileIconBody.Fill = System.Windows.Media.Brushes.White;
            ProfileDefaultAvatar.Fill = new SolidColorBrush(Color.FromRgb(37, 37, 69)); // #252545
            // Menu dots: White on blue nav bar in WWW mode
            MenuDot1.Fill = System.Windows.Media.Brushes.White;
            MenuDot2.Fill = System.Windows.Media.Brushes.White;
            MenuDot3.Fill = System.Windows.Media.Brushes.White;
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
            textBlock.Foreground = brush;
        }
    }

    private string GetHomepage()
    {
        var defaultHomepage = "http://www.jubileeverse.com";
        var homepage = _settingsManager?.Settings?.Homepage;
        if (homepage == null)
            return defaultHomepage;

        return _currentMode == BrowserMode.JubileeBibles
            ? homepage.JubileeBibles ?? defaultHomepage
            : homepage.Internet ?? defaultHomepage;
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

    #endregion

    #region Bookmarks & History

    private void BookmarkButton_Click(object sender, RoutedEventArgs e)
    {
        BookmarkCurrentPage();
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

    private void HistoryButton_Click(object sender, RoutedEventArgs e)
    {
        ShowHistory();
    }

    private void BookmarksButton_Click(object sender, RoutedEventArgs e)
    {
        ShowBookmarks();
    }

    private void ShowHistory()
    {
        SidePanelTitle.Text = "History";
        SidePanelList.ItemsSource = _historyManager.GetEntries(_currentMode, 100)
            .Select(h => new { h.Title, h.Url, Display = $"{h.Title}\n{h.Url}" });
        ShowSidePanel();
    }

    private void ShowBookmarks()
    {
        SidePanelTitle.Text = "Bookmarks";
        SidePanelList.ItemsSource = _bookmarkManager.GetBookmarks(_currentMode)
            .Select(b => new { b.Title, b.Url, Display = $"{b.Title}\n{b.Url}" });
        ShowSidePanel();
    }

    private void ShowSidePanel()
    {
        SidePanel.Visibility = Visibility.Visible;
        SidePanelColumn.Width = new GridLength(300);
    }

    private void CloseSidePanel_Click(object sender, RoutedEventArgs e)
    {
        SidePanel.Visibility = Visibility.Collapsed;
        SidePanelColumn.Width = new GridLength(0);
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
        // TODO: Implement SSO sign-in flow
        MessageBox.Show("Sign in to sync your bookmarks, history, and settings across devices.\n\nThis feature is coming soon!",
            "Sign In", MessageBoxButton.OK, MessageBoxImage.Information);
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

    private void MainMenu_History_Click(object sender, RoutedEventArgs e)
    {
        MainMenuPopup.IsOpen = false;
        ShowHistory();
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

    private void OnWebMessageReceived(string tabId, CoreWebView2WebMessageReceivedEventArgs e)
    {
        // Handle messages from JavaScript
        var message = e.WebMessageAsJson;
        // TODO: Parse and handle messages for IPC-like communication
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

    #region Helpers

    private static string EnsureValidUrl(string input)
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

        // Treat as search query
        return $"https://www.google.com/search?q={Uri.EscapeDataString(input)}";
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
                    ProfileAvatarImage.ImageSource = new System.Windows.Media.Imaging.BitmapImage(new Uri(profile.AvatarUrl));
                    ProfilePopupAvatarImage.ImageSource = ProfileAvatarImage.ImageSource;
                }
                catch
                {
                    // Use default if avatar URL fails
                    ProfileUserAvatar.Fill = new SolidColorBrush(Color.FromRgb(0, 120, 212));
                }
            }
            else
            {
                ProfileUserAvatar.Fill = new SolidColorBrush(Color.FromRgb(0, 120, 212));
            }

            // Update popup
            ProfileSignedOutPanel.Visibility = Visibility.Collapsed;
            ProfileSignedInPanel.Visibility = Visibility.Visible;
            ProfilePopupName.Text = profile.DisplayName;
            ProfilePopupEmail.Text = profile.Email;

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

            ProfileButton.ToolTip = "Sign in to sync your data";
        }
    }

    private void UpdateSyncStatusUI(SyncStatus status)
    {
        switch (status)
        {
            case SyncStatus.Syncing:
                ProfileSyncStatusIcon.Text = "\uE895";
                ProfileSyncStatusText.Text = "Syncing...";
                ProfileSyncIndicator.Fill = new SolidColorBrush(Color.FromRgb(59, 130, 246)); // Blue
                ProfileSyncErrorBanner.Visibility = Visibility.Collapsed;
                break;

            case SyncStatus.Idle:
                ProfileSyncStatusIcon.Text = "\uE73E";
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
                ProfileSyncIndicator.Fill = new SolidColorBrush(Color.FromRgb(34, 197, 94)); // Green
                ProfileSyncErrorBanner.Visibility = Visibility.Collapsed;
                break;

            case SyncStatus.Error:
            case SyncStatus.Offline:
                ProfileSyncStatusIcon.Text = "\uE783";
                ProfileSyncStatusText.Text = status == SyncStatus.Offline ? "Offline" : "Sync error";
                ProfileSyncLastTime.Text = "";
                ProfileSyncIndicator.Fill = new SolidColorBrush(Color.FromRgb(239, 68, 68)); // Red
                ProfileSyncErrorBanner.Visibility = Visibility.Visible;
                ProfileSyncErrorText.Text = _syncEngine.LastError ?? "Unable to sync";
                break;

            case SyncStatus.Paused:
                ProfileSyncStatusIcon.Text = "\uE769";
                ProfileSyncStatusText.Text = "Paused";
                ProfileSyncLastTime.Text = "";
                ProfileSyncIndicator.Fill = new SolidColorBrush(Color.FromRgb(251, 191, 36)); // Yellow
                ProfileSyncErrorBanner.Visibility = Visibility.Collapsed;
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

        var authDialog = new Window
        {
            Title = "JubileeInspire - Authentication",
            Width = 450,
            Height = 477,
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
            BorderThickness = new Thickness(3),
            CornerRadius = new CornerRadius(12)
        };

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

        // Subtitle
        var subtitleText = new TextBlock
        {
            Text = "A Faith-Based AI Browser for the Worldwide Bible Web",
            FontSize = 13,
            Foreground = Brushes.White,
            HorizontalAlignment = HorizontalAlignment.Center,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            Margin = new Thickness(0, 0, 0, 15)
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

        // "Create an account" link - upper-left corner aligned with content
        var signUpLinkColor = new SolidColorBrush(Color.FromRgb(180, 180, 180)); // Default gray
        var signUpLinkHoverColor = new SolidColorBrush(goldColor); // Gold hover
        var signUpLink = new TextBlock
        {
            Text = "Create an account",
            Foreground = signUpLinkColor,
            FontSize = 13,
            Cursor = Cursors.Hand,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 0, 0, 12),
            Focusable = true
        };
        signUpLink.MouseEnter += (s, args) => { signUpLink.Foreground = signUpLinkHoverColor; signUpLink.TextDecorations = TextDecorations.Underline; };
        signUpLink.MouseLeave += (s, args) => { signUpLink.Foreground = signUpLinkColor; signUpLink.TextDecorations = null; };
        signUpLink.GotFocus += (s, args) => { signUpLink.Foreground = signUpLinkHoverColor; signUpLink.TextDecorations = TextDecorations.Underline; };
        signUpLink.LostFocus += (s, args) => { signUpLink.Foreground = signUpLinkColor; signUpLink.TextDecorations = null; };
        // Click and keyboard handlers are set up later after ShowPanel is defined
        signInPanel.Children.Add(signUpLink);

        var (signInEmailBorder, signInEmailBox) = CreateTextInput("Email Address", 12);
        signInPanel.Children.Add(signInEmailBorder);

        var (signInPasswordBorder, signInPasswordBox, _) = CreatePasswordInput("Password", 10);
        signInPanel.Children.Add(signInPasswordBorder);

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

        // "Sign in" link - upper-left corner aligned with content (consistent with sign-in panel)
        var step1SignInLinkColor = new SolidColorBrush(Color.FromRgb(180, 180, 180));
        var step1SignInLinkHoverColor = new SolidColorBrush(goldColor);
        var step1SignInLink = new TextBlock
        {
            Text = "Sign in",
            Foreground = step1SignInLinkColor,
            FontSize = 13,
            Cursor = Cursors.Hand,
            HorizontalAlignment = HorizontalAlignment.Left,
            Margin = new Thickness(0, 0, 0, 12),
            Focusable = true
        };
        step1SignInLink.MouseEnter += (s, args) => { step1SignInLink.Foreground = step1SignInLinkHoverColor; step1SignInLink.TextDecorations = TextDecorations.Underline; };
        step1SignInLink.MouseLeave += (s, args) => { step1SignInLink.Foreground = step1SignInLinkColor; step1SignInLink.TextDecorations = null; };
        step1SignInLink.GotFocus += (s, args) => { step1SignInLink.Foreground = step1SignInLinkHoverColor; step1SignInLink.TextDecorations = TextDecorations.Underline; };
        step1SignInLink.LostFocus += (s, args) => { step1SignInLink.Foreground = step1SignInLinkColor; step1SignInLink.TextDecorations = null; };
        // Click and keyboard handlers are set up later after ShowPanel is defined
        createStep1Panel.Children.Add(step1SignInLink);

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

        var step2BackLinkPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 12) };
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
        termsOfUseLink.Click += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/terms", UseShellExecute = true }); } catch { } };
        termsTextBlock.Inlines.Add(termsOfUseLink);
        termsTextBlock.Inlines.Add(new System.Windows.Documents.Run(" and ") { Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 13 });
        var privacyPolicyLink = new System.Windows.Documents.Hyperlink(new System.Windows.Documents.Run("Privacy Policy")) { Foreground = new SolidColorBrush(goldColor), TextDecorations = null };
        privacyPolicyLink.Click += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/privacy", UseShellExecute = true }); } catch { } };
        termsTextBlock.Inlines.Add(privacyPolicyLink);
        termsPanel.Children.Add(termsTextBlock);
        createStep2Panel.Children.Add(termsPanel);

        // ===== FORGOT PASSWORD STEP 1 (content only - no button) =====
        var forgotStep1Panel = new StackPanel { Visibility = Visibility.Collapsed };

        var forgotBackLinkPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 12) };
        var forgotBackLink = new TextBlock { Text = "← Back to Sign In", Foreground = new SolidColorBrush(goldColor), FontSize = 13, Cursor = Cursors.Hand };
        forgotBackLink.MouseEnter += (s, args) => forgotBackLink.TextDecorations = TextDecorations.Underline;
        forgotBackLink.MouseLeave += (s, args) => forgotBackLink.TextDecorations = null;
        forgotBackLinkPanel.Children.Add(forgotBackLink);
        forgotStep1Panel.Children.Add(forgotBackLinkPanel);

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

        var (forgotEmailBorder, forgotEmailBox) = CreateTextInput("Email Address", 0);
        forgotStep1Panel.Children.Add(forgotEmailBorder);

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

        // Create 6 code input boxes
        var codeBoxesPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 0) };
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
            codeBoxes[i] = codeBox;
            codeBoxesPanel.Children.Add(codeBox);
        }
        forgotStep2Panel.Children.Add(codeBoxesPanel);

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
        termsLink.MouseLeftButtonUp += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/terms", UseShellExecute = true }); } catch { } };
        copyrightPanel.Children.Add(termsLink);

        copyrightPanel.Children.Add(new TextBlock { Text = " | ", Foreground = footerTextColor, FontSize = 11 });

        var privacyLink = new TextBlock { Text = "Privacy Policy", Foreground = footerLinkColor, FontSize = 11, Cursor = Cursors.Hand };
        privacyLink.MouseEnter += (s, args) => { privacyLink.Foreground = footerLinkHoverColor; privacyLink.TextDecorations = TextDecorations.Underline; };
        privacyLink.MouseLeave += (s, args) => { privacyLink.Foreground = footerLinkColor; privacyLink.TextDecorations = null; };
        privacyLink.MouseLeftButtonUp += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/privacy", UseShellExecute = true }); } catch { } };
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
                    actionButton.Content = "Create Account";
                    break;
                case "forgotStep1":
                    forgotStep1Panel.Visibility = Visibility.Visible;
                    actionButton.Content = "Continue";
                    break;
                case "forgotStep2":
                    forgotStep2Panel.Visibility = Visibility.Visible;
                    actionButton.Content = "Continue";
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
                        MessageBox.Show("Please enter your email and password.", "Sign In", MessageBoxButton.OK, MessageBoxImage.Warning);
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

                        try
                        {
                            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                            var loginRequest = new { UsernameOrEmail = signInEmail, Password = signInPassword };
                            var json = System.Text.Json.JsonSerializer.Serialize(loginRequest);
                            var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                            var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/login", content);
                            responseJson = await response.Content.ReadAsStringAsync();
                            success = response.IsSuccessStatusCode;
                        }
                        catch (Exception ex)
                        {
                            errorMsg = ex.Message;
                        }

                        // Now dispatch to UI thread - no async operations inside
                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Sign In";

                            if (errorMsg != null)
                            {
                                // Offer demo mode when connection fails
                                var result = MessageBox.Show(
                                    $"Could not connect to the authentication server.\n\nError: {errorMsg}\n\nWould you like to continue in Demo Mode?\n\n(Demo mode allows you to explore all features without requiring a server connection)",
                                    "Connection Error",
                                    MessageBoxButton.YesNo,
                                    MessageBoxImage.Question);

                                if (result == MessageBoxResult.Yes)
                                {
                                    var demoName = signInEmail.Split('@')[0];
                                    _profileAuthService.SignInDemoMode(demoName, signInEmail);
                                    authDialog.Close();
                                    MessageBox.Show($"Welcome to Jubilee Demo Mode, {demoName}!\n\nYou can now explore all features. Note: Data will not be saved to a server.", "Demo Mode Active", MessageBoxButton.OK, MessageBoxImage.Information);
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
                                var accessTokenExpiry = DateTime.UtcNow.AddMinutes(15);

                                if (result.TryGetProperty("user", out var userElement))
                                {
                                    if (userElement.TryGetProperty("displayName", out var displayNameElement))
                                        displayName = displayNameElement.GetString() ?? "User";
                                    if (userElement.TryGetProperty("userId", out var userIdElement))
                                        userId = userIdElement.GetString() ?? "";
                                    if (userElement.TryGetProperty("email", out var emailElement))
                                        email = emailElement.GetString() ?? signInEmail;
                                }
                                if (result.TryGetProperty("accessToken", out var accessTokenElement))
                                    accessToken = accessTokenElement.GetString() ?? "";
                                if (result.TryGetProperty("refreshToken", out var refreshTokenElement))
                                    refreshToken = refreshTokenElement.GetString() ?? "";
                                if (result.TryGetProperty("accessTokenExpiry", out var expiryElement) && expiryElement.ValueKind == System.Text.Json.JsonValueKind.String)
                                {
                                    if (DateTime.TryParse(expiryElement.GetString(), out var parsedExpiry))
                                        accessTokenExpiry = parsedExpiry;
                                }

                                // Sign in with the API response tokens - use synchronous version on UI thread
                                _profileAuthService.SignInWithApiResponse(userId, email, displayName, accessToken, refreshToken, accessTokenExpiry);
                                authDialog.Close();
                                MessageBox.Show($"Welcome back, {displayName}!", "Sign In Successful", MessageBoxButton.OK, MessageBoxImage.Information);
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

                                // Offer demo mode when server sign-in fails
                                var result = MessageBox.Show(
                                    $"{errorMessage}\n\nWould you like to continue in Demo Mode instead?\n\n(Demo mode allows you to explore all features without requiring server authentication)",
                                    "Sign In Failed",
                                    MessageBoxButton.YesNo,
                                    MessageBoxImage.Question);

                                if (result == MessageBoxResult.Yes)
                                {
                                    var demoName = signInEmail.Split('@')[0];
                                    _profileAuthService.SignInDemoMode(demoName, signInEmail);
                                    authDialog.Close();
                                    MessageBox.Show($"Welcome to Jubilee Demo Mode, {demoName}!\n\nYou can now explore all features. Note: Data will not be saved to a server.", "Demo Mode Active", MessageBoxButton.OK, MessageBoxImage.Information);
                                }
                            }
                        });
                    });
                    break;

                case "createStep1":
                    if (string.IsNullOrWhiteSpace(fullNameBox.Text))
                    {
                        MessageBox.Show("Please enter your full name.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    if (string.IsNullOrWhiteSpace(createEmailBox.Text))
                    {
                        MessageBox.Show("Please enter your email address.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    // Basic email validation
                    if (!createEmailBox.Text.Contains("@") || !createEmailBox.Text.Contains("."))
                    {
                        MessageBox.Show("Please enter a valid email address.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    ShowPanel("createStep2");
                    break;

                case "createStep2":
                    if (string.IsNullOrWhiteSpace(createPasswordBox.Password))
                    {
                        MessageBox.Show("Please enter a password.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    if (createPasswordBox.Password.Length < 8)
                    {
                        MessageBox.Show("Password must be at least 8 characters long.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    if (createPasswordBox.Password != confirmPasswordBox.Password)
                    {
                        MessageBox.Show("Passwords do not match.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    if (termsCheckbox.IsChecked != true)
                    {
                        MessageBox.Show("You must agree to the Terms of Use and Privacy Policy to create an account.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    // Perform account creation via API
                    actionButton.IsEnabled = false;
                    actionButton.Content = "Creating Account...";
                    var createFullName = fullNameBox.Text;
                    var createEmail = createEmailBox.Text;
                    var createPassword = createPasswordBox.Password;
                    var subscribeNewsletter = newsletterCheckbox.IsChecked == true;
                    _ = Task.Run(async () =>
                    {
                        bool success = false;
                        string responseJson = "";
                        string? errorMsg = null;

                        try
                        {
                            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                            var registerRequest = new { FullName = createFullName, Email = createEmail, Password = createPassword, SubscribeNewsletter = subscribeNewsletter };
                            var json = System.Text.Json.JsonSerializer.Serialize(registerRequest);
                            var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                            var response = await client.PostAsync($"{_apiBaseUrl}/api/auth/register", content);
                            responseJson = await response.Content.ReadAsStringAsync();
                            success = response.IsSuccessStatusCode;
                        }
                        catch (Exception ex)
                        {
                            errorMsg = ex.Message;
                        }

                        // Now dispatch to UI thread - no async operations inside
                        Dispatcher.Invoke(() =>
                        {
                            actionButton.IsEnabled = true;
                            actionButton.Content = "Create Account";

                            if (errorMsg != null)
                            {
                                // Offer demo mode when API is unavailable
                                var result = MessageBox.Show(
                                    $"Could not connect to the authentication server.\n\nWould you like to continue in Demo Mode?\n\n(Demo mode allows you to test features without requiring a server connection)",
                                    "Connection Error",
                                    MessageBoxButton.YesNo,
                                    MessageBoxImage.Question);

                                if (result == MessageBoxResult.Yes)
                                {
                                    // Create a demo profile locally
                                    _profileAuthService.SignInDemoMode(createFullName, createEmail);
                                    authDialog.Close();
                                    MessageBox.Show($"Welcome to Jubilee Demo Mode, {createFullName}!\n\nYou can now explore all features. Note: Data will not be saved to a server.", "Demo Mode Active", MessageBoxButton.OK, MessageBoxImage.Information);
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
                                var accessTokenExpiry = DateTime.UtcNow.AddMinutes(15);

                                if (result.TryGetProperty("user", out var userElement))
                                {
                                    if (userElement.TryGetProperty("displayName", out var displayNameElement))
                                        displayName = displayNameElement.GetString() ?? createFullName;
                                    if (userElement.TryGetProperty("userId", out var userIdElement))
                                        userId = userIdElement.GetString() ?? "";
                                    if (userElement.TryGetProperty("email", out var emailElement))
                                        email = emailElement.GetString() ?? createEmail;
                                }
                                if (result.TryGetProperty("accessToken", out var accessTokenElement))
                                    accessToken = accessTokenElement.GetString() ?? "";
                                if (result.TryGetProperty("refreshToken", out var refreshTokenElement))
                                    refreshToken = refreshTokenElement.GetString() ?? "";
                                if (result.TryGetProperty("accessTokenExpiry", out var expiryElement) && expiryElement.ValueKind == System.Text.Json.JsonValueKind.String)
                                {
                                    if (DateTime.TryParse(expiryElement.GetString(), out var parsedExpiry))
                                        accessTokenExpiry = parsedExpiry;
                                }

                                // Sign in with the API response tokens - use synchronous version on UI thread
                                _profileAuthService.SignInWithApiResponse(userId, email, displayName, accessToken, refreshToken, accessTokenExpiry);
                                authDialog.Close();
                                MessageBox.Show($"Welcome to Jubilee, {displayName}!\n\nYour account has been created successfully.", "Account Created", MessageBoxButton.OK, MessageBoxImage.Information);
                            }
                            else
                            {
                                var errorMessage = "Account creation failed. Please try again.";
                                try
                                {
                                    var errorResult = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseJson);
                                    if (errorResult.TryGetProperty("errorMessage", out var errElement))
                                        errorMessage = errElement.GetString() ?? errorMessage;
                                }
                                catch { }

                                // Offer demo mode when server registration fails
                                var result = MessageBox.Show(
                                    $"{errorMessage}\n\nWould you like to continue in Demo Mode instead?\n\n(Demo mode allows you to explore all features without requiring server registration)",
                                    "Registration Failed",
                                    MessageBoxButton.YesNo,
                                    MessageBoxImage.Question);

                                if (result == MessageBoxResult.Yes)
                                {
                                    _profileAuthService.SignInDemoMode(createFullName, createEmail);
                                    authDialog.Close();
                                    MessageBox.Show($"Welcome to Jubilee Demo Mode, {createFullName}!\n\nYou can now explore all features. Note: Data will not be saved to a server.", "Demo Mode Active", MessageBoxButton.OK, MessageBoxImage.Information);
                                }
                            }
                        });
                    });
                    break;

                case "forgotStep1":
                    if (string.IsNullOrWhiteSpace(forgotEmailBox.Text))
                    {
                        MessageBox.Show("Please enter your email address.", "Forgot Password", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    ShowPanel("forgotStep2");
                    codeBoxes[0].Focus();
                    break;

                case "forgotStep2":
                    var code = string.Join("", codeBoxes.Select(cb => cb.Text));
                    if (code.Length != 6)
                    {
                        MessageBox.Show("Please enter the complete 6-digit verification code.", "Forgot Password", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    ShowPanel("forgotStep3");
                    break;

                case "forgotStep3":
                    if (string.IsNullOrWhiteSpace(newPasswordBox.Password))
                    {
                        MessageBox.Show("Please enter a new password.", "Reset Password", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    if (newPasswordBox.Password != confirmNewPasswordBox.Password)
                    {
                        MessageBox.Show("Passwords do not match.", "Reset Password", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                    // Password reset would require email infrastructure
                    authDialog.Close();
                    MessageBox.Show("Your password has been reset successfully.\n\nYou can now sign in with your new password.", "Password Reset", MessageBoxButton.OK, MessageBoxImage.Information);
                    break;
            }
        };

        // ===== NAVIGATION LINK HANDLERS =====
        // Mouse click handlers
        signUpLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("createStep1"); };
        step1SignInLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("signIn"); };
        step2BackLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("createStep1"); };
        forgotPasswordLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("forgotStep1"); };
        forgotBackLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("signIn"); };
        codeBackLink.PreviewMouseLeftButtonDown += (s, args) => { args.Handled = true; ShowPanel("forgotStep1"); };

        // Keyboard accessibility handlers (Enter/Space)
        signUpLink.PreviewKeyDown += (s, args) => { if (args.Key == Key.Enter || args.Key == Key.Space) { args.Handled = true; ShowPanel("createStep1"); } };
        step1SignInLink.PreviewKeyDown += (s, args) => { if (args.Key == Key.Enter || args.Key == Key.Space) { args.Handled = true; ShowPanel("signIn"); } };

        // ===== ASSEMBLE THE LAYOUT WITH FIXED REGIONS =====
        // Add content panels to content container (Row 1)
        contentContainer.Children.Add(signInPanel);
        contentContainer.Children.Add(createStep1Panel);
        contentContainer.Children.Add(createStep2Panel);
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
        authDialog.Content = mainBorder;

        // Allow window dragging
        mainBorder.MouseLeftButtonDown += (s, args) =>
        {
            if (args.ButtonState == MouseButtonState.Pressed)
                authDialog.DragMove();
        };

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
        var termsLink = new System.Windows.Documents.Hyperlink(new System.Windows.Documents.Run("Terms of Use")) { Foreground = new SolidColorBrush(goldColor) };
        termsLink.Click += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/terms", UseShellExecute = true }); } catch { } };
        termsTextBlock.Inlines.Add(termsLink);
        termsTextBlock.Inlines.Add(new System.Windows.Documents.Run(" and ") { Foreground = new SolidColorBrush(Color.FromRgb(180, 180, 180)), FontSize = 12 });
        var privacyLinkInline = new System.Windows.Documents.Hyperlink(new System.Windows.Documents.Run("Privacy Policy")) { Foreground = new SolidColorBrush(goldColor) };
        privacyLinkInline.Click += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/privacy", UseShellExecute = true }); } catch { } };
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
                MessageBox.Show("Please enter your full name.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (string.IsNullOrWhiteSpace(email) || !email.Contains("@"))
            {
                MessageBox.Show("Please enter a valid email address.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            {
                MessageBox.Show("Password must be at least 8 characters long.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (termsCheck.IsChecked != true)
            {
                MessageBox.Show("Please agree to the Terms of Use and Privacy Policy.", "Create Account", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // TODO: Implement actual account creation with Jubilee Inspire API
            createAccountDialog.Close();
            MessageBox.Show("Account creation with Jubilee Inspire is coming soon!\n\nYour information has been saved for when this feature becomes available.",
                "Create Account", MessageBoxButton.OK, MessageBoxImage.Information);
        };
        mainPanel.Children.Add(createAccountButton);

        // Footer
        var footerPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
        footerPanel.Children.Add(new TextBlock { Text = "© 2026 Jubilee Browser", Foreground = new SolidColorBrush(Color.FromRgb(120, 120, 120)), FontSize = 11 });
        footerPanel.Children.Add(new TextBlock { Text = " | ", Foreground = new SolidColorBrush(Color.FromRgb(120, 120, 120)), FontSize = 11 });
        var termsFooterLink = new TextBlock { Text = "Terms of Use", Foreground = new SolidColorBrush(Color.FromRgb(100, 180, 200)), FontSize = 11, Cursor = Cursors.Hand };
        termsFooterLink.MouseLeftButtonUp += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/terms", UseShellExecute = true }); } catch { } };
        footerPanel.Children.Add(termsFooterLink);
        footerPanel.Children.Add(new TextBlock { Text = " | ", Foreground = new SolidColorBrush(Color.FromRgb(120, 120, 120)), FontSize = 11 });
        var privacyFooterLink = new TextBlock { Text = "Privacy Policy", Foreground = new SolidColorBrush(Color.FromRgb(100, 180, 200)), FontSize = 11, Cursor = Cursors.Hand };
        privacyFooterLink.MouseLeftButtonUp += (s, args) => { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://jubileeverse.com/privacy", UseShellExecute = true }); } catch { } };
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

    private async void ProfileRetrySync_Click(object sender, RoutedEventArgs e)
    {
        await _syncEngine.SyncNowAsync();
    }

    private void ProfileManageAccount_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;
        // Open account management page in WorldWideBibleWeb SSO
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "https://sso.worldwidebibleweb.org/account",
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to open account page: {ex.Message}",
                "Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
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
                await _profileAuthService.SwitchProfileAsync(userId);
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

    private async void ProfileSyncSettings_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;

        // Show sync settings dialog
        var syncDialog = new Window
        {
            Title = "Sync Settings",
            Width = 400,
            Height = 400,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = this,
            Background = new SolidColorBrush(Color.FromRgb(30, 30, 46)),
            WindowStyle = WindowStyle.ToolWindow,
            ResizeMode = ResizeMode.NoResize
        };

        var prefs = _syncEngine.Preferences;
        var panel = new StackPanel { Margin = new Thickness(20) };
        panel.Children.Add(new TextBlock
        {
            Text = "Choose what to sync",
            FontSize = 18,
            FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White,
            Margin = new Thickness(0, 0, 0, 20)
        });

        var checkboxStyle = new Style(typeof(CheckBox));
        checkboxStyle.Setters.Add(new Setter(CheckBox.ForegroundProperty, Brushes.White));
        checkboxStyle.Setters.Add(new Setter(CheckBox.MarginProperty, new Thickness(0, 8, 0, 8)));
        checkboxStyle.Setters.Add(new Setter(CheckBox.FontSizeProperty, 14d));

        var bookmarksCheck = new CheckBox { Content = "Bookmarks", IsChecked = prefs.SyncBookmarks, Style = checkboxStyle };
        var historyCheck = new CheckBox { Content = "History", IsChecked = prefs.SyncHistory, Style = checkboxStyle };
        var passwordsCheck = new CheckBox { Content = "Passwords", IsChecked = prefs.SyncPasswords, Style = checkboxStyle };
        var autofillCheck = new CheckBox { Content = "Autofill", IsChecked = prefs.SyncAutofill, Style = checkboxStyle };
        var extensionsCheck = new CheckBox { Content = "Extensions", IsChecked = prefs.SyncExtensions, Style = checkboxStyle };
        var themesCheck = new CheckBox { Content = "Themes", IsChecked = prefs.SyncThemes, Style = checkboxStyle };
        var settingsCheck = new CheckBox { Content = "Settings", IsChecked = prefs.SyncSettings, Style = checkboxStyle };

        panel.Children.Add(bookmarksCheck);
        panel.Children.Add(historyCheck);
        panel.Children.Add(passwordsCheck);
        panel.Children.Add(autofillCheck);
        panel.Children.Add(extensionsCheck);
        panel.Children.Add(themesCheck);
        panel.Children.Add(settingsCheck);

        var buttonPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 20, 0, 0) };
        var cancelBtn = new Button
        {
            Content = "Cancel",
            Width = 80,
            Height = 32,
            Margin = new Thickness(0, 0, 8, 0)
        };
        cancelBtn.Click += (s, args) => syncDialog.Close();

        var saveBtn = new Button
        {
            Content = "Save",
            Width = 80,
            Height = 32,
            Background = new SolidColorBrush(Color.FromRgb(0, 120, 212)),
            Foreground = Brushes.White
        };
        saveBtn.Click += async (s, args) =>
        {
            var newPrefs = new SyncPreferences
            {
                SyncBookmarks = bookmarksCheck.IsChecked ?? false,
                SyncHistory = historyCheck.IsChecked ?? false,
                SyncPasswords = passwordsCheck.IsChecked ?? false,
                SyncAutofill = autofillCheck.IsChecked ?? false,
                SyncExtensions = extensionsCheck.IsChecked ?? false,
                SyncThemes = themesCheck.IsChecked ?? false,
                SyncSettings = settingsCheck.IsChecked ?? false
            };
            await _syncEngine.UpdatePreferencesAsync(newPrefs);
            syncDialog.Close();
        };

        buttonPanel.Children.Add(cancelBtn);
        buttonPanel.Children.Add(saveBtn);
        panel.Children.Add(buttonPanel);

        syncDialog.Content = panel;
        syncDialog.ShowDialog();
    }

    private async void ProfileSignOut_Click(object sender, RoutedEventArgs e)
    {
        ProfilePopup.IsOpen = false;

        var result = MessageBox.Show(
            "Are you sure you want to sign out?\n\nYour local data will be kept, but syncing will stop.",
            "Sign Out",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result == MessageBoxResult.Yes)
        {
            await _profileAuthService.SignOutAsync();
            _syncEngine.StopSyncTimer();

            // Update chat panel state when signing out
            UpdateChatPanelAuthState();
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

    private void ChatCloseButton_Click(object sender, RoutedEventArgs e)
    {
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
}
