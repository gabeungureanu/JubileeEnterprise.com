using Inspire.SelfHealing.Configuration;

namespace Inspire.SelfHealing.Services;

public interface IEventLogService
{
    Task LogServiceStartAsync();
    Task LogServiceStopAsync();
    Task LogHealthCheckFailureAsync(string serviceName, string errorMessage);
    Task LogHealthCheckSuccessAsync(string serviceName);
    Task LogRecoveryAttemptAsync(string serviceName, RecoveryActionType actionType);
    Task LogRecoverySuccessAsync(string serviceName, RecoveryActionType actionType);
    Task LogRecoveryFailureAsync(string serviceName, RecoveryActionType actionType, string errorMessage);
}
