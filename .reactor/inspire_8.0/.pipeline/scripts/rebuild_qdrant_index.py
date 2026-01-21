#!/usr/bin/env python3
# =============================================================================
# REBUILD QDRANT INDEX
# =============================================================================
"""
Rebuild the Qdrant vector index from scratch.

This script performs a complete rebuild of the Qdrant vector database index,
including:
1. Validating connection to Qdrant instance
2. Backing up existing collections (optional)
3. Dropping and recreating collections
4. Re-indexing all documents from source
5. Validating index integrity

USAGE:
    python rebuild_qdrant_index.py [options]

OPTIONS:
    --collection NAME    Rebuild specific collection (default: all)
    --backup             Create backup before rebuild
    --force              Skip confirmation prompts
    --dry-run            Show what would be done without executing
    --verbose            Enable verbose logging

ENVIRONMENT VARIABLES:
    QDRANT_HOST          Qdrant server host (default: localhost)
    QDRANT_PORT          Qdrant server port (default: 6333)
    QDRANT_API_KEY       Optional API key for authentication
    INSPIRE_DATA_DIR     Source data directory

EXIT CODES:
    0 - Success
    1 - Configuration error
    2 - Connection error
    3 - Rebuild error
    4 - Validation error
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

class Config:
    """Configuration for Qdrant index rebuild."""

    def __init__(self):
        self.qdrant_host = os.environ.get('QDRANT_HOST', 'localhost')
        self.qdrant_port = int(os.environ.get('QDRANT_PORT', '6333'))
        self.qdrant_api_key = os.environ.get('QDRANT_API_KEY')
        self.data_dir = Path(os.environ.get(
            'INSPIRE_DATA_DIR',
            'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/qdrant'
        ))

        # Inspire 8.0 collections
        self.collections = [
            # Authority Foundation
            'inspire_authority_foundation',
            'inspire_canonical_personas',
            'inspire_scripture_core',
            # Knowledge Base
            'inspire_theology_systematic',
            'inspire_theology_pastoral',
            'inspire_theology_apologetics',
            # Operational
            'inspire_conversation_memory',
            'inspire_session_context',
            'inspire_user_preferences',
            # Audit
            'inspire_activation_logs',
            'inspire_drift_audit',
        ]

    def validate(self) -> bool:
        """Validate configuration."""
        if not self.data_dir.exists():
            logger.warning(f"Data directory does not exist: {self.data_dir}")
            # Don't fail - may be creating fresh
        return True


# =============================================================================
# QDRANT CLIENT (MOCK)
# =============================================================================

class QdrantClient:
    """
    Mock Qdrant client for demonstration.

    In production, replace with actual qdrant_client import:
    from qdrant_client import QdrantClient
    """

    def __init__(self, host: str, port: int, api_key: str = None):
        self.host = host
        self.port = port
        self.api_key = api_key
        self._connected = False

    def connect(self) -> bool:
        """Simulate connection to Qdrant."""
        logger.info(f"Connecting to Qdrant at {self.host}:{self.port}...")
        # In production: actual connection logic
        self._connected = True
        logger.info("Connected to Qdrant successfully")
        return True

    def list_collections(self) -> List[str]:
        """List existing collections."""
        if not self._connected:
            raise RuntimeError("Not connected to Qdrant")
        # In production: return actual collection list
        return []

    def create_collection(self, name: str, vector_size: int = 1536) -> bool:
        """Create a new collection."""
        logger.info(f"Creating collection: {name} (vector_size={vector_size})")
        # In production: actual collection creation
        return True

    def delete_collection(self, name: str) -> bool:
        """Delete a collection."""
        logger.info(f"Deleting collection: {name}")
        # In production: actual collection deletion
        return True

    def get_collection_info(self, name: str) -> Dict[str, Any]:
        """Get collection information."""
        # In production: return actual collection info
        return {
            "name": name,
            "vectors_count": 0,
            "status": "green"
        }

    def upsert_vectors(self, collection: str, vectors: List[Dict]) -> int:
        """Upsert vectors into collection."""
        logger.info(f"Upserting {len(vectors)} vectors into {collection}")
        # In production: actual upsert
        return len(vectors)


# =============================================================================
# INDEX REBUILDER
# =============================================================================

class IndexRebuilder:
    """Handles Qdrant index rebuild operations."""

    def __init__(self, config: Config, dry_run: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.client = None
        self.stats = {
            "collections_processed": 0,
            "collections_created": 0,
            "vectors_indexed": 0,
            "errors": [],
            "started_at": None,
            "completed_at": None,
        }

    def connect(self) -> bool:
        """Connect to Qdrant."""
        try:
            self.client = QdrantClient(
                host=self.config.qdrant_host,
                port=self.config.qdrant_port,
                api_key=self.config.qdrant_api_key,
            )
            return self.client.connect()
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            return False

    def backup_collection(self, name: str) -> bool:
        """Create backup of a collection."""
        if self.dry_run:
            logger.info(f"[DRY-RUN] Would backup collection: {name}")
            return True

        backup_name = f"{name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"Creating backup: {backup_name}")
        # In production: actual backup logic (snapshot or export)
        return True

    def rebuild_collection(self, name: str, backup: bool = False) -> bool:
        """Rebuild a single collection."""
        logger.info(f"{'[DRY-RUN] ' if self.dry_run else ''}Rebuilding collection: {name}")

        try:
            # Step 1: Backup if requested
            if backup:
                self.backup_collection(name)

            # Step 2: Delete existing collection
            if not self.dry_run:
                existing = self.client.list_collections()
                if name in existing:
                    self.client.delete_collection(name)

            # Step 3: Create new collection
            if not self.dry_run:
                self.client.create_collection(name, vector_size=1536)
                self.stats["collections_created"] += 1

            # Step 4: Load and index source documents
            vectors_indexed = self._index_collection_documents(name)
            self.stats["vectors_indexed"] += vectors_indexed

            self.stats["collections_processed"] += 1
            logger.info(f"Rebuilt collection: {name} ({vectors_indexed} vectors)")
            return True

        except Exception as e:
            error_msg = f"Failed to rebuild {name}: {e}"
            logger.error(error_msg)
            self.stats["errors"].append(error_msg)
            return False

    def _index_collection_documents(self, collection: str) -> int:
        """Index documents for a specific collection."""
        # In production: load documents from source and create embeddings
        source_dir = self.config.data_dir / collection.replace('inspire_', '')

        if not source_dir.exists():
            logger.debug(f"No source directory for {collection}: {source_dir}")
            return 0

        # Simulate indexing
        document_count = 0
        for file_path in source_dir.glob('**/*.json'):
            document_count += 1

        if document_count > 0 and not self.dry_run:
            # In production: create embeddings and upsert
            vectors = [{"id": i, "vector": [0.0] * 1536} for i in range(document_count)]
            self.client.upsert_vectors(collection, vectors)

        return document_count

    def rebuild_all(self, backup: bool = False) -> bool:
        """Rebuild all collections."""
        self.stats["started_at"] = datetime.now().isoformat()

        logger.info("=" * 60)
        logger.info("INSPIRE 8.0 QDRANT INDEX REBUILD")
        logger.info("=" * 60)
        logger.info(f"Collections to rebuild: {len(self.config.collections)}")
        logger.info(f"Dry run: {self.dry_run}")
        logger.info(f"Backup: {backup}")
        logger.info("=" * 60)

        success = True
        for collection in self.config.collections:
            if not self.rebuild_collection(collection, backup=backup):
                success = False

        self.stats["completed_at"] = datetime.now().isoformat()

        # Print summary
        self._print_summary()

        return success and len(self.stats["errors"]) == 0

    def rebuild_specific(self, collection: str, backup: bool = False) -> bool:
        """Rebuild a specific collection."""
        if collection not in self.config.collections:
            logger.error(f"Unknown collection: {collection}")
            logger.info(f"Available collections: {', '.join(self.config.collections)}")
            return False

        self.stats["started_at"] = datetime.now().isoformat()
        result = self.rebuild_collection(collection, backup=backup)
        self.stats["completed_at"] = datetime.now().isoformat()

        self._print_summary()
        return result

    def validate_index(self) -> bool:
        """Validate index integrity."""
        logger.info("Validating index integrity...")

        all_valid = True
        for collection in self.config.collections:
            try:
                info = self.client.get_collection_info(collection)
                status = info.get("status", "unknown")
                count = info.get("vectors_count", 0)

                if status == "green":
                    logger.info(f"  {collection}: OK ({count} vectors)")
                else:
                    logger.warning(f"  {collection}: {status} ({count} vectors)")
                    all_valid = False

            except Exception as e:
                logger.error(f"  {collection}: ERROR - {e}")
                all_valid = False

        return all_valid

    def _print_summary(self):
        """Print rebuild summary."""
        logger.info("=" * 60)
        logger.info("REBUILD SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Collections processed: {self.stats['collections_processed']}")
        logger.info(f"Collections created: {self.stats['collections_created']}")
        logger.info(f"Vectors indexed: {self.stats['vectors_indexed']}")
        logger.info(f"Errors: {len(self.stats['errors'])}")
        logger.info(f"Started: {self.stats['started_at']}")
        logger.info(f"Completed: {self.stats['completed_at']}")

        if self.stats["errors"]:
            logger.info("-" * 60)
            logger.info("ERRORS:")
            for error in self.stats["errors"]:
                logger.error(f"  - {error}")

        logger.info("=" * 60)


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Rebuild Qdrant vector index for Inspire 8.0',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        '--collection',
        type=str,
        help='Rebuild specific collection (default: all)'
    )
    parser.add_argument(
        '--backup',
        action='store_true',
        help='Create backup before rebuild'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Skip confirmation prompts'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without executing'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Only validate existing index, do not rebuild'
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load configuration
    config = Config()
    if not config.validate():
        logger.error("Configuration validation failed")
        return 1

    # Create rebuilder
    rebuilder = IndexRebuilder(config, dry_run=args.dry_run)

    # Connect to Qdrant
    if not rebuilder.connect():
        logger.error("Failed to connect to Qdrant")
        return 2

    # Validate only mode
    if args.validate_only:
        if rebuilder.validate_index():
            logger.info("Index validation passed")
            return 0
        else:
            logger.error("Index validation failed")
            return 4

    # Confirmation prompt
    if not args.force and not args.dry_run:
        target = args.collection or "ALL collections"
        response = input(f"\nThis will rebuild {target}. Continue? [y/N]: ")
        if response.lower() != 'y':
            logger.info("Rebuild cancelled by user")
            return 0

    # Execute rebuild
    try:
        if args.collection:
            success = rebuilder.rebuild_specific(args.collection, backup=args.backup)
        else:
            success = rebuilder.rebuild_all(backup=args.backup)

        if success:
            logger.info("Rebuild completed successfully")
            return 0
        else:
            logger.error("Rebuild completed with errors")
            return 3

    except Exception as e:
        logger.exception(f"Rebuild failed with exception: {e}")
        return 3


if __name__ == '__main__':
    sys.exit(main())
