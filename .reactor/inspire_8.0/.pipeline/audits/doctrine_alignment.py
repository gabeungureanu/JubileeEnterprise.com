# =============================================================================
# DOCTRINE ALIGNMENT AUDIT
# =============================================================================
"""
Doctrine alignment audit for the Inspire 8.0 pipeline.

This module evaluates persona-generated outputs against the authoritative
Canon specification and defined persona boundaries to detect drift,
inconsistencies, and theological deviations.

AUDIT PROCESS:
1. Sample outputs from conversation memory
2. Load authoritative doctrine from Canon
3. Evaluate each output against doctrine
4. Flag deviations with severity levels
5. Generate structured findings

DEVIATION TYPES:
- DOCTRINAL: Contradicts core theological positions
- BOUNDARY: Exceeds persona scope or role
- TONAL: Violates tone/style requirements
- SCRIPTURAL: Misuses or misattributes scripture
- AMBIGUITY: Unclear or potentially misleading

SEVERITY LEVELS:
- CRITICAL: Must be addressed immediately
- HIGH: Requires review before next deployment
- MEDIUM: Should be addressed in next iteration
- LOW: For awareness, monitor over time
"""

import hashlib
import json
import logging
import os
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class DeviationType(Enum):
    """Types of doctrine deviations."""
    DOCTRINAL = "doctrinal"      # Contradicts theology
    BOUNDARY = "boundary"        # Exceeds persona scope
    TONAL = "tonal"              # Tone/style violation
    SCRIPTURAL = "scriptural"    # Scripture misuse
    AMBIGUITY = "ambiguity"      # Unclear/misleading
    AUTHORITY = "authority"      # Authority foundation violation
    CONSISTENCY = "consistency"  # Internal inconsistency


class DeviationSeverity(Enum):
    """Severity levels for deviations."""
    CRITICAL = "critical"  # Immediate action required
    HIGH = "high"          # Review before deployment
    MEDIUM = "medium"      # Address in next iteration
    LOW = "low"            # Monitor over time

    @property
    def blocking(self) -> bool:
        """Whether this severity blocks further operations."""
        return self in (DeviationSeverity.CRITICAL, DeviationSeverity.HIGH)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class DoctrineDeviation:
    """
    A single doctrine deviation finding.

    Captures all information about a detected deviation including
    the source interaction, deviation type, and remediation guidance.
    """
    # Identification
    deviation_id: str = ""
    audit_id: str = ""

    # Source
    interaction_id: str = ""
    session_id: str = ""
    persona_id: str = ""
    timestamp: str = ""

    # Classification
    deviation_type: DeviationType = DeviationType.AMBIGUITY
    severity: DeviationSeverity = DeviationSeverity.LOW

    # Content
    user_message: str = ""
    persona_response: str = ""
    problematic_segment: str = ""

    # Doctrine reference
    violated_doctrine: str = ""
    doctrine_source: str = ""
    canon_reference: str = ""

    # Analysis
    explanation: str = ""
    confidence: float = 0.0

    # Remediation
    remediation_hint: str = ""
    requires_manual_review: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'deviation_id': self.deviation_id,
            'audit_id': self.audit_id,
            'interaction_id': self.interaction_id,
            'session_id': self.session_id,
            'persona_id': self.persona_id,
            'timestamp': self.timestamp,
            'deviation_type': self.deviation_type.value,
            'severity': self.severity.value,
            'user_message': self.user_message,
            'persona_response': self.persona_response,
            'problematic_segment': self.problematic_segment,
            'violated_doctrine': self.violated_doctrine,
            'doctrine_source': self.doctrine_source,
            'canon_reference': self.canon_reference,
            'explanation': self.explanation,
            'confidence': self.confidence,
            'remediation_hint': self.remediation_hint,
            'requires_manual_review': self.requires_manual_review,
        }


@dataclass
class DoctrineAuditResult:
    """
    Complete result of a doctrine alignment audit.

    Contains all findings, statistics, and recommendations.
    """
    # Identification
    audit_id: str = ""
    audit_timestamp: str = ""
    audit_type: str = "doctrine_alignment"

    # Scope
    persona_id: str = ""
    personas_audited: List[str] = field(default_factory=list)
    sample_size: int = 0
    sample_period_start: str = ""
    sample_period_end: str = ""

    # Findings
    total_deviations: int = 0
    deviations: List[DoctrineDeviation] = field(default_factory=list)

    # By severity
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0

    # By type
    by_type: Dict[str, int] = field(default_factory=dict)

    # Status
    passed: bool = True
    blocking_issues: bool = False
    requires_review: bool = False

    # Recommendations
    recommendations: List[str] = field(default_factory=list)

    # Metadata
    canon_version: str = ""
    auditor_version: str = "1.0.0"

    def add_deviation(self, deviation: DoctrineDeviation):
        """Add a deviation to the result."""
        self.deviations.append(deviation)
        self.total_deviations = len(self.deviations)

        # Update counts
        if deviation.severity == DeviationSeverity.CRITICAL:
            self.critical_count += 1
        elif deviation.severity == DeviationSeverity.HIGH:
            self.high_count += 1
        elif deviation.severity == DeviationSeverity.MEDIUM:
            self.medium_count += 1
        else:
            self.low_count += 1

        # Update by type
        type_key = deviation.deviation_type.value
        if type_key not in self.by_type:
            self.by_type[type_key] = 0
        self.by_type[type_key] += 1

        # Update status
        if deviation.severity.blocking:
            self.passed = False
            self.blocking_issues = True
        if deviation.requires_manual_review:
            self.requires_review = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'audit_id': self.audit_id,
            'audit_timestamp': self.audit_timestamp,
            'audit_type': self.audit_type,
            'persona_id': self.persona_id,
            'personas_audited': self.personas_audited,
            'sample_size': self.sample_size,
            'sample_period_start': self.sample_period_start,
            'sample_period_end': self.sample_period_end,
            'summary': {
                'total_deviations': self.total_deviations,
                'critical_count': self.critical_count,
                'high_count': self.high_count,
                'medium_count': self.medium_count,
                'low_count': self.low_count,
                'by_type': self.by_type,
            },
            'status': {
                'passed': self.passed,
                'blocking_issues': self.blocking_issues,
                'requires_review': self.requires_review,
            },
            'deviations': [d.to_dict() for d in self.deviations],
            'recommendations': self.recommendations,
            'metadata': {
                'canon_version': self.canon_version,
                'auditor_version': self.auditor_version,
            },
        }


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class DoctrineAuditConfig:
    """Configuration for doctrine alignment audits."""

    # Sampling
    default_sample_size: int = 100
    sample_period_days: int = 7
    min_sample_for_audit: int = 10

    # Confidence thresholds
    high_confidence_threshold: float = 0.85
    medium_confidence_threshold: float = 0.70
    low_confidence_threshold: float = 0.50

    # Severity escalation
    escalate_repeated_issues: bool = True
    repetition_threshold: int = 3

    # Canon sources
    canon_collection: str = "inspire_authority_foundation"
    persona_collection: str = "inspire_canonical_personas"

    # Log directories
    audit_output_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/audits/results'
    ))
    interaction_log_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/execution'
    ))

    # Available personas
    personas: List[str] = field(default_factory=lambda: [
        'inspire_foundation',
        'inspire_pastor',
        'inspire_teacher',
        'inspire_counselor',
        'inspire_scholar',
    ])


# =============================================================================
# DOCTRINE CHECKER
# =============================================================================

class DoctrineChecker:
    """
    Checks outputs against doctrine standards.

    In production, this would use embeddings and semantic similarity
    to compare against the Canon. For now, uses rule-based checking.
    """

    def __init__(self, config: DoctrineAuditConfig):
        self.config = config

        # Core doctrines to check (simplified for demonstration)
        self.core_doctrines = {
            'trinity': {
                'keywords': ['trinity', 'father', 'son', 'holy spirit', 'godhead'],
                'required_stance': 'One God in three persons',
                'violations': ['modalism', 'tritheism', 'arianism'],
            },
            'scripture_authority': {
                'keywords': ['bible', 'scripture', 'word of god', 'biblical'],
                'required_stance': 'Scripture as ultimate authority',
                'violations': ['tradition over scripture', 'relativism'],
            },
            'salvation_grace': {
                'keywords': ['salvation', 'saved', 'grace', 'faith', 'gospel'],
                'required_stance': 'Salvation by grace through faith',
                'violations': ['works-based', 'universalism without repentance'],
            },
            'christ_deity': {
                'keywords': ['jesus', 'christ', 'lord', 'savior', 'messiah'],
                'required_stance': 'Jesus is fully God and fully man',
                'violations': ['docetism', 'adoptionism', 'denial of deity'],
            },
        }

        # Boundary rules per persona
        self.persona_boundaries = {
            'inspire_pastor': {
                'scope': ['spiritual guidance', 'pastoral care', 'prayer'],
                'restrictions': ['medical advice', 'legal advice', 'financial planning'],
                'tone': ['warm', 'empathetic', 'non-judgmental'],
            },
            'inspire_teacher': {
                'scope': ['education', 'explanation', 'doctrine teaching'],
                'restrictions': ['counseling', 'diagnosis', 'personal advice'],
                'tone': ['clear', 'accurate', 'educational'],
            },
            'inspire_counselor': {
                'scope': ['emotional support', 'guidance', 'listening'],
                'restrictions': ['therapy', 'diagnosis', 'medication'],
                'tone': ['empathetic', 'supportive', 'safe'],
            },
            'inspire_scholar': {
                'scope': ['research', 'analysis', 'theology', 'apologetics'],
                'restrictions': ['pastoral care', 'emotional counseling'],
                'tone': ['scholarly', 'precise', 'referenced'],
            },
        }

    def check_doctrinal_alignment(
        self,
        response: str,
        persona_id: str
    ) -> List[DoctrineDeviation]:
        """
        Check a response for doctrinal alignment.

        Args:
            response: The persona's response
            persona_id: The persona that generated the response

        Returns:
            List of deviations found
        """
        deviations = []
        response_lower = response.lower()

        # Check core doctrines
        for doctrine_name, doctrine in self.core_doctrines.items():
            # Check if doctrine topic is mentioned
            if any(kw in response_lower for kw in doctrine['keywords']):
                # Check for violations
                for violation in doctrine['violations']:
                    if violation.lower() in response_lower:
                        deviation = DoctrineDeviation(
                            deviation_type=DeviationType.DOCTRINAL,
                            severity=DeviationSeverity.CRITICAL,
                            violated_doctrine=doctrine_name,
                            problematic_segment=self._extract_segment(response, violation),
                            explanation=f"Response may contain {violation} which contradicts {doctrine['required_stance']}",
                            confidence=0.70,
                            remediation_hint=f"Review response for {doctrine_name} doctrine alignment",
                            requires_manual_review=True,
                        )
                        deviations.append(deviation)

        return deviations

    def check_boundary_compliance(
        self,
        response: str,
        persona_id: str
    ) -> List[DoctrineDeviation]:
        """
        Check a response for persona boundary compliance.

        Args:
            response: The persona's response
            persona_id: The persona that generated the response

        Returns:
            List of deviations found
        """
        deviations = []
        response_lower = response.lower()

        # Get persona boundaries
        boundaries = self.persona_boundaries.get(persona_id, {})
        restrictions = boundaries.get('restrictions', [])

        # Check for boundary violations
        for restriction in restrictions:
            restriction_lower = restriction.lower()
            if restriction_lower in response_lower:
                # Check for actual advice-giving patterns
                advice_patterns = [
                    f"you should",
                    f"i recommend",
                    f"take",
                    f"consult",
                ]
                if any(pattern in response_lower for pattern in advice_patterns):
                    deviation = DoctrineDeviation(
                        deviation_type=DeviationType.BOUNDARY,
                        severity=DeviationSeverity.HIGH,
                        violated_doctrine=f"Persona boundary: {restriction}",
                        problematic_segment=self._extract_segment(response, restriction),
                        explanation=f"Response may be providing {restriction} which is outside {persona_id} scope",
                        confidence=0.65,
                        remediation_hint=f"Ensure {persona_id} refers users to appropriate professionals for {restriction}",
                        requires_manual_review=True,
                    )
                    deviations.append(deviation)

        return deviations

    def check_scriptural_accuracy(
        self,
        response: str,
        persona_id: str
    ) -> List[DoctrineDeviation]:
        """
        Check scriptural references for accuracy.

        Args:
            response: The persona's response
            persona_id: The persona that generated the response

        Returns:
            List of deviations found
        """
        deviations = []

        # Simple scripture reference pattern
        scripture_pattern = r'(\d?\s?[A-Za-z]+)\s+(\d+):(\d+(?:-\d+)?)'
        matches = re.findall(scripture_pattern, response)

        for match in matches:
            book, chapter, verse = match
            # In production: verify against scripture database
            # For now, flag references that need verification
            if int(chapter) > 50 or (verse.isdigit() and int(verse) > 100):
                deviation = DoctrineDeviation(
                    deviation_type=DeviationType.SCRIPTURAL,
                    severity=DeviationSeverity.MEDIUM,
                    violated_doctrine="Scripture accuracy",
                    problematic_segment=f"{book} {chapter}:{verse}",
                    explanation="Scripture reference may be invalid or inaccurate",
                    confidence=0.60,
                    remediation_hint="Verify scripture reference exists and is correctly cited",
                    requires_manual_review=True,
                )
                deviations.append(deviation)

        return deviations

    def check_tonal_compliance(
        self,
        response: str,
        persona_id: str
    ) -> List[DoctrineDeviation]:
        """
        Check response tone for persona compliance.

        Args:
            response: The persona's response
            persona_id: The persona that generated the response

        Returns:
            List of deviations found
        """
        deviations = []
        response_lower = response.lower()

        # Negative tone indicators
        negative_indicators = [
            ('judgmental', ['you are wrong', 'shame on you', 'how dare you']),
            ('harsh', ['stupid', 'foolish', 'idiot', 'nonsense']),
            ('dismissive', ["don't bother", "that's ridiculous", "whatever"]),
            ('condescending', ['obviously', 'as anyone knows', 'clearly you']),
        ]

        for indicator_type, patterns in negative_indicators:
            for pattern in patterns:
                if pattern in response_lower:
                    deviation = DoctrineDeviation(
                        deviation_type=DeviationType.TONAL,
                        severity=DeviationSeverity.HIGH,
                        violated_doctrine=f"Tone requirement: non-{indicator_type}",
                        problematic_segment=self._extract_segment(response, pattern),
                        explanation=f"Response contains {indicator_type} language which violates persona tone requirements",
                        confidence=0.80,
                        remediation_hint=f"Revise to remove {indicator_type} language and maintain pastoral warmth",
                        requires_manual_review=True,
                    )
                    deviations.append(deviation)

        return deviations

    def _extract_segment(self, text: str, keyword: str, context_chars: int = 100) -> str:
        """Extract a segment around a keyword."""
        lower_text = text.lower()
        pos = lower_text.find(keyword.lower())
        if pos == -1:
            return ""

        start = max(0, pos - context_chars)
        end = min(len(text), pos + len(keyword) + context_chars)

        segment = text[start:end]
        if start > 0:
            segment = "..." + segment
        if end < len(text):
            segment = segment + "..."

        return segment


# =============================================================================
# DOCTRINE ALIGNMENT AUDIT
# =============================================================================

class DoctrineAlignmentAudit:
    """
    Main class for doctrine alignment auditing.

    Samples persona outputs, evaluates against doctrine,
    and generates comprehensive audit reports.
    """

    def __init__(self, config: DoctrineAuditConfig = None):
        self.config = config or DoctrineAuditConfig()
        self.checker = DoctrineChecker(self.config)
        self._lock = threading.Lock()

    def run_audit(
        self,
        persona_id: str = None,
        sample_size: int = None,
        period_days: int = None
    ) -> DoctrineAuditResult:
        """
        Run a doctrine alignment audit.

        Args:
            persona_id: Specific persona to audit (None = all)
            sample_size: Number of interactions to sample
            period_days: Days of history to sample from

        Returns:
            DoctrineAuditResult with findings
        """
        import uuid

        sample_size = sample_size or self.config.default_sample_size
        period_days = period_days or self.config.sample_period_days

        # Create result
        result = DoctrineAuditResult(
            audit_id=str(uuid.uuid4()),
            audit_timestamp=datetime.now().isoformat(),
            persona_id=persona_id or "all",
            sample_period_end=datetime.now().isoformat(),
            sample_period_start=(datetime.now() - timedelta(days=period_days)).isoformat(),
        )

        # Determine personas to audit
        if persona_id:
            personas = [persona_id]
        else:
            personas = self.config.personas

        result.personas_audited = personas

        logger.info("=" * 60)
        logger.info("INSPIRE 8.0 DOCTRINE ALIGNMENT AUDIT")
        logger.info("=" * 60)
        logger.info(f"Personas: {', '.join(personas)}")
        logger.info(f"Sample size: {sample_size}")
        logger.info(f"Period: {period_days} days")
        logger.info("=" * 60)

        # Sample and audit each persona
        total_sampled = 0
        for pid in personas:
            logger.info(f"Auditing persona: {pid}")

            # Sample interactions
            interactions = self._sample_interactions(pid, sample_size, period_days)
            total_sampled += len(interactions)
            logger.info(f"  Sampled {len(interactions)} interactions")

            # Audit each interaction
            for interaction in interactions:
                deviations = self._audit_interaction(interaction, pid)
                for deviation in deviations:
                    deviation.audit_id = result.audit_id
                    deviation.persona_id = pid
                    result.add_deviation(deviation)

        result.sample_size = total_sampled

        # Generate recommendations
        result.recommendations = self._generate_recommendations(result)

        # Log summary
        self._log_summary(result)

        # Save result
        self._save_result(result)

        return result

    def _sample_interactions(
        self,
        persona_id: str,
        sample_size: int,
        period_days: int
    ) -> List[Dict[str, Any]]:
        """
        Sample interactions from conversation memory.

        In production: query Qdrant or log files.
        For demonstration: return mock data.
        """
        # In production: query actual interaction logs
        # Mock interactions for demonstration
        interactions = []

        # Generate some mock interactions
        for i in range(min(sample_size // len(self.config.personas), 5)):
            interactions.append({
                'interaction_id': f'int_{persona_id}_{i:04d}',
                'session_id': f'sess_{i:03d}',
                'timestamp': (datetime.now() - timedelta(hours=i * 8)).isoformat(),
                'user_message': f'Sample user message {i} for {persona_id}',
                'persona_response': f'Sample response {i} demonstrating typical {persona_id} behavior.',
            })

        return interactions

    def _audit_interaction(
        self,
        interaction: Dict[str, Any],
        persona_id: str
    ) -> List[DoctrineDeviation]:
        """
        Audit a single interaction for deviations.

        Args:
            interaction: The interaction to audit
            persona_id: The persona that generated the response

        Returns:
            List of deviations found
        """
        import uuid

        deviations = []
        response = interaction.get('persona_response', '')
        user_message = interaction.get('user_message', '')

        # Run all checks
        checks = [
            self.checker.check_doctrinal_alignment,
            self.checker.check_boundary_compliance,
            self.checker.check_scriptural_accuracy,
            self.checker.check_tonal_compliance,
        ]

        for check in checks:
            found = check(response, persona_id)
            for deviation in found:
                deviation.deviation_id = str(uuid.uuid4())
                deviation.interaction_id = interaction.get('interaction_id', '')
                deviation.session_id = interaction.get('session_id', '')
                deviation.timestamp = interaction.get('timestamp', '')
                deviation.user_message = user_message[:500]
                deviation.persona_response = response[:1000]
                deviations.append(deviation)

        return deviations

    def _generate_recommendations(self, result: DoctrineAuditResult) -> List[str]:
        """Generate recommendations based on findings."""
        recommendations = []

        if result.critical_count > 0:
            recommendations.append(
                f"CRITICAL: {result.critical_count} critical deviations found. "
                "Immediate review required before any deployments."
            )

        if result.high_count > 0:
            recommendations.append(
                f"HIGH PRIORITY: {result.high_count} high-severity issues require "
                "review before next persona evolution or memory update."
            )

        if result.by_type.get('doctrinal', 0) > 0:
            recommendations.append(
                "Doctrinal deviations detected. Review authority foundation anchors "
                "and ensure they are properly loaded during activation."
            )

        if result.by_type.get('boundary', 0) > 0:
            recommendations.append(
                "Boundary violations detected. Strengthen persona constraint definitions "
                "and add explicit scope limitations to system prompts."
            )

        if result.by_type.get('tonal', 0) > 0:
            recommendations.append(
                "Tonal issues detected. Review persona identity anchors for warmth "
                "and empathy requirements."
            )

        if not recommendations:
            recommendations.append(
                "No significant issues found. Continue monitoring with regular audits."
            )

        return recommendations

    def _log_summary(self, result: DoctrineAuditResult):
        """Log audit summary."""
        logger.info("=" * 60)
        logger.info("AUDIT SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total interactions sampled: {result.sample_size}")
        logger.info(f"Total deviations found: {result.total_deviations}")
        logger.info(f"  Critical: {result.critical_count}")
        logger.info(f"  High: {result.high_count}")
        logger.info(f"  Medium: {result.medium_count}")
        logger.info(f"  Low: {result.low_count}")
        logger.info(f"By type: {result.by_type}")
        logger.info(f"Audit passed: {result.passed}")
        logger.info(f"Blocking issues: {result.blocking_issues}")
        logger.info(f"Requires review: {result.requires_review}")
        logger.info("-" * 60)
        logger.info("RECOMMENDATIONS:")
        for rec in result.recommendations:
            logger.info(f"  - {rec}")
        logger.info("=" * 60)

    def _save_result(self, result: DoctrineAuditResult):
        """Save audit result to file."""
        self.config.audit_output_dir.mkdir(parents=True, exist_ok=True)

        filename = f"doctrine_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = self.config.audit_output_dir / filename

        filepath.write_text(json.dumps(result.to_dict(), indent=2))
        logger.info(f"Audit result saved: {filepath}")


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def run_doctrine_audit(
    persona_id: str = None,
    sample_size: int = None,
    period_days: int = None
) -> DoctrineAuditResult:
    """
    Run a doctrine alignment audit.

    Example:
        result = run_doctrine_audit(
            persona_id="inspire_pastor",
            sample_size=50,
            period_days=7,
        )

        if not result.passed:
            print(f"Audit failed with {result.critical_count} critical issues")
    """
    audit = DoctrineAlignmentAudit()
    return audit.run_audit(
        persona_id=persona_id,
        sample_size=sample_size,
        period_days=period_days
    )
