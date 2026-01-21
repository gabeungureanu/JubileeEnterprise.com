# =============================================================================
# AUTOMATIC MODEL DOWNGRADE GOVERNANCE
# =============================================================================
"""
Implements automatic model downgrade limits as a mandatory cost-governance
mechanism to prevent uncontrolled escalation and ensure predictable token usage.

DOWNGRADE POLICY:
- Premium (gpt-4o): Maximum 2 successful executions per session
  → Automatically downgrades to STANDARD (gpt-4o-turbo) after limit reached
- Standard (gpt-4o-turbo): Maximum 3 successful executions per session
  → Automatically downgrades to ECONOMY (gpt-4o-mini) after limit reached
- Economy (gpt-4o-mini): No limit (baseline tier)

COUNTER BEHAVIOR:
- Counters decrement ONLY on successful execution with valid response
- Failed, timed-out, or aborted executions do NOT decrement counters
- Counters are persisted in runtime state for deterministic auditing
- Downgrade rules are enforced BEFORE each execution decision

CRITICAL INVARIANTS:
1. Downgrade enforcement is MANDATORY (cannot be bypassed)
2. Counters are session/context-scoped for isolation
3. Higher tiers are reserved for limited, high-value moments
4. All downgrade decisions are logged for audit
5. Uniform application across all personas and sessions
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from .models import ModelTier, get_model_for_tier

logger = logging.getLogger(__name__)


# =============================================================================
# DOWNGRADE CONFIGURATION
# =============================================================================

@dataclass
class DowngradeConfig:
    """
    Configuration for automatic model downgrade limits.

    Attributes:
        premium_limit: Max successful executions for premium tier (default: 2)
        standard_limit: Max successful executions for standard tier (default: 3)
        economy_limit: Max for economy tier (None = unlimited, baseline tier)
        enable_downgrade: Whether downgrade is enabled (ALWAYS True - documented only)
        log_downgrades: Whether to log downgrade decisions
        strict_enforcement: If True, NEVER allow bypass of downgrade rules
    """
    # Tier-specific limits
    premium_limit: int = 2  # gpt-4o: max 2 successful calls
    standard_limit: int = 3  # gpt-4o-turbo: max 3 successful calls
    economy_limit: Optional[int] = None  # gpt-4o-mini: unlimited (baseline)

    # Enforcement settings
    enable_downgrade: bool = True  # MANDATORY - cannot be disabled
    log_downgrades: bool = True
    strict_enforcement: bool = True  # NEVER allow bypass

    def get_limit_for_tier(self, tier: ModelTier) -> Optional[int]:
        """Get the usage limit for a specific tier."""
        if tier == ModelTier.PREMIUM:
            return self.premium_limit
        elif tier == ModelTier.STANDARD:
            return self.standard_limit
        elif tier == ModelTier.ECONOMY:
            return self.economy_limit
        return None


# =============================================================================
# DOWNGRADE REASON
# =============================================================================

class DowngradeReason(Enum):
    """Reason for model downgrade."""
    LIMIT_REACHED = "limit_reached"
    COST_GOVERNANCE = "cost_governance"
    MANUAL_OVERRIDE = "manual_override"
    SESSION_POLICY = "session_policy"
    NO_DOWNGRADE = "no_downgrade"


# =============================================================================
# USAGE COUNTER
# =============================================================================

@dataclass
class TierUsageCounter:
    """
    Tracks successful executions for a specific model tier.

    Counters only decrement on successful execution with valid response.
    Failed, timed-out, or aborted executions do NOT affect counters.
    """
    tier: ModelTier
    limit: Optional[int]  # None = unlimited
    used: int = 0
    remaining: Optional[int] = None  # None if unlimited

    def __post_init__(self):
        """Initialize remaining count."""
        if self.limit is not None:
            self.remaining = self.limit - self.used

    def is_exhausted(self) -> bool:
        """Check if this tier's limit is exhausted."""
        if self.limit is None:
            return False  # Unlimited
        return self.used >= self.limit

    def can_use(self) -> bool:
        """Check if this tier can still be used."""
        return not self.is_exhausted()

    def record_success(self) -> bool:
        """
        Record a successful execution.

        Returns:
            True if counter was decremented, False if already at limit
        """
        if self.is_exhausted():
            return False

        self.used += 1
        if self.limit is not None:
            self.remaining = self.limit - self.used

        return True

    def get_remaining(self) -> Optional[int]:
        """Get remaining uses (None if unlimited)."""
        if self.limit is None:
            return None
        return max(0, self.limit - self.used)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "tier": self.tier.value,
            "limit": self.limit,
            "used": self.used,
            "remaining": self.remaining,
            "is_exhausted": self.is_exhausted(),
        }


# =============================================================================
# DOWNGRADE DECISION
# =============================================================================

@dataclass
class DowngradeDecision:
    """
    Decision about whether to downgrade a model tier.

    This captures the original requested tier, the final tier after
    downgrade rules are applied, and the justification.
    """
    # Original request
    requested_tier: ModelTier
    requested_model_id: str

    # Final decision
    final_tier: ModelTier
    final_model_id: str

    # Downgrade status
    was_downgraded: bool = False
    downgrade_reason: DowngradeReason = DowngradeReason.NO_DOWNGRADE
    downgrade_justification: str = ""

    # Usage information
    tier_usage: Optional[Dict[str, Any]] = None

    # Audit trail
    decided_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "requested": {
                "tier": self.requested_tier.value,
                "model_id": self.requested_model_id,
            },
            "final": {
                "tier": self.final_tier.value,
                "model_id": self.final_model_id,
            },
            "downgrade": {
                "was_downgraded": self.was_downgraded,
                "reason": self.downgrade_reason.value,
                "justification": self.downgrade_justification,
            },
            "usage": self.tier_usage,
            "decided_at": self.decided_at,
        }


# =============================================================================
# DOWNGRADE GOVERNOR
# =============================================================================

class DowngradeGovernor:
    """
    Enforces automatic model downgrade limits.

    This is a MANDATORY component that prevents uncontrolled escalation
    and ensures predictable token usage across all sessions.

    USAGE:
        governor = DowngradeGovernor()
        decision = governor.apply_downgrade(ModelTier.PREMIUM, context_id="session_123")

        # After successful execution:
        governor.record_success(decision.final_tier, context_id="session_123")

    The governor enforces:
    1. Premium tier: Max 2 successful executions → downgrade to standard
    2. Standard tier: Max 3 successful executions → downgrade to economy
    3. Economy tier: Unlimited (baseline)
    """

    def __init__(self, config: DowngradeConfig = None):
        """
        Initialize the downgrade governor.

        Args:
            config: Downgrade configuration
        """
        self.config = config or DowngradeConfig()

        # Usage counters per context (session/activation)
        # Structure: {context_id: {tier: TierUsageCounter}}
        self._usage: Dict[str, Dict[ModelTier, TierUsageCounter]] = {}

        # Statistics
        self._stats = {
            "total_decisions": 0,
            "downgrades_applied": 0,
            "by_tier": {tier.value: {"requested": 0, "downgraded": 0} for tier in ModelTier},
            "successful_executions": {tier.value: 0 for tier in ModelTier},
        }

    def _get_or_create_counters(self, context_id: str) -> Dict[ModelTier, TierUsageCounter]:
        """Get or create usage counters for a context."""
        if context_id not in self._usage:
            self._usage[context_id] = {
                ModelTier.PREMIUM: TierUsageCounter(
                    tier=ModelTier.PREMIUM,
                    limit=self.config.premium_limit,
                ),
                ModelTier.STANDARD: TierUsageCounter(
                    tier=ModelTier.STANDARD,
                    limit=self.config.standard_limit,
                ),
                ModelTier.ECONOMY: TierUsageCounter(
                    tier=ModelTier.ECONOMY,
                    limit=self.config.economy_limit,
                ),
            }
        return self._usage[context_id]

    def apply_downgrade(
        self,
        requested_tier: ModelTier,
        context_id: str = "default",
    ) -> DowngradeDecision:
        """
        Apply downgrade rules to a requested model tier.

        This is the MANDATORY pre-execution step that enforces
        downgrade limits before any model call.

        Args:
            requested_tier: The tier requested by routing
            context_id: Session/activation context identifier

        Returns:
            DowngradeDecision with final tier after rules applied
        """
        self._stats["total_decisions"] += 1
        self._stats["by_tier"][requested_tier.value]["requested"] += 1

        counters = self._get_or_create_counters(context_id)
        requested_model = get_model_for_tier(requested_tier)

        # Check if requested tier can be used
        if counters[requested_tier].can_use():
            # No downgrade needed
            return DowngradeDecision(
                requested_tier=requested_tier,
                requested_model_id=requested_model.model_id,
                final_tier=requested_tier,
                final_model_id=requested_model.model_id,
                was_downgraded=False,
                downgrade_reason=DowngradeReason.NO_DOWNGRADE,
                downgrade_justification=self._build_no_downgrade_justification(
                    requested_tier, counters[requested_tier]
                ),
                tier_usage=self._build_usage_dict(counters),
            )

        # Tier is exhausted - find downgrade target
        final_tier = self._find_downgrade_target(requested_tier, counters)
        final_model = get_model_for_tier(final_tier)

        self._stats["downgrades_applied"] += 1
        self._stats["by_tier"][requested_tier.value]["downgraded"] += 1

        decision = DowngradeDecision(
            requested_tier=requested_tier,
            requested_model_id=requested_model.model_id,
            final_tier=final_tier,
            final_model_id=final_model.model_id,
            was_downgraded=True,
            downgrade_reason=DowngradeReason.LIMIT_REACHED,
            downgrade_justification=self._build_downgrade_justification(
                requested_tier, final_tier, counters[requested_tier]
            ),
            tier_usage=self._build_usage_dict(counters),
        )

        if self.config.log_downgrades:
            self._log_downgrade(decision)

        return decision

    def _find_downgrade_target(
        self,
        exhausted_tier: ModelTier,
        counters: Dict[ModelTier, TierUsageCounter],
    ) -> ModelTier:
        """
        Find the next available tier after downgrade.

        Downgrade cascade:
        - Premium → Standard (if available) → Economy
        - Standard → Economy
        - Economy → Economy (no downgrade possible)
        """
        if exhausted_tier == ModelTier.PREMIUM:
            # Try standard first
            if counters[ModelTier.STANDARD].can_use():
                return ModelTier.STANDARD
            # Fall through to economy
            return ModelTier.ECONOMY

        if exhausted_tier == ModelTier.STANDARD:
            return ModelTier.ECONOMY

        # Economy has no downgrade target
        return ModelTier.ECONOMY

    def record_success(
        self,
        tier: ModelTier,
        context_id: str = "default",
    ) -> bool:
        """
        Record a successful execution for a tier.

        This should be called ONLY after a model call completes
        successfully with a valid response.

        Args:
            tier: The tier that was used
            context_id: Session/activation context identifier

        Returns:
            True if recorded, False if tier was already exhausted
        """
        counters = self._get_or_create_counters(context_id)
        result = counters[tier].record_success()

        if result:
            self._stats["successful_executions"][tier.value] += 1
            logger.debug(
                f"DOWNGRADE: Recorded success for {tier.value} in context {context_id}. "
                f"Remaining: {counters[tier].get_remaining()}"
            )

        return result

    def get_usage(self, context_id: str = "default") -> Dict[str, Any]:
        """Get usage information for a context."""
        if context_id not in self._usage:
            return {
                "context_id": context_id,
                "initialized": False,
                "counters": {},
            }

        counters = self._usage[context_id]
        return {
            "context_id": context_id,
            "initialized": True,
            "counters": {tier.value: counter.to_dict() for tier, counter in counters.items()},
        }

    def get_remaining(self, tier: ModelTier, context_id: str = "default") -> Optional[int]:
        """Get remaining uses for a tier in a context."""
        if context_id not in self._usage:
            limit = self.config.get_limit_for_tier(tier)
            return limit  # Full limit available
        return self._usage[context_id][tier].get_remaining()

    def is_tier_available(self, tier: ModelTier, context_id: str = "default") -> bool:
        """Check if a tier is still available in a context."""
        counters = self._get_or_create_counters(context_id)
        return counters[tier].can_use()

    def reset_context(self, context_id: str):
        """Reset counters for a context (e.g., new session)."""
        if context_id in self._usage:
            del self._usage[context_id]
            logger.info(f"DOWNGRADE: Reset counters for context {context_id}")

    def reset_all(self):
        """Reset all counters (for testing)."""
        self._usage = {}
        logger.info("DOWNGRADE: Reset all counters")

    def _build_no_downgrade_justification(
        self,
        tier: ModelTier,
        counter: TierUsageCounter,
    ) -> str:
        """Build justification for no downgrade."""
        remaining = counter.get_remaining()
        if remaining is None:
            return f"{tier.value} tier: unlimited (baseline)"
        return f"{tier.value} tier: {remaining}/{counter.limit} remaining"

    def _build_downgrade_justification(
        self,
        original_tier: ModelTier,
        final_tier: ModelTier,
        counter: TierUsageCounter,
    ) -> str:
        """Build justification for downgrade."""
        return (
            f"DOWNGRADE: {original_tier.value} → {final_tier.value} | "
            f"Reason: {original_tier.value} limit reached ({counter.used}/{counter.limit} used) | "
            f"Cost governance policy enforced"
        )

    def _build_usage_dict(
        self,
        counters: Dict[ModelTier, TierUsageCounter],
    ) -> Dict[str, Any]:
        """Build usage dictionary for decision."""
        return {
            tier.value: {
                "used": counter.used,
                "limit": counter.limit,
                "remaining": counter.get_remaining(),
                "exhausted": counter.is_exhausted(),
            }
            for tier, counter in counters.items()
        }

    def _log_downgrade(self, decision: DowngradeDecision):
        """Log a downgrade decision."""
        logger.warning(
            f"DOWNGRADE ENFORCED: {decision.requested_tier.value} → {decision.final_tier.value} | "
            f"Context: {decision.downgrade_justification}"
        )

    def get_statistics(self) -> Dict[str, Any]:
        """Get downgrade statistics."""
        stats = self._stats.copy()
        if stats["total_decisions"] > 0:
            stats["downgrade_rate"] = stats["downgrades_applied"] / stats["total_decisions"]
        else:
            stats["downgrade_rate"] = 0.0
        return stats

    def reset_statistics(self):
        """Reset statistics."""
        self._stats = {
            "total_decisions": 0,
            "downgrades_applied": 0,
            "by_tier": {tier.value: {"requested": 0, "downgraded": 0} for tier in ModelTier},
            "successful_executions": {tier.value: 0 for tier in ModelTier},
        }


# =============================================================================
# GLOBAL GOVERNOR INSTANCE
# =============================================================================

_global_governor: Optional[DowngradeGovernor] = None


def get_downgrade_governor() -> DowngradeGovernor:
    """Get the global downgrade governor."""
    global _global_governor
    if _global_governor is None:
        _global_governor = DowngradeGovernor()
    return _global_governor


def set_downgrade_governor(governor: DowngradeGovernor):
    """Set the global downgrade governor."""
    global _global_governor
    _global_governor = governor


def reset_downgrade_governor():
    """Reset the global downgrade governor."""
    global _global_governor
    _global_governor = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def apply_downgrade(
    requested_tier: ModelTier,
    context_id: str = "default",
) -> DowngradeDecision:
    """
    Apply downgrade rules to a requested tier.

    Args:
        requested_tier: The tier requested by routing
        context_id: Session/activation context identifier

    Returns:
        DowngradeDecision with final tier
    """
    return get_downgrade_governor().apply_downgrade(requested_tier, context_id)


def record_execution_success(
    tier: ModelTier,
    context_id: str = "default",
) -> bool:
    """
    Record a successful execution.

    Call this ONLY after a model call succeeds with valid response.

    Args:
        tier: The tier that was used
        context_id: Session/activation context identifier

    Returns:
        True if recorded successfully
    """
    return get_downgrade_governor().record_success(tier, context_id)


def get_tier_remaining(
    tier: ModelTier,
    context_id: str = "default",
) -> Optional[int]:
    """
    Get remaining uses for a tier.

    Args:
        tier: The tier to check
        context_id: Session/activation context identifier

    Returns:
        Remaining uses (None if unlimited)
    """
    return get_downgrade_governor().get_remaining(tier, context_id)


def is_tier_available(
    tier: ModelTier,
    context_id: str = "default",
) -> bool:
    """
    Check if a tier is available.

    Args:
        tier: The tier to check
        context_id: Session/activation context identifier

    Returns:
        True if tier can be used
    """
    return get_downgrade_governor().is_tier_available(tier, context_id)
