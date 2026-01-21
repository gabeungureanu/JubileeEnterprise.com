# =============================================================================
# ACTIVATION ANCHOR RETRIEVER
# =============================================================================
"""
Retrieves activation anchors from Qdrant for persona ignition.

CRITICAL INVARIANTS:
1. This module is READ-ONLY - it NEVER writes to Qdrant
2. Only retrieves anchors tagged with activation_anchor types
3. Explicitly filters OUT memory and interaction data
4. Returns deterministic results for reproducible activation

The retriever queries Qdrant to load Identity, Mission, Voice, and Guardrail
anchors for a specific persona, assembles them into a PersonaAnchors object,
and ensures all required anchors are present before activation can proceed.
"""

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from .anchors import (
        ActivationAnchor,
        AnchorType,
        PersonaAnchors,
        create_anchor_from_payload,
    )
except ImportError:
    from anchors import (
        ActivationAnchor,
        AnchorType,
        PersonaAnchors,
        create_anchor_from_payload,
    )

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Filter, FieldCondition, MatchAny, MatchValue
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    QdrantClient = None


logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """Result of an anchor retrieval operation."""
    success: bool
    persona_name: str
    anchors: Optional[PersonaAnchors] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    retrieval_time_ms: float = 0.0
    points_retrieved: int = 0


class AnchorRetriever:
    """
    Retrieves activation anchors from Qdrant.

    This class is READ-ONLY by design. It has no methods that write
    to Qdrant, enforcing the separation between activation and memory.

    IMPORTANT: All methods are read-only. Any attempt to add write
    functionality violates the activation layer contract.
    """

    # Anchor types to retrieve (activation anchors only)
    ANCHOR_TYPES = [
        AnchorType.IDENTITY.value,
        AnchorType.MISSION.value,
        AnchorType.VOICE.value,
        AnchorType.GUARDRAIL.value,
    ]

    # Types to explicitly exclude (memory/interaction data)
    EXCLUDED_TYPES = [
        "interaction_summary",
        "long_term_memory",
        "relationship_context",
        "lesson_learned",
        "session_memory",
    ]

    def __init__(
        self,
        host: str = None,
        port: int = None,
        api_key: str = None,
    ):
        """
        Initialize the retriever.

        Args:
            host: Qdrant host (default: from QDRANT_HOST env)
            port: Qdrant port (default: from QDRANT_PORT env)
            api_key: Qdrant API key (default: from QDRANT_API_KEY env)
        """
        if not QDRANT_AVAILABLE:
            raise ImportError(
                "qdrant-client is not installed. "
                "Install with: pip install qdrant-client"
            )

        self.host = host or os.getenv('QDRANT_HOST', 'localhost')
        self.port = port or int(os.getenv('QDRANT_PORT', '6333'))
        self.api_key = api_key or os.getenv('QDRANT_API_KEY')

        self._client: Optional[QdrantClient] = None
        self._connected = False

    def connect(self) -> bool:
        """
        Establish connection to Qdrant.

        Returns:
            True if connection successful
        """
        try:
            self._client = QdrantClient(
                host=self.host,
                port=self.port,
                api_key=self.api_key,
                timeout=10,
            )
            # Test connection
            self._client.get_collections()
            self._connected = True
            logger.info(f"Connected to Qdrant at {self.host}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            self._connected = False
            return False

    def disconnect(self):
        """Close connection to Qdrant."""
        if self._client:
            self._client.close()
            self._client = None
            self._connected = False
            logger.info("Disconnected from Qdrant")

    def retrieve_persona_anchors(
        self,
        persona_name: str,
        collection_name: str = None,
    ) -> RetrievalResult:
        """
        Retrieve all activation anchors for a persona.

        This is the primary entry point for persona activation. It retrieves
        all four anchor types (Identity, Mission, Voice, Guardrails) and
        validates that the persona can be activated.

        Args:
            persona_name: Name of the persona (e.g., "jubilee")
            collection_name: Optional explicit collection name

        Returns:
            RetrievalResult with anchors or errors
        """
        start_time = datetime.now()
        result = RetrievalResult(
            success=False,
            persona_name=persona_name,
        )

        # Validate connection
        if not self._connected:
            if not self.connect():
                result.errors.append("Failed to connect to Qdrant")
                return result

        # Determine collection
        collection = collection_name or persona_name

        # Check collection exists
        if not self._collection_exists(collection):
            result.errors.append(f"Collection '{collection}' does not exist")
            return result

        # Retrieve anchors
        try:
            persona_anchors = PersonaAnchors(persona_name=persona_name)
            total_points = 0

            for anchor_type in self.ANCHOR_TYPES:
                anchors, count = self._retrieve_anchors_by_type(
                    collection=collection,
                    anchor_type=anchor_type,
                    persona_name=persona_name,
                )
                total_points += count

                # Categorize by type
                if anchor_type == AnchorType.IDENTITY.value:
                    persona_anchors.identity.extend(anchors)
                elif anchor_type == AnchorType.MISSION.value:
                    persona_anchors.mission.extend(anchors)
                elif anchor_type == AnchorType.VOICE.value:
                    persona_anchors.voice.extend(anchors)
                elif anchor_type == AnchorType.GUARDRAIL.value:
                    persona_anchors.guardrails.extend(anchors)

            result.anchors = persona_anchors
            result.points_retrieved = total_points

            # Validate completeness
            if not persona_anchors.is_complete:
                missing = []
                if not persona_anchors.identity:
                    missing.append("identity")
                if not persona_anchors.mission:
                    missing.append("mission")
                if not persona_anchors.voice:
                    missing.append("voice")
                if not persona_anchors.guardrails:
                    missing.append("guardrails")
                result.warnings.append(
                    f"Missing anchor types: {', '.join(missing)}"
                )

            result.success = True
            logger.info(
                f"Retrieved {total_points} anchors for {persona_name} "
                f"({persona_anchors.total_anchors} valid)"
            )

        except Exception as e:
            logger.error(f"Error retrieving anchors: {e}")
            result.errors.append(str(e))

        # Calculate retrieval time
        end_time = datetime.now()
        result.retrieval_time_ms = (end_time - start_time).total_seconds() * 1000

        return result

    def _retrieve_anchors_by_type(
        self,
        collection: str,
        anchor_type: str,
        persona_name: str,
    ) -> tuple[List[ActivationAnchor], int]:
        """
        Retrieve anchors of a specific type.

        Args:
            collection: Qdrant collection name
            anchor_type: Type of anchor to retrieve
            persona_name: Persona name for filtering

        Returns:
            Tuple of (list of anchors, count retrieved)
        """
        anchors = []

        # Build filter for activation anchors only
        filter_conditions = Filter(
            must=[
                FieldCondition(
                    key="type",
                    match=MatchValue(value=anchor_type),
                ),
                FieldCondition(
                    key="immutable",
                    match=MatchValue(value=True),
                ),
            ]
        )

        try:
            # Scroll through all matching points
            points, _ = self._client.scroll(
                collection_name=collection,
                scroll_filter=filter_conditions,
                limit=100,  # Should be more than enough for anchors
                with_payload=True,
                with_vectors=False,  # Don't need vectors for activation
            )

            for point in points:
                try:
                    payload = point.payload
                    payload['point_id'] = str(point.id)
                    anchor = create_anchor_from_payload(payload)
                    anchors.append(anchor)
                except Exception as e:
                    logger.warning(f"Failed to parse anchor point: {e}")

            return anchors, len(points)

        except Exception as e:
            logger.error(f"Error querying {anchor_type}: {e}")
            return [], 0

    def _collection_exists(self, collection_name: str) -> bool:
        """Check if a collection exists in Qdrant."""
        try:
            collections = self._client.get_collections()
            return any(c.name == collection_name for c in collections.collections)
        except Exception:
            return False

    def get_anchor_by_section(
        self,
        collection: str,
        anchor_type: str,
        section: str,
    ) -> Optional[ActivationAnchor]:
        """
        Retrieve a specific anchor by section name.

        Args:
            collection: Qdrant collection name
            anchor_type: Type of anchor
            section: Section name within the anchor

        Returns:
            ActivationAnchor if found, None otherwise
        """
        if not self._connected:
            if not self.connect():
                return None

        filter_conditions = Filter(
            must=[
                FieldCondition(
                    key="type",
                    match=MatchValue(value=anchor_type),
                ),
                FieldCondition(
                    key="anchor_section",
                    match=MatchValue(value=section),
                ),
                FieldCondition(
                    key="immutable",
                    match=MatchValue(value=True),
                ),
            ]
        )

        try:
            points, _ = self._client.scroll(
                collection_name=collection,
                scroll_filter=filter_conditions,
                limit=1,
                with_payload=True,
                with_vectors=False,
            )

            if points:
                payload = points[0].payload
                payload['point_id'] = str(points[0].id)
                return create_anchor_from_payload(payload)

            return None

        except Exception as e:
            logger.error(f"Error retrieving anchor section: {e}")
            return None

    # =========================================================================
    # READ-ONLY ENFORCEMENT
    # =========================================================================
    # The following methods are intentionally NOT implemented to enforce
    # the read-only nature of the activation layer.
    #
    # DO NOT ADD:
    # - upsert_anchor()
    # - update_anchor()
    # - delete_anchor()
    # - write_memory()
    # - Any method that modifies Qdrant state
    #
    # If you need to write data, use the ingestion pipeline instead.
    # =========================================================================
