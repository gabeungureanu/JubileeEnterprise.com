-- ============================================
-- JubileeVerse Database Schema
-- Migration 065: Collections System
-- Comprehensive schema for managing the JubileeVerse
-- "AI Reactor Control Rods" collection system
-- ============================================

-- ============================================
-- PART 1: ENUM TYPES
-- ============================================

-- Classification sections (top-level groupings)
CREATE TYPE collection_section AS ENUM (
    'authority_and_identity',      -- Scripture, Doctrine, Governance, Persona Collections
    'orchestration_and_mediation', -- Fivefold Models, Shared Resources, Ministers
    'interaction_and_context'      -- Languages, Users, Analytics, Sessions
);

-- Collection types for different kinds of collections
CREATE TYPE collection_type AS ENUM (
    'scripture',           -- JSV Bible, Scripture references
    'doctrine',           -- Doctrinal statements, beliefs
    'governance',         -- Governance layers, policies
    'persona',            -- Individual persona collections (Jubilee, Melody, etc.)
    'fivefold',           -- Fivefold orchestration models
    'shared_resource',    -- Shared resources across personas
    'minister',           -- Minister profiles and assignments
    'language',           -- Language and localization data
    'user',               -- User-related data
    'analytics'           -- Analytics and metrics
);

-- Item types for category content
CREATE TYPE category_item_type AS ENUM (
    'activation',         -- Executable activation instructions
    'property',           -- Property-based reference information
    'event_trigger',      -- Event-triggered response logic
    'prompt',             -- System prompts or prompt modifiers
    'instruction',        -- General instructions
    'reference',          -- Reference data (links, citations)
    'metadata'            -- Metadata and configuration
);

-- ============================================
-- PART 2: COLLECTIONS TABLE
-- ============================================

-- Primary collections table - stores every collection in the system
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,

    -- Classification
    section collection_section NOT NULL,
    collection_type collection_type NOT NULL,

    -- Qdrant Export Configuration
    qdrant_collection_name VARCHAR(100),      -- Name used in Qdrant
    qdrant_vector_size INT DEFAULT 1536,       -- Vector dimension size
    qdrant_distance_metric VARCHAR(20) DEFAULT 'Cosine',

    -- Persona linkage (for persona collections)
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,

    -- Template linkage (for collections using shared structure)
    template_id UUID,  -- Self-reference, added as FK after table creation

    -- Hierarchy
    parent_collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    display_order INT DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,  -- System collections cannot be deleted

    -- Versioning for Qdrant export
    version INT DEFAULT 1,
    last_exported_at TIMESTAMPTZ,
    export_checksum VARCHAR(64),  -- SHA-256 of exported content

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add self-referencing foreign key for template
ALTER TABLE collections
ADD CONSTRAINT fk_collections_template
FOREIGN KEY (template_id) REFERENCES collections(id) ON DELETE SET NULL;

-- Indexes for collections
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_section ON collections(section);
CREATE INDEX IF NOT EXISTS idx_collections_type ON collections(collection_type);
CREATE INDEX IF NOT EXISTS idx_collections_persona ON collections(persona_id);
CREATE INDEX IF NOT EXISTS idx_collections_template ON collections(template_id);
CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_collection_id);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_collections_order ON collections(display_order);

-- ============================================
-- PART 3: CATEGORY TEMPLATES
-- ============================================

-- Category templates define reusable tree structures
-- that can be shared across multiple collections
CREATE TABLE IF NOT EXISTS category_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Template type (e.g., 'persona_stage_template')
    template_type VARCHAR(100) NOT NULL,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Versioning
    version INT DEFAULT 1,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_templates_slug ON category_templates(slug);
CREATE INDEX IF NOT EXISTS idx_category_templates_type ON category_templates(template_type);

-- ============================================
-- PART 4: COLLECTION CATEGORIES (Tree Structure)
-- ============================================

-- Collection categories with self-referencing hierarchy
-- Can be either template-based or collection-specific
CREATE TABLE IF NOT EXISTS collection_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Either belongs to a collection directly OR to a template
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    template_id UUID REFERENCES category_templates(id) ON DELETE CASCADE,

    -- Self-referencing parent for tree structure
    parent_category_id UUID REFERENCES collection_categories(id) ON DELETE CASCADE,

    -- Identity
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,

    -- Tree position
    level INT DEFAULT 0,              -- Depth in tree (0 = root)
    path TEXT,                        -- Materialized path for efficient queries (e.g., '01.04.02')
    display_order INT DEFAULT 0,

    -- For persona stages specifically
    stage_number INT,                 -- Stage 01-32 for persona stages
    domain_number INT,                -- Domain 01-24 under stages

    -- Icon/display
    icon VARCHAR(100),
    icon_color VARCHAR(20),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_expandable BOOLEAN DEFAULT TRUE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure category belongs to either collection or template, not both
    CONSTRAINT chk_category_owner CHECK (
        (collection_id IS NOT NULL AND template_id IS NULL) OR
        (collection_id IS NULL AND template_id IS NOT NULL)
    ),

    -- Unique slug within collection or template scope
    CONSTRAINT uq_category_collection_slug UNIQUE (collection_id, slug),
    CONSTRAINT uq_category_template_slug UNIQUE (template_id, slug)
);

-- Indexes for collection_categories
CREATE INDEX IF NOT EXISTS idx_collection_categories_collection ON collection_categories(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_categories_template ON collection_categories(template_id);
CREATE INDEX IF NOT EXISTS idx_collection_categories_parent ON collection_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_collection_categories_slug ON collection_categories(slug);
CREATE INDEX IF NOT EXISTS idx_collection_categories_path ON collection_categories(path);
CREATE INDEX IF NOT EXISTS idx_collection_categories_level ON collection_categories(level);
CREATE INDEX IF NOT EXISTS idx_collection_categories_stage ON collection_categories(stage_number);
CREATE INDEX IF NOT EXISTS idx_collection_categories_order ON collection_categories(display_order);

-- ============================================
-- PART 5: CATEGORY ITEMS (Content Storage)
-- ============================================

-- Stores actual content for categories
CREATE TABLE IF NOT EXISTS category_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Can belong to a template category or collection-specific override
    category_id UUID NOT NULL REFERENCES collection_categories(id) ON DELETE CASCADE,

    -- For persona-specific content linked to template categories
    -- This allows shared structure but unique content per persona
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,

    -- Item identification
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,

    -- Content type and data
    item_type category_item_type NOT NULL,
    content TEXT,                     -- Primary content (prompt text, instruction, etc.)
    content_json JSONB,               -- Structured content for complex items

    -- For activation items
    trigger_event VARCHAR(100),       -- Event that triggers this item
    trigger_conditions JSONB,         -- Conditions for activation

    -- For property items
    property_key VARCHAR(100),
    property_value TEXT,

    -- Ordering and priority
    display_order INT DEFAULT 0,
    priority INT DEFAULT 0,           -- Higher priority items processed first

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Versioning
    version INT DEFAULT 1,

    -- Qdrant export metadata
    vector_embedding_id VARCHAR(100), -- ID in Qdrant after export
    embedding_model VARCHAR(100),     -- Model used for embedding
    last_embedded_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for category_items
CREATE INDEX IF NOT EXISTS idx_category_items_category ON category_items(category_id);
CREATE INDEX IF NOT EXISTS idx_category_items_collection ON category_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_category_items_slug ON category_items(slug);
CREATE INDEX IF NOT EXISTS idx_category_items_type ON category_items(item_type);
CREATE INDEX IF NOT EXISTS idx_category_items_trigger ON category_items(trigger_event);
CREATE INDEX IF NOT EXISTS idx_category_items_order ON category_items(display_order);
CREATE INDEX IF NOT EXISTS idx_category_items_active ON category_items(is_active) WHERE is_active = TRUE;

-- ============================================
-- PART 6: PERSONA-TEMPLATE MAPPING
-- ============================================

-- Maps persona collections to template categories for content storage
-- This allows each persona to store unique content under shared template nodes
CREATE TABLE IF NOT EXISTS persona_template_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- The persona collection
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

    -- The template being used
    template_id UUID NOT NULL REFERENCES category_templates(id) ON DELETE CASCADE,

    -- Optional: specific template category override
    template_category_id UUID REFERENCES collection_categories(id) ON DELETE SET NULL,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each collection can only use each template once
    CONSTRAINT uq_persona_template UNIQUE (collection_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_template_collection ON persona_template_mappings(collection_id);
CREATE INDEX IF NOT EXISTS idx_persona_template_template ON persona_template_mappings(template_id);

-- ============================================
-- PART 7: QDRANT EXPORT TRACKING
-- ============================================

-- Tracks export history for audit and rollback
CREATE TABLE IF NOT EXISTS qdrant_export_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- What was exported
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    category_id UUID REFERENCES collection_categories(id) ON DELETE SET NULL,
    item_id UUID REFERENCES category_items(id) ON DELETE SET NULL,

    -- Export details
    export_type VARCHAR(50) NOT NULL,  -- 'full', 'incremental', 'item'
    qdrant_collection_name VARCHAR(100),
    vector_count INT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, failed
    error_message TEXT,

    -- Checksums for verification
    source_checksum VARCHAR(64),
    exported_checksum VARCHAR(64),

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_history_collection ON qdrant_export_history(collection_id);
CREATE INDEX IF NOT EXISTS idx_export_history_status ON qdrant_export_history(status);
CREATE INDEX IF NOT EXISTS idx_export_history_created ON qdrant_export_history(created_at DESC);

-- ============================================
-- PART 8: TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_collections_updated_at
    BEFORE UPDATE ON collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_templates_updated_at
    BEFORE UPDATE ON category_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_categories_updated_at
    BEFORE UPDATE ON collection_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_items_updated_at
    BEFORE UPDATE ON category_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_persona_template_mappings_updated_at
    BEFORE UPDATE ON persona_template_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 9: HELPER FUNCTIONS
-- ============================================

-- Function to get full category path
CREATE OR REPLACE FUNCTION get_category_path(category_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    current_id UUID := category_uuid;
    parent_id UUID;
    cat_name VARCHAR(200);
BEGIN
    WHILE current_id IS NOT NULL LOOP
        SELECT cc.name, cc.parent_category_id
        INTO cat_name, parent_id
        FROM collection_categories cc
        WHERE cc.id = current_id;

        IF result = '' THEN
            result := cat_name;
        ELSE
            result := cat_name || ' > ' || result;
        END IF;

        current_id := parent_id;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get all descendants of a category
CREATE OR REPLACE FUNCTION get_category_descendants(category_uuid UUID)
RETURNS TABLE(id UUID, name VARCHAR(200), level INT, path TEXT) AS $$
WITH RECURSIVE descendants AS (
    SELECT cc.id, cc.name, cc.level, cc.path
    FROM collection_categories cc
    WHERE cc.parent_category_id = category_uuid

    UNION ALL

    SELECT cc.id, cc.name, cc.level, cc.path
    FROM collection_categories cc
    INNER JOIN descendants d ON cc.parent_category_id = d.id
)
SELECT * FROM descendants ORDER BY path;
$$ LANGUAGE sql;

-- Function to update materialized path on category insert/update
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT;
    new_path TEXT;
BEGIN
    IF NEW.parent_category_id IS NULL THEN
        -- Root category
        NEW.level := 0;
        NEW.path := LPAD(NEW.display_order::TEXT, 2, '0');
    ELSE
        -- Get parent's path and level
        SELECT path, level INTO parent_path
        FROM collection_categories
        WHERE id = NEW.parent_category_id;

        NEW.level := (SELECT level + 1 FROM collection_categories WHERE id = NEW.parent_category_id);
        NEW.path := parent_path || '.' || LPAD(NEW.display_order::TEXT, 2, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_category_path
    BEFORE INSERT OR UPDATE ON collection_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_category_path();

-- ============================================
-- PART 10: VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Collections with their sections and types (human-readable)
CREATE OR REPLACE VIEW v_collections_summary AS
SELECT
    c.id,
    c.slug,
    c.name,
    c.display_name,
    c.section::TEXT AS section,
    c.collection_type::TEXT AS type,
    p.name AS persona_name,
    t.name AS template_name,
    c.is_active,
    c.version,
    c.last_exported_at,
    (SELECT COUNT(*) FROM collection_categories cc WHERE cc.collection_id = c.id) AS category_count,
    (SELECT COUNT(*) FROM category_items ci
     JOIN collection_categories cc ON ci.category_id = cc.id
     WHERE cc.collection_id = c.id OR ci.collection_id = c.id) AS item_count
FROM collections c
LEFT JOIN personas p ON c.persona_id = p.id
LEFT JOIN collections t ON c.template_id = t.id
ORDER BY c.section, c.display_order;

-- View: Category tree with full paths
CREATE OR REPLACE VIEW v_category_tree AS
SELECT
    cc.id,
    cc.collection_id,
    cc.template_id,
    cc.slug,
    cc.name,
    cc.level,
    cc.path,
    cc.stage_number,
    cc.domain_number,
    get_category_path(cc.id) AS full_path,
    cc.parent_category_id,
    pc.name AS parent_name,
    cc.is_active,
    (SELECT COUNT(*) FROM category_items ci WHERE ci.category_id = cc.id) AS item_count
FROM collection_categories cc
LEFT JOIN collection_categories pc ON cc.parent_category_id = pc.id
ORDER BY cc.path;

-- View: Persona collections with template info
CREATE OR REPLACE VIEW v_persona_collections AS
SELECT
    c.id AS collection_id,
    c.slug AS collection_slug,
    c.name AS collection_name,
    p.id AS persona_id,
    p.slug AS persona_slug,
    p.name AS persona_name,
    p.avatar_url,
    ct.id AS template_id,
    ct.name AS template_name,
    c.is_active,
    c.version,
    (SELECT COUNT(*) FROM persona_stages ps WHERE ps.persona_id = p.id) AS stage_count
FROM collections c
JOIN personas p ON c.persona_id = p.id
LEFT JOIN persona_template_mappings ptm ON ptm.collection_id = c.id
LEFT JOIN category_templates ct ON ptm.template_id = ct.id
WHERE c.collection_type = 'persona'
ORDER BY c.display_order;

-- ============================================
-- PART 11: SEED DATA - COLLECTIONS
-- ============================================

-- Insert the three section headers as parent collections (optional, for grouping)
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES
    -- Authority & Identity Section
    ('scripture-jsv', 'Scripture (JSV Jubilee Bible)', 'JSV Jubilee Bible', 'authority_and_identity', 'scripture', TRUE, 1, 'The Jubilee Standard Version Bible - Scripture collection'),
    ('doctrine', 'Doctrine', 'Doctrine & Beliefs', 'authority_and_identity', 'doctrine', TRUE, 2, 'Core doctrinal statements and beliefs'),
    ('governance', 'Governance', 'Governance Layers', 'authority_and_identity', 'governance', TRUE, 3, 'System governance and policy layers'),

    -- Orchestration & Mediation Section
    ('fivefold-apostolic', 'Fivefold: Apostolic', 'Apostolic Model', 'orchestration_and_mediation', 'fivefold', TRUE, 10, 'Apostolic orchestration model'),
    ('fivefold-prophetic', 'Fivefold: Prophetic', 'Prophetic Model', 'orchestration_and_mediation', 'fivefold', TRUE, 11, 'Prophetic orchestration model'),
    ('fivefold-evangelistic', 'Fivefold: Evangelistic', 'Evangelistic Model', 'orchestration_and_mediation', 'fivefold', TRUE, 12, 'Evangelistic orchestration model'),
    ('fivefold-pastoral', 'Fivefold: Pastoral', 'Pastoral Model', 'orchestration_and_mediation', 'fivefold', TRUE, 13, 'Pastoral orchestration model'),
    ('fivefold-teaching', 'Fivefold: Teaching', 'Teaching Model', 'orchestration_and_mediation', 'fivefold', TRUE, 14, 'Teaching orchestration model'),
    ('shared-resources', 'Shared Resources', 'Shared Resources', 'orchestration_and_mediation', 'shared_resource', TRUE, 15, 'Resources shared across all personas'),
    ('ministers', 'Ministers', 'Minister Profiles', 'orchestration_and_mediation', 'minister', TRUE, 16, 'Minister profiles and assignments'),

    -- Interaction & Context Section
    ('languages', 'Languages', 'Language Support', 'interaction_and_context', 'language', TRUE, 20, 'Language and localization data'),
    ('users', 'Users', 'User Data', 'interaction_and_context', 'user', TRUE, 21, 'User profiles and preferences'),
    ('analytics', 'Analytics', 'Analytics & Metrics', 'interaction_and_context', 'analytics', TRUE, 22, 'System analytics and metrics')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- PART 12: SEED DATA - PERSONA STAGE TEMPLATE
-- ============================================

-- Create the persona stage template
INSERT INTO category_templates (slug, name, description, template_type, version)
VALUES (
    'persona-stage-template',
    'Persona Stage Template',
    'Standard template for persona progression stages (Stage 01-32) with 24 domain categories per stage',
    'persona_stage',
    1
)
ON CONFLICT (slug) DO NOTHING;

-- Create the 24 domain categories under the template
DO $$
DECLARE
    template_uuid UUID;
    domain_data JSONB := '[
        {"num": 1, "id": "01_Activations", "name": "Activations", "children": ["Authority_Changes", "Responsibility_Expansion", "Tone_and_Voice_Adjustments", "Permission_Grants", "Feature_Enablements", "Stage_Activation_Manifest"]},
        {"num": 2, "id": "02_Lived_Experiences", "name": "Lived Experiences", "children": ["Formative_Events", "Milestone_Moments", "Relational_History", "Cultural_Exposure", "Failure_and_Recovery_Patterns", "Joy_and_Celebration_History"]},
        {"num": 3, "id": "03_Environmental_and_Contextual_Formation", "name": "Environmental and Contextual Formation", "children": ["Family_of_Origin", "Social_Context", "Economic_Background", "Geographic_and_Cultural_Setting", "Educational_Background", "Vocational_History"]},
        {"num": 4, "id": "04_Core_Memories", "name": "Core Memories", "children": ["Narrative_Memories", "Emotional_Memories", "Spiritual_Milestone_Memories", "Wisdom_Forming_Memories", {"id": "Mementos_and_Artifacts", "name": "Mementos & Artifacts", "children": ["Symbolic_Objects", "Images_and_Visual_Anchors", "Scripture_Anchors"]}]},
        {"num": 5, "id": "05_Abilities_and_Skills", "name": "Abilities and Skills", "children": ["Intellectual_Strengths", "Practical_Skills", "Interpersonal_Abilities", "Spiritual_Gifts", "Creative_Talents", "Leadership_Competencies", "Adaptive_Coping_Skills"]},
        {"num": 6, "id": "06_Knowledge_and_Properties", "name": "Knowledge and Properties", "children": ["Theological_Knowledge", "Scriptural_Familiarity", "Cultural_Awareness", "Practical_Wisdom", "Historical_and_Contextual_Knowledge", "Self_Knowledge"]},
        {"num": 7, "id": "07_Emotional_Maturity", "name": "Emotional Maturity", "children": ["Emotional_Regulation", "Empathy_and_Compassion", "Resilience", "Vulnerability", "Healthy_Boundaries"]},
        {"num": 8, "id": "08_Character_Formation", "name": "Character Formation", "children": ["Integrity_and_Honesty", "Patience_and_Longsuffering", "Courage_and_Boldness", "Faithfulness", "Self_Control"]},
        {"num": 9, "id": "09_Personality_Expression", "name": "Personality Expression", "children": ["Temperament", "Communication_Style", "Humor_and_Playfulness", "Expressiveness", "Social_Energy"]},
        {"num": 10, "id": "10_Quirks_and_Human_Texture", "name": "Quirks and Human Texture", "children": ["Unique_Habits", "Personal_Preferences", "Aesthetic_Sensibilities", "Speech_Patterns_and_Idioms", "Comfort_and_Discomfort_Triggers"]},
        {"num": 11, "id": "11_Social_and_Relational_Wisdom", "name": "Social and Relational Wisdom", "children": ["Conflict_Resolution", "Relational_Priorities", "Boundaries_in_Relationships", "Mentorship_and_Guidance", "Community_Belonging"]},
        {"num": 12, "id": "12_Spiritual_Identity_and_Calling", "name": "Spiritual Identity and Calling", "children": ["Sense_of_Calling", "Identity_in_Christ", "Spiritual_Disciplines", "Worship_Orientation", "Mission_Awareness"]},
        {"num": 13, "id": "13_Discernment_and_Wisdom_Growth", "name": "Discernment and Wisdom Growth", "children": ["Moral_Reasoning", "Contextual_Sensitivity", "Prophetic_Awareness", "Teachability", "Decision_Making_Maturity"]},
        {"num": 14, "id": "14_Sanctification_and_Transformation", "name": "Sanctification and Transformation", "children": ["Areas_of_Growth", "Besetting_Struggles", "Victories_and_Breakthroughs", "Accountability_Structures", "Transformation_Narratives"]},
        {"num": 15, "id": "15_Humility_and_Teachability", "name": "Humility and Teachability", "children": ["Openness_to_Correction", "Submission_to_Scripture", "Servant_Heart_Posture", "Listening_and_Stillness", "Dependence_on_God"]},
        {"num": 16, "id": "16_Miscellaneous_Metadata", "name": "Miscellaneous Metadata", "children": ["Versioning", "Confidence_Scores", "Activation_Dependencies", "Deprecated_Flags", "Audit_and_Change_Log", "Vector_Index_Metadata"]},
        {"num": 17, "id": "17_Conscience", "name": "Conscience", "children": ["Internal_Voice", "Moral_Alignment", "Self_Awareness", "Private_Reflections", "Internal_Decision_Making", "Convictions_and_Commitments", "Intentions_and_Motives", "Dreams_and_Imaginal_Life"]},
        {"num": 18, "id": "18_Financial_Stewardship", "name": "Financial Stewardship", "children": ["Resource_Mindset", "Temperance_and_Contentment", "Provision_and_Trust", "Planning_and_Budgeting", "Generosity_and_Giving", "Risk_and_Responsibility", "Wealth_and_Purpose"]},
        {"num": 19, "id": "19_Physical_Wellbeing", "name": "Physical Wellbeing", "children": ["Energy_and_Vitality", "Rest_and_Recovery", "Discipline_and_Care", "Limits_and_Endurance"]},
        {"num": 20, "id": "20_Vocational_and_Work_Life", "name": "Vocational and Work Life", "children": ["Calling_in_Work", "Excellence_and_Diligence", "Service_and_Contribution", "Boundaries_in_Labor"]},
        {"num": 21, "id": "21_Rhythm_and_Rest", "name": "Rhythm and Rest", "children": ["Daily_Rhythms", "Seasonal_Rhythms", "Sabbath_and_Pause", "Balance_and_Sustainability"]},
        {"num": 22, "id": "22_Creativity_and_Imagination", "name": "Creativity and Imagination", "children": ["Creative_Vision", "Symbolic_Thinking", "Innovation_and_Play", "Artistic_Expression"]},
        {"num": 23, "id": "23_Decision_and_Choice_History", "name": "Decision and Choice History", "children": ["Major_Decisions", "Patterned_Choices", "Learned_Lessons", "Outcome_Reflections"]},
        {"num": 24, "id": "24_Covenants_and_Long_Term_Commitments", "name": "Covenants and Long-Term Commitments", "children": ["Promises_Made", "Promises_Kept", "Relational_Covenants", "Mission_Commitments"]}
    ]';
    domain_record JSONB;
    domain_uuid UUID;
    child_value JSONB;
    child_name TEXT;
    child_order INT;
    nested_parent_uuid UUID;
    nested_child JSONB;
    nested_child_name TEXT;
    nested_order INT;
BEGIN
    -- Get template ID
    SELECT id INTO template_uuid FROM category_templates WHERE slug = 'persona-stage-template';

    -- Iterate through domains
    FOR domain_record IN SELECT * FROM jsonb_array_elements(domain_data) LOOP
        -- Insert domain category
        INSERT INTO collection_categories (
            template_id, slug, name, display_name, level, display_order, domain_number, icon, icon_color
        ) VALUES (
            template_uuid,
            domain_record->>'id',
            domain_record->>'name',
            domain_record->>'name',
            0,
            (domain_record->>'num')::INT,
            (domain_record->>'num')::INT,
            'folder',
            '#ffbd59'
        )
        RETURNING id INTO domain_uuid;

        -- Insert children
        child_order := 1;
        FOR child_value IN SELECT * FROM jsonb_array_elements(domain_record->'children') LOOP
            -- Check if child is a string or object (for nested children like Mementos_and_Artifacts)
            IF jsonb_typeof(child_value) = 'string' THEN
                child_name := child_value #>> '{}';
                INSERT INTO collection_categories (
                    template_id, parent_category_id, slug, name, display_name, level, display_order, icon, icon_color
                ) VALUES (
                    template_uuid,
                    domain_uuid,
                    child_name,
                    REPLACE(child_name, '_', ' '),
                    REPLACE(child_name, '_', ' '),
                    1,
                    child_order,
                    'folder',
                    '#ffbd59'
                );
            ELSE
                -- This is a nested parent (like Mementos_and_Artifacts)
                INSERT INTO collection_categories (
                    template_id, parent_category_id, slug, name, display_name, level, display_order, icon, icon_color, is_expandable
                ) VALUES (
                    template_uuid,
                    domain_uuid,
                    child_value->>'id',
                    child_value->>'name',
                    child_value->>'name',
                    1,
                    child_order,
                    'folder',
                    '#ffbd59',
                    TRUE
                )
                RETURNING id INTO nested_parent_uuid;

                -- Insert nested children
                nested_order := 1;
                FOR nested_child IN SELECT * FROM jsonb_array_elements(child_value->'children') LOOP
                    nested_child_name := nested_child #>> '{}';
                    INSERT INTO collection_categories (
                        template_id, parent_category_id, slug, name, display_name, level, display_order, icon, icon_color
                    ) VALUES (
                        template_uuid,
                        nested_parent_uuid,
                        nested_child_name,
                        REPLACE(nested_child_name, '_', ' '),
                        REPLACE(nested_child_name, '_', ' '),
                        2,
                        nested_order,
                        'folder',
                        '#ffbd59'
                    );
                    nested_order := nested_order + 1;
                END LOOP;
            END IF;
            child_order := child_order + 1;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- PART 13: SEED DATA - PERSONA COLLECTIONS
-- ============================================

-- Insert persona collections for the 13 Inspire Family personas (including Gabriel)
DO $$
DECLARE
    persona_record RECORD;
    collection_uuid UUID;
    template_uuid UUID;
    display_ord INT := 100;
BEGIN
    -- Get template ID
    SELECT id INTO template_uuid FROM category_templates WHERE slug = 'persona-stage-template';

    -- First, ensure Gabriel Inspire exists in personas table
    INSERT INTO personas (slug, name, title, avatar_url, short_bio, system_prompt, is_featured, is_active)
    VALUES (
        'gabriel',
        'Gabriel Inspire',
        'Messenger & Announcer',
        '/images/personas/gabriel.png',
        'Bringing divine messages with clarity and purpose',
        'You are Gabriel, a messenger persona who communicates with clarity, authority, and grace.',
        TRUE,
        TRUE
    )
    ON CONFLICT (slug) DO NOTHING;

    -- Create collections for each Inspire Family persona
    FOR persona_record IN
        SELECT id, slug, name
        FROM personas
        WHERE slug IN (
            'jubilee', 'melody', 'zariah', 'elias', 'eliana', 'caleb',
            'imani', 'zev', 'amir', 'nova', 'santiago', 'tahoma', 'gabriel'
        )
        ORDER BY
            CASE slug
                WHEN 'jubilee' THEN 1
                WHEN 'gabriel' THEN 2
                WHEN 'melody' THEN 3
                WHEN 'zariah' THEN 4
                WHEN 'elias' THEN 5
                WHEN 'eliana' THEN 6
                WHEN 'caleb' THEN 7
                WHEN 'imani' THEN 8
                WHEN 'zev' THEN 9
                WHEN 'amir' THEN 10
                WHEN 'nova' THEN 11
                WHEN 'santiago' THEN 12
                WHEN 'tahoma' THEN 13
                ELSE 99
            END
    LOOP
        -- Create collection for this persona
        INSERT INTO collections (
            slug, name, display_name, section, collection_type,
            persona_id, qdrant_collection_name, display_order, is_system, description
        ) VALUES (
            'persona-' || persona_record.slug,
            persona_record.name,
            persona_record.name,
            'authority_and_identity',
            'persona',
            persona_record.id,
            'persona_' || persona_record.slug,
            display_ord,
            FALSE,
            'Collection for ' || persona_record.name || ' persona progression and personality data'
        )
        ON CONFLICT (slug) DO UPDATE SET
            persona_id = EXCLUDED.persona_id,
            updated_at = NOW()
        RETURNING id INTO collection_uuid;

        -- Link to persona stage template
        INSERT INTO persona_template_mappings (collection_id, template_id)
        VALUES (collection_uuid, template_uuid)
        ON CONFLICT (collection_id, template_id) DO NOTHING;

        display_ord := display_ord + 1;
    END LOOP;
END $$;

-- ============================================
-- PART 14: SEED DATA - CREATE STAGES FOR EACH PERSONA COLLECTION
-- ============================================

-- Create Stage 01-32 categories for each persona collection
DO $$
DECLARE
    collection_record RECORD;
    stage_num INT;
    stage_uuid UUID;
BEGIN
    FOR collection_record IN
        SELECT c.id, c.slug, p.name AS persona_name
        FROM collections c
        JOIN personas p ON c.persona_id = p.id
        WHERE c.collection_type = 'persona'
    LOOP
        FOR stage_num IN 1..32 LOOP
            INSERT INTO collection_categories (
                collection_id,
                slug,
                name,
                display_name,
                level,
                display_order,
                stage_number,
                icon,
                icon_color,
                is_expandable
            ) VALUES (
                collection_record.id,
                'stage-' || LPAD(stage_num::TEXT, 2, '0'),
                'Stage ' || LPAD(stage_num::TEXT, 2, '0'),
                'Stage ' || LPAD(stage_num::TEXT, 2, '0'),
                0,
                stage_num,
                stage_num,
                'dot',
                '#ffbd59',
                TRUE
            )
            ON CONFLICT (collection_id, slug) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- PART 15: COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE collections IS 'Primary collections table storing all JubileeVerse collections including Scripture, Doctrine, Governance, Personas, Fivefold models, and more';
COMMENT ON TABLE category_templates IS 'Reusable category tree templates that can be shared across multiple collections';
COMMENT ON TABLE collection_categories IS 'Self-referencing category tree with unlimited nesting depth, scoped to either a collection or template';
COMMENT ON TABLE category_items IS 'Content storage for categories including prompts, instructions, properties, and event triggers';
COMMENT ON TABLE persona_template_mappings IS 'Links persona collections to templates, enabling shared structure with unique content';
COMMENT ON TABLE qdrant_export_history IS 'Audit trail for Qdrant exports, enabling verification and rollback';

COMMENT ON COLUMN collections.section IS 'Top-level classification: authority_and_identity, orchestration_and_mediation, or interaction_and_context';
COMMENT ON COLUMN collections.template_id IS 'Reference to a template collection for shared structure';
COMMENT ON COLUMN collection_categories.path IS 'Materialized path for efficient tree queries (e.g., 01.04.02)';
COMMENT ON COLUMN category_items.item_type IS 'Type of content: activation, property, event_trigger, prompt, instruction, reference, or metadata';
