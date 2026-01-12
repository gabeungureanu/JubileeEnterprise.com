namespace JubileeFlywheel.Charts;

/// <summary>
/// Represents a single OHLC bar/candle with timestamp
/// </summary>
public readonly struct OhlcBar
{
    public DateTime Timestamp { get; init; }
    public double Open { get; init; }
    public double High { get; init; }
    public double Low { get; init; }
    public double Close { get; init; }
    public double Volume { get; init; }

    public bool IsBullish => Close >= Open;
    public bool IsBearish => Close < Open;
    public double Body => Math.Abs(Close - Open);
    public double UpperWick => High - Math.Max(Open, Close);
    public double LowerWick => Math.Min(Open, Close) - Low;
    public double Range => High - Low;

    public OhlcBar(DateTime timestamp, double open, double high, double low, double close, double volume = 0)
    {
        Timestamp = timestamp;
        Open = open;
        High = high;
        Low = low;
        Close = close;
        Volume = volume;
    }

    /// <summary>
    /// Convert to Heikin Ashi bar
    /// </summary>
    public OhlcBar ToHeikinAshi(OhlcBar? previous)
    {
        double haClose = (Open + High + Low + Close) / 4.0;
        double haOpen = previous.HasValue
            ? (previous.Value.Open + previous.Value.Close) / 2.0
            : (Open + Close) / 2.0;
        double haHigh = Math.Max(High, Math.Max(haOpen, haClose));
        double haLow = Math.Min(Low, Math.Min(haOpen, haClose));

        return new OhlcBar(Timestamp, haOpen, haHigh, haLow, haClose, Volume);
    }
}

/// <summary>
/// Represents a Renko brick
/// </summary>
public readonly struct RenkoBrick
{
    public DateTime Timestamp { get; init; }
    public double Open { get; init; }
    public double Close { get; init; }
    public bool IsBullish => Close > Open;

    public RenkoBrick(DateTime timestamp, double open, double close)
    {
        Timestamp = timestamp;
        Open = open;
        Close = close;
    }
}

/// <summary>
/// Represents a Point & Figure box
/// </summary>
public readonly struct PnfBox
{
    public int Column { get; init; }
    public double Price { get; init; }
    public bool IsX { get; init; } // X = bullish, O = bearish
    public DateTime Timestamp { get; init; }

    public PnfBox(int column, double price, bool isX, DateTime timestamp)
    {
        Column = column;
        Price = price;
        IsX = isX;
        Timestamp = timestamp;
    }
}

/// <summary>
/// Chart data series containing bars and metadata
/// </summary>
public class ChartDataSeries
{
    public string Symbol { get; set; } = string.Empty;
    public ChartInterval Interval { get; set; } = ChartInterval.Day1;
    public List<OhlcBar> Bars { get; } = new();

    public double MinPrice => Bars.Count > 0 ? Bars.Min(b => b.Low) : 0;
    public double MaxPrice => Bars.Count > 0 ? Bars.Max(b => b.High) : 0;
    public DateTime MinTime => Bars.Count > 0 ? Bars.Min(b => b.Timestamp) : DateTime.MinValue;
    public DateTime MaxTime => Bars.Count > 0 ? Bars.Max(b => b.Timestamp) : DateTime.MaxValue;

    /// <summary>
    /// Convert bars to Heikin Ashi
    /// </summary>
    public List<OhlcBar> ToHeikinAshi()
    {
        var result = new List<OhlcBar>(Bars.Count);
        OhlcBar? previous = null;

        foreach (var bar in Bars)
        {
            var haBar = bar.ToHeikinAshi(previous);
            result.Add(haBar);
            previous = haBar;
        }

        return result;
    }

    /// <summary>
    /// Convert bars to Renko bricks
    /// </summary>
    public List<RenkoBrick> ToRenko(double brickSize)
    {
        if (Bars.Count == 0 || brickSize <= 0)
            return new List<RenkoBrick>();

        var bricks = new List<RenkoBrick>();
        double lastBrickClose = Math.Floor(Bars[0].Close / brickSize) * brickSize;
        bool lastWasBullish = true;

        foreach (var bar in Bars)
        {
            double price = bar.Close;

            // Bullish bricks
            while (price >= lastBrickClose + brickSize)
            {
                double newClose = lastBrickClose + brickSize;
                bricks.Add(new RenkoBrick(bar.Timestamp, lastBrickClose, newClose));
                lastBrickClose = newClose;
                lastWasBullish = true;
            }

            // Bearish bricks (need reversal of 2 bricks if coming from bullish)
            double reversalThreshold = lastWasBullish ? lastBrickClose - (2 * brickSize) : lastBrickClose - brickSize;
            while (price <= reversalThreshold)
            {
                double newClose = lastBrickClose - brickSize;
                bricks.Add(new RenkoBrick(bar.Timestamp, lastBrickClose, newClose));
                lastBrickClose = newClose;
                lastWasBullish = false;
                reversalThreshold = lastBrickClose - brickSize;
            }
        }

        return bricks;
    }

    /// <summary>
    /// Convert bars to Point & Figure
    /// </summary>
    public List<PnfBox> ToPointAndFigure(double boxSize, int reversalBoxes = 3)
    {
        if (Bars.Count == 0 || boxSize <= 0)
            return new List<PnfBox>();

        var boxes = new List<PnfBox>();
        int currentColumn = 0;
        bool isXColumn = true;
        double currentPrice = Math.Floor(Bars[0].Close / boxSize) * boxSize;

        foreach (var bar in Bars)
        {
            double high = bar.High;
            double low = bar.Low;

            if (isXColumn)
            {
                // Looking for higher prices (X column)
                while (high >= currentPrice + boxSize)
                {
                    currentPrice += boxSize;
                    boxes.Add(new PnfBox(currentColumn, currentPrice, true, bar.Timestamp));
                }

                // Check for reversal
                if (low <= currentPrice - (reversalBoxes * boxSize))
                {
                    currentColumn++;
                    isXColumn = false;
                    currentPrice -= boxSize;
                    boxes.Add(new PnfBox(currentColumn, currentPrice, false, bar.Timestamp));
                }
            }
            else
            {
                // Looking for lower prices (O column)
                while (low <= currentPrice - boxSize)
                {
                    currentPrice -= boxSize;
                    boxes.Add(new PnfBox(currentColumn, currentPrice, false, bar.Timestamp));
                }

                // Check for reversal
                if (high >= currentPrice + (reversalBoxes * boxSize))
                {
                    currentColumn++;
                    isXColumn = true;
                    currentPrice += boxSize;
                    boxes.Add(new PnfBox(currentColumn, currentPrice, true, bar.Timestamp));
                }
            }
        }

        return boxes;
    }
}
