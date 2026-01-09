# Installation Instructions for solarwinding Server

## Current Status
✓ Server detected: `solarwinding` (10.0.0.4)
✓ Configuration files created
✓ Docker Compose files ready
⚠ Docker Desktop needs to be started/configured
⚠ Node.js needs to be installed/configured

---

## Step 1: Install Node.js (REQUIRED)

### Option A: Download and Install
1. Download Node.js 20.x LTS from: https://nodejs.org/
2. Run the installer
3. Select "Add to PATH" during installation
4. Restart your terminal/Git Bash

### Option B: Using Chocolatey (if available)
```powershell
# Open PowerShell as Administrator
choco install nodejs-lts -y

# Refresh environment
refreshenv
```

### Verify Installation
```bash
node --version
npm --version
```

---

## Step 2: Start Docker Desktop (REQUIRED)

Docker Desktop appears to be installed but not running.

### Start Docker Desktop:
1. Press Windows key
2. Search for "Docker Desktop"
3. Click to start
4. Wait for Docker to be ready (green whale icon in system tray)

### Verify Docker is Running:
```bash
docker --version
docker ps
```

If Docker is not installed, run this in PowerShell as Administrator:
```powershell
cd C:\Data\JubileeVerse.com
.\scripts\install-docker-windows.ps1
```

---

## Step 3: Automated Setup (RECOMMENDED)

Once Docker and Node.js are running, use the quick start script:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\quick-start.ps1
```

This will automatically:
- ✓ Check Docker status
- ✓ Create data directories
- ✓ Start PostgreSQL, Qdrant, and Redis containers
- ✓ Install npm dependencies
- ✓ Run database migrations
- ✓ Display ready-to-start summary

---

## Step 4: Manual Setup (If Quick Start Fails)

### 4.1 Create Data Directories
```powershell
New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse.com\.datastore\postgres"
New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse.com\.datastore\qdrant"
New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse.com\.datastore\redis"
```

### 4.2 Start Docker Containers
```bash
cd /c/Data/JubileeVerse.com
docker-compose -f docker-compose.production.yml up -d
```

Wait 10-15 seconds for containers to start, then verify:
```bash
docker ps --filter "name=JubileeVerse"
```

You should see three containers running:
- `JubileeVerse-postgres`
- `JubileeVerse-qdrant`
- `JubileeVerse-redis`

### 4.3 Install Node.js Dependencies
```bash
npm install
```

### 4.4 Run Database Migrations
```bash
npm run db:setup
```

This creates all 92 database tables in the `JubileeVerse` database.

### 4.5 Verify Database
```bash
docker exec JubileeVerse-postgres psql -U guardian -d JubileeVerse -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

Should return a count > 50 (the number of tables created).

---

## Step 5: Start the Application

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

---

## Step 6: Verify Everything Works

### Check Application
Open browser: http://localhost:3000

### Check Qdrant Dashboard
Open browser: http://localhost:6333/dashboard

### Check Database Connection
```bash
docker exec JubileeVerse-postgres psql -U guardian -d JubileeVerse -c "\dt"
```

### Check Redis
```bash
docker exec JubileeVerse-redis redis-cli ping
```

Should return: `PONG`

### Check Container Logs
```bash
docker-compose -f docker-compose.production.yml logs -f
```

Press Ctrl+C to exit logs.

---

## Common Issues and Solutions

### Issue: "docker: command not found"
**Solution**:
1. Start Docker Desktop
2. Wait for it to fully load
3. Restart your terminal
4. Try again

### Issue: "node: command not found"
**Solution**:
1. Install Node.js from https://nodejs.org/
2. Ensure "Add to PATH" is selected
3. Restart terminal
4. Run: `node --version`

### Issue: Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :5432
netstat -ano | findstr :6333
netstat -ano | findstr :6379
netstat -ano | findstr :3000

# Stop the process or change the port in .env
```

### Issue: Docker Containers Won't Start
```bash
# Check logs
docker logs JubileeVerse-postgres
docker logs JubileeVerse-qdrant
docker logs JubileeVerse-redis

# Remove and recreate
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Issue: Database Migrations Fail
```bash
# Check if database exists
docker exec JubileeVerse-postgres psql -U guardian -l

# If database doesn't exist, create it
docker exec JubileeVerse-postgres psql -U guardian -c "CREATE DATABASE JubileeVerse;"

# Try migrations again
npm run db:setup
```

---

## Production Checklist

- [ ] Node.js installed and in PATH
- [ ] Docker Desktop running
- [ ] Three containers running (postgres, qdrant, redis)
- [ ] npm dependencies installed
- [ ] Database migrations completed
- [ ] Application starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can access http://localhost:6333/dashboard (Qdrant)

---

## Quick Commands Reference

```bash
# Start containers
docker-compose -f docker-compose.production.yml up -d

# Stop containers
docker-compose -f docker-compose.production.yml stop

# View container status
docker ps --filter "name=JubileeVerse"

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Restart containers
docker-compose -f docker-compose.production.yml restart

# Database backup
docker exec JubileeVerse-postgres pg_dump -U guardian JubileeVerse > backup.sql

# Connect to PostgreSQL
docker exec -it JubileeVerse-postgres psql -U guardian -d JubileeVerse

# Connect to Redis
docker exec -it JubileeVerse-redis redis-cli

# Start application
npm start

# Start with auto-reload
npm run dev

# Run tests
npm test
```

---

## Next Steps After Installation

1. **Review Configuration**: Check [.env](.env) file for any settings you want to change
2. **Create Admin User**: Access the application and register the first admin account
3. **Load Persona Data**: Check if persona data needs to be seeded
4. **Configure Monitoring**: Set up Prometheus/Grafana if needed
5. **Set Up Backups**: Create a backup schedule for the database
6. **Review Security**: Update SESSION_SECRET in production
7. **Configure Firewall**: If accessing from other machines, open ports

---

## Support Files

- **Full Setup Guide**: [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)
- **Project README**: [README.md](README.md)
- **Architecture**: [help/01-ARCHITECTURE.md](help/01-ARCHITECTURE.md)
- **Troubleshooting**: See PRODUCTION_SETUP.md

---

**Server**: solarwinding (10.0.0.4)
**Status**: Ready for installation
**Next**: Install Node.js and start Docker Desktop
