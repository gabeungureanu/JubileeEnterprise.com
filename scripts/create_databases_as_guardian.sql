-- =====================================================
-- Create Databases for Jubilee Enterprise (as guardian user)
-- =====================================================
-- This script creates the inspire and continuum databases
-- The codex database already exists per the env configuration
-- Run this using the guardian user who has CREATEDB privileges
-- =====================================================

-- Note: If guardian user doesn't have CREATEDB privilege,
-- this script must be run by postgres superuser first to grant it.

-- Create Inspire database if it doesn't exist
SELECT 'CREATE DATABASE inspire'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'inspire')\gexec

-- Create Continuum database if it doesn't exist
SELECT 'CREATE DATABASE continuum'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'continuum')\gexec

-- Display results
\echo '====================================================='
\echo 'Database creation check completed!'
\echo '====================================================='
\echo 'Listing all databases:'
\l

\echo ''
\echo 'Next steps:'
\echo '1. Initialize codex database: psql -h localhost -U guardian -d codex -f scripts/setup_codex_db.sql'
\echo '2. Configure applications to use these databases'
\echo '====================================================='
