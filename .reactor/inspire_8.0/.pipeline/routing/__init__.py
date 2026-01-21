# =============================================================================
# INSPIRE 8.0 MODEL ROUTING LAYER
# =============================================================================
"""
Model Routing Layer for Inspire 8.0.

This module implements a deterministic model routing mechanism that minimizes
token cost while preserving accuracy and authority by dynamically selecting
the lowest sufficient model for each interaction.

COST-FIRST ROUTING STRATEGY:
The routing layer implements a cost-first approach that prioritizes inexpensive,
deterministic classification before invoking any language model:

1. ZERO-TOKEN CLASSIFICATION (always first):
   - Keyword detection
   - Pattern matching (regex)
   - Message length thresholds
   - Persona role requirements
   - Contextual flags

2. MINIMAL LLM CLASSIFIER (only if needed):
   - Invoked only when zero-token confidence is insufficient
   - Uses cheapest available model (gpt-4o-mini)
   - Minimal, constrained prompt
   - Fixed, machine-readable output (INTENT:X)

AUTOMATIC DOWNGRADE GOVERNANCE:
The routing layer enforces mandatory usage limits to prevent uncontrolled
escalation and ensure predictable token usage:

- Premium (gpt-4o): Max 2 successful executions per session
  → Automatically downgrades to STANDARD after limit reached
- Standard (gpt-4o-turbo): Max 3 successful executions per session
  → Automatically downgrades to ECONOMY after limit reached
- Economy (gpt-4o-mini): Unlimited (baseline tier)

Counters decrement ONLY on successful execution with valid response.
Failed, timed-out, or aborted executions do NOT affect counters.

ROUTING TIERS:
1. gpt-4o-mini (ECONOMY):
   - Routine interactions
   - Factual lookups
   - Clarifications
   - Low-risk queries

2. gpt-4o-turbo (STANDARD):
   - Teaching-oriented requests
   - Pastoral guidance
   - Explanatory content
   - Moderately complex requests

3. gpt-4o (PREMIUM):
   - Deep doctrinal questions
   - High-stakes leadership guidance
   - Strategic decisions
   - Theologically sensitive matters

CRITICAL INVARIANTS:
1. Zero-token classification is ALWAYS attempted first
2. LLM is only invoked if rule-based confidence is insufficient
3. Routing is DETERMINISTIC (rules-based, not intuition)
4. Router is a MANDATORY pre-execution step
5. Higher models require explicit justification from classification
6. DOWNGRADE governance is MANDATORY and cannot be bypassed
7. Counters decrement ONLY on successful execution
8. All routing decisions are logged for audit
"""

from .router import (
    ModelRouter,
    RoutingDecision,
    RoutingConfig,
    get_model_router,
    set_model_router,
    reset_model_router,
    route_message,
    get_model_for_message,
)
from .classifier import (
    MessageClassifier,
    ClassificationResult,
    IntentCategory,
    ComplexityLevel,
    RiskLevel,
)
from .cheap_first import (
    # Cost-first classifier (primary)
    CostFirstClassifier,
    CheapClassificationResult,
    ClassificationSource,
    # Zero-token classifier
    ZeroTokenClassifier,
    ZeroTokenConfig,
    # Minimal LLM classifier
    MinimalLLMClassifier,
    MinimalClassifierConfig,
    MINIMAL_CLASSIFIER_PROMPT,
    CLASSIFIER_MAX_TOKENS,
    # Global instance
    get_cost_first_classifier,
    set_cost_first_classifier,
    reset_cost_first_classifier,
)
from .downgrade import (
    # Downgrade governor
    DowngradeGovernor,
    DowngradeConfig,
    DowngradeDecision,
    DowngradeReason,
    TierUsageCounter,
    # Global instance
    get_downgrade_governor,
    set_downgrade_governor,
    reset_downgrade_governor,
    # Convenience functions
    apply_downgrade,
    record_execution_success,
    get_tier_remaining,
    is_tier_available,
)
from .models import (
    ModelTier,
    ModelConfig,
    MODEL_CONFIGS,
    get_model_for_tier,
    get_model_id_for_tier,
    get_default_model,
    is_tier_sufficient,
)
from .rules import (
    RoutingRule,
    RoutingRuleEngine,
    get_default_rules,
)
from .executor import (
    RoutedExecutor,
    ExecutionResult,
    ExecutionHooks,
    RoutingGuard,
    get_routed_executor,
    set_routed_executor,
    reset_routed_executor,
    execute_with_routing,
)

__all__ = [
    # Router
    'ModelRouter',
    'RoutingDecision',
    'RoutingConfig',
    'get_model_router',
    'set_model_router',
    'reset_model_router',
    'route_message',
    'get_model_for_message',
    # Legacy Classifier
    'MessageClassifier',
    'ClassificationResult',
    'IntentCategory',
    'ComplexityLevel',
    'RiskLevel',
    # Cost-First Classifier (PRIMARY)
    'CostFirstClassifier',
    'CheapClassificationResult',
    'ClassificationSource',
    'ZeroTokenClassifier',
    'ZeroTokenConfig',
    'MinimalLLMClassifier',
    'MinimalClassifierConfig',
    'MINIMAL_CLASSIFIER_PROMPT',
    'CLASSIFIER_MAX_TOKENS',
    'get_cost_first_classifier',
    'set_cost_first_classifier',
    'reset_cost_first_classifier',
    # DOWNGRADE GOVERNANCE (MANDATORY)
    'DowngradeGovernor',
    'DowngradeConfig',
    'DowngradeDecision',
    'DowngradeReason',
    'TierUsageCounter',
    'get_downgrade_governor',
    'set_downgrade_governor',
    'reset_downgrade_governor',
    'apply_downgrade',
    'record_execution_success',
    'get_tier_remaining',
    'is_tier_available',
    # Models
    'ModelTier',
    'ModelConfig',
    'MODEL_CONFIGS',
    'get_model_for_tier',
    'get_model_id_for_tier',
    'get_default_model',
    'is_tier_sufficient',
    # Rules
    'RoutingRule',
    'RoutingRuleEngine',
    'get_default_rules',
    # Executor
    'RoutedExecutor',
    'ExecutionResult',
    'ExecutionHooks',
    'RoutingGuard',
    'get_routed_executor',
    'set_routed_executor',
    'reset_routed_executor',
    'execute_with_routing',
]

__version__ = '1.2.0'  # Updated for downgrade governance
