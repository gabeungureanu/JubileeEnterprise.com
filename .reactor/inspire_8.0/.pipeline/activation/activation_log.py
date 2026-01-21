# =============================================================================
# ACTIVATION AUDIT LOG
# =============================================================================
"""
Comprehensive logging for persona activation events.

This module provides detailed, structured logging for every activation,
recording exactly which anchors were retrieved, their identifiers, types,
priorities, sources, and versions. This enables:

1. Audit trails for governance and compliance
2. Debugging of activation issues
3. Replay of activations for testing
4. Verification of deterministic behavior

CRITICAL: Activation logs are APPEND-ONLY and IMMUTABLE.
Once written, activation logs should never be modified.
"""

import hashlib
import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# =============================================================================
# ACTIVATION LOG ENTRY DATA CLASSES
# =============================================================================

@dataclass
class AnchorLogEntry:
    """
    Log entry for a single anchor retrieved during activation.

    This captures all metadata needed to identify and reproduce
    the anchor selection.
    """
    # Identifier
    anchor_id: str
    point_id: str = ""

    # Type and classification
    anchor_type: str = ""  # identity_anchor, mission_anchor, voice_anchor, guardrail_anchor
    section: str = ""      # e.g., core_identity, calling, tone

    # Priority for deterministic ordering
    priority: str = "normal"  # core, high, normal, low
    priority_order: int = 0   # Numeric order within type

    # Source tracking
    source: str = ""
    collection: str = ""
    doc_version: str = ""

    # Content hash for verification
    content_hash: str = ""
    content_length: int = 0
    token_estimate: int = 0

    # Timestamps
    created_at: str = ""
    retrieved_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class ActivationLogEntry:
    """
    Complete log entry for a persona activation event.

    This captures everything about the activation for audit
    and replay purposes.
    """
    # Activation identification
    activation_id: str = ""
    activation_hash: str = ""  # Hash of all anchor content for verification

    # Persona
    persona_name: str = ""
    persona_full_name: str = ""
    persona_collection: str = ""

    # Timestamps
    activation_start: str = ""
    activation_end: str = ""
    duration_ms: float = 0.0

    # Anchor details by type
    identity_anchors: List[AnchorLogEntry] = field(default_factory=list)
    mission_anchors: List[AnchorLogEntry] = field(default_factory=list)
    voice_anchors: List[AnchorLogEntry] = field(default_factory=list)
    guardrail_anchors: List[AnchorLogEntry] = field(default_factory=list)

    # Shared canon anchors
    scripture_anchors: List[AnchorLogEntry] = field(default_factory=list)
    doctrine_anchors: List[AnchorLogEntry] = field(default_factory=list)
    governance_anchors: List[AnchorLogEntry] = field(default_factory=list)

    # Contextual grounding
    grounding_items: List[AnchorLogEntry] = field(default_factory=list)

    # Assembly metadata
    assembly_order: List[str] = field(default_factory=list)
    total_anchors: int = 0
    total_tokens: int = 0
    context_hash: str = ""

    # Status
    success: bool = False
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Environment
    qdrant_host: str = ""
    qdrant_port: int = 0

    @property
    def all_anchor_entries(self) -> List[AnchorLogEntry]:
        """Get all anchor entries as a flat list."""
        return (
            self.identity_anchors +
            self.mission_anchors +
            self.voice_anchors +
            self.guardrail_anchors +
            self.scripture_anchors +
            self.doctrine_anchors +
            self.governance_anchors +
            self.grounding_items
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "activation_id": self.activation_id,
            "activation_hash": self.activation_hash,
            "persona_name": self.persona_name,
            "persona_full_name": self.persona_full_name,
            "persona_collection": self.persona_collection,
            "activation_start": self.activation_start,
            "activation_end": self.activation_end,
            "duration_ms": self.duration_ms,
            "identity_anchors": [a.to_dict() for a in self.identity_anchors],
            "mission_anchors": [a.to_dict() for a in self.mission_anchors],
            "voice_anchors": [a.to_dict() for a in self.voice_anchors],
            "guardrail_anchors": [a.to_dict() for a in self.guardrail_anchors],
            "scripture_anchors": [a.to_dict() for a in self.scripture_anchors],
            "doctrine_anchors": [a.to_dict() for a in self.doctrine_anchors],
            "governance_anchors": [a.to_dict() for a in self.governance_anchors],
            "grounding_items": [a.to_dict() for a in self.grounding_items],
            "assembly_order": self.assembly_order,
            "total_anchors": self.total_anchors,
            "total_tokens": self.total_tokens,
            "context_hash": self.context_hash,
            "success": self.success,
            "errors": self.errors,
            "warnings": self.warnings,
            "qdrant_host": self.qdrant_host,
            "qdrant_port": self.qdrant_port,
        }

    def to_json(self, indent: int = 2) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)


# =============================================================================
# ACTIVATION LOGGER
# =============================================================================

class ActivationLogger:
    """
    Handles logging of activation events to files.

    Logs are written to a designated directory with one file per
    activation, named with timestamp and persona for easy lookup.
    """

    # Log directory relative to activation module
    DEFAULT_LOG_DIR = "logs/activations"

    def __init__(
        self,
        log_directory: str = None,
        enabled: bool = True,
    ):
        """
        Initialize the activation logger.

        Args:
            log_directory: Directory for log files (default: logs/activations)
            enabled: Whether logging is enabled
        """
        self.enabled = enabled

        # Determine log directory
        if log_directory:
            self.log_dir = Path(log_directory)
        else:
            # Default to logs/activations relative to this file
            module_dir = Path(__file__).parent
            self.log_dir = module_dir / self.DEFAULT_LOG_DIR

        # Ensure log directory exists
        if self.enabled:
            self.log_dir.mkdir(parents=True, exist_ok=True)

    def create_entry(
        self,
        persona_name: str,
        persona_collection: str = None,
    ) -> ActivationLogEntry:
        """
        Create a new activation log entry.

        Args:
            persona_name: Name of the persona
            persona_collection: Optional collection name

        Returns:
            New ActivationLogEntry
        """
        timestamp = datetime.now()

        return ActivationLogEntry(
            activation_id=self._generate_activation_id(persona_name, timestamp),
            persona_name=persona_name,
            persona_collection=persona_collection or persona_name,
            activation_start=timestamp.isoformat(),
        )

    def create_anchor_entry(
        self,
        anchor_id: str,
        anchor_type: str,
        section: str,
        content: str,
        **kwargs,
    ) -> AnchorLogEntry:
        """
        Create a log entry for an anchor.

        Args:
            anchor_id: Unique identifier for the anchor
            anchor_type: Type of anchor
            section: Section within anchor type
            content: Anchor content (for hashing)
            **kwargs: Additional fields

        Returns:
            New AnchorLogEntry
        """
        content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]

        return AnchorLogEntry(
            anchor_id=anchor_id,
            anchor_type=anchor_type,
            section=section,
            content_hash=content_hash,
            content_length=len(content),
            token_estimate=len(content) // 4,
            retrieved_at=datetime.now().isoformat(),
            **kwargs,
        )

    def finalize_entry(
        self,
        entry: ActivationLogEntry,
        context_hash: str = "",
        success: bool = True,
        errors: List[str] = None,
        warnings: List[str] = None,
    ) -> ActivationLogEntry:
        """
        Finalize an activation log entry.

        Args:
            entry: The log entry to finalize
            context_hash: Hash of assembled context
            success: Whether activation succeeded
            errors: List of errors
            warnings: List of warnings

        Returns:
            Finalized ActivationLogEntry
        """
        entry.activation_end = datetime.now().isoformat()

        # Calculate duration
        start = datetime.fromisoformat(entry.activation_start)
        end = datetime.fromisoformat(entry.activation_end)
        entry.duration_ms = (end - start).total_seconds() * 1000

        # Set status
        entry.success = success
        entry.errors = errors or []
        entry.warnings = warnings or []
        entry.context_hash = context_hash

        # Calculate totals
        entry.total_anchors = len(entry.all_anchor_entries)
        entry.total_tokens = sum(a.token_estimate for a in entry.all_anchor_entries)

        # Generate activation hash (hash of all anchor content hashes)
        all_hashes = [a.content_hash for a in entry.all_anchor_entries]
        entry.activation_hash = hashlib.sha256(
            "|".join(sorted(all_hashes)).encode('utf-8')
        ).hexdigest()[:16]

        return entry

    def write_entry(self, entry: ActivationLogEntry) -> str:
        """
        Write an activation log entry to file.

        Args:
            entry: The log entry to write

        Returns:
            Path to the written log file
        """
        if not self.enabled:
            return ""

        # Generate filename
        timestamp = entry.activation_start.replace(":", "-").replace(".", "-")
        filename = f"{entry.persona_name}_{timestamp}.json"
        filepath = self.log_dir / filename

        # Write log
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(entry.to_json())

            logger.info(f"Activation log written: {filepath}")
            return str(filepath)

        except Exception as e:
            logger.error(f"Failed to write activation log: {e}")
            return ""

    def get_recent_activations(
        self,
        persona_name: str = None,
        limit: int = 10,
    ) -> List[ActivationLogEntry]:
        """
        Get recent activation log entries.

        Args:
            persona_name: Filter by persona (optional)
            limit: Maximum entries to return

        Returns:
            List of ActivationLogEntry objects
        """
        if not self.enabled or not self.log_dir.exists():
            return []

        # Get log files
        pattern = f"{persona_name}_*.json" if persona_name else "*.json"
        files = sorted(
            self.log_dir.glob(pattern),
            key=lambda f: f.stat().st_mtime,
            reverse=True
        )

        entries = []
        for filepath in files[:limit]:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                entry = ActivationLogEntry(**{
                    k: v for k, v in data.items()
                    if k not in [
                        'identity_anchors', 'mission_anchors', 'voice_anchors',
                        'guardrail_anchors', 'scripture_anchors', 'doctrine_anchors',
                        'governance_anchors', 'grounding_items'
                    ]
                })
                entries.append(entry)

            except Exception as e:
                logger.warning(f"Failed to read log file {filepath}: {e}")

        return entries

    def verify_determinism(
        self,
        entry1: ActivationLogEntry,
        entry2: ActivationLogEntry,
    ) -> Dict[str, Any]:
        """
        Verify two activations produced identical results.

        Args:
            entry1: First activation entry
            entry2: Second activation entry

        Returns:
            Verification result with details
        """
        result = {
            "identical": False,
            "persona_match": entry1.persona_name == entry2.persona_name,
            "anchor_count_match": entry1.total_anchors == entry2.total_anchors,
            "activation_hash_match": entry1.activation_hash == entry2.activation_hash,
            "context_hash_match": entry1.context_hash == entry2.context_hash,
            "differences": [],
        }

        # Check each anchor type
        for anchor_type in ['identity', 'mission', 'voice', 'guardrail']:
            anchors1 = getattr(entry1, f"{anchor_type}_anchors", [])
            anchors2 = getattr(entry2, f"{anchor_type}_anchors", [])

            if len(anchors1) != len(anchors2):
                result["differences"].append(
                    f"{anchor_type}: count mismatch ({len(anchors1)} vs {len(anchors2)})"
                )
            else:
                for i, (a1, a2) in enumerate(zip(anchors1, anchors2)):
                    if a1.content_hash != a2.content_hash:
                        result["differences"].append(
                            f"{anchor_type}[{i}]: content hash mismatch"
                        )

        result["identical"] = (
            result["persona_match"] and
            result["anchor_count_match"] and
            result["activation_hash_match"] and
            result["context_hash_match"] and
            len(result["differences"]) == 0
        )

        return result

    def _generate_activation_id(
        self,
        persona_name: str,
        timestamp: datetime,
    ) -> str:
        """Generate a unique activation ID."""
        data = f"{persona_name}:{timestamp.isoformat()}"
        return hashlib.sha256(data.encode('utf-8')).hexdigest()[:12]


# =============================================================================
# DETERMINISTIC ORDERING
# =============================================================================

# Priority order for deterministic anchor sorting
PRIORITY_ORDER = {
    "core": 0,
    "critical": 1,
    "high": 2,
    "normal": 3,
    "low": 4,
}

# Section order within each anchor type for deterministic assembly
SECTION_ORDER = {
    "identity_anchor": [
        "core_identity",
        "spiritual_identity",
        "psychological_identity",
        "cultural_identity",
        "temporal_identity",
        "relational_identity",
        "visual_identity",
        "audience",
        "authority",
    ],
    "mission_anchor": [
        "calling",
        "purpose",
        "ministry_focus",
        "goals",
        "success_criteria",
        "impact_areas",
    ],
    "voice_anchor": [
        "tone",
        "cadence",
        "vocabulary",
        "speech_patterns",
        "emotional_range",
        "communication_style",
    ],
    "guardrail_anchor": [
        "hard_stops",
        "soft_boundaries",
        "doctrinal_constraints",
        "ethical_boundaries",
        "forbidden_topics",
    ],
}


def get_deterministic_sort_key(anchor: Any) -> tuple:
    """
    Generate a sort key for deterministic anchor ordering.

    Anchors are sorted by:
    1. Priority (core > critical > high > normal > low)
    2. Section order within type
    3. Content hash (for absolute consistency)

    Args:
        anchor: An anchor object with type, section, priority attributes

    Returns:
        Tuple for sorting
    """
    # Get priority order
    priority = getattr(anchor, 'priority', 'normal')
    priority_num = PRIORITY_ORDER.get(priority, 3)

    # Get section order
    anchor_type = getattr(anchor, 'anchor_type', '') or getattr(anchor, 'type', '')
    section = getattr(anchor, 'section', '')
    section_list = SECTION_ORDER.get(anchor_type, [])

    try:
        section_num = section_list.index(section)
    except ValueError:
        section_num = 999  # Unknown sections go last

    # Get content hash for final tiebreaker
    content = getattr(anchor, 'content', '')
    content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

    return (priority_num, section_num, content_hash)


def sort_anchors_deterministically(anchors: List[Any]) -> List[Any]:
    """
    Sort anchors in a deterministic order.

    Args:
        anchors: List of anchor objects

    Returns:
        Sorted list of anchors
    """
    return sorted(anchors, key=get_deterministic_sort_key)


# =============================================================================
# GLOBAL LOGGER INSTANCE
# =============================================================================

_global_activation_logger: Optional[ActivationLogger] = None


def get_activation_logger() -> ActivationLogger:
    """Get the global activation logger instance."""
    global _global_activation_logger
    if _global_activation_logger is None:
        _global_activation_logger = ActivationLogger()
    return _global_activation_logger


def reset_activation_logger():
    """Reset the global activation logger (for testing)."""
    global _global_activation_logger
    _global_activation_logger = None
