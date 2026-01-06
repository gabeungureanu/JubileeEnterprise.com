-- ============================================
-- JubileeVerse Database Schema
-- Migration 078a: Add new collection types
-- ============================================

-- Add new collection types to the enum (skip if already exists)
DO $$ BEGIN
    -- Check and add each value one at a time
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'prompts' AND enumtypid = 'collection_type'::regtype) THEN
        ALTER TYPE collection_type ADD VALUE 'prompts';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'resources' AND enumtypid = 'collection_type'::regtype) THEN
        ALTER TYPE collection_type ADD VALUE 'resources';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'marketing' AND enumtypid = 'collection_type'::regtype) THEN
        ALTER TYPE collection_type ADD VALUE 'marketing';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'country' AND enumtypid = 'collection_type'::regtype) THEN
        ALTER TYPE collection_type ADD VALUE 'country';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'orchestration' AND enumtypid = 'collection_type'::regtype) THEN
        ALTER TYPE collection_type ADD VALUE 'orchestration';
    END IF;
END $$;
