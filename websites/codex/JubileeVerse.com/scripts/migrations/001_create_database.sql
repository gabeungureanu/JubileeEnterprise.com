-- ============================================
-- JubileeVerse Database Creation Script
-- Migration 001: Create Database
-- ============================================

-- Create the database (run as superuser)
-- Note: This should be run separately before other migrations
-- CREATE DATABASE jubileeverse WITH ENCODING 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8';

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable citext for case-insensitive text
CREATE EXTENSION IF NOT EXISTS "citext";
