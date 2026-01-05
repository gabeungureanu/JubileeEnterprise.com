# Docker Setup for Windows Server 2019 via WSL2

## Overview

Windows Server 2019 doesn't support Docker Desktop, so we'll use WSL2 (Windows Subsystem for Linux) to run Docker inside an Ubuntu environment.

**Server**: solarwinding (10.0.0.4)
**OS**: Windows Server 2019 Datacenter (Version 1809)

---

## Architecture

```
Windows Server 2019
    └── WSL2 (Windows Subsystem for Linux)
        └── Ubuntu 22.04
            └── Docker Engine
                ├── JubileeVerse-postgres
                ├── JubileeVerse-qdrant
                └── JubileeVerse-redis
```

Your Windows files at `C:\Data\JubileeVerse.com` are accessible inside WSL at `/mnt/c/Data/JubileeVerse.com`

---

## Installation Steps

### Prerequisites
- ✓ Windows Server 2019 (confirmed)
- ✓ Node.js installed (confirmed)
- ✓ Administrator access required

### Step 1: Install WSL2 and Docker

**Run as Administrator in PowerShell:**

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\install-docker-wsl2-server2019.ps1
```

This script will:
1. Enable WSL feature
2. Enable Virtual Machine Platform
3. Install WSL2 kernel update
4. **Prompt for restart** (required)
5. After restart, run the script again to:
   - Install Ubuntu 22.04
   - Prompt you to create a Linux username/password
   - Install Docker Engine in Ubuntu
   - Configure Docker

**IMPORTANT**:
- The script will restart your server
- After restart, run the same command again to complete installation
- When Ubuntu opens, create a username and password (remember these!)

### Step 2: Start Docker Containers

After WSL2 and Docker are installed:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\setup-wsl-docker-containers.ps1
```

This will start the three production containers:
- PostgreSQL (JubileeVerse database)
- Qdrant (vector database)
- Redis (cache/queue)

### Step 3: Install Application Dependencies

```powershell
npm install
```

### Step 4: Run Database Migrations

```powershell
npm run db:setup
```

### Step 5: Start the Application

```powershell
npm start
```

Then visit: **http://localhost:3000**

---

## Manual Installation (Alternative)

If the automated script fails, follow these manual steps:

### 1. Enable WSL Features

```powershell
# Run as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart

# Restart computer
Restart-Computer
```

### 2. Download and Install WSL2 Kernel

After restart, download and install:
- https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi

### 3. Set WSL2 as Default

```powershell
wsl --set-default-version 2
```

### 4. Install Ubuntu

```powershell
# Download Ubuntu 22.04
Invoke-WebRequest -Uri https://aka.ms/wslubuntu2204 -OutFile Ubuntu.appx -UseBasicParsing

# Install
Add-AppxPackage Ubuntu.appx

# Launch Ubuntu and create user account
ubuntu2204.exe
```

### 5. Install Docker in Ubuntu

```bash
# Inside WSL Ubuntu terminal:
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
sudo service docker start

# Add user to docker group
sudo usermod -aG docker $USER
```

### 6. Start Containers

```bash
# From Windows PowerShell
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml up -d"
```

---

## Working with WSL Docker

### Starting Docker Service

Docker service needs to be started each time WSL starts:

```powershell
wsl bash -c "sudo service docker start"
```

### Common Commands

```powershell
# View running containers
wsl bash -c "sudo docker ps"

# View all containers
wsl bash -c "sudo docker ps -a"

# View JubileeVerse containers
wsl bash -c "sudo docker ps --filter 'name=JubileeVerse'"

# View logs
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml logs -f"

# Restart containers
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml restart"

# Stop containers
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml stop"

# Start containers
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml start"
```

### Accessing Containers

```powershell
# PostgreSQL
wsl bash -c "sudo docker exec -it JubileeVerse-postgres psql -U guardian -d JubileeVerse"

# Redis
wsl bash -c "sudo docker exec -it JubileeVerse-redis redis-cli"

# View container logs
wsl bash -c "sudo docker logs JubileeVerse-postgres"
wsl bash -c "sudo docker logs JubileeVerse-qdrant"
wsl bash -c "sudo docker logs JubileeVerse-redis"
```

### Entering WSL Shell

```powershell
# Enter Ubuntu shell
wsl

# Or specify bash
wsl bash

# Exit back to Windows
exit
```

---

## Troubleshooting

### WSL Installation Fails

```powershell
# Check Windows version (must be 1809 or higher)
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion

# Ensure virtualization is enabled
Get-ComputerInfo | Select-Object HyperVisorPresent, HyperVRequirementVirtualizationFirmwareEnabled
```

### Docker Service Won't Start

```bash
# Inside WSL
sudo service docker status

# If not running
sudo service docker start

# Check logs
sudo journalctl -u docker
```

### Containers Won't Start

```powershell
# Check Docker is running
wsl bash -c "sudo service docker start"

# Check for errors
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml logs"

# Remove and recreate
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml down"
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml up -d"
```

### Port Already in Use

```powershell
# Check what's using the port in Windows
netstat -ano | findstr :5432
netstat -ano | findstr :6333
netstat -ano | findstr :6379

# In WSL
wsl bash -c "sudo netstat -tulpn | grep :5432"
```

### Permission Denied Errors

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Logout and login again to WSL
exit
wsl

# Or use sudo
sudo docker ps
```

---

## Auto-Starting Docker

To automatically start Docker service when WSL starts:

### Option 1: Manual Start Script

Create `start-docker.ps1`:
```powershell
wsl bash -c "sudo service docker start"
```

Run this whenever you restart the server.

### Option 2: WSL Config (Requires WSL 0.67.6+)

Create `/etc/wsl.conf` in Ubuntu:
```bash
wsl bash -c "echo '[boot]' | sudo tee /etc/wsl.conf"
wsl bash -c "echo 'command = \"service docker start\"' | sudo tee -a /etc/wsl.conf"
```

Then restart WSL:
```powershell
wsl --shutdown
wsl
```

---

## Performance Notes

- WSL2 has near-native Linux performance
- File I/O is faster inside the Linux filesystem (`/home/...`)
- But your code is in Windows (`/mnt/c/...`) for easier editing
- This is a good trade-off for this setup

---

## Data Storage

All persistent data is stored at:
- **Windows path**: `C:\Data\JubileeVerse\.datastore\`
- **WSL path**: `/mnt/c/Data/JubileeVerse/.datastore/`

Subdirectories:
- `postgres/` - PostgreSQL database files
- `qdrant/` - Vector database files
- `redis/` - Cache and queue data

---

## Next Steps After Setup

1. ✓ WSL2 and Docker installed
2. ✓ Containers running
3. Install dependencies: `npm install`
4. Run migrations: `npm run db:setup`
5. Start app: `npm start`
6. Visit: http://localhost:3000

---

## Quick Reference

| Task | Command |
|------|---------|
| Install WSL2 + Docker | `.\scripts\install-docker-wsl2-server2019.ps1` |
| Start containers | `.\scripts\setup-wsl-docker-containers.ps1` |
| Start Docker service | `wsl bash -c "sudo service docker start"` |
| View containers | `wsl bash -c "sudo docker ps"` |
| Enter WSL shell | `wsl` |
| Start application | `npm start` |

---

**Ready to begin?** Run the installation script as Administrator:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\install-docker-wsl2-server2019.ps1
```
