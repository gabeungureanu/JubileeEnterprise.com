# =============================================================================
# AUDIT COORDINATOR
# =============================================================================
"""
Unified audit coordination for the Inspire 8.0 pipeline.

This module provides centralized audit context management:
- Correlation of logs across pipeline stages
- Session-scoped audit trails
- Audit report generation
- Compliance and governance support

CRITICAL: The audit coordinator ties all logging together for
complete observability and accountability.
"""

import json
import threading
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from .base import (
    LogEntry,
    LogLevel,
    LogWriter,
    LogConfig,
    get_log_writer,
    get_log_config,
)


# =============================================================================
# AUDIT CONTEXT
# =============================================================================

@dataclass
class AuditContext:
    """
    Audit context for a single execution or session.

    Provides correlation IDs and tracks all related log entries.
    """
    # Identification
    audit_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    context_id: str = ""
    persona_id: str = ""

    # Timing
    started_at: str = field(default_factory=lambda: datetime.now().isoformat())
    ended_at: str = ""
    duration_ms: float = 0.0

    # User context
    user_id: str = ""
    user_session: str = ""

    # Log references (IDs of related logs)
    request_log_ids: List[str] = field(default_factory=list)
    retrieval_log_ids: List[str] = field(default_factory=list)
    activation_log_ids: List[str] = field(default_factory=list)
    error_log_ids: List[str] = field(default_factory=list)
    performance_log_ids: List[str] = field(default_factory=list)

    # Counts
    total_requests: int = 0
    total_retrievals: int = 0
    total_errors: int = 0

    # Token usage
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_routing_tokens: int = 0

    # Cost tracking
    estimated_cost_usd: float = 0.0

    # Status
    active: bool = True
    success: bool = True
    error_summary: str = ""

    # Metadata
    environment: str = ""
    pipeline_version: str = "8.0"

    def add_request(self, request_id: str, input_tokens: int = 0, output_tokens: int = 0):
        """Add a request to the audit context."""
        self.request_log_ids.append(request_id)
        self.total_requests += 1
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens

    def add_retrieval(self, retrieval_id: str):
        """Add a retrieval to the audit context."""
        self.retrieval_log_ids.append(retrieval_id)
        self.total_retrievals += 1

    def add_activation(self, activation_id: str):
        """Add an activation to the audit context."""
        self.activation_log_ids.append(activation_id)

    def add_error(self, error_id: str, message: str = ""):
        """Add an error to the audit context."""
        self.error_log_ids.append(error_id)
        self.total_errors += 1
        if message and not self.error_summary:
            self.error_summary = message

    def add_performance(self, performance_id: str):
        """Add a performance log to the audit context."""
        self.performance_log_ids.append(performance_id)

    def close(self, success: bool = True, error_summary: str = ""):
        """Close the audit context."""
        self.active = False
        self.ended_at = datetime.now().isoformat()
        self.success = success and self.total_errors == 0
        if error_summary:
            self.error_summary = error_summary

        # Calculate duration
        if self.started_at:
            try:
                start = datetime.fromisoformat(self.started_at)
                end = datetime.fromisoformat(self.ended_at)
                self.duration_ms = (end - start).total_seconds() * 1000
            except ValueError:
                pass

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'audit_id': self.audit_id,
            'session_id': self.session_id,
            'context_id': self.context_id,
            'persona_id': self.persona_id,
            'started_at': self.started_at,
            'ended_at': self.ended_at,
            'duration_ms': self.duration_ms,
            'user_id': self.user_id,
            'user_session': self.user_session,
            'request_log_ids': self.request_log_ids,
            'retrieval_log_ids': self.retrieval_log_ids,
            'activation_log_ids': self.activation_log_ids,
            'error_log_ids': self.error_log_ids,
            'performance_log_ids': self.performance_log_ids,
            'total_requests': self.total_requests,
            'total_retrievals': self.total_retrievals,
            'total_errors': self.total_errors,
            'total_input_tokens': self.total_input_tokens,
            'total_output_tokens': self.total_output_tokens,
            'total_routing_tokens': self.total_routing_tokens,
            'estimated_cost_usd': self.estimated_cost_usd,
            'active': self.active,
            'success': self.success,
            'error_summary': self.error_summary,
            'environment': self.environment,
            'pipeline_version': self.pipeline_version,
        }


# =============================================================================
# AUDIT REPORT
# =============================================================================

@dataclass
class AuditReport:
    """
    Complete audit report for a session or time period.

    Aggregates all logs and provides summary statistics.
    """
    # Identification
    report_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Scope
    audit_context_id: str = ""
    session_id: str = ""
    persona_id: str = ""
    period_start: str = ""
    period_end: str = ""

    # Execution summary
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    success_rate: float = 0.0

    # Token usage
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    average_tokens_per_request: float = 0.0

    # Cost summary
    estimated_total_cost_usd: float = 0.0
    cost_by_tier: Dict[str, float] = field(default_factory=dict)

    # Performance summary
    average_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    sla_compliance_rate: float = 0.0

    # Model usage
    requests_by_tier: Dict[str, int] = field(default_factory=dict)
    downgrades_applied: int = 0
    downgrade_rate: float = 0.0

    # Retrieval summary
    total_retrievals: int = 0
    average_chunks_per_retrieval: float = 0.0
    average_similarity_score: float = 0.0

    # Error summary
    total_errors: int = 0
    errors_by_type: Dict[str, int] = field(default_factory=dict)
    critical_errors: int = 0

    # Audit trail
    audit_contexts: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'report_id': self.report_id,
            'generated_at': self.generated_at,
            'audit_context_id': self.audit_context_id,
            'session_id': self.session_id,
            'persona_id': self.persona_id,
            'period_start': self.period_start,
            'period_end': self.period_end,
            'execution_summary': {
                'total_requests': self.total_requests,
                'successful_requests': self.successful_requests,
                'failed_requests': self.failed_requests,
                'success_rate': self.success_rate,
            },
            'token_usage': {
                'total_input_tokens': self.total_input_tokens,
                'total_output_tokens': self.total_output_tokens,
                'total_tokens': self.total_tokens,
                'average_tokens_per_request': self.average_tokens_per_request,
            },
            'cost_summary': {
                'estimated_total_cost_usd': self.estimated_total_cost_usd,
                'cost_by_tier': self.cost_by_tier,
            },
            'performance_summary': {
                'average_latency_ms': self.average_latency_ms,
                'p50_latency_ms': self.p50_latency_ms,
                'p95_latency_ms': self.p95_latency_ms,
                'p99_latency_ms': self.p99_latency_ms,
                'sla_compliance_rate': self.sla_compliance_rate,
            },
            'model_usage': {
                'requests_by_tier': self.requests_by_tier,
                'downgrades_applied': self.downgrades_applied,
                'downgrade_rate': self.downgrade_rate,
            },
            'retrieval_summary': {
                'total_retrievals': self.total_retrievals,
                'average_chunks_per_retrieval': self.average_chunks_per_retrieval,
                'average_similarity_score': self.average_similarity_score,
            },
            'error_summary': {
                'total_errors': self.total_errors,
                'errors_by_type': self.errors_by_type,
                'critical_errors': self.critical_errors,
            },
            'audit_contexts': self.audit_contexts,
        }

    def to_json(self, indent: int = 2) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=indent, default=str)


# =============================================================================
# AUDIT COORDINATOR
# =============================================================================

class AuditCoordinator:
    """
    Centralized coordinator for audit logging.

    Manages audit contexts and provides unified logging across
    all pipeline stages.
    """

    def __init__(self, config: LogConfig = None):
        self.config = config or get_log_config()
        self.writer = LogWriter(self.config)
        self._active_contexts: Dict[str, AuditContext] = {}
        self._completed_contexts: List[AuditContext] = []
        self._lock = threading.Lock()

    def start_context(
        self,
        session_id: str = "",
        context_id: str = "",
        persona_id: str = "",
        user_id: str = "",
        **kwargs
    ) -> AuditContext:
        """
        Start a new audit context.

        Call this at the beginning of a session or activation.

        Args:
            session_id: Session identifier
            context_id: Context identifier
            persona_id: Active persona
            user_id: User identifier
            **kwargs: Additional fields

        Returns:
            AuditContext instance
        """
        context = AuditContext(
            session_id=session_id,
            context_id=context_id or session_id,
            persona_id=persona_id,
            user_id=user_id,
        )

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(context, key):
                setattr(context, key, value)

        # Track active context
        with self._lock:
            self._active_contexts[context.audit_id] = context

        return context

    def get_context(self, audit_id: str) -> Optional[AuditContext]:
        """Get an active audit context by ID."""
        with self._lock:
            return self._active_contexts.get(audit_id)

    def get_context_by_session(self, session_id: str) -> Optional[AuditContext]:
        """Get an active audit context by session ID."""
        with self._lock:
            for context in self._active_contexts.values():
                if context.session_id == session_id:
                    return context
            return None

    def end_context(
        self,
        audit_id: str,
        success: bool = True,
        error_summary: str = ""
    ) -> Optional[AuditContext]:
        """
        End an audit context.

        Call this at the end of a session or activation.

        Args:
            audit_id: The audit context ID
            success: Whether the session was successful
            error_summary: Summary of errors if any

        Returns:
            Completed AuditContext
        """
        with self._lock:
            context = self._active_contexts.pop(audit_id, None)

        if context is None:
            return None

        context.close(success=success, error_summary=error_summary)

        # Save to completed list
        with self._lock:
            self._completed_contexts.append(context)

        # Write audit log
        self._write_context_log(context)

        return context

    def _write_context_log(self, context: AuditContext):
        """Write audit context to log file."""
        log_entry = LogEntry(
            log_type="audit",
            session_id=context.session_id,
            context_id=context.context_id,
            persona_id=context.persona_id,
            component="audit_coordinator",
            operation="context_close",
        )

        # Create a combined log with context data
        data = log_entry.to_dict()
        data['audit_context'] = context.to_dict()

        # Write directly
        try:
            log_file = self.config.get_log_file('audit')
            log_file.parent.mkdir(parents=True, exist_ok=True)

            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(data, default=str) + '\n')
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to write audit log: {e}")

    def generate_report(
        self,
        audit_id: str = None,
        session_id: str = None,
        include_completed: bool = True
    ) -> AuditReport:
        """
        Generate an audit report.

        Args:
            audit_id: Specific audit context ID
            session_id: Session to report on
            include_completed: Include completed contexts

        Returns:
            AuditReport instance
        """
        contexts = []

        with self._lock:
            if audit_id:
                ctx = self._active_contexts.get(audit_id)
                if ctx:
                    contexts.append(ctx)
            elif session_id:
                for ctx in self._active_contexts.values():
                    if ctx.session_id == session_id:
                        contexts.append(ctx)
                if include_completed:
                    for ctx in self._completed_contexts:
                        if ctx.session_id == session_id:
                            contexts.append(ctx)
            else:
                contexts.extend(self._active_contexts.values())
                if include_completed:
                    contexts.extend(self._completed_contexts)

        report = AuditReport(
            session_id=session_id or "",
            period_start=min((c.started_at for c in contexts), default=""),
            period_end=max((c.ended_at or c.started_at for c in contexts), default=""),
        )

        # Aggregate statistics
        for ctx in contexts:
            report.total_requests += ctx.total_requests
            report.total_retrievals += ctx.total_retrievals
            report.total_errors += ctx.total_errors
            report.total_input_tokens += ctx.total_input_tokens
            report.total_output_tokens += ctx.total_output_tokens
            report.estimated_total_cost_usd += ctx.estimated_cost_usd
            report.audit_contexts.append(ctx.to_dict())

            if ctx.success:
                report.successful_requests += ctx.total_requests
            else:
                report.failed_requests += ctx.total_requests

        # Calculate derived metrics
        report.total_tokens = report.total_input_tokens + report.total_output_tokens

        if report.total_requests > 0:
            report.success_rate = report.successful_requests / report.total_requests
            report.average_tokens_per_request = report.total_tokens / report.total_requests

        return report

    def save_report(self, report: AuditReport, filename: str = None) -> Path:
        """
        Save an audit report to file.

        Args:
            report: The report to save
            filename: Optional filename (default: auto-generated)

        Returns:
            Path to saved file
        """
        if filename is None:
            filename = f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        report_dir = self.config.get_log_dir('audit') / 'reports'
        report_dir.mkdir(parents=True, exist_ok=True)

        report_file = report_dir / filename
        report_file.write_text(report.to_json())

        return report_file

    def get_active_context_count(self) -> int:
        """Get count of active contexts."""
        with self._lock:
            return len(self._active_contexts)

    def get_completed_context_count(self) -> int:
        """Get count of completed contexts."""
        with self._lock:
            return len(self._completed_contexts)

    def clear_completed_contexts(self):
        """Clear completed contexts (after archiving)."""
        with self._lock:
            self._completed_contexts = []


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_coordinator: Optional[AuditCoordinator] = None
_coordinator_lock = threading.Lock()


def get_audit_coordinator() -> AuditCoordinator:
    """Get the global audit coordinator."""
    global _global_coordinator
    with _coordinator_lock:
        if _global_coordinator is None:
            _global_coordinator = AuditCoordinator()
        return _global_coordinator


def set_audit_coordinator(coordinator: AuditCoordinator):
    """Set the global audit coordinator."""
    global _global_coordinator
    with _coordinator_lock:
        _global_coordinator = coordinator


def reset_audit_coordinator():
    """Reset to default audit coordinator."""
    global _global_coordinator
    with _coordinator_lock:
        _global_coordinator = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def start_audit_context(
    session_id: str = "",
    context_id: str = "",
    persona_id: str = "",
    user_id: str = "",
    **kwargs
) -> AuditContext:
    """
    Start a new audit context.

    Example:
        context = start_audit_context(
            session_id="sess_123",
            persona_id="inspire_pastor",
            user_id="user_456",
        )

        # ... perform operations ...

        end_audit_context(context.audit_id)
    """
    coordinator = get_audit_coordinator()
    return coordinator.start_context(
        session_id=session_id,
        context_id=context_id,
        persona_id=persona_id,
        user_id=user_id,
        **kwargs
    )


def end_audit_context(
    audit_id: str,
    success: bool = True,
    error_summary: str = ""
) -> Optional[AuditContext]:
    """
    End an audit context.

    Example:
        end_audit_context(context.audit_id, success=True)
    """
    coordinator = get_audit_coordinator()
    return coordinator.end_context(
        audit_id=audit_id,
        success=success,
        error_summary=error_summary
    )
