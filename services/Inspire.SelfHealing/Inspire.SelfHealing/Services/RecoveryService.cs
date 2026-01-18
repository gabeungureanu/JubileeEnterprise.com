using System.Diagnostics;
using System.ServiceProcess;
using Inspire.SelfHealing.Configuration;

namespace Inspire.SelfHealing.Services;

public class RecoveryService : IRecoveryService
{
    private readonly ILogger<RecoveryService> _logger;
    private readonly IEventLogService _eventLogService;

    public RecoveryService(ILogger<RecoveryService> logger, IEventLogService eventLogService)
    {
        _logger = logger;
        _eventLogService = eventLogService;
    }

    public async Task<RecoveryResult> ExecuteRecoveryAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new RecoveryResult
        {
            ServiceName = service.Name,
            ActionType = service.RecoveryAction.Type
        };

        _logger.LogInformation("Executing recovery action {ActionType} for {ServiceName}",
            service.RecoveryAction.Type, service.Name);

        try
        {
            switch (service.RecoveryAction.Type)
            {
                case RecoveryActionType.RestartWindowsService:
                    result = await RestartWindowsServiceAsync(service, cancellationToken);
                    break;

                case RecoveryActionType.RecycleIISAppPool:
                    result = await RecycleIISAppPoolAsync(service, cancellationToken);
                    break;

                case RecoveryActionType.StartProcess:
                    result = await StartProcessAsync(service, cancellationToken);
                    break;

                case RecoveryActionType.RestartDockerContainer:
                    result = await RestartDockerContainerAsync(service, cancellationToken);
                    break;

                case RecoveryActionType.RestartCloudflareTunnel:
                    result = await RestartCloudflareTunnelAsync(service, cancellationToken);
                    break;

                default:
                    result.Success = false;
                    result.ErrorMessage = $"Unknown recovery action type: {service.RecoveryAction.Type}";
                    break;
            }

            if (result.Success)
            {
                await _eventLogService.LogRecoverySuccessAsync(service.Name, service.RecoveryAction.Type);
            }
            else
            {
                await _eventLogService.LogRecoveryFailureAsync(service.Name, service.RecoveryAction.Type, result.ErrorMessage ?? "Unknown error");
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
            _logger.LogError(ex, "Recovery action failed for {ServiceName}", service.Name);
            await _eventLogService.LogRecoveryFailureAsync(service.Name, service.RecoveryAction.Type, ex.Message);
        }

        return result;
    }

    private async Task<RecoveryResult> RestartWindowsServiceAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new RecoveryResult
        {
            ServiceName = service.Name,
            ActionType = RecoveryActionType.RestartWindowsService
        };

        try
        {
            var serviceName = service.RecoveryAction.ServiceName;
            if (string.IsNullOrEmpty(serviceName))
            {
                result.Success = false;
                result.ErrorMessage = "Service name not configured";
                return result;
            }

            using var sc = new ServiceController(serviceName);

            // Stop if running
            if (sc.Status == ServiceControllerStatus.Running)
            {
                _logger.LogInformation("Stopping Windows service {ServiceName}", serviceName);
                sc.Stop();
                sc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(30));
            }

            // Start the service
            _logger.LogInformation("Starting Windows service {ServiceName}", serviceName);
            sc.Start();
            sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));

            result.Success = true;
            result.Message = $"Windows service {serviceName} restarted successfully";
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    private async Task<RecoveryResult> RecycleIISAppPoolAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new RecoveryResult
        {
            ServiceName = service.Name,
            ActionType = RecoveryActionType.RecycleIISAppPool
        };

        try
        {
            var appPoolName = service.RecoveryAction.AppPoolName;
            if (string.IsNullOrEmpty(appPoolName))
            {
                result.Success = false;
                result.ErrorMessage = "App pool name not configured";
                return result;
            }

            _logger.LogInformation("Recycling IIS app pool {AppPoolName}", appPoolName);

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = @"C:\Windows\System32\inetsrv\appcmd.exe",
                    Arguments = $"recycle apppool /apppool.name:\"{appPoolName}\"",
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

            if (process.ExitCode == 0)
            {
                result.Success = true;
                result.Message = $"IIS app pool {appPoolName} recycled successfully";
            }
            else
            {
                result.Success = false;
                result.ErrorMessage = !string.IsNullOrEmpty(error) ? error : output;
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    private async Task<RecoveryResult> StartProcessAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new RecoveryResult
        {
            ServiceName = service.Name,
            ActionType = RecoveryActionType.StartProcess
        };

        try
        {
            var processPath = service.RecoveryAction.ProcessPath;
            if (string.IsNullOrEmpty(processPath))
            {
                result.Success = false;
                result.ErrorMessage = "Process path not configured";
                return result;
            }

            _logger.LogInformation("Starting process {ProcessPath}", processPath);

            // First, try to find and kill any existing process
            await KillExistingProcessAsync(service, cancellationToken);

            var startInfo = new ProcessStartInfo
            {
                FileName = processPath,
                Arguments = service.RecoveryAction.Arguments ?? "",
                WorkingDirectory = service.RecoveryAction.WorkingDirectory ?? Path.GetDirectoryName(processPath) ?? "",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            var process = Process.Start(startInfo);

            if (process != null)
            {
                // Give the process time to start
                await Task.Delay(2000, cancellationToken);

                if (!process.HasExited)
                {
                    result.Success = true;
                    result.Message = $"Process started successfully (PID: {process.Id})";
                }
                else
                {
                    result.Success = false;
                    result.ErrorMessage = "Process exited immediately after starting";
                }
            }
            else
            {
                result.Success = false;
                result.ErrorMessage = "Failed to start process";
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    private async Task KillExistingProcessAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        try
        {
            if (service.Port.HasValue)
            {
                // Kill process using the port
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = $"/c for /f \"tokens=5\" %a in ('netstat -ano ^| findstr :{service.Port.Value} ^| findstr LISTENING') do taskkill /F /PID %a",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    }
                };

                process.Start();
                await process.WaitForExitAsync(cancellationToken);

                _logger.LogInformation("Killed existing process on port {Port}", service.Port.Value);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to kill existing process for {ServiceName}", service.Name);
        }
    }

    private async Task<RecoveryResult> RestartDockerContainerAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new RecoveryResult
        {
            ServiceName = service.Name,
            ActionType = RecoveryActionType.RestartDockerContainer
        };

        try
        {
            var containerName = service.RecoveryAction.ContainerName;
            if (string.IsNullOrEmpty(containerName))
            {
                result.Success = false;
                result.ErrorMessage = "Container name not configured";
                return result;
            }

            _logger.LogInformation("Restarting Docker container {ContainerName}", containerName);

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"restart {containerName}",
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

            if (process.ExitCode == 0)
            {
                result.Success = true;
                result.Message = $"Docker container {containerName} restarted successfully";
            }
            else
            {
                result.Success = false;
                result.ErrorMessage = !string.IsNullOrEmpty(error) ? error : output;
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    private async Task<RecoveryResult> RestartCloudflareTunnelAsync(MonitoredService service, CancellationToken cancellationToken)
    {
        var result = new RecoveryResult
        {
            ServiceName = service.Name,
            ActionType = RecoveryActionType.RestartCloudflareTunnel
        };

        try
        {
            var tunnelName = service.RecoveryAction.TunnelName;
            if (string.IsNullOrEmpty(tunnelName))
            {
                result.Success = false;
                result.ErrorMessage = "Tunnel name not configured";
                return result;
            }

            _logger.LogInformation("Restarting Cloudflare tunnel {TunnelName}", tunnelName);

            // Kill existing cloudflared processes
            var killProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "taskkill",
                    Arguments = "/F /IM cloudflared.exe",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            killProcess.Start();
            await killProcess.WaitForExitAsync(cancellationToken);

            // Wait a moment for cleanup
            await Task.Delay(2000, cancellationToken);

            // Start the tunnel
            var startProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "cloudflared",
                    Arguments = $"tunnel run {tunnelName}",
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            startProcess.Start();

            // Give it time to connect
            await Task.Delay(5000, cancellationToken);

            if (!startProcess.HasExited)
            {
                result.Success = true;
                result.Message = $"Cloudflare tunnel {tunnelName} started successfully";
            }
            else
            {
                result.Success = false;
                result.ErrorMessage = "Tunnel process exited unexpectedly";
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }
}
