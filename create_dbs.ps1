$env:PGPASSWORD = "Pass@123"
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "Creating codex database..."
& $psqlPath -U postgres -c "CREATE DATABASE codex;"

Write-Host "Creating inspire database..."
& $psqlPath -U postgres -c "CREATE DATABASE inspire;"

Write-Host "Creating continuum database..."
& $psqlPath -U postgres -c "CREATE DATABASE continuum;"

Write-Host "All databases created successfully!"
