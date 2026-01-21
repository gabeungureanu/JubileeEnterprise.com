# =============================================================================
# RETRIEVAL LOGGER
# =============================================================================
"""
Logging for similarity searches and memory lookups.

This module captures detailed metadata for every retrieval operation:
- Chunks retrieved with IDs and similarity scores
- Collection metadata and retrieval order
- Query vectors and parameters
- Performance timing

CRITICAL: Every retrieval MUST be logged for auditability and debugging.
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
# CHUNK INFO
# =============================================================================

@dataclass
class ChunkInfo:
    """
    Information about a retrieved chunk.

    Captures all metadata needed to identify and audit
    the chunk and its retrieval context.
    """
    # Identification
    chunk_id: str = ""
    doc_id: str = ""
    collection: str = ""

    # Retrieval metrics
    similarity_score: float = 0.0
    retrieval_rank: int = 0  # 1-based position in results

    # Content
    content_preview: str = ""  # First N characters
    content_length: int = 0

    # Metadata
    chunk_index: int = 0  # Position within document
    total_chunks: int = 0  # Total chunks in document
    source_file: str = ""
    source_type: str = ""  # txt, md, json, etc.

    # Versioning
    chunk_version: str = ""
    ingested_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'chunk_id': self.chunk_id,
            'doc_id': self.doc_id,
            'collection': self.collection,
            'similarity_score': self.similarity_score,
            'retrieval_rank': self.retrieval_rank,
            'content_preview': self.content_preview,
            'content_length': self.content_length,
            'chunk_index': self.chunk_index,
            'total_chunks': self.total_chunks,
            'source_file': self.source_file,
            'source_type': self.source_type,
            'chunk_version': self.chunk_version,
            'ingested_at': self.ingested_at,
        }


# =============================================================================
# RETRIEVAL LOG ENTRY
# =============================================================================

@dataclass
class RetrievalLog(LogEntry):
    """
    Detailed log entry for a retrieval operation.

    Captures all information about similarity searches and
    memory lookups for debugging and auditing.
    """
    log_type: str = "retrieval"

    # Query identification
    query_id: str = ""
    parent_request_id: str = ""  # Links to the request that triggered this

    # Query details
    query_text: str = ""
    query_text_length: int = 0
    query_type: str = ""  # similarity, memory, hybrid, etc.

    # Vector details
    query_vector_dim: int = 0
    embedding_model: str = ""
    embedding_tokens: int = 0

    # Search parameters
    collection_searched: str = ""
    collections_searched: List[str] = field(default_factory=list)
    top_k_requested: int = 0
    score_threshold: float = 0.0
    filter_applied: str = ""  # JSON string of filters

    # Results
    chunks_retrieved: int = 0
    chunks_above_threshold: int = 0
    top_score: float = 0.0
    bottom_score: float = 0.0
    average_score: float = 0.0

    # Detailed chunk info
    chunk_details: List[Dict[str, Any]] = field(default_factory=list)

    # Timing
    started_at: str = ""
    completed_at: str = ""
    embedding_latency_ms: float = 0.0
    search_latency_ms: float = 0.0
    total_latency_ms: float = 0.0

    # Status
    success: bool = True
    error_message: str = ""
    cache_hit: bool = False

    def add_chunk(self, chunk: ChunkInfo):
        """Add a retrieved chunk to the log."""
        self.chunk_details.append(chunk.to_dict())
        self.chunks_retrieved = len(self.chunk_details)

        # Update score statistics
        if self.chunk_details:
            scores = [c['similarity_score'] for c in self.chunk_details]
            self.top_score = max(scores)
            self.bottom_score = min(scores)
            self.average_score = sum(scores) / len(scores)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with all fields."""
        data = super().to_dict()
        return data


# =============================================================================
# RETRIEVAL LOGGER
# =============================================================================

class RetrievalLogger:
    """
    Logger for retrieval operations.

    Provides methods to log similarity searches and memory lookups
    with full metadata for debugging and auditing.
    """

    def __init__(self, writer: LogWriter = None):
        self.writer = writer or get_log_writer()
        self._active_queries: Dict[str, RetrievalLog] = {}
        self._lock = threading.Lock()

    def start_retrieval(
        self,
        query_id: str,
        query_text: str,
        collection: str = "",
        collections: List[str] = None,
        top_k: int = 10,
        score_threshold: float = 0.0,
        session_id: str = "",
        context_id: str = "",
        parent_request_id: str = "",
        **kwargs
    ) -> RetrievalLog:
        """
        Start tracking a retrieval operation.

        Call this BEFORE executing the search.

        Args:
            query_id: Unique identifier for this query
            query_text: The query text
            collection: Single collection to search
            collections: Multiple collections to search
            top_k: Number of results requested
            score_threshold: Minimum similarity score
            session_id: Session identifier
            context_id: Context identifier
            parent_request_id: Request that triggered this retrieval
            **kwargs: Additional fields

        Returns:
            RetrievalLog instance
        """
        config = get_log_config()

        log = RetrievalLog(
            query_id=query_id,
            query_text=query_text[:config.max_message_length],
            query_text_length=len(query_text),
            collection_searched=collection,
            collections_searched=collections or ([collection] if collection else []),
            top_k_requested=top_k,
            score_threshold=score_threshold,
            session_id=session_id,
            context_id=context_id,
            parent_request_id=parent_request_id,
            started_at=datetime.now().isoformat(),
            component="retrieval_logger",
            operation="similarity_search",
        )

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Track active query
        with self._lock:
            self._active_queries[query_id] = log

        return log

    def complete_retrieval(
        self,
        query_id: str,
        chunks: List[ChunkInfo] = None,
        embedding_latency_ms: float = 0.0,
        search_latency_ms: float = 0.0,
        **kwargs
    ) -> Optional[RetrievalLog]:
        """
        Complete a retrieval operation.

        Call this AFTER the search returns results.

        Args:
            query_id: The query ID from start_retrieval
            chunks: List of retrieved chunks
            embedding_latency_ms: Time to create embedding
            search_latency_ms: Time to search
            **kwargs: Additional fields

        Returns:
            Completed RetrievalLog
        """
        with self._lock:
            log = self._active_queries.pop(query_id, None)

        if log is None:
            log = RetrievalLog(
                query_id=query_id,
                level=LogLevel.WARNING,
                error_message="Retrieval completed without start_retrieval call",
            )

        # Add chunks
        if chunks:
            for chunk in chunks:
                log.add_chunk(chunk)

        # Update timing
        now = datetime.now()
        log.completed_at = now.isoformat()
        log.embedding_latency_ms = embedding_latency_ms
        log.search_latency_ms = search_latency_ms
        log.total_latency_ms = embedding_latency_ms + search_latency_ms

        if log.started_at:
            try:
                start = datetime.fromisoformat(log.started_at)
                log.total_latency_ms = (now - start).total_seconds() * 1000
            except ValueError:
                pass

        log.success = True

        # Set additional fields
        for key, value in kwargs.items():
            if hasattr(log, key):
                setattr(log, key, value)

        # Write the log
        self.writer.write(log)

        return log

    def fail_retrieval(
        self,
        query_id: str,
        error_message: str,
        **kwargs
    ) -> Optional[RetrievalLog]:
        """
        Mark a retrieval as failed.

        Args:
            query_id: The query ID from start_retrieval
            error_message: Description of the error
            **kwargs: Additional fields

        Returns:
            Failed RetrievalLog
        """
        with self._lock:
            log = self._active_queries.pop(query_id, None)

        if log is None:
            log = RetrievalLog(
                query_id=query_id,
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

    def log_retrieval(
        self,
        query_text: str,
        collection: str = "",
        collections: List[str] = None,
        chunks: List[ChunkInfo] = None,
        top_k: int = 10,
        score_threshold: float = 0.0,
        embedding_latency_ms: float = 0.0,
        search_latency_ms: float = 0.0,
        session_id: str = "",
        context_id: str = "",
        parent_request_id: str = "",
        **kwargs
    ) -> RetrievalLog:
        """
        Log a complete retrieval in one call.

        Convenience method for logging after-the-fact.

        Args:
            query_text: The query text
            collection: Collection searched
            collections: Collections searched
            chunks: Retrieved chunks
            top_k: Number requested
            score_threshold: Minimum score
            embedding_latency_ms: Embedding time
            search_latency_ms: Search time
            session_id: Session ID
            context_id: Context ID
            parent_request_id: Parent request
            **kwargs: Additional fields

        Returns:
            Completed RetrievalLog
        """
        import uuid
        config = get_log_config()
        now = datetime.now()

        log = RetrievalLog(
            query_id=str(uuid.uuid4()),
            query_text=query_text[:config.max_message_length],
            query_text_length=len(query_text),
            collection_searched=collection,
            collections_searched=collections or ([collection] if collection else []),
            top_k_requested=top_k,
            score_threshold=score_threshold,
            session_id=session_id,
            context_id=context_id,
            parent_request_id=parent_request_id,
            started_at=now.isoformat(),
            completed_at=now.isoformat(),
            embedding_latency_ms=embedding_latency_ms,
            search_latency_ms=search_latency_ms,
            total_latency_ms=embedding_latency_ms + search_latency_ms,
            success=True,
            component="retrieval_logger",
            operation="similarity_search",
        )

        # Add chunks
        if chunks:
            for chunk in chunks:
                log.add_chunk(chunk)

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

_global_logger: Optional[RetrievalLogger] = None
_logger_lock = threading.Lock()


def get_retrieval_logger() -> RetrievalLogger:
    """Get the global retrieval logger."""
    global _global_logger
    with _logger_lock:
        if _global_logger is None:
            _global_logger = RetrievalLogger()
        return _global_logger


def set_retrieval_logger(logger: RetrievalLogger):
    """Set the global retrieval logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = logger


def reset_retrieval_logger():
    """Reset to default retrieval logger."""
    global _global_logger
    with _logger_lock:
        _global_logger = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def log_retrieval(
    query_text: str,
    collection: str = "",
    collections: List[str] = None,
    chunks: List[ChunkInfo] = None,
    top_k: int = 10,
    score_threshold: float = 0.0,
    embedding_latency_ms: float = 0.0,
    search_latency_ms: float = 0.0,
    session_id: str = "",
    context_id: str = "",
    parent_request_id: str = "",
    **kwargs
) -> RetrievalLog:
    """
    Log a complete retrieval operation.

    This is the primary function for logging retrievals.

    Example:
        chunks = [
            ChunkInfo(
                chunk_id="chunk_001",
                collection="inspire_scripture_core",
                similarity_score=0.92,
                retrieval_rank=1,
                content_preview="John 3:16 - For God so loved...",
            ),
        ]

        log_retrieval(
            query_text="What does John 3:16 mean?",
            collection="inspire_scripture_core",
            chunks=chunks,
            top_k=5,
            embedding_latency_ms=50.0,
            search_latency_ms=25.0,
        )
    """
    logger = get_retrieval_logger()
    return logger.log_retrieval(
        query_text=query_text,
        collection=collection,
        collections=collections,
        chunks=chunks,
        top_k=top_k,
        score_threshold=score_threshold,
        embedding_latency_ms=embedding_latency_ms,
        search_latency_ms=search_latency_ms,
        session_id=session_id,
        context_id=context_id,
        parent_request_id=parent_request_id,
        **kwargs
    )
