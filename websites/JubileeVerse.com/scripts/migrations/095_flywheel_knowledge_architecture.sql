-- ============================================
-- JubileeVerse Database Schema
-- Migration 095: Flywheel Knowledge Architecture
--
-- This migration establishes the Flywheel three-section architecture:
--   1. Data       - Market data, fundamentals, alternative data sources
--   2. Intelligence - Signals, strategies, models, forecasts
--   3. Execution  - Portfolios, trades, orders, compliance
--
-- IMPORTANT: Flywheel metadata is stored EXCLUSIVELY in flywheel_ prefixed tables.
-- These tables define structure only, not vector data. They serve as the
-- control-plane registry that informs Qdrant collection provisioning.
--
-- Naming Convention: All Flywheel tables MUST use flywheel_ prefix.
-- ============================================

-- ============================================
-- PART 1: CLEAN SLATE FOR FLYWHEEL ARCHITECTURE
-- Drop existing constraints that may conflict with new architecture
-- ============================================

-- Remove the owner check constraint as we're using a different architecture
-- (categories are top-level sections, not tied to templates or parent collections)
ALTER TABLE flywheel_collection_categories
DROP CONSTRAINT IF EXISTS chk_flywheel_category_owner;

-- Remove template references since Flywheel categories are standalone sections
ALTER TABLE flywheel_collection_categories
DROP CONSTRAINT IF EXISTS flywheel_collection_categories_template_id_fkey;

-- ============================================
-- PART 2: MODIFY FLYWHEEL_COLLECTION_CATEGORIES FOR SECTION ARCHITECTURE
-- This table becomes the authoritative registry for Flywheel's three sections
-- ============================================

-- Add section-specific columns if they don't exist
DO $$
BEGIN
    -- Add section_order for deterministic ordering
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'flywheel_collection_categories' AND column_name = 'section_order') THEN
        ALTER TABLE flywheel_collection_categories ADD COLUMN section_order INT DEFAULT 0;
    END IF;

    -- Add qdrant_prefix for Qdrant collection naming convention
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'flywheel_collection_categories' AND column_name = 'qdrant_prefix') THEN
        ALTER TABLE flywheel_collection_categories ADD COLUMN qdrant_prefix VARCHAR(50);
    END IF;
END $$;

-- ============================================
-- PART 3: INSERT THE THREE FLYWHEEL SECTIONS
-- These are the authoritative category records for the Flywheel lifecycle
-- ============================================

-- Clear any existing categories to ensure clean state
DELETE FROM flywheel_collection_categories WHERE collection_id IS NULL;

-- Insert the three Flywheel sections as top-level categories
INSERT INTO flywheel_collection_categories (
    id,
    slug,
    name,
    display_name,
    description,
    level,
    display_order,
    section_order,
    qdrant_prefix,
    icon,
    icon_color,
    is_active,
    is_expandable
) VALUES
(
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'data',
    'Data',
    'Data',
    'Market data, fundamentals, macroeconomic indicators, alternative data sources, news, sentiment, and historical information that feed the Flywheel intelligence layer.',
    0,
    1,
    1,
    'flywheel_data_',
    'database',
    '#4CAF50',
    TRUE,
    TRUE
),
(
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'intelligence',
    'Intelligence',
    'Intelligence',
    'Signals, strategies, models, forecasts, correlations, risk profiles, and optimization logic that transform raw data into actionable insights.',
    0,
    2,
    2,
    'flywheel_intel_',
    'brain',
    '#2196F3',
    TRUE,
    TRUE
),
(
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'execution',
    'Execution',
    'Execution',
    'Portfolios, trades, orders, execution logs, performance tracking, attribution, compliance, and audit trails that operationalize intelligence into market actions.',
    0,
    3,
    3,
    'flywheel_exec_',
    'play-circle',
    '#FF9800',
    TRUE,
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    section_order = EXCLUDED.section_order,
    qdrant_prefix = EXCLUDED.qdrant_prefix,
    icon = EXCLUDED.icon,
    icon_color = EXCLUDED.icon_color,
    updated_at = NOW();

-- ============================================
-- PART 4: MODIFY FLYWHEEL_COLLECTIONS TABLE
-- Add category reference for section association
-- ============================================

-- Add category_id column if it doesn't exist (foreign key to flywheel_collection_categories)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'flywheel_collections' AND column_name = 'category_id') THEN
        ALTER TABLE flywheel_collections ADD COLUMN category_id UUID;
    END IF;

    -- Add qdrant_collection_prefix for derived Qdrant naming
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'flywheel_collections' AND column_name = 'qdrant_collection_prefix') THEN
        ALTER TABLE flywheel_collections ADD COLUMN qdrant_collection_prefix VARCHAR(100);
    END IF;
END $$;

-- Add foreign key constraint for referential integrity
-- (collection MUST belong to a valid Flywheel category)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_flywheel_collections_category') THEN
        ALTER TABLE flywheel_collections
        ADD CONSTRAINT fk_flywheel_collections_category
        FOREIGN KEY (category_id) REFERENCES flywheel_collection_categories(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Create index on category_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_flywheel_collections_category_id ON flywheel_collections(category_id);

-- ============================================
-- PART 5: POPULATE FLYWHEEL_COLLECTIONS
-- 30 collections across 3 categories (10 each)
-- ============================================

-- Clear existing collections to ensure clean state
DELETE FROM flywheel_collections;

-- DATA SECTION (10 collections)
INSERT INTO flywheel_collections (
    slug, name, display_name, description, category_id,
    section, collection_type, qdrant_collection_prefix, display_order, is_active, is_system
) VALUES
(
    'market-data', 'MarketData', 'Market Data',
    'Real-time and delayed market data including quotes, trades, order book depth, and tick-level information across asset classes.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_market', 1, TRUE, TRUE
),
(
    'fundamentals', 'Fundamentals', 'Fundamentals',
    'Company financial statements, earnings, balance sheets, cash flows, and key fundamental metrics.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_fundamentals', 2, TRUE, TRUE
),
(
    'macroeconomic', 'Macroeconomic', 'Macroeconomic',
    'Economic indicators, central bank policies, GDP, inflation, employment, and global macroeconomic data.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_macro', 3, TRUE, TRUE
),
(
    'alternative-data', 'AlternativeData', 'Alternative Data',
    'Non-traditional data sources including satellite imagery, web traffic, credit card transactions, and social signals.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_alt', 4, TRUE, TRUE
),
(
    'news', 'News', 'News',
    'Financial news, press releases, regulatory filings, and real-time news feeds from global sources.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_news', 5, TRUE, TRUE
),
(
    'sentiment', 'Sentiment', 'Sentiment',
    'Market sentiment indicators, social media analysis, analyst ratings, and behavioral signals.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_sentiment', 6, TRUE, TRUE
),
(
    'historical-prices', 'HistoricalPrices', 'Historical Prices',
    'Historical OHLCV data, adjusted prices, splits, dividends, and long-term price archives.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_historical', 7, TRUE, TRUE
),
(
    'corporate-actions', 'CorporateActions', 'Corporate Actions',
    'Dividends, splits, mergers, acquisitions, spin-offs, and other corporate events.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_corpactions', 8, TRUE, TRUE
),
(
    'indicators', 'Indicators', 'Indicators',
    'Technical indicators, moving averages, oscillators, and derived quantitative metrics.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_indicators', 9, TRUE, TRUE
),
(
    'benchmarks', 'Benchmarks', 'Benchmarks',
    'Index compositions, benchmark returns, sector classifications, and reference data.',
    'a0000001-0000-0000-0000-000000000001'::UUID,
    'authority_and_identity', 'analytics',
    'flywheel_data_benchmarks', 10, TRUE, TRUE
),

-- INTELLIGENCE SECTION (10 collections)
(
    'signals', 'Signals', 'Signals',
    'Trading signals, entry/exit triggers, signal strength scores, and signal metadata.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_signals', 1, TRUE, TRUE
),
(
    'strategies', 'Strategies', 'Strategies',
    'Trading strategy definitions, parameters, backtests, and strategy performance metrics.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_strategies', 2, TRUE, TRUE
),
(
    'models', 'Models', 'Models',
    'Machine learning models, statistical models, factor models, and model versioning.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_models', 3, TRUE, TRUE
),
(
    'forecasts', 'Forecasts', 'Forecasts',
    'Price forecasts, volatility predictions, return expectations, and forecast confidence intervals.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_forecasts', 4, TRUE, TRUE
),
(
    'correlations', 'Correlations', 'Correlations',
    'Asset correlations, regime-dependent correlations, rolling correlations, and correlation matrices.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_correlations', 5, TRUE, TRUE
),
(
    'risk-profiles', 'RiskProfiles', 'Risk Profiles',
    'VaR, CVaR, drawdown analysis, stress tests, and comprehensive risk metrics.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_risk', 6, TRUE, TRUE
),
(
    'scenario-analysis', 'ScenarioAnalysis', 'Scenario Analysis',
    'What-if scenarios, Monte Carlo simulations, tail risk analysis, and scenario libraries.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_scenarios', 7, TRUE, TRUE
),
(
    'optimization', 'Optimization', 'Optimization',
    'Portfolio optimization results, efficient frontiers, weight recommendations, and rebalancing signals.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_optimization', 8, TRUE, TRUE
),
(
    'alpha-research', 'AlphaResearch', 'Alpha Research',
    'Alpha factor research, factor exposures, alpha decay analysis, and research notebooks.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_alpha', 9, TRUE, TRUE
),
(
    'constraints', 'Constraints', 'Constraints',
    'Investment constraints, position limits, sector limits, and regulatory constraints.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_constraints', 10, TRUE, TRUE
),

-- EXECUTION SECTION (10 collections)
(
    'portfolios', 'Portfolios', 'Portfolios',
    'Portfolio compositions, holdings, weights, NAV, and portfolio snapshots.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_portfolios', 1, TRUE, TRUE
),
(
    'trades', 'Trades', 'Trades',
    'Executed trades, fill details, slippage analysis, and trade confirmations.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_trades', 2, TRUE, TRUE
),
(
    'orders', 'Orders', 'Orders',
    'Order lifecycle, pending orders, order routing, and order management.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_orders', 3, TRUE, TRUE
),
(
    'execution-logs', 'ExecutionLogs', 'Execution Logs',
    'Detailed execution logs, timestamps, venue information, and execution quality metrics.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_logs', 4, TRUE, TRUE
),
(
    'performance', 'Performance', 'Performance',
    'Portfolio performance, returns, Sharpe ratios, drawdowns, and performance attribution.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_performance', 5, TRUE, TRUE
),
(
    'attribution', 'Attribution', 'Attribution',
    'Performance attribution, factor contributions, sector allocation, and stock selection effects.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_attribution', 6, TRUE, TRUE
),
(
    'compliance', 'Compliance', 'Compliance',
    'Regulatory compliance checks, breach monitoring, reporting requirements, and compliance status.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_compliance', 7, TRUE, TRUE
),
(
    'controls', 'Controls', 'Controls',
    'Risk controls, trading limits, circuit breakers, and control configurations.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_controls', 8, TRUE, TRUE
),
(
    'alerts', 'Alerts', 'Alerts',
    'System alerts, threshold breaches, anomaly detection, and notification history.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_alerts', 9, TRUE, TRUE
),
(
    'audit', 'Audit', 'Audit',
    'Comprehensive audit trails, change logs, access logs, and regulatory audit records.',
    'a0000001-0000-0000-0000-000000000003'::UUID,
    'interaction_and_context', 'analytics',
    'flywheel_exec_audit', 10, TRUE, TRUE
);

-- ============================================
-- PART 6: VALIDATION VIEWS
-- Views to validate Flywheel schema integrity
-- ============================================

-- View: Flywheel sections with collection counts
CREATE OR REPLACE VIEW v_flywheel_sections AS
SELECT
    fcc.id AS section_id,
    fcc.slug AS section_slug,
    fcc.name AS section_name,
    fcc.description AS section_description,
    fcc.section_order,
    fcc.qdrant_prefix,
    fcc.icon,
    fcc.icon_color,
    fcc.is_active,
    COUNT(fc.id) AS collection_count
FROM flywheel_collection_categories fcc
LEFT JOIN flywheel_collections fc ON fc.category_id = fcc.id
WHERE fcc.level = 0 AND fcc.collection_id IS NULL
GROUP BY fcc.id, fcc.slug, fcc.name, fcc.description, fcc.section_order,
         fcc.qdrant_prefix, fcc.icon, fcc.icon_color, fcc.is_active
ORDER BY fcc.section_order;

-- View: All Flywheel collections with their sections
CREATE OR REPLACE VIEW v_flywheel_collections_by_section AS
SELECT
    fcc.name AS section_name,
    fcc.section_order,
    fc.slug AS collection_slug,
    fc.name AS collection_name,
    fc.display_name,
    fc.description,
    fc.qdrant_collection_prefix,
    fc.display_order,
    fc.is_active
FROM flywheel_collections fc
JOIN flywheel_collection_categories fcc ON fc.category_id = fcc.id
ORDER BY fcc.section_order, fc.display_order;

-- View: Orphaned collections check (should always return 0 rows)
CREATE OR REPLACE VIEW v_flywheel_orphaned_collections AS
SELECT fc.*
FROM flywheel_collections fc
LEFT JOIN flywheel_collection_categories fcc ON fc.category_id = fcc.id
WHERE fcc.id IS NULL OR fc.category_id IS NULL;

-- ============================================
-- PART 7: VALIDATION QUERIES
-- Ensure data integrity
-- ============================================

DO $$
DECLARE
    section_count INT;
    collection_count INT;
    orphan_count INT;
    data_count INT;
    intel_count INT;
    exec_count INT;
BEGIN
    -- Validate exactly 3 sections exist
    SELECT COUNT(*) INTO section_count
    FROM flywheel_collection_categories
    WHERE level = 0 AND collection_id IS NULL;

    IF section_count != 3 THEN
        RAISE EXCEPTION 'Expected 3 Flywheel sections, found %', section_count;
    END IF;

    -- Validate 30 total collections exist
    SELECT COUNT(*) INTO collection_count FROM flywheel_collections;

    IF collection_count != 30 THEN
        RAISE EXCEPTION 'Expected 30 Flywheel collections, found %', collection_count;
    END IF;

    -- Validate no orphaned collections
    SELECT COUNT(*) INTO orphan_count FROM v_flywheel_orphaned_collections;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Found % orphaned Flywheel collections', orphan_count;
    END IF;

    -- Validate 10 collections per section
    SELECT COUNT(*) INTO data_count FROM flywheel_collections
    WHERE category_id = 'a0000001-0000-0000-0000-000000000001'::UUID;

    SELECT COUNT(*) INTO intel_count FROM flywheel_collections
    WHERE category_id = 'a0000001-0000-0000-0000-000000000002'::UUID;

    SELECT COUNT(*) INTO exec_count FROM flywheel_collections
    WHERE category_id = 'a0000001-0000-0000-0000-000000000003'::UUID;

    IF data_count != 10 OR intel_count != 10 OR exec_count != 10 THEN
        RAISE EXCEPTION 'Expected 10 collections per section. Data: %, Intelligence: %, Execution: %',
            data_count, intel_count, exec_count;
    END IF;

    RAISE NOTICE '✓ Flywheel validation passed: 3 sections, 30 collections (10 per section), 0 orphans';
END $$;

-- ============================================
-- PART 8: COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON TABLE flywheel_collections IS
'Flywheel collection registry - control-plane metadata for Qdrant collection provisioning.
Each record defines a logical collection belonging to one Flywheel section (Data, Intelligence, Execution).
This table is the SINGLE SOURCE OF TRUTH for Flywheel collection definitions.
Qdrant orchestration must read from this table, not use hard-coded definitions.';

COMMENT ON TABLE flywheel_collection_categories IS
'Flywheel section registry - defines the three Flywheel lifecycle sections: Data, Intelligence, Execution.
Top-level categories (level=0, collection_id IS NULL) represent sections.
This table is the AUTHORITATIVE REGISTRY for Flywheel sections.';

COMMENT ON COLUMN flywheel_collections.category_id IS
'Foreign key to flywheel_collection_categories. Enforces that every collection belongs to exactly one Flywheel section.';

COMMENT ON COLUMN flywheel_collections.qdrant_collection_prefix IS
'Prefix used when creating the corresponding Qdrant collection. Format: flywheel_{section}_{collection}';

COMMENT ON COLUMN flywheel_collection_categories.section_order IS
'Deterministic ordering for the three Flywheel sections: 1=Data, 2=Intelligence, 3=Execution';

COMMENT ON COLUMN flywheel_collection_categories.qdrant_prefix IS
'Prefix applied to all Qdrant collections within this section';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 095 complete: Flywheel Knowledge Architecture established';
    RAISE NOTICE '  - 3 sections: Data, Intelligence, Execution';
    RAISE NOTICE '  - 30 collections (10 per section)';
    RAISE NOTICE '  - Referential integrity enforced';
    RAISE NOTICE '  - Validation views created';
END $$;
