# =============================================================================
# MEMORY WRITEBACK ORCHESTRATOR
# =============================================================================
"""
Orchestrates the complete memory writeback process.

This module coordinates all components of the memory writeback pipeline:
1. Generate session summary (100-250 tokens)
2. Extract key decisions
3. Extract durable user preferences
4. Extract scripture references
5. Apply FORMAL MEMORY POLICY (durability, confidence, scope)
6. Write all items to Qdrant with proper metadata

CRITICAL INVARIANTS:
1. Session summary is REQUIRED for all writebacks
2. Raw transcripts are NEVER stored by default
3. All items have proper metadata
4. Token budgets are enforced
5. All operations are logged for audit
6. FORMAL MEMORY POLICY enforced: only durable, high-signal content persisted
7. All items MUST have confidence level and scope designation
"""

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from .config import (
        WritebackConfig,
        get_writeback_config,
        MemoryItemType,
        TranscriptPolicy,
    )
    from .summarizer import SessionSummarizer, SummaryResult
    from .extractors import (
        CombinedExtractor,
        ExtractedItem,
        ExtractionResult,
    )
    from .writer import (
        MemoryWriter,
        WriteResult,
        MemoryItem,
        TranscriptBlocker,
    )
    from .memory_policy import (
        MemoryPolicyEnforcer,
        get_memory_policy_enforcer,
        PolicyEvaluation,
        ConfidenceLevel,
        MemoryScope,
    )
except ImportError:
    from config import (
        WritebackConfig,
        get_writeback_config,
        MemoryItemType,
        TranscriptPolicy,
    )
    from summarizer import SessionSummarizer, SummaryResult
    from extractors import (
        CombinedExtractor,
        ExtractedItem,
        ExtractionResult,
    )
    from writer import (
        MemoryWriter,
        WriteResult,
        MemoryItem,
        TranscriptBlocker,
    )
    from memory_policy import (
        MemoryPolicyEnforcer,
        get_memory_policy_enforcer,
        PolicyEvaluation,
        ConfidenceLevel,
        MemoryScope,
    )

logger = logging.getLogger(__name__)


@dataclass
class WritebackResult:
    """
    Complete result of a memory writeback operation.

    This captures the results of all writeback steps:
    summarization, extraction, policy evaluation, and writing.
    """
    success: bool = False

    # Session info
    persona_name: str = ""
    session_id: str = ""
    collection: str = ""

    # Summary results
    summary_generated: bool = False
    summary_token_count: int = 0
    summary_hash: str = ""

    # Extraction results
    decisions_extracted: int = 0
    preferences_extracted: int = 0
    scripture_extracted: int = 0
    total_items_extracted: int = 0

    # FORMAL MEMORY POLICY RESULTS
    items_policy_approved: int = 0
    items_policy_rejected: int = 0
    policy_rejection_reasons: List[str] = field(default_factory=list)

    # Write results
    items_written: int = 0
    items_blocked: int = 0
    items_failed: int = 0
    total_tokens_written: int = 0

    # Timing
    started_at: str = ""
    completed_at: str = ""
    duration_ms: float = 0.0

    # Errors and warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Audit trail
    written_item_ids: List[str] = field(default_factory=list)
    blocked_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/storage."""
        return {
            "success": self.success,
            "persona_name": self.persona_name,
            "session_id": self.session_id,
            "collection": self.collection,
            "summary": {
                "generated": self.summary_generated,
                "token_count": self.summary_token_count,
                "hash": self.summary_hash,
            },
            "extraction": {
                "decisions": self.decisions_extracted,
                "preferences": self.preferences_extracted,
                "scripture": self.scripture_extracted,
                "total": self.total_items_extracted,
            },
            "policy": {
                "approved": self.items_policy_approved,
                "rejected": self.items_policy_rejected,
                "rejection_reasons": self.policy_rejection_reasons,
            },
            "writing": {
                "written": self.items_written,
                "blocked": self.items_blocked,
                "failed": self.items_failed,
                "total_tokens": self.total_tokens_written,
            },
            "timing": {
                "started_at": self.started_at,
                "completed_at": self.completed_at,
                "duration_ms": self.duration_ms,
            },
            "errors": self.errors,
            "warnings": self.warnings,
            "audit": {
                "written_ids": self.written_item_ids,
                "blocked_reasons": self.blocked_reasons,
            },
        }


@dataclass
class WritebackSession:
    """
    Tracks state for a writeback session.

    This is used internally by the orchestrator to manage
    the writeback process.
    """
    session_id: str = ""
    persona_name: str = ""
    collection: str = ""

    # Conversation data
    conversation: List[Dict[str, str]] = field(default_factory=list)
    context_hints: Dict[str, Any] = field(default_factory=dict)

    # Generated items
    summary: Optional[SummaryResult] = None
    extracted_items: List[ExtractedItem] = field(default_factory=list)
    memory_items: List[MemoryItem] = field(default_factory=list)

    # State
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class WritebackOrchestrator:
    """
    Orchestrates the complete memory writeback process.

    This is the main entry point for memory writeback operations.
    It coordinates summarization, extraction, and writing while
    enforcing all policies.

    CRITICAL: This orchestrator applies the FORMAL MEMORY POLICY
    consistently across all personas and all memory writeback operations.

    USAGE:
        orchestrator = WritebackOrchestrator()
        result = orchestrator.process_session(
            conversation=messages,
            persona_name="jubilee",
            collection_name="jubilee",
        )
    """

    def __init__(self, config: WritebackConfig = None):
        """
        Initialize the orchestrator.

        Args:
            config: Writeback configuration (uses global if not provided)
        """
        self.config = config or get_writeback_config()

        # Initialize components
        self.summarizer = SessionSummarizer(self.config)
        self.extractor = CombinedExtractor(self.config)
        self.writer = MemoryWriter(self.config)
        self.transcript_blocker = TranscriptBlocker(self.config)

        # Initialize FORMAL MEMORY POLICY enforcer
        self.memory_policy_enforcer = get_memory_policy_enforcer()

    def process_session(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        collection_name: str,
        session_id: str = None,
        context_hints: Dict[str, Any] = None,
        authorization_method: str = "session_end_commit",
    ) -> WritebackResult:
        """
        Process a complete session for memory writeback.

        This is the main entry point. It:
        1. Generates a session summary (100-250 tokens)
        2. Extracts key decisions, preferences, and scripture
        3. Writes all items to Qdrant with metadata
        4. Blocks any raw transcript storage attempts

        Args:
            conversation: List of messages with 'role' and 'content'
            persona_name: Name of the persona
            collection_name: Target Qdrant collection
            session_id: Optional session identifier
            context_hints: Optional hints for summarization
            authorization_method: Method for write authorization

        Returns:
            WritebackResult with complete operation details
        """
        # Initialize result
        result = WritebackResult(
            persona_name=persona_name,
            collection=collection_name,
            started_at=datetime.now().isoformat(),
        )

        # Generate session ID if not provided
        session_id = session_id or self._generate_session_id(persona_name)
        result.session_id = session_id

        try:
            # Create writeback session
            session = WritebackSession(
                session_id=session_id,
                persona_name=persona_name,
                collection=collection_name,
                conversation=conversation,
                context_hints=context_hints or {},
                started_at=datetime.now(),
            )

            # Step 1: Generate session summary (REQUIRED)
            logger.info(f"Generating session summary for {persona_name}...")
            summary_result = self._generate_summary(session)

            if not summary_result.success:
                if self.config.require_session_summary:
                    result.errors.append(
                        "Session summary generation failed (required)"
                    )
                    result.errors.extend(summary_result.errors)
                    return self._finalize_result(result, session)
                else:
                    result.warnings.append(
                        "Session summary generation failed (optional)"
                    )

            result.summary_generated = summary_result.success
            result.summary_token_count = summary_result.token_count
            result.summary_hash = summary_result.content_hash
            session.summary = summary_result

            # Step 2: Extract memory items
            logger.info(f"Extracting memory items for {persona_name}...")
            extraction_result = self._extract_items(session)

            result.decisions_extracted = extraction_result.decisions_found
            result.preferences_extracted = extraction_result.preferences_found
            result.scripture_extracted = extraction_result.scripture_found
            result.total_items_extracted = extraction_result.total_found
            session.extracted_items = extraction_result.items

            # Step 3: Build memory items for storage (with POLICY EVALUATION)
            logger.info(f"Building memory items for {persona_name} (applying formal memory policy)...")
            memory_items = self._build_memory_items(session, result)
            session.memory_items = memory_items

            logger.info(
                f"Policy evaluation: {result.items_policy_approved} approved, "
                f"{result.items_policy_rejected} rejected"
            )

            # Step 4: Check session limits
            total_tokens = sum(item.token_count for item in memory_items)
            if total_tokens > self.config.max_tokens_per_session:
                result.warnings.append(
                    f"Session token count ({total_tokens}) exceeds limit "
                    f"({self.config.max_tokens_per_session})"
                )
                # Trim items to fit
                memory_items = self._trim_to_limit(memory_items)

            if len(memory_items) > self.config.max_items_per_session:
                result.warnings.append(
                    f"Session item count ({len(memory_items)}) exceeds limit "
                    f"({self.config.max_items_per_session})"
                )
                memory_items = memory_items[:self.config.max_items_per_session]

            # Step 5: Write to Qdrant
            logger.info(f"Writing {len(memory_items)} items for {persona_name}...")
            write_result = self.writer.write_items(
                items=memory_items,
                collection_name=collection_name,
                authorization_method=authorization_method,
            )

            result.items_written = write_result.items_written
            result.items_blocked = write_result.items_blocked
            result.items_failed = write_result.items_failed
            result.total_tokens_written = write_result.total_tokens
            result.written_item_ids = write_result.written_ids
            result.blocked_reasons = write_result.blocked_reasons
            result.errors.extend(write_result.errors)
            result.warnings.extend(write_result.warnings)

            result.success = write_result.success

            logger.info(
                f"Writeback complete for {persona_name}: "
                f"{result.items_written} written, "
                f"{result.items_blocked} blocked, "
                f"{result.total_tokens_written} tokens"
            )

        except Exception as e:
            logger.error(f"Writeback failed: {e}")
            result.errors.append(str(e))
            result.success = False

        return self._finalize_result(result, session)

    def _generate_summary(self, session: WritebackSession) -> SummaryResult:
        """Generate session summary."""
        return self.summarizer.summarize(
            conversation=session.conversation,
            persona_name=session.persona_name,
            session_id=session.session_id,
            context_hints=session.context_hints,
        )

    def _extract_items(self, session: WritebackSession) -> ExtractionResult:
        """Extract memory items from conversation."""
        return self.extractor.extract_with_result(
            conversation=session.conversation,
            persona_name=session.persona_name,
        )

    def _build_memory_items(
        self,
        session: WritebackSession,
        result: WritebackResult = None,
    ) -> List[MemoryItem]:
        """
        Build MemoryItem objects from summary and extracted items.

        CRITICAL: This method applies the FORMAL MEMORY POLICY to all
        extracted items, filtering out transient content and enriching
        approved items with confidence level and scope designation.
        """
        items = []

        # Add session summary as a memory item (always approved)
        # Session summaries bypass policy as they are required
        if session.summary and session.summary.success:
            summary_item = MemoryItem(
                item_type=MemoryItemType.SESSION_SUMMARY.value,
                content=session.summary.summary,
                persona_name=session.persona_name,
                collection=session.collection,
                source="session_summarizer",
                session_id=session.session_id,
                tags=["summary", "session"] + session.summary.topics_covered,
                # Session summaries are high confidence and private by default
                confidence_level=ConfidenceLevel.HIGH_CONFIDENCE.value,
                scope=MemoryScope.PRIVATE.value,
                durability_score=1.0,
                signal_strength=1.0,
                policy_justification="Session summary (required, bypasses policy)",
            )
            items.append(summary_item)
            if result:
                result.items_policy_approved += 1

        # Add extracted items WITH POLICY EVALUATION
        for extracted in session.extracted_items:
            # Evaluate against formal memory policy
            evaluation = self.memory_policy_enforcer.evaluate(
                content=extracted.content,
                item_type=extracted.item_type.value,
                context={"session_id": session.session_id} if session.session_id else {},
            )

            if not evaluation.should_persist:
                # Item rejected by policy
                logger.info(
                    f"POLICY REJECTION: {extracted.item_type.value} - "
                    f"{evaluation.rejection_reason}"
                )
                if result:
                    result.items_policy_rejected += 1
                    result.policy_rejection_reasons.append(
                        f"{extracted.item_type.value}: {evaluation.rejection_reason}"
                    )
                continue

            # Item approved - build with policy metadata
            item = MemoryItem(
                item_type=extracted.item_type.value,
                content=extracted.content,
                persona_name=session.persona_name,
                collection=session.collection,
                source="memory_extractor",
                session_id=session.session_id,
                context=extracted.context,
                tags=extracted.tags,
                reference=extracted.reference,
                decision_type=extracted.decision_type,
                preference_key=extracted.preference_key,
                # FORMAL MEMORY POLICY METADATA (REQUIRED)
                confidence_level=evaluation.confidence.value if evaluation.confidence else "",
                scope=evaluation.scope.value if evaluation.scope else "",
                durability_score=evaluation.durability_score,
                signal_strength=evaluation.signal_strength,
                policy_justification=evaluation.justification,
            )
            items.append(item)
            if result:
                result.items_policy_approved += 1

        # Deduplicate if configured
        if self.config.deduplicate_items:
            items = self._deduplicate_items(items)

        return items

    def _deduplicate_items(self, items: List[MemoryItem]) -> List[MemoryItem]:
        """Remove duplicate items based on content hash."""
        seen = set()
        unique = []

        for item in items:
            if item.content_hash not in seen:
                seen.add(item.content_hash)
                unique.append(item)

        if len(unique) < len(items):
            logger.info(
                f"Deduplicated {len(items) - len(unique)} items"
            )

        return unique

    def _trim_to_limit(self, items: List[MemoryItem]) -> List[MemoryItem]:
        """Trim items to fit within token limit."""
        max_tokens = self.config.max_tokens_per_session

        # Sort by priority: summary first, then by type
        priority = {
            MemoryItemType.SESSION_SUMMARY.value: 0,
            MemoryItemType.KEY_DECISION.value: 1,
            MemoryItemType.SCRIPTURE_REFERENCE.value: 2,
            MemoryItemType.USER_PREFERENCE.value: 3,
        }

        items.sort(key=lambda x: priority.get(x.item_type, 10))

        # Keep items until we hit the limit
        kept = []
        total_tokens = 0

        for item in items:
            if total_tokens + item.token_count <= max_tokens:
                kept.append(item)
                total_tokens += item.token_count
            else:
                break

        return kept

    def _finalize_result(
        self,
        result: WritebackResult,
        session: WritebackSession,
    ) -> WritebackResult:
        """Finalize the writeback result."""
        result.completed_at = datetime.now().isoformat()

        if session.started_at:
            start = session.started_at
            end = datetime.now()
            result.duration_ms = (end - start).total_seconds() * 1000

        return result

    def _generate_session_id(self, persona_name: str) -> str:
        """Generate a unique session ID."""
        timestamp = datetime.now().isoformat()
        data = f"{persona_name}:{timestamp}"
        return hashlib.sha256(data.encode('utf-8')).hexdigest()[:12]

    # =========================================================================
    # TRANSCRIPT BLOCKING
    # =========================================================================

    def attempt_transcript_storage(
        self,
        transcript: str,
        collection_name: str,
        justification: str = None,
    ) -> WriteResult:
        """
        Attempt to store a raw transcript (BLOCKED BY DEFAULT).

        This method exists to explicitly handle transcript storage
        requests and enforce the prohibition policy.

        Args:
            transcript: The raw transcript to store
            collection_name: Target collection
            justification: Reason for storing (required for override)

        Returns:
            WriteResult (always fails unless policy explicitly allows)
        """
        result = WriteResult(success=False)

        allowed, reason = self.transcript_blocker.is_transcript_allowed(justification)

        if not allowed:
            result.errors.append(reason)
            result.blocked_reasons.append(
                f"RAW_TRANSCRIPT: {reason}"
            )
            result.items_blocked = 1
            logger.warning(f"Transcript storage blocked: {reason}")
            return result

        # If explicitly allowed (audit/debug), proceed with caution
        logger.warning(
            f"Transcript storage ALLOWED with justification: {justification}"
        )

        item = MemoryItem(
            item_type=MemoryItemType.RAW_TRANSCRIPT.value,
            content=transcript,
            source="explicit_transcript_storage",
            tags=["transcript", "raw", "explicit"],
            context=f"Stored with justification: {justification}",
        )

        return self.writer.write_items([item], collection_name)

    # =========================================================================
    # CONVENIENCE METHODS
    # =========================================================================

    def process_and_summarize_only(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        context_hints: Dict[str, Any] = None,
    ) -> SummaryResult:
        """
        Generate a summary without writing to Qdrant.

        Useful for previewing summaries before committing.

        Args:
            conversation: List of messages
            persona_name: Persona name
            context_hints: Optional hints

        Returns:
            SummaryResult
        """
        return self.summarizer.summarize(
            conversation=conversation,
            persona_name=persona_name,
            context_hints=context_hints,
        )

    def cleanup(self):
        """Cleanup resources."""
        self.writer.disconnect()
