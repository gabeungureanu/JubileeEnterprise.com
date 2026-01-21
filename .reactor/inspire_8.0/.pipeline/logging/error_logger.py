# =============================================================================
# ERROR LOGGER
# =============================================================================
"""
Centralized error logging for the Inspire 8.0 pipeline.

This module captures comprehensive error information:
- Execution failures and exceptions
- Timeouts and circuit breaker events
- Stack traces and context
- Error categorization and severity

CRITICAL: All errors MUST be logged for debugging and reliability.
"""

import sys
import threading
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from .base import (
    LogEntry,
    LogLevel,
    LogWriter,
    get_log_writer,
    get_log_config,
)


# =============================================================================
# ERROR SEVERITY
# =============================================================================

class ErrorSeverity(Enum):
    """Error severity levels for categorization and alerting."""
    LOW = "low"           # Minor issues, system continues normally
    MEDIUM = "medium"     # Degraded functionality, may need attention
    HIGH = "high"         # Significant issue, requires attention
    CRITICAL = "critical" # System failure, immediate action required


# =============================================================================
# ERROR LOG ENTRY
# =============================================================================

@dataclass
class ErrorLog(LogEntry):
    """
    Detailed log entry for an error event.

    Captures all information needed to debug, analyze, and
    resolve errors across the pipeline.
    """
    log_type: str = "error"
    level: LogLevel = LogLevel.ERROR

    # Error identification
    error_id: str = ""
    error_type: str = ""  # exception class name
    error_message: str = ""
    error_code: str = ""  # Application-specific error code

    # Severity
    severity: ErrorSeverity = ErrorSeverity.MEDIUM

    # Context
    component: str = ""
    operation: str = ""
    stage: str = ""  # routing, retrieval, execution, etc.

    # Exception details
    exception_class: str = ""
    exception_module: str = ""
    stack_trace: str = ""
    stack_frames: List[Dict[str, Any]] = field(default_factory=list)

    # Request context
    request_id: str = ""
    session_id: str = ""
    context_id: str = ""
    persona_id: str = ""
    user_message_preview: str = ""

    # Retry information
    retry_count: int = 0
    max_retries: int = 0
    is_retryable: bool = True
    will_retry: bool = False

    # Timeout information
    is_timeout: bool = False
    timeout_ms: float = 0.0
    elapsed_ms: float = 0.0

    # Circuit breaker
    circuit_breaker_triggered: bool = False
    circuit_breaker_state: str = ""  # closed, open, half-open

    # Additional context
    error_context: Dict[str, Any] = field(default_factory=dict)

    # Resolution
    resolution_hint: str = ""
    documentation_link: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with all fields."""
        data = super().to_dict()
        data['severity'] = self.severity.value
        return data


# =============================================================================
# ERROR LOGGER
# =============================================================================

class ErrorLogger:
    """
    Centralized logger for errors and exceptions.

    Provides methods to log errors with full context and stack traces.
    """

    def __init__(self, writer: LogWriter = None):
        self.writer = writer or get_log_writer()
        self._error_counts: Dict[str, int] = {}
        self._lock = threading.Lock()

    def log_error(
        self,
        error_message: str,
        error_type: str = "general",
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        component: str = "",
        operation: str = "",
        stage: str = "",
        request_id: str = "",
        session_id: str = "",
        context_id: str = "",
        persona_id: str = "",
        error_context: Dict[str, Any] = None,
        **kwargs
    ) -> ErrorLog:
        """
        Log an error.

        Args:
            error_message: Description of the error
            error_type: Type of error
            severity: Error severity
            component: Component where error occurred
            operation: Operation being performed
            stage: Pipeline stage
            request_id: Related request ID
            session_id: Session ID
            context_id: Context ID
            persona_id: Persona ID
            error_context: Additional context
            **kwargs: Additional fields

        Returns:
            ErrorLog instance
        """
        import uuid

        log = ErrorLog(
            error_id=str(uuid.uuid4()),
            error_message=error_message,
            error_type=error_type,
            severity=severity,
            component=component,
            operation=operation,
            stage=stage,
            request_id=request_id,
            session_id=session_id,
            context_id=context_id,
            persona_id=persona_id,
            error_context=error_context or {},
        )

        # Map severity to log level
        severity_to_level = {
            ErrorSeverity.LOW: LogLevel.WARNING,
            ErrorSeverity.MEDIUM: LogLevel.ERROR,
            ErrorSeverity.HIGH: LogLevel.ERROR,
            ErrorSeverity.CRITICAL: LogLevel.CRITICAL,
        }
        log.level = severity_to_level.get(severity, LogLevel.ERROR)

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Update error counts
        with self._lock:
            if error_type not in self._error_counts:
                self._error_counts[error_type] = 0
            self._error_counts[error_type] += 1

        # Write the log
        self.writer.write(log)

        return log

    def log_exception(
        self,
        exception: Exception,
        component: str = "",
        operation: str = "",
        stage: str = "",
        request_id: str = "",
        session_id: str = "",
        context_id: str = "",
        persona_id: str = "",
        severity: ErrorSeverity = None,
        error_context: Dict[str, Any] = None,
        **kwargs
    ) -> ErrorLog:
        """
        Log an exception with full stack trace.

        Args:
            exception: The exception object
            component: Component where error occurred
            operation: Operation being performed
            stage: Pipeline stage
            request_id: Related request ID
            session_id: Session ID
            context_id: Context ID
            persona_id: Persona ID
            severity: Override severity (auto-detected if None)
            error_context: Additional context
            **kwargs: Additional fields

        Returns:
            ErrorLog instance
        """
        import uuid

        # Extract exception details
        exc_type = type(exception).__name__
        exc_module = type(exception).__module__

        # Get stack trace
        stack_trace = traceback.format_exc()
        stack_frames = self._extract_stack_frames(exception)

        # Auto-detect severity based on exception type
        if severity is None:
            severity = self._classify_exception_severity(exception)

        log = ErrorLog(
            error_id=str(uuid.uuid4()),
            error_message=str(exception),
            error_type=exc_type,
            exception_class=exc_type,
            exception_module=exc_module,
            stack_trace=stack_trace,
            stack_frames=stack_frames,
            severity=severity,
            component=component,
            operation=operation,
            stage=stage,
            request_id=request_id,
            session_id=session_id,
            context_id=context_id,
            persona_id=persona_id,
            error_context=error_context or {},
        )

        # Detect timeout
        if 'timeout' in exc_type.lower() or 'timeout' in str(exception).lower():
            log.is_timeout = True

        # Map severity to log level
        severity_to_level = {
            ErrorSeverity.LOW: LogLevel.WARNING,
            ErrorSeverity.MEDIUM: LogLevel.ERROR,
            ErrorSeverity.HIGH: LogLevel.ERROR,
            ErrorSeverity.CRITICAL: LogLevel.CRITICAL,
        }
        log.level = severity_to_level.get(severity, LogLevel.ERROR)

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Update error counts
        with self._lock:
            if exc_type not in self._error_counts:
                self._error_counts[exc_type] = 0
            self._error_counts[exc_type] += 1

        # Write the log
        self.writer.write(log)

        return log

    def log_timeout(
        self,
        operation: str,
        timeout_ms: float,
        elapsed_ms: float,
        component: str = "",
        stage: str = "",
        request_id: str = "",
        session_id: str = "",
        **kwargs
    ) -> ErrorLog:
        """
        Log a timeout event.

        Args:
            operation: Operation that timed out
            timeout_ms: Timeout threshold
            elapsed_ms: Actual elapsed time
            component: Component
            stage: Pipeline stage
            request_id: Request ID
            session_id: Session ID
            **kwargs: Additional fields

        Returns:
            ErrorLog instance
        """
        return self.log_error(
            error_message=f"Operation timed out after {elapsed_ms:.0f}ms (limit: {timeout_ms:.0f}ms)",
            error_type="timeout",
            severity=ErrorSeverity.MEDIUM,
            component=component,
            operation=operation,
            stage=stage,
            request_id=request_id,
            session_id=session_id,
            is_timeout=True,
            timeout_ms=timeout_ms,
            elapsed_ms=elapsed_ms,
            **kwargs
        )

    def log_circuit_breaker(
        self,
        component: str,
        state: str,
        error_message: str = "",
        request_id: str = "",
        session_id: str = "",
        **kwargs
    ) -> ErrorLog:
        """
        Log a circuit breaker event.

        Args:
            component: Component with circuit breaker
            state: Circuit breaker state (open, closed, half-open)
            error_message: Description
            request_id: Request ID
            session_id: Session ID
            **kwargs: Additional fields

        Returns:
            ErrorLog instance
        """
        severity = ErrorSeverity.HIGH if state == "open" else ErrorSeverity.MEDIUM

        return self.log_error(
            error_message=error_message or f"Circuit breaker state: {state}",
            error_type="circuit_breaker",
            severity=severity,
            component=component,
            operation="circuit_breaker_transition",
            request_id=request_id,
            session_id=session_id,
            circuit_breaker_triggered=(state == "open"),
            circuit_breaker_state=state,
            **kwargs
        )

    def _extract_stack_frames(self, exception: Exception) -> List[Dict[str, Any]]:
        """Extract structured stack frame information."""
        frames = []
        tb = exception.__traceback__

        while tb is not None:
            frame = tb.tb_frame
            frames.append({
                'filename': frame.f_code.co_filename,
                'function': frame.f_code.co_name,
                'line_number': tb.tb_lineno,
                'locals': {k: str(v)[:100] for k, v in frame.f_locals.items()
                          if not k.startswith('_')},
            })
            tb = tb.tb_next

        return frames

    def _classify_exception_severity(self, exception: Exception) -> ErrorSeverity:
        """Auto-classify exception severity based on type."""
        exc_type = type(exception).__name__.lower()

        # Critical errors
        critical_patterns = ['memory', 'system', 'fatal', 'corruption']
        if any(p in exc_type for p in critical_patterns):
            return ErrorSeverity.CRITICAL

        # High severity
        high_patterns = ['authentication', 'authorization', 'permission', 'security']
        if any(p in exc_type for p in high_patterns):
            return ErrorSeverity.HIGH

        # Low severity
        low_patterns = ['validation', 'value', 'type', 'key']
        if any(p in exc_type for p in low_patterns):
            return ErrorSeverity.LOW

        # Default to medium
        return ErrorSeverity.MEDIUM

    def get_error_counts(self) -> Dict[str, int]:
        """Get error counts by type."""
        with self._lock:
            return self._error_counts.copy()

    def reset_error_counts(self):
        """Reset error counts."""
        with self._lock:
            self._error_counts = {}


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_logger: Optional[ErrorLogger] = None
_logger_lock = threading.Lock()


def get_error_logger() -> ErrorLogger:
    """Get the global error logger."""
    global _global_logger
    with _logger_lock:
        if _global_logger is None:
            _global_logger = ErrorLogger()
        return _global_logger


def set_error_logger(logger: ErrorLogger):
    """Set the global error logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = logger


def reset_error_logger():
    """Reset to default error logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def log_error(
    error_message: str,
    error_type: str = "general",
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    component: str = "",
    operation: str = "",
    stage: str = "",
    request_id: str = "",
    session_id: str = "",
    **kwargs
) -> ErrorLog:
    """
    Log an error.

    Example:
        log_error(
            error_message="Failed to connect to Qdrant",
            error_type="connection_error",
            severity=ErrorSeverity.HIGH,
            component="qdrant_client",
            operation="connect",
            stage="retrieval",
        )
    """
    logger = get_error_logger()
    return logger.log_error(
        error_message=error_message,
        error_type=error_type,
        severity=severity,
        component=component,
        operation=operation,
        stage=stage,
        request_id=request_id,
        session_id=session_id,
        **kwargs
    )


def log_exception(
    exception: Exception,
    component: str = "",
    operation: str = "",
    stage: str = "",
    request_id: str = "",
    session_id: str = "",
    **kwargs
) -> ErrorLog:
    """
    Log an exception with full stack trace.

    Example:
        try:
            result = risky_operation()
        except Exception as e:
            log_exception(
                exception=e,
                component="model_executor",
                operation="execute_request",
                stage="execution",
                request_id="req_123",
            )
    """
    logger = get_error_logger()
    return logger.log_exception(
        exception=exception,
        component=component,
        operation=operation,
        stage=stage,
        request_id=request_id,
        session_id=session_id,
        **kwargs
    )
