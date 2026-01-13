# Services

Production service templates and configurations for JubileeEnterprise.com applications.

## Available Templates

### [windows-service-template](./windows-service-template/)

A production-ready Windows Service template for Node.js applications with:

- **Multi-core clustering** - Uses all CPU cores (16 cores = 16 workers on this system)
- **Zero-downtime reload** - Restart workers without dropping requests
- **Auto-restart** - Workers automatically restart on crash
- **Windows boot auto-start** - Service starts when Windows boots

## Currently Running Services

| Service Name | Application | Port | Workers | Status |
|--------------|-------------|------|---------|--------|
| jubileeverse.exe | JubileeVerse.com | 3000 | 16 | Active |
| jubileeinspire.exe | JubileeInspire.com | 3001 | 16 | Active |
| inspirecodex-api | InspireCodex API | 3002 | PM2 | Active |
| wwbibleweb.exe | wwBibleweb.com | 3003 | 16 | Active |
| jubileebrowser.exe | JubileeBrowser.com | 3200 | 16 | Active |

## Quick Start

1. Copy the template files to your application
2. Modify `install-service.js` with your service name and port
3. Run `node install-service.js` as Administrator
4. Deploy updates with `node reload-service.js` for zero downtime

## System Information

| Specification | Value |
|---------------|-------|
| Physical Cores | 16 |
| Logical Processors | 32 (hyperthreading) |
| Recommended Workers | 16 (1 per physical core) |
| Max Workers | 32 (1 per logical processor) |

---

*JubileeEnterprise.com Production Infrastructure*
