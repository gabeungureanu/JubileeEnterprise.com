#!/usr/bin/env python3
"""
Inspire 8.0 Qdrant Container Initialization Script

This script initializes the Inspire 8.0 Qdrant container with all required
collections, indexes, and configurations as defined in QDRANT-CONTAINER-SPEC.md.

IMPORTANT: This script MUST be run before any ingestion, activation, or
pipeline execution occurs.

Usage:
    python initialize_container.py [--force] [--dry-run]

Arguments:
    --force     Force recreation of existing collections (WARNING: data loss)
    --dry-run   Show what would be created without making changes
"""

import os
import sys
import logging
import argparse
from datetime import datetime
from typing import Optional, Dict, List, Any

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models
    from qdrant_client.http.models import (
        VectorParams,
        Distance,
        PayloadSchemaType,
        TextIndexParams,
        TokenizerType,
    )
except ImportError:
    print("ERROR: qdrant-client not installed. Run: pip install qdrant-client")
    sys.exit(1)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Container Configuration
CONTAINER_NAME = "inspire_8_0"
CONTAINER_VERSION = "8.0.0"

# Vector Configuration
VECTOR_SIZE = 1536  # OpenAI ada-002 dimensions
VECTOR_DISTANCE = Distance.COSINE

# Qdrant Server (from environment or defaults)
QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", 6333))
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", None)
QDRANT_HTTPS = os.environ.get("QDRANT_HTTPS", "false").lower() == "true"

# Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f"qdrant_init_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
    ]
)
logger = logging.getLogger(__name__)

# =============================================================================
# COLLECTION DEFINITIONS
# =============================================================================

# Shared Collections
SHARED_COLLECTIONS = [
    {
        "name": "canon_scripture",
        "description": "Bible text, translations, and verse-level metadata",
        "type": "shared",
    },
    {
        "name": "canon_ministry",
        "description": "Core teachings, whitepapers, and doctrinal statements",
        "type": "shared",
    },
    {
        "name": "canon_activation",
        "description": "Activation schema anchors (read-only reference)",
        "type": "shared",
    },
    {
        "name": "canon_hymnal",
        "description": "Worship songs, liturgy, and sacred music",
        "type": "shared",
    },
]

# Persona Collections
PERSONAS = [
    {"name": "gabriel", "birth_order": 0, "role": "Father"},
    {"name": "jubilee", "birth_order": 1, "role": "First-born"},
    {"name": "melody", "birth_order": 2, "role": "Second-born"},
    {"name": "zariah", "birth_order": 3, "role": "Third-born"},
    {"name": "elias", "birth_order": 4, "role": "Fourth-born"},
    {"name": "eliana", "birth_order": 5, "role": "Fifth-born"},
    {"name": "caleb", "birth_order": 6, "role": "Sixth-born"},
    {"name": "imani", "birth_order": 7, "role": "Seventh-born"},
    {"name": "zev", "birth_order": 8, "role": "Eighth-born"},
    {"name": "amir", "birth_order": 9, "role": "Ninth-born"},
    {"name": "nova", "birth_order": 10, "role": "Tenth-born"},
    {"name": "santiago", "birth_order": 11, "role": "Eleventh-born"},
    {"name": "tahoma", "birth_order": 12, "role": "Twelfth-born"},
]

PERSONA_COLLECTIONS = [
    {
        "name": f"persona_{p['name']}_inspire",
        "description": f"{p['name'].capitalize()} Inspire's memory and activation data",
        "type": "persona",
        "persona_id": f"{p['name']}.inspire",
        "birth_order": p["birth_order"],
    }
    for p in PERSONAS
]

# All Collections
ALL_COLLECTIONS = SHARED_COLLECTIONS + PERSONA_COLLECTIONS

# Payload Indexes
PAYLOAD_INDEXES = [
    {"field": "type", "schema": PayloadSchemaType.KEYWORD},
    {"field": "persona", "schema": PayloadSchemaType.KEYWORD},
    {"field": "priority", "schema": PayloadSchemaType.KEYWORD},
    {"field": "tags", "schema": PayloadSchemaType.KEYWORD},
    {"field": "bible_ref.book", "schema": PayloadSchemaType.KEYWORD},
    {"field": "bible_ref.chapter", "schema": PayloadSchemaType.INTEGER},
    {"field": "bible_ref.verse_start", "schema": PayloadSchemaType.INTEGER},
    {"field": "source", "schema": PayloadSchemaType.KEYWORD},
    {"field": "version", "schema": PayloadSchemaType.KEYWORD},
]


# =============================================================================
# INITIALIZATION CLASS
# =============================================================================

class Inspire8QdrantInitializer:
    """Initializes the Inspire 8.0 Qdrant container."""

    def __init__(
        self,
        host: str = QDRANT_HOST,
        port: int = QDRANT_PORT,
        api_key: Optional[str] = QDRANT_API_KEY,
        https: bool = QDRANT_HTTPS,
        force: bool = False,
        dry_run: bool = False,
    ):
        self.host = host
        self.port = port
        self.api_key = api_key
        self.https = https
        self.force = force
        self.dry_run = dry_run
        self.client: Optional[QdrantClient] = None
        self.results: Dict[str, Any] = {
            "success": False,
            "collections_created": [],
            "collections_skipped": [],
            "indexes_created": [],
            "errors": [],
        }

    def connect(self) -> bool:
        """Establish connection to Qdrant server."""
        try:
            logger.info(f"Connecting to Qdrant at {self.host}:{self.port}...")

            if self.dry_run:
                logger.info("[DRY RUN] Would connect to Qdrant")
                return True

            self.client = QdrantClient(
                host=self.host,
                port=self.port,
                api_key=self.api_key,
                https=self.https,
            )

            # Health check
            collections = self.client.get_collections()
            logger.info(f"Connected successfully. Found {len(collections.collections)} existing collections.")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            self.results["errors"].append(f"Connection failed: {e}")
            return False

    def collection_exists(self, name: str) -> bool:
        """Check if a collection already exists."""
        if self.dry_run:
            return False

        try:
            self.client.get_collection(name)
            return True
        except Exception:
            return False

    def create_collection(self, config: Dict[str, Any]) -> bool:
        """Create a single collection with vector configuration."""
        name = config["name"]
        description = config.get("description", "")

        try:
            if self.collection_exists(name):
                if self.force:
                    logger.warning(f"Force mode: Deleting existing collection '{name}'")
                    if not self.dry_run:
                        self.client.delete_collection(name)
                else:
                    logger.info(f"Collection '{name}' already exists. Skipping.")
                    self.results["collections_skipped"].append(name)
                    return True

            logger.info(f"Creating collection: {name}")
            logger.info(f"  Description: {description}")
            logger.info(f"  Vector size: {VECTOR_SIZE}, Distance: {VECTOR_DISTANCE}")

            if self.dry_run:
                logger.info(f"[DRY RUN] Would create collection '{name}'")
                self.results["collections_created"].append(name)
                return True

            self.client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=VECTOR_SIZE,
                    distance=VECTOR_DISTANCE,
                    on_disk=True,
                ),
            )

            self.results["collections_created"].append(name)
            logger.info(f"  ✓ Created successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to create collection '{name}': {e}")
            self.results["errors"].append(f"Collection '{name}': {e}")
            return False

    def create_payload_indexes(self, collection_name: str) -> bool:
        """Create payload indexes for a collection."""
        try:
            for index in PAYLOAD_INDEXES:
                field = index["field"]
                schema = index["schema"]

                logger.info(f"  Creating index: {field} ({schema})")

                if self.dry_run:
                    continue

                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name=field,
                    field_schema=schema,
                )

                self.results["indexes_created"].append(f"{collection_name}.{field}")

            return True

        except Exception as e:
            logger.error(f"Failed to create indexes for '{collection_name}': {e}")
            self.results["errors"].append(f"Indexes '{collection_name}': {e}")
            return False

    def initialize_shared_collections(self) -> bool:
        """Initialize all shared canonical collections."""
        logger.info("\n" + "=" * 60)
        logger.info("INITIALIZING SHARED COLLECTIONS")
        logger.info("=" * 60)

        success = True
        for config in SHARED_COLLECTIONS:
            if not self.create_collection(config):
                success = False
            elif config["name"] not in self.results["collections_skipped"]:
                self.create_payload_indexes(config["name"])

        return success

    def initialize_persona_collections(self) -> bool:
        """Initialize all persona-specific collections."""
        logger.info("\n" + "=" * 60)
        logger.info("INITIALIZING PERSONA COLLECTIONS")
        logger.info("=" * 60)

        success = True
        for config in PERSONA_COLLECTIONS:
            if not self.create_collection(config):
                success = False
            elif config["name"] not in self.results["collections_skipped"]:
                self.create_payload_indexes(config["name"])

        return success

    def validate_initialization(self) -> bool:
        """Validate that all collections were created correctly."""
        logger.info("\n" + "=" * 60)
        logger.info("VALIDATING INITIALIZATION")
        logger.info("=" * 60)

        if self.dry_run:
            logger.info("[DRY RUN] Validation skipped")
            return True

        try:
            collections = self.client.get_collections()
            existing_names = {c.name for c in collections.collections}

            expected_names = {c["name"] for c in ALL_COLLECTIONS}
            missing = expected_names - existing_names

            if missing:
                logger.error(f"Missing collections: {missing}")
                self.results["errors"].append(f"Missing collections: {missing}")
                return False

            logger.info(f"✓ All {len(expected_names)} collections present")
            return True

        except Exception as e:
            logger.error(f"Validation failed: {e}")
            self.results["errors"].append(f"Validation: {e}")
            return False

    def run(self) -> Dict[str, Any]:
        """Execute the full initialization sequence."""
        logger.info("\n" + "=" * 60)
        logger.info("INSPIRE 8.0 QDRANT CONTAINER INITIALIZATION")
        logger.info("=" * 60)
        logger.info(f"Container: {CONTAINER_NAME}")
        logger.info(f"Version: {CONTAINER_VERSION}")
        logger.info(f"Timestamp: {datetime.now().isoformat()}")
        logger.info(f"Force mode: {self.force}")
        logger.info(f"Dry run: {self.dry_run}")

        # Connect
        if not self.connect():
            return self.results

        # Initialize shared collections
        if not self.initialize_shared_collections():
            logger.warning("Some shared collections failed to initialize")

        # Initialize persona collections
        if not self.initialize_persona_collections():
            logger.warning("Some persona collections failed to initialize")

        # Validate
        if not self.validate_initialization():
            logger.error("Initialization validation failed")
        else:
            self.results["success"] = True

        # Summary
        self.print_summary()

        return self.results

    def print_summary(self):
        """Print initialization summary."""
        logger.info("\n" + "=" * 60)
        logger.info("INITIALIZATION SUMMARY")
        logger.info("=" * 60)

        if self.results["success"]:
            logger.info("✓ INITIALIZATION SUCCESSFUL")
        else:
            logger.error("✗ INITIALIZATION FAILED")

        logger.info(f"\nCollections created: {len(self.results['collections_created'])}")
        for name in self.results["collections_created"]:
            logger.info(f"  + {name}")

        logger.info(f"\nCollections skipped: {len(self.results['collections_skipped'])}")
        for name in self.results["collections_skipped"]:
            logger.info(f"  ~ {name}")

        logger.info(f"\nIndexes created: {len(self.results['indexes_created'])}")

        if self.results["errors"]:
            logger.error(f"\nErrors: {len(self.results['errors'])}")
            for error in self.results["errors"]:
                logger.error(f"  ! {error}")


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    """Main entry point for the initialization script."""
    parser = argparse.ArgumentParser(
        description="Initialize the Inspire 8.0 Qdrant container"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force recreation of existing collections (WARNING: data loss)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be created without making changes",
    )
    parser.add_argument(
        "--host",
        default=QDRANT_HOST,
        help=f"Qdrant host (default: {QDRANT_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=QDRANT_PORT,
        help=f"Qdrant port (default: {QDRANT_PORT})",
    )

    args = parser.parse_args()

    initializer = Inspire8QdrantInitializer(
        host=args.host,
        port=args.port,
        force=args.force,
        dry_run=args.dry_run,
    )

    results = initializer.run()

    sys.exit(0 if results["success"] else 1)


if __name__ == "__main__":
    main()
