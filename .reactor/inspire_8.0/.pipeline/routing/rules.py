# =============================================================================
# ROUTING RULES ENGINE
# =============================================================================
"""
Deterministic routing rules for model selection.

This module defines the rules that map classification results to model tiers.
Rules are evaluated in priority order, and the first matching rule determines
the model tier.

CRITICAL: These rules are DETERMINISTIC. Model selection is governed by
classification rules rather than intuition.
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from .classifier import (
    ClassificationResult,
    IntentCategory,
    ComplexityLevel,
    RiskLevel,
)
from .models import ModelTier

logger = logging.getLogger(__name__)


# =============================================================================
# ROUTING RULE
# =============================================================================

@dataclass
class RoutingRule:
    """
    A single routing rule that maps conditions to a model tier.

    Rules are evaluated in priority order. The first rule whose
    condition is satisfied determines the model tier.

    Attributes:
        name: Human-readable rule name
        priority: Lower numbers = higher priority (evaluated first)
        tier: The model tier to use if this rule matches
        description: Human-readable description of the rule
        intent_matches: List of intents that trigger this rule (OR)
        complexity_min: Minimum complexity level to match
        risk_min: Minimum risk level to match
        custom_condition: Optional custom condition function
    """
    name: str
    priority: int
    tier: ModelTier
    description: str

    # Matching conditions
    intent_matches: List[IntentCategory] = field(default_factory=list)
    complexity_min: Optional[ComplexityLevel] = None
    risk_min: Optional[RiskLevel] = None

    # Custom condition (advanced)
    custom_condition: Optional[Callable[[ClassificationResult], bool]] = None

    def matches(self, classification: ClassificationResult) -> bool:
        """
        Check if this rule matches the classification.

        All specified conditions must be met (AND logic).
        Intent matches use OR logic within the list.

        Args:
            classification: The classification result to check

        Returns:
            True if this rule matches
        """
        # Check intent (if specified)
        if self.intent_matches:
            if classification.intent not in self.intent_matches:
                return False

        # Check complexity minimum (if specified)
        if self.complexity_min is not None:
            complexity_order = [
                ComplexityLevel.LOW,
                ComplexityLevel.MEDIUM,
                ComplexityLevel.HIGH,
                ComplexityLevel.VERY_HIGH,
            ]
            min_idx = complexity_order.index(self.complexity_min)
            actual_idx = complexity_order.index(classification.complexity)
            if actual_idx < min_idx:
                return False

        # Check risk minimum (if specified)
        if self.risk_min is not None:
            risk_order = [
                RiskLevel.LOW,
                RiskLevel.MEDIUM,
                RiskLevel.HIGH,
                RiskLevel.CRITICAL,
            ]
            min_idx = risk_order.index(self.risk_min)
            actual_idx = risk_order.index(classification.risk)
            if actual_idx < min_idx:
                return False

        # Check custom condition (if specified)
        if self.custom_condition is not None:
            if not self.custom_condition(classification):
                return False

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "priority": self.priority,
            "tier": self.tier.value,
            "description": self.description,
            "intent_matches": [i.value for i in self.intent_matches],
            "complexity_min": self.complexity_min.value if self.complexity_min else None,
            "risk_min": self.risk_min.value if self.risk_min else None,
        }


# =============================================================================
# ROUTING RULE ENGINE
# =============================================================================

class RoutingRuleEngine:
    """
    Engine that evaluates rules to determine model tier.

    The engine maintains a sorted list of rules and evaluates them
    in priority order. The first matching rule determines the tier.

    CRITICAL: This is the MANDATORY pre-execution step that ensures
    consistent, predictable model routing.
    """

    def __init__(self, rules: List[RoutingRule] = None):
        """
        Initialize the rule engine.

        Args:
            rules: List of routing rules (uses defaults if not provided)
        """
        self.rules = rules or get_default_rules()
        # Sort by priority (lower = higher priority)
        self.rules.sort(key=lambda r: r.priority)

    def evaluate(
        self,
        classification: ClassificationResult,
    ) -> tuple:
        """
        Evaluate rules to determine model tier.

        Args:
            classification: The classification result

        Returns:
            Tuple of (ModelTier, matched_rule_name)
        """
        for rule in self.rules:
            if rule.matches(classification):
                logger.info(
                    f"Rule matched: {rule.name} -> {rule.tier.value}"
                )
                return rule.tier, rule.name

        # Default fallback (should not happen if rules are complete)
        logger.warning("No rule matched, defaulting to ECONOMY tier")
        return ModelTier.ECONOMY, "default_fallback"

    def add_rule(self, rule: RoutingRule):
        """Add a rule and re-sort."""
        self.rules.append(rule)
        self.rules.sort(key=lambda r: r.priority)

    def remove_rule(self, name: str) -> bool:
        """Remove a rule by name."""
        for i, rule in enumerate(self.rules):
            if rule.name == name:
                del self.rules[i]
                return True
        return False

    def get_rules_summary(self) -> List[Dict[str, Any]]:
        """Get a summary of all rules."""
        return [rule.to_dict() for rule in self.rules]


# =============================================================================
# DEFAULT ROUTING RULES
# =============================================================================

def get_default_rules() -> List[RoutingRule]:
    """
    Get the default set of routing rules.

    These rules implement the three-tier routing strategy:
    - ECONOMY: Routine, factual, low-risk
    - STANDARD: Teaching, pastoral, moderate complexity
    - PREMIUM: Doctrinal, high-stakes, critical

    RULES ARE EVALUATED IN PRIORITY ORDER (lower number = higher priority).
    """
    rules = []

    # =========================================================================
    # PREMIUM TIER RULES (Priority 100-199)
    # =========================================================================
    # These rules catch the most critical cases first

    rules.append(RoutingRule(
        name="critical_risk",
        priority=100,
        tier=ModelTier.PREMIUM,
        description="Any CRITICAL risk level requires premium tier",
        risk_min=RiskLevel.CRITICAL,
    ))

    rules.append(RoutingRule(
        name="crisis_guidance",
        priority=110,
        tier=ModelTier.PREMIUM,
        description="Crisis guidance requires premium tier",
        intent_matches=[IntentCategory.CRISIS_GUIDANCE],
    ))

    rules.append(RoutingRule(
        name="sensitive_matter",
        priority=111,
        tier=ModelTier.PREMIUM,
        description="Sensitive matters require premium tier",
        intent_matches=[IntentCategory.SENSITIVE_MATTER],
    ))

    rules.append(RoutingRule(
        name="doctrinal_question",
        priority=120,
        tier=ModelTier.PREMIUM,
        description="Deep doctrinal questions require premium tier",
        intent_matches=[IntentCategory.DOCTRINAL_QUESTION],
    ))

    rules.append(RoutingRule(
        name="theological_debate",
        priority=121,
        tier=ModelTier.PREMIUM,
        description="Theological debates require premium tier",
        intent_matches=[IntentCategory.THEOLOGICAL_DEBATE],
    ))

    rules.append(RoutingRule(
        name="ethical_dilemma",
        priority=130,
        tier=ModelTier.PREMIUM,
        description="Ethical dilemmas require premium tier",
        intent_matches=[IntentCategory.ETHICAL_DILEMMA],
    ))

    rules.append(RoutingRule(
        name="leadership_decision",
        priority=140,
        tier=ModelTier.PREMIUM,
        description="Leadership decisions require premium tier",
        intent_matches=[IntentCategory.LEADERSHIP_DECISION],
    ))

    rules.append(RoutingRule(
        name="strategic_planning",
        priority=141,
        tier=ModelTier.PREMIUM,
        description="Strategic planning requires premium tier",
        intent_matches=[IntentCategory.STRATEGIC_PLANNING],
    ))

    rules.append(RoutingRule(
        name="very_high_complexity_high_risk",
        priority=150,
        tier=ModelTier.PREMIUM,
        description="Very high complexity with high risk requires premium",
        complexity_min=ComplexityLevel.VERY_HIGH,
        risk_min=RiskLevel.HIGH,
    ))

    # =========================================================================
    # STANDARD TIER RULES (Priority 200-299)
    # =========================================================================
    # These rules catch moderate complexity and pastoral cases

    rules.append(RoutingRule(
        name="high_risk",
        priority=200,
        tier=ModelTier.STANDARD,
        description="HIGH risk (non-critical) uses standard tier",
        risk_min=RiskLevel.HIGH,
    ))

    rules.append(RoutingRule(
        name="pastoral_guidance",
        priority=210,
        tier=ModelTier.STANDARD,
        description="Pastoral guidance uses standard tier",
        intent_matches=[IntentCategory.PASTORAL_GUIDANCE],
    ))

    rules.append(RoutingRule(
        name="teaching_request",
        priority=220,
        tier=ModelTier.STANDARD,
        description="Teaching requests use standard tier",
        intent_matches=[IntentCategory.TEACHING_REQUEST],
    ))

    rules.append(RoutingRule(
        name="explanation",
        priority=221,
        tier=ModelTier.STANDARD,
        description="Explanations use standard tier",
        intent_matches=[IntentCategory.EXPLANATION],
    ))

    rules.append(RoutingRule(
        name="scripture_application",
        priority=230,
        tier=ModelTier.STANDARD,
        description="Scripture application uses standard tier",
        intent_matches=[IntentCategory.SCRIPTURE_APPLICATION],
    ))

    rules.append(RoutingRule(
        name="prayer_request",
        priority=240,
        tier=ModelTier.STANDARD,
        description="Prayer requests use standard tier",
        intent_matches=[IntentCategory.PRAYER_REQUEST],
    ))

    rules.append(RoutingRule(
        name="encouragement",
        priority=241,
        tier=ModelTier.STANDARD,
        description="Encouragement uses standard tier",
        intent_matches=[IntentCategory.ENCOURAGEMENT],
    ))

    rules.append(RoutingRule(
        name="high_complexity",
        priority=250,
        tier=ModelTier.STANDARD,
        description="High complexity uses standard tier",
        complexity_min=ComplexityLevel.HIGH,
    ))

    rules.append(RoutingRule(
        name="medium_risk",
        priority=260,
        tier=ModelTier.STANDARD,
        description="Medium risk uses standard tier",
        risk_min=RiskLevel.MEDIUM,
    ))

    rules.append(RoutingRule(
        name="unknown_intent",
        priority=290,
        tier=ModelTier.STANDARD,
        description="Unknown intent defaults to standard for safety",
        intent_matches=[IntentCategory.UNKNOWN],
    ))

    # =========================================================================
    # ECONOMY TIER RULES (Priority 300-399)
    # =========================================================================
    # These rules catch routine, factual, and low-risk cases

    rules.append(RoutingRule(
        name="greeting",
        priority=300,
        tier=ModelTier.ECONOMY,
        description="Greetings use economy tier",
        intent_matches=[IntentCategory.GREETING],
    ))

    rules.append(RoutingRule(
        name="acknowledgment",
        priority=301,
        tier=ModelTier.ECONOMY,
        description="Acknowledgments use economy tier",
        intent_matches=[IntentCategory.ACKNOWLEDGMENT],
    ))

    rules.append(RoutingRule(
        name="clarification",
        priority=310,
        tier=ModelTier.ECONOMY,
        description="Clarifications use economy tier",
        intent_matches=[IntentCategory.CLARIFICATION],
    ))

    rules.append(RoutingRule(
        name="factual_lookup",
        priority=320,
        tier=ModelTier.ECONOMY,
        description="Factual lookups use economy tier",
        intent_matches=[IntentCategory.FACTUAL_LOOKUP],
    ))

    rules.append(RoutingRule(
        name="simple_question",
        priority=330,
        tier=ModelTier.ECONOMY,
        description="Simple questions use economy tier",
        intent_matches=[IntentCategory.SIMPLE_QUESTION],
    ))

    rules.append(RoutingRule(
        name="routine_request",
        priority=340,
        tier=ModelTier.ECONOMY,
        description="Routine requests use economy tier",
        intent_matches=[IntentCategory.ROUTINE_REQUEST],
    ))

    # =========================================================================
    # DEFAULT FALLBACK (Priority 999)
    # =========================================================================

    rules.append(RoutingRule(
        name="default_economy",
        priority=999,
        tier=ModelTier.ECONOMY,
        description="Default fallback to economy tier",
        # No conditions - always matches if nothing else did
    ))

    return rules


# =============================================================================
# CUSTOM RULE BUILDERS
# =============================================================================

def create_override_rule(
    name: str,
    tier: ModelTier,
    description: str,
    priority: int = 50,  # High priority to override defaults
) -> RoutingRule:
    """
    Create a high-priority override rule.

    Use this for special cases that need to bypass normal routing.

    Args:
        name: Rule name
        tier: Tier to force
        description: Why this override exists
        priority: Rule priority (default 50 = very high)

    Returns:
        RoutingRule
    """
    return RoutingRule(
        name=f"override_{name}",
        priority=priority,
        tier=tier,
        description=f"OVERRIDE: {description}",
        # Override rules need a custom condition
        custom_condition=lambda c: True,  # Always matches
    )


def create_persona_rule(
    persona_name: str,
    tier: ModelTier,
    description: str,
) -> RoutingRule:
    """
    Create a rule that routes based on persona.

    Args:
        persona_name: The persona name to match
        tier: Tier to use for this persona
        description: Rule description

    Returns:
        RoutingRule
    """
    def persona_condition(classification: ClassificationResult) -> bool:
        # This would need access to context - simplified for now
        return False  # Placeholder

    return RoutingRule(
        name=f"persona_{persona_name}",
        priority=90,  # Just before premium rules
        tier=tier,
        description=description,
        custom_condition=persona_condition,
    )
