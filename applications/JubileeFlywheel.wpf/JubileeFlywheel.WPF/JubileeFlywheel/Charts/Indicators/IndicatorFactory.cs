namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Factory for creating indicator instances
/// </summary>
public static class IndicatorFactory
{
    /// <summary>
    /// Available indicator types
    /// </summary>
    public static readonly List<IndicatorInfo> AvailableIndicators = new()
    {
        // Moving Averages
        new IndicatorInfo
        {
            Name = "Simple Moving Average",
            ShortName = "SMA",
            Category = "Moving Averages",
            Description = "Average price over a specified period",
            CreateInstance = () => new SmaIndicator()
        },
        new IndicatorInfo
        {
            Name = "Exponential Moving Average",
            ShortName = "EMA",
            Category = "Moving Averages",
            Description = "Weighted moving average giving more weight to recent prices",
            CreateInstance = () => new EmaIndicator()
        },
        new IndicatorInfo
        {
            Name = "Weighted Moving Average",
            ShortName = "WMA",
            Category = "Moving Averages",
            Description = "Moving average with linearly decreasing weights",
            CreateInstance = () => new WmaIndicator()
        },
        new IndicatorInfo
        {
            Name = "Volume Weighted Average Price",
            ShortName = "VWAP",
            Category = "Moving Averages",
            Description = "Average price weighted by volume",
            CreateInstance = () => new VwapIndicator()
        },

        // Volatility
        new IndicatorInfo
        {
            Name = "Bollinger Bands",
            ShortName = "BB",
            Category = "Volatility",
            Description = "Volatility bands using standard deviation",
            CreateInstance = () => new BollingerBandsIndicator()
        },
        new IndicatorInfo
        {
            Name = "Keltner Channel",
            ShortName = "KC",
            Category = "Volatility",
            Description = "Volatility bands using Average True Range",
            CreateInstance = () => new KeltnerChannelIndicator()
        },
        new IndicatorInfo
        {
            Name = "Average True Range",
            ShortName = "ATR",
            Category = "Volatility",
            Description = "Measures market volatility",
            CreateInstance = () => new AtrIndicator()
        },

        // Momentum/Oscillators
        new IndicatorInfo
        {
            Name = "Relative Strength Index",
            ShortName = "RSI",
            Category = "Momentum",
            Description = "Momentum oscillator measuring overbought/oversold conditions",
            CreateInstance = () => new RsiIndicator()
        },
        new IndicatorInfo
        {
            Name = "MACD",
            ShortName = "MACD",
            Category = "Momentum",
            Description = "Trend-following momentum indicator",
            CreateInstance = () => new MacdIndicator()
        },
        new IndicatorInfo
        {
            Name = "Stochastic Oscillator",
            ShortName = "Stoch",
            Category = "Momentum",
            Description = "Momentum indicator comparing close to price range",
            CreateInstance = () => new StochasticIndicator()
        },

        // Trend
        new IndicatorInfo
        {
            Name = "Ichimoku Cloud",
            ShortName = "Ichimoku",
            Category = "Trend",
            Description = "Japanese charting technique showing support, resistance, and trend",
            CreateInstance = () => new IchimokuIndicator()
        },

        // Volume
        new IndicatorInfo
        {
            Name = "Volume Profile",
            ShortName = "VP",
            Category = "Volume",
            Description = "Volume distribution across price levels",
            CreateInstance = () => new VolumeProfileIndicator()
        }
    };

    /// <summary>
    /// Get indicators by category
    /// </summary>
    public static Dictionary<string, List<IndicatorInfo>> GetIndicatorsByCategory()
    {
        return AvailableIndicators
            .GroupBy(i => i.Category)
            .ToDictionary(g => g.Key, g => g.ToList());
    }

    /// <summary>
    /// Create an indicator by short name
    /// </summary>
    public static IIndicator? CreateIndicator(string shortName)
    {
        var info = AvailableIndicators.FirstOrDefault(i =>
            i.ShortName.Equals(shortName, StringComparison.OrdinalIgnoreCase));
        return info?.CreateInstance();
    }
}

/// <summary>
/// Information about an available indicator type
/// </summary>
public class IndicatorInfo
{
    public string Name { get; set; } = "";
    public string ShortName { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public Func<IIndicator> CreateInstance { get; set; } = () => throw new NotImplementedException();
}
