# =============================================================================
# INGESTION LOGGING AND REPORTING
# =============================================================================
"""
Provides structured logging and run report generation for ingestion auditing.

All ingestion activity is logged with:
- Timestamps
- Operation types
- Source files
- Chunk counts
- Embedding stats
- Upsert results
- Errors and warnings
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class RunStats:
    """Statistics for a single ingestion run."""
    run_id: str
    script_name: str
    collection: str
    started_at: str = ""
    completed_at: str = ""
    duration_seconds: float = 0.0

    # Source stats
    files_found: int = 0
    files_processed: int = 0
    files_skipped: int = 0
    files_errored: int = 0

    # Chunk stats
    chunks_created: int = 0
    chunks_skipped_duplicate: int = 0
    total_tokens: int = 0
    avg_chunk_tokens: float = 0.0

    # Embedding stats
    embeddings_generated: int = 0
    embeddings_cached: int = 0
    embedding_errors: int = 0
    embedding_api_calls: int = 0

    # Upsert stats
    points_upserted: int = 0
    points_skipped: int = 0
    upsert_batches: int = 0

    # Errors
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Status
    status: str = "pending"  # pending, running, completed, failed


class IngestionLogger:
    """
    Structured logger for ingestion operations.

    Provides both console and file logging with configurable levels.
    """

    def __init__(
        self,
        name: str,
        log_dir: str = "logs",
        level: int = logging.INFO,
        console_output: bool = True
    ):
        """
        Initialize the logger.

        Args:
            name: Logger name (usually script name)
            log_dir: Directory for log files
            level: Logging level
            console_output: Whether to also log to console
        """
        self.name = name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Create logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        self.logger.handlers = []  # Clear existing handlers

        # File handler
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = self.log_dir / f"{name}_{timestamp}.log"
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(level)
        file_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        self.logger.addHandler(file_handler)

        # Console handler
        if console_output:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(level)
            console_formatter = logging.Formatter(
                '%(asctime)s | %(levelname)-8s | %(message)s',
                datefmt='%H:%M:%S'
            )
            console_handler.setFormatter(console_formatter)
            self.logger.addHandler(console_handler)

        self.log_file = log_file

    def info(self, message: str, **kwargs):
        """Log info message with optional structured data."""
        if kwargs:
            message = f"{message} | {json.dumps(kwargs)}"
        self.logger.info(message)

    def warning(self, message: str, **kwargs):
        """Log warning message."""
        if kwargs:
            message = f"{message} | {json.dumps(kwargs)}"
        self.logger.warning(message)

    def error(self, message: str, exc_info: bool = False, **kwargs):
        """Log error message with optional exception info."""
        if kwargs:
            message = f"{message} | {json.dumps(kwargs)}"
        self.logger.error(message, exc_info=exc_info)

    def debug(self, message: str, **kwargs):
        """Log debug message."""
        if kwargs:
            message = f"{message} | {json.dumps(kwargs)}"
        self.logger.debug(message)

    def section(self, title: str):
        """Log a section divider."""
        separator = "=" * 60
        self.logger.info(separator)
        self.logger.info(f"  {title}")
        self.logger.info(separator)

    def progress(self, current: int, total: int, message: str = ""):
        """Log progress update."""
        pct = (current / total * 100) if total > 0 else 0
        self.logger.info(f"Progress: {current}/{total} ({pct:.1f}%) {message}")


def create_run_report(
    stats: RunStats,
    report_dir: str = "reports",
    include_errors: bool = True
) -> str:
    """
    Create a structured run report in JSON format.

    Args:
        stats: RunStats object with all statistics
        report_dir: Directory to save report
        include_errors: Whether to include detailed error list

    Returns:
        Path to the generated report file
    """
    report_path = Path(report_dir)
    report_path.mkdir(parents=True, exist_ok=True)

    # Build report
    report = {
        "report_version": "1.0",
        "generated_at": datetime.now().isoformat(),
        "run_metadata": {
            "run_id": stats.run_id,
            "script_name": stats.script_name,
            "collection": stats.collection,
            "started_at": stats.started_at,
            "completed_at": stats.completed_at,
            "duration_seconds": stats.duration_seconds,
            "status": stats.status,
        },
        "source_stats": {
            "files_found": stats.files_found,
            "files_processed": stats.files_processed,
            "files_skipped": stats.files_skipped,
            "files_errored": stats.files_errored,
        },
        "chunk_stats": {
            "chunks_created": stats.chunks_created,
            "chunks_skipped_duplicate": stats.chunks_skipped_duplicate,
            "total_tokens": stats.total_tokens,
            "avg_chunk_tokens": stats.avg_chunk_tokens,
        },
        "embedding_stats": {
            "embeddings_generated": stats.embeddings_generated,
            "embeddings_cached": stats.embeddings_cached,
            "embedding_errors": stats.embedding_errors,
            "embedding_api_calls": stats.embedding_api_calls,
        },
        "upsert_stats": {
            "points_upserted": stats.points_upserted,
            "points_skipped": stats.points_skipped,
            "upsert_batches": stats.upsert_batches,
        },
        "warnings": stats.warnings,
    }

    if include_errors:
        report["errors"] = stats.errors

    # Summary
    report["summary"] = {
        "success": stats.status == "completed" and len(stats.errors) == 0,
        "total_points_added": stats.points_upserted,
        "error_count": len(stats.errors),
        "warning_count": len(stats.warnings),
    }

    # Write report
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_file = report_path / f"{stats.script_name}_{stats.collection}_{timestamp}.json"

    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    return str(report_file)


def generate_run_id(script_name: str) -> str:
    """Generate a unique run ID."""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"{script_name}_{timestamp}"
