# =============================================================================
# LOGGING BASE CLASSES
# =============================================================================
"""
Base classes and utilities for the Inspire 8.0 logging system.

This module provides the foundation for all logging operations:
- LogLevel enum for severity classification
- LogEntry base dataclass for all log types
- LogWriter for file-based log persistence
- LogConfig for global logging configuration
"""

import json
import logging
import os
import threading
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

# Standard Python logger for internal logging
logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class LogLevel(Enum):
    """Log severity levels."""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


# =============================================================================
# BASE LOG ENTRY
# =============================================================================

@dataclass
class LogEntry:
    """
    Base class for all log entries.

    All log types inherit from this and add their specific fields.
    This ensures consistent metadata across all logs.
    """
    # Unique identifiers
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    # Context identifiers for correlation
    session_id: str = ""
    context_id: str = ""
    request_id: str = ""
    persona_id: str = ""

    # Classification
    log_type: str = "base"
    level: LogLevel = LogLevel.INFO

    # Source information
    component: str = ""
    operation: str = ""

    # Version tracking
    pipeline_version: str = "8.0"
    log_schema_version: str = "1.0"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['level'] = self.level.value
        return data

    def to_json(self, indent: int = None) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=indent, default=str)


# =============================================================================
# LOG CONFIGURATION
# =============================================================================

@dataclass
class LogConfig:
    """
    Global configuration for the logging system.

    Controls where logs are written, what is logged, and formatting.
    """
    # Base directory for all logs
    base_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs'
    ))

    # Subdirectories for each log type
    execution_dir: str = "execution"
    retrieval_dir: str = "retrieval"
    activation_dir: str = "activation"
    error_dir: str = "error"
    performance_dir: str = "performance"
    audit_dir: str = "audit"

    # Log file settings
    file_prefix: str = ""
    file_suffix: str = ".jsonl"  # JSON Lines format
    rotate_daily: bool = True
    max_file_size_mb: int = 100

    # Content settings
    min_level: LogLevel = LogLevel.DEBUG
    include_timestamps: bool = True
    include_context_ids: bool = True
    pretty_print: bool = False  # Compact for production, pretty for debug

    # Performance settings
    async_write: bool = True
    buffer_size: int = 100
    flush_interval_seconds: int = 5

    # Safety settings
    log_failures_silently: bool = True  # Never block execution on log failure
    max_message_length: int = 10000  # Truncate very long messages

    def get_log_dir(self, log_type: str) -> Path:
        """Get the directory for a specific log type."""
        type_dirs = {
            'execution': self.execution_dir,
            'retrieval': self.retrieval_dir,
            'activation': self.activation_dir,
            'error': self.error_dir,
            'performance': self.performance_dir,
            'audit': self.audit_dir,
        }
        subdir = type_dirs.get(log_type, log_type)
        return self.base_dir / subdir

    def get_log_file(self, log_type: str, date: datetime = None) -> Path:
        """Get the log file path for a specific type and date."""
        if date is None:
            date = datetime.now()

        log_dir = self.get_log_dir(log_type)

        if self.rotate_daily:
            date_str = date.strftime('%Y%m%d')
            filename = f"{self.file_prefix}{log_type}_{date_str}{self.file_suffix}"
        else:
            filename = f"{self.file_prefix}{log_type}{self.file_suffix}"

        return log_dir / filename


# =============================================================================
# LOG WRITER
# =============================================================================

class LogWriter:
    """
    Thread-safe log writer for persisting logs to files.

    Features:
    - Thread-safe writing with locks
    - Buffered writes for performance
    - Automatic directory creation
    - Graceful failure handling
    """

    def __init__(self, config: LogConfig = None):
        self.config = config or LogConfig()
        self._lock = threading.Lock()
        self._buffers: Dict[str, List[str]] = {}
        self._last_flush: Dict[str, datetime] = {}

    def write(self, entry: LogEntry, log_type: str = None) -> bool:
        """
        Write a log entry to the appropriate file.

        Args:
            entry: The log entry to write
            log_type: Override log type (default: use entry.log_type)

        Returns:
            True if successful, False if failed
        """
        if log_type is None:
            log_type = entry.log_type

        # Check minimum level
        if self._level_value(entry.level) < self._level_value(self.config.min_level):
            return True  # Silently skip, not a failure

        try:
            # Format the entry
            if self.config.pretty_print:
                line = entry.to_json(indent=2)
            else:
                line = entry.to_json()

            # Add to buffer or write directly
            if self.config.async_write:
                return self._buffer_write(log_type, line)
            else:
                return self._direct_write(log_type, line)

        except Exception as e:
            if self.config.log_failures_silently:
                logger.warning(f"Log write failed: {e}")
                return False
            else:
                raise

    def _buffer_write(self, log_type: str, line: str) -> bool:
        """Add line to buffer, flush if needed."""
        with self._lock:
            if log_type not in self._buffers:
                self._buffers[log_type] = []
                self._last_flush[log_type] = datetime.now()

            self._buffers[log_type].append(line)

            # Check if we should flush
            should_flush = (
                len(self._buffers[log_type]) >= self.config.buffer_size or
                (datetime.now() - self._last_flush[log_type]).seconds >= self.config.flush_interval_seconds
            )

            if should_flush:
                return self._flush_buffer(log_type)

            return True

    def _flush_buffer(self, log_type: str) -> bool:
        """Flush buffered entries to file."""
        if log_type not in self._buffers or not self._buffers[log_type]:
            return True

        lines = self._buffers[log_type]
        self._buffers[log_type] = []
        self._last_flush[log_type] = datetime.now()

        return self._write_lines(log_type, lines)

    def _direct_write(self, log_type: str, line: str) -> bool:
        """Write line directly to file."""
        return self._write_lines(log_type, [line])

    def _write_lines(self, log_type: str, lines: List[str]) -> bool:
        """Write multiple lines to the log file."""
        try:
            log_file = self.config.get_log_file(log_type)

            # Ensure directory exists
            log_file.parent.mkdir(parents=True, exist_ok=True)

            # Append to file
            with open(log_file, 'a', encoding='utf-8') as f:
                for line in lines:
                    f.write(line + '\n')

            return True

        except Exception as e:
            logger.warning(f"Failed to write {len(lines)} lines to {log_type}: {e}")
            return False

    def flush_all(self) -> bool:
        """Flush all buffered entries."""
        success = True
        with self._lock:
            for log_type in list(self._buffers.keys()):
                if not self._flush_buffer(log_type):
                    success = False
        return success

    def _level_value(self, level: LogLevel) -> int:
        """Get numeric value for level comparison."""
        values = {
            LogLevel.DEBUG: 0,
            LogLevel.INFO: 1,
            LogLevel.WARNING: 2,
            LogLevel.ERROR: 3,
            LogLevel.CRITICAL: 4,
        }
        return values.get(level, 0)


# =============================================================================
# GLOBAL INSTANCES
# =============================================================================

_global_config: Optional[LogConfig] = None
_global_writer: Optional[LogWriter] = None
_config_lock = threading.Lock()


def get_log_config() -> LogConfig:
    """Get the global log configuration."""
    global _global_config
    with _config_lock:
        if _global_config is None:
            _global_config = LogConfig()
        return _global_config


def set_log_config(config: LogConfig):
    """Set the global log configuration."""
    global _global_config, _global_writer
    with _config_lock:
        _global_config = config
        _global_writer = LogWriter(config)


def reset_log_config():
    """Reset to default configuration."""
    global _global_config, _global_writer
    with _config_lock:
        _global_config = None
        _global_writer = None


def get_log_writer() -> LogWriter:
    """Get the global log writer."""
    global _global_writer
    with _config_lock:
        if _global_writer is None:
            _global_writer = LogWriter(get_log_config())
        return _global_writer
