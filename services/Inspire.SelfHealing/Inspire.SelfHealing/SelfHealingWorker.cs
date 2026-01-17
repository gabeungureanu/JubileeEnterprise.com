using Inspire.SelfHealing.Configuration;
using Inspire.SelfHealing.Services;
using Microsoft.Extensions.Options;

namespace Inspire.SelfHealing;

public class SelfHealingWorker : BackgroundService
{
    private readonly ILogger<SelfHealingWorker> _logger;
    private readonly IHealthCheckService _healthCheckService;
    private readonly IRecoveryService _recoveryService;
    private readonly IEventLogService _eventLogService;
    private readonly IOptionsMonitor<MonitoredServicesConfig> _configMonitor;
    private readonly Dictionary<string, int> _failureCount = new();

    public SelfHealingWorker(
        ILogger<SelfHealingWorker> logger,
        IHealthCheckService healthCheckService,
        IRecoveryService recoveryService,
        IEventLogService eventLogService,
        IOptionsMonitor<MonitoredServicesConfig> configMonitor)
    {
        _logger = logger;
        _healthCheckService = healthCheckService;
        _recoveryService = recoveryService;
        _eventLogService = eventLogService;
        _configMonitor = configMonitor;
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Inspire 8.0: Self-Healing service starting...");
        await _eventLogService.LogServiceStartAsync();
        await base.StartAsync(cancellationToken);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Inspire 8.0: Self-Healing service stopping...");
        await _eventLogService.LogServiceStopAsync();
        await base.StopAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Self-Healing monitoring loop started");

        while (!stoppingToken.IsCancellationRequested)
        {
            var config = _configMonitor.CurrentValue;

            _logger.LogInformation("Starting health check cycle for {Count} services",
                config.Services.Count(s => s.Enabled));

            foreach (var service in config.Services.Where(s => s.Enabled))
            {
                try
                {
                    await ProcessServiceHealthAsync(service, config, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing health check for {ServiceName}", service.Name);
                }
            }

            var interval = TimeSpan.FromSeconds(config.MonitoringIntervalSeconds);
            _logger.LogDebug("Waiting {Interval} seconds before next health check cycle", config.MonitoringIntervalSeconds);
            await Task.Delay(interval, stoppingToken);
        }
    }

    private async Task ProcessServiceHealthAsync(
        MonitoredService service,
        MonitoredServicesConfig config,
        CancellationToken cancellationToken)
    {
        var healthResult = await _healthCheckService.CheckHealthAsync(service, cancellationToken);

        if (healthResult.IsHealthy)
        {
            // Reset failure count on success
            _failureCount[service.Name] = 0;
            await _eventLogService.LogHealthCheckSuccessAsync(service.Name);
            _logger.LogDebug("{ServiceName} is healthy (response time: {ResponseTime}ms)",
                service.Name, healthResult.ResponseTime.TotalMilliseconds);
        }
        else
        {
            // Increment failure count
            if (!_failureCount.ContainsKey(service.Name))
            {
                _failureCount[service.Name] = 0;
            }
            _failureCount[service.Name]++;

            _logger.LogWarning("{ServiceName} health check FAILED ({FailureCount}/{MaxRetries}): {ErrorMessage}",
                service.Name, _failureCount[service.Name], config.MaxRetryAttempts, healthResult.ErrorMessage);

            await _eventLogService.LogHealthCheckFailureAsync(service.Name, healthResult.ErrorMessage ?? "Unknown error");

            // Execute recovery if failure count exceeds threshold
            if (_failureCount[service.Name] >= config.MaxRetryAttempts)
            {
                _logger.LogWarning("Initiating recovery for {ServiceName} after {FailureCount} consecutive failures",
                    service.Name, _failureCount[service.Name]);

                await _eventLogService.LogRecoveryAttemptAsync(service.Name, service.RecoveryAction.Type);
                var recoveryResult = await _recoveryService.ExecuteRecoveryAsync(service, cancellationToken);

                if (recoveryResult.Success)
                {
                    _logger.LogInformation("Recovery SUCCESSFUL for {ServiceName}: {Message}",
                        service.Name, recoveryResult.Message);
                    _failureCount[service.Name] = 0;

                    // Wait a bit for the service to fully start before next check
                    await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
                }
                else
                {
                    _logger.LogError("Recovery FAILED for {ServiceName}: {ErrorMessage}",
                        service.Name, recoveryResult.ErrorMessage);
                }
            }
        }
    }
}
