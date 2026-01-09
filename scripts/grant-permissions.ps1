# Grant guardian user permissions on codex database tables

$env:PGPASSWORD = "Pass@123"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "Granting permissions to guardian user..." -ForegroundColor Cyan

& $psql -U postgres -d codex -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO guardian;"
& $psql -U postgres -d codex -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO guardian;"
& $psql -U postgres -d codex -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO guardian;"
& $psql -U postgres -d codex -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO guardian;"

Write-Host "Permissions granted successfully!" -ForegroundColor Green

$env:PGPASSWORD = $null
