using SkiaSharp;

namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Bollinger Bands - volatility bands placed above and below a moving average
/// </summary>
public class BollingerBandsIndicator : IndicatorBase
{
    public override string Name => "Bollinger Bands";
    public override string ShortName => $"BB({(int)GetParameter("Period")},{GetParameter("StdDev"):F1})";
    public override string Description => "Volatility bands using standard deviation from a moving average";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    public BollingerBandsIndicator(int period = 20, double stdDev = 2.0)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Period",
            DisplayName = "Period",
            Value = period,
            MinValue = 2,
            MaxValue = 200,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "StdDev",
            DisplayName = "Standard Deviations",
            Value = stdDev,
            MinValue = 0.5,
            MaxValue = 5.0,
            Step = 0.5,
            Type = ParameterType.Double
        });

        // Middle band (SMA)
        _series.Add(new IndicatorSeries
        {
            Name = "Middle",
            Color = new SKColor(0x21, 0x96, 0xF3), // Blue
            StrokeWidth = 1.5f
        });

        // Upper band
        _series.Add(new IndicatorSeries
        {
            Name = "Upper",
            Color = new SKColor(0x21, 0x96, 0xF3, 0x80), // Blue transparent
            StrokeWidth = 1f
        });

        // Lower band
        _series.Add(new IndicatorSeries
        {
            Name = "Lower",
            Color = new SKColor(0x21, 0x96, 0xF3, 0x80), // Blue transparent
            StrokeWidth = 1f
        });

        // Fill between bands
        _series.Add(new IndicatorSeries
        {
            Name = "Fill",
            Color = new SKColor(0x21, 0x96, 0xF3, 0x20), // Very transparent blue
            IsFilled = true,
            FillColor = new SKColor(0x21, 0x96, 0xF3, 0x20)
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int period = (int)GetParameter("Period");
        double stdDevMultiplier = GetParameter("StdDev");

        var middle = _series[0];
        var upper = _series[1];
        var lower = _series[2];
        var fill = _series[3];

        middle.Values.Clear();
        upper.Values.Clear();
        lower.Values.Clear();
        fill.Values.Clear();

        for (int i = 0; i < bars.Count; i++)
        {
            if (i < period - 1)
            {
                middle.Values.Add(null);
                upper.Values.Add(null);
                lower.Values.Add(null);
                fill.Values.Add(null);
            }
            else
            {
                // Calculate SMA
                double sum = 0;
                for (int j = 0; j < period; j++)
                {
                    sum += bars[i - j].Close;
                }
                double sma = sum / period;

                // Calculate standard deviation
                double squaredSum = 0;
                for (int j = 0; j < period; j++)
                {
                    double diff = bars[i - j].Close - sma;
                    squaredSum += diff * diff;
                }
                double stdDev = Math.Sqrt(squaredSum / period);

                middle.Values.Add(sma);
                upper.Values.Add(sma + stdDevMultiplier * stdDev);
                lower.Values.Add(sma - stdDevMultiplier * stdDev);
                fill.Values.Add(sma); // Used for reference in rendering
            }
        }
    }

    public override IIndicator Clone()
    {
        return new BollingerBandsIndicator(
            (int)GetParameter("Period"),
            GetParameter("StdDev"));
    }
}

/// <summary>
/// Keltner Channels - volatility-based bands using ATR
/// </summary>
public class KeltnerChannelIndicator : IndicatorBase
{
    public override string Name => "Keltner Channel";
    public override string ShortName => $"KC({(int)GetParameter("Period")},{GetParameter("Multiplier"):F1})";
    public override string Description => "Volatility bands using Average True Range";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    public KeltnerChannelIndicator(int period = 20, double multiplier = 2.0)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Period",
            DisplayName = "Period",
            Value = period,
            MinValue = 2,
            MaxValue = 200,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Multiplier",
            DisplayName = "ATR Multiplier",
            Value = multiplier,
            MinValue = 0.5,
            MaxValue = 5.0,
            Step = 0.5,
            Type = ParameterType.Double
        });

        _series.Add(new IndicatorSeries
        {
            Name = "Middle",
            Color = new SKColor(0xFF, 0x98, 0x00), // Orange
            StrokeWidth = 1.5f
        });

        _series.Add(new IndicatorSeries
        {
            Name = "Upper",
            Color = new SKColor(0xFF, 0x98, 0x00, 0x80),
            StrokeWidth = 1f
        });

        _series.Add(new IndicatorSeries
        {
            Name = "Lower",
            Color = new SKColor(0xFF, 0x98, 0x00, 0x80),
            StrokeWidth = 1f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int period = (int)GetParameter("Period");
        double multiplier = GetParameter("Multiplier");

        var middle = _series[0];
        var upper = _series[1];
        var lower = _series[2];

        middle.Values.Clear();
        upper.Values.Clear();
        lower.Values.Clear();

        if (bars.Count == 0) return;

        // Calculate ATR
        List<double> trueRanges = new();
        for (int i = 0; i < bars.Count; i++)
        {
            if (i == 0)
            {
                trueRanges.Add(bars[i].High - bars[i].Low);
            }
            else
            {
                double tr = Math.Max(
                    bars[i].High - bars[i].Low,
                    Math.Max(
                        Math.Abs(bars[i].High - bars[i - 1].Close),
                        Math.Abs(bars[i].Low - bars[i - 1].Close)));
                trueRanges.Add(tr);
            }
        }

        // Calculate EMA for middle band and ATR
        double emaMultiplier = 2.0 / (period + 1);
        double? prevEma = null;
        double? prevAtr = null;

        for (int i = 0; i < bars.Count; i++)
        {
            if (i < period - 1)
            {
                middle.Values.Add(null);
                upper.Values.Add(null);
                lower.Values.Add(null);
            }
            else if (i == period - 1)
            {
                // Initial values are simple averages
                double sum = 0;
                double atrSum = 0;
                for (int j = 0; j < period; j++)
                {
                    sum += bars[i - j].Close;
                    atrSum += trueRanges[i - j];
                }
                prevEma = sum / period;
                prevAtr = atrSum / period;

                middle.Values.Add(prevEma);
                upper.Values.Add(prevEma + multiplier * prevAtr);
                lower.Values.Add(prevEma - multiplier * prevAtr);
            }
            else
            {
                double currentEma = (bars[i].Close - prevEma!.Value) * emaMultiplier + prevEma.Value;
                double currentAtr = (trueRanges[i] - prevAtr!.Value) * emaMultiplier + prevAtr.Value;

                middle.Values.Add(currentEma);
                upper.Values.Add(currentEma + multiplier * currentAtr);
                lower.Values.Add(currentEma - multiplier * currentAtr);

                prevEma = currentEma;
                prevAtr = currentAtr;
            }
        }
    }

    public override IIndicator Clone()
    {
        return new KeltnerChannelIndicator(
            (int)GetParameter("Period"),
            GetParameter("Multiplier"));
    }
}
