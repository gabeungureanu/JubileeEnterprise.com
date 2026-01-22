# =============================================================================
# CONTENT HASHING FOR DUPLICATE PREVENTION
# =============================================================================
"""
Provides deterministic content hashing for idempotent ingestion.

This module ensures that:
1. Identical content produces identical hashes
2. Point IDs are stable across runs
3. Re-running ingestion does not create duplicates
"""

import hashlib
import json
import re
import uuid
from typing import Any, Dict, List, Optional

# Namespace UUID for generating deterministic UUIDs (UUID5)
# This is a custom namespace for Inspire 8.0 content
INSPIRE_NAMESPACE = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # DNS namespace as base


class ContentHasher:
    """
    Generates stable content hashes for duplicate prevention.

    Uses SHA-256 by default for cryptographic stability.
    """

    def __init__(self, algorithm: str = 'sha256'):
        """
        Initialize the hasher.

        Args:
            algorithm: Hash algorithm to use (default: sha256)
        """
        self.algorithm = algorithm

    def hash_content(self, content: str) -> str:
        """
        Generate a hash of text content.

        Args:
            content: The text content to hash

        Returns:
            Hexadecimal hash string
        """
        normalized = self._normalize_content(content)
        hasher = hashlib.new(self.algorithm)
        hasher.update(normalized.encode('utf-8'))
        return hasher.hexdigest()

    def hash_payload(self, payload: Dict[str, Any], fields: List[str]) -> str:
        """
        Generate a hash from specific payload fields.

        Args:
            payload: The full payload dictionary
            fields: List of field names to include in hash

        Returns:
            Hexadecimal hash string
        """
        values = []
        for field in sorted(fields):  # Sort for consistency
            value = payload.get(field, '')
            if isinstance(value, (dict, list)):
                value = json.dumps(value, sort_keys=True)
            values.append(str(value))

        combined = '|'.join(values)
        return self.hash_content(combined)

    def _normalize_content(self, content: str) -> str:
        """
        Normalize content for consistent hashing.

        - Strips whitespace
        - Normalizes line endings
        - Lowercases for case-insensitive matching
        """
        # Normalize whitespace
        content = re.sub(r'\s+', ' ', content)
        # Strip leading/trailing
        content = content.strip()
        # Normalize case
        content = content.lower()
        return content


def generate_point_id(
    collection: str,
    content_type: str,
    identifier: Optional[str] = None,
    content_hash: Optional[str] = None,
    **kwargs
) -> str:
    """
    Generate a deterministic point ID for Qdrant.

    Different strategies based on content type:
    - Scripture: jsv_{book}_{chapter}_{verse}
    - Anchors: {persona}_{anchor_type}_{section}
    - Other: {collection}_{hash[:16]}

    Args:
        collection: Target Qdrant collection
        content_type: Type of content (verse, teaching, anchor, etc.)
        identifier: Optional explicit identifier
        content_hash: Pre-computed content hash
        **kwargs: Additional context (book, chapter, verse, persona, etc.)

    Returns:
        Stable point ID string
    """
    if identifier:
        return _sanitize_id(identifier)

    # Scripture-specific ID generation
    if content_type == 'verse' or collection == 'scripture':
        book = kwargs.get('book', 'unknown')
        chapter = kwargs.get('chapter', 0)
        verse = kwargs.get('verse', kwargs.get('verse_start', 0))
        translation = kwargs.get('translation', 'jsv').lower()
        return _sanitize_id(f"{translation}_{book}_{chapter}_{verse}")

    # Activation anchor ID generation
    if content_type in ['identity_anchor', 'mission_anchor', 'voice_anchor', 'guardrail_anchor']:
        persona = kwargs.get('persona', 'unknown')
        section = kwargs.get('section', 'main')
        return _sanitize_id(f"{persona}_{content_type}_{section}")

    # Persona memory ID generation
    if collection.startswith('persona_'):
        persona = collection.replace('persona_', '').replace('_inspire', '')
        timestamp = kwargs.get('timestamp', '')
        if content_hash:
            return _sanitize_id(f"{persona}_{content_type}_{content_hash[:12]}")
        return _sanitize_id(f"{persona}_{content_type}_{timestamp}")

    # Default: use content hash
    if content_hash:
        return _sanitize_id(f"{collection}_{content_hash[:16]}")

    # Fallback: generate from kwargs
    hasher = ContentHasher()
    fallback_hash = hasher.hash_payload(kwargs, list(kwargs.keys()))
    return _sanitize_id(f"{collection}_{fallback_hash[:16]}")


def _sanitize_id(raw_id: str) -> str:
    """
    Convert a human-readable ID string to a valid Qdrant point ID (UUID).

    Qdrant requires point IDs to be either unsigned integers or UUIDs.
    This function generates a deterministic UUID5 from the raw ID string,
    ensuring that the same input always produces the same UUID.

    Args:
        raw_id: Human-readable identifier (e.g., 'jsv_genesis_1_1')

    Returns:
        UUID string (e.g., '550e8400-e29b-41d4-a716-446655440000')
    """
    # Normalize the ID for consistency
    normalized = raw_id.lower().strip()
    # Generate deterministic UUID5 from the normalized ID
    return str(uuid.uuid5(INSPIRE_NAMESPACE, normalized))


def compute_file_hash(file_path: str) -> str:
    """
    Compute SHA-256 hash of a file's contents.

    Args:
        file_path: Path to the file

    Returns:
        Hexadecimal hash string
    """
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            hasher.update(chunk)
    return hasher.hexdigest()
