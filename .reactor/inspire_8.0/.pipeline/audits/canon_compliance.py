# =============================================================================
# CANON COMPLIANCE CHECKER
# =============================================================================
"""
Canon compliance checking for the Inspire 8.0 pipeline.

This module verifies outputs against the authoritative Canon specification
to ensure theological consistency and doctrinal accuracy.

CANON SOURCES:
1. Authority Foundation - Core theological positions
2. Scripture Core - Biblical references and interpretations
3. Canonical Personas - Approved persona definitions

COMPLIANCE LEVELS:
- FULL: Complete alignment with Canon
- PARTIAL: Minor deviations, acceptable
- MARGINAL: Notable deviations, needs review
- NON_COMPLIANT: Significant violations
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class ComplianceLevel(Enum):
    """Levels of canon compliance."""
    FULL = "full"              # Complete alignment
    PARTIAL = "partial"        # Minor deviations
    MARGINAL = "marginal"      # Notable deviations
    NON_COMPLIANT = "non_compliant"  # Significant violations

    @property
    def passing(self) -> bool:
        """Whether this level is considered passing."""
        return self in (ComplianceLevel.FULL, ComplianceLevel.PARTIAL)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class CanonReference:
    """
    A reference to authoritative Canon content.

    Used to cite the specific Canon sources that define
    expected behavior or doctrine.
    """
    reference_id: str = ""
    source_collection: str = ""
    source_document: str = ""
    source_section: str = ""

    # Content
    canon_text: str = ""
    canon_version: str = ""

    # Metadata
    authority_level: str = ""  # primary, secondary, supporting
    last_updated: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'reference_id': self.reference_id,
            'source_collection': self.source_collection,
            'source_document': self.source_document,
            'source_section': self.source_section,
            'canon_text': self.canon_text,
            'canon_version': self.canon_version,
            'authority_level': self.authority_level,
            'last_updated': self.last_updated,
        }


@dataclass
class ComplianceResult:
    """
    Result of a canon compliance check.

    Contains the compliance level, supporting references,
    and any issues found.
    """
    # Identification
    check_id: str = ""
    checked_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Content checked
    content_hash: str = ""
    content_preview: str = ""
    persona_id: str = ""

    # Compliance
    compliance_level: ComplianceLevel = ComplianceLevel.PARTIAL
    compliance_score: float = 0.0  # 0.0 to 1.0

    # References
    canon_references: List[CanonReference] = field(default_factory=list)
    matched_doctrines: List[str] = field(default_factory=list)

    # Issues
    issues_found: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'check_id': self.check_id,
            'checked_at': self.checked_at,
            'content_hash': self.content_hash,
            'content_preview': self.content_preview,
            'persona_id': self.persona_id,
            'compliance': {
                'level': self.compliance_level.value,
                'score': self.compliance_score,
                'passing': self.compliance_level.passing,
            },
            'canon_references': [r.to_dict() for r in self.canon_references],
            'matched_doctrines': self.matched_doctrines,
            'issues_found': self.issues_found,
            'recommendations': self.recommendations,
        }


# =============================================================================
# CANON COMPLIANCE CHECKER
# =============================================================================

class CanonComplianceChecker:
    """
    Checks content against Canon for compliance.

    In production, this would use semantic similarity against
    the Canon vector store. For now, uses rule-based checking.
    """

    def __init__(self, canon_dir: Path = None):
        self.canon_dir = canon_dir or Path(
            'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/qdrant'
        )

        # Core Canon definitions (simplified for demonstration)
        self.canon_doctrines = {
            'scripture_authority': {
                'statement': 'The Bible is the inspired, authoritative Word of God',
                'collection': 'inspire_authority_foundation',
                'authority_level': 'primary',
                'keywords': ['scripture', 'bible', 'word of god', 'inspired'],
            },
            'trinity': {
                'statement': 'God exists as one God in three persons: Father, Son, and Holy Spirit',
                'collection': 'inspire_authority_foundation',
                'authority_level': 'primary',
                'keywords': ['trinity', 'father', 'son', 'holy spirit', 'triune'],
            },
            'salvation_grace': {
                'statement': 'Salvation is by grace alone through faith alone in Christ alone',
                'collection': 'inspire_theology_systematic',
                'authority_level': 'primary',
                'keywords': ['salvation', 'grace', 'faith', 'saved', 'redeemed'],
            },
            'christ_deity': {
                'statement': 'Jesus Christ is fully God and fully man',
                'collection': 'inspire_authority_foundation',
                'authority_level': 'primary',
                'keywords': ['jesus', 'christ', 'lord', 'god', 'divine', 'incarnation'],
            },
            'resurrection': {
                'statement': 'Jesus Christ rose bodily from the dead',
                'collection': 'inspire_scripture_core',
                'authority_level': 'primary',
                'keywords': ['resurrection', 'risen', 'raised', 'empty tomb'],
            },
            'pastoral_care': {
                'statement': 'Pastoral care should be compassionate, confidential, and Christ-centered',
                'collection': 'inspire_canonical_personas',
                'authority_level': 'secondary',
                'keywords': ['pastoral', 'care', 'counseling', 'support'],
            },
            'professional_boundaries': {
                'statement': 'Personas must maintain appropriate boundaries and refer to professionals',
                'collection': 'inspire_canonical_personas',
                'authority_level': 'secondary',
                'keywords': ['medical', 'legal', 'professional', 'refer', 'boundary'],
            },
        }

        # Violation patterns
        self.violation_patterns = {
            'universalism': {
                'pattern': r'all.*saved|everyone.*heaven|no.*hell',
                'violates': ['salvation_grace'],
                'severity': 'high',
            },
            'works_salvation': {
                'pattern': r'earn.*salvation|good.*works.*saved|merit.*heaven',
                'violates': ['salvation_grace'],
                'severity': 'high',
            },
            'denial_trinity': {
                'pattern': r'not.*three|one.*person|same.*being',
                'violates': ['trinity'],
                'severity': 'critical',
            },
            'denial_deity': {
                'pattern': r'just.*man|not.*god|merely.*human',
                'violates': ['christ_deity'],
                'severity': 'critical',
            },
        }

    def check_compliance(
        self,
        content: str,
        persona_id: str = ""
    ) -> ComplianceResult:
        """
        Check content for Canon compliance.

        Args:
            content: The content to check
            persona_id: The persona that generated the content

        Returns:
            ComplianceResult with compliance level and details
        """
        import uuid
        import re

        result = ComplianceResult(
            check_id=str(uuid.uuid4()),
            content_hash=hashlib.md5(content.encode()).hexdigest(),
            content_preview=content[:200],
            persona_id=persona_id,
        )

        content_lower = content.lower()
        score_points = 100.0  # Start with full score

        # Check for doctrine alignment
        for doctrine_name, doctrine in self.canon_doctrines.items():
            # Check if doctrine topic is mentioned
            if any(kw in content_lower for kw in doctrine['keywords']):
                result.matched_doctrines.append(doctrine_name)

                # Add canon reference
                result.canon_references.append(CanonReference(
                    reference_id=doctrine_name,
                    source_collection=doctrine['collection'],
                    canon_text=doctrine['statement'],
                    authority_level=doctrine['authority_level'],
                ))

        # Check for violations
        for violation_name, violation in self.violation_patterns.items():
            if re.search(violation['pattern'], content_lower, re.IGNORECASE):
                result.issues_found.append(
                    f"Potential {violation_name} detected - may violate {', '.join(violation['violates'])}"
                )

                if violation['severity'] == 'critical':
                    score_points -= 40.0
                elif violation['severity'] == 'high':
                    score_points -= 25.0
                else:
                    score_points -= 10.0

        # Check for ambiguity in theological statements
        ambiguous_patterns = [
            ('some believe', 'Presents as opinion what Canon states definitively'),
            ('it depends', 'May appear relativistic on doctrinal matters'),
            ('many views', 'Could undermine doctrinal clarity'),
        ]

        for pattern, concern in ambiguous_patterns:
            if pattern in content_lower:
                # Only flag if in context of core doctrine
                if any(d in content_lower for d in ['salvation', 'trinity', 'resurrection']):
                    result.issues_found.append(f"Ambiguity concern: {concern}")
                    score_points -= 5.0

        # Calculate final score and level
        result.compliance_score = max(0.0, min(1.0, score_points / 100.0))

        if result.compliance_score >= 0.95:
            result.compliance_level = ComplianceLevel.FULL
        elif result.compliance_score >= 0.80:
            result.compliance_level = ComplianceLevel.PARTIAL
        elif result.compliance_score >= 0.60:
            result.compliance_level = ComplianceLevel.MARGINAL
        else:
            result.compliance_level = ComplianceLevel.NON_COMPLIANT

        # Generate recommendations
        if result.issues_found:
            result.recommendations.append(
                "Review flagged issues against Canon authority foundation"
            )
        if result.compliance_level == ComplianceLevel.MARGINAL:
            result.recommendations.append(
                "Content should be reviewed before deployment"
            )
        if result.compliance_level == ComplianceLevel.NON_COMPLIANT:
            result.recommendations.append(
                "Content requires revision to meet Canon compliance"
            )

        return result

    def check_batch(
        self,
        contents: List[str],
        persona_id: str = ""
    ) -> List[ComplianceResult]:
        """
        Check multiple contents for compliance.

        Args:
            contents: List of contents to check
            persona_id: The persona that generated the content

        Returns:
            List of ComplianceResults
        """
        results = []
        for content in contents:
            result = self.check_compliance(content, persona_id)
            results.append(result)
        return results

    def get_doctrine(self, doctrine_name: str) -> Optional[Dict[str, Any]]:
        """Get a doctrine definition by name."""
        return self.canon_doctrines.get(doctrine_name)

    def list_doctrines(self) -> List[str]:
        """List all doctrine names."""
        return list(self.canon_doctrines.keys())


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def check_canon_compliance(
    content: str,
    persona_id: str = ""
) -> ComplianceResult:
    """
    Check content for Canon compliance.

    Example:
        result = check_canon_compliance(
            content="Jesus said 'I am the way, the truth, and the life.'",
            persona_id="inspire_teacher",
        )

        if result.compliance_level.passing:
            print("Content is Canon-compliant")
        else:
            print(f"Issues found: {result.issues_found}")
    """
    checker = CanonComplianceChecker()
    return checker.check_compliance(content, persona_id)
