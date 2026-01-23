# Cloudflare DNS Configuration for ImpossibleHarvest.com
# Adds CNAME records pointing to the tunnel
#
# Usage:
#   1. Get your API token from https://dash.cloudflare.com/profile/api-tokens
#   2. Run: .\cloudflare-add-impossibleharvest-dns.ps1 -ApiToken "your_token_here"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiToken
)

$tunnelId = "c4c875e2-55a9-4ad7-a0e9-36c391229c0b"
$domain = "impossibleharvest.com"

$headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type" = "application/json"
}

Write-Host "=== Cloudflare DNS Configuration for $domain ===" -ForegroundColor Yellow
Write-Host ""

# Step 1: Get Zone ID
Write-Host "Getting Zone ID for $domain..." -ForegroundColor Cyan
try {
    $zoneResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=$domain" `
        -Headers $headers -Method Get -ErrorAction Stop

    if ($zoneResponse.result.Count -eq 0) {
        Write-Host "Zone not found for $domain. Make sure the domain is added to your Cloudflare account." -ForegroundColor Red
        exit 1
    }

    $zoneId = $zoneResponse.result[0].id
    Write-Host "  Zone ID: $zoneId" -ForegroundColor Green
}
catch {
    Write-Host "Error getting zone: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create/update root CNAME record
Write-Host ""
Write-Host "Adding CNAME record for @ (root)..." -ForegroundColor Cyan
try {
    $body = @{
        type = "CNAME"
        name = "@"
        content = "$tunnelId.cfargotunnel.com"
        proxied = $true
    } | ConvertTo-Json

    $createResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" `
        -Headers $headers -Method Post -Body $body -ErrorAction Stop

    if ($createResponse.success) {
        Write-Host "  Root CNAME created - SUCCESS" -ForegroundColor Green
    }
}
catch {
    if ($_.Exception.Message -match "already exists") {
        Write-Host "  Root record already exists (OK)" -ForegroundColor Yellow
    }
    else {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 3: Create www CNAME record
Write-Host ""
Write-Host "Adding CNAME record for www..." -ForegroundColor Cyan
try {
    $body = @{
        type = "CNAME"
        name = "www"
        content = "$tunnelId.cfargotunnel.com"
        proxied = $true
    } | ConvertTo-Json

    $createResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" `
        -Headers $headers -Method Post -Body $body -ErrorAction Stop

    if ($createResponse.success) {
        Write-Host "  www CNAME created - SUCCESS" -ForegroundColor Green
    }
}
catch {
    if ($_.Exception.Message -match "already exists") {
        Write-Host "  www record already exists (OK)" -ForegroundColor Yellow
    }
    else {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "DNS records configured to point to tunnel: $tunnelId" -ForegroundColor Gray
Write-Host "Changes may take a few minutes to propagate." -ForegroundColor Gray
Write-Host ""
Write-Host "Test with: curl https://$domain/health" -ForegroundColor Cyan
