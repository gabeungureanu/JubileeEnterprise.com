# WSL2 + systemd Infrastructure

**Architecture Decision**: ARCH-0007
**Status**: FINAL
**Date**: 2026-01-17

## Overview

This directory contains all configuration files for running Jubilee Enterprise services inside WSL2 with systemd as the process supervisor.

## Architecture

```
Windows 11 Pro (Hypervisor)
└── WSL2 (Ubuntu 24.04)
    └── systemd (PID 1)
        ├── docker.service
        │   └── jubilee-docker.service (PostgreSQL, Qdrant, Redis)
        ├── jubilee-api.target (4 API services)
        ├── jubilee-websites.target (36 website services)
        ├── jubilee-cloudflared.service
        ├── nginx.service (reverse proxy)
        └── prometheus.service + grafana.service
```

## Directory Structure

```
infrastructure/wsl2/
├── docker/
│   └── docker-compose.yml          # PostgreSQL, Qdrant, Redis, pgAdmin
├── systemd/
│   ├── jubilee.target              # Main orchestration target
│   ├── jubilee-docker.target       # Infrastructure containers
│   ├── jubilee-docker.service      # Docker compose manager
│   ├── jubilee-api.target          # API services group
│   ├── jubilee-api@.service        # API service template
│   ├── jubilee-websites.target     # Website services group
│   ├── jubilee-website@.service    # Website service template
│   └── jubilee-cloudflared.service # Cloudflare tunnel
├── nginx/
│   ├── nginx.conf                  # Main Nginx configuration
│   ├── upstreams.conf              # Upstream server definitions
│   └── health.conf                 # Health check endpoint
├── monitoring/
│   ├── prometheus.yml              # Prometheus configuration
│   └── docker-compose.monitoring.yml
├── scripts/
│   ├── install-systemd-services.sh # Install all systemd units
│   ├── install-cloudflared.sh      # Install cloudflared
│   ├── start-wsl-services.ps1      # Windows boot script
│   └── install-scheduled-task.ps1  # Install Windows task
└── README.md                       # This file
```

## Installation

### Prerequisites

- Windows 11 Pro with WSL2 enabled
- Ubuntu 24.04 in WSL2 with systemd enabled
- Docker Engine installed in WSL2
- Node.js 22+ installed in WSL2

### Step 1: Install systemd Services

```bash
# In WSL2 (Ubuntu)
cd "/mnt/c/data/JubileeEnterprise.com Bibleweb/infrastructure/wsl2/scripts"
chmod +x install-systemd-services.sh
sudo ./install-systemd-services.sh
```

### Step 2: Install cloudflared

```bash
# In WSL2 (Ubuntu)
chmod +x install-cloudflared.sh
sudo ./install-cloudflared.sh
```

### Step 3: Install Nginx Configuration

```bash
# In WSL2 (Ubuntu)
sudo apt install nginx -y
sudo cp ../nginx/nginx.conf /etc/nginx/nginx.conf
sudo mkdir -p /etc/nginx/upstreams
sudo cp ../nginx/upstreams.conf /etc/nginx/upstreams/jubilee.conf
sudo cp ../nginx/health.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/health.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### Step 4: Install Windows Auto-Start

```powershell
# In Windows PowerShell (as Administrator)
cd "C:\data\JubileeEnterprise.com Bibleweb\infrastructure\wsl2\scripts"
.\install-scheduled-task.ps1
```

## Usage

### Start All Services

```bash
sudo systemctl start jubilee.target
```

### Stop All Services

```bash
sudo systemctl stop jubilee.target
```

### Check Status

```bash
# Overall status
systemctl status jubilee.target

# List all Jubilee services
systemctl list-units 'jubilee-*'

# Specific service status
systemctl status jubilee-api@InspireCodex.com
systemctl status jubilee-website@JubileeVerse.com
```

### View Logs

```bash
# All Jubilee logs
journalctl -u 'jubilee-*' -f

# Specific service logs
journalctl -u jubilee-api@InspireCodex.com -f
journalctl -u jubilee-cloudflared -f
```

### Restart a Service

```bash
sudo systemctl restart jubilee-api@InspireCodex.com
```

### Reload Configuration (Zero-Downtime)

```bash
# Reload Nginx
sudo nginx -s reload

# Reload systemd units
sudo systemctl daemon-reload
```

## Port Allocations

| Port Range | Services |
|------------|----------|
| 3000-3009 | Core websites |
| 3100-3137 | Website services |
| 3200 | InspireContinuum API |
| 3900 | Nginx health endpoint |
| 5432 | PostgreSQL (Codex) |
| 5433 | PostgreSQL (Inspire) |
| 5434 | PostgreSQL (Continuum) |
| 5050 | pgAdmin |
| 6333-6334 | Qdrant |
| 6379 | Redis |
| 9090 | Prometheus |
| 3950 | Grafana |

## Health Checks

```bash
# Nginx health
curl http://localhost:3900/health

# API health
curl http://localhost:3100/health
curl http://localhost:3200/health

# Database health
docker exec postgres-codex pg_isready -U guardian
docker exec qdrant curl http://localhost:6333/health
docker exec redis redis-cli ping
```

## Troubleshooting

### Services won't start

```bash
# Check systemd logs
journalctl -xe

# Check specific service
systemctl status jubilee-docker.service -l
```

### Docker containers not healthy

```bash
# Check Docker logs
docker compose -f /mnt/c/data/.../docker/docker-compose.yml logs

# Restart Docker infrastructure
sudo systemctl restart jubilee-docker.service
```

### Cloudflared tunnel not connecting

```bash
# Check tunnel status
cloudflared tunnel info jubilee-enterprise

# View tunnel logs
journalctl -u jubilee-cloudflared -f
```

## Rollback to Windows Services

If issues occur, you can roll back to the original Windows Services:

1. Stop WSL2 services: `wsl -d Ubuntu-24.04 -- sudo systemctl stop jubilee.target`
2. Re-enable Windows cloudflared service
3. Start Windows Inspire 8.0 services

The original Windows Service configuration remains in `services/Inspire.8.0/`.
