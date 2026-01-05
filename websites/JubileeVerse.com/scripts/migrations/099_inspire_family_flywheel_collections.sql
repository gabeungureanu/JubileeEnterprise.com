-- ============================================
-- JubileeVerse Database Schema
-- Migration 099: Inspire Family Flywheel Collections
--
-- Creates 12 new Flywheel collections for the Inspire Family agents
-- in Section 2 (Intelligence), with root category structures.
--
-- Each agent has a specialized domain:
--   - ElianaInspire: Orchestration & Workflow Management
--   - AvaSterling: Capital Allocation & Portfolio Health
--   - GraceHalley: Compliance & Ethics
--   - NaomiVega: System Health & Monitoring
--   - TalithaRayne: Model Development & Training
--   - JudahFlint: Backtesting & Strategy Diagnostics
--   - OrianWells: API & System Integration
--   - SelahMoreno: Feature Engineering & Data Transformation
--   - KnoxEveren: Signal Logic & Algorithm Design
--   - TheoBeck: Order Execution & Routing
--   - ZionBlack: Performance & Reporting
--   - MilesGreystone: Real-Time Data Ingestion
--
-- Total: 12 collections, 72 roots (6 per collection)
-- ============================================

-- ============================================
-- PART 1: CREATE INSPIRE FAMILY FLYWHEEL COLLECTIONS
-- ============================================

-- Clear any existing Inspire Family collections (if re-running)
DELETE FROM flywheel_collection_categories
WHERE collection_id IN (
    SELECT id FROM flywheel_collections
    WHERE slug IN (
        'eliana-inspire', 'ava-sterling', 'grace-halley', 'naomi-vega',
        'talitha-rayne', 'judah-flint', 'orian-wells', 'selah-moreno',
        'knox-everen', 'theo-beck', 'zion-black', 'miles-greystone'
    )
);

DELETE FROM flywheel_collections
WHERE slug IN (
    'eliana-inspire', 'ava-sterling', 'grace-halley', 'naomi-vega',
    'talitha-rayne', 'judah-flint', 'orian-wells', 'selah-moreno',
    'knox-everen', 'theo-beck', 'zion-black', 'miles-greystone'
);

-- Insert the 12 Inspire Family agent collections into Section 2 (Intelligence)
INSERT INTO flywheel_collections (
    slug, name, display_name, description, category_id,
    section, collection_type, qdrant_collection_prefix, display_order, is_active, is_system
) VALUES
-- 1. ElianaInspire - Orchestration & Workflow
(
    'eliana-inspire', 'ElianaInspire', 'Eliana Inspire',
    'Orchestration and workflow management. Coordinates agent activities, manages workflow assignments, handles conflict resolution, and ensures mission alignment across the Inspire Family.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_eliana', 11, TRUE, TRUE
),
-- 2. AvaSterling - Capital & Portfolio
(
    'ava-sterling', 'AvaSterling', 'Ava Sterling',
    'Capital allocation and portfolio health. Manages portfolio rebalancing, exposure limits, risk constraints, and portfolio health monitoring with protective guardrails.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_ava', 12, TRUE, TRUE
),
-- 3. GraceHalley - Compliance & Ethics
(
    'grace-halley', 'GraceHalley', 'Grace Halley',
    'Compliance rules and ethical boundaries. Oversees regulatory alignment, audit oversight, policy enforcement, and integrity reporting across operations.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_grace', 13, TRUE, TRUE
),
-- 4. NaomiVega - System Health
(
    'naomi-vega', 'NaomiVega', 'Naomi Vega',
    'System health and anomaly detection. Monitors alerts, manages kill switches, tracks heartbeats, and oversees failover status for system reliability.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_naomi', 14, TRUE, TRUE
),
-- 5. TalithaRayne - Model Development
(
    'talitha-rayne', 'TalithaRayne', 'Talitha Rayne',
    'Model development and training. Handles model training, retraining cycles, feature selection, experiment tracking, and model validation.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_talitha', 15, TRUE, TRUE
),
-- 6. JudahFlint - Backtesting & Diagnostics
(
    'judah-flint', 'JudahFlint', 'Judah Flint',
    'Backtest runs and strategy diagnostics. Manages historical simulations, performance comparisons, drawdown analysis, and lessons learned documentation.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_judah', 16, TRUE, TRUE
),
-- 7. OrianWells - API & Integration
(
    'orian-wells', 'OrianWells', 'Orian Wells',
    'API integrations and system bridges. Manages broker connections, data pipelines, SDK management, interface schemas, and cross-system communication.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_orian', 17, TRUE, TRUE
),
-- 8. SelahMoreno - Feature Engineering
(
    'selah-moreno', 'SelahMoreno', 'Selah Moreno',
    'Feature engineering and data transformation. Handles indicator construction, data normalization, pattern extraction, and transformation recipes.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_selah', 18, TRUE, TRUE
),
-- 9. KnoxEveren - Signal Logic
(
    'knox-everen', 'KnoxEveren', 'Knox Everen',
    'Signal logic and algorithm design. Manages rule sets, ML signal models, threshold configuration, and signal validation processes.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_knox', 19, TRUE, TRUE
),
-- 10. TheoBeck - Order Execution
(
    'theo-beck', 'TheoBeck', 'Theo Beck',
    'Order routing and execution tactics. Manages slippage control, broker execution, latency management, and fill optimization.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_theo', 20, TRUE, TRUE
),
-- 11. ZionBlack - Performance & Reporting
(
    'zion-black', 'ZionBlack', 'Zion Black',
    'Performance metrics and reporting. Manages ROI analysis, reporting dashboards, quality assurance, and optimization insights.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_zion', 21, TRUE, TRUE
),
-- 12. MilesGreystone - Data Ingestion
(
    'miles-greystone', 'MilesGreystone', 'Miles Greystone',
    'Real-time feeds and data ingestion. Manages historical ingestion, news streams, sentiment sources, exchange listeners, and data validation.',
    'a0000001-0000-0000-0000-000000000002'::UUID,
    'orchestration_and_mediation', 'analytics',
    'flywheel_intel_miles', 22, TRUE, TRUE
);

-- ============================================
-- PART 2: CREATE ROOT CATEGORIES FOR ELIANAINSPIRE
-- 6 roots for orchestration and workflow management
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
    ('orchestration', 'Orchestration', 'Orchestration',
     'Agent coordination workflows, task sequencing, and multi-agent collaboration patterns.',
     1, 'layers'),
    ('workflow-assignments', 'WorkflowAssignments', 'Workflow Assignments',
     'Task allocation, agent assignment rules, workload distribution, and priority scheduling.',
     2, 'list'),
    ('agent-coordination', 'AgentCoordination', 'Agent Coordination',
     'Inter-agent communication, handoff protocols, and synchronized execution management.',
     3, 'users'),
    ('conflict-resolution', 'ConflictResolution', 'Conflict Resolution',
     'Priority conflicts, resource contention handling, and decision arbitration rules.',
     4, 'git-merge'),
    ('mission-alignment', 'MissionAlignment', 'Mission Alignment',
     'Goal alignment verification, objective tracking, and mission success metrics.',
     5, 'target'),
    ('system-directives', 'SystemDirectives', 'System Directives',
     'Global system instructions, operational constraints, and override policies.',
     6, 'terminal')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'eliana-inspire';

-- ============================================
-- PART 3: CREATE ROOT CATEGORIES FOR AVASTERLING
-- 6 roots for capital allocation and portfolio health
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
    ('capital-allocation', 'CapitalAllocation', 'Capital Allocation',
     'Capital deployment strategies, cash management, and investment allocation frameworks.',
     1, 'dollar-sign'),
    ('portfolio-rebalancing', 'PortfolioRebalancing', 'Portfolio Rebalancing',
     'Rebalancing triggers, drift thresholds, and automatic rebalancing schedules.',
     2, 'refresh-cw'),
    ('exposure-limits', 'ExposureLimits', 'Exposure Limits',
     'Position limits, sector caps, concentration constraints, and exposure monitoring.',
     3, 'bar-chart'),
    ('risk-constraints', 'RiskConstraints', 'Risk Constraints',
     'VaR limits, drawdown constraints, volatility targets, and risk budget allocation.',
     4, 'shield'),
    ('portfolio-health', 'PortfolioHealth', 'Portfolio Health',
     'Portfolio diagnostics, health scores, liquidity assessment, and quality metrics.',
     5, 'activity'),
    ('guardrails', 'Guardrails', 'Guardrails',
     'Protective limits, circuit breakers, automatic position closures, and safety overrides.',
     6, 'alert-triangle')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'ava-sterling';

-- ============================================
-- PART 4: CREATE ROOT CATEGORIES FOR GRACEHALLEY
-- 6 roots for compliance and ethics
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
    ('compliance-rules', 'ComplianceRules', 'Compliance Rules',
     'Regulatory rule sets, compliance checks, and rule enforcement configurations.',
     1, 'check-square'),
    ('ethical-boundaries', 'EthicalBoundaries', 'Ethical Boundaries',
     'Ethical guidelines, restricted activities, and moral constraint definitions.',
     2, 'heart'),
    ('regulatory-alignment', 'RegulatoryAlignment', 'Regulatory Alignment',
     'SEC, FINRA, MiFID II alignment, jurisdiction rules, and regulatory mapping.',
     3, 'book'),
    ('audit-oversight', 'AuditOversight', 'Audit Oversight',
     'Audit trail management, oversight reporting, and independent review processes.',
     4, 'eye'),
    ('policy-enforcement', 'PolicyEnforcement', 'Policy Enforcement',
     'Policy violation detection, enforcement actions, and remediation tracking.',
     5, 'shield'),
    ('integrity-reports', 'IntegrityReports', 'Integrity Reports',
     'Integrity assessments, compliance dashboards, and ethical status reporting.',
     6, 'file-text')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'grace-halley';

-- ============================================
-- PART 5: CREATE ROOT CATEGORIES FOR NAOMIVEGA
-- 6 roots for system health and monitoring
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
    ('system-health', 'SystemHealth', 'System Health',
     'Overall system status, health scores, resource utilization, and performance baselines.',
     1, 'heart'),
    ('anomaly-detection', 'AnomalyDetection', 'Anomaly Detection',
     'Unusual pattern detection, outlier identification, and behavioral anomaly alerts.',
     2, 'alert-circle'),
    ('alerts', 'Alerts', 'Alerts',
     'System alerts, threshold notifications, escalation rules, and alert history.',
     3, 'bell'),
    ('kill-switches', 'KillSwitches', 'Kill Switches',
     'Emergency shutdown controls, trading halts, and system pause mechanisms.',
     4, 'power'),
    ('heartbeats', 'Heartbeats', 'Heartbeats',
     'Service heartbeat monitoring, liveness checks, and connection status tracking.',
     5, 'activity'),
    ('failover-status', 'FailoverStatus', 'Failover Status',
     'Failover readiness, backup system status, and disaster recovery monitoring.',
     6, 'repeat')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'naomi-vega';

-- ============================================
-- PART 6: CREATE ROOT CATEGORIES FOR TALITHARAYNE
-- 6 roots for model development and training
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
    ('model-development', 'ModelDevelopment', 'Model Development',
     'New model creation, architecture design, and development lifecycle management.',
     1, 'box'),
    ('model-training', 'ModelTraining', 'Model Training',
     'Training pipelines, hyperparameter tuning, and training progress monitoring.',
     2, 'cpu'),
    ('model-retraining', 'ModelRetraining', 'Model Retraining',
     'Scheduled retraining, drift detection triggers, and continuous learning processes.',
     3, 'refresh-cw'),
    ('feature-selection', 'FeatureSelection', 'Feature Selection',
     'Feature importance analysis, selection algorithms, and dimensionality reduction.',
     4, 'filter'),
    ('experiment-tracking', 'ExperimentTracking', 'Experiment Tracking',
     'Experiment logs, A/B test results, and model comparison metrics.',
     5, 'git-branch'),
    ('model-validation', 'ModelValidation', 'Model Validation',
     'Out-of-sample testing, cross-validation, and model performance verification.',
     6, 'check-circle')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'talitha-rayne';

-- ============================================
-- PART 7: CREATE ROOT CATEGORIES FOR JUDAHFLINT
-- 6 roots for backtesting and strategy diagnostics
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
    ('backtest-runs', 'BacktestRuns', 'Backtest Runs',
     'Historical backtest executions, test configurations, and run histories.',
     1, 'play'),
    ('historical-simulations', 'HistoricalSimulations', 'Historical Simulations',
     'Multi-scenario simulations, stress testing, and historical event replays.',
     2, 'clock'),
    ('performance-comparisons', 'PerformanceComparisons', 'Performance Comparisons',
     'Strategy vs benchmark comparisons, peer analysis, and relative performance metrics.',
     3, 'bar-chart-2'),
    ('drawdown-analysis', 'DrawdownAnalysis', 'Drawdown Analysis',
     'Maximum drawdown tracking, recovery periods, and drawdown risk metrics.',
     4, 'trending-down'),
    ('strategy-diagnostics', 'StrategyDiagnostics', 'Strategy Diagnostics',
     'Strategy health checks, parameter sensitivity, and diagnostic reports.',
     5, 'tool'),
    ('lessons-learned', 'LessonsLearned', 'Lessons Learned',
     'Post-mortem analyses, failure documentation, and improvement recommendations.',
     6, 'book-open')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'judah-flint';

-- ============================================
-- PART 8: CREATE ROOT CATEGORIES FOR ORIANWELLS
-- 6 roots for API and system integration
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
    ('api-integrations', 'APIIntegrations', 'API Integrations',
     'External API connections, authentication management, and integration health.',
     1, 'link'),
    ('broker-connections', 'BrokerConnections', 'Broker Connections',
     'Brokerage API links, order routing connections, and broker status monitoring.',
     2, 'briefcase'),
    ('data-pipelines', 'DataPipelines', 'Data Pipelines',
     'ETL processes, data flow management, and pipeline orchestration.',
     3, 'git-commit'),
    ('sdk-management', 'SDKManagement', 'SDK Management',
     'SDK versions, library dependencies, and package management.',
     4, 'package'),
    ('interface-schemas', 'InterfaceSchemas', 'Interface Schemas',
     'API schemas, data contracts, and interface definitions.',
     5, 'file-code'),
    ('system-bridges', 'SystemBridges', 'System Bridges',
     'Cross-system connectors, message queues, and inter-service communication.',
     6, 'share-2')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'orian-wells';

-- ============================================
-- PART 9: CREATE ROOT CATEGORIES FOR SELAHMORENO
-- 6 roots for feature engineering and transformation
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
    ('feature-engineering', 'FeatureEngineering', 'Feature Engineering',
     'Feature creation processes, derived variable definitions, and engineering pipelines.',
     1, 'tool'),
    ('indicator-construction', 'IndicatorConstruction', 'Indicator Construction',
     'Technical indicator formulas, custom indicator definitions, and calculation logic.',
     2, 'activity'),
    ('data-normalization', 'DataNormalization', 'Data Normalization',
     'Scaling methods, standardization rules, and normalization procedures.',
     3, 'sliders'),
    ('pattern-extraction', 'PatternExtraction', 'Pattern Extraction',
     'Pattern recognition algorithms, shape detection, and pattern libraries.',
     4, 'grid'),
    ('signal-inputs', 'SignalInputs', 'Signal Inputs',
     'Raw signal sources, input validation, and signal preprocessing.',
     5, 'radio'),
    ('transformation-recipes', 'TransformationRecipes', 'Transformation Recipes',
     'Reusable transformation templates, recipe libraries, and transformation chains.',
     6, 'code')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'selah-moreno';

-- ============================================
-- PART 10: CREATE ROOT CATEGORIES FOR KNOXEVEREN
-- 6 roots for signal logic and algorithm design
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
    ('signal-logic', 'SignalLogic', 'Signal Logic',
     'Signal generation rules, entry/exit conditions, and logical signal frameworks.',
     1, 'zap'),
    ('algorithm-design', 'AlgorithmDesign', 'Algorithm Design',
     'Trading algorithm architecture, pseudocode, and algorithm documentation.',
     2, 'code'),
    ('rule-sets', 'RuleSets', 'Rule Sets',
     'Conditional rule definitions, decision trees, and rule execution order.',
     3, 'list'),
    ('ml-signal-models', 'MLSignalModels', 'ML Signal Models',
     'Machine learning signal generators, ensemble models, and ML pipeline configs.',
     4, 'cpu'),
    ('thresholds', 'Thresholds', 'Thresholds',
     'Signal threshold configurations, trigger levels, and sensitivity parameters.',
     5, 'sliders'),
    ('signal-validation', 'SignalValidation', 'Signal Validation',
     'Signal quality checks, false positive filtering, and validation rules.',
     6, 'check-circle')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'knox-everen';

-- ============================================
-- PART 11: CREATE ROOT CATEGORIES FOR THEOBECK
-- 6 roots for order execution and routing
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
    ('order-routing', 'OrderRouting', 'Order Routing',
     'Smart order routing logic, venue selection, and routing optimization.',
     1, 'navigation'),
    ('execution-tactics', 'ExecutionTactics', 'Execution Tactics',
     'TWAP, VWAP, POV strategies, and tactical execution algorithms.',
     2, 'target'),
    ('slippage-control', 'SlippageControl', 'Slippage Control',
     'Slippage monitoring, impact estimation, and slippage minimization rules.',
     3, 'trending-down'),
    ('broker-execution', 'BrokerExecution', 'Broker Execution',
     'Broker-specific execution rules, FIX protocol configs, and broker performance.',
     4, 'briefcase'),
    ('latency-management', 'LatencyManagement', 'Latency Management',
     'Execution latency tracking, co-location configs, and speed optimization.',
     5, 'clock'),
    ('fill-optimization', 'FillOptimization', 'Fill Optimization',
     'Fill rate improvement, partial fill handling, and fill quality metrics.',
     6, 'check-square')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'theo-beck';

-- ============================================
-- PART 12: CREATE ROOT CATEGORIES FOR ZIONBLACK
-- 6 roots for performance and reporting
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
    ('performance-metrics', 'PerformanceMetrics', 'Performance Metrics',
     'Returns, Sharpe ratio, Sortino, alpha, beta, and comprehensive performance stats.',
     1, 'trending-up'),
    ('roi-analysis', 'ROIAnalysis', 'ROI Analysis',
     'Return on investment calculations, ROIC, and capital efficiency metrics.',
     2, 'dollar-sign'),
    ('reporting-dashboards', 'ReportingDashboards', 'Reporting Dashboards',
     'Dashboard configurations, visualization templates, and report layouts.',
     3, 'layout'),
    ('quality-assurance', 'QualityAssurance', 'Quality Assurance',
     'Data quality checks, accuracy verification, and QA processes.',
     4, 'check-circle'),
    ('optimization-insights', 'OptimizationInsights', 'Optimization Insights',
     'Performance improvement recommendations, optimization opportunities, and insights.',
     5, 'zap'),
    ('historical-reports', 'HistoricalReports', 'Historical Reports',
     'Archived reports, report history, and historical performance documentation.',
     6, 'archive')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'zion-black';

-- ============================================
-- PART 13: CREATE ROOT CATEGORIES FOR MILESGREYSTONE
-- 6 roots for real-time data ingestion
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
    ('real-time-feeds', 'RealTimeFeeds', 'Real-Time Feeds',
     'Live market data streams, real-time quotes, and streaming data connections.',
     1, 'radio'),
    ('historical-ingestion', 'HistoricalIngestion', 'Historical Ingestion',
     'Batch data loading, historical data imports, and archive ingestion processes.',
     2, 'database'),
    ('news-streams', 'NewsStreams', 'News Streams',
     'Real-time news feeds, headline streams, and news aggregation sources.',
     3, 'rss'),
    ('sentiment-sources', 'SentimentSources', 'Sentiment Sources',
     'Social media feeds, sentiment data providers, and alternative sentiment streams.',
     4, 'message-square'),
    ('exchange-listeners', 'ExchangeListeners', 'Exchange Listeners',
     'Exchange websocket connections, order book listeners, and trade tape feeds.',
     5, 'wifi'),
    ('data-validation', 'DataValidation', 'Data Validation',
     'Incoming data validation, quality gates, and data integrity checks.',
     6, 'check-square')
) AS root(slug, name, display_name, description, display_order, icon)
WHERE fc.slug = 'miles-greystone';

-- ============================================
-- PART 14: VALIDATION
-- ============================================

DO $$
DECLARE
    collection_count INT;
    root_count INT;
    expected_collections INT := 12;
    expected_roots INT := 72;
BEGIN
    -- Count collections
    SELECT COUNT(*) INTO collection_count
    FROM flywheel_collections
    WHERE slug IN (
        'eliana-inspire', 'ava-sterling', 'grace-halley', 'naomi-vega',
        'talitha-rayne', 'judah-flint', 'orian-wells', 'selah-moreno',
        'knox-everen', 'theo-beck', 'zion-black', 'miles-greystone'
    );

    -- Count roots
    SELECT COUNT(*) INTO root_count
    FROM flywheel_collection_categories fcc
    JOIN flywheel_collections fc ON fcc.collection_id = fc.id
    WHERE fc.slug IN (
        'eliana-inspire', 'ava-sterling', 'grace-halley', 'naomi-vega',
        'talitha-rayne', 'judah-flint', 'orian-wells', 'selah-moreno',
        'knox-everen', 'theo-beck', 'zion-black', 'miles-greystone'
    );

    RAISE NOTICE '';
    RAISE NOTICE 'Migration 099 - Inspire Family Flywheel Collections';
    RAISE NOTICE '════════════════════════════════════════════════════';
    RAISE NOTICE '  Collections created: % (expected %)', collection_count, expected_collections;
    RAISE NOTICE '  Root categories created: % (expected %)', root_count, expected_roots;
    RAISE NOTICE '════════════════════════════════════════════════════';

    IF collection_count = expected_collections AND root_count = expected_roots THEN
        RAISE NOTICE '  All Inspire Family collections and roots created successfully';
    ELSE
        RAISE WARNING '  Mismatch in expected counts!';
    END IF;
END $$;
