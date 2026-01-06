# Manual Installation Guide - JubileeVerse Services

**Server**: solarwinding (10.0.0.4)
**All installers are ready at**: `C:\Temp\`

---

## Current Status

✅ **Downloaded and Ready**:
- PostgreSQL 16 installer: `C:\Temp\postgresql-installer.exe` (282 MB)
- Redis installer: `C:\Temp\Redis-installer.msi` (6.8 MB)
- Qdrant binary: `C:\Temp\qdrant.zip` (21 MB)

---

## Step-by-Step Installation

### Step 1: Install PostgreSQL (5 minutes)

1. **Run the installer**:
   ```
   Double-click: C:\Temp\postgresql-installer.exe
   ```

2. **Installation settings**:
   - **Password**: `askShaddai4e!`
   - **Port**: `5432` (default)
   - **Locale**: Default
   - Components: Select all
   - Launch Stack Builder: **NO** (uncheck)

3. **Create Database**:
   After installation, open PowerShell and run:
   ```powershell
   $env:PGPASSWORD="askShaddai4e!"
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE JubileeVerse;"
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER guardian WITH PASSWORD 'askShaddai4e!';"
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE JubileeVerse TO guardian;"
   ```

4. **Verify**:
   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -l
   ```
   You should see `JubileeVerse` in the list.

---

### Step 2: Install Redis (2 minutes)

1. **Run the installer**:
   ```
   Double-click: C:\Temp\Redis-installer.msi
   ```

2. **Installation settings**:
   - Accept defaults
   - Install for all users
   - Add to PATH: **YES**
   - Install as Windows Service: **YES**

3. **Verify**:
   ```powershell
   Get-Service Redis
   ```
   Should show "Running"

---

### Step 3: Setup Qdrant (3 minutes)

1. **Extract the zip file**:
   ```powershell
   Expand-Archive -Path "C:\Temp\qdrant.zip" -DestinationPath "C:\Program Files\Qdrant" -Force
   ```

2. **Create data directory**:
   ```powershell
   New-Item -ItemType Directory -Force -Path "C:\Data\JubileeVerse\.datastore\qdrant"
   ```

3. **Start Qdrant** (in a separate PowerShell window):
   ```powershell
   cd "C:\Program Files\Qdrant"
   .\qdrant.exe
   ```

   Keep this window open! Qdrant will run here.

4. **Verify** (in another PowerShell window):
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:6333/health"
   ```
   Should return status 200.

---

## Step 4: Install Application Dependencies (3 minutes)

```powershell
cd C:\Data\JubileeVerse.com
npm install
```

---

## Step 5: Run Database Migrations (1 minute)

```powershell
npm run db:setup
```

This will create all 92 database tables.

---

## Step 6: Start the Application

```powershell
npm start
```

Then visit: **http://localhost:3000**

---

## Verification Checklist

- [ ] PostgreSQL installed and running on port 5432
- [ ] JubileeVerse database created
- [ ] guardian user created with permissions
- [ ] Redis installed and service running on port 6379
- [ ] Qdrant running on port 6333
- [ ] npm dependencies installed
- [ ] Database migrations completed (92 migrations)
- [ ] Application starts without errors
- [ ] Can access http://localhost:3000

---

## Service Management

### PostgreSQL
```powershell
# Start
Start-Service postgresql-x64-16

# Stop
Stop-Service postgresql-x64-16

# Status
Get-Service postgresql-x64-16
```

### Redis
```powershell
# Start
Start-Service Redis

# Stop
Stop-Service Redis

# Status
Get-Service Redis
```

### Qdrant
```powershell
# Start (must be run manually in a window)
cd "C:\Program Files\Qdrant"
.\qdrant.exe

# Or run in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Program Files\Qdrant'; .\qdrant.exe"
```

---

## Quick Start Script (After Manual Installation)

Save this as `start-jubileeverse.ps1`:

```powershell
# Start all services
Write-Host "Starting JubileeVerse services..." -ForegroundColor Cyan

# Start PostgreSQL
Start-Service postgresql-x64-16 -ErrorAction SilentlyContinue

# Start Redis
Start-Service Redis -ErrorAction SilentlyContinue

# Start Qdrant in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Program Files\Qdrant'; .\qdrant.exe"

# Wait for services to be ready
Start-Sleep -Seconds 5

# Start application
cd C:\Data\JubileeVerse.com
npm start
```

---

## Troubleshooting

### PostgreSQL won't start
```powershell
# Check service
Get-Service postgresql-x64-16

# View logs
Get-Content "C:\PostgreSQL\16\data\pg_log\*.log" -Tail 50
```

### Redis won't start
```powershell
# Check service
Get-Service Redis

# Reinstall if needed
msiexec /i C:\Temp\Redis-installer.msi /quiet
```

### Qdrant won't start
```powershell
# Try running directly
cd "C:\Program Files\Qdrant"
.\qdrant.exe --help

# Check if port 6333 is in use
netstat -ano | findstr :6333
```

### Database migrations fail
```powershell
# Verify database exists
$env:PGPASSWORD="askShaddai4e!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -l

# Recreate database if needed
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS JubileeVerse;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE JubileeVerse;"

# Run migrations again
npm run db:setup
```

---

##Ready to Install?

1. Open PowerShell as Administrator
2. Follow Steps 1-3 above to install PostgreSQL, Redis, and Qdrant
3. Then run Steps 4-6 to set up the application

**Estimated total time**: 15-20 minutes

All installers are ready in `C:\Temp\` - just double-click to start!
