-- =====================================================
-- Create Databases for Jubilee Enterprise
-- =====================================================
-- This script creates the codex, inspire, and continuum databases
-- Run this as postgres superuser or a user with CREATEDB privilege
-- =====================================================

-- Create the guardian role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'guardian') THEN
        CREATE ROLE guardian WITH LOGIN PASSWORD 'askShaddai4e!';
    END IF;
END
$$;

-- Grant necessary privileges to guardian
ALTER ROLE guardian CREATEDB;

-- =====================================================
-- 1. CODEX DATABASE
-- =====================================================

-- Create Codex database
DROP DATABASE IF EXISTS codex;
CREATE DATABASE codex
    WITH
    OWNER = guardian
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE codex IS 'JubileeVerse and Codex applications database';

-- =====================================================
-- 2. INSPIRE DATABASE
-- =====================================================

-- Create Inspire database
DROP DATABASE IF EXISTS inspire;
CREATE DATABASE inspire
    WITH
    OWNER = guardian
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE inspire IS 'Inspire family applications database';

-- =====================================================
-- 3. CONTINUUM DATABASE
-- =====================================================

-- Create Continuum database
DROP DATABASE IF EXISTS continuum;
CREATE DATABASE continuum
    WITH
    OWNER = guardian
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE continuum IS 'Continuum applications database';

-- =====================================================
-- Grant all privileges to guardian
-- =====================================================

GRANT ALL PRIVILEGES ON DATABASE codex TO guardian;
GRANT ALL PRIVILEGES ON DATABASE inspire TO guardian;
GRANT ALL PRIVILEGES ON DATABASE continuum TO guardian;

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Databases created successfully!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Database: codex - Owner: guardian';
    RAISE NOTICE 'Database: inspire - Owner: guardian';
    RAISE NOTICE 'Database: continuum - Owner: guardian';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Connect to codex database and run: scripts/setup_codex_db.sql';
    RAISE NOTICE '2. Configure your applications to use these databases';
    RAISE NOTICE '=====================================================';
END
$$;
