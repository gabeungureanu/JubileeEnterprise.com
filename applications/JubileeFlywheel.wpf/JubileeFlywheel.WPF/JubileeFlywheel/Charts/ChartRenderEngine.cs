using SkiaSharp;
using JubileeFlywheel.Charts.Indicators;

namespace JubileeFlywheel.Charts;

/// <summary>
/// High-performance GPU-accelerated chart rendering engine using SkiaSharp
/// </summary>
public class ChartRenderEngine : IDisposable
{
    private readonly ChartViewport _viewport;
    private readonly ChartColors _colors;
    private readonly IndicatorRenderer _indicatorRenderer;
    private ChartDataSeries? _data;
    private ChartType _chartType = ChartType.Candlestick;

    // Sub-panel configuration
    private float _subPanelHeight = 100; // Height per sub-panel indicator

    // Cached paints (reused to avoid GC pressure)
    private SKPaint _backgroundPaint;
    private SKPaint _gridLinePaint;
    private SKPaint _gridLineMajorPaint;
    private SKPaint _bullishBodyPaint;
    private SKPaint _bullishWickPaint;
    private SKPaint _bearishBodyPaint;
    private SKPaint _bearishWickPaint;
    private SKPaint _linePaint;
    private SKPaint _areaFillPaint;
    private SKPaint _scaleTextPaint;
    private SKPaint _scaleLinePaint;
    private SKPaint _crosshairLinePaint;
    private SKPaint _crosshairBgPaint;
    private SKPaint _crosshairTextPaint;

    // Crosshair state
    private bool _showCrosshair;
    private float _crosshairX;
    private float _crosshairY;

    // Frame throttling
    private DateTime _lastRenderTime = DateTime.MinValue;
    private readonly TimeSpan _minFrameInterval = TimeSpan.FromMilliseconds(16); // ~60 FPS

    // Renko/P&F settings
    public double RenkoBrickSize { get; set; } = 1.0;
    public double PnfBoxSize { get; set; } = 1.0;
    public int PnfReversalBoxes { get; set; } = 3;

    public ChartRenderEngine(ChartViewport viewport, ChartColors? colors = null)
    {
        _viewport = viewport;
        _colors = colors ?? ChartColors.DarkTheme;
        _indicatorRenderer = new IndicatorRenderer(viewport);
        InitializePaints();
    }

    /// <summary>
    /// Access to the indicator renderer for adding/removing indicators
    /// </summary>
    public IndicatorRenderer Indicators => _indicatorRenderer;

    private void InitializePaints()
    {
        _backgroundPaint = new SKPaint
        {
            Color = _colors.Background,
            Style = SKPaintStyle.Fill,
            IsAntialias = false
        };

        _gridLinePaint = new SKPaint
        {
            Color = _colors.GridLines,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = 1,
            IsAntialias = false
        };

        _gridLineMajorPaint = new SKPaint
        {
            Color = _colors.GridLinesMajor,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = 1,
            IsAntialias = false
        };

        _bullishBodyPaint = new SKPaint
        {
            Color = _colors.BullishBody,
            Style = SKPaintStyle.Fill,
            IsAntialias = true
        };

        _bullishWickPaint = new SKPaint
        {
            Color = _colors.BullishWick,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = 1,
            IsAntialias = true
        };

        _bearishBodyPaint = new SKPaint
        {
            Color = _colors.BearishBody,
            Style = SKPaintStyle.Fill,
            IsAntialias = true
        };

        _bearishWickPaint = new SKPaint
        {
            Color = _colors.BearishWick,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = 1,
            IsAntialias = true
        };

        _linePaint = new SKPaint
        {
            Color = _colors.LineColor,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = 2,
            IsAntialias = true,
            StrokeCap = SKStrokeCap.Round,
            StrokeJoin = SKStrokeJoin.Round
        };

        _areaFillPaint = new SKPaint
        {
            Style = SKPaintStyle.Fill,
            IsAntialias = true
        };

        _scaleTextPaint = new SKPaint
        {
            Color = _colors.ScaleText,
            TextSize = 11,
            IsAntialias = true,
            Typeface = SKTypeface.FromFamilyName("Segoe UI", SKFontStyle.Normal)
        };

        _scaleLinePaint = new SKPaint
        {
            Color = _colors.ScaleLine,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = 1,
            IsAntialias = false
        };

        _crosshairLinePaint = new SKPaint
        {
            Color = _colors.CrosshairLine,
            Style = SKPaintStyle.Stroke,
            StrokeWidth = 1,
            IsAntialias = false,
            PathEffect = SKPathEffect.CreateDash(new float[] { 4, 4 }, 0)
        };

        _crosshairBgPaint = new SKPaint
        {
            Color = _colors.CrosshairBackground,
            Style = SKPaintStyle.Fill,
            IsAntialias = true
        };

        _crosshairTextPaint = new SKPaint
        {
            Color = _colors.CrosshairText,
            TextSize = 11,
            IsAntialias = true,
            Typeface = SKTypeface.FromFamilyName("Segoe UI", SKFontStyle.Normal)
        };
    }

    /// <summary>
    /// Set chart data
    /// </summary>
    public void SetData(ChartDataSeries data)
    {
        _data = data;
        // Recalculate all indicators with new data
        if (_data != null && _data.Bars.Count > 0)
        {
            _indicatorRenderer.Calculate(_data.Bars);
        }
    }

    /// <summary>
    /// Set chart type
    /// </summary>
    public void SetChartType(ChartType chartType)
    {
        _chartType = chartType;
    }

    /// <summary>
    /// Update crosshair position
    /// </summary>
    public void SetCrosshair(float x, float y, bool show)
    {
        _showCrosshair = show;
        _crosshairX = x;
        _crosshairY = y;
    }

    /// <summary>
    /// Check if enough time has passed for next frame (60 FPS throttle)
    /// </summary>
    public bool ShouldRender()
    {
        var now = DateTime.UtcNow;
        if (now - _lastRenderTime < _minFrameInterval)
            return false;
        _lastRenderTime = now;
        return true;
    }

    /// <summary>
    /// Main render method - called by SKElement
    /// </summary>
    public void Render(SKCanvas canvas, int width, int height)
    {
        // Calculate sub-panel space needed
        float subPanelTotalHeight = _indicatorRenderer.GetSubPanelHeight((int)_subPanelHeight);

        // Adjust viewport for sub-panels
        _viewport.SetScreenSize(width, height, subPanelTotalHeight);

        // Clear background
        canvas.Clear(_colors.Background);

        // Render layers
        RenderGrid(canvas);
        RenderChart(canvas);

        // Render overlay indicators on the main chart
        if (_data != null && _data.Bars.Count > 0)
        {
            _indicatorRenderer.RenderOverlays(canvas, _data.Bars);
        }

        RenderPriceScale(canvas);
        RenderTimeScale(canvas);

        // Render sub-panel indicators below the main chart
        if (_data != null && _data.Bars.Count > 0 && subPanelTotalHeight > 0)
        {
            float subPanelTop = (float)_viewport.ChartBottom + 30; // After time scale
            _indicatorRenderer.RenderSubPanels(canvas, _data.Bars, subPanelTop, subPanelTotalHeight);
        }

        if (_showCrosshair)
        {
            RenderCrosshair(canvas);
        }
    }

    /// <summary>
    /// Recalculate all indicators (call after adding/removing indicators or changing parameters)
    /// </summary>
    public void RecalculateIndicators()
    {
        if (_data != null && _data.Bars.Count > 0)
        {
            _indicatorRenderer.Calculate(_data.Bars);
        }
    }

    private void RenderGrid(SKCanvas canvas)
    {
        // Horizontal grid lines (price levels)
        int priceLines = 8;
        double priceStep = _viewport.PriceRange / priceLines;

        for (int i = 0; i <= priceLines; i++)
        {
            double price = _viewport.MinPrice + (i * priceStep);
            float y = (float)_viewport.PriceToScreenY(price);

            canvas.DrawLine(
                (float)_viewport.ChartLeft, y,
                (float)_viewport.ChartRight, y,
                i % 2 == 0 ? _gridLineMajorPaint : _gridLinePaint
            );
        }

        // Vertical grid lines (time intervals)
        int timeLines = 10;
        double timeStep = _viewport.TimeRange.TotalSeconds / timeLines;

        for (int i = 0; i <= timeLines; i++)
        {
            DateTime time = _viewport.MinTime.AddSeconds(i * timeStep);
            float x = (float)_viewport.TimeToScreenX(time);

            canvas.DrawLine(
                x, (float)_viewport.ChartTop,
                x, (float)_viewport.ChartBottom,
                i % 2 == 0 ? _gridLineMajorPaint : _gridLinePaint
            );
        }
    }

    private void RenderChart(SKCanvas canvas)
    {
        if (_data == null || _data.Bars.Count == 0) return;

        switch (_chartType)
        {
            case ChartType.Candlestick:
                RenderCandlesticks(canvas, _data.Bars);
                break;
            case ChartType.OHLC:
                RenderOHLC(canvas, _data.Bars);
                break;
            case ChartType.Line:
                RenderLine(canvas, _data.Bars);
                break;
            case ChartType.Area:
                RenderArea(canvas, _data.Bars);
                break;
            case ChartType.HeikinAshi:
                RenderCandlesticks(canvas, _data.ToHeikinAshi());
                break;
            case ChartType.Renko:
                RenderRenko(canvas, _data.ToRenko(RenkoBrickSize));
                break;
            case ChartType.PointAndFigure:
                RenderPointAndFigure(canvas, _data.ToPointAndFigure(PnfBoxSize, PnfReversalBoxes));
                break;
        }
    }

    private void RenderCandlesticks(SKCanvas canvas, IList<OhlcBar> bars)
    {
        if (bars.Count == 0) return;

        // Calculate bar width
        int visibleBars = bars.Count(b => _viewport.IsBarVisible(b));
        float barWidth = Math.Max(1, (float)_viewport.GetBarWidth(visibleBars, 0.2));
        float halfWidth = barWidth / 2;

        foreach (var bar in bars)
        {
            if (!_viewport.IsBarVisible(bar)) continue;

            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float openY = (float)_viewport.PriceToScreenY(bar.Open);
            float closeY = (float)_viewport.PriceToScreenY(bar.Close);
            float highY = (float)_viewport.PriceToScreenY(bar.High);
            float lowY = (float)_viewport.PriceToScreenY(bar.Low);

            var bodyPaint = bar.IsBullish ? _bullishBodyPaint : _bearishBodyPaint;
            var wickPaint = bar.IsBullish ? _bullishWickPaint : _bearishWickPaint;

            // Draw wick (high-low line)
            canvas.DrawLine(x, highY, x, lowY, wickPaint);

            // Draw body
            float bodyTop = Math.Min(openY, closeY);
            float bodyBottom = Math.Max(openY, closeY);
            float bodyHeight = Math.Max(1, bodyBottom - bodyTop);

            var bodyRect = new SKRect(x - halfWidth, bodyTop, x + halfWidth, bodyTop + bodyHeight);
            canvas.DrawRect(bodyRect, bodyPaint);
        }
    }

    private void RenderOHLC(SKCanvas canvas, IList<OhlcBar> bars)
    {
        if (bars.Count == 0) return;

        int visibleBars = bars.Count(b => _viewport.IsBarVisible(b));
        float tickWidth = Math.Max(2, (float)_viewport.GetBarWidth(visibleBars, 0.3) / 2);

        foreach (var bar in bars)
        {
            if (!_viewport.IsBarVisible(bar)) continue;

            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float openY = (float)_viewport.PriceToScreenY(bar.Open);
            float closeY = (float)_viewport.PriceToScreenY(bar.Close);
            float highY = (float)_viewport.PriceToScreenY(bar.High);
            float lowY = (float)_viewport.PriceToScreenY(bar.Low);

            var paint = bar.IsBullish ? _bullishWickPaint : _bearishWickPaint;

            // Vertical line (high-low)
            canvas.DrawLine(x, highY, x, lowY, paint);

            // Open tick (left)
            canvas.DrawLine(x - tickWidth, openY, x, openY, paint);

            // Close tick (right)
            canvas.DrawLine(x, closeY, x + tickWidth, closeY, paint);
        }
    }

    private void RenderLine(SKCanvas canvas, IList<OhlcBar> bars)
    {
        if (bars.Count < 2) return;

        var path = new SKPath();
        bool first = true;

        foreach (var bar in bars)
        {
            if (!_viewport.IsBarVisible(bar)) continue;

            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float y = (float)_viewport.PriceToScreenY(bar.Close);

            if (first)
            {
                path.MoveTo(x, y);
                first = false;
            }
            else
            {
                path.LineTo(x, y);
            }
        }

        canvas.DrawPath(path, _linePaint);
        path.Dispose();
    }

    private void RenderArea(SKCanvas canvas, IList<OhlcBar> bars)
    {
        if (bars.Count < 2) return;

        var linePath = new SKPath();
        var areaPath = new SKPath();
        bool first = true;
        float firstX = 0, lastX = 0;

        foreach (var bar in bars)
        {
            if (!_viewport.IsBarVisible(bar)) continue;

            float x = (float)_viewport.TimeToScreenX(bar.Timestamp);
            float y = (float)_viewport.PriceToScreenY(bar.Close);

            if (first)
            {
                linePath.MoveTo(x, y);
                areaPath.MoveTo(x, (float)_viewport.ChartBottom);
                areaPath.LineTo(x, y);
                firstX = x;
                first = false;
            }
            else
            {
                linePath.LineTo(x, y);
                areaPath.LineTo(x, y);
            }
            lastX = x;
        }

        // Close area path
        areaPath.LineTo(lastX, (float)_viewport.ChartBottom);
        areaPath.Close();

        // Create gradient for area fill
        _areaFillPaint.Shader = SKShader.CreateLinearGradient(
            new SKPoint(0, (float)_viewport.ChartTop),
            new SKPoint(0, (float)_viewport.ChartBottom),
            new SKColor[] { _colors.AreaGradientTop, _colors.AreaGradientBottom },
            null,
            SKShaderTileMode.Clamp
        );

        canvas.DrawPath(areaPath, _areaFillPaint);
        canvas.DrawPath(linePath, _linePaint);

        linePath.Dispose();
        areaPath.Dispose();
    }

    private void RenderRenko(SKCanvas canvas, IList<RenkoBrick> bricks)
    {
        if (bricks.Count == 0) return;

        float brickWidth = Math.Max(5, (float)_viewport.ChartWidth / Math.Max(1, bricks.Count) * 0.8f);
        float halfWidth = brickWidth / 2;

        for (int i = 0; i < bricks.Count; i++)
        {
            var brick = bricks[i];
            float x = (float)_viewport.ChartLeft + (i * brickWidth * 1.1f) + halfWidth;
            float openY = (float)_viewport.PriceToScreenY(brick.Open);
            float closeY = (float)_viewport.PriceToScreenY(brick.Close);

            var paint = brick.IsBullish ? _bullishBodyPaint : _bearishBodyPaint;

            float top = Math.Min(openY, closeY);
            float bottom = Math.Max(openY, closeY);
            var rect = new SKRect(x - halfWidth, top, x + halfWidth, bottom);
            canvas.DrawRect(rect, paint);
        }
    }

    private void RenderPointAndFigure(SKCanvas canvas, IList<PnfBox> boxes)
    {
        if (boxes.Count == 0) return;

        int maxColumn = boxes.Max(b => b.Column);
        float columnWidth = (float)_viewport.ChartWidth / Math.Max(1, maxColumn + 1);
        float boxHeight = Math.Max(5, (float)(_viewport.PriceRange > 0
            ? _viewport.ChartHeight / (_viewport.PriceRange / PnfBoxSize)
            : 10));

        foreach (var box in boxes)
        {
            float x = (float)_viewport.ChartLeft + (box.Column * columnWidth) + columnWidth / 2;
            float y = (float)_viewport.PriceToScreenY(box.Price);

            if (box.IsX)
            {
                // Draw X
                float size = Math.Min(columnWidth, boxHeight) * 0.4f;
                canvas.DrawLine(x - size, y - size, x + size, y + size, _bullishWickPaint);
                canvas.DrawLine(x - size, y + size, x + size, y - size, _bullishWickPaint);
            }
            else
            {
                // Draw O
                float radius = Math.Min(columnWidth, boxHeight) * 0.35f;
                using var circlePaint = new SKPaint
                {
                    Color = _colors.BearishBody,
                    Style = SKPaintStyle.Stroke,
                    StrokeWidth = 2,
                    IsAntialias = true
                };
                canvas.DrawCircle(x, y, radius, circlePaint);
            }
        }
    }

    private void RenderPriceScale(SKCanvas canvas)
    {
        // Draw scale background
        var scaleRect = new SKRect(
            (float)_viewport.ChartRight, 0,
            (float)_viewport.ScreenWidth, (float)_viewport.ScreenHeight
        );
        canvas.DrawRect(scaleRect, new SKPaint { Color = _colors.ScaleBackground });

        // Draw price labels
        int priceLines = 8;
        double priceStep = _viewport.PriceRange / priceLines;

        for (int i = 0; i <= priceLines; i++)
        {
            double price = _viewport.MinPrice + (i * priceStep);
            float y = (float)_viewport.PriceToScreenY(price);

            // Draw tick mark
            canvas.DrawLine(
                (float)_viewport.ChartRight, y,
                (float)_viewport.ChartRight + 4, y,
                _scaleLinePaint
            );

            // Draw price text
            string priceText = FormatPrice(price);
            float textX = (float)_viewport.ChartRight + 8;
            float textY = y + _scaleTextPaint.TextSize / 3;
            canvas.DrawText(priceText, textX, textY, _scaleTextPaint);
        }
    }

    private void RenderTimeScale(SKCanvas canvas)
    {
        // Draw scale background
        var scaleRect = new SKRect(
            0, (float)_viewport.ChartBottom,
            (float)_viewport.ScreenWidth, (float)_viewport.ScreenHeight
        );
        canvas.DrawRect(scaleRect, new SKPaint { Color = _colors.ScaleBackground });

        // Draw time labels
        int timeLines = 8;
        double timeStep = _viewport.TimeRange.TotalSeconds / timeLines;

        for (int i = 0; i <= timeLines; i++)
        {
            DateTime time = _viewport.MinTime.AddSeconds(i * timeStep);
            float x = (float)_viewport.TimeToScreenX(time);

            // Draw tick mark
            canvas.DrawLine(
                x, (float)_viewport.ChartBottom,
                x, (float)_viewport.ChartBottom + 4,
                _scaleLinePaint
            );

            // Draw time text
            string timeText = FormatTime(time);
            float textWidth = _scaleTextPaint.MeasureText(timeText);
            float textX = x - textWidth / 2;
            float textY = (float)_viewport.ChartBottom + 18;
            canvas.DrawText(timeText, textX, textY, _scaleTextPaint);
        }
    }

    private void RenderCrosshair(SKCanvas canvas)
    {
        // Clamp to chart area
        float x = Math.Clamp(_crosshairX, (float)_viewport.ChartLeft, (float)_viewport.ChartRight);
        float y = Math.Clamp(_crosshairY, (float)_viewport.ChartTop, (float)_viewport.ChartBottom);

        // Draw crosshair lines
        canvas.DrawLine(x, (float)_viewport.ChartTop, x, (float)_viewport.ChartBottom, _crosshairLinePaint);
        canvas.DrawLine((float)_viewport.ChartLeft, y, (float)_viewport.ChartRight, y, _crosshairLinePaint);

        // Get values at crosshair
        DateTime time = _viewport.ScreenXToTime(x);
        double price = _viewport.ScreenYToPrice(y);

        // Draw price label on right scale
        string priceText = FormatPrice(price);
        float priceTextWidth = _crosshairTextPaint.MeasureText(priceText);
        float priceLabelX = (float)_viewport.ChartRight + 4;
        float priceLabelY = y;

        var priceLabelRect = new SKRect(
            priceLabelX - 2, priceLabelY - 10,
            priceLabelX + priceTextWidth + 6, priceLabelY + 6
        );
        canvas.DrawRoundRect(priceLabelRect, 2, 2, _crosshairBgPaint);
        canvas.DrawText(priceText, priceLabelX + 2, priceLabelY + 2, _crosshairTextPaint);

        // Draw time label on bottom scale
        string timeText = FormatTimeFull(time);
        float timeTextWidth = _crosshairTextPaint.MeasureText(timeText);
        float timeLabelX = x - timeTextWidth / 2;
        float timeLabelY = (float)_viewport.ChartBottom + 4;

        var timeLabelRect = new SKRect(
            timeLabelX - 4, timeLabelY,
            timeLabelX + timeTextWidth + 4, timeLabelY + 18
        );
        canvas.DrawRoundRect(timeLabelRect, 2, 2, _crosshairBgPaint);
        canvas.DrawText(timeText, timeLabelX, timeLabelY + 13, _crosshairTextPaint);
    }

    private string FormatPrice(double price)
    {
        if (Math.Abs(price) >= 1000)
            return price.ToString("N0");
        if (Math.Abs(price) >= 1)
            return price.ToString("N2");
        return price.ToString("N4");
    }

    private string FormatTime(DateTime time)
    {
        if (_viewport.TimeRange.TotalDays > 365)
            return time.ToString("yyyy");
        if (_viewport.TimeRange.TotalDays > 30)
            return time.ToString("MMM");
        if (_viewport.TimeRange.TotalDays > 1)
            return time.ToString("MM/dd");
        return time.ToString("HH:mm");
    }

    private string FormatTimeFull(DateTime time)
    {
        if (_viewport.TimeRange.TotalDays > 1)
            return time.ToString("yyyy-MM-dd HH:mm");
        return time.ToString("HH:mm:ss");
    }

    public void Dispose()
    {
        _backgroundPaint?.Dispose();
        _gridLinePaint?.Dispose();
        _gridLineMajorPaint?.Dispose();
        _bullishBodyPaint?.Dispose();
        _bullishWickPaint?.Dispose();
        _bearishBodyPaint?.Dispose();
        _bearishWickPaint?.Dispose();
        _linePaint?.Dispose();
        _areaFillPaint?.Dispose();
        _scaleTextPaint?.Dispose();
        _scaleLinePaint?.Dispose();
        _crosshairLinePaint?.Dispose();
        _crosshairBgPaint?.Dispose();
        _crosshairTextPaint?.Dispose();
    }
}
