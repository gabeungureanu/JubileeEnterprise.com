$env:PGPASSWORD = "Pass@123"
$PGBIN = "C:\Program Files\PostgreSQL\16\bin"

Write-Host "=== Database Status Check ===" -ForegroundColor Cyan

# Check if database exists
Write-Host "`n1. Checking database..." -ForegroundColor Yellow
$dbCheck = & "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -t -c "SELECT datname FROM pg_database WHERE datname = 'jubilee_outlook_cache';" 2>$null
if ($dbCheck -match "jubilee_outlook_cache") {
    Write-Host "   [PASS] Database 'jubilee_outlook_cache' exists" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Database 'jubilee_outlook_cache' NOT found" -ForegroundColor Red
    exit
}

# Check if user exists
Write-Host "`n2. Checking user..." -ForegroundColor Yellow
$userCheck = & "$PGBIN\psql.exe" -U postgres -h localhost -p 5432 -t -c "SELECT rolname FROM pg_roles WHERE rolname = 'jubilee_user';" 2>$null
if ($userCheck -match "jubilee_user") {
    Write-Host "   [PASS] User 'jubilee_user' exists" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] User 'jubilee_user' NOT found" -ForegroundColor Red
}

# Check tables
Write-Host "`n3. Checking tables..." -ForegroundColor Yellow
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

# Check sync states
Write-Host "`n4. Checking sync states..." -ForegroundColor Yellow
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT entity_type, full_sync_required, last_sync_time FROM sync_state ORDER BY entity_type;"

# Check index count
Write-Host "`n5. Index summary..." -ForegroundColor Yellow
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT tablename, COUNT(*) as index_count FROM pg_indexes WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;"

Write-Host "`n=== Check Complete ===" -ForegroundColor Cyan
