using System.Collections.ObjectModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Threading;
using JubileeFlywheel.Models;
using JubileeFlywheel.Services;
using JubileeFlywheel.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;

namespace JubileeFlywheel
{
    public partial class MainWindow : Window
    {
        private readonly MainViewModel _viewModel;
        private readonly ISettingsService _settingsService;
        private readonly DispatcherTimer _clockTimer;
        private readonly DispatcherTimer _marketStatusTimer;
        private readonly ObservableCollection<StockQuote> _watchlist;
        private string _currentModule = "Inbox";
        private WindowState _previousWindowState;

        public MainWindow()
        {
            InitializeComponent();

            _viewModel = App.ServiceProvider.GetRequiredService<MainViewModel>();
            _settingsService = App.ServiceProvider.GetRequiredService<ISettingsService>();
            DataContext = _viewModel;

            _watchlist = new ObservableCollection<StockQuote>();
            StockListBox.ItemsSource = _watchlist;

            // Initialize timers
            _clockTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            _clockTimer.Tick += ClockTimer_Tick;
            _clockTimer.Start();

            _marketStatusTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMinutes(1)
            };
            _marketStatusTimer.Tick += MarketStatusTimer_Tick;
            _marketStatusTimer.Start();

            UpdateClock();
            UpdateMarketStatus();
            LoadSampleWatchlist();
            RestoreWindowState();

            Loaded += MainWindow_Loaded;
            Closing += MainWindow_Closing;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // Set initial state
            if (DashboardViewControl != null)
            {
                UpdateViewVisibility("Dashboard");
            }
        }

        private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            SaveWindowState();
        }

        #region Window State Management

        private void SaveWindowState()
        {
            try
            {
                var windowState = new WindowStateInfo
                {
                    Left = Left,
                    Top = Top,
                    Width = Width,
                    Height = Height,
                    IsMaximized = WindowState == WindowState.Maximized
                };

                var json = JsonConvert.SerializeObject(windowState);
                var path = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "JubileeFlywheel",
                    "windowstate.json");

                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                File.WriteAllText(path, json);
            }
            catch
            {
                // Ignore window state save errors
            }
        }

        private void RestoreWindowState()
        {
            try
            {
                var path = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "JubileeFlywheel",
                    "windowstate.json");

                if (File.Exists(path))
                {
                    var json = File.ReadAllText(path);
                    var state = JsonConvert.DeserializeObject<WindowStateInfo>(json);

                    if (state != null && IsPositionOnScreen(state.Left, state.Top, state.Width, state.Height))
                    {
                        Left = state.Left;
                        Top = state.Top;
                        Width = state.Width;
                        Height = state.Height;

                        if (state.IsMaximized)
                        {
                            WindowState = WindowState.Maximized;
                        }
                        return;
                    }
                }
            }
            catch
            {
                // Fall through to center window
            }

            // First launch or invalid state - center window on primary screen
            CenterWindowOnScreen();
        }

        private bool IsPositionOnScreen(double left, double top, double width, double height)
        {
            // Use Win32 MonitorFromRect to check if the window is on any monitor
            var rect = new RECT
            {
                Left = (int)left,
                Top = (int)top,
                Right = (int)(left + width),
                Bottom = (int)(top + height)
            };

            IntPtr monitor = MonitorFromRect(ref rect, MONITOR_DEFAULTTONULL);
            if (monitor == IntPtr.Zero)
                return false;

            // Get monitor info to verify the window is reasonably visible
            var monitorInfo = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
            if (GetMonitorInfo(monitor, ref monitorInfo))
            {
                // Check if at least part of the window overlaps with the working area
                var workArea = monitorInfo.rcWork;
                bool overlapsHorizontally = left < workArea.Right && (left + width) > workArea.Left;
                bool overlapsVertically = top < workArea.Bottom && (top + height) > workArea.Top;
                return overlapsHorizontally && overlapsVertically;
            }

            return false;
        }

        private void CenterWindowOnScreen()
        {
            // Get the working area of the primary screen
            var workArea = SystemParameters.WorkArea;
            Left = workArea.Left + (workArea.Width - Width) / 2;
            Top = workArea.Top + (workArea.Height - Height) / 2;
        }

        #region Win32 Interop for Multi-Monitor Support

        private const int MONITOR_DEFAULTTONULL = 0;

        [DllImport("user32.dll")]
        private static extern IntPtr MonitorFromRect(ref RECT lprc, int dwFlags);

        [DllImport("user32.dll")]
        private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MONITORINFO
        {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public int dwFlags;
        }

        #endregion

        private class WindowStateInfo
        {
            public double Left { get; set; }
            public double Top { get; set; }
            public double Width { get; set; }
            public double Height { get; set; }
            public bool IsMaximized { get; set; }
        }

        #endregion

        #region Timer Events

        private void ClockTimer_Tick(object? sender, EventArgs e)
        {
            UpdateClock();
        }

        private void UpdateClock()
        {
            ClockText.Text = DateTime.Now.ToString("HH:mm:ss");
        }

        private void MarketStatusTimer_Tick(object? sender, EventArgs e)
        {
            UpdateMarketStatus();
        }

        private void UpdateMarketStatus()
        {
            var session = SessionCalendar.GetCurrentSession();

            if (session.IsMarketOpen)
            {
                switch (session.CurrentSession)
                {
                    case TradingSession.PreMarket:
                        MarketStatusText.Text = "Pre-Market";
                        MarketStatusText.Foreground = (System.Windows.Media.Brush)FindResource("WarningBrush");
                        break;
                    case TradingSession.Regular:
                        MarketStatusText.Text = "Market: Open";
                        MarketStatusText.Foreground = (System.Windows.Media.Brush)FindResource("BullishBrush");
                        break;
                    case TradingSession.AfterHours:
                        MarketStatusText.Text = "After-Hours";
                        MarketStatusText.Foreground = (System.Windows.Media.Brush)FindResource("WarningBrush");
                        break;
                }
            }
            else
            {
                MarketStatusText.Text = "Market: Closed";
                MarketStatusText.Foreground = (System.Windows.Media.Brush)FindResource("TextSecondaryBrush");
            }
        }

        #endregion

        #region Window Chrome Events

        private void MinimizeButton_Click(object sender, RoutedEventArgs e)
        {
            WindowState = WindowState.Minimized;
        }

        private void MaximizeButton_Click(object sender, RoutedEventArgs e)
        {
            if (WindowState == WindowState.Maximized)
            {
                WindowState = WindowState.Normal;
            }
            else
            {
                _previousWindowState = WindowState;
                WindowState = WindowState.Maximized;
            }
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void Window_StateChanged(object sender, EventArgs e)
        {
            if (WindowState == WindowState.Maximized)
            {
                MaximizeIcon.Text = (string)FindResource("IconRestore");
                MaximizeButton.ToolTip = "Restore";
            }
            else
            {
                MaximizeIcon.Text = (string)FindResource("IconMaximize");
                MaximizeButton.ToolTip = "Maximize";
            }
        }

        #endregion

        #region Top Navigation Events

        private void TopNavTab_Checked(object sender, RoutedEventArgs e)
        {
            if (sender is RadioButton tab && DashboardViewControl != null)
            {
                var tabName = tab.Name.Replace("Tab", "");
                StatusText.Text = $"Viewing {tabName}";

                // Update view visibility based on tab
                UpdateTopNavViewVisibility(tabName);
            }
        }

        private void UpdateTopNavViewVisibility(string tabName)
        {
            if (DashboardViewControl == null) return;

            DashboardViewControl.Visibility = Visibility.Collapsed;
            RadarViewControl.Visibility = Visibility.Collapsed;
            DataGridViewControl.Visibility = Visibility.Collapsed;
            ApiConfigViewControl.Visibility = Visibility.Collapsed;
            SettingsViewControl.Visibility = Visibility.Collapsed;

            switch (tabName)
            {
                case "Home":
                    DashboardViewControl.Visibility = Visibility.Visible;
                    break;
                case "Radar":
                    RadarViewControl.Visibility = Visibility.Visible;
                    break;
                case "Charts":
                    DashboardViewControl.Visibility = Visibility.Visible;
                    break;
                case "Accounts":
                    ApiConfigViewControl.Visibility = Visibility.Visible;
                    break;
            }
        }

        #endregion

        #region App Rail Events

        private void AppRail_ModuleChanged(object? sender, string moduleName)
        {
            _currentModule = moduleName;
            UpdateViewVisibility(moduleName);
            StatusText.Text = $"Module: {moduleName}";
        }

        private void AppRail_SettingsRequested(object? sender, EventArgs e)
        {
            UpdateViewVisibility("Settings");
        }

        private void AppRail_MenuRequested(object? sender, EventArgs e)
        {
            // Toggle stock list panel
            if (StockListColumn.Width.Value > 0)
            {
                StockListColumn.Width = new GridLength(0);
            }
            else
            {
                StockListColumn.Width = new GridLength(280);
            }
        }

        private void UpdateViewVisibility(string viewName)
        {
            if (DashboardViewControl == null) return;

            DashboardViewControl.Visibility = Visibility.Collapsed;
            RadarViewControl.Visibility = Visibility.Collapsed;
            DataGridViewControl.Visibility = Visibility.Collapsed;
            ApiConfigViewControl.Visibility = Visibility.Collapsed;
            SettingsViewControl.Visibility = Visibility.Collapsed;

            switch (viewName)
            {
                case "Inbox":
                case "Charts":
                case "Portfolio":
                case "Dashboard":
                    DashboardViewControl.Visibility = Visibility.Visible;
                    break;
                case "Radar":
                    RadarViewControl.Visibility = Visibility.Visible;
                    break;
                case "Accounts":
                case "Data":
                    ApiConfigViewControl.Visibility = Visibility.Visible;
                    break;
                case "Settings":
                    SettingsViewControl.Visibility = Visibility.Visible;
                    break;
            }
        }

        #endregion

        #region Command Bar Events

        private void NewChartButton_Click(object sender, RoutedEventArgs e)
        {
            _viewModel.DashboardViewModel.AddWidgetCommand.Execute(WidgetType.LineChart);
            StatusText.Text = "Added new chart widget";
        }

        private async void RefreshButton_Click(object sender, RoutedEventArgs e)
        {
            StatusText.Text = "Refreshing data...";
            await _viewModel.RefreshDataCommand.ExecuteAsync(null);
            await RefreshWatchlistData();
            StatusText.Text = _viewModel.StatusMessage;
        }

        private void AddWidgetButton_Click(object sender, RoutedEventArgs e)
        {
            var menu = new ContextMenu
            {
                Style = (Style)FindResource(typeof(ContextMenu))
            };

            var widgetTypes = new[]
            {
                ("Line Chart", WidgetType.LineChart),
                ("Candlestick Chart", WidgetType.AreaChart),
                ("Bar Chart", WidgetType.BarChart),
                ("Pie Chart", WidgetType.PieChart),
                ("Gauge", WidgetType.Gauge),
                ("KPI Card", WidgetType.KpiCard),
                ("Data Grid", WidgetType.DataGrid)
            };

            foreach (var (name, type) in widgetTypes)
            {
                var item = new MenuItem
                {
                    Header = name,
                    Tag = type
                };
                item.Click += AddWidgetMenuItem_Click;
                menu.Items.Add(item);
            }

            menu.PlacementTarget = sender as Button;
            menu.IsOpen = true;
        }

        private void AddWidgetMenuItem_Click(object sender, RoutedEventArgs e)
        {
            if (sender is MenuItem item && item.Tag is WidgetType type)
            {
                _viewModel.DashboardViewModel.AddWidgetCommand.Execute(type);
                StatusText.Text = $"Added {type} widget";
            }
        }

        private void SearchButton_Click(object sender, RoutedEventArgs e)
        {
            var searchTerm = SearchTextBox.Text?.Trim();
            if (!string.IsNullOrEmpty(searchTerm))
            {
                StatusText.Text = $"Searching for: {searchTerm}";
                // TODO: Implement symbol search
            }
        }

        private void ExportButton_Click(object sender, RoutedEventArgs e)
        {
            StatusText.Text = "Export functionality coming soon...";
        }

        #endregion

        #region Stock List Events

        private void LoadSampleWatchlist()
        {
            var sampleStocks = new List<StockQuote>
            {
                new() { Symbol = "AAPL", Name = "Apple Inc.", Price = 189.84m, Change = 2.34m, ChangePercent = 1.25 },
                new() { Symbol = "MSFT", Name = "Microsoft Corporation", Price = 378.91m, Change = -1.23m, ChangePercent = -0.32 },
                new() { Symbol = "GOOGL", Name = "Alphabet Inc.", Price = 141.80m, Change = 0.95m, ChangePercent = 0.67 },
                new() { Symbol = "AMZN", Name = "Amazon.com Inc.", Price = 178.25m, Change = 3.45m, ChangePercent = 1.97 },
                new() { Symbol = "NVDA", Name = "NVIDIA Corporation", Price = 495.22m, Change = -8.15m, ChangePercent = -1.62 },
                new() { Symbol = "META", Name = "Meta Platforms Inc.", Price = 505.95m, Change = 12.30m, ChangePercent = 2.49 },
                new() { Symbol = "TSLA", Name = "Tesla Inc.", Price = 248.50m, Change = -5.72m, ChangePercent = -2.25 },
                new() { Symbol = "JPM", Name = "JPMorgan Chase & Co.", Price = 195.35m, Change = 1.82m, ChangePercent = 0.94 },
                new() { Symbol = "V", Name = "Visa Inc.", Price = 276.12m, Change = 0.45m, ChangePercent = 0.16 },
                new() { Symbol = "SPY", Name = "SPDR S&P 500 ETF", Price = 502.30m, Change = 2.15m, ChangePercent = 0.43 }
            };

            foreach (var stock in sampleStocks)
            {
                _watchlist.Add(stock);
            }
        }

        private async Task RefreshWatchlistData()
        {
            // Simulate data refresh
            await Task.Delay(500);

            var random = new Random();
            foreach (var stock in _watchlist)
            {
                var changePercent = (random.NextDouble() - 0.5) * 4;
                var priceChange = stock.Price * (decimal)(changePercent / 100);
                stock.Price += priceChange;
                stock.Change = priceChange;
                stock.ChangePercent = changePercent;
                stock.LastUpdated = DateTime.Now;
            }
        }

        private void StockListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (StockListBox.SelectedItem is StockQuote quote)
            {
                StatusText.Text = $"Selected: {quote.Symbol} - {quote.Name}";
                // TODO: Load chart for selected symbol
            }
        }

        private void AddSymbolButton_Click(object sender, RoutedEventArgs e)
        {
            // TODO: Show add symbol dialog
            StatusText.Text = "Add symbol dialog coming soon...";
        }

        private void FilterButton_Click(object sender, RoutedEventArgs e)
        {
            // TODO: Show filter options
            StatusText.Text = "Filter options coming soon...";
        }

        #endregion

        protected override void OnClosed(EventArgs e)
        {
            _clockTimer.Stop();
            _marketStatusTimer.Stop();
            base.OnClosed(e);
        }
    }
}
