using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Extensions.DependencyInjection;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;
using JubileeVibes.ViewModels;

namespace JubileeVibes.Views;

public partial class MainWindow : Window
{
    private readonly INavigationService _navigationService;
    private readonly ISettingsService _settingsService;
    private WindowSettings _windowSettings = new();
    private bool _isLoaded;

    public MainWindow()
    {
        InitializeComponent();

        _navigationService = App.Services.GetRequiredService<INavigationService>();
        _settingsService = App.Services.GetRequiredService<ISettingsService>();
        DataContext = App.Services.GetRequiredService<MainWindowViewModel>();

        // Update navigation button states
        _navigationService.Navigated += (s, e) => UpdateNavigationButtons();
        UpdateNavigationButtons();

        // Handle state changes
        StateChanged += MainWindow_StateChanged;

        // Load window settings on startup
        Loaded += MainWindow_Loaded;

        // Save window state on various events
        LocationChanged += MainWindow_LocationChanged;
        SizeChanged += MainWindow_SizeChanged;
        Closing += MainWindow_Closing;

        // Hook into source initialized to add Win32 message handling
        SourceInitialized += MainWindow_SourceInitialized;
    }

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

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        await LoadWindowStateAsync();
        _isLoaded = true;
    }

    private async Task LoadWindowStateAsync()
    {
        try
        {
            _windowSettings = await _settingsService.GetAsync("Window", new WindowSettings());

            // If first run or invalid settings, center on screen
            if (_windowSettings.IsFirstRun || double.IsNaN(_windowSettings.Left) || double.IsNaN(_windowSettings.Top))
            {
                WindowStartupLocation = WindowStartupLocation.CenterScreen;
                _windowSettings.IsFirstRun = false;
            }
            else
            {
                // Get primary screen work area using WPF SystemParameters
                var workArea = SystemParameters.WorkArea;

                // Ensure window is at least partially visible
                double left = _windowSettings.Left;
                double top = _windowSettings.Top;
                double width = Math.Max(_windowSettings.Width, MinWidth);
                double height = Math.Max(_windowSettings.Height, MinHeight);

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
            if (_windowSettings.WindowState == (int)WindowState.Maximized)
            {
                WindowState = WindowState.Maximized;
            }
            else
            {
                WindowState = WindowState.Normal;
            }
        }
        catch
        {
            // If loading fails, use default centered position
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
        }
    }

    private async void SaveWindowStateAsync()
    {
        if (!_isLoaded) return;

        try
        {
            // Only save position/size when in Normal state
            if (WindowState == WindowState.Normal)
            {
                _windowSettings.Left = Left;
                _windowSettings.Top = Top;
                _windowSettings.Width = Width;
                _windowSettings.Height = Height;
            }

            _windowSettings.WindowState = (int)WindowState;
            _windowSettings.IsFirstRun = false;

            await _settingsService.SetAsync("Window", _windowSettings);
        }
        catch
        {
            // Silently fail if saving doesn't work
        }
    }

    private void MainWindow_LocationChanged(object? sender, EventArgs e)
    {
        if (_isLoaded && WindowState == WindowState.Normal)
        {
            _windowSettings.Left = Left;
            _windowSettings.Top = Top;
            // Debounce the save - will be saved on close or state change
        }
    }

    private void MainWindow_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        if (_isLoaded && WindowState == WindowState.Normal)
        {
            _windowSettings.Width = Width;
            _windowSettings.Height = Height;
            // Debounce the save - will be saved on close or state change
        }
    }

    private async void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        // Save final window state before closing
        SaveWindowStateAsync();

        // Give a moment for the save to complete
        await Task.Delay(50);
    }

    private void UpdateNavigationButtons()
    {
        BackButton.IsEnabled = _navigationService.CanGoBack;
        ForwardButton.IsEnabled = _navigationService.CanGoForward;
    }

    private void BackButton_Click(object sender, RoutedEventArgs e)
    {
        _navigationService.GoBack();
    }

    private void ForwardButton_Click(object sender, RoutedEventArgs e)
    {
        _navigationService.GoForward();
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void MainWindow_StateChanged(object? sender, EventArgs e)
    {
        // Update maximize icon based on window state
        MaximizeIcon.Data = WindowState == WindowState.Maximized
            ? (System.Windows.Media.Geometry)FindResource("RestoreIcon")
            : (System.Windows.Media.Geometry)FindResource("MaximizeIcon");

        // Update tooltip
        MaximizeButton.ToolTip = WindowState == WindowState.Maximized ? "Restore" : "Maximize";

        // Save state when maximizing/restoring (but not minimizing)
        if (WindowState != WindowState.Minimized)
        {
            SaveWindowStateAsync();
        }
    }
}
