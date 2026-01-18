# Cloudflare SSL Mode Update Script
# Sets SSL/TLS encryption mode to "Flexible" for specified domains
#
# Usage:
#   1. Get your API token from https://dash.cloudflare.com/profile/api-tokens
#   2. Run: .\cloudflare-set-flexible-ssl.ps1 -ApiToken "your_token_here"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiToken
)

$domains = @(
    "jubileetunes.com",
    "jubileeverse.com",
    "jubileevideos.com",
    "jubileeapps.com",
    "jubileechat.com",
    "jubileeintelligence.com",
    "jubileeoutlook.com",
    "inspirewebspaces.com",
    "jubileeaive.com"
)

$headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type" = "application/json"
}

Write-Host "=== Cloudflare SSL Mode Update ===" -ForegroundColor Yellow
Write-Host ""

foreach ($domain in $domains) {
    Write-Host "Processing $domain..." -ForegroundColor Cyan

    # Step 1: Get Zone ID for the domain
    try {
        $zoneResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=$domain" `
            -Headers $headers -Method Get -ErrorAction Stop

        if ($zoneResponse.result.Count -eq 0) {
            Write-Host "  Zone not found for $domain" -ForegroundColor Red
            continue
        }

        $zoneId = $zoneResponse.result[0].id
        Write-Host "  Zone ID: $zoneId" -ForegroundColor Gray

        # Step 2: Update SSL setting to Flexible
        $body = '{"value":"flexible"}'
        $sslResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/settings/ssl" `
            -Headers $headers -Method Patch -Body $body -ErrorAction Stop

        if ($sslResponse.success) {
            Write-Host "  SSL set to Flexible - SUCCESS" -ForegroundColor Green
        } else {
            Write-Host "  Failed: $($sslResponse.errors | ConvertTo-Json)" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "=== Complete ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: Changes may take a few minutes to propagate." -ForegroundColor Gray
