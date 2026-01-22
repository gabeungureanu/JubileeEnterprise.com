-- JubileeOutlook Local Cache Database Setup
-- Run this script as postgres superuser
-- psql -U postgres -h localhost -f create_database.sql

-- Check if database exists and create if not
SELECT 'Creating database jubilee_outlook_cache...' AS status;

-- Create the database (run this separately if it fails due to existing database)
CREATE DATABASE jubilee_outlook_cache
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'English_United States.1252'
    LC_CTYPE = 'English_United States.1252'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Create user if not exists (using 'jubilee' user for consistency with other Jubilee databases)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'jubilee') THEN
        CREATE USER jubilee WITH PASSWORD 'Pass@123';
        RAISE NOTICE 'User jubilee created';
    ELSE
        -- Update password if user exists
        ALTER USER jubilee WITH PASSWORD 'Pass@123';
        RAISE NOTICE 'User jubilee password updated';
    END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE jubilee_outlook_cache TO jubilee;

-- Connect to the new database and grant schema privileges
\c jubilee_outlook_cache

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO jubilee;
GRANT CREATE ON SCHEMA public TO jubilee;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO jubilee;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO jubilee;

SELECT 'Database setup complete!' AS status;
