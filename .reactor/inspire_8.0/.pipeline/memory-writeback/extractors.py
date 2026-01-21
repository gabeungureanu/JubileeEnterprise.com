# =============================================================================
# MEMORY ITEM EXTRACTORS
# =============================================================================
"""
Extracts structured memory items from conversations.

This module provides extractors for:
1. Key decisions made during conversation
2. Durable user preferences (not session-specific)
3. Scripture references cited or discussed

Each extractor produces structured items with proper metadata
for storage in Qdrant.

EXTRACTION PRINCIPLES:
- Extract only what's meaningful and durable
- Ignore transient or session-specific information
- Maintain proper attribution and context
- Enforce token limits on all items
"""

import hashlib
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from .config import WritebackConfig, get_writeback_config, MemoryItemType
except ImportError:
    from config import WritebackConfig, get_writeback_config, MemoryItemType

logger = logging.getLogger(__name__)


@dataclass
class ExtractedItem:
    """A single extracted memory item."""
    item_type: MemoryItemType
    content: str
    confidence: float = 0.0  # 0.0-1.0

    # Metadata
    source_message_index: int = -1
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    content_hash: str = ""

    # Optional context
    context: str = ""
    tags: List[str] = field(default_factory=list)

    # For scripture references
    reference: str = ""  # e.g., "John 3:16"
    translation: str = ""  # e.g., "JSV"

    # For decisions
    decision_type: str = ""  # e.g., "technical", "preference", "action"

    # For preferences
    preference_key: str = ""  # e.g., "communication_style"
    is_durable: bool = True  # Only store durable preferences

    def __post_init__(self):
        if not self.content_hash:
            self.content_hash = hashlib.sha256(
                self.content.encode('utf-8')
            ).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "item_type": self.item_type.value,
            "content": self.content,
            "confidence": self.confidence,
            "source_message_index": self.source_message_index,
            "created_at": self.created_at,
            "content_hash": self.content_hash,
            "context": self.context,
            "tags": self.tags,
            "reference": self.reference,
            "translation": self.translation,
            "decision_type": self.decision_type,
            "preference_key": self.preference_key,
            "is_durable": self.is_durable,
        }


@dataclass
class ExtractionResult:
    """Result of an extraction operation."""
    success: bool
    items: List[ExtractedItem] = field(default_factory=list)
    total_found: int = 0
    total_kept: int = 0

    # Statistics
    decisions_found: int = 0
    preferences_found: int = 0
    scripture_found: int = 0

    # Errors/warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "items": [i.to_dict() for i in self.items],
            "total_found": self.total_found,
            "total_kept": self.total_kept,
            "decisions_found": self.decisions_found,
            "preferences_found": self.preferences_found,
            "scripture_found": self.scripture_found,
            "errors": self.errors,
            "warnings": self.warnings,
        }


# =============================================================================
# BASE EXTRACTOR
# =============================================================================

class MemoryExtractor(ABC):
    """Base class for memory item extractors."""

    def __init__(self, config: WritebackConfig = None):
        """Initialize the extractor."""
        self.config = config or get_writeback_config()

    @abstractmethod
    def extract(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        **kwargs,
    ) -> List[ExtractedItem]:
        """
        Extract memory items from conversation.

        Args:
            conversation: List of message dicts with 'role' and 'content'
            persona_name: Name of the persona
            **kwargs: Additional extraction parameters

        Returns:
            List of extracted items
        """
        pass

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count."""
        return len(text) // 4

    def _truncate_to_limit(self, text: str, max_tokens: int) -> str:
        """Truncate text to token limit."""
        estimated = self._estimate_tokens(text)
        if estimated <= max_tokens:
            return text

        # Truncate by characters (4 chars per token estimate)
        max_chars = max_tokens * 4
        if len(text) <= max_chars:
            return text

        return text[:max_chars - 3] + "..."


# =============================================================================
# DECISION EXTRACTOR
# =============================================================================

class DecisionExtractor(MemoryExtractor):
    """
    Extracts key decisions made during conversation.

    Looks for:
    - Explicit decision statements ("we decided", "the decision is")
    - Choice selections ("I'll go with", "let's use")
    - Commitments ("I will", "we should")
    - Technical decisions ("using X", "implementing Y")
    """

    # Decision patterns with type classification
    DECISION_PATTERNS = [
        # Explicit decisions
        (r'(?:we |I )(?:have )?decided (?:to |that )(.+?)(?:\.|$)', 'explicit', 0.9),
        (r'(?:the |my )decision is (?:to )?(.+?)(?:\.|$)', 'explicit', 0.9),
        (r'(?:I\'ve |we\'ve )decided (?:to |on )(.+?)(?:\.|$)', 'explicit', 0.9),

        # Choices
        (r'(?:I\'ll |let\'s |we\'ll )(?:go with|use|choose) (.+?)(?:\.|$)', 'choice', 0.8),
        (r'(?:choosing|selected|picked) (.+?) (?:for|as|to)', 'choice', 0.7),

        # Technical decisions
        (r'(?:using|implementing|deploying|adopting) (.+?) (?:for|to|as)', 'technical', 0.7),
        (r'(?:the |our )(?:approach|solution|strategy) (?:is|will be) (.+?)(?:\.|$)', 'technical', 0.8),

        # Commitments
        (r'(?:I will|we will|I\'ll|we\'ll) (.+?)(?:\.|$)', 'commitment', 0.6),
        (r'(?:going to|plan to) (.+?)(?:\.|$)', 'commitment', 0.6),
    ]

    def extract(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        **kwargs,
    ) -> List[ExtractedItem]:
        """Extract key decisions from conversation."""
        items = []
        max_tokens = self.config.token_limits.key_decision_max

        for idx, message in enumerate(conversation):
            content = message.get("content", "")
            role = message.get("role", "")

            # Focus on assistant messages for decisions
            if role != "assistant":
                continue

            for pattern, decision_type, base_confidence in self.DECISION_PATTERNS:
                matches = re.findall(pattern, content, re.IGNORECASE)

                for match in matches:
                    # Clean and validate the match
                    decision_text = self._clean_decision(match)
                    if not decision_text or len(decision_text) < 10:
                        continue

                    # Truncate to limit
                    decision_text = self._truncate_to_limit(decision_text, max_tokens)

                    # Create item
                    item = ExtractedItem(
                        item_type=MemoryItemType.KEY_DECISION,
                        content=decision_text,
                        confidence=base_confidence,
                        source_message_index=idx,
                        decision_type=decision_type,
                        context=f"Decision from {persona_name} conversation",
                        tags=[decision_type, "decision"],
                    )

                    items.append(item)

        # Deduplicate by content hash
        seen = set()
        unique_items = []
        for item in items:
            if item.content_hash not in seen:
                seen.add(item.content_hash)
                unique_items.append(item)

        # Sort by confidence
        unique_items.sort(key=lambda x: x.confidence, reverse=True)

        # Limit to top decisions
        return unique_items[:5]

    def _clean_decision(self, text: str) -> str:
        """Clean extracted decision text."""
        # Remove leading/trailing whitespace
        text = text.strip()

        # Remove common filler words at start
        filler_start = r'^(?:that |to |on |the |a |an )'
        text = re.sub(filler_start, '', text, flags=re.IGNORECASE)

        # Capitalize first letter
        if text:
            text = text[0].upper() + text[1:]

        return text


# =============================================================================
# PREFERENCE EXTRACTOR
# =============================================================================

class PreferenceExtractor(MemoryExtractor):
    """
    Extracts durable user preferences from conversation.

    Only extracts preferences that are:
    - Durable (not session-specific)
    - Meaningful (affect future interactions)
    - Explicitly stated or clearly implied

    SKIPS:
    - Transient preferences ("just this time")
    - Session-specific settings
    - Temporary choices
    """

    # Preference patterns with key classification
    PREFERENCE_PATTERNS = [
        # Communication preferences
        (r'(?:I |please )(?:prefer|like|want) (?:you to |to )(.+?)(?:\.|$)', 'communication', 0.8),
        (r'(?:call me|address me as|my name is) (.+?)(?:\.|$)', 'identity', 0.9),

        # Style preferences
        (r'(?:I |please )(?:prefer|like) (?:a )?(.+?) (?:style|tone|approach)', 'style', 0.7),
        (r'(?:keep it|be more|be less) (.+?)(?:\.|$)', 'style', 0.6),

        # Topic preferences
        (r'(?:I\'m interested in|I care about|focus on) (.+?)(?:\.|$)', 'interest', 0.7),
        (r'(?:don\'t |never )(?:mention|talk about|discuss) (.+?)(?:\.|$)', 'avoidance', 0.8),

        # Format preferences
        (r'(?:I prefer|I like) (?:responses |answers )?(?:in |as )(.+?)(?:\.|$)', 'format', 0.7),
    ]

    # Transient indicators (skip these)
    TRANSIENT_INDICATORS = [
        r'(?:just |only )?(?:this time|for now|right now|today)',
        r'(?:temporarily|for this session|until)',
    ]

    def extract(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        **kwargs,
    ) -> List[ExtractedItem]:
        """Extract durable user preferences from conversation."""
        items = []
        max_tokens = self.config.token_limits.user_preference_max

        # Only extract durable preferences if configured
        if not self.config.preferences_durable_only:
            logger.info("Durable-only preferences disabled, extracting all")

        for idx, message in enumerate(conversation):
            content = message.get("content", "")
            role = message.get("role", "")

            # Focus on user messages for preferences
            if role != "user":
                continue

            # Skip if transient indicators present
            if self._is_transient(content):
                continue

            for pattern, pref_key, base_confidence in self.PREFERENCE_PATTERNS:
                matches = re.findall(pattern, content, re.IGNORECASE)

                for match in matches:
                    # Clean and validate
                    pref_text = self._clean_preference(match)
                    if not pref_text or len(pref_text) < 3:
                        continue

                    # Truncate to limit
                    pref_text = self._truncate_to_limit(pref_text, max_tokens)

                    # Create item
                    item = ExtractedItem(
                        item_type=MemoryItemType.USER_PREFERENCE,
                        content=pref_text,
                        confidence=base_confidence,
                        source_message_index=idx,
                        preference_key=pref_key,
                        is_durable=True,
                        context=f"User preference expressed to {persona_name}",
                        tags=[pref_key, "preference", "durable"],
                    )

                    items.append(item)

        # Deduplicate
        seen = set()
        unique_items = []
        for item in items:
            if item.content_hash not in seen:
                seen.add(item.content_hash)
                unique_items.append(item)

        # Sort by confidence
        unique_items.sort(key=lambda x: x.confidence, reverse=True)

        return unique_items[:5]

    def _is_transient(self, text: str) -> bool:
        """Check if text contains transient indicators."""
        for pattern in self.TRANSIENT_INDICATORS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def _clean_preference(self, text: str) -> str:
        """Clean extracted preference text."""
        text = text.strip()

        # Remove common filler
        filler = r'^(?:that |to |you |me )'
        text = re.sub(filler, '', text, flags=re.IGNORECASE)

        if text:
            text = text[0].upper() + text[1:]

        return text


# =============================================================================
# SCRIPTURE EXTRACTOR
# =============================================================================

class ScriptureExtractor(MemoryExtractor):
    """
    Extracts Scripture references from conversation.

    Identifies:
    - Direct citations (John 3:16)
    - Book references (the book of John)
    - Verse ranges (Romans 8:28-30)
    - Paraphrased references
    """

    # Scripture reference patterns
    SCRIPTURE_PATTERNS = [
        # Standard format: Book Chapter:Verse
        (r'(\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d+):(\d+(?:-\d+)?)', 0.95),

        # Book Chapter:Verse with period separator
        (r'(\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d+)\.(\d+(?:-\d+)?)', 0.9),

        # Just chapter and verse in context
        (r'(?:verse|chapter)\s+(\d+):(\d+)', 0.7),
    ]

    # Known Bible books for validation
    BIBLE_BOOKS = {
        "genesis", "exodus", "leviticus", "numbers", "deuteronomy",
        "joshua", "judges", "ruth", "samuel", "kings", "chronicles",
        "ezra", "nehemiah", "esther", "job", "psalms", "psalm",
        "proverbs", "ecclesiastes", "song", "isaiah", "jeremiah",
        "lamentations", "ezekiel", "daniel", "hosea", "joel", "amos",
        "obadiah", "jonah", "micah", "nahum", "habakkuk", "zephaniah",
        "haggai", "zechariah", "malachi",
        "matthew", "mark", "luke", "john", "acts", "romans",
        "corinthians", "galatians", "ephesians", "philippians",
        "colossians", "thessalonians", "timothy", "titus", "philemon",
        "hebrews", "james", "peter", "jude", "revelation",
    }

    def extract(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        **kwargs,
    ) -> List[ExtractedItem]:
        """Extract Scripture references from conversation."""
        items = []
        max_tokens = self.config.token_limits.scripture_reference_max

        for idx, message in enumerate(conversation):
            content = message.get("content", "")

            # Try each pattern
            for pattern, base_confidence in self.SCRIPTURE_PATTERNS:
                matches = re.findall(pattern, content)

                for match in matches:
                    # Build reference string
                    if len(match) == 3:
                        book, chapter, verse = match
                        reference = f"{book} {chapter}:{verse}"
                    elif len(match) == 2:
                        chapter, verse = match
                        reference = f"Chapter {chapter}:{verse}"
                    else:
                        continue

                    # Validate book name if present
                    if len(match) == 3:
                        book_lower = match[0].lower().split()[-1]  # Handle "1 John" -> "john"
                        if book_lower not in self.BIBLE_BOOKS:
                            continue

                    # Extract surrounding context
                    context = self._extract_context(content, reference, max_words=20)

                    # Create item
                    item = ExtractedItem(
                        item_type=MemoryItemType.SCRIPTURE_REFERENCE,
                        content=context or f"Referenced {reference}",
                        confidence=base_confidence,
                        source_message_index=idx,
                        reference=reference,
                        translation="JSV",  # Default to Jubilee Standard Version
                        context=f"Scripture referenced in {persona_name} conversation",
                        tags=["scripture", "reference"],
                    )

                    # Truncate if needed
                    item.content = self._truncate_to_limit(item.content, max_tokens)

                    items.append(item)

        # Deduplicate by reference
        seen_refs = set()
        unique_items = []
        for item in items:
            if item.reference not in seen_refs:
                seen_refs.add(item.reference)
                unique_items.append(item)

        # Sort by confidence
        unique_items.sort(key=lambda x: x.confidence, reverse=True)

        return unique_items[:10]  # Allow more scripture references

    def _extract_context(self, text: str, reference: str, max_words: int = 20) -> str:
        """Extract context around a scripture reference."""
        # Find the reference in text
        ref_idx = text.lower().find(reference.lower())
        if ref_idx == -1:
            return ""

        # Get surrounding text
        start = max(0, ref_idx - 100)
        end = min(len(text), ref_idx + len(reference) + 100)
        context = text[start:end]

        # Clean up
        context = re.sub(r'\s+', ' ', context).strip()

        # Truncate to max words
        words = context.split()
        if len(words) > max_words:
            # Try to center on the reference
            ref_words = reference.split()
            for i, word in enumerate(words):
                if any(rw.lower() in word.lower() for rw in ref_words):
                    start_idx = max(0, i - max_words // 2)
                    words = words[start_idx:start_idx + max_words]
                    break
            else:
                words = words[:max_words]

        return " ".join(words)


# =============================================================================
# COMBINED EXTRACTOR
# =============================================================================

class CombinedExtractor(MemoryExtractor):
    """
    Combines all extractors for comprehensive memory extraction.
    """

    def __init__(self, config: WritebackConfig = None):
        """Initialize combined extractor."""
        super().__init__(config)
        self.decision_extractor = DecisionExtractor(config)
        self.preference_extractor = PreferenceExtractor(config)
        self.scripture_extractor = ScriptureExtractor(config)

    def extract(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        **kwargs,
    ) -> List[ExtractedItem]:
        """Extract all memory item types from conversation."""
        items = []

        # Extract decisions (if enabled)
        if self.config.extract_decisions:
            decisions = self.decision_extractor.extract(
                conversation, persona_name, **kwargs
            )
            items.extend(decisions)

        # Extract preferences (if enabled)
        if self.config.extract_preferences:
            preferences = self.preference_extractor.extract(
                conversation, persona_name, **kwargs
            )
            items.extend(preferences)

        # Extract scripture (if enabled)
        if self.config.extract_scripture:
            scripture = self.scripture_extractor.extract(
                conversation, persona_name, **kwargs
            )
            items.extend(scripture)

        return items

    def extract_with_result(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        **kwargs,
    ) -> ExtractionResult:
        """Extract all items and return detailed result."""
        result = ExtractionResult(success=False)

        try:
            # Extract each type
            decisions = []
            preferences = []
            scripture = []

            if self.config.extract_decisions:
                decisions = self.decision_extractor.extract(
                    conversation, persona_name, **kwargs
                )

            if self.config.extract_preferences:
                preferences = self.preference_extractor.extract(
                    conversation, persona_name, **kwargs
                )

            if self.config.extract_scripture:
                scripture = self.scripture_extractor.extract(
                    conversation, persona_name, **kwargs
                )

            # Combine
            all_items = decisions + preferences + scripture

            # Build result
            result.success = True
            result.items = all_items
            result.total_found = len(all_items)
            result.total_kept = len(all_items)
            result.decisions_found = len(decisions)
            result.preferences_found = len(preferences)
            result.scripture_found = len(scripture)

            logger.info(
                f"Extracted {len(all_items)} items: "
                f"{len(decisions)} decisions, "
                f"{len(preferences)} preferences, "
                f"{len(scripture)} scripture references"
            )

        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            result.errors.append(str(e))

        return result
