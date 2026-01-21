# =============================================================================
# INSPIRE 8.0 INGESTION UTILITIES
# =============================================================================
"""
Core utilities for the Inspire 8.0 Qdrant ingestion pipeline.

This module provides:
- Content hashing for duplicate prevention
- Document versioning for traceability and rebuilds
- Logging utilities with structured output
- Qdrant client wrapper with retry logic
- Chunking utilities following the three-tier standard
- Report generation for audit trails
- Changelog management for source history
"""

from .hasher import ContentHasher, generate_point_id
from .logger import IngestionLogger, create_run_report
from .qdrant_client import QdrantIngestionClient
from .chunker import Chunker, ChunkingStrategy
from .embedder import EmbeddingService
from .versioner import (
    DocumentVersioner,
    VersionStrategy,
    VersionInfo,
    ChangelogManager,
    ChangelogEntry,
    create_rebuild_manifest
)

__all__ = [
    'ContentHasher',
    'generate_point_id',
    'IngestionLogger',
    'create_run_report',
    'QdrantIngestionClient',
    'Chunker',
    'ChunkingStrategy',
    'EmbeddingService',
    'DocumentVersioner',
    'VersionStrategy',
    'VersionInfo',
    'ChangelogManager',
    'ChangelogEntry',
    'create_rebuild_manifest',
]

__version__ = '1.1.0'
