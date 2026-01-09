$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = [Environment]::GetFolderPath('Startup')
$Shortcut = $WshShell.CreateShortcut("$StartupFolder\PM2-Jubilee.lnk")
$Shortcut.TargetPath = "C:\data\JubileeEnterprise.com\scripts\start-pm2.bat"
$Shortcut.WorkingDirectory = "C:\data\JubileeEnterprise.com"
$Shortcut.Save()
Write-Host "Startup shortcut created at: $StartupFolder\PM2-Jubilee.lnk"
