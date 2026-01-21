# =============================================================================
# CHUNKING UTILITIES - THREE-TIER STANDARD
# =============================================================================
"""
Implements the Inspire 8.0 three-tier chunking standard:
1. Scripture (Tier 1): Atomic per-verse retrieval
2. Teaching/Doctrine (Tier 2): Contextual sections
3. Notes/Memory (Tier 3): Surgical precision

All chunking follows the approved chunking-standards.yaml specification.
"""

import re
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    tiktoken = None


class ChunkingStrategy(Enum):
    """Available chunking strategies."""
    SCRIPTURE = "scripture"
    DOCTRINE = "doctrine"
    NOTES = "notes"
    ACTIVATION_ANCHOR = "activation_anchor"


@dataclass
class ChunkConfig:
    """Configuration for a chunking strategy."""
    min_tokens: int
    target_tokens: int
    max_tokens: int
    overlap_tokens: int = 0
    preserve_boundaries: bool = True


@dataclass
class Chunk:
    """A single chunk of content."""
    text: str
    token_count: int
    index: int
    metadata: Dict[str, Any]


# Default configurations per strategy
CHUNK_CONFIGS = {
    ChunkingStrategy.SCRIPTURE: ChunkConfig(
        min_tokens=10,
        target_tokens=50,
        max_tokens=150,
        overlap_tokens=0,
        preserve_boundaries=True,
    ),
    ChunkingStrategy.DOCTRINE: ChunkConfig(
        min_tokens=200,
        target_tokens=350,
        max_tokens=500,
        overlap_tokens=40,
        preserve_boundaries=True,
    ),
    ChunkingStrategy.NOTES: ChunkConfig(
        min_tokens=80,
        target_tokens=150,
        max_tokens=200,
        overlap_tokens=25,
        preserve_boundaries=True,
    ),
    ChunkingStrategy.ACTIVATION_ANCHOR: ChunkConfig(
        min_tokens=150,
        target_tokens=300,
        max_tokens=400,
        overlap_tokens=0,
        preserve_boundaries=True,  # Never split sections
    ),
}


class Chunker:
    """
    Content chunker following the three-tier standard.

    Uses tiktoken for accurate token counting when available,
    falls back to word-based estimation otherwise.
    """

    def __init__(self, model: str = "cl100k_base"):
        """
        Initialize the chunker.

        Args:
            model: Tiktoken model/encoding to use
        """
        self.encoding = None
        if TIKTOKEN_AVAILABLE:
            try:
                self.encoding = tiktoken.get_encoding(model)
            except Exception:
                pass

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text.

        Args:
            text: Text to count tokens for

        Returns:
            Token count
        """
        if self.encoding:
            return len(self.encoding.encode(text))
        # Fallback: rough estimate (1 token ≈ 4 chars for English)
        return len(text) // 4

    def chunk_scripture(
        self,
        verses: List[Dict[str, Any]],
        max_group_size: int = 5
    ) -> List[Chunk]:
        """
        Chunk scripture using per-verse atomic strategy.

        Args:
            verses: List of verse dicts with 'verse', 'text' keys
            max_group_size: Maximum verses to group (only for semantic continuity)

        Returns:
            List of Chunk objects
        """
        chunks = []
        config = CHUNK_CONFIGS[ChunkingStrategy.SCRIPTURE]

        for i, verse in enumerate(verses):
            text = verse.get('text', '')
            verse_num = verse.get('verse', i + 1)

            tokens = self.count_tokens(text)

            # Single verse chunk
            chunk = Chunk(
                text=text,
                token_count=tokens,
                index=i,
                metadata={
                    'verse': verse_num,
                    'strategy': 'per_verse',
                    **{k: v for k, v in verse.items() if k not in ['text']}
                }
            )
            chunks.append(chunk)

        return chunks

    def chunk_doctrine(
        self,
        text: str,
        headings: Optional[List[Tuple[int, str]]] = None
    ) -> List[Chunk]:
        """
        Chunk teaching/doctrine content using contextual sections.

        Args:
            text: Full text content
            headings: Optional list of (position, heading_text) tuples

        Returns:
            List of Chunk objects
        """
        config = CHUNK_CONFIGS[ChunkingStrategy.DOCTRINE]
        chunks = []

        # If headings provided, chunk by sections
        if headings:
            chunks = self._chunk_by_headings(text, headings, config)
        else:
            # Chunk by paragraphs/sentences
            chunks = self._chunk_by_paragraphs(text, config)

        return chunks

    def chunk_notes(self, text: str) -> List[Chunk]:
        """
        Chunk notes/memory content using surgical precision.

        Args:
            text: Note content

        Returns:
            List of Chunk objects
        """
        config = CHUNK_CONFIGS[ChunkingStrategy.NOTES]
        return self._chunk_by_sentences(text, config)

    def chunk_activation_anchor(
        self,
        sections: Dict[str, str]
    ) -> List[Chunk]:
        """
        Chunk activation anchor by complete sections.

        Args:
            sections: Dict mapping section name to content

        Returns:
            List of Chunk objects (one per section)
        """
        chunks = []
        config = CHUNK_CONFIGS[ChunkingStrategy.ACTIVATION_ANCHOR]

        for i, (section_name, content) in enumerate(sections.items()):
            tokens = self.count_tokens(content)

            # Anchors are never split - one chunk per section
            chunk = Chunk(
                text=content,
                token_count=tokens,
                index=i,
                metadata={
                    'section': section_name,
                    'strategy': 'complete_section',
                    'exceeds_target': tokens > config.max_tokens,
                }
            )
            chunks.append(chunk)

        return chunks

    def _chunk_by_headings(
        self,
        text: str,
        headings: List[Tuple[int, str]],
        config: ChunkConfig
    ) -> List[Chunk]:
        """Chunk text by heading boundaries."""
        chunks = []

        # Sort headings by position
        headings = sorted(headings, key=lambda x: x[0])

        for i, (pos, heading) in enumerate(headings):
            # Get section end
            if i < len(headings) - 1:
                end_pos = headings[i + 1][0]
            else:
                end_pos = len(text)

            section_text = text[pos:end_pos].strip()
            tokens = self.count_tokens(section_text)

            if tokens <= config.max_tokens:
                # Section fits in one chunk
                chunks.append(Chunk(
                    text=section_text,
                    token_count=tokens,
                    index=len(chunks),
                    metadata={'heading': heading, 'strategy': 'heading_section'}
                ))
            else:
                # Need to sub-chunk the section
                sub_chunks = self._chunk_by_paragraphs(section_text, config)
                for sc in sub_chunks:
                    sc.metadata['heading'] = heading
                chunks.extend(sub_chunks)

        return chunks

    def _chunk_by_paragraphs(
        self,
        text: str,
        config: ChunkConfig
    ) -> List[Chunk]:
        """Chunk text by paragraph boundaries."""
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        current_text = ""
        current_tokens = 0

        for para in paragraphs:
            para_tokens = self.count_tokens(para)

            # Check if adding this paragraph exceeds max
            if current_tokens + para_tokens > config.max_tokens and current_text:
                # Save current chunk
                chunks.append(Chunk(
                    text=current_text.strip(),
                    token_count=current_tokens,
                    index=len(chunks),
                    metadata={'strategy': 'paragraph'}
                ))
                # Start new chunk with overlap
                if config.overlap_tokens > 0:
                    overlap_text = self._get_overlap_text(
                        current_text, config.overlap_tokens
                    )
                    current_text = overlap_text + "\n\n" + para
                    current_tokens = self.count_tokens(current_text)
                else:
                    current_text = para
                    current_tokens = para_tokens
            else:
                # Add to current chunk
                if current_text:
                    current_text += "\n\n" + para
                else:
                    current_text = para
                current_tokens += para_tokens

        # Don't forget the last chunk
        if current_text:
            chunks.append(Chunk(
                text=current_text.strip(),
                token_count=current_tokens,
                index=len(chunks),
                metadata={'strategy': 'paragraph'}
            ))

        return chunks

    def _chunk_by_sentences(
        self,
        text: str,
        config: ChunkConfig
    ) -> List[Chunk]:
        """Chunk text by sentence boundaries."""
        # Simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_text = ""
        current_tokens = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            sent_tokens = self.count_tokens(sentence)

            if current_tokens + sent_tokens > config.max_tokens and current_text:
                # Save current chunk
                chunks.append(Chunk(
                    text=current_text.strip(),
                    token_count=current_tokens,
                    index=len(chunks),
                    metadata={'strategy': 'sentence'}
                ))
                # Start new chunk
                current_text = sentence
                current_tokens = sent_tokens
            else:
                if current_text:
                    current_text += " " + sentence
                else:
                    current_text = sentence
                current_tokens += sent_tokens

        if current_text:
            chunks.append(Chunk(
                text=current_text.strip(),
                token_count=current_tokens,
                index=len(chunks),
                metadata={'strategy': 'sentence'}
            ))

        return chunks

    def _get_overlap_text(self, text: str, overlap_tokens: int) -> str:
        """Get the last N tokens of text for overlap."""
        if not self.encoding:
            # Approximate with characters
            return text[-(overlap_tokens * 4):]

        tokens = self.encoding.encode(text)
        if len(tokens) <= overlap_tokens:
            return text
        overlap = tokens[-overlap_tokens:]
        return self.encoding.decode(overlap)
