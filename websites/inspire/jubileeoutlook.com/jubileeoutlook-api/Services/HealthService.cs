namespace JubileeOutlook.Api.Services;

public class HealthService : IHealthService
{
    public Task<HealthStatus> GetHealthStatusAsync()
    {
        var status = new HealthStatus
        {
            Status = "Healthy",
            Timestamp = DateTime.UtcNow,
            Version = "1.0.0"
        };

        return Task.FromResult(status);
    }
}
