using SkiaSharp;

namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Volume level data for volume profile
/// </summary>
public class VolumeLevelData
{
    public double PriceLow { get; set; }
    public double PriceHigh { get; set; }
    public double Volume { get; set; }
    public double BuyVolume { get; set; }
    public double SellVolume { get; set; }
    public bool IsPointOfControl { get; set; }
    public bool IsValueArea { get; set; }
}

/// <summary>
/// Volume Profile - shows volume distribution at different price levels
/// </summary>
public class VolumeProfileIndicator : IndicatorBase
{
    public override string Name => "Volume Profile";
    public override string ShortName => "VP";
    public override string Description => "Volume distribution across price levels";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.Overlay;

    /// <summary>Volume levels calculated from the data</summary>
    public List<VolumeLevelData> VolumeLevels { get; } = new();

    /// <summary>Point of Control - price level with highest volume</summary>
    public double? PointOfControl { get; private set; }

    /// <summary>Value Area High - upper bound of value area</summary>
    public double? ValueAreaHigh { get; private set; }

    /// <summary>Value Area Low - lower bound of value area</summary>
    public double? ValueAreaLow { get; private set; }

    public VolumeProfileIndicator(int rowCount = 24, double valueAreaPercent = 70)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "RowCount",
            DisplayName = "Number of Rows",
            Value = rowCount,
            MinValue = 10,
            MaxValue = 100,
            Step = 1,
            Type = ParameterType.Integer
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "ValueArea",
            DisplayName = "Value Area %",
            Value = valueAreaPercent,
            MinValue = 50,
            MaxValue = 90,
            Step = 5,
            Type = ParameterType.Double
        });

        _parameters.Add(new IndicatorParameter
        {
            Name = "Width",
            DisplayName = "Profile Width %",
            Value = 20,
            MinValue = 5,
            MaxValue = 50,
            Step = 5,
            Type = ParameterType.Double
        });

        // POC line
        _series.Add(new IndicatorSeries
        {
            Name = "POC",
            Color = new SKColor(0xFF, 0xEB, 0x3B), // Yellow
            StrokeWidth = 2f
        });

        // Value Area High
        _series.Add(new IndicatorSeries
        {
            Name = "VAH",
            Color = new SKColor(0x4C, 0xAF, 0x50, 0x80), // Green
            StrokeWidth = 1f
        });

        // Value Area Low
        _series.Add(new IndicatorSeries
        {
            Name = "VAL",
            Color = new SKColor(0xF4, 0x43, 0x36, 0x80), // Red
            StrokeWidth = 1f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int rowCount = (int)GetParameter("RowCount");
        double valueAreaPercent = GetParameter("ValueArea") / 100.0;

        var poc = _series[0];
        var vah = _series[1];
        var val = _series[2];

        poc.Values.Clear();
        vah.Values.Clear();
        val.Values.Clear();
        VolumeLevels.Clear();

        if (bars.Count == 0) return;

        // Find price range
        double minPrice = bars.Min(b => b.Low);
        double maxPrice = bars.Max(b => b.High);
        double priceRange = maxPrice - minPrice;

        if (priceRange <= 0) return;

        double rowHeight = priceRange / rowCount;

        // Initialize volume levels
        for (int i = 0; i < rowCount; i++)
        {
            VolumeLevels.Add(new VolumeLevelData
            {
                PriceLow = minPrice + i * rowHeight,
                PriceHigh = minPrice + (i + 1) * rowHeight,
                Volume = 0,
                BuyVolume = 0,
                SellVolume = 0
            });
        }

        // Distribute volume to price levels
        foreach (var bar in bars)
        {
            // Simple distribution: divide volume equally across price range of bar
            int startRow = Math.Max(0, (int)((bar.Low - minPrice) / rowHeight));
            int endRow = Math.Min(rowCount - 1, (int)((bar.High - minPrice) / rowHeight));

            double volumePerRow = bar.Volume / Math.Max(1, endRow - startRow + 1);
            bool isBullish = bar.Close >= bar.Open;

            for (int row = startRow; row <= endRow; row++)
            {
                VolumeLevels[row].Volume += volumePerRow;
                if (isBullish)
                    VolumeLevels[row].BuyVolume += volumePerRow;
                else
                    VolumeLevels[row].SellVolume += volumePerRow;
            }
        }

        // Find Point of Control (highest volume level)
        double maxVolume = VolumeLevels.Max(l => l.Volume);
        var pocLevel = VolumeLevels.FirstOrDefault(l => l.Volume == maxVolume);
        if (pocLevel != null)
        {
            pocLevel.IsPointOfControl = true;
            PointOfControl = (pocLevel.PriceLow + pocLevel.PriceHigh) / 2;
        }

        // Calculate Value Area (levels containing X% of total volume)
        double totalVolume = VolumeLevels.Sum(l => l.Volume);
        double targetVolume = totalVolume * valueAreaPercent;

        // Start from POC and expand outward
        int pocIndex = VolumeLevels.IndexOf(pocLevel!);
        double accumulatedVolume = pocLevel!.Volume;
        pocLevel.IsValueArea = true;

        int upperIndex = pocIndex + 1;
        int lowerIndex = pocIndex - 1;

        while (accumulatedVolume < targetVolume && (upperIndex < rowCount || lowerIndex >= 0))
        {
            double upperVolume = upperIndex < rowCount ? VolumeLevels[upperIndex].Volume : 0;
            double lowerVolume = lowerIndex >= 0 ? VolumeLevels[lowerIndex].Volume : 0;

            if (upperVolume >= lowerVolume && upperIndex < rowCount)
            {
                VolumeLevels[upperIndex].IsValueArea = true;
                accumulatedVolume += upperVolume;
                upperIndex++;
            }
            else if (lowerIndex >= 0)
            {
                VolumeLevels[lowerIndex].IsValueArea = true;
                accumulatedVolume += lowerVolume;
                lowerIndex--;
            }
        }

        // Set Value Area High and Low
        var valueAreaLevels = VolumeLevels.Where(l => l.IsValueArea).ToList();
        if (valueAreaLevels.Count > 0)
        {
            ValueAreaHigh = valueAreaLevels.Max(l => l.PriceHigh);
            ValueAreaLow = valueAreaLevels.Min(l => l.PriceLow);
        }

        // Fill series with horizontal lines for the full chart
        for (int i = 0; i < bars.Count; i++)
        {
            poc.Values.Add(PointOfControl);
            vah.Values.Add(ValueAreaHigh);
            val.Values.Add(ValueAreaLow);
        }
    }

    public override IIndicator Clone()
    {
        return new VolumeProfileIndicator(
            (int)GetParameter("RowCount"),
            GetParameter("ValueArea"));
    }
}

/// <summary>
/// Average True Range (ATR) - measures volatility
/// </summary>
public class AtrIndicator : IndicatorBase
{
    public override string Name => "Average True Range";
    public override string ShortName => $"ATR({(int)GetParameter("Period")})";
    public override string Description => "Volatility indicator measuring average price range";
    public override IndicatorRenderMode RenderMode => IndicatorRenderMode.SubPanel;

    public AtrIndicator(int period = 14)
    {
        _parameters.Add(new IndicatorParameter
        {
            Name = "Period",
            DisplayName = "Period",
            Value = period,
            MinValue = 1,
            MaxValue = 100,
            Step = 1,
            Type = ParameterType.Integer
        });

        _series.Add(new IndicatorSeries
        {
            Name = "ATR",
            Color = new SKColor(0x9C, 0x27, 0xB0), // Purple
            StrokeWidth = 1.5f
        });
    }

    public override void Calculate(IReadOnlyList<OhlcBar> bars)
    {
        int period = (int)GetParameter("Period");
        var atr = _series[0];
        atr.Values.Clear();

        if (bars.Count == 0) return;

        List<double> trueRanges = new();

        for (int i = 0; i < bars.Count; i++)
        {
            double tr;
            if (i == 0)
            {
                tr = bars[i].High - bars[i].Low;
            }
            else
            {
                tr = Math.Max(
                    bars[i].High - bars[i].Low,
                    Math.Max(
                        Math.Abs(bars[i].High - bars[i - 1].Close),
                        Math.Abs(bars[i].Low - bars[i - 1].Close)));
            }
            trueRanges.Add(tr);

            if (i < period - 1)
            {
                atr.Values.Add(null);
            }
            else if (i == period - 1)
            {
                // First ATR is simple average
                atr.Values.Add(trueRanges.Take(period).Average());
            }
            else
            {
                // Subsequent ATR uses smoothed average
                double prevAtr = atr.Values[i - 1]!.Value;
                atr.Values.Add((prevAtr * (period - 1) + tr) / period);
            }
        }
    }

    public override IIndicator Clone()
    {
        return new AtrIndicator((int)GetParameter("Period"));
    }
}
