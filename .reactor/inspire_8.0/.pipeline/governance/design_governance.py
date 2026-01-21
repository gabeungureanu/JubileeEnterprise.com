# =============================================================================
# DESIGN GOVERNANCE
# =============================================================================
"""
Design governance for the Inspire 8.0 pipeline.

This module enforces the use of approved templates and mockups for all
design-related work performed by UI-focused personas or tooling.

DESIGN CANON HIERARCHY:

1. FOUNDATION SPECS (Highest Authority):
   - Design system principles
   - Brand guidelines
   - Accessibility requirements
   - Core visual language

2. COMPONENT SPECS:
   - Component library definitions
   - Interaction patterns
   - State specifications
   - Animation guidelines

3. LAYOUT SPECS:
   - Grid systems
   - Spacing rules
   - Responsive breakpoints
   - Page templates

4. TYPOGRAPHY SPECS:
   - Font families and fallbacks
   - Type scale
   - Line heights
   - Text styles

5. MOCKUPS & TEMPLATES:
   - Approved page designs
   - Component mockups
   - Flow diagrams
   - Prototype references

ENFORCEMENT RULES:

1. NO AD HOC DESIGN:
   - Design work MUST reference approved specs
   - Improvised design output is PROHIBITED
   - Missing specs trigger spec request workflow

2. ACTIVATION REQUIREMENTS:
   - UI personas MUST load design canon on activation
   - Design specs are part of activation context
   - Missing design context blocks design tasks

3. VALIDATION:
   - Design outputs are checked against specs
   - Deviations are flagged with severity
   - Non-compliant work requires remediation

CRITICAL INVARIANTS:
1. Design specs are AUTHORITATIVE, not optional
2. All design decisions MUST be traceable to specs
3. Design governance applies UNIFORMLY across all UI work
4. Spec gaps trigger formal spec creation, not ad hoc work
"""

import hashlib
import json
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class DesignSpecType(Enum):
    """Types of design specifications."""
    FOUNDATION = "foundation"      # Design system principles
    COMPONENT = "component"        # Component definitions
    LAYOUT = "layout"              # Layout and grid specs
    TYPOGRAPHY = "typography"      # Typography rules
    COLOR = "color"                # Color palette and usage
    SPACING = "spacing"            # Spacing and sizing rules
    INTERACTION = "interaction"    # Interaction patterns
    ANIMATION = "animation"        # Motion and animation
    ACCESSIBILITY = "accessibility"  # A11y requirements
    MOCKUP = "mockup"              # Approved mockups
    TEMPLATE = "template"          # Page/component templates
    ICON = "icon"                  # Icon specifications
    IMAGERY = "imagery"            # Image and media guidelines


class DesignTaskType(Enum):
    """Types of design-related tasks."""
    PAGE_DESIGN = "page_design"           # Full page design
    COMPONENT_DESIGN = "component_design"  # Component creation
    LAYOUT_DESIGN = "layout_design"        # Layout work
    STYLE_UPDATE = "style_update"          # Style modifications
    RESPONSIVE_DESIGN = "responsive"       # Responsive work
    INTERACTION_DESIGN = "interaction"     # Interaction patterns
    ICON_DESIGN = "icon_design"            # Icon work
    PROTOTYPE = "prototype"                # Prototyping
    REVIEW = "review"                      # Design review
    DOCUMENTATION = "documentation"        # Design documentation


class ComplianceStatus(Enum):
    """Design compliance status."""
    COMPLIANT = "compliant"          # Fully aligned with specs
    MINOR_DEVIATION = "minor"        # Small deviations, acceptable
    MAJOR_DEVIATION = "major"        # Significant deviations
    NON_COMPLIANT = "non_compliant"  # Spec violations
    NO_SPEC = "no_spec"              # No spec available
    PENDING_REVIEW = "pending"       # Awaiting review


class DesignAction(Enum):
    """Actions for design governance."""
    PROCEED = "proceed"                  # Work can proceed
    LOAD_SPEC = "load_spec"              # Load required spec first
    REQUEST_SPEC = "request_spec"        # Request spec creation
    REVIEW_DEVIATION = "review_deviation"  # Review deviation
    REMEDIATE = "remediate"              # Fix non-compliance
    BLOCK = "block"                      # Block until resolved


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class DesignSpec:
    """
    A canonical design specification document.

    Represents an authoritative design reference that must be
    followed for all related design work.
    """
    # Identification
    spec_id: str = ""
    spec_type: DesignSpecType = DesignSpecType.FOUNDATION
    name: str = ""
    description: str = ""

    # Versioning
    version: str = "1.0.0"
    created_at: str = ""
    updated_at: str = ""
    created_by: str = ""

    # Source
    source_collection: str = "inspire_design_canon"
    source_document: str = ""
    source_path: str = ""

    # Content
    content_hash: str = ""
    content_preview: str = ""

    # Scope
    applies_to: List[str] = field(default_factory=list)  # Personas/tools
    task_types: List[str] = field(default_factory=list)  # Task types
    components: List[str] = field(default_factory=list)  # Component names

    # Authority
    authority_level: str = "primary"  # primary, secondary, guidance
    mandatory: bool = True
    supersedes: List[str] = field(default_factory=list)  # Older spec IDs

    # Status
    status: str = "active"  # active, deprecated, draft
    deprecation_date: str = ""
    replacement_spec_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'spec_id': self.spec_id,
            'spec_type': self.spec_type.value,
            'name': self.name,
            'description': self.description,
            'version': self.version,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'created_by': self.created_by,
            'source': {
                'collection': self.source_collection,
                'document': self.source_document,
                'path': self.source_path,
            },
            'content_hash': self.content_hash,
            'content_preview': self.content_preview,
            'scope': {
                'applies_to': self.applies_to,
                'task_types': self.task_types,
                'components': self.components,
            },
            'authority': {
                'level': self.authority_level,
                'mandatory': self.mandatory,
                'supersedes': self.supersedes,
            },
            'status': {
                'current': self.status,
                'deprecation_date': self.deprecation_date,
                'replacement_spec_id': self.replacement_spec_id,
            },
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DesignSpec':
        """Create from dictionary."""
        spec = cls()
        spec.spec_id = data.get('spec_id', '')
        spec.spec_type = DesignSpecType(data.get('spec_type', 'foundation'))
        spec.name = data.get('name', '')
        spec.description = data.get('description', '')
        spec.version = data.get('version', '1.0.0')
        spec.created_at = data.get('created_at', '')
        spec.updated_at = data.get('updated_at', '')
        spec.created_by = data.get('created_by', '')

        source = data.get('source', {})
        spec.source_collection = source.get('collection', '')
        spec.source_document = source.get('document', '')
        spec.source_path = source.get('path', '')

        spec.content_hash = data.get('content_hash', '')
        spec.content_preview = data.get('content_preview', '')

        scope = data.get('scope', {})
        spec.applies_to = scope.get('applies_to', [])
        spec.task_types = scope.get('task_types', [])
        spec.components = scope.get('components', [])

        authority = data.get('authority', {})
        spec.authority_level = authority.get('level', 'primary')
        spec.mandatory = authority.get('mandatory', True)
        spec.supersedes = authority.get('supersedes', [])

        status = data.get('status', {})
        spec.status = status.get('current', 'active')
        spec.deprecation_date = status.get('deprecation_date', '')
        spec.replacement_spec_id = status.get('replacement_spec_id', '')

        return spec


@dataclass
class DesignRequirement:
    """
    A specific design requirement from a spec.

    Represents a single rule or guideline that must be followed.
    """
    requirement_id: str = ""
    spec_id: str = ""
    category: str = ""  # spacing, color, typography, etc.

    # Content
    description: str = ""
    rationale: str = ""

    # Values
    property_name: str = ""  # e.g., "margin-top", "font-size"
    expected_value: str = ""  # e.g., "16px", "#333333"
    allowed_values: List[str] = field(default_factory=list)
    forbidden_values: List[str] = field(default_factory=list)

    # Enforcement
    severity: str = "error"  # error, warning, info
    auto_fixable: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'requirement_id': self.requirement_id,
            'spec_id': self.spec_id,
            'category': self.category,
            'description': self.description,
            'rationale': self.rationale,
            'property_name': self.property_name,
            'expected_value': self.expected_value,
            'allowed_values': self.allowed_values,
            'forbidden_values': self.forbidden_values,
            'severity': self.severity,
            'auto_fixable': self.auto_fixable,
        }


@dataclass
class DesignDeviation:
    """
    A deviation from design specifications.

    Documents where actual design work differs from the
    authoritative specification.
    """
    deviation_id: str = ""
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Source
    spec_id: str = ""
    requirement_id: str = ""
    spec_name: str = ""

    # Context
    task_id: str = ""
    persona_id: str = ""
    component_name: str = ""
    file_path: str = ""
    line_number: int = 0

    # Deviation details
    category: str = ""
    property_name: str = ""
    expected_value: str = ""
    actual_value: str = ""
    description: str = ""

    # Severity and status
    severity: str = "warning"  # error, warning, info
    status: ComplianceStatus = ComplianceStatus.MINOR_DEVIATION

    # Remediation
    auto_fixable: bool = False
    fix_suggestion: str = ""
    requires_review: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'deviation_id': self.deviation_id,
            'detected_at': self.detected_at,
            'spec': {
                'spec_id': self.spec_id,
                'requirement_id': self.requirement_id,
                'spec_name': self.spec_name,
            },
            'context': {
                'task_id': self.task_id,
                'persona_id': self.persona_id,
                'component_name': self.component_name,
                'file_path': self.file_path,
                'line_number': self.line_number,
            },
            'deviation': {
                'category': self.category,
                'property_name': self.property_name,
                'expected_value': self.expected_value,
                'actual_value': self.actual_value,
                'description': self.description,
            },
            'severity': self.severity,
            'status': self.status.value,
            'remediation': {
                'auto_fixable': self.auto_fixable,
                'fix_suggestion': self.fix_suggestion,
                'requires_review': self.requires_review,
            },
        }


@dataclass
class DesignContext:
    """
    Design context loaded for a persona activation.

    Contains all relevant design specs needed for a
    design-related task.
    """
    context_id: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Persona
    persona_id: str = ""
    task_type: DesignTaskType = DesignTaskType.COMPONENT_DESIGN

    # Loaded specs
    foundation_specs: List[DesignSpec] = field(default_factory=list)
    component_specs: List[DesignSpec] = field(default_factory=list)
    layout_specs: List[DesignSpec] = field(default_factory=list)
    typography_specs: List[DesignSpec] = field(default_factory=list)
    color_specs: List[DesignSpec] = field(default_factory=list)
    mockups: List[DesignSpec] = field(default_factory=list)

    # Requirements
    active_requirements: List[DesignRequirement] = field(default_factory=list)

    # Status
    complete: bool = False
    missing_specs: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def all_specs(self) -> List[DesignSpec]:
        """Get all loaded specs."""
        return (
            self.foundation_specs +
            self.component_specs +
            self.layout_specs +
            self.typography_specs +
            self.color_specs +
            self.mockups
        )

    @property
    def spec_count(self) -> int:
        """Get total spec count."""
        return len(self.all_specs)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'context_id': self.context_id,
            'created_at': self.created_at,
            'persona_id': self.persona_id,
            'task_type': self.task_type.value,
            'specs': {
                'foundation': [s.to_dict() for s in self.foundation_specs],
                'component': [s.to_dict() for s in self.component_specs],
                'layout': [s.to_dict() for s in self.layout_specs],
                'typography': [s.to_dict() for s in self.typography_specs],
                'color': [s.to_dict() for s in self.color_specs],
                'mockups': [s.to_dict() for s in self.mockups],
            },
            'requirements_count': len(self.active_requirements),
            'status': {
                'complete': self.complete,
                'missing_specs': self.missing_specs,
                'warnings': self.warnings,
            },
        }


@dataclass
class DesignGateDecision:
    """
    Decision from a design governance gate check.

    Determines whether design work can proceed and what
    actions are required.
    """
    # Decision
    allowed: bool = False
    action: DesignAction = DesignAction.BLOCK

    # Context
    task_type: DesignTaskType = DesignTaskType.COMPONENT_DESIGN
    persona_id: str = ""

    # Specs
    required_specs: List[str] = field(default_factory=list)
    loaded_specs: List[str] = field(default_factory=list)
    missing_specs: List[str] = field(default_factory=list)

    # Reasons
    blocking_reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Requirements
    required_actions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'allowed': self.allowed,
            'action': self.action.value,
            'task_type': self.task_type.value,
            'persona_id': self.persona_id,
            'specs': {
                'required': self.required_specs,
                'loaded': self.loaded_specs,
                'missing': self.missing_specs,
            },
            'reasons': {
                'blocking': self.blocking_reasons,
                'warnings': self.warnings,
            },
            'required_actions': self.required_actions,
        }


@dataclass
class DesignComplianceResult:
    """
    Result of a design compliance check.

    Evaluates design work against loaded specifications.
    """
    result_id: str = ""
    checked_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Context
    task_id: str = ""
    persona_id: str = ""
    context_id: str = ""

    # Overall status
    status: ComplianceStatus = ComplianceStatus.PENDING_REVIEW
    compliance_score: float = 0.0  # 0-100

    # Specs checked
    specs_checked: List[str] = field(default_factory=list)
    requirements_checked: int = 0
    requirements_passed: int = 0
    requirements_failed: int = 0

    # Deviations
    deviations: List[DesignDeviation] = field(default_factory=list)
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0

    # Summary
    summary: str = ""
    requires_remediation: bool = False

    def add_deviation(self, deviation: DesignDeviation):
        """Add a deviation and update counts."""
        self.deviations.append(deviation)

        if deviation.severity == "error":
            self.error_count += 1
        elif deviation.severity == "warning":
            self.warning_count += 1
        else:
            self.info_count += 1

        self.requirements_failed += 1

    def calculate_score(self):
        """Calculate compliance score."""
        if self.requirements_checked == 0:
            self.compliance_score = 0.0
            return

        # Weight: errors = -10, warnings = -3, info = -1
        penalty = (self.error_count * 10) + (self.warning_count * 3) + self.info_count
        max_penalty = self.requirements_checked * 10

        self.compliance_score = max(0.0, 100.0 - (penalty / max_penalty * 100))

        # Determine status
        if self.error_count > 0:
            self.status = ComplianceStatus.NON_COMPLIANT
            self.requires_remediation = True
        elif self.warning_count > 0:
            self.status = ComplianceStatus.MAJOR_DEVIATION
        elif self.info_count > 0:
            self.status = ComplianceStatus.MINOR_DEVIATION
        else:
            self.status = ComplianceStatus.COMPLIANT

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'result_id': self.result_id,
            'checked_at': self.checked_at,
            'context': {
                'task_id': self.task_id,
                'persona_id': self.persona_id,
                'context_id': self.context_id,
            },
            'status': self.status.value,
            'compliance_score': self.compliance_score,
            'requirements': {
                'checked': self.requirements_checked,
                'passed': self.requirements_passed,
                'failed': self.requirements_failed,
            },
            'deviations': [d.to_dict() for d in self.deviations],
            'counts': {
                'errors': self.error_count,
                'warnings': self.warning_count,
                'info': self.info_count,
            },
            'summary': self.summary,
            'requires_remediation': self.requires_remediation,
        }


# =============================================================================
# DESIGN GOVERNANCE CONFIG
# =============================================================================

@dataclass
class DesignGovernanceConfig:
    """Configuration for design governance."""

    # UI-focused personas that require design governance
    ui_personas: List[str] = field(default_factory=lambda: [
        'inspire_designer',
        'inspire_frontend',
        'inspire_ui',
    ])

    # Task types that require design specs
    governed_task_types: List[DesignTaskType] = field(default_factory=lambda: [
        DesignTaskType.PAGE_DESIGN,
        DesignTaskType.COMPONENT_DESIGN,
        DesignTaskType.LAYOUT_DESIGN,
        DesignTaskType.STYLE_UPDATE,
        DesignTaskType.RESPONSIVE_DESIGN,
        DesignTaskType.INTERACTION_DESIGN,
        DesignTaskType.ICON_DESIGN,
        DesignTaskType.PROTOTYPE,
    ])

    # Required spec types by task type
    required_specs: Dict[str, List[DesignSpecType]] = field(default_factory=lambda: {
        'page_design': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.LAYOUT,
            DesignSpecType.TYPOGRAPHY,
            DesignSpecType.COLOR,
            DesignSpecType.SPACING,
        ],
        'component_design': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.COMPONENT,
            DesignSpecType.SPACING,
            DesignSpecType.INTERACTION,
        ],
        'layout_design': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.LAYOUT,
            DesignSpecType.SPACING,
        ],
        'style_update': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.TYPOGRAPHY,
            DesignSpecType.COLOR,
            DesignSpecType.SPACING,
        ],
        'responsive': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.LAYOUT,
        ],
        'interaction': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.INTERACTION,
            DesignSpecType.ANIMATION,
        ],
        'icon_design': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.ICON,
        ],
        'prototype': [
            DesignSpecType.FOUNDATION,
            DesignSpecType.MOCKUP,
            DesignSpecType.INTERACTION,
        ],
    })

    # Enforcement settings
    block_without_spec: bool = True
    require_mockup_reference: bool = True
    allow_minor_deviations: bool = True
    max_warnings_allowed: int = 5

    # Compliance thresholds
    min_compliance_score: float = 80.0
    require_foundation_spec: bool = True

    # Paths
    specs_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/design/specs'
    ))
    templates_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/design/templates'
    ))
    mockups_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/design/mockups'
    ))


# =============================================================================
# DESIGN SPEC REGISTRY
# =============================================================================

class DesignSpecRegistry:
    """
    Registry of available design specifications.

    Manages loading, caching, and retrieval of design specs
    from the canon collections.
    """

    def __init__(self, config: DesignGovernanceConfig = None):
        self.config = config or DesignGovernanceConfig()
        self._specs: Dict[str, DesignSpec] = {}
        self._specs_by_type: Dict[DesignSpecType, List[DesignSpec]] = {}
        self._lock = threading.Lock()

        # Ensure directories exist
        self.config.specs_dir.mkdir(parents=True, exist_ok=True)
        self.config.templates_dir.mkdir(parents=True, exist_ok=True)
        self.config.mockups_dir.mkdir(parents=True, exist_ok=True)

        # Load specs
        self._load_specs()

    def _load_specs(self):
        """Load specs from the specs directory."""
        for spec_file in self.config.specs_dir.glob('**/*.json'):
            try:
                data = json.loads(spec_file.read_text(encoding='utf-8'))
                spec = DesignSpec.from_dict(data)
                self.register_spec(spec)
            except Exception as e:
                logger.error(f"Error loading spec {spec_file}: {e}")

    def register_spec(self, spec: DesignSpec):
        """Register a design spec."""
        with self._lock:
            self._specs[spec.spec_id] = spec

            if spec.spec_type not in self._specs_by_type:
                self._specs_by_type[spec.spec_type] = []
            self._specs_by_type[spec.spec_type].append(spec)

    def get_spec(self, spec_id: str) -> Optional[DesignSpec]:
        """Get a spec by ID."""
        return self._specs.get(spec_id)

    def get_specs_by_type(self, spec_type: DesignSpecType) -> List[DesignSpec]:
        """Get all specs of a given type."""
        return self._specs_by_type.get(spec_type, [])

    def get_specs_for_task(
        self,
        task_type: DesignTaskType,
        component_name: str = ""
    ) -> List[DesignSpec]:
        """Get all relevant specs for a task type."""
        required_types = self.config.required_specs.get(task_type.value, [])

        specs = []
        for spec_type in required_types:
            type_specs = self.get_specs_by_type(spec_type)
            for spec in type_specs:
                # Filter by component if specified
                if component_name:
                    if not spec.components or component_name in spec.components:
                        specs.append(spec)
                else:
                    specs.append(spec)

        return specs

    def get_specs_for_persona(self, persona_id: str) -> List[DesignSpec]:
        """Get all specs applicable to a persona."""
        specs = []
        for spec in self._specs.values():
            if not spec.applies_to or persona_id in spec.applies_to:
                specs.append(spec)
        return specs

    def list_specs(self) -> List[str]:
        """List all spec IDs."""
        return list(self._specs.keys())

    def save_spec(self, spec: DesignSpec):
        """Save a spec to disk."""
        spec_file = self.config.specs_dir / f"{spec.spec_id}.json"
        spec_file.write_text(
            json.dumps(spec.to_dict(), indent=2),
            encoding='utf-8'
        )
        self.register_spec(spec)


# =============================================================================
# DESIGN GOVERNANCE ENFORCER
# =============================================================================

class DesignGovernanceEnforcer:
    """
    Enforces design governance rules.

    Ensures all design work follows approved specifications
    and templates.
    """

    def __init__(self, config: DesignGovernanceConfig = None):
        self.config = config or DesignGovernanceConfig()
        self.registry = DesignSpecRegistry(config)
        self._active_contexts: Dict[str, DesignContext] = {}
        self._lock = threading.Lock()

    def check_design_gate(
        self,
        persona_id: str,
        task_type: DesignTaskType,
        component_name: str = "",
        mockup_reference: str = ""
    ) -> DesignGateDecision:
        """
        Check if design work can proceed.

        Args:
            persona_id: The persona attempting design work
            task_type: Type of design task
            component_name: Optional component being designed
            mockup_reference: Optional mockup/template reference

        Returns:
            DesignGateDecision indicating if work can proceed
        """
        decision = DesignGateDecision(
            task_type=task_type,
            persona_id=persona_id,
        )

        # Check if persona requires design governance
        if persona_id not in self.config.ui_personas:
            # Non-UI personas don't need design governance
            decision.allowed = True
            decision.action = DesignAction.PROCEED
            decision.warnings.append(
                f"Persona {persona_id} not subject to design governance"
            )
            return decision

        # Check if task type requires governance
        if task_type not in self.config.governed_task_types:
            decision.allowed = True
            decision.action = DesignAction.PROCEED
            decision.warnings.append(
                f"Task type {task_type.value} not governed"
            )
            return decision

        # Get required specs
        required_types = self.config.required_specs.get(task_type.value, [])
        decision.required_specs = [t.value for t in required_types]

        # Check foundation spec requirement
        if self.config.require_foundation_spec:
            foundation_specs = self.registry.get_specs_by_type(DesignSpecType.FOUNDATION)
            if not foundation_specs:
                decision.missing_specs.append("foundation")
                decision.blocking_reasons.append(
                    "Foundation design spec is required but not available"
                )

        # Check for required spec types
        for spec_type in required_types:
            specs = self.registry.get_specs_by_type(spec_type)
            if specs:
                decision.loaded_specs.append(spec_type.value)
            else:
                decision.missing_specs.append(spec_type.value)

        # Check mockup requirement
        if self.config.require_mockup_reference:
            if task_type in [
                DesignTaskType.PAGE_DESIGN,
                DesignTaskType.COMPONENT_DESIGN,
                DesignTaskType.PROTOTYPE,
            ]:
                if not mockup_reference:
                    mockup_specs = self.registry.get_specs_by_type(DesignSpecType.MOCKUP)
                    if not mockup_specs:
                        decision.warnings.append(
                            "No mockup reference provided and no mockups available"
                        )
                        if self.config.block_without_spec:
                            decision.missing_specs.append("mockup")

        # Determine action
        if decision.missing_specs:
            if self.config.block_without_spec:
                decision.allowed = False
                decision.action = DesignAction.REQUEST_SPEC
                decision.blocking_reasons.append(
                    f"Missing required specs: {', '.join(decision.missing_specs)}"
                )
                decision.required_actions.append(
                    "Locate or create required design specifications"
                )
            else:
                decision.allowed = True
                decision.action = DesignAction.LOAD_SPEC
                decision.warnings.append(
                    f"Proceeding with missing specs: {', '.join(decision.missing_specs)}"
                )
        else:
            decision.allowed = True
            decision.action = DesignAction.PROCEED

        return decision

    def create_design_context(
        self,
        persona_id: str,
        task_type: DesignTaskType,
        component_name: str = ""
    ) -> DesignContext:
        """
        Create a design context with loaded specs.

        Called during persona activation for design tasks.

        Args:
            persona_id: The persona being activated
            task_type: Type of design task
            component_name: Optional component focus

        Returns:
            DesignContext with loaded specs
        """
        import uuid

        context = DesignContext(
            context_id=str(uuid.uuid4()),
            persona_id=persona_id,
            task_type=task_type,
        )

        # Load specs by type
        context.foundation_specs = self.registry.get_specs_by_type(
            DesignSpecType.FOUNDATION
        )
        context.component_specs = self.registry.get_specs_by_type(
            DesignSpecType.COMPONENT
        )
        context.layout_specs = self.registry.get_specs_by_type(
            DesignSpecType.LAYOUT
        )
        context.typography_specs = self.registry.get_specs_by_type(
            DesignSpecType.TYPOGRAPHY
        )
        context.color_specs = self.registry.get_specs_by_type(
            DesignSpecType.COLOR
        )
        context.mockups = self.registry.get_specs_by_type(
            DesignSpecType.MOCKUP
        )

        # Check for required specs
        required_types = self.config.required_specs.get(task_type.value, [])
        for spec_type in required_types:
            specs = self.registry.get_specs_by_type(spec_type)
            if not specs:
                context.missing_specs.append(spec_type.value)

        context.complete = len(context.missing_specs) == 0

        # Store context
        with self._lock:
            self._active_contexts[context.context_id] = context

        return context

    def validate_design_output(
        self,
        context_id: str,
        output_description: str,
        properties: Dict[str, Any] = None
    ) -> DesignComplianceResult:
        """
        Validate design output against loaded specs.

        Args:
            context_id: ID of the design context
            output_description: Description of the design output
            properties: Design properties to validate

        Returns:
            DesignComplianceResult with validation details
        """
        import uuid

        result = DesignComplianceResult(
            result_id=str(uuid.uuid4()),
            context_id=context_id,
        )

        # Get context
        context = self._active_contexts.get(context_id)
        if not context:
            result.status = ComplianceStatus.NO_SPEC
            result.summary = "Design context not found"
            return result

        result.persona_id = context.persona_id

        # Basic validation - in production, this would do deeper analysis
        # For now, check that required spec types are present

        for spec in context.all_specs:
            result.specs_checked.append(spec.spec_id)
            result.requirements_checked += 1
            result.requirements_passed += 1

        if context.missing_specs:
            for missing in context.missing_specs:
                deviation = DesignDeviation(
                    deviation_id=str(uuid.uuid4()),
                    category="spec_coverage",
                    description=f"Missing required spec type: {missing}",
                    severity="warning",
                    status=ComplianceStatus.NO_SPEC,
                )
                result.add_deviation(deviation)

        result.calculate_score()

        if result.compliance_score >= self.config.min_compliance_score:
            result.summary = "Design output meets compliance requirements"
        else:
            result.summary = (
                f"Design output compliance score ({result.compliance_score:.1f}) "
                f"below minimum ({self.config.min_compliance_score})"
            )
            result.requires_remediation = True

        return result

    def get_context(self, context_id: str) -> Optional[DesignContext]:
        """Get a design context by ID."""
        return self._active_contexts.get(context_id)


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_enforcer: Optional[DesignGovernanceEnforcer] = None
_enforcer_lock = threading.Lock()


def get_design_enforcer() -> DesignGovernanceEnforcer:
    """Get the global design governance enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        if _global_enforcer is None:
            _global_enforcer = DesignGovernanceEnforcer()
        return _global_enforcer


def set_design_enforcer(enforcer: DesignGovernanceEnforcer):
    """Set the global design governance enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        _global_enforcer = enforcer


def reset_design_enforcer():
    """Reset to default design governance enforcer."""
    global _global_enforcer
    with _enforcer_lock:
        _global_enforcer = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def check_design_gate(
    persona_id: str,
    task_type: DesignTaskType,
    component_name: str = "",
    mockup_reference: str = ""
) -> DesignGateDecision:
    """
    Check if design work can proceed.

    Example:
        decision = check_design_gate(
            persona_id="inspire_designer",
            task_type=DesignTaskType.COMPONENT_DESIGN,
            component_name="Button",
        )

        if not decision.allowed:
            print(f"Blocked: {decision.blocking_reasons}")
    """
    enforcer = get_design_enforcer()
    return enforcer.check_design_gate(
        persona_id=persona_id,
        task_type=task_type,
        component_name=component_name,
        mockup_reference=mockup_reference,
    )


def require_design_spec(
    persona_id: str,
    task_type: DesignTaskType,
    component_name: str = ""
) -> DesignContext:
    """
    Require and load design specs for a task.

    Raises DesignGovernanceError if specs cannot be loaded.

    Example:
        context = require_design_spec(
            persona_id="inspire_designer",
            task_type=DesignTaskType.PAGE_DESIGN,
        )

        print(f"Loaded {context.spec_count} specs")
    """
    enforcer = get_design_enforcer()

    # Check gate first
    decision = enforcer.check_design_gate(
        persona_id=persona_id,
        task_type=task_type,
        component_name=component_name,
    )

    if not decision.allowed:
        raise DesignGovernanceError(
            f"Design work blocked: {'; '.join(decision.blocking_reasons)}"
        )

    # Create context
    return enforcer.create_design_context(
        persona_id=persona_id,
        task_type=task_type,
        component_name=component_name,
    )


class DesignGovernanceError(Exception):
    """Exception raised when design governance blocks an operation."""
    pass
