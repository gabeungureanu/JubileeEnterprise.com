#!/usr/bin/env python3
# =============================================================================
# MANAGE BACKUPS
# =============================================================================
"""
CLI tool for managing Inspire 8.0 backups and rebuilds.

This script provides commands for backup creation, restoration, verification,
archival, and clean rebuilds from source data.

USAGE:
    python manage_backups.py [options] [command]

COMMANDS:
    backup               Create a new backup
    restore              Restore from a backup
    verify               Verify backup integrity
    archive              Archive a backup for long-term storage
    rebuild              Rebuild from source data
    list                 List available backups
    status               Show backup system status
    cleanup              Apply retention policies
    config               Show backup configuration
    test                 Run backup/restore test

OPTIONS:
    --collections COLS   Comma-separated list of collections
    --manifest-id ID     Backup manifest ID
    --retention POLICY   Retention policy (daily, weekly, monthly, quarterly, permanent)
    --dry-run            Simulate operation without making changes
    --format FORMAT      Output format: text, json (default: text)
    --verbose            Enable verbose logging

EXIT CODES:
    0 - Success
    1 - Configuration error
    2 - Backup failed
    3 - Restore failed
    4 - Verification failed
    5 - Rebuild failed
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

from backup.backup_manager import (
    BackupManager,
    BackupConfig,
    BackupType,
    BackupStatus,
    RebuildMode,
    RetentionPolicy,
    get_backup_manager,
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
        description='Manage Inspire 8.0 backups and rebuilds',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        'command',
        type=str,
        nargs='?',
        default='status',
        choices=['backup', 'restore', 'verify', 'archive', 'rebuild',
                 'list', 'status', 'cleanup', 'config', 'test'],
        help='Command to execute (default: status)'
    )
    parser.add_argument(
        '--collections',
        type=str,
        default='',
        help='Comma-separated list of collections'
    )
    parser.add_argument(
        '--manifest-id',
        type=str,
        default='',
        help='Backup manifest ID'
    )
    parser.add_argument(
        '--retention',
        type=str,
        default='daily',
        choices=['daily', 'weekly', 'monthly', 'quarterly', 'permanent'],
        help='Retention policy (default: daily)'
    )
    parser.add_argument(
        '--notes',
        type=str,
        default='',
        help='Notes for the backup'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simulate operation without making changes'
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


def get_retention_policy(policy_str: str) -> RetentionPolicy:
    """Convert string to RetentionPolicy enum."""
    return {
        'daily': RetentionPolicy.DAILY,
        'weekly': RetentionPolicy.WEEKLY,
        'monthly': RetentionPolicy.MONTHLY,
        'quarterly': RetentionPolicy.QUARTERLY,
        'permanent': RetentionPolicy.PERMANENT,
    }.get(policy_str, RetentionPolicy.DAILY)


def create_backup(args, manager: BackupManager):
    """Create a new backup."""
    collections = args.collections.split(',') if args.collections else None
    retention = get_retention_policy(args.retention)

    if args.dry_run:
        print("\n[DRY RUN] Would create backup:")
        print(f"  Collections: {collections or 'all'}")
        print(f"  Retention: {retention.value}")
        print(f"  Notes: {args.notes or '(none)'}")
        return 0

    print("\n" + "=" * 60)
    print("CREATING BACKUP")
    print("=" * 60)

    start_time = time.time()

    manifest = manager.create_backup(
        collections=collections,
        retention_policy=retention,
        notes=args.notes,
    )

    duration = time.time() - start_time

    if args.format == 'json':
        print(json.dumps(manifest.to_dict(), indent=2))
        return 0

    print(f"\nBackup Created Successfully")
    print("-" * 40)
    print(f"  Manifest ID:    {manifest.manifest_id}")
    print(f"  Collections:    {len(manifest.collections)}")
    print(f"  Snapshots:      {len(manifest.snapshots)}")
    print(f"  Total Size:     {manifest.total_size_bytes:,} bytes")
    print(f"  Status:         {manifest.status.value}")
    print(f"  Retention:      {manifest.retention_policy.value}")
    print(f"  Source Version: {manifest.source_version}")
    print(f"  Duration:       {duration:.1f}s")

    print("\n" + "=" * 60)
    return 0


def restore_backup(args, manager: BackupManager):
    """Restore from a backup."""
    if not args.manifest_id:
        print("Error: --manifest-id is required for restore")
        return 1

    collections = args.collections.split(',') if args.collections else None

    if args.dry_run:
        print("\n[DRY RUN] Would restore backup:")
        print(f"  Manifest ID: {args.manifest_id}")
        print(f"  Collections: {collections or 'all'}")
        return 0

    print("\n" + "=" * 60)
    print("RESTORING BACKUP")
    print("=" * 60)

    start_time = time.time()

    success, message = manager.restore_backup(
        manifest_id=args.manifest_id,
        collections=collections,
    )

    duration = time.time() - start_time

    if args.format == 'json':
        print(json.dumps({
            'success': success,
            'message': message,
            'manifest_id': args.manifest_id,
            'duration_seconds': round(duration, 2),
        }, indent=2))
        return 0 if success else 3

    print(f"\nResult: {'SUCCESS' if success else 'FAILED'}")
    print(f"Message: {message}")
    print(f"Duration: {duration:.1f}s")

    print("\n" + "=" * 60)
    return 0 if success else 3


def verify_backup(args, manager: BackupManager):
    """Verify backup integrity."""
    if not args.manifest_id:
        print("Error: --manifest-id is required for verification")
        return 1

    print("\n" + "=" * 60)
    print("VERIFYING BACKUP")
    print("=" * 60)

    valid, results = manager.verify_backup(args.manifest_id)

    if args.format == 'json':
        print(json.dumps({
            'valid': valid,
            'manifest_id': args.manifest_id,
            'results': results,
        }, indent=2))
        return 0 if valid else 4

    print(f"\nManifest: {args.manifest_id}")
    print(f"Status: {'VERIFIED' if valid else 'FAILED'}")

    print("\n" + "-" * 40)
    print("Collection Results:")

    for collection, result in results.items():
        status = "OK" if result.get('valid', False) else "FAIL"
        print(f"  [{status}] {collection}: {result.get('message', '')}")

    print("\n" + "=" * 60)
    return 0 if valid else 4


def archive_backup(args, manager: BackupManager):
    """Archive a backup for long-term storage."""
    if not args.manifest_id:
        print("Error: --manifest-id is required for archival")
        return 1

    if args.dry_run:
        print("\n[DRY RUN] Would archive backup:")
        print(f"  Manifest ID: {args.manifest_id}")
        return 0

    print("\n" + "=" * 60)
    print("ARCHIVING BACKUP")
    print("=" * 60)

    success, archive_path = manager.archive_backup(args.manifest_id)

    if args.format == 'json':
        print(json.dumps({
            'success': success,
            'manifest_id': args.manifest_id,
            'archive_path': archive_path,
        }, indent=2))
        return 0 if success else 2

    if success:
        print(f"\nBackup archived successfully")
        print(f"Archive: {archive_path}")
    else:
        print(f"\nArchival failed: {archive_path}")

    print("\n" + "=" * 60)
    return 0 if success else 2


def rebuild_system(args, manager: BackupManager):
    """Rebuild from source data."""
    collections = args.collections.split(',') if args.collections else None

    print("\n" + "=" * 60)
    print("REBUILDING FROM SOURCE")
    print("=" * 60)

    if args.dry_run:
        print("\n[DRY RUN] Simulating rebuild...")

    start_time = time.time()

    success, results = manager.rebuild_from_source(
        collections=collections,
        dry_run=args.dry_run,
    )

    duration = time.time() - start_time

    if args.format == 'json':
        print(json.dumps({
            'success': success,
            'dry_run': args.dry_run,
            'duration_seconds': round(duration, 2),
            'results': results,
        }, indent=2))
        return 0 if success else 5

    print(f"\nResult: {'SUCCESS' if success else 'FAILED'}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Duration: {duration:.1f}s")

    print("\n" + "-" * 40)
    print("Collections Processed:")
    for collection in results.get('collections_processed', []):
        print(f"  [OK] {collection}")

    if results.get('collections_failed'):
        print("\nCollections Failed:")
        for failure in results['collections_failed']:
            print(f"  [FAIL] {failure['collection']}: {failure['error']}")

    print("\n" + "=" * 60)
    return 0 if success else 5


def list_backups(args, manager: BackupManager):
    """List available backups."""
    backups = manager.list_backups(limit=20)

    if args.format == 'json':
        print(json.dumps([b.to_dict() for b in backups], indent=2))
        return 0

    print("\n" + "=" * 60)
    print("AVAILABLE BACKUPS")
    print("=" * 60)

    if not backups:
        print("\nNo backups found.")
        return 0

    print(f"\n{'Manifest ID':<35} {'Created':<20} {'Status':<12} {'Collections':>12}")
    print("-" * 80)

    for backup in backups:
        created = backup.created_at.strftime("%Y-%m-%d %H:%M")
        print(
            f"{backup.manifest_id:<35} "
            f"{created:<20} "
            f"{backup.status.value:<12} "
            f"{len(backup.collections):>12}"
        )

    print("\n" + "=" * 60)
    return 0


def show_status(args, manager: BackupManager):
    """Show backup system status."""
    stats = manager.get_statistics()

    if args.format == 'json':
        print(json.dumps(stats, indent=2))
        return 0

    print("\n" + "=" * 60)
    print("BACKUP SYSTEM STATUS")
    print("=" * 60)

    print(f"\n{'Total Backups:':<25} {stats.get('total_backups', 0):>10}")
    print(f"{'Total Snapshots:':<25} {stats.get('total_snapshots', 0):>10}")
    print(f"{'Total Archives:':<25} {stats.get('total_archives', 0):>10}")
    print(f"{'Verified Backups:':<25} {stats.get('verified_backups', 0):>10}")
    print(f"{'Archived Backups:':<25} {stats.get('archived_backups', 0):>10}")

    total_size = stats.get('total_size_bytes', 0)
    if total_size > 1024 * 1024 * 1024:
        size_str = f"{total_size / (1024*1024*1024):.2f} GB"
    elif total_size > 1024 * 1024:
        size_str = f"{total_size / (1024*1024):.2f} MB"
    else:
        size_str = f"{total_size / 1024:.2f} KB"

    print(f"\n{'Total Size:':<25} {size_str:>10}")

    latest = stats.get('latest_backup')
    if latest:
        print(f"{'Latest Backup:':<25} {latest}")

    collections = stats.get('collections_covered', [])
    if collections:
        print(f"\nCollections Covered ({len(collections)}):")
        for col in collections[:10]:
            print(f"  - {col}")
        if len(collections) > 10:
            print(f"  ... and {len(collections) - 10} more")

    print("\n" + "=" * 60)
    return 0


def cleanup_backups(args, manager: BackupManager):
    """Apply retention policies."""
    if args.dry_run:
        print("\n[DRY RUN] Would apply retention policies")
        return 0

    print("\n" + "=" * 60)
    print("APPLYING RETENTION POLICIES")
    print("=" * 60)

    results = manager.apply_retention_policies()

    if args.format == 'json':
        print(json.dumps(results, indent=2))
        return 0

    print(f"\nSnapshots deleted: {results.get('snapshots_deleted', 0)}")
    print(f"Manifests cleaned: {results.get('manifests_cleaned', 0)}")

    print("\n" + "=" * 60)
    return 0


def show_config(args, manager: BackupManager):
    """Show backup configuration."""
    config = manager.config

    if args.format == 'json':
        print(json.dumps(config.to_dict(), indent=2))
        return 0

    print("\n" + "=" * 60)
    print("BACKUP CONFIGURATION")
    print("=" * 60)

    print("\n[Directories]")
    print(f"  Backup:    {config.backup_directory}")
    print(f"  Archive:   {config.archive_directory}")
    print(f"  Snapshot:  {config.snapshot_directory}")
    print(f"  Manifest:  {config.manifest_directory}")
    print(f"  Logs:      {config.log_directory}")

    print("\n[Qdrant Connection]")
    print(f"  Host: {config.qdrant_host}")
    print(f"  Port: {config.qdrant_port}")

    print("\n[Retention Policies (days)]")
    print(f"  Daily:     {config.daily_retention_days}")
    print(f"  Weekly:    {config.weekly_retention_days}")
    print(f"  Monthly:   {config.monthly_retention_days}")
    print(f"  Quarterly: {config.quarterly_retention_days}")

    print("\n[Backup Settings]")
    print(f"  Auto-backup:  {config.auto_backup_enabled}")
    print(f"  Interval:     {config.backup_interval_hours} hours")
    print(f"  Verify after: {config.verify_after_backup}")
    print(f"  Compression:  {config.compress_archives} (level {config.compression_level})")

    print(f"\n[Collections ({len(config.collections)})]")
    for col in config.collections:
        print(f"  - {col}")

    print("\n" + "=" * 60)
    return 0


def run_test(args, manager: BackupManager):
    """Run backup/restore test."""
    print("\n" + "=" * 60)
    print("BACKUP/RESTORE TEST")
    print("=" * 60)

    test_collection = "inspire_authority_foundation"

    # Test 1: Create backup
    print("\n[Test 1] Creating backup...")
    manifest = manager.create_backup(
        collections=[test_collection],
        notes="Test backup",
    )
    print(f"  Created: {manifest.manifest_id}")
    print(f"  Status: {manifest.status.value}")

    if manifest.status != BackupStatus.COMPLETED:
        print("  [FAIL] Backup creation failed")
        return 2

    print("  [PASS]")

    # Test 2: Verify backup
    print("\n[Test 2] Verifying backup...")
    valid, results = manager.verify_backup(manifest.manifest_id)
    print(f"  Valid: {valid}")

    if not valid:
        print("  [FAIL] Backup verification failed")
        return 4

    print("  [PASS]")

    # Test 3: List backups
    print("\n[Test 3] Listing backups...")
    backups = manager.list_backups(limit=5)
    print(f"  Found {len(backups)} backups")

    if len(backups) == 0:
        print("  [FAIL] No backups found")
        return 2

    print("  [PASS]")

    # Test 4: Archive backup
    print("\n[Test 4] Archiving backup...")
    success, archive_path = manager.archive_backup(manifest.manifest_id)
    print(f"  Success: {success}")

    if not success:
        print("  [FAIL] Archive creation failed")
        return 2

    print(f"  Archive: {archive_path}")
    print("  [PASS]")

    # Test 5: Rebuild (dry run)
    print("\n[Test 5] Rebuild dry run...")
    success, results = manager.rebuild_from_source(
        collections=[test_collection],
        dry_run=True,
    )
    print(f"  Success: {success}")
    print(f"  Collections: {results.get('collections_processed', [])}")

    if not success:
        print("  [FAIL] Rebuild dry run failed")
        return 5

    print("  [PASS]")

    # Test 6: Get statistics
    print("\n[Test 6] Getting statistics...")
    stats = manager.get_statistics()
    print(f"  Total backups: {stats.get('total_backups', 0)}")
    print("  [PASS]")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)

    return 0


def main():
    """Main entry point."""
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Get backup manager
    config = BackupConfig()
    manager = get_backup_manager(config)

    # Execute command
    if args.command == 'backup':
        return create_backup(args, manager)
    elif args.command == 'restore':
        return restore_backup(args, manager)
    elif args.command == 'verify':
        return verify_backup(args, manager)
    elif args.command == 'archive':
        return archive_backup(args, manager)
    elif args.command == 'rebuild':
        return rebuild_system(args, manager)
    elif args.command == 'list':
        return list_backups(args, manager)
    elif args.command == 'status':
        return show_status(args, manager)
    elif args.command == 'cleanup':
        return cleanup_backups(args, manager)
    elif args.command == 'config':
        return show_config(args, manager)
    elif args.command == 'test':
        return run_test(args, manager)
    else:
        logger.error(f"Unknown command: {args.command}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
