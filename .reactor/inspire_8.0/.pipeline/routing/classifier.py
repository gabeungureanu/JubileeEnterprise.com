# =============================================================================
# MESSAGE CLASSIFIER
# =============================================================================
"""
Classifies incoming messages to determine routing tier.

This module evaluates each incoming user message and classifies it across
three dimensions:
1. Intent Category - What the user wants to accomplish
2. Complexity Level - How complex is the request
3. Risk Level - What are the stakes of getting it wrong

These classifications drive deterministic model routing decisions.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# INTENT CATEGORIES
# =============================================================================

class IntentCategory(Enum):
    """
    Categories of user intent for routing purposes.

    These map to different model requirements based on the
    nature of what the user is trying to accomplish.
    """
    # ECONOMY TIER INTENTS
    GREETING = "greeting"
    CLARIFICATION = "clarification"
    FACTUAL_LOOKUP = "factual_lookup"
    SIMPLE_QUESTION = "simple_question"
    ACKNOWLEDGMENT = "acknowledgment"
    ROUTINE_REQUEST = "routine_request"

    # STANDARD TIER INTENTS
    TEACHING_REQUEST = "teaching_request"
    EXPLANATION = "explanation"
    PASTORAL_GUIDANCE = "pastoral_guidance"
    SCRIPTURE_APPLICATION = "scripture_application"
    PRAYER_REQUEST = "prayer_request"
    ENCOURAGEMENT = "encouragement"

    # PREMIUM TIER INTENTS
    DOCTRINAL_QUESTION = "doctrinal_question"
    THEOLOGICAL_DEBATE = "theological_debate"
    LEADERSHIP_DECISION = "leadership_decision"
    STRATEGIC_PLANNING = "strategic_planning"
    CRISIS_GUIDANCE = "crisis_guidance"
    ETHICAL_DILEMMA = "ethical_dilemma"
    SENSITIVE_MATTER = "sensitive_matter"

    # SPECIAL
    UNKNOWN = "unknown"


# =============================================================================
# COMPLEXITY LEVELS
# =============================================================================

class ComplexityLevel(Enum):
    """
    Complexity levels for routing purposes.

    Higher complexity requires more capable models.
    """
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


# =============================================================================
# RISK LEVELS
# =============================================================================

class RiskLevel(Enum):
    """
    Risk levels for routing purposes.

    Higher risk requires more capable models to minimize errors.
    """
    LOW = "low"          # Incorrect response has minimal impact
    MEDIUM = "medium"    # Incorrect response could cause confusion
    HIGH = "high"        # Incorrect response could cause harm
    CRITICAL = "critical"  # Incorrect response could cause significant harm


# =============================================================================
# CLASSIFICATION RESULT
# =============================================================================

@dataclass
class ClassificationResult:
    """
    Result of classifying a user message.

    This captures the intent, complexity, risk, and supporting evidence
    for the classification decision.
    """
    # Primary classifications
    intent: IntentCategory = IntentCategory.UNKNOWN
    complexity: ComplexityLevel = ComplexityLevel.LOW
    risk: RiskLevel = RiskLevel.LOW

    # Confidence scores (0.0-1.0)
    intent_confidence: float = 0.0
    complexity_confidence: float = 0.0
    risk_confidence: float = 0.0

    # Supporting evidence
    matched_patterns: List[str] = field(default_factory=list)
    detected_keywords: List[str] = field(default_factory=list)
    context_signals: List[str] = field(default_factory=list)

    # Metadata
    message_length: int = 0
    classified_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "intent": self.intent.value,
            "complexity": self.complexity.value,
            "risk": self.risk.value,
            "confidence": {
                "intent": self.intent_confidence,
                "complexity": self.complexity_confidence,
                "risk": self.risk_confidence,
            },
            "evidence": {
                "matched_patterns": self.matched_patterns,
                "detected_keywords": self.detected_keywords,
                "context_signals": self.context_signals,
            },
            "message_length": self.message_length,
            "classified_at": self.classified_at,
        }


# =============================================================================
# MESSAGE CLASSIFIER
# =============================================================================

class MessageClassifier:
    """
    Classifies user messages for model routing.

    This classifier uses deterministic pattern matching and keyword
    analysis to classify messages. It does NOT use LLM inference
    to avoid circular dependencies and ensure predictable costs.

    CLASSIFICATION DIMENSIONS:
    1. Intent - What the user wants
    2. Complexity - How complex the request is
    3. Risk - What the stakes are
    """

    # =========================================================================
    # INTENT PATTERNS (deterministic matching)
    # =========================================================================

    # ECONOMY TIER PATTERNS
    GREETING_PATTERNS = [
        r"^(hi|hello|hey|good\s*(morning|afternoon|evening))[\s!.,]*$",
        r"^(greetings|howdy|yo|sup)[\s!.,]*$",
        r"^(how are you|how's it going)[\s?!.,]*$",
    ]

    CLARIFICATION_PATTERNS = [
        r"what do you mean",
        r"can you clarify",
        r"i don't understand",
        r"could you explain that",
        r"what does .* mean",
        r"^huh[\s?]*$",
        r"^what[\s?]*$",
    ]

    FACTUAL_LOOKUP_PATTERNS = [
        r"what is the (verse|chapter|book)",
        r"where (is|can i find)",
        r"what (time|date|day)",
        r"how many (chapters|verses|books)",
        r"^(who|what|when|where) (is|was|are|were)",
    ]

    ACKNOWLEDGMENT_PATTERNS = [
        r"^(ok|okay|thanks|thank you|got it|understood)[\s!.,]*$",
        r"^(sure|alright|sounds good)[\s!.,]*$",
        r"^(yes|no|maybe)[\s!.,]*$",
    ]

    # STANDARD TIER PATTERNS
    TEACHING_PATTERNS = [
        r"teach me",
        r"can you explain",
        r"help me understand",
        r"what does .* teach",
        r"what is the meaning of",
        r"how should i interpret",
        r"explain .* to me",
    ]

    PASTORAL_PATTERNS = [
        r"i('m| am) (struggling|worried|anxious|afraid|scared)",
        r"i('m| am) going through",
        r"i need (help|guidance|advice)",
        r"how (do|can|should) i (deal|cope|handle)",
        r"(pray|praying) for",
        r"feeling (lost|confused|overwhelmed)",
    ]

    SCRIPTURE_APPLICATION_PATTERNS = [
        r"how (does|can) .* apply to",
        r"what (does|would) .* say about",
        r"biblical (perspective|view|teaching) on",
        r"scripture (for|about|regarding)",
        r"verse(s)? (for|about|regarding)",
    ]

    PRAYER_PATTERNS = [
        r"(pray|prayer) (for|with) me",
        r"can you pray",
        r"i need prayer",
        r"please pray",
    ]

    # PREMIUM TIER PATTERNS
    DOCTRINAL_PATTERNS = [
        r"(doctrine|doctrinal)",
        r"(theology|theological)",
        r"(heresy|heretical)",
        r"(orthodox|orthodoxy)",
        r"(calvini|arminian)",
        r"(trinit|trinity)",
        r"(salvation|soteriology)",
        r"(eschatology|end times|rapture|tribulation)",
        r"(predestination|election)",
        r"(atonement|justification|sanctification)",
    ]

    LEADERSHIP_PATTERNS = [
        r"(church|ministry) (leadership|decision)",
        r"(should|how) (we|i|the church) (handle|address|respond)",
        r"(discipline|disciplin)",
        r"(elder|deacon|pastor) (meeting|decision|role)",
        r"(congregat|member) (conflict|dispute|issue)",
    ]

    CRISIS_PATTERNS = [
        r"(crisis|emergency|urgent)",
        r"(suicide|self.?harm|abuse)",
        r"(divorce|separation|affair)",
        r"(death|dying|funeral|grief)",
        r"(addiction|substance|alcohol|drug)",
    ]

    ETHICAL_PATTERNS = [
        r"(ethic|moral) (dilemma|question)",
        r"(right|wrong) (to|thing)",
        r"(sin|sinful|sinning)",
        r"is it (okay|ok|acceptable|permissible)",
        r"(conscience|conviction)",
    ]

    SENSITIVE_PATTERNS = [
        r"(homosexual|lgbt|same.?sex)",
        r"(abort|euthanasia)",
        r"(gender|transgender)",
        r"(politic|election|government)",
        r"(denominat|other church)",
        r"(false (teacher|prophet|teaching))",
    ]

    # =========================================================================
    # COMPLEXITY INDICATORS
    # =========================================================================

    COMPLEXITY_INDICATORS = {
        ComplexityLevel.LOW: [
            # Short, simple questions
            "simple", "quick", "basic", "brief",
        ],
        ComplexityLevel.MEDIUM: [
            # Requires explanation
            "explain", "describe", "help me understand",
            "what is the difference", "compare",
        ],
        ComplexityLevel.HIGH: [
            # Multiple parts, nuance required
            "in depth", "detailed", "comprehensive",
            "multiple", "several", "all the",
        ],
        ComplexityLevel.VERY_HIGH: [
            # Requires deep reasoning
            "systematic", "thorough analysis",
            "historical context", "original language",
            "scholarly", "exegesis", "hermeneutic",
        ],
    }

    # =========================================================================
    # RISK INDICATORS
    # =========================================================================

    RISK_INDICATORS = {
        RiskLevel.LOW: [
            # General information
            "curious", "wondering", "just asking",
        ],
        RiskLevel.MEDIUM: [
            # Personal application
            "should i", "advice", "guidance",
            "decision", "choice",
        ],
        RiskLevel.HIGH: [
            # Life decisions, spiritual health
            "life", "marriage", "divorce", "career",
            "calling", "vocation", "ministry",
        ],
        RiskLevel.CRITICAL: [
            # Crisis, safety, doctrine
            "crisis", "emergency", "urgent",
            "suicide", "harm", "abuse",
            "heresy", "false teaching",
        ],
    }

    def __init__(self):
        """Initialize the classifier."""
        # Compile patterns for efficiency
        self._compiled_patterns = {}
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for efficient matching."""
        pattern_groups = {
            "greeting": self.GREETING_PATTERNS,
            "clarification": self.CLARIFICATION_PATTERNS,
            "factual_lookup": self.FACTUAL_LOOKUP_PATTERNS,
            "acknowledgment": self.ACKNOWLEDGMENT_PATTERNS,
            "teaching": self.TEACHING_PATTERNS,
            "pastoral": self.PASTORAL_PATTERNS,
            "scripture_application": self.SCRIPTURE_APPLICATION_PATTERNS,
            "prayer": self.PRAYER_PATTERNS,
            "doctrinal": self.DOCTRINAL_PATTERNS,
            "leadership": self.LEADERSHIP_PATTERNS,
            "crisis": self.CRISIS_PATTERNS,
            "ethical": self.ETHICAL_PATTERNS,
            "sensitive": self.SENSITIVE_PATTERNS,
        }

        for name, patterns in pattern_groups.items():
            self._compiled_patterns[name] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

    def classify(
        self,
        message: str,
        context: Dict[str, Any] = None,
    ) -> ClassificationResult:
        """
        Classify a user message for routing.

        This is the main entry point for classification. It evaluates
        the message across all three dimensions and returns a complete
        ClassificationResult.

        Args:
            message: The user's message text
            context: Optional context (conversation history, persona, etc.)

        Returns:
            ClassificationResult with intent, complexity, and risk
        """
        context = context or {}
        result = ClassificationResult(message_length=len(message))

        # Normalize message for matching
        message_lower = message.lower().strip()

        # Step 1: Classify intent
        intent, intent_conf, matched = self._classify_intent(message_lower)
        result.intent = intent
        result.intent_confidence = intent_conf
        result.matched_patterns = matched

        # Step 2: Classify complexity
        complexity, complexity_conf, keywords = self._classify_complexity(
            message_lower
        )
        result.complexity = complexity
        result.complexity_confidence = complexity_conf
        result.detected_keywords.extend(keywords)

        # Step 3: Classify risk
        risk, risk_conf, signals = self._classify_risk(message_lower, intent)
        result.risk = risk
        result.risk_confidence = risk_conf
        result.context_signals = signals

        # Step 4: Apply context adjustments
        self._apply_context_adjustments(result, context)

        logger.info(
            f"Classified message: intent={result.intent.value}, "
            f"complexity={result.complexity.value}, risk={result.risk.value}"
        )

        return result

    def _classify_intent(
        self,
        message: str,
    ) -> Tuple[IntentCategory, float, List[str]]:
        """Classify the user's intent."""
        matched_patterns = []

        # Check each pattern group in order of specificity (most specific first)

        # PREMIUM TIER (most specific)
        if self._match_patterns("crisis", message):
            matched_patterns.append("crisis")
            return IntentCategory.CRISIS_GUIDANCE, 0.95, matched_patterns

        if self._match_patterns("sensitive", message):
            matched_patterns.append("sensitive")
            return IntentCategory.SENSITIVE_MATTER, 0.90, matched_patterns

        if self._match_patterns("doctrinal", message):
            matched_patterns.append("doctrinal")
            return IntentCategory.DOCTRINAL_QUESTION, 0.90, matched_patterns

        if self._match_patterns("leadership", message):
            matched_patterns.append("leadership")
            return IntentCategory.LEADERSHIP_DECISION, 0.85, matched_patterns

        if self._match_patterns("ethical", message):
            matched_patterns.append("ethical")
            return IntentCategory.ETHICAL_DILEMMA, 0.85, matched_patterns

        # STANDARD TIER
        if self._match_patterns("pastoral", message):
            matched_patterns.append("pastoral")
            return IntentCategory.PASTORAL_GUIDANCE, 0.85, matched_patterns

        if self._match_patterns("prayer", message):
            matched_patterns.append("prayer")
            return IntentCategory.PRAYER_REQUEST, 0.90, matched_patterns

        if self._match_patterns("teaching", message):
            matched_patterns.append("teaching")
            return IntentCategory.TEACHING_REQUEST, 0.80, matched_patterns

        if self._match_patterns("scripture_application", message):
            matched_patterns.append("scripture_application")
            return IntentCategory.SCRIPTURE_APPLICATION, 0.80, matched_patterns

        # ECONOMY TIER (least specific)
        if self._match_patterns("greeting", message):
            matched_patterns.append("greeting")
            return IntentCategory.GREETING, 0.95, matched_patterns

        if self._match_patterns("acknowledgment", message):
            matched_patterns.append("acknowledgment")
            return IntentCategory.ACKNOWLEDGMENT, 0.95, matched_patterns

        if self._match_patterns("clarification", message):
            matched_patterns.append("clarification")
            return IntentCategory.CLARIFICATION, 0.85, matched_patterns

        if self._match_patterns("factual_lookup", message):
            matched_patterns.append("factual_lookup")
            return IntentCategory.FACTUAL_LOOKUP, 0.80, matched_patterns

        # Default based on message characteristics
        if len(message) < 20:
            return IntentCategory.SIMPLE_QUESTION, 0.60, matched_patterns

        # Unknown - default to standard tier for safety
        return IntentCategory.UNKNOWN, 0.50, matched_patterns

    def _match_patterns(self, group: str, message: str) -> bool:
        """Check if message matches any patterns in a group."""
        if group not in self._compiled_patterns:
            return False

        for pattern in self._compiled_patterns[group]:
            if pattern.search(message):
                return True
        return False

    def _classify_complexity(
        self,
        message: str,
    ) -> Tuple[ComplexityLevel, float, List[str]]:
        """Classify the complexity of the request."""
        detected_keywords = []
        scores = {level: 0 for level in ComplexityLevel}

        # Check for complexity indicators
        for level, keywords in self.COMPLEXITY_INDICATORS.items():
            for keyword in keywords:
                if keyword.lower() in message:
                    scores[level] += 1
                    detected_keywords.append(keyword)

        # Length-based complexity
        if len(message) > 500:
            scores[ComplexityLevel.HIGH] += 2
        elif len(message) > 200:
            scores[ComplexityLevel.MEDIUM] += 1
        elif len(message) < 50:
            scores[ComplexityLevel.LOW] += 1

        # Question marks indicate multiple questions
        question_count = message.count("?")
        if question_count > 2:
            scores[ComplexityLevel.HIGH] += 1
        elif question_count > 1:
            scores[ComplexityLevel.MEDIUM] += 1

        # Find highest scoring level
        max_score = max(scores.values())
        if max_score == 0:
            return ComplexityLevel.LOW, 0.60, detected_keywords

        best_level = max(scores, key=scores.get)
        confidence = min(0.95, 0.60 + (max_score * 0.1))

        return best_level, confidence, detected_keywords

    def _classify_risk(
        self,
        message: str,
        intent: IntentCategory,
    ) -> Tuple[RiskLevel, float, List[str]]:
        """Classify the risk level of the request."""
        signals = []
        scores = {level: 0 for level in RiskLevel}

        # Check for risk indicators
        for level, keywords in self.RISK_INDICATORS.items():
            for keyword in keywords:
                if keyword.lower() in message:
                    scores[level] += 1
                    signals.append(f"keyword:{keyword}")

        # Intent-based risk adjustment
        intent_risk_map = {
            IntentCategory.GREETING: RiskLevel.LOW,
            IntentCategory.ACKNOWLEDGMENT: RiskLevel.LOW,
            IntentCategory.CLARIFICATION: RiskLevel.LOW,
            IntentCategory.FACTUAL_LOOKUP: RiskLevel.LOW,
            IntentCategory.SIMPLE_QUESTION: RiskLevel.LOW,
            IntentCategory.TEACHING_REQUEST: RiskLevel.MEDIUM,
            IntentCategory.EXPLANATION: RiskLevel.MEDIUM,
            IntentCategory.PASTORAL_GUIDANCE: RiskLevel.MEDIUM,
            IntentCategory.SCRIPTURE_APPLICATION: RiskLevel.MEDIUM,
            IntentCategory.PRAYER_REQUEST: RiskLevel.MEDIUM,
            IntentCategory.DOCTRINAL_QUESTION: RiskLevel.HIGH,
            IntentCategory.THEOLOGICAL_DEBATE: RiskLevel.HIGH,
            IntentCategory.ETHICAL_DILEMMA: RiskLevel.HIGH,
            IntentCategory.LEADERSHIP_DECISION: RiskLevel.HIGH,
            IntentCategory.CRISIS_GUIDANCE: RiskLevel.CRITICAL,
            IntentCategory.SENSITIVE_MATTER: RiskLevel.CRITICAL,
        }

        intent_risk = intent_risk_map.get(intent, RiskLevel.MEDIUM)
        scores[intent_risk] += 2
        signals.append(f"intent:{intent.value}")

        # Find highest scoring level
        max_score = max(scores.values())
        if max_score == 0:
            return RiskLevel.LOW, 0.60, signals

        best_level = max(scores, key=scores.get)
        confidence = min(0.95, 0.60 + (max_score * 0.1))

        return best_level, confidence, signals

    def _apply_context_adjustments(
        self,
        result: ClassificationResult,
        context: Dict[str, Any],
    ):
        """Apply context-based adjustments to classification."""
        # Persona-specific adjustments
        persona = context.get("persona_name", "").lower()

        # If talking to a pastoral persona, increase pastoral intent likelihood
        if persona in ["jubilee", "shepherd", "pastor"]:
            if result.intent == IntentCategory.UNKNOWN:
                result.intent = IntentCategory.PASTORAL_GUIDANCE
                result.context_signals.append("persona_pastoral")

        # Conversation history adjustments
        if context.get("previous_crisis"):
            # If previous message was crisis, maintain higher risk
            if result.risk == RiskLevel.LOW:
                result.risk = RiskLevel.MEDIUM
                result.context_signals.append("previous_crisis")

        # User-specific adjustments
        if context.get("user_is_leader"):
            # Leaders may need higher tier for decisions
            if result.intent == IntentCategory.SIMPLE_QUESTION:
                result.intent = IntentCategory.LEADERSHIP_DECISION
                result.context_signals.append("user_is_leader")
