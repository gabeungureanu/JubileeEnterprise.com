# =============================================================================
# SESSION SUMMARIZER
# =============================================================================
"""
Generates concise session summaries for memory storage.

This module creates structured, token-efficient summaries that capture
the essential meaning and outcomes of conversations while staying within
the 100-250 token budget.

SUMMARY REQUIREMENTS:
1. Length: 100-250 tokens (enforced)
2. Content: Essential meaning and outcomes only
3. Structure: Organized for efficient retrieval
4. No raw data: Summarized, not copied
"""

import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from .config import WritebackConfig, get_writeback_config, MemoryItemType
except ImportError:
    from config import WritebackConfig, get_writeback_config, MemoryItemType

logger = logging.getLogger(__name__)


@dataclass
class SummaryResult:
    """Result of a summarization operation."""
    success: bool
    summary: str = ""
    token_count: int = 0
    within_limits: bool = False

    # Metadata
    persona_name: str = ""
    session_id: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Content hash for deduplication
    content_hash: str = ""

    # Quality indicators
    completeness_score: float = 0.0  # 0.0-1.0
    topics_covered: List[str] = field(default_factory=list)

    # Errors/warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "success": self.success,
            "summary": self.summary,
            "token_count": self.token_count,
            "within_limits": self.within_limits,
            "persona_name": self.persona_name,
            "session_id": self.session_id,
            "created_at": self.created_at,
            "content_hash": self.content_hash,
            "completeness_score": self.completeness_score,
            "topics_covered": self.topics_covered,
            "errors": self.errors,
            "warnings": self.warnings,
        }


class SessionSummarizer:
    """
    Generates concise, structured session summaries.

    The summarizer extracts essential information from conversation
    content and produces a summary within the 100-250 token budget.
    This is the core of the summarization-first memory policy.

    SUMMARY STRUCTURE:
    - Context: Brief session context (who, when, what topic)
    - Outcome: Key results or conclusions
    - Action items: Any follow-up actions identified
    - Notes: Important observations (if space permits)
    """

    # Summary template sections
    SECTION_CONTEXT = "Context"
    SECTION_OUTCOME = "Outcome"
    SECTION_ACTIONS = "Actions"
    SECTION_NOTES = "Notes"

    def __init__(self, config: WritebackConfig = None):
        """
        Initialize the summarizer.

        Args:
            config: Writeback configuration (uses global if not provided)
        """
        self.config = config or get_writeback_config()
        self.min_tokens = self.config.token_limits.session_summary_min
        self.max_tokens = self.config.token_limits.session_summary_max

    def summarize(
        self,
        conversation: List[Dict[str, str]],
        persona_name: str,
        session_id: str = None,
        context_hints: Dict[str, Any] = None,
    ) -> SummaryResult:
        """
        Generate a session summary from conversation content.

        Args:
            conversation: List of message dicts with 'role' and 'content'
            persona_name: Name of the persona involved
            session_id: Optional session identifier
            context_hints: Optional hints for summarization (topics, user, etc.)

        Returns:
            SummaryResult with the generated summary
        """
        result = SummaryResult(
            success=False,
            persona_name=persona_name,
            session_id=session_id or self._generate_session_id(),
        )

        if not conversation:
            result.errors.append("No conversation content to summarize")
            return result

        try:
            # Step 1: Extract key information
            extracted = self._extract_key_information(conversation, context_hints)

            # Step 2: Build structured summary
            summary = self._build_summary(
                context=extracted.get("context", ""),
                outcome=extracted.get("outcome", ""),
                actions=extracted.get("actions", []),
                notes=extracted.get("notes", ""),
                persona_name=persona_name,
            )

            # Step 3: Enforce token limits
            summary, token_count = self._enforce_token_limits(summary)

            # Step 4: Validate summary quality
            quality = self._assess_quality(summary, extracted)

            # Build result
            result.success = True
            result.summary = summary
            result.token_count = token_count
            result.within_limits = self.min_tokens <= token_count <= self.max_tokens
            result.content_hash = self._hash_content(summary)
            result.completeness_score = quality["completeness"]
            result.topics_covered = extracted.get("topics", [])

            if not result.within_limits:
                if token_count < self.min_tokens:
                    result.warnings.append(
                        f"Summary below minimum ({token_count} < {self.min_tokens} tokens)"
                    )
                else:
                    result.warnings.append(
                        f"Summary truncated to fit limit ({self.max_tokens} tokens)"
                    )

            logger.info(
                f"Generated summary for {persona_name}: "
                f"{token_count} tokens, quality={quality['completeness']:.2f}"
            )

        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            result.errors.append(str(e))

        return result

    def _extract_key_information(
        self,
        conversation: List[Dict[str, str]],
        context_hints: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Extract key information from conversation for summary.

        Args:
            conversation: List of messages
            context_hints: Optional hints

        Returns:
            Dict with extracted context, outcome, actions, notes, topics
        """
        context_hints = context_hints or {}

        # Analyze conversation
        user_messages = [m for m in conversation if m.get("role") == "user"]
        assistant_messages = [m for m in conversation if m.get("role") == "assistant"]

        # Extract topics from user messages
        topics = self._extract_topics(user_messages)

        # Determine conversation context
        context = self._determine_context(
            user_messages,
            context_hints.get("topic", ""),
            context_hints.get("user_name", ""),
        )

        # Extract outcome from assistant's final messages
        outcome = self._extract_outcome(assistant_messages)

        # Extract any action items
        actions = self._extract_actions(conversation)

        # Extract notable observations
        notes = self._extract_notes(conversation, context_hints)

        return {
            "context": context,
            "outcome": outcome,
            "actions": actions,
            "notes": notes,
            "topics": topics,
        }

    def _extract_topics(self, user_messages: List[Dict[str, str]]) -> List[str]:
        """Extract main topics from user messages."""
        topics = []

        # Keywords that indicate topics
        topic_patterns = [
            r'\b(?:about|regarding|concerning|discuss|help with|question about)\s+(\w+(?:\s+\w+)?)',
            r'\b(?:how to|how do I|can you)\s+(\w+(?:\s+\w+)?)',
        ]

        all_text = " ".join(m.get("content", "") for m in user_messages).lower()

        for pattern in topic_patterns:
            matches = re.findall(pattern, all_text)
            topics.extend(matches)

        # Deduplicate and limit
        seen = set()
        unique_topics = []
        for topic in topics:
            if topic not in seen:
                seen.add(topic)
                unique_topics.append(topic)
                if len(unique_topics) >= 5:
                    break

        return unique_topics

    def _determine_context(
        self,
        user_messages: List[Dict[str, str]],
        topic_hint: str,
        user_hint: str,
    ) -> str:
        """Determine the conversation context."""
        if not user_messages:
            return "No user interaction recorded"

        # Start with first user message topic
        first_message = user_messages[0].get("content", "")[:100]

        # Clean and summarize
        context_parts = []

        if user_hint:
            context_parts.append(f"Conversation with {user_hint}")

        if topic_hint:
            context_parts.append(f"regarding {topic_hint}")
        elif first_message:
            # Extract topic from first message
            topic = self._summarize_text(first_message, max_words=10)
            if topic:
                context_parts.append(f"regarding {topic}")

        context_parts.append(f"({len(user_messages)} exchanges)")

        return " ".join(context_parts) if context_parts else "General conversation"

    def _extract_outcome(self, assistant_messages: List[Dict[str, str]]) -> str:
        """Extract the conversation outcome from assistant messages."""
        if not assistant_messages:
            return "No response generated"

        # Focus on the last few messages for outcome
        recent_messages = assistant_messages[-3:]
        combined = " ".join(m.get("content", "") for m in recent_messages)

        # Look for conclusion indicators
        conclusion_patterns = [
            r'(?:in summary|to summarize|in conclusion|therefore|as a result)[,:]?\s*(.+?)(?:\.|$)',
            r'(?:the answer is|the solution is|you should)[,:]?\s*(.+?)(?:\.|$)',
            r'(?:I recommend|my recommendation is|the best approach)[,:]?\s*(.+?)(?:\.|$)',
        ]

        for pattern in conclusion_patterns:
            match = re.search(pattern, combined, re.IGNORECASE)
            if match:
                return self._summarize_text(match.group(1), max_words=30)

        # Fallback: summarize the last message
        if recent_messages:
            last_content = recent_messages[-1].get("content", "")
            return self._summarize_text(last_content, max_words=40)

        return "Conversation completed"

    def _extract_actions(self, conversation: List[Dict[str, str]]) -> List[str]:
        """Extract action items from conversation."""
        actions = []

        # Action indicators
        action_patterns = [
            r'(?:you should|please|I recommend|next step is to|action item:)\s*(.+?)(?:\.|$)',
            r'(?:TODO|TASK|ACTION):\s*(.+?)(?:\.|$)',
        ]

        all_text = " ".join(m.get("content", "") for m in conversation)

        for pattern in action_patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            for match in matches:
                action = self._summarize_text(match, max_words=15)
                if action and len(action) > 5:
                    actions.append(action)
                    if len(actions) >= 3:  # Limit to 3 actions
                        break
            if len(actions) >= 3:
                break

        return actions

    def _extract_notes(
        self,
        conversation: List[Dict[str, str]],
        context_hints: Dict[str, Any],
    ) -> str:
        """Extract notable observations or insights."""
        notes_parts = []

        # Add any provided context notes
        if context_hints.get("notes"):
            notes_parts.append(context_hints["notes"])

        # Look for important observations in conversation
        importance_patterns = [
            r'(?:importantly|note that|keep in mind|remember that)\s*(.+?)(?:\.|$)',
            r'(?:key point|main takeaway|essential)\s*(?:is|:)\s*(.+?)(?:\.|$)',
        ]

        all_text = " ".join(m.get("content", "") for m in conversation)

        for pattern in importance_patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            for match in matches:
                note = self._summarize_text(match, max_words=15)
                if note:
                    notes_parts.append(note)
                    if len(notes_parts) >= 2:
                        break
            if len(notes_parts) >= 2:
                break

        return "; ".join(notes_parts) if notes_parts else ""

    def _build_summary(
        self,
        context: str,
        outcome: str,
        actions: List[str],
        notes: str,
        persona_name: str,
    ) -> str:
        """
        Build the structured summary from extracted information.

        Args:
            context: Conversation context
            outcome: Key outcome/result
            actions: List of action items
            notes: Additional notes
            persona_name: Persona name for attribution

        Returns:
            Formatted summary string
        """
        lines = []

        # Header with persona
        lines.append(f"[{persona_name}] Session Summary")
        lines.append("")

        # Context section
        if context:
            lines.append(f"**{self.SECTION_CONTEXT}:** {context}")

        # Outcome section
        if outcome:
            lines.append(f"**{self.SECTION_OUTCOME}:** {outcome}")

        # Actions section (if any)
        if actions:
            lines.append(f"**{self.SECTION_ACTIONS}:**")
            for action in actions:
                lines.append(f"  - {action}")

        # Notes section (if any and space permits)
        if notes:
            lines.append(f"**{self.SECTION_NOTES}:** {notes}")

        return "\n".join(lines)

    def _enforce_token_limits(self, summary: str) -> tuple:
        """
        Enforce token limits on summary.

        Args:
            summary: The summary to check/truncate

        Returns:
            Tuple of (adjusted_summary, token_count)
        """
        token_count = self._estimate_tokens(summary)

        if token_count <= self.max_tokens:
            return summary, token_count

        # Need to truncate - remove sections in reverse priority
        lines = summary.split("\n")

        # Priority: Context > Outcome > Actions > Notes
        # Remove Notes first, then Actions, then truncate Outcome

        # Try removing Notes
        filtered = [l for l in lines if not l.startswith(f"**{self.SECTION_NOTES}")]
        test_summary = "\n".join(filtered)
        token_count = self._estimate_tokens(test_summary)

        if token_count <= self.max_tokens:
            return test_summary, token_count

        # Try removing Actions
        filtered = [l for l in filtered
                    if not l.startswith(f"**{self.SECTION_ACTIONS}")
                    and not l.strip().startswith("- ")]
        test_summary = "\n".join(filtered)
        token_count = self._estimate_tokens(test_summary)

        if token_count <= self.max_tokens:
            return test_summary, token_count

        # Truncate by words
        words = test_summary.split()
        max_words = int(self.max_tokens * 0.75)  # Conservative estimate
        truncated = " ".join(words[:max_words])

        if not truncated.endswith("..."):
            truncated += "..."

        return truncated, self._estimate_tokens(truncated)

    def _assess_quality(
        self,
        summary: str,
        extracted: Dict[str, Any],
    ) -> Dict[str, float]:
        """
        Assess the quality of the generated summary.

        Args:
            summary: The generated summary
            extracted: Original extracted information

        Returns:
            Dict with quality metrics
        """
        # Check completeness based on what was available vs included
        completeness_factors = []

        if extracted.get("context"):
            completeness_factors.append(
                1.0 if extracted["context"] in summary else 0.5
            )

        if extracted.get("outcome"):
            completeness_factors.append(
                1.0 if "Outcome" in summary else 0.5
            )

        if extracted.get("actions"):
            completeness_factors.append(
                1.0 if "Actions" in summary else 0.3
            )

        completeness = (
            sum(completeness_factors) / len(completeness_factors)
            if completeness_factors else 0.5
        )

        return {"completeness": completeness}

    def _summarize_text(self, text: str, max_words: int = 20) -> str:
        """Summarize text to max words."""
        if not text:
            return ""

        # Clean the text
        text = re.sub(r'\s+', ' ', text).strip()

        # Split into words
        words = text.split()

        if len(words) <= max_words:
            return text

        # Take first max_words
        return " ".join(words[:max_words])

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count (roughly 4 chars per token)."""
        return len(text) // 4

    def _hash_content(self, content: str) -> str:
        """Generate SHA-256 hash of content."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]

    def _generate_session_id(self) -> str:
        """Generate a unique session ID."""
        timestamp = datetime.now().isoformat()
        return hashlib.sha256(timestamp.encode('utf-8')).hexdigest()[:12]
