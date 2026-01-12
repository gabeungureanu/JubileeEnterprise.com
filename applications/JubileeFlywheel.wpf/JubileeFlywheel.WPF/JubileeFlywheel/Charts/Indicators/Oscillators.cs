using SkiaSharp;

namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Relative Strength Index (RSI)
/// </summary>
public class RsiIndicator : IndicatorBase
{
    public override string Name => "Relative Strength Index";
    public override string ShortName => $"RSI({(int)GetParameter("Period")})";
    public override string Description => "Momentum oscillator measuring speed and magnitude of price changes";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.SubPanel;
    public override (double? Min, double? Max) FixedScale => (0, 100);

    public RsiIndicator(int period = 14)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Period",
            DisplayName = "Period",
            Value = period,
            MinValue = 2,
            MaxValue = 100,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Overbought",
            DisplayName = "Overbought Level",
            Value = 70,
            MinValue = 50,
            MaxValue = 100,
            Step = 5,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Oversold",
            DisplayName = "Oversold Level",
            Value = 30,
            MinValue = 0,
            MaxValue = 50,
            Step = 5,
            Type = ParameterType.Integer
        });

        _series.Add(new IndicatorSeries
        {
            Name = "RSI",
            Color = new SKColor(0x9C, 0x27, 0xB0), // Purple
            StrokeWidth = 1.5f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int period = (int)GetParameter("Period");
        var rsi = _series[0];
        rsi.Values.Clear();

        if (bars.Count < 2)
        {
            for (int i = 0; i < bars.Count; i++)
                rsi.Values.Add(null);
            return;
        }

        List<double> gains = new();
        List<double> losses = new();

        // Calculate gains and losses
        for (int i = 1; i < bars.Count; i++)
        {
            double change = bars[i].Close - bars[i - 1].Close;
            gains.Add(change > 0 ? change : 0);
            losses.Add(change < 0 ? -change : 0);
        }

        // First bar has no RSI
        rsi.Values.Add(null);

        double avgGain = 0;
        double avgLoss = 0;

        for (int i = 0; i < gains.Count; i++)
        {
            if (i < period - 1)
            {
                rsi.Values.Add(null);
            }
            else if (i == period - 1)
            {
                // First RSI uses simple average
                avgGain = gains.Take(period).Average();
                avgLoss = losses.Take(period).Average();

                double rs = avgLoss == 0 ? 100 : avgGain / avgLoss;
                rsi.Values.Add(100 - (100 / (1 + rs)));
            }
            else
            {
                // Subsequent RSI uses smoothed average
                avgGain = (avgGain * (period - 1) + gains[i]) / period;
                avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

                double rs = avgLoss == 0 ? 100 : avgGain / avgLoss;
                rsi.Values.Add(100 - (100 / (1 + rs)));
            }
        }
    }

    public override IIndicator Clone()
    {
        var clone = new RsiIndicator((int)GetParameter("Period"));
        clone.SetParameter("Overbought", GetParameter("Overbought"));
        clone.SetParameter("Oversold", GetParameter("Oversold"));
        return clone;
    }
}

/// <summary>
/// Moving Average Convergence Divergence (MACD)
/// </summary>
public class MacdIndicator : IndicatorBase
{
    public override string Name => "MACD";
    public override string ShortName => $"MACD({(int)GetParameter("Fast")},{(int)GetParameter("Slow")},{(int)GetParameter("Signal")})";
    public override string Description => "Trend-following momentum indicator showing relationship between two EMAs";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.SubPanel;

    public MacdIndicator(int fastPeriod = 12, int slowPeriod = 26, int signalPeriod = 9)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Fast",
            DisplayName = "Fast Period",
            Value = fastPeriod,
            MinValue = 1,
            MaxValue = 100,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Slow",
            DisplayName = "Slow Period",
            Value = slowPeriod,
            MinValue = 1,
            MaxValue = 200,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Signal",
            DisplayName = "Signal Period",
            Value = signalPeriod,
            MinValue = 1,
            MaxValue = 50,
            Step = 1,
            Type = ParameterType.Integer
        });

        _series.Add(new IndicatorSeries
        {
            Name = "MACD",
            Color = new SKColor(0x21, 0x96, 0xF3), // Blue
            StrokeWidth = 1.5f
        });

        _series.Add(new IndicatorSeries
        {
            Name = "Signal",
            Color = new SKColor(0xFF, 0x98, 0x00), // Orange
            StrokeWidth = 1.5f
        });

        _series.Add(new IndicatorSeries
        {
            Name = "Histogram",
            Color = new SKColor(0x4C, 0xAF, 0x50), // Green
            IsHistogram = true,
            StrokeWidth = 0
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int fastPeriod = (int)GetParameter("Fast");
        int slowPeriod = (int)GetParameter("Slow");
        int signalPeriod = (int)GetParameter("Signal");

        var macdLine = _series[0];
        var signalLine = _series[1];
        var histogram = _series[2];

        macdLine.Values.Clear();
        signalLine.Values.Clear();
        histogram.Values.Clear();

        if (bars.Count == 0) return;

        // Calculate fast and slow EMAs
        var fastEma = CalculateEma(bars, fastPeriod);
        var slowEma = CalculateEma(bars, slowPeriod);

        // Calculate MACD line
        List<double?> macdValues = new();
        for (int i = 0; i < bars.Count; i++)
        {
            if (fastEma[i].HasValue && slowEma[i].HasValue)
            {
                macdValues.Add(fastEma[i]!.Value - slowEma[i]!.Value);
            }
            else
            {
                macdValues.Add(null);
            }
            macdLine.Values.Add(macdValues[i]);
        }

        // Calculate signal line (EMA of MACD)
        var signalEma = CalculateEmaFromValues(macdValues, signalPeriod);
        for (int i = 0; i < bars.Count; i++)
        {
            signalLine.Values.Add(signalEma[i]);

            // Calculate histogram
            if (macdValues[i].HasValue && signalEma[i].HasValue)
            {
                histogram.Values.Add(macdValues[i]!.Value - signalEma[i]!.Value);
            }
            else
            {
                histogram.Values.Add(null);
            }
        }
    }

    private List<double?> CalculateEma(IReadOnlyList<OhlcBar> bars, int period)
    {
        var result = new List<double?>();
        double multiplier = 2.0 / (period + 1);
        double? prevEma = null;

        for (int i = 0; i < bars.Count; i++)
        {
            if (i < period - 1)
            {
                result.Add(null);
            }
            else if (i == period - 1)
            {
                double sum = 0;
                for (int j = 0; j < period; j++)
                {
                    sum += bars[i - j].Close;
                }
                prevEma = sum / period;
                result.Add(prevEma);
            }
            else
            {
                double currentEma = (bars[i].Close - prevEma!.Value) * multiplier + prevEma.Value;
                result.Add(currentEma);
                prevEma = currentEma;
            }
        }

        return result;
    }

    private List<double?> CalculateEmaFromValues(List<double?> values, int period)
    {
        var result = new List<double?>();
        double multiplier = 2.0 / (period + 1);
        double? prevEma = null;
        int validCount = 0;

        for (int i = 0; i < values.Count; i++)
        {
            if (!values[i].HasValue)
            {
                result.Add(null);
                continue;
            }

            validCount++;

            if (validCount < period)
            {
                result.Add(null);
            }
            else if (validCount == period)
            {
                // Calculate initial SMA from first valid values
                double sum = 0;
                int count = 0;
                for (int j = i; j >= 0 && count < period; j--)
                {
                    if (values[j].HasValue)
                    {
                        sum += values[j]!.Value;
                        count++;
                    }
                }
                prevEma = sum / period;
                result.Add(prevEma);
            }
            else
            {
                double currentEma = (values[i]!.Value - prevEma!.Value) * multiplier + prevEma.Value;
                result.Add(currentEma);
                prevEma = currentEma;
            }
        }

        return result;
    }

    public override IIndicator Clone()
    {
        return new MacdIndicator(
            (int)GetParameter("Fast"),
            (int)GetParameter("Slow"),
            (int)GetParameter("Signal"));
    }
}

/// <summary>
/// Stochastic Oscillator
/// </summary>
public class StochasticIndicator : IndicatorBase
{
    public override string Name => "Stochastic Oscillator";
    public override string ShortName => $"Stoch({(int)GetParameter("KPeriod")},{(int)GetParameter("DPeriod")})";
    public override string Description => "Momentum indicator comparing closing price to price range over a period";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.SubPanel;
    public override (double? Min, double? Max) FixedScale => (0, 100);

    public StochasticIndicator(int kPeriod = 14, int dPeriod = 3, int smooth = 3)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "KPeriod",
            DisplayName = "%K Period",
            Value = kPeriod,
            MinValue = 1,
            MaxValue = 100,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "DPeriod",
            DisplayName = "%D Period",
            Value = dPeriod,
            MinValue = 1,
            MaxValue = 50,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Smooth",
            DisplayName = "Smoothing",
            Value = smooth,
            MinValue = 1,
            MaxValue = 10,
            Step = 1,
            Type = ParameterType.Integer
        });

        _series.Add(new IndicatorSeries
        {
            Name = "%K",
            Color = new SKColor(0x21, 0x96, 0xF3), // Blue
            StrokeWidth = 1.5f
        });

        _series.Add(new IndicatorSeries
        {
            Name = "%D",
            Color = new SKColor(0xFF, 0x98, 0x00), // Orange
            StrokeWidth = 1.5f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int kPeriod = (int)GetParameter("KPeriod");
        int dPeriod = (int)GetParameter("DPeriod");
        int smooth = (int)GetParameter("Smooth");

        var kLine = _series[0];
        var dLine = _series[1];

        kLine.Values.Clear();
        dLine.Values.Clear();

        if (bars.Count == 0) return;

        // Calculate raw %K values
        List<double?> rawK = new();
        for (int i = 0; i < bars.Count; i++)
        {
            if (i < kPeriod - 1)
            {
                rawK.Add(null);
            }
            else
            {
                double highest = double.MinValue;
                double lowest = double.MaxValue;

                for (int j = 0; j < kPeriod; j++)
                {
                    highest = Math.Max(highest, bars[i - j].High);
                    lowest = Math.Min(lowest, bars[i - j].Low);
                }

                double range = highest - lowest;
                if (range > 0)
                {
                    rawK.Add(100 * (bars[i].Close - lowest) / range);
                }
                else
                {
                    rawK.Add(50); // Neutral if no range
                }
            }
        }

        // Smooth %K
        var smoothedK = SmoothValues(rawK, smooth);
        foreach (var val in smoothedK)
        {
            kLine.Values.Add(val);
        }

        // Calculate %D (SMA of %K)
        var dValues = SmoothValues(smoothedK, dPeriod);
        foreach (var val in dValues)
        {
            dLine.Values.Add(val);
        }
    }

    private List<double?> SmoothValues(List<double?> values, int period)
    {
        var result = new List<double?>();

        for (int i = 0; i < values.Count; i++)
        {
            int validCount = 0;
            double sum = 0;

            for (int j = 0; j < period && i - j >= 0; j++)
            {
                if (values[i - j].HasValue)
                {
                    sum += values[i - j]!.Value;
                    validCount++;
                }
            }

            if (validCount == period)
            {
                result.Add(sum / period);
            }
            else
            {
                result.Add(null);
            }
        }

        return result;
    }

    public override IIndicator Clone()
    {
        return new StochasticIndicator(
            (int)GetParameter("KPeriod"),
            (int)GetParameter("DPeriod"),
            (int)GetParameter("Smooth"));
    }
}
