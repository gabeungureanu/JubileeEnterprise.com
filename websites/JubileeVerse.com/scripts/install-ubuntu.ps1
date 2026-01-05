# Install Ubuntu 22.04 in WSL2

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Installing Ubuntu 22.04 for WSL2" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if WSL is available
try {
    wsl --status | Out-Null
    Write-Host "✓ WSL is available" -ForegroundColor Green
} catch {
    Write-Host "✗ WSL is not available" -ForegroundColor Red
    Write-Host "The system may need another restart" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Set WSL2 as default
Write-Host "Setting WSL2 as default version..." -ForegroundColor Cyan
wsl --set-default-version 2
Write-Host ""

# Check if Ubuntu is already installed
$ubuntuInstalled = wsl -l -q 2>&1 | Select-String -Pattern "Ubuntu"

if ($ubuntuInstalled) {
    Write-Host "✓ Ubuntu is already installed" -ForegroundColor Green
    wsl -l -v
} else {
    Write-Host "Downloading Ubuntu 22.04..." -ForegroundColor Cyan
    $ubuntuPath = "$env:TEMP\Ubuntu2204.appx"
    $ubuntuUrl = "https://aka.ms/wslubuntu2204"

    try {
        Invoke-WebRequest -Uri $ubuntuUrl -OutFile $ubuntuPath -UseBasicParsing
        Write-Host "✓ Downloaded" -ForegroundColor Green

        Write-Host ""
        Write-Host "Installing Ubuntu..." -ForegroundColor Cyan
        Add-AppxPackage -Path $ubuntuPath
        Remove-Item $ubuntuPath -ErrorAction SilentlyContinue
        Write-Host "✓ Ubuntu installed" -ForegroundColor Green

        Write-Host ""
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "  IMPORTANT: Ubuntu First-Time Setup" -ForegroundColor Yellow
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Ubuntu will now open for first-time setup." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please:" -ForegroundColor Cyan
        Write-Host "  1. Create a username (lowercase, no spaces)" -ForegroundColor White
        Write-Host "  2. Create a password" -ForegroundColor White
        Write-Host "  3. Remember these credentials!" -ForegroundColor White
        Write-Host ""
        Write-Host "Press any key to launch Ubuntu..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        # Launch Ubuntu
        Start-Process "ubuntu2204.exe"

        Write-Host ""
        Write-Host "Waiting for Ubuntu setup..." -ForegroundColor Cyan
        Write-Host "Press any key after you've completed the setup in Ubuntu..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        Write-Host ""
        Write-Host "✓ Ubuntu setup complete" -ForegroundColor Green

    } catch {
        Write-Host "✗ Ubuntu installation failed" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Manual steps:" -ForegroundColor Yellow
        Write-Host "  1. Open Microsoft Store" -ForegroundColor White
        Write-Host "  2. Search for 'Ubuntu 22.04'" -ForegroundColor White
        Write-Host "  3. Click Install" -ForegroundColor White
        Write-Host "  4. Launch and create user" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "Installed WSL distributions:" -ForegroundColor Cyan
wsl -l -v
Write-Host ""
Write-Host "✓ Ubuntu is ready for Docker installation" -ForegroundColor Green
Write-Host ""
