-- Migration: 0002_seed_default_data
-- Database: continuum
-- Author: Jubilee Solutions
-- Date: 2026-01-04
-- Description: Seed default subscription plans, TLDs, and global community

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- ============================================================================
-- DEFAULT SUBSCRIPTION PLANS
-- ============================================================================

INSERT INTO subscription_plans (name, slug, description, tier_level, price_monthly_cents, price_yearly_cents, daily_word_limit, monthly_word_limit, max_conversations, max_personas, features, is_default)
VALUES
    ('Free', 'free', 'Free tier with basic features', 0, 0, 0, 1000, 25000, 5, 3, '["basic_personas", "community_access"]', TRUE),
    ('Essentials', 'essentials', 'Essential features for regular use', 1, 999, 9990, 5000, 100000, 25, 10, '["all_personas", "priority_response", "export_conversations"]', FALSE),
    ('Ministry', 'ministry', 'Full features for ministry work', 2, 2499, 24990, NULL, NULL, NULL, NULL, '["unlimited_usage", "custom_personas", "api_access", "analytics"]', FALSE),
    ('Enterprise', 'enterprise', 'Enterprise features with support', 3, 9999, 99990, NULL, NULL, NULL, NULL, '["everything", "dedicated_support", "sla", "custom_integration"]', FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- DEFAULT JUBILEE TLDS
-- ============================================================================

INSERT INTO jubilee_tlds (tld, display_name, description, price_per_year_cents)
VALUES
    ('bible', '.bible', 'Bible-focused websites and ministries', 2499),
    ('faith', '.faith', 'Faith-based organizations and content', 1999),
    ('church', '.church', 'Churches and religious organizations', 2499),
    ('ministry', '.ministry', 'Ministry organizations', 1999),
    ('prayer', '.prayer', 'Prayer-focused content', 1499),
    ('worship', '.worship', 'Worship and praise content', 1499),
    ('gospel', '.gospel', 'Gospel-centered content', 1999),
    ('christian', '.christian', 'Christian content and organizations', 1999)
ON CONFLICT (tld) DO NOTHING;

-- ============================================================================
-- DEFAULT GLOBAL COMMUNITY
-- ============================================================================

-- Note: Using a placeholder UUID for owner_id (system user)
-- This should be updated once a system admin user is created
INSERT INTO communities (id, name, slug, description, owner_id, is_global, is_public)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Jubilee Community',
    'jubilee',
    'The global Jubilee community for all users',
    '00000000-0000-0000-0000-000000000000',
    TRUE,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
