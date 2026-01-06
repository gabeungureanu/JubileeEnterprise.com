-- ============================================
-- JubileeVerse Database Schema
-- Migration 068: Collection Capacity Metrics
-- Neural Capacity calculation and tracking for collections
-- ============================================

-- ============================================
-- PART 1: CAPACITY METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS collection_capacity_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Collection reference
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

    -- Calculation timestamp
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unit counts by functional group
    executable_units INT NOT NULL DEFAULT 0,      -- Activation logic, instructions
    event_reactive_units INT NOT NULL DEFAULT 0,  -- Conditional/trigger-based logic
    reference_units INT NOT NULL DEFAULT 0,       -- Properties, guidelines, definitions
    governance_units INT NOT NULL DEFAULT 0,      -- Guardrails, constraints, authority

    -- Calculated totals
    total_vectors_raw INT NOT NULL DEFAULT 0,     -- Sum of all units
    expanded_estimate DECIMAL(10, 2),             -- With expansion multipliers applied

    -- Expansion multipliers used (for audit)
    multiplier_executable DECIMAL(4, 2) DEFAULT 1.2,
    multiplier_event_reactive DECIMAL(4, 2) DEFAULT 1.3,
    multiplier_reference DECIMAL(4, 2) DEFAULT 1.0,
    multiplier_governance DECIMAL(4, 2) DEFAULT 1.1,

    -- Metadata
    calculation_version INT NOT NULL DEFAULT 1,
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_capacity_metrics_collection ON collection_capacity_metrics(collection_id);
CREATE INDEX IF NOT EXISTS idx_capacity_metrics_calculated ON collection_capacity_metrics(calculated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capacity_metrics_latest ON collection_capacity_metrics(collection_id, calculated_at DESC);

-- ============================================
-- PART 2: ITEM TYPE TO FUNCTIONAL GROUP MAPPING
-- ============================================

-- This table maps category_item_type enum values to functional groups
CREATE TABLE IF NOT EXISTS item_type_functional_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_type VARCHAR(50) NOT NULL UNIQUE,
    functional_group VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the mapping
INSERT INTO item_type_functional_mapping (item_type, functional_group, description) VALUES
    ('activation', 'executable', 'Activation logic and instructions intended to run during persona or family activation'),
    ('instruction', 'executable', 'Direct executable instructions'),
    ('event_trigger', 'event_reactive', 'Conditional logic that responds to triggers or situations'),
    ('property', 'reference', 'Descriptive or informational content such as properties and definitions'),
    ('reference', 'reference', 'Reference data including links and citations'),
    ('prompt', 'reference', 'Prompt templates and response patterns'),
    ('metadata', 'governance', 'Configuration and governance metadata')
ON CONFLICT (item_type) DO UPDATE SET
    functional_group = EXCLUDED.functional_group,
    description = EXCLUDED.description;

-- ============================================
-- PART 3: CAPACITY CALCULATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_collection_capacity(
    p_collection_slug VARCHAR(100),
    p_calculation_version INT DEFAULT 1,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    collection_name VARCHAR(200),
    executable_units INT,
    event_reactive_units INT,
    reference_units INT,
    governance_units INT,
    total_vectors_raw INT,
    expanded_estimate DECIMAL(10, 2),
    metric_id UUID
) AS $$
DECLARE
    v_collection_id UUID;
    v_collection_name VARCHAR(200);
    v_executable INT := 0;
    v_event_reactive INT := 0;
    v_reference INT := 0;
    v_governance INT := 0;
    v_total_raw INT := 0;
    v_expanded DECIMAL(10, 2) := 0;
    v_metric_id UUID;

    -- Expansion multipliers
    c_mult_executable DECIMAL(4, 2) := 1.2;
    c_mult_event_reactive DECIMAL(4, 2) := 1.3;
    c_mult_reference DECIMAL(4, 2) := 1.0;
    c_mult_governance DECIMAL(4, 2) := 1.1;
BEGIN
    -- Step 1: Resolve collection_id from slug
    SELECT c.id, c.name INTO v_collection_id, v_collection_name
    FROM collections c
    WHERE c.slug = p_collection_slug;

    IF v_collection_id IS NULL THEN
        RAISE EXCEPTION 'Collection with slug "%" not found', p_collection_slug;
    END IF;

    -- Step 2: Count items by functional group
    -- Query all category_items associated with this collection's categories
    -- or directly linked to the collection

    -- Executable Units (activation, instruction)
    SELECT COUNT(*) INTO v_executable
    FROM category_items ci
    JOIN collection_categories cc ON ci.category_id = cc.id
    WHERE cc.collection_id = v_collection_id
      AND ci.item_type::TEXT IN ('activation', 'instruction');

    -- Also count items directly linked to collection
    SELECT v_executable + COUNT(*) INTO v_executable
    FROM category_items ci
    WHERE ci.collection_id = v_collection_id
      AND ci.item_type::TEXT IN ('activation', 'instruction');

    -- Event-Reactive Units (event_trigger)
    SELECT COUNT(*) INTO v_event_reactive
    FROM category_items ci
    JOIN collection_categories cc ON ci.category_id = cc.id
    WHERE cc.collection_id = v_collection_id
      AND ci.item_type::TEXT = 'event_trigger';

    SELECT v_event_reactive + COUNT(*) INTO v_event_reactive
    FROM category_items ci
    WHERE ci.collection_id = v_collection_id
      AND ci.item_type::TEXT = 'event_trigger';

    -- Reference Units (property, reference, prompt)
    SELECT COUNT(*) INTO v_reference
    FROM category_items ci
    JOIN collection_categories cc ON ci.category_id = cc.id
    WHERE cc.collection_id = v_collection_id
      AND ci.item_type::TEXT IN ('property', 'reference', 'prompt');

    SELECT v_reference + COUNT(*) INTO v_reference
    FROM category_items ci
    WHERE ci.collection_id = v_collection_id
      AND ci.item_type::TEXT IN ('property', 'reference', 'prompt');

    -- Governance Units (metadata - treating sealed/irrevocable items as governance)
    SELECT COUNT(*) INTO v_governance
    FROM category_items ci
    JOIN collection_categories cc ON ci.category_id = cc.id
    WHERE cc.collection_id = v_collection_id
      AND ci.item_type::TEXT = 'metadata';

    SELECT v_governance + COUNT(*) INTO v_governance
    FROM category_items ci
    WHERE ci.collection_id = v_collection_id
      AND ci.item_type::TEXT = 'metadata';

    -- Also count sealed items as governance (they enforce constraints)
    SELECT v_governance + COUNT(*) INTO v_governance
    FROM category_items ci
    JOIN collection_categories cc ON ci.category_id = cc.id
    WHERE cc.collection_id = v_collection_id
      AND (ci.metadata->>'sealed')::BOOLEAN = TRUE
      AND ci.item_type::TEXT NOT IN ('metadata');

    -- Step 3: Calculate totals
    v_total_raw := v_executable + v_event_reactive + v_reference + v_governance;

    -- Step 4: Apply expansion multipliers
    v_expanded := (v_executable * c_mult_executable) +
                  (v_event_reactive * c_mult_event_reactive) +
                  (v_reference * c_mult_reference) +
                  (v_governance * c_mult_governance);

    -- Step 5: Persist metrics
    INSERT INTO collection_capacity_metrics (
        collection_id,
        executable_units,
        event_reactive_units,
        reference_units,
        governance_units,
        total_vectors_raw,
        expanded_estimate,
        multiplier_executable,
        multiplier_event_reactive,
        multiplier_reference,
        multiplier_governance,
        calculation_version,
        notes,
        metadata
    ) VALUES (
        v_collection_id,
        v_executable,
        v_event_reactive,
        v_reference,
        v_governance,
        v_total_raw,
        v_expanded,
        c_mult_executable,
        c_mult_event_reactive,
        c_mult_reference,
        c_mult_governance,
        p_calculation_version,
        p_notes,
        jsonb_build_object(
            'collection_slug', p_collection_slug,
            'calculated_by', 'calculate_collection_capacity',
            'timestamp', NOW()
        )
    )
    RETURNING id INTO v_metric_id;

    -- Return results
    RETURN QUERY SELECT
        v_collection_name,
        v_executable,
        v_event_reactive,
        v_reference,
        v_governance,
        v_total_raw,
        v_expanded,
        v_metric_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 4: HELPER FUNCTION TO GET LATEST METRICS
-- ============================================

CREATE OR REPLACE FUNCTION get_collection_capacity(p_collection_slug VARCHAR(100))
RETURNS TABLE(
    collection_name VARCHAR(200),
    collection_slug VARCHAR(100),
    executable_units INT,
    event_reactive_units INT,
    reference_units INT,
    governance_units INT,
    total_vectors_raw INT,
    expanded_estimate DECIMAL(10, 2),
    calculated_at TIMESTAMPTZ,
    calculation_version INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.name,
        c.slug,
        ccm.executable_units,
        ccm.event_reactive_units,
        ccm.reference_units,
        ccm.governance_units,
        ccm.total_vectors_raw,
        ccm.expanded_estimate,
        ccm.calculated_at,
        ccm.calculation_version
    FROM collection_capacity_metrics ccm
    JOIN collections c ON ccm.collection_id = c.id
    WHERE c.slug = p_collection_slug
    ORDER BY ccm.calculated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 5: VIEW FOR CAPACITY OVERVIEW
-- ============================================

CREATE OR REPLACE VIEW v_collection_capacity_overview AS
SELECT DISTINCT ON (c.id)
    c.id AS collection_id,
    c.slug AS collection_slug,
    c.name AS collection_name,
    c.section::TEXT AS section,
    c.collection_type::TEXT AS collection_type,
    ccm.executable_units,
    ccm.event_reactive_units,
    ccm.reference_units,
    ccm.governance_units,
    ccm.total_vectors_raw,
    ccm.expanded_estimate,
    ccm.calculated_at,
    ccm.calculation_version,
    CASE
        WHEN ccm.total_vectors_raw IS NULL THEN 'Not Calculated'
        WHEN ccm.total_vectors_raw = 0 THEN 'Empty'
        WHEN ccm.total_vectors_raw < 100 THEN 'Light'
        WHEN ccm.total_vectors_raw < 500 THEN 'Medium'
        WHEN ccm.total_vectors_raw < 1000 THEN 'Heavy'
        ELSE 'Dense'
    END AS capacity_tier
FROM collections c
LEFT JOIN collection_capacity_metrics ccm ON c.id = ccm.collection_id
ORDER BY c.id, ccm.calculated_at DESC NULLS LAST;

-- ============================================
-- PART 6: CALCULATE INSPIRE FAMILY METRICS
-- ============================================

-- Run the calculation for Inspire Family collection
SELECT * FROM calculate_collection_capacity('inspire-family', 1, 'Initial capacity calculation for Inspire Family collection');

-- ============================================
-- PART 7: DETAILED BREAKDOWN VIEW
-- ============================================

CREATE OR REPLACE VIEW v_inspire_family_capacity_breakdown AS
SELECT
    cc.name AS category_name,
    cc.level AS category_level,
    cc.path AS category_path,
    ci.item_type::TEXT AS item_type,
    CASE
        WHEN ci.item_type::TEXT IN ('activation', 'instruction') THEN 'Executable'
        WHEN ci.item_type::TEXT = 'event_trigger' THEN 'Event-Reactive'
        WHEN ci.item_type::TEXT IN ('property', 'reference', 'prompt') THEN 'Reference'
        WHEN ci.item_type::TEXT = 'metadata' THEN 'Governance'
        ELSE 'Unknown'
    END AS functional_group,
    ci.name AS item_name,
    ci.priority,
    CASE WHEN (ci.metadata->>'sealed')::BOOLEAN = TRUE THEN 'Yes' ELSE 'No' END AS is_sealed,
    CASE WHEN (ci.metadata->>'irrevocable')::BOOLEAN = TRUE THEN 'Yes' ELSE 'No' END AS is_irrevocable,
    ci.metadata->>'source' AS source_file
FROM category_items ci
JOIN collection_categories cc ON ci.category_id = cc.id
JOIN collections c ON cc.collection_id = c.id
WHERE c.slug = 'inspire-family'
ORDER BY cc.path, ci.priority DESC;

-- ============================================
-- PART 8: COMMENTS
-- ============================================

COMMENT ON TABLE collection_capacity_metrics IS 'Stores calculated neural capacity metrics for collections, enabling trend tracking and comparison';
COMMENT ON FUNCTION calculate_collection_capacity IS 'Calculates and persists capacity metrics for a collection by functional group';
COMMENT ON FUNCTION get_collection_capacity IS 'Retrieves the most recent capacity metrics for a collection';
COMMENT ON VIEW v_collection_capacity_overview IS 'Overview of all collections with their latest capacity metrics and tier classification';
COMMENT ON VIEW v_inspire_family_capacity_breakdown IS 'Detailed breakdown of Inspire Family items by category and functional group';
