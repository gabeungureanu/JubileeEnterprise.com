# =============================================================================
# INSPIRE 8.0 GOVERNANCE
# =============================================================================
"""
Governance layer for the Inspire 8.0 pipeline.

This module enforces rules and policies across the pipeline to ensure
consistency, compliance, and quality.

GOVERNANCE DOMAINS:

1. DESIGN GOVERNANCE:
   - Enforces use of approved templates and mockups
   - Validates design outputs against specifications
   - Blocks ad hoc design work without spec references
   - Manages design canon document retrieval

2. (Future) CONTENT GOVERNANCE:
   - Content quality standards
   - Tone and voice consistency
   - Brand compliance

3. (Future) DATA GOVERNANCE:
   - Data handling rules
   - Privacy compliance
   - Retention policies

ENFORCEMENT PRINCIPLES:
1. Specifications are AUTHORITATIVE, not optional
2. Governance applies UNIFORMLY across all personas
3. Violations trigger remediation, not silent acceptance
4. All governance decisions are LOGGED for audit
"""

from .design_governance import (
    # Enums
    DesignSpecType,
    DesignTaskType,
    ComplianceStatus,
    DesignAction,
    # Data classes
    DesignSpec,
    DesignRequirement,
    DesignDeviation,
    DesignContext,
    DesignGateDecision,
    DesignComplianceResult,
    # Config
    DesignGovernanceConfig,
    # Classes
    DesignSpecRegistry,
    DesignGovernanceEnforcer,
    DesignGovernanceError,
    # Global functions
    get_design_enforcer,
    set_design_enforcer,
    reset_design_enforcer,
    check_design_gate,
    require_design_spec,
)

__all__ = [
    # Design governance enums
    'DesignSpecType',
    'DesignTaskType',
    'ComplianceStatus',
    'DesignAction',
    # Design data classes
    'DesignSpec',
    'DesignRequirement',
    'DesignDeviation',
    'DesignContext',
    'DesignGateDecision',
    'DesignComplianceResult',
    # Design config
    'DesignGovernanceConfig',
    # Design classes
    'DesignSpecRegistry',
    'DesignGovernanceEnforcer',
    'DesignGovernanceError',
    # Design functions
    'get_design_enforcer',
    'set_design_enforcer',
    'reset_design_enforcer',
    'check_design_gate',
    'require_design_spec',
]

__version__ = '1.0.0'
