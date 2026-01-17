# Inspire 8.0: Self-Healing Windows Service

A lightweight, self-healing Windows Service designed to monitor the health of Jubilee Enterprise websites and services, automatically restoring availability when failures are detected.

## Features

- **Health Monitoring**: Checks website health endpoints every 60 seconds
- **Auto-Recovery**: Automatically restarts failed services
- **Windows Event Log**: Logs all health checks and recovery actions
- **Hot-Reload Configuration**: Edit `monitored-services.json` without restarting
- **Docker Support**: Can restart Docker containers
- **Cloudflare Tunnel**: Can restart Cloudflare tunnels

## Monitored Services

| Service | Port | Health Endpoint | Recovery Action |
|---------|------|-----------------|-----------------|
| JubileeVerse.com | 3000 | /health | Restart Node.js |
| InspireCodex.com | 3100 | /health | Restart Node.js |
| JubileeGoodNews.com | 3107 | /health | Restart Node.js |
| Qdrant Vector DB | 6333 | /health | Restart Docker |
| Redis Cache | 6379 | - | Restart Docker |
| Cloudflare Tunnel | - | - | Restart Tunnel |

## Installation

### Prerequisites
- Windows 10/11 or Windows Server
- Administrator privileges
- .NET 9.0 Runtime (if not using self-contained)

### Quick Install

1. Open Command Prompt **as Administrator**
2. Navigate to the service directory:
   ```cmd
   cd "C:\data\JubileeEnterprise.com Bibleweb\services\Inspire.SelfHealing"
   ```
3. Run the installation script:
   ```cmd
   install-service.bat
   ```

### Manual Install

```cmd
sc create Inspire.SelfHealing binPath= "C:\data\JubileeEnterprise.com Bibleweb\services\Inspire.SelfHealing\Inspire.SelfHealing\publish\Inspire.SelfHealing.exe" start= auto DisplayName= "Inspire 8.0: Self-Healing"

sc description Inspire.SelfHealing "Health monitoring and automatic recovery service for Jubilee Enterprise websites and services"

sc failure Inspire.SelfHealing reset= 86400 actions= restart/60000/restart/60000/restart/60000

sc start Inspire.SelfHealing
```

## Uninstallation

1. Open Command Prompt **as Administrator**
2. Run:
   ```cmd
   uninstall-service.bat
   ```

Or manually:
```cmd
sc stop Inspire.SelfHealing
sc delete Inspire.SelfHealing
```

## Configuration

Edit `monitored-services.json` in the publish folder to add or modify monitored services.

### Configuration Options

```json
{
  "MonitoredServices": {
    "MonitoringIntervalSeconds": 60,     // Health check interval
    "HealthCheckTimeoutSeconds": 30,     // HTTP request timeout
    "MaxRetryAttempts": 3,               // Failures before recovery
    "Services": [...]
  }
}
```

### Service Types

- `Website` - HTTP health endpoint check
- `WindowsService` - Windows Service status check
- `DockerContainer` - Docker container running check
- `CloudflareTunnel` - Cloudflare tunnel status check
- `IISAppPool` - IIS Application Pool check

### Recovery Actions

- `StartProcess` - Start a Node.js/other process
- `RestartWindowsService` - Restart a Windows Service
- `RecycleIISAppPool` - Recycle an IIS App Pool
- `RestartDockerContainer` - Restart a Docker container
- `RestartCloudflareTunnel` - Restart Cloudflare tunnel

## Viewing Logs

### Windows Event Viewer
1. Open Event Viewer
2. Navigate to Windows Logs > Application
3. Filter by Source: "Inspire.SelfHealing"

### Event IDs
- **1000**: Service started
- **1001**: Service stopped
- **2000**: Health check failed
- **3000**: Recovery attempted
- **3001**: Recovery successful
- **3002**: Recovery failed

## Building from Source

```cmd
cd "C:\data\JubileeEnterprise.com Bibleweb\services\Inspire.SelfHealing\Inspire.SelfHealing"
dotnet publish -c Release -r win-x64 --self-contained -o publish
```

## Troubleshooting

### Service won't start
- Check Windows Event Viewer for error details
- Verify `monitored-services.json` is valid JSON
- Ensure the publish folder has all required files

### Recovery actions not working
- Verify paths in configuration are correct
- Check Node.js is in PATH for process recovery
- Ensure Docker is running for container recovery
- Check Cloudflare credentials for tunnel recovery

### Health checks failing
- Verify the health endpoint URL is correct
- Check if the target service is running
- Ensure firewall allows localhost connections

## Architecture

```
┌─────────────────────────────────────────┐
│     Inspire 8.0: Self-Healing           │
├─────────────────────────────────────────┤
│  SelfHealingWorker (60s loop)           │
│    │                                    │
│    ├── HealthCheckService               │
│    │     ├── HTTP Health Checks         │
│    │     ├── Windows Service Checks     │
│    │     └── Docker Container Checks    │
│    │                                    │
│    ├── RecoveryService                  │
│    │     ├── Process Restart            │
│    │     ├── Service Restart            │
│    │     ├── IIS Recycle                │
│    │     ├── Docker Restart             │
│    │     └── Tunnel Restart             │
│    │                                    │
│    └── EventLogService                  │
│          └── Windows Event Log          │
└─────────────────────────────────────────┘
```

## License

Jubilee Enterprise - Internal Use Only
