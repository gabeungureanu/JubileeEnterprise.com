# JubileeVerse Production Setup Guide

## Deployment Options

This application supports two production deployment methods:

1. **IIS/IISNode Deployment** (Recommended for Windows Server)
   - See [IIS_PRODUCTION_DEPLOYMENT.md](IIS_PRODUCTION_DEPLOYMENT.md) for complete IIS setup guide
   - Includes IISNode configuration, URL rewrite rules, and troubleshooting
   - Domain: www.jubileeverse.com

2. **Docker/Standalone Deployment** (This document)
   - Uses Docker containers for PostgreSQL, Qdrant, and Redis
   - Runs Node.js application standalone or via PM2

## Server Information
- **Hostname**: solarwinding
- **IP Address**: 10.0.0.4
- **Subnet**: 10.0.0.0/24
- **OS**: Windows Server (MINGW64_NT-10.0-17763)

## Production Container Configuration

### Container Names
- **PostgreSQL**: `JubileeVerse-postgres`
- **Qdrant**: `JubileeVerse-qdrant`
- **Redis**: `JubileeVerse-redis`

### Database Details
- **PostgreSQL Database**: `JubileeVerse`
- **Database User**: `guardian`
- **Qdrant Collection**: `inspire_knowledge`

---

## Installation Steps

### Step 1: Install Docker (If Not Already Installed)

Run as Administrator in PowerShell:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\install-docker-windows.ps1
```

This script will:
- Install Chocolatey package manager
- Install Docker Desktop
- Verify installation

**Note**: You may need to restart your computer after Docker installation.

### Step 2: Start Docker Desktop

1. Open Docker Desktop from the Start Menu
2. Wait for Docker to fully start (whale icon in system tray)
3. Verify Docker is running:

```powershell
docker ps
```

### Step 3: Set Up Production Containers

Run in PowerShell:

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\setup-production-containers.ps1
```

This script will:
- Create data storage directories at `C:\Data\JubileeVerse\.datastore\`
- Start PostgreSQL, Qdrant, and Redis containers
- Run health checks
- Display connection information

### Step 4: Install Node.js Dependencies

```powershell
npm install
```

### Step 5: Run Database Migrations

```powershell
npm run db:setup
```

This will run all 92 migrations to create the complete database schema.

### Step 6: Start the Application

```powershell
npm start
```

Or for development with auto-reload:

```powershell
npm run dev
```

---

## Manual Docker Setup (Alternative)

If you prefer to set up manually without the PowerShell script:

```powershell
# Navigate to project directory
cd C:\Data\JubileeVerse.com

# Create data directories
New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse\.datastore\postgres"
New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse\.datastore\qdrant"
New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse\.datastore\redis"

# Start containers
docker-compose -f docker-compose.production.yml up -d

# View container status
docker ps --filter "name=JubileeVerse"

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

---

## Container Management

### View Running Containers
```powershell
docker ps --filter "name=JubileeVerse"
```

### View Container Logs
```powershell
# All containers
docker-compose -f docker-compose.production.yml logs -f

# Specific container
docker logs JubileeVerse-postgres -f
docker logs JubileeVerse-qdrant -f
docker logs JubileeVerse-redis -f
```

### Stop Containers
```powershell
docker-compose -f docker-compose.production.yml stop
```

### Start Containers
```powershell
docker-compose -f docker-compose.production.yml start
```

### Restart Containers
```powershell
docker-compose -f docker-compose.production.yml restart
```

### Stop and Remove Containers
```powershell
docker-compose -f docker-compose.production.yml down
```

**Note**: This does NOT delete your data. Data is persisted in `C:\Data\JubileeVerse\.datastore\`

---

## Database Access

### PostgreSQL

**Connect via Docker:**
```powershell
docker exec -it JubileeVerse-postgres psql -U guardian -d JubileeVerse
```

**Common PostgreSQL Commands:**
```sql
-- List all tables
\dt

-- Describe a table
\d users

-- List all databases
\l

-- Quit
\q
```

**Connect via External Tool:**
- Host: `localhost` (or `10.0.0.4` from other machines)
- Port: `5432`
- Database: `JubileeVerse`
- User: `guardian`
- Password: `askShaddai4e!`

### Qdrant

**Web Dashboard:**
- URL: http://localhost:6333/dashboard
- Or: http://10.0.0.4:6333/dashboard (from other machines)

**Health Check:**
```powershell
curl http://localhost:6333/health
```

**List Collections:**
```powershell
curl http://localhost:6333/collections
```

### Redis

**Connect via Docker:**
```powershell
docker exec -it JubileeVerse-redis redis-cli
```

**Common Redis Commands:**
```redis
# Test connection
PING

# List all keys
KEYS *

# Get a value
GET key_name

# View memory usage
INFO memory

# Exit
EXIT
```

---

## Data Storage Locations

All persistent data is stored in:
```
C:\Data\JubileeVerse\.datastore\
├── postgres\     # PostgreSQL database files
├── qdrant\       # Qdrant vector database files
└── redis\        # Redis AOF and RDB files
```

### Backup Recommendations

1. **PostgreSQL Backup:**
```powershell
docker exec JubileeVerse-postgres pg_dump -U guardian JubileeVerse > backup.sql
```

2. **Full Data Backup:**
```powershell
# Stop containers first
docker-compose -f docker-compose.production.yml stop

# Copy entire datastore
Copy-Item -Path "C:\Data\JubileeVerse\.datastore" -Destination "C:\Backups\JubileeVerse-backup-$(Get-Date -Format 'yyyy-MM-dd')" -Recurse

# Restart containers
docker-compose -f docker-compose.production.yml start
```

---

## Server Detection

The application automatically detects when it's running on the production server using:

- **Hostname**: `solarwinding`
- **IP Address**: `10.0.0.4`

This is implemented in `src/utils/serverDetection.js`:

```javascript
const { isProductionServer, getServerInfo } = require('./src/utils/serverDetection');

if (isProductionServer()) {
  console.log('Running on production server');
}

// Get full server details
const info = getServerInfo();
console.log(info);
```

---

## Troubleshooting

### Docker Not Starting

1. Ensure virtualization is enabled in BIOS
2. Enable Hyper-V or WSL2 in Windows Features
3. Restart computer
4. Check Docker Desktop logs

### Container Won't Start

```powershell
# View container logs
docker logs JubileeVerse-postgres

# Check if port is already in use
netstat -ano | findstr :5432
netstat -ano | findstr :6333
netstat -ano | findstr :6379
```

### Database Connection Failed

1. Verify container is running:
   ```powershell
   docker ps --filter "name=JubileeVerse-postgres"
   ```

2. Check container health:
   ```powershell
   docker inspect JubileeVerse-postgres --format='{{.State.Health.Status}}'
   ```

3. Test connection:
   ```powershell
   docker exec JubileeVerse-postgres pg_isready -U guardian -d JubileeVerse
   ```

### Qdrant Not Responding

1. Check if container is running
2. Wait 30 seconds after starting (initialization time)
3. Check logs: `docker logs JubileeVerse-qdrant`
4. Verify port: `netstat -ano | findstr :6333`

---

## Firewall Configuration

If accessing from other machines on the network:

```powershell
# Allow PostgreSQL
New-NetFirewallRule -DisplayName "PostgreSQL" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow

# Allow Qdrant
New-NetFirewallRule -DisplayName "Qdrant" -Direction Inbound -Protocol TCP -LocalPort 6333,6334 -Action Allow

# Allow Redis
New-NetFirewallRule -DisplayName "Redis" -Direction Inbound -Protocol TCP -LocalPort 6379 -Action Allow

# Allow Application
New-NetFirewallRule -DisplayName "JubileeVerse" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

---

## Environment Variables

All configuration is in `.env` file:

```env
# Database (updated to use production container)
DB_NAME=JubileeVerse
DB_HOST=localhost
DB_PORT=5432
DB_USER=guardian

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=inspire_knowledge

# Server
PORT=3000
HOST=0.0.0.0

# Environment
NODE_ENV=production
```

---

## Next Steps After Setup

1. **Run Migrations**: `npm run db:setup`
2. **Seed Data** (if needed): `npm run db:seed`
3. **Start Application**: `npm start`
4. **Access Application**: http://localhost:3000
5. **Access Qdrant Dashboard**: http://localhost:6333/dashboard
6. **Run Tests**: `npm test`

---

## Support

For issues or questions:
1. Check container logs: `docker-compose -f docker-compose.production.yml logs`
2. Review application logs: `logs/server.log`
3. Check health endpoints: http://localhost:3000/api/admin/health

---

## Quick Reference

| Service | Container Name | Port | Dashboard/CLI |
|---------|---------------|------|---------------|
| PostgreSQL | JubileeVerse-postgres | 5432 | `docker exec -it JubileeVerse-postgres psql -U guardian -d JubileeVerse` |
| Qdrant | JubileeVerse-qdrant | 6333/6334 | http://localhost:6333/dashboard |
| Redis | JubileeVerse-redis | 6379 | `docker exec -it JubileeVerse-redis redis-cli` |
| Application | - | 3000 | http://localhost:3000 |
