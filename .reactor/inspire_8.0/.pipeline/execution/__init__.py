# =============================================================================
# INSPIRE 8.0 EXECUTION LAYER
# =============================================================================
"""
Execution layer for the Inspire 8.0 pipeline.

This module manages the execution of persona interactions with
production-hardening controls for reliability and cost-efficiency.

EXECUTION CONTROLS:

1. TOKEN BUDGET MANAGEMENT:
   - Explicit token limits per model tier
   - Hard limits that cannot be exceeded
   - Automatic capping and model downgrading
   - Usage tracking and cost analysis

2. (Future) RATE LIMITING:
   - Request rate limits per persona/session
   - Throttling under high load
   - Circuit breakers for failures

3. (Future) RETRY LOGIC:
   - Automatic retries with backoff
   - Fallback model selection
   - Graceful degradation

MODEL TIERS:

- Economy (gpt-4o-mini): 500 default / 1,000 hard limit
- Standard (gpt-4o-turbo): 1,500 default / 4,000 hard limit
- Premium (gpt-4o): 2,000 default / 4,000 hard limit (requires justification)

CRITICAL INVARIANTS:
1. Hard limits are NEVER exceeded
2. All token usage is LOGGED
3. Premium models require JUSTIFICATION
4. Budgets apply UNIFORMLY across personas
"""

from .token_budget import (
    # Enums
    ModelTier,
    BudgetAction,
    UsageCategory,
    # Data classes
    ModelBudget,
    TokenRequest,
    TokenUsage,
    BudgetDecision,
    BudgetStatus,
    # Config
    TokenBudgetConfig,
    # Classes
    TokenUsageTracker,
    TokenBudgetEnforcer,
    # Global functions
    get_budget_enforcer,
    set_budget_enforcer,
    reset_budget_enforcer,
    validate_token_request,
    record_token_usage,
    get_current_budget_status,
)

__all__ = [
    # Token budget enums
    'ModelTier',
    'BudgetAction',
    'UsageCategory',
    # Token budget data classes
    'ModelBudget',
    'TokenRequest',
    'TokenUsage',
    'BudgetDecision',
    'BudgetStatus',
    # Token budget config
    'TokenBudgetConfig',
    # Token budget classes
    'TokenUsageTracker',
    'TokenBudgetEnforcer',
    # Token budget functions
    'get_budget_enforcer',
    'set_budget_enforcer',
    'reset_budget_enforcer',
    'validate_token_request',
    'record_token_usage',
    'get_current_budget_status',
]

__version__ = '1.0.0'
