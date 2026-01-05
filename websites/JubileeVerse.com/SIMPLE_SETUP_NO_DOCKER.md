# Simple Setup Without Docker

Since Docker installation on Windows Server 2019 is proving complex, here's an alternative approach:

## Option: Install Services Directly on Windows

Instead of using Docker containers, we can install PostgreSQL, Redis, and Qdrant directly on Windows Server 2019.

### 1. Install PostgreSQL

```powershell
# Download PostgreSQL 16
$pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.1-1-windows-x64.exe"
Invoke-WebRequest -Uri $pgUrl -OutFile "C:\Temp\postgresql-installer.exe"

# Run installer (GUI will open)
Start-Process "C:\Temp\postgresql-installer.exe"
```

**During installation:**
- Password: `askShaddai4e!`
- Port: `5432`
- Database: Create `JubileeVerse` after installation

### 2. Install Redis

```powershell
# Download Redis for Windows
$redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.2.100/Redis-x64-3.2.100.msi"
Invoke-WebRequest -Uri $redisUrl -OutFile "C:\Temp\Redis-installer.msi"

# Install
msiexec /i "C:\Temp\Redis-installer.msi" /quiet
```

### 3. Install Qdrant

```powershell
# Download Qdrant Windows binary
$qdrantUrl = "https://github.com/qdrant/qdrant/releases/download/v1.7.0/qdrant-x86_64-pc-windows-msvc.zip"
Invoke-WebRequest -Uri $qdrantUrl -OutFile "C:\Temp\qdrant.zip"

# Extract
Expand-Archive -Path "C:\Temp\qdrant.zip" -DestinationPath "C:\Program Files\Qdrant"

# Run Qdrant
cd "C:\Program Files\Qdrant"
.\qdrant.exe
```

### 4. Update .env File

No changes needed! The .env is already configured for localhost.

### 5. Run Application

```powershell
cd C:\Data\JubileeVerse.com
npm install
npm run db:setup
npm start
```

---

## Recommendation

Given the Docker complexities on Windows Server 2019, I recommend either:

1. **Use cloud-hosted databases** (simplest):
   - PostgreSQL: AWS RDS, Azure Database
   - Redis: AWS ElastiCache, Azure Cache
   - Qdrant: Qdrant Cloud

2. **Install services directly** (as above)

3. **Continue troubleshooting Docker/WSL2** (most complex)

Which approach would you prefer?
