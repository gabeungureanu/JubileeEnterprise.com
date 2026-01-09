# =====================================================
# Create Databases Script for Jubilee Enterprise
# =====================================================
# This script creates the codex, inspire, and continuum databases
# =====================================================

param(
    [string]$PostgresUser = "postgres",
    [string]$PostgresHost = "localhost",
    [int]$PostgresPort = 5432
)

Write-Host "=====================================================`n" -ForegroundColor Cyan
Write-Host "Creating Jubilee Enterprise Databases`n" -ForegroundColor Cyan
Write-Host "=====================================================`n" -ForegroundColor Cyan

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "create_databases.sql"

# Check if SQL file exists
if (-not (Test-Path $sqlFile)) {
    Write-Host "Error: SQL file not found at: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "Postgres User: $PostgresUser" -ForegroundColor Yellow
Write-Host "Postgres Host: $PostgresHost" -ForegroundColor Yellow
Write-Host "Postgres Port: $PostgresPort" -ForegroundColor Yellow
Write-Host ""

# Check if psql is available
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCommand) {
    Write-Host "Error: psql command not found in PATH" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL is installed and psql is in your PATH" -ForegroundColor Red
    Write-Host "Common PostgreSQL bin path: C:\Program Files\PostgreSQL\<version>\bin" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found psql at: $($psqlCommand.Source)" -ForegroundColor Green
Write-Host ""

# Prompt for password
Write-Host "Please enter the password for PostgreSQL user '$PostgresUser':" -ForegroundColor Yellow
$env:PGPASSWORD = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText

Write-Host "`nExecuting SQL script..." -ForegroundColor Cyan

# Execute the SQL script
try {
    & psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -f $sqlFile -v ON_ERROR_STOP=1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n=====================================================`n" -ForegroundColor Green
        Write-Host "SUCCESS! Databases created successfully!`n" -ForegroundColor Green
        Write-Host "=====================================================`n" -ForegroundColor Green
        Write-Host "Databases created:" -ForegroundColor Cyan
        Write-Host "  - codex (Owner: guardian)" -ForegroundColor White
        Write-Host "  - inspire (Owner: guardian)" -ForegroundColor White
        Write-Host "  - continuum (Owner: guardian)" -ForegroundColor White
        Write-Host "`nNext steps:" -ForegroundColor Cyan
        Write-Host "  1. Connect to codex database:" -ForegroundColor White
        Write-Host "     psql -h localhost -U guardian -d codex" -ForegroundColor Gray
        Write-Host "  2. Run the codex setup script:" -ForegroundColor White
        Write-Host "     \i scripts/setup_codex_db.sql" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "`nError: Failed to create databases (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "`nError executing SQL script: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear the password from environment
    $env:PGPASSWORD = $null
}
