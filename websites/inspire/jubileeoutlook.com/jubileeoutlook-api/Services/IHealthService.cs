namespace JubileeOutlook.Api.Services;

public interface IHealthService
{
    Task<HealthStatus> GetHealthStatusAsync();
}

public class HealthStatus
{
    public string Status { get; set; } = "Healthy";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Version { get; set; } = "1.0.0";
}
