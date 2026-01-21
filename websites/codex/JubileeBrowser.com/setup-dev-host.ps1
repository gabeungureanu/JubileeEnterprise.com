# =====================================================
# Setup dev.jubileebrowser.com Local Development
# =====================================================
# Run this script as Administrator to configure hosts file
# =====================================================

Write-Host "`n=====================================================`n" -ForegroundColor Cyan
Write-Host "Setting up dev.jubileebrowser.com`n" -ForegroundColor Cyan
Write-Host "=====================================================`n" -ForegroundColor Cyan

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostname = "dev.jubileebrowser.com"
$ip = "127.0.0.1"
$entry = "$ip`t$hostname"

# Check if entry already exists
$hostsContent = Get-Content $hostsPath -ErrorAction SilentlyContinue
if ($hostsContent -match $hostname) {
    Write-Host "✓ $hostname already exists in hosts file" -ForegroundColor Green
} else {
    Write-Host "Adding $hostname to hosts file..." -ForegroundColor Yellow
    try {
        Add-Content -Path $hostsPath -Value "`n$entry" -Force
        Write-Host "✓ Successfully added $hostname to hosts file" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to modify hosts file: $_" -ForegroundColor Red
        Write-Host "Please run this script as Administrator" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n=====================================================`n" -ForegroundColor Cyan
Write-Host "Setup Complete!`n" -ForegroundColor Green
Write-Host "You can now access the site at: http://dev.jubileebrowser.com:3200`n" -ForegroundColor White
Write-Host "=====================================================`n" -ForegroundColor Cyan
