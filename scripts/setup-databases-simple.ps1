# Setup Jubilee Enterprise Databases
# This PowerShell script creates the databases and sets up the schema

$env:PGPASSWORD = "Pass@123"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Creating Databases and Guardian User" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# Create guardian role
& $psql -U postgres -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'guardian') THEN CREATE ROLE guardian WITH LOGIN PASSWORD 'askShaddai4e!'; END IF; END `$`$;"
& $psql -U postgres -c "ALTER ROLE guardian CREATEDB;"

# Create databases
& $psql -U postgres -c "DROP DATABASE IF EXISTS codex;"
& $psql -U postgres -c "CREATE DATABASE codex WITH OWNER = guardian ENCODING = 'UTF8';"

& $psql -U postgres -c "DROP DATABASE IF EXISTS inspire;"
& $psql -U postgres -c "CREATE DATABASE inspire WITH OWNER = guardian ENCODING = 'UTF8';"

& $psql -U postgres -c "DROP DATABASE IF EXISTS continuum;"
& $psql -U postgres -c "CREATE DATABASE continuum WITH OWNER = guardian ENCODING = 'UTF8';"

# Grant privileges
& $psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE codex TO guardian;"
& $psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE inspire TO guardian;"
& $psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE continuum TO guardian;"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Setting up Codex Database Schema" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# Setup codex schema using postgres user (guardian user already has ownership)
& $psql -U postgres -d codex -f "d:\data\JubileeEnterprise.com\scripts\setup_codex_db.sql"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "Database setup complete!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Created databases:"
Write-Host "  - codex (owner: guardian)"
Write-Host "  - inspire (owner: guardian)"
Write-Host "  - continuum (owner: guardian)"
Write-Host ""
Write-Host "Guardian password: askShaddai4e!"
Write-Host ""

$env:PGPASSWORD = $null
