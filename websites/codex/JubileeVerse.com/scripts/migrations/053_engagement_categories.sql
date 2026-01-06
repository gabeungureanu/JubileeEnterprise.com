-- ============================================
-- JubileeVerse Database Schema
-- Migration 053: Engagement Categories System
-- ============================================
-- Hierarchical category taxonomy for organizing engagement rules.
-- Supports up to 5 levels of depth with safe deletion policies.
-- Categories represent ministry structures and persona-driven scopes.
--
-- DELETION POLICY:
-- When deleting a category with children, one of these actions must occur:
-- 1. REASSIGN: Move children to the deleted node's parent (default behavior)
-- 2. CASCADE: Soft-delete all descendants recursively
-- 3. BLOCK: Prevent deletion until children are manually moved
--
-- Rules are NEVER orphaned - deletion is blocked if rules exist unless
-- they are first moved to another category or to "Uncategorized" root.

-- ============================================
-- ENGAGEMENT CATEGORIES TABLE
-- Hierarchical tree with parent_id self-reference
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Hierarchy (NULL = root category)
    parent_id UUID REFERENCES engagement_categories(id) ON DELETE SET NULL,

    -- Ordering within siblings
    sort_order INT DEFAULT 0,

    -- Tree depth (calculated, 0 = root)
    depth INT DEFAULT 0 CHECK (depth >= 0 AND depth <= 4),

    -- Materialized path for efficient subtree queries (e.g., "/uuid1/uuid2/uuid3")
    path TEXT NOT NULL DEFAULT '',

    -- Icon for UI (optional SVG or icon class)
    icon VARCHAR(500),

    -- Color theme for UI (hex color)
    color VARCHAR(7) DEFAULT '#9a9a9a',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Soft delete support
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Admin tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Slug must be unique within the same parent (siblings don't collide)
    CONSTRAINT engagement_categories_slug_parent_unique UNIQUE (slug, parent_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_engagement_categories_parent ON engagement_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_engagement_categories_slug ON engagement_categories(slug);
CREATE INDEX IF NOT EXISTS idx_engagement_categories_path ON engagement_categories(path);
CREATE INDEX IF NOT EXISTS idx_engagement_categories_depth ON engagement_categories(depth);
CREATE INDEX IF NOT EXISTS idx_engagement_categories_active ON engagement_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_engagement_categories_not_deleted ON engagement_categories(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_engagement_categories_sort ON engagement_categories(parent_id, sort_order);

-- ============================================
-- ADD category_id TO hospitality_rules
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hospitality_rules' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE hospitality_rules ADD COLUMN category_id UUID REFERENCES engagement_categories(id) ON DELETE SET NULL;
        COMMENT ON COLUMN hospitality_rules.category_id IS 'Reference to engagement category tree. NULL means uncategorized.';
        CREATE INDEX IF NOT EXISTS idx_hospitality_rules_category ON hospitality_rules(category_id);
    END IF;
END $$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for engagement_categories
DROP TRIGGER IF EXISTS update_engagement_categories_updated_at ON engagement_categories;
CREATE TRIGGER update_engagement_categories_updated_at
    BEFORE UPDATE ON engagement_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate depth from parent_id chain
CREATE OR REPLACE FUNCTION calculate_category_depth(category_uuid UUID)
RETURNS INT AS $$
DECLARE
    current_depth INT := 0;
    current_parent UUID;
BEGIN
    SELECT parent_id INTO current_parent FROM engagement_categories WHERE id = category_uuid;

    WHILE current_parent IS NOT NULL LOOP
        current_depth := current_depth + 1;
        SELECT parent_id INTO current_parent FROM engagement_categories WHERE id = current_parent;

        -- Safety: prevent infinite loops (max depth 5)
        IF current_depth > 5 THEN
            RAISE EXCEPTION 'Category depth exceeds maximum of 5 levels';
        END IF;
    END LOOP;

    RETURN current_depth;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate materialized path
CREATE OR REPLACE FUNCTION calculate_category_path(category_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    path_parts TEXT[] := ARRAY[]::TEXT[];
    current_id UUID := category_uuid;
    current_parent UUID;
BEGIN
    WHILE current_id IS NOT NULL LOOP
        path_parts := current_id::TEXT || path_parts;
        SELECT parent_id INTO current_parent FROM engagement_categories WHERE id = current_id;
        current_id := current_parent;
    END LOOP;

    RETURN '/' || array_to_string(path_parts, '/');
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-update depth and path on insert/update
CREATE OR REPLACE FUNCTION update_category_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate depth
    NEW.depth := calculate_category_depth(NEW.id);

    -- Validate depth doesn't exceed 4 (5 levels: 0,1,2,3,4)
    IF NEW.depth > 4 THEN
        RAISE EXCEPTION 'Cannot create category: maximum depth of 5 levels exceeded';
    END IF;

    -- Calculate materialized path
    NEW.path := calculate_category_path(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for AFTER trigger to update the row (must be defined BEFORE trigger)
CREATE OR REPLACE FUNCTION update_category_hierarchy_after()
RETURNS TRIGGER AS $$
DECLARE
    new_depth INT;
    new_path TEXT;
BEGIN
    -- Calculate depth
    new_depth := calculate_category_depth(NEW.id);

    -- Validate depth
    IF new_depth > 4 THEN
        RAISE EXCEPTION 'Cannot create category: maximum depth of 5 levels exceeded';
    END IF;

    -- Calculate path
    new_path := calculate_category_path(NEW.id);

    -- Update the row if values changed
    IF NEW.depth IS DISTINCT FROM new_depth OR NEW.path IS DISTINCT FROM new_path THEN
        UPDATE engagement_categories
        SET depth = new_depth, path = new_path
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger for hierarchy updates (after insert to get the ID)
DROP TRIGGER IF EXISTS engagement_categories_hierarchy_trigger ON engagement_categories;
CREATE TRIGGER engagement_categories_hierarchy_trigger
    AFTER INSERT OR UPDATE OF parent_id ON engagement_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_category_hierarchy_after();

-- Function to safely delete a category (reassign children to parent)
CREATE OR REPLACE FUNCTION safe_delete_category(
    category_uuid UUID,
    deletion_mode VARCHAR DEFAULT 'reassign', -- 'reassign', 'cascade', 'block'
    deleted_by_uuid UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT, affected_rules INT, affected_children INT) AS $$
DECLARE
    cat_parent_id UUID;
    child_count INT;
    rule_count INT;
BEGIN
    -- Get category info
    SELECT parent_id INTO cat_parent_id
    FROM engagement_categories
    WHERE id = category_uuid AND is_deleted = FALSE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Category not found or already deleted'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Count children and rules
    SELECT COUNT(*) INTO child_count FROM engagement_categories WHERE parent_id = category_uuid AND is_deleted = FALSE;
    SELECT COUNT(*) INTO rule_count FROM hospitality_rules WHERE category_id = category_uuid;

    -- Check deletion mode
    IF deletion_mode = 'block' AND (child_count > 0 OR rule_count > 0) THEN
        RETURN QUERY SELECT FALSE,
            format('Cannot delete: %s children and %s rules exist. Move them first.', child_count, rule_count)::TEXT,
            rule_count, child_count;
        RETURN;
    END IF;

    -- Reassign or cascade
    IF deletion_mode = 'reassign' THEN
        -- Move children to parent (or make them root if no parent)
        UPDATE engagement_categories
        SET parent_id = cat_parent_id, updated_at = NOW()
        WHERE parent_id = category_uuid AND is_deleted = FALSE;

        -- Move rules to parent category (or NULL if no parent)
        UPDATE hospitality_rules
        SET category_id = cat_parent_id, updated_at = NOW()
        WHERE category_id = category_uuid;

    ELSIF deletion_mode = 'cascade' THEN
        -- Soft-delete all descendants recursively
        WITH RECURSIVE descendants AS (
            SELECT id FROM engagement_categories WHERE id = category_uuid
            UNION ALL
            SELECT ec.id FROM engagement_categories ec
            INNER JOIN descendants d ON ec.parent_id = d.id
            WHERE ec.is_deleted = FALSE
        )
        UPDATE engagement_categories
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = deleted_by_uuid
        WHERE id IN (SELECT id FROM descendants WHERE id != category_uuid);

        -- Move all rules from deleted categories to uncategorized (NULL)
        WITH RECURSIVE descendants AS (
            SELECT id FROM engagement_categories WHERE id = category_uuid
            UNION ALL
            SELECT ec.id FROM engagement_categories ec
            INNER JOIN descendants d ON ec.parent_id = d.id
        )
        UPDATE hospitality_rules
        SET category_id = NULL, updated_at = NOW()
        WHERE category_id IN (SELECT id FROM descendants);
    END IF;

    -- Soft-delete the category
    UPDATE engagement_categories
    SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = deleted_by_uuid
    WHERE id = category_uuid;

    RETURN QUERY SELECT TRUE, 'Category deleted successfully'::TEXT, rule_count, child_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get category tree (for UI)
CREATE OR REPLACE FUNCTION get_category_tree(root_id UUID DEFAULT NULL)
RETURNS TABLE(
    id UUID,
    slug VARCHAR,
    name VARCHAR,
    description TEXT,
    parent_id UUID,
    depth INT,
    path TEXT,
    sort_order INT,
    icon VARCHAR,
    color VARCHAR,
    is_active BOOLEAN,
    rule_count BIGINT,
    child_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH category_stats AS (
        SELECT
            ec.id,
            COUNT(DISTINCT hr.id) as rule_count,
            COUNT(DISTINCT child.id) as child_count
        FROM engagement_categories ec
        LEFT JOIN hospitality_rules hr ON hr.category_id = ec.id
        LEFT JOIN engagement_categories child ON child.parent_id = ec.id AND child.is_deleted = FALSE
        WHERE ec.is_deleted = FALSE
        GROUP BY ec.id
    )
    SELECT
        ec.id,
        ec.slug,
        ec.name,
        ec.description,
        ec.parent_id,
        ec.depth,
        ec.path,
        ec.sort_order,
        ec.icon,
        ec.color,
        ec.is_active,
        COALESCE(cs.rule_count, 0),
        COALESCE(cs.child_count, 0)
    FROM engagement_categories ec
    LEFT JOIN category_stats cs ON cs.id = ec.id
    WHERE ec.is_deleted = FALSE
      AND (root_id IS NULL OR ec.path LIKE '%' || root_id::TEXT || '%' OR ec.id = root_id)
    ORDER BY ec.depth, ec.sort_order, ec.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED INITIAL CATEGORY TAXONOMY
-- 14 Root Categories with Subcategories
-- ============================================

-- Helper function to insert categories
CREATE OR REPLACE FUNCTION insert_category(
    p_slug VARCHAR,
    p_name VARCHAR,
    p_description TEXT,
    p_parent_slug VARCHAR DEFAULT NULL,
    p_icon VARCHAR DEFAULT NULL,
    p_color VARCHAR DEFAULT '#9a9a9a',
    p_sort_order INT DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    parent_uuid UUID := NULL;
    parent_depth INT := -1;
BEGIN
    -- Find parent if specified
    IF p_parent_slug IS NOT NULL THEN
        SELECT id, depth INTO parent_uuid, parent_depth
        FROM engagement_categories
        WHERE slug = p_parent_slug AND is_deleted = FALSE
        LIMIT 1;
    END IF;

    -- Generate new UUID
    new_id := uuid_generate_v4();

    -- Insert category
    INSERT INTO engagement_categories (
        id, slug, name, description, parent_id, depth, path, icon, color, sort_order
    ) VALUES (
        new_id,
        p_slug,
        p_name,
        p_description,
        parent_uuid,
        COALESCE(parent_depth + 1, 0),
        CASE
            WHEN parent_uuid IS NULL THEN '/' || new_id::TEXT
            ELSE (SELECT path FROM engagement_categories WHERE id = parent_uuid) || '/' || new_id::TEXT
        END,
        p_icon,
        p_color,
        p_sort_order
    )
    ON CONFLICT (slug, parent_id) DO NOTHING;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROOT CATEGORIES (Level 0)
-- ============================================

-- 1. Welcome & Onboarding
SELECT insert_category(
    'welcome-onboarding',
    'Welcome & Onboarding',
    'Rules for greeting and guiding new visitors through their first experience',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    '#4ade80',
    1
);

-- 2. Prayer
SELECT insert_category(
    'prayer',
    'Prayer',
    'Prayer-related engagement rules including prayer rooms and intercession',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 4C10.89 4 10 4.89 10 6C10 7.11 10.89 8 12 8C13.11 8 14 7.11 14 6C14 4.89 13.11 4 12 4ZM12 10C9.33 10 4 11.34 4 14V16H20V14C20 11.34 14.67 10 12 10ZM12 13C9.67 13 6.83 14.17 6.17 15H17.83C17.17 14.17 14.33 13 12 13Z"/></svg>',
    '#a855f7',
    2
);

-- 3. Discipleship & Growth
SELECT insert_category(
    'discipleship-growth',
    'Discipleship & Growth',
    'Spiritual growth, mentoring, and discipleship engagement',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/></svg>',
    '#60a5fa',
    3
);

-- 4. Bible Study
SELECT insert_category(
    'bible-study',
    'Bible Study',
    'Scripture study, word studies, and biblical exploration',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 8c2.21 0 4 1.79 4 4H8c0-2.21 1.79-4 4-4z"/></svg>',
    '#f59e0b',
    4
);

-- 5. Community & Groups
SELECT insert_category(
    'community-groups',
    'Community & Groups',
    'Small groups, community building, and fellowship engagement',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    '#22c55e',
    5
);

-- 6. Family & Kids
SELECT insert_category(
    'family-kids',
    'Family & Kids',
    'Family ministry, children''s ministry, and parenting support',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    '#ec4899',
    6
);

-- 7. Youth & Young Adults
SELECT insert_category(
    'youth-young-adults',
    'Youth & Young Adults',
    'Teen ministry, college-age, and young adult engagement',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>',
    '#8b5cf6',
    7
);

-- 8. Men & Women
SELECT insert_category(
    'men-women',
    'Men & Women',
    'Gender-specific ministry and fellowship groups',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
    '#06b6d4',
    8
);

-- 9. Care & Coaching
SELECT insert_category(
    'care-coaching',
    'Care & Coaching',
    'Pastoral care, life coaching, and emotional support (not counseling)',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    '#ef4444',
    9
);

-- 10. Outreach & Missions
SELECT insert_category(
    'outreach-missions',
    'Outreach & Missions',
    'Evangelism, missions, and community outreach',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    '#f97316',
    10
);

-- 11. Leadership & Ministry Ops
SELECT insert_category(
    'leadership-ops',
    'Leadership & Ministry Ops',
    'Church leadership, administration, and ministry operations',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/></svg>',
    '#64748b',
    11
);

-- 12. Health & Wellness
SELECT insert_category(
    'health-wellness',
    'Health & Wellness',
    'Physical, mental, and spiritual health engagement',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M10.5 13H8v-3h2.5V7.5h3V10H16v3h-2.5v2.5h-3V13zM12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>',
    '#10b981',
    12
);

-- 13. Marketplace & Work
SELECT insert_category(
    'marketplace-work',
    'Marketplace & Work',
    'Faith and work integration, business ministry',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z"/></svg>',
    '#84cc16',
    13
);

-- 14. AI & Digital Ministry
SELECT insert_category(
    'ai-digital',
    'AI & Digital Ministry',
    'AI literacy, digital tools, and technology ethics',
    NULL,
    '<svg viewBox="0 0 24 24"><path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>',
    '#ffbd59',
    14
);

-- ============================================
-- LEVEL 2 SUBCATEGORIES
-- ============================================

-- Prayer subcategories
SELECT insert_category('prayer-rooms', 'Prayer Rooms', 'Virtual and physical prayer room engagement', 'prayer', NULL, '#a855f7', 1);
SELECT insert_category('intercessory-prayer', 'Intercessory Prayer', 'Praying for others and intercession ministry', 'prayer', NULL, '#a855f7', 2);
SELECT insert_category('prayer-requests', 'Prayer Requests', 'Receiving and managing prayer requests', 'prayer', NULL, '#a855f7', 3);
SELECT insert_category('prayer-partners', 'Prayer Partners', 'Pairing users for mutual prayer support', 'prayer', NULL, '#a855f7', 4);

-- Bible Study subcategories
SELECT insert_category('hebraic-studies', 'Hebraic Studies', 'Hebrew language and cultural context study', 'bible-study', NULL, '#f59e0b', 1);
SELECT insert_category('greek-word-study', 'Greek Word Study', 'New Testament Greek exploration', 'bible-study', NULL, '#f59e0b', 2);
SELECT insert_category('prophecy', 'Prophecy', 'Prophetic books and eschatology study', 'bible-study', NULL, '#f59e0b', 3);
SELECT insert_category('topical-studies', 'Topical Studies', 'Theme-based Bible exploration', 'bible-study', NULL, '#f59e0b', 4);

-- Family & Kids subcategories
SELECT insert_category('childrens-ministry', 'Children''s Ministry', 'Ministry to children of all ages', 'family-kids', NULL, '#ec4899', 1);
SELECT insert_category('parenting', 'Parenting', 'Parenting resources and support', 'family-kids', NULL, '#ec4899', 2);
SELECT insert_category('marriage-family', 'Marriage & Family', 'Marriage enrichment and family dynamics', 'family-kids', NULL, '#ec4899', 3);

-- Care & Coaching subcategories
SELECT insert_category('grief-support', 'Grief Support', 'Supporting those experiencing loss', 'care-coaching', NULL, '#ef4444', 1);
SELECT insert_category('anxiety-support', 'Anxiety Support', 'Help for anxiety and stress', 'care-coaching', NULL, '#ef4444', 2);
SELECT insert_category('marriage-support', 'Marriage Support', 'Marriage care and enrichment coaching', 'care-coaching', NULL, '#ef4444', 3);
SELECT insert_category('addiction-recovery', 'Addiction Recovery', 'Recovery support and accountability', 'care-coaching', NULL, '#ef4444', 4);
SELECT insert_category('life-transitions', 'Life Transitions', 'Support through major life changes', 'care-coaching', NULL, '#ef4444', 5);

-- Outreach & Missions subcategories
SELECT insert_category('prison-outreach', 'Prison Outreach', 'Ministry to incarcerated individuals', 'outreach-missions', NULL, '#f97316', 1);
SELECT insert_category('local-outreach', 'Local Outreach', 'Community service and local evangelism', 'outreach-missions', NULL, '#f97316', 2);
SELECT insert_category('global-missions', 'Global Missions', 'International missions and support', 'outreach-missions', NULL, '#f97316', 3);
SELECT insert_category('digital-evangelism', 'Digital Evangelism', 'Online outreach and social media ministry', 'outreach-missions', NULL, '#f97316', 4);

-- AI & Digital Ministry subcategories
SELECT insert_category('ai-literacy', 'AI Literacy', 'Understanding AI for ministry contexts', 'ai-digital', NULL, '#ffbd59', 1);
SELECT insert_category('ai-tools-church', 'AI Tools for Church', 'Practical AI applications for churches', 'ai-digital', NULL, '#ffbd59', 2);
SELECT insert_category('ai-ethics', 'AI Ethics', 'Ethical considerations in AI ministry', 'ai-digital', NULL, '#ffbd59', 3);
SELECT insert_category('digital-discipleship', 'Digital Discipleship', 'Online discipleship and virtual community', 'ai-digital', NULL, '#ffbd59', 4);

-- ============================================
-- LEVEL 3 SUBCATEGORIES
-- ============================================

-- Prayer Rooms → specific rooms
SELECT insert_category('upper-room', 'Upper Room', 'Intimate prayer and worship space', 'prayer-rooms', NULL, '#a855f7', 1);
SELECT insert_category('healing-room', 'Healing Room', 'Prayer for physical and emotional healing', 'prayer-rooms', NULL, '#a855f7', 2);
SELECT insert_category('nations-room', 'Nations Room', 'Prayer for nations and global issues', 'prayer-rooms', NULL, '#a855f7', 3);

-- Children's Ministry → age groups
SELECT insert_category('ages-0-2', 'Nursery (0-2)', 'Infant and toddler ministry', 'childrens-ministry', NULL, '#ec4899', 1);
SELECT insert_category('ages-3-5', 'Preschool (3-5)', 'Preschool age children ministry', 'childrens-ministry', NULL, '#ec4899', 2);
SELECT insert_category('ages-6-8', 'Early Elementary (6-8)', 'Early elementary school ministry', 'childrens-ministry', NULL, '#ec4899', 3);
SELECT insert_category('ages-9-11', 'Upper Elementary (9-11)', 'Upper elementary school ministry', 'childrens-ministry', NULL, '#ec4899', 4);

-- Hebraic Studies → specific focuses
SELECT insert_category('hebrew-language', 'Hebrew Language', 'Biblical Hebrew learning', 'hebraic-studies', NULL, '#f59e0b', 1);
SELECT insert_category('jewish-roots', 'Jewish Roots', 'Understanding Jewish context of Scripture', 'hebraic-studies', NULL, '#f59e0b', 2);
SELECT insert_category('feasts-festivals', 'Feasts & Festivals', 'Biblical feasts and their significance', 'hebraic-studies', NULL, '#f59e0b', 3);

-- ============================================
-- CLEANUP
-- ============================================
DROP FUNCTION IF EXISTS insert_category(VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR, INT);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE engagement_categories IS 'Hierarchical taxonomy for organizing engagement rules. Supports up to 5 levels of depth. Uses soft-delete with safe deletion policies.';
COMMENT ON COLUMN engagement_categories.slug IS 'URL-friendly identifier. Must be unique within sibling scope (same parent_id).';
COMMENT ON COLUMN engagement_categories.parent_id IS 'Reference to parent category. NULL indicates root category.';
COMMENT ON COLUMN engagement_categories.depth IS 'Tree depth level: 0=root, 1=level2, 2=level3, etc. Max 4 (5 levels total).';
COMMENT ON COLUMN engagement_categories.path IS 'Materialized path for efficient subtree queries. Format: /uuid1/uuid2/uuid3';
COMMENT ON COLUMN engagement_categories.is_deleted IS 'Soft-delete flag. Deleted categories are hidden but data is preserved.';
COMMENT ON FUNCTION safe_delete_category IS 'Safely delete a category using specified mode: reassign (move children to parent), cascade (soft-delete descendants), or block (prevent if children exist).';
COMMENT ON FUNCTION get_category_tree IS 'Returns category tree with rule counts and child counts for UI rendering.';
