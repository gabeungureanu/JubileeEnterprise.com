# =============================================================================
# MEMORY WRITEBACK CONFIGURATION
# =============================================================================
"""
Configuration for memory writeback operations.

This module defines the policies and constraints for memory storage,
ensuring summarization-first approach and prohibiting raw transcript
storage by default.

CRITICAL POLICIES:
1. Summaries are REQUIRED for all session memory
2. Raw transcripts are PROHIBITED by default
3. All memory items must have proper metadata
4. Token limits are enforced for all item types
"""

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set


class MemoryItemType(Enum):
    """
    Types of memory items that can be stored.

    ALLOWED types can be written during normal writeback.
    RESTRICTED types require explicit policy override.
    """
    # ALLOWED: Standard memory items
    SESSION_SUMMARY = "session_summary"
    KEY_DECISION = "key_decision"
    USER_PREFERENCE = "user_preference"
    SCRIPTURE_REFERENCE = "scripture_reference"
    INTERACTION_SUMMARY = "interaction_summary"
    LESSON_LEARNED = "lesson_learned"
    RELATIONSHIP_CONTEXT = "relationship_context"

    # RESTRICTED: Require explicit authorization
    RAW_TRANSCRIPT = "raw_transcript"
    UNFILTERED_LOG = "unfiltered_log"
    DEBUG_DATA = "debug_data"


class TranscriptPolicy(Enum):
    """
    Policy for handling raw transcripts.

    PROHIBITED: Never store transcripts (default)
    AUDIT_ONLY: Store only when required by audit policy
    DEBUG_ONLY: Store only during debugging sessions
    EXPLICIT_REQUEST: Store only when explicitly requested
    """
    PROHIBITED = "prohibited"
    AUDIT_ONLY = "audit_only"
    DEBUG_ONLY = "debug_only"
    EXPLICIT_REQUEST = "explicit_request"


@dataclass
class TokenLimits:
    """Token limits for different memory item types."""
    # Session summary: 100-250 tokens (REQUIRED)
    session_summary_min: int = 100
    session_summary_max: int = 250

    # Key decisions: brief but complete
    key_decision_max: int = 150

    # User preferences: concise
    user_preference_max: int = 100

    # Scripture references: reference + brief context
    scripture_reference_max: int = 200

    # Interaction summary: brief record
    interaction_summary_max: int = 300

    # Lesson learned: insight + context
    lesson_learned_max: int = 200

    # Relationship context: durable facts
    relationship_context_max: int = 150


@dataclass
class WritebackConfig:
    """
    Configuration for memory writeback operations.

    This configuration enforces the summarization-first memory policy
    and prohibits raw transcript storage by default.
    """

    # ==========================================================================
    # SUMMARIZATION POLICY (REQUIRED)
    # ==========================================================================

    # Require session summary for all conversations
    require_session_summary: bool = True

    # Token limits for all memory types
    token_limits: TokenLimits = field(default_factory=TokenLimits)

    # ==========================================================================
    # TRANSCRIPT POLICY (PROHIBITED BY DEFAULT)
    # ==========================================================================

    # Default: Transcripts are prohibited
    transcript_policy: TranscriptPolicy = TranscriptPolicy.PROHIBITED

    # Explicit flag to enable transcript storage (requires justification)
    allow_transcript_storage: bool = False

    # Justification required if transcripts are enabled
    transcript_justification: Optional[str] = None

    # ==========================================================================
    # EXTRACTION SETTINGS
    # ==========================================================================

    # Extract key decisions automatically
    extract_decisions: bool = True

    # Extract user preferences (durable only)
    extract_preferences: bool = True

    # Only extract durable preferences (not session-specific)
    preferences_durable_only: bool = True

    # Extract scripture references
    extract_scripture: bool = True

    # ==========================================================================
    # METADATA REQUIREMENTS
    # ==========================================================================

    # Require timestamp on all memory items
    require_timestamp: bool = True

    # Require source attribution
    require_source: bool = True

    # Require persona attribution
    require_persona: bool = True

    # ==========================================================================
    # MEMORY HYGIENE
    # ==========================================================================

    # Maximum items per session writeback
    max_items_per_session: int = 20

    # Maximum total tokens per session writeback
    max_tokens_per_session: int = 2000

    # Deduplicate similar items
    deduplicate_items: bool = True

    # Similarity threshold for deduplication (0.0-1.0)
    deduplication_threshold: float = 0.85

    # ==========================================================================
    # ALLOWED/PROHIBITED TYPES
    # ==========================================================================

    # Types allowed for normal writeback
    allowed_types: Set[MemoryItemType] = field(default_factory=lambda: {
        MemoryItemType.SESSION_SUMMARY,
        MemoryItemType.KEY_DECISION,
        MemoryItemType.USER_PREFERENCE,
        MemoryItemType.SCRIPTURE_REFERENCE,
        MemoryItemType.INTERACTION_SUMMARY,
        MemoryItemType.LESSON_LEARNED,
        MemoryItemType.RELATIONSHIP_CONTEXT,
    })

    # Types prohibited by default (require explicit override)
    prohibited_types: Set[MemoryItemType] = field(default_factory=lambda: {
        MemoryItemType.RAW_TRANSCRIPT,
        MemoryItemType.UNFILTERED_LOG,
        MemoryItemType.DEBUG_DATA,
    })

    def is_type_allowed(self, item_type: MemoryItemType) -> bool:
        """Check if a memory item type is allowed for storage."""
        if item_type in self.prohibited_types:
            # Check for explicit override
            if item_type == MemoryItemType.RAW_TRANSCRIPT:
                return self.allow_transcript_storage
            return False
        return item_type in self.allowed_types

    def get_token_limit(self, item_type: MemoryItemType) -> int:
        """Get the token limit for a memory item type."""
        limits = {
            MemoryItemType.SESSION_SUMMARY: self.token_limits.session_summary_max,
            MemoryItemType.KEY_DECISION: self.token_limits.key_decision_max,
            MemoryItemType.USER_PREFERENCE: self.token_limits.user_preference_max,
            MemoryItemType.SCRIPTURE_REFERENCE: self.token_limits.scripture_reference_max,
            MemoryItemType.INTERACTION_SUMMARY: self.token_limits.interaction_summary_max,
            MemoryItemType.LESSON_LEARNED: self.token_limits.lesson_learned_max,
            MemoryItemType.RELATIONSHIP_CONTEXT: self.token_limits.relationship_context_max,
        }
        return limits.get(item_type, 200)  # Default limit

    def validate(self) -> List[str]:
        """Validate the configuration. Returns list of warnings/errors."""
        issues = []

        # Check transcript policy consistency
        if self.allow_transcript_storage and not self.transcript_justification:
            issues.append(
                "WARNING: Transcript storage enabled but no justification provided"
            )

        if self.transcript_policy == TranscriptPolicy.PROHIBITED and self.allow_transcript_storage:
            issues.append(
                "WARNING: Transcript policy is PROHIBITED but allow_transcript_storage is True"
            )

        # Check token limits
        if self.token_limits.session_summary_min > self.token_limits.session_summary_max:
            issues.append(
                "ERROR: Session summary min tokens > max tokens"
            )

        # Check session limits
        if self.max_tokens_per_session < self.token_limits.session_summary_max:
            issues.append(
                "WARNING: max_tokens_per_session is less than session_summary_max"
            )

        return issues


# =============================================================================
# GLOBAL CONFIGURATION
# =============================================================================

_global_config: Optional[WritebackConfig] = None


def get_writeback_config() -> WritebackConfig:
    """Get the global writeback configuration."""
    global _global_config
    if _global_config is None:
        _global_config = WritebackConfig()
    return _global_config


def set_writeback_config(config: WritebackConfig):
    """Set the global writeback configuration."""
    global _global_config
    _global_config = config


def reset_writeback_config():
    """Reset to default configuration (for testing)."""
    global _global_config
    _global_config = None


# =============================================================================
# CONFIGURATION PRESETS
# =============================================================================

def get_strict_config() -> WritebackConfig:
    """
    Get a strict configuration that maximizes memory hygiene.

    - Minimum session summary length
    - No transcript storage
    - Strict deduplication
    """
    return WritebackConfig(
        require_session_summary=True,
        transcript_policy=TranscriptPolicy.PROHIBITED,
        allow_transcript_storage=False,
        max_items_per_session=10,
        max_tokens_per_session=1500,
        deduplicate_items=True,
        deduplication_threshold=0.80,
    )


def get_audit_config() -> WritebackConfig:
    """
    Get an audit-friendly configuration.

    - Allows transcript storage with audit justification
    - Higher item limits
    """
    return WritebackConfig(
        require_session_summary=True,
        transcript_policy=TranscriptPolicy.AUDIT_ONLY,
        allow_transcript_storage=True,
        transcript_justification="Audit compliance requirement",
        max_items_per_session=30,
        max_tokens_per_session=3000,
    )


def get_debug_config() -> WritebackConfig:
    """
    Get a debug configuration.

    - Allows transcript and debug data storage
    - Higher limits for troubleshooting
    """
    return WritebackConfig(
        require_session_summary=True,
        transcript_policy=TranscriptPolicy.DEBUG_ONLY,
        allow_transcript_storage=True,
        transcript_justification="Debug session - temporary storage only",
        max_items_per_session=50,
        max_tokens_per_session=5000,
        allowed_types={
            MemoryItemType.SESSION_SUMMARY,
            MemoryItemType.KEY_DECISION,
            MemoryItemType.USER_PREFERENCE,
            MemoryItemType.SCRIPTURE_REFERENCE,
            MemoryItemType.INTERACTION_SUMMARY,
            MemoryItemType.LESSON_LEARNED,
            MemoryItemType.RELATIONSHIP_CONTEXT,
            MemoryItemType.DEBUG_DATA,
        },
        prohibited_types={
            MemoryItemType.RAW_TRANSCRIPT,  # Still prohibited even in debug
            MemoryItemType.UNFILTERED_LOG,
        },
    )
