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
- FORMAL MEMORY POLICY: Only durable, high-signal content is persisted
- REQUIRED METADATA: All items MUST have confidence level and scope

MEMORY ITEM TYPES:
- session_summary: Concise summary of interaction (100-250 tokens)
- key_decision: Important decisions made during conversation
- user_preference: Durable user preferences (not session-specific)
- scripture_reference: Scripture cited or discussed
- interaction_summary: Brief interaction record

PROHIBITED BY DEFAULT:
- raw_transcript: Full conversation logs
- unfiltered_log: Raw system logs
- Transient content: Routine exchanges, speculative thoughts

FORMAL MEMORY POLICY:
- Confidence levels: provisional, confirmed, high_confidence
- Scope designations: private, shared, user_global
- Durability criteria: new_user_preference, new_decision, etc.
- Transient reasons: routine_exchange, speculative_thought, etc.
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
from .memory_policy import (
    MemoryPolicyEnforcer,
    MemoryPolicyConfig,
    PolicyEvaluation,
    ConfidenceLevel,
    MemoryScope,
    DurabilityCriteria,
    TransientReason,
    get_memory_policy_enforcer,
    set_memory_policy_enforcer,
    reset_memory_policy_enforcer,
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
    # FORMAL MEMORY POLICY
    'MemoryPolicyEnforcer',
    'MemoryPolicyConfig',
    'PolicyEvaluation',
    'ConfidenceLevel',
    'MemoryScope',
    'DurabilityCriteria',
    'TransientReason',
    'get_memory_policy_enforcer',
    'set_memory_policy_enforcer',
    'reset_memory_policy_enforcer',
]

__version__ = '1.1.0'  # Updated for formal memory policy
