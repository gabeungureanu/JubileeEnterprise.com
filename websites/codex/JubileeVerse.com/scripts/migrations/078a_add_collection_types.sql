-- ============================================
-- JubileeVerse Database Schema
-- Migration 078a: Add new collection types
-- ============================================

-- Add new collection types to the enum
ALTER TYPE collection_type ADD VALUE IF NOT EXISTS 'prompts';
ALTER TYPE collection_type ADD VALUE IF NOT EXISTS 'resources';
ALTER TYPE collection_type ADD VALUE IF NOT EXISTS 'marketing';
ALTER TYPE collection_type ADD VALUE IF NOT EXISTS 'country';
ALTER TYPE collection_type ADD VALUE IF NOT EXISTS 'orchestration';
