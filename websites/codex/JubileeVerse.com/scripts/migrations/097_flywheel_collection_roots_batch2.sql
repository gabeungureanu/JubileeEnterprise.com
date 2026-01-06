-- ============================================
-- JubileeVerse Database Schema
-- Migration 097: Flywheel Collection Root Structures - Batch 2
--
-- Creates root category structures for additional Flywheel collections:
--   - AlternativeData: 8 roots
--   - News: 7 roots
--   - Sentiment: 6 roots
--   - HistoricalPrices: 6 roots
--   - CorporateActions: 7 roots
--   - Benchmarks: 6 roots
--
-- Total: 40 new roots across 6 collections
-- ============================================

-- ============================================
-- PART 1: CLEANUP - Remove any existing roots for these collections
-- ============================================

DELETE FROM flywheel_collection_categories
WHERE collection_id IN (
    SELECT id FROM flywheel_collections
    WHERE slug IN ('alternative-data', 'news', 'sentiment', 'historical-prices', 'corporate-actions', 'benchmarks')
);

-- ============================================
-- PART 2: CREATE ROOT CATEGORIES FOR ALTERNATIVEDATA COLLECTION
-- 8 roots for non-traditional data sources
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
    ('web-traffic', 'WebTraffic', 'Web Traffic',
     'Website visitor analytics, page views, unique visitors, session duration, and traffic source attribution.',
     1, 'globe'),
    ('app-usage', 'AppUsage', 'App Usage',
     'Mobile and desktop application usage metrics, DAU/MAU, session frequency, and engagement patterns.',
     2, 'smartphone'),
    ('geolocation', 'Geolocation', 'Geolocation',
     'Foot traffic data, location intelligence, store visits, movement patterns, and geographic heat maps.',
     3, 'map-pin'),
    ('satellite', 'Satellite', 'Satellite',
     'Satellite imagery analytics, parking lot counts, agricultural yields, construction activity, and infrastructure monitoring.',
     4, 'radio'),
    ('supply-chain', 'SupplyChain', 'Supply Chain',
     'Shipping data, port activity, container tracking, inventory levels, and logistics flow metrics.',
     5, 'truck'),
    ('social-signals', 'SocialSignals', 'Social Signals',
     'Social media mentions, hashtag trends, influencer activity, viral content detection, and community engagement.',
     6, 'share-2'),
    ('transactional', 'Transactional', 'Transactional',
     'Credit card transaction data, consumer spending patterns, retail sales signals, and payment flow analytics.',
     7, 'credit-card'),
    ('search-trends', 'SearchTrends', 'Search Trends',
     'Search engine query volumes, keyword trends, topic interest over time, and search intent signals.',
     8, 'search')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'alternative-data';

-- ============================================
-- PART 3: CREATE ROOT CATEGORIES FOR NEWS COLLECTION
-- 7 roots for financial news sources
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
    ('headlines', 'Headlines', 'Headlines',
     'Breaking news headlines, top stories, headline sentiment, and real-time news alerts.',
     1, 'zap'),
    ('articles', 'Articles', 'Articles',
     'Full news articles, long-form content, investigative pieces, and in-depth market analysis.',
     2, 'file-text'),
    ('press-releases', 'PressReleases', 'Press Releases',
     'Official company press releases, announcements, product launches, and corporate communications.',
     3, 'megaphone'),
    ('earnings-news', 'EarningsNews', 'Earnings News',
     'Earnings announcements, quarterly results coverage, guidance updates, and earnings call summaries.',
     4, 'dollar-sign'),
    ('mergers-acquisitions', 'MergersAcquisitions', 'Mergers & Acquisitions',
     'M&A deal announcements, acquisition rumors, merger terms, and deal completion news.',
     5, 'git-merge'),
    ('regulatory-news', 'RegulatoryNews', 'Regulatory News',
     'SEC filings, regulatory announcements, compliance updates, and government policy impacts.',
     6, 'shield'),
    ('analyst-commentary', 'AnalystCommentary', 'Analyst Commentary',
     'Analyst notes, research highlights, rating changes, and expert market commentary.',
     7, 'message-circle')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'news';

-- ============================================
-- PART 4: CREATE ROOT CATEGORIES FOR SENTIMENT COLLECTION
-- 6 roots for sentiment analysis categories
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
    ('market-sentiment', 'MarketSentiment', 'Market Sentiment',
     'Broad market sentiment indicators, fear/greed indices, risk appetite measures, and market mood tracking.',
     1, 'activity'),
    ('equity-sentiment', 'EquitySentiment', 'Equity Sentiment',
     'Individual stock sentiment scores, bullish/bearish signals, and equity-specific mood indicators.',
     2, 'trending-up'),
    ('sector-sentiment', 'SectorSentiment', 'Sector Sentiment',
     'Sector rotation sentiment, industry mood tracking, and cross-sector sentiment comparisons.',
     3, 'pie-chart'),
    ('news-sentiment', 'NewsSentiment', 'News Sentiment',
     'News article sentiment analysis, headline tone classification, and media coverage sentiment scores.',
     4, 'file-text'),
    ('social-sentiment', 'SocialSentiment', 'Social Sentiment',
     'Social media sentiment metrics, Twitter/Reddit mood, retail investor sentiment, and viral topic sentiment.',
     5, 'message-square'),
    ('analyst-sentiment', 'AnalystSentiment', 'Analyst Sentiment',
     'Analyst recommendation sentiment, earnings call tone analysis, and institutional sentiment indicators.',
     6, 'users')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'sentiment';

-- ============================================
-- PART 5: CREATE ROOT CATEGORIES FOR HISTORICALPRICES COLLECTION
-- 6 roots for historical price data types
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
    ('daily', 'Daily', 'Daily',
     'End-of-day OHLCV data, daily price bars, settlement prices, and daily trading statistics.',
     1, 'calendar'),
    ('intraday', 'Intraday', 'Intraday',
     'Tick data, minute bars, hourly bars, intraday VWAP, and high-frequency price snapshots.',
     2, 'clock'),
    ('adjusted', 'Adjusted', 'Adjusted',
     'Split-adjusted prices, dividend-adjusted series, and corporate action normalized data.',
     3, 'sliders'),
    ('corporate-adjusted', 'CorporateAdjusted', 'Corporate Adjusted',
     'Prices adjusted for all corporate actions including mergers, spin-offs, and rights issues.',
     4, 'settings'),
    ('total-return', 'TotalReturn', 'Total Return',
     'Total return indices, reinvested dividend series, and cumulative return calculations.',
     5, 'percent'),
    ('long-term-series', 'LongTermSeries', 'Long-Term Series',
     'Extended historical archives, multi-decade price series, and legacy market data.',
     6, 'database')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'historical-prices';

-- ============================================
-- PART 6: CREATE ROOT CATEGORIES FOR CORPORATEACTIONS COLLECTION
-- 7 roots for corporate action types
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
    ('dividends', 'Dividends', 'Dividends',
     'Cash dividends, special dividends, dividend declarations, ex-dates, and payment schedules.',
     1, 'dollar-sign'),
    ('splits', 'Splits', 'Splits',
     'Stock splits, reverse splits, split ratios, and split-adjusted factor calculations.',
     2, 'scissors'),
    ('spin-offs', 'SpinOffs', 'Spin-Offs',
     'Corporate spin-off events, parent-child relationships, and spin-off valuation data.',
     3, 'git-branch'),
    ('mergers', 'Mergers', 'Mergers',
     'Merger announcements, merger terms, consideration details, and completion status tracking.',
     4, 'git-merge'),
    ('acquisitions', 'Acquisitions', 'Acquisitions',
     'Acquisition events, tender offers, acquisition premiums, and deal structure data.',
     5, 'target'),
    ('buybacks', 'Buybacks', 'Buybacks',
     'Share repurchase programs, buyback authorizations, executed buybacks, and buyback impact analysis.',
     6, 'rotate-ccw'),
    ('rights-issues', 'RightsIssues', 'Rights Issues',
     'Rights offerings, subscription prices, rights ratios, and dilution calculations.',
     7, 'file-plus')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'corporate-actions';

-- ============================================
-- PART 7: CREATE ROOT CATEGORIES FOR BENCHMARKS COLLECTION
-- 6 roots for benchmark categories
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
    ('indices', 'Indices', 'Indices',
     'Major market indices, broad market benchmarks, index compositions, and index methodology documentation.',
     1, 'bar-chart-2'),
    ('sectors', 'Sectors', 'Sectors',
     'Sector indices, GICS classifications, industry benchmarks, and sector rotation tracking.',
     2, 'pie-chart'),
    ('factors', 'Factors', 'Factors',
     'Factor indices, smart beta benchmarks, value/growth/momentum factors, and factor exposure data.',
     3, 'layers'),
    ('asset-classes', 'AssetClasses', 'Asset Classes',
     'Cross-asset benchmarks, fixed income indices, commodity indices, and multi-asset class references.',
     4, 'briefcase'),
    ('regional-benchmarks', 'RegionalBenchmarks', 'Regional Benchmarks',
     'Geographic benchmarks, country indices, emerging market benchmarks, and regional performance data.',
     5, 'globe'),
    ('custom-benchmarks', 'CustomBenchmarks', 'Custom Benchmarks',
     'Custom-weighted benchmarks, blended indices, client-specific benchmarks, and bespoke reference portfolios.',
     6, 'edit-3')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'benchmarks';

-- ============================================
-- PART 8: VALIDATION
-- ============================================

DO $$
DECLARE
    alt_data_roots INT;
    news_roots INT;
    sentiment_roots INT;
    hist_prices_roots INT;
    corp_actions_roots INT;
    benchmarks_roots INT;
    total_roots INT;
BEGIN
    -- Count roots for each collection
    SELECT COUNT(*) INTO alt_data_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'alternative-data';

    SELECT COUNT(*) INTO news_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'news';

    SELECT COUNT(*) INTO sentiment_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'sentiment';

    SELECT COUNT(*) INTO hist_prices_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'historical-prices';

    SELECT COUNT(*) INTO corp_actions_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'corporate-actions';

    SELECT COUNT(*) INTO benchmarks_roots
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug = 'benchmarks';

    total_roots := alt_data_roots + news_roots + sentiment_roots + hist_prices_roots + corp_actions_roots + benchmarks_roots;

    -- Output results
    RAISE NOTICE '';
    RAISE NOTICE 'Migration 097 - Flywheel Collection Roots Batch 2';
    RAISE NOTICE '════════════════════════════════════════════════';
    RAISE NOTICE '  AlternativeData:   % roots (expected 8)', alt_data_roots;
    RAISE NOTICE '  News:              % roots (expected 7)', news_roots;
    RAISE NOTICE '  Sentiment:         % roots (expected 6)', sentiment_roots;
    RAISE NOTICE '  HistoricalPrices:  % roots (expected 6)', hist_prices_roots;
    RAISE NOTICE '  CorporateActions:  % roots (expected 7)', corp_actions_roots;
    RAISE NOTICE '  Benchmarks:        % roots (expected 6)', benchmarks_roots;
    RAISE NOTICE '════════════════════════════════════════════════';
    RAISE NOTICE '  Total:             % roots (expected 40)', total_roots;

    -- Validate counts
    IF total_roots != 40 THEN
        RAISE WARNING 'Expected 40 total roots, found %', total_roots;
    ELSE
        RAISE NOTICE '  ✓ All roots created successfully';
    END IF;
END $$;

-- ============================================
-- PART 9: UPDATE VIEW FOR COLLECTION ROOTS
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
ORDER BY fc.display_order, fcc.display_order;

COMMENT ON VIEW v_flywheel_collection_roots IS
'View showing all root categories for Flywheel collections.
Roots are categories that organize data within each collection.
Updated in migration 097 to include batch 2 collections.';
