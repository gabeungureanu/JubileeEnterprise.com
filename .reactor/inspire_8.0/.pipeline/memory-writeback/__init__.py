# =============================================================================
# INSPIRE 8.0 MEMORY WRITEBACK LAYER
# =============================================================================
"""
Memory Writeback Layer for Inspire 8.0.

This module implements a controlled memory update strategy that prioritizes
summarization over raw data storage to:
1. Preserve retrieval quality
2. Reduce token waste
3. Maintain long-term memory hygiene

CRITICAL INVARIANTS:
- Summarization-first: All memory writes default to summaries (100-250 tokens)
- No raw transcripts: Full conversation logs are PROHIBITED by default
- Structured extraction: Decisions, preferences, and scripture references
- Explicit authorization: All writes require writeback phase + authorization
- Audit trail: All memory operations are logged

MEMORY ITEM TYPES:
- session_summary: Concise summary of interaction (100-250 tokens)
- key_decision: Important decisions made during conversation
- user_preference: Durable user preferences (not session-specific)
- scripture_reference: Scripture cited or discussed
- interaction_summary: Brief interaction record

PROHIBITED BY DEFAULT:
- raw_transcript: Full conversation logs
- unfiltered_log: Raw system logs
"""

from .config import (
    WritebackConfig,
    get_writeback_config,
    MemoryItemType,
    TranscriptPolicy,
)
from .summarizer import (
    SessionSummarizer,
    SummaryResult,
)
from .extractors import (
    MemoryExtractor,
    DecisionExtractor,
    PreferenceExtractor,
    ScriptureExtractor,
    ExtractedItem,
    ExtractionResult,
)
from .writer import (
    MemoryWriter,
    WriteResult,
    MemoryItem,
)
from .orchestrator import (
    WritebackOrchestrator,
    WritebackResult,
    WritebackSession,
)

__all__ = [
    # Configuration
    'WritebackConfig',
    'get_writeback_config',
    'MemoryItemType',
    'TranscriptPolicy',
    # Summarization
    'SessionSummarizer',
    'SummaryResult',
    # Extraction
    'MemoryExtractor',
    'DecisionExtractor',
    'PreferenceExtractor',
    'ScriptureExtractor',
    'ExtractedItem',
    'ExtractionResult',
    # Writing
    'MemoryWriter',
    'WriteResult',
    'MemoryItem',
    # Orchestration
    'WritebackOrchestrator',
    'WritebackResult',
    'WritebackSession',
]

__version__ = '1.0.0'
