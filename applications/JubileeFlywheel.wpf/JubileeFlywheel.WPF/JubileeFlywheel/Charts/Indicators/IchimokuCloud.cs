using SkiaSharp;

namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Ichimoku Cloud (Ichimoku Kinko Hyo) - comprehensive indicator showing support/resistance,
/// trend direction, and momentum
/// </summary>
public class IchimokuIndicator : IndicatorBase
{
    public override string Name => "Ichimoku Cloud";
    public override string ShortName => "Ichimoku";
    public override string Description => "Japanese charting technique showing support, resistance, trend, and momentum";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    public IchimokuIndicator(int tenkanPeriod = 9, int kijunPeriod = 26, int senkouBPeriod = 52)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Tenkan",
            DisplayName = "Tenkan-sen (Conversion)",
            Value = tenkanPeriod,
            MinValue = 1,
            MaxValue = 100,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Kijun",
            DisplayName = "Kijun-sen (Base)",
            Value = kijunPeriod,
            MinValue = 1,
            MaxValue = 200,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "SenkouB",
            DisplayName = "Senkou Span B",
            Value = senkouBPeriod,
            MinValue = 1,
            MaxValue = 200,
            Step = 1,
            Type = ParameterType.Integer
        });

        // Tenkan-sen (Conversion Line) - short-term trend
        _series.Add(new IndicatorSeries
        {
            Name = "Tenkan-sen",
            Color = new SKColor(0x21, 0x96, 0xF3), // Blue
            StrokeWidth = 1f
        });

        // Kijun-sen (Base Line) - medium-term trend
        _series.Add(new IndicatorSeries
        {
            Name = "Kijun-sen",
            Color = new SKColor(0xF4, 0x43, 0x36), // Red
            StrokeWidth = 1f
        });

        // Chikou Span (Lagging Span) - current close shifted back
        _series.Add(new IndicatorSeries
        {
            Name = "Chikou Span",
            Color = new SKColor(0x4C, 0xAF, 0x50), // Green
            StrokeWidth = 1f
        });

        // Senkou Span A (Leading Span A) - upper/lower cloud boundary
        _series.Add(new IndicatorSeries
        {
            Name = "Senkou Span A",
            Color = new SKColor(0x4C, 0xAF, 0x50, 0x80), // Green transparent
            StrokeWidth = 1f
        });

        // Senkou Span B (Leading Span B) - upper/lower cloud boundary
        _series.Add(new IndicatorSeries
        {
            Name = "Senkou Span B",
            Color = new SKColor(0xF4, 0x43, 0x36, 0x80), // Red transparent
            StrokeWidth = 1f
        });

        // Cloud fill (bullish - green when A > B, bearish - red when B > A)
        _series.Add(new IndicatorSeries
        {
            Name = "Cloud",
            Color = new SKColor(0x4C, 0xAF, 0x50, 0x30), // Default bullish
            IsFilled = true,
            FillColor = new SKColor(0x4C, 0xAF, 0x50, 0x30)
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int tenkanPeriod = (int)GetParameter("Tenkan");
        int kijunPeriod = (int)GetParameter("Kijun");
        int senkouBPeriod = (int)GetParameter("SenkouB");
        int displacement = kijunPeriod; // Standard displacement

        var tenkan = _series[0];
        var kijun = _series[1];
        var chikou = _series[2];
        var senkouA = _series[3];
        var senkouB = _series[4];
        var cloud = _series[5];

        // Clear all series
        tenkan.Values.Clear();
        kijun.Values.Clear();
        chikou.Values.Clear();
        senkouA.Values.Clear();
        senkouB.Values.Clear();
        cloud.Values.Clear();

        if (bars.Count == 0) return;

        // Pre-calculate Tenkan and Kijun for Senkou A calculation
        List<double?> tenkanValues = new();
        List<double?> kijunValues = new();

        for (int i = 0; i < bars.Count; i++)
        {
            // Tenkan-sen (Conversion Line)
            tenkanValues.Add(CalculateMidpoint(bars, i, tenkanPeriod));

            // Kijun-sen (Base Line)
            kijunValues.Add(CalculateMidpoint(bars, i, kijunPeriod));
        }

        // Now fill in all series with proper displacement
        for (int i = 0; i < bars.Count + displacement; i++)
        {
            // Tenkan-sen and Kijun-sen (current values, no displacement)
            if (i < bars.Count)
            {
                tenkan.Values.Add(tenkanValues[i]);
                kijun.Values.Add(kijunValues[i]);
            }
            else
            {
                tenkan.Values.Add(null);
                kijun.Values.Add(null);
            }

            // Chikou Span (current close, shifted back by displacement)
            // At position i, we show the close from i + displacement
            if (i + displacement < bars.Count)
            {
                chikou.Values.Add(bars[i + displacement].Close);
            }
            else
            {
                chikou.Values.Add(null);
            }

            // Senkou Span A (average of Tenkan and Kijun, shifted forward by displacement)
            // At position i, we show the value calculated from i - displacement
            int sourceIndex = i - displacement;
            if (sourceIndex >= 0 && sourceIndex < bars.Count &&
                tenkanValues[sourceIndex].HasValue && kijunValues[sourceIndex].HasValue)
            {
                senkouA.Values.Add((tenkanValues[sourceIndex]!.Value + kijunValues[sourceIndex]!.Value) / 2);
            }
            else
            {
                senkouA.Values.Add(null);
            }

            // Senkou Span B (midpoint of Senkou B period, shifted forward)
            if (sourceIndex >= 0 && sourceIndex < bars.Count)
            {
                senkouB.Values.Add(CalculateMidpoint(bars, sourceIndex, senkouBPeriod));
            }
            else
            {
                senkouB.Values.Add(null);
            }

            // Cloud reference (for rendering)
            cloud.Values.Add(senkouA.Values[i]);
        }
    }

    private double? CalculateMidpoint(IReadOnlyList<OhlcBar> bars, int endIndex, int period)
    {
        if (endIndex < period - 1) return null;

        double highest = double.MinValue;
        double lowest = double.MaxValue;

        for (int i = 0; i < period && endIndex - i >= 0; i++)
        {
            highest = Math.Max(highest, bars[endIndex - i].High);
            lowest = Math.Min(lowest, bars[endIndex - i].Low);
        }

        return (highest + lowest) / 2;
    }

    public override IIndicator Clone()
    {
        return new IchimokuIndicator(
            (int)GetParameter("Tenkan"),
            (int)GetParameter("Kijun"),
            (int)GetParameter("SenkouB"));
    }
}
