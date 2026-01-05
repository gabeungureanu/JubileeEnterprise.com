-- ============================================
-- JubileeVerse Database Schema
-- Migration 028: Update Plan Features for Maximum JQA Rating
-- ============================================
-- This migration adds comprehensive features to achieve 120% JQA rating
-- Categories: A-I with all recommended features

-- First, let's add new categories that are missing
INSERT INTO plan_feature_categories (name, slug, display_order, is_published)
VALUES
  ('Prayer & Devotion', 'prayer-devotion', 5, true),
  ('Community & Accountability', 'community-accountability', 6, true),
  ('Bible Study Deep Features', 'bible-study-deep', 7, true),
  ('Habit Building & Growth', 'habit-building', 8, true),
  ('Trust & Safety', 'trust-safety', 9, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  is_published = EXCLUDED.is_published;

-- Now add all the missing features for 120% JQA rating

-- Category: Prayer & Devotion (new features)
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Personal Prayer Lists', 'personal-prayer-lists', 'Create and manage your personal prayer requests', 1, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'prayer-devotion'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Confidential Prayer Requests', 'confidential-prayer-requests', 'Submit private prayer needs with complete confidentiality', 2, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'prayer-devotion'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Prayer Reminder Notifications', 'prayer-reminders', 'Customizable reminders to maintain your prayer life', 3, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'prayer-devotion'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Answered Prayer Tracking', 'answered-prayer-tracking', 'Record and celebrate answered prayers with gratitude journals', 4, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'prayer-devotion'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Fasting Companion', 'fasting-companion', 'Guided fasting plans with spiritual support and encouragement', 5, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'prayer-devotion'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Morning & Evening Devotionals', 'morning-evening-devotionals', 'Start and end your day with Scripture-based reflections', 6, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'prayer-devotion'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Category: Community & Accountability
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Small Group Creation', 'small-groups', 'Create and join faith-based small groups for deeper connection', 1, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'community-accountability'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Accountability Partners', 'accountability-partners', 'Connect with trusted partners for spiritual growth accountability', 2, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'community-accountability'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Shared Prayer Chains', 'shared-prayer-chains', 'Join community prayer chains for collective intercession', 3, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'community-accountability'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Group Bible Studies', 'group-bible-studies', 'Participate in collaborative Scripture study sessions', 4, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'community-accountability'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Mentor Matching', 'mentor-matching', 'Connect with experienced believers for spiritual mentorship', 5, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'community-accountability'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Discussion Forums', 'discussion-forums', 'Engage in moderated faith discussions with the community', 6, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'community-accountability'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Category: Bible Study Deep Features
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Cross-Reference Explorer', 'cross-reference-explorer', 'Discover connected passages across the entire Bible', 1, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'bible-study-deep'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Personal Study Notes', 'personal-study-notes', 'Create, organize, and search your own study notes', 2, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'bible-study-deep'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Verse Highlighting & Bookmarks', 'verse-highlighting', 'Highlight verses with colors and bookmark important passages', 3, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'bible-study-deep'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Commentary Integration', 'commentary-integration', 'Access trusted biblical commentaries alongside Scripture', 4, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'bible-study-deep'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Word Study Tools', 'word-study-tools', 'Deep dive into Greek, Hebrew, and Aramaic word meanings', 5, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'bible-study-deep'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Timeline & Maps', 'timeline-maps', 'Visual biblical timelines and interactive Holy Land maps', 6, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'bible-study-deep'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Topical Study Guides', 'topical-study-guides', 'Comprehensive guides on key biblical topics and themes', 7, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'bible-study-deep'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Category: Habit Building & Growth
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Daily Reading Streaks', 'daily-reading-streaks', 'Track your consistency with motivating streak counters', 1, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'habit-building'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Customizable Reminders', 'customizable-reminders', 'Set personalized reminders for devotions, prayer, and study', 2, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'habit-building'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Progress Dashboard', 'progress-dashboard', 'Visual dashboard showing your spiritual growth journey', 3, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'habit-building'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Achievement Milestones', 'achievement-milestones', 'Celebrate spiritual milestones with meaningful achievements', 4, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'habit-building'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Annual Bible Reading Plans', 'annual-reading-plans', 'Multiple one-year Bible reading plan options', 5, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'habit-building'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Spiritual Growth Reports', 'spiritual-growth-reports', 'Monthly insights on your faith journey progress', 6, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'habit-building'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Category: Trust & Safety
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'AI Transparency Disclosure', 'ai-transparency', 'Clear disclosure that you are interacting with AI personas', 1, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'trust-safety'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Data Privacy Protection', 'data-privacy', 'Your conversations and data are encrypted and protected', 2, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'trust-safety'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Crisis Resource Links', 'crisis-resources', 'Quick access to professional help and crisis hotlines', 3, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'trust-safety'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Denominational Neutrality', 'denominational-neutrality', 'Balanced, non-denominational biblical perspectives', 4, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'trust-safety'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Content Moderation', 'content-moderation', 'AI-powered and human review for safe community interactions', 5, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'trust-safety'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Parental Controls', 'parental-controls', 'Family-safe settings and content filters for younger users', 6, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'trust-safety'
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Update display_order for existing categories to ensure proper ordering
UPDATE plan_feature_categories SET display_order = 1 WHERE slug = 'core-features';
UPDATE plan_feature_categories SET display_order = 2 WHERE slug = 'standard-edition-features';
UPDATE plan_feature_categories SET display_order = 3 WHERE slug = 'ministry-edition-features';
UPDATE plan_feature_categories SET display_order = 4 WHERE slug = 'business-edition-features';

-- Ensure all features have proper display_order within their categories
UPDATE plan_features f SET display_order = sub.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at) as row_num
  FROM plan_features
) sub
WHERE f.id = sub.id;
