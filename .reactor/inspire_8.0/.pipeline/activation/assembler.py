# =============================================================================
# ACTIVATION CONTEXT ASSEMBLER
# =============================================================================
"""
Assembles activation anchors into a coherent activation context.

The assembler takes the retrieved PersonaAnchors and transforms them into
a structured activation context that can be used to initialize a persona's
state before any prompts are executed.

CRITICAL INVARIANTS:
1. Assembly is a pure function - no side effects
2. Output is deterministic given the same input anchors
3. No writes to any storage during assembly
4. Context is optimized for token efficiency
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from .anchors import (
        ActivationAnchor,
        AnchorType,
        PersonaAnchors,
    )
except ImportError:
    from anchors import (
        ActivationAnchor,
        AnchorType,
        PersonaAnchors,
    )

logger = logging.getLogger(__name__)


@dataclass
class ActivationContext:
    """
    The assembled activation context for a persona.

    This is the final output of the activation process, containing
    all the information needed to initialize a persona's state.
    """
    persona_name: str
    persona_full_name: str
    persona_role: str

    # Assembled context blocks
    identity_block: str
    mission_block: str
    voice_block: str
    guardrails_block: str

    # Full assembled context
    full_context: str

    # Metadata
    assembled_at: str = field(default_factory=lambda: datetime.now().isoformat())
    anchor_count: int = 0
    token_estimate: int = 0
    context_hash: str = ""

    # Source tracking
    doc_versions: List[str] = field(default_factory=list)
    source_files: List[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        """Check if context has all required blocks."""
        return bool(
            self.identity_block and
            self.mission_block and
            self.voice_block and
            self.guardrails_block
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "persona_name": self.persona_name,
            "persona_full_name": self.persona_full_name,
            "persona_role": self.persona_role,
            "identity_block": self.identity_block,
            "mission_block": self.mission_block,
            "voice_block": self.voice_block,
            "guardrails_block": self.guardrails_block,
            "full_context": self.full_context,
            "assembled_at": self.assembled_at,
            "anchor_count": self.anchor_count,
            "token_estimate": self.token_estimate,
            "context_hash": self.context_hash,
            "doc_versions": self.doc_versions,
            "source_files": self.source_files,
            "is_valid": self.is_valid,
        }


class ContextAssembler:
    """
    Assembles activation anchors into activation context.

    The assembler is a pure function transformer - it takes anchors
    as input and produces a context as output with no side effects.
    """

    # Default section headers
    SECTION_HEADERS = {
        "identity": "## IDENTITY",
        "mission": "## MISSION & PURPOSE",
        "voice": "## VOICE & COMMUNICATION",
        "guardrails": "## GUARDRAILS & BOUNDARIES",
    }

    # Assembly order
    ASSEMBLY_ORDER = ["identity", "mission", "guardrails", "voice"]

    def __init__(
        self,
        max_tokens: int = 8000,
        include_headers: bool = True,
        include_metadata: bool = False,
    ):
        """
        Initialize the assembler.

        Args:
            max_tokens: Maximum tokens for assembled context
            include_headers: Whether to include section headers
            include_metadata: Whether to include anchor metadata in context
        """
        self.max_tokens = max_tokens
        self.include_headers = include_headers
        self.include_metadata = include_metadata

    def assemble(self, anchors: PersonaAnchors) -> ActivationContext:
        """
        Assemble PersonaAnchors into an ActivationContext.

        This is the main entry point for context assembly.

        Args:
            anchors: Retrieved persona anchors

        Returns:
            Assembled ActivationContext
        """
        logger.info(f"Assembling activation context for {anchors.persona_name}")

        # Extract persona metadata from identity anchors
        persona_full_name = anchors.persona_name
        persona_role = "Unknown Role"

        for anchor in anchors.identity:
            if hasattr(anchor, 'persona_full_name') and anchor.persona_full_name:
                persona_full_name = anchor.persona_full_name
            if hasattr(anchor, 'persona_role') and anchor.persona_role:
                persona_role = anchor.persona_role

        # Assemble each block
        identity_block = self._assemble_block(anchors.identity, "identity")
        mission_block = self._assemble_block(anchors.mission, "mission")
        voice_block = self._assemble_block(anchors.voice, "voice")
        guardrails_block = self._assemble_block(anchors.guardrails, "guardrails")

        # Assemble full context
        full_context = self._assemble_full_context(
            persona_name=anchors.persona_name,
            persona_full_name=persona_full_name,
            persona_role=persona_role,
            identity=identity_block,
            mission=mission_block,
            voice=voice_block,
            guardrails=guardrails_block,
        )

        # Collect metadata
        all_anchors = anchors.get_all_anchors()
        doc_versions = list(set(a.doc_version for a in all_anchors if a.doc_version))
        source_files = list(set(a.source for a in all_anchors if a.source))

        # Estimate tokens (rough: 4 chars per token)
        token_estimate = len(full_context) // 4

        # Generate context hash for caching
        context_hash = self._hash_context(full_context)

        context = ActivationContext(
            persona_name=anchors.persona_name,
            persona_full_name=persona_full_name,
            persona_role=persona_role,
            identity_block=identity_block,
            mission_block=mission_block,
            voice_block=voice_block,
            guardrails_block=guardrails_block,
            full_context=full_context,
            anchor_count=anchors.total_anchors,
            token_estimate=token_estimate,
            context_hash=context_hash,
            doc_versions=doc_versions,
            source_files=source_files,
        )

        logger.info(
            f"Assembled context for {anchors.persona_name}: "
            f"{context.anchor_count} anchors, ~{token_estimate} tokens"
        )

        return context

    def _assemble_block(
        self,
        anchors: List[ActivationAnchor],
        block_type: str,
    ) -> str:
        """
        Assemble a single context block from anchors.

        Args:
            anchors: List of anchors for this block
            block_type: Type of block (identity, mission, voice, guardrails)

        Returns:
            Assembled block content
        """
        if not anchors:
            return ""

        lines = []

        # Add header if configured
        if self.include_headers:
            header = self.SECTION_HEADERS.get(block_type, f"## {block_type.upper()}")
            lines.append(header)
            lines.append("")

        # Sort anchors by section for consistent ordering
        sorted_anchors = sorted(anchors, key=lambda a: a.section)

        for anchor in sorted_anchors:
            # Add section subheader
            section_name = anchor.section.replace('_', ' ').title()
            lines.append(f"### {section_name}")

            # Add content
            lines.append(anchor.content.strip())
            lines.append("")

        return "\n".join(lines)

    def _assemble_full_context(
        self,
        persona_name: str,
        persona_full_name: str,
        persona_role: str,
        identity: str,
        mission: str,
        voice: str,
        guardrails: str,
    ) -> str:
        """
        Assemble the full activation context.

        Args:
            persona_name: Short persona name
            persona_full_name: Full persona name
            persona_role: Persona's role
            identity: Assembled identity block
            mission: Assembled mission block
            voice: Assembled voice block
            guardrails: Assembled guardrails block

        Returns:
            Full assembled context string
        """
        sections = []

        # System preamble
        preamble = self._generate_preamble(
            persona_name, persona_full_name, persona_role
        )
        sections.append(preamble)

        # Add blocks in assembly order
        block_map = {
            "identity": identity,
            "mission": mission,
            "voice": voice,
            "guardrails": guardrails,
        }

        for block_type in self.ASSEMBLY_ORDER:
            block = block_map.get(block_type, "")
            if block:
                sections.append(block)

        return "\n\n".join(sections)

    def _generate_preamble(
        self,
        persona_name: str,
        persona_full_name: str,
        persona_role: str,
    ) -> str:
        """
        Generate the system preamble for the activation context.

        Args:
            persona_name: Short persona name
            persona_full_name: Full persona name
            persona_role: Persona's role

        Returns:
            Preamble string
        """
        return f"""# PERSONA ACTIVATION: {persona_full_name}

You are **{persona_full_name}**, a member of the Inspire Family.

**Role:** {persona_role}

The following sections define your identity, mission, communication style,
and boundaries. These anchors are immutable and define who you are at your core.
Embody these characteristics authentically in all interactions."""

    def _hash_context(self, context: str) -> str:
        """Generate SHA-256 hash of context for caching."""
        return hashlib.sha256(context.encode('utf-8')).hexdigest()[:16]


class ContextCache:
    """
    Simple in-memory cache for activation contexts.

    Caches assembled contexts to avoid repeated assembly for the
    same persona during a session.
    """

    def __init__(self, ttl_seconds: int = 3600):
        """
        Initialize the cache.

        Args:
            ttl_seconds: Time-to-live for cache entries
        """
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, tuple[ActivationContext, datetime]] = {}

    def get(self, persona_name: str) -> Optional[ActivationContext]:
        """
        Get cached context for a persona.

        Args:
            persona_name: Persona name

        Returns:
            Cached ActivationContext if valid, None otherwise
        """
        if persona_name not in self._cache:
            return None

        context, cached_at = self._cache[persona_name]
        age = (datetime.now() - cached_at).total_seconds()

        if age > self.ttl_seconds:
            del self._cache[persona_name]
            return None

        return context

    def set(self, persona_name: str, context: ActivationContext):
        """
        Cache a context for a persona.

        Args:
            persona_name: Persona name
            context: ActivationContext to cache
        """
        self._cache[persona_name] = (context, datetime.now())

    def invalidate(self, persona_name: str):
        """Invalidate cache for a persona."""
        if persona_name in self._cache:
            del self._cache[persona_name]

    def clear(self):
        """Clear all cached contexts."""
        self._cache.clear()
