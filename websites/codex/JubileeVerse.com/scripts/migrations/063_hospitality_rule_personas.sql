-- ============================================
-- JubileeVerse Database Schema
-- Migration 063: Hospitality Rule Personas
-- ============================================
-- Adds support for primary and secondary persona assignments per rule.
-- Primary persona (one per rule) is the default presenter.
-- Secondary personas (multiple per rule) are backup options.

-- Add primary_persona_id column to hospitality_rules if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'primary_persona_id'
    ) THEN
        ALTER TABLE hospitality_rules ADD COLUMN primary_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL;
        COMMENT ON COLUMN hospitality_rules.primary_persona_id IS 'Primary persona for this rule - the default presenter';
    END IF;
END $$;

-- ============================================
-- HOSPITALITY RULE SECONDARY PERSONAS
-- Junction table for secondary persona assignments
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_rule_secondary_personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Rule reference
    rule_id UUID NOT NULL REFERENCES hospitality_rules(id) ON DELETE CASCADE,

    -- Persona reference
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

    -- Priority order for secondary personas (lower = higher priority)
    priority INT DEFAULT 100,

    -- Selection criteria (optional - when to prefer this secondary persona)
    selection_criteria JSONB DEFAULT '{}',
    -- Example: {
    --   "user_language": "es",
    --   "user_sentiment": "anxious",
    --   "time_of_day": "night",
    --   "topic_affinity": ["prayer", "comfort"]
    -- }

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one persona can only be secondary once per rule
    CONSTRAINT hospitality_rule_secondary_personas_unique UNIQUE (rule_id, persona_id)
);

-- Create indexes for hospitality_rule_secondary_personas
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_secondary_personas_rule ON hospitality_rule_secondary_personas(rule_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_secondary_personas_persona ON hospitality_rule_secondary_personas(persona_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_rule_secondary_personas_priority ON hospitality_rule_secondary_personas(rule_id, priority);

-- ============================================
-- MIGRATE EXISTING PERSONA ASSIGNMENTS
-- ============================================
-- If rules have a legacy persona_id field, migrate to primary_persona_id
DO $$
BEGIN
    -- Check if legacy persona_id column exists on hospitality_rules
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'persona_id'
    ) THEN
        -- Copy persona_id to primary_persona_id where primary_persona_id is null
        UPDATE hospitality_rules
        SET primary_persona_id = persona_id
        WHERE primary_persona_id IS NULL AND persona_id IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get all personas for a rule (primary first, then secondaries by priority)
CREATE OR REPLACE FUNCTION get_rule_personas(p_rule_id UUID)
RETURNS TABLE (
    persona_id UUID,
    is_primary BOOLEAN,
    priority INT
) AS $$
BEGIN
    RETURN QUERY
    -- Primary persona first
    SELECT hr.primary_persona_id, TRUE::BOOLEAN, 0
    FROM hospitality_rules hr
    WHERE hr.id = p_rule_id AND hr.primary_persona_id IS NOT NULL

    UNION ALL

    -- Secondary personas by priority
    SELECT hrsp.persona_id, FALSE::BOOLEAN, hrsp.priority
    FROM hospitality_rule_secondary_personas hrsp
    WHERE hrsp.rule_id = p_rule_id
    ORDER BY priority;
END;
$$ LANGUAGE plpgsql;

-- Function to select the best persona for a rule based on context
CREATE OR REPLACE FUNCTION select_rule_persona(
    p_rule_id UUID,
    p_user_context JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_primary_persona_id UUID;
    v_selected_persona_id UUID;
    v_secondary RECORD;
BEGIN
    -- Get primary persona as default
    SELECT primary_persona_id INTO v_primary_persona_id
    FROM hospitality_rules
    WHERE id = p_rule_id;

    v_selected_persona_id := v_primary_persona_id;

    -- Check secondary personas for better match based on context
    FOR v_secondary IN
        SELECT persona_id, selection_criteria
        FROM hospitality_rule_secondary_personas
        WHERE rule_id = p_rule_id
        ORDER BY priority
    LOOP
        -- Simple matching: if user_language matches
        IF v_secondary.selection_criteria ? 'user_language'
           AND p_user_context ? 'language'
           AND v_secondary.selection_criteria->>'user_language' = p_user_context->>'language' THEN
            v_selected_persona_id := v_secondary.persona_id;
            EXIT;
        END IF;

        -- Simple matching: if time_of_day matches
        IF v_secondary.selection_criteria ? 'time_of_day'
           AND p_user_context ? 'time_of_day'
           AND v_secondary.selection_criteria->>'time_of_day' = p_user_context->>'time_of_day' THEN
            v_selected_persona_id := v_secondary.persona_id;
            EXIT;
        END IF;
    END LOOP;

    RETURN COALESCE(v_selected_persona_id, v_primary_persona_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE hospitality_rule_secondary_personas IS 'Junction table linking hospitality rules to secondary (backup) personas';
COMMENT ON COLUMN hospitality_rule_secondary_personas.priority IS 'Selection priority: lower values are preferred when choosing among secondaries';
COMMENT ON COLUMN hospitality_rule_secondary_personas.selection_criteria IS 'JSONB conditions for when to prefer this secondary persona (language, sentiment, time, topic)';
COMMENT ON FUNCTION get_rule_personas(UUID) IS 'Returns all personas for a rule with primary first, then secondaries by priority';
COMMENT ON FUNCTION select_rule_persona(UUID, JSONB) IS 'Selects the best persona for a rule based on user context, falling back to primary';
