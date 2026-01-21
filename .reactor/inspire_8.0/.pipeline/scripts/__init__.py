# =============================================================================
# INSPIRE 8.0 OPERATIONAL SCRIPTS
# =============================================================================
"""
Operational scripts for the Inspire 8.0 system.

This directory contains all core operational scripts that can be executed
via VS Code Tasks for consistent, auditable system management.

AVAILABLE SCRIPTS:
- rebuild_qdrant_index.py: Rebuild the Qdrant vector index from scratch
- ingest_documents.py: Ingest new documents into the knowledge base
- activate_persona.py: Activate a specific persona for testing/operation
- audit_persona_drift.py: Audit persona behavior for drift from baseline

VS CODE INTEGRATION:
All scripts are exposed as VS Code Tasks in .vscode/tasks.json.
Run them via: Terminal > Run Task > [Task Name]

CRITICAL INVARIANTS:
1. All scripts are idempotent and safe to re-run
2. All scripts log their operations for audit
3. All scripts use environment variables for configuration
4. All scripts return proper exit codes (0 = success, non-zero = failure)
"""

__version__ = '1.0.0'
