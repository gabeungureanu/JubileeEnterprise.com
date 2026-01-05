-- ============================================
-- JubileeVerse Database Schema
-- Migration 031: Plan Feature Translations with Versioning
-- ============================================
-- This migration creates tables for storing translated plan features
-- with version tracking for automatic re-translation when content changes

-- Plan feature translations table
CREATE TABLE IF NOT EXISTS plan_feature_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES plan_features(id) ON DELETE CASCADE,
  language_code VARCHAR(10) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  content_version INTEGER NOT NULL DEFAULT 1,
  translated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feature_id, language_code)
);

-- Plan feature category translations table
CREATE TABLE IF NOT EXISTS plan_feature_category_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES plan_feature_categories(id) ON DELETE CASCADE,
  language_code VARCHAR(10) NOT NULL,
  name TEXT NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1,
  translated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category_id, language_code)
);

-- Plan page static content translations (headers, descriptions, buttons, etc.)
CREATE TABLE IF NOT EXISTS plan_page_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key VARCHAR(100) NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  content_value TEXT NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1,
  translated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_key, language_code)
);

-- Version tracking table for plan page content
CREATE TABLE IF NOT EXISTS plan_content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL, -- 'features', 'categories', 'static'
  current_version INTEGER NOT NULL DEFAULT 1,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_type)
);

-- Initialize version tracking
INSERT INTO plan_content_versions (content_type, current_version)
VALUES
  ('features', 1),
  ('categories', 1),
  ('static', 1)
ON CONFLICT (content_type) DO NOTHING;

-- Add content_version column to plan_features if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_features' AND column_name = 'content_version'
  ) THEN
    ALTER TABLE plan_features ADD COLUMN content_version INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add content_version column to plan_feature_categories if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_feature_categories' AND column_name = 'content_version'
  ) THEN
    ALTER TABLE plan_feature_categories ADD COLUMN content_version INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_plan_feature_translations_feature_lang
  ON plan_feature_translations(feature_id, language_code);

CREATE INDEX IF NOT EXISTS idx_plan_feature_category_translations_cat_lang
  ON plan_feature_category_translations(category_id, language_code);

CREATE INDEX IF NOT EXISTS idx_plan_page_translations_key_lang
  ON plan_page_translations(content_key, language_code);

-- Insert default static content keys (English originals)
INSERT INTO plan_page_translations (content_key, language_code, content_value, content_version)
VALUES
  ('page_title', 'en', 'Subscription Plans', 1),
  ('page_description', 'en', 'Whether you''re a passionate student of the Scriptures or a thriving faith-based business, we''ve got the perfect plan tailored just for you!', 1),
  ('free_plan_name', 'en', 'Free Plan', 1),
  ('free_plan_description', 'en', 'Try out the most advanced AI Bible personalities and get real answers.', 1),
  ('standard_plan_name', 'en', 'Standard Edition', 1),
  ('standard_plan_description', 'en', 'Resources for mentoring, group studies, and teaching.', 1),
  ('ministry_plan_name', 'en', 'Ministry Edition', 1),
  ('ministry_plan_description', 'en', 'Tools for churches, sermons, teams, and outreach.', 1),
  ('business_plan_name', 'en', 'Business Edition', 1),
  ('business_plan_description', 'en', 'AI-powered tools for faith-based organizations. (Business Coaching)', 1),
  ('per_month', 'en', 'per month', 1),
  ('per_year', 'en', 'per year', 1),
  ('get_started', 'en', 'GET STARTED', 1),
  ('recommended', 'en', 'RECOMMENDED', 1),
  ('two_months_free', 'en', '2 MONTHS FREE', 1),
  ('monthly', 'en', 'MONTHLY', 1),
  ('month', 'en', 'MONTH', 1),
  ('year', 'en', 'YEAR', 1),
  ('back', 'en', 'Back', 1)
ON CONFLICT (content_key, language_code) DO NOTHING;

-- Function to increment version when content changes
CREATE OR REPLACE FUNCTION increment_plan_feature_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_version := COALESCE(OLD.content_version, 0) + 1;
  NEW.updated_at := CURRENT_TIMESTAMP;

  -- Update the global version tracker
  UPDATE plan_content_versions
  SET current_version = current_version + 1,
      last_updated_at = CURRENT_TIMESTAMP
  WHERE content_type = 'features';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_plan_category_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_version := COALESCE(OLD.content_version, 0) + 1;
  NEW.updated_at := CURRENT_TIMESTAMP;

  -- Update the global version tracker
  UPDATE plan_content_versions
  SET current_version = current_version + 1,
      last_updated_at = CURRENT_TIMESTAMP
  WHERE content_type = 'categories';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop first if exists)
DROP TRIGGER IF EXISTS trigger_plan_feature_version ON plan_features;
CREATE TRIGGER trigger_plan_feature_version
  BEFORE UPDATE OF name, description ON plan_features
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.description IS DISTINCT FROM NEW.description)
  EXECUTE FUNCTION increment_plan_feature_version();

DROP TRIGGER IF EXISTS trigger_plan_category_version ON plan_feature_categories;
CREATE TRIGGER trigger_plan_category_version
  BEFORE UPDATE OF name ON plan_feature_categories
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION increment_plan_category_version();

-- Verify tables created
SELECT 'plan_feature_translations' as table_name, COUNT(*) as row_count FROM plan_feature_translations
UNION ALL
SELECT 'plan_feature_category_translations', COUNT(*) FROM plan_feature_category_translations
UNION ALL
SELECT 'plan_page_translations', COUNT(*) FROM plan_page_translations
UNION ALL
SELECT 'plan_content_versions', COUNT(*) FROM plan_content_versions;
