using SkiaSharp;

namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Renders technical indicators on the chart
/// </summary>
public class IndicatorRenderer
{
    private readonly ChartViewport _viewport;
    private readonly List<IIndicator> _indicators = new();

    // Cached paints for efficiency
    private readonly Dictionary<SKColor, SKPaint> _linePaints = new();
    private readonly Dictionary<SKColor, SKPaint> _fillPaints = new();
    private readonly SKPaint _levelLinePaint;
    private readonly SKPaint _levelTextPaint;

    public IReadOnlyList<IIndicator> Indicators => _indicators;

    public IndicatorRenderer(ChartViewport viewport)
    {
        _viewport = viewport;

        _levelLinePaint = new SKPaint
        {
            Style = SKPaintStyle.Stroke,
            Color = new SKColor(0x80, 0x80, 0x80, 0x60),
            StrokeWidth = 1,
            PathEffect = SKPathEffect.CreateDash(new[] { 4f, 4f }, 0)
        };

        _levelTextPaint = new SKPaint
        {
            Color = new SKColor(0xAA, 0xAA, 0xAA),
            TextSize = 10,
            IsAntialias = true
        };
    }

    public void AddIndicator(IIndicator indicator)
    {
        _indicators.Add(indicator);
    }

    public void RemoveIndicator(IIndicator indicator)
    {
        _indicators.Remove(indicator);
    }

    public void RemoveIndicator(string id)
    {
        var indicator = _indicators.FirstOrDefault(i => i.Id == id);
        if (indicator != null)
        {
            _indicators.Remove(indicator);
        }
    }

    public void ClearIndicators()
    {
        _indicators.Clear();
    }

    /// <summary>
    /// Calculate all indicators with the given price data
    /// </summary>
    public void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        foreach (var indicator in _indicators)
        {
            indicator.Calculate(bars);
        }
    }

    /// <summary>
    /// Render overlay indicators on the main chart
    /// </summary>
    public void RenderOverlays(SKCanvas canvas, IReadOnlyList<OhlcBar> bars)
    {
        var overlayIndicators = _indicators.Where(i => i.RenderMode == IndicatorRenderMode.Overlay);

        foreach (var indicator in overlayIndicators)
        {
            RenderIndicator(canvas, indicator, bars);
        }
    }

    /// <summary>
    /// Render sub-panel indicators below the main chart
    /// </summary>
    public void RenderSubPanels(SKCanvas canvas, IReadOnlyList<OhlcBar> bars, float panelTop, float panelHeight)
    {
        var subPanelIndicators = _indicators.Where(i => i.RenderMode == IndicatorRenderMode.SubPanel).ToList();

        if (subPanelIndicators.Count == 0) return;

        float individualPanelHeight = panelHeight / subPanelIndicators.Count;
        float currentTop = panelTop;

        foreach (var indicator in subPanelIndicators)
        {
            RenderSubPanelIndicator(canvas, indicator, bars, currentTop, individualPanelHeight);
            currentTop += individualPanelHeight;
        }
    }

    /// <summary>
    /// Get total height needed for sub-panels
    /// </summary>
    public float GetSubPanelHeight(int subPanelPixelHeight = 100)
    {
        int count = _indicators.Count(i => i.RenderMode == IndicatorRenderMode.SubPanel);
        return count * subPanelPixelHeight;
    }

    private void RenderIndicator(SKCanvas canvas, IIndicator indicator, IReadOnlyList<OhlcBar> bars)
    {
        // Special handling for volume profile
        if (indicator is VolumeProfileIndicator volumeProfile)
        {
            RenderVolumeProfile(canvas, volumeProfile, bars);
            return;
        }

        // Special handling for Ichimoku cloud
        if (indicator is IchimokuIndicator ichimoku)
        {
            RenderIchimoku(canvas, ichimoku, bars);
            return;
        }

        // Special handling for Bollinger Bands fill
        if (indicator is BollingerBandsIndicator bollinger)
        {
            RenderBollingerBands(canvas, bollinger, bars);
            return;
        }

        // Render each series as a line
        foreach (var series in indicator.Series)
        {
            if (series.IsFilled || series.IsHistogram) continue;
            RenderLineSeries(canvas, series, bars);
        }
    }

    private void RenderLineSeries(SKCanvas canvas, IndicatorSeries series, IReadOnlyList<OhlcBar> bars)
    {
        if (series.Values.Count == 0) return;

        var paint = GetLinePaint(series.Color, series.StrokeWidth);
        var path = new SKPath();
        bool pathStarted = false;

        for (int i = 0; i < Math.Min(bars.Count, series.Values.Count); i++)
        {
            if (!series.Values[i].HasValue)
            {
                if (pathStarted)
                {
                    canvas.DrawPath(path, paint);
                    path.Reset();
                    pathStarted = false;
                }
                continue;
            }

            var bar = bars[i];
            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float y = (float)_viewport.PriceToScreenY(series.Values[i]!.Value);

            if (!pathStarted)
            {
                path.MoveTo(x, y);
                pathStarted = true;
            }
            else
            {
                path.LineTo(x, y);
            }
        }

        if (pathStarted)
        {
            canvas.DrawPath(path, paint);
        }
    }

    private void RenderBollingerBands(SKCanvas canvas, BollingerBandsIndicator bollinger, IReadOnlyList<OhlcBar> bars)
    {
        var middle = bollinger.Series[0];
        var upper = bollinger.Series[1];
        var lower = bollinger.Series[2];

        // Draw fill between upper and lower
        var fillPaint = GetFillPaint(new SKColor(0x21, 0x96, 0xF3, 0x20));
        var fillPath = new SKPath();
        bool fillStarted = false;
        List<SKPoint> lowerPoints = new();

        for (int i = 0; i < Math.Min(bars.Count, upper.Values.Count); i++)
        {
            if (!upper.Values[i].HasValue || !lower.Values[i].HasValue) continue;

            var bar = bars[i];
            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float yUpper = (float)_viewport.PriceToScreenY(upper.Values[i]!.Value);
            float yLower = (float)_viewport.PriceToScreenY(lower.Values[i]!.Value);

            if (!fillStarted)
            {
                fillPath.MoveTo(x, yUpper);
                fillStarted = true;
            }
            else
            {
                fillPath.LineTo(x, yUpper);
            }

            lowerPoints.Add(new SKPoint(x, yLower));
        }

        // Close the path by going back along the lower band
        for (int i = lowerPoints.Count - 1; i >= 0; i--)
        {
            fillPath.LineTo(lowerPoints[i].X, lowerPoints[i].Y);
        }
        fillPath.Close();
        canvas.DrawPath(fillPath, fillPaint);

        // Draw the lines
        RenderLineSeries(canvas, middle, bars);
        RenderLineSeries(canvas, upper, bars);
        RenderLineSeries(canvas, lower, bars);
    }

    private void RenderIchimoku(SKCanvas canvas, IchimokuIndicator ichimoku, IReadOnlyList<OhlcBar> bars)
    {
        var senkouA = ichimoku.Series[3];
        var senkouB = ichimoku.Series[4];

        // Draw cloud fill
        var bullishFill = GetFillPaint(new SKColor(0x4C, 0xAF, 0x50, 0x30));
        var bearishFill = GetFillPaint(new SKColor(0xF4, 0x43, 0x36, 0x30));

        // We need to handle the extended data for Ichimoku
        int maxValues = Math.Max(senkouA.Values.Count, senkouB.Values.Count);

        for (int i = 0; i < maxValues - 1; i++)
        {
            if (!senkouA.Values[i].HasValue || !senkouB.Values[i].HasValue ||
                !senkouA.Values[i + 1].HasValue || !senkouB.Values[i + 1].HasValue)
                continue;

            // Calculate x positions (may extend beyond bars)
            DateTime time1 = i < bars.Count ? bars[i].Timestamp :
                bars[bars.Count - 1].Timestamp.AddDays(i - bars.Count + 1);
            DateTime time2 = i + 1 < bars.Count ? bars[i + 1].Timestamp :
                bars[bars.Count - 1].Timestamp.AddDays(i - bars.Count + 2);

            float x1 = (float)_viewport.TimeToScreenX(time1);
            float x2 = (float)_viewport.TimeToScreenX(time2);

            float yA1 = (float)_viewport.PriceToScreenY(senkouA.Values[i]!.Value);
            float yB1 = (float)_viewport.PriceToScreenY(senkouB.Values[i]!.Value);
            float yA2 = (float)_viewport.PriceToScreenY(senkouA.Values[i + 1]!.Value);
            float yB2 = (float)_viewport.PriceToScreenY(senkouB.Values[i + 1]!.Value);

            var cloudPath = new SKPath();
            cloudPath.MoveTo(x1, yA1);
            cloudPath.LineTo(x2, yA2);
            cloudPath.LineTo(x2, yB2);
            cloudPath.LineTo(x1, yB1);
            cloudPath.Close();

            bool isBullish = senkouA.Values[i]!.Value > senkouB.Values[i]!.Value;
            canvas.DrawPath(cloudPath, isBullish ? bullishFill : bearishFill);
        }

        // Draw the lines (first 3 series: Tenkan, Kijun, Chikou)
        for (int s = 0; s < 3; s++)
        {
            RenderLineSeries(canvas, ichimoku.Series[s], bars);
        }

        // Draw Senkou spans
        RenderLineSeries(canvas, senkouA, bars);
        RenderLineSeries(canvas, senkouB, bars);
    }

    private void RenderVolumeProfile(SKCanvas canvas, VolumeProfileIndicator volumeProfile, IReadOnlyList<OhlcBar> bars)
    {
        if (volumeProfile.VolumeLevels.Count == 0) return;

        float profileWidth = (float)(_viewport.ChartWidth * volumeProfile.GetParameter("Width") / 100);
        float profileRight = (float)(_viewport.ChartLeft + _viewport.ChartWidth);
        float profileLeft = profileRight - profileWidth;

        double maxVolume = volumeProfile.VolumeLevels.Max(l => l.Volume);
        if (maxVolume <= 0) return;

        var buyPaint = GetFillPaint(new SKColor(0x4C, 0xAF, 0x50, 0x80));
        var sellPaint = GetFillPaint(new SKColor(0xF4, 0x43, 0x36, 0x80));
        var pocPaint = GetFillPaint(new SKColor(0xFF, 0xEB, 0x3B, 0xA0));

        foreach (var level in volumeProfile.VolumeLevels)
        {
            float yTop = (float)_viewport.PriceToScreenY(level.PriceHigh);
            float yBottom = (float)_viewport.PriceToScreenY(level.PriceLow);
            float height = yBottom - yTop;

            float totalWidth = (float)(level.Volume / maxVolume * profileWidth);
            float buyWidth = (float)(level.BuyVolume / maxVolume * profileWidth);
            float sellWidth = (float)(level.SellVolume / maxVolume * profileWidth);

            // Draw buy volume (left side)
            if (buyWidth > 0)
            {
                canvas.DrawRect(profileLeft, yTop, buyWidth, height,
                    level.IsPointOfControl ? pocPaint : buyPaint);
            }

            // Draw sell volume (right of buy)
            if (sellWidth > 0)
            {
                canvas.DrawRect(profileLeft + buyWidth, yTop, sellWidth, height,
                    level.IsPointOfControl ? pocPaint : sellPaint);
            }
        }

        // Draw POC, VAH, VAL lines
        RenderLineSeries(canvas, volumeProfile.Series[0], bars); // POC
        RenderLineSeries(canvas, volumeProfile.Series[1], bars); // VAH
        RenderLineSeries(canvas, volumeProfile.Series[2], bars); // VAL
    }

    private void RenderSubPanelIndicator(SKCanvas canvas, IIndicator indicator, IReadOnlyList<OhlcBar> bars,
        float panelTop, float panelHeight)
    {
        float chartLeft = (float)_viewport.ChartLeft;
        float chartWidth = (float)_viewport.ChartWidth;

        // Draw panel background
        var bgPaint = new SKPaint { Color = new SKColor(0x1A, 0x1A, 0x1A) };
        canvas.DrawRect(chartLeft, panelTop, chartWidth, panelHeight, bgPaint);

        // Draw separator line
        var separatorPaint = new SKPaint
        {
            Color = new SKColor(0x40, 0x40, 0x40),
            StrokeWidth = 1
        };
        canvas.DrawLine(chartLeft, panelTop, chartLeft + chartWidth, panelTop, separatorPaint);

        // Calculate value range
        var (fixedMin, fixedMax) = indicator.FixedScale;
        double minValue, maxValue;

        if (fixedMin.HasValue && fixedMax.HasValue)
        {
            minValue = fixedMin.Value;
            maxValue = fixedMax.Value;
        }
        else
        {
            // Auto-scale based on visible values
            var allValues = indicator.Series
                .SelectMany(s => s.Values)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();

            if (allValues.Count == 0) return;

            minValue = allValues.Min();
            maxValue = allValues.Max();

            // Add padding
            double range = maxValue - minValue;
            if (range < 0.01) range = 0.01;
            minValue -= range * 0.1;
            maxValue += range * 0.1;
        }

        // Draw level lines for RSI/Stochastic
        if (indicator is RsiIndicator rsi)
        {
            float overboughtY = ValueToY(rsi.GetParameter("Overbought"), minValue, maxValue, panelTop, panelHeight);
            float oversoldY = ValueToY(rsi.GetParameter("Oversold"), minValue, maxValue, panelTop, panelHeight);
            float midY = ValueToY(50, minValue, maxValue, panelTop, panelHeight);

            canvas.DrawLine(chartLeft, overboughtY, chartLeft + chartWidth, overboughtY, _levelLinePaint);
            canvas.DrawLine(chartLeft, oversoldY, chartLeft + chartWidth, oversoldY, _levelLinePaint);
            canvas.DrawLine(chartLeft, midY, chartLeft + chartWidth, midY, _levelLinePaint);
        }

        // Draw zero line for MACD
        if (indicator is MacdIndicator)
        {
            float zeroY = ValueToY(0, minValue, maxValue, panelTop, panelHeight);
            canvas.DrawLine(chartLeft, zeroY, chartLeft + chartWidth, zeroY, _levelLinePaint);
        }

        // Draw each series
        foreach (var series in indicator.Series)
        {
            if (series.IsHistogram)
            {
                RenderHistogram(canvas, series, bars, minValue, maxValue, panelTop, panelHeight);
            }
            else
            {
                RenderSubPanelLine(canvas, series, bars, minValue, maxValue, panelTop, panelHeight);
            }
        }

        // Draw indicator name
        canvas.DrawText(indicator.ShortName, chartLeft + 5, panelTop + 15, _levelTextPaint);
    }

    private void RenderSubPanelLine(SKCanvas canvas, IndicatorSeries series, IReadOnlyList<OhlcBar> bars,
        double minValue, double maxValue, float panelTop, float panelHeight)
    {
        if (series.Values.Count == 0) return;

        var paint = GetLinePaint(series.Color, series.StrokeWidth);
        var path = new SKPath();
        bool pathStarted = false;

        for (int i = 0; i < Math.Min(bars.Count, series.Values.Count); i++)
        {
            if (!series.Values[i].HasValue)
            {
                if (pathStarted)
                {
                    canvas.DrawPath(path, paint);
                    path.Reset();
                    pathStarted = false;
                }
                continue;
            }

            var bar = bars[i];
            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float y = ValueToY(series.Values[i]!.Value, minValue, maxValue, panelTop, panelHeight);

            if (!pathStarted)
            {
                path.MoveTo(x, y);
                pathStarted = true;
            }
            else
            {
                path.LineTo(x, y);
            }
        }

        if (pathStarted)
        {
            canvas.DrawPath(path, paint);
        }
    }

    private void RenderHistogram(SKCanvas canvas, IndicatorSeries series, IReadOnlyList<OhlcBar> bars,
        double minValue, double maxValue, float panelTop, float panelHeight)
    {
        if (series.Values.Count == 0) return;

        float zeroY = ValueToY(0, minValue, maxValue, panelTop, panelHeight);
        float barWidth = (float)(_viewport.ChartWidth / Math.Max(1, bars.Count)) * 0.6f;

        var positivePaint = GetFillPaint(new SKColor(0x4C, 0xAF, 0x50));
        var negativePaint = GetFillPaint(new SKColor(0xF4, 0x43, 0x36));

        for (int i = 0; i < Math.Min(bars.Count, series.Values.Count); i++)
        {
            if (!series.Values[i].HasValue) continue;

            var bar = bars[i];
            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float y = ValueToY(series.Values[i]!.Value, minValue, maxValue, panelTop, panelHeight);

            float height = Math.Abs(y - zeroY);
            float top = series.Values[i]!.Value >= 0 ? y : zeroY;

            canvas.DrawRect(x - barWidth / 2, top, barWidth, height,
                series.Values[i]!.Value >= 0 ? positivePaint : negativePaint);
        }
    }

    private float ValueToY(double value, double minValue, double maxValue, float panelTop, float panelHeight)
    {
        double ratio = (value - minValue) / (maxValue - minValue);
        return panelTop + panelHeight - (float)(ratio * panelHeight);
    }

    private SKPaint GetLinePaint(SKColor color, float strokeWidth)
    {
        if (!_linePaints.TryGetValue(color, out var paint))
        {
            paint = new SKPaint
            {
                Style = SKPaintStyle.Stroke,
                Color = color,
                StrokeWidth = strokeWidth,
                IsAntialias = true,
                StrokeCap = SKStrokeCap.Round,
                StrokeJoin = SKStrokeJoin.Round
            };
            _linePaints[color] = paint;
        }
        paint.StrokeWidth = strokeWidth;
        return paint;
    }

    private SKPaint GetFillPaint(SKColor color)
    {
        if (!_fillPaints.TryGetValue(color, out var paint))
        {
            paint = new SKPaint
            {
                Style = SKPaintStyle.Fill,
                Color = color,
                IsAntialias = true
            };
            _fillPaints[color] = paint;
        }
        return paint;
    }
}
