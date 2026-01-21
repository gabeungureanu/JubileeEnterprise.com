# =============================================================================
# FORMAL MEMORY POLICY
# =============================================================================
"""
Formal memory policy governing when information is written to long-term
persona memory.

This module enforces that ONLY durable, high-signal content is persisted:
- New user preferences
- New decisions
- Newly revealed needs
- Doctrinal or theological notes

PROHIBITED from persistence:
- Transient conversation details
- Speculative thoughts
- Routine exchanges
- Content that does not meet durability criteria

REQUIRED for all memory items:
- Confidence indicator (provisional, confirmed, high_confidence)
- Scope designation (private, shared)
- Durability justification

This policy is applied CONSISTENTLY across all personas and all memory
writeback operations.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIDENCE INDICATORS
# =============================================================================

class ConfidenceLevel(Enum):
    """
    Confidence indicators for memory items.

    Every memory item MUST have a confidence level that indicates
    how certain we are about the information.

    PROVISIONAL: Initial observation, may need verification
                 - First mention of a preference
                 - Unclear or ambiguous statement
                 - May be updated or invalidated later

    CONFIRMED: Verified through repetition or explicit confirmation
               - Preference stated multiple times
               - User explicitly confirmed
               - Consistent with known patterns

    HIGH_CONFIDENCE: Strong certainty, unlikely to change
                     - Explicit, unambiguous statement
                     - Core identity information
                     - Doctrinal/theological anchor
    """
    PROVISIONAL = "provisional"
    CONFIRMED = "confirmed"
    HIGH_CONFIDENCE = "high_confidence"

    @classmethod
    def from_score(cls, score: float) -> "ConfidenceLevel":
        """Convert a numeric score (0.0-1.0) to confidence level."""
        if score >= 0.85:
            return cls.HIGH_CONFIDENCE
        elif score >= 0.65:
            return cls.CONFIRMED
        else:
            return cls.PROVISIONAL


# =============================================================================
# SCOPE DESIGNATIONS
# =============================================================================

class MemoryScope(Enum):
    """
    Scope designations for memory items.

    Every memory item MUST have a scope that indicates its visibility
    and applicability.

    PRIVATE: Persona-specific or user-specific memory
             - User preferences for a specific persona
             - Personal interactions and history
             - NOT shared across personas

    SHARED: Cross-persona relevance
            - Doctrinal anchors (applies to all personas)
            - Scripture references (universal truth)
            - Governance guidelines
            - User preferences that apply to all personas

    USER_GLOBAL: User-specific but applies across all personas
                 - User's name, communication preferences
                 - Global user settings
    """
    PRIVATE = "private"
    SHARED = "shared"
    USER_GLOBAL = "user_global"


# =============================================================================
# DURABILITY CRITERIA
# =============================================================================

class DurabilityCriteria(Enum):
    """
    Criteria that qualify content for long-term memory storage.

    Only content meeting at least ONE of these criteria should be stored.
    Content not meeting any criteria is considered TRANSIENT and must be
    rejected from long-term storage.
    """
    # Qualifies: Meaningful, lasting changes or insights
    NEW_USER_PREFERENCE = "new_user_preference"
    NEW_DECISION = "new_decision"
    NEWLY_REVEALED_NEED = "newly_revealed_need"
    DOCTRINAL_NOTE = "doctrinal_note"
    THEOLOGICAL_INSIGHT = "theological_insight"
    RELATIONSHIP_MILESTONE = "relationship_milestone"
    SCRIPTURE_APPLICATION = "scripture_application"
    LESSON_LEARNED = "lesson_learned"

    # Does NOT qualify: Transient content
    # - Routine exchanges
    # - Speculative thoughts
    # - Temporary preferences
    # - Session-specific details


class TransientReason(Enum):
    """
    Reasons why content is considered transient and NOT durable.

    Content matching any of these reasons must be REJECTED from
    long-term memory storage.
    """
    ROUTINE_EXCHANGE = "routine_exchange"
    SPECULATIVE_THOUGHT = "speculative_thought"
    TEMPORARY_PREFERENCE = "temporary_preference"
    SESSION_SPECIFIC = "session_specific"
    UNCLEAR_INTENT = "unclear_intent"
    TRIVIAL_DETAIL = "trivial_detail"
    ALREADY_KNOWN = "already_known"
    LOW_SIGNAL = "low_signal"


# =============================================================================
# POLICY EVALUATION RESULT
# =============================================================================

@dataclass
class PolicyEvaluation:
    """
    Result of evaluating a memory item against the formal memory policy.

    This captures whether an item should be persisted and why.
    """
    # Decision
    should_persist: bool = False
    rejection_reason: Optional[str] = None

    # Required classifications (MUST be set for persisted items)
    confidence: Optional[ConfidenceLevel] = None
    scope: Optional[MemoryScope] = None

    # Durability assessment
    durability_criteria_met: List[DurabilityCriteria] = field(default_factory=list)
    transient_reasons: List[TransientReason] = field(default_factory=list)

    # Quality metrics
    durability_score: float = 0.0  # 0.0-1.0
    signal_strength: float = 0.0  # 0.0-1.0

    # Justification
    justification: str = ""

    # Audit trail
    evaluated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    policy_version: str = "1.0.0"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/logging."""
        return {
            "should_persist": self.should_persist,
            "rejection_reason": self.rejection_reason,
            "confidence": self.confidence.value if self.confidence else None,
            "scope": self.scope.value if self.scope else None,
            "durability_criteria_met": [c.value for c in self.durability_criteria_met],
            "transient_reasons": [r.value for r in self.transient_reasons],
            "durability_score": self.durability_score,
            "signal_strength": self.signal_strength,
            "justification": self.justification,
            "evaluated_at": self.evaluated_at,
            "policy_version": self.policy_version,
        }


# =============================================================================
# MEMORY POLICY ENFORCER
# =============================================================================

@dataclass
class MemoryPolicyConfig:
    """Configuration for memory policy enforcement."""

    # Minimum durability score to persist (0.0-1.0)
    min_durability_score: float = 0.5

    # Minimum signal strength to persist (0.0-1.0)
    min_signal_strength: float = 0.4

    # Require at least one durability criterion
    require_durability_criterion: bool = True

    # Block items with transient reasons
    block_transient_items: bool = True

    # Require explicit confidence level
    require_confidence: bool = True

    # Require explicit scope
    require_scope: bool = True

    # Default confidence for unclassified items
    default_confidence: ConfidenceLevel = ConfidenceLevel.PROVISIONAL

    # Default scope for unclassified items
    default_scope: MemoryScope = MemoryScope.PRIVATE


class MemoryPolicyEnforcer:
    """
    Enforces the formal memory policy on all memory items.

    This is the central gatekeeper that ensures ONLY durable, high-signal
    content is persisted to long-term memory. It evaluates each item
    against durability criteria and assigns required metadata.

    CRITICAL: This policy is applied UNIFORMLY across all personas
    and all memory writeback operations.
    """

    # Keywords indicating durable content
    DURABILITY_KEYWORDS = {
        DurabilityCriteria.NEW_USER_PREFERENCE: [
            "prefer", "like", "want", "always", "never", "please",
            "call me", "address me", "my name", "i prefer",
        ],
        DurabilityCriteria.NEW_DECISION: [
            "decided", "decision", "chose", "choosing", "will use",
            "going with", "selected", "committed", "resolved",
        ],
        DurabilityCriteria.NEWLY_REVEALED_NEED: [
            "need", "require", "must have", "looking for",
            "struggling with", "help with", "want to",
        ],
        DurabilityCriteria.DOCTRINAL_NOTE: [
            "doctrine", "doctrinal", "belief", "believes",
            "theology", "theological", "teaching", "truth",
        ],
        DurabilityCriteria.THEOLOGICAL_INSIGHT: [
            "scripture", "verse", "biblical", "god", "jesus",
            "spirit", "faith", "prayer", "worship",
        ],
        DurabilityCriteria.RELATIONSHIP_MILESTONE: [
            "first time", "milestone", "breakthrough", "progress",
            "growth", "learned", "realized", "understood",
        ],
        DurabilityCriteria.SCRIPTURE_APPLICATION: [
            "applies", "application", "meaning", "interpretation",
            "teaches", "shows us", "reminds us",
        ],
        DurabilityCriteria.LESSON_LEARNED: [
            "learned", "lesson", "insight", "realized",
            "discovered", "understood", "key takeaway",
        ],
    }

    # Keywords indicating transient content
    TRANSIENT_KEYWORDS = {
        TransientReason.ROUTINE_EXCHANGE: [
            "hello", "hi", "hey", "thanks", "thank you",
            "bye", "goodbye", "see you", "ok", "okay",
        ],
        TransientReason.SPECULATIVE_THOUGHT: [
            "maybe", "perhaps", "might", "could be",
            "not sure", "wondering", "possibly", "i think",
        ],
        TransientReason.TEMPORARY_PREFERENCE: [
            "just this time", "for now", "right now",
            "today only", "temporarily", "this session",
        ],
        TransientReason.SESSION_SPECIFIC: [
            "this conversation", "earlier you said",
            "as we discussed", "in this chat",
        ],
        TransientReason.TRIVIAL_DETAIL: [
            "by the way", "anyway", "also", "btw",
            "random thought", "off topic",
        ],
    }

    # Scope indicators
    SHARED_SCOPE_INDICATORS = [
        "everyone", "all personas", "universal", "always true",
        "doctrine", "scripture", "theological", "governance",
    ]

    USER_GLOBAL_INDICATORS = [
        "my name is", "call me", "i always", "i never",
        "remember that i", "across all", "everywhere",
    ]

    def __init__(self, config: MemoryPolicyConfig = None):
        """
        Initialize the policy enforcer.

        Args:
            config: Policy configuration (uses defaults if not provided)
        """
        self.config = config or MemoryPolicyConfig()
        self.policy_version = "1.0.0"

    def evaluate(
        self,
        content: str,
        item_type: str,
        context: Dict[str, Any] = None,
        existing_confidence: float = None,
    ) -> PolicyEvaluation:
        """
        Evaluate a memory item against the formal memory policy.

        This is the main entry point for policy evaluation. It determines
        whether an item should be persisted and assigns required metadata.

        Args:
            content: The memory item content
            item_type: Type of memory item
            context: Optional context about the item
            existing_confidence: Pre-calculated confidence score (0.0-1.0)

        Returns:
            PolicyEvaluation with decision and metadata
        """
        context = context or {}
        evaluation = PolicyEvaluation()

        # Step 1: Check for transient content (disqualifying)
        transient_reasons = self._detect_transient_reasons(content)
        evaluation.transient_reasons = transient_reasons

        if transient_reasons and self.config.block_transient_items:
            evaluation.should_persist = False
            evaluation.rejection_reason = (
                f"Content is transient: {', '.join(r.value for r in transient_reasons)}"
            )
            return evaluation

        # Step 2: Check for durability criteria (qualifying)
        durability_criteria = self._detect_durability_criteria(content, item_type)
        evaluation.durability_criteria_met = durability_criteria

        if not durability_criteria and self.config.require_durability_criterion:
            evaluation.should_persist = False
            evaluation.rejection_reason = (
                "Content does not meet any durability criteria. "
                "Only durable, high-signal content should be stored."
            )
            return evaluation

        # Step 3: Calculate durability and signal scores
        durability_score = self._calculate_durability_score(
            content, durability_criteria, transient_reasons
        )
        signal_strength = self._calculate_signal_strength(
            content, item_type, context
        )

        evaluation.durability_score = durability_score
        evaluation.signal_strength = signal_strength

        # Step 4: Check minimum thresholds
        if durability_score < self.config.min_durability_score:
            evaluation.should_persist = False
            evaluation.rejection_reason = (
                f"Durability score {durability_score:.2f} below minimum "
                f"{self.config.min_durability_score}"
            )
            return evaluation

        if signal_strength < self.config.min_signal_strength:
            evaluation.should_persist = False
            evaluation.rejection_reason = (
                f"Signal strength {signal_strength:.2f} below minimum "
                f"{self.config.min_signal_strength}"
            )
            return evaluation

        # Step 5: Assign confidence level (REQUIRED)
        if existing_confidence is not None:
            evaluation.confidence = ConfidenceLevel.from_score(existing_confidence)
        else:
            evaluation.confidence = self._determine_confidence(
                content, durability_criteria, signal_strength
            )

        # Step 6: Assign scope (REQUIRED)
        evaluation.scope = self._determine_scope(content, item_type, context)

        # Step 7: Generate justification
        evaluation.justification = self._generate_justification(
            durability_criteria, evaluation.confidence, evaluation.scope
        )

        # Step 8: Final decision
        evaluation.should_persist = True

        logger.info(
            f"Policy evaluation: PERSIST={evaluation.should_persist}, "
            f"confidence={evaluation.confidence.value if evaluation.confidence else 'none'}, "
            f"scope={evaluation.scope.value if evaluation.scope else 'none'}, "
            f"criteria={[c.value for c in durability_criteria]}"
        )

        return evaluation

    def _detect_transient_reasons(self, content: str) -> List[TransientReason]:
        """Detect reasons why content might be transient."""
        reasons = []
        content_lower = content.lower()

        for reason, keywords in self.TRANSIENT_KEYWORDS.items():
            if any(kw in content_lower for kw in keywords):
                reasons.append(reason)

        return reasons

    def _detect_durability_criteria(
        self,
        content: str,
        item_type: str,
    ) -> List[DurabilityCriteria]:
        """Detect which durability criteria the content meets."""
        criteria = []
        content_lower = content.lower()

        # Check keyword-based criteria
        for criterion, keywords in self.DURABILITY_KEYWORDS.items():
            if any(kw in content_lower for kw in keywords):
                criteria.append(criterion)

        # Check item type-based criteria
        type_criteria_map = {
            "user_preference": DurabilityCriteria.NEW_USER_PREFERENCE,
            "key_decision": DurabilityCriteria.NEW_DECISION,
            "scripture_reference": DurabilityCriteria.SCRIPTURE_APPLICATION,
            "lesson_learned": DurabilityCriteria.LESSON_LEARNED,
            "relationship_context": DurabilityCriteria.RELATIONSHIP_MILESTONE,
        }

        if item_type in type_criteria_map:
            type_criterion = type_criteria_map[item_type]
            if type_criterion not in criteria:
                criteria.append(type_criterion)

        return criteria

    def _calculate_durability_score(
        self,
        content: str,
        durability_criteria: List[DurabilityCriteria],
        transient_reasons: List[TransientReason],
    ) -> float:
        """
        Calculate durability score (0.0-1.0).

        Higher score = more durable, should be persisted.
        """
        score = 0.5  # Base score

        # Boost for each durability criterion met
        score += len(durability_criteria) * 0.15

        # Penalty for each transient reason
        score -= len(transient_reasons) * 0.2

        # Content length factor (very short = less durable)
        if len(content) < 20:
            score -= 0.2
        elif len(content) > 100:
            score += 0.1

        return max(0.0, min(1.0, score))

    def _calculate_signal_strength(
        self,
        content: str,
        item_type: str,
        context: Dict[str, Any],
    ) -> float:
        """
        Calculate signal strength (0.0-1.0).

        Higher score = more meaningful/valuable content.
        """
        score = 0.5  # Base score

        # Item type factors
        high_signal_types = {
            "key_decision": 0.2,
            "user_preference": 0.15,
            "scripture_reference": 0.2,
            "lesson_learned": 0.15,
        }
        score += high_signal_types.get(item_type, 0)

        # Content specificity (contains specific details)
        if any(char.isdigit() for char in content):
            score += 0.1  # Contains numbers (specific)

        # Context factors
        if context.get("user_confirmed"):
            score += 0.2
        if context.get("repeated"):
            score += 0.15

        return max(0.0, min(1.0, score))

    def _determine_confidence(
        self,
        content: str,
        durability_criteria: List[DurabilityCriteria],
        signal_strength: float,
    ) -> ConfidenceLevel:
        """Determine the appropriate confidence level."""
        # High confidence indicators
        if signal_strength >= 0.8:
            return ConfidenceLevel.HIGH_CONFIDENCE

        # Doctrinal/theological content is high confidence
        doctrinal_criteria = {
            DurabilityCriteria.DOCTRINAL_NOTE,
            DurabilityCriteria.THEOLOGICAL_INSIGHT,
            DurabilityCriteria.SCRIPTURE_APPLICATION,
        }
        if any(c in doctrinal_criteria for c in durability_criteria):
            return ConfidenceLevel.HIGH_CONFIDENCE

        # Confirmed indicators
        if signal_strength >= 0.6:
            return ConfidenceLevel.CONFIRMED

        # Explicit statements
        explicit_words = ["always", "never", "definitely", "certainly"]
        if any(word in content.lower() for word in explicit_words):
            return ConfidenceLevel.CONFIRMED

        # Default to provisional
        return ConfidenceLevel.PROVISIONAL

    def _determine_scope(
        self,
        content: str,
        item_type: str,
        context: Dict[str, Any],
    ) -> MemoryScope:
        """Determine the appropriate scope designation."""
        content_lower = content.lower()

        # Check for shared scope indicators
        if any(ind in content_lower for ind in self.SHARED_SCOPE_INDICATORS):
            return MemoryScope.SHARED

        # Check for user-global indicators
        if any(ind in content_lower for ind in self.USER_GLOBAL_INDICATORS):
            return MemoryScope.USER_GLOBAL

        # Item type-based scope
        shared_types = {"scripture_reference", "doctrinal_note"}
        if item_type in shared_types:
            return MemoryScope.SHARED

        # Context-based scope
        if context.get("cross_persona"):
            return MemoryScope.SHARED
        if context.get("user_global"):
            return MemoryScope.USER_GLOBAL

        # Default to private
        return MemoryScope.PRIVATE

    def _generate_justification(
        self,
        durability_criteria: List[DurabilityCriteria],
        confidence: ConfidenceLevel,
        scope: MemoryScope,
    ) -> str:
        """Generate a justification for persisting the item."""
        parts = []

        # Criteria justification
        if durability_criteria:
            criteria_str = ", ".join(c.value for c in durability_criteria)
            parts.append(f"Meets durability criteria: {criteria_str}")

        # Confidence justification
        if confidence:
            parts.append(f"Confidence level: {confidence.value}")

        # Scope justification
        if scope:
            parts.append(f"Scope: {scope.value}")

        return ". ".join(parts) if parts else "Standard memory item"

    # =========================================================================
    # BULK EVALUATION
    # =========================================================================

    def evaluate_batch(
        self,
        items: List[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Evaluate a batch of items and separate into persist/reject lists.

        Args:
            items: List of dicts with 'content', 'item_type', 'context', 'confidence'

        Returns:
            Tuple of (items_to_persist, items_to_reject)
        """
        to_persist = []
        to_reject = []

        for item in items:
            evaluation = self.evaluate(
                content=item.get("content", ""),
                item_type=item.get("item_type", ""),
                context=item.get("context", {}),
                existing_confidence=item.get("confidence"),
            )

            if evaluation.should_persist:
                # Enrich item with policy metadata
                item["policy_confidence"] = evaluation.confidence.value
                item["policy_scope"] = evaluation.scope.value
                item["policy_justification"] = evaluation.justification
                item["durability_score"] = evaluation.durability_score
                item["signal_strength"] = evaluation.signal_strength
                to_persist.append(item)
            else:
                item["rejection_reason"] = evaluation.rejection_reason
                to_reject.append(item)

        logger.info(
            f"Batch evaluation: {len(to_persist)} to persist, "
            f"{len(to_reject)} rejected"
        )

        return to_persist, to_reject


# =============================================================================
# GLOBAL POLICY INSTANCE
# =============================================================================

_global_policy_enforcer: Optional[MemoryPolicyEnforcer] = None


def get_memory_policy_enforcer() -> MemoryPolicyEnforcer:
    """Get the global memory policy enforcer."""
    global _global_policy_enforcer
    if _global_policy_enforcer is None:
        _global_policy_enforcer = MemoryPolicyEnforcer()
    return _global_policy_enforcer


def set_memory_policy_enforcer(enforcer: MemoryPolicyEnforcer):
    """Set the global memory policy enforcer."""
    global _global_policy_enforcer
    _global_policy_enforcer = enforcer


def reset_memory_policy_enforcer():
    """Reset the global memory policy enforcer (for testing)."""
    global _global_policy_enforcer
    _global_policy_enforcer = None
