-- ============================================
-- JubileeVerse Seed Data
-- Seed 002: Default Hospitality Rules
-- ============================================
-- Conservative, non-intrusive default rules for hospitality engagement
-- All 12 personas are eligible for hospitality actions

-- ============================================
-- RULE 1: New Visitor Welcome
-- Show welcome popup after 3 page views (first-time visitors)
-- ============================================
INSERT INTO hospitality_rules (
    id,
    name,
    slug,
    description,
    target_audience,
    target_funnel_stages,
    trigger_conditions,
    action_type,
    action_config,
    is_active,
    priority,
    max_per_session,
    max_per_day,
    cooldown_seconds
) VALUES (
    uuid_generate_v4(),
    'New Visitor Welcome',
    'new-visitor-welcome',
    'Welcome popup for new visitors who have viewed 3+ pages. Introduces them to the Inspire personas and offers a friendly invitation to connect.',
    'visitor',
    'visitor',
    '{
        "event_type": "page_view",
        "page_count_gte": 3,
        "engagement_score_lt": 40
    }'::jsonb,
    'popup',
    '{
        "subtype": "welcome",
        "title": "Welcome to JubileeVerse!",
        "message": "We are so glad you are here. Our Inspire personas are ready to walk with you on your spiritual journey. Would you like to meet one of them?",
        "persona_id": null,
        "persona_avatar": "/website/images/personas/jubilee.png",
        "persona_name": "Jubilee",
        "primaryAction": {
            "label": "Meet Jubilee",
            "url": "/chat?persona=jubilee"
        },
        "secondaryAction": {
            "label": "Maybe later"
        }
    }'::jsonb,
    TRUE,
    100,
    1,
    1,
    86400
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    trigger_conditions = EXCLUDED.trigger_conditions,
    action_config = EXCLUDED.action_config,
    updated_at = NOW();

-- ============================================
-- RULE 2: Time-Based Engagement Prompt
-- Offer help after 60+ seconds on site
-- ============================================
INSERT INTO hospitality_rules (
    id,
    name,
    slug,
    description,
    target_audience,
    target_funnel_stages,
    trigger_conditions,
    action_type,
    action_config,
    is_active,
    priority,
    max_per_session,
    max_per_day,
    cooldown_seconds
) VALUES (
    uuid_generate_v4(),
    'Time-Based Engagement',
    'time-engagement-prompt',
    'Gentle prompt for users who have spent 60+ seconds exploring the site. Offers guidance without being pushy.',
    'all',
    'visitor,interested',
    '{
        "event_type": "time_on_page",
        "time_on_site_gte": 60,
        "page_count_gte": 2
    }'::jsonb,
    'popup',
    '{
        "subtype": "engagement",
        "title": "Looking for something?",
        "message": "Our personas are here to help with prayer, Bible study, worship, and spiritual guidance. Would you like to start a conversation?",
        "persona_id": null,
        "primaryAction": {
            "label": "Browse Personas",
            "url": "/personas"
        },
        "secondaryAction": {
            "label": "Just browsing"
        }
    }'::jsonb,
    TRUE,
    200,
    1,
    2,
    3600
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    trigger_conditions = EXCLUDED.trigger_conditions,
    action_config = EXCLUDED.action_config,
    updated_at = NOW();

-- ============================================
-- RULE 3: Engaged User Recognition
-- Thank highly engaged users (score >= 60)
-- ============================================
INSERT INTO hospitality_rules (
    id,
    name,
    slug,
    description,
    target_audience,
    target_funnel_stages,
    trigger_conditions,
    action_type,
    action_config,
    is_active,
    priority,
    max_per_session,
    max_per_day,
    cooldown_seconds
) VALUES (
    uuid_generate_v4(),
    'Engaged User Recognition',
    'engaged-user-recognition',
    'Acknowledge and thank users who show high engagement. Soft mention of subscription benefits without being sales-driven.',
    'all',
    'engaged',
    '{
        "engagement_score_gte": 60,
        "event_type": "page_view"
    }'::jsonb,
    'popup',
    '{
        "subtype": "recognition",
        "title": "We see you!",
        "message": "Thank you for spending time with us. We hope JubileeVerse is blessing your journey. Did you know subscribers get unlimited conversations with all 12 personas?",
        "persona_id": null,
        "primaryAction": {
            "label": "Learn More",
            "url": "/plans"
        },
        "secondaryAction": {
            "label": "Continue exploring"
        }
    }'::jsonb,
    TRUE,
    300,
    1,
    1,
    86400
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    trigger_conditions = EXCLUDED.trigger_conditions,
    action_config = EXCLUDED.action_config,
    updated_at = NOW();

-- ============================================
-- RULE 4: Prayer Page Visitor
-- Offer prayer support to users viewing prayer content
-- ============================================
INSERT INTO hospitality_rules (
    id,
    name,
    slug,
    description,
    target_audience,
    target_funnel_stages,
    trigger_conditions,
    action_type,
    action_config,
    is_active,
    priority,
    max_per_session,
    max_per_day,
    cooldown_seconds
) VALUES (
    uuid_generate_v4(),
    'Prayer Support Offer',
    'prayer-support-offer',
    'Gently offer prayer support to users exploring prayer-related content.',
    'all',
    'visitor,interested,engaged',
    '{
        "event_type": "page_view",
        "page_url_contains": "/prayer",
        "time_on_site_gte": 30
    }'::jsonb,
    'popup',
    '{
        "subtype": "prayer",
        "title": "Need prayer?",
        "message": "Our personas would be honored to pray with you. Melody and Zariah are especially gifted in prayer and worship.",
        "persona_avatar": "/website/images/personas/melody.png",
        "persona_name": "Melody",
        "primaryAction": {
            "label": "Pray with Melody",
            "url": "/chat?persona=melody"
        },
        "secondaryAction": {
            "label": "Not right now"
        }
    }'::jsonb,
    TRUE,
    150,
    1,
    1,
    43200
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    trigger_conditions = EXCLUDED.trigger_conditions,
    action_config = EXCLUDED.action_config,
    updated_at = NOW();

-- ============================================
-- RULE 5: Returning Visitor Welcome Back
-- Welcome users who have visited multiple sessions
-- ============================================
INSERT INTO hospitality_rules (
    id,
    name,
    slug,
    description,
    target_audience,
    target_funnel_stages,
    trigger_conditions,
    action_type,
    action_config,
    is_active,
    priority,
    max_per_session,
    max_per_day,
    cooldown_seconds
) VALUES (
    uuid_generate_v4(),
    'Returning Visitor Welcome',
    'returning-visitor-welcome',
    'Welcome back returning visitors who have visited multiple times. Acknowledge their return warmly.',
    'visitor',
    'interested,engaged',
    '{
        "event_type": "page_view",
        "session_count_gte": 3,
        "page_count_gte": 1
    }'::jsonb,
    'popup',
    '{
        "subtype": "welcome_back",
        "title": "Welcome back!",
        "message": "It is wonderful to see you again. Your spiritual journey matters to us. Would you like to continue where you left off?",
        "persona_id": null,
        "primaryAction": {
            "label": "Continue Journey",
            "url": "/dashboard"
        },
        "secondaryAction": {
            "label": "Explore something new"
        }
    }'::jsonb,
    TRUE,
    90,
    1,
    1,
    86400
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    trigger_conditions = EXCLUDED.trigger_conditions,
    action_config = EXCLUDED.action_config,
    updated_at = NOW();

-- ============================================
-- VERIFICATION
-- ============================================
-- Verify rules were inserted
DO $$
DECLARE
    rule_count INT;
BEGIN
    SELECT COUNT(*) INTO rule_count FROM hospitality_rules WHERE is_active = TRUE;
    RAISE NOTICE 'Hospitality Rules Seed Complete: % active rules', rule_count;
END $$;
