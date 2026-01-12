using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using SkiaSharp;
using SkiaSharp.Views.Desktop;
using JubileeFlywheel.Charts.Indicators;

namespace JubileeFlywheel.Charts;

/// <summary>
/// High-performance GPU-accelerated chart control using SkiaSharp
/// </summary>
public partial class SkiaChartControl : UserControl
{
    private readonly ChartViewport _viewport;
    private readonly ChartRenderEngine _renderEngine;
    private ChartDataSeries _data;

    // Pan state
    private bool _isPanning;
    private Point _panStartPoint;
    private DateTime _panStartMinTime;
    private DateTime _panStartMaxTime;
    private double _panStartMinPrice;
    private double _panStartMaxPrice;

    // Current symbol
    public string Symbol { get; set; } = "AAPL";

    public SkiaChartControl()
    {
        InitializeComponent();

        _viewport = new ChartViewport();
        _renderEngine = new ChartRenderEngine(_viewport, ChartColors.DarkTheme);
        _data = new ChartDataSeries();

        DataContext = this;

        // Load sample data on init
        Loaded += (s, e) =>
        {
            LoadSampleData();
            InvalidateChart();
        };
    }

    /// <summary>
    /// Set chart data
    /// </summary>
    public void SetData(ChartDataSeries data)
    {
        _data = data;
        _renderEngine.SetData(_data);
        _viewport.FitToData(_data, 100);
        InvalidateChart();
    }

    /// <summary>
    /// Invalidate and redraw chart
    /// </summary>
    public void InvalidateChart()
    {
        ChartCanvas?.InvalidateVisual();
    }

    private void ChartCanvas_PaintSurface(object sender, SKPaintSurfaceEventArgs e)
    {
        var canvas = e.Surface.Canvas;
        var info = e.Info;

        _renderEngine.Render(canvas, info.Width, info.Height);
    }

    private void ChartCanvas_MouseMove(object sender, MouseEventArgs e)
    {
        var pos = e.GetPosition(ChartCanvas);

        if (_isPanning)
        {
            // Calculate delta
            double deltaX = pos.X - _panStartPoint.X;
            double deltaY = pos.Y - _panStartPoint.Y;

            // Calculate time/price change
            double timePerPixel = (_panStartMaxTime - _panStartMinTime).TotalSeconds / _viewport.ChartWidth;
            double pricePerPixel = (_panStartMaxPrice - _panStartMinPrice) / _viewport.ChartHeight;

            _viewport.SetTimeRange(
                _panStartMinTime.AddSeconds(-deltaX * timePerPixel),
                _panStartMaxTime.AddSeconds(-deltaX * timePerPixel)
            );

            // Update price bounds (inverted Y)
            _viewport.SetWorldBounds(
                _viewport.MinTime,
                _viewport.MaxTime,
                _panStartMinPrice + (deltaY * pricePerPixel),
                _panStartMaxPrice + (deltaY * pricePerPixel),
                false
            );
        }
        else
        {
            // Update crosshair
            _renderEngine.SetCrosshair((float)pos.X, (float)pos.Y, true);

            // Update OHLC info if hovering over a bar
            UpdateOhlcInfo(pos);
        }

        InvalidateChart();
    }

    private void ChartCanvas_MouseLeave(object sender, MouseEventArgs e)
    {
        _renderEngine.SetCrosshair(0, 0, false);
        OhlcInfo.Text = "";
        InvalidateChart();
    }

    private void ChartCanvas_MouseWheel(object sender, MouseWheelEventArgs e)
    {
        var pos = e.GetPosition(ChartCanvas);
        double zoomFactor = e.Delta > 0 ? 1.2 : 0.8;

        // Zoom time axis only (more intuitive)
        _viewport.ZoomTime(zoomFactor, pos.X);

        // Fit price to visible data
        FitPriceToVisibleData();

        InvalidateChart();
    }

    private void ChartCanvas_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        _isPanning = true;
        _panStartPoint = e.GetPosition(ChartCanvas);
        _panStartMinTime = _viewport.MinTime;
        _panStartMaxTime = _viewport.MaxTime;
        _panStartMinPrice = _viewport.MinPrice;
        _panStartMaxPrice = _viewport.MaxPrice;

        ChartCanvas.CaptureMouse();
        Cursor = Cursors.Hand;
    }

    private void ChartCanvas_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        _isPanning = false;
        ChartCanvas.ReleaseMouseCapture();
        Cursor = Cursors.Arrow;
    }

    private void ChartTypeCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // Guard against XAML initialization firing before constructor completes
        if (_renderEngine == null || ChartTypeCombo.SelectedIndex < 0) return;

        var chartType = ChartTypeCombo.SelectedIndex switch
        {
            0 => ChartType.Candlestick,
            1 => ChartType.OHLC,
            2 => ChartType.Line,
            3 => ChartType.Area,
            4 => ChartType.HeikinAshi,
            5 => ChartType.Renko,
            6 => ChartType.PointAndFigure,
            _ => ChartType.Candlestick
        };

        _renderEngine.SetChartType(chartType);
        InvalidateChart();
    }

    private void IntervalCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // Guard against XAML initialization firing before constructor completes
        if (_renderEngine == null) return;

        // For now, just regenerate sample data with different characteristics
        // In production, this would fetch new data from the data service
        LoadSampleData();
        InvalidateChart();
    }

    private void SymbolTextBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            LoadSymbol(SymbolTextBox.Text?.ToUpperInvariant() ?? "AAPL");
        }
    }

    private void LoadButton_Click(object sender, RoutedEventArgs e)
    {
        LoadSymbol(SymbolTextBox.Text?.ToUpperInvariant() ?? "AAPL");
    }

    private void FitButton_Click(object sender, RoutedEventArgs e)
    {
        _viewport.FitToData(_data);
        InvalidateChart();
    }

    private void ZoomInButton_Click(object sender, RoutedEventArgs e)
    {
        _viewport.ZoomTime(1.5, _viewport.ChartLeft + _viewport.ChartWidth / 2);
        FitPriceToVisibleData();
        InvalidateChart();
    }

    private void ZoomOutButton_Click(object sender, RoutedEventArgs e)
    {
        _viewport.ZoomTime(0.67, _viewport.ChartLeft + _viewport.ChartWidth / 2);
        FitPriceToVisibleData();
        InvalidateChart();
    }

    private void IndicatorsButton_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new IndicatorManagerDialog(_renderEngine.Indicators, _data);
        dialog.Owner = Window.GetWindow(this);

        if (dialog.ShowDialog() == true)
        {
            // Recalculate and redraw after changes
            _renderEngine.RecalculateIndicators();
            InvalidateChart();
        }
    }

    /// <summary>
    /// Add an indicator to the chart
    /// </summary>
    public void AddIndicator(IIndicator indicator)
    {
        _renderEngine.Indicators.AddIndicator(indicator);
        _renderEngine.RecalculateIndicators();
        InvalidateChart();
    }

    /// <summary>
    /// Remove an indicator from the chart
    /// </summary>
    public void RemoveIndicator(string indicatorId)
    {
        _renderEngine.Indicators.RemoveIndicator(indicatorId);
        InvalidateChart();
    }

    /// <summary>
    /// Remove all indicators
    /// </summary>
    public void ClearIndicators()
    {
        _renderEngine.Indicators.ClearIndicators();
        InvalidateChart();
    }

    /// <summary>
    /// Get the list of current indicators
    /// </summary>
    public IReadOnlyList<IIndicator> GetIndicators()
    {
        return _renderEngine.Indicators.Indicators;
    }

    private void LoadSymbol(string symbol)
    {
        Symbol = symbol;
        // In production, this would fetch real data
        LoadSampleData();
        InvalidateChart();
    }

    private void FitPriceToVisibleData()
    {
        if (_data.Bars.Count == 0) return;

        var visibleBars = _data.Bars.Where(b => _viewport.IsBarVisible(b)).ToList();
        if (visibleBars.Count == 0) return;

        double minPrice = visibleBars.Min(b => b.Low);
        double maxPrice = visibleBars.Max(b => b.High);

        _viewport.SetWorldBounds(_viewport.MinTime, _viewport.MaxTime, minPrice, maxPrice, true);
    }

    private void UpdateOhlcInfo(Point pos)
    {
        if (_data.Bars.Count == 0) return;

        DateTime hoverTime = _viewport.ScreenXToTime(pos.X);

        // Find nearest bar
        var nearestBar = _data.Bars
            .OrderBy(b => Math.Abs((b.Timestamp - hoverTime).TotalSeconds))
            .FirstOrDefault();

        if (nearestBar.Timestamp != default)
        {
            string changeStr = nearestBar.Close >= nearestBar.Open
                ? $"+{nearestBar.Close - nearestBar.Open:F2}"
                : $"{nearestBar.Close - nearestBar.Open:F2}";

            OhlcInfo.Text = $"O: {nearestBar.Open:F2}  H: {nearestBar.High:F2}  L: {nearestBar.Low:F2}  C: {nearestBar.Close:F2}  ({changeStr})  Vol: {nearestBar.Volume:N0}";
            OhlcInfo.Foreground = nearestBar.IsBullish
                ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0x00, 0xC8, 0x53))
                : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xFF, 0x17, 0x44));
        }
    }

    private void LoadSampleData()
    {
        _data = new ChartDataSeries
        {
            Symbol = Symbol,
            Interval = ChartInterval.Day1
        };

        // Generate realistic price action
        var random = new Random(Symbol.GetHashCode());
        double basePrice = 100 + random.NextDouble() * 400; // Random base price 100-500
        double price = basePrice;
        double volatility = 0.02 + random.NextDouble() * 0.03; // 2-5% daily volatility

        DateTime startDate = DateTime.Now.AddDays(-200);

        for (int i = 0; i < 200; i++)
        {
            DateTime timestamp = startDate.AddDays(i);

            // Skip weekends
            if (timestamp.DayOfWeek == DayOfWeek.Saturday || timestamp.DayOfWeek == DayOfWeek.Sunday)
                continue;

            // Random walk with momentum
            double change = (random.NextDouble() - 0.48) * volatility * price; // Slight upward bias
            double open = price;
            double close = price + change;

            // Ensure close is positive
            close = Math.Max(close, price * 0.9);

            double high = Math.Max(open, close) + random.NextDouble() * volatility * price * 0.5;
            double low = Math.Min(open, close) - random.NextDouble() * volatility * price * 0.5;

            // Volume varies with price movement
            double volume = 1000000 + random.NextDouble() * 5000000 + Math.Abs(change / price) * 10000000;

            _data.Bars.Add(new OhlcBar(timestamp, open, high, low, close, volume));

            price = close;
        }

        _renderEngine.SetData(_data);
        _viewport.FitToData(_data, 100);

        // Set Renko/P&F sizes based on price
        _renderEngine.RenkoBrickSize = basePrice * 0.01; // 1% of price
        _renderEngine.PnfBoxSize = basePrice * 0.005; // 0.5% of price
    }
}
