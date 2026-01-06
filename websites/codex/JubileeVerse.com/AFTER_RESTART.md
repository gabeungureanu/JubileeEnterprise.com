# After Restart - Continue WSL2 Setup

## ✅ Completed Before Restart

1. ✓ Enabled WSL feature
2. ✓ Enabled Virtual Machine Platform
3. ✓ Installed WSL2 kernel update

**Server needs to restart to complete these installations.**

---

## 🚀 Next Steps After Restart

### Step 1: Verify WSL2 Installation

Open PowerShell and run:

```powershell
wsl --status
```

You should see WSL2 information. If you see "command not found", wait a few minutes and try again.

### Step 2: Set WSL2 as Default Version

```powershell
wsl --set-default-version 2
```

### Step 3: Install Ubuntu 22.04

```powershell
cd C:\Data\JubileeVerse.com
powershell.exe -ExecutionPolicy Bypass -File scripts/install-ubuntu.ps1
```

Or manually:
```powershell
# Download Ubuntu
Invoke-WebRequest -Uri https://aka.ms/wslubuntu2204 -OutFile Ubuntu.appx -UseBasicParsing

# Install
Add-AppxPackage Ubuntu.appx

# Launch Ubuntu for first-time setup
ubuntu2204.exe
```

**IMPORTANT**: When Ubuntu opens:
- Create a username (lowercase, no spaces)
- Create a password
- Remember these credentials!

### Step 4: Install Docker in Ubuntu

```powershell
cd C:\Data\JubileeVerse.com
powershell.exe -ExecutionPolicy Bypass -File scripts/install-docker-in-wsl.ps1
```

### Step 5: Start Containers

```powershell
cd C:\Data\JubileeVerse.com
.\scripts\setup-wsl-docker-containers.ps1
```

### Step 6: Complete Application Setup

```powershell
npm install
npm run db:setup
npm start
```

Then visit: http://localhost:3000

---

## Quick One-Liner (After Restart)

```powershell
cd C:\Data\JubileeVerse.com; wsl --set-default-version 2; .\scripts\install-ubuntu.ps1; .\scripts\install-docker-in-wsl.ps1; .\scripts\setup-wsl-docker-containers.ps1; npm install; npm run db:setup; npm start
```

---

## ⚠️ Restart Now

To restart the server:

```powershell
Restart-Computer -Force
```

Or manually restart from the Start menu.

---

**After restart, open PowerShell as Administrator and continue with Step 1 above.**
