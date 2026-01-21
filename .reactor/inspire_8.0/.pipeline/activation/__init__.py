# =============================================================================
# INSPIRE 8.0 PERSONA ACTIVATION LAYER
# =============================================================================
"""
Persona Activation (Ignition) Layer for Inspire 8.0.

This module provides deterministic persona activation by:
1. Retrieving activation anchors (Identity, Mission, Voice, Guardrails) from Qdrant
2. Assembling them into an activation context
3. Enforcing strict read-only behavior (NO WRITES during activation)

CRITICAL INVARIANTS:
- Activation anchors are IMMUTABLE at runtime
- Activation scripts NEVER write to Qdrant
- Memory writing occurs ONLY in designated writeback phase
- Persona identity remains stable and reproducible
"""

from .anchors import (
    ActivationAnchor,
    IdentityAnchor,
    MissionAnchor,
    VoiceAnchor,
    GuardrailAnchor,
    AnchorType,
)
from .retriever import (
    AnchorRetriever,
    RetrievalResult,
)
from .assembler import (
    ActivationContext,
    ContextAssembler,
)
from .policy import (
    MemoryPolicy,
    ExecutionPhase,
    WriteAttemptError,
)

__all__ = [
    # Anchor types
    'ActivationAnchor',
    'IdentityAnchor',
    'MissionAnchor',
    'VoiceAnchor',
    'GuardrailAnchor',
    'AnchorType',
    # Retrieval
    'AnchorRetriever',
    'RetrievalResult',
    # Context assembly
    'ActivationContext',
    'ContextAssembler',
    # Memory policy
    'MemoryPolicy',
    'ExecutionPhase',
    'WriteAttemptError',
]

__version__ = '1.0.0'
