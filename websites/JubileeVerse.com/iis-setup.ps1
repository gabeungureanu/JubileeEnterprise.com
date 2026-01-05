Import-Module WebAdministration

$siteName = "JubileeVerse"
$physicalPath = "C:\Data\JubileeVerse.com"
$appPoolName = "JubileeVerseAppPool"

Write-Host "Setting up IIS for JubileeVerse..."

# Remove existing site
$existingSite = Get-Website -Name $siteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Remove-Website -Name $siteName
    Write-Host "Removed existing site"
}

# Create or get app pool
$existingAppPool = Get-ChildItem IIS:\AppPools | Where-Object {$_.Name -eq $appPoolName}
if (-not $existingAppPool) {
    New-WebAppPool -Name $appPoolName
    Write-Host "Created app pool: $appPoolName"
}

# Configure app pool for Node.js (no managed code)
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ""
Write-Host "Configured app pool"

# Create website
New-Website -Name $siteName -PhysicalPath $physicalPath -Port 80 -HostHeader "www.jubileeverse.com" -ApplicationPool $appPoolName
Write-Host "Created website: $siteName"

# Add bindings
New-WebBinding -Name $siteName -Protocol http -Port 80 -HostHeader "localhost" -ErrorAction SilentlyContinue
New-WebBinding -Name $siteName -Protocol http -Port 80 -HostHeader "" -ErrorAction SilentlyContinue
Write-Host "Added bindings"

Write-Host ""
Write-Host "SUCCESS! IIS configured" -ForegroundColor Green
Write-Host "Site bindings:" -ForegroundColor Cyan
Get-WebBinding -Name $siteName | Format-Table protocol,bindingInformation
