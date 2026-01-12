namespace JubileeFlywheel.Models
{
    public class AppSettings
    {
        public string Theme { get; set; } = "Dark";
        public int DefaultRefreshInterval { get; set; } = 30;
        public bool AutoRefreshEnabled { get; set; } = true;
        public List<ApiEndpoint> ApiEndpoints { get; set; } = new();
        public List<Dashboard> Dashboards { get; set; } = new();
        public string? ActiveDashboardId { get; set; }
        public WindowSettings WindowSettings { get; set; } = new();
    }

    public class WindowSettings
    {
        public double Width { get; set; } = 1400;
        public double Height { get; set; } = 900;
        public double Left { get; set; } = 100;
        public double Top { get; set; } = 100;
        public bool IsMaximized { get; set; } = false;
    }
}
