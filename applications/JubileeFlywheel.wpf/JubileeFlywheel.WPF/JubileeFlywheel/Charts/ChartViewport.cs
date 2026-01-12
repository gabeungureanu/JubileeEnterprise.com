namespace JubileeFlywheel.Charts;

/// <summary>
/// Represents the visible area of the chart in world coordinates (time/price)
/// Handles coordinate transformation between world and screen space
/// </summary>
public class ChartViewport
{
    // World coordinates (data space)
    public DateTime MinTime { get; private set; }
    public DateTime MaxTime { get; private set; }
    public double MinPrice { get; private set; }
    public double MaxPrice { get; private set; }

    // Screen coordinates (pixel space)
    public double ScreenWidth { get; private set; }
    public double ScreenHeight { get; private set; }

    // Margins for scales (in pixels)
    public double LeftMargin { get; set; } = 0;
    public double RightMargin { get; set; } = 80;
    public double TopMargin { get; set; } = 10;
    public double BottomMargin { get; set; } = 30;

    // Computed chart area
    public double ChartLeft => LeftMargin;
    public double ChartRight => ScreenWidth - RightMargin;
    public double ChartTop => TopMargin;
    public double ChartBottom => ScreenHeight - BottomMargin;
    public double ChartWidth => ChartRight - ChartLeft;
    public double ChartHeight => ChartBottom - ChartTop;

    // Time span
    public TimeSpan TimeRange => MaxTime - MinTime;
    public double PriceRange => MaxPrice - MinPrice;

    // Zoom limits
    public int MinVisibleBars { get; set; } = 10;
    public int MaxVisibleBars { get; set; } = 5000;

    // Price padding (percentage above/below data range)
    public double PricePadding { get; set; } = 0.05;

    public ChartViewport()
    {
        MinTime = DateTime.Now.AddDays(-30);
        MaxTime = DateTime.Now;
        MinPrice = 0;
        MaxPrice = 100;
        ScreenWidth = 800;
        ScreenHeight = 600;
    }

    /// <summary>
    /// Set screen dimensions
    /// </summary>
    public void SetScreenSize(double width, double height)
    {
        ScreenWidth = Math.Max(1, width);
        ScreenHeight = Math.Max(1, height);
    }

    /// <summary>
    /// Set world bounds with optional price padding
    /// </summary>
    public void SetWorldBounds(DateTime minTime, DateTime maxTime, double minPrice, double maxPrice, bool applyPadding = true)
    {
        MinTime = minTime;
        MaxTime = maxTime;

        if (applyPadding && maxPrice > minPrice)
        {
            double padding = (maxPrice - minPrice) * PricePadding;
            MinPrice = minPrice - padding;
            MaxPrice = maxPrice + padding;
        }
        else
        {
            MinPrice = minPrice;
            MaxPrice = maxPrice;
        }
    }

    /// <summary>
    /// Set time range only (keeps current price range)
    /// </summary>
    public void SetTimeRange(DateTime minTime, DateTime maxTime)
    {
        MinTime = minTime;
        MaxTime = maxTime;
    }

    /// <summary>
    /// Convert world time to screen X coordinate
    /// </summary>
    public double TimeToScreenX(DateTime time)
    {
        if (TimeRange.TotalSeconds <= 0) return ChartLeft;

        double fraction = (time - MinTime).TotalSeconds / TimeRange.TotalSeconds;
        return ChartLeft + (fraction * ChartWidth);
    }

    /// <summary>
    /// Convert screen X coordinate to world time
    /// </summary>
    public DateTime ScreenXToTime(double x)
    {
        if (ChartWidth <= 0) return MinTime;

        double fraction = (x - ChartLeft) / ChartWidth;
        fraction = Math.Clamp(fraction, 0, 1);
        return MinTime.AddSeconds(fraction * TimeRange.TotalSeconds);
    }

    /// <summary>
    /// Convert world price to screen Y coordinate (inverted - higher price = lower Y)
    /// </summary>
    public double PriceToScreenY(double price)
    {
        if (PriceRange <= 0) return ChartTop;

        double fraction = (price - MinPrice) / PriceRange;
        return ChartBottom - (fraction * ChartHeight);
    }

    /// <summary>
    /// Convert screen Y coordinate to world price
    /// </summary>
    public double ScreenYToPrice(double y)
    {
        if (ChartHeight <= 0) return MinPrice;

        double fraction = (ChartBottom - y) / ChartHeight;
        fraction = Math.Clamp(fraction, 0, 1);
        return MinPrice + (fraction * PriceRange);
    }

    /// <summary>
    /// Get bar width in pixels for given number of bars
    /// </summary>
    public double GetBarWidth(int barCount, double barSpacing = 0.2)
    {
        if (barCount <= 0) return 1;
        double totalWidth = ChartWidth / barCount;
        return totalWidth * (1 - barSpacing);
    }

    /// <summary>
    /// Pan the viewport by screen delta
    /// </summary>
    public void Pan(double deltaX, double deltaY)
    {
        // Calculate time delta
        double timePerPixel = TimeRange.TotalSeconds / ChartWidth;
        double timeDeltaSeconds = -deltaX * timePerPixel;
        MinTime = MinTime.AddSeconds(timeDeltaSeconds);
        MaxTime = MaxTime.AddSeconds(timeDeltaSeconds);

        // Calculate price delta
        double pricePerPixel = PriceRange / ChartHeight;
        double priceDelta = deltaY * pricePerPixel;
        MinPrice += priceDelta;
        MaxPrice += priceDelta;
    }

    /// <summary>
    /// Zoom the viewport around a screen point
    /// </summary>
    public void Zoom(double factor, double screenX, double screenY)
    {
        // Get world coordinates at zoom point
        DateTime focusTime = ScreenXToTime(screenX);
        double focusPrice = ScreenYToPrice(screenY);

        // Calculate new time range
        double newTimeRangeSeconds = TimeRange.TotalSeconds / factor;
        double focusFractionX = (screenX - ChartLeft) / ChartWidth;
        double newMinTimeSeconds = (focusTime - MinTime).TotalSeconds - (focusFractionX * newTimeRangeSeconds);
        MinTime = MinTime.AddSeconds(newMinTimeSeconds - (focusTime - MinTime).TotalSeconds + (focusFractionX * TimeRange.TotalSeconds));
        MaxTime = MinTime.AddSeconds(newTimeRangeSeconds);

        // Calculate new price range
        double newPriceRange = PriceRange / factor;
        double focusFractionY = (ChartBottom - screenY) / ChartHeight;
        double newMinPrice = focusPrice - (focusFractionY * newPriceRange);
        MinPrice = newMinPrice;
        MaxPrice = newMinPrice + newPriceRange;
    }

    /// <summary>
    /// Zoom horizontally only (time axis)
    /// </summary>
    public void ZoomTime(double factor, double screenX)
    {
        DateTime focusTime = ScreenXToTime(screenX);
        double newTimeRangeSeconds = TimeRange.TotalSeconds / factor;

        double focusFraction = (screenX - ChartLeft) / ChartWidth;
        double timeBeforeFocus = focusFraction * newTimeRangeSeconds;
        double timeAfterFocus = (1 - focusFraction) * newTimeRangeSeconds;

        MinTime = focusTime.AddSeconds(-timeBeforeFocus);
        MaxTime = focusTime.AddSeconds(timeAfterFocus);
    }

    /// <summary>
    /// Fit viewport to data series
    /// </summary>
    public void FitToData(ChartDataSeries data, int? visibleBars = null)
    {
        if (data.Bars.Count == 0) return;

        if (visibleBars.HasValue && visibleBars.Value < data.Bars.Count)
        {
            // Show only last N bars
            int startIndex = data.Bars.Count - visibleBars.Value;
            var visibleData = data.Bars.Skip(startIndex).ToList();
            SetWorldBounds(
                visibleData.First().Timestamp,
                visibleData.Last().Timestamp,
                visibleData.Min(b => b.Low),
                visibleData.Max(b => b.High)
            );
        }
        else
        {
            SetWorldBounds(data.MinTime, data.MaxTime, data.MinPrice, data.MaxPrice);
        }
    }

    /// <summary>
    /// Check if a bar is visible in the current viewport
    /// </summary>
    public bool IsBarVisible(OhlcBar bar)
    {
        return bar.Timestamp >= MinTime && bar.Timestamp <= MaxTime;
    }

    /// <summary>
    /// Get visible bars from data series
    /// </summary>
    public IEnumerable<(int Index, OhlcBar Bar)> GetVisibleBars(ChartDataSeries data)
    {
        for (int i = 0; i < data.Bars.Count; i++)
        {
            if (IsBarVisible(data.Bars[i]))
            {
                yield return (i, data.Bars[i]);
            }
        }
    }
}
