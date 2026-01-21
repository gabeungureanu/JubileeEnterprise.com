# =============================================================================
# PERFORMANCE LOGGER
# =============================================================================
"""
Performance logging for the Inspire 8.0 pipeline.

This module captures latency and timing information:
- Latency per pipeline stage
- Overall execution duration
- Bottleneck identification
- Resource utilization metrics

CRITICAL: Performance logging enables optimization and SLA monitoring.
"""

import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Generator, List, Optional

from .base import (
    LogEntry,
    LogLevel,
    LogWriter,
    get_log_writer,
    get_log_config,
)


# =============================================================================
# STAGE METRICS
# =============================================================================

@dataclass
class StageMetrics:
    """
    Metrics for a single pipeline stage.

    Captures timing and count information for performance analysis.
    """
    stage_name: str = ""
    started_at: str = ""
    completed_at: str = ""
    duration_ms: float = 0.0

    # Counts
    items_processed: int = 0
    items_per_second: float = 0.0

    # Sub-stages
    sub_stages: List[Dict[str, Any]] = field(default_factory=list)

    # Status
    success: bool = True
    error_message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'stage_name': self.stage_name,
            'started_at': self.started_at,
            'completed_at': self.completed_at,
            'duration_ms': self.duration_ms,
            'items_processed': self.items_processed,
            'items_per_second': self.items_per_second,
            'sub_stages': self.sub_stages,
            'success': self.success,
            'error_message': self.error_message,
        }


# =============================================================================
# PERFORMANCE LOG ENTRY
# =============================================================================

@dataclass
class PerformanceLog(LogEntry):
    """
    Detailed log entry for performance metrics.

    Captures timing information across all pipeline stages
    for a single execution.
    """
    log_type: str = "performance"

    # Execution identification
    execution_id: str = ""
    parent_request_id: str = ""

    # Overall timing
    total_duration_ms: float = 0.0
    started_at: str = ""
    completed_at: str = ""

    # Stage breakdown
    stages: List[Dict[str, Any]] = field(default_factory=list)
    stage_count: int = 0

    # Key timings (commonly accessed)
    routing_ms: float = 0.0
    classification_ms: float = 0.0
    retrieval_ms: float = 0.0
    embedding_ms: float = 0.0
    model_execution_ms: float = 0.0
    response_processing_ms: float = 0.0

    # Bottleneck analysis
    slowest_stage: str = ""
    slowest_stage_ms: float = 0.0
    slowest_stage_pct: float = 0.0

    # Throughput
    tokens_per_second: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0

    # Resource metrics
    memory_used_mb: float = 0.0
    cpu_percent: float = 0.0

    # SLA tracking
    sla_target_ms: float = 0.0
    sla_met: bool = True
    sla_margin_ms: float = 0.0

    # Percentile context
    p50_benchmark_ms: float = 0.0
    p95_benchmark_ms: float = 0.0
    p99_benchmark_ms: float = 0.0
    percentile_bucket: str = ""  # p50, p95, p99, outlier

    def add_stage(self, stage: StageMetrics):
        """Add a stage to the log."""
        self.stages.append(stage.to_dict())
        self.stage_count = len(self.stages)

        # Update bottleneck
        if stage.duration_ms > self.slowest_stage_ms:
            self.slowest_stage = stage.stage_name
            self.slowest_stage_ms = stage.duration_ms

        # Update total duration and percentages
        if self.total_duration_ms > 0:
            self.slowest_stage_pct = (self.slowest_stage_ms / self.total_duration_ms) * 100

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with all fields."""
        data = super().to_dict()
        return data


# =============================================================================
# PERFORMANCE TIMER
# =============================================================================

class PerformanceTimer:
    """
    Context manager for timing code sections.

    Provides easy-to-use timing for pipeline stages.

    Example:
        with PerformanceTimer("retrieval") as timer:
            results = search_qdrant(query)
        print(f"Retrieval took {timer.duration_ms}ms")
    """

    def __init__(self, stage_name: str):
        self.stage_name = stage_name
        self.start_time: float = 0.0
        self.end_time: float = 0.0
        self.duration_ms: float = 0.0
        self.started_at: str = ""
        self.completed_at: str = ""
        self.items_processed: int = 0
        self.success: bool = True
        self.error_message: str = ""

    def __enter__(self) -> 'PerformanceTimer':
        self.start_time = time.perf_counter()
        self.started_at = datetime.now().isoformat()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.completed_at = datetime.now().isoformat()
        self.duration_ms = (self.end_time - self.start_time) * 1000

        if exc_type is not None:
            self.success = False
            self.error_message = str(exc_val)

        return False  # Don't suppress exceptions

    def set_items_processed(self, count: int):
        """Set the number of items processed."""
        self.items_processed = count

    def to_stage_metrics(self) -> StageMetrics:
        """Convert to StageMetrics."""
        items_per_second = 0.0
        if self.duration_ms > 0 and self.items_processed > 0:
            items_per_second = self.items_processed / (self.duration_ms / 1000)

        return StageMetrics(
            stage_name=self.stage_name,
            started_at=self.started_at,
            completed_at=self.completed_at,
            duration_ms=self.duration_ms,
            items_processed=self.items_processed,
            items_per_second=items_per_second,
            success=self.success,
            error_message=self.error_message,
        )


# =============================================================================
# PERFORMANCE LOGGER
# =============================================================================

class PerformanceLogger:
    """
    Logger for performance metrics.

    Provides methods to log execution timing and identify bottlenecks.
    """

    def __init__(self, writer: LogWriter = None):
        self.writer = writer or get_log_writer()
        self._active_executions: Dict[str, PerformanceLog] = {}
        self._stage_timers: Dict[str, List[PerformanceTimer]] = {}
        self._lock = threading.Lock()

        # Benchmarks (can be updated based on historical data)
        self._benchmarks = {
            'p50': 500.0,   # 500ms
            'p95': 2000.0,  # 2s
            'p99': 5000.0,  # 5s
        }

    def start_execution(
        self,
        execution_id: str,
        request_id: str = "",
        session_id: str = "",
        sla_target_ms: float = 0.0,
        **kwargs
    ) -> PerformanceLog:
        """
        Start tracking execution performance.

        Call this at the beginning of request processing.

        Args:
            execution_id: Unique execution identifier
            request_id: Related request ID
            session_id: Session ID
            sla_target_ms: SLA target in milliseconds
            **kwargs: Additional fields

        Returns:
            PerformanceLog instance
        """
        log = PerformanceLog(
            execution_id=execution_id,
            parent_request_id=request_id,
            session_id=session_id,
            sla_target_ms=sla_target_ms,
            started_at=datetime.now().isoformat(),
            component="performance_logger",
            operation="execution_timing",
            p50_benchmark_ms=self._benchmarks['p50'],
            p95_benchmark_ms=self._benchmarks['p95'],
            p99_benchmark_ms=self._benchmarks['p99'],
        )

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Track active execution
        with self._lock:
            self._active_executions[execution_id] = log
            self._stage_timers[execution_id] = []

        return log

    @contextmanager
    def time_stage(
        self,
        execution_id: str,
        stage_name: str
    ) -> Generator[PerformanceTimer, None, None]:
        """
        Context manager for timing a stage.

        Example:
            with logger.time_stage(exec_id, "retrieval") as timer:
                results = search(query)
                timer.set_items_processed(len(results))

        Args:
            execution_id: The execution ID
            stage_name: Name of the stage

        Yields:
            PerformanceTimer instance
        """
        timer = PerformanceTimer(stage_name)
        try:
            yield timer.__enter__()
        finally:
            timer.__exit__(*sys.exc_info())

            # Add to execution log
            with self._lock:
                if execution_id in self._stage_timers:
                    self._stage_timers[execution_id].append(timer)

    def add_stage_timing(
        self,
        execution_id: str,
        stage_name: str,
        duration_ms: float,
        items_processed: int = 0,
        success: bool = True,
        **kwargs
    ):
        """
        Add stage timing manually.

        Use this when you can't use the context manager.

        Args:
            execution_id: The execution ID
            stage_name: Name of the stage
            duration_ms: Stage duration
            items_processed: Number of items processed
            success: Whether stage succeeded
            **kwargs: Additional fields for StageMetrics
        """
        stage = StageMetrics(
            stage_name=stage_name,
            duration_ms=duration_ms,
            items_processed=items_processed,
            success=success,
            started_at=datetime.now().isoformat(),
            completed_at=datetime.now().isoformat(),
        )

        with self._lock:
            log = self._active_executions.get(execution_id)
            if log:
                log.add_stage(stage)

    def complete_execution(
        self,
        execution_id: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        **kwargs
    ) -> Optional[PerformanceLog]:
        """
        Complete execution tracking.

        Call this at the end of request processing.

        Args:
            execution_id: The execution ID
            input_tokens: Input token count
            output_tokens: Output token count
            **kwargs: Additional fields

        Returns:
            Completed PerformanceLog
        """
        with self._lock:
            log = self._active_executions.pop(execution_id, None)
            timers = self._stage_timers.pop(execution_id, [])

        if log is None:
            log = PerformanceLog(
                execution_id=execution_id,
                level=LogLevel.WARNING,
            )

        # Add stage timers
        for timer in timers:
            log.add_stage(timer.to_stage_metrics())

            # Map to specific stage fields
            stage_mapping = {
                'routing': 'routing_ms',
                'classification': 'classification_ms',
                'retrieval': 'retrieval_ms',
                'embedding': 'embedding_ms',
                'model_execution': 'model_execution_ms',
                'execution': 'model_execution_ms',
                'response_processing': 'response_processing_ms',
            }
            if timer.stage_name in stage_mapping:
                setattr(log, stage_mapping[timer.stage_name], timer.duration_ms)

        # Calculate total duration
        now = datetime.now()
        log.completed_at = now.isoformat()

        if log.started_at:
            try:
                start = datetime.fromisoformat(log.started_at)
                log.total_duration_ms = (now - start).total_seconds() * 1000
            except ValueError:
                log.total_duration_ms = sum(s['duration_ms'] for s in log.stages)

        # Token metrics
        log.input_tokens = input_tokens
        log.output_tokens = output_tokens
        total_tokens = input_tokens + output_tokens
        if log.total_duration_ms > 0 and total_tokens > 0:
            log.tokens_per_second = total_tokens / (log.total_duration_ms / 1000)

        # SLA check
        if log.sla_target_ms > 0:
            log.sla_met = log.total_duration_ms <= log.sla_target_ms
            log.sla_margin_ms = log.sla_target_ms - log.total_duration_ms

        # Percentile bucket
        log.percentile_bucket = self._classify_percentile(log.total_duration_ms)

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def log_performance(
        self,
        request_id: str = "",
        session_id: str = "",
        total_duration_ms: float = 0.0,
        routing_ms: float = 0.0,
        retrieval_ms: float = 0.0,
        model_execution_ms: float = 0.0,
        input_tokens: int = 0,
        output_tokens: int = 0,
        sla_target_ms: float = 0.0,
        **kwargs
    ) -> PerformanceLog:
        """
        Log performance metrics in one call.

        Convenience method for logging after-the-fact.

        Args:
            request_id: Request ID
            session_id: Session ID
            total_duration_ms: Total execution time
            routing_ms: Routing stage time
            retrieval_ms: Retrieval stage time
            model_execution_ms: Model execution time
            input_tokens: Input tokens
            output_tokens: Output tokens
            sla_target_ms: SLA target
            **kwargs: Additional fields

        Returns:
            PerformanceLog instance
        """
        import uuid
        now = datetime.now()

        log = PerformanceLog(
            execution_id=str(uuid.uuid4()),
            parent_request_id=request_id,
            session_id=session_id,
            total_duration_ms=total_duration_ms,
            started_at=now.isoformat(),
            completed_at=now.isoformat(),
            routing_ms=routing_ms,
            retrieval_ms=retrieval_ms,
            model_execution_ms=model_execution_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            sla_target_ms=sla_target_ms,
            p50_benchmark_ms=self._benchmarks['p50'],
            p95_benchmark_ms=self._benchmarks['p95'],
            p99_benchmark_ms=self._benchmarks['p99'],
            component="performance_logger",
            operation="execution_timing",
        )

        # Calculate derived metrics
        total_tokens = input_tokens + output_tokens
        if total_duration_ms > 0 and total_tokens > 0:
            log.tokens_per_second = total_tokens / (total_duration_ms / 1000)

        # SLA check
        if sla_target_ms > 0:
            log.sla_met = total_duration_ms <= sla_target_ms
            log.sla_margin_ms = sla_target_ms - total_duration_ms

        # Percentile bucket
        log.percentile_bucket = self._classify_percentile(total_duration_ms)

        # Identify bottleneck
        stage_times = {
            'routing': routing_ms,
            'retrieval': retrieval_ms,
            'model_execution': model_execution_ms,
        }
        if stage_times:
            slowest = max(stage_times, key=stage_times.get)
            log.slowest_stage = slowest
            log.slowest_stage_ms = stage_times[slowest]
            if total_duration_ms > 0:
                log.slowest_stage_pct = (stage_times[slowest] / total_duration_ms) * 100

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def _classify_percentile(self, duration_ms: float) -> str:
        """Classify duration into percentile bucket."""
        if duration_ms <= self._benchmarks['p50']:
            return "p50"
        elif duration_ms <= self._benchmarks['p95']:
            return "p95"
        elif duration_ms <= self._benchmarks['p99']:
            return "p99"
        else:
            return "outlier"

    def set_benchmarks(self, p50: float, p95: float, p99: float):
        """Update benchmark values."""
        self._benchmarks = {'p50': p50, 'p95': p95, 'p99': p99}


# Need to import sys for exc_info
import sys


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_logger: Optional[PerformanceLogger] = None
_logger_lock = threading.Lock()


def get_performance_logger() -> PerformanceLogger:
    """Get the global performance logger."""
    global _global_logger
    with _logger_lock:
        if _global_logger is None:
            _global_logger = PerformanceLogger()
        return _global_logger


def set_performance_logger(logger: PerformanceLogger):
    """Set the global performance logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = logger


def reset_performance_logger():
    """Reset to default performance logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def log_performance(
    request_id: str = "",
    session_id: str = "",
    total_duration_ms: float = 0.0,
    routing_ms: float = 0.0,
    retrieval_ms: float = 0.0,
    model_execution_ms: float = 0.0,
    input_tokens: int = 0,
    output_tokens: int = 0,
    sla_target_ms: float = 0.0,
    **kwargs
) -> PerformanceLog:
    """
    Log performance metrics.

    Example:
        log_performance(
            request_id="req_123",
            total_duration_ms=1500.0,
            routing_ms=50.0,
            retrieval_ms=200.0,
            model_execution_ms=1200.0,
            input_tokens=500,
            output_tokens=300,
            sla_target_ms=2000.0,
        )
    """
    logger = get_performance_logger()
    return logger.log_performance(
        request_id=request_id,
        session_id=session_id,
        total_duration_ms=total_duration_ms,
        routing_ms=routing_ms,
        retrieval_ms=retrieval_ms,
        model_execution_ms=model_execution_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        sla_target_ms=sla_target_ms,
        **kwargs
    )
