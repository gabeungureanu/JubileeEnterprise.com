# =============================================================================
# ACTIVATION LOGGER
# =============================================================================
"""
Logging for persona activation and ignition events.

This module captures detailed metadata for every persona activation:
- Which activation anchors were loaded
- Anchor type, priority, source collection, version
- Load order for deterministic replay
- Session initialization details

CRITICAL: Every activation MUST be logged for auditability and replay.
"""

import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from .base import (
    LogEntry,
    LogLevel,
    LogWriter,
    get_log_writer,
    get_log_config,
)


# =============================================================================
# ANCHOR INFO
# =============================================================================

@dataclass
class AnchorInfo:
    """
    Information about an activation anchor.

    Activation anchors are the foundation elements loaded when
    a persona is activated. They include identity, constraints,
    behaviors, and other persona-defining content.
    """
    # Identification
    anchor_id: str = ""
    anchor_type: str = ""  # identity, constraint, behavior, context, etc.
    anchor_name: str = ""

    # Loading details
    load_order: int = 0  # Order in which anchor was loaded
    priority: int = 0  # Priority level (higher = more important)

    # Source
    source_collection: str = ""
    source_document: str = ""
    source_chunk_id: str = ""

    # Version
    anchor_version: str = ""
    created_at: str = ""
    last_modified: str = ""

    # Content
    content_preview: str = ""
    content_length: int = 0
    content_hash: str = ""  # For change detection

    # Status
    loaded_successfully: bool = True
    error_message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'anchor_id': self.anchor_id,
            'anchor_type': self.anchor_type,
            'anchor_name': self.anchor_name,
            'load_order': self.load_order,
            'priority': self.priority,
            'source_collection': self.source_collection,
            'source_document': self.source_document,
            'source_chunk_id': self.source_chunk_id,
            'anchor_version': self.anchor_version,
            'created_at': self.created_at,
            'last_modified': self.last_modified,
            'content_preview': self.content_preview,
            'content_length': self.content_length,
            'content_hash': self.content_hash,
            'loaded_successfully': self.loaded_successfully,
            'error_message': self.error_message,
        }


# =============================================================================
# ACTIVATION LOG ENTRY
# =============================================================================

@dataclass
class ActivationLog(LogEntry):
    """
    Detailed log entry for a persona activation.

    Captures all information needed to audit, replay, and debug
    persona activations across the pipeline.
    """
    log_type: str = "activation"

    # Activation identification
    activation_id: str = ""
    previous_activation_id: str = ""  # For activation chains

    # Persona details
    persona_id: str = ""
    persona_name: str = ""
    persona_version: str = ""
    persona_tier_default: str = ""

    # Activation mode
    activation_mode: str = ""  # interactive, single-shot, test
    activation_reason: str = ""  # user_request, scheduled, system

    # Anchors loaded
    anchors_requested: int = 0
    anchors_loaded: int = 0
    anchors_failed: int = 0
    anchor_details: List[Dict[str, Any]] = field(default_factory=list)

    # Anchor loading by type
    identity_anchors: int = 0
    constraint_anchors: int = 0
    behavior_anchors: int = 0
    context_anchors: int = 0
    memory_anchors: int = 0

    # Collections accessed
    collections_accessed: List[str] = field(default_factory=list)

    # Session initialization
    session_created: bool = False
    session_id: str = ""
    context_id: str = ""
    memory_initialized: bool = False
    routing_configured: bool = False

    # Constraints applied
    constraints_applied: List[str] = field(default_factory=list)
    constraint_count: int = 0

    # Timing
    started_at: str = ""
    completed_at: str = ""
    anchor_load_ms: float = 0.0
    session_init_ms: float = 0.0
    total_latency_ms: float = 0.0

    # Status
    success: bool = True
    error_message: str = ""
    partial_activation: bool = False  # Some anchors failed but persona usable

    # Environment
    environment: str = ""  # development, staging, production
    host: str = ""
    pipeline_version: str = "8.0"

    def add_anchor(self, anchor: AnchorInfo):
        """Add an anchor to the log."""
        self.anchor_details.append(anchor.to_dict())
        self.anchors_loaded = len(self.anchor_details)

        # Update type counts
        type_counters = {
            'identity': 'identity_anchors',
            'constraint': 'constraint_anchors',
            'behavior': 'behavior_anchors',
            'context': 'context_anchors',
            'memory': 'memory_anchors',
        }
        counter = type_counters.get(anchor.anchor_type)
        if counter:
            setattr(self, counter, getattr(self, counter) + 1)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with all fields."""
        data = super().to_dict()
        return data


# =============================================================================
# ACTIVATION LOGGER
# =============================================================================

class ActivationLogger:
    """
    Logger for persona activation events.

    Provides methods to log activation with full anchor details
    for auditing and deterministic replay.
    """

    def __init__(self, writer: LogWriter = None):
        self.writer = writer or get_log_writer()
        self._active_activations: Dict[str, ActivationLog] = {}
        self._lock = threading.Lock()

    def start_activation(
        self,
        activation_id: str,
        persona_id: str,
        persona_name: str = "",
        activation_mode: str = "interactive",
        session_id: str = "",
        **kwargs
    ) -> ActivationLog:
        """
        Start tracking a persona activation.

        Call this BEFORE loading anchors.

        Args:
            activation_id: Unique identifier for this activation
            persona_id: ID of the persona being activated
            persona_name: Display name of the persona
            activation_mode: Mode (interactive, single-shot, test)
            session_id: Session being created
            **kwargs: Additional fields

        Returns:
            ActivationLog instance
        """
        log = ActivationLog(
            activation_id=activation_id,
            persona_id=persona_id,
            persona_name=persona_name,
            activation_mode=activation_mode,
            session_id=session_id,
            started_at=datetime.now().isoformat(),
            component="activation_logger",
            operation="persona_activation",
        )

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Track active activation
        with self._lock:
            self._active_activations[activation_id] = log

        return log

    def add_anchor(
        self,
        activation_id: str,
        anchor: AnchorInfo
    ) -> bool:
        """
        Add an anchor to an active activation log.

        Call this as each anchor is loaded.

        Args:
            activation_id: The activation ID
            anchor: The anchor that was loaded

        Returns:
            True if added, False if activation not found
        """
        with self._lock:
            log = self._active_activations.get(activation_id)
            if log is None:
                return False

            log.add_anchor(anchor)

            # Track collections
            if anchor.source_collection and anchor.source_collection not in log.collections_accessed:
                log.collections_accessed.append(anchor.source_collection)

            return True

    def complete_activation(
        self,
        activation_id: str,
        session_created: bool = True,
        constraints_applied: List[str] = None,
        anchor_load_ms: float = 0.0,
        session_init_ms: float = 0.0,
        **kwargs
    ) -> Optional[ActivationLog]:
        """
        Complete an activation successfully.

        Call this AFTER all anchors are loaded and session is ready.

        Args:
            activation_id: The activation ID
            session_created: Whether session was created
            constraints_applied: List of constraints applied
            anchor_load_ms: Time to load anchors
            session_init_ms: Time to init session
            **kwargs: Additional fields

        Returns:
            Completed ActivationLog
        """
        with self._lock:
            log = self._active_activations.pop(activation_id, None)

        if log is None:
            log = ActivationLog(
                activation_id=activation_id,
                level=LogLevel.WARNING,
                error_message="Activation completed without start_activation call",
            )

        # Update completion fields
        now = datetime.now()
        log.completed_at = now.isoformat()
        log.session_created = session_created
        log.constraints_applied = constraints_applied or []
        log.constraint_count = len(log.constraints_applied)
        log.anchor_load_ms = anchor_load_ms
        log.session_init_ms = session_init_ms
        log.success = True

        # Calculate total latency
        if log.started_at:
            try:
                start = datetime.fromisoformat(log.started_at)
                log.total_latency_ms = (now - start).total_seconds() * 1000
            except ValueError:
                log.total_latency_ms = anchor_load_ms + session_init_ms

        # Check for partial activation
        log.partial_activation = log.anchors_failed > 0

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def fail_activation(
        self,
        activation_id: str,
        error_message: str,
        **kwargs
    ) -> Optional[ActivationLog]:
        """
        Mark an activation as failed.

        Args:
            activation_id: The activation ID
            error_message: Description of the error
            **kwargs: Additional fields

        Returns:
            Failed ActivationLog
        """
        with self._lock:
            log = self._active_activations.pop(activation_id, None)

        if log is None:
            log = ActivationLog(
                activation_id=activation_id,
                level=LogLevel.ERROR,
            )

        now = datetime.now()
        log.completed_at = now.isoformat()
        log.success = False
        log.error_message = error_message
        log.level = LogLevel.ERROR

        if log.started_at:
            try:
                start = datetime.fromisoformat(log.started_at)
                log.total_latency_ms = (now - start).total_seconds() * 1000
            except ValueError:
                pass

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def log_activation(
        self,
        persona_id: str,
        persona_name: str = "",
        activation_mode: str = "interactive",
        session_id: str = "",
        context_id: str = "",
        anchors: List[AnchorInfo] = None,
        constraints_applied: List[str] = None,
        anchor_load_ms: float = 0.0,
        session_init_ms: float = 0.0,
        success: bool = True,
        **kwargs
    ) -> ActivationLog:
        """
        Log a complete activation in one call.

        Convenience method for logging after-the-fact.

        Args:
            persona_id: Persona ID
            persona_name: Persona name
            activation_mode: Activation mode
            session_id: Session ID
            context_id: Context ID
            anchors: List of loaded anchors
            constraints_applied: Constraints applied
            anchor_load_ms: Anchor load time
            session_init_ms: Session init time
            success: Whether activation succeeded
            **kwargs: Additional fields

        Returns:
            Completed ActivationLog
        """
        import uuid
        now = datetime.now()

        log = ActivationLog(
            activation_id=str(uuid.uuid4()),
            persona_id=persona_id,
            persona_name=persona_name,
            activation_mode=activation_mode,
            session_id=session_id,
            context_id=context_id,
            started_at=now.isoformat(),
            completed_at=now.isoformat(),
            anchor_load_ms=anchor_load_ms,
            session_init_ms=session_init_ms,
            total_latency_ms=anchor_load_ms + session_init_ms,
            constraints_applied=constraints_applied or [],
            constraint_count=len(constraints_applied or []),
            success=success,
            session_created=success,
            component="activation_logger",
            operation="persona_activation",
        )

        # Add anchors
        if anchors:
            for anchor in anchors:
                log.add_anchor(anchor)

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_logger: Optional[ActivationLogger] = None
_logger_lock = threading.Lock()


def get_activation_logger() -> ActivationLogger:
    """Get the global activation logger."""
    global _global_logger
    with _logger_lock:
        if _global_logger is None:
            _global_logger = ActivationLogger()
        return _global_logger


def set_activation_logger(logger: ActivationLogger):
    """Set the global activation logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = logger


def reset_activation_logger():
    """Reset to default activation logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def log_activation(
    persona_id: str,
    persona_name: str = "",
    activation_mode: str = "interactive",
    session_id: str = "",
    context_id: str = "",
    anchors: List[AnchorInfo] = None,
    constraints_applied: List[str] = None,
    anchor_load_ms: float = 0.0,
    session_init_ms: float = 0.0,
    success: bool = True,
    **kwargs
) -> ActivationLog:
    """
    Log a complete persona activation.

    This is the primary function for logging activations.

    Example:
        anchors = [
            AnchorInfo(
                anchor_id="anchor_001",
                anchor_type="identity",
                anchor_name="Inspire Pastor Identity",
                load_order=1,
                priority=100,
                source_collection="inspire_canonical_personas",
            ),
            AnchorInfo(
                anchor_id="anchor_002",
                anchor_type="constraint",
                anchor_name="Pastoral Sensitivity",
                load_order=2,
                priority=90,
                source_collection="inspire_authority_foundation",
            ),
        ]

        log_activation(
            persona_id="inspire_pastor",
            persona_name="Inspire Pastor",
            activation_mode="interactive",
            session_id="sess_123",
            anchors=anchors,
            constraints_applied=["pastoral_sensitivity", "confidentiality"],
            anchor_load_ms=150.0,
            session_init_ms=50.0,
        )
    """
    logger = get_activation_logger()
    return logger.log_activation(
        persona_id=persona_id,
        persona_name=persona_name,
        activation_mode=activation_mode,
        session_id=session_id,
        context_id=context_id,
        anchors=anchors,
        constraints_applied=constraints_applied,
        anchor_load_ms=anchor_load_ms,
        session_init_ms=session_init_ms,
        success=success,
        **kwargs
    )
