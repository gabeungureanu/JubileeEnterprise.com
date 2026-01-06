# Create JubileeVerse Database and User

Write-Host "Creating JubileeVerse database..." -ForegroundColor Cyan

# Set the password (you may need to adjust this based on your installation)
$env:PGPASSWORD = "askShaddai4e!"

$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

# Create database
Write-Host "Creating database..." -ForegroundColor Yellow
& $psqlPath -U postgres -c "CREATE DATABASE JubileeVerse;" 2>&1

# Create user
Write-Host "Creating guardian user..." -ForegroundColor Yellow
& $psqlPath -U postgres -c "CREATE USER guardian WITH PASSWORD 'askShaddai4e!';" 2>&1

# Grant privileges
Write-Host "Granting privileges..." -ForegroundColor Yellow
& $psqlPath -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE JubileeVerse TO guardian;" 2>&1
& $psqlPath -U postgres -d JubileeVerse -c "GRANT ALL ON SCHEMA public TO guardian;" 2>&1

# Verify
Write-Host ""
Write-Host "Verifying database creation..." -ForegroundColor Cyan
& $psqlPath -U postgres -l | Select-String "JubileeVerse"

Write-Host ""
Write-Host "Database setup complete!" -ForegroundColor Green
