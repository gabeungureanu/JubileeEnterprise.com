# =============================================================================
# INSPIRE 8.0 PERSONA ACTIVATION LAYER
# =============================================================================
"""
Persona Activation (Ignition) Layer for Inspire 8.0.

This module provides deterministic persona activation by:
1. Retrieving activation anchors (Identity, Mission, Voice, Guardrails) from Qdrant
2. Retrieving shared canon anchors for doctrinal alignment
3. Optionally retrieving bounded contextual grounding for situational awareness
4. Assembling them into a structured activation packet
5. Enforcing strict read-only behavior (NO WRITES during activation)

CRITICAL INVARIANTS:
- Activation anchors are IMMUTABLE at runtime
- Activation scripts NEVER write to Qdrant
- Memory writing occurs ONLY in designated writeback phase
- Persona identity remains stable and reproducible
- Contextual grounding is bounded (max items, max tokens)
"""

from .anchors import (
    ActivationAnchor,
    IdentityAnchor,
    MissionAnchor,
    VoiceAnchor,
    GuardrailAnchor,
    AnchorType,
    PersonaAnchors,
)
from .retriever import (
    AnchorRetriever,
    RetrievalResult,
)
from .assembler import (
    ActivationContext,
    ActivationPacket,
    ContextAssembler,
    ContextCache,
)
from .shared_canon import (
    SharedCanonAnchor,
    SharedCanonResult,
    SharedCanonRetriever,
    GroundingItem,
    GroundingResult,
    ContextualGroundingRetriever,
)
from .policy import (
    MemoryPolicy,
    ExecutionPhase,
    WriteAttemptError,
    ActivationPhase,
    WritebackPhase,
    get_memory_policy,
)
from .activation_log import (
    AnchorLogEntry,
    ActivationLogEntry,
    ActivationLogger,
    get_activation_logger,
    sort_anchors_deterministically,
    get_deterministic_sort_key,
    PRIORITY_ORDER,
    SECTION_ORDER,
)

__all__ = [
    # Anchor types
    'ActivationAnchor',
    'IdentityAnchor',
    'MissionAnchor',
    'VoiceAnchor',
    'GuardrailAnchor',
    'AnchorType',
    'PersonaAnchors',
    # Retrieval
    'AnchorRetriever',
    'RetrievalResult',
    # Shared canon
    'SharedCanonAnchor',
    'SharedCanonResult',
    'SharedCanonRetriever',
    # Contextual grounding
    'GroundingItem',
    'GroundingResult',
    'ContextualGroundingRetriever',
    # Context assembly
    'ActivationContext',
    'ActivationPacket',
    'ContextAssembler',
    'ContextCache',
    # Memory policy
    'MemoryPolicy',
    'ExecutionPhase',
    'WriteAttemptError',
    'ActivationPhase',
    'WritebackPhase',
    'get_memory_policy',
    # Activation logging
    'AnchorLogEntry',
    'ActivationLogEntry',
    'ActivationLogger',
    'get_activation_logger',
    'sort_anchors_deterministically',
    'get_deterministic_sort_key',
    'PRIORITY_ORDER',
    'SECTION_ORDER',
]

__version__ = '1.2.0'
