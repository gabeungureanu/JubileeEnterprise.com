using System.Diagnostics;
using Inspire.SelfHealing.Configuration;

namespace Inspire.SelfHealing.Services;

public class HealthCheckService : IHealthCheckService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<HealthCheckService> _logger;

    public HealthCheckService(IHttpClientFactory httpClientFactory, ILogger<HealthCheckService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new HealthCheckResult
        {
            ServiceName = service.Name
        };

        var stopwatch = Stopwatch.StartNew();

        try
        {
            switch (service.Type)
            {
                case ServiceType.Website:
                case ServiceType.IISAppPool:
                    return await CheckHttpHealthAsync(service, cancellationToken);

                case ServiceType.WindowsService:
                    return CheckWindowsServiceHealth(service);

                case ServiceType.DockerContainer:
                    return await CheckDockerContainerHealthAsync(service, cancellationToken);

                case ServiceType.CloudflareTunnel:
                    return await CheckCloudflareTunnelHealthAsync(service, cancellationToken);

                default:
                    result.IsHealthy = false;
                    result.ErrorMessage = $"Unknown service type: {service.Type}";
                    break;
            }
        }
        catch (Exception ex)
        {
            result.IsHealthy = false;
            result.ErrorMessage = ex.Message;
            _logger.LogError(ex, "Health check failed for {ServiceName}", service.Name);
        }
        finally
        {
            stopwatch.Stop();
            result.ResponseTime = stopwatch.Elapsed;
        }

        return result;
    }

    private async Task<HealthCheckResult> CheckHttpHealthAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new HealthCheckResult
        {
            ServiceName = service.Name
        };

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);

            var response = await client.GetAsync(service.HealthEndpoint, cancellationToken);

            stopwatch.Stop();
            result.ResponseTime = stopwatch.Elapsed;
            result.StatusCode = (int)response.StatusCode;
            result.IsHealthy = response.IsSuccessStatusCode;

            if (!result.IsHealthy)
            {
                result.ErrorMessage = $"HTTP {result.StatusCode}: {response.ReasonPhrase}";
            }
        }
        catch (TaskCanceledException)
        {
            stopwatch.Stop();
            result.ResponseTime = stopwatch.Elapsed;
            result.IsHealthy = false;
            result.ErrorMessage = "Request timed out";
        }
        catch (HttpRequestException ex)
        {
            stopwatch.Stop();
            result.ResponseTime = stopwatch.Elapsed;
            result.IsHealthy = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    private HealthCheckResult CheckWindowsServiceHealth(MonitoredService service)
    {
        var result = new HealthCheckResult
        {
            ServiceName = service.Name
        };

        var stopwatch = Stopwatch.StartNew();

        try
        {
            using var sc = new System.ServiceProcess.ServiceController(service.RecoveryAction.ServiceName);
            result.IsHealthy = sc.Status == System.ServiceProcess.ServiceControllerStatus.Running;

            if (!result.IsHealthy)
            {
                result.ErrorMessage = $"Service status: {sc.Status}";
            }
        }
        catch (Exception ex)
        {
            result.IsHealthy = false;
            result.ErrorMessage = ex.Message;
        }
        finally
        {
            stopwatch.Stop();
            result.ResponseTime = stopwatch.Elapsed;
        }

        return result;
    }

    private async Task<HealthCheckResult> CheckDockerContainerHealthAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new HealthCheckResult
        {
            ServiceName = service.Name
        };

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var containerName = service.RecoveryAction.ContainerName;
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"inspect --format=\"{{{{.State.Running}}}}\" {containerName}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            result.IsHealthy = output.Trim().Equals("true", StringComparison.OrdinalIgnoreCase);

            if (!result.IsHealthy)
            {
                result.ErrorMessage = $"Container not running. Output: {output.Trim()}";
            }
        }
        catch (Exception ex)
        {
            result.IsHealthy = false;
            result.ErrorMessage = ex.Message;
        }
        finally
        {
            stopwatch.Stop();
            result.ResponseTime = stopwatch.Elapsed;
        }

        return result;
    }

    private async Task<HealthCheckResult> CheckCloudflareTunnelHealthAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new HealthCheckResult
        {
            ServiceName = service.Name
        };

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var tunnelName = service.RecoveryAction.TunnelName;
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "cloudflared",
                    Arguments = $"tunnel info {tunnelName}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
            var error = await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            // Check if tunnel has active connections
            result.IsHealthy = process.ExitCode == 0 && !string.IsNullOrEmpty(output);

            if (!result.IsHealthy)
            {
                result.ErrorMessage = !string.IsNullOrEmpty(error) ? error : "Tunnel not active";
            }
        }
        catch (Exception ex)
        {
            result.IsHealthy = false;
            result.ErrorMessage = ex.Message;
        }
        finally
        {
            stopwatch.Stop();
            result.ResponseTime = stopwatch.Elapsed;
        }

        return result;
    }
}
