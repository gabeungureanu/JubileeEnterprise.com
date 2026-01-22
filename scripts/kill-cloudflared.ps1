# Kill Windows cloudflared process
$proc = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "Found cloudflared process: $($proc.Id)"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $check = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
    if ($check) {
        Write-Host "Failed to kill - needs admin privileges"
    } else {
        Write-Host "Successfully killed cloudflared"
    }
} else {
    Write-Host "No cloudflared process found"
}
