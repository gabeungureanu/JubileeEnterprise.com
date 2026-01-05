Import-Module WebAdministration

Write-Host "Configuring IIS for JubileeVerse..." -ForegroundColor Cyan

# Site configuration
$siteName = "JubileeVerse"
$physicalPath = "C:\Data\JubileeVerse.com"
$appPoolName = "JubileeVerseAppPool"

# Check if site already exists
$existingSite = Get-Website -Name $siteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Host "Site already exists, removing..." -ForegroundColor Yellow
    Remove-Website -Name $siteName
}

# Check if app pool exists, create if not
$existingAppPool = Get-WebAppPoolState -Name $appPoolName -ErrorAction SilentlyContinue
if (-not $existingAppPool) {
    Write-Host "Creating Application Pool..." -ForegroundColor Cyan
    New-WebAppPool -Name $appPoolName
}

# Configure application pool for Node.js
Write-Host "Configuring Application Pool..." -ForegroundColor Cyan
Set-ItemProperty IIS:\AppPools\$appPoolName -Name managedRuntimeVersion -Value ""
Set-ItemProperty IIS:\AppPools\$appPoolName -Name enable32BitAppOnWin64 -Value $false
Set-ItemProperty IIS:\AppPools\$appPoolName -Name processModel.identityType -Value 0

# Create new website
Write-Host "Creating IIS website..." -ForegroundColor Cyan
New-Website -Name $siteName `
    -PhysicalPath $physicalPath `
    -Port 80 `
    -HostHeader "www.jubileeverse.com" `
    -ApplicationPool $appPoolName

# Add localhost binding for testing
Write-Host "Adding localhost binding..." -ForegroundColor Cyan
New-WebBinding -Name $siteName -IPAddress "*" -Port 80 -HostHeader "localhost" -ErrorAction SilentlyContinue

# Add binding without host header (for IP access)
New-WebBinding -Name $siteName -IPAddress "*" -Port 80 -HostHeader "" -ErrorAction SilentlyContinue

# Set permissions on the application folder
Write-Host "Setting folder permissions..." -ForegroundColor Cyan
$acl = Get-Acl $physicalPath
$permission = "IIS_IUSRS","Read,ReadAndExecute,ListDirectory","ContainerInherit,ObjectInherit","None","Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
Set-Acl $physicalPath $acl

# Also give permissions to IUSR
$permission2 = "IUSR","Read,ReadAndExecute,ListDirectory","ContainerInherit,ObjectInherit","None","Allow"
$accessRule2 = New-Object System.Security.AccessControl.FileSystemAccessRule $permission2
$acl.SetAccessRule($accessRule2)
Set-Acl $physicalPath $acl

Write-Host ""
Write-Host "✓ IIS website configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Site bindings:" -ForegroundColor Cyan
Get-WebBinding -Name $siteName | Select-Object protocol,bindingInformation

Write-Host ""
Write-Host "IIS Configuration Complete!" -ForegroundColor Green
Write-Host "You can now test the website by visiting:" -ForegroundColor Cyan
Write-Host "  - http://localhost" -ForegroundColor White
Write-Host "  - http://www.jubileeverse.com (if DNS is configured)" -ForegroundColor White
