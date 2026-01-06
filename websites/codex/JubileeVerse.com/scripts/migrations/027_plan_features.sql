-- Migration: 027_plan_features.sql
-- Description: Create tables for managing subscription plan features dynamically
-- Created: December 2024

-- Table: plan_feature_categories
-- Groups features into logical sections (Core Features, Standard Edition, etc.)
CREATE TABLE IF NOT EXISTS plan_feature_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: plan_features
-- Individual features that can be enabled/disabled per plan
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES plan_feature_categories(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  -- Which plans include this feature (true = included, false = not included)
  free_plan BOOLEAN NOT NULL DEFAULT false,
  standard_plan BOOLEAN NOT NULL DEFAULT false,
  ministry_plan BOOLEAN NOT NULL DEFAULT false,
  business_plan BOOLEAN NOT NULL DEFAULT false,
  -- Special display values (for custom content like "12 AI Personas" instead of checkmark)
  free_value VARCHAR(100),
  standard_value VARCHAR(100),
  ministry_value VARCHAR(100),
  business_value VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_features_category ON plan_features(category_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_published ON plan_features(is_published);
CREATE INDEX IF NOT EXISTS idx_plan_features_order ON plan_features(display_order);
CREATE INDEX IF NOT EXISTS idx_plan_feature_categories_order ON plan_feature_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_plan_feature_categories_published ON plan_feature_categories(is_published);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plan_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_plan_features_updated_at ON plan_features;
CREATE TRIGGER trigger_plan_features_updated_at
  BEFORE UPDATE ON plan_features
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_features_updated_at();

DROP TRIGGER IF EXISTS trigger_plan_feature_categories_updated_at ON plan_feature_categories;
CREATE TRIGGER trigger_plan_feature_categories_updated_at
  BEFORE UPDATE ON plan_feature_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_features_updated_at();

-- Seed data: Categories
INSERT INTO plan_feature_categories (name, slug, display_order, is_published) VALUES
  ('Core Features', 'core-features', 1, true),
  ('Standard Edition Features', 'standard-edition', 2, true),
  ('Ministry Edition Features', 'ministry-edition', 3, true),
  ('Business Edition Features', 'business-edition', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed data: Core Features
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan, free_value, standard_value, ministry_value, business_value)
SELECT
  c.id,
  'Personalized AI Bible Personalities',
  'ai-personas',
  'Experience our AI companions with 98% "Simulated Sentient" rating',
  1, true, true, true, true, true,
  '12 AI Bible Personas', '12 AI Bible Personas', '12 AI Bible Personas', '12 AI Bible Personas'
FROM plan_feature_categories c WHERE c.slug = 'core-features'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Interactive Bible Verse Exploration', 'bible-exploration', 'Search verses and get powerful passages tailored to your questions', 2, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'core-features'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Multi-Language Bible Translations', 'multi-language', '95+ written languages, 57 spoken languages', 3, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'core-features'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'AI-Assisted Personalized Prayer Support', 'prayer-support', 'AI-crafted prayers for your spiritual needs', 4, true, true, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'core-features'
ON CONFLICT (slug) DO NOTHING;

-- Seed data: Standard Edition Features
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Inspirational Daily Bible Verses & Reflection', 'daily-verses', 'Daily verse and reflection to uplift your spirit', 1, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Hebrew & Greek Word Study', 'hebrew-greek', 'Explore meanings rooted in original Hebrew, Greek, and Aramaic', 2, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Interactive Daily Devotionals', 'daily-devotionals', 'Bite-sized reflections with Scripture and action steps', 3, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'AI-Assisted Journaling', 'journaling', 'Deepen your faith and track spiritual growth', 4, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Faith-Building Challenges', 'faith-challenges', 'Weekly challenges to strengthen key disciplines', 5, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Personalized Prayer Suggestions', 'prayer-suggestions', 'Tailored prayer suggestions for your unique journey', 6, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Thematic Bible Reading Plans', 'reading-plans', 'Curated plans on grace, forgiveness, leadership, prophecy', 7, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Verse-to-Life Application', 'verse-application', 'Practical steps to apply biblical truths daily', 8, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Scripture Memorization Assistant', 'memorization', 'Personalized memory techniques for your learning style', 9, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Biblical Character Profiles', 'character-profiles', 'Explore journeys, challenges, and triumphs of biblical figures', 10, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Community Engagement Tools', 'community-engagement', 'Foster meaningful connections in your church community', 11, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Historical Event Contextualizer', 'historical-context', 'Detailed historical and cultural backdrop of biblical events', 12, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Prophetic Insights Exploration', 'prophetic-insights', 'Uncover meanings behind prophetic messages', 13, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Faith-Based Bed-Time Stories', 'bedtime-stories', 'Personalized bedtime stories rooted in biblical values', 14, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Family Devotional Ideas', 'family-devotionals', 'Transform family time into meaningful faith moments', 15, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Faith-Inspired Music Recommendations', 'music-recommendations', 'Curated hymns, worship songs tailored to you', 16, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Weekly Reflection Questions', 'reflection-questions', 'Thoughtfully crafted questions to strengthen understanding', 17, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Spiritual Goal Setting', 'goal-setting', 'Define and achieve meaningful spiritual goals', 18, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Discipleship Pathway Builder', 'discipleship-pathway', 'Customized discipleship journeys with milestones', 19, true, false, true, true, true
FROM plan_feature_categories c WHERE c.slug = 'standard-edition'
ON CONFLICT (slug) DO NOTHING;

-- Seed data: Ministry Edition Features
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Parables Explorer & Generator', 'parables-explorer', 'Contextual insights on Jesus'' parables for modern life', 1, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Sermon Inspiration Hub', 'sermon-inspiration', 'Generate sermon outlines, talking points, and Scripture', 2, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Volunteer Management Tools', 'volunteer-management', 'Schedule tasks, assign responsibilities, send encouragement', 3, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Bible Study Design Tools', 'bible-study-design', 'Create themed studies tailored to your group''s needs', 4, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Faith-Based Leadership Development', 'leadership-development', 'Tailored workshops and team-building resources', 5, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Prayer Chain Organizer', 'prayer-chain', 'Create, manage prayer chains and track requests', 6, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Counseling Insights', 'counseling-insights', 'AI-driven pastoral care support rooted in Scripture', 7, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Ministry Growth Analytics', 'ministry-analytics', 'Insights into engagement, sermon feedback, attendance', 8, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Custom Faith Resource Library', 'resource-library', 'Personalized faith-focused materials for your ministry', 9, true, false, false, true, true
FROM plan_feature_categories c WHERE c.slug = 'ministry-edition'
ON CONFLICT (slug) DO NOTHING;

-- Seed data: Business Edition Features
INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Values-Driven Marketing Strategies', 'marketing-strategies', 'AI-powered marketing reflecting faith-based values', 1, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Inspirational Team-Building Activities', 'team-building', 'Engaging exercises rooted in faith-based principles', 2, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Faith-Centered Customer Engagement', 'customer-engagement', 'Personalized outreach with compassion and integrity', 3, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Mission-Driven Branding Assistance', 'branding-assistance', 'Develop a powerful purpose-driven brand identity', 4, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Faith-Based Leadership Training', 'leadership-training', 'Transformative tools grounded in biblical principles', 5, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Community Impact Campaigns', 'impact-campaigns', 'AI-guided planning for meaningful service projects', 6, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Ethical Decision-Making Framework', 'ethical-framework', 'Navigate business decisions with faith-based integrity', 7, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Workplace Devotional Resources', 'workplace-devotionals', 'Transform your workplace with spiritual growth tools', 8, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Faith-Inspired Content Creation', 'content-creation', 'Generate captivating blogs, newsletters, social posts', 9, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Personalized Networking Strategies', 'networking-strategies', 'Connect with like-minded faith-inspired professionals', 10, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO plan_features (category_id, name, slug, description, display_order, is_published, free_plan, standard_plan, ministry_plan, business_plan)
SELECT c.id, 'Scripture-Based Business Insights', 'business-insights', 'Biblical wisdom for stewardship and customer relations', 11, true, false, false, false, true
FROM plan_feature_categories c WHERE c.slug = 'business-edition'
ON CONFLICT (slug) DO NOTHING;
