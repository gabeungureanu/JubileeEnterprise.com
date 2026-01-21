# =============================================================================
# INSPIRE 8.0 LOGGING AND AUDITING SYSTEM
# =============================================================================
"""
Comprehensive logging and auditing for the Inspire 8.0 pipeline.

This module implements production-grade logging across all pipeline stages,
ensuring observability, accountability, and long-term system reliability.

LOG CATEGORIES:

1. REQUEST LOGS (execution_logs/):
   - Every model execution with full metadata
   - Selected model, token usage, routing decision
   - Downgrade status, session identifiers
   - Latency and timing information

2. RETRIEVAL LOGS (retrieval_logs/):
   - Every similarity search and memory lookup
   - Chunks retrieved with IDs and scores
   - Collection metadata, retrieval order
   - Query vectors and parameters

3. ACTIVATION LOGS (activation_logs/):
   - Every persona ignition event
   - Activation anchors loaded with metadata
   - Anchor type, priority, source, version
   - Load order for deterministic replay

4. ERROR LOGS (error_logs/):
   - Execution failures and exceptions
   - Timeouts and circuit breaker events
   - Stack traces and context

5. PERFORMANCE LOGS (performance_logs/):
   - Latency per pipeline stage
   - Overall execution duration
   - Bottleneck identification

LOG FORMAT:
All logs are written in structured JSON format for:
- Manual review and debugging
- Programmatic querying and analysis
- Audit and compliance requirements
- Cost analysis and optimization

CRITICAL INVARIANTS:
1. ALL executions MUST be logged (no silent operations)
2. Logs are IMMUTABLE once written (append-only)
3. Logs include TIMESTAMPS for ordering
4. Logs include CONTEXT IDs for correlation
5. Logs are STRUCTURED (machine-readable JSON)
6. Logging failures NEVER block execution
"""

from .base import (
    LogLevel,
    LogEntry,
    LogWriter,
    LogConfig,
    get_log_config,
    set_log_config,
    reset_log_config,
)
from .request_logger import (
    RequestLog,
    RequestLogger,
    get_request_logger,
    set_request_logger,
    reset_request_logger,
    log_request,
)
from .retrieval_logger import (
    RetrievalLog,
    ChunkInfo,
    RetrievalLogger,
    get_retrieval_logger,
    set_retrieval_logger,
    reset_retrieval_logger,
    log_retrieval,
)
from .activation_logger import (
    ActivationLog,
    AnchorInfo,
    ActivationLogger,
    get_activation_logger,
    set_activation_logger,
    reset_activation_logger,
    log_activation,
)
from .error_logger import (
    ErrorLog,
    ErrorSeverity,
    ErrorLogger,
    get_error_logger,
    set_error_logger,
    reset_error_logger,
    log_error,
    log_exception,
)
from .performance_logger import (
    PerformanceLog,
    StageMetrics,
    PerformanceLogger,
    get_performance_logger,
    set_performance_logger,
    reset_performance_logger,
    log_performance,
    PerformanceTimer,
)
from .audit_coordinator import (
    AuditCoordinator,
    AuditContext,
    AuditReport,
    get_audit_coordinator,
    set_audit_coordinator,
    reset_audit_coordinator,
    start_audit_context,
    end_audit_context,
)

__all__ = [
    # Base
    'LogLevel',
    'LogEntry',
    'LogWriter',
    'LogConfig',
    'get_log_config',
    'set_log_config',
    'reset_log_config',
    # Request logging
    'RequestLog',
    'RequestLogger',
    'get_request_logger',
    'set_request_logger',
    'reset_request_logger',
    'log_request',
    # Retrieval logging
    'RetrievalLog',
    'ChunkInfo',
    'RetrievalLogger',
    'get_retrieval_logger',
    'set_retrieval_logger',
    'reset_retrieval_logger',
    'log_retrieval',
    # Activation logging
    'ActivationLog',
    'AnchorInfo',
    'ActivationLogger',
    'get_activation_logger',
    'set_activation_logger',
    'reset_activation_logger',
    'log_activation',
    # Error logging
    'ErrorLog',
    'ErrorSeverity',
    'ErrorLogger',
    'get_error_logger',
    'set_error_logger',
    'reset_error_logger',
    'log_error',
    'log_exception',
    # Performance logging
    'PerformanceLog',
    'StageMetrics',
    'PerformanceLogger',
    'get_performance_logger',
    'set_performance_logger',
    'reset_performance_logger',
    'log_performance',
    'PerformanceTimer',
    # Audit coordination
    'AuditCoordinator',
    'AuditContext',
    'AuditReport',
    'get_audit_coordinator',
    'set_audit_coordinator',
    'reset_audit_coordinator',
    'start_audit_context',
    'end_audit_context',
]

__version__ = '1.0.0'
