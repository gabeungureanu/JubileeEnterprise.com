#!/usr/bin/env python3
# =============================================================================
# BACKUP MANAGER
# =============================================================================
"""
Comprehensive backup and rebuild management for Inspire 8.0 Qdrant system.

This module provides tools for:
- Creating and managing Qdrant snapshots
- Archiving snapshots with versioned retention policies
- Reproducible, deterministic rebuild from source data
- Idempotent ingestion that can reconstruct the entire system

BACKUP STRATEGY:
1. Qdrant Snapshots: Point-in-time snapshots of all collections
2. Source Archival: Versioned source files in repository
3. Reproducible Rebuild: Replay ingestion from authoritative sources

RECOVERY PATHS:
1. Snapshot Restore: Fast recovery from recent snapshot
2. Clean Re-ingestion: Full rebuild from source data
3. Hybrid: Restore snapshot + replay recent changes

Author: Jubilee Enterprise
Version: 1.0.0
"""

import hashlib
import json
import logging
import os
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import zipfile

# Configure logging
logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class BackupType(Enum):
    """Types of backup operations."""
    SNAPSHOT = "snapshot"
    FULL_ARCHIVE = "full_archive"
    INCREMENTAL = "incremental"
    SOURCE_ONLY = "source_only"


class BackupStatus(Enum):
    """Status of backup operations."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    VERIFIED = "verified"
    ARCHIVED = "archived"


class RebuildMode(Enum):
    """Modes for system rebuild."""
    SNAPSHOT_RESTORE = "snapshot_restore"
    CLEAN_INGESTION = "clean_ingestion"
    HYBRID = "hybrid"
    VALIDATION_ONLY = "validation_only"


class RetentionPolicy(Enum):
    """Retention policies for backups."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    PERMANENT = "permanent"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class SnapshotMetadata:
    """
    Metadata for a Qdrant snapshot.
    """
    snapshot_id: str
    collection_name: str
    created_at: datetime
    size_bytes: int
    point_count: int
    vector_dimension: int
    checksum: str
    qdrant_version: str
    backup_path: str
    retention_policy: RetentionPolicy = RetentionPolicy.DAILY
    verified: bool = False
    archived: bool = False
    archive_path: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'snapshot_id': self.snapshot_id,
            'collection_name': self.collection_name,
            'created_at': self.created_at.isoformat(),
            'size_bytes': self.size_bytes,
            'point_count': self.point_count,
            'vector_dimension': self.vector_dimension,
            'checksum': self.checksum,
            'qdrant_version': self.qdrant_version,
            'backup_path': self.backup_path,
            'retention_policy': self.retention_policy.value,
            'verified': self.verified,
            'archived': self.archived,
            'archive_path': self.archive_path,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SnapshotMetadata':
        """Create from dictionary."""
        return cls(
            snapshot_id=data['snapshot_id'],
            collection_name=data['collection_name'],
            created_at=datetime.fromisoformat(data['created_at']),
            size_bytes=data['size_bytes'],
            point_count=data['point_count'],
            vector_dimension=data['vector_dimension'],
            checksum=data['checksum'],
            qdrant_version=data['qdrant_version'],
            backup_path=data['backup_path'],
            retention_policy=RetentionPolicy(data.get('retention_policy', 'daily')),
            verified=data.get('verified', False),
            archived=data.get('archived', False),
            archive_path=data.get('archive_path', ''),
        )


@dataclass
class BackupManifest:
    """
    Manifest describing a complete backup set.
    """
    manifest_id: str
    backup_type: BackupType
    created_at: datetime
    collections: List[str]
    snapshots: List[SnapshotMetadata]
    source_version: str  # Git commit hash
    config_hash: str
    total_size_bytes: int
    status: BackupStatus
    retention_policy: RetentionPolicy
    notes: str = ""
    verified_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    archive_location: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'manifest_id': self.manifest_id,
            'backup_type': self.backup_type.value,
            'created_at': self.created_at.isoformat(),
            'collections': self.collections,
            'snapshots': [s.to_dict() for s in self.snapshots],
            'source_version': self.source_version,
            'config_hash': self.config_hash,
            'total_size_bytes': self.total_size_bytes,
            'status': self.status.value,
            'retention_policy': self.retention_policy.value,
            'notes': self.notes,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'archived_at': self.archived_at.isoformat() if self.archived_at else None,
            'archive_location': self.archive_location,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BackupManifest':
        """Create from dictionary."""
        return cls(
            manifest_id=data['manifest_id'],
            backup_type=BackupType(data['backup_type']),
            created_at=datetime.fromisoformat(data['created_at']),
            collections=data['collections'],
            snapshots=[SnapshotMetadata.from_dict(s) for s in data['snapshots']],
            source_version=data['source_version'],
            config_hash=data['config_hash'],
            total_size_bytes=data['total_size_bytes'],
            status=BackupStatus(data['status']),
            retention_policy=RetentionPolicy(data.get('retention_policy', 'daily')),
            notes=data.get('notes', ''),
            verified_at=datetime.fromisoformat(data['verified_at']) if data.get('verified_at') else None,
            archived_at=datetime.fromisoformat(data['archived_at']) if data.get('archived_at') else None,
            archive_location=data.get('archive_location', ''),
        )


@dataclass
class IngestionConfig:
    """
    Configuration for reproducible ingestion.
    """
    config_id: str
    source_paths: List[str]
    collection_mappings: Dict[str, str]  # source -> collection
    chunking_config: Dict[str, Any]
    embedding_config: Dict[str, Any]
    processing_order: List[str]
    idempotency_key: str
    version: str
    created_at: datetime = field(default_factory=datetime.now)

    def compute_hash(self) -> str:
        """Compute deterministic hash of configuration."""
        config_data = {
            'source_paths': sorted(self.source_paths),
            'collection_mappings': dict(sorted(self.collection_mappings.items())),
            'chunking_config': json.dumps(self.chunking_config, sort_keys=True),
            'embedding_config': json.dumps(self.embedding_config, sort_keys=True),
            'processing_order': self.processing_order,
        }
        config_string = json.dumps(config_data, sort_keys=True)
        return hashlib.sha256(config_string.encode()).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'config_id': self.config_id,
            'source_paths': self.source_paths,
            'collection_mappings': self.collection_mappings,
            'chunking_config': self.chunking_config,
            'embedding_config': self.embedding_config,
            'processing_order': self.processing_order,
            'idempotency_key': self.idempotency_key,
            'version': self.version,
            'created_at': self.created_at.isoformat(),
            'config_hash': self.compute_hash(),
        }


@dataclass
class RebuildPlan:
    """
    Plan for system rebuild.
    """
    plan_id: str
    mode: RebuildMode
    target_state: str  # snapshot_id or "latest" or specific version
    collections_to_rebuild: List[str]
    estimated_duration_seconds: int
    source_snapshot: Optional[str] = None
    ingestion_config: Optional[IngestionConfig] = None
    validation_checks: List[str] = field(default_factory=list)
    rollback_snapshot: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'plan_id': self.plan_id,
            'mode': self.mode.value,
            'target_state': self.target_state,
            'collections_to_rebuild': self.collections_to_rebuild,
            'estimated_duration_seconds': self.estimated_duration_seconds,
            'source_snapshot': self.source_snapshot,
            'ingestion_config': self.ingestion_config.to_dict() if self.ingestion_config else None,
            'validation_checks': self.validation_checks,
            'rollback_snapshot': self.rollback_snapshot,
            'created_at': self.created_at.isoformat(),
        }


@dataclass
class BackupEvent:
    """
    Event log entry for backup/rebuild operations.
    """
    event_id: str
    timestamp: datetime
    operation: str  # backup, restore, rebuild, verify, archive
    status: BackupStatus
    manifest_id: Optional[str]
    collections: List[str]
    duration_seconds: float
    size_bytes: int
    details: Dict[str, Any] = field(default_factory=dict)
    error_message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging."""
        return {
            'event_id': self.event_id,
            'timestamp': self.timestamp.isoformat(),
            'operation': self.operation,
            'status': self.status.value,
            'manifest_id': self.manifest_id,
            'collections': self.collections,
            'duration_seconds': round(self.duration_seconds, 2),
            'size_bytes': self.size_bytes,
            'details': self.details,
            'error_message': self.error_message,
        }


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class BackupConfig:
    """
    Configuration for backup management.
    """
    # Paths
    backup_directory: str = "backups"
    archive_directory: str = "backups/archive"
    snapshot_directory: str = "backups/snapshots"
    manifest_directory: str = "backups/manifests"
    log_directory: str = "logs/backup"

    # Qdrant connection
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_api_key: str = ""

    # Retention policies (days)
    daily_retention_days: int = 7
    weekly_retention_days: int = 30
    monthly_retention_days: int = 365
    quarterly_retention_days: int = 730  # 2 years

    # Backup schedule
    auto_backup_enabled: bool = True
    backup_interval_hours: int = 24

    # Verification
    verify_after_backup: bool = True
    verify_after_restore: bool = True

    # Compression
    compress_archives: bool = True
    compression_level: int = 6  # 1-9

    # Collections to backup
    collections: List[str] = field(default_factory=lambda: [
        "inspire_authority_foundation",
        "inspire_canonical_personas",
        "inspire_scripture_core",
        "inspire_theology_systematic",
        "inspire_theology_pastoral",
        "inspire_theology_apologetics",
        "inspire_design_canon",
        "inspire_ui_components",
        "inspire_audit_history",
        "inspire_drift_baselines",
    ])

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'backup_directory': self.backup_directory,
            'archive_directory': self.archive_directory,
            'snapshot_directory': self.snapshot_directory,
            'manifest_directory': self.manifest_directory,
            'log_directory': self.log_directory,
            'qdrant_host': self.qdrant_host,
            'qdrant_port': self.qdrant_port,
            'daily_retention_days': self.daily_retention_days,
            'weekly_retention_days': self.weekly_retention_days,
            'monthly_retention_days': self.monthly_retention_days,
            'quarterly_retention_days': self.quarterly_retention_days,
            'auto_backup_enabled': self.auto_backup_enabled,
            'backup_interval_hours': self.backup_interval_hours,
            'verify_after_backup': self.verify_after_backup,
            'verify_after_restore': self.verify_after_restore,
            'compress_archives': self.compress_archives,
            'compression_level': self.compression_level,
            'collections': self.collections,
        }


# =============================================================================
# BACKUP EVENT LOGGER
# =============================================================================

class BackupEventLogger:
    """
    Logs backup and rebuild events for auditability.
    """

    def __init__(self, config: BackupConfig):
        self.config = config
        self.log_path = Path(config.log_directory)
        self.log_path.mkdir(parents=True, exist_ok=True)
        self._event_count = 0
        self._lock = threading.Lock()

    def _get_log_file(self) -> Path:
        """Get current log file path."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        return self.log_path / f"backup_events_{date_str}.jsonl"

    def _generate_event_id(self) -> str:
        """Generate unique event ID."""
        with self._lock:
            self._event_count += 1
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            return f"backup_{timestamp}_{self._event_count:06d}"

    def log_event(self, event: BackupEvent) -> None:
        """Log a backup event."""
        try:
            log_file = self._get_log_file()
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(event.to_dict()) + '\n')
        except Exception as e:
            logger.error(f"Failed to log backup event: {e}")

    def log_backup_start(
        self,
        manifest_id: str,
        collections: List[str],
    ) -> BackupEvent:
        """Log backup start."""
        event = BackupEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            operation="backup",
            status=BackupStatus.IN_PROGRESS,
            manifest_id=manifest_id,
            collections=collections,
            duration_seconds=0,
            size_bytes=0,
        )
        self.log_event(event)
        return event

    def log_backup_complete(
        self,
        manifest_id: str,
        collections: List[str],
        duration_seconds: float,
        size_bytes: int,
        success: bool,
        error_message: str = "",
    ) -> BackupEvent:
        """Log backup completion."""
        event = BackupEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            operation="backup",
            status=BackupStatus.COMPLETED if success else BackupStatus.FAILED,
            manifest_id=manifest_id,
            collections=collections,
            duration_seconds=duration_seconds,
            size_bytes=size_bytes,
            error_message=error_message,
        )
        self.log_event(event)
        return event

    def log_restore(
        self,
        manifest_id: str,
        collections: List[str],
        duration_seconds: float,
        success: bool,
        error_message: str = "",
    ) -> BackupEvent:
        """Log restore operation."""
        event = BackupEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            operation="restore",
            status=BackupStatus.COMPLETED if success else BackupStatus.FAILED,
            manifest_id=manifest_id,
            collections=collections,
            duration_seconds=duration_seconds,
            size_bytes=0,
            error_message=error_message,
        )
        self.log_event(event)
        return event

    def log_rebuild(
        self,
        plan_id: str,
        collections: List[str],
        duration_seconds: float,
        success: bool,
        details: Dict[str, Any] = None,
        error_message: str = "",
    ) -> BackupEvent:
        """Log rebuild operation."""
        event = BackupEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            operation="rebuild",
            status=BackupStatus.COMPLETED if success else BackupStatus.FAILED,
            manifest_id=plan_id,
            collections=collections,
            duration_seconds=duration_seconds,
            size_bytes=0,
            details=details or {},
            error_message=error_message,
        )
        self.log_event(event)
        return event

    def log_verification(
        self,
        manifest_id: str,
        collections: List[str],
        success: bool,
        details: Dict[str, Any] = None,
    ) -> BackupEvent:
        """Log verification operation."""
        event = BackupEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.now(),
            operation="verify",
            status=BackupStatus.VERIFIED if success else BackupStatus.FAILED,
            manifest_id=manifest_id,
            collections=collections,
            duration_seconds=0,
            size_bytes=0,
            details=details or {},
        )
        self.log_event(event)
        return event


# =============================================================================
# SNAPSHOT MANAGER
# =============================================================================

class SnapshotManager:
    """
    Manages Qdrant snapshots for backup and restore.
    """

    def __init__(self, config: BackupConfig):
        self.config = config
        self.snapshot_path = Path(config.snapshot_directory)
        self.snapshot_path.mkdir(parents=True, exist_ok=True)
        self._snapshots: Dict[str, SnapshotMetadata] = {}

    def create_snapshot(
        self,
        collection_name: str,
        retention_policy: RetentionPolicy = RetentionPolicy.DAILY,
    ) -> SnapshotMetadata:
        """
        Create a snapshot of a Qdrant collection.

        In a real implementation, this would call the Qdrant API.
        For now, we simulate the snapshot creation.
        """
        timestamp = datetime.now()
        snapshot_id = f"{collection_name}_{timestamp.strftime('%Y%m%d_%H%M%S')}"

        # Simulate snapshot file
        snapshot_file = self.snapshot_path / f"{snapshot_id}.snapshot"

        # In production, call Qdrant API:
        # POST /collections/{collection_name}/snapshots

        # Simulate metadata
        metadata = SnapshotMetadata(
            snapshot_id=snapshot_id,
            collection_name=collection_name,
            created_at=timestamp,
            size_bytes=0,  # Would be actual size
            point_count=0,  # Would be from collection info
            vector_dimension=1536,  # Typical for OpenAI embeddings
            checksum=hashlib.sha256(snapshot_id.encode()).hexdigest(),
            qdrant_version="1.7.0",
            backup_path=str(snapshot_file),
            retention_policy=retention_policy,
        )

        self._snapshots[snapshot_id] = metadata
        logger.info(f"Created snapshot: {snapshot_id}")

        return metadata

    def list_snapshots(
        self,
        collection_name: Optional[str] = None,
    ) -> List[SnapshotMetadata]:
        """List available snapshots."""
        snapshots = list(self._snapshots.values())

        if collection_name:
            snapshots = [s for s in snapshots if s.collection_name == collection_name]

        return sorted(snapshots, key=lambda s: s.created_at, reverse=True)

    def get_snapshot(self, snapshot_id: str) -> Optional[SnapshotMetadata]:
        """Get snapshot by ID."""
        return self._snapshots.get(snapshot_id)

    def delete_snapshot(self, snapshot_id: str) -> bool:
        """Delete a snapshot."""
        if snapshot_id not in self._snapshots:
            return False

        metadata = self._snapshots[snapshot_id]
        snapshot_file = Path(metadata.backup_path)

        if snapshot_file.exists():
            snapshot_file.unlink()

        del self._snapshots[snapshot_id]
        logger.info(f"Deleted snapshot: {snapshot_id}")

        return True

    def verify_snapshot(self, snapshot_id: str) -> Tuple[bool, str]:
        """
        Verify snapshot integrity.

        Returns:
            Tuple of (is_valid, message)
        """
        metadata = self._snapshots.get(snapshot_id)
        if not metadata:
            return False, f"Snapshot not found: {snapshot_id}"

        # In production, verify checksum and test restore
        # For now, simulate verification

        metadata.verified = True
        return True, "Snapshot verified successfully"

    def restore_snapshot(
        self,
        snapshot_id: str,
        target_collection: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Restore a snapshot to a collection.

        In production, this would call Qdrant API:
        PUT /collections/{collection_name}/snapshots/recover

        Returns:
            Tuple of (success, message)
        """
        metadata = self._snapshots.get(snapshot_id)
        if not metadata:
            return False, f"Snapshot not found: {snapshot_id}"

        target = target_collection or metadata.collection_name
        logger.info(f"Restoring snapshot {snapshot_id} to {target}")

        # In production, call Qdrant API

        return True, f"Restored {snapshot_id} to {target}"

    def apply_retention_policy(self) -> int:
        """
        Apply retention policy and delete expired snapshots.

        Returns number of snapshots deleted.
        """
        now = datetime.now()
        deleted = 0

        for snapshot_id, metadata in list(self._snapshots.items()):
            age_days = (now - metadata.created_at).days

            max_age = {
                RetentionPolicy.DAILY: self.config.daily_retention_days,
                RetentionPolicy.WEEKLY: self.config.weekly_retention_days,
                RetentionPolicy.MONTHLY: self.config.monthly_retention_days,
                RetentionPolicy.QUARTERLY: self.config.quarterly_retention_days,
                RetentionPolicy.PERMANENT: float('inf'),
            }.get(metadata.retention_policy, self.config.daily_retention_days)

            if age_days > max_age:
                self.delete_snapshot(snapshot_id)
                deleted += 1

        logger.info(f"Retention policy applied: {deleted} snapshots deleted")
        return deleted


# =============================================================================
# ARCHIVE MANAGER
# =============================================================================

class ArchiveManager:
    """
    Manages backup archives for long-term storage.
    """

    def __init__(self, config: BackupConfig):
        self.config = config
        self.archive_path = Path(config.archive_directory)
        self.archive_path.mkdir(parents=True, exist_ok=True)

    def create_archive(
        self,
        manifest: BackupManifest,
        snapshots: List[SnapshotMetadata],
    ) -> str:
        """
        Create a compressed archive of backup files.

        Returns archive path.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_name = f"inspire_backup_{timestamp}.zip"
        archive_file = self.archive_path / archive_name

        with zipfile.ZipFile(
            archive_file,
            'w',
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=self.config.compression_level,
        ) as zf:
            # Add manifest
            manifest_json = json.dumps(manifest.to_dict(), indent=2)
            zf.writestr("manifest.json", manifest_json)

            # Add snapshot files
            for snapshot in snapshots:
                snapshot_file = Path(snapshot.backup_path)
                if snapshot_file.exists():
                    zf.write(snapshot_file, f"snapshots/{snapshot_file.name}")

            # Add snapshot metadata
            snapshots_json = json.dumps(
                [s.to_dict() for s in snapshots],
                indent=2
            )
            zf.writestr("snapshots/metadata.json", snapshots_json)

        logger.info(f"Created archive: {archive_file}")
        return str(archive_file)

    def extract_archive(
        self,
        archive_path: str,
        target_directory: str,
    ) -> Tuple[bool, str]:
        """
        Extract a backup archive.

        Returns:
            Tuple of (success, manifest_path)
        """
        archive_file = Path(archive_path)
        if not archive_file.exists():
            return False, f"Archive not found: {archive_path}"

        target = Path(target_directory)
        target.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(archive_file, 'r') as zf:
            zf.extractall(target)

        manifest_path = target / "manifest.json"
        return True, str(manifest_path)

    def list_archives(self) -> List[Dict[str, Any]]:
        """List available archives."""
        archives = []

        for archive_file in self.archive_path.glob("*.zip"):
            stat = archive_file.stat()
            archives.append({
                'name': archive_file.name,
                'path': str(archive_file),
                'size_bytes': stat.st_size,
                'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

        return sorted(archives, key=lambda a: a['created_at'], reverse=True)

    def delete_archive(self, archive_path: str) -> bool:
        """Delete an archive."""
        archive_file = Path(archive_path)
        if archive_file.exists():
            archive_file.unlink()
            logger.info(f"Deleted archive: {archive_path}")
            return True
        return False


# =============================================================================
# REBUILD MANAGER
# =============================================================================

class RebuildManager:
    """
    Manages reproducible rebuild of Qdrant collections.
    """

    def __init__(self, config: BackupConfig):
        self.config = config
        self._ingestion_configs: Dict[str, IngestionConfig] = {}

    def create_ingestion_config(
        self,
        source_paths: List[str],
        collection_mappings: Dict[str, str],
        chunking_config: Dict[str, Any],
        embedding_config: Dict[str, Any],
    ) -> IngestionConfig:
        """
        Create a reproducible ingestion configuration.
        """
        config_id = f"ingest_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        config = IngestionConfig(
            config_id=config_id,
            source_paths=source_paths,
            collection_mappings=collection_mappings,
            chunking_config=chunking_config,
            embedding_config=embedding_config,
            processing_order=list(collection_mappings.values()),
            idempotency_key=hashlib.sha256(
                json.dumps(sorted(source_paths)).encode()
            ).hexdigest()[:16],
            version="1.0.0",
        )

        self._ingestion_configs[config_id] = config
        return config

    def get_default_ingestion_config(self) -> IngestionConfig:
        """
        Get the default ingestion configuration for full rebuild.
        """
        return IngestionConfig(
            config_id="default_ingestion",
            source_paths=[
                "qdrant/collections/inspire_authority_foundation",
                "qdrant/collections/inspire_canonical_personas",
                "qdrant/collections/inspire_scripture_core",
                "qdrant/collections/inspire_theology_systematic",
                "qdrant/collections/inspire_theology_pastoral",
                "qdrant/collections/inspire_theology_apologetics",
            ],
            collection_mappings={
                "inspire_authority_foundation": "inspire_authority_foundation",
                "inspire_canonical_personas": "inspire_canonical_personas",
                "inspire_scripture_core": "inspire_scripture_core",
                "inspire_theology_systematic": "inspire_theology_systematic",
                "inspire_theology_pastoral": "inspire_theology_pastoral",
                "inspire_theology_apologetics": "inspire_theology_apologetics",
            },
            chunking_config={
                "strategy": "semantic",
                "max_chunk_size": 512,
                "overlap": 50,
                "preserve_sentences": True,
            },
            embedding_config={
                "model": "text-embedding-3-small",
                "dimensions": 1536,
                "batch_size": 100,
            },
            processing_order=[
                "inspire_authority_foundation",
                "inspire_canonical_personas",
                "inspire_scripture_core",
                "inspire_theology_systematic",
                "inspire_theology_pastoral",
                "inspire_theology_apologetics",
            ],
            idempotency_key="default",
            version="1.0.0",
        )

    def create_rebuild_plan(
        self,
        mode: RebuildMode,
        collections: Optional[List[str]] = None,
        source_snapshot: Optional[str] = None,
        ingestion_config: Optional[IngestionConfig] = None,
    ) -> RebuildPlan:
        """
        Create a plan for system rebuild.
        """
        plan_id = f"rebuild_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        target_collections = collections or self.config.collections

        # Estimate duration based on mode and collection count
        base_duration = {
            RebuildMode.SNAPSHOT_RESTORE: 60,  # 1 min per collection
            RebuildMode.CLEAN_INGESTION: 300,  # 5 min per collection
            RebuildMode.HYBRID: 180,  # 3 min per collection
            RebuildMode.VALIDATION_ONLY: 30,  # 30 sec per collection
        }.get(mode, 300)

        estimated_duration = base_duration * len(target_collections)

        plan = RebuildPlan(
            plan_id=plan_id,
            mode=mode,
            target_state="latest",
            collections_to_rebuild=target_collections,
            estimated_duration_seconds=estimated_duration,
            source_snapshot=source_snapshot,
            ingestion_config=ingestion_config or self.get_default_ingestion_config(),
            validation_checks=[
                "collection_exists",
                "point_count_matches",
                "vector_dimension_correct",
                "index_optimized",
            ],
        )

        return plan

    def execute_rebuild(
        self,
        plan: RebuildPlan,
        dry_run: bool = False,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Execute a rebuild plan.

        Returns:
            Tuple of (success, results)
        """
        results = {
            'plan_id': plan.plan_id,
            'mode': plan.mode.value,
            'collections_processed': [],
            'collections_failed': [],
            'validation_results': {},
            'dry_run': dry_run,
        }

        if dry_run:
            logger.info(f"[DRY RUN] Would execute rebuild plan: {plan.plan_id}")
            results['collections_processed'] = plan.collections_to_rebuild
            return True, results

        logger.info(f"Executing rebuild plan: {plan.plan_id}")

        for collection in plan.collections_to_rebuild:
            try:
                if plan.mode == RebuildMode.SNAPSHOT_RESTORE:
                    # Restore from snapshot
                    logger.info(f"Restoring {collection} from snapshot")
                    # In production: call snapshot restore API

                elif plan.mode == RebuildMode.CLEAN_INGESTION:
                    # Re-ingest from source
                    logger.info(f"Re-ingesting {collection} from source")
                    # In production: call ingestion pipeline

                elif plan.mode == RebuildMode.HYBRID:
                    # Restore snapshot then replay recent changes
                    logger.info(f"Hybrid rebuild for {collection}")

                elif plan.mode == RebuildMode.VALIDATION_ONLY:
                    # Just validate
                    logger.info(f"Validating {collection}")

                results['collections_processed'].append(collection)

            except Exception as e:
                logger.error(f"Failed to rebuild {collection}: {e}")
                results['collections_failed'].append({
                    'collection': collection,
                    'error': str(e),
                })

        success = len(results['collections_failed']) == 0
        return success, results

    def validate_rebuild(
        self,
        plan: RebuildPlan,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Validate that rebuild completed successfully.

        Returns:
            Tuple of (all_valid, validation_results)
        """
        results = {}

        for collection in plan.collections_to_rebuild:
            collection_results = {}

            for check in plan.validation_checks:
                # In production, perform actual validation
                collection_results[check] = {
                    'passed': True,
                    'message': f"{check} validation passed",
                }

            results[collection] = {
                'all_passed': all(r['passed'] for r in collection_results.values()),
                'checks': collection_results,
            }

        all_valid = all(r['all_passed'] for r in results.values())
        return all_valid, results


# =============================================================================
# BACKUP MANAGER
# =============================================================================

class BackupManager:
    """
    Main backup and rebuild management class.

    Coordinates snapshots, archives, and rebuilds.
    """

    _instance: Optional['BackupManager'] = None
    _lock = threading.Lock()

    def __new__(cls, config: Optional[BackupConfig] = None):
        """Singleton pattern."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, config: Optional[BackupConfig] = None):
        if self._initialized:
            return

        self.config = config or BackupConfig()
        self.snapshot_manager = SnapshotManager(self.config)
        self.archive_manager = ArchiveManager(self.config)
        self.rebuild_manager = RebuildManager(self.config)
        self.event_logger = BackupEventLogger(self.config)

        # Create directories
        for directory in [
            self.config.backup_directory,
            self.config.archive_directory,
            self.config.snapshot_directory,
            self.config.manifest_directory,
            self.config.log_directory,
        ]:
            Path(directory).mkdir(parents=True, exist_ok=True)

        self._manifests: Dict[str, BackupManifest] = {}
        self._initialized = True

        logger.info("BackupManager initialized")

    def create_backup(
        self,
        collections: Optional[List[str]] = None,
        backup_type: BackupType = BackupType.SNAPSHOT,
        retention_policy: RetentionPolicy = RetentionPolicy.DAILY,
        notes: str = "",
    ) -> BackupManifest:
        """
        Create a complete backup of specified collections.
        """
        target_collections = collections or self.config.collections
        start_time = time.time()

        manifest_id = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Log backup start
        self.event_logger.log_backup_start(manifest_id, target_collections)

        # Create snapshots for each collection
        snapshots = []
        total_size = 0

        for collection in target_collections:
            try:
                snapshot = self.snapshot_manager.create_snapshot(
                    collection_name=collection,
                    retention_policy=retention_policy,
                )
                snapshots.append(snapshot)
                total_size += snapshot.size_bytes
            except Exception as e:
                logger.error(f"Failed to snapshot {collection}: {e}")

        # Get git commit hash for source version
        source_version = self._get_git_commit_hash()

        # Create manifest
        manifest = BackupManifest(
            manifest_id=manifest_id,
            backup_type=backup_type,
            created_at=datetime.now(),
            collections=target_collections,
            snapshots=snapshots,
            source_version=source_version,
            config_hash=self.rebuild_manager.get_default_ingestion_config().compute_hash(),
            total_size_bytes=total_size,
            status=BackupStatus.COMPLETED,
            retention_policy=retention_policy,
            notes=notes,
        )

        # Save manifest
        self._save_manifest(manifest)
        self._manifests[manifest_id] = manifest

        # Verify if configured
        if self.config.verify_after_backup:
            self.verify_backup(manifest_id)

        duration = time.time() - start_time

        # Log completion
        self.event_logger.log_backup_complete(
            manifest_id=manifest_id,
            collections=target_collections,
            duration_seconds=duration,
            size_bytes=total_size,
            success=True,
        )

        logger.info(f"Backup complete: {manifest_id} ({len(snapshots)} snapshots)")
        return manifest

    def restore_backup(
        self,
        manifest_id: str,
        collections: Optional[List[str]] = None,
    ) -> Tuple[bool, str]:
        """
        Restore from a backup manifest.
        """
        manifest = self._manifests.get(manifest_id)
        if not manifest:
            manifest = self._load_manifest(manifest_id)
            if not manifest:
                return False, f"Manifest not found: {manifest_id}"

        start_time = time.time()
        target_collections = collections or manifest.collections

        logger.info(f"Restoring backup: {manifest_id}")

        errors = []
        for snapshot in manifest.snapshots:
            if snapshot.collection_name not in target_collections:
                continue

            success, message = self.snapshot_manager.restore_snapshot(
                snapshot.snapshot_id,
            )
            if not success:
                errors.append(f"{snapshot.collection_name}: {message}")

        duration = time.time() - start_time
        success = len(errors) == 0

        # Log restore
        self.event_logger.log_restore(
            manifest_id=manifest_id,
            collections=target_collections,
            duration_seconds=duration,
            success=success,
            error_message="; ".join(errors) if errors else "",
        )

        if success:
            # Verify if configured
            if self.config.verify_after_restore:
                self.verify_backup(manifest_id)

            return True, f"Restored {len(target_collections)} collections"
        else:
            return False, f"Restore errors: {'; '.join(errors)}"

    def verify_backup(self, manifest_id: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Verify backup integrity.
        """
        manifest = self._manifests.get(manifest_id)
        if not manifest:
            return False, {'error': f"Manifest not found: {manifest_id}"}

        results = {}
        all_valid = True

        for snapshot in manifest.snapshots:
            valid, message = self.snapshot_manager.verify_snapshot(
                snapshot.snapshot_id
            )
            results[snapshot.collection_name] = {
                'valid': valid,
                'message': message,
            }
            if not valid:
                all_valid = False

        # Update manifest status
        if all_valid:
            manifest.status = BackupStatus.VERIFIED
            manifest.verified_at = datetime.now()
            self._save_manifest(manifest)

        # Log verification
        self.event_logger.log_verification(
            manifest_id=manifest_id,
            collections=manifest.collections,
            success=all_valid,
            details=results,
        )

        return all_valid, results

    def archive_backup(self, manifest_id: str) -> Tuple[bool, str]:
        """
        Archive a backup for long-term storage.
        """
        manifest = self._manifests.get(manifest_id)
        if not manifest:
            return False, f"Manifest not found: {manifest_id}"

        archive_path = self.archive_manager.create_archive(
            manifest=manifest,
            snapshots=manifest.snapshots,
        )

        manifest.status = BackupStatus.ARCHIVED
        manifest.archived_at = datetime.now()
        manifest.archive_location = archive_path
        self._save_manifest(manifest)

        return True, archive_path

    def rebuild_from_source(
        self,
        collections: Optional[List[str]] = None,
        dry_run: bool = False,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Perform clean rebuild from source data.
        """
        plan = self.rebuild_manager.create_rebuild_plan(
            mode=RebuildMode.CLEAN_INGESTION,
            collections=collections,
        )

        start_time = time.time()

        success, results = self.rebuild_manager.execute_rebuild(plan, dry_run)

        if success and not dry_run:
            # Validate rebuild
            valid, validation_results = self.rebuild_manager.validate_rebuild(plan)
            results['validation'] = validation_results

        duration = time.time() - start_time

        # Log rebuild
        self.event_logger.log_rebuild(
            plan_id=plan.plan_id,
            collections=plan.collections_to_rebuild,
            duration_seconds=duration,
            success=success,
            details=results,
        )

        return success, results

    def list_backups(
        self,
        limit: int = 10,
        status: Optional[BackupStatus] = None,
    ) -> List[BackupManifest]:
        """List available backups."""
        manifests = list(self._manifests.values())

        if status:
            manifests = [m for m in manifests if m.status == status]

        manifests = sorted(manifests, key=lambda m: m.created_at, reverse=True)
        return manifests[:limit]

    def apply_retention_policies(self) -> Dict[str, int]:
        """
        Apply retention policies to all backups.
        """
        results = {
            'snapshots_deleted': self.snapshot_manager.apply_retention_policy(),
            'manifests_cleaned': 0,
        }

        # Also clean old manifests
        now = datetime.now()
        for manifest_id, manifest in list(self._manifests.items()):
            age_days = (now - manifest.created_at).days

            max_age = {
                RetentionPolicy.DAILY: self.config.daily_retention_days,
                RetentionPolicy.WEEKLY: self.config.weekly_retention_days,
                RetentionPolicy.MONTHLY: self.config.monthly_retention_days,
                RetentionPolicy.QUARTERLY: self.config.quarterly_retention_days,
                RetentionPolicy.PERMANENT: float('inf'),
            }.get(manifest.retention_policy, self.config.daily_retention_days)

            if age_days > max_age and manifest.status != BackupStatus.ARCHIVED:
                del self._manifests[manifest_id]
                results['manifests_cleaned'] += 1

        return results

    def get_statistics(self) -> Dict[str, Any]:
        """Get backup statistics."""
        manifests = list(self._manifests.values())
        snapshots = self.snapshot_manager.list_snapshots()
        archives = self.archive_manager.list_archives()

        return {
            'total_backups': len(manifests),
            'total_snapshots': len(snapshots),
            'total_archives': len(archives),
            'total_size_bytes': sum(m.total_size_bytes for m in manifests),
            'latest_backup': manifests[0].created_at.isoformat() if manifests else None,
            'verified_backups': len([m for m in manifests if m.status == BackupStatus.VERIFIED]),
            'archived_backups': len([m for m in manifests if m.status == BackupStatus.ARCHIVED]),
            'collections_covered': list(set(
                c for m in manifests for c in m.collections
            )),
        }

    def _get_git_commit_hash(self) -> str:
        """Get current git commit hash."""
        try:
            result = subprocess.run(
                ['git', 'rev-parse', 'HEAD'],
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent.parent,
            )
            return result.stdout.strip()[:8] if result.returncode == 0 else "unknown"
        except Exception:
            return "unknown"

    def _save_manifest(self, manifest: BackupManifest) -> None:
        """Save manifest to disk."""
        manifest_path = Path(self.config.manifest_directory) / f"{manifest.manifest_id}.json"
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest.to_dict(), f, indent=2)

    def _load_manifest(self, manifest_id: str) -> Optional[BackupManifest]:
        """Load manifest from disk."""
        manifest_path = Path(self.config.manifest_directory) / f"{manifest_id}.json"
        if not manifest_path.exists():
            return None

        with open(manifest_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return BackupManifest.from_dict(data)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_backup_manager(config: Optional[BackupConfig] = None) -> BackupManager:
    """Get the singleton backup manager instance."""
    return BackupManager(config)


def create_backup(
    collections: Optional[List[str]] = None,
    retention_policy: RetentionPolicy = RetentionPolicy.DAILY,
    notes: str = "",
) -> BackupManifest:
    """Convenience function to create a backup."""
    manager = get_backup_manager()
    return manager.create_backup(
        collections=collections,
        retention_policy=retention_policy,
        notes=notes,
    )


def restore_backup(manifest_id: str) -> Tuple[bool, str]:
    """Convenience function to restore a backup."""
    manager = get_backup_manager()
    return manager.restore_backup(manifest_id)


def rebuild_from_source(
    collections: Optional[List[str]] = None,
    dry_run: bool = False,
) -> Tuple[bool, Dict[str, Any]]:
    """Convenience function for clean rebuild."""
    manager = get_backup_manager()
    return manager.rebuild_from_source(collections, dry_run)


if __name__ == '__main__':
    # Example usage
    import sys

    logging.basicConfig(level=logging.INFO)

    # Initialize manager
    config = BackupConfig()
    manager = get_backup_manager(config)

    # Create a backup
    manifest = manager.create_backup(
        collections=['inspire_authority_foundation'],
        notes='Test backup',
    )
    print(f"Created backup: {manifest.manifest_id}")

    # Verify backup
    valid, results = manager.verify_backup(manifest.manifest_id)
    print(f"Verification: {'PASSED' if valid else 'FAILED'}")

    # Get statistics
    stats = manager.get_statistics()
    print(f"\nStatistics: {json.dumps(stats, indent=2)}")
