#!/usr/bin/env python3
# =============================================================================
# PERSONA ACTIVATION SCRIPT
# =============================================================================
"""
Main entry point for persona activation (ignition).

This script retrieves activation anchors from Qdrant, shared canon anchors
for doctrinal alignment, and optional contextual grounding for situational
awareness. It assembles them into a structured activation packet and outputs
the packet for persona initialization.

CRITICAL INVARIANTS:
1. This script is READ-ONLY - it NEVER writes to Qdrant
2. Only retrieves anchors tagged with activation_anchor types
3. Shared canon provides doctrinal/governance alignment
4. Contextual grounding is bounded (max items, max tokens)
5. Output is deterministic for reproducible activation
6. No memory is ever written during activation

Usage:
    python activate_persona.py --persona jubilee [--output json|text|context]

Options:
    --persona      Name of the persona to activate (required)
    --output       Output format: json, text, or context (default: context)
    --validate     Validate anchors only, don't output context
    --no-cache     Disable context caching
    --no-canon     Skip shared canon retrieval
    --no-grounding Skip contextual grounding retrieval
    --quiet        Suppress logging output

Examples:
    python activate_persona.py --persona jubilee
    python activate_persona.py --persona gabriel --output json
    python activate_persona.py --persona melody --validate
    python activate_persona.py --persona jubilee --no-grounding
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))
sys.path.insert(0, str(SCRIPT_DIR.parent / "ingestion"))

from anchors import PersonaAnchors, AnchorType
from retriever import AnchorRetriever, RetrievalResult
from assembler import ContextAssembler, ActivationPacket, ContextCache
from shared_canon import (
    SharedCanonRetriever,
    SharedCanonResult,
    ContextualGroundingRetriever,
    GroundingResult,
)
from policy import (
    MemoryPolicy,
    ExecutionPhase,
    ActivationPhase,
    get_memory_policy,
)

# Alias for backward compatibility
ActivationContext = ActivationPacket


# =============================================================================
# CONFIGURATION
# =============================================================================

# Persona collection mappings
PERSONA_COLLECTIONS = {
    "gabriel": "gabriel",
    "jubilee": "jubilee",
    "melody": "melody",
    "zev": "zev",
    "eliana": "eliana",
    "caleb": "caleb",
    "imani": "imani",
    "amir": "amir",
    "nova": "nova",
    "tahoma": "tahoma",
    "santiago": "santiago",
    "zariah": "zariah",
    "elias": "elias",
}

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)


# =============================================================================
# PERSONA ACTIVATOR
# =============================================================================

class PersonaActivator:
    """
    Handles persona activation by retrieving and assembling anchors.

    This is a READ-ONLY class. It retrieves data but NEVER writes.
    The memory policy enforces this invariant.

    ============================================================
    DO NOT ADD ANY WRITE METHODS TO THIS CLASS.
    The activation layer must remain purely read-only.
    ============================================================
    """

    def __init__(
        self,
        use_cache: bool = True,
        include_canon: bool = True,
        include_grounding: bool = True,
    ):
        """
        Initialize the activator.

        Args:
            use_cache: Whether to use context caching
            include_canon: Whether to retrieve shared canon anchors
            include_grounding: Whether to retrieve contextual grounding
        """
        self.retriever = AnchorRetriever()
        self.canon_retriever = SharedCanonRetriever()
        self.grounding_retriever = ContextualGroundingRetriever()
        self.assembler = ContextAssembler()
        self.policy = get_memory_policy()
        self.cache = ContextCache() if use_cache else None
        self.include_canon = include_canon
        self.include_grounding = include_grounding

    def activate(
        self,
        persona_name: str,
        include_canon: bool = None,
        include_grounding: bool = None,
    ) -> ActivationPacket:
        """
        Activate a persona by retrieving anchors and assembling context.

        This is the main entry point for activation. The resulting packet
        contains:
        - Persona-specific activation anchors (identity, mission, voice, guardrails)
        - Shared canon anchors for doctrinal alignment (if enabled)
        - Contextual grounding for situational awareness (if enabled)

        Args:
            persona_name: Name of the persona to activate
            include_canon: Override for shared canon (None = use instance setting)
            include_grounding: Override for grounding (None = use instance setting)

        Returns:
            Assembled ActivationPacket

        Raises:
            ValueError: If persona is unknown or activation fails
        """
        # Resolve options
        should_include_canon = include_canon if include_canon is not None else self.include_canon
        should_include_grounding = include_grounding if include_grounding is not None else self.include_grounding

        # Validate persona
        if persona_name not in PERSONA_COLLECTIONS:
            raise ValueError(
                f"Unknown persona: {persona_name}. "
                f"Valid personas: {', '.join(PERSONA_COLLECTIONS.keys())}"
            )

        # Check cache first
        if self.cache:
            cached = self.cache.get(persona_name)
            if cached:
                logger.info(f"Using cached context for {persona_name}")
                return cached

        # Enter activation phase (enforces read-only)
        with ActivationPhase(self.policy):
            logger.info(f"Activating persona: {persona_name}")

            # Step 1: Retrieve persona-specific anchors
            collection = PERSONA_COLLECTIONS[persona_name]
            result = self.retriever.retrieve_persona_anchors(
                persona_name=persona_name,
                collection_name=collection,
            )

            if not result.success:
                raise ValueError(
                    f"Failed to retrieve anchors for {persona_name}: "
                    f"{'; '.join(result.errors)}"
                )

            if result.warnings:
                for warning in result.warnings:
                    logger.warning(warning)

            # Step 2: Retrieve shared canon (if enabled)
            shared_canon = None
            if should_include_canon:
                logger.info("Retrieving shared canon anchors...")
                shared_canon = self.canon_retriever.retrieve_shared_canon(
                    include_scripture=True,
                    include_doctrine=True,
                    include_governance=True,
                    include_family=False,  # Not needed at activation
                    max_total_tokens=2000,
                )
                if shared_canon.errors:
                    for error in shared_canon.errors:
                        logger.warning(f"Canon retrieval warning: {error}")

            # Step 3: Retrieve contextual grounding (if enabled)
            grounding = None
            if should_include_grounding:
                logger.info("Retrieving contextual grounding...")
                grounding = self.grounding_retriever.retrieve_grounding(
                    persona_name=persona_name,
                    collection_name=collection,
                    strategy="mixed",
                    max_items=5,
                    max_tokens=1000,
                )
                if grounding.errors:
                    for error in grounding.errors:
                        logger.warning(f"Grounding retrieval warning: {error}")

            # Step 4: Assemble the activation packet
            packet = self.assembler.assemble(
                anchors=result.anchors,
                shared_canon=shared_canon,
                grounding=grounding,
            )

            # Cache the result
            if self.cache:
                self.cache.set(persona_name, packet)

            return packet

    def validate(self, persona_name: str) -> dict:
        """
        Validate that a persona has all required anchors.

        Args:
            persona_name: Name of the persona to validate

        Returns:
            Validation result dictionary
        """
        validation = {
            "persona": persona_name,
            "valid": False,
            "timestamp": datetime.now().isoformat(),
            "anchors": {
                "identity": {"found": 0, "required": True},
                "mission": {"found": 0, "required": True},
                "voice": {"found": 0, "required": True},
                "guardrails": {"found": 0, "required": True},
            },
            "errors": [],
            "warnings": [],
        }

        if persona_name not in PERSONA_COLLECTIONS:
            validation["errors"].append(f"Unknown persona: {persona_name}")
            return validation

        try:
            # Retrieve anchors
            collection = PERSONA_COLLECTIONS[persona_name]
            result = self.retriever.retrieve_persona_anchors(
                persona_name=persona_name,
                collection_name=collection,
            )

            if not result.success:
                validation["errors"].extend(result.errors)
                return validation

            # Count anchors by type
            if result.anchors:
                validation["anchors"]["identity"]["found"] = len(result.anchors.identity)
                validation["anchors"]["mission"]["found"] = len(result.anchors.mission)
                validation["anchors"]["voice"]["found"] = len(result.anchors.voice)
                validation["anchors"]["guardrails"]["found"] = len(result.anchors.guardrails)

            # Check completeness
            validation["valid"] = result.anchors.is_complete if result.anchors else False
            validation["warnings"].extend(result.warnings)

            # Add specific errors for missing anchors
            if result.anchors and not result.anchors.is_complete:
                for anchor_type, info in validation["anchors"].items():
                    if info["required"] and info["found"] == 0:
                        validation["errors"].append(
                            f"Missing required anchor type: {anchor_type}"
                        )

        except Exception as e:
            validation["errors"].append(str(e))

        return validation

    def cleanup(self):
        """Cleanup resources."""
        self.retriever.disconnect()
        self.canon_retriever.disconnect()
        self.grounding_retriever.disconnect()
        if self.cache:
            self.cache.clear()


# =============================================================================
# OUTPUT FORMATTERS
# =============================================================================

def output_json(context: ActivationContext) -> str:
    """Output context as JSON."""
    return json.dumps(context.to_dict(), indent=2)


def output_text(packet: ActivationPacket) -> str:
    """Output packet as formatted text."""
    lines = [
        "=" * 70,
        f"  PERSONA ACTIVATION PACKET: {packet.persona_full_name}",
        "=" * 70,
        f"  Role: {packet.persona_role}",
        f"  Persona Anchors: {packet.anchor_count}",
        f"  Shared Canon: {packet.shared_canon_count}",
        f"  Grounding Items: {packet.grounding_count}",
        f"  Total Items: {packet.total_items}",
        f"  Tokens (est): ~{packet.token_estimate}",
        f"  Context Hash: {packet.context_hash}",
        f"  Assembled: {packet.assembled_at}",
        "-" * 70,
        "",
        "IDENTITY BLOCK:",
        packet.identity_block if packet.identity_block else "(not loaded)",
        "",
        "MISSION BLOCK:",
        packet.mission_block if packet.mission_block else "(not loaded)",
        "",
        "VOICE BLOCK:",
        packet.voice_block if packet.voice_block else "(not loaded)",
        "",
        "GUARDRAILS BLOCK:",
        packet.guardrails_block if packet.guardrails_block else "(not loaded)",
        "",
    ]

    # Add shared canon if present
    if packet.shared_canon_block:
        lines.extend([
            "SHARED CANON BLOCK:",
            packet.shared_canon_block,
            "",
        ])

    # Add grounding if present
    if packet.grounding_block:
        lines.extend([
            "CONTEXTUAL GROUNDING BLOCK:",
            packet.grounding_block,
            "",
        ])

    lines.append("=" * 70)
    return "\n".join(lines)


def output_context(context: ActivationContext) -> str:
    """Output just the full context (for system prompt use)."""
    return context.full_context


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Activate a persona by retrieving and assembling anchors into a structured activation packet"
    )

    parser.add_argument(
        "--persona", "-p",
        type=str,
        required=True,
        choices=list(PERSONA_COLLECTIONS.keys()),
        help="Name of the persona to activate"
    )

    parser.add_argument(
        "--output", "-o",
        type=str,
        choices=["json", "text", "context"],
        default="context",
        help="Output format (default: context)"
    )

    parser.add_argument(
        "--validate", "-v",
        action="store_true",
        help="Validate anchors only, don't output context"
    )

    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable context caching"
    )

    parser.add_argument(
        "--no-canon",
        action="store_true",
        help="Skip shared canon retrieval (doctrinal alignment)"
    )

    parser.add_argument(
        "--no-grounding",
        action="store_true",
        help="Skip contextual grounding retrieval (situational awareness)"
    )

    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress logging output"
    )

    args = parser.parse_args()

    # Configure logging
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)

    # Create activator with options
    activator = PersonaActivator(
        use_cache=not args.no_cache,
        include_canon=not args.no_canon,
        include_grounding=not args.no_grounding,
    )

    try:
        if args.validate:
            # Validation mode
            validation = activator.validate(args.persona)
            print(json.dumps(validation, indent=2))
            sys.exit(0 if validation["valid"] else 1)

        else:
            # Activation mode
            packet = activator.activate(args.persona)

            # Output in requested format
            if args.output == "json":
                print(output_json(packet))
            elif args.output == "text":
                print(output_text(packet))
            else:  # context
                print(output_context(packet))

            sys.exit(0)

    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)

    except Exception as e:
        logger.error(f"Activation failed: {e}")
        sys.exit(1)

    finally:
        activator.cleanup()


if __name__ == "__main__":
    main()
