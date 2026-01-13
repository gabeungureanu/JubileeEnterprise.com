# Jubilee Enterprise Unified Windows Service

## Overview

The Jubilee Enterprise platform uses a **unified Windows Service** (`jubileeservices.exe`) to manage all websites and APIs from a single service. This approach provides:

- Centralized management of all Node.js applications
- Automatic restart on crash with exponential backoff
- Health monitoring via HTTP endpoint
- Zero-downtime reload capability
- Automatic startup on Windows boot

## Service Details

| Property | Value |
|----------|-------|
| Service Name | `jubileeservices.exe` |
| Display Name | JubileeServices |
| Health Endpoint | http://localhost:3999/health |
| Configuration | `services/unified/services.json` |
| Logs Directory | `services/unified/logs/` |

## Managed Services

The unified service manages the following websites and APIs:

| Service | Port | Description |
|---------|------|-------------|
| JubileeVerse.com | 3000 | Main Website |
| JubileeInspire.com | 3001 | Inspiration Platform |
| wwBibleweb.com | 3003 | Bible Web Platform |
| JubileeWebsites.com | 3008 | Website Generator |
| JubileeParadox.com | 3009 | Movie Website |
| InspireCodex API | 3100 | Identity & Configuration API |
| InspireContinuum API | 3101 | User Activity & Chat API |
| JubileeBrowser.com | 3200 | Browser Downloads |
| CelestialPaths.com | 3300 | Celestial Paths Website |

## File Structure

```
services/unified/
├── jubilee-services.cjs      # Main service manager
├── services.json             # Service configuration
├── install-service.cjs       # Windows Service installer
├── uninstall-service.cjs     # Windows Service uninstaller
├── reload-service.cjs        # Hot reload trigger
├── status.cjs                # Status checker
├── .gitignore
└── logs/                     # Per-service log files
    ├── jubileeverse.log
    ├── jubileeinspire.log
    ├── wwbibleweb.log
    └── ...
```

## Common Commands

### Check Service Status

```bash
# Using Windows Service Manager
sc query jubileeservices.exe

# Using health endpoint
curl http://localhost:3999/health
```

### Start/Stop/Restart Service

```bash
# Start service (requires Administrator)
net start jubileeservices.exe

# Stop service (requires Administrator)
net stop jubileeservices.exe

# Restart service (requires Administrator)
powershell -Command "Restart-Service jubileeservices.exe"
```

### Hot Reload Services

Reload all services without stopping the Windows Service:

```bash
# Method 1: Using reload script
cd services/unified
node reload-service.cjs

# Method 2: Using HTTP endpoint
curl http://localhost:3999/reload

# Method 3: Touch trigger file
touch services/unified/.reload-trigger
```

### View Service Logs

```bash
# View specific service log
cat services/unified/logs/jubileeverse.log

# Tail logs in real-time
tail -f services/unified/logs/jubileeverse.log
```

### Install/Uninstall Service

```bash
# Install (requires Administrator)
cd services/unified
node install-service.cjs

# Uninstall (requires Administrator)
cd services/unified
node uninstall-service.cjs
```

## Configuration

### services.json

The `services.json` file defines all managed services:

```json
{
  "name": "Jubilee Enterprise Services",
  "version": "1.0.0",
  "healthPort": 3999,
  "services": [
    {
      "name": "jubileeverse",
      "description": "JubileeVerse.com - Main Website",
      "script": "server.js",
      "cwd": "C:/data/JubileeEnterprise.com/websites/codex/JubileeVerse.com",
      "port": 3000,
      "enabled": true
    }
    // ... more services
  ]
}
```

### Adding a New Service

1. Add entry to `services.json`:
```json
{
  "name": "newservice",
  "description": "Description of new service",
  "script": "server.js",
  "cwd": "C:/path/to/service",
  "port": 3400,
  "enabled": true
}
```

2. Restart the Windows Service:
```bash
powershell -Command "Restart-Service jubileeservices.exe"
```

### Disabling a Service

Set `"enabled": false` in the service configuration:

```json
{
  "name": "servicename",
  "enabled": false
}
```

Then reload or restart the service.

## Health Endpoint

The health endpoint at `http://localhost:3999/health` returns:

```json
{
  "status": "ok",
  "timestamp": "2026-01-13T06:30:34.095Z",
  "manager": {
    "pid": 280876,
    "uptime": 1054.92
  },
  "services": [
    {
      "name": "jubileeverse",
      "port": 3000,
      "pid": 220972,
      "status": "running",
      "restarts": 0
    }
    // ... more services
  ]
}
```

## Automatic Restart Behavior

If a service crashes, the manager will:

1. Log the crash to the service's log file
2. Wait with exponential backoff (1s, 2s, 4s, 8s, ... up to 30s max)
3. Automatically restart the service
4. Reset the restart counter after 5 minutes of stable operation

## Troubleshooting

### Service Won't Start

1. Check if port is already in use:
```bash
netstat -ano | findstr ":PORT"
```

2. Check service logs:
```bash
cat services/unified/logs/servicename.log
```

3. Verify script path exists in services.json

### All Services Down

1. Check Windows Service status:
```bash
sc query jubileeservices.exe
```

2. If stopped, start it:
```bash
net start jubileeservices.exe
```

3. Check Windows Event Viewer for errors

### Health Endpoint Not Responding

1. Verify service is running:
```bash
sc query jubileeservices.exe
```

2. Check if port 3999 is in use by another process:
```bash
netstat -ano | findstr ":3999"
```

## Admin Dashboard

A real-time monitoring dashboard is available at:

**http://localhost:3008/admin/**

Features:
- Server status indicators for all 9 services
- Speedometer gauge showing visitors per minute
- Mini gauges for system metrics
- Stats by period (Hourly, Daily, Weekly, Monthly, YTD)

## Important Notes

- **No PM2**: This system does not use PM2. All process management is handled by the unified Windows Service.
- **node-windows**: The Windows Service is created using the `node-windows` npm package.
- **Administrator Required**: Installing, uninstalling, starting, and stopping the service requires Administrator privileges.
- **Logs Rotation**: Log files grow indefinitely. Consider implementing log rotation for production use.

## Dependencies

- Node.js v18+
- node-windows (globally installed at `C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows`)

## Related Files

- Main service manager: `services/unified/jubilee-services.cjs`
- Configuration: `services/unified/services.json`
- Admin dashboard: `websites/codex/JubileeWebsites.com/public/admin/index.html`
