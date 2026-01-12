namespace JubileeFlywheel.Models
{
    public class ChartDataPoint
    {
        public string Label { get; set; } = string.Empty;
        public double Value { get; set; }
        public DateTime? Timestamp { get; set; }
        public string? Category { get; set; }
        public Dictionary<string, object>? Metadata { get; set; }
    }

    public class TimeSeriesDataPoint
    {
        public DateTime Timestamp { get; set; }
        public double Value { get; set; }
        public string? Series { get; set; }
    }

    public class KpiData
    {
        public string Title { get; set; } = string.Empty;
        public double CurrentValue { get; set; }
        public double? PreviousValue { get; set; }
        public string? Unit { get; set; }
        public double? TargetValue { get; set; }
        public string? Trend { get; set; }
        public double? ChangePercent => PreviousValue.HasValue && PreviousValue != 0
            ? ((CurrentValue - PreviousValue.Value) / PreviousValue.Value) * 100
            : null;
    }

    public class GaugeData
    {
        public double Value { get; set; }
        public double MinValue { get; set; } = 0;
        public double MaxValue { get; set; } = 100;
        public string? Unit { get; set; }
        public List<GaugeRange> Ranges { get; set; } = new();
    }

    public class GaugeRange
    {
        public double Start { get; set; }
        public double End { get; set; }
        public string Color { get; set; } = "#4CAF50";
        public string? Label { get; set; }
    }
}
