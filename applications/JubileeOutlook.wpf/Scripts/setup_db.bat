@echo off
set PGPASSWORD=Pass@123
set PGBIN=C:\Program Files\PostgreSQL\16\bin

echo Checking if database exists...
"%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -t -c "SELECT 1 FROM pg_database WHERE datname = 'jubilee_outlook_cache';" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Database jubilee_outlook_cache already exists.
) else (
    echo Creating database jubilee_outlook_cache...
    "%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE DATABASE jubilee_outlook_cache;"
)

echo Checking if user exists...
"%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -t -c "SELECT 1 FROM pg_roles WHERE rolname = 'jubilee_user';" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo User jubilee_user already exists. Updating password...
    "%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -c "ALTER USER jubilee_user WITH PASSWORD 'Pass@123';"
) else (
    echo Creating user jubilee_user...
    "%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE USER jubilee_user WITH PASSWORD 'Pass@123';"
)

echo Granting privileges...
"%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -c "GRANT ALL PRIVILEGES ON DATABASE jubilee_outlook_cache TO jubilee_user;"
"%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "GRANT USAGE ON SCHEMA public TO jubilee_user;"
"%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "GRANT CREATE ON SCHEMA public TO jubilee_user;"
"%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO jubilee_user;"
"%PGBIN%\psql.exe" -U postgres -h localhost -p 5432 -d jubilee_outlook_cache -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO jubilee_user;"

echo.
echo Testing connection as jubilee_user...
set PGPASSWORD=Pass@123
"%PGBIN%\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT current_user, current_database();"

echo.
echo Creating cache schema tables...
"%PGBIN%\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -f "%~dp0create_cache_schema.sql"

echo.
echo Verifying tables created...
"%PGBIN%\psql.exe" -U jubilee_user -h localhost -p 5432 -d jubilee_outlook_cache -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

echo.
echo Setup complete!
