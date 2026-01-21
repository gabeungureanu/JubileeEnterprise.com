# =============================================================================
# INSPIRE 8.0 MODEL ROUTING LAYER
# =============================================================================
"""
Model Routing Layer for Inspire 8.0.

This module implements a deterministic model routing mechanism that minimizes
token cost while preserving accuracy and authority by dynamically selecting
the lowest sufficient model for each interaction.

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
1. Routing is DETERMINISTIC (rules-based, not intuition)
2. Router is a MANDATORY pre-execution step
3. Classification evaluates intent, complexity, and risk
4. Higher models used ONLY when justified
5. All routing decisions are logged for audit
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
    # Classifier
    'MessageClassifier',
    'ClassificationResult',
    'IntentCategory',
    'ComplexityLevel',
    'RiskLevel',
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

__version__ = '1.0.0'
