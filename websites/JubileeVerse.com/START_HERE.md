# 🚀 START HERE - JubileeVerse Setup for Windows Server 2019

**Server**: solarwinding (10.0.0.4)
**OS**: Windows Server 2019 Datacenter
**Status**: Ready to install WSL2 + Docker

---

## ✅ Current Status

✓ **Node.js** - Installed
✓ **Project Files** - Ready
✓ **Configuration** - Complete
✓ **Scripts** - Created
⏳ **Docker** - Needs WSL2 installation

---

## 🎯 Installation Overview

Since Windows Server 2019 doesn't support Docker Desktop, we'll use **WSL2** (Windows Subsystem for Linux) to run Docker in an Ubuntu environment.

**Total Time**: ~20-30 minutes (includes one restart)

---

## 📋 Step-by-Step Instructions

### **Step 1: Install WSL2 and Docker** (15 minutes + restart)

Open **PowerShell as Administrator** and run:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\install-docker-wsl2-server2019.ps1
```

**What this does**:
1. ✓ Enables WSL feature
2. ✓ Enables Virtual Machine Platform
3. ✓ Installs WSL2 kernel
4. ⚠️ **RESTARTS YOUR SERVER** (required)
5. After restart, run the **same command again** to:
   - Install Ubuntu 22.04
   - Prompt you to create Linux username/password
   - Install Docker in Ubuntu

**IMPORTANT**:
- You'll need to run the script **twice** (before and after restart)
- When Ubuntu opens, create a username and password
- Remember these credentials!

---

### **Step 2: Start Docker Containers** (3 minutes)

After WSL2 and Docker are installed:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\setup-wsl-docker-containers.ps1
```

This starts three containers:
- `JubileeVerse-postgres` - PostgreSQL database
- `JubileeVerse-qdrant` - Vector database
- `JubileeVerse-redis` - Cache/queue

---

### **Step 3: Install Dependencies** (3 minutes)

```powershell
npm install
```

---

### **Step 4: Initialize Database** (1 minute)

```powershell
npm run db:setup
```

This runs 92 migrations to create ~50 database tables.

---

### **Step 5: Start Application** (instant)

```powershell
npm start
```

Then visit: **http://localhost:3000**

---

## 🔧 Quick Start (After Initial Setup)

Once everything is installed, starting the application is simple:

```powershell
# 1. Start Docker (if not running)
wsl bash -c "sudo service docker start"

# 2. Start containers
.\scripts\setup-wsl-docker-containers.ps1

# 3. Start application
npm start
```

---

## 📚 Documentation

- **[WSL_DOCKER_SETUP.md](WSL_DOCKER_SETUP.md)** - Complete WSL2/Docker guide
- **[PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)** - Production deployment guide
- **[README.md](README.md)** - Project overview
- **[STATUS.md](STATUS.md)** - Current setup status

---

## 🐛 Troubleshooting

### Script Won't Run
```powershell
# If you see execution policy error:
Set-ExecutionPolicy -Scope Process -Bypass

# Then try again:
.\scripts\install-docker-wsl2-server2019.ps1
```

### Docker Service Not Starting
```powershell
# Manually start Docker in WSL:
wsl bash -c "sudo service docker start"

# Check status:
wsl bash -c "sudo service docker status"
```

### Containers Won't Start
```powershell
# Check Docker is running:
wsl bash -c "sudo docker ps"

# View logs:
wsl bash -c "cd /mnt/c/Data/JubileeVerse.com && sudo docker compose -f docker-compose.production.yml logs"
```

### Need Help?
See [WSL_DOCKER_SETUP.md](WSL_DOCKER_SETUP.md) for detailed troubleshooting.

---

## 🎓 Understanding the Setup

### Architecture
```
Windows Server 2019
  └── WSL2 (Windows Subsystem for Linux)
      └── Ubuntu 22.04
          └── Docker Engine
              ├── PostgreSQL (JubileeVerse database)
              ├── Qdrant (vector database)
              └── Redis (cache/queue)
```

### Why WSL2?
- Windows Server 2019 doesn't support Docker Desktop
- WSL2 provides a full Linux kernel
- Near-native Linux performance
- Your code stays in Windows for easy editing
- Docker runs in Linux for compatibility

### File Access
- **Windows**: `C:\Data\JubileeVerse.com`
- **WSL**: `/mnt/c/Data/JubileeVerse.com`

---

## 📊 What Gets Installed

### WSL2 Components
- Windows Subsystem for Linux feature
- Virtual Machine Platform
- WSL2 Linux kernel
- Ubuntu 22.04 LTS

### Docker Components
- Docker Engine
- Docker Compose
- Container runtime (containerd)

### JubileeVerse Containers
- PostgreSQL 16 (database: JubileeVerse)
- Qdrant (vector embeddings)
- Redis 7 (caching & queues)

---

## ⚡ Useful Commands

### WSL Commands
```powershell
# Enter WSL Ubuntu shell
wsl

# Run a command in WSL
wsl bash -c "COMMAND"

# Check WSL status
wsl --status

# Shutdown WSL
wsl --shutdown
```

### Docker Commands (via WSL)
```powershell
# View running containers
wsl bash -c "sudo docker ps"

# View all containers
wsl bash -c "sudo docker ps -a"

# Start Docker service
wsl bash -c "sudo service docker start"

# View container logs
wsl bash -c "sudo docker logs JubileeVerse-postgres"
```

### Application Commands
```powershell
# Install dependencies
npm install

# Run migrations
npm run db:setup

# Start application
npm start

# Development mode (auto-reload)
npm run dev

# Run tests
npm test
```

---

## 🎯 Ready to Start?

Run this command as Administrator in PowerShell:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\install-docker-wsl2-server2019.ps1
```

**Remember**: You'll need to run it again after the restart to complete installation.

---

## 📞 Support

If you encounter issues:
1. Check [WSL_DOCKER_SETUP.md](WSL_DOCKER_SETUP.md) for detailed troubleshooting
2. Review error messages carefully
3. Ensure running PowerShell as Administrator
4. Verify Windows Server 2019 has latest updates

---

**Let's get started!** 🚀
