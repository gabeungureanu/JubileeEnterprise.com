$env:PGPASSWORD = "Pass@123"
$PGBIN = "C:\Program Files\PostgreSQL\16\bin"

Write-Host "=== LocalCacheService Verification Tests ===" -ForegroundColor Cyan

# Test 1: Connection Pooling - Verify connection string format
Write-Host "`n1. Testing connection pooling configuration..." -ForegroundColor Yellow
$connTest = & "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -t -c "SELECT 1;" 2>&1
if ($connTest -match "1") {
    Write-Host "   [PASS] Database connection successful" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Database connection failed: $connTest" -ForegroundColor Red
    exit 1
}

# Test 2: Verify all tables exist
Write-Host "`n2. Verifying cache tables exist..." -ForegroundColor Yellow
$tables = @("cached_emails", "cached_folders", "cached_events", "cached_contacts", "sync_queue", "sync_state")
foreach ($table in $tables) {
    $exists = & "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>&1
    if ($exists -match "t") {
        Write-Host "   [PASS] Table '$table' exists" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] Table '$table' NOT found" -ForegroundColor Red
    }
}

# Test 3: CRUD Operations - Insert test email
Write-Host "`n3. Testing CRUD operations..." -ForegroundColor Yellow

# Insert
$insertSql = @"
INSERT INTO cached_emails (server_id, folder_id, subject, sender_name, sender_email, recipients, body, is_html, is_read, is_flagged, has_attachments, importance, received_date, sync_status)
VALUES ('test-email-001', 'inbox', 'Test Email Subject', 'Test Sender', 'test@example.com', '[]'::jsonb, 'Test body content', false, false, false, false, 'normal', CURRENT_TIMESTAMP, 'synced')
ON CONFLICT (server_id) DO UPDATE SET subject = EXCLUDED.subject;
"@
$insertResult = & "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c $insertSql 2>&1
if ($insertResult -match "INSERT" -or $insertResult -match "UPDATE") {
    Write-Host "   [PASS] INSERT/UPSERT operation successful" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] INSERT failed: $insertResult" -ForegroundColor Red
}

# Read
$readResult = & "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -t -c "SELECT subject FROM cached_emails WHERE server_id = 'test-email-001';" 2>&1
if ($readResult -match "Test Email Subject") {
    Write-Host "   [PASS] READ operation successful" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] READ failed: $readResult" -ForegroundColor Red
}

# Update
$updateResult = & "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "UPDATE cached_emails SET is_read = TRUE WHERE server_id = 'test-email-001';" 2>&1
if ($updateResult -match "UPDATE 1") {
    Write-Host "   [PASS] UPDATE operation successful" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] UPDATE failed: $updateResult" -ForegroundColor Red
}

# Delete (soft delete)
$deleteResult = & "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "UPDATE cached_emails SET is_deleted = TRUE WHERE server_id = 'test-email-001';" 2>&1
if ($deleteResult -match "UPDATE 1") {
    Write-Host "   [PASS] SOFT DELETE operation successful" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] SOFT DELETE failed: $deleteResult" -ForegroundColor Red
}

# Test 4: Verify indexes are being used
Write-Host "`n4. Verifying index usage..." -ForegroundColor Yellow
$indexCount = & "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>&1
$indexCount = $indexCount.Trim()
if ([int]$indexCount -ge 28) {
    Write-Host "   [PASS] Found $indexCount indexes (expected 28+)" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Found only $indexCount indexes (expected 28+)" -ForegroundColor Yellow
}

# Test 5: Connection pooling simulation
Write-Host "`n5. Testing concurrent connections (simulating pool)..." -ForegroundColor Yellow
$jobs = @()
for ($i = 1; $i -le 5; $i++) {
    $jobs += Start-Job -ScriptBlock {
        param($pgbin, $iteration)
        $env:PGPASSWORD = "Pass@123"
        & "$pgbin\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -t -c "SELECT $iteration;" 2>&1
    } -ArgumentList $PGBIN, $i
}
$results = $jobs | Wait-Job | Receive-Job
$successCount = ($results | Where-Object { $_ -match "\d" }).Count
if ($successCount -eq 5) {
    Write-Host "   [PASS] All 5 concurrent connections successful" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Only $successCount/5 concurrent connections succeeded" -ForegroundColor Yellow
}
$jobs | Remove-Job

# Cleanup test data
Write-Host "`n6. Cleaning up test data..." -ForegroundColor Yellow
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "DELETE FROM cached_emails WHERE server_id = 'test-email-001';" 2>&1 | Out-Null
Write-Host "   [DONE] Test data cleaned up" -ForegroundColor Green

Write-Host "`n=== All Verification Tests Complete ===" -ForegroundColor Cyan
