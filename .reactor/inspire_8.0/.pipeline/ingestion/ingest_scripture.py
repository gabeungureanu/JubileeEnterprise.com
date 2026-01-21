#!/usr/bin/env python3
# =============================================================================
# SCRIPTURE INGESTION SCRIPT
# =============================================================================
"""
Ingests Bible scripture from the Jubilee Standard Version (JSV) into Qdrant.

Target Collection: scripture
Chunking Strategy: Tier 1 - Atomic per-verse retrieval
Source: .reactor/inspire_8.0/authority_foundation/a1_scripture/Jubilee_Bible_JSV/

This script is IDEMPOTENT - safe to re-run without duplicating data.
Uses deterministic point IDs based on book/chapter/verse.

Usage:
    python ingest_scripture.py [--dry-run] [--book BOOK] [--force]

Options:
    --dry-run   Simulate ingestion without writing to Qdrant
    --book      Only ingest a specific book (e.g., "Genesis")
    --force     Re-ingest even if points already exist
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add utils to path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from utils.hasher import ContentHasher, generate_point_id
from utils.logger import IngestionLogger, RunStats, create_run_report, generate_run_id
from utils.qdrant_client import QdrantIngestionClient
from utils.chunker import Chunker
from utils.embedder import EmbeddingService


# =============================================================================
# CONFIGURATION
# =============================================================================

COLLECTION_NAME = "scripture"
WORKSPACE_ROOT = Path(__file__).parent.parent.parent.parent.parent
SCRIPTURE_PATH = WORKSPACE_ROOT / ".reactor/inspire_8.0/authority_foundation/a1_scripture/Jubilee_Bible_JSV"
LOG_DIR = SCRIPT_DIR / "logs"
REPORT_DIR = SCRIPT_DIR / "reports"

# Bible book mappings (folder name -> canonical name)
BOOK_MAPPINGS = {
    "01_Genesis": "Genesis",
    "02_Exodus": "Exodus",
    "03_Leviticus": "Leviticus",
    "04_Numbers": "Numbers",
    "05_Deuteronomy": "Deuteronomy",
    "06_Joshua": "Joshua",
    "07_Judges": "Judges",
    "08_Ruth": "Ruth",
    "09_1_Samuel": "1 Samuel",
    "10_2_Samuel": "2 Samuel",
    "11_1_Kings": "1 Kings",
    "12_2_Kings": "2 Kings",
    "13_1_Chronicles": "1 Chronicles",
    "14_2_Chronicles": "2 Chronicles",
    "15_Ezra": "Ezra",
    "16_Nehemiah": "Nehemiah",
    "17_Esther": "Esther",
    "18_Job": "Job",
    "19_Psalms": "Psalms",
    "20_Proverbs": "Proverbs",
    "21_Ecclesiastes": "Ecclesiastes",
    "22_Song_of_Solomon": "Song of Solomon",
    "23_Isaiah": "Isaiah",
    "24_Jeremiah": "Jeremiah",
    "25_Lamentations": "Lamentations",
    "26_Ezekiel": "Ezekiel",
    "27_Daniel": "Daniel",
    "28_Hosea": "Hosea",
    "29_Joel": "Joel",
    "30_Amos": "Amos",
    "31_Obadiah": "Obadiah",
    "32_Jonah": "Jonah",
    "33_Micah": "Micah",
    "34_Nahum": "Nahum",
    "35_Habakkuk": "Habakkuk",
    "36_Zephaniah": "Zephaniah",
    "37_Haggai": "Haggai",
    "38_Zechariah": "Zechariah",
    "39_Malachi": "Malachi",
    "40_Matthew": "Matthew",
    "41_Mark": "Mark",
    "42_Luke": "Luke",
    "43_John": "John",
    "44_Acts": "Acts",
    "45_Romans": "Romans",
    "46_1_Corinthians": "1 Corinthians",
    "47_2_Corinthians": "2 Corinthians",
    "48_Galatians": "Galatians",
    "49_Ephesians": "Ephesians",
    "50_Philippians": "Philippians",
    "51_Colossians": "Colossians",
    "52_1_Thessalonians": "1 Thessalonians",
    "53_2_Thessalonians": "2 Thessalonians",
    "54_1_Timothy": "1 Timothy",
    "55_2_Timothy": "2 Timothy",
    "56_Titus": "Titus",
    "57_Philemon": "Philemon",
    "58_Hebrews": "Hebrews",
    "59_James": "James",
    "60_1_Peter": "1 Peter",
    "61_2_Peter": "2 Peter",
    "62_1_John": "1 John",
    "63_2_John": "2 John",
    "64_3_John": "3 John",
    "65_Jude": "Jude",
    "66_Revelation": "Revelation",
}


# =============================================================================
# MAIN INGESTION LOGIC
# =============================================================================

class ScriptureIngester:
    """Handles scripture ingestion into Qdrant."""

    def __init__(
        self,
        dry_run: bool = False,
        force: bool = False,
        target_book: Optional[str] = None
    ):
        self.dry_run = dry_run
        self.force = force
        self.target_book = target_book

        self.run_id = generate_run_id("ingest_scripture")
        self.logger = IngestionLogger("ingest_scripture", str(LOG_DIR))
        self.hasher = ContentHasher()
        self.chunker = Chunker()

        self.stats = RunStats(
            run_id=self.run_id,
            script_name="ingest_scripture",
            collection=COLLECTION_NAME
        )

        # Initialize services (lazy)
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

        self.logger.section("SCRIPTURE INGESTION STARTED")
        self.logger.info(f"Run ID: {self.run_id}")
        self.logger.info(f"Dry Run: {self.dry_run}")
        self.logger.info(f"Force: {self.force}")
        self.logger.info(f"Target Book: {self.target_book or 'ALL'}")
        self.logger.info(f"Source: {SCRIPTURE_PATH}")

        try:
            # Step 1: Discover source files
            self.logger.section("DISCOVERING SOURCE FILES")
            book_files = self._discover_files()
            self.stats.files_found = sum(len(files) for files in book_files.values())
            self.logger.info(f"Found {self.stats.files_found} chapter files across {len(book_files)} books")

            if not book_files:
                self.logger.warning("No scripture files found")
                self.stats.status = "completed"
                return True

            # Step 2: Connect to Qdrant (if not dry run)
            if not self.dry_run:
                self.logger.section("CONNECTING TO QDRANT")
                self.qdrant.connect()
                if not self.qdrant.collection_exists(COLLECTION_NAME):
                    self.logger.error(f"Collection '{COLLECTION_NAME}' does not exist!")
                    self.stats.errors.append({
                        "type": "collection_not_found",
                        "collection": COLLECTION_NAME
                    })
                    self.stats.status = "failed"
                    return False
                self.logger.info("Connected to Qdrant successfully")

            # Step 3: Process each book
            self.logger.section("PROCESSING SCRIPTURE")
            all_points = []

            for book_folder, chapter_files in book_files.items():
                book_name = BOOK_MAPPINGS.get(book_folder, book_folder)
                self.logger.info(f"Processing {book_name} ({len(chapter_files)} chapters)")

                for chapter_file in sorted(chapter_files):
                    points = self._process_chapter(book_folder, book_name, chapter_file)
                    all_points.extend(points)
                    self.stats.files_processed += 1

            self.logger.info(f"Created {len(all_points)} verse points")
            self.stats.chunks_created = len(all_points)

            # Step 4: Generate embeddings
            if all_points and not self.dry_run:
                self.logger.section("GENERATING EMBEDDINGS")
                self._generate_embeddings(all_points)

            # Step 5: Upsert to Qdrant
            if all_points and not self.dry_run:
                self.logger.section("UPSERTING TO QDRANT")
                self._upsert_points(all_points)

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

    def _discover_files(self) -> Dict[str, List[Path]]:
        """Discover all scripture JSON files."""
        book_files = {}

        if not SCRIPTURE_PATH.exists():
            self.logger.error(f"Scripture path does not exist: {SCRIPTURE_PATH}")
            return book_files

        for book_dir in sorted(SCRIPTURE_PATH.iterdir()):
            if not book_dir.is_dir():
                continue

            book_folder = book_dir.name

            # Filter by target book if specified
            if self.target_book:
                book_name = BOOK_MAPPINGS.get(book_folder, book_folder)
                if self.target_book.lower() not in book_name.lower():
                    continue

            # Find chapter files
            chapter_files = list(book_dir.glob("*.json"))
            if chapter_files:
                book_files[book_folder] = chapter_files

        return book_files

    def _process_chapter(
        self,
        book_folder: str,
        book_name: str,
        chapter_file: Path
    ) -> List[Dict[str, Any]]:
        """Process a single chapter file into points."""
        points = []

        try:
            with open(chapter_file, 'r', encoding='utf-8') as f:
                chapter_data = json.load(f)

            # Extract chapter number from filename (e.g., "01_Genesis_01.json" -> 1)
            chapter_match = re.search(r'_(\d+)\.json$', chapter_file.name)
            chapter_num = int(chapter_match.group(1)) if chapter_match else 1

            # Get verses
            verses = chapter_data.get('verses', chapter_data.get('content', []))
            if isinstance(verses, dict):
                verses = list(verses.values())

            for verse_data in verses:
                # Handle different verse formats
                if isinstance(verse_data, dict):
                    verse_num = verse_data.get('verse', verse_data.get('verse_number', 1))
                    text = verse_data.get('text', verse_data.get('content', ''))
                elif isinstance(verse_data, str):
                    # Simple string format
                    verse_num = verses.index(verse_data) + 1
                    text = verse_data
                else:
                    continue

                if not text or not text.strip():
                    continue

                # Generate deterministic point ID
                point_id = generate_point_id(
                    collection=COLLECTION_NAME,
                    content_type='verse',
                    book=book_name.lower().replace(' ', '_'),
                    chapter=chapter_num,
                    verse=verse_num,
                    translation='jsv'
                )

                # Generate content hash for deduplication
                content_hash = self.hasher.hash_content(text)

                # Build payload
                payload = {
                    "type": "verse",
                    "persona": "shared",
                    "source": str(chapter_file.relative_to(WORKSPACE_ROOT)),
                    "priority": "core",
                    "timestamp": datetime.now().isoformat(),
                    "version": "1.0.0",
                    "content_hash": content_hash,
                    "bible_ref": {
                        "book": book_name,
                        "chapter": chapter_num,
                        "verse_start": verse_num,
                        "verse_end": None,
                        "translation": "JSV"
                    },
                    "text": text,
                }

                # Count tokens
                token_count = self.chunker.count_tokens(text)
                self.stats.total_tokens += token_count

                points.append({
                    "id": point_id,
                    "payload": payload,
                    "text": text,  # For embedding
                    "vector": None  # Will be filled later
                })

        except Exception as e:
            self.logger.error(f"Error processing {chapter_file}: {e}")
            self.stats.files_errored += 1
            self.stats.errors.append({
                "type": "file_error",
                "file": str(chapter_file),
                "message": str(e)
            })

        return points

    def _generate_embeddings(self, points: List[Dict[str, Any]]):
        """Generate embeddings for all points."""
        texts = [p['text'] for p in points]

        def progress_callback(current, total):
            self.logger.progress(current, total, "embeddings generated")

        result = self.embedder.embed_batch(texts, progress_callback)

        # Assign embeddings to points
        for i, embedding in enumerate(result.embeddings):
            if embedding:
                points[i]['vector'] = embedding
                self.stats.embeddings_generated += 1
            else:
                self.stats.embedding_errors += 1

        self.stats.embedding_api_calls = self.embedder.total_requests
        self.logger.info(f"Generated {self.stats.embeddings_generated} embeddings")

    def _upsert_points(self, points: List[Dict[str, Any]]):
        """Upsert points to Qdrant."""
        # Filter out points without embeddings
        valid_points = [p for p in points if p.get('vector')]

        if not valid_points:
            self.logger.warning("No valid points to upsert")
            return

        # Remove 'text' field from points (not needed in Qdrant)
        for p in valid_points:
            if 'text' in p:
                del p['text']

        result = self.qdrant.upsert_points(
            collection_name=COLLECTION_NAME,
            points=valid_points,
            batch_size=100,
            skip_existing=not self.force
        )

        self.stats.points_upserted = result.points_upserted
        self.stats.points_skipped = result.points_skipped

        if result.errors:
            for err in result.errors:
                self.stats.errors.append({"type": "upsert_error", "message": err})

        self.logger.info(
            f"Upserted {result.points_upserted} points, "
            f"skipped {result.points_skipped} existing"
        )

    def _log_summary(self):
        """Log ingestion summary."""
        self.logger.info(f"Files processed: {self.stats.files_processed}")
        self.logger.info(f"Verses created: {self.stats.chunks_created}")
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
        description="Ingest JSV scripture into Qdrant"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate without writing to Qdrant"
    )
    parser.add_argument(
        "--book",
        type=str,
        help="Only ingest a specific book (e.g., 'Genesis')"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-ingest even if points already exist"
    )

    args = parser.parse_args()

    ingester = ScriptureIngester(
        dry_run=args.dry_run,
        force=args.force,
        target_book=args.book
    )

    success = ingester.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
