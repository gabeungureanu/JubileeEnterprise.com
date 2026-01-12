namespace JubileeFlywheel.Models
{
    public enum WidgetType
    {
        LineChart,
        BarChart,
        PieChart,
        Gauge,
        KpiCard,
        DataGrid,
        AreaChart,
        DonutChart
    }

    public class DashboardWidget
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Title { get; set; } = string.Empty;
        public WidgetType Type { get; set; }
        public string? ApiEndpointId { get; set; }
        public string? DataPath { get; set; }
        public int Row { get; set; }
        public int Column { get; set; }
        public int RowSpan { get; set; } = 1;
        public int ColumnSpan { get; set; } = 1;
        public WidgetSettings Settings { get; set; } = new();
    }

    public class WidgetSettings
    {
        public string? LabelField { get; set; }
        public string? ValueField { get; set; }
        public double? MinValue { get; set; }
        public double? MaxValue { get; set; }
        public string? Unit { get; set; }
        public string? ColorScheme { get; set; }
        public bool ShowLegend { get; set; } = true;
        public bool ShowDataLabels { get; set; } = false;
        public int? DecimalPlaces { get; set; } = 2;
    }

    public class Dashboard
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = "New Dashboard";
        public List<DashboardWidget> Widgets { get; set; } = new();
        public int Columns { get; set; } = 4;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
