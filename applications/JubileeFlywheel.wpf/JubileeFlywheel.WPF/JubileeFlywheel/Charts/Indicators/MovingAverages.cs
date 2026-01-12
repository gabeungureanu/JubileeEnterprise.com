using SkiaSharp;

namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Simple Moving Average (SMA)
/// </summary>
public class SmaIndicator : IndicatorBase
{
    public override string Name => "Simple Moving Average";
    public override string ShortName => $"SMA({(int)GetParameter("Period")})";
    public override string Description => "Average price over a specified period";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    public SmaIndicator(int period = 20, SKColor? color = null)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Period",
            DisplayName = "Period",
            Value = period,
            MinValue = 1,
            MaxValue = 500,
            Step = 1,
            Type = ParameterType.Integer
        });

        _series.Add(new IndicatorSeries
        {
            Name = "SMA",
            Color = color ?? new SKColor(0x21, 0x96, 0xF3), // Blue
            StrokeWidth = 1.5f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int period = (int)GetParameter("Period");
        var sma = _series[0];
        sma.Values.Clear();

        for (int i = 0; i < bars.Count; i++)
        {
            if (i < period - 1)
            {
                sma.Values.Add(null);
            }
            else
            {
                double sum = 0;
                for (int j = 0; j < period; j++)
                {
                    sum += bars[i - j].Close;
                }
                sma.Values.Add(sum / period);
            }
        }
    }

    public override IIndicator Clone()
    {
        return new SmaIndicator((int)GetParameter("Period"), _series[0].Color);
    }
}

/// <summary>
/// Exponential Moving Average (EMA)
/// </summary>
public class EmaIndicator : IndicatorBase
{
    public override string Name => "Exponential Moving Average";
    public override string ShortName => $"EMA({(int)GetParameter("Period")})";
    public override string Description => "Weighted moving average giving more weight to recent prices";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    public EmaIndicator(int period = 20, SKColor? color = null)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Period",
            DisplayName = "Period",
            Value = period,
            MinValue = 1,
            MaxValue = 500,
            Step = 1,
            Type = ParameterType.Integer
        });

        _series.Add(new IndicatorSeries
        {
            Name = "EMA",
            Color = color ?? new SKColor(0xFF, 0x98, 0x00), // Orange
            StrokeWidth = 1.5f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int period = (int)GetParameter("Period");
        var ema = _series[0];
        ema.Values.Clear();

        if (bars.Count == 0) return;

        double multiplier = 2.0 / (period + 1);
        double? prevEma = null;

        for (int i = 0; i < bars.Count; i++)
        {
            if (i < period - 1)
            {
                ema.Values.Add(null);
            }
            else if (i == period - 1)
            {
                // First EMA is SMA
                double sum = 0;
                for (int j = 0; j < period; j++)
                {
                    sum += bars[i - j].Close;
                }
                prevEma = sum / period;
                ema.Values.Add(prevEma);
            }
            else
            {
                double currentEma = (bars[i].Close - prevEma!.Value) * multiplier + prevEma.Value;
                ema.Values.Add(currentEma);
                prevEma = currentEma;
            }
        }
    }

    public override IIndicator Clone()
    {
        return new EmaIndicator((int)GetParameter("Period"), _series[0].Color);
    }
}

/// <summary>
/// Volume Weighted Average Price (VWAP)
/// </summary>
public class VwapIndicator : IndicatorBase
{
    public override string Name => "Volume Weighted Average Price";
    public override string ShortName => "VWAP";
    public override string Description => "Average price weighted by volume, typically reset daily";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    public VwapIndicator(SKColor? color = null)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "ResetDaily",
            DisplayName = "Reset Daily",
            Value = 1,
            MinValue = 0,
            MaxValue = 1,
            Step = 1,
            Type = ParameterType.Boolean
        });

        _series.Add(new IndicatorSeries
        {
            Name = "VWAP",
            Color = color ?? new SKColor(0x9C, 0x27, 0xB0), // Purple
            StrokeWidth = 2f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        bool resetDaily = GetParameter("ResetDaily") > 0.5;
        var vwap = _series[0];
        vwap.Values.Clear();

        double cumulativeTPV = 0; // Typical Price * Volume
        double cumulativeVolume = 0;
        DateTime? lastDate = null;

        for (int i = 0; i < bars.Count; i++)
        {
            var bar = bars[i];

            // Reset at start of new day if enabled
            if (resetDaily && lastDate.HasValue && bar.Timestamp.Date != lastDate.Value.Date)
            {
                cumulativeTPV = 0;
                cumulativeVolume = 0;
            }

            double typicalPrice = (bar.High + bar.Low + bar.Close) / 3;
            cumulativeTPV += typicalPrice * bar.Volume;
            cumulativeVolume += bar.Volume;

            if (cumulativeVolume > 0)
            {
                vwap.Values.Add(cumulativeTPV / cumulativeVolume);
            }
            else
            {
                vwap.Values.Add(null);
            }

            lastDate = bar.Timestamp;
        }
    }

    public override IIndicator Clone()
    {
        return new VwapIndicator(_series[0].Color);
    }
}

/// <summary>
/// Weighted Moving Average (WMA)
/// </summary>
public class WmaIndicator : IndicatorBase
{
    public override string Name => "Weighted Moving Average";
    public override string ShortName => $"WMA({(int)GetParameter("Period")})";
    public override string Description => "Moving average with linearly decreasing weights";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    public WmaIndicator(int period = 20, SKColor? color = null)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Period",
            DisplayName = "Period",
            Value = period,
            MinValue = 1,
            MaxValue = 500,
            Step = 1,
            Type = ParameterType.Integer
        });

        _series.Add(new IndicatorSeries
        {
            Name = "WMA",
            Color = color ?? new SKColor(0x4C, 0xAF, 0x50), // Green
            StrokeWidth = 1.5f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int period = (int)GetParameter("Period");
        var wma = _series[0];
        wma.Values.Clear();

        double denominator = period * (period + 1) / 2.0;

        for (int i = 0; i < bars.Count; i++)
        {
            if (i < period - 1)
            {
                wma.Values.Add(null);
            }
            else
            {
                double sum = 0;
                for (int j = 0; j < period; j++)
                {
                    sum += bars[i - j].Close * (period - j);
                }
                wma.Values.Add(sum / denominator);
            }
        }
    }

    public override IIndicator Clone()
    {
        return new WmaIndicator((int)GetParameter("Period"), _series[0].Color);
    }
}
