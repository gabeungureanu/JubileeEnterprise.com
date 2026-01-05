-- Migration: 0002_seed_default_data
-- Database: inspire
-- Author: Jubilee Solutions
-- Date: 2026-01-04
-- Description: Seed default content types, Bible versions, and collection templates

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- ============================================================================
-- DEFAULT CONTENT TYPES
-- ============================================================================

INSERT INTO content_types (slug, name, description, icon)
VALUES
    ('book', 'Book', 'Written publications and eBooks', 'book'),
    ('article', 'Article', 'Written articles and blog posts', 'article'),
    ('audio', 'Audio', 'Podcasts and audio teachings', 'headphones'),
    ('video', 'Video', 'Video teachings and sermons', 'video'),
    ('music', 'Music', 'Songs and worship music', 'music'),
    ('sermon', 'Sermon', 'Recorded sermons and messages', 'microphone'),
    ('devotional', 'Devotional', 'Daily devotional content', 'heart'),
    ('study', 'Bible Study', 'Bible study materials', 'book-open'),
    ('course', 'Course', 'Educational courses', 'graduation-cap')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- DEFAULT BIBLE VERSIONS
-- ============================================================================

INSERT INTO bible_versions (code, name, language, is_public_domain)
VALUES
    ('KJV', 'King James Version', 'en', TRUE),
    ('ASV', 'American Standard Version', 'en', TRUE),
    ('WEB', 'World English Bible', 'en', TRUE),
    ('YLT', 'Young''s Literal Translation', 'en', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DEFAULT COLLECTION TEMPLATES
-- ============================================================================

INSERT INTO collection_templates (slug, name, description, template_type)
VALUES
    ('persona-32-stage', '32-Stage Persona Template', 'Standard 32-stage persona development template', 'persona'),
    ('scripture-reference', 'Scripture Reference Template', 'Template for scripture-based collections', 'scripture'),
    ('doctrine-framework', 'Doctrine Framework Template', 'Template for doctrinal collections', 'doctrine')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
