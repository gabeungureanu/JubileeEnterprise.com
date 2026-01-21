# =============================================================================
# MEMORY WRITEBACK POLICY ENFORCER
# =============================================================================
"""
Enforces strict separation between activation and memory writing.

This module defines execution phases and enforces that:
1. NO writes occur during activation phase
2. NO writes occur during execution phase
3. Writes ONLY occur during explicit writeback phase
4. Activation anchors are NEVER writable

The policy acts as a gatekeeper for all write operations, ensuring
that persona identity remains stable and memory is only written when
explicitly authorized by memory policy.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class ExecutionPhase(Enum):
    """
    Execution phases with different write permissions.

    ACTIVATION: Loading persona anchors, assembling context
               WRITES: PROHIBITED

    EXECUTION: Processing user prompts, generating responses
              WRITES: PROHIBITED

    WRITEBACK: Explicit memory commit phase
              WRITES: ALLOWED (with authorization)

    SHUTDOWN: Session cleanup
             WRITES: PROHIBITED
    """
    ACTIVATION = "activation"
    EXECUTION = "execution"
    WRITEBACK = "writeback"
    SHUTDOWN = "shutdown"


class WriteAttemptError(Exception):
    """
    Raised when a write is attempted outside writeback phase.

    This is a critical error indicating a violation of the
    activation/memory separation contract.
    """

    def __init__(
        self,
        phase: ExecutionPhase,
        target_type: str,
        message: str = None
    ):
        self.phase = phase
        self.target_type = target_type
        self.message = message or (
            f"Write attempt blocked: Cannot write '{target_type}' "
            f"during {phase.value} phase. Writes are only allowed "
            f"during {ExecutionPhase.WRITEBACK.value} phase."
        )
        super().__init__(self.message)


@dataclass
class WriteAttempt:
    """Record of a write attempt (for audit logging)."""
    timestamp: str
    phase: str
    target_type: str
    collection: str
    allowed: bool
    reason: str
    authorization: Optional[str] = None


@dataclass
class MemoryPolicy:
    """
    Enforces memory write policy across execution phases.

    This is the central gatekeeper for all write operations.
    It tracks the current execution phase and blocks any write
    attempts that violate the activation/memory separation contract.
    """

    # Current execution phase
    _current_phase: ExecutionPhase = field(default=ExecutionPhase.ACTIVATION)

    # Write authorization (required for writeback phase)
    _authorization: Optional[str] = None

    # Audit log of write attempts
    _write_attempts: List[WriteAttempt] = field(default_factory=list)

    # Alert callbacks for blocked writes
    _alert_callbacks: List[Callable[[WriteAttempt], None]] = field(default_factory=list)

    # Types that are NEVER writable (activation anchors)
    IMMUTABLE_TYPES = frozenset([
        "identity_anchor",
        "mission_anchor",
        "voice_anchor",
        "guardrail_anchor",
    ])

    # Types that CAN be written (only in writeback phase)
    WRITABLE_TYPES = frozenset([
        "interaction_summary",
        "long_term_memory",
        "relationship_context",
        "lesson_learned",
        "session_memory",
    ])

    # Authorization methods
    VALID_AUTHORIZATIONS = frozenset([
        "explicit_user_request",
        "memory_policy_trigger",
        "session_end_commit",
    ])

    @property
    def current_phase(self) -> ExecutionPhase:
        """Get current execution phase."""
        return self._current_phase

    @property
    def writes_allowed(self) -> bool:
        """Check if writes are allowed in current phase."""
        return self._current_phase == ExecutionPhase.WRITEBACK

    def enter_phase(self, phase: ExecutionPhase) -> bool:
        """
        Transition to a new execution phase.

        Args:
            phase: Phase to enter

        Returns:
            True if transition successful
        """
        old_phase = self._current_phase
        self._current_phase = phase

        logger.info(f"Phase transition: {old_phase.value} -> {phase.value}")

        # Clear authorization when leaving writeback
        if old_phase == ExecutionPhase.WRITEBACK and phase != ExecutionPhase.WRITEBACK:
            self._authorization = None
            logger.info("Cleared write authorization")

        return True

    def authorize_writeback(self, method: str) -> bool:
        """
        Authorize the writeback phase for memory commits.

        Args:
            method: Authorization method (must be in VALID_AUTHORIZATIONS)

        Returns:
            True if authorization granted

        Raises:
            ValueError: If authorization method is invalid
        """
        if method not in self.VALID_AUTHORIZATIONS:
            raise ValueError(
                f"Invalid authorization method: {method}. "
                f"Valid methods: {', '.join(self.VALID_AUTHORIZATIONS)}"
            )

        if self._current_phase != ExecutionPhase.WRITEBACK:
            logger.warning(
                f"Cannot authorize writeback: not in writeback phase "
                f"(current: {self._current_phase.value})"
            )
            return False

        self._authorization = method
        logger.info(f"Writeback authorized via: {method}")
        return True

    def check_write_allowed(
        self,
        target_type: str,
        collection: str,
        raise_on_block: bool = True,
    ) -> bool:
        """
        Check if a write operation is allowed.

        This is the main gatekeeper method. Call this before any
        write operation to ensure it complies with memory policy.

        Args:
            target_type: Type of data being written
            collection: Target Qdrant collection
            raise_on_block: If True, raise WriteAttemptError when blocked

        Returns:
            True if write is allowed

        Raises:
            WriteAttemptError: If write is blocked and raise_on_block=True
        """
        allowed = False
        reason = ""

        # Check 1: Is this an immutable type?
        if target_type in self.IMMUTABLE_TYPES:
            reason = f"Type '{target_type}' is immutable and can never be written at runtime"
            allowed = False

        # Check 2: Is this a writable type?
        elif target_type not in self.WRITABLE_TYPES:
            reason = f"Type '{target_type}' is not in the list of writable types"
            allowed = False

        # Check 3: Are we in writeback phase?
        elif self._current_phase != ExecutionPhase.WRITEBACK:
            reason = (
                f"Writes not allowed during {self._current_phase.value} phase. "
                f"Writes are only allowed during {ExecutionPhase.WRITEBACK.value} phase."
            )
            allowed = False

        # Check 4: Do we have authorization?
        elif not self._authorization:
            reason = "Writeback phase requires authorization"
            allowed = False

        else:
            reason = f"Write authorized via {self._authorization}"
            allowed = True

        # Record the attempt
        attempt = WriteAttempt(
            timestamp=datetime.now().isoformat(),
            phase=self._current_phase.value,
            target_type=target_type,
            collection=collection,
            allowed=allowed,
            reason=reason,
            authorization=self._authorization if allowed else None,
        )
        self._write_attempts.append(attempt)

        # Alert on blocked writes
        if not allowed:
            logger.warning(f"WRITE BLOCKED: {reason}")
            for callback in self._alert_callbacks:
                try:
                    callback(attempt)
                except Exception as e:
                    logger.error(f"Alert callback failed: {e}")

            if raise_on_block:
                raise WriteAttemptError(
                    phase=self._current_phase,
                    target_type=target_type,
                    message=reason
                )

        return allowed

    def register_alert_callback(self, callback: Callable[[WriteAttempt], None]):
        """Register a callback to be called when writes are blocked."""
        self._alert_callbacks.append(callback)

    def get_audit_log(self) -> List[Dict[str, Any]]:
        """Get the audit log of all write attempts."""
        return [
            {
                "timestamp": a.timestamp,
                "phase": a.phase,
                "target_type": a.target_type,
                "collection": a.collection,
                "allowed": a.allowed,
                "reason": a.reason,
                "authorization": a.authorization,
            }
            for a in self._write_attempts
        ]

    def get_blocked_attempts(self) -> List[WriteAttempt]:
        """Get all blocked write attempts."""
        return [a for a in self._write_attempts if not a.allowed]


# =============================================================================
# PHASE-AWARE CONTEXT MANAGER
# =============================================================================

class ActivationPhase:
    """
    Context manager for activation phase.

    Usage:
        with ActivationPhase(policy):
            # Code here runs in activation phase
            # Writes will be blocked
            anchors = retriever.retrieve_persona_anchors(...)
            context = assembler.assemble(anchors)
    """

    def __init__(self, policy: MemoryPolicy):
        self.policy = policy
        self._previous_phase = None

    def __enter__(self):
        self._previous_phase = self.policy.current_phase
        self.policy.enter_phase(ExecutionPhase.ACTIVATION)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Return to previous phase on exit
        if self._previous_phase:
            self.policy.enter_phase(self._previous_phase)
        return False


class ExecutionPhaseContext:
    """
    Context manager for execution phase.

    Usage:
        with ExecutionPhaseContext(policy):
            # Code here runs in execution phase
            # Writes will be blocked
            response = generate_response(...)
    """

    def __init__(self, policy: MemoryPolicy):
        self.policy = policy
        self._previous_phase = None

    def __enter__(self):
        self._previous_phase = self.policy.current_phase
        self.policy.enter_phase(ExecutionPhase.EXECUTION)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._previous_phase:
            self.policy.enter_phase(self._previous_phase)
        return False


class WritebackPhase:
    """
    Context manager for writeback phase with authorization.

    Usage:
        with WritebackPhase(policy, "session_end_commit") as wb:
            if wb.authorized:
                # Writes allowed here
                memory_writer.commit_memories(...)
    """

    def __init__(self, policy: MemoryPolicy, authorization_method: str):
        self.policy = policy
        self.authorization_method = authorization_method
        self._previous_phase = None
        self.authorized = False

    def __enter__(self):
        self._previous_phase = self.policy.current_phase
        self.policy.enter_phase(ExecutionPhase.WRITEBACK)
        self.authorized = self.policy.authorize_writeback(self.authorization_method)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._previous_phase:
            self.policy.enter_phase(self._previous_phase)
        return False


# =============================================================================
# GLOBAL POLICY INSTANCE
# =============================================================================

# Singleton policy instance for the application
_global_policy: Optional[MemoryPolicy] = None


def get_memory_policy() -> MemoryPolicy:
    """Get the global memory policy instance."""
    global _global_policy
    if _global_policy is None:
        _global_policy = MemoryPolicy()
    return _global_policy


def reset_memory_policy():
    """Reset the global memory policy (for testing)."""
    global _global_policy
    _global_policy = None
