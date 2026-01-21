# =============================================================================
# MODEL TIER DEFINITIONS
# =============================================================================
"""
Defines the model tiers and their configurations for the routing system.

This module establishes the three-tier model hierarchy:
1. ECONOMY (gpt-4o-mini) - Lowest cost, sufficient for routine tasks
2. STANDARD (gpt-4o-turbo) - Balanced cost/capability for moderate complexity
3. PREMIUM (gpt-4o) - Highest capability for critical decisions

Each tier has associated cost multipliers and capability characteristics
to enable informed routing decisions.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class ModelTier(Enum):
    """
    Model tiers for routing decisions.

    ECONOMY: Lowest cost, suitable for routine interactions
    STANDARD: Balanced cost/capability for teaching and pastoral work
    PREMIUM: Maximum capability for doctrinal and high-stakes decisions
    """
    ECONOMY = "economy"
    STANDARD = "standard"
    PREMIUM = "premium"

    @classmethod
    def from_string(cls, value: str) -> "ModelTier":
        """Convert string to ModelTier."""
        value_lower = value.lower()
        for tier in cls:
            if tier.value == value_lower:
                return tier
        raise ValueError(f"Unknown model tier: {value}")


@dataclass
class ModelConfig:
    """
    Configuration for a specific model.

    Attributes:
        tier: The model tier (economy, standard, premium)
        model_id: The actual model identifier (e.g., "gpt-4o-mini")
        display_name: Human-readable name
        cost_multiplier: Relative cost compared to economy tier (1.0 = baseline)
        max_tokens: Maximum output tokens for this model
        context_window: Maximum context window size
        capabilities: List of capability tags
        description: Human-readable description
    """
    tier: ModelTier
    model_id: str
    display_name: str
    cost_multiplier: float
    max_tokens: int
    context_window: int
    capabilities: list
    description: str

    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "tier": self.tier.value,
            "model_id": self.model_id,
            "display_name": self.display_name,
            "cost_multiplier": self.cost_multiplier,
            "max_tokens": self.max_tokens,
            "context_window": self.context_window,
            "capabilities": self.capabilities,
            "description": self.description,
        }


# =============================================================================
# MODEL CONFIGURATIONS
# =============================================================================

MODEL_CONFIGS: Dict[ModelTier, ModelConfig] = {
    ModelTier.ECONOMY: ModelConfig(
        tier=ModelTier.ECONOMY,
        model_id="gpt-4o-mini",
        display_name="GPT-4o Mini",
        cost_multiplier=1.0,  # Baseline
        max_tokens=4096,
        context_window=128000,
        capabilities=[
            "factual_lookup",
            "clarification",
            "routine_response",
            "simple_formatting",
            "basic_qa",
        ],
        description=(
            "Economy tier for routine interactions, factual lookups, "
            "clarifications, and low-risk queries. Optimized for cost efficiency."
        ),
    ),

    ModelTier.STANDARD: ModelConfig(
        tier=ModelTier.STANDARD,
        model_id="gpt-4o-turbo",
        display_name="GPT-4o Turbo",
        cost_multiplier=3.0,  # 3x economy cost
        max_tokens=4096,
        context_window=128000,
        capabilities=[
            "teaching",
            "pastoral_guidance",
            "explanation",
            "moderate_complexity",
            "contextual_reasoning",
            "scripture_application",
        ],
        description=(
            "Standard tier for teaching-oriented, pastoral, explanatory, "
            "or moderately complex requests. Balances depth and efficiency."
        ),
    ),

    ModelTier.PREMIUM: ModelConfig(
        tier=ModelTier.PREMIUM,
        model_id="gpt-4o",
        display_name="GPT-4o",
        cost_multiplier=6.0,  # 6x economy cost
        max_tokens=4096,
        context_window=128000,
        capabilities=[
            "deep_doctrinal",
            "theological_reasoning",
            "leadership_guidance",
            "strategic_decision",
            "high_stakes",
            "sensitive_matters",
            "complex_ethics",
            "nuanced_interpretation",
        ],
        description=(
            "Premium tier for deep doctrinal questions, high-stakes leadership "
            "guidance, strategic decisions, or theologically sensitive matters. "
            "Maximum reasoning quality and faithfulness."
        ),
    ),
}


def get_model_for_tier(tier: ModelTier) -> ModelConfig:
    """
    Get the model configuration for a specific tier.

    Args:
        tier: The model tier

    Returns:
        ModelConfig for the specified tier

    Raises:
        ValueError: If tier is not recognized
    """
    if tier not in MODEL_CONFIGS:
        raise ValueError(f"Unknown model tier: {tier}")
    return MODEL_CONFIGS[tier]


def get_model_id_for_tier(tier: ModelTier) -> str:
    """
    Get the model ID for a specific tier.

    Args:
        tier: The model tier

    Returns:
        The model ID string (e.g., "gpt-4o-mini")
    """
    return get_model_for_tier(tier).model_id


def get_default_model() -> ModelConfig:
    """
    Get the default model (economy tier).

    Returns:
        ModelConfig for the economy tier
    """
    return MODEL_CONFIGS[ModelTier.ECONOMY]


def estimate_cost_ratio(from_tier: ModelTier, to_tier: ModelTier) -> float:
    """
    Estimate the cost ratio between two tiers.

    Args:
        from_tier: Source tier
        to_tier: Target tier

    Returns:
        Cost multiplier (e.g., 3.0 means 3x the cost)
    """
    from_config = get_model_for_tier(from_tier)
    to_config = get_model_for_tier(to_tier)
    return to_config.cost_multiplier / from_config.cost_multiplier


# =============================================================================
# TIER ORDERING
# =============================================================================

TIER_ORDER = [ModelTier.ECONOMY, ModelTier.STANDARD, ModelTier.PREMIUM]


def is_tier_sufficient(available: ModelTier, required: ModelTier) -> bool:
    """
    Check if an available tier is sufficient for a required tier.

    Args:
        available: The tier that is available
        required: The tier that is required

    Returns:
        True if available >= required in capability
    """
    available_idx = TIER_ORDER.index(available)
    required_idx = TIER_ORDER.index(required)
    return available_idx >= required_idx


def get_minimum_tier(*tiers: ModelTier) -> ModelTier:
    """
    Get the minimum (lowest) tier from a list.

    Args:
        *tiers: Variable number of tiers

    Returns:
        The minimum tier
    """
    if not tiers:
        return ModelTier.ECONOMY
    return min(tiers, key=lambda t: TIER_ORDER.index(t))


def get_maximum_tier(*tiers: ModelTier) -> ModelTier:
    """
    Get the maximum (highest) tier from a list.

    Args:
        *tiers: Variable number of tiers

    Returns:
        The maximum tier
    """
    if not tiers:
        return ModelTier.ECONOMY
    return max(tiers, key=lambda t: TIER_ORDER.index(t))
