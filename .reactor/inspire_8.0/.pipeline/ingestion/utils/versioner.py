# =============================================================================
# DOCUMENT VERSION TRACKING FOR QDRANT INGESTION
# =============================================================================
"""
Provides strict versioning strategy for all content ingested into Qdrant.

This module ensures:
1. Every payload includes a doc_version field
2. Version identifiers reflect authoritative source state at ingestion time
3. Consistent versioning across all collections
4. Support for deterministic rebuilds and rollbacks

Version Strategies:
- CONTENT_HASH: SHA-256 hash of content (default for most content)
- SEMANTIC: Semantic version from source metadata (e.g., 1.0.0)
- INCREMENTAL: Auto-incrementing integer (for sequential updates)
- FILE_HASH: Hash of entire source file
- GIT_COMMIT: Git commit hash of source file
"""

import hashlib
import json
import os
import re
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class VersionStrategy(Enum):
    """Version derivation strategies."""
    CONTENT_HASH = "content_hash"
    SEMANTIC = "semantic"
    INCREMENTAL = "incremental"
    FILE_HASH = "file_hash"
    GIT_COMMIT = "git_commit"
    COMPOSITE = "composite"


@dataclass
class VersionInfo:
    """Complete version information for a document."""
    doc_version: str
    strategy: str
    content_hash: str
    file_hash: Optional[str] = None
    git_commit: Optional[str] = None
    git_timestamp: Optional[str] = None
    semantic_version: Optional[str] = None
    ingested_at: str = field(default_factory=lambda: datetime.now().isoformat())
    source_path: Optional[str] = None

    def to_payload_fields(self) -> Dict[str, Any]:
        """Convert to fields suitable for Qdrant payload."""
        return {
            "doc_version": self.doc_version,
            "version_strategy": self.strategy,
            "content_hash": self.content_hash,
            "file_hash": self.file_hash,
            "git_commit": self.git_commit,
            "git_timestamp": self.git_timestamp,
            "ingested_at": self.ingested_at,
        }


class DocumentVersioner:
    """
    Manages document versioning for Qdrant ingestion.

    Provides multiple versioning strategies and ensures consistent
    version tracking across all ingested content.
    """

    def __init__(
        self,
        workspace_root: Path,
        default_strategy: VersionStrategy = VersionStrategy.COMPOSITE
    ):
        """
        Initialize the versioner.

        Args:
            workspace_root: Root directory of the workspace (for Git operations)
            default_strategy: Default versioning strategy
        """
        self.workspace_root = Path(workspace_root)
        self.default_strategy = default_strategy
        self._git_available = self._check_git_available()
        self._git_info_cache: Dict[str, tuple[Optional[str], Optional[str]]] = {}
        self._file_hash_cache: Dict[str, str] = {}

    def _check_git_available(self) -> bool:
        """Check if Git is available and workspace is a Git repo."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--git-dir"],
                cwd=str(self.workspace_root),
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
            return False

    def compute_version(
        self,
        content: str,
        source_path: Optional[Path] = None,
        strategy: Optional[VersionStrategy] = None,
        semantic_version: Optional[str] = None
    ) -> VersionInfo:
        """
        Compute version information for content.

        Args:
            content: The text content being versioned
            source_path: Optional path to source file
            strategy: Version strategy (uses default if not specified)
            semantic_version: Optional explicit semantic version from metadata

        Returns:
            VersionInfo with complete version details
        """
        strategy = strategy or self.default_strategy

        # Compute content hash (always needed)
        content_hash = self._hash_content(content)

        # Compute file hash if source path provided
        file_hash = None
        if source_path and source_path.exists():
            file_hash = self._hash_file(source_path)

        # Get Git info if available
        git_commit = None
        git_timestamp = None
        if self._git_available and source_path:
            git_commit, git_timestamp = self._get_git_info(source_path)

        # Determine doc_version based on strategy
        if strategy == VersionStrategy.CONTENT_HASH:
            doc_version = f"ch:{content_hash[:12]}"
        elif strategy == VersionStrategy.FILE_HASH:
            doc_version = f"fh:{file_hash[:12]}" if file_hash else f"ch:{content_hash[:12]}"
        elif strategy == VersionStrategy.GIT_COMMIT:
            doc_version = f"git:{git_commit[:8]}" if git_commit else f"ch:{content_hash[:12]}"
        elif strategy == VersionStrategy.SEMANTIC:
            doc_version = semantic_version if semantic_version else "1.0.0"
        elif strategy == VersionStrategy.INCREMENTAL:
            # Incremental requires external state; use content hash as fallback
            doc_version = f"ch:{content_hash[:12]}"
        elif strategy == VersionStrategy.COMPOSITE:
            # Composite: combine file hash + git commit for maximum traceability
            parts = []
            if file_hash:
                parts.append(file_hash[:8])
            if git_commit:
                parts.append(git_commit[:8])
            if not parts:
                parts.append(content_hash[:12])
            doc_version = ".".join(parts)
        else:
            doc_version = f"ch:{content_hash[:12]}"

        return VersionInfo(
            doc_version=doc_version,
            strategy=strategy.value,
            content_hash=content_hash,
            file_hash=file_hash,
            git_commit=git_commit,
            git_timestamp=git_timestamp,
            semantic_version=semantic_version,
            source_path=str(source_path) if source_path else None
        )

    def _hash_content(self, content: str) -> str:
        """Compute SHA-256 hash of content."""
        # Normalize content for consistent hashing
        normalized = re.sub(r'\s+', ' ', content).strip().lower()
        hasher = hashlib.sha256()
        hasher.update(normalized.encode('utf-8'))
        return hasher.hexdigest()

    def _hash_file(self, file_path: Path) -> str:
        """Compute SHA-256 hash of file contents (cached)."""
        cache_key = str(file_path)
        if cache_key in self._file_hash_cache:
            return self._file_hash_cache[cache_key]

        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        result = hasher.hexdigest()
        self._file_hash_cache[cache_key] = result
        return result

    def _get_git_info(self, file_path: Path) -> tuple[Optional[str], Optional[str]]:
        """Get Git commit hash and timestamp for a file (cached)."""
        # Use cache to avoid repeated git calls for the same file
        cache_key = str(file_path)
        if cache_key in self._git_info_cache:
            return self._git_info_cache[cache_key]

        try:
            # Get the last commit that modified this file
            relative_path = file_path.relative_to(self.workspace_root)

            result = subprocess.run(
                ["git", "log", "-1", "--format=%H|%aI", "--", str(relative_path)],
                cwd=str(self.workspace_root),
                capture_output=True,
                text=True,
                timeout=3  # 3 second timeout to prevent hanging
            )

            if result.returncode == 0 and result.stdout.strip():
                parts = result.stdout.strip().split("|")
                if len(parts) == 2:
                    info = (parts[0], parts[1])
                    self._git_info_cache[cache_key] = info
                    return info

            # Cache the None result too to avoid re-calling
            self._git_info_cache[cache_key] = (None, None)
            return None, None

        except (subprocess.SubprocessError, subprocess.TimeoutExpired, ValueError):
            self._git_info_cache[cache_key] = (None, None)
            return None, None


@dataclass
class ChangelogEntry:
    """A single entry in the changelog."""
    timestamp: str
    version: str
    change_type: str  # added, modified, removed, reindexed
    description: str
    source_files: List[str] = field(default_factory=list)
    collection: Optional[str] = None
    points_affected: int = 0
    author: str = "system"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "timestamp": self.timestamp,
            "version": self.version,
            "change_type": self.change_type,
            "description": self.description,
            "source_files": self.source_files,
            "collection": self.collection,
            "points_affected": self.points_affected,
            "author": self.author
        }


class ChangelogManager:
    """
    Manages changelogs for ingested content.

    Maintains human-readable changelog files at collection or domain level,
    recording what changed, when it changed, and why.
    """

    def __init__(self, changelog_dir: Path):
        """
        Initialize the changelog manager.

        Args:
            changelog_dir: Directory to store changelog files
        """
        self.changelog_dir = Path(changelog_dir)
        self.changelog_dir.mkdir(parents=True, exist_ok=True)

    def add_entry(
        self,
        collection: str,
        change_type: str,
        description: str,
        version: str,
        source_files: Optional[List[str]] = None,
        points_affected: int = 0,
        author: str = "system"
    ) -> ChangelogEntry:
        """
        Add a new changelog entry.

        Args:
            collection: Target collection name
            change_type: Type of change (added, modified, removed, reindexed)
            description: Human-readable description of the change
            version: Version identifier
            source_files: List of source files involved
            points_affected: Number of Qdrant points affected
            author: Who/what made the change

        Returns:
            The created ChangelogEntry
        """
        entry = ChangelogEntry(
            timestamp=datetime.now().isoformat(),
            version=version,
            change_type=change_type,
            description=description,
            source_files=source_files or [],
            collection=collection,
            points_affected=points_affected,
            author=author
        )

        self._append_to_changelog(collection, entry)
        return entry

    def _append_to_changelog(self, collection: str, entry: ChangelogEntry):
        """Append entry to collection's changelog file."""
        changelog_file = self.changelog_dir / f"{collection}.changelog.json"

        # Load existing entries
        entries = []
        if changelog_file.exists():
            try:
                with open(changelog_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    entries = data.get('entries', [])
            except (json.JSONDecodeError, IOError):
                entries = []

        # Append new entry
        entries.append(entry.to_dict())

        # Write back
        with open(changelog_file, 'w', encoding='utf-8') as f:
            json.dump({
                "collection": collection,
                "last_updated": datetime.now().isoformat(),
                "total_entries": len(entries),
                "entries": entries
            }, f, indent=2)

    def generate_markdown_changelog(self, collection: str) -> str:
        """
        Generate a human-readable Markdown changelog.

        Args:
            collection: Collection to generate changelog for

        Returns:
            Markdown-formatted changelog content
        """
        changelog_file = self.changelog_dir / f"{collection}.changelog.json"

        if not changelog_file.exists():
            return f"# Changelog: {collection}\n\nNo entries yet.\n"

        with open(changelog_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        entries = data.get('entries', [])

        lines = [
            f"# Changelog: {collection}",
            "",
            f"Last updated: {data.get('last_updated', 'unknown')}",
            f"Total entries: {len(entries)}",
            "",
            "---",
            ""
        ]

        # Group by date
        from collections import defaultdict
        by_date = defaultdict(list)
        for entry in entries:
            date = entry['timestamp'][:10]
            by_date[date].append(entry)

        for date in sorted(by_date.keys(), reverse=True):
            lines.append(f"## {date}")
            lines.append("")

            for entry in by_date[date]:
                change_icon = {
                    "added": "+",
                    "modified": "~",
                    "removed": "-",
                    "reindexed": "↻"
                }.get(entry['change_type'], "•")

                lines.append(f"- [{change_icon}] **{entry['version']}**: {entry['description']}")
                if entry['points_affected'] > 0:
                    lines.append(f"  - Points affected: {entry['points_affected']}")
                if entry['source_files']:
                    lines.append(f"  - Sources: {', '.join(entry['source_files'][:3])}")
                    if len(entry['source_files']) > 3:
                        lines.append(f"    ... and {len(entry['source_files']) - 3} more")

            lines.append("")

        return "\n".join(lines)

    def export_all_changelogs_to_markdown(self):
        """Export all changelogs to Markdown files."""
        for changelog_file in self.changelog_dir.glob("*.changelog.json"):
            collection = changelog_file.stem.replace('.changelog', '')
            markdown_content = self.generate_markdown_changelog(collection)

            md_file = self.changelog_dir / f"{collection}.CHANGELOG.md"
            with open(md_file, 'w', encoding='utf-8') as f:
                f.write(markdown_content)


def create_rebuild_manifest(
    workspace_root: Path,
    output_path: Path,
    collections: List[str]
) -> Dict[str, Any]:
    """
    Create a manifest for rebuilding Qdrant state from scratch.

    This manifest records everything needed to deterministically
    rebuild all collections by replaying ingestion.

    Args:
        workspace_root: Root of the workspace
        output_path: Where to write the manifest
        collections: List of collections to include

    Returns:
        The manifest dictionary
    """
    manifest = {
        "created_at": datetime.now().isoformat(),
        "workspace_root": str(workspace_root),
        "git_head": None,
        "collections": collections,
        "rebuild_order": [
            "scripture",      # Foundation layer
            "doctrine",       # Doctrinal content
            "governance",     # Governance rules
            "kingdom_builder", # Kingdom strategy
            "jubilee_ministry", # Ministry docs
            # Persona collections
            "gabriel", "michael", "uriel", "raphael", "selah", "ezra",
            "lydia", "enoch", "seraph", "malachi", "anna", "nathaniel", "elias"
        ],
        "instructions": [
            "1. Ensure Qdrant is running and collections exist",
            "2. Set OPENAI_API_KEY environment variable",
            "3. Run: python run_pipeline.py --force",
            "4. Verify point counts match expected values"
        ]
    }

    # Get current Git HEAD
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(workspace_root),
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            manifest["git_head"] = result.stdout.strip()
    except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
        pass

    # Write manifest
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    return manifest
