# =============================================================================
# ACTIVATION ANCHOR DATA CLASSES
# =============================================================================
"""
Defines the four activation anchor types as distinct data classes.

Activation anchors are:
- IMMUTABLE at runtime
- Retrieved ONLY at activation time
- NEVER written during normal execution
- Tagged with type=activation_anchor in Qdrant

Anchor Types:
1. Identity - Core identity, spiritual/psychological profile, authority
2. Mission - Calling, purpose, goals, ministry focus
3. Voice - Tone, cadence, vocabulary, communication style
4. Guardrails - Hard stops, boundaries, doctrinal constraints
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class AnchorType(Enum):
    """Enumeration of activation anchor types."""
    IDENTITY = "identity_anchor"
    MISSION = "mission_anchor"
    VOICE = "voice_anchor"
    GUARDRAIL = "guardrail_anchor"


@dataclass(frozen=True)
class ActivationAnchor:
    """
    Base class for all activation anchors.

    Anchors are frozen (immutable) to enforce the invariant that
    activation data cannot be modified at runtime.

    Attributes:
        anchor_type: Type of anchor (identity, mission, voice, guardrail)
        persona: Persona this anchor belongs to (e.g., "jubilee.inspire")
        section: Section within the anchor (e.g., "core_identity")
        content: The actual anchor content
        doc_version: Version identifier for traceability
        source: Source file path
        priority: Priority level (core, high, normal, low)
        point_id: Qdrant point ID
        content_hash: SHA-256 hash of content
    """
    anchor_type: AnchorType
    persona: str
    section: str
    content: str
    doc_version: str
    source: str
    priority: str = "core"
    point_id: Optional[str] = None
    content_hash: Optional[str] = None

    def __post_init__(self):
        """Validate anchor invariants."""
        if not self.content:
            raise ValueError(f"Anchor content cannot be empty: {self.section}")
        if not self.persona:
            raise ValueError("Anchor must have a persona")

    @property
    def is_immutable(self) -> bool:
        """Anchors are always immutable at runtime."""
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert anchor to dictionary (for serialization)."""
        return {
            "anchor_type": self.anchor_type.value,
            "persona": self.persona,
            "section": self.section,
            "content": self.content,
            "doc_version": self.doc_version,
            "source": self.source,
            "priority": self.priority,
            "point_id": self.point_id,
            "content_hash": self.content_hash,
            "immutable": True,
        }


@dataclass(frozen=True)
class IdentityAnchor(ActivationAnchor):
    """
    Identity anchor containing core persona identity.

    Sections include:
    - core_identity: Name, role, family position
    - spiritual_identity: Faith, beliefs, spiritual gifts
    - psychological_identity: Personality, traits, temperament
    - cultural_identity: Cultural background, heritage
    - temporal_identity: Age presentation, generational context
    - relational_identity: Family relationships, bonds
    - visual_identity: Avatar, visual representation
    - audience: Target audience, ministry focus
    - authority: Decision-making authority, scope
    """
    # Identity-specific metadata
    persona_full_name: Optional[str] = None
    persona_role: Optional[str] = None
    birth_order: Optional[int] = None

    def __post_init__(self):
        # Validate parent first
        super().__post_init__()
        # Override anchor_type for identity
        object.__setattr__(self, 'anchor_type', AnchorType.IDENTITY)


@dataclass(frozen=True)
class MissionAnchor(ActivationAnchor):
    """
    Mission anchor containing persona's calling and purpose.

    Sections include:
    - calling: Divine calling and vocation
    - purpose: Core purpose statement
    - ministry_focus: Primary ministry areas
    - goals: Short and long-term objectives
    - success_criteria: How success is measured
    - impact_areas: Areas of intended impact
    """
    # Mission-specific metadata
    ministry_domains: Optional[List[str]] = None

    def __post_init__(self):
        super().__post_init__()
        object.__setattr__(self, 'anchor_type', AnchorType.MISSION)


@dataclass(frozen=True)
class VoiceAnchor(ActivationAnchor):
    """
    Voice anchor containing communication style and tone.

    Sections include:
    - tone: Overall tone (warm, authoritative, gentle, etc.)
    - cadence: Speech rhythm and pacing
    - vocabulary: Word choice, terminology preferences
    - speech_patterns: Characteristic phrases, expressions
    - emotional_range: Emotional expression boundaries
    - communication_style: Formal/informal, direct/indirect
    """
    # Voice-specific metadata
    primary_tone: Optional[str] = None
    language_level: Optional[str] = None

    def __post_init__(self):
        super().__post_init__()
        object.__setattr__(self, 'anchor_type', AnchorType.VOICE)


@dataclass(frozen=True)
class GuardrailAnchor(ActivationAnchor):
    """
    Guardrail anchor containing boundaries and constraints.

    Sections include:
    - hard_stops: Absolute prohibitions (never cross)
    - soft_boundaries: Caution areas (approach carefully)
    - doctrinal_constraints: Theological boundaries
    - ethical_boundaries: Moral and ethical limits
    - forbidden_topics: Topics to avoid entirely
    """
    # Guardrail-specific metadata
    severity: Optional[str] = None  # critical, high, moderate

    def __post_init__(self):
        super().__post_init__()
        object.__setattr__(self, 'anchor_type', AnchorType.GUARDRAIL)


@dataclass
class PersonaAnchors:
    """
    Complete set of activation anchors for a persona.

    This is the assembled result of retrieving all four anchor types
    for a specific persona. Used to initialize persona state.
    """
    persona_name: str
    identity: List[IdentityAnchor] = field(default_factory=list)
    mission: List[MissionAnchor] = field(default_factory=list)
    voice: List[VoiceAnchor] = field(default_factory=list)
    guardrails: List[GuardrailAnchor] = field(default_factory=list)
    retrieved_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def is_complete(self) -> bool:
        """Check if all required anchor types are present."""
        return bool(
            self.identity and
            self.mission and
            self.voice and
            self.guardrails
        )

    @property
    def total_anchors(self) -> int:
        """Total number of anchors across all types."""
        return (
            len(self.identity) +
            len(self.mission) +
            len(self.voice) +
            len(self.guardrails)
        )

    def get_all_anchors(self) -> List[ActivationAnchor]:
        """Get all anchors as a flat list."""
        return self.identity + self.mission + self.voice + self.guardrails

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "persona_name": self.persona_name,
            "identity": [a.to_dict() for a in self.identity],
            "mission": [a.to_dict() for a in self.mission],
            "voice": [a.to_dict() for a in self.voice],
            "guardrails": [a.to_dict() for a in self.guardrails],
            "retrieved_at": self.retrieved_at,
            "is_complete": self.is_complete,
            "total_anchors": self.total_anchors,
        }


def create_anchor_from_payload(payload: Dict[str, Any]) -> ActivationAnchor:
    """
    Factory function to create appropriate anchor type from Qdrant payload.

    Args:
        payload: Qdrant point payload containing anchor data

    Returns:
        Appropriate ActivationAnchor subclass instance

    Raises:
        ValueError: If anchor type is unknown or invalid
    """
    anchor_type_str = payload.get('type', '')

    # Common fields
    common = {
        'persona': payload.get('persona', ''),
        'section': payload.get('anchor_section', 'main'),
        'content': payload.get('text', ''),
        'doc_version': payload.get('doc_version', 'unknown'),
        'source': payload.get('source', ''),
        'priority': payload.get('priority', 'core'),
        'point_id': payload.get('point_id'),
        'content_hash': payload.get('content_hash'),
    }

    if anchor_type_str == AnchorType.IDENTITY.value:
        return IdentityAnchor(
            anchor_type=AnchorType.IDENTITY,
            persona_full_name=payload.get('persona_full_name'),
            persona_role=payload.get('persona_role'),
            birth_order=payload.get('birth_order'),
            **common
        )
    elif anchor_type_str == AnchorType.MISSION.value:
        return MissionAnchor(
            anchor_type=AnchorType.MISSION,
            ministry_domains=payload.get('ministry_domains'),
            **common
        )
    elif anchor_type_str == AnchorType.VOICE.value:
        return VoiceAnchor(
            anchor_type=AnchorType.VOICE,
            primary_tone=payload.get('primary_tone'),
            language_level=payload.get('language_level'),
            **common
        )
    elif anchor_type_str == AnchorType.GUARDRAIL.value:
        return GuardrailAnchor(
            anchor_type=AnchorType.GUARDRAIL,
            severity=payload.get('severity'),
            **common
        )
    else:
        raise ValueError(f"Unknown anchor type: {anchor_type_str}")
