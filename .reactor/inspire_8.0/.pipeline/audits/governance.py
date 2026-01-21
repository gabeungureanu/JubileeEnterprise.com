# =============================================================================
# GOVERNANCE ENFORCEMENT
# =============================================================================
"""
Governance enforcement layer for the Inspire 8.0 pipeline.

This module enforces governance gates that must be passed before
critical operations like persona evolution, memory updates, or deployments.

GOVERNANCE GATES:

1. PERSONA_EVOLUTION: Before modifying persona definitions
2. MEMORY_UPDATE: Before ingesting new documents or memories
3. DEPLOYMENT: Before deploying changes to production
4. ACTIVATION: Before activating a persona for use

ENFORCEMENT RULES:

- Critical audit issues BLOCK all gates
- High-severity issues BLOCK evolution and deployment
- Medium issues require ACKNOWLEDGMENT
- Low issues are logged for awareness

AUDIT REQUIREMENTS:

- Gates check for recent passing audits
- Stale audits (>24h) require re-audit
- Blocking issues require resolution
"""

import json
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .doctrine_alignment import (
    DoctrineAuditResult,
    DeviationSeverity,
)

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class GateStatus(Enum):
    """Status of a governance gate."""
    OPEN = "open"        # Gate passed, operation allowed
    BLOCKED = "blocked"  # Gate blocked, operation denied
    PENDING = "pending"  # Awaiting audit or review
    EXPIRED = "expired"  # Previous approval expired


class GateType(Enum):
    """Types of governance gates."""
    PERSONA_EVOLUTION = "persona_evolution"
    MEMORY_UPDATE = "memory_update"
    DEPLOYMENT = "deployment"
    ACTIVATION = "activation"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class GateDecision:
    """
    Decision from a governance gate check.

    Contains the gate status, reasons, and required actions.
    """
    # Gate identification
    gate_type: GateType = GateType.ACTIVATION
    gate_id: str = ""
    checked_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Decision
    status: GateStatus = GateStatus.PENDING
    allowed: bool = False

    # Context
    persona_id: str = ""
    operation: str = ""

    # Audit reference
    audit_id: str = ""
    audit_timestamp: str = ""
    audit_passed: bool = False

    # Blocking reasons
    blocking_reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Required actions
    required_actions: List[str] = field(default_factory=list)

    # Acknowledgments
    acknowledged_by: str = ""
    acknowledged_at: str = ""
    acknowledgment_notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'gate_type': self.gate_type.value,
            'gate_id': self.gate_id,
            'checked_at': self.checked_at,
            'status': self.status.value,
            'allowed': self.allowed,
            'persona_id': self.persona_id,
            'operation': self.operation,
            'audit_reference': {
                'audit_id': self.audit_id,
                'audit_timestamp': self.audit_timestamp,
                'audit_passed': self.audit_passed,
            },
            'blocking_reasons': self.blocking_reasons,
            'warnings': self.warnings,
            'required_actions': self.required_actions,
            'acknowledgment': {
                'acknowledged_by': self.acknowledged_by,
                'acknowledged_at': self.acknowledged_at,
                'notes': self.acknowledgment_notes,
            },
        }


@dataclass
class GovernanceGate:
    """
    A governance gate configuration.

    Defines what checks are required for a specific gate type.
    """
    gate_type: GateType = GateType.ACTIVATION
    name: str = ""
    description: str = ""

    # Audit requirements
    requires_passing_audit: bool = True
    max_audit_age_hours: int = 24

    # Severity thresholds
    block_on_critical: bool = True
    block_on_high: bool = True
    block_on_medium: bool = False

    # Acknowledgment
    requires_acknowledgment: bool = False
    allows_override: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'gate_type': self.gate_type.value,
            'name': self.name,
            'description': self.description,
            'requires_passing_audit': self.requires_passing_audit,
            'max_audit_age_hours': self.max_audit_age_hours,
            'block_on_critical': self.block_on_critical,
            'block_on_high': self.block_on_high,
            'block_on_medium': self.block_on_medium,
            'requires_acknowledgment': self.requires_acknowledgment,
            'allows_override': self.allows_override,
        }


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class GovernanceConfig:
    """Configuration for governance enforcement."""

    # Audit result directory
    audit_result_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/audits/results'
    ))

    # Governance log directory
    governance_log_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/governance'
    ))

    # Default gate configurations
    gates: Dict[GateType, GovernanceGate] = field(default_factory=lambda: {
        GateType.PERSONA_EVOLUTION: GovernanceGate(
            gate_type=GateType.PERSONA_EVOLUTION,
            name="Persona Evolution Gate",
            description="Controls modifications to persona definitions",
            requires_passing_audit=True,
            max_audit_age_hours=24,
            block_on_critical=True,
            block_on_high=True,
            block_on_medium=False,
            requires_acknowledgment=True,
            allows_override=False,
        ),
        GateType.MEMORY_UPDATE: GovernanceGate(
            gate_type=GateType.MEMORY_UPDATE,
            name="Memory Update Gate",
            description="Controls ingestion of new documents and memories",
            requires_passing_audit=True,
            max_audit_age_hours=48,
            block_on_critical=True,
            block_on_high=True,
            block_on_medium=False,
            requires_acknowledgment=False,
            allows_override=True,
        ),
        GateType.DEPLOYMENT: GovernanceGate(
            gate_type=GateType.DEPLOYMENT,
            name="Deployment Gate",
            description="Controls deployment to production",
            requires_passing_audit=True,
            max_audit_age_hours=12,
            block_on_critical=True,
            block_on_high=True,
            block_on_medium=True,
            requires_acknowledgment=True,
            allows_override=False,
        ),
        GateType.ACTIVATION: GovernanceGate(
            gate_type=GateType.ACTIVATION,
            name="Activation Gate",
            description="Controls persona activation",
            requires_passing_audit=True,
            max_audit_age_hours=168,  # 1 week
            block_on_critical=True,
            block_on_high=False,
            block_on_medium=False,
            requires_acknowledgment=False,
            allows_override=True,
        ),
    })

    # Enforcement mode
    strict_mode: bool = True  # If False, gates warn but don't block
    log_all_decisions: bool = True


# =============================================================================
# GOVERNANCE ENFORCER
# =============================================================================

class GovernanceEnforcer:
    """
    Enforces governance gates across the pipeline.

    All critical operations must pass through governance gates
    to ensure audit compliance and prevent drift.
    """

    def __init__(self, config: GovernanceConfig = None):
        self.config = config or GovernanceConfig()
        self._lock = threading.Lock()
        self._acknowledged_issues: Dict[str, Dict[str, Any]] = {}
        self._gate_log: List[GateDecision] = []

    def check_gate(
        self,
        gate_type: GateType,
        persona_id: str = "",
        operation: str = "",
        force: bool = False
    ) -> GateDecision:
        """
        Check a governance gate.

        Args:
            gate_type: Type of gate to check
            persona_id: Persona being operated on
            operation: Description of the operation
            force: Force allow (only if gate allows override)

        Returns:
            GateDecision with status and required actions
        """
        import uuid

        gate = self.config.gates.get(gate_type)
        if gate is None:
            return GateDecision(
                gate_type=gate_type,
                gate_id=str(uuid.uuid4()),
                status=GateStatus.OPEN,
                allowed=True,
                persona_id=persona_id,
                operation=operation,
            )

        decision = GateDecision(
            gate_type=gate_type,
            gate_id=str(uuid.uuid4()),
            persona_id=persona_id,
            operation=operation,
        )

        # Find most recent audit
        audit_result = self._find_recent_audit(persona_id)

        if audit_result is None:
            decision.status = GateStatus.PENDING
            decision.allowed = False
            decision.blocking_reasons.append("No audit found - audit required before this operation")
            decision.required_actions.append(f"Run doctrine alignment audit for {persona_id or 'all personas'}")
        else:
            decision.audit_id = audit_result.audit_id
            decision.audit_timestamp = audit_result.audit_timestamp
            decision.audit_passed = audit_result.passed

            # Check audit age
            if gate.requires_passing_audit:
                audit_age = self._get_audit_age_hours(audit_result)
                if audit_age > gate.max_audit_age_hours:
                    decision.status = GateStatus.EXPIRED
                    decision.allowed = False
                    decision.blocking_reasons.append(
                        f"Audit is {audit_age:.1f} hours old (max: {gate.max_audit_age_hours}h)"
                    )
                    decision.required_actions.append("Run new doctrine alignment audit")

            # Check audit results
            if audit_result.critical_count > 0 and gate.block_on_critical:
                decision.status = GateStatus.BLOCKED
                decision.allowed = False
                decision.blocking_reasons.append(
                    f"{audit_result.critical_count} critical issues found in audit"
                )
                decision.required_actions.append("Resolve all critical issues before proceeding")

            if audit_result.high_count > 0 and gate.block_on_high:
                decision.status = GateStatus.BLOCKED
                decision.allowed = False
                decision.blocking_reasons.append(
                    f"{audit_result.high_count} high-severity issues found in audit"
                )
                decision.required_actions.append("Resolve high-severity issues before proceeding")

            if audit_result.medium_count > 0 and gate.block_on_medium:
                decision.status = GateStatus.BLOCKED
                decision.allowed = False
                decision.blocking_reasons.append(
                    f"{audit_result.medium_count} medium-severity issues found in audit"
                )
                decision.required_actions.append("Resolve or acknowledge medium issues")

            # Add warnings for non-blocking issues
            if audit_result.medium_count > 0 and not gate.block_on_medium:
                decision.warnings.append(
                    f"{audit_result.medium_count} medium-severity issues present (not blocking)"
                )

            if audit_result.low_count > 0:
                decision.warnings.append(
                    f"{audit_result.low_count} low-severity issues present (for awareness)"
                )

        # Check for force override
        if force and gate.allows_override and not decision.allowed:
            if decision.status != GateStatus.BLOCKED or not any(
                'critical' in r.lower() for r in decision.blocking_reasons
            ):
                decision.allowed = True
                decision.warnings.append("OVERRIDE: Gate forced open by operator")
                logger.warning(f"Gate {gate_type.value} forced open for {operation}")

        # Set final status
        if decision.allowed and decision.status not in (GateStatus.BLOCKED,):
            decision.status = GateStatus.OPEN

        # Log decision
        if self.config.log_all_decisions:
            self._log_decision(decision)

        # Enforce strict mode
        if not self.config.strict_mode and not decision.allowed:
            decision.warnings.insert(0, "STRICT MODE DISABLED: Proceeding despite gate failure")
            decision.allowed = True

        return decision

    def acknowledge_issues(
        self,
        audit_id: str,
        acknowledged_by: str,
        notes: str = ""
    ) -> bool:
        """
        Acknowledge issues in an audit.

        Allows medium-severity issues to be acknowledged for gates
        that require acknowledgment.

        Args:
            audit_id: The audit ID to acknowledge
            acknowledged_by: Who is acknowledging
            notes: Acknowledgment notes

        Returns:
            True if acknowledged successfully
        """
        with self._lock:
            self._acknowledged_issues[audit_id] = {
                'acknowledged_by': acknowledged_by,
                'acknowledged_at': datetime.now().isoformat(),
                'notes': notes,
            }

        self._log_acknowledgment(audit_id, acknowledged_by, notes)
        return True

    def _find_recent_audit(self, persona_id: str = "") -> Optional[DoctrineAuditResult]:
        """Find the most recent audit result."""
        audit_dir = self.config.audit_result_dir
        if not audit_dir.exists():
            return None

        # Find audit files
        pattern = "doctrine_audit_*.json"
        audit_files = sorted(audit_dir.glob(pattern), reverse=True)

        for audit_file in audit_files:
            try:
                data = json.loads(audit_file.read_text())

                # Check if audit covers the persona
                personas_audited = data.get('personas_audited', [])
                if persona_id and persona_id not in personas_audited:
                    continue

                # Reconstruct result
                result = DoctrineAuditResult(
                    audit_id=data.get('audit_id', ''),
                    audit_timestamp=data.get('audit_timestamp', ''),
                    persona_id=data.get('persona_id', ''),
                    personas_audited=personas_audited,
                    sample_size=data.get('sample_size', 0),
                    passed=data.get('status', {}).get('passed', False),
                    blocking_issues=data.get('status', {}).get('blocking_issues', False),
                    requires_review=data.get('status', {}).get('requires_review', False),
                )

                summary = data.get('summary', {})
                result.total_deviations = summary.get('total_deviations', 0)
                result.critical_count = summary.get('critical_count', 0)
                result.high_count = summary.get('high_count', 0)
                result.medium_count = summary.get('medium_count', 0)
                result.low_count = summary.get('low_count', 0)

                return result

            except Exception as e:
                logger.warning(f"Failed to parse audit file {audit_file}: {e}")
                continue

        return None

    def _get_audit_age_hours(self, audit: DoctrineAuditResult) -> float:
        """Get the age of an audit in hours."""
        if not audit.audit_timestamp:
            return float('inf')

        try:
            audit_time = datetime.fromisoformat(audit.audit_timestamp)
            age = datetime.now() - audit_time
            return age.total_seconds() / 3600
        except ValueError:
            return float('inf')

    def _log_decision(self, decision: GateDecision):
        """Log a gate decision."""
        with self._lock:
            self._gate_log.append(decision)

        # Write to file
        self.config.governance_log_dir.mkdir(parents=True, exist_ok=True)
        log_file = self.config.governance_log_dir / f"governance_{datetime.now().strftime('%Y%m%d')}.jsonl"

        try:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(decision.to_dict(), default=str) + '\n')
        except Exception as e:
            logger.warning(f"Failed to write governance log: {e}")

    def _log_acknowledgment(self, audit_id: str, acknowledged_by: str, notes: str):
        """Log an acknowledgment."""
        log_entry = {
            'type': 'acknowledgment',
            'timestamp': datetime.now().isoformat(),
            'audit_id': audit_id,
            'acknowledged_by': acknowledged_by,
            'notes': notes,
        }

        self.config.governance_log_dir.mkdir(parents=True, exist_ok=True)
        log_file = self.config.governance_log_dir / f"governance_{datetime.now().strftime('%Y%m%d')}.jsonl"

        try:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            logger.warning(f"Failed to write acknowledgment log: {e}")

    def get_gate_status(self, gate_type: GateType) -> GovernanceGate:
        """Get configuration for a gate type."""
        return self.config.gates.get(gate_type)

    def get_recent_decisions(self, limit: int = 10) -> List[GateDecision]:
        """Get recent gate decisions."""
        with self._lock:
            return self._gate_log[-limit:]


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_enforcer: Optional[GovernanceEnforcer] = None
_enforcer_lock = threading.Lock()


def get_governance_enforcer() -> GovernanceEnforcer:
    """Get the global governance enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        if _global_enforcer is None:
            _global_enforcer = GovernanceEnforcer()
        return _global_enforcer


def set_governance_enforcer(enforcer: GovernanceEnforcer):
    """Set the global governance enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        _global_enforcer = enforcer


def reset_governance_enforcer():
    """Reset to default governance enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        _global_enforcer = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def check_governance_gate(
    gate_type: GateType,
    persona_id: str = "",
    operation: str = "",
    force: bool = False
) -> GateDecision:
    """
    Check a governance gate.

    Example:
        decision = check_governance_gate(
            GateType.PERSONA_EVOLUTION,
            persona_id="inspire_pastor",
            operation="Update pastoral boundaries",
        )

        if not decision.allowed:
            print(f"Gate blocked: {decision.blocking_reasons}")
    """
    enforcer = get_governance_enforcer()
    return enforcer.check_gate(
        gate_type=gate_type,
        persona_id=persona_id,
        operation=operation,
        force=force
    )


def require_audit_pass(
    gate_type: GateType,
    persona_id: str = "",
    operation: str = ""
) -> bool:
    """
    Require an audit to pass before proceeding.

    Raises GovernanceError if gate is blocked.

    Example:
        if require_audit_pass(GateType.MEMORY_UPDATE, "inspire_pastor"):
            ingest_new_documents()
    """
    decision = check_governance_gate(gate_type, persona_id, operation)

    if not decision.allowed:
        logger.error(f"Governance gate {gate_type.value} blocked: {decision.blocking_reasons}")
        raise GovernanceError(
            f"Operation blocked by governance: {', '.join(decision.blocking_reasons)}",
            decision=decision
        )

    return True


class GovernanceError(Exception):
    """Raised when a governance gate blocks an operation."""

    def __init__(self, message: str, decision: GateDecision = None):
        super().__init__(message)
        self.decision = decision
