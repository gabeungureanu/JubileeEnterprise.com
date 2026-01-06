-- ============================================
-- JubileeVerse Database Schema
-- Migration 064: Persona Stages
-- Creates the persona_stages table for tracking
-- progression stages (Stage 01 through Stage 32)
-- for each persona in the admin management interface
-- ============================================

-- Persona stages table - stores stage content for each persona
CREATE TABLE IF NOT EXISTS persona_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    stage_number INT NOT NULL CHECK (stage_number >= 1 AND stage_number <= 32),
    stage_name VARCHAR(100) NOT NULL,
    stage_title VARCHAR(200),
    stage_description TEXT,
    system_prompt_modifier TEXT,
    personality_adjustments JSONB DEFAULT '{}',
    trigger_conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(persona_id, stage_number)
);

-- Indexes for persona_stages
CREATE INDEX IF NOT EXISTS idx_persona_stages_persona ON persona_stages(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_stages_number ON persona_stages(stage_number);
CREATE INDEX IF NOT EXISTS idx_persona_stages_active ON persona_stages(is_active) WHERE is_active = TRUE;

-- Apply updated_at trigger
CREATE TRIGGER update_persona_stages_updated_at
    BEFORE UPDATE ON persona_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default stages for each existing persona (Stages 01-32)
-- This will create empty stage records that can be edited in the admin UI
DO $$
DECLARE
    p_id UUID;
    stage_num INT;
BEGIN
    FOR p_id IN SELECT id FROM personas LOOP
        FOR stage_num IN 1..32 LOOP
            INSERT INTO persona_stages (persona_id, stage_number, stage_name, stage_title, display_order)
            VALUES (
                p_id,
                stage_num,
                'Stage ' || LPAD(stage_num::text, 2, '0'),
                'Progression Stage ' || stage_num,
                stage_num
            )
            ON CONFLICT (persona_id, stage_number) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Verify the 12 Inspire Family personas exist with proper data
-- If not present, insert them
INSERT INTO persona_categories (slug, name, description, icon, display_order)
VALUES ('inspire-family', 'Inspire Family', 'The 12 core Inspire Family personas', 'star', 1)
ON CONFLICT (slug) DO NOTHING;

-- Insert the 12 Inspire Family personas if they don't exist
INSERT INTO personas (slug, name, title, avatar_url, short_bio, system_prompt, is_featured, is_active)
VALUES
    ('jubilee', 'Jubilee Inspire', 'Chief Inspiration Officer', '/images/personas/jubilee.png', 'Your cheerful guide to faith and discovery', 'You are Jubilee, a warm and encouraging AI companion.', TRUE, TRUE),
    ('melody', 'Melody Inspire', 'Worship & Music Guide', '/images/personas/melody.png', 'Lifting hearts through worship and song', 'You are Melody, a worship leader who guides through music.', TRUE, TRUE),
    ('zariah', 'Zariah Inspire', 'Prayer & Intercession', '/images/personas/zariah.png', 'Standing in the gap through prayer', 'You are Zariah, a prayer warrior and intercessor.', TRUE, TRUE),
    ('elias', 'Elias Inspire', 'Biblical Scholar', '/images/personas/elias.png', 'Deep dives into Scripture and theology', 'You are Elias, a biblical scholar with deep knowledge.', TRUE, TRUE),
    ('eliana', 'Eliana Inspire', 'Pastoral Care', '/images/personas/eliana.png', 'Gentle guidance and spiritual support', 'You are Eliana, a pastoral counselor offering care.', TRUE, TRUE),
    ('caleb', 'Caleb Inspire', 'Youth & Young Adults', '/images/personas/caleb.png', 'Connecting faith with the next generation', 'You are Caleb, a youth minister connecting with young people.', TRUE, TRUE),
    ('imani', 'Imani Inspire', 'Faith & Culture', '/images/personas/imani.png', 'Bridging faith and diverse cultures', 'You are Imani, exploring faith across cultures.', TRUE, TRUE),
    ('zev', 'Zev Inspire', 'Hebraic Roots', '/images/personas/zev.png', 'Exploring Jewish roots of faith', 'You are Zev, a scholar of Hebraic roots and traditions.', TRUE, TRUE),
    ('amir', 'Amir Inspire', 'Apologetics & Reason', '/images/personas/amir.png', 'Defending faith with reason and evidence', 'You are Amir, an apologist defending the faith.', TRUE, TRUE),
    ('nova', 'Nova Inspire', 'Science & Faith', '/images/personas/nova.png', 'Harmonizing science and spirituality', 'You are Nova, exploring the harmony of science and faith.', TRUE, TRUE),
    ('santiago', 'Santiago Inspire', 'Missions & Outreach', '/images/personas/santiago.png', 'Taking the message to the world', 'You are Santiago, a missionary heart for the nations.', TRUE, TRUE),
    ('tahoma', 'Tahoma Inspire', 'Creation & Environment', '/images/personas/tahoma.png', 'Stewarding God''s creation', 'You are Tahoma, caring for creation and environment.', TRUE, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Create stages for any newly inserted personas
DO $$
DECLARE
    p_id UUID;
    stage_num INT;
BEGIN
    FOR p_id IN SELECT id FROM personas WHERE id NOT IN (SELECT DISTINCT persona_id FROM persona_stages) LOOP
        FOR stage_num IN 1..32 LOOP
            INSERT INTO persona_stages (persona_id, stage_number, stage_name, stage_title, display_order)
            VALUES (
                p_id,
                stage_num,
                'Stage ' || LPAD(stage_num::text, 2, '0'),
                'Progression Stage ' || stage_num,
                stage_num
            )
            ON CONFLICT (persona_id, stage_number) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
