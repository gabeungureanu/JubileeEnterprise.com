-- ============================================
-- JubileeVerse Database Schema
-- Migration 096: Flywheel Collection Root Structures
--
-- Creates root category structures for Flywheel collections:
--   - MarketData: 8 roots (Prices, Volume, OrderBook, Trades, Volatility, Liquidity, TechnicalIndicators, MarketStructure)
--   - Fundamentals: 7 roots (FinancialStatements, Valuation, Ratios, Earnings, Guidance, BalanceSheetQuality, CapitalStructure)
--   - Macroeconomic: 6 roots (Growth, Inflation, Employment, MonetaryPolicy, FiscalPolicy, GlobalIndicators)
--
-- These roots reflect professional trading and analytics consumption patterns.
-- ============================================

-- ============================================
-- PART 1: CLEANUP - Remove any existing roots for these collections
-- ============================================

DELETE FROM flywheel_collection_categories
WHERE collection_id IN (
    SELECT id FROM flywheel_collections WHERE slug IN ('market-data', 'fundamentals', 'macroeconomic')
);

-- ============================================
-- PART 2: CREATE ROOT CATEGORIES FOR MARKETDATA COLLECTION
-- 8 roots reflecting market data consumption patterns
-- ============================================

INSERT INTO flywheel_collection_categories (
    collection_id,
    slug,
    name,
    display_name,
    description,
    level,
    display_order,
    icon,
    icon_color,
    is_active,
    is_expandable
)
SELECT
    fc.id,
    root.slug,
    root.name,
    root.display_name,
    root.description,
    1,  -- Level 1 (roots under collection)
    root.display_order,
    root.icon,
    '#81c784',  -- Light green for Flywheel
    TRUE,
    TRUE
FROM flywheel_collections fc
CROSS JOIN (
    VALUES
    ('prices', 'Prices', 'Prices',
     'Real-time and historical price data including quotes, OHLCV, bid/ask spreads, and price discovery mechanisms.',
     1, 'trending-up'),
    ('volume', 'Volume', 'Volume',
     'Trading volume metrics including tick volume, dollar volume, volume profiles, and volume-weighted analytics.',
     2, 'bar-chart-2'),
    ('orderbook', 'OrderBook', 'Order Book',
     'Order book depth, level 2 data, market depth snapshots, and order flow imbalance metrics.',
     3, 'layers'),
    ('trades', 'Trades', 'Trades',
     'Tick-level trade data, time and sales, trade size distribution, and trade classification.',
     4, 'activity'),
    ('volatility', 'Volatility', 'Volatility',
     'Realized volatility, implied volatility surfaces, volatility term structure, and volatility regime indicators.',
     5, 'zap'),
    ('liquidity', 'Liquidity', 'Liquidity',
     'Bid-ask spreads, market impact estimates, liquidity scores, and intraday liquidity patterns.',
     6, 'droplet'),
    ('technical-indicators', 'TechnicalIndicators', 'Technical Indicators',
     'Moving averages, oscillators, momentum indicators, trend indicators, and derived technical metrics.',
     7, 'sliders'),
    ('market-structure', 'MarketStructure', 'Market Structure',
     'Market microstructure data, venue analytics, fragmentation metrics, and market quality indicators.',
     8, 'grid')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'market-data';

-- ============================================
-- PART 3: CREATE ROOT CATEGORIES FOR FUNDAMENTALS COLLECTION
-- 7 roots reflecting financial statement and valuation workflows
-- ============================================

INSERT INTO flywheel_collection_categories (
    collection_id,
    slug,
    name,
    display_name,
    description,
    level,
    display_order,
    icon,
    icon_color,
    is_active,
    is_expandable
)
SELECT
    fc.id,
    root.slug,
    root.name,
    root.display_name,
    root.description,
    1,
    root.display_order,
    root.icon,
    '#81c784',
    TRUE,
    TRUE
FROM flywheel_collections fc
CROSS JOIN (
    VALUES
    ('financial-statements', 'FinancialStatements', 'Financial Statements',
     'Income statements, balance sheets, cash flow statements, and statement of changes in equity.',
     1, 'file-text'),
    ('valuation', 'Valuation', 'Valuation',
     'Valuation multiples, DCF inputs, comparable company analysis, and intrinsic value estimates.',
     2, 'dollar-sign'),
    ('ratios', 'Ratios', 'Ratios',
     'Profitability ratios, liquidity ratios, leverage ratios, efficiency ratios, and growth metrics.',
     3, 'percent'),
    ('earnings', 'Earnings', 'Earnings',
     'Earnings per share, earnings surprises, earnings quality, and earnings momentum indicators.',
     4, 'trending-up'),
    ('guidance', 'Guidance', 'Guidance',
     'Management guidance, analyst estimates, consensus forecasts, and guidance revision tracking.',
     5, 'compass'),
    ('balance-sheet-quality', 'BalanceSheetQuality', 'Balance Sheet Quality',
     'Asset quality, liability structure, working capital health, and balance sheet stress indicators.',
     6, 'shield'),
    ('capital-structure', 'CapitalStructure', 'Capital Structure',
     'Debt levels, equity structure, cost of capital, leverage dynamics, and capital allocation patterns.',
     7, 'layers')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'fundamentals';

-- ============================================
-- PART 4: CREATE ROOT CATEGORIES FOR MACROECONOMIC COLLECTION
-- 6 roots reflecting top-down economic modeling and regime analysis
-- ============================================

INSERT INTO flywheel_collection_categories (
    collection_id,
    slug,
    name,
    display_name,
    description,
    level,
    display_order,
    icon,
    icon_color,
    is_active,
    is_expandable
)
SELECT
    fc.id,
    root.slug,
    root.name,
    root.display_name,
    root.description,
    1,
    root.display_order,
    root.icon,
    '#81c784',
    TRUE,
    TRUE
FROM flywheel_collections fc
CROSS JOIN (
    VALUES
    ('growth', 'Growth', 'Growth',
     'GDP growth, industrial production, PMI indicators, leading economic indicators, and growth regime classification.',
     1, 'trending-up'),
    ('inflation', 'Inflation', 'Inflation',
     'CPI, PPI, PCE, inflation expectations, breakeven rates, and inflation regime indicators.',
     2, 'thermometer'),
    ('employment', 'Employment', 'Employment',
     'Non-farm payrolls, unemployment rates, labor force participation, wage growth, and labor market slack indicators.',
     3, 'users'),
    ('monetary-policy', 'MonetaryPolicy', 'Monetary Policy',
     'Central bank rates, Fed funds futures, quantitative easing metrics, policy stance indicators, and rate expectations.',
     4, 'credit-card'),
    ('fiscal-policy', 'FiscalPolicy', 'Fiscal Policy',
     'Government spending, tax policy changes, deficit projections, and fiscal stimulus indicators.',
     5, 'briefcase'),
    ('global-indicators', 'GlobalIndicators', 'Global Indicators',
     'Cross-border trade flows, currency dynamics, global PMIs, emerging market indicators, and geopolitical risk metrics.',
     6, 'globe')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'macroeconomic';

-- ============================================
-- PART 5: VALIDATION
-- ============================================

DO $$
DECLARE
    market_data_roots INT;
    fundamentals_roots INT;
    macro_roots INT;
BEGIN
    -- Count roots for each collection
    SELECT COUNT(*) INTO market_data_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'market-data' AND fcc.level = 1;

    SELECT COUNT(*) INTO fundamentals_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'fundamentals' AND fcc.level = 1;

    SELECT COUNT(*) INTO macro_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'macroeconomic' AND fcc.level = 1;

    -- Validate counts
    IF market_data_roots != 8 THEN
        RAISE WARNING 'MarketData expected 8 roots, found %', market_data_roots;
    ELSE
        RAISE NOTICE '✓ MarketData: 8 roots created';
    END IF;

    IF fundamentals_roots != 7 THEN
        RAISE WARNING 'Fundamentals expected 7 roots, found %', fundamentals_roots;
    ELSE
        RAISE NOTICE '✓ Fundamentals: 7 roots created';
    END IF;

    IF macro_roots != 6 THEN
        RAISE WARNING 'Macroeconomic expected 6 roots, found %', macro_roots;
    ELSE
        RAISE NOTICE '✓ Macroeconomic: 6 roots created';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'Migration 096 complete: Flywheel Collection Root Structures';
    RAISE NOTICE '  - MarketData: % roots', market_data_roots;
    RAISE NOTICE '  - Fundamentals: % roots', fundamentals_roots;
    RAISE NOTICE '  - Macroeconomic: % roots', macro_roots;
    RAISE NOTICE '  - Total: % roots', market_data_roots + fundamentals_roots + macro_roots;
END $$;

-- ============================================
-- PART 6: CREATE VIEW FOR COLLECTION ROOTS
-- ============================================

CREATE OR REPLACE VIEW v_flywheel_collection_roots AS
SELECT
    fc.slug AS collection_slug,
    fc.name AS collection_name,
    fc.display_name AS collection_display_name,
    fcc.slug AS root_slug,
    fcc.name AS root_name,
    fcc.display_name AS root_display_name,
    fcc.description AS root_description,
    fcc.display_order AS root_order,
    fcc.icon AS root_icon,
    fcc.icon_color AS root_color,
    fcc.is_active AS root_active
FROM flywheel_collection_categories fcc
JOIN flywheel_collections fc ON fcc.collection_id = fc.id
WHERE fcc.level = 1
ORDER BY fc.display_order, fcc.display_order;

COMMENT ON VIEW v_flywheel_collection_roots IS
'View showing all root categories for Flywheel collections.
Roots are level-1 categories that organize data within each collection.';
