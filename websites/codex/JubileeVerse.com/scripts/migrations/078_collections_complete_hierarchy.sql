-- ============================================
-- JubileeVerse Database Schema
-- Migration 078: Complete Collections Hierarchy
-- Inserts all collections and their root folder structures
-- as defined in admin-collections.html
-- PREREQUISITE: Run 078a_add_collection_types.sql first
-- ============================================

-- ============================================
-- SECTION 1: AUTHORITY & IDENTITY
-- ============================================

-- Scripture (Jubilee Bible) - a1
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('scripture-jubilee-bible', 'Scripture (Jubilee Bible)', 'Scripture (Jubilee Bible)', 'authority_and_identity', 'scripture', TRUE, 1, 'The Jubilee Bible - Scripture collection with translation rules and validation controls')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Doctrine (Book of Acts) - a2
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('doctrine-book-of-acts', 'Doctrine (Book of Acts)', 'Doctrine (Book of Acts)', 'authority_and_identity', 'doctrine', TRUE, 2, 'Doctrinal framework based on the Book of Acts')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Governance (Apostolic) - a3
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('governance-apostolic', 'Governance (Apostolic)', 'Governance (Apostolic)', 'authority_and_identity', 'governance', TRUE, 3, 'Apostolic governance framework')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Personas collections (a4-a5 are Jubilee Father and Jubilee Family)
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES
    ('jubilee-father', 'Jubilee Father', 'Jubilee Father', 'authority_and_identity', 'persona', TRUE, 4, 'Jubilee Father persona collection'),
    ('jubilee-family', 'Jubilee Family', 'Jubilee Family', 'authority_and_identity', 'persona', TRUE, 5, 'Jubilee Family personas collection'),
    ('jubilee-inspire', 'Jubilee Inspire', 'Jubilee Inspire', 'authority_and_identity', 'persona', TRUE, 6, 'Jubilee Inspire persona collection with 32 stages')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- ============================================
-- SECTION 2: ORCHESTRATION & MEDIATION
-- ============================================

-- Kingdom Builder - o1
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('kingdom-builder', 'Kingdom Builder', 'Kingdom Builder', 'orchestration_and_mediation', 'orchestration', TRUE, 10, 'Kingdom Builder orchestration model')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Creative Fire - o2
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('creative-fire', 'Creative Fire', 'Creative Fire', 'orchestration_and_mediation', 'orchestration', TRUE, 11, 'Creative Fire orchestration model')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Gospel Pulse - o3
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('gospel-pulse', 'Gospel Pulse', 'Gospel Pulse', 'orchestration_and_mediation', 'orchestration', TRUE, 12, 'Gospel Pulse orchestration model')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Shepherd's Voice - o4
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('shepherds-voice', 'Shepherd''s Voice', 'Shepherd''s Voice', 'orchestration_and_mediation', 'orchestration', TRUE, 13, 'Shepherd''s Voice orchestration model')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Hebraic Roots - o5
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('hebraic-roots', 'Hebraic Roots', 'Hebraic Roots', 'orchestration_and_mediation', 'orchestration', TRUE, 14, 'Hebraic Roots orchestration model')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- ============================================
-- SECTION 3: INTERACTION & CONTEXT
-- ============================================

-- Prompts - i6 (now first in order)
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('prompts', 'Prompts', 'Prompts', 'interaction_and_context', 'prompts', TRUE, 20, 'Prompt library and templates')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Resources - i1
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('resources', 'Resources', 'Resources', 'interaction_and_context', 'resources', TRUE, 21, 'Resource library including books, courses, and media')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Languages - i3
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('languages', 'Languages', 'Languages', 'interaction_and_context', 'language', TRUE, 22, 'Language catalog and translation resources')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Countries - i8
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('countries', 'Countries', 'Countries', 'interaction_and_context', 'country', TRUE, 23, 'Country profiles and regional data')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Jubilee Ministry - i2
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('jubilee-ministry', 'Jubilee Ministry', 'Jubilee Ministry', 'interaction_and_context', 'minister', TRUE, 24, 'Jubilee Ministry organization and operations')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Ministers - i9
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('ministers', 'Ministers', 'Ministers', 'interaction_and_context', 'minister', TRUE, 25, 'Minister profiles and assignments')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Users - i4
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('users', 'Users', 'Users', 'interaction_and_context', 'user', TRUE, 26, 'User profiles and data')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Analytics - i5
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('analytics', 'Analytics', 'Analytics', 'interaction_and_context', 'analytics', TRUE, 27, 'Analytics and metrics')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();

-- Marketing - i7
INSERT INTO collections (slug, name, display_name, section, collection_type, is_system, display_order, description)
VALUES ('marketing', 'Marketing', 'Marketing', 'interaction_and_context', 'marketing', TRUE, 28, 'Marketing campaigns and outreach')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, updated_at = NOW();


-- ============================================
-- ROOT FOLDERS FOR SCRIPTURE (a1)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'scripture-jubilee-bible';

    -- Insert root folders
    INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
    VALUES
        (coll_id, 'Jubilee_Bible_JSV', 'Jubilee Bible (JSV)', 'Jubilee Bible (JSV)', 0, 1, TRUE),
        (coll_id, 'Translation_Rules', 'Translation Rules', 'Translation Rules', 0, 2, TRUE),
        (coll_id, 'Language_Translations', 'Language Translations', 'Language Translations', 0, 3, TRUE),
        (coll_id, 'Validation_Controls', 'Validation Controls', 'Validation Controls', 0, 4, TRUE),
        (coll_id, 'Source_Manuscripts', 'Source Manuscripts', 'Source Manuscripts', 0, 5, FALSE),
        (coll_id, 'Original_Languages', 'Original Languages', 'Original Languages', 0, 6, FALSE),
        (coll_id, 'Linguistic_Mappings', 'Linguistic Mappings', 'Linguistic Mappings', 0, 7, FALSE),
        (coll_id, 'Hermeneutical_Framework', 'Hermeneutical Framework', 'Hermeneutical Framework', 0, 8, FALSE),
        (coll_id, 'Translation_Decisions', 'Translation Decisions', 'Translation Decisions', 0, 9, FALSE),
        (coll_id, 'Consistency_and_Style', 'Consistency and Style', 'Consistency and Style', 0, 10, FALSE),
        (coll_id, 'Accuracy_Metrics', 'Accuracy Metrics', 'Accuracy Metrics', 0, 11, FALSE),
        (coll_id, 'Benchmark_Comparisons', 'Benchmark Comparisons', 'Benchmark Comparisons', 0, 12, FALSE),
        (coll_id, 'Versioning_and_History', 'Versioning and History', 'Versioning and History', 0, 13, FALSE),
        (coll_id, 'Metadata_and_Indexes', 'Metadata and Indexes', 'Metadata and Indexes', 0, 14, FALSE)
    ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
END $$;

-- ============================================
-- ROOT FOLDERS FOR DOCTRINE (a2)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Scripture', 'Revelation', 'God', 'Creation', 'Image_of_God', 'Authority', 'Power', 'Glory',
        'Holiness', 'Covenant', 'Law', 'Commandments', 'Wisdom', 'Truth', 'Righteousness', 'Justice',
        'Mercy', 'Faithfulness', 'Love', 'Peace', 'Sin', 'Fall', 'Repentance', 'Grace', 'Faith',
        'Obedience', 'Salvation', 'Redemption', 'Forgiveness', 'Justification', 'Sanctification',
        'Adoption', 'New_Birth', 'Resurrection', 'Eternal_Life', 'Judgment', 'Restoration', 'Kingdom',
        'Messiah', 'Son_of_God', 'Holy_Spirit', 'Spirit_Indwelling', 'Spirit_Filling', 'Spiritual_Gifts',
        'Power_of_the_Spirit', 'Prophecy', 'Prayer', 'Worship', 'Praise', 'Thanksgiving', 'Church',
        'Body_of_Christ', 'Discipleship', 'Apostleship', 'Leadership', 'Shepherding', 'Teaching',
        'Evangelism', 'Mission', 'Witness', 'Unity', 'Fellowship', 'Service', 'Stewardship',
        'Generosity', 'Humility', 'Endurance', 'Suffering', 'Hope', 'Perseverance', 'Covenant_Faithfulness',
        'Spiritual_Warfare', 'Discernment', 'Holiness_of_Life', 'Transformation', 'Renewal_of_the_Mind',
        'Fruit_of_the_Spirit', 'Freedom', 'Light', 'Life'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'doctrine-book-of-acts';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR GOVERNANCE (a3)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Authority', 'Stewardship', 'Accountability', 'Oversight', 'Servanthood', 'Responsibility',
        'Delegation', 'Leadership', 'Eldership', 'Shepherding', 'Discipline', 'Correction',
        'Restoration', 'Protection', 'Justice', 'Integrity', 'Transparency', 'Faithfulness',
        'Obedience', 'Submission', 'Order', 'Unity', 'Peace', 'Discernment', 'Wisdom', 'Counsel',
        'Decision_Making', 'Boundaries', 'Safeguards', 'Escalation', 'Training', 'Maturity',
        'Qualification', 'Multiplication', 'Succession', 'Provision', 'Resource_Management',
        'Risk_Management', 'Conflict_Resolution', 'Accountability_Review'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'governance-apostolic';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR ORCHESTRATION COLLECTIONS (o1-o5)
-- These all share the same 12 root folders
-- ============================================

DO $$
DECLARE
    coll_slugs TEXT[] := ARRAY['kingdom-builder', 'creative-fire', 'gospel-pulse', 'shepherds-voice', 'hebraic-roots'];
    coll_slug TEXT;
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Invocation', 'Authority_Flow', 'Model_Intent', 'Discernment_Logic', 'Safety_and_Guardrails',
        'Family_Alignment', 'Fatherly_Alignment', 'Persona_Selection', 'Resource_Routing',
        'Ministry_Context', 'Language_and_Localization', 'Outcome_Assembly'
    ];
    cat TEXT;
    ord INT;
BEGIN
    FOREACH coll_slug IN ARRAY coll_slugs LOOP
        SELECT id INTO coll_id FROM collections WHERE slug = coll_slug;
        ord := 1;

        FOREACH cat IN ARRAY categories LOOP
            INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
            VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
            ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
            ord := ord + 1;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR PROMPTS (i6)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Prompt_Library', 'Prompt_Templates', 'System_Prompts', 'Persona_Prompts', 'Model_Prompts',
        'User_Prompts', 'Workflow_Prompts', 'Process_Definitions', 'Prompt_Parameters',
        'Prompt_Constraints', 'Prompt_Versioning', 'Prompt_Testing', 'Prompt_Governance', 'Prompt_Analytics'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'prompts';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR RESOURCES (i1)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Websites', 'Books', 'Courses', 'Sermons', 'Teachings', 'Podcasts', 'Videos', 'Music',
        'Prayer_Resources', 'Study_Tools', 'Reference_Materials', 'Research_Papers',
        'Testimonies', 'Historical_Archives', 'Interactive_Tools', 'AI_Generated_Resources'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'resources';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR LANGUAGES (i3)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Language_Catalog', 'Language_Families', 'Writing_Systems', 'Phonetics_and_Pronunciation',
        'Grammar_and_Syntax', 'Semantics_and_Meaning', 'Idioms_and_Expressions', 'Cultural_Context',
        'Cultural_Sensitivities', 'Regional_Variants', 'Countries_and_Regions', 'Dialects_and_Variations',
        'Translation_Rules', 'Translation_Constraints', 'Theological_Language_Considerations',
        'Scripture_Translation_Notes', 'Formal_vs_Informal_Usage', 'Historical_Language_Evolution',
        'Modern_Usage_Patterns', 'Loanwords_and_Borrowings', 'Language_Accuracy_Metrics',
        'Validation_and_Review', 'Benchmark_Comparisons', 'Language_Interoperability',
        'Localization_Guidelines', 'Language_Metadata', 'Language_Indexes'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'languages';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR COUNTRIES (i8)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Country_Profiles', 'Regional_Groupings', 'Cultural_Context', 'Language_Prevalence',
        'Religious_Landscape', 'Legal_and_Regulatory', 'Social_Norms', 'Historical_Background',
        'Ministry_Opportunities', 'Ministry_Sensitivities', 'Digital_Access_and_Usage',
        'Economic_Conditions', 'Security_and_Risk', 'Localization_Guidelines'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'countries';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR JUBILEE MINISTRY (i2)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Spiritual_Authority', 'Governance_and_Oversight', 'Fivefold_Leadership', 'Pastoral_Care',
        'Discipleship', 'Teaching_and_Education', 'Scripture_and_Theology', 'Prayer_and_Intercession',
        'Evangelism_and_Outreach', 'Missions_and_Global_Impact', 'AI_and_Digital_Ministry',
        'Online_Communities', 'Physical_Ministry_Operations', 'Creative_and_Media',
        'Technology_and_Platforms', 'Finance_and_Stewardship', 'Ministers_and_Staff',
        'Partnerships_and_Alliances', 'Research_and_Innovation', 'Future_Expansion'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'jubilee-ministry';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR MINISTERS (i9)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Minister_Identity', 'Roles_and_Assignments', 'Skills_and_Abilities', 'Training_and_Certification',
        'Fivefold_Alignment', 'Spiritual_Maturity', 'Availability_and_Capacity', 'Performance_and_Growth',
        'Accountability_and_Oversight', 'Care_and_Support', 'Ethics_and_Conduct', 'Succession_and_Development'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'ministers';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR USERS (i4)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'User_Identity', 'Account_and_Access', 'Consent_and_Privacy', 'Demographics',
        'Language_and_Culture', 'Location_and_Region', 'Spiritual_Background', 'Faith_Journey',
        'Spiritual_Growth', 'Prayer_and_Intercession', 'Needs_and_Requests', 'Struggles_and_Challenges',
        'Strengths_and_Gifts', 'Testimonies_and_Praise', 'Community_and_Groups', 'Discipleship_and_Learning',
        'Engagement_and_Activity', 'Pastoral_Care_Notes', 'Safety_and_Safeguards', 'Aggregated_Insights'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'users';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR ANALYTICS (i5)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'User_Analytics', 'Ministry_Analytics', 'Engagement_Metrics', 'Growth_Indicators',
        'Spiritual_Impact_Signals', 'Prayer_Activity_Metrics', 'Content_Performance',
        'Resource_Utilization', 'AI_Behavior_Analytics', 'Safety_and_Risk_Signals',
        'Community_Trends', 'Regional_and_Cultural_Signals', 'Temporal_and_Seasonal_Patterns',
        'System_Health_Metrics', 'External_Environment_Signals', 'Aggregated_Insights'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'analytics';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- ROOT FOLDERS FOR MARKETING (i7)
-- ============================================

DO $$
DECLARE
    coll_id UUID;
    categories TEXT[] := ARRAY[
        'Messaging_and_Positioning', 'Audience_Segmentation', 'Campaign_Strategy',
        'Content_Distribution', 'Channels_and_Platforms', 'Outreach_Funnels',
        'Engagement_Metrics', 'Conversion_Insights', 'Brand_Identity',
        'Creative_Assets', 'Testing_and_Optimization', 'Compliance_and_Ethics'
    ];
    cat TEXT;
    ord INT := 1;
BEGIN
    SELECT id INTO coll_id FROM collections WHERE slug = 'marketing';

    FOREACH cat IN ARRAY categories LOOP
        INSERT INTO collection_categories (collection_id, slug, name, display_name, level, display_order, is_expandable)
        VALUES (coll_id, cat, REPLACE(cat, '_', ' '), REPLACE(cat, '_', ' '), 0, ord, FALSE)
        ON CONFLICT (collection_id, slug) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = NOW();
        ord := ord + 1;
    END LOOP;
END $$;

-- ============================================
-- SUMMARY VIEW
-- ============================================

-- Create a helpful view to see all collections and their categories
CREATE OR REPLACE VIEW v_collections_with_categories AS
SELECT
    c.slug AS collection_slug,
    c.name AS collection_name,
    c.section::TEXT AS section,
    c.display_order AS collection_order,
    cc.slug AS category_slug,
    cc.name AS category_name,
    cc.display_order AS category_order,
    cc.level AS category_level,
    cc.is_expandable
FROM collections c
LEFT JOIN collection_categories cc ON cc.collection_id = c.id
ORDER BY c.section, c.display_order, cc.display_order;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 078 complete: All collections and root folders inserted';
END $$;
