namespace JubileeFlywheel.Charts;

/// <summary>
/// Supported chart visualization types
/// </summary>
public enum ChartType
{
    Candlestick,
    OHLC,
    Line,
    Area,
    HeikinAshi,
    Renko,
    Range,
    PointAndFigure
}

/// <summary>
/// Chart time intervals
/// </summary>
public enum ChartInterval
{
    Tick,
    Second1,
    Second5,
    Second15,
    Second30,
    Minute1,
    Minute5,
    Minute15,
    Minute30,
    Hour1,
    Hour4,
    Day1,
    Week1,
    Month1
}

/// <summary>
/// Price scale position
/// </summary>
public enum PriceScalePosition
{
    Right,
    Left,
    Both,
    None
}

/// <summary>
/// Time scale position
/// </summary>
public enum TimeScalePosition
{
    Bottom,
    Top,
    Both,
    None
}
