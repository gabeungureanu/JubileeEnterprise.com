#!/usr/bin/env python3
# =============================================================================
# RETRIEVAL CACHE
# =============================================================================
"""
Session-scoped retrieval caching for Qdrant vector queries.

This module implements caching at the user and session level to reduce
redundant vector searches, improve performance, and lower costs.

CACHING STRATEGY:
- Cache Qdrant query results for the duration of a session
- Reuse cached results when intent, persona, and context are unchanged
- Invalidate cache on persona change, scope shift, or freshness expiry
- Log all cache operations for observability

CACHE INVALIDATION TRIGGERS:
- Persona change
- Significant task scope shift
- New context introduction
- Cache freshness window exceeded
- Explicit invalidation request
- Session termination

Author: Jubilee Enterprise
Version: 1.0.0
"""

import hashlib
import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import OrderedDict

# Configure logging
logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class CacheStatus(Enum):
    """Status of cache operations."""
    HIT = "hit"
    MISS = "miss"
    STALE = "stale"
    INVALIDATED = "invalidated"
    EXPIRED = "expired"
    EVICTED = "evicted"


class InvalidationReason(Enum):
    """Reasons for cache invalidation."""
    PERSONA_CHANGE = "persona_change"
    SCOPE_SHIFT = "scope_shift"
    NEW_CONTEXT = "new_context"
    FRESHNESS_EXPIRED = "freshness_expired"
    EXPLICIT_REQUEST = "explicit_request"
    SESSION_TERMINATED = "session_terminated"
    CACHE_FULL = "cache_full"
    MANUAL_CLEAR = "manual_clear"


class QueryIntent(Enum):
    """Types of retrieval query intents."""
    DOCTRINAL_LOOKUP = "doctrinal_lookup"
    TEACHING_REFERENCE = "teaching_reference"
    PASTORAL_GUIDANCE = "pastoral_guidance"
    SCRIPTURE_SEARCH = "scripture_search"
    POLICY_LOOKUP = "policy_lookup"
    CONTENT_GENERATION = "content_generation"
    FACT_VERIFICATION = "fact_verification"
    CONTEXT_ENRICHMENT = "context_enrichment"
    GENERAL_SEARCH = "general_search"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class CacheKey:
    """
    Structured cache key linking retrieval to context.

    Combines user, persona, session, intent, and query signature
    to create unique cache identifiers.
    """
    user_id: str
    session_id: str
    persona_id: str
    intent: QueryIntent
    query_signature: str  # Hash of query parameters
    collection: str

    def to_string(self) -> str:
        """Generate string representation for cache lookup."""
        return f"{self.user_id}:{self.session_id}:{self.persona_id}:{self.intent.value}:{self.collection}:{self.query_signature}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'user_id': self.user_id,
            'session_id': self.session_id,
            'persona_id': self.persona_id,
            'intent': self.intent.value,
            'query_signature': self.query_signature,
            'collection': self.collection,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CacheKey':
        """Create from dictionary."""
        return cls(
            user_id=data['user_id'],
            session_id=data['session_id'],
            persona_id=data['persona_id'],
            intent=QueryIntent(data['intent']),
            query_signature=data['query_signature'],
            collection=data['collection'],
        )


@dataclass
class CachedResult:
    """
    Cached retrieval result with metadata.
    """
    cache_key: CacheKey
    results: List[Dict[str, Any]]  # Qdrant query results
    query_vector: Optional[List[float]] = None  # Original query vector
    query_text: str = ""  # Original query text
    score_threshold: float = 0.0
    top_k: int = 10
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: datetime = field(default_factory=datetime.now)
    access_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_fresh(self, freshness_window_seconds: int) -> bool:
        """Check if cache entry is still fresh."""
        age = (datetime.now() - self.created_at).total_seconds()
        return age < freshness_window_seconds

    def touch(self) -> None:
        """Update access time and count."""
        self.last_accessed = datetime.now()
        self.access_count += 1

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'cache_key': self.cache_key.to_dict(),
            'results': self.results,
            'query_text': self.query_text,
            'score_threshold': self.score_threshold,
            'top_k': self.top_k,
            'created_at': self.created_at.isoformat(),
            'last_accessed': self.last_accessed.isoformat(),
            'access_count': self.access_count,
            'metadata': self.metadata,
        }


@dataclass
class CacheEvent:
    """
    Cache operation event for logging and observability.
    """
    event_id: str
    timestamp: datetime
    event_type: CacheStatus
    cache_key: Optional[CacheKey]
    session_id: str
    user_id: str
    persona_id: str
    collection: str
    query_text: str
    invalidation_reason: Optional[InvalidationReason] = None
    latency_ms: float = 0.0
    result_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging."""
        return {
            'event_id': self.event_id,
            'timestamp': self.timestamp.isoformat(),
            'event_type': self.event_type.value,
            'cache_key': self.cache_key.to_string() if self.cache_key else None,
            'session_id': self.session_id,
            'user_id': self.user_id,
            'persona_id': self.persona_id,
            'collection': self.collection,
            'query_text': self.query_text[:100] if self.query_text else "",
            'invalidation_reason': self.invalidation_reason.value if self.invalidation_reason else None,
            'latency_ms': self.latency_ms,
            'result_count': self.result_count,
            'metadata': self.metadata,
        }


@dataclass
class SessionContext:
    """
    Session context for cache scope management.
    """
    session_id: str
    user_id: str
    persona_id: str
    activation_state: str = "active"
    started_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    turn_count: int = 0
    context_hash: str = ""  # Hash of current context for change detection

    def update_activity(self) -> None:
        """Update last activity timestamp."""
        self.last_activity = datetime.now()
        self.turn_count += 1

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'persona_id': self.persona_id,
            'activation_state': self.activation_state,
            'started_at': self.started_at.isoformat(),
            'last_activity': self.last_activity.isoformat(),
            'turn_count': self.turn_count,
            'context_hash': self.context_hash,
        }


@dataclass
class CacheStatistics:
    """
    Cache performance statistics.
    """
    total_queries: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    cache_invalidations: int = 0
    cache_evictions: int = 0
    total_entries: int = 0
    total_latency_saved_ms: float = 0.0
    avg_retrieval_latency_ms: float = 0.0
    hit_rate: float = 0.0

    def update_hit_rate(self) -> None:
        """Recalculate hit rate."""
        if self.total_queries > 0:
            self.hit_rate = self.cache_hits / self.total_queries

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        self.update_hit_rate()
        return {
            'total_queries': self.total_queries,
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'cache_invalidations': self.cache_invalidations,
            'cache_evictions': self.cache_evictions,
            'total_entries': self.total_entries,
            'total_latency_saved_ms': round(self.total_latency_saved_ms, 2),
            'avg_retrieval_latency_ms': round(self.avg_retrieval_latency_ms, 2),
            'hit_rate': round(self.hit_rate * 100, 2),
        }


# =============================================================================
# CACHE CONFIGURATION
# =============================================================================

@dataclass
class RetrievalCacheConfig:
    """
    Configuration for retrieval caching behavior.
    """
    # Cache size limits
    max_entries_per_session: int = 100
    max_total_entries: int = 1000
    max_result_size_bytes: int = 1024 * 1024  # 1MB per result

    # Freshness windows (seconds)
    default_freshness_window: int = 300  # 5 minutes
    doctrinal_freshness_window: int = 900  # 15 minutes (doctrinal content stable)
    teaching_freshness_window: int = 600  # 10 minutes
    pastoral_freshness_window: int = 300  # 5 minutes

    # Intent-specific freshness windows
    freshness_by_intent: Dict[str, int] = field(default_factory=lambda: {
        QueryIntent.DOCTRINAL_LOOKUP.value: 900,
        QueryIntent.TEACHING_REFERENCE.value: 600,
        QueryIntent.PASTORAL_GUIDANCE.value: 300,
        QueryIntent.SCRIPTURE_SEARCH.value: 1800,  # 30 minutes
        QueryIntent.POLICY_LOOKUP.value: 600,
        QueryIntent.CONTENT_GENERATION.value: 300,
        QueryIntent.FACT_VERIFICATION.value: 600,
        QueryIntent.CONTEXT_ENRICHMENT.value: 300,
        QueryIntent.GENERAL_SEARCH.value: 300,
    })

    # Session timeout
    session_timeout_seconds: int = 3600  # 1 hour

    # Similarity thresholds for cache matching
    query_similarity_threshold: float = 0.95  # 95% similar = cache hit
    context_change_threshold: float = 0.3  # 30% change = invalidate

    # Eviction policy
    eviction_policy: str = "lru"  # lru, lfu, fifo

    # Logging
    log_cache_events: bool = True
    log_directory: str = "logs/cache"

    def get_freshness_window(self, intent: QueryIntent) -> int:
        """Get freshness window for specific intent."""
        return self.freshness_by_intent.get(
            intent.value,
            self.default_freshness_window
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'max_entries_per_session': self.max_entries_per_session,
            'max_total_entries': self.max_total_entries,
            'max_result_size_bytes': self.max_result_size_bytes,
            'default_freshness_window': self.default_freshness_window,
            'freshness_by_intent': self.freshness_by_intent,
            'session_timeout_seconds': self.session_timeout_seconds,
            'query_similarity_threshold': self.query_similarity_threshold,
            'context_change_threshold': self.context_change_threshold,
            'eviction_policy': self.eviction_policy,
            'log_cache_events': self.log_cache_events,
        }


# =============================================================================
# CACHE KEY GENERATOR
# =============================================================================

class CacheKeyGenerator:
    """
    Generates cache keys from query parameters.
    """

    @staticmethod
    def generate_query_signature(
        query_text: str,
        collection: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = 10,
        score_threshold: float = 0.0,
    ) -> str:
        """
        Generate a unique signature for a query.

        Combines query text, collection, filters, and parameters
        into a deterministic hash.
        """
        signature_data = {
            'query_text': query_text.strip().lower(),
            'collection': collection,
            'filters': json.dumps(filters or {}, sort_keys=True),
            'top_k': top_k,
            'score_threshold': score_threshold,
        }
        signature_string = json.dumps(signature_data, sort_keys=True)
        return hashlib.sha256(signature_string.encode()).hexdigest()[:16]

    @staticmethod
    def generate_context_hash(context: Dict[str, Any]) -> str:
        """
        Generate a hash of the current context for change detection.
        """
        # Exclude volatile fields
        stable_context = {
            k: v for k, v in context.items()
            if k not in ['timestamp', 'turn_number', 'last_response']
        }
        context_string = json.dumps(stable_context, sort_keys=True, default=str)
        return hashlib.sha256(context_string.encode()).hexdigest()[:16]

    @staticmethod
    def create_cache_key(
        user_id: str,
        session_id: str,
        persona_id: str,
        intent: QueryIntent,
        query_text: str,
        collection: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = 10,
        score_threshold: float = 0.0,
    ) -> CacheKey:
        """
        Create a complete cache key for a retrieval request.
        """
        query_signature = CacheKeyGenerator.generate_query_signature(
            query_text=query_text,
            collection=collection,
            filters=filters,
            top_k=top_k,
            score_threshold=score_threshold,
        )

        return CacheKey(
            user_id=user_id,
            session_id=session_id,
            persona_id=persona_id,
            intent=intent,
            query_signature=query_signature,
            collection=collection,
        )


# =============================================================================
# CACHE EVENT LOGGER
# =============================================================================

class CacheEventLogger:
    """
    Logs cache events for observability and tuning.
    """

    def __init__(self, config: RetrievalCacheConfig):
        self.config = config
        self.log_path = Path(config.log_directory)
        self.log_path.mkdir(parents=True, exist_ok=True)
        self._event_count = 0
        self._lock = threading.Lock()

    def _get_log_file(self) -> Path:
        """Get current log file path."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        return self.log_path / f"cache_events_{date_str}.jsonl"

    def _generate_event_id(self) -> str:
        """Generate unique event ID."""
        with self._lock:
            self._event_count += 1
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            return f"cache_{timestamp}_{self._event_count:06d}"

    def log_event(self, event: CacheEvent) -> None:
        """Log a cache event."""
        if not self.config.log_cache_events:
            return

        try:
            log_file = self._get_log_file()
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(event.to_dict()) + '\n')
        except Exception as e:
            logger.error(f"Failed to log cache event: {e}")

    def log_hit(
        self,
        cache_key: CacheKey,
        session_id: str,
        user_id: str,
        persona_id: str,
        collection: str,
        query_text: str,
        latency_ms: float,
        result_count: int,
    ) -> CacheEvent:
        """Log a cache hit event."""
        event = CacheEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            event_type=CacheStatus.HIT,
            cache_key=cache_key,
            session_id=session_id,
            user_id=user_id,
            persona_id=persona_id,
            collection=collection,
            query_text=query_text,
            latency_ms=latency_ms,
            result_count=result_count,
        )
        self.log_event(event)
        return event

    def log_miss(
        self,
        cache_key: CacheKey,
        session_id: str,
        user_id: str,
        persona_id: str,
        collection: str,
        query_text: str,
        latency_ms: float,
        result_count: int,
    ) -> CacheEvent:
        """Log a cache miss event."""
        event = CacheEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            event_type=CacheStatus.MISS,
            cache_key=cache_key,
            session_id=session_id,
            user_id=user_id,
            persona_id=persona_id,
            collection=collection,
            query_text=query_text,
            latency_ms=latency_ms,
            result_count=result_count,
        )
        self.log_event(event)
        return event

    def log_invalidation(
        self,
        cache_key: Optional[CacheKey],
        session_id: str,
        user_id: str,
        persona_id: str,
        reason: InvalidationReason,
        entries_invalidated: int = 1,
    ) -> CacheEvent:
        """Log a cache invalidation event."""
        event = CacheEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            event_type=CacheStatus.INVALIDATED,
            cache_key=cache_key,
            session_id=session_id,
            user_id=user_id,
            persona_id=persona_id,
            collection=cache_key.collection if cache_key else "",
            query_text="",
            invalidation_reason=reason,
            metadata={'entries_invalidated': entries_invalidated},
        )
        self.log_event(event)
        return event

    def log_eviction(
        self,
        cache_key: CacheKey,
        session_id: str,
        user_id: str,
        persona_id: str,
        reason: str = "cache_full",
    ) -> CacheEvent:
        """Log a cache eviction event."""
        event = CacheEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            event_type=CacheStatus.EVICTED,
            cache_key=cache_key,
            session_id=session_id,
            user_id=user_id,
            persona_id=persona_id,
            collection=cache_key.collection,
            query_text="",
            metadata={'eviction_reason': reason},
        )
        self.log_event(event)
        return event


# =============================================================================
# SESSION CACHE
# =============================================================================

class SessionCache:
    """
    Session-scoped cache for a single user session.
    """

    def __init__(
        self,
        session_context: SessionContext,
        config: RetrievalCacheConfig,
    ):
        self.context = session_context
        self.config = config
        self._cache: OrderedDict[str, CachedResult] = OrderedDict()
        self._lock = threading.RLock()

    @property
    def session_id(self) -> str:
        return self.context.session_id

    @property
    def user_id(self) -> str:
        return self.context.user_id

    @property
    def persona_id(self) -> str:
        return self.context.persona_id

    @property
    def entry_count(self) -> int:
        return len(self._cache)

    def get(self, cache_key: CacheKey) -> Optional[CachedResult]:
        """
        Get cached result if exists and fresh.
        """
        with self._lock:
            key_str = cache_key.to_string()

            if key_str not in self._cache:
                return None

            result = self._cache[key_str]
            freshness_window = self.config.get_freshness_window(cache_key.intent)

            if not result.is_fresh(freshness_window):
                # Remove stale entry
                del self._cache[key_str]
                return None

            # Update access for LRU
            result.touch()
            self._cache.move_to_end(key_str)

            return result

    def put(
        self,
        cache_key: CacheKey,
        results: List[Dict[str, Any]],
        query_text: str = "",
        query_vector: Optional[List[float]] = None,
        score_threshold: float = 0.0,
        top_k: int = 10,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CachedResult:
        """
        Store result in cache.
        """
        with self._lock:
            # Check size limit
            if len(self._cache) >= self.config.max_entries_per_session:
                self._evict_oldest()

            cached = CachedResult(
                cache_key=cache_key,
                results=results,
                query_vector=query_vector,
                query_text=query_text,
                score_threshold=score_threshold,
                top_k=top_k,
                metadata=metadata or {},
            )

            self._cache[cache_key.to_string()] = cached
            return cached

    def invalidate(self, cache_key: CacheKey) -> bool:
        """
        Invalidate specific cache entry.
        """
        with self._lock:
            key_str = cache_key.to_string()
            if key_str in self._cache:
                del self._cache[key_str]
                return True
            return False

    def invalidate_by_persona(self, persona_id: str) -> int:
        """
        Invalidate all entries for a specific persona.
        """
        with self._lock:
            to_remove = [
                key for key, result in self._cache.items()
                if result.cache_key.persona_id == persona_id
            ]
            for key in to_remove:
                del self._cache[key]
            return len(to_remove)

    def invalidate_by_collection(self, collection: str) -> int:
        """
        Invalidate all entries for a specific collection.
        """
        with self._lock:
            to_remove = [
                key for key, result in self._cache.items()
                if result.cache_key.collection == collection
            ]
            for key in to_remove:
                del self._cache[key]
            return len(to_remove)

    def invalidate_stale(self) -> int:
        """
        Remove all stale entries.
        """
        with self._lock:
            to_remove = []
            for key, result in self._cache.items():
                freshness = self.config.get_freshness_window(result.cache_key.intent)
                if not result.is_fresh(freshness):
                    to_remove.append(key)

            for key in to_remove:
                del self._cache[key]
            return len(to_remove)

    def clear(self) -> int:
        """
        Clear all cache entries.
        """
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count

    def _evict_oldest(self) -> Optional[CacheKey]:
        """
        Evict oldest entry (LRU).
        """
        if not self._cache:
            return None

        # OrderedDict maintains insertion order
        oldest_key = next(iter(self._cache))
        oldest = self._cache.pop(oldest_key)
        return oldest.cache_key

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        """
        with self._lock:
            total_results = sum(len(r.results) for r in self._cache.values())
            avg_access = 0
            if self._cache:
                avg_access = sum(r.access_count for r in self._cache.values()) / len(self._cache)

            return {
                'session_id': self.session_id,
                'user_id': self.user_id,
                'persona_id': self.persona_id,
                'entry_count': len(self._cache),
                'total_results_cached': total_results,
                'avg_access_count': round(avg_access, 2),
                'oldest_entry_age_seconds': self._get_oldest_age(),
            }

    def _get_oldest_age(self) -> float:
        """Get age of oldest entry in seconds."""
        if not self._cache:
            return 0.0
        oldest = next(iter(self._cache.values()))
        return (datetime.now() - oldest.created_at).total_seconds()


# =============================================================================
# RETRIEVAL CACHE MANAGER
# =============================================================================

class RetrievalCacheManager:
    """
    Manages session-scoped retrieval caches across all users.

    This is the main entry point for the caching system.
    """

    _instance: Optional['RetrievalCacheManager'] = None
    _lock = threading.Lock()

    def __new__(cls, config: Optional[RetrievalCacheConfig] = None):
        """Singleton pattern for cache manager."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, config: Optional[RetrievalCacheConfig] = None):
        if self._initialized:
            return

        self.config = config or RetrievalCacheConfig()
        self._sessions: Dict[str, SessionCache] = {}
        self._contexts: Dict[str, SessionContext] = {}
        self._statistics = CacheStatistics()
        self._event_logger = CacheEventLogger(self.config)
        self._cache_lock = threading.RLock()
        self._initialized = True

        logger.info("RetrievalCacheManager initialized")

    def get_or_create_session(
        self,
        session_id: str,
        user_id: str,
        persona_id: str,
    ) -> SessionCache:
        """
        Get existing session cache or create new one.
        """
        with self._cache_lock:
            if session_id not in self._sessions:
                context = SessionContext(
                    session_id=session_id,
                    user_id=user_id,
                    persona_id=persona_id,
                )
                self._contexts[session_id] = context
                self._sessions[session_id] = SessionCache(context, self.config)
                logger.debug(f"Created new session cache: {session_id}")

            return self._sessions[session_id]

    def query_with_cache(
        self,
        session_id: str,
        user_id: str,
        persona_id: str,
        intent: QueryIntent,
        query_text: str,
        collection: str,
        query_function: callable,
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = 10,
        score_threshold: float = 0.0,
        force_refresh: bool = False,
    ) -> Tuple[List[Dict[str, Any]], CacheStatus]:
        """
        Execute query with caching.

        Args:
            session_id: Session identifier
            user_id: User identifier
            persona_id: Active persona
            intent: Query intent type
            query_text: Query text
            collection: Qdrant collection name
            query_function: Callable that executes the actual Qdrant query
            filters: Optional query filters
            top_k: Number of results
            score_threshold: Minimum score threshold
            force_refresh: Force fresh query, bypass cache

        Returns:
            Tuple of (results, cache_status)
        """
        start_time = time.time()

        # Get or create session cache
        session_cache = self.get_or_create_session(session_id, user_id, persona_id)

        # Generate cache key
        cache_key = CacheKeyGenerator.create_cache_key(
            user_id=user_id,
            session_id=session_id,
            persona_id=persona_id,
            intent=intent,
            query_text=query_text,
            collection=collection,
            filters=filters,
            top_k=top_k,
            score_threshold=score_threshold,
        )

        # Check cache unless force refresh
        if not force_refresh:
            cached = session_cache.get(cache_key)
            if cached:
                latency = (time.time() - start_time) * 1000

                # Log cache hit
                self._event_logger.log_hit(
                    cache_key=cache_key,
                    session_id=session_id,
                    user_id=user_id,
                    persona_id=persona_id,
                    collection=collection,
                    query_text=query_text,
                    latency_ms=latency,
                    result_count=len(cached.results),
                )

                # Update statistics
                self._statistics.total_queries += 1
                self._statistics.cache_hits += 1

                logger.debug(f"Cache HIT for {collection}: {query_text[:50]}...")
                return cached.results, CacheStatus.HIT

        # Cache miss - execute query
        self._statistics.total_queries += 1
        self._statistics.cache_misses += 1

        query_start = time.time()
        results = query_function()
        query_latency = (time.time() - query_start) * 1000

        # Update average latency
        n = self._statistics.cache_misses
        self._statistics.avg_retrieval_latency_ms = (
            (self._statistics.avg_retrieval_latency_ms * (n - 1) + query_latency) / n
        )

        # Store in cache
        session_cache.put(
            cache_key=cache_key,
            results=results,
            query_text=query_text,
            score_threshold=score_threshold,
            top_k=top_k,
        )

        total_latency = (time.time() - start_time) * 1000

        # Log cache miss
        self._event_logger.log_miss(
            cache_key=cache_key,
            session_id=session_id,
            user_id=user_id,
            persona_id=persona_id,
            collection=collection,
            query_text=query_text,
            latency_ms=total_latency,
            result_count=len(results),
        )

        logger.debug(f"Cache MISS for {collection}: {query_text[:50]}...")
        return results, CacheStatus.MISS

    def check_cache(
        self,
        session_id: str,
        user_id: str,
        persona_id: str,
        intent: QueryIntent,
        query_text: str,
        collection: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = 10,
        score_threshold: float = 0.0,
    ) -> Optional[CachedResult]:
        """
        Check if query result exists in cache without executing query.
        """
        if session_id not in self._sessions:
            return None

        session_cache = self._sessions[session_id]

        cache_key = CacheKeyGenerator.create_cache_key(
            user_id=user_id,
            session_id=session_id,
            persona_id=persona_id,
            intent=intent,
            query_text=query_text,
            collection=collection,
            filters=filters,
            top_k=top_k,
            score_threshold=score_threshold,
        )

        return session_cache.get(cache_key)

    def invalidate_session(
        self,
        session_id: str,
        reason: InvalidationReason = InvalidationReason.SESSION_TERMINATED,
    ) -> int:
        """
        Invalidate entire session cache.
        """
        with self._cache_lock:
            if session_id not in self._sessions:
                return 0

            session_cache = self._sessions[session_id]
            count = session_cache.clear()

            # Log invalidation
            context = self._contexts.get(session_id)
            if context:
                self._event_logger.log_invalidation(
                    cache_key=None,
                    session_id=session_id,
                    user_id=context.user_id,
                    persona_id=context.persona_id,
                    reason=reason,
                    entries_invalidated=count,
                )

            # Remove session
            del self._sessions[session_id]
            if session_id in self._contexts:
                del self._contexts[session_id]

            self._statistics.cache_invalidations += count
            logger.info(f"Invalidated session {session_id}: {count} entries")
            return count

    def invalidate_on_persona_change(
        self,
        session_id: str,
        old_persona_id: str,
        new_persona_id: str,
    ) -> int:
        """
        Handle persona change - invalidate persona-specific cached results.
        """
        with self._cache_lock:
            if session_id not in self._sessions:
                return 0

            session_cache = self._sessions[session_id]
            count = session_cache.invalidate_by_persona(old_persona_id)

            # Update session context
            if session_id in self._contexts:
                self._contexts[session_id].persona_id = new_persona_id

            if count > 0:
                self._event_logger.log_invalidation(
                    cache_key=None,
                    session_id=session_id,
                    user_id=session_cache.user_id,
                    persona_id=old_persona_id,
                    reason=InvalidationReason.PERSONA_CHANGE,
                    entries_invalidated=count,
                )
                self._statistics.cache_invalidations += count

            logger.info(f"Persona change {old_persona_id} -> {new_persona_id}: invalidated {count} entries")
            return count

    def invalidate_on_context_change(
        self,
        session_id: str,
        new_context: Dict[str, Any],
    ) -> int:
        """
        Handle significant context change.
        """
        with self._cache_lock:
            if session_id not in self._sessions:
                return 0

            session_cache = self._sessions[session_id]
            context = self._contexts.get(session_id)

            if not context:
                return 0

            # Generate new context hash
            new_hash = CacheKeyGenerator.generate_context_hash(new_context)

            # Compare with existing
            if context.context_hash and context.context_hash != new_hash:
                # Context changed significantly
                count = session_cache.clear()
                context.context_hash = new_hash

                self._event_logger.log_invalidation(
                    cache_key=None,
                    session_id=session_id,
                    user_id=context.user_id,
                    persona_id=context.persona_id,
                    reason=InvalidationReason.NEW_CONTEXT,
                    entries_invalidated=count,
                )

                self._statistics.cache_invalidations += count
                logger.info(f"Context change in {session_id}: invalidated {count} entries")
                return count

            # Update hash if first time
            if not context.context_hash:
                context.context_hash = new_hash

            return 0

    def cleanup_stale_entries(self) -> int:
        """
        Remove stale entries from all session caches.
        """
        total_removed = 0
        with self._cache_lock:
            for session_id, session_cache in list(self._sessions.items()):
                removed = session_cache.invalidate_stale()
                if removed > 0:
                    total_removed += removed
                    logger.debug(f"Removed {removed} stale entries from {session_id}")

        if total_removed > 0:
            self._statistics.cache_evictions += total_removed
            logger.info(f"Cleaned up {total_removed} stale cache entries")

        return total_removed

    def cleanup_expired_sessions(self) -> int:
        """
        Remove expired session caches.
        """
        count = 0
        cutoff = datetime.now() - timedelta(seconds=self.config.session_timeout_seconds)

        with self._cache_lock:
            expired = [
                sid for sid, ctx in self._contexts.items()
                if ctx.last_activity < cutoff
            ]

            for session_id in expired:
                self.invalidate_session(session_id, InvalidationReason.SESSION_TERMINATED)
                count += 1

        if count > 0:
            logger.info(f"Cleaned up {count} expired sessions")

        return count

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get overall cache statistics.
        """
        self._statistics.total_entries = sum(
            s.entry_count for s in self._sessions.values()
        )
        self._statistics.update_hit_rate()

        return {
            'global': self._statistics.to_dict(),
            'session_count': len(self._sessions),
            'sessions': {
                sid: cache.get_statistics()
                for sid, cache in self._sessions.items()
            },
        }

    def get_session_statistics(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get statistics for specific session.
        """
        if session_id not in self._sessions:
            return None
        return self._sessions[session_id].get_statistics()

    def reset(self) -> None:
        """
        Reset all caches and statistics.
        """
        with self._cache_lock:
            for session_cache in self._sessions.values():
                session_cache.clear()
            self._sessions.clear()
            self._contexts.clear()
            self._statistics = CacheStatistics()
            logger.info("RetrievalCacheManager reset")


# =============================================================================
# CACHE INVALIDATION CHECKER
# =============================================================================

class CacheInvalidationChecker:
    """
    Checks conditions that require cache invalidation.
    """

    def __init__(self, config: RetrievalCacheConfig):
        self.config = config

    def should_invalidate_for_persona_change(
        self,
        old_persona: str,
        new_persona: str,
    ) -> bool:
        """
        Check if persona change requires invalidation.
        """
        # Always invalidate on persona change
        return old_persona != new_persona

    def should_invalidate_for_scope_shift(
        self,
        old_scope: Dict[str, Any],
        new_scope: Dict[str, Any],
    ) -> Tuple[bool, float]:
        """
        Check if task scope shift requires invalidation.

        Returns:
            Tuple of (should_invalidate, change_ratio)
        """
        # Compare key scope fields
        scope_fields = ['task_type', 'domain', 'objective', 'target_audience']

        changes = 0
        total = 0

        for field in scope_fields:
            old_val = old_scope.get(field, '')
            new_val = new_scope.get(field, '')
            if old_val or new_val:
                total += 1
                if old_val != new_val:
                    changes += 1

        change_ratio = changes / total if total > 0 else 0
        should_invalidate = change_ratio >= self.config.context_change_threshold

        return should_invalidate, change_ratio

    def should_invalidate_for_new_context(
        self,
        context: SessionContext,
        new_context_hash: str,
    ) -> bool:
        """
        Check if new context introduction requires invalidation.
        """
        if not context.context_hash:
            return False
        return context.context_hash != new_context_hash

    def should_invalidate_for_freshness(
        self,
        cached_result: CachedResult,
        intent: QueryIntent,
    ) -> bool:
        """
        Check if cache entry has exceeded freshness window.
        """
        freshness_window = self.config.get_freshness_window(intent)
        return not cached_result.is_fresh(freshness_window)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_cache_manager(config: Optional[RetrievalCacheConfig] = None) -> RetrievalCacheManager:
    """
    Get the singleton cache manager instance.
    """
    return RetrievalCacheManager(config)


def query_with_cache(
    session_id: str,
    user_id: str,
    persona_id: str,
    intent: QueryIntent,
    query_text: str,
    collection: str,
    query_function: callable,
    filters: Optional[Dict[str, Any]] = None,
    top_k: int = 10,
    score_threshold: float = 0.0,
    force_refresh: bool = False,
) -> Tuple[List[Dict[str, Any]], CacheStatus]:
    """
    Convenience function for cached queries.
    """
    manager = get_cache_manager()
    return manager.query_with_cache(
        session_id=session_id,
        user_id=user_id,
        persona_id=persona_id,
        intent=intent,
        query_text=query_text,
        collection=collection,
        query_function=query_function,
        filters=filters,
        top_k=top_k,
        score_threshold=score_threshold,
        force_refresh=force_refresh,
    )


def invalidate_session_cache(
    session_id: str,
    reason: InvalidationReason = InvalidationReason.EXPLICIT_REQUEST,
) -> int:
    """
    Convenience function to invalidate session cache.
    """
    manager = get_cache_manager()
    return manager.invalidate_session(session_id, reason)


def get_cache_statistics() -> Dict[str, Any]:
    """
    Convenience function to get cache statistics.
    """
    manager = get_cache_manager()
    return manager.get_statistics()


if __name__ == '__main__':
    # Example usage
    import sys

    # Initialize manager
    config = RetrievalCacheConfig()
    manager = get_cache_manager(config)

    # Simulate a cached query
    def mock_qdrant_query():
        # Simulate Qdrant latency
        time.sleep(0.1)
        return [
            {'id': '1', 'score': 0.95, 'payload': {'text': 'Result 1'}},
            {'id': '2', 'score': 0.90, 'payload': {'text': 'Result 2'}},
        ]

    # First query (cache miss)
    results1, status1 = manager.query_with_cache(
        session_id='session_001',
        user_id='user_001',
        persona_id='inspire_foundation',
        intent=QueryIntent.DOCTRINAL_LOOKUP,
        query_text='What is grace?',
        collection='inspire_doctrinal',
        query_function=mock_qdrant_query,
    )
    print(f"Query 1: {status1.value}, {len(results1)} results")

    # Second identical query (cache hit)
    results2, status2 = manager.query_with_cache(
        session_id='session_001',
        user_id='user_001',
        persona_id='inspire_foundation',
        intent=QueryIntent.DOCTRINAL_LOOKUP,
        query_text='What is grace?',
        collection='inspire_doctrinal',
        query_function=mock_qdrant_query,
    )
    print(f"Query 2: {status2.value}, {len(results2)} results")

    # Print statistics
    stats = manager.get_statistics()
    print(f"\nStatistics: {json.dumps(stats['global'], indent=2)}")
