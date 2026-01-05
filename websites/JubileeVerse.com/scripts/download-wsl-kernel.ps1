# Download WSL2 Kernel Update
$url = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
$output = "C:\Temp\wsl_update_x64.msi"

Write-Host "Downloading WSL2 kernel update..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "C:\Temp" | Out-Null
Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
Write-Host "Downloaded to: $output" -ForegroundColor Green

Write-Host "Installing WSL2 kernel..." -ForegroundColor Cyan
Start-Process msiexec.exe -Wait -ArgumentList "/i `"$output`" /quiet /norestart"
Write-Host "WSL2 kernel installed" -ForegroundColor Green
