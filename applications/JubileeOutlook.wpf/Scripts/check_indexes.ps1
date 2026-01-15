$env:PGPASSWORD = "Pass@123"
$PGBIN = "C:\Program Files\PostgreSQL\16\bin"
& "$PGBIN\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public';"
