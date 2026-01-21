# =============================================================================
# MODEL ROUTER
# =============================================================================
"""
Main model router that orchestrates the routing process.

This module is the primary entry point for model routing. It:
1. Classifies incoming messages using COST-FIRST strategy
2. Evaluates routing rules
3. Returns a routing decision with selected model

CRITICAL: The router is a MANDATORY pre-execution step. All messages
must be routed before execution to ensure consistent behavior,
predictable costs, and intentional use of higher-capability models.

COST-FIRST STRATEGY:
- Zero-token classification is ALWAYS attempted first
- LLM is only invoked if rule-based confidence is insufficient
- This minimizes token usage at the routing stage
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from .classifier import (
    MessageClassifier,
    ClassificationResult,
    IntentCategory,
    ComplexityLevel,
    RiskLevel,
)
from .cheap_first import (
    CostFirstClassifier,
    CheapClassificationResult,
    ClassificationSource,
    ZeroTokenClassifier,
    ZeroTokenConfig,
    MinimalLLMClassifier,
    MinimalClassifierConfig,
    get_cost_first_classifier,
)
from .models import (
    ModelTier,
    ModelConfig,
    MODEL_CONFIGS,
    get_model_for_tier,
    get_model_id_for_tier,
)
from .rules import (
    RoutingRule,
    RoutingRuleEngine,
    get_default_rules,
)

logger = logging.getLogger(__name__)


# =============================================================================
# ROUTING DECISION
# =============================================================================

@dataclass
class RoutingDecision:
    """
    The complete routing decision for a message.

    This captures the classification, selected tier, model details,
    and justification for the routing decision.
    """
    # Selected model
    tier: ModelTier = ModelTier.ECONOMY
    model_id: str = ""
    model_display_name: str = ""

    # Classification that led to this decision
    classification: Optional[ClassificationResult] = None

    # Cost-first classification result (includes full metadata)
    cost_first_result: Optional[CheapClassificationResult] = None

    # Rule that matched
    matched_rule: str = ""
    rule_description: str = ""

    # Cost information
    cost_multiplier: float = 1.0
    estimated_savings: str = ""

    # Cost-first specific metrics
    classification_source: str = ""  # zero_token_keyword, minimal_llm, etc.
    zero_token_succeeded: bool = False
    llm_invoked: bool = False
    tokens_used_for_routing: int = 0

    # Justification
    justification: str = ""

    # Audit trail
    routed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    router_version: str = "1.1.0"  # Updated for cost-first integration

    # Original message (for audit)
    message_preview: str = ""  # First 100 chars

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/storage."""
        return {
            "tier": self.tier.value,
            "model_id": self.model_id,
            "model_display_name": self.model_display_name,
            "classification": self.classification.to_dict() if self.classification else None,
            "cost_first": self.cost_first_result.to_dict() if self.cost_first_result else None,
            "matched_rule": self.matched_rule,
            "rule_description": self.rule_description,
            "cost_multiplier": self.cost_multiplier,
            "estimated_savings": self.estimated_savings,
            "cost_first_metrics": {
                "source": self.classification_source,
                "zero_token_succeeded": self.zero_token_succeeded,
                "llm_invoked": self.llm_invoked,
                "tokens_used": self.tokens_used_for_routing,
            },
            "justification": self.justification,
            "routed_at": self.routed_at,
            "router_version": self.router_version,
            "message_preview": self.message_preview,
        }


# =============================================================================
# ROUTING CONFIG
# =============================================================================

@dataclass
class RoutingConfig:
    """
    Configuration for the model router.

    Attributes:
        default_tier: Default tier when no rules match
        log_decisions: Whether to log all routing decisions
        log_message_preview: Whether to include message preview in logs
        preview_length: Length of message preview for logging
        enable_cost_tracking: Whether to track cost savings
        custom_rules: Additional routing rules
        use_cost_first: Whether to use cost-first classification (MANDATORY)
        cost_first_confidence_threshold: Confidence threshold for zero-token success
        call_llm: Optional function to call LLM for minimal classification
    """
    default_tier: ModelTier = ModelTier.ECONOMY
    log_decisions: bool = True
    log_message_preview: bool = True
    preview_length: int = 100
    enable_cost_tracking: bool = True
    custom_rules: List[RoutingRule] = field(default_factory=list)

    # Cost-first configuration (MANDATORY - cannot be disabled)
    use_cost_first: bool = True  # Always true - included for documentation
    cost_first_confidence_threshold: float = 0.70
    call_llm: Optional[Callable] = None  # Function to call LLM if needed


# =============================================================================
# MODEL ROUTER
# =============================================================================

class ModelRouter:
    """
    Main model router for the Inspire 8.0 pipeline.

    This router is the MANDATORY pre-execution step that determines
    which model tier should handle each incoming message.

    USAGE:
        router = get_model_router()
        decision = router.route("What does John 3:16 mean?")
        model_id = decision.model_id  # e.g., "gpt-4o-turbo"

    COST-FIRST ROUTING:
    - Zero-token classification is ALWAYS attempted first
    - LLM is only invoked if rule-based confidence is insufficient
    - This minimizes token usage at the routing stage

    The router is DETERMINISTIC:
    - Same input produces same output (given same context)
    - Rules-based, not intuition
    - LLM inference only when rule-based classification is insufficient
    """

    def __init__(
        self,
        config: RoutingConfig = None,
        classifier: MessageClassifier = None,
        cost_first_classifier: CostFirstClassifier = None,
        rule_engine: RoutingRuleEngine = None,
    ):
        """
        Initialize the router.

        Args:
            config: Router configuration
            classifier: Legacy message classifier (fallback only)
            cost_first_classifier: Cost-first classifier (primary)
            rule_engine: Rule engine (uses default if not provided)
        """
        self.config = config or RoutingConfig()

        # Legacy classifier (kept for compatibility)
        self.classifier = classifier or MessageClassifier()

        # Cost-first classifier (PRIMARY - mandatory for routing)
        self.cost_first_classifier = cost_first_classifier or CostFirstClassifier(
            confidence_threshold=self.config.cost_first_confidence_threshold,
            call_llm=self.config.call_llm,
        )

        # Initialize rule engine with default + custom rules
        rules = get_default_rules()
        if self.config.custom_rules:
            rules.extend(self.config.custom_rules)
        self.rule_engine = rule_engine or RoutingRuleEngine(rules)

        # Statistics tracking
        self._stats = {
            "total_routed": 0,
            "by_tier": {tier.value: 0 for tier in ModelTier},
            "by_intent": {},
            "estimated_savings": 0.0,
            # Cost-first statistics
            "zero_token_successes": 0,
            "llm_invocations": 0,
            "total_tokens_for_routing": 0,
        }

    def route(
        self,
        message: str,
        context: Dict[str, Any] = None,
    ) -> RoutingDecision:
        """
        Route a message to the appropriate model tier using COST-FIRST strategy.

        This is the main entry point for routing. It:
        1. FIRST: Attempts zero-token classification (no LLM cost)
        2. ONLY IF NEEDED: Invokes minimal LLM classifier
        3. Evaluates routing rules based on classification
        4. Returns a complete routing decision with cost-first metadata

        CRITICAL: Zero-token classification is ALWAYS attempted first.
        LLM is only invoked if rule-based confidence is insufficient.

        Args:
            message: The user's message text
            context: Optional context (conversation history, persona, etc.)

        Returns:
            RoutingDecision with selected model, justification, and cost-first metrics
        """
        context = context or {}

        # Step 1: COST-FIRST CLASSIFICATION (mandatory)
        # This attempts zero-token classification first, only invoking LLM if needed
        cost_first_result = self.cost_first_classifier.classify(message, context)

        # Extract the base classification for rule evaluation
        classification = cost_first_result.classification

        # Step 2: Evaluate routing rules
        tier, rule_name = self.rule_engine.evaluate(classification)

        # Step 3: Get model details
        model_config = get_model_for_tier(tier)

        # Step 4: Build routing decision with cost-first metadata
        decision = RoutingDecision(
            tier=tier,
            model_id=model_config.model_id,
            model_display_name=model_config.display_name,
            classification=classification,
            cost_first_result=cost_first_result,
            matched_rule=rule_name,
            rule_description=self._get_rule_description(rule_name),
            cost_multiplier=model_config.cost_multiplier,
            # Cost-first specific metrics
            classification_source=cost_first_result.source.value,
            zero_token_succeeded=cost_first_result.zero_token_succeeded,
            llm_invoked=cost_first_result.llm_invoked,
            tokens_used_for_routing=cost_first_result.tokens_used,
            justification=self._generate_cost_first_justification(
                classification, cost_first_result, tier, rule_name
            ),
            message_preview=message[:self.config.preview_length] if self.config.log_message_preview else "",
        )

        # Step 5: Calculate estimated savings
        if self.config.enable_cost_tracking:
            decision.estimated_savings = self._calculate_savings(tier)

        # Step 6: Update statistics (including cost-first stats)
        self._update_stats(decision)

        # Step 7: Log decision
        if self.config.log_decisions:
            self._log_decision(decision)

        return decision

    def route_batch(
        self,
        messages: List[str],
        context: Dict[str, Any] = None,
    ) -> List[RoutingDecision]:
        """
        Route multiple messages.

        Args:
            messages: List of message texts
            context: Optional shared context

        Returns:
            List of RoutingDecision objects
        """
        return [self.route(msg, context) for msg in messages]

    def _get_rule_description(self, rule_name: str) -> str:
        """Get the description for a rule by name."""
        for rule in self.rule_engine.rules:
            if rule.name == rule_name:
                return rule.description
        return "Unknown rule"

    def _generate_justification(
        self,
        classification: ClassificationResult,
        tier: ModelTier,
        rule_name: str,
    ) -> str:
        """Generate human-readable justification for routing decision (legacy)."""
        parts = []

        # Intent justification
        parts.append(f"Intent: {classification.intent.value}")

        # Complexity/risk justification
        parts.append(f"Complexity: {classification.complexity.value}")
        parts.append(f"Risk: {classification.risk.value}")

        # Rule justification
        parts.append(f"Rule: {rule_name}")

        # Tier selection
        parts.append(f"Selected tier: {tier.value}")

        return " | ".join(parts)

    def _generate_cost_first_justification(
        self,
        classification: ClassificationResult,
        cost_first_result: CheapClassificationResult,
        tier: ModelTier,
        rule_name: str,
    ) -> str:
        """
        Generate human-readable justification including cost-first metadata.

        This provides full transparency about how the routing decision was made,
        including whether zero-token classification succeeded or LLM was needed.
        """
        parts = []

        # Cost-first source
        parts.append(f"Source: {cost_first_result.source.value}")

        # Zero-token status
        if cost_first_result.zero_token_succeeded:
            parts.append("Zero-token: SUCCESS")
        else:
            parts.append(f"Zero-token: INSUFFICIENT (conf={cost_first_result.rule_confidence:.2f})")

        # LLM status
        if cost_first_result.llm_invoked:
            parts.append(f"LLM: INVOKED ({cost_first_result.tokens_used} tokens)")
        else:
            parts.append("LLM: SKIPPED (zero-token sufficient)")

        # Intent justification
        parts.append(f"Intent: {classification.intent.value}")

        # Confidence
        parts.append(f"Confidence: {cost_first_result.final_confidence:.2f}")

        # Risk level
        parts.append(f"Risk: {classification.risk.value}")

        # Rule justification
        parts.append(f"Rule: {rule_name}")

        # Tier selection
        parts.append(f"Tier: {tier.value}")

        return " | ".join(parts)

    def _calculate_savings(self, actual_tier: ModelTier) -> str:
        """Calculate estimated savings vs always using premium."""
        actual_config = get_model_for_tier(actual_tier)
        premium_config = get_model_for_tier(ModelTier.PREMIUM)

        if actual_tier == ModelTier.PREMIUM:
            return "No savings (premium required)"

        savings_ratio = (premium_config.cost_multiplier - actual_config.cost_multiplier) / premium_config.cost_multiplier
        savings_pct = savings_ratio * 100

        return f"~{savings_pct:.0f}% savings vs premium"

    def _update_stats(self, decision: RoutingDecision):
        """Update routing statistics including cost-first metrics."""
        self._stats["total_routed"] += 1
        self._stats["by_tier"][decision.tier.value] += 1

        intent = decision.classification.intent.value if decision.classification else "unknown"
        if intent not in self._stats["by_intent"]:
            self._stats["by_intent"][intent] = 0
        self._stats["by_intent"][intent] += 1

        # Cost-first statistics
        if decision.zero_token_succeeded:
            self._stats["zero_token_successes"] += 1
        if decision.llm_invoked:
            self._stats["llm_invocations"] += 1
        self._stats["total_tokens_for_routing"] += decision.tokens_used_for_routing

    def _log_decision(self, decision: RoutingDecision):
        """Log the routing decision with cost-first metadata."""
        # Determine cost-first status
        if decision.zero_token_succeeded:
            cost_first_status = "ZERO-TOKEN"
        elif decision.llm_invoked:
            cost_first_status = f"LLM ({decision.tokens_used_for_routing} tokens)"
        else:
            cost_first_status = "FALLBACK"

        logger.info(
            f"ROUTING: {decision.tier.value} ({decision.model_id}) | "
            f"Source: {decision.classification_source} | "
            f"Cost-first: {cost_first_status} | "
            f"Rule: {decision.matched_rule} | "
            f"Intent: {decision.classification.intent.value if decision.classification else 'unknown'} | "
            f"{decision.estimated_savings}"
        )

    def get_statistics(self) -> Dict[str, Any]:
        """Get routing statistics."""
        return self._stats.copy()

    def reset_statistics(self):
        """Reset routing statistics."""
        self._stats = {
            "total_routed": 0,
            "by_tier": {tier.value: 0 for tier in ModelTier},
            "by_intent": {},
            "estimated_savings": 0.0,
            # Cost-first statistics
            "zero_token_successes": 0,
            "llm_invocations": 0,
            "total_tokens_for_routing": 0,
        }

    def get_cost_first_statistics(self) -> Dict[str, Any]:
        """Get cost-first specific statistics."""
        stats = {
            "total_classifications": self._stats["total_routed"],
            "zero_token_successes": self._stats["zero_token_successes"],
            "llm_invocations": self._stats["llm_invocations"],
            "total_tokens_for_routing": self._stats["total_tokens_for_routing"],
        }
        if stats["total_classifications"] > 0:
            stats["zero_token_rate"] = (
                stats["zero_token_successes"] / stats["total_classifications"]
            )
            stats["llm_invocation_rate"] = (
                stats["llm_invocations"] / stats["total_classifications"]
            )
        else:
            stats["zero_token_rate"] = 0.0
            stats["llm_invocation_rate"] = 0.0
        return stats

    # =========================================================================
    # OVERRIDE METHODS
    # =========================================================================

    def force_tier(
        self,
        message: str,
        tier: ModelTier,
        reason: str,
        context: Dict[str, Any] = None,
    ) -> RoutingDecision:
        """
        Force a specific tier (bypass normal routing).

        Use sparingly for special cases.

        Args:
            message: The message
            tier: The tier to force
            reason: Reason for the override
            context: Optional context

        Returns:
            RoutingDecision with forced tier
        """
        context = context or {}

        # Still classify for audit purposes
        classification = self.classifier.classify(message, context)

        model_config = get_model_for_tier(tier)

        decision = RoutingDecision(
            tier=tier,
            model_id=model_config.model_id,
            model_display_name=model_config.display_name,
            classification=classification,
            matched_rule="FORCED_OVERRIDE",
            rule_description=f"Forced to {tier.value}: {reason}",
            cost_multiplier=model_config.cost_multiplier,
            justification=f"FORCED OVERRIDE: {reason}",
            message_preview=message[:self.config.preview_length] if self.config.log_message_preview else "",
        )

        self._update_stats(decision)

        logger.warning(
            f"ROUTING OVERRIDE: Forced to {tier.value} | Reason: {reason}"
        )

        return decision


# =============================================================================
# GLOBAL ROUTER INSTANCE
# =============================================================================

_global_router: Optional[ModelRouter] = None


def get_model_router() -> ModelRouter:
    """
    Get the global model router instance.

    Returns:
        ModelRouter
    """
    global _global_router
    if _global_router is None:
        _global_router = ModelRouter()
    return _global_router


def set_model_router(router: ModelRouter):
    """
    Set the global model router instance.

    Args:
        router: The router to use globally
    """
    global _global_router
    _global_router = router


def reset_model_router():
    """Reset the global model router (for testing)."""
    global _global_router
    _global_router = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def route_message(
    message: str,
    context: Dict[str, Any] = None,
) -> RoutingDecision:
    """
    Convenience function to route a message.

    Args:
        message: The user's message
        context: Optional context

    Returns:
        RoutingDecision
    """
    return get_model_router().route(message, context)


def get_model_for_message(
    message: str,
    context: Dict[str, Any] = None,
) -> str:
    """
    Get the model ID for a message.

    Args:
        message: The user's message
        context: Optional context

    Returns:
        Model ID string (e.g., "gpt-4o-mini")
    """
    decision = route_message(message, context)
    return decision.model_id
