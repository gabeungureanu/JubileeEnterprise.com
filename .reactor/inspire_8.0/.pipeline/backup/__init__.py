#!/usr/bin/env python3
# =============================================================================
# BACKUP MODULE
# =============================================================================
"""
Backup and rebuild management for Inspire 8.0 Qdrant system.

This module provides comprehensive backup, restore, and rebuild capabilities
ensuring the system can be fully recovered at any time.

FEATURES:
- Qdrant snapshot management
- Versioned backup archives
- Retention policy enforcement
- Reproducible rebuild from source
- Full audit logging

USAGE:
    from backup import (
        get_backup_manager,
        create_backup,
        restore_backup,
        rebuild_from_source,
        BackupType,
        RetentionPolicy,
    )

    # Create a backup
    manifest = create_backup(
        collections=['inspire_authority_foundation'],
        retention_policy=RetentionPolicy.WEEKLY,
    )

    # Restore from backup
    success, message = restore_backup(manifest.manifest_id)

    # Rebuild from source
    success, results = rebuild_from_source(dry_run=True)
"""

from .backup_manager import (
    # Enums
    BackupType,
    BackupStatus,
    RebuildMode,
    RetentionPolicy,

    # Data classes
    SnapshotMetadata,
    BackupManifest,
    IngestionConfig,
    RebuildPlan,
    BackupEvent,

    # Configuration
    BackupConfig,

    # Event logger
    BackupEventLogger,

    # Managers
    SnapshotManager,
    ArchiveManager,
    RebuildManager,
    BackupManager,

    # Helper functions
    get_backup_manager,
    create_backup,
    restore_backup,
    rebuild_from_source,
)

__all__ = [
    # Enums
    'BackupType',
    'BackupStatus',
    'RebuildMode',
    'RetentionPolicy',

    # Data classes
    'SnapshotMetadata',
    'BackupManifest',
    'IngestionConfig',
    'RebuildPlan',
    'BackupEvent',

    # Configuration
    'BackupConfig',

    # Event logger
    'BackupEventLogger',

    # Managers
    'SnapshotManager',
    'ArchiveManager',
    'RebuildManager',
    'BackupManager',

    # Helper functions
    'get_backup_manager',
    'create_backup',
    'restore_backup',
    'rebuild_from_source',
]

__version__ = '1.0.0'
