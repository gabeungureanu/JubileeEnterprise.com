# =====================================================
# Verify Databases Script for Jubilee Enterprise
# =====================================================
# This script verifies that all required databases exist
# =====================================================

param(
    [string]$PostgresUser = "guardian",
    [string]$PostgresHost = "localhost",
    [int]$PostgresPort = 5432
)

Write-Host "`n=====================================================`n" -ForegroundColor Cyan
Write-Host "Verifying Jubilee Enterprise Databases`n" -ForegroundColor Cyan
Write-Host "=====================================================`n" -ForegroundColor Cyan

# Check if psql is available
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCommand) {
    Write-Host "Error: psql command not found in PATH" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL is installed and psql is in your PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Using psql: $($psqlCommand.Source)`n" -ForegroundColor Green

# Prompt for password
Write-Host "Please enter the password for PostgreSQL user '$PostgresUser':" -ForegroundColor Yellow
$password = Read-Host -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

Write-Host "`nChecking databases...`n" -ForegroundColor Cyan

$databases = @("codex", "inspire", "continuum")
$allExist = $true

foreach ($db in $databases) {
    Write-Host "Checking database: $db ... " -NoNewline

    $result = & psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='$db';" 2>&1

    if ($LASTEXITCODE -eq 0 -and $result -match "1") {
        Write-Host "✓ EXISTS" -ForegroundColor Green

        # Try to connect and check owner
        $owner = & psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -t -c "SELECT pg_catalog.pg_get_userbyid(d.datdba) FROM pg_catalog.pg_database d WHERE d.datname = '$db';" 2>&1
        if ($owner) {
            Write-Host "  Owner: $($owner.Trim())" -ForegroundColor Gray
        }
    } else {
        Write-Host "✗ NOT FOUND" -ForegroundColor Red
        $allExist = $false
    }
}

Write-Host "`n-----------------------------------------------------`n" -ForegroundColor Cyan

if ($allExist) {
    Write-Host "SUCCESS! All databases exist.`n" -ForegroundColor Green

    # Check if codex has been initialized
    Write-Host "Checking if codex database is initialized..." -ForegroundColor Cyan
    $tables = & psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d codex -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1

    if ($LASTEXITCODE -eq 0) {
        $tableCount = $tables.Trim()
        if ($tableCount -gt 0) {
            Write-Host "  Codex database has $tableCount table(s)" -ForegroundColor Green

            # List tables
            Write-Host "`n  Tables in codex:" -ForegroundColor Gray
            & psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d codex -c "\dt" 2>&1 | ForEach-Object {
                if ($_ -match "public \| (\w+)") {
                    Write-Host "    - $($matches[1])" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "  ⚠ Codex database is empty (no tables)" -ForegroundColor Yellow
            Write-Host "  Run: psql -h localhost -U guardian -d codex -f scripts\setup_codex_db.sql" -ForegroundColor Gray
        }
    }

    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  - If codex is not initialized, run: scripts\setup_codex_db.sql" -ForegroundColor White
    Write-Host "  - Configure your applications to use these databases" -ForegroundColor White
    Write-Host "  - Run any application-specific migrations" -ForegroundColor White
} else {
    Write-Host "ERROR: Some databases are missing!`n" -ForegroundColor Red
    Write-Host "Please run the create-databases script:" -ForegroundColor Yellow
    Write-Host "  .\scripts\create-databases.ps1`n" -ForegroundColor Gray
    exit 1
}

Write-Host "`n=====================================================`n" -ForegroundColor Cyan

# Clear the password from environment
$env:PGPASSWORD = $null
