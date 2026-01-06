-- ============================================
-- JubileeVerse Database Schema
-- Migration 062: ML-Inspired Engagement Rules Per Category
-- ============================================
-- Generates 7 high-engagement rules per root category using
-- ML/sentiment analysis inspired templates. Each rule includes:
-- - Behavioral triggers based on engagement patterns
-- - Sentiment-aware message templates
-- - Persona assignments matched to rule intent
-- - Engagement scoring thresholds
-- ============================================

-- Helper function to generate rule number
CREATE OR REPLACE FUNCTION generate_next_rule_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    max_num INT;
    next_num VARCHAR(20);
BEGIN
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(rule_number, '[^0-9]', '', 'g') AS INT)), 0) + 1
    INTO max_num
    FROM hospitality_rules
    WHERE rule_number ~ '^[0-9]+$';

    RETURN LPAD(max_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Generate ML-Inspired Rules Per Category
-- ============================================
CREATE OR REPLACE FUNCTION generate_category_engagement_rules()
RETURNS TABLE(rules_created INT, categories_processed INT) AS $$
DECLARE
    cat_record RECORD;
    rule_count INT := 0;
    cat_count INT := 0;
    next_rule_num INT;
    cat_id UUID;
    persona_list TEXT[] := ARRAY['jubilee', 'solomon', 'lydia', 'barnabas', 'deborah', 'gideon', 'ruth', 'elijah'];
BEGIN
    -- Get starting rule number
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(rule_number, '[^0-9]', '', 'g') AS INT)), 0)
    INTO next_rule_num
    FROM hospitality_rules
    WHERE rule_number ~ '^[0-9]+$';

    -- Process each root category (parent_id IS NULL)
    FOR cat_record IN
        SELECT id, slug, name, description
        FROM engagement_categories
        WHERE parent_id IS NULL AND is_deleted = FALSE
        ORDER BY sort_order
    LOOP
        cat_id := cat_record.id;
        cat_count := cat_count + 1;

        -- ======================================
        -- RULE 1: First-Time Visitor Welcome
        -- Sentiment: Warm, Inviting
        -- ======================================
        next_rule_num := next_rule_num + 1;
        INSERT INTO hospitality_rules (
            name, slug, description, category_id, rule_number,
            target_audience, trigger_conditions, action_type, action_config,
            message_template, button_config, personalization_config,
            is_active, priority, max_per_session, max_per_day, cooldown_seconds
        ) VALUES (
            cat_record.name || ' - First Visit Welcome',
            cat_record.slug || '-first-visit-welcome',
            'Warmly welcomes first-time visitors exploring ' || cat_record.name || ' content',
            cat_id,
            LPAD(next_rule_num::TEXT, 4, '0'),
            'visitor',
            jsonb_build_object(
                'event_type', 'page_view',
                'is_first_visit', true,
                'time_on_page_gte', 10,
                'page_category', cat_record.slug
            ),
            'persona_message',
            jsonb_build_object(
                'persona_id', persona_list[1 + (cat_count % 8)],
                'title', 'Welcome to ' || cat_record.name,
                'sentiment', 'warm_inviting',
                'urgency', 'low'
            ),
            'Hello and welcome! I noticed you''re exploring our {{category_name}} resources. I''m {{persona_name}}, and I''d love to help you find exactly what you need. What brings you here today?',
            jsonb_build_array(
                jsonb_build_object('text', 'Show me around', 'type', 'primary', 'action', 'start_tour'),
                jsonb_build_object('text', 'I''ll explore', 'type', 'secondary', 'action', 'dismiss')
            ),
            jsonb_build_object(
                'adaptToLanguage', true,
                'adaptToSentiment', true,
                'adaptToHistory', false
            ),
            TRUE, 100, 1, 1, 3600
        ) ON CONFLICT (slug) DO NOTHING;
        rule_count := rule_count + 1;

        -- ======================================
        -- RULE 2: Deep Engagement Recognition
        -- Sentiment: Encouraging, Affirming
        -- ======================================
        next_rule_num := next_rule_num + 1;
        INSERT INTO hospitality_rules (
            name, slug, description, category_id, rule_number,
            target_audience, trigger_conditions, action_type, action_config,
            message_template, button_config, personalization_config,
            is_active, priority, max_per_session, max_per_day, cooldown_seconds
        ) VALUES (
            cat_record.name || ' - Deep Engagement',
            cat_record.slug || '-deep-engagement',
            'Recognizes and encourages users spending quality time with ' || cat_record.name || ' content',
            cat_id,
            LPAD(next_rule_num::TEXT, 4, '0'),
            'all',
            jsonb_build_object(
                'event_type', 'page_engagement',
                'time_on_site_gte', 300,
                'page_count_gte', 5,
                'scroll_depth_gte', 75,
                'page_category', cat_record.slug
            ),
            'persona_message',
            jsonb_build_object(
                'persona_id', persona_list[2 + (cat_count % 8)],
                'title', 'You''re Making Great Progress',
                'sentiment', 'encouraging',
                'urgency', 'low'
            ),
            'I can see you''re really diving deep into {{category_name}}! Your dedication to growth is inspiring. Would you like me to suggest some advanced resources or help you save your progress?',
            jsonb_build_array(
                jsonb_build_object('text', 'Show advanced topics', 'type', 'primary', 'action', 'show_advanced'),
                jsonb_build_object('text', 'Save my progress', 'type', 'secondary', 'action', 'save_progress')
            ),
            jsonb_build_object(
                'adaptToLanguage', true,
                'adaptToSentiment', true,
                'adaptToHistory', true
            ),
            TRUE, 150, 1, 2, 1800
        ) ON CONFLICT (slug) DO NOTHING;
        rule_count := rule_count + 1;

        -- ======================================
        -- RULE 3: Return Visitor Recognition
        -- Sentiment: Familiar, Appreciative
        -- ======================================
        next_rule_num := next_rule_num + 1;
        INSERT INTO hospitality_rules (
            name, slug, description, category_id, rule_number,
            target_audience, trigger_conditions, action_type, action_config,
            message_template, button_config, personalization_config,
            is_active, priority, max_per_session, max_per_day, cooldown_seconds
        ) VALUES (
            cat_record.name || ' - Return Visitor',
            cat_record.slug || '-return-visitor',
            'Welcomes back returning visitors with personalized ' || cat_record.name || ' recommendations',
            cat_id,
            LPAD(next_rule_num::TEXT, 4, '0'),
            'subscriber',
            jsonb_build_object(
                'event_type', 'session_start',
                'return_visit', true,
                'days_since_last_visit_gte', 3,
                'previous_category', cat_record.slug
            ),
            'persona_message',
            jsonb_build_object(
                'persona_id', persona_list[3 + (cat_count % 8)],
                'title', 'Welcome Back!',
                'sentiment', 'familiar_warm',
                'urgency', 'low'
            ),
            'Welcome back, {{user_name}}! It''s wonderful to see you again. Since you last visited, we''ve added some new {{category_name}} content you might enjoy. Would you like to pick up where you left off?',
            jsonb_build_array(
                jsonb_build_object('text', 'Continue journey', 'type', 'primary', 'action', 'resume_progress'),
                jsonb_build_object('text', 'What''s new?', 'type', 'secondary', 'action', 'show_new')
            ),
            jsonb_build_object(
                'adaptToLanguage', true,
                'adaptToSentiment', true,
                'adaptToHistory', true
            ),
            TRUE, 80, 1, 1, 7200
        ) ON CONFLICT (slug) DO NOTHING;
        rule_count := rule_count + 1;

        -- ======================================
        -- RULE 4: Milestone Celebration
        -- Sentiment: Celebratory, Proud
        -- ======================================
        next_rule_num := next_rule_num + 1;
        INSERT INTO hospitality_rules (
            name, slug, description, category_id, rule_number,
            target_audience, trigger_conditions, action_type, action_config,
            message_template, button_config, personalization_config,
            is_active, priority, max_per_session, max_per_day, cooldown_seconds
        ) VALUES (
            cat_record.name || ' - Milestone Reached',
            cat_record.slug || '-milestone-reached',
            'Celebrates user milestones in ' || cat_record.name || ' journey',
            cat_id,
            LPAD(next_rule_num::TEXT, 4, '0'),
            'subscriber',
            jsonb_build_object(
                'event_type', 'milestone',
                'milestone_type', 'category_progress',
                'completion_percentage_gte', 50,
                'page_category', cat_record.slug
            ),
            'popup',
            jsonb_build_object(
                'persona_id', persona_list[4 + (cat_count % 8)],
                'title', 'Milestone Achieved!',
                'sentiment', 'celebratory',
                'urgency', 'medium',
                'animation', 'confetti'
            ),
            'Congratulations! You''ve completed {{progress_percent}}% of the {{category_name}} journey! Your commitment to spiritual growth is truly commendable. Keep going - you''re doing amazing!',
            jsonb_build_array(
                jsonb_build_object('text', 'Share achievement', 'type', 'primary', 'action', 'share_milestone'),
                jsonb_build_object('text', 'Continue', 'type', 'secondary', 'action', 'dismiss')
            ),
            jsonb_build_object(
                'adaptToLanguage', true,
                'adaptToSentiment', false,
                'adaptToHistory', true
            ),
            TRUE, 50, 1, 1, 86400
        ) ON CONFLICT (slug) DO NOTHING;
        rule_count := rule_count + 1;

        -- ======================================
        -- RULE 5: Inactivity Re-engagement
        -- Sentiment: Gentle, Caring
        -- ======================================
        next_rule_num := next_rule_num + 1;
        INSERT INTO hospitality_rules (
            name, slug, description, category_id, rule_number,
            target_audience, trigger_conditions, action_type, action_config,
            message_template, button_config, personalization_config,
            is_active, priority, max_per_session, max_per_day, cooldown_seconds
        ) VALUES (
            cat_record.name || ' - Gentle Re-engagement',
            cat_record.slug || '-gentle-reengagement',
            'Gently re-engages users who pause during ' || cat_record.name || ' exploration',
            cat_id,
            LPAD(next_rule_num::TEXT, 4, '0'),
            'all',
            jsonb_build_object(
                'event_type', 'inactivity',
                'idle_seconds_gte', 120,
                'scroll_position_stable', true,
                'page_category', cat_record.slug
            ),
            'persona_message',
            jsonb_build_object(
                'persona_id', persona_list[5 + (cat_count % 8)],
                'title', 'Need a Hand?',
                'sentiment', 'gentle_caring',
                'urgency', 'low'
            ),
            'I noticed you paused for a moment. Sometimes we all need time to reflect. If you have any questions about {{category_name}} or need guidance, I''m here to help whenever you''re ready.',
            jsonb_build_array(
                jsonb_build_object('text', 'Ask a question', 'type', 'primary', 'action', 'open_chat'),
                jsonb_build_object('text', 'Just reflecting', 'type', 'secondary', 'action', 'dismiss')
            ),
            jsonb_build_object(
                'adaptToLanguage', true,
                'adaptToSentiment', true,
                'adaptToHistory', false
            ),
            TRUE, 200, 1, 3, 600
        ) ON CONFLICT (slug) DO NOTHING;
        rule_count := rule_count + 1;

        -- ======================================
        -- RULE 6: Community Connection Prompt
        -- Sentiment: Friendly, Inclusive
        -- ======================================
        next_rule_num := next_rule_num + 1;
        INSERT INTO hospitality_rules (
            name, slug, description, category_id, rule_number,
            target_audience, trigger_conditions, action_type, action_config,
            message_template, button_config, personalization_config,
            is_active, priority, max_per_session, max_per_day, cooldown_seconds
        ) VALUES (
            cat_record.name || ' - Community Connection',
            cat_record.slug || '-community-connection',
            'Invites engaged users to join ' || cat_record.name || ' community groups',
            cat_id,
            LPAD(next_rule_num::TEXT, 4, '0'),
            'subscriber',
            jsonb_build_object(
                'event_type', 'engagement_threshold',
                'engagement_score_gte', 70,
                'not_in_community', true,
                'page_category', cat_record.slug
            ),
            'persona_message',
            jsonb_build_object(
                'persona_id', persona_list[6 + (cat_count % 8)],
                'title', 'Join the Community',
                'sentiment', 'friendly_inclusive',
                'urgency', 'medium'
            ),
            'You seem to really connect with {{category_name}} content! There''s a wonderful community of like-minded believers who share this passion. Would you like to join the conversation?',
            jsonb_build_array(
                jsonb_build_object('text', 'Join community', 'type', 'primary', 'action', 'join_community'),
                jsonb_build_object('text', 'Maybe later', 'type', 'secondary', 'action', 'remind_later')
            ),
            jsonb_build_object(
                'adaptToLanguage', true,
                'adaptToSentiment', true,
                'adaptToHistory', true
            ),
            TRUE, 120, 1, 1, 43200
        ) ON CONFLICT (slug) DO NOTHING;
        rule_count := rule_count + 1;

        -- ======================================
        -- RULE 7: Personalized Recommendation
        -- Sentiment: Helpful, Insightful
        -- ======================================
        next_rule_num := next_rule_num + 1;
        INSERT INTO hospitality_rules (
            name, slug, description, category_id, rule_number,
            target_audience, trigger_conditions, action_type, action_config,
            message_template, button_config, personalization_config,
            is_active, priority, max_per_session, max_per_day, cooldown_seconds
        ) VALUES (
            cat_record.name || ' - Smart Recommendation',
            cat_record.slug || '-smart-recommendation',
            'AI-powered content recommendations based on ' || cat_record.name || ' browsing patterns',
            cat_id,
            LPAD(next_rule_num::TEXT, 4, '0'),
            'all',
            jsonb_build_object(
                'event_type', 'content_completion',
                'completed_items_gte', 3,
                'ml_recommendation_ready', true,
                'page_category', cat_record.slug
            ),
            'notification',
            jsonb_build_object(
                'persona_id', persona_list[7 + (cat_count % 8)],
                'title', 'Personalized for You',
                'sentiment', 'helpful_insightful',
                'urgency', 'low',
                'ml_model', 'content_affinity_v2'
            ),
            'Based on your journey through {{category_name}}, I think you''d really appreciate "{{recommended_title}}". It aligns beautifully with your interests and could deepen your understanding.',
            jsonb_build_array(
                jsonb_build_object('text', 'Show me', 'type', 'primary', 'action', 'view_recommendation'),
                jsonb_build_object('text', 'Different topic', 'type', 'secondary', 'action', 'show_alternatives')
            ),
            jsonb_build_object(
                'adaptToLanguage', true,
                'adaptToSentiment', true,
                'adaptToHistory', true,
                'useMLRecommendations', true
            ),
            TRUE, 130, 2, 5, 900
        ) ON CONFLICT (slug) DO NOTHING;
        rule_count := rule_count + 1;

    END LOOP;

    RETURN QUERY SELECT rule_count, cat_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- EXECUTE: Generate Rules for All Categories
-- ============================================
DO $$
DECLARE
    result RECORD;
BEGIN
    SELECT * INTO result FROM generate_category_engagement_rules();
    RAISE NOTICE 'Migration 062: Created % engagement rules across % categories', result.rules_created, result.categories_processed;
END $$;

-- ============================================
-- CREATE VIEW: Rules with ML Sentiment Analysis
-- ============================================
CREATE OR REPLACE VIEW v_engagement_rules_by_category AS
SELECT
    ec.id as category_id,
    ec.name as category_name,
    ec.slug as category_slug,
    ec.icon as category_icon,
    COUNT(hr.id) as rule_count,
    ARRAY_AGG(
        jsonb_build_object(
            'id', hr.id,
            'name', hr.name,
            'sentiment', hr.action_config->>'sentiment',
            'priority', hr.priority,
            'is_active', hr.is_active
        ) ORDER BY hr.priority
    ) as rules
FROM engagement_categories ec
LEFT JOIN hospitality_rules hr ON hr.category_id = ec.id
WHERE ec.is_deleted = FALSE AND ec.parent_id IS NULL
GROUP BY ec.id, ec.name, ec.slug, ec.icon, ec.sort_order
ORDER BY ec.sort_order;

-- ============================================
-- CREATE VIEW: Sentiment Distribution Analysis
-- ============================================
CREATE OR REPLACE VIEW v_rule_sentiment_analysis AS
SELECT
    ec.name as category_name,
    hr.action_config->>'sentiment' as sentiment_type,
    COUNT(*) as rule_count,
    ROUND(AVG(hr.priority)) as avg_priority,
    SUM(CASE WHEN hr.is_active THEN 1 ELSE 0 END) as active_count
FROM hospitality_rules hr
JOIN engagement_categories ec ON hr.category_id = ec.id
WHERE hr.action_config->>'sentiment' IS NOT NULL
GROUP BY ec.name, hr.action_config->>'sentiment'
ORDER BY ec.name, rule_count DESC;

-- ============================================
-- INDEX: Optimize ML-based rule queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hospitality_rules_ml_sentiment
ON hospitality_rules ((action_config->>'sentiment'))
WHERE action_config->>'sentiment' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hospitality_rules_ml_model
ON hospitality_rules ((action_config->>'ml_model'))
WHERE action_config->>'ml_model' IS NOT NULL;

-- ============================================
-- DOCUMENTATION
-- ============================================
COMMENT ON FUNCTION generate_category_engagement_rules IS 'Generates 7 ML-inspired engagement rules per root category with sentiment-aware templates';
COMMENT ON VIEW v_engagement_rules_by_category IS 'Aggregated view of engagement rules organized by category with sentiment metadata';
COMMENT ON VIEW v_rule_sentiment_analysis IS 'Analytics view showing sentiment distribution across categories and rule effectiveness';

-- Log completion
DO $$
DECLARE
    total_rules INT;
    total_categories INT;
BEGIN
    SELECT COUNT(*) INTO total_rules FROM hospitality_rules WHERE action_config->>'sentiment' IS NOT NULL;
    SELECT COUNT(DISTINCT category_id) INTO total_categories FROM hospitality_rules WHERE category_id IS NOT NULL;

    RAISE NOTICE 'Migration 062 Complete: % sentiment-aware rules across % categories', total_rules, total_categories;
END $$;
