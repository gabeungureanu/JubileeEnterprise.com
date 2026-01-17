using Inspire.SelfHealing.Configuration;

namespace Inspire.SelfHealing.Services;

public interface IHealthCheckService
{
    Task<HealthCheckResult> CheckHealthAsync(MonitoredService service, CancellationToken cancellationToken);
}

public class HealthCheckResult
{
    public bool IsHealthy { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public int? StatusCode { get; set; }
    public string? ErrorMessage { get; set; }
    public TimeSpan ResponseTime { get; set; }
}
