-- ============================================
-- JubileeVerse Database Schema
-- Migration 029: Reorder Categories and Move Annual Bible Reading Plans
-- ============================================
-- 1. Move "Annual Bible Reading Plans" feature to Core Features category
-- 2. Reorder categories so Trust & Safety is right after Core Features

-- First, find the core-features category ID and move Annual Bible Reading Plans there
UPDATE plan_features
SET category_id = (SELECT id FROM plan_feature_categories WHERE slug = 'core-features')
WHERE slug = 'annual-reading-plans';

-- Now reorder categories:
-- 1. Core Features
-- 2. Trust & Safety (moved up from position 9)
-- 3. Standard Edition
-- 4. Prayer & Devotion
-- 5. Community & Accountability
-- 6. Bible Study Deep Features
-- 7. Habit Building & Growth
-- 8. Ministry Edition
-- 9. Business Edition

UPDATE plan_feature_categories SET display_order = 1 WHERE slug = 'core-features';
UPDATE plan_feature_categories SET display_order = 2 WHERE slug = 'trust-safety';
UPDATE plan_feature_categories SET display_order = 3 WHERE slug = 'standard-edition';
UPDATE plan_feature_categories SET display_order = 4 WHERE slug = 'prayer-devotion';
UPDATE plan_feature_categories SET display_order = 5 WHERE slug = 'community-accountability';
UPDATE plan_feature_categories SET display_order = 6 WHERE slug = 'bible-study-deep';
UPDATE plan_feature_categories SET display_order = 7 WHERE slug = 'habit-building';
UPDATE plan_feature_categories SET display_order = 8 WHERE slug = 'ministry-edition';
UPDATE plan_feature_categories SET display_order = 9 WHERE slug = 'business-edition';

-- Verify the changes
SELECT id, name, slug, display_order FROM plan_feature_categories ORDER BY display_order;
