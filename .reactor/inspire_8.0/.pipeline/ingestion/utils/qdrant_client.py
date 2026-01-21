# =============================================================================
# QDRANT CLIENT WRAPPER FOR INGESTION
# =============================================================================
"""
Provides a robust Qdrant client wrapper with:
- Automatic retry logic
- Batch upsert operations
- Duplicate checking
- Connection validation
"""

import os
import time
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import (
        Distance,
        PointStruct,
        VectorParams,
        Filter,
        FieldCondition,
        MatchValue,
        ScrollRequest,
    )
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    QdrantClient = None


@dataclass
class UpsertResult:
    """Result of an upsert operation."""
    success: bool
    points_upserted: int
    points_skipped: int
    errors: List[str]


class QdrantIngestionClient:
    """
    Wrapper around Qdrant client optimized for ingestion operations.

    Features:
    - Connection pooling and retry logic
    - Batch upsert with configurable size
    - Duplicate detection via point ID checking
    - Idempotent operations
    """

    def __init__(
        self,
        host: str = None,
        port: int = None,
        api_key: str = None,
        timeout: int = 30,
        max_retries: int = 3,
        retry_delay: float = 1.0
    ):
        """
        Initialize the Qdrant client.

        Args:
            host: Qdrant server host (default: from QDRANT_HOST env)
            port: Qdrant server port (default: from QDRANT_PORT env)
            api_key: Optional API key (default: from QDRANT_API_KEY env)
            timeout: Request timeout in seconds
            max_retries: Maximum retry attempts
            retry_delay: Initial delay between retries (exponential backoff)
        """
        if not QDRANT_AVAILABLE:
            raise ImportError(
                "qdrant-client is not installed. "
                "Install with: pip install qdrant-client"
            )

        self.host = host or os.getenv('QDRANT_HOST', 'localhost')
        self.port = port or int(os.getenv('QDRANT_PORT', '6333'))
        self.api_key = api_key or os.getenv('QDRANT_API_KEY')
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        self._client = None
        self._connected = False

    def connect(self) -> bool:
        """
        Establish connection to Qdrant server.

        Returns:
            True if connection successful
        """
        try:
            self._client = QdrantClient(
                host=self.host,
                port=self.port,
                api_key=self.api_key if self.api_key else None,
                timeout=self.timeout,
            )
            # Test connection
            self._client.get_collections()
            self._connected = True
            return True
        except Exception as e:
            self._connected = False
            raise ConnectionError(f"Failed to connect to Qdrant: {e}")

    def disconnect(self):
        """Close the connection."""
        if self._client:
            self._client.close()
            self._client = None
            self._connected = False

    def is_connected(self) -> bool:
        """Check if connected to Qdrant."""
        return self._connected and self._client is not None

    def collection_exists(self, collection_name: str) -> bool:
        """Check if a collection exists."""
        self._ensure_connected()
        try:
            collections = self._client.get_collections().collections
            return any(c.name == collection_name for c in collections)
        except Exception:
            return False

    def get_collection_info(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """Get collection information."""
        self._ensure_connected()
        try:
            info = self._client.get_collection(collection_name)
            return {
                "name": collection_name,
                "points_count": info.points_count,
                "vectors_count": info.vectors_count,
                "status": info.status.value if info.status else "unknown",
            }
        except Exception:
            return None

    def point_exists(self, collection_name: str, point_id: str) -> bool:
        """
        Check if a point with the given ID exists.

        Args:
            collection_name: Target collection
            point_id: Point ID to check

        Returns:
            True if point exists
        """
        self._ensure_connected()
        try:
            result = self._client.retrieve(
                collection_name=collection_name,
                ids=[point_id],
                with_payload=False,
                with_vectors=False,
            )
            return len(result) > 0
        except Exception:
            return False

    def get_existing_point_ids(
        self,
        collection_name: str,
        point_ids: List[str]
    ) -> set:
        """
        Get set of point IDs that already exist in collection.

        Args:
            collection_name: Target collection
            point_ids: List of point IDs to check

        Returns:
            Set of existing point IDs
        """
        self._ensure_connected()
        existing = set()

        try:
            # Check in batches to avoid overloading
            batch_size = 100
            for i in range(0, len(point_ids), batch_size):
                batch = point_ids[i:i + batch_size]
                result = self._client.retrieve(
                    collection_name=collection_name,
                    ids=batch,
                    with_payload=False,
                    with_vectors=False,
                )
                existing.update(p.id for p in result)
        except Exception:
            pass

        return existing

    def upsert_points(
        self,
        collection_name: str,
        points: List[Dict[str, Any]],
        batch_size: int = 100,
        skip_existing: bool = True
    ) -> UpsertResult:
        """
        Upsert points to collection with batch processing.

        Args:
            collection_name: Target collection
            points: List of point dicts with 'id', 'vector', 'payload'
            batch_size: Number of points per batch
            skip_existing: Whether to skip points that already exist

        Returns:
            UpsertResult with statistics
        """
        self._ensure_connected()

        errors = []
        points_upserted = 0
        points_skipped = 0

        # Filter out existing points if requested
        if skip_existing:
            point_ids = [p['id'] for p in points]
            existing = self.get_existing_point_ids(collection_name, point_ids)
            original_count = len(points)
            points = [p for p in points if p['id'] not in existing]
            points_skipped = original_count - len(points)

        if not points:
            return UpsertResult(
                success=True,
                points_upserted=0,
                points_skipped=points_skipped,
                errors=[]
            )

        # Process in batches
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            point_structs = [
                PointStruct(
                    id=p['id'],
                    vector=p['vector'],
                    payload=p.get('payload', {})
                )
                for p in batch
            ]

            success = self._upsert_with_retry(collection_name, point_structs)
            if success:
                points_upserted += len(batch)
            else:
                errors.append(f"Failed to upsert batch {i // batch_size + 1}")

        return UpsertResult(
            success=len(errors) == 0,
            points_upserted=points_upserted,
            points_skipped=points_skipped,
            errors=errors
        )

    def _upsert_with_retry(
        self,
        collection_name: str,
        points: List[PointStruct]
    ) -> bool:
        """Upsert with retry logic."""
        delay = self.retry_delay

        for attempt in range(self.max_retries):
            try:
                self._client.upsert(
                    collection_name=collection_name,
                    points=points,
                    wait=True
                )
                return True
            except Exception as e:
                if attempt < self.max_retries - 1:
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                else:
                    return False

        return False

    def search_by_hash(
        self,
        collection_name: str,
        content_hash: str
    ) -> Optional[Dict[str, Any]]:
        """
        Search for a point by content hash in payload.

        Args:
            collection_name: Target collection
            content_hash: Hash value to search for

        Returns:
            Point data if found, None otherwise
        """
        self._ensure_connected()
        try:
            results, _ = self._client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="content_hash",
                            match=MatchValue(value=content_hash)
                        )
                    ]
                ),
                limit=1,
                with_payload=True,
                with_vectors=False,
            )
            return results[0] if results else None
        except Exception:
            return None

    def _ensure_connected(self):
        """Ensure client is connected."""
        if not self.is_connected():
            self.connect()

    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()
        return False
