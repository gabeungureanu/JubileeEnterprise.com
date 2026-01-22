-- JubileeOutlook Contacts Schema Update
-- Adds additional contact fields for full Outlook contact support
-- Run this script to update the cached_contacts table
-- psql -U jubilee_user -h localhost -d jubilee_outlook_cache -f update_contacts_schema.sql

-- Add new columns to cached_contacts table
ALTER TABLE cached_contacts
ADD COLUMN IF NOT EXISTS mobile_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS anniversary DATE,
ADD COLUMN IF NOT EXISTS spouse VARCHAR(255),
ADD COLUMN IF NOT EXISTS website VARCHAR(500),
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Create index for favorites
CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON cached_contacts(is_favorite) WHERE is_favorite = TRUE;

-- Verification
SELECT 'Contacts schema update complete!' AS status;

-- Show updated columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cached_contacts'
ORDER BY ordinal_position;
