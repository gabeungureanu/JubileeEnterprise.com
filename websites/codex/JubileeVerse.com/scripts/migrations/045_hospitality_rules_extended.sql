-- ============================================
-- JubileeVerse Database Schema
-- Migration 045: Hospitality Rules Extended
-- ============================================
-- Extends hospitality_rules with message templates, button configuration,
-- and adds hospitality_rule_events for comprehensive outcome tracking.

-- Add message template column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'message_template'
    ) THEN
        ALTER TABLE hospitality_rules ADD COLUMN message_template TEXT;
        COMMENT ON COLUMN hospitality_rules.message_template IS 'Base message template with placeholders like {{name}}, {{persona}}, {{time}}';
    END IF;
END $$;

-- Add button configuration column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'button_config'
    ) THEN
        ALTER TABLE hospitality_rules ADD COLUMN button_config JSONB DEFAULT '[]';
        COMMENT ON COLUMN hospitality_rules.button_config IS 'Array of button configs: [{text, type, action, style}]';
    END IF;
END $$;

-- Add rule_number for easy reference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'rule_number'
    ) THEN
        ALTER TABLE hospitality_rules ADD COLUMN rule_number VARCHAR(20);

        -- Generate rule numbers for existing rules
        WITH numbered AS (
            SELECT id, 'HR-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0') as new_number
            FROM hospitality_rules
        )
        UPDATE hospitality_rules SET rule_number = numbered.new_number
        FROM numbered WHERE hospitality_rules.id = numbered.id;

        -- Add unique constraint
        ALTER TABLE hospitality_rules ADD CONSTRAINT hospitality_rules_rule_number_unique UNIQUE (rule_number);
    END IF;
END $$;

-- Add category for organizing rules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'category'
    ) THEN
        ALTER TABLE hospitality_rules ADD COLUMN category VARCHAR(50) DEFAULT 'engagement';
        COMMENT ON COLUMN hospitality_rules.category IS 'Rule category: welcome, engagement, assistance, recognition, retention';
    END IF;
END $$;

-- Add personalization settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'personalization_config'
    ) THEN
        ALTER TABLE hospitality_rules ADD COLUMN personalization_config JSONB DEFAULT '{}';
        COMMENT ON COLUMN hospitality_rules.personalization_config IS 'Personalization settings: {adaptToLanguage, adaptToSentiment, adaptToHistory}';
    END IF;
END $$;

-- ============================================
-- HOSPITALITY RULE EVENTS
-- Comprehensive tracking of rule outcomes
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_rule_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Rule reference
    rule_id UUID NOT NULL REFERENCES hospitality_rules(id) ON DELETE CASCADE,
    action_id UUID REFERENCES hospitality_actions(id) ON DELETE SET NULL,

    -- User/session reference
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),

    -- Event type
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'triggered',      -- Rule was triggered
        'displayed',      -- Message was shown to user
        'button_clicked', -- User clicked a button
        'dismissed',      -- User dismissed without action
        'expired',        -- Display timed out
        'converted'       -- User took conversion action
    )),

    -- Button details (if button_clicked)
    button_index INT,
    button_text VARCHAR(100),
    button_action VARCHAR(100),

    -- Context at time of event
    context JSONB DEFAULT '{}',
    -- Example: {
    --   "page_url": "/personas/jubilee",
    --   "user_type": "visitor",
    --   "language": "en",
    --   "sentiment_score": 0.7,
    --   "time_on_site": 120,
    --   "engagement_score": 45
    -- }

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure at least one identifier
    CONSTRAINT hospitality_rule_events_has_identifier CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Create indexes for hospitality_rule_events
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_events_rule ON hospitality_rule_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_events_user ON hospitality_rule_events(user_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_events_session ON hospitality_rule_events(session_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_events_type ON hospitality_rule_events(event_type);
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_events_created ON hospitality_rule_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_events_rule_type ON hospitality_rule_events(rule_id, event_type);

-- ============================================
-- SEED DEFAULT HOSPITALITY RULES
-- ============================================
INSERT INTO hospitality_rules (
    id, name, slug, description, target_audience, category,
    trigger_conditions, action_type, action_config,
    message_template, button_config, is_active, priority, rule_number
)
VALUES
    (
        uuid_generate_v4(),
        'Welcome New Visitor',
        'welcome-new-visitor',
        'Greets first-time visitors after they have explored for a moment',
        'visitor',
        'welcome',
        '{"time_on_site_gte": 30, "page_views_gte": 2}',
        'popup',
        '{"subtype": "welcome", "persona_id": null, "title": "Welcome to JubileeVerse"}',
        'Hello! I noticed you''re exploring JubileeVerse. Would you like a quick introduction to how our AI companions can support your spiritual journey?',
        '[{"text": "Yes, please", "type": "primary", "action": "open_intro", "style": "gold"}, {"text": "Maybe later", "type": "secondary", "action": "dismiss", "style": "subtle"}]',
        true,
        100,
        'HR-0001'
    ),
    (
        uuid_generate_v4(),
        'Engagement Encouragement',
        'engagement-encouragement',
        'Encourages visitors showing interest but not yet subscribed',
        'visitor',
        'engagement',
        '{"time_on_site_gte": 120, "page_views_gte": 5, "engagement_score_gte": 40}',
        'popup',
        '{"subtype": "engagement", "title": "You seem interested!"}',
        'It looks like you''re finding value here. Our community offers deeper engagement with AI companions who remember you. Would you like to learn more?',
        '[{"text": "Tell me more", "type": "primary", "action": "open_signup", "style": "gold"}, {"text": "Not now", "type": "secondary", "action": "dismiss", "style": "subtle"}]',
        true,
        200,
        'HR-0002'
    ),
    (
        uuid_generate_v4(),
        'Prayer Companion Offer',
        'prayer-companion-offer',
        'Offers prayer support when user seems to be seeking guidance',
        'all',
        'assistance',
        '{"persona_context": "prayer", "sentiment_indicator": "seeking"}',
        'persona_message',
        '{"subtype": "assistance", "persona_id": null}',
        'I sense you might be carrying something on your heart. Would you like to take a moment for prayer together? I''m here to listen and support you.',
        '[{"text": "Pray with me", "type": "primary", "action": "open_prayer_space", "style": "gold"}, {"text": "Thank you, not now", "type": "secondary", "action": "dismiss", "style": "subtle"}]',
        true,
        150,
        'HR-0003'
    ),
    (
        uuid_generate_v4(),
        'Return Visitor Welcome Back',
        'return-visitor-welcome',
        'Welcomes back returning visitors with personalized greeting',
        'all',
        'recognition',
        '{"session_count_gte": 2, "is_return_visit": true}',
        'popup',
        '{"subtype": "recognition", "title": "Welcome back!"}',
        'Good to see you again! {{persona_name}} remembers our last conversation. Would you like to continue where we left off?',
        '[{"text": "Yes, continue", "type": "primary", "action": "open_last_conversation", "style": "gold"}, {"text": "Start fresh", "type": "secondary", "action": "open_new_chat", "style": "subtle"}]',
        true,
        50,
        'HR-0004'
    ),
    (
        uuid_generate_v4(),
        'Inactivity Check-in',
        'inactivity-checkin',
        'Gently checks in when user has been idle for a while',
        'subscriber',
        'retention',
        '{"idle_seconds_gte": 300, "has_active_conversation": true}',
        'persona_message',
        '{"subtype": "checkin", "persona_id": null}',
        'I noticed you''ve been quiet for a bit. Is there something specific you''d like to explore, or would you prefer some space right now?',
        '[{"text": "I have a question", "type": "primary", "action": "focus_input", "style": "gold"}, {"text": "Just reading", "type": "secondary", "action": "dismiss", "style": "subtle"}, {"text": "Taking a break", "type": "tertiary", "action": "pause_notifications", "style": "muted"}]',
        true,
        300,
        'HR-0005'
    )
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE hospitality_rule_events IS 'Comprehensive tracking of hospitality rule outcomes for analytics and optimization';
COMMENT ON COLUMN hospitality_rule_events.event_type IS 'Event lifecycle: triggered -> displayed -> (button_clicked|dismissed|expired) -> (converted)';
COMMENT ON COLUMN hospitality_rule_events.context IS 'Snapshot of user context at time of event for analytics';
