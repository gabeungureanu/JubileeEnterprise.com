#!/usr/bin/env python3
# =============================================================================
# RETRIEVAL MODULE
# =============================================================================
"""
Retrieval layer for Inspire 8.0 execution pipeline.

This module provides session-scoped caching for Qdrant vector queries,
reducing redundant searches and improving system performance.

FEATURES:
- Session-scoped retrieval caching
- Intent-based cache key generation
- Configurable freshness windows
- Automatic cache invalidation
- Cache event logging for observability

USAGE:
    from retrieval import (
        get_cache_manager,
        query_with_cache,
        QueryIntent,
        CacheStatus,
    )

    # Execute cached query
    results, status = query_with_cache(
        session_id='session_001',
        user_id='user_001',
        persona_id='inspire_foundation',
        intent=QueryIntent.DOCTRINAL_LOOKUP,
        query_text='What is grace?',
        collection='inspire_doctrinal',
        query_function=my_qdrant_query,
    )

    if status == CacheStatus.HIT:
        print("Used cached results")
    else:
        print("Fresh query executed")
"""

from .retrieval_cache import (
    # Enums
    CacheStatus,
    InvalidationReason,
    QueryIntent,

    # Data classes
    CacheKey,
    CachedResult,
    CacheEvent,
    SessionContext,
    CacheStatistics,

    # Configuration
    RetrievalCacheConfig,

    # Key generator
    CacheKeyGenerator,

    # Event logger
    CacheEventLogger,

    # Session cache
    SessionCache,

    # Main manager
    RetrievalCacheManager,

    # Invalidation checker
    CacheInvalidationChecker,

    # Helper functions
    get_cache_manager,
    query_with_cache,
    invalidate_session_cache,
    get_cache_statistics,
)

__all__ = [
    # Enums
    'CacheStatus',
    'InvalidationReason',
    'QueryIntent',

    # Data classes
    'CacheKey',
    'CachedResult',
    'CacheEvent',
    'SessionContext',
    'CacheStatistics',

    # Configuration
    'RetrievalCacheConfig',

    # Key generator
    'CacheKeyGenerator',

    # Event logger
    'CacheEventLogger',

    # Session cache
    'SessionCache',

    # Main manager
    'RetrievalCacheManager',

    # Invalidation checker
    'CacheInvalidationChecker',

    # Helper functions
    'get_cache_manager',
    'query_with_cache',
    'invalidate_session_cache',
    'get_cache_statistics',
]

__version__ = '1.0.0'
