Import-Module WebAdministration

$siteName = "jubileeverse.com"
$newPath = "C:\Data\JubileeVerse.com"
$appPoolName = "JubileeVerseAppPool"

Write-Host "Updating $siteName to use Node.js application..." -ForegroundColor Cyan

# Stop the site
Write-Host "Stopping site..."
Stop-Website -Name $siteName

# Get current config
$site = Get-Website -Name $siteName
Write-Host "Current physical path: $($site.PhysicalPath)"

# Update physical path
Write-Host "Updating physical path to: $newPath"
Set-ItemProperty "IIS:\Sites\$siteName" -Name physicalPath -Value $newPath

# Update application pool
Write-Host "Setting application pool to: $appPoolName"
Set-ItemProperty "IIS:\Sites\$siteName" -Name applicationPool -Value $appPoolName

# Start the site
Write-Host "Starting site..."
Start-Website -Name $siteName

Write-Host ""
Write-Host "SUCCESS! Site updated and running" -ForegroundColor Green
Write-Host ""
Get-Website -Name $siteName | Select-Object Name,State,PhysicalPath,ApplicationPool
