# =============================================================================
# REQUEST EXECUTION LOGGER
# =============================================================================
"""
Detailed logging for every model execution request.

This module captures comprehensive metadata for each execution:
- Selected model and routing decision
- Token usage (input, output, total)
- Downgrade status and session identifiers
- Latency and timing information
- Request/response content (configurable)

CRITICAL: Every execution MUST be logged for auditability.
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
# REQUEST LOG ENTRY
# =============================================================================

@dataclass
class RequestLog(LogEntry):
    """
    Detailed log entry for a model execution request.

    Captures all information needed to audit, replay, and analyze
    model executions across the pipeline.
    """
    log_type: str = "execution"

    # Request identification
    request_id: str = ""
    parent_request_id: str = ""  # For chained requests

    # Model selection
    model_id: str = ""
    model_display_name: str = ""
    model_tier: str = ""  # economy, standard, premium

    # Routing decision
    original_tier: str = ""  # Before downgrade
    was_downgraded: bool = False
    downgrade_reason: str = ""
    routing_rule: str = ""
    routing_justification: str = ""

    # Classification
    classification_source: str = ""  # zero_token, minimal_llm, etc.
    zero_token_succeeded: bool = False
    classification_confidence: float = 0.0
    detected_intent: str = ""
    detected_complexity: str = ""
    detected_risk: str = ""

    # Token usage
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    routing_tokens: int = 0  # Tokens used for classification

    # Cost tracking
    estimated_cost_usd: float = 0.0
    cost_multiplier: float = 1.0
    savings_vs_premium: str = ""

    # Timing
    started_at: str = ""
    completed_at: str = ""
    latency_ms: float = 0.0
    time_to_first_token_ms: float = 0.0

    # Request content
    user_message: str = ""
    user_message_length: int = 0
    system_prompt_hash: str = ""  # Hash for comparison without storing full prompt

    # Response content
    response_preview: str = ""  # First N characters
    response_length: int = 0
    response_complete: bool = True
    stop_reason: str = ""  # stop, length, content_filter, etc.

    # Execution status
    success: bool = True
    error_message: str = ""
    error_type: str = ""
    retry_count: int = 0

    # Context
    conversation_turn: int = 0
    memory_chunks_used: int = 0
    activation_anchors_used: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with all fields."""
        data = super().to_dict()
        # Ensure all fields are serializable
        return data


# =============================================================================
# REQUEST LOGGER
# =============================================================================

class RequestLogger:
    """
    Logger for model execution requests.

    Provides methods to log complete execution cycles including
    start, completion, and failure scenarios.
    """

    def __init__(self, writer: LogWriter = None):
        self.writer = writer or get_log_writer()
        self._active_requests: Dict[str, RequestLog] = {}
        self._lock = threading.Lock()

    def start_request(
        self,
        request_id: str,
        session_id: str = "",
        context_id: str = "",
        persona_id: str = "",
        user_message: str = "",
        **kwargs
    ) -> RequestLog:
        """
        Start tracking a new request.

        Call this BEFORE executing the model request.

        Args:
            request_id: Unique identifier for this request
            session_id: Session identifier
            context_id: Context for downgrade tracking
            persona_id: Active persona
            user_message: The user's message
            **kwargs: Additional fields to set

        Returns:
            RequestLog instance (mutable, update before logging)
        """
        config = get_log_config()

        log = RequestLog(
            request_id=request_id,
            session_id=session_id,
            context_id=context_id,
            persona_id=persona_id,
            user_message=user_message[:config.max_message_length],
            user_message_length=len(user_message),
            started_at=datetime.now().isoformat(),
            component="request_logger",
            operation="model_execution",
        )

        # Set any additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Track active request
        with self._lock:
            self._active_requests[request_id] = log

        return log

    def complete_request(
        self,
        request_id: str,
        response: str = "",
        input_tokens: int = 0,
        output_tokens: int = 0,
        stop_reason: str = "stop",
        **kwargs
    ) -> Optional[RequestLog]:
        """
        Complete a request successfully.

        Call this AFTER the model returns a response.

        Args:
            request_id: The request ID from start_request
            response: The model's response
            input_tokens: Input token count
            output_tokens: Output token count
            stop_reason: Why generation stopped
            **kwargs: Additional fields to update

        Returns:
            Completed RequestLog, or None if request not found
        """
        with self._lock:
            log = self._active_requests.pop(request_id, None)

        if log is None:
            # Request not found - create a minimal log
            log = RequestLog(
                request_id=request_id,
                level=LogLevel.WARNING,
                error_message="Request completed without start_request call",
            )

        # Update completion fields
        config = get_log_config()
        now = datetime.now()

        log.completed_at = now.isoformat()
        log.response_preview = response[:config.max_message_length] if response else ""
        log.response_length = len(response) if response else 0
        log.response_complete = True
        log.stop_reason = stop_reason
        log.input_tokens = input_tokens
        log.output_tokens = output_tokens
        log.total_tokens = input_tokens + output_tokens
        log.success = True

        # Calculate latency
        if log.started_at:
            try:
                start = datetime.fromisoformat(log.started_at)
                log.latency_ms = (now - start).total_seconds() * 1000
            except ValueError:
                pass

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def fail_request(
        self,
        request_id: str,
        error_message: str,
        error_type: str = "unknown",
        **kwargs
    ) -> Optional[RequestLog]:
        """
        Mark a request as failed.

        Call this when the model request fails.

        Args:
            request_id: The request ID from start_request
            error_message: Description of the error
            error_type: Type of error (timeout, api_error, etc.)
            **kwargs: Additional fields to update

        Returns:
            Failed RequestLog, or None if request not found
        """
        with self._lock:
            log = self._active_requests.pop(request_id, None)

        if log is None:
            log = RequestLog(
                request_id=request_id,
                level=LogLevel.ERROR,
            )

        # Update failure fields
        now = datetime.now()
        log.completed_at = now.isoformat()
        log.success = False
        log.error_message = error_message
        log.error_type = error_type
        log.level = LogLevel.ERROR

        # Calculate latency
        if log.started_at:
            try:
                start = datetime.fromisoformat(log.started_at)
                log.latency_ms = (now - start).total_seconds() * 1000
            except ValueError:
                pass

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def log_complete_request(
        self,
        session_id: str = "",
        context_id: str = "",
        persona_id: str = "",
        user_message: str = "",
        response: str = "",
        model_id: str = "",
        model_tier: str = "",
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        routing_decision: Dict[str, Any] = None,
        **kwargs
    ) -> RequestLog:
        """
        Log a complete request in one call.

        Convenience method for logging after-the-fact when
        start_request wasn't called.

        Args:
            session_id: Session identifier
            context_id: Context identifier
            persona_id: Active persona
            user_message: User's message
            response: Model's response
            model_id: Model used
            model_tier: Tier used
            input_tokens: Input token count
            output_tokens: Output token count
            latency_ms: Total latency
            routing_decision: Full routing decision dict
            **kwargs: Additional fields

        Returns:
            Completed RequestLog
        """
        import uuid
        config = get_log_config()
        now = datetime.now()

        log = RequestLog(
            request_id=str(uuid.uuid4()),
            session_id=session_id,
            context_id=context_id,
            persona_id=persona_id,
            user_message=user_message[:config.max_message_length],
            user_message_length=len(user_message),
            response_preview=response[:config.max_message_length] if response else "",
            response_length=len(response) if response else 0,
            model_id=model_id,
            model_tier=model_tier,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            latency_ms=latency_ms,
            started_at=now.isoformat(),
            completed_at=now.isoformat(),
            success=True,
            component="request_logger",
            operation="model_execution",
        )

        # Extract routing decision fields if provided
        if routing_decision:
            log.original_tier = routing_decision.get('original_tier', '')
            log.was_downgraded = routing_decision.get('was_downgraded', False)
            log.downgrade_reason = routing_decision.get('downgrade_reason', '')
            log.routing_rule = routing_decision.get('matched_rule', '')
            log.routing_justification = routing_decision.get('justification', '')
            log.classification_source = routing_decision.get('classification_source', '')
            log.zero_token_succeeded = routing_decision.get('zero_token_succeeded', False)
            log.routing_tokens = routing_decision.get('tokens_used_for_routing', 0)

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def get_active_requests(self) -> List[str]:
        """Get list of currently active request IDs."""
        with self._lock:
            return list(self._active_requests.keys())


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_logger: Optional[RequestLogger] = None
_logger_lock = threading.Lock()


def get_request_logger() -> RequestLogger:
    """Get the global request logger."""
    global _global_logger
    with _logger_lock:
        if _global_logger is None:
            _global_logger = RequestLogger()
        return _global_logger


def set_request_logger(logger: RequestLogger):
    """Set the global request logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = logger


def reset_request_logger():
    """Reset to default request logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def log_request(
    session_id: str = "",
    context_id: str = "",
    persona_id: str = "",
    user_message: str = "",
    response: str = "",
    model_id: str = "",
    model_tier: str = "",
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: float = 0.0,
    routing_decision: Dict[str, Any] = None,
    **kwargs
) -> RequestLog:
    """
    Log a complete model execution request.

    This is the primary function for logging executions.

    Example:
        log_request(
            session_id="sess_123",
            persona_id="inspire_pastor",
            user_message="What does John 3:16 mean?",
            response="John 3:16 is one of the most famous verses...",
            model_id="gpt-4o-mini",
            model_tier="economy",
            input_tokens=150,
            output_tokens=200,
            latency_ms=1234.5,
            routing_decision=decision.to_dict(),
        )
    """
    logger = get_request_logger()
    return logger.log_complete_request(
        session_id=session_id,
        context_id=context_id,
        persona_id=persona_id,
        user_message=user_message,
        response=response,
        model_id=model_id,
        model_tier=model_tier,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        routing_decision=routing_decision,
        **kwargs
    )
