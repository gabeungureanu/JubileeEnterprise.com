namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Defines how an indicator should be rendered
/// </summary>
public enum IndicatorRenderMode
{
    /// <summary>Render on the main price chart (e.g., moving averages, Bollinger Bands)</summary>
    Overlay,

    /// <summary>Render in a separate sub-panel below the chart (e.g., RSI, MACD)</summary>
    SubPanel
}

/// <summary>
/// Represents a single series of indicator values
/// </summary>
public class IndicatorSeries
{
    public string Name { get; set; } = "";
    public SkiaSharp.SKColor Color { get; set; }
    public float StrokeWidth { get; set; } = 1.5f;
    public List<double?> Values { get; } = new();
    public bool IsFilled { get; set; } = false;
    public SkiaSharp.SKColor? FillColor { get; set; }

    /// <summary>For histogram-style rendering (e.g., MACD histogram)</summary>
    public bool IsHistogram { get; set; } = false;
}

/// <summary>
/// Parameter definition for an indicator
/// </summary>
public class IndicatorParameter
{
    public string Name { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public double Value { get; set; }
    public double MinValue { get; set; }
    public double MaxValue { get; set; }
    public double Step { get; set; } = 1;
    public ParameterType Type { get; set; } = ParameterType.Integer;
}

public enum ParameterType
{
    Integer,
    Double,
    Boolean
}

/// <summary>
/// Base interface for all technical indicators
/// </summary>
public interface IIndicator
{
    /// <summary>Unique identifier for this indicator instance</summary>
    string Id { get; }

    /// <summary>Display name of the indicator</summary>
    string Name { get; }

    /// <summary>Short name for display in legends</summary>
    string ShortName { get; }

    /// <summary>Description of the indicator</summary>
    string Description { get; }

    /// <summary>Whether this indicator renders on the price chart or in a sub-panel</summary>
    IndicatorRenderMode RenderMode { get; }

    /// <summary>Output series produced by this indicator</summary>
    IReadOnlyList<IndicatorSeries> Series { get; }

    /// <summary>Configurable parameters</summary>
    IReadOnlyList<IndicatorParameter> Parameters { get; }

    /// <summary>Minimum and maximum values for sub-panel scaling (null for auto-scale)</summary>
    (double? Min, double? Max) FixedScale { get; }

    /// <summary>
    /// Calculate indicator values for the given price data
    /// </summary>
    void Calculate(IReadOnlyList<OhlcBar> bars);

    /// <summary>
    /// Incrementally update the last N bars (for efficiency)
    /// </summary>
    void UpdateLast(IReadOnlyList<OhlcBar> bars, int count);

    /// <summary>
    /// Set a parameter value
    /// </summary>
    void SetParameter(string name, double value);

    /// <summary>
    /// Get a parameter value
    /// </summary>
    double GetParameter(string name);

    /// <summary>
    /// Create a copy of this indicator with the same parameters
    /// </summary>
    IIndicator Clone();
}

/// <summary>
/// Base class for indicators with common functionality
/// </summary>
public abstract class IndicatorBase : IIndicator
{
    public string Id { get; } = Guid.NewGuid().ToString();
    public abstract string Name { get; }
    public abstract string ShortName { get; }
    public virtual string Description => "";
    public abstract IndicatorRenderMode RenderMode { get; }

    protected List<IndicatorSeries> _series = new();
    public IReadOnlyList<IndicatorSeries> Series => _series;

    protected List<IndicatorParameter> _parameters = new();
    public IReadOnlyList<IndicatorParameter> Parameters => _parameters;

    public virtual (double? Min, double? Max) FixedScale => (null, null);

    public abstract void Calculate(IReadOnlyList<OhlcBar> bars);

    public virtual void UpdateLast(IReadOnlyList<OhlcBar> bars, int count)
    {
        // Default: recalculate everything
        Calculate(bars);
    }

    public void SetParameter(string name, double value)
    {
        var param = _parameters.FirstOrDefault(p => p.Name == name);
        if (param != null)
        {
            param.Value = Math.Clamp(value, param.MinValue, param.MaxValue);
        }
    }

    public double GetParameter(string name)
    {
        var param = _parameters.FirstOrDefault(p => p.Name == name);
        return param?.Value ?? 0;
    }

    public abstract IIndicator Clone();

    /// <summary>
    /// Ensure series have correct number of values
    /// </summary>
    protected void EnsureSeriesSize(int count)
    {
        foreach (var series in _series)
        {
            while (series.Values.Count < count)
                series.Values.Add(null);
            while (series.Values.Count > count)
                series.Values.RemoveAt(series.Values.Count - 1);
        }
    }
}
