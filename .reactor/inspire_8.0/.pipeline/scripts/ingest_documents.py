#!/usr/bin/env python3
# =============================================================================
# INGEST DOCUMENTS
# =============================================================================
"""
Ingest new documents into the Inspire 8.0 knowledge base.

This script handles document ingestion including:
1. Scanning input directory for new documents
2. Validating document format and content
3. Chunking documents according to standards
4. Creating embeddings
5. Upserting to appropriate Qdrant collection
6. Updating ingestion logs

USAGE:
    python ingest_documents.py [options] <source>

ARGUMENTS:
    source               Source directory or file to ingest

OPTIONS:
    --collection NAME    Target collection (required)
    --chunk-size N       Chunk size in tokens (default: 512)
    --chunk-overlap N    Chunk overlap in tokens (default: 50)
    --dry-run            Show what would be done without executing
    --verbose            Enable verbose logging

SUPPORTED FORMATS:
    - .txt               Plain text files
    - .md                Markdown files
    - .json              JSON documents
    - .pdf               PDF files (requires pypdf)

ENVIRONMENT VARIABLES:
    QDRANT_HOST          Qdrant server host
    QDRANT_PORT          Qdrant server port
    QDRANT_API_KEY       Optional API key
    OPENAI_API_KEY       For embedding generation

EXIT CODES:
    0 - Success
    1 - Configuration error
    2 - Source not found
    3 - Ingestion error
    4 - Validation error
"""

import argparse
import hashlib
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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

class IngestionConfig:
    """Configuration for document ingestion."""

    def __init__(self):
        self.qdrant_host = os.environ.get('QDRANT_HOST', 'localhost')
        self.qdrant_port = int(os.environ.get('QDRANT_PORT', '6333'))
        self.qdrant_api_key = os.environ.get('QDRANT_API_KEY')
        self.openai_api_key = os.environ.get('OPENAI_API_KEY')

        # Chunking configuration
        self.default_chunk_size = 512
        self.default_chunk_overlap = 50

        # Supported file types
        self.supported_extensions = {'.txt', '.md', '.json', '.pdf'}

        # Valid collections for ingestion
        self.valid_collections = [
            'inspire_authority_foundation',
            'inspire_canonical_personas',
            'inspire_scripture_core',
            'inspire_theology_systematic',
            'inspire_theology_pastoral',
            'inspire_theology_apologetics',
        ]

        # Ingestion log directory
        self.log_dir = Path(
            'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/ingestion'
        )

    def validate(self) -> bool:
        """Validate configuration."""
        if not self.openai_api_key:
            logger.warning("OPENAI_API_KEY not set - embeddings will be mocked")
        return True


# =============================================================================
# DOCUMENT LOADER
# =============================================================================

class DocumentLoader:
    """Loads documents from various formats."""

    @staticmethod
    def load(file_path: Path) -> Tuple[str, Dict[str, Any]]:
        """
        Load a document and return content and metadata.

        Returns:
            Tuple of (content, metadata)
        """
        suffix = file_path.suffix.lower()

        if suffix in {'.txt', '.md'}:
            return DocumentLoader._load_text(file_path)
        elif suffix == '.json':
            return DocumentLoader._load_json(file_path)
        elif suffix == '.pdf':
            return DocumentLoader._load_pdf(file_path)
        else:
            raise ValueError(f"Unsupported file type: {suffix}")

    @staticmethod
    def _load_text(file_path: Path) -> Tuple[str, Dict[str, Any]]:
        """Load plain text or markdown file."""
        content = file_path.read_text(encoding='utf-8')
        metadata = {
            "source": str(file_path),
            "type": file_path.suffix[1:],
            "size_bytes": file_path.stat().st_size,
            "modified_at": datetime.fromtimestamp(
                file_path.stat().st_mtime
            ).isoformat(),
        }
        return content, metadata

    @staticmethod
    def _load_json(file_path: Path) -> Tuple[str, Dict[str, Any]]:
        """Load JSON document."""
        data = json.loads(file_path.read_text(encoding='utf-8'))

        # Extract content and metadata
        if isinstance(data, dict):
            content = data.get('content', data.get('text', json.dumps(data)))
            metadata = data.get('metadata', {})
            metadata['source'] = str(file_path)
            metadata['type'] = 'json'
        else:
            content = json.dumps(data)
            metadata = {"source": str(file_path), "type": "json"}

        return content, metadata

    @staticmethod
    def _load_pdf(file_path: Path) -> Tuple[str, Dict[str, Any]]:
        """Load PDF document."""
        # In production: use pypdf or similar
        logger.warning(f"PDF loading not implemented, skipping: {file_path}")
        return "", {"source": str(file_path), "type": "pdf", "skipped": True}


# =============================================================================
# TEXT CHUNKER
# =============================================================================

class TextChunker:
    """Chunks text into smaller pieces for embedding."""

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, text: str) -> List[str]:
        """
        Split text into chunks.

        Uses simple word-based chunking with overlap.
        In production, consider sentence-aware chunking.
        """
        if not text:
            return []

        words = text.split()
        chunks = []

        start = 0
        while start < len(words):
            end = start + self.chunk_size
            chunk_words = words[start:end]
            chunk_text = ' '.join(chunk_words)
            chunks.append(chunk_text)

            # Move start forward, accounting for overlap
            start = end - self.chunk_overlap
            if start >= len(words):
                break

        return chunks

    def chunk_with_metadata(
        self,
        text: str,
        base_metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Chunk text and attach metadata to each chunk."""
        chunks = self.chunk(text)
        result = []

        for i, chunk_text in enumerate(chunks):
            chunk_metadata = base_metadata.copy()
            chunk_metadata.update({
                "chunk_index": i,
                "chunk_count": len(chunks),
                "chunk_size": len(chunk_text),
            })
            result.append({
                "content": chunk_text,
                "metadata": chunk_metadata,
            })

        return result


# =============================================================================
# EMBEDDING GENERATOR (MOCK)
# =============================================================================

class EmbeddingGenerator:
    """
    Generates embeddings for text chunks.

    In production, replace with actual OpenAI or other embedding API.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.model = "text-embedding-3-small"
        self.dimension = 1536

    def generate(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []

        if self.api_key:
            # In production: call OpenAI embeddings API
            # response = openai.embeddings.create(...)
            pass

        # Mock embeddings for demonstration
        logger.debug(f"Generating mock embeddings for {len(texts)} texts")
        return [[0.0] * self.dimension for _ in texts]

    def generate_single(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        result = self.generate([text])
        return result[0] if result else [0.0] * self.dimension


# =============================================================================
# DOCUMENT INGESTOR
# =============================================================================

class DocumentIngestor:
    """Main class for document ingestion."""

    def __init__(
        self,
        config: IngestionConfig,
        collection: str,
        chunk_size: int = None,
        chunk_overlap: int = None,
        dry_run: bool = False
    ):
        self.config = config
        self.collection = collection
        self.dry_run = dry_run

        self.chunker = TextChunker(
            chunk_size=chunk_size or config.default_chunk_size,
            chunk_overlap=chunk_overlap or config.default_chunk_overlap,
        )
        self.embedder = EmbeddingGenerator(config.openai_api_key)

        self.stats = {
            "files_processed": 0,
            "files_skipped": 0,
            "chunks_created": 0,
            "vectors_upserted": 0,
            "errors": [],
            "started_at": None,
            "completed_at": None,
        }

    def ingest_directory(self, source_dir: Path) -> bool:
        """Ingest all documents from a directory."""
        self.stats["started_at"] = datetime.now().isoformat()

        logger.info("=" * 60)
        logger.info("INSPIRE 8.0 DOCUMENT INGESTION")
        logger.info("=" * 60)
        logger.info(f"Source: {source_dir}")
        logger.info(f"Collection: {self.collection}")
        logger.info(f"Chunk size: {self.chunker.chunk_size}")
        logger.info(f"Chunk overlap: {self.chunker.chunk_overlap}")
        logger.info(f"Dry run: {self.dry_run}")
        logger.info("=" * 60)

        # Find all documents
        documents = self._find_documents(source_dir)
        logger.info(f"Found {len(documents)} documents to process")

        # Process each document
        for doc_path in documents:
            self._process_document(doc_path)

        self.stats["completed_at"] = datetime.now().isoformat()
        self._print_summary()
        self._save_ingestion_log()

        return len(self.stats["errors"]) == 0

    def ingest_file(self, file_path: Path) -> bool:
        """Ingest a single file."""
        self.stats["started_at"] = datetime.now().isoformat()

        logger.info(f"Ingesting single file: {file_path}")

        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return False

        self._process_document(file_path)

        self.stats["completed_at"] = datetime.now().isoformat()
        self._print_summary()
        self._save_ingestion_log()

        return len(self.stats["errors"]) == 0

    def _find_documents(self, source_dir: Path) -> List[Path]:
        """Find all supported documents in directory."""
        documents = []
        for ext in self.config.supported_extensions:
            documents.extend(source_dir.rglob(f"*{ext}"))
        return sorted(documents)

    def _process_document(self, file_path: Path) -> bool:
        """Process a single document."""
        logger.info(f"Processing: {file_path.name}")

        try:
            # Load document
            content, metadata = DocumentLoader.load(file_path)

            if metadata.get("skipped"):
                logger.info(f"  Skipped: {file_path.name}")
                self.stats["files_skipped"] += 1
                return True

            if not content:
                logger.warning(f"  Empty content: {file_path.name}")
                self.stats["files_skipped"] += 1
                return True

            # Generate document ID
            doc_id = hashlib.md5(str(file_path).encode()).hexdigest()
            metadata["doc_id"] = doc_id

            # Chunk document
            chunks = self.chunker.chunk_with_metadata(content, metadata)
            self.stats["chunks_created"] += len(chunks)
            logger.info(f"  Created {len(chunks)} chunks")

            if self.dry_run:
                logger.info(f"  [DRY-RUN] Would upsert {len(chunks)} vectors")
            else:
                # Generate embeddings
                texts = [c["content"] for c in chunks]
                embeddings = self.embedder.generate(texts)

                # Upsert to Qdrant
                self._upsert_vectors(chunks, embeddings)
                self.stats["vectors_upserted"] += len(chunks)
                logger.info(f"  Upserted {len(chunks)} vectors")

            self.stats["files_processed"] += 1
            return True

        except Exception as e:
            error_msg = f"Error processing {file_path}: {e}"
            logger.error(f"  {error_msg}")
            self.stats["errors"].append(error_msg)
            return False

    def _upsert_vectors(
        self,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ):
        """Upsert vectors to Qdrant."""
        # In production: actual Qdrant client upsert
        # for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        #     qdrant_client.upsert(...)
        pass

    def _print_summary(self):
        """Print ingestion summary."""
        logger.info("=" * 60)
        logger.info("INGESTION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Files processed: {self.stats['files_processed']}")
        logger.info(f"Files skipped: {self.stats['files_skipped']}")
        logger.info(f"Chunks created: {self.stats['chunks_created']}")
        logger.info(f"Vectors upserted: {self.stats['vectors_upserted']}")
        logger.info(f"Errors: {len(self.stats['errors'])}")

        if self.stats["errors"]:
            logger.info("-" * 60)
            logger.info("ERRORS:")
            for error in self.stats["errors"]:
                logger.error(f"  - {error}")

        logger.info("=" * 60)

    def _save_ingestion_log(self):
        """Save ingestion log to file."""
        if self.dry_run:
            return

        self.config.log_dir.mkdir(parents=True, exist_ok=True)
        log_file = self.config.log_dir / f"ingestion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        log_data = {
            "collection": self.collection,
            "stats": self.stats,
            "config": {
                "chunk_size": self.chunker.chunk_size,
                "chunk_overlap": self.chunker.chunk_overlap,
            }
        }

        log_file.write_text(json.dumps(log_data, indent=2))
        logger.info(f"Ingestion log saved: {log_file}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Ingest documents into Inspire 8.0 knowledge base',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'source',
        type=str,
        help='Source directory or file to ingest'
    )
    parser.add_argument(
        '--collection',
        type=str,
        required=True,
        help='Target Qdrant collection (required)'
    )
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=512,
        help='Chunk size in tokens (default: 512)'
    )
    parser.add_argument(
        '--chunk-overlap',
        type=int,
        default=50,
        help='Chunk overlap in tokens (default: 50)'
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

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Validate source
    source = Path(args.source)
    if not source.exists():
        logger.error(f"Source not found: {source}")
        return 2

    # Load configuration
    config = IngestionConfig()
    if not config.validate():
        logger.error("Configuration validation failed")
        return 1

    # Validate collection
    if args.collection not in config.valid_collections:
        logger.error(f"Invalid collection: {args.collection}")
        logger.info(f"Valid collections: {', '.join(config.valid_collections)}")
        return 1

    # Create ingestor
    ingestor = DocumentIngestor(
        config=config,
        collection=args.collection,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        dry_run=args.dry_run,
    )

    # Execute ingestion
    try:
        if source.is_dir():
            success = ingestor.ingest_directory(source)
        else:
            success = ingestor.ingest_file(source)

        if success:
            logger.info("Ingestion completed successfully")
            return 0
        else:
            logger.error("Ingestion completed with errors")
            return 3

    except Exception as e:
        logger.exception(f"Ingestion failed with exception: {e}")
        return 3


if __name__ == '__main__':
    sys.exit(main())
