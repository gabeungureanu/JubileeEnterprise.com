# Install Required Software - solarwinding Server

## Current Status
❌ Node.js - **NOT INSTALLED**
❌ Docker Desktop - **NOT INSTALLED**

Both are required to run JubileeVerse. Follow the steps below.

---

## Step 1: Install Node.js (REQUIRED)

### Download and Install

1. **Download Node.js 20.x LTS**:
   - URL: https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi
   - Or visit: https://nodejs.org/ and click "Download LTS"

2. **Run the Installer**:
   - Double-click the downloaded `.msi` file
   - Click "Next" through the wizard
   - **IMPORTANT**: Check "Automatically install the necessary tools"
   - **IMPORTANT**: Check "Add to PATH" (should be default)
   - Click "Install"
   - Click "Finish"

3. **Verify Installation**:
   Open a **NEW** PowerShell or Git Bash window and run:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers like:
   ```
   v20.11.0
   10.2.4
   ```

---

## Step 2: Install Docker Desktop (REQUIRED)

### Download and Install

1. **Download Docker Desktop for Windows**:
   - URL: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
   - Or visit: https://www.docker.com/products/docker-desktop/

2. **Run the Installer**:
   - Double-click the downloaded installer
   - Check "Use WSL 2 instead of Hyper-V" (recommended)
   - Click "OK" to install
   - **May require system restart**

3. **Start Docker Desktop**:
   - Press Windows Key
   - Search for "Docker Desktop"
   - Click to launch
   - Wait for Docker to start (green whale icon in system tray)
   - Accept the license agreement if prompted

4. **Verify Installation**:
   Open a **NEW** PowerShell or Git Bash window and run:
   ```bash
   docker --version
   docker ps
   ```
   You should see:
   ```
   Docker version 24.x.x
   CONTAINER ID   IMAGE   COMMAND   ...
   ```

---

## Step 3: After Installation

Once both Node.js and Docker Desktop are installed and running:

### Option A: Quick Start (Automated)

Open PowerShell in the project directory:
```powershell
cd C:\Data\JubileeVerse.com
.\scripts\quick-start.ps1
```

This will automatically:
- ✓ Create and start Docker containers
- ✓ Install npm dependencies
- ✓ Run database migrations
- ✓ Show you the startup command

### Option B: Manual Start

Open Git Bash or PowerShell:
```bash
cd /c/Data/JubileeVerse.com

# Start Docker containers
docker-compose -f docker-compose.production.yml up -d

# Wait 15 seconds for containers to be ready
sleep 15

# Install dependencies
npm install

# Run database migrations
npm run db:setup

# Start the application
npm start
```

### Option C: Bash Script (Git Bash)

```bash
cd /c/Data/JubileeVerse.com
./start-production.sh
```

---

## Verification Checklist

After installation, verify everything works:

```bash
# Check Node.js
node --version          # Should show v20.x.x
npm --version           # Should show 10.x.x

# Check Docker
docker --version        # Should show version
docker ps               # Should show running containers

# Check containers (after starting)
docker ps --filter "name=JubileeVerse"
# Should show 3 containers:
# - JubileeVerse-postgres
# - JubileeVerse-qdrant
# - JubileeVerse-redis

# Check application
curl http://localhost:3000/api/admin/health
# Should return JSON health status
```

---

## Alternative: Install via Chocolatey (PowerShell as Admin)

If you prefer using a package manager:

```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Refresh environment
refreshenv

# Install Node.js
choco install nodejs-lts -y

# Install Docker Desktop
choco install docker-desktop -y

# Restart terminal and verify
node --version
docker --version
```

---

## Troubleshooting

### "node is not recognized"
- Restart your terminal/PowerShell/Git Bash
- Check PATH: `echo $env:PATH` (PowerShell) or `echo $PATH` (Bash)
- Reinstall Node.js and ensure "Add to PATH" is checked

### "docker is not recognized"
- Start Docker Desktop application
- Wait for it to fully start (green whale in system tray)
- Restart your terminal
- Try again

### Docker Desktop won't start
- Enable virtualization in BIOS
- Enable Hyper-V or WSL2 in Windows Features
- Restart computer
- Try starting Docker Desktop again

### WSL2 Installation Required
If Docker asks to install WSL2:
```powershell
# Run as Administrator
wsl --install
# Restart computer
# Start Docker Desktop again
```

---

## What Happens After Installation?

Once Node.js and Docker are installed, the quick-start script will:

1. **Start 3 Docker Containers**:
   - PostgreSQL database (JubileeVerse)
   - Qdrant vector database
   - Redis cache/queue

2. **Install Application Dependencies**:
   - All npm packages from package.json
   - ~50 packages including Express, OpenAI SDK, etc.

3. **Initialize Database**:
   - Run 92 migrations
   - Create ~50+ tables
   - Set up initial schema

4. **Start Application**:
   - Launch Express server on port 3000
   - Connect to all services
   - Ready to accept requests

5. **Access Points**:
   - Application: http://localhost:3000
   - Qdrant Dashboard: http://localhost:6333/dashboard
   - Admin Health: http://localhost:3000/api/admin/health

---

## Timeline

- **Node.js Installation**: ~5 minutes
- **Docker Desktop Installation**: ~10 minutes (may require restart)
- **First Container Start**: ~2 minutes
- **npm install**: ~3 minutes
- **Database Migrations**: ~30 seconds
- **Total**: ~20-25 minutes for first-time setup

Subsequent starts take ~30 seconds (containers start quickly).

---

## Next Steps

1. Install Node.js (see Step 1 above)
2. Install Docker Desktop (see Step 2 above)
3. Restart your terminal
4. Run: `cd C:\Data\JubileeVerse.com && .\scripts\quick-start.ps1`
5. Run: `npm start`
6. Visit: http://localhost:3000

---

**Ready to start?** Install Node.js and Docker Desktop, then come back to this guide!
