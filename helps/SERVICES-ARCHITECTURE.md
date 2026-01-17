# Inspire 8.0 Services Architecture

## Overview

Jubilee Enterprise uses a **5-service Windows architecture** for managing all websites, APIs, and infrastructure. This document defines the authoritative architecture that MUST be followed.

---

## The 5 Windows Services

| Service Name | Purpose | Technology |
|--------------|---------|------------|
| **Inspire 8.0: Website Services** | Manages all 40 frontend websites | Unified Node.js Service Manager |
| **Inspire 8.0: Web API Services** | Manages API servers (Codex, Continuum) | Unified Node.js Service Manager |
| **Inspire 8.0: Self-Healing Services** | Health monitoring & auto-recovery | .NET Worker Service |
| **Inspire 8.0: Docker Services** | Manages Docker containers (Qdrant, Redis) | .NET Worker Service |
| **Inspire 8.0: Cloudflared Services** | Manages Cloudflare tunnel | Windows Service |

---

## Service Architecture

### 1. Inspire 8.0: Website Services
- **Location**: `services/Inspire.8.0/`
- **Config**: `websites-services.json`
- **Manager**: `inspire-service-manager.cjs`
- **Health Port**: 3900
- **Websites**: 40 frontend websites (ports 3000-3137)
- **Features**:
  - Multi-process management (1 service manages all websites)
  - Per-site enable/disable via JSON config
  - Auto-restart on crash with exponential backoff
  - Zero-downtime reload via trigger file
  - Health monitoring endpoint

### 2. Inspire 8.0: Web API Services
- **Location**: `services/Inspire.8.0/`
- **Config**: `api-services.json`
- **Manager**: `inspire-service-manager.cjs`
- **Health Port**: 3901
- **APIs**:
  - InspireCodex.com (port 3100) - Identity & Configuration
  - InspireContinuum.com (port 3200) - User Activity & Chat

### 3. Inspire 8.0: Self-Healing Services
- **Location**: `services/Inspire.SelfHealing/`
- **Technology**: .NET 9.0 Worker Service
- **Config**: `monitored-services.json`
- **Features**:
  - 60-second health check cycle
  - Auto-recovery after 3 consecutive failures
  - Windows Event Log integration
  - Hot-reload configuration

### 4. Inspire 8.0: Docker Services
- **Location**: `services/Inspire.8.0/`
- **Config**: `docker-services.json`
- **Manager**: `docker-service-manager.cjs`
- **Health Port**: 3902
- **Containers**:
  - Qdrant (port 6333) - Vector database
  - Redis (port 6379) - Cache
  - pgAdmin (port 5050) - DB Admin

### 5. Inspire 8.0: Cloudflared Services
- **Location**: `services/Inspire.8.0/`
- **Manager**: `cloudflared-service-manager.cjs`
- **Health Port**: 3903
- **Tunnel Name**: `jubilee-enterprise`
- **Config**: `C:\Users\elian\.cloudflared\config.yml`
- **Maps**: All production domains to localhost ports

---

## Unified Service Manager Pattern

The unified service manager (`inspire-service-manager.cjs`) is based on `C:\data\JubileeEnterprise.com Flywheel\services\unified\jubilee-services.cjs`.

### Key Features:
1. **Single Windows Service** manages multiple Node.js applications
2. **JSON configuration** for easy site management
3. **Child process isolation** - each site runs in its own process
4. **Automatic restart** with exponential backoff
5. **Zero-downtime reload** - touch `.reload-trigger` file
6. **Health endpoint** - GET `/health` for status

### Installation Pattern:
```javascript
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'Inspire 8.0: Website Services',
  description: 'Manages all Jubilee Enterprise frontend websites',
  script: path.join(__dirname, 'inspire-service-manager.cjs'),
  nodeOptions: ['--config=websites-services.json'],
  workingDirectory: __dirname,
  env: [{ name: 'NODE_ENV', value: 'production' }]
});

svc.install();
```

---

## Port Allocation

| Range | Purpose |
|-------|---------|
| 3000-3099 | Core websites |
| 3100-3199 | API services |
| 3200-3299 | Browser/Tools |
| 3300-3399 | Static sites |
| 3900-3999 | Health endpoints |
| 6333 | Qdrant |
| 6379 | Redis |
| 5050 | pgAdmin |

---

## Critical Rules

1. **NO PM2** - Use the unified service manager pattern
2. **NO individual Windows Services per website** - Use grouped services
3. **All services auto-start** without user login (LocalSystem account)
4. **Configuration via JSON** - Not hardcoded
5. **Always use existing templates** from `services/windows-service-template/`

---

## Existing Service Infrastructure

### From Flywheel (Reference):
- `C:\data\JubileeEnterprise.com Flywheel\services\unified\` - Unified manager
- `C:\data\JubileeEnterprise.com Flywheel\services\windows-service-template\` - Templates

### Current Service Files:
```
services/Inspire.8.0/
├── inspire-service-manager.cjs      # Unified manager for websites/APIs
├── websites-services.json           # Config for 40 websites
├── api-services.json                # Config for API services
├── docker-services.json             # Config for Docker containers
├── docker-service-manager.cjs       # Docker container manager
├── cloudflared-service-manager.cjs  # Cloudflare tunnel manager
├── install-website-services.cjs     # Install Website Services
├── install-api-services.cjs         # Install API Services
├── install-docker-services.cjs      # Install Docker Services
├── install-cloudflared-services.cjs # Install Cloudflared Services
├── uninstall-website-services.cjs   # Uninstall Website Services
├── uninstall-api-services.cjs       # Uninstall API Services
├── uninstall-docker-services.cjs    # Uninstall Docker Services
├── uninstall-cloudflared-services.cjs # Uninstall Cloudflared Services
├── install-all-services.bat         # Master install script
└── uninstall-all-services.bat       # Master uninstall script

services/Inspire.SelfHealing/
├── Inspire.SelfHealing/             # .NET Worker Service project
│   ├── Program.cs
│   ├── SelfHealingWorker.cs
│   ├── Configuration/
│   └── Services/
├── monitored-services.json          # Monitored services config
├── install-service.bat              # Install Self-Healing Service
└── uninstall-service.bat            # Uninstall Self-Healing Service
```

---

## Installation

### Quick Install (All Services):
```batch
# Run as Administrator
cd services\Inspire.8.0
install-all-services.bat
```

### Individual Install:
```batch
# Run as Administrator
node install-docker-services.cjs      # Infrastructure first
node install-cloudflared-services.cjs # Tunnel
node install-api-services.cjs         # APIs
node install-website-services.cjs     # Websites
```

---

## Recovery Procedures

### If a website fails:
1. Check health endpoint: `curl http://localhost:3900/health`
2. The unified manager auto-restarts failed sites
3. Manual restart: `touch .reload-trigger` in service directory

### If entire service fails:
1. Self-Healing service will detect and restart
2. Manual: `sc start "Inspire 8.0: Website Services"`

---

*Last Updated: January 17, 2026*
*This document is the authoritative source for Inspire 8.0 service architecture.*
