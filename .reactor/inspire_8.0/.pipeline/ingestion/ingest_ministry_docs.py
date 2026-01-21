#!/usr/bin/env python3
# =============================================================================
# MINISTRY DOCUMENTS INGESTION SCRIPT
# =============================================================================
"""
Ingests ministry documentation, teachings, and doctrinal content into Qdrant.

Target Collections: doctrine, jubilee_ministry, governance
Chunking Strategy: Tier 2 - Contextual sections (300-500 tokens)
Sources:
    - authority_foundation/a2_doctrine/
    - authority_foundation/a3_governance/
    - authority_foundation/a5_gabriel_pastoral_voice/
    - authority_foundation/o1_kingdom_builder/
    - authority_foundation/i2_jubilee_ministry/

This script is IDEMPOTENT - safe to re-run without duplicating data.
Uses content hashing for duplicate detection.

Usage:
    python ingest_ministry_docs.py [--dry-run] [--collection COLLECTION] [--force]

Options:
    --dry-run       Simulate ingestion without writing to Qdrant
    --collection    Only ingest to a specific collection
    --force         Re-ingest even if points already exist
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add utils to path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from utils.hasher import ContentHasher, generate_point_id
from utils.logger import IngestionLogger, RunStats, create_run_report, generate_run_id
from utils.qdrant_client import QdrantIngestionClient
from utils.chunker import Chunker, ChunkingStrategy
from utils.embedder import EmbeddingService
from utils.versioner import DocumentVersioner, VersionStrategy, ChangelogManager

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False


# =============================================================================
# CONFIGURATION
# =============================================================================

WORKSPACE_ROOT = Path(__file__).parent.parent.parent.parent.parent
AUTHORITY_PATH = WORKSPACE_ROOT / ".reactor/inspire_8.0/authority_foundation"
CHANGELOG_DIR = SCRIPT_DIR / "changelogs"
LOG_DIR = SCRIPT_DIR / "logs"
REPORT_DIR = SCRIPT_DIR / "reports"

# Source mappings: (path, collection, content_types)
SOURCE_MAPPINGS = {
    "doctrine": {
        "path": AUTHORITY_PATH / "a2_doctrine",
        "collection": "doctrine",
        "types": ["teaching", "whitepaper", "doctrinal_statement", "devotional", "commentary"],
        "default_type": "teaching",
        "priority": "high",
    },
    "governance": {
        "path": AUTHORITY_PATH / "a3_governance",
        "collection": "governance",
        "types": ["protocol_anchor", "guardrail_anchor", "governance_doc"],
        "default_type": "governance_doc",
        "priority": "core",
    },
    "gabriel": {
        "path": AUTHORITY_PATH / "a5_gabriel_pastoral_voice",
        "collection": "doctrine",  # Gabriel's voice goes to doctrine
        "types": ["teaching", "pastoral_guidance", "sermon"],
        "default_type": "teaching",
        "priority": "high",
    },
    "kingdom": {
        "path": AUTHORITY_PATH / "o1_kingdom_builder",
        "collection": "kingdom_builder",
        "types": ["strategy", "framework", "plan"],
        "default_type": "framework",
        "priority": "normal",
    },
    "ministry": {
        "path": AUTHORITY_PATH / "i2_jubilee_ministry",
        "collection": "jubilee_ministry",
        "types": ["ministry_doc", "organizational", "process"],
        "default_type": "ministry_doc",
        "priority": "normal",
    },
}


# =============================================================================
# MAIN INGESTION LOGIC
# =============================================================================

class MinistryDocsIngester:
    """Handles ministry document ingestion into Qdrant."""

    def __init__(
        self,
        dry_run: bool = False,
        force: bool = False,
        target_collection: Optional[str] = None
    ):
        self.dry_run = dry_run
        self.force = force
        self.target_collection = target_collection

        self.run_id = generate_run_id("ingest_ministry_docs")
        self.logger = IngestionLogger("ingest_ministry_docs", str(LOG_DIR))
        self.hasher = ContentHasher()
        self.chunker = Chunker()

        # Version tracking
        self.versioner = DocumentVersioner(
            workspace_root=WORKSPACE_ROOT,
            default_strategy=VersionStrategy.COMPOSITE
        )
        self.changelog = ChangelogManager(CHANGELOG_DIR)

        self.stats = RunStats(
            run_id=self.run_id,
            script_name="ingest_ministry_docs",
            collection="multiple"
        )

        # Track points per collection for changelog
        self._collection_points: Dict[str, List[Dict[str, Any]]] = {}

        self._qdrant_client = None
        self._embedder = None

    @property
    def qdrant(self) -> QdrantIngestionClient:
        if self._qdrant_client is None:
            self._qdrant_client = QdrantIngestionClient()
        return self._qdrant_client

    @property
    def embedder(self) -> EmbeddingService:
        if self._embedder is None:
            self._embedder = EmbeddingService()
        return self._embedder

    def run(self) -> bool:
        """Execute the ingestion process."""
        self.stats.started_at = datetime.now().isoformat()
        self.stats.status = "running"

        self.logger.section("MINISTRY DOCS INGESTION STARTED")
        self.logger.info(f"Run ID: {self.run_id}")
        self.logger.info(f"Dry Run: {self.dry_run}")
        self.logger.info(f"Force: {self.force}")
        self.logger.info(f"Target Collection: {self.target_collection or 'ALL'}")

        try:
            # Connect to Qdrant
            if not self.dry_run:
                self.logger.section("CONNECTING TO QDRANT")
                self.qdrant.connect()
                self.logger.info("Connected to Qdrant successfully")

            # Process each source
            for source_key, source_config in SOURCE_MAPPINGS.items():
                # Filter by target collection
                if self.target_collection:
                    if source_config["collection"] != self.target_collection:
                        continue

                self.logger.section(f"PROCESSING {source_key.upper()}")
                self._process_source(source_key, source_config)

            # Success
            self.stats.status = "completed"
            self.logger.section("INGESTION COMPLETED")
            self._log_summary()

            return True

        except Exception as e:
            self.logger.error(f"Ingestion failed: {e}", exc_info=True)
            self.stats.errors.append({
                "type": "fatal_error",
                "message": str(e)
            })
            self.stats.status = "failed"
            return False

        finally:
            self.stats.completed_at = datetime.now().isoformat()
            started = datetime.fromisoformat(self.stats.started_at)
            completed = datetime.fromisoformat(self.stats.completed_at)
            self.stats.duration_seconds = (completed - started).total_seconds()

            # Calculate averages
            if self.stats.chunks_created > 0:
                self.stats.avg_chunk_tokens = self.stats.total_tokens / self.stats.chunks_created

            # Generate report
            report_path = create_run_report(self.stats, str(REPORT_DIR))
            self.logger.info(f"Report saved: {report_path}")

            # Cleanup
            if self._qdrant_client:
                self._qdrant_client.disconnect()

    def _process_source(self, source_key: str, config: Dict[str, Any]):
        """Process a single source directory."""
        source_path = config["path"]
        collection = config["collection"]

        if not source_path.exists():
            self.logger.warning(f"Source path does not exist: {source_path}")
            return

        # Verify collection exists
        if not self.dry_run and not self.qdrant.collection_exists(collection):
            self.logger.warning(f"Collection '{collection}' does not exist, skipping")
            return

        # Find all document files
        files = self._discover_files(source_path)
        self.logger.info(f"Found {len(files)} files in {source_key}")
        self.stats.files_found += len(files)

        if not files:
            return

        # Process each file
        all_points = []
        for file_path in files:
            points = self._process_file(file_path, config)
            all_points.extend(points)
            self.stats.files_processed += 1

        self.logger.info(f"Created {len(all_points)} chunks from {source_key}")

        # Track points per collection for changelog
        if collection not in self._collection_points:
            self._collection_points[collection] = []
        self._collection_points[collection].extend(all_points)

        # Generate embeddings and upsert
        if all_points and not self.dry_run:
            self._generate_embeddings(all_points)
            self._upsert_points(all_points, collection)
            self._record_changelog(collection, all_points)

    def _discover_files(self, source_path: Path) -> List[Path]:
        """Discover all document files in source path."""
        files = []
        patterns = ["*.json", "*.yaml", "*.yml", "*.md"]

        for pattern in patterns:
            files.extend(source_path.rglob(pattern))

        return sorted(files)

    def _process_file(
        self,
        file_path: Path,
        config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Process a single document file into chunks."""
        points = []

        try:
            # Read file content
            content, metadata = self._read_file(file_path)
            if not content:
                self.stats.files_skipped += 1
                return points

            # Determine content type
            content_type = metadata.get('type', config["default_type"])
            if content_type not in config["types"]:
                content_type = config["default_type"]

            # Chunk the content using Tier 2 strategy
            chunks = self.chunker.chunk_doctrine(content)

            for i, chunk in enumerate(chunks):
                # Generate content hash
                content_hash = self.hasher.hash_content(chunk.text)

                # Generate point ID
                point_id = generate_point_id(
                    collection=config["collection"],
                    content_type=content_type,
                    content_hash=content_hash
                )

                # Compute document version for traceability
                version_info = self.versioner.compute_version(
                    content=chunk.text,
                    source_path=file_path,
                    strategy=VersionStrategy.COMPOSITE
                )

                # Build payload with doc_version for strict versioning
                payload = {
                    "type": content_type,
                    "persona": "shared",
                    "source": str(file_path.relative_to(WORKSPACE_ROOT)),
                    "priority": config["priority"],
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0.0",
                    "doc_version": version_info.doc_version,
                    "version_strategy": version_info.strategy,
                    "content_hash": content_hash,
                    "file_hash": version_info.file_hash,
                    "git_commit": version_info.git_commit,
                    "ingested_at": version_info.ingested_at,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "text": chunk.text,
                    **metadata,
                }

                self.stats.total_tokens += chunk.token_count
                self.stats.chunks_created += 1

                points.append({
                    "id": point_id,
                    "payload": payload,
                    "text": chunk.text,
                    "vector": None
                })

        except Exception as e:
            self.logger.error(f"Error processing {file_path}: {e}")
            self.stats.files_errored += 1
            self.stats.errors.append({
                "type": "file_error",
                "file": str(file_path),
                "message": str(e)
            })

        return points

    def _read_file(self, file_path: Path) -> Tuple[str, Dict[str, Any]]:
        """Read file and extract content and metadata."""
        content = ""
        metadata = {}

        suffix = file_path.suffix.lower()

        try:
            if suffix == ".json":
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Extract content from various JSON structures
                if isinstance(data, dict):
                    content = data.get('content', data.get('text', ''))
                    if not content and 'body' in data:
                        content = data['body']
                    # Copy metadata fields
                    for key in ['title', 'author', 'type', 'category', 'tags']:
                        if key in data:
                            metadata[key] = data[key]
                elif isinstance(data, str):
                    content = data

            elif suffix in [".yaml", ".yml"]:
                if not YAML_AVAILABLE:
                    self.logger.warning(f"YAML not available, skipping {file_path}")
                    return "", {}

                with open(file_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)

                if isinstance(data, dict):
                    content = data.get('content', data.get('text', ''))
                    if not content:
                        # Convert entire YAML to text for indexing
                        content = yaml.dump(data, default_flow_style=False)
                    for key in ['title', 'author', 'type', 'category', 'tags']:
                        if key in data:
                            metadata[key] = data[key]

            elif suffix == ".md":
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Extract title from first heading
                title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                if title_match:
                    metadata['title'] = title_match.group(1)

        except Exception as e:
            self.logger.error(f"Error reading {file_path}: {e}")

        return content.strip(), metadata

    def _generate_embeddings(self, points: List[Dict[str, Any]]):
        """Generate embeddings for all points."""
        texts = [p['text'] for p in points]

        def progress_callback(current, total):
            if current % 100 == 0 or current == total:
                self.logger.progress(current, total, "embeddings")

        result = self.embedder.embed_batch(texts, progress_callback)

        for i, embedding in enumerate(result.embeddings):
            if embedding:
                points[i]['vector'] = embedding
                self.stats.embeddings_generated += 1
            else:
                self.stats.embedding_errors += 1

        self.stats.embedding_api_calls = self.embedder.total_requests

    def _upsert_points(self, points: List[Dict[str, Any]], collection: str):
        """Upsert points to Qdrant."""
        valid_points = [p for p in points if p.get('vector')]

        if not valid_points:
            self.logger.warning(f"No valid points to upsert to {collection}")
            return

        # Remove 'text' field
        for p in valid_points:
            if 'text' in p:
                del p['text']

        result = self.qdrant.upsert_points(
            collection_name=collection,
            points=valid_points,
            batch_size=100,
            skip_existing=not self.force
        )

        self.stats.points_upserted += result.points_upserted
        self.stats.points_skipped += result.points_skipped
        self.stats.chunks_skipped_duplicate += result.points_skipped

        if result.errors:
            for err in result.errors:
                self.stats.errors.append({"type": "upsert_error", "message": err})

        self.logger.info(
            f"{collection}: upserted {result.points_upserted}, "
            f"skipped {result.points_skipped}"
        )

    def _record_changelog(self, collection: str, points: List[Dict[str, Any]]):
        """Record changelog entry for this collection's ingestion."""
        # Collect unique source files
        source_files = list(set(
            p['payload'].get('source', '') for p in points if p.get('payload')
        ))

        # Get representative doc_version from first point
        doc_version = "unknown"
        if points and points[0].get('payload'):
            doc_version = points[0]['payload'].get('doc_version', 'unknown')

        # Determine change type
        change_type = "reindexed" if self.force else "added"

        self.changelog.add_entry(
            collection=collection,
            change_type=change_type,
            description=f"Ingested {len(points)} ministry document chunks",
            version=doc_version,
            source_files=source_files[:50],  # Limit to first 50
            points_affected=len(points),
            author=f"ingest_ministry_docs/{self.run_id}"
        )

        self.logger.info(f"Changelog entry recorded for {collection}")

    def _log_summary(self):
        """Log ingestion summary."""
        self.logger.info(f"Files found: {self.stats.files_found}")
        self.logger.info(f"Files processed: {self.stats.files_processed}")
        self.logger.info(f"Files skipped: {self.stats.files_skipped}")
        self.logger.info(f"Chunks created: {self.stats.chunks_created}")
        self.logger.info(f"Embeddings generated: {self.stats.embeddings_generated}")
        self.logger.info(f"Points upserted: {self.stats.points_upserted}")
        self.logger.info(f"Points skipped (duplicates): {self.stats.chunks_skipped_duplicate}")
        self.logger.info(f"Errors: {len(self.stats.errors)}")
        self.logger.info(f"Duration: {self.stats.duration_seconds:.2f}s")


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Ingest ministry documents into Qdrant"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate without writing to Qdrant"
    )
    parser.add_argument(
        "--collection",
        type=str,
        help="Only ingest to a specific collection"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-ingest even if points already exist"
    )

    args = parser.parse_args()

    ingester = MinistryDocsIngester(
        dry_run=args.dry_run,
        force=args.force,
        target_collection=args.collection
    )

    success = ingester.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
