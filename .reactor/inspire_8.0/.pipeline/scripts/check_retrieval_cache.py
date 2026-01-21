#!/usr/bin/env python3
# =============================================================================
# CHECK RETRIEVAL CACHE
# =============================================================================
"""
Check and manage retrieval cache for Inspire 8.0 execution pipeline.

This script provides tools for viewing cache status, testing cache operations,
and managing session caches.

USAGE:
    python check_retrieval_cache.py [options] [command]

COMMANDS:
    status               Show cache statistics
    sessions             List active sessions
    test                 Run cache test scenarios
    invalidate           Invalidate session cache
    cleanup              Clean up stale entries
    config               Show cache configuration

OPTIONS:
    --session SESSION    Session ID for operations
    --user USER          User ID
    --persona PERSONA    Persona ID
    --reason REASON      Invalidation reason
    --format FORMAT      Output format: text, json (default: text)
    --verbose            Enable verbose logging

EXIT CODES:
    0 - Success
    1 - Configuration error
    2 - Operation failed
    3 - Session not found
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from retrieval.retrieval_cache import (
    RetrievalCacheManager,
    RetrievalCacheConfig,
    CacheStatus,
    InvalidationReason,
    QueryIntent,
    get_cache_manager,
    get_cache_statistics,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Check and manage retrieval cache',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        'command',
        type=str,
        nargs='?',
        default='status',
        choices=['status', 'sessions', 'test', 'invalidate', 'cleanup', 'config'],
        help='Command to execute (default: status)'
    )
    parser.add_argument(
        '--session',
        type=str,
        default='',
        help='Session ID for operations'
    )
    parser.add_argument(
        '--user',
        type=str,
        default='test_user',
        help='User ID (default: test_user)'
    )
    parser.add_argument(
        '--persona',
        type=str,
        default='inspire_foundation',
        help='Persona ID (default: inspire_foundation)'
    )
    parser.add_argument(
        '--reason',
        type=str,
        default='explicit_request',
        choices=[r.value for r in InvalidationReason],
        help='Invalidation reason (default: explicit_request)'
    )
    parser.add_argument(
        '--format',
        type=str,
        choices=['text', 'json'],
        default='text',
        help='Output format (default: text)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    return parser.parse_args()


def show_status(args, manager: RetrievalCacheManager):
    """Show cache statistics."""
    stats = manager.get_statistics()

    if args.format == 'json':
        print(json.dumps(stats, indent=2))
        return 0

    print("\n" + "=" * 60)
    print("RETRIEVAL CACHE STATUS")
    print("=" * 60)

    global_stats = stats.get('global', {})

    print(f"\n{'Total Queries:':<30} {global_stats.get('total_queries', 0):>10,}")
    print(f"{'Cache Hits:':<30} {global_stats.get('cache_hits', 0):>10,}")
    print(f"{'Cache Misses:':<30} {global_stats.get('cache_misses', 0):>10,}")
    print(f"{'Hit Rate:':<30} {global_stats.get('hit_rate', 0):>9.1f}%")

    print("\n" + "-" * 60)

    print(f"{'Cache Invalidations:':<30} {global_stats.get('cache_invalidations', 0):>10,}")
    print(f"{'Cache Evictions:':<30} {global_stats.get('cache_evictions', 0):>10,}")
    print(f"{'Total Entries:':<30} {global_stats.get('total_entries', 0):>10,}")

    print("\n" + "-" * 60)

    print(f"{'Avg Retrieval Latency:':<30} {global_stats.get('avg_retrieval_latency_ms', 0):>7.1f} ms")
    print(f"{'Total Latency Saved:':<30} {global_stats.get('total_latency_saved_ms', 0):>7.1f} ms")

    print(f"\n{'Active Sessions:':<30} {stats.get('session_count', 0):>10}")

    print("\n" + "=" * 60)
    return 0


def show_sessions(args, manager: RetrievalCacheManager):
    """List active sessions."""
    stats = manager.get_statistics()
    sessions = stats.get('sessions', {})

    if args.format == 'json':
        print(json.dumps(sessions, indent=2))
        return 0

    print("\n" + "=" * 60)
    print("ACTIVE SESSIONS")
    print("=" * 60)

    if not sessions:
        print("\nNo active sessions.")
        return 0

    print(f"\n{'Session ID':<25} {'User':<15} {'Persona':<20} {'Entries':>8}")
    print("-" * 70)

    for session_id, session_stats in sessions.items():
        print(
            f"{session_id:<25} "
            f"{session_stats.get('user_id', ''):<15} "
            f"{session_stats.get('persona_id', ''):<20} "
            f"{session_stats.get('entry_count', 0):>8}"
        )

    print("\n" + "=" * 60)
    return 0


def run_test(args, manager: RetrievalCacheManager):
    """Run cache test scenarios."""
    print("\n" + "=" * 60)
    print("CACHE TEST SCENARIOS")
    print("=" * 60)

    test_session = f"test_session_{int(time.time())}"
    test_user = args.user
    test_persona = args.persona

    # Mock query function with latency simulation
    query_count = [0]

    def mock_qdrant_query():
        query_count[0] += 1
        time.sleep(0.05)  # Simulate 50ms latency
        return [
            {'id': f'result_{i}', 'score': 0.95 - i * 0.05, 'payload': {'text': f'Result {i}'}}
            for i in range(5)
        ]

    print("\n[Test 1] First query (expected: MISS)")
    print("-" * 40)

    results1, status1 = manager.query_with_cache(
        session_id=test_session,
        user_id=test_user,
        persona_id=test_persona,
        intent=QueryIntent.DOCTRINAL_LOOKUP,
        query_text='What is the doctrine of grace?',
        collection='inspire_doctrinal',
        query_function=mock_qdrant_query,
    )

    print(f"  Status: {status1.value}")
    print(f"  Results: {len(results1)}")
    print(f"  Qdrant queries: {query_count[0]}")

    if status1 != CacheStatus.MISS:
        print("  [FAIL] Expected MISS")
        return 2

    print("  [PASS]")

    print("\n[Test 2] Identical query (expected: HIT)")
    print("-" * 40)

    results2, status2 = manager.query_with_cache(
        session_id=test_session,
        user_id=test_user,
        persona_id=test_persona,
        intent=QueryIntent.DOCTRINAL_LOOKUP,
        query_text='What is the doctrine of grace?',
        collection='inspire_doctrinal',
        query_function=mock_qdrant_query,
    )

    print(f"  Status: {status2.value}")
    print(f"  Results: {len(results2)}")
    print(f"  Qdrant queries: {query_count[0]} (should still be 1)")

    if status2 != CacheStatus.HIT:
        print("  [FAIL] Expected HIT")
        return 2

    if query_count[0] != 1:
        print("  [FAIL] Qdrant query should not have been called")
        return 2

    print("  [PASS]")

    print("\n[Test 3] Different query (expected: MISS)")
    print("-" * 40)

    results3, status3 = manager.query_with_cache(
        session_id=test_session,
        user_id=test_user,
        persona_id=test_persona,
        intent=QueryIntent.TEACHING_REFERENCE,
        query_text='How to teach about forgiveness?',
        collection='inspire_teaching',
        query_function=mock_qdrant_query,
    )

    print(f"  Status: {status3.value}")
    print(f"  Results: {len(results3)}")
    print(f"  Qdrant queries: {query_count[0]} (should be 2)")

    if status3 != CacheStatus.MISS:
        print("  [FAIL] Expected MISS")
        return 2

    print("  [PASS]")

    print("\n[Test 4] Force refresh (expected: MISS)")
    print("-" * 40)

    results4, status4 = manager.query_with_cache(
        session_id=test_session,
        user_id=test_user,
        persona_id=test_persona,
        intent=QueryIntent.DOCTRINAL_LOOKUP,
        query_text='What is the doctrine of grace?',
        collection='inspire_doctrinal',
        query_function=mock_qdrant_query,
        force_refresh=True,
    )

    print(f"  Status: {status4.value}")
    print(f"  Qdrant queries: {query_count[0]} (should be 3)")

    if status4 != CacheStatus.MISS:
        print("  [FAIL] Expected MISS with force_refresh")
        return 2

    print("  [PASS]")

    print("\n[Test 5] Session invalidation")
    print("-" * 40)

    invalidated = manager.invalidate_session(
        test_session,
        InvalidationReason.EXPLICIT_REQUEST
    )
    print(f"  Entries invalidated: {invalidated}")

    # Try to get cached result after invalidation
    cached = manager.check_cache(
        session_id=test_session,
        user_id=test_user,
        persona_id=test_persona,
        intent=QueryIntent.DOCTRINAL_LOOKUP,
        query_text='What is the doctrine of grace?',
        collection='inspire_doctrinal',
    )

    if cached is not None:
        print("  [FAIL] Cache should be empty after invalidation")
        return 2

    print("  [PASS]")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)

    # Show final statistics
    stats = manager.get_statistics()
    global_stats = stats.get('global', {})
    print(f"\nFinal Statistics:")
    print(f"  Total Queries: {global_stats.get('total_queries', 0)}")
    print(f"  Cache Hits: {global_stats.get('cache_hits', 0)}")
    print(f"  Cache Misses: {global_stats.get('cache_misses', 0)}")
    print(f"  Hit Rate: {global_stats.get('hit_rate', 0):.1f}%")

    return 0


def invalidate_session(args, manager: RetrievalCacheManager):
    """Invalidate session cache."""
    if not args.session:
        print("Error: --session is required for invalidation")
        return 1

    reason_map = {r.value: r for r in InvalidationReason}
    reason = reason_map.get(args.reason, InvalidationReason.EXPLICIT_REQUEST)

    count = manager.invalidate_session(args.session, reason)

    if args.format == 'json':
        print(json.dumps({
            'session_id': args.session,
            'reason': reason.value,
            'entries_invalidated': count,
        }, indent=2))
        return 0

    if count > 0:
        print(f"\nInvalidated {count} cache entries for session: {args.session}")
        print(f"Reason: {reason.value}")
    else:
        print(f"\nNo cache entries found for session: {args.session}")

    return 0


def cleanup_cache(args, manager: RetrievalCacheManager):
    """Clean up stale entries."""
    print("\n" + "=" * 60)
    print("CACHE CLEANUP")
    print("=" * 60)

    # Clean stale entries
    stale_count = manager.cleanup_stale_entries()
    print(f"\nStale entries removed: {stale_count}")

    # Clean expired sessions
    expired_count = manager.cleanup_expired_sessions()
    print(f"Expired sessions removed: {expired_count}")

    if args.format == 'json':
        print(json.dumps({
            'stale_entries_removed': stale_count,
            'expired_sessions_removed': expired_count,
        }, indent=2))

    print("\n" + "=" * 60)
    return 0


def show_config(args, manager: RetrievalCacheManager):
    """Show cache configuration."""
    config = manager.config

    if args.format == 'json':
        print(json.dumps(config.to_dict(), indent=2))
        return 0

    print("\n" + "=" * 60)
    print("CACHE CONFIGURATION")
    print("=" * 60)

    print("\n[Size Limits]")
    print(f"  Max entries per session: {config.max_entries_per_session:,}")
    print(f"  Max total entries: {config.max_total_entries:,}")
    print(f"  Max result size: {config.max_result_size_bytes / 1024:.0f} KB")

    print("\n[Freshness Windows]")
    print(f"  Default: {config.default_freshness_window}s")
    for intent, window in config.freshness_by_intent.items():
        print(f"  {intent}: {window}s")

    print("\n[Session]")
    print(f"  Timeout: {config.session_timeout_seconds}s ({config.session_timeout_seconds / 60:.0f} min)")

    print("\n[Matching]")
    print(f"  Query similarity threshold: {config.query_similarity_threshold * 100:.0f}%")
    print(f"  Context change threshold: {config.context_change_threshold * 100:.0f}%")

    print("\n[Eviction]")
    print(f"  Policy: {config.eviction_policy.upper()}")

    print("\n[Logging]")
    print(f"  Log events: {config.log_cache_events}")
    print(f"  Log directory: {config.log_directory}")

    print("\n" + "=" * 60)
    return 0


def main():
    """Main entry point."""
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Get cache manager
    config = RetrievalCacheConfig()
    manager = get_cache_manager(config)

    # Execute command
    if args.command == 'status':
        return show_status(args, manager)
    elif args.command == 'sessions':
        return show_sessions(args, manager)
    elif args.command == 'test':
        return run_test(args, manager)
    elif args.command == 'invalidate':
        return invalidate_session(args, manager)
    elif args.command == 'cleanup':
        return cleanup_cache(args, manager)
    elif args.command == 'config':
        return show_config(args, manager)
    else:
        logger.error(f"Unknown command: {args.command}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
