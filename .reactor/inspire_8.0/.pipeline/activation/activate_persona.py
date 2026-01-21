#!/usr/bin/env python3
# =============================================================================
# PERSONA ACTIVATION SCRIPT
# =============================================================================
"""
Main entry point for persona activation (ignition).

This script retrieves activation anchors from Qdrant, assembles them into
an activation context, and outputs the context for persona initialization.

CRITICAL INVARIANTS:
1. This script is READ-ONLY - it NEVER writes to Qdrant
2. Only retrieves anchors tagged with activation_anchor types
3. Output is deterministic for reproducible activation
4. No memory or interaction data is ever touched

Usage:
    python activate_persona.py --persona jubilee [--output json|text|context]

Options:
    --persona   Name of the persona to activate (required)
    --output    Output format: json, text, or context (default: context)
    --validate  Validate anchors only, don't output context
    --cache     Use cached context if available

Examples:
    python activate_persona.py --persona jubilee
    python activate_persona.py --persona gabriel --output json
    python activate_persona.py --persona melody --validate
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
from assembler import ContextAssembler, ActivationContext, ContextCache
from policy import (
    MemoryPolicy,
    ExecutionPhase,
    ActivationPhase,
    get_memory_policy,
)


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

    This is a READ-ONLY class. It retrieves data but never writes.
    The memory policy enforces this invariant.
    """

    def __init__(self, use_cache: bool = True):
        """
        Initialize the activator.

        Args:
            use_cache: Whether to use context caching
        """
        self.retriever = AnchorRetriever()
        self.assembler = ContextAssembler()
        self.policy = get_memory_policy()
        self.cache = ContextCache() if use_cache else None

    def activate(self, persona_name: str) -> ActivationContext:
        """
        Activate a persona by retrieving anchors and assembling context.

        This is the main entry point for activation.

        Args:
            persona_name: Name of the persona to activate

        Returns:
            Assembled ActivationContext

        Raises:
            ValueError: If persona is unknown or activation fails
        """
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

            # Retrieve anchors
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

            # Assemble context
            context = self.assembler.assemble(result.anchors)

            # Cache the result
            if self.cache:
                self.cache.set(persona_name, context)

            return context

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
        if self.cache:
            self.cache.clear()


# =============================================================================
# OUTPUT FORMATTERS
# =============================================================================

def output_json(context: ActivationContext) -> str:
    """Output context as JSON."""
    return json.dumps(context.to_dict(), indent=2)


def output_text(context: ActivationContext) -> str:
    """Output context as formatted text."""
    lines = [
        "=" * 70,
        f"  PERSONA ACTIVATION: {context.persona_full_name}",
        "=" * 70,
        f"  Role: {context.persona_role}",
        f"  Anchors: {context.anchor_count}",
        f"  Tokens (est): ~{context.token_estimate}",
        f"  Context Hash: {context.context_hash}",
        f"  Assembled: {context.assembled_at}",
        "-" * 70,
        "",
        "IDENTITY BLOCK:",
        context.identity_block if context.identity_block else "(not loaded)",
        "",
        "MISSION BLOCK:",
        context.mission_block if context.mission_block else "(not loaded)",
        "",
        "VOICE BLOCK:",
        context.voice_block if context.voice_block else "(not loaded)",
        "",
        "GUARDRAILS BLOCK:",
        context.guardrails_block if context.guardrails_block else "(not loaded)",
        "",
        "=" * 70,
    ]
    return "\n".join(lines)


def output_context(context: ActivationContext) -> str:
    """Output just the full context (for system prompt use)."""
    return context.full_context


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Activate a persona by retrieving and assembling anchors"
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
        "--quiet", "-q",
        action="store_true",
        help="Suppress logging output"
    )

    args = parser.parse_args()

    # Configure logging
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)

    # Create activator
    activator = PersonaActivator(use_cache=not args.no_cache)

    try:
        if args.validate:
            # Validation mode
            validation = activator.validate(args.persona)
            print(json.dumps(validation, indent=2))
            sys.exit(0 if validation["valid"] else 1)

        else:
            # Activation mode
            context = activator.activate(args.persona)

            # Output in requested format
            if args.output == "json":
                print(output_json(context))
            elif args.output == "text":
                print(output_text(context))
            else:  # context
                print(output_context(context))

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
