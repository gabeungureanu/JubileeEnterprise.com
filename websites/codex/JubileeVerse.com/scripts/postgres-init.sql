-- PostgreSQL Initialization Script for JubileeVerse Production
-- This script runs automatically when the container is first created

-- Create the database (if not already created by POSTGRES_DB env var)
-- The database should already exist from the environment variable

-- Set up extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE "JubileeVerse" TO guardian;

-- Connect to the database
\c JubileeVerse

-- Set timezone
SET timezone = 'UTC';

-- Create a schema for application data (optional - using public by default)
-- CREATE SCHEMA IF NOT EXISTS jubileeverse;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'JubileeVerse database initialized successfully';
    RAISE NOTICE 'Database: JubileeVerse';
    RAISE NOTICE 'User: guardian';
    RAISE NOTICE 'Extensions: uuid-ossp, pg_trgm';
END $$;
