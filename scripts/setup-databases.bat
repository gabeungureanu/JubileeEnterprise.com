@echo off
REM Setup Jubilee Enterprise Databases
REM This batch file creates the databases and sets up the schema

set PGPASSWORD=askShaddai4e!
set PSQL="C:\Program Files\PostgreSQL\18\bin\psql.exe"

echo =====================================================
echo Creating Databases and Guardian User
echo =====================================================

%PSQL% -U postgres -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'guardian') THEN CREATE ROLE guardian WITH LOGIN PASSWORD 'askShaddai4e!'; END IF; END $$;"
%PSQL% -U postgres -c "ALTER ROLE guardian CREATEDB;"

%PSQL% -U postgres -c "DROP DATABASE IF EXISTS codex;"
%PSQL% -U postgres -c "CREATE DATABASE codex WITH OWNER = guardian ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8';"

%PSQL% -U postgres -c "DROP DATABASE IF EXISTS inspire;"
%PSQL% -U postgres -c "CREATE DATABASE inspire WITH OWNER = guardian ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8';"

%PSQL% -U postgres -c "DROP DATABASE IF EXISTS continuum;"
%PSQL% -U postgres -c "CREATE DATABASE continuum WITH OWNER = guardian ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8';"

%PSQL% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE codex TO guardian;"
%PSQL% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE inspire TO guardian;"
%PSQL% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE continuum TO guardian;"

echo.
echo =====================================================
echo Setting up Codex Database Schema
echo =====================================================

%PSQL% -U guardian -d codex -f "%~dp0setup_codex_db.sql"

echo.
echo =====================================================
echo Database setup complete!
echo =====================================================
echo.
echo Created databases:
echo   - codex (owner: guardian)
echo   - inspire (owner: guardian)
echo   - continuum (owner: guardian)
echo.
echo Guardian password: askShaddai4e!
echo.

set PGPASSWORD=
pause
