-- ============================================
-- JubileeVerse Database Schema
-- Migration 098: Flywheel Collection Root Structures - Batch 3
--
-- Creates root category structures for Intelligence and Execution collections:
--
-- INTELLIGENCE SECTION (10 collections):
--   - Signals: 6 roots
--   - Strategies: 7 roots
--   - Models: 6 roots
--   - Forecasts: 5 roots
--   - Correlations: 5 roots
--   - RiskProfiles: 6 roots
--   - ScenarioAnalysis: 5 roots
--   - Optimization: 5 roots
--   - AlphaResearch: 5 roots
--   - Constraints: 5 roots
--
-- EXECUTION SECTION (10 collections):
--   - Portfolios: 6 roots
--   - Trades: 5 roots
--   - Orders: 5 roots
--   - ExecutionLogs: 5 roots
--   - Performance: 5 roots
--   - Attribution: 5 roots
--   - Compliance: 5 roots
--   - Controls: 5 roots
--   - Alerts: 5 roots
--   - Audit: 5 roots
--
-- Total: 106 new roots across 20 collections
-- ============================================

-- ============================================
-- PART 1: CLEANUP - Remove existing roots for these collections
-- ============================================

DELETE FROM flywheel_collection_categories
WHERE collection_id IN (
    SELECT id FROM flywheel_collections
    WHERE slug IN (
        -- Intelligence
        'signals', 'strategies', 'models', 'forecasts', 'correlations',
        'risk-profiles', 'scenario-analysis', 'optimization', 'alpha-research', 'constraints',
        -- Execution
        'portfolios', 'trades', 'orders', 'execution-logs', 'performance',
        'attribution', 'compliance', 'controls', 'alerts', 'audit'
    )
);

-- ============================================
-- INTELLIGENCE SECTION COLLECTIONS
-- ============================================

-- ============================================
-- SIGNALS: 6 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('technical-signals', 'TechnicalSignals', 'Technical Signals', 'Price-based and indicator-driven signals from technical analysis.', 1, 'trending-up'),
    ('fundamental-signals', 'FundamentalSignals', 'Fundamental Signals', 'Signals derived from financial statements, valuations, and fundamental metrics.', 2, 'file-text'),
    ('macro-signals', 'MacroSignals', 'Macro Signals', 'Economic and macroeconomic regime-based signals.', 3, 'globe'),
    ('event-signals', 'EventSignals', 'Event Signals', 'Corporate event, news, and calendar-driven signals.', 4, 'calendar'),
    ('flow-signals', 'FlowSignals', 'Flow Signals', 'Order flow, fund flow, and positioning-based signals.', 5, 'activity'),
    ('volatility-signals', 'VolatilitySignals', 'Volatility Signals', 'Volatility regime and vol surface-derived signals.', 6, 'zap')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'signals';

-- ============================================
-- STRATEGIES: 7 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('long-short', 'LongShort', 'Long/Short', 'Long/short equity strategies with paired positions.', 1, 'git-compare'),
    ('momentum', 'Momentum', 'Momentum', 'Trend-following and momentum-based strategies.', 2, 'trending-up'),
    ('mean-reversion', 'MeanReversion', 'Mean Reversion', 'Statistical arbitrage and mean-reverting strategies.', 3, 'repeat'),
    ('arbitrage', 'Arbitrage', 'Arbitrage', 'Pure arbitrage, relative value, and convergence strategies.', 4, 'shuffle'),
    ('factor-based', 'FactorBased', 'Factor-Based', 'Factor investing and smart beta strategies.', 5, 'layers'),
    ('thematic', 'Thematic', 'Thematic', 'Thematic and sector rotation strategies.', 6, 'compass'),
    ('event-driven', 'EventDriven', 'Event-Driven', 'Merger arb, earnings, and corporate event strategies.', 7, 'calendar')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'strategies';

-- ============================================
-- MODELS: 6 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('statistical-models', 'StatisticalModels', 'Statistical Models', 'Traditional statistical and econometric models.', 1, 'bar-chart-2'),
    ('machine-learning', 'MachineLearning', 'Machine Learning', 'ML models including supervised, unsupervised, and deep learning.', 2, 'cpu'),
    ('time-series', 'TimeSeries', 'Time Series', 'Time series forecasting and ARIMA-family models.', 3, 'clock'),
    ('factor-models', 'FactorModels', 'Factor Models', 'Multi-factor models and factor decomposition.', 4, 'layers'),
    ('regime-models', 'RegimeModels', 'Regime Models', 'Hidden Markov and regime-switching models.', 5, 'toggle-left'),
    ('risk-models', 'RiskModels', 'Risk Models', 'Covariance, VaR, and risk factor models.', 6, 'shield')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'models';

-- ============================================
-- FORECASTS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('price-forecasts', 'PriceForecasts', 'Price Forecasts', 'Point and probabilistic price forecasts.', 1, 'trending-up'),
    ('volatility-forecasts', 'VolatilityForecasts', 'Volatility Forecasts', 'Realized and implied volatility forecasts.', 2, 'activity'),
    ('earnings-forecasts', 'EarningsForecasts', 'Earnings Forecasts', 'EPS and revenue forecast models.', 3, 'dollar-sign'),
    ('macro-forecasts', 'MacroForecasts', 'Macro Forecasts', 'Economic indicator and GDP forecasts.', 4, 'globe'),
    ('scenario-forecasts', 'ScenarioForecasts', 'Scenario Forecasts', 'Multi-scenario and conditional forecasts.', 5, 'git-branch')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'forecasts';

-- ============================================
-- CORRELATIONS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('asset-correlations', 'AssetCorrelations', 'Asset Correlations', 'Pairwise and rolling asset correlations.', 1, 'link'),
    ('sector-correlations', 'SectorCorrelations', 'Sector Correlations', 'Sector and industry group correlations.', 2, 'pie-chart'),
    ('cross-asset', 'CrossAsset', 'Cross-Asset', 'Cross-asset class correlation matrices.', 3, 'grid'),
    ('temporal-correlations', 'TemporalCorrelations', 'Temporal Correlations', 'Lead-lag and time-varying correlations.', 4, 'clock'),
    ('regime-correlations', 'RegimeCorrelations', 'Regime Correlations', 'Regime-dependent correlation structures.', 5, 'toggle-left')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'correlations';

-- ============================================
-- RISK PROFILES: 6 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('market-risk', 'MarketRisk', 'Market Risk', 'Beta, VaR, and systematic risk measures.', 1, 'trending-down'),
    ('credit-risk', 'CreditRisk', 'Credit Risk', 'Credit spreads, default risk, and credit quality.', 2, 'alert-triangle'),
    ('liquidity-risk', 'LiquidityRisk', 'Liquidity Risk', 'Market impact, bid-ask, and liquidity metrics.', 3, 'droplet'),
    ('volatility-risk', 'VolatilityRisk', 'Volatility Risk', 'Vega, vol-of-vol, and volatility exposures.', 4, 'zap'),
    ('concentration-risk', 'ConcentrationRisk', 'Concentration Risk', 'Position sizing, sector, and name concentration.', 5, 'target'),
    ('tail-risk', 'TailRisk', 'Tail Risk', 'CVaR, expected shortfall, and extreme event risk.', 6, 'alert-octagon')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'risk-profiles';

-- ============================================
-- SCENARIO ANALYSIS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('stress-scenarios', 'StressScenarios', 'Stress Scenarios', 'Historical and hypothetical stress tests.', 1, 'alert-triangle'),
    ('macro-scenarios', 'MacroScenarios', 'Macro Scenarios', 'Economic regime and macro shock scenarios.', 2, 'globe'),
    ('market-shocks', 'MarketShocks', 'Market Shocks', 'Flash crash and market dislocation scenarios.', 3, 'zap'),
    ('policy-scenarios', 'PolicyScenarios', 'Policy Scenarios', 'Central bank and fiscal policy scenarios.', 4, 'briefcase'),
    ('custom-scenarios', 'CustomScenarios', 'Custom Scenarios', 'User-defined and bespoke scenario analysis.', 5, 'edit-3')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'scenario-analysis';

-- ============================================
-- OPTIMIZATION: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('portfolio-optimization', 'PortfolioOptimization', 'Portfolio Optimization', 'Mean-variance and efficient frontier optimization.', 1, 'maximize-2'),
    ('risk-optimization', 'RiskOptimization', 'Risk Optimization', 'Risk parity and minimum variance optimization.', 2, 'shield'),
    ('return-optimization', 'ReturnOptimization', 'Return Optimization', 'Maximum return and alpha optimization.', 3, 'trending-up'),
    ('constraint-optimization', 'ConstraintOptimization', 'Constraint Optimization', 'Constraint-aware and penalty-based optimization.', 4, 'lock'),
    ('multi-objective', 'MultiObjective', 'Multi-Objective', 'Pareto optimal and multi-goal optimization.', 5, 'target')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'optimization';

-- ============================================
-- ALPHA RESEARCH: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('signal-discovery', 'SignalDiscovery', 'Signal Discovery', 'Alpha signal mining and pattern discovery.', 1, 'search'),
    ('feature-engineering', 'FeatureEngineering', 'Feature Engineering', 'Feature construction and transformation pipelines.', 2, 'tool'),
    ('backtests', 'Backtests', 'Backtests', 'Historical backtesting and walk-forward analysis.', 3, 'rewind'),
    ('factor-research', 'FactorResearch', 'Factor Research', 'Factor decay, crowding, and persistence analysis.', 4, 'layers'),
    ('strategy-evaluation', 'StrategyEvaluation', 'Strategy Evaluation', 'Strategy performance and robustness testing.', 5, 'check-circle')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'alpha-research';

-- ============================================
-- CONSTRAINTS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('regulatory-constraints', 'RegulatoryConstraints', 'Regulatory Constraints', 'SEC, UCITS, and regulatory position limits.', 1, 'shield'),
    ('liquidity-constraints', 'LiquidityConstraints', 'Liquidity Constraints', 'ADV-based and market impact constraints.', 2, 'droplet'),
    ('risk-limits', 'RiskLimits', 'Risk Limits', 'VaR, tracking error, and risk budget limits.', 3, 'alert-triangle'),
    ('capital-limits', 'CapitalLimits', 'Capital Limits', 'Gross/net exposure and leverage constraints.', 4, 'dollar-sign'),
    ('operational-constraints', 'OperationalConstraints', 'Operational Constraints', 'Settlement, custody, and operational limits.', 5, 'settings')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'constraints';

-- ============================================
-- EXECUTION SECTION COLLECTIONS
-- ============================================

-- ============================================
-- PORTFOLIOS: 6 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('portfolio-definitions', 'PortfolioDefinitions', 'Portfolio Definitions', 'Portfolio setup, benchmarks, and configuration.', 1, 'folder'),
    ('holdings', 'Holdings', 'Holdings', 'Current positions, quantities, and market values.', 2, 'list'),
    ('allocations', 'Allocations', 'Allocations', 'Target weights, sector allocations, and asset mix.', 3, 'pie-chart'),
    ('rebalancing', 'Rebalancing', 'Rebalancing', 'Rebalance triggers, schedules, and trade lists.', 4, 'refresh-cw'),
    ('portfolio-hierarchy', 'PortfolioHierarchy', 'Portfolio Hierarchy', 'Sleeve structure, sub-portfolios, and rollups.', 5, 'git-branch'),
    ('portfolio-metadata', 'PortfolioMetadata', 'Portfolio Metadata', 'Tags, classifications, and custom attributes.', 6, 'tag')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'portfolios';

-- ============================================
-- TRADES: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('trade-blotter', 'TradeBlotter', 'Trade Blotter', 'Intraday trade activity and working orders.', 1, 'file-text'),
    ('trade-history', 'TradeHistory', 'Trade History', 'Historical trade archive and audit trail.', 2, 'clock'),
    ('trade-lifecycle', 'TradeLifecycle', 'Trade Lifecycle', 'Trade states from inception to settlement.', 3, 'repeat'),
    ('trade-exceptions', 'TradeExceptions', 'Trade Exceptions', 'Failed trades, breaks, and exception handling.', 4, 'alert-triangle'),
    ('trade-costs', 'TradeCosts', 'Trade Costs', 'Commissions, fees, and transaction cost analysis.', 5, 'dollar-sign')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'trades';

-- ============================================
-- ORDERS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('order-book', 'OrderBook', 'Order Book', 'Active orders and working order queue.', 1, 'book'),
    ('order-history', 'OrderHistory', 'Order History', 'Completed and cancelled order archive.', 2, 'clock'),
    ('order-types', 'OrderTypes', 'Order Types', 'Market, limit, stop, and algorithmic order definitions.', 3, 'list'),
    ('order-routing', 'OrderRouting', 'Order Routing', 'Venue selection, SOR, and routing logic.', 4, 'send'),
    ('order-status', 'OrderStatus', 'Order Status', 'Order state tracking and status updates.', 5, 'check-circle')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'orders';

-- ============================================
-- EXECUTION LOGS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('execution-events', 'ExecutionEvents', 'Execution Events', 'Fill events, partial fills, and execution timestamps.', 1, 'activity'),
    ('execution-latency', 'ExecutionLatency', 'Execution Latency', 'Order-to-fill latency and timing analytics.', 2, 'clock'),
    ('fill-details', 'FillDetails', 'Fill Details', 'Fill prices, quantities, and venue information.', 3, 'check-square'),
    ('slippage', 'Slippage', 'Slippage', 'Implementation shortfall and slippage analysis.', 4, 'trending-down'),
    ('execution-errors', 'ExecutionErrors', 'Execution Errors', 'Rejected orders, errors, and failure logs.', 5, 'alert-circle')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'execution-logs';

-- ============================================
-- PERFORMANCE: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('returns', 'Returns', 'Returns', 'Daily, weekly, and periodic return series.', 1, 'percent'),
    ('risk-adjusted-returns', 'RiskAdjustedReturns', 'Risk-Adjusted Returns', 'Sharpe, Sortino, and information ratios.', 2, 'award'),
    ('drawdowns', 'Drawdowns', 'Drawdowns', 'Maximum drawdown, drawdown duration, and recovery.', 3, 'trending-down'),
    ('volatility-metrics', 'VolatilityMetrics', 'Volatility Metrics', 'Realized vol, tracking error, and vol ratios.', 4, 'activity'),
    ('performance-history', 'PerformanceHistory', 'Performance History', 'Historical performance archive and time series.', 5, 'clock')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'performance';

-- ============================================
-- ATTRIBUTION: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('asset-attribution', 'AssetAttribution', 'Asset Attribution', 'Single security contribution to returns.', 1, 'bar-chart'),
    ('sector-attribution', 'SectorAttribution', 'Sector Attribution', 'Allocation and selection effects by sector.', 2, 'pie-chart'),
    ('factor-attribution', 'FactorAttribution', 'Factor Attribution', 'Factor exposure and factor return contribution.', 3, 'layers'),
    ('strategy-attribution', 'StrategyAttribution', 'Strategy Attribution', 'Strategy-level P&L decomposition.', 4, 'target'),
    ('temporal-attribution', 'TemporalAttribution', 'Temporal Attribution', 'Time-based and period-over-period attribution.', 5, 'calendar')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'attribution';

-- ============================================
-- COMPLIANCE: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('regulatory-rules', 'RegulatoryRules', 'Regulatory Rules', 'SEC, FINRA, and regulatory rule definitions.', 1, 'book'),
    ('trade-surveillance', 'TradeSurveillance', 'Trade Surveillance', 'Best execution and trade monitoring.', 2, 'eye'),
    ('reporting', 'Reporting', 'Reporting', 'Regulatory filings and compliance reports.', 3, 'file-text'),
    ('breach-tracking', 'BreachTracking', 'Breach Tracking', 'Limit breaches, violations, and remediation.', 4, 'alert-triangle'),
    ('compliance-history', 'ComplianceHistory', 'Compliance History', 'Historical compliance events and audit trail.', 5, 'clock')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'compliance';

-- ============================================
-- CONTROLS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('risk-controls', 'RiskControls', 'Risk Controls', 'Pre-trade and post-trade risk checks.', 1, 'shield'),
    ('execution-controls', 'ExecutionControls', 'Execution Controls', 'Order size limits and trading restrictions.', 2, 'sliders'),
    ('access-controls', 'AccessControls', 'Access Controls', 'User permissions and entitlements.', 3, 'lock'),
    ('limit-controls', 'LimitControls', 'Limit Controls', 'Position and exposure limit enforcement.', 4, 'alert-octagon'),
    ('override-logs', 'OverrideLogs', 'Override Logs', 'Control override history and approvals.', 5, 'unlock')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'controls';

-- ============================================
-- ALERTS: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('risk-alerts', 'RiskAlerts', 'Risk Alerts', 'Risk threshold breaches and warnings.', 1, 'alert-triangle'),
    ('trade-alerts', 'TradeAlerts', 'Trade Alerts', 'Trade execution and order status alerts.', 2, 'bell'),
    ('compliance-alerts', 'ComplianceAlerts', 'Compliance Alerts', 'Regulatory and compliance notifications.', 3, 'shield'),
    ('system-alerts', 'SystemAlerts', 'System Alerts', 'Infrastructure and system health alerts.', 4, 'server'),
    ('custom-alerts', 'CustomAlerts', 'Custom Alerts', 'User-defined and custom alert rules.', 5, 'edit-3')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'alerts';

-- ============================================
-- AUDIT: 5 roots
-- ============================================
INSERT INTO flywheel_collection_categories (collection_id, slug, name, display_name, description, level, display_order, icon, icon_color, is_active, is_expandable)
SELECT fc.id, root.slug, root.name, root.display_name, root.description, 1, root.display_order, root.icon, '#81c784', TRUE, TRUE
FROM flywheel_collections fc
CROSS JOIN (VALUES
    ('audit-events', 'AuditEvents', 'Audit Events', 'System-wide audit event log.', 1, 'file-text'),
    ('change-history', 'ChangeHistory', 'Change History', 'Configuration and data change tracking.', 2, 'edit'),
    ('access-logs', 'AccessLogs', 'Access Logs', 'User login and access event logs.', 3, 'log-in'),
    ('decision-logs', 'DecisionLogs', 'Decision Logs', 'Trading and investment decision audit trail.', 4, 'check-circle'),
    ('system-audits', 'SystemAudits', 'System Audits', 'System integrity and security audits.', 5, 'shield')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'audit';

-- ============================================
-- VALIDATION
-- ============================================

DO $$
DECLARE
    intel_total INT := 0;
    exec_total INT := 0;
    grand_total INT := 0;
    coll_name TEXT;
    coll_count INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Migration 098 - Flywheel Collection Roots Batch 3';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'INTELLIGENCE SECTION:';

    FOR coll_name, coll_count IN
        SELECT fc.display_name, COUNT(fcc.id)
        FROM flywheel_collections fc
        LEFT JOIN flywheel_collection_categories fcc ON fcc.collection_id = fc.id
        WHERE fc.slug IN ('signals', 'strategies', 'models', 'forecasts', 'correlations',
                          'risk-profiles', 'scenario-analysis', 'optimization', 'alpha-research', 'constraints')
        GROUP BY fc.display_name, fc.display_order
        ORDER BY fc.display_order
    LOOP
        RAISE NOTICE '  %: % roots', rpad(coll_name, 20), coll_count;
        intel_total := intel_total + coll_count;
    END LOOP;

    RAISE NOTICE '  ────────────────────────────────';
    RAISE NOTICE '  Intelligence Total: % roots', intel_total;
    RAISE NOTICE '';
    RAISE NOTICE 'EXECUTION SECTION:';

    FOR coll_name, coll_count IN
        SELECT fc.display_name, COUNT(fcc.id)
        FROM flywheel_collections fc
        LEFT JOIN flywheel_collection_categories fcc ON fcc.collection_id = fc.id
        WHERE fc.slug IN ('portfolios', 'trades', 'orders', 'execution-logs', 'performance',
                          'attribution', 'compliance', 'controls', 'alerts', 'audit')
        GROUP BY fc.display_name, fc.display_order
        ORDER BY fc.display_order
    LOOP
        RAISE NOTICE '  %: % roots', rpad(coll_name, 20), coll_count;
        exec_total := exec_total + coll_count;
    END LOOP;

    RAISE NOTICE '  ────────────────────────────────';
    RAISE NOTICE '  Execution Total: % roots', exec_total;
    RAISE NOTICE '';

    grand_total := intel_total + exec_total;
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE 'BATCH 3 TOTAL: % roots (expected 106)', grand_total;

    IF grand_total = 106 THEN
        RAISE NOTICE '✓ All roots created successfully';
    ELSE
        RAISE WARNING '✗ Expected 106 roots, found %', grand_total;
    END IF;

    -- Get grand total across all collections
    SELECT COUNT(*) INTO grand_total FROM flywheel_collection_categories WHERE collection_id IS NOT NULL;
    RAISE NOTICE '';
    RAISE NOTICE 'CUMULATIVE TOTAL (all batches): % roots', grand_total;
END $$;
