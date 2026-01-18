' Run wwBibleweb fix as Administrator
Set objShell = CreateObject("Shell.Application")

' Run PowerShell with the reinstall script
objShell.ShellExecute "powershell.exe", "-NoProfile -ExecutionPolicy Bypass -Command ""& {" & _
    "$ErrorActionPreference = 'Continue'; " & _
    "Write-Host 'Stopping service...'; " & _
    "Stop-Service -Name 'wwbibleweb.exe' -Force -ErrorAction SilentlyContinue; " & _
    "Start-Sleep -Seconds 3; " & _
    "Write-Host 'Removing service...'; " & _
    "sc.exe delete 'wwbibleweb.exe'; " & _
    "Start-Sleep -Seconds 2; " & _
    "Write-Host 'Reinstalling service...'; " & _
    "Set-Location 'C:\data\JubileeEnterprise.com Bibleweb\websites\codex\wwBibleweb.com'; " & _
    "node install-service.js; " & _
    "Start-Sleep -Seconds 8; " & _
    "Write-Host 'Testing port 3116...'; " & _
    "$listener = Get-NetTCPConnection -LocalPort 3116 -ErrorAction SilentlyContinue; " & _
    "if ($listener) { Write-Host 'SUCCESS: Port 3116 is listening!' -ForegroundColor Green } " & _
    "else { Write-Host 'WAITING: Port not ready yet' -ForegroundColor Yellow }; " & _
    "Write-Host ''; " & _
    "Read-Host 'Press Enter to close'" & _
    "}""", "", "runas", 1

WScript.Quit
