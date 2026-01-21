# =============================================================================
# SHARED CANON ANCHOR RETRIEVER
# =============================================================================
"""
Retrieves shared canon anchors for doctrinal and governance alignment.

This module retrieves approved shared anchors from designated shared collections
(scripture, doctrine, governance) to ensure all personas operate within the
same doctrinal and behavioral framework.

CRITICAL INVARIANTS:
1. This module is READ-ONLY - it NEVER writes to Qdrant
2. Only retrieves from approved shared collections
3. Respects priority filtering for token efficiency
4. Returns deterministic results for reproducible activation
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Filter, FieldCondition, MatchAny, MatchValue
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    QdrantClient = None

logger = logging.getLogger(__name__)


# =============================================================================
# SHARED CANON ANCHOR DATA CLASSES
# =============================================================================

@dataclass(frozen=True)
class SharedCanonAnchor:
    """
    Immutable representation of a shared canon anchor.

    Shared anchors provide doctrinal and governance alignment across
    all personas in the Inspire Family.
    """
    id: str
    collection: str
    content: str
    anchor_type: str
    priority: str = "normal"
    source: str = ""
    doc_version: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def token_estimate(self) -> int:
        """Rough token count (4 chars per token)."""
        return len(self.content) // 4


@dataclass
class SharedCanonResult:
    """Result of shared canon retrieval."""
    scripture: List[SharedCanonAnchor] = field(default_factory=list)
    doctrine: List[SharedCanonAnchor] = field(default_factory=list)
    governance: List[SharedCanonAnchor] = field(default_factory=list)
    family: List[SharedCanonAnchor] = field(default_factory=list)

    retrieval_time: str = ""
    total_items: int = 0
    total_tokens: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def success(self) -> bool:
        """Check if retrieval was successful."""
        return len(self.errors) == 0

    def get_all_anchors(self) -> List[SharedCanonAnchor]:
        """Get all anchors as a flat list."""
        return self.scripture + self.doctrine + self.governance + self.family


# =============================================================================
# SHARED CANON RETRIEVER
# =============================================================================

class SharedCanonRetriever:
    """
    Retrieves shared canon anchors from designated shared collections.

    This is a READ-ONLY class. It retrieves data but NEVER writes.

    ============================================================
    DO NOT ADD ANY WRITE METHODS TO THIS CLASS.
    The activation layer must remain purely read-only.
    ============================================================
    """

    # Collection configurations
    COLLECTIONS = {
        "scripture": {
            "collection": "scripture",
            "types": ["verse", "passage"],
            "priority": "core",
            "max_items": 10,
        },
        "doctrine": {
            "collection": "doctrine",
            "types": ["doctrinal_statement", "teaching"],
            "priority": "core",
            "max_items": 5,
        },
        "governance": {
            "collection": "governance",
            "types": ["identity_anchor", "guardrail_anchor", "protocol_anchor"],
            "priority": "core",
            "max_items": 5,
        },
        "family": {
            "collection": "inspire-family",
            "types": ["family_resource"],
            "priority": "high",
            "max_items": 3,
        },
    }

    def __init__(
        self,
        qdrant_host: str = "localhost",
        qdrant_port: int = 6333,
        qdrant_api_key: Optional[str] = None,
    ):
        """
        Initialize the shared canon retriever.

        Args:
            qdrant_host: Qdrant server host
            qdrant_port: Qdrant server port
            qdrant_api_key: Optional API key
        """
        self.qdrant_host = qdrant_host
        self.qdrant_port = qdrant_port
        self.qdrant_api_key = qdrant_api_key
        self._client: Optional[QdrantClient] = None

    def _get_client(self) -> Optional[QdrantClient]:
        """Get or create Qdrant client."""
        if not QDRANT_AVAILABLE:
            logger.warning("Qdrant client not available")
            return None

        if self._client is None:
            try:
                self._client = QdrantClient(
                    host=self.qdrant_host,
                    port=self.qdrant_port,
                    api_key=self.qdrant_api_key,
                )
                logger.info(f"Connected to Qdrant at {self.qdrant_host}:{self.qdrant_port}")
            except Exception as e:
                logger.error(f"Failed to connect to Qdrant: {e}")
                return None

        return self._client

    def disconnect(self):
        """Disconnect from Qdrant."""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None

    def retrieve_shared_canon(
        self,
        include_scripture: bool = True,
        include_doctrine: bool = True,
        include_governance: bool = True,
        include_family: bool = False,
        max_total_tokens: int = 2000,
    ) -> SharedCanonResult:
        """
        Retrieve shared canon anchors from all enabled collections.

        Args:
            include_scripture: Whether to include scripture anchors
            include_doctrine: Whether to include doctrine anchors
            include_governance: Whether to include governance anchors
            include_family: Whether to include family resource anchors
            max_total_tokens: Maximum total tokens for all shared canon

        Returns:
            SharedCanonResult with all retrieved anchors
        """
        result = SharedCanonResult(
            retrieval_time=datetime.now().isoformat()
        )

        client = self._get_client()
        if not client:
            result.errors.append("Qdrant client not available")
            return result

        total_tokens = 0

        # Retrieve from each enabled collection
        if include_scripture:
            scripture_anchors, tokens = self._retrieve_from_collection(
                client, "scripture", max_total_tokens - total_tokens
            )
            result.scripture = scripture_anchors
            total_tokens += tokens

        if include_doctrine and total_tokens < max_total_tokens:
            doctrine_anchors, tokens = self._retrieve_from_collection(
                client, "doctrine", max_total_tokens - total_tokens
            )
            result.doctrine = doctrine_anchors
            total_tokens += tokens

        if include_governance and total_tokens < max_total_tokens:
            governance_anchors, tokens = self._retrieve_from_collection(
                client, "governance", max_total_tokens - total_tokens
            )
            result.governance = governance_anchors
            total_tokens += tokens

        if include_family and total_tokens < max_total_tokens:
            family_anchors, tokens = self._retrieve_from_collection(
                client, "family", max_total_tokens - total_tokens
            )
            result.family = family_anchors
            total_tokens += tokens

        # Calculate totals
        result.total_items = len(result.get_all_anchors())
        result.total_tokens = total_tokens

        logger.info(
            f"Retrieved {result.total_items} shared canon anchors "
            f"(~{total_tokens} tokens)"
        )

        return result

    def _retrieve_from_collection(
        self,
        client: QdrantClient,
        collection_key: str,
        remaining_tokens: int,
    ) -> tuple[List[SharedCanonAnchor], int]:
        """
        Retrieve anchors from a specific collection.

        Args:
            client: Qdrant client
            collection_key: Key for collection config
            remaining_tokens: Token budget remaining

        Returns:
            Tuple of (anchors list, tokens used)
        """
        config = self.COLLECTIONS.get(collection_key)
        if not config:
            return [], 0

        collection_name = config["collection"]
        allowed_types = config["types"]
        priority = config.get("priority", "normal")
        max_items = config.get("max_items", 10)

        try:
            # Check if collection exists
            collections = client.get_collections().collections
            collection_names = [c.name for c in collections]

            if collection_name not in collection_names:
                logger.warning(f"Collection '{collection_name}' not found")
                return [], 0

            # Build filter for priority and type
            filter_conditions = []

            # Type filter
            if allowed_types:
                filter_conditions.append(
                    FieldCondition(
                        key="type",
                        match=MatchAny(any=allowed_types),
                    )
                )

            # Priority filter
            if priority:
                filter_conditions.append(
                    FieldCondition(
                        key="priority",
                        match=MatchValue(value=priority),
                    )
                )

            # Retrieve points
            query_filter = Filter(must=filter_conditions) if filter_conditions else None

            points = client.scroll(
                collection_name=collection_name,
                scroll_filter=query_filter,
                limit=max_items,
                with_payload=True,
            )[0]

            # Convert to anchors with token budgeting
            anchors = []
            total_tokens = 0

            for point in points:
                payload = point.payload or {}
                content = payload.get("text", "") or payload.get("content", "")
                token_estimate = len(content) // 4

                # Check token budget
                if total_tokens + token_estimate > remaining_tokens:
                    logger.debug(
                        f"Token budget exceeded for {collection_name}, "
                        f"stopping at {len(anchors)} items"
                    )
                    break

                anchor = SharedCanonAnchor(
                    id=str(point.id),
                    collection=collection_name,
                    content=content,
                    anchor_type=payload.get("type", "unknown"),
                    priority=payload.get("priority", "normal"),
                    source=payload.get("source", ""),
                    doc_version=payload.get("doc_version", ""),
                    metadata={
                        k: v for k, v in payload.items()
                        if k not in ["text", "content", "type", "priority", "source", "doc_version"]
                    }
                )
                anchors.append(anchor)
                total_tokens += token_estimate

            logger.debug(
                f"Retrieved {len(anchors)} anchors from {collection_name} "
                f"(~{total_tokens} tokens)"
            )

            return anchors, total_tokens

        except Exception as e:
            logger.error(f"Error retrieving from {collection_name}: {e}")
            return [], 0


# =============================================================================
# CONTEXTUAL GROUNDING RETRIEVER
# =============================================================================

@dataclass(frozen=True)
class GroundingItem:
    """
    Immutable representation of a contextual grounding item.

    Grounding items provide situational awareness from past interactions
    without loading full memory histories.
    """
    id: str
    item_type: str
    content: str
    timestamp: str
    relevance_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def token_estimate(self) -> int:
        """Rough token count (4 chars per token)."""
        return len(self.content) // 4


@dataclass
class GroundingResult:
    """Result of contextual grounding retrieval."""
    items: List[GroundingItem] = field(default_factory=list)
    retrieval_time: str = ""
    strategy: str = ""
    total_items: int = 0
    total_tokens: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def success(self) -> bool:
        """Check if retrieval was successful."""
        return len(self.errors) == 0


class ContextualGroundingRetriever:
    """
    Retrieves bounded contextual grounding from persona memory.

    This retrieves a small, bounded set of existing memory items for
    situational awareness. It explicitly PROHIBITS loading large memory
    histories or raw transcripts.

    CRITICAL INVARIANTS:
    1. This class is READ-ONLY - it NEVER writes to Qdrant
    2. Respects hard limits on items and tokens
    3. Only retrieves from allowed_types
    4. Never retrieves raw transcripts or session memory

    ============================================================
    DO NOT ADD ANY WRITE METHODS TO THIS CLASS.
    The activation layer must remain purely read-only.
    ============================================================
    """

    # Types allowed for contextual grounding
    ALLOWED_TYPES = frozenset([
        "interaction_summary",
        "relationship_context",
        "lesson_learned",
    ])

    # Types explicitly prohibited
    PROHIBITED_TYPES = frozenset([
        "raw_transcript",
        "session_memory",
        "long_term_memory",
        "activation_anchor",
        "identity_anchor",
        "mission_anchor",
        "voice_anchor",
        "guardrail_anchor",
    ])

    # Hard limits
    MAX_ITEMS = 5
    MAX_TOKENS = 1000
    MAX_AGE_DAYS = 90

    def __init__(
        self,
        qdrant_host: str = "localhost",
        qdrant_port: int = 6333,
        qdrant_api_key: Optional[str] = None,
    ):
        """
        Initialize the contextual grounding retriever.

        Args:
            qdrant_host: Qdrant server host
            qdrant_port: Qdrant server port
            qdrant_api_key: Optional API key
        """
        self.qdrant_host = qdrant_host
        self.qdrant_port = qdrant_port
        self.qdrant_api_key = qdrant_api_key
        self._client: Optional[QdrantClient] = None

    def _get_client(self) -> Optional[QdrantClient]:
        """Get or create Qdrant client."""
        if not QDRANT_AVAILABLE:
            logger.warning("Qdrant client not available")
            return None

        if self._client is None:
            try:
                self._client = QdrantClient(
                    host=self.qdrant_host,
                    port=self.qdrant_port,
                    api_key=self.qdrant_api_key,
                )
            except Exception as e:
                logger.error(f"Failed to connect to Qdrant: {e}")
                return None

        return self._client

    def disconnect(self):
        """Disconnect from Qdrant."""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None

    def retrieve_grounding(
        self,
        persona_name: str,
        collection_name: str,
        strategy: str = "recent",
        max_items: Optional[int] = None,
        max_tokens: Optional[int] = None,
    ) -> GroundingResult:
        """
        Retrieve contextual grounding for a persona.

        Args:
            persona_name: Name of the persona
            collection_name: Qdrant collection for this persona
            strategy: Retrieval strategy ("recent", "relevant", "mixed")
            max_items: Override for max items (capped by MAX_ITEMS)
            max_tokens: Override for max tokens (capped by MAX_TOKENS)

        Returns:
            GroundingResult with retrieved items
        """
        result = GroundingResult(
            retrieval_time=datetime.now().isoformat(),
            strategy=strategy,
        )

        # Enforce hard limits
        effective_max_items = min(max_items or self.MAX_ITEMS, self.MAX_ITEMS)
        effective_max_tokens = min(max_tokens or self.MAX_TOKENS, self.MAX_TOKENS)

        client = self._get_client()
        if not client:
            result.errors.append("Qdrant client not available")
            return result

        try:
            # Check if collection exists
            collections = client.get_collections().collections
            collection_names = [c.name for c in collections]

            if collection_name not in collection_names:
                result.warnings.append(
                    f"Collection '{collection_name}' not found, "
                    "no contextual grounding available"
                )
                return result

            # Build filter for allowed types only
            filter_conditions = [
                FieldCondition(
                    key="type",
                    match=MatchAny(any=list(self.ALLOWED_TYPES)),
                )
            ]

            query_filter = Filter(must=filter_conditions)

            # Retrieve based on strategy
            if strategy == "recent":
                items = self._retrieve_recent(
                    client, collection_name, query_filter,
                    effective_max_items, effective_max_tokens
                )
            elif strategy == "relevant":
                items = self._retrieve_relevant(
                    client, collection_name, query_filter,
                    persona_name, effective_max_items, effective_max_tokens
                )
            else:  # mixed
                items = self._retrieve_mixed(
                    client, collection_name, query_filter,
                    persona_name, effective_max_items, effective_max_tokens
                )

            result.items = items
            result.total_items = len(items)
            result.total_tokens = sum(item.token_estimate for item in items)

            logger.info(
                f"Retrieved {result.total_items} grounding items for {persona_name} "
                f"(~{result.total_tokens} tokens)"
            )

        except Exception as e:
            result.errors.append(f"Error retrieving grounding: {e}")
            logger.error(f"Grounding retrieval failed: {e}")

        return result

    def _retrieve_recent(
        self,
        client: QdrantClient,
        collection_name: str,
        query_filter: Filter,
        max_items: int,
        max_tokens: int,
    ) -> List[GroundingItem]:
        """Retrieve most recent grounding items."""
        try:
            points = client.scroll(
                collection_name=collection_name,
                scroll_filter=query_filter,
                limit=max_items * 2,  # Fetch extra to allow token filtering
                with_payload=True,
            )[0]

            # Sort by timestamp if available
            def get_timestamp(point):
                payload = point.payload or {}
                ts = payload.get("created_at") or payload.get("timestamp") or ""
                return ts

            sorted_points = sorted(points, key=get_timestamp, reverse=True)

            return self._convert_to_grounding_items(
                sorted_points, max_items, max_tokens
            )

        except Exception as e:
            logger.error(f"Recent retrieval failed: {e}")
            return []

    def _retrieve_relevant(
        self,
        client: QdrantClient,
        collection_name: str,
        query_filter: Filter,
        persona_name: str,
        max_items: int,
        max_tokens: int,
    ) -> List[GroundingItem]:
        """Retrieve semantically relevant grounding items."""
        # For now, fall back to recent since we need embeddings for semantic search
        logger.debug("Semantic retrieval not yet implemented, using recent")
        return self._retrieve_recent(
            client, collection_name, query_filter, max_items, max_tokens
        )

    def _retrieve_mixed(
        self,
        client: QdrantClient,
        collection_name: str,
        query_filter: Filter,
        persona_name: str,
        max_items: int,
        max_tokens: int,
    ) -> List[GroundingItem]:
        """Retrieve mixed recent and relevant items."""
        # For now, use recent until semantic search is implemented
        return self._retrieve_recent(
            client, collection_name, query_filter, max_items, max_tokens
        )

    def _convert_to_grounding_items(
        self,
        points: List,
        max_items: int,
        max_tokens: int,
    ) -> List[GroundingItem]:
        """Convert Qdrant points to grounding items with token budget."""
        items = []
        total_tokens = 0

        for point in points:
            if len(items) >= max_items:
                break

            payload = point.payload or {}
            content = payload.get("text", "") or payload.get("content", "")
            token_estimate = len(content) // 4

            # Check token budget
            if total_tokens + token_estimate > max_tokens:
                continue

            # Verify type is allowed
            item_type = payload.get("type", "")
            if item_type in self.PROHIBITED_TYPES:
                logger.warning(f"Skipping prohibited type: {item_type}")
                continue

            if item_type and item_type not in self.ALLOWED_TYPES:
                logger.warning(f"Skipping unknown type: {item_type}")
                continue

            item = GroundingItem(
                id=str(point.id),
                item_type=item_type,
                content=content,
                timestamp=payload.get("created_at", "") or payload.get("timestamp", ""),
                relevance_score=0.0,
                metadata={
                    k: v for k, v in payload.items()
                    if k not in ["text", "content", "type", "created_at", "timestamp"]
                }
            )
            items.append(item)
            total_tokens += token_estimate

        return items
