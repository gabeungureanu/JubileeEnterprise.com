using System.Diagnostics;
using Inspire.SelfHealing.Configuration;

namespace Inspire.SelfHealing.Services;

public class EventLogService : IEventLogService
{
    private const string SourceName = "Inspire.SelfHealing";
    private const string LogName = "Application";
    private readonly ILogger<EventLogService> _logger;

    public EventLogService(ILogger<EventLogService> logger)
    {
        _logger = logger;
        EnsureEventSourceExists();
    }

    private void EnsureEventSourceExists()
    {
        try
        {
            if (!EventLog.SourceExists(SourceName))
            {
                EventLog.CreateEventSource(SourceName, LogName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not create event source. Run as administrator once to create it.");
        }
    }

    public Task LogServiceStartAsync()
    {
        WriteEventLog("Inspire 8.0: Self-Healing service started.", EventLogEntryType.Information, 1000);
        return Task.CompletedTask;
    }

    public Task LogServiceStopAsync()
    {
        WriteEventLog("Inspire 8.0: Self-Healing service stopped.", EventLogEntryType.Information, 1001);
        return Task.CompletedTask;
    }

    public Task LogHealthCheckFailureAsync(string serviceName, string errorMessage)
    {
        WriteEventLog(
            $"Health check FAILED for {serviceName}: {errorMessage}",
            EventLogEntryType.Warning,
            2000);
        return Task.CompletedTask;
    }

    public Task LogHealthCheckSuccessAsync(string serviceName)
    {
        _logger.LogDebug("Health check passed for {ServiceName}", serviceName);
        return Task.CompletedTask;
    }

    public Task LogRecoveryAttemptAsync(string serviceName, RecoveryActionType actionType)
    {
        WriteEventLog(
            $"Attempting recovery for {serviceName} using action: {actionType}",
            EventLogEntryType.Information,
            3000);
        return Task.CompletedTask;
    }

    public Task LogRecoverySuccessAsync(string serviceName, RecoveryActionType actionType)
    {
        WriteEventLog(
            $"Recovery SUCCESSFUL for {serviceName} using action: {actionType}",
            EventLogEntryType.Information,
            3001);
        return Task.CompletedTask;
    }

    public Task LogRecoveryFailureAsync(string serviceName, RecoveryActionType actionType, string errorMessage)
    {
        WriteEventLog(
            $"Recovery FAILED for {serviceName} using action {actionType}: {errorMessage}",
            EventLogEntryType.Error,
            3002);
        return Task.CompletedTask;
    }

    private void WriteEventLog(string message, EventLogEntryType entryType, int eventId)
    {
        try
        {
            EventLog.WriteEntry(SourceName, message, entryType, eventId);
            _logger.LogInformation("[EventLog] {Message}", message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write to Windows Event Log: {Message}", message);
        }
    }
}
