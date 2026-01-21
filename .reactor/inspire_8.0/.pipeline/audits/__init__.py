# =============================================================================
# INSPIRE 8.0 GOVERNANCE AUDITS
# =============================================================================
"""
Governance and audit layer for the Inspire 8.0 pipeline.

This module implements active prevention of persona drift and theological
inconsistency through systematic auditing and enforcement.

AUDIT CATEGORIES:

1. DOCTRINE ALIGNMENT AUDIT:
   - Evaluates outputs against Canon specification
   - Checks doctrinal commitments and boundaries
   - Flags theological deviations and ambiguities

2. PERSONA BOUNDARY AUDIT:
   - Validates behavioral constraints
   - Checks tone and style requirements
   - Monitors scope adherence

3. CANON COMPLIANCE AUDIT:
   - Compares against authoritative sources
   - Validates scriptural references
   - Checks theological consistency

GOVERNANCE ENFORCEMENT:

- Identified issues MUST be reviewed before:
  - Further persona evolution
  - Memory updates or ingestion
  - Production deployment

- Audit results are:
  - Stored in structured format
  - Linked to source interactions
  - Tracked over time for trends

CRITICAL INVARIANTS:
1. Audits are NON-DESTRUCTIVE (read-only analysis)
2. All findings are DOCUMENTED with severity
3. Audit trails are IMMUTABLE
4. Governance applies UNIFORMLY across all personas
5. No persona evolution without passing audit
"""

from .doctrine_alignment import (
    DoctrineAlignmentAudit,
    DoctrineAuditConfig,
    DoctrineAuditResult,
    DoctrineDeviation,
    DeviationType,
    DeviationSeverity,
    run_doctrine_audit,
)
from .governance import (
    GovernanceEnforcer,
    GovernanceConfig,
    GovernanceGate,
    GateDecision,
    GateStatus,
    get_governance_enforcer,
    set_governance_enforcer,
    reset_governance_enforcer,
    check_governance_gate,
    require_audit_pass,
)
from .canon_compliance import (
    CanonComplianceChecker,
    CanonReference,
    ComplianceResult,
    ComplianceLevel,
    check_canon_compliance,
)
from .audit_report import (
    AuditReport,
    AuditReportGenerator,
    ReportFormat,
    generate_audit_report,
    save_audit_report,
)

__all__ = [
    # Doctrine alignment
    'DoctrineAlignmentAudit',
    'DoctrineAuditConfig',
    'DoctrineAuditResult',
    'DoctrineDeviation',
    'DeviationType',
    'DeviationSeverity',
    'run_doctrine_audit',
    # Governance
    'GovernanceEnforcer',
    'GovernanceConfig',
    'GovernanceGate',
    'GateDecision',
    'GateStatus',
    'get_governance_enforcer',
    'set_governance_enforcer',
    'reset_governance_enforcer',
    'check_governance_gate',
    'require_audit_pass',
    # Canon compliance
    'CanonComplianceChecker',
    'CanonReference',
    'ComplianceResult',
    'ComplianceLevel',
    'check_canon_compliance',
    # Audit reports
    'AuditReport',
    'AuditReportGenerator',
    'ReportFormat',
    'generate_audit_report',
    'save_audit_report',
]

__version__ = '1.0.0'
