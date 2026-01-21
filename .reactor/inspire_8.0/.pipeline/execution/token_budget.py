# =============================================================================
# TOKEN BUDGET MANAGEMENT
# =============================================================================
"""
Token budget management for the Inspire 8.0 execution pipeline.

This module implements production-hardening controls with explicit token
budgets per model to ensure cost-efficiency and predictable operation.

MODEL TIERS AND BUDGETS:

1. GPT-4O-MINI (Tier 1 - Economy):
   - Small default token limits
   - Suitable for: routine queries, summaries, low-risk tasks
   - Default max tokens: 500
   - Hard limit: 1,000
   - Cost multiplier: 1x (baseline)

2. GPT-4O-TURBO (Tier 2 - Standard):
   - Moderate token limits
   - Suitable for: teaching, pastoral guidance, multi-step reasoning
   - Default max tokens: 1,500
   - Hard limit: 4,000
   - Cost multiplier: ~10x

3. GPT-4O (Tier 3 - Premium):
   - Tightly constrained budgets
   - Suitable for: high-stakes doctrinal, leadership, strategic scenarios
   - Default max tokens: 2,000
   - Hard limit: 4,000
   - Cost multiplier: ~30x
   - REQUIRES explicit justification

ENFORCEMENT RULES:

1. HARD LIMITS:
   - Cannot be exceeded under any circumstances
   - Requests exceeding limits are rejected or capped

2. SOFT LIMITS (Defaults):
   - Can be increased with justification
   - Still capped by hard limits

3. BUDGET VALIDATION:
   - All requests validated before execution
   - Token counts estimated before API calls
   - Actual usage logged after completion

4. COST TRACKING:
   - All token usage logged for analysis
   - Per-persona, per-session, per-model tracking
   - Alerts when budgets approach limits

CRITICAL INVARIANTS:
1. Hard limits are NEVER exceeded
2. All budget decisions are LOGGED
3. Tier 3 (GPT-4O) requires JUSTIFICATION
4. Budgets apply UNIFORMLY across all personas
"""

import json
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class ModelTier(Enum):
    """Model tiers for token budgeting."""
    ECONOMY = "economy"      # gpt-4o-mini
    STANDARD = "standard"    # gpt-4o-turbo
    PREMIUM = "premium"      # gpt-4o


class BudgetAction(Enum):
    """Actions taken by budget enforcement."""
    APPROVED = "approved"          # Request within budget
    CAPPED = "capped"              # Request capped to limit
    REJECTED = "rejected"          # Request exceeds hard limit
    DOWNGRADED = "downgraded"      # Model downgraded to cheaper tier
    REQUIRES_JUSTIFICATION = "requires_justification"  # Premium needs justification


class UsageCategory(Enum):
    """Categories for token usage tracking."""
    ROUTINE = "routine"            # Simple queries, summaries
    TEACHING = "teaching"          # Educational content
    PASTORAL = "pastoral"          # Pastoral guidance
    COUNSELING = "counseling"      # Counseling sessions
    DOCTRINAL = "doctrinal"        # Doctrinal discussions
    STRATEGIC = "strategic"        # Strategic/leadership content
    SCHOLARLY = "scholarly"        # Academic/scholarly content


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class ModelBudget:
    """
    Token budget configuration for a specific model.

    Defines soft and hard limits for token usage.
    """
    model_id: str = ""
    model_name: str = ""
    tier: ModelTier = ModelTier.ECONOMY

    # Token limits
    default_max_tokens: int = 500       # Soft limit (default)
    hard_limit_tokens: int = 1000       # Hard limit (cannot exceed)
    min_tokens: int = 50                # Minimum useful response

    # Input token limits
    max_input_tokens: int = 2000        # Max prompt size
    context_window: int = 8000          # Total context window

    # Cost factors (relative to baseline)
    input_cost_per_1k: float = 0.0001   # $ per 1K input tokens
    output_cost_per_1k: float = 0.0002  # $ per 1K output tokens
    cost_multiplier: float = 1.0        # Relative cost factor

    # Restrictions
    requires_justification: bool = False
    allowed_categories: List[str] = field(default_factory=list)
    restricted_to_personas: List[str] = field(default_factory=list)

    # Usage tracking
    daily_budget_tokens: int = 100000   # Daily token budget
    session_budget_tokens: int = 10000  # Per-session budget

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'model_id': self.model_id,
            'model_name': self.model_name,
            'tier': self.tier.value,
            'limits': {
                'default_max_tokens': self.default_max_tokens,
                'hard_limit_tokens': self.hard_limit_tokens,
                'min_tokens': self.min_tokens,
                'max_input_tokens': self.max_input_tokens,
                'context_window': self.context_window,
            },
            'cost': {
                'input_cost_per_1k': self.input_cost_per_1k,
                'output_cost_per_1k': self.output_cost_per_1k,
                'cost_multiplier': self.cost_multiplier,
            },
            'restrictions': {
                'requires_justification': self.requires_justification,
                'allowed_categories': self.allowed_categories,
                'restricted_to_personas': self.restricted_to_personas,
            },
            'budgets': {
                'daily_budget_tokens': self.daily_budget_tokens,
                'session_budget_tokens': self.session_budget_tokens,
            },
        }


@dataclass
class TokenRequest:
    """
    A request for token allocation.

    Represents a request to use tokens for a specific model.
    """
    request_id: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    # Request details
    model_id: str = ""
    requested_tokens: int = 0
    estimated_input_tokens: int = 0

    # Context
    persona_id: str = ""
    session_id: str = ""
    task_category: UsageCategory = UsageCategory.ROUTINE

    # Justification (for premium models)
    justification: str = ""
    routing_reason: str = ""

    # Status
    approved: bool = False
    approved_tokens: int = 0
    action_taken: BudgetAction = BudgetAction.REJECTED

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'request_id': self.request_id,
            'timestamp': self.timestamp,
            'model_id': self.model_id,
            'requested_tokens': self.requested_tokens,
            'estimated_input_tokens': self.estimated_input_tokens,
            'persona_id': self.persona_id,
            'session_id': self.session_id,
            'task_category': self.task_category.value,
            'justification': self.justification,
            'routing_reason': self.routing_reason,
            'approved': self.approved,
            'approved_tokens': self.approved_tokens,
            'action_taken': self.action_taken.value,
        }


@dataclass
class TokenUsage:
    """
    Record of actual token usage from an execution.

    Captures real token counts after API completion.
    """
    usage_id: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    # Request reference
    request_id: str = ""

    # Model
    model_id: str = ""
    tier: ModelTier = ModelTier.ECONOMY

    # Actual usage
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0

    # Cost
    estimated_cost: float = 0.0

    # Context
    persona_id: str = ""
    session_id: str = ""
    task_category: UsageCategory = UsageCategory.ROUTINE

    # Budget status
    within_budget: bool = True
    budget_remaining_session: int = 0
    budget_remaining_daily: int = 0

    def calculate_cost(self, budget: ModelBudget):
        """Calculate cost based on model budget."""
        input_cost = (self.input_tokens / 1000) * budget.input_cost_per_1k
        output_cost = (self.output_tokens / 1000) * budget.output_cost_per_1k
        self.estimated_cost = input_cost + output_cost

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'usage_id': self.usage_id,
            'timestamp': self.timestamp,
            'request_id': self.request_id,
            'model_id': self.model_id,
            'tier': self.tier.value,
            'tokens': {
                'input': self.input_tokens,
                'output': self.output_tokens,
                'total': self.total_tokens,
            },
            'estimated_cost': self.estimated_cost,
            'persona_id': self.persona_id,
            'session_id': self.session_id,
            'task_category': self.task_category.value,
            'budget_status': {
                'within_budget': self.within_budget,
                'remaining_session': self.budget_remaining_session,
                'remaining_daily': self.budget_remaining_daily,
            },
        }


@dataclass
class BudgetDecision:
    """
    Decision from the budget enforcement layer.

    Contains the result of a budget validation check.
    """
    # Decision
    allowed: bool = False
    action: BudgetAction = BudgetAction.REJECTED

    # Request
    request_id: str = ""
    model_id: str = ""
    requested_tokens: int = 0
    approved_tokens: int = 0

    # Limits applied
    soft_limit: int = 0
    hard_limit: int = 0

    # Reasons
    reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Alternative
    suggested_model: str = ""
    suggested_tokens: int = 0

    # Cost estimate
    estimated_cost: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'allowed': self.allowed,
            'action': self.action.value,
            'request_id': self.request_id,
            'model_id': self.model_id,
            'tokens': {
                'requested': self.requested_tokens,
                'approved': self.approved_tokens,
                'soft_limit': self.soft_limit,
                'hard_limit': self.hard_limit,
            },
            'reasons': self.reasons,
            'warnings': self.warnings,
            'alternative': {
                'suggested_model': self.suggested_model,
                'suggested_tokens': self.suggested_tokens,
            },
            'estimated_cost': self.estimated_cost,
        }


@dataclass
class BudgetStatus:
    """
    Current budget status for tracking.

    Shows remaining budgets and usage statistics.
    """
    # Period
    period_start: str = ""
    period_type: str = "daily"  # daily, session

    # Model breakdown
    model_usage: Dict[str, int] = field(default_factory=dict)  # model_id -> tokens used
    model_cost: Dict[str, float] = field(default_factory=dict)  # model_id -> cost

    # Totals
    total_tokens_used: int = 0
    total_cost: float = 0.0

    # Budgets
    total_budget: int = 0
    budget_remaining: int = 0
    budget_used_percent: float = 0.0

    # Alerts
    approaching_limit: bool = False
    over_budget: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'period_start': self.period_start,
            'period_type': self.period_type,
            'by_model': {
                'usage': self.model_usage,
                'cost': self.model_cost,
            },
            'totals': {
                'tokens_used': self.total_tokens_used,
                'cost': self.total_cost,
            },
            'budget': {
                'total': self.total_budget,
                'remaining': self.budget_remaining,
                'used_percent': self.budget_used_percent,
            },
            'alerts': {
                'approaching_limit': self.approaching_limit,
                'over_budget': self.over_budget,
            },
        }


# =============================================================================
# TOKEN BUDGET CONFIG
# =============================================================================

@dataclass
class TokenBudgetConfig:
    """Configuration for token budget management."""

    # Model budgets
    model_budgets: Dict[str, ModelBudget] = field(default_factory=dict)

    # Global limits
    global_daily_budget: int = 500000  # 500K tokens/day
    global_session_budget: int = 50000  # 50K tokens/session
    alert_threshold_percent: float = 80.0  # Alert at 80% usage

    # Enforcement
    enforce_hard_limits: bool = True
    auto_cap_to_limit: bool = True
    auto_downgrade_model: bool = True
    require_premium_justification: bool = True

    # Logging
    log_all_decisions: bool = True
    log_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/budget'
    ))

    def __post_init__(self):
        """Initialize default model budgets if not provided."""
        if not self.model_budgets:
            self._init_default_budgets()

    def _init_default_budgets(self):
        """Initialize default model budgets."""
        # GPT-4O-MINI (Economy tier)
        self.model_budgets['gpt-4o-mini'] = ModelBudget(
            model_id='gpt-4o-mini',
            model_name='GPT-4o Mini',
            tier=ModelTier.ECONOMY,
            default_max_tokens=500,
            hard_limit_tokens=1000,
            min_tokens=50,
            max_input_tokens=4000,
            context_window=128000,
            input_cost_per_1k=0.00015,
            output_cost_per_1k=0.0006,
            cost_multiplier=1.0,
            requires_justification=False,
            allowed_categories=[c.value for c in UsageCategory],
            daily_budget_tokens=200000,
            session_budget_tokens=20000,
        )

        # GPT-4O-TURBO (Standard tier)
        self.model_budgets['gpt-4o-turbo'] = ModelBudget(
            model_id='gpt-4o-turbo',
            model_name='GPT-4o Turbo',
            tier=ModelTier.STANDARD,
            default_max_tokens=1500,
            hard_limit_tokens=4000,
            min_tokens=100,
            max_input_tokens=8000,
            context_window=128000,
            input_cost_per_1k=0.005,
            output_cost_per_1k=0.015,
            cost_multiplier=10.0,
            requires_justification=False,
            allowed_categories=[c.value for c in UsageCategory],
            daily_budget_tokens=100000,
            session_budget_tokens=15000,
        )

        # GPT-4O (Premium tier)
        self.model_budgets['gpt-4o'] = ModelBudget(
            model_id='gpt-4o',
            model_name='GPT-4o',
            tier=ModelTier.PREMIUM,
            default_max_tokens=2000,
            hard_limit_tokens=4000,
            min_tokens=200,
            max_input_tokens=8000,
            context_window=128000,
            input_cost_per_1k=0.005,
            output_cost_per_1k=0.015,
            cost_multiplier=30.0,
            requires_justification=True,
            allowed_categories=[
                UsageCategory.DOCTRINAL.value,
                UsageCategory.STRATEGIC.value,
                UsageCategory.SCHOLARLY.value,
            ],
            daily_budget_tokens=50000,
            session_budget_tokens=8000,
        )

    def get_budget(self, model_id: str) -> Optional[ModelBudget]:
        """Get budget for a model."""
        return self.model_budgets.get(model_id)

    def get_tier_models(self, tier: ModelTier) -> List[str]:
        """Get all models of a specific tier."""
        return [
            model_id for model_id, budget in self.model_budgets.items()
            if budget.tier == tier
        ]


# =============================================================================
# USAGE TRACKER
# =============================================================================

class TokenUsageTracker:
    """
    Tracks token usage across sessions and time periods.

    Maintains running totals for budget enforcement.
    """

    def __init__(self, config: TokenBudgetConfig = None):
        self.config = config or TokenBudgetConfig()
        self._lock = threading.Lock()

        # Usage tracking
        self._daily_usage: Dict[str, int] = {}  # model_id -> tokens
        self._session_usage: Dict[str, Dict[str, int]] = {}  # session_id -> model_id -> tokens
        self._daily_cost: Dict[str, float] = {}  # model_id -> cost

        # Period tracking
        self._current_day: str = datetime.now().strftime('%Y-%m-%d')

        # Ensure log directory exists
        self.config.log_dir.mkdir(parents=True, exist_ok=True)

    def _check_day_rollover(self):
        """Check if we've rolled over to a new day."""
        today = datetime.now().strftime('%Y-%m-%d')
        if today != self._current_day:
            # Archive previous day
            self._archive_daily_usage()
            # Reset
            self._daily_usage = {}
            self._daily_cost = {}
            self._current_day = today

    def _archive_daily_usage(self):
        """Archive the previous day's usage."""
        if not self._daily_usage:
            return

        archive_file = self.config.log_dir / f"daily_usage_{self._current_day}.json"
        archive_data = {
            'date': self._current_day,
            'usage': self._daily_usage,
            'cost': self._daily_cost,
            'total_tokens': sum(self._daily_usage.values()),
            'total_cost': sum(self._daily_cost.values()),
        }
        archive_file.write_text(json.dumps(archive_data, indent=2), encoding='utf-8')

    def record_usage(self, usage: TokenUsage):
        """Record token usage."""
        with self._lock:
            self._check_day_rollover()

            model_id = usage.model_id
            session_id = usage.session_id

            # Update daily usage
            self._daily_usage[model_id] = self._daily_usage.get(model_id, 0) + usage.total_tokens
            self._daily_cost[model_id] = self._daily_cost.get(model_id, 0.0) + usage.estimated_cost

            # Update session usage
            if session_id not in self._session_usage:
                self._session_usage[session_id] = {}
            self._session_usage[session_id][model_id] = (
                self._session_usage[session_id].get(model_id, 0) + usage.total_tokens
            )

    def get_daily_usage(self, model_id: str = None) -> int:
        """Get daily usage for a model or all models."""
        with self._lock:
            self._check_day_rollover()
            if model_id:
                return self._daily_usage.get(model_id, 0)
            return sum(self._daily_usage.values())

    def get_session_usage(self, session_id: str, model_id: str = None) -> int:
        """Get session usage for a model or all models."""
        with self._lock:
            if session_id not in self._session_usage:
                return 0
            if model_id:
                return self._session_usage[session_id].get(model_id, 0)
            return sum(self._session_usage[session_id].values())

    def get_remaining_daily_budget(self, model_id: str) -> int:
        """Get remaining daily budget for a model."""
        budget = self.config.get_budget(model_id)
        if not budget:
            return 0
        used = self.get_daily_usage(model_id)
        return max(0, budget.daily_budget_tokens - used)

    def get_remaining_session_budget(self, session_id: str, model_id: str) -> int:
        """Get remaining session budget for a model."""
        budget = self.config.get_budget(model_id)
        if not budget:
            return 0
        used = self.get_session_usage(session_id, model_id)
        return max(0, budget.session_budget_tokens - used)

    def get_budget_status(self, session_id: str = None) -> BudgetStatus:
        """Get current budget status."""
        with self._lock:
            self._check_day_rollover()

            status = BudgetStatus(
                period_start=self._current_day,
                period_type="daily" if not session_id else "session",
                model_usage=dict(self._daily_usage),
                model_cost=dict(self._daily_cost),
                total_tokens_used=sum(self._daily_usage.values()),
                total_cost=sum(self._daily_cost.values()),
                total_budget=self.config.global_daily_budget,
            )

            status.budget_remaining = max(0, status.total_budget - status.total_tokens_used)
            status.budget_used_percent = (status.total_tokens_used / status.total_budget) * 100

            status.approaching_limit = status.budget_used_percent >= self.config.alert_threshold_percent
            status.over_budget = status.total_tokens_used >= status.total_budget

            return status

    def clear_session(self, session_id: str):
        """Clear session usage tracking."""
        with self._lock:
            if session_id in self._session_usage:
                del self._session_usage[session_id]


# =============================================================================
# TOKEN BUDGET ENFORCER
# =============================================================================

class TokenBudgetEnforcer:
    """
    Enforces token budgets across the execution pipeline.

    Validates requests against budgets and tracks usage.
    """

    def __init__(self, config: TokenBudgetConfig = None):
        self.config = config or TokenBudgetConfig()
        self.tracker = TokenUsageTracker(config)
        self._lock = threading.Lock()

        # Decision log
        self._decisions: List[BudgetDecision] = []
        self._max_decision_log = 1000

    def validate_request(
        self,
        model_id: str,
        requested_tokens: int,
        session_id: str,
        persona_id: str = "",
        task_category: UsageCategory = UsageCategory.ROUTINE,
        justification: str = "",
        estimated_input_tokens: int = 0
    ) -> BudgetDecision:
        """
        Validate a token request against budgets.

        Args:
            model_id: The model being requested
            requested_tokens: Number of tokens requested
            session_id: Session identifier
            persona_id: Persona making the request
            task_category: Category of the task
            justification: Justification for premium models
            estimated_input_tokens: Estimated input token count

        Returns:
            BudgetDecision with approval status and any modifications
        """
        import uuid

        decision = BudgetDecision(
            request_id=str(uuid.uuid4()),
            model_id=model_id,
            requested_tokens=requested_tokens,
        )

        # Get model budget
        budget = self.config.get_budget(model_id)
        if not budget:
            decision.reasons.append(f"Unknown model: {model_id}")
            return self._finalize_decision(decision)

        decision.soft_limit = budget.default_max_tokens
        decision.hard_limit = budget.hard_limit_tokens

        # Check premium justification requirement
        if budget.requires_justification and self.config.require_premium_justification:
            if not justification:
                decision.action = BudgetAction.REQUIRES_JUSTIFICATION
                decision.reasons.append(
                    f"Model {model_id} (Premium tier) requires justification"
                )
                # Suggest downgrade
                decision.suggested_model = 'gpt-4o-turbo'
                decision.suggested_tokens = min(
                    requested_tokens,
                    self.config.get_budget('gpt-4o-turbo').hard_limit_tokens
                )
                return self._finalize_decision(decision)

        # Check category restrictions
        if budget.allowed_categories:
            if task_category.value not in budget.allowed_categories:
                decision.reasons.append(
                    f"Category {task_category.value} not allowed for model {model_id}"
                )
                # Suggest downgrade
                decision.suggested_model = 'gpt-4o-turbo'
                decision.action = BudgetAction.DOWNGRADED
                return self._finalize_decision(decision)

        # Check hard limit
        if requested_tokens > budget.hard_limit_tokens:
            if self.config.enforce_hard_limits:
                if self.config.auto_cap_to_limit:
                    decision.action = BudgetAction.CAPPED
                    decision.approved_tokens = budget.hard_limit_tokens
                    decision.allowed = True
                    decision.warnings.append(
                        f"Request capped from {requested_tokens} to {budget.hard_limit_tokens}"
                    )
                else:
                    decision.action = BudgetAction.REJECTED
                    decision.reasons.append(
                        f"Requested {requested_tokens} exceeds hard limit {budget.hard_limit_tokens}"
                    )
                    return self._finalize_decision(decision)

        # Check daily budget
        remaining_daily = self.tracker.get_remaining_daily_budget(model_id)
        if requested_tokens > remaining_daily:
            if self.config.auto_downgrade_model and budget.tier != ModelTier.ECONOMY:
                # Try to downgrade
                alternative = self._find_alternative_model(
                    requested_tokens, budget.tier, task_category
                )
                if alternative:
                    decision.action = BudgetAction.DOWNGRADED
                    decision.suggested_model = alternative
                    decision.warnings.append(
                        f"Daily budget exhausted for {model_id}, downgraded to {alternative}"
                    )
            else:
                decision.action = BudgetAction.REJECTED
                decision.reasons.append(
                    f"Daily budget exhausted for {model_id} ({remaining_daily} remaining)"
                )
                return self._finalize_decision(decision)

        # Check session budget
        remaining_session = self.tracker.get_remaining_session_budget(session_id, model_id)
        if requested_tokens > remaining_session:
            if self.config.auto_cap_to_limit:
                capped = min(requested_tokens, remaining_session)
                if capped >= budget.min_tokens:
                    decision.action = BudgetAction.CAPPED
                    decision.approved_tokens = capped
                    decision.allowed = True
                    decision.warnings.append(
                        f"Request capped to session budget ({capped} tokens)"
                    )
                else:
                    decision.action = BudgetAction.REJECTED
                    decision.reasons.append(
                        f"Session budget too low for minimum response ({remaining_session} < {budget.min_tokens})"
                    )
                    return self._finalize_decision(decision)

        # Request approved
        if not decision.approved_tokens:
            decision.approved_tokens = min(requested_tokens, budget.hard_limit_tokens)

        decision.allowed = True
        if decision.action == BudgetAction.REJECTED:
            decision.action = BudgetAction.APPROVED

        # Calculate estimated cost
        decision.estimated_cost = self._estimate_cost(
            budget, estimated_input_tokens, decision.approved_tokens
        )

        return self._finalize_decision(decision)

    def _find_alternative_model(
        self,
        requested_tokens: int,
        current_tier: ModelTier,
        task_category: UsageCategory
    ) -> Optional[str]:
        """Find an alternative model at a lower tier."""
        tier_order = [ModelTier.PREMIUM, ModelTier.STANDARD, ModelTier.ECONOMY]
        current_index = tier_order.index(current_tier)

        for tier in tier_order[current_index + 1:]:
            models = self.config.get_tier_models(tier)
            for model_id in models:
                budget = self.config.get_budget(model_id)
                if not budget:
                    continue

                # Check if category is allowed
                if budget.allowed_categories:
                    if task_category.value not in budget.allowed_categories:
                        continue

                # Check if has budget
                remaining = self.tracker.get_remaining_daily_budget(model_id)
                if remaining >= budget.min_tokens:
                    return model_id

        return None

    def _estimate_cost(
        self,
        budget: ModelBudget,
        input_tokens: int,
        output_tokens: int
    ) -> float:
        """Estimate cost for a request."""
        input_cost = (input_tokens / 1000) * budget.input_cost_per_1k
        output_cost = (output_tokens / 1000) * budget.output_cost_per_1k
        return input_cost + output_cost

    def _finalize_decision(self, decision: BudgetDecision) -> BudgetDecision:
        """Finalize and log a decision."""
        if self.config.log_all_decisions:
            self._log_decision(decision)

        with self._lock:
            self._decisions.append(decision)
            if len(self._decisions) > self._max_decision_log:
                self._decisions = self._decisions[-self._max_decision_log:]

        return decision

    def _log_decision(self, decision: BudgetDecision):
        """Log a budget decision."""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'decision': decision.to_dict(),
        }

        log_file = self.config.log_dir / f"decisions_{datetime.now().strftime('%Y%m%d')}.jsonl"
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + '\n')

    def record_completion(
        self,
        request_id: str,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        session_id: str,
        persona_id: str = "",
        task_category: UsageCategory = UsageCategory.ROUTINE
    ) -> TokenUsage:
        """
        Record actual token usage after completion.

        Args:
            request_id: Original request ID
            model_id: Model used
            input_tokens: Actual input tokens
            output_tokens: Actual output tokens
            session_id: Session ID
            persona_id: Persona ID
            task_category: Task category

        Returns:
            TokenUsage record
        """
        import uuid

        budget = self.config.get_budget(model_id)

        usage = TokenUsage(
            usage_id=str(uuid.uuid4()),
            request_id=request_id,
            model_id=model_id,
            tier=budget.tier if budget else ModelTier.ECONOMY,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            persona_id=persona_id,
            session_id=session_id,
            task_category=task_category,
        )

        if budget:
            usage.calculate_cost(budget)

        # Record usage
        self.tracker.record_usage(usage)

        # Update remaining budgets
        usage.budget_remaining_session = self.tracker.get_remaining_session_budget(
            session_id, model_id
        )
        usage.budget_remaining_daily = self.tracker.get_remaining_daily_budget(model_id)
        usage.within_budget = usage.budget_remaining_daily > 0

        # Log usage
        self._log_usage(usage)

        return usage

    def _log_usage(self, usage: TokenUsage):
        """Log token usage."""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'usage': usage.to_dict(),
        }

        log_file = self.config.log_dir / f"usage_{datetime.now().strftime('%Y%m%d')}.jsonl"
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + '\n')

    def get_budget_status(self, session_id: str = None) -> BudgetStatus:
        """Get current budget status."""
        return self.tracker.get_budget_status(session_id)

    def get_model_budget(self, model_id: str) -> Optional[ModelBudget]:
        """Get budget configuration for a model."""
        return self.config.get_budget(model_id)


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_enforcer: Optional[TokenBudgetEnforcer] = None
_enforcer_lock = threading.Lock()


def get_budget_enforcer() -> TokenBudgetEnforcer:
    """Get the global token budget enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        if _global_enforcer is None:
            _global_enforcer = TokenBudgetEnforcer()
        return _global_enforcer


def set_budget_enforcer(enforcer: TokenBudgetEnforcer):
    """Set the global token budget enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        _global_enforcer = enforcer


def reset_budget_enforcer():
    """Reset to default token budget enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        _global_enforcer = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def validate_token_request(
    model_id: str,
    requested_tokens: int,
    session_id: str,
    persona_id: str = "",
    task_category: UsageCategory = UsageCategory.ROUTINE,
    justification: str = ""
) -> BudgetDecision:
    """
    Validate a token request against budgets.

    Example:
        decision = validate_token_request(
            model_id="gpt-4o-mini",
            requested_tokens=500,
            session_id="session_123",
            persona_id="inspire_teacher",
            task_category=UsageCategory.TEACHING,
        )

        if decision.allowed:
            # Proceed with approved_tokens
            pass
        else:
            # Handle rejection
            print(f"Rejected: {decision.reasons}")
    """
    enforcer = get_budget_enforcer()
    return enforcer.validate_request(
        model_id=model_id,
        requested_tokens=requested_tokens,
        session_id=session_id,
        persona_id=persona_id,
        task_category=task_category,
        justification=justification,
    )


def record_token_usage(
    request_id: str,
    model_id: str,
    input_tokens: int,
    output_tokens: int,
    session_id: str,
    persona_id: str = "",
    task_category: UsageCategory = UsageCategory.ROUTINE
) -> TokenUsage:
    """
    Record actual token usage after completion.

    Example:
        usage = record_token_usage(
            request_id=decision.request_id,
            model_id="gpt-4o-mini",
            input_tokens=200,
            output_tokens=450,
            session_id="session_123",
        )

        print(f"Cost: ${usage.estimated_cost:.4f}")
    """
    enforcer = get_budget_enforcer()
    return enforcer.record_completion(
        request_id=request_id,
        model_id=model_id,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        session_id=session_id,
        persona_id=persona_id,
        task_category=task_category,
    )


def get_current_budget_status(session_id: str = None) -> BudgetStatus:
    """Get current budget status."""
    enforcer = get_budget_enforcer()
    return enforcer.get_budget_status(session_id)
