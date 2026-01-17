$env:PGPASSWORD = "Pass@123"
$PGBIN = "C:\Program Files\PostgreSQL\16\bin"

Write-Host "=== JubileeOutlook Database Setup ===" -ForegroundColor Cyan

# Step 1: Check if database exists
Write-Host "`nChecking if database exists..." -ForegroundColor Yellow
$dbExists = & "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -t -c "SELECT 1 FROM pg_database WHERE datname = 'jubilee_outlook_cache';" 2>$null
if ($dbExists -match "1") {
    Write-Host "Database jubilee_outlook_cache already exists." -ForegroundColor Green
} else {
    Write-Host "Creating database jubilee_outlook_cache..." -ForegroundColor Yellow
    & "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE DATABASE jubilee_outlook_cache;"
    Write-Host "Database created." -ForegroundColor Green
}

# Step 2: Check if user exists
Write-Host "`nChecking if user exists..." -ForegroundColor Yellow
$userExists = & "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -t -c "SELECT 1 FROM pg_roles WHERE rolname = 'jubilee_user';" 2>$null
if ($userExists -match "1") {
    Write-Host "User jubilee_user already exists. Updating password..." -ForegroundColor Green
    & "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -c "ALTER USER jubilee_user WITH PASSWORD 'Pass@123';"
} else {
    Write-Host "Creating user jubilee_user..." -ForegroundColor Yellow
    & "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE USER jubilee_user WITH PASSWORD 'Pass@123';"
    Write-Host "User created." -ForegroundColor Green
}

# Step 3: Grant privileges
Write-Host "`nGranting privileges..." -ForegroundColor Yellow
& "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -c "GRANT ALL PRIVILEGES ON DATABASE jubilee_outlook_cache TO jubilee_user;"
& "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "GRANT USAGE ON SCHEMA public TO jubilee_user;"
& "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "GRANT CREATE ON SCHEMA public TO jubilee_user;"
& "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO jubilee_user;"
& "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO jubilee_user;"
Write-Host "Privileges granted." -ForegroundColor Green

# Step 4: Run schema script
Write-Host "`nCreating cache schema tables..." -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "create_cache_schema.sql"
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -f $scriptPath

# Step 5: Verify
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
Write-Host "`nTables created:" -ForegroundColor Yellow
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

Write-Host "`nSync states:" -ForegroundColor Yellow
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT entity_type, full_sync_required FROM sync_state ORDER BY entity_type;"

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
