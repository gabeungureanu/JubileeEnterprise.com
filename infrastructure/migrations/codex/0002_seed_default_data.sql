-- Migration: 0002_seed_default_data
-- Database: codex
-- Author: Jubilee Solutions
-- Date: 2026-01-04
-- Description: Seed default roles, permissions, settings, and Bible books

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- ============================================================================
-- DEFAULT ROLES
-- ============================================================================

INSERT INTO roles (name, display_name, description, hierarchy_level, is_system_role)
VALUES
    ('superadmin', 'Super Administrator', 'Full system access', 1, TRUE),
    ('admin', 'Administrator', 'Administrative access', 10, TRUE),
    ('moderator', 'Moderator', 'Content moderation access', 50, TRUE),
    ('user', 'User', 'Standard user access', 100, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- DEFAULT PERMISSIONS
-- ============================================================================

INSERT INTO permissions (name, display_name, description, resource_category)
VALUES
    ('users:read', 'View Users', 'View user information', 'users'),
    ('users:write', 'Manage Users', 'Create and update users', 'users'),
    ('users:delete', 'Delete Users', 'Delete user accounts', 'users'),
    ('roles:read', 'View Roles', 'View role information', 'roles'),
    ('roles:write', 'Manage Roles', 'Create and update roles', 'roles'),
    ('personas:read', 'View Personas', 'View persona definitions', 'personas'),
    ('personas:write', 'Manage Personas', 'Create and update personas', 'personas'),
    ('content:read', 'View Content', 'View ministry content', 'content'),
    ('content:write', 'Manage Content', 'Create and update content', 'content'),
    ('content:publish', 'Publish Content', 'Publish content to production', 'content'),
    ('admin:tasks', 'Admin Tasks', 'Manage admin tasks', 'admin'),
    ('admin:safety', 'Safety Review', 'Review safety alerts', 'admin'),
    ('platform:config', 'Platform Config', 'Manage platform settings', 'platform')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ROLE PERMISSION ASSIGNMENTS
-- ============================================================================

-- Superadmin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- Admin gets all except platform config
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name NOT IN ('platform:config')
ON CONFLICT DO NOTHING;

-- Moderator gets persona, content, and admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator' AND p.resource_category IN ('personas', 'content', 'admin')
ON CONFLICT DO NOTHING;

-- User gets read access to personas and content
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN ('personas:read', 'content:read')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEFAULT PLATFORM SETTINGS
-- ============================================================================

INSERT INTO platform_settings (key, value, description, is_public)
VALUES
    ('maintenance_mode', 'false', 'Enable maintenance mode', FALSE),
    ('registration_enabled', 'true', 'Allow new user registration', TRUE),
    ('default_language', '"en"', 'Default platform language', TRUE),
    ('supported_languages', '["en", "es", "fr", "de", "pt", "zh", "ko", "ja"]', 'Supported languages', TRUE)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- BIBLE BOOKS REFERENCE DATA
-- ============================================================================

INSERT INTO bible_books (code, name, testament, chapter_count, display_order)
VALUES
    ('GEN', 'Genesis', 'OT', 50, 1),
    ('EXO', 'Exodus', 'OT', 40, 2),
    ('LEV', 'Leviticus', 'OT', 27, 3),
    ('NUM', 'Numbers', 'OT', 36, 4),
    ('DEU', 'Deuteronomy', 'OT', 34, 5),
    ('JOS', 'Joshua', 'OT', 24, 6),
    ('JDG', 'Judges', 'OT', 21, 7),
    ('RUT', 'Ruth', 'OT', 4, 8),
    ('1SA', '1 Samuel', 'OT', 31, 9),
    ('2SA', '2 Samuel', 'OT', 24, 10),
    ('1KI', '1 Kings', 'OT', 22, 11),
    ('2KI', '2 Kings', 'OT', 25, 12),
    ('1CH', '1 Chronicles', 'OT', 29, 13),
    ('2CH', '2 Chronicles', 'OT', 36, 14),
    ('EZR', 'Ezra', 'OT', 10, 15),
    ('NEH', 'Nehemiah', 'OT', 13, 16),
    ('EST', 'Esther', 'OT', 10, 17),
    ('JOB', 'Job', 'OT', 42, 18),
    ('PSA', 'Psalms', 'OT', 150, 19),
    ('PRO', 'Proverbs', 'OT', 31, 20),
    ('ECC', 'Ecclesiastes', 'OT', 12, 21),
    ('SNG', 'Song of Solomon', 'OT', 8, 22),
    ('ISA', 'Isaiah', 'OT', 66, 23),
    ('JER', 'Jeremiah', 'OT', 52, 24),
    ('LAM', 'Lamentations', 'OT', 5, 25),
    ('EZK', 'Ezekiel', 'OT', 48, 26),
    ('DAN', 'Daniel', 'OT', 12, 27),
    ('HOS', 'Hosea', 'OT', 14, 28),
    ('JOL', 'Joel', 'OT', 3, 29),
    ('AMO', 'Amos', 'OT', 9, 30),
    ('OBA', 'Obadiah', 'OT', 1, 31),
    ('JON', 'Jonah', 'OT', 4, 32),
    ('MIC', 'Micah', 'OT', 7, 33),
    ('NAM', 'Nahum', 'OT', 3, 34),
    ('HAB', 'Habakkuk', 'OT', 3, 35),
    ('ZEP', 'Zephaniah', 'OT', 3, 36),
    ('HAG', 'Haggai', 'OT', 2, 37),
    ('ZEC', 'Zechariah', 'OT', 14, 38),
    ('MAL', 'Malachi', 'OT', 4, 39),
    ('MAT', 'Matthew', 'NT', 28, 40),
    ('MRK', 'Mark', 'NT', 16, 41),
    ('LUK', 'Luke', 'NT', 24, 42),
    ('JHN', 'John', 'NT', 21, 43),
    ('ACT', 'Acts', 'NT', 28, 44),
    ('ROM', 'Romans', 'NT', 16, 45),
    ('1CO', '1 Corinthians', 'NT', 16, 46),
    ('2CO', '2 Corinthians', 'NT', 13, 47),
    ('GAL', 'Galatians', 'NT', 6, 48),
    ('EPH', 'Ephesians', 'NT', 6, 49),
    ('PHP', 'Philippians', 'NT', 4, 50),
    ('COL', 'Colossians', 'NT', 4, 51),
    ('1TH', '1 Thessalonians', 'NT', 5, 52),
    ('2TH', '2 Thessalonians', 'NT', 3, 53),
    ('1TI', '1 Timothy', 'NT', 6, 54),
    ('2TI', '2 Timothy', 'NT', 4, 55),
    ('TIT', 'Titus', 'NT', 3, 56),
    ('PHM', 'Philemon', 'NT', 1, 57),
    ('HEB', 'Hebrews', 'NT', 13, 58),
    ('JAS', 'James', 'NT', 5, 59),
    ('1PE', '1 Peter', 'NT', 5, 60),
    ('2PE', '2 Peter', 'NT', 3, 61),
    ('1JN', '1 John', 'NT', 5, 62),
    ('2JN', '2 John', 'NT', 1, 63),
    ('3JN', '3 John', 'NT', 1, 64),
    ('JUD', 'Jude', 'NT', 1, 65),
    ('REV', 'Revelation', 'NT', 22, 66)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DEFAULT SAFETY THRESHOLDS
-- ============================================================================

INSERT INTO safety_thresholds (category, alert_confidence_threshold, requires_immediate_review)
VALUES
    ('self_harm', 60, TRUE),
    ('harm_to_others', 60, TRUE),
    ('crisis_signal', 50, TRUE),
    ('grooming_behavior', 70, TRUE),
    ('sexual_advance', 75, FALSE),
    ('manipulation_attempt', 75, FALSE),
    ('coercive_language', 80, FALSE),
    ('boundary_violation', 80, FALSE),
    ('abuse_language', 70, FALSE),
    ('deception_attempt', 80, FALSE),
    ('identity_confusion', 85, FALSE),
    ('exploitation_risk', 70, TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
