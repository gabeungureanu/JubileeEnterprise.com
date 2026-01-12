using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using JubileeFlywheel.Models;
using JubileeFlywheel.Services;
using LiveChartsCore;
using LiveChartsCore.Defaults;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Painting;
using Microsoft.Extensions.DependencyInjection;
using SkiaSharp;

namespace JubileeFlywheel.Controls
{
    public partial class StockChartControl : UserControl
    {
        private readonly ISymbolService _symbolService;
        private readonly IOhlcAggregationEngine _aggregationEngine;

        private string _currentSymbol = "AAPL";
        private TimeResolution _currentResolution = TimeResolution.OneMinute;
        private ObservableCollection<FinancialPoint> _ohlcData;
        private ObservableCollection<double> _volumeData;
        private List<OhlcDataPoint> _rawData;
        private CancellationTokenSource? _searchCts;
        private CancellationTokenSource? _dataCts;
        private bool _isUpdating;
        private double _zoomLevel = 1.0;

        public event EventHandler<string>? SymbolChanged;
        public event EventHandler<TimeResolution>? ResolutionChanged;

        public string CurrentSymbol
        {
            get => _currentSymbol;
            set
            {
                if (_currentSymbol != value)
                {
                    _currentSymbol = value;
                    SymbolChanged?.Invoke(this, value);
                }
            }
        }

        public StockChartControl()
        {
            InitializeComponent();

            _symbolService = App.ServiceProvider.GetRequiredService<ISymbolService>();
            _aggregationEngine = App.ServiceProvider.GetRequiredService<IOhlcAggregationEngine>();

            _ohlcData = new ObservableCollection<FinancialPoint>();
            _volumeData = new ObservableCollection<double>();
            _rawData = new List<OhlcDataPoint>();

            InitializeCharts();

            Loaded += StockChartControl_Loaded;
        }

        private void StockChartControl_Loaded(object sender, RoutedEventArgs e)
        {
            SymbolTextBox.Text = _currentSymbol;
            _ = LoadChartDataAsync(_currentSymbol, _currentResolution);
        }

        private void InitializeCharts()
        {
            // Price Chart (Candlestick)
            var candlestickSeries = new CandlesticksSeries<FinancialPoint>
            {
                Values = _ohlcData,
                UpStroke = new SolidColorPaint(SKColors.LimeGreen) { StrokeThickness = 1 },
                DownStroke = new SolidColorPaint(SKColors.Crimson) { StrokeThickness = 1 },
                UpFill = new SolidColorPaint(SKColor.Parse("#00C853")),
                DownFill = new SolidColorPaint(SKColor.Parse("#FF1744")),
                MaxBarWidth = 8
            };

            PriceChart.Series = new ISeries[] { candlestickSeries };

            // Volume Chart (Column)
            var volumeSeries = new ColumnSeries<double>
            {
                Values = _volumeData,
                Fill = new SolidColorPaint(SKColor.Parse("#404040")),
                MaxBarWidth = 6,
                Padding = 0
            };

            VolumeChart.Series = new ISeries[] { volumeSeries };
        }

        public async Task LoadChartDataAsync(string symbol, TimeResolution resolution)
        {
            if (_isUpdating) return;
            _isUpdating = true;

            // Cancel previous request
            _dataCts?.Cancel();
            _dataCts = new CancellationTokenSource();
            var token = _dataCts.Token;

            try
            {
                LoadingOverlay.Visibility = Visibility.Visible;

                var data = await _symbolService.GetRealtimeDataAsync(symbol, resolution, token);

                if (token.IsCancellationRequested) return;

                _rawData = data.ToList();
                UpdateChartData();

                // Update metadata
                var metadata = await _symbolService.GetSymbolMetadataAsync(symbol, token);
                if (metadata != null)
                {
                    ExchangeText.Text = metadata.Exchange;
                }

                // Update price info from last candle
                if (_rawData.Count > 0)
                {
                    var lastCandle = _rawData[^1];
                    UpdatePriceInfo(lastCandle);
                }
            }
            catch (OperationCanceledException)
            {
                // Ignore cancellation
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to load data: {ex.Message}", "Error",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                LoadingOverlay.Visibility = Visibility.Collapsed;
                _isUpdating = false;
            }
        }

        private void UpdateChartData()
        {
            _ohlcData.Clear();
            _volumeData.Clear();

            foreach (var point in _rawData)
            {
                _ohlcData.Add(new FinancialPoint(
                    point.Timestamp,
                    (double)point.High,
                    (double)point.Open,
                    (double)point.Close,
                    (double)point.Low
                ));
                _volumeData.Add(point.Volume);
            }
        }

        private void UpdatePriceInfo(OhlcDataPoint candle)
        {
            OpenValue.Text = candle.Open.ToString("F2");
            HighValue.Text = candle.High.ToString("F2");
            LowValue.Text = candle.Low.ToString("F2");
            CloseValue.Text = candle.Close.ToString("F2");

            var changePercent = candle.Open > 0
                ? ((candle.Close - candle.Open) / candle.Open) * 100
                : 0;

            if (changePercent >= 0)
            {
                ChangeValue.Text = $"+{changePercent:F2}%";
                ChangeValue.Foreground = (System.Windows.Media.Brush)FindResource("BullishBrush");
                CloseValue.Foreground = (System.Windows.Media.Brush)FindResource("BullishBrush");
            }
            else
            {
                ChangeValue.Text = $"{changePercent:F2}%";
                ChangeValue.Foreground = (System.Windows.Media.Brush)FindResource("BearishBrush");
                CloseValue.Foreground = (System.Windows.Media.Brush)FindResource("BearishBrush");
            }
        }

        #region Symbol Autocomplete

        private async void SymbolTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            var text = SymbolTextBox.Text?.Trim();
            if (string.IsNullOrEmpty(text) || text.Length < 1)
            {
                AutocompletePopup.IsOpen = false;
                return;
            }

            // Cancel previous search
            _searchCts?.Cancel();
            _searchCts = new CancellationTokenSource();
            var token = _searchCts.Token;

            try
            {
                await Task.Delay(150, token); // Debounce

                var results = await _symbolService.SearchSymbolsAsync(text, token);

                if (!token.IsCancellationRequested && results.Any())
                {
                    AutocompleteListBox.ItemsSource = results;
                    AutocompletePopup.IsOpen = true;
                }
                else
                {
                    AutocompletePopup.IsOpen = false;
                }
            }
            catch (OperationCanceledException)
            {
                // Ignore
            }
        }

        private void SymbolTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                var symbol = SymbolTextBox.Text?.Trim().ToUpperInvariant();
                if (!string.IsNullOrEmpty(symbol))
                {
                    AutocompletePopup.IsOpen = false;
                    SelectSymbol(symbol);
                }
                e.Handled = true;
            }
            else if (e.Key == Key.Down && AutocompletePopup.IsOpen)
            {
                AutocompleteListBox.Focus();
                if (AutocompleteListBox.Items.Count > 0)
                {
                    AutocompleteListBox.SelectedIndex = 0;
                }
                e.Handled = true;
            }
            else if (e.Key == Key.Escape)
            {
                AutocompletePopup.IsOpen = false;
                e.Handled = true;
            }
        }

        private void SymbolTextBox_GotFocus(object sender, RoutedEventArgs e)
        {
            SymbolTextBox.SelectAll();
        }

        private void SymbolTextBox_LostFocus(object sender, RoutedEventArgs e)
        {
            // Delay closing to allow click on popup
            Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Background,
                new Action(() =>
                {
                    if (!AutocompleteListBox.IsKeyboardFocusWithin)
                    {
                        AutocompletePopup.IsOpen = false;
                    }
                }));
        }

        private void AutocompleteListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (AutocompleteListBox.SelectedItem is SymbolMetadata metadata)
            {
                AutocompletePopup.IsOpen = false;
                SelectSymbol(metadata.Symbol);
                SymbolTextBox.Text = metadata.Symbol;
            }
        }

        private void SelectSymbol(string symbol)
        {
            CurrentSymbol = symbol;
            _ = LoadChartDataAsync(symbol, _currentResolution);
        }

        #endregion

        #region Resolution Selection

        private void Resolution_Checked(object sender, RoutedEventArgs e)
        {
            if (sender is RadioButton rb)
            {
                var resolution = rb.Name switch
                {
                    "Res1m" => TimeResolution.OneMinute,
                    "Res5m" => TimeResolution.FiveMinutes,
                    "Res15m" => TimeResolution.FifteenMinutes,
                    "Res1h" => TimeResolution.OneHour,
                    "Res4h" => TimeResolution.FourHours,
                    "ResD" => TimeResolution.OneDay,
                    "ResW" => TimeResolution.OneWeek,
                    _ => TimeResolution.OneMinute
                };

                if (_currentResolution != resolution)
                {
                    _currentResolution = resolution;
                    ResolutionChanged?.Invoke(this, resolution);
                    _ = LoadChartDataAsync(_currentSymbol, resolution);
                }
            }
        }

        #endregion

        #region Chart Interaction

        private void PriceChart_MouseMove(object sender, MouseEventArgs e)
        {
            var position = e.GetPosition(PriceChart);

            // Update crosshair
            CrosshairVertical.X1 = position.X;
            CrosshairVertical.X2 = position.X;
            CrosshairVertical.Y1 = 0;
            CrosshairVertical.Y2 = PriceChart.ActualHeight;
            CrosshairVertical.Visibility = Visibility.Visible;

            CrosshairHorizontal.X1 = 0;
            CrosshairHorizontal.X2 = PriceChart.ActualWidth;
            CrosshairHorizontal.Y1 = position.Y;
            CrosshairHorizontal.Y2 = position.Y;
            CrosshairHorizontal.Visibility = Visibility.Visible;

            // Update price label position
            Canvas.SetLeft(PriceLabel, PriceChart.ActualWidth - 60);
            Canvas.SetTop(PriceLabel, position.Y - 10);
            PriceLabel.Visibility = Visibility.Visible;

            // Calculate price at position (approximate)
            if (_rawData.Count > 0)
            {
                var minPrice = (double)_rawData.Min(d => d.Low);
                var maxPrice = (double)_rawData.Max(d => d.High);
                var priceRange = maxPrice - minPrice;
                var normalizedY = 1 - (position.Y / PriceChart.ActualHeight);
                var price = minPrice + (normalizedY * priceRange);
                PriceLabelText.Text = price.ToString("F2");

                // Find closest candle and update OHLC display
                var candleIndex = (int)(position.X / PriceChart.ActualWidth * _rawData.Count);
                if (candleIndex >= 0 && candleIndex < _rawData.Count)
                {
                    UpdatePriceInfo(_rawData[candleIndex]);
                }
            }
        }

        private void PriceChart_MouseWheel(object sender, MouseWheelEventArgs e)
        {
            var zoomFactor = e.Delta > 0 ? 1.1 : 0.9;
            _zoomLevel *= zoomFactor;
            _zoomLevel = Math.Max(0.5, Math.Min(5.0, _zoomLevel));

            // TODO: Implement proper zooming with visible range adjustment
            e.Handled = true;
        }

        #endregion

        #region Toolbar Actions

        private void IndicatorsButton_Click(object sender, RoutedEventArgs e)
        {
            // TODO: Show indicators menu
            MessageBox.Show("Indicators panel coming soon!", "Indicators",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void DrawingToolsButton_Click(object sender, RoutedEventArgs e)
        {
            // TODO: Show drawing tools
            MessageBox.Show("Drawing tools coming soon!", "Drawing Tools",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void ZoomInButton_Click(object sender, RoutedEventArgs e)
        {
            _zoomLevel *= 1.25;
            _zoomLevel = Math.Min(5.0, _zoomLevel);
            ApplyZoom();
        }

        private void ZoomOutButton_Click(object sender, RoutedEventArgs e)
        {
            _zoomLevel *= 0.8;
            _zoomLevel = Math.Max(0.5, _zoomLevel);
            ApplyZoom();
        }

        private void ResetViewButton_Click(object sender, RoutedEventArgs e)
        {
            _zoomLevel = 1.0;
            ApplyZoom();
            _ = LoadChartDataAsync(_currentSymbol, _currentResolution);
        }

        private void FullscreenButton_Click(object sender, RoutedEventArgs e)
        {
            // TODO: Toggle fullscreen mode
            var window = Window.GetWindow(this);
            if (window != null)
            {
                if (window.WindowState == WindowState.Maximized)
                {
                    window.WindowState = WindowState.Normal;
                }
                else
                {
                    window.WindowState = WindowState.Maximized;
                }
            }
        }

        private void ApplyZoom()
        {
            // Adjust visible data points based on zoom level
            var visibleCount = (int)(_rawData.Count / _zoomLevel);
            visibleCount = Math.Max(20, Math.Min(_rawData.Count, visibleCount));

            // Show last N candles
            var startIndex = Math.Max(0, _rawData.Count - visibleCount);

            _ohlcData.Clear();
            _volumeData.Clear();

            for (var i = startIndex; i < _rawData.Count; i++)
            {
                var point = _rawData[i];
                _ohlcData.Add(new FinancialPoint(
                    point.Timestamp,
                    (double)point.High,
                    (double)point.Open,
                    (double)point.Close,
                    (double)point.Low
                ));
                _volumeData.Add(point.Volume);
            }
        }

        #endregion

        public void RefreshChart()
        {
            _ = LoadChartDataAsync(_currentSymbol, _currentResolution);
        }
    }
}
