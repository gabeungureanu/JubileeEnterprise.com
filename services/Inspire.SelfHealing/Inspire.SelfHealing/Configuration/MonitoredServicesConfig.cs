namespace Inspire.SelfHealing.Configuration;

public class MonitoredServicesConfig
{
    public int MonitoringIntervalSeconds { get; set; } = 60;
    public int HealthCheckTimeoutSeconds { get; set; } = 30;
    public int MaxRetryAttempts { get; set; } = 3;
    public List<MonitoredService> Services { get; set; } = new();
}

public class MonitoredService
{
    public string Name { get; set; } = string.Empty;
    public ServiceType Type { get; set; }
    public string? HealthEndpoint { get; set; }
    public int? Port { get; set; }
    public RecoveryAction RecoveryAction { get; set; } = new();
    public bool Enabled { get; set; } = true;
}

public enum ServiceType
{
    Website,
    WindowsService,
    DockerContainer,
    CloudflareTunnel,
    IISAppPool
}

public class RecoveryAction
{
    public RecoveryActionType Type { get; set; }
    public string? ServiceName { get; set; }
    public string? AppPoolName { get; set; }
    public string? ProcessPath { get; set; }
    public string? WorkingDirectory { get; set; }
    public string? Arguments { get; set; }
    public string? ContainerName { get; set; }
    public string? TunnelName { get; set; }
}

public enum RecoveryActionType
{
    RestartWindowsService,
    RecycleIISAppPool,
    StartProcess,
    RestartDockerContainer,
    RestartCloudflareTunnel
}
