-- ============================================
-- JubileeVerse Database Schema
-- Migration 094: Flywheel Collections System
-- Creates flywheel_collections and flywheel_collection_categories tables
-- Duplicating the structure of collections and collection_categories
-- ============================================

-- ============================================
-- PART 1: FLYWHEEL COLLECTIONS TABLE
-- ============================================

-- Primary flywheel collections table - mirrors collections table structure
CREATE TABLE IF NOT EXISTS flywheel_collections (
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
    parent_collection_id UUID REFERENCES flywheel_collections(id) ON DELETE SET NULL,
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
ALTER TABLE flywheel_collections
ADD CONSTRAINT fk_flywheel_collections_template
FOREIGN KEY (template_id) REFERENCES flywheel_collections(id) ON DELETE SET NULL;

-- Indexes for flywheel_collections
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_slug ON flywheel_collections(slug);
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_section ON flywheel_collections(section);
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_type ON flywheel_collections(collection_type);
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_persona ON flywheel_collections(persona_id);
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_template ON flywheel_collections(template_id);
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_parent ON flywheel_collections(parent_collection_id);
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_active ON flywheel_collections(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_order ON flywheel_collections(display_order);

-- ============================================
-- PART 2: FLYWHEEL COLLECTION CATEGORIES TABLE
-- ============================================

-- Flywheel collection categories with self-referencing hierarchy
-- Mirrors collection_categories structure
CREATE TABLE IF NOT EXISTS flywheel_collection_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Either belongs to a flywheel collection directly OR to a template
    collection_id UUID REFERENCES flywheel_collections(id) ON DELETE CASCADE,
    template_id UUID REFERENCES category_templates(id) ON DELETE CASCADE,

    -- Self-referencing parent for tree structure
    parent_category_id UUID REFERENCES flywheel_collection_categories(id) ON DELETE CASCADE,

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
    CONSTRAINT chk_flywheel_category_owner CHECK (
        (collection_id IS NOT NULL AND template_id IS NULL) OR
        (collection_id IS NULL AND template_id IS NOT NULL)
    ),

    -- Unique slug within collection or template scope
    CONSTRAINT uq_flywheel_category_collection_slug UNIQUE (collection_id, slug),
    CONSTRAINT uq_flywheel_category_template_slug UNIQUE (template_id, slug)
);

-- Indexes for flywheel_collection_categories
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_collection ON flywheel_collection_categories(collection_id);
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_template ON flywheel_collection_categories(template_id);
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_parent ON flywheel_collection_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_slug ON flywheel_collection_categories(slug);
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_path ON flywheel_collection_categories(path);
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_level ON flywheel_collection_categories(level);
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_stage ON flywheel_collection_categories(stage_number);
CREATE INDEX IF NOT EXISTS idx_flywheel_collection_categories_order ON flywheel_collection_categories(display_order);

-- ============================================
-- PART 3: TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_flywheel_collections_updated_at
    BEFORE UPDATE ON flywheel_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flywheel_collection_categories_updated_at
    BEFORE UPDATE ON flywheel_collection_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 4: PATH UPDATE FUNCTION FOR FLYWHEEL CATEGORIES
-- ============================================

-- Function to update materialized path on flywheel category insert/update
CREATE OR REPLACE FUNCTION update_flywheel_category_path()
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
        FROM flywheel_collection_categories
        WHERE id = NEW.parent_category_id;

        NEW.level := (SELECT level + 1 FROM flywheel_collection_categories WHERE id = NEW.parent_category_id);
        NEW.path := parent_path || '.' || LPAD(NEW.display_order::TEXT, 2, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_flywheel_category_path
    BEFORE INSERT OR UPDATE ON flywheel_collection_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_flywheel_category_path();

-- ============================================
-- PART 5: HELPER FUNCTIONS
-- ============================================

-- Function to get full flywheel category path
CREATE OR REPLACE FUNCTION get_flywheel_category_path(category_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    current_id UUID := category_uuid;
    parent_id UUID;
    cat_name VARCHAR(200);
BEGIN
    WHILE current_id IS NOT NULL LOOP
        SELECT fcc.name, fcc.parent_category_id
        INTO cat_name, parent_id
        FROM flywheel_collection_categories fcc
        WHERE fcc.id = current_id;

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

-- Function to get all descendants of a flywheel category
CREATE OR REPLACE FUNCTION get_flywheel_category_descendants(category_uuid UUID)
RETURNS TABLE(id UUID, name VARCHAR(200), level INT, path TEXT) AS $$
WITH RECURSIVE descendants AS (
    SELECT fcc.id, fcc.name, fcc.level, fcc.path
    FROM flywheel_collection_categories fcc
    WHERE fcc.parent_category_id = category_uuid

    UNION ALL

    SELECT fcc.id, fcc.name, fcc.level, fcc.path
    FROM flywheel_collection_categories fcc
    INNER JOIN descendants d ON fcc.parent_category_id = d.id
)
SELECT * FROM descendants ORDER BY path;
$$ LANGUAGE sql;

-- ============================================
-- PART 6: VIEWS
-- ============================================

-- View: Flywheel collections with their sections and types (human-readable)
CREATE OR REPLACE VIEW v_flywheel_collections_summary AS
SELECT
    fc.id,
    fc.slug,
    fc.name,
    fc.display_name,
    fc.section::TEXT AS section,
    fc.collection_type::TEXT AS type,
    p.name AS persona_name,
    t.name AS template_name,
    fc.is_active,
    fc.version,
    fc.last_exported_at,
    (SELECT COUNT(*) FROM flywheel_collection_categories fcc WHERE fcc.collection_id = fc.id) AS category_count
FROM flywheel_collections fc
LEFT JOIN personas p ON fc.persona_id = p.id
LEFT JOIN flywheel_collections t ON fc.template_id = t.id
ORDER BY fc.section, fc.display_order;

-- View: Flywheel category tree with full paths
CREATE OR REPLACE VIEW v_flywheel_category_tree AS
SELECT
    fcc.id,
    fcc.collection_id,
    fcc.template_id,
    fcc.slug,
    fcc.name,
    fcc.level,
    fcc.path,
    fcc.stage_number,
    fcc.domain_number,
    get_flywheel_category_path(fcc.id) AS full_path,
    fcc.parent_category_id,
    pfc.name AS parent_name,
    fcc.is_active
FROM flywheel_collection_categories fcc
LEFT JOIN flywheel_collection_categories pfc ON fcc.parent_category_id = pfc.id
ORDER BY fcc.path;

-- ============================================
-- PART 7: COMMENTS
-- ============================================

COMMENT ON TABLE flywheel_collections IS 'Flywheel collections table - mirrors structure of collections table for Flywheel system';
COMMENT ON TABLE flywheel_collection_categories IS 'Flywheel collection categories - self-referencing category tree for flywheel collections';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 094 complete: flywheel_collections and flywheel_collection_categories tables created';
END $$;
