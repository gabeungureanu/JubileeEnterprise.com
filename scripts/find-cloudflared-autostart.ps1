# Find what's auto-starting cloudflared
Write-Host "=== Checking Scheduled Tasks ==="
Get-ScheduledTask | Where-Object { $_.TaskName -like '*cloud*' -or $_.TaskPath -like '*cloud*' } | ForEach-Object {
    Write-Host "Task: $($_.TaskName) - State: $($_.State)"
    Disable-ScheduledTask -TaskName $_.TaskName -ErrorAction SilentlyContinue
    Write-Host "  Disabled task"
}

Write-Host "`n=== Checking Services ==="
Get-Service | Where-Object { $_.DisplayName -like '*cloud*' -or $_.Name -like '*cloud*' } | ForEach-Object {
    Write-Host "Service: $($_.Name) - Status: $($_.Status)"
    Stop-Service -Name $_.Name -Force -ErrorAction SilentlyContinue
    Set-Service -Name $_.Name -StartupType Disabled -ErrorAction SilentlyContinue
    Write-Host "  Stopped and disabled"
}

Write-Host "`n=== Killing cloudflared process ==="
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing PID: $($_.Id)"
    Stop-Process -Id $_.Id -Force
}

Write-Host "`n=== Checking startup registry ==="
$startupPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
)
foreach ($path in $startupPaths) {
    Get-ItemProperty -Path $path -ErrorAction SilentlyContinue | ForEach-Object {
        $_.PSObject.Properties | Where-Object { $_.Value -like '*cloudflared*' } | ForEach-Object {
            Write-Host "Found in registry: $($_.Name) = $($_.Value)"
        }
    }
}

Write-Host "`nDone!"
