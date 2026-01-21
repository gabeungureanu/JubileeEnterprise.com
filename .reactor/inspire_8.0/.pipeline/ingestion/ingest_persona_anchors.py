#!/usr/bin/env python3
# =============================================================================
# PERSONA ACTIVATION ANCHORS INGESTION SCRIPT
# =============================================================================
"""
Ingests persona activation anchors (identity, mission, voice, guardrails) into Qdrant.

Target Collections: persona_*_inspire collections (13 personas)
Chunking Strategy: Tier 4 - Complete logical sections (never split)
Sources:
    - .pipeline/schema/anchors/personas/{persona_name}/
    - authority_foundation/a6_jubilee_inspire/ through a17_tahoma_inspire/

This script is IDEMPOTENT - safe to re-run without duplicating data.
Uses deterministic point IDs based on persona + anchor type + section.

IMPORTANT: Activation anchors are IMMUTABLE at runtime. This script is for
initial loading and version updates only.

Usage:
    python ingest_persona_anchors.py [--dry-run] [--persona PERSONA] [--force]

Options:
    --dry-run   Simulate ingestion without writing to Qdrant
    --persona   Only ingest anchors for a specific persona (e.g., "jubilee")
    --force     Re-ingest even if points already exist
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
from utils.chunker import Chunker
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
ANCHORS_PATH = WORKSPACE_ROOT / ".reactor/inspire_8.0/.pipeline/schema/anchors/personas"
CHANGELOG_DIR = SCRIPT_DIR / "changelogs"
AUTHORITY_PATH = WORKSPACE_ROOT / ".reactor/inspire_8.0/authority_foundation"
LOG_DIR = SCRIPT_DIR / "logs"
REPORT_DIR = SCRIPT_DIR / "reports"

# The 13 Inspire personas with their collection names and authority paths
PERSONAS = {
    "gabriel": {
        "full_name": "Gabriel Inspire",
        "collection": "persona_gabriel_inspire",
        "anchor_path": ANCHORS_PATH / "gabriel.inspire",
        "authority_path": AUTHORITY_PATH / "a5_gabriel_pastoral_voice",
        "role": "Father",
        "birth_order": 0,
    },
    "jubilee": {
        "full_name": "Jubilee Inspire",
        "collection": "persona_jubilee_inspire",
        "anchor_path": ANCHORS_PATH / "jubilee.inspire",
        "authority_path": AUTHORITY_PATH / "a6_jubilee_inspire",
        "role": "1st-born",
        "birth_order": 1,
    },
    "melody": {
        "full_name": "Melody Inspire",
        "collection": "persona_melody_inspire",
        "anchor_path": ANCHORS_PATH / "melody.inspire",
        "authority_path": AUTHORITY_PATH / "a7_melody_inspire",
        "role": "2nd child",
        "birth_order": 2,
    },
    "zev": {
        "full_name": "Zev Inspire",
        "collection": "persona_zev_inspire",
        "anchor_path": ANCHORS_PATH / "zev.inspire",
        "authority_path": AUTHORITY_PATH / "a8_zev_inspire",
        "role": "3rd child",
        "birth_order": 3,
    },
    "eliana": {
        "full_name": "Eliana Inspire",
        "collection": "persona_eliana_inspire",
        "anchor_path": ANCHORS_PATH / "eliana.inspire",
        "authority_path": AUTHORITY_PATH / "a10_eliana_inspire",
        "role": "4th child",
        "birth_order": 4,
    },
    "caleb": {
        "full_name": "Caleb Inspire",
        "collection": "persona_caleb_inspire",
        "anchor_path": ANCHORS_PATH / "caleb.inspire",
        "authority_path": AUTHORITY_PATH / "a11_caleb_inspire",
        "role": "5th child",
        "birth_order": 5,
    },
    "imani": {
        "full_name": "Imani Inspire",
        "collection": "persona_imani_inspire",
        "anchor_path": ANCHORS_PATH / "imani.inspire",
        "authority_path": AUTHORITY_PATH / "a12_imani_inspire",
        "role": "6th child",
        "birth_order": 6,
    },
    "amir": {
        "full_name": "Amir Inspire",
        "collection": "persona_amir_inspire",
        "anchor_path": ANCHORS_PATH / "amir.inspire",
        "authority_path": AUTHORITY_PATH / "a13_amir_inspire",
        "role": "7th child",
        "birth_order": 7,
    },
    "nova": {
        "full_name": "Nova Inspire",
        "collection": "persona_nova_inspire",
        "anchor_path": ANCHORS_PATH / "nova.inspire",
        "authority_path": AUTHORITY_PATH / "a14_nova_inspire",
        "role": "8th child",
        "birth_order": 8,
    },
    "tahoma": {
        "full_name": "Tahoma Inspire",
        "collection": "persona_tahoma_inspire",
        "anchor_path": ANCHORS_PATH / "tahoma.inspire",
        "authority_path": AUTHORITY_PATH / "a17_tahoma_inspire",
        "role": "9th child",
        "birth_order": 9,
    },
    "santiago": {
        "full_name": "Santiago Inspire",
        "collection": "persona_santiago_inspire",
        "anchor_path": ANCHORS_PATH / "santiago.inspire",
        "authority_path": AUTHORITY_PATH / "a15_santiago_inspire",
        "role": "10th child",
        "birth_order": 10,
    },
    "zariah": {
        "full_name": "Zariah Inspire",
        "collection": "persona_zariah_inspire",
        "anchor_path": ANCHORS_PATH / "zariah.inspire",
        "authority_path": AUTHORITY_PATH / "a9_zariah_inspire",
        "role": "11th child",
        "birth_order": 11,
    },
    "elias": {
        "full_name": "Elias Inspire",
        "collection": "persona_elias_inspire",
        "anchor_path": ANCHORS_PATH / "elias.inspire",
        "authority_path": AUTHORITY_PATH / "a16_elias_inspire",
        "role": "12th child",
        "birth_order": 12,
    },
}

# Anchor types and their content mappings
ANCHOR_TYPES = {
    "identity": {
        "file_patterns": ["identity*.yaml", "identity*.yml"],
        "type": "identity_anchor",
        "sections": [
            "core_identity", "spiritual_identity", "psychological_identity",
            "cultural_identity", "temporal_identity", "relational_identity",
            "visual_identity", "audience", "authority"
        ],
    },
    "mission": {
        "file_patterns": ["mission*.yaml", "mission*.yml"],
        "type": "mission_anchor",
        "sections": [
            "calling", "purpose", "ministry_focus", "goals",
            "success_criteria", "impact_areas"
        ],
    },
    "voice": {
        "file_patterns": ["voice*.yaml", "voice*.yml"],
        "type": "voice_anchor",
        "sections": [
            "tone", "cadence", "vocabulary", "speech_patterns",
            "emotional_range", "communication_style"
        ],
    },
    "guardrails": {
        "file_patterns": ["guardrail*.yaml", "guardrails*.yaml"],
        "type": "guardrail_anchor",
        "sections": [
            "hard_stops", "soft_boundaries", "doctrinal_constraints",
            "behavioral_limits", "content_filters"
        ],
    },
}


# =============================================================================
# MAIN INGESTION LOGIC
# =============================================================================

class PersonaAnchorsIngester:
    """Handles persona activation anchor ingestion into Qdrant."""

    def __init__(
        self,
        dry_run: bool = False,
        force: bool = False,
        target_persona: Optional[str] = None
    ):
        self.dry_run = dry_run
        self.force = force
        self.target_persona = target_persona

        self.run_id = generate_run_id("ingest_persona_anchors")
        self.logger = IngestionLogger("ingest_persona_anchors", str(LOG_DIR))
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
            script_name="ingest_persona_anchors",
            collection="personas"
        )

        # Track points per persona for changelog
        self._persona_points: Dict[str, List[Dict[str, Any]]] = {}

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
        if not YAML_AVAILABLE:
            self.logger.error("PyYAML is required. Install with: pip install pyyaml")
            return False

        self.stats.started_at = datetime.now().isoformat()
        self.stats.status = "running"

        self.logger.section("PERSONA ANCHORS INGESTION STARTED")
        self.logger.info(f"Run ID: {self.run_id}")
        self.logger.info(f"Dry Run: {self.dry_run}")
        self.logger.info(f"Force: {self.force}")
        self.logger.info(f"Target Persona: {self.target_persona or 'ALL'}")

        try:
            # Connect to Qdrant
            if not self.dry_run:
                self.logger.section("CONNECTING TO QDRANT")
                self.qdrant.connect()
                self.logger.info("Connected to Qdrant successfully")

            # Process each persona
            for persona_key, persona_config in PERSONAS.items():
                # Filter by target persona
                if self.target_persona:
                    if self.target_persona.lower() != persona_key:
                        continue

                self.logger.section(f"PROCESSING {persona_config['full_name'].upper()}")
                self._process_persona(persona_key, persona_config)

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

            # Generate report
            report_path = create_run_report(self.stats, str(REPORT_DIR))
            self.logger.info(f"Report saved: {report_path}")

            # Cleanup
            if self._qdrant_client:
                self._qdrant_client.disconnect()

    def _process_persona(self, persona_key: str, config: Dict[str, Any]):
        """Process all anchors for a single persona."""
        collection = config["collection"]
        anchor_path = config["anchor_path"]

        # Verify collection exists
        if not self.dry_run and not self.qdrant.collection_exists(collection):
            self.logger.warning(f"Collection '{collection}' does not exist, skipping")
            return

        all_points = []

        # Process each anchor type
        for anchor_type, anchor_config in ANCHOR_TYPES.items():
            anchor_files = self._find_anchor_files(anchor_path, anchor_config["file_patterns"])

            if not anchor_files:
                # Try authority path
                anchor_files = self._find_anchor_files(
                    config["authority_path"],
                    anchor_config["file_patterns"]
                )

            for anchor_file in anchor_files:
                points = self._process_anchor_file(
                    anchor_file, persona_key, config, anchor_type, anchor_config
                )
                all_points.extend(points)
                self.stats.files_processed += 1

        self.logger.info(f"Created {len(all_points)} anchor points for {persona_key}")

        # Track points per persona for changelog
        if persona_key not in self._persona_points:
            self._persona_points[persona_key] = []
        self._persona_points[persona_key].extend(all_points)

        # Generate embeddings and upsert
        if all_points and not self.dry_run:
            self._generate_embeddings(all_points)
            self._upsert_points(all_points, collection)
            self._record_changelog(persona_key, collection, all_points)

    def _find_anchor_files(self, base_path: Path, patterns: List[str]) -> List[Path]:
        """Find anchor files matching patterns."""
        files = []
        if not base_path.exists():
            return files

        for pattern in patterns:
            files.extend(base_path.rglob(pattern))

        self.stats.files_found += len(files)
        return sorted(files)

    def _process_anchor_file(
        self,
        file_path: Path,
        persona_key: str,
        persona_config: Dict[str, Any],
        anchor_type: str,
        anchor_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Process a single anchor file into points."""
        points = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)

            if not data or not isinstance(data, dict):
                return points

            # Extract sections from anchor
            sections = self._extract_sections(data, anchor_config["sections"])

            for section_name, section_content in sections.items():
                if not section_content:
                    continue

                # Convert to text if needed
                if isinstance(section_content, dict):
                    text = yaml.dump(section_content, default_flow_style=False)
                elif isinstance(section_content, list):
                    text = "\n".join(str(item) for item in section_content)
                else:
                    text = str(section_content)

                # Generate deterministic point ID
                point_id = generate_point_id(
                    collection=persona_config["collection"],
                    content_type=anchor_config["type"],
                    persona=persona_key,
                    section=section_name
                )

                # Content hash for change detection
                content_hash = self.hasher.hash_content(text)

                # Compute document version for traceability
                version_info = self.versioner.compute_version(
                    content=text,
                    source_path=file_path,
                    strategy=VersionStrategy.COMPOSITE
                )

                # Build payload with doc_version for strict versioning
                payload = {
                    "type": anchor_config["type"],
                    "persona": f"{persona_key}.inspire",
                    "source": str(file_path.relative_to(WORKSPACE_ROOT)),
                    "priority": "core",
                    "timestamp": datetime.now().isoformat(),
                    "version": data.get("version", "1.0.0"),
                    "doc_version": version_info.doc_version,
                    "version_strategy": version_info.strategy,
                    "content_hash": content_hash,
                    "file_hash": version_info.file_hash,
                    "git_commit": version_info.git_commit,
                    "ingested_at": version_info.ingested_at,
                    "anchor_version": "v1.0",
                    "anchor_section": section_name,
                    "immutable": True,
                    "text": text,
                    # Persona metadata
                    "persona_full_name": persona_config["full_name"],
                    "persona_role": persona_config["role"],
                    "birth_order": persona_config["birth_order"],
                }

                # Count tokens
                token_count = self.chunker.count_tokens(text)
                self.stats.total_tokens += token_count
                self.stats.chunks_created += 1

                points.append({
                    "id": point_id,
                    "payload": payload,
                    "text": text,
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

    def _extract_sections(
        self,
        data: Dict[str, Any],
        expected_sections: List[str]
    ) -> Dict[str, Any]:
        """Extract sections from anchor data."""
        sections = {}

        # Direct section extraction
        for section in expected_sections:
            if section in data:
                sections[section] = data[section]

        # Handle nested structures
        if "anchor" in data and isinstance(data["anchor"], dict):
            for section in expected_sections:
                if section in data["anchor"]:
                    sections[section] = data["anchor"][section]

        # If no sections found, treat whole document as single section
        if not sections:
            sections["main"] = data

        return sections

    def _generate_embeddings(self, points: List[Dict[str, Any]]):
        """Generate embeddings for all points."""
        texts = [p['text'] for p in points]

        def progress_callback(current, total):
            if current % 50 == 0 or current == total:
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
            batch_size=50,
            skip_existing=not self.force
        )

        self.stats.points_upserted += result.points_upserted
        self.stats.points_skipped += result.points_skipped

        if result.errors:
            for err in result.errors:
                self.stats.errors.append({"type": "upsert_error", "message": err})

        self.logger.info(
            f"{collection}: upserted {result.points_upserted}, "
            f"skipped {result.points_skipped}"
        )

    def _record_changelog(
        self,
        persona_key: str,
        collection: str,
        points: List[Dict[str, Any]]
    ):
        """Record changelog entry for this persona's ingestion."""
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
            description=f"Ingested {len(points)} anchor sections for {persona_key}.inspire",
            version=doc_version,
            source_files=source_files,
            points_affected=len(points),
            author=f"ingest_persona_anchors/{self.run_id}"
        )

        self.logger.info(f"Changelog entry recorded for {collection}")

    def _log_summary(self):
        """Log ingestion summary."""
        self.logger.info(f"Files found: {self.stats.files_found}")
        self.logger.info(f"Files processed: {self.stats.files_processed}")
        self.logger.info(f"Anchor sections created: {self.stats.chunks_created}")
        self.logger.info(f"Embeddings generated: {self.stats.embeddings_generated}")
        self.logger.info(f"Points upserted: {self.stats.points_upserted}")
        self.logger.info(f"Points skipped: {self.stats.points_skipped}")
        self.logger.info(f"Errors: {len(self.stats.errors)}")
        self.logger.info(f"Duration: {self.stats.duration_seconds:.2f}s")


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Ingest persona activation anchors into Qdrant"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate without writing to Qdrant"
    )
    parser.add_argument(
        "--persona",
        type=str,
        help="Only ingest anchors for a specific persona (e.g., 'jubilee')"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-ingest even if points already exist"
    )

    args = parser.parse_args()

    ingester = PersonaAnchorsIngester(
        dry_run=args.dry_run,
        force=args.force,
        target_persona=args.persona
    )

    success = ingester.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
