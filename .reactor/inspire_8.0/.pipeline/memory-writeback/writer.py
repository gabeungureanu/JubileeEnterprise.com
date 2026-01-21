# =============================================================================
# MEMORY WRITER
# =============================================================================
"""
Writes memory items to Qdrant with proper metadata.

This module handles the actual persistence of memory items to Qdrant,
enforcing the summarization-first policy and ensuring proper metadata
on all stored items.

CRITICAL INVARIANTS:
1. All writes require writeback phase authorization
2. Prohibited types are blocked (raw transcripts by default)
3. All items have required metadata (timestamp, source, persona)
4. Token limits are enforced
5. All writes are logged for audit
6. FORMAL MEMORY POLICY enforced: only durable, high-signal content persisted
7. All items MUST have confidence level and scope designation
"""

import hashlib
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from .config import WritebackConfig, get_writeback_config, MemoryItemType
    from .extractors import ExtractedItem
    from .summarizer import SummaryResult
    from .memory_policy import (
        MemoryPolicyEnforcer,
        get_memory_policy_enforcer,
        PolicyEvaluation,
        ConfidenceLevel,
        MemoryScope,
    )
except ImportError:
    from config import WritebackConfig, get_writeback_config, MemoryItemType
    from extractors import ExtractedItem
    from summarizer import SummaryResult
    from memory_policy import (
        MemoryPolicyEnforcer,
        get_memory_policy_enforcer,
        PolicyEvaluation,
        ConfidenceLevel,
        MemoryScope,
    )

# Import policy from activation layer
import sys
from pathlib import Path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR.parent / "activation"))

try:
    from policy import (
        MemoryPolicy,
        ExecutionPhase,
        WritebackPhase,
        get_memory_policy,
        WriteAttemptError,
    )
except ImportError:
    # Stub for standalone testing
    class WriteAttemptError(Exception):
        pass

    def get_memory_policy():
        return None

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import PointStruct, VectorParams, Distance
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    QdrantClient = None

logger = logging.getLogger(__name__)


@dataclass
class MemoryItem:
    """
    A memory item ready for storage in Qdrant.

    This represents the final form of a memory item with all
    required metadata and validation applied.

    POLICY REQUIREMENTS:
    - confidence_level: REQUIRED (provisional, confirmed, high_confidence)
    - scope: REQUIRED (private, shared, user_global)
    """
    # Identification
    item_id: str = ""
    item_type: str = ""  # MemoryItemType value

    # Content
    content: str = ""
    content_hash: str = ""
    token_count: int = 0

    # Required metadata
    persona_name: str = ""
    collection: str = ""
    source: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    # Optional metadata
    session_id: str = ""
    context: str = ""
    tags: List[str] = field(default_factory=list)

    # Type-specific fields
    reference: str = ""  # For scripture
    decision_type: str = ""  # For decisions
    preference_key: str = ""  # For preferences

    # FORMAL MEMORY POLICY FIELDS (REQUIRED)
    confidence_level: str = ""  # provisional, confirmed, high_confidence
    scope: str = ""  # private, shared, user_global
    durability_score: float = 0.0
    signal_strength: float = 0.0
    policy_justification: str = ""

    # Storage metadata
    vector: List[float] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        if not self.item_id:
            self.item_id = str(uuid.uuid4())
        if not self.content_hash:
            self.content_hash = hashlib.sha256(
                self.content.encode('utf-8')
            ).hexdigest()[:16]
        if not self.token_count:
            self.token_count = len(self.content) // 4

    def to_payload(self) -> Dict[str, Any]:
        """Convert to Qdrant payload format."""
        return {
            "item_id": self.item_id,
            "type": self.item_type,
            "content": self.content,
            "content_hash": self.content_hash,
            "token_count": self.token_count,
            "persona_name": self.persona_name,
            "collection": self.collection,
            "source": self.source,
            "timestamp": self.timestamp,
            "session_id": self.session_id,
            "context": self.context,
            "tags": self.tags,
            "reference": self.reference,
            "decision_type": self.decision_type,
            "preference_key": self.preference_key,
            "created_at": self.created_at,
            # Memory items are mutable (unlike activation anchors)
            "immutable": False,
            "memory_item": True,
            # FORMAL MEMORY POLICY FIELDS (REQUIRED)
            "confidence_level": self.confidence_level,
            "scope": self.scope,
            "durability_score": self.durability_score,
            "signal_strength": self.signal_strength,
            "policy_justification": self.policy_justification,
        }


@dataclass
class WriteResult:
    """Result of a memory write operation."""
    success: bool
    items_written: int = 0
    items_blocked: int = 0
    items_failed: int = 0

    # Details
    written_ids: List[str] = field(default_factory=list)
    blocked_reasons: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Metrics
    total_tokens: int = 0
    write_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "items_written": self.items_written,
            "items_blocked": self.items_blocked,
            "items_failed": self.items_failed,
            "written_ids": self.written_ids,
            "blocked_reasons": self.blocked_reasons,
            "errors": self.errors,
            "warnings": self.warnings,
            "total_tokens": self.total_tokens,
            "write_time_ms": self.write_time_ms,
        }


class MemoryWriter:
    """
    Writes memory items to Qdrant with policy enforcement.

    This class is the gatekeeper for all memory writes. It:
    1. Validates items against policy
    2. Enforces token limits
    3. Blocks prohibited types
    4. Ensures proper metadata
    5. Logs all write operations
    6. ENFORCES FORMAL MEMORY POLICY (durability, confidence, scope)
    """

    def __init__(
        self,
        config: WritebackConfig = None,
        host: str = None,
        port: int = None,
        api_key: str = None,
    ):
        """
        Initialize the memory writer.

        Args:
            config: Writeback configuration
            host: Qdrant host
            port: Qdrant port
            api_key: Qdrant API key
        """
        if not QDRANT_AVAILABLE:
            raise ImportError(
                "qdrant-client is not installed. "
                "Install with: pip install qdrant-client"
            )

        self.config = config or get_writeback_config()
        self.policy = get_memory_policy()

        # Initialize formal memory policy enforcer
        self.memory_policy_enforcer = get_memory_policy_enforcer()

        self.host = host or os.getenv('QDRANT_HOST', 'localhost')
        self.port = port or int(os.getenv('QDRANT_PORT', '6333'))
        self.api_key = api_key or os.getenv('QDRANT_API_KEY')

        self._client: Optional[QdrantClient] = None
        self._connected = False

    def connect(self) -> bool:
        """Establish connection to Qdrant."""
        try:
            self._client = QdrantClient(
                host=self.host,
                port=self.port,
                api_key=self.api_key,
                timeout=10,
            )
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

    def write_items(
        self,
        items: List[MemoryItem],
        collection_name: str,
        authorization_method: str = "session_end_commit",
    ) -> WriteResult:
        """
        Write memory items to Qdrant.

        This method enforces all writeback policies and only writes
        items that pass validation.

        Args:
            items: List of MemoryItem objects to write
            collection_name: Target Qdrant collection
            authorization_method: Method for write authorization

        Returns:
            WriteResult with operation details
        """
        start_time = datetime.now()
        result = WriteResult(success=False)

        if not items:
            result.success = True
            return result

        # Ensure connection
        if not self._connected:
            if not self.connect():
                result.errors.append("Failed to connect to Qdrant")
                return result

        # Validate and filter items
        validated_items = []
        for item in items:
            validation = self._validate_item(item, collection_name)
            if validation["allowed"]:
                validated_items.append(item)
            else:
                result.items_blocked += 1
                result.blocked_reasons.append(
                    f"{item.item_type}: {validation['reason']}"
                )

        if not validated_items:
            result.success = True
            result.warnings.append("No items passed validation")
            return result

        # Enter writeback phase with authorization
        try:
            if self.policy:
                with WritebackPhase(self.policy, authorization_method) as wb:
                    if not wb.authorized:
                        result.errors.append("Writeback authorization failed")
                        return result

                    # Perform writes
                    result = self._perform_writes(
                        validated_items, collection_name, result
                    )
            else:
                # No policy - direct write (testing mode)
                result = self._perform_writes(
                    validated_items, collection_name, result
                )

        except WriteAttemptError as e:
            result.errors.append(f"Write blocked by policy: {e}")
            return result
        except Exception as e:
            result.errors.append(f"Write failed: {e}")
            logger.error(f"Memory write failed: {e}")
            return result

        # Calculate metrics
        end_time = datetime.now()
        result.write_time_ms = (end_time - start_time).total_seconds() * 1000
        result.total_tokens = sum(i.token_count for i in validated_items)

        return result

    def _validate_item(
        self,
        item: MemoryItem,
        collection_name: str,
    ) -> Dict[str, Any]:
        """
        Validate a memory item against policy.

        This includes BOTH the original policy checks AND the formal
        memory policy (durability, confidence, scope).

        Args:
            item: Item to validate
            collection_name: Target collection

        Returns:
            Dict with 'allowed', 'reason', and optional 'evaluation' keys
        """
        # Check 1: Item type allowed?
        try:
            item_type = MemoryItemType(item.item_type)
        except ValueError:
            return {
                "allowed": False,
                "reason": f"Unknown item type: {item.item_type}"
            }

        if not self.config.is_type_allowed(item_type):
            return {
                "allowed": False,
                "reason": f"Item type '{item.item_type}' is prohibited by policy"
            }

        # Check 2: Token limit?
        max_tokens = self.config.get_token_limit(item_type)
        if item.token_count > max_tokens:
            return {
                "allowed": False,
                "reason": f"Token count {item.token_count} exceeds limit {max_tokens}"
            }

        # Check 3: Required metadata present?
        if self.config.require_timestamp and not item.timestamp:
            return {
                "allowed": False,
                "reason": "Missing required timestamp"
            }

        if self.config.require_source and not item.source:
            return {
                "allowed": False,
                "reason": "Missing required source"
            }

        if self.config.require_persona and not item.persona_name:
            return {
                "allowed": False,
                "reason": "Missing required persona_name"
            }

        # Check 4: Content not empty?
        if not item.content or not item.content.strip():
            return {
                "allowed": False,
                "reason": "Empty content"
            }

        # Check 5: FORMAL MEMORY POLICY - Durability evaluation
        # Skip policy for session summaries (always allowed)
        if item.item_type != MemoryItemType.SESSION_SUMMARY.value:
            evaluation = self.memory_policy_enforcer.evaluate(
                content=item.content,
                item_type=item.item_type,
                context={"session_id": item.session_id} if item.session_id else {},
            )

            if not evaluation.should_persist:
                return {
                    "allowed": False,
                    "reason": f"MEMORY POLICY BLOCK: {evaluation.rejection_reason}",
                    "evaluation": evaluation,
                }

            # Enrich item with policy metadata if not already set
            if not item.confidence_level:
                item.confidence_level = evaluation.confidence.value if evaluation.confidence else ""
            if not item.scope:
                item.scope = evaluation.scope.value if evaluation.scope else ""
            if not item.durability_score:
                item.durability_score = evaluation.durability_score
            if not item.signal_strength:
                item.signal_strength = evaluation.signal_strength
            if not item.policy_justification:
                item.policy_justification = evaluation.justification

        # Check activation phase policy if available
        if self.policy:
            # Map our item type to policy writable types
            policy_type = self._map_to_policy_type(item_type)
            try:
                self.policy.check_write_allowed(
                    target_type=policy_type,
                    collection=collection_name,
                    raise_on_block=True,
                )
            except WriteAttemptError as e:
                return {
                    "allowed": False,
                    "reason": str(e)
                }

        return {"allowed": True, "reason": "Passed all checks (including formal memory policy)"}

    def _map_to_policy_type(self, item_type: MemoryItemType) -> str:
        """Map MemoryItemType to policy writable type."""
        mapping = {
            MemoryItemType.SESSION_SUMMARY: "interaction_summary",
            MemoryItemType.KEY_DECISION: "lesson_learned",
            MemoryItemType.USER_PREFERENCE: "relationship_context",
            MemoryItemType.SCRIPTURE_REFERENCE: "interaction_summary",
            MemoryItemType.INTERACTION_SUMMARY: "interaction_summary",
            MemoryItemType.LESSON_LEARNED: "lesson_learned",
            MemoryItemType.RELATIONSHIP_CONTEXT: "relationship_context",
        }
        return mapping.get(item_type, "interaction_summary")

    def _perform_writes(
        self,
        items: List[MemoryItem],
        collection_name: str,
        result: WriteResult,
    ) -> WriteResult:
        """
        Perform the actual Qdrant writes.

        Args:
            items: Validated items to write
            collection_name: Target collection
            result: WriteResult to update

        Returns:
            Updated WriteResult
        """
        # Ensure collection exists
        if not self._ensure_collection_exists(collection_name):
            result.errors.append(f"Failed to ensure collection: {collection_name}")
            return result

        # Build points
        points = []
        for item in items:
            # Generate or use existing vector
            vector = item.vector if item.vector else self._generate_dummy_vector()

            point = PointStruct(
                id=item.item_id,
                vector=vector,
                payload=item.to_payload(),
            )
            points.append(point)

        # Write to Qdrant
        try:
            self._client.upsert(
                collection_name=collection_name,
                points=points,
            )

            result.success = True
            result.items_written = len(points)
            result.written_ids = [item.item_id for item in items]

            logger.info(
                f"Wrote {len(points)} memory items to {collection_name}"
            )

        except Exception as e:
            result.items_failed = len(items)
            result.errors.append(f"Qdrant upsert failed: {e}")
            logger.error(f"Qdrant write failed: {e}")

        return result

    def _ensure_collection_exists(self, collection_name: str) -> bool:
        """Ensure the target collection exists in Qdrant."""
        try:
            collections = self._client.get_collections()
            if any(c.name == collection_name for c in collections.collections):
                return True

            # Create collection (basic config - should match persona collections)
            self._client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=1536,  # OpenAI embedding size
                    distance=Distance.COSINE,
                ),
            )
            logger.info(f"Created collection: {collection_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}")
            return False

    def _generate_dummy_vector(self) -> List[float]:
        """Generate a dummy vector for testing (should use real embeddings)."""
        import random
        return [random.uniform(-1, 1) for _ in range(1536)]

    # =========================================================================
    # CONVENIENCE METHODS
    # =========================================================================

    def write_summary(
        self,
        summary_result: SummaryResult,
        collection_name: str,
        session_id: str = None,
    ) -> WriteResult:
        """
        Write a session summary to Qdrant.

        Args:
            summary_result: SummaryResult from summarizer
            collection_name: Target collection
            session_id: Optional session ID

        Returns:
            WriteResult
        """
        if not summary_result.success:
            return WriteResult(
                success=False,
                errors=["Cannot write failed summary"]
            )

        item = MemoryItem(
            item_type=MemoryItemType.SESSION_SUMMARY.value,
            content=summary_result.summary,
            persona_name=summary_result.persona_name,
            collection=collection_name,
            source="session_summarizer",
            session_id=session_id or summary_result.session_id,
            tags=["summary", "session"] + summary_result.topics_covered,
        )

        return self.write_items([item], collection_name)

    def write_extracted_items(
        self,
        items: List[ExtractedItem],
        persona_name: str,
        collection_name: str,
        session_id: str = None,
    ) -> WriteResult:
        """
        Write extracted items to Qdrant.

        Args:
            items: List of ExtractedItem from extractors
            persona_name: Persona name
            collection_name: Target collection
            session_id: Optional session ID

        Returns:
            WriteResult
        """
        memory_items = []

        for extracted in items:
            item = MemoryItem(
                item_type=extracted.item_type.value,
                content=extracted.content,
                persona_name=persona_name,
                collection=collection_name,
                source="memory_extractor",
                session_id=session_id or "",
                context=extracted.context,
                tags=extracted.tags,
                reference=extracted.reference,
                decision_type=extracted.decision_type,
                preference_key=extracted.preference_key,
            )
            memory_items.append(item)

        return self.write_items(memory_items, collection_name)


# =============================================================================
# TRANSCRIPT BLOCKER
# =============================================================================

class TranscriptBlocker:
    """
    Explicitly blocks raw transcript storage.

    This class enforces the policy that raw transcripts are
    PROHIBITED by default. It must be explicitly bypassed
    with proper justification for audit/debug scenarios.
    """

    def __init__(self, config: WritebackConfig = None):
        """Initialize the blocker."""
        self.config = config or get_writeback_config()

    def is_transcript_allowed(self, justification: str = None) -> tuple:
        """
        Check if transcript storage is allowed.

        Args:
            justification: Reason for storing transcript

        Returns:
            Tuple of (allowed: bool, reason: str)
        """
        from .config import TranscriptPolicy

        policy = self.config.transcript_policy

        if policy == TranscriptPolicy.PROHIBITED:
            return (
                False,
                "Raw transcript storage is PROHIBITED by policy. "
                "Use session summaries instead."
            )

        if policy == TranscriptPolicy.AUDIT_ONLY:
            if justification and "audit" in justification.lower():
                return (True, "Allowed for audit compliance")
            return (
                False,
                "Transcripts allowed only for audit compliance. "
                "Provide audit justification."
            )

        if policy == TranscriptPolicy.DEBUG_ONLY:
            if justification and "debug" in justification.lower():
                return (True, "Allowed for debugging")
            return (
                False,
                "Transcripts allowed only for debugging. "
                "Provide debug justification."
            )

        if policy == TranscriptPolicy.EXPLICIT_REQUEST:
            if justification:
                return (True, f"Allowed with justification: {justification}")
            return (
                False,
                "Transcripts require explicit justification."
            )

        return (False, "Unknown transcript policy")

    def block_transcript_write(self, transcript: str) -> None:
        """
        Raise an error if transcript storage is attempted.

        Args:
            transcript: The transcript that was attempted to be stored

        Raises:
            WriteAttemptError: Always (transcripts blocked by default)
        """
        allowed, reason = self.is_transcript_allowed()

        if not allowed:
            logger.warning(f"Transcript storage blocked: {reason}")
            raise WriteAttemptError(
                phase=ExecutionPhase.WRITEBACK if hasattr(ExecutionPhase, 'WRITEBACK') else None,
                target_type="raw_transcript",
                message=reason
            )
