using Inspire.SelfHealing.Configuration;

namespace Inspire.SelfHealing.Services;

public interface IRecoveryService
{
    Task<RecoveryResult> ExecuteRecoveryAsync(MonitoredService service, CancellationToken cancellationToken);
}

public class RecoveryResult
{
    public bool Success { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public RecoveryActionType ActionType { get; set; }
    public string? Message { get; set; }
    public string? ErrorMessage { get; set; }
}
