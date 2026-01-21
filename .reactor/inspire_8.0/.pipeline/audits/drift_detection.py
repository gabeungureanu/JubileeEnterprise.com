# =============================================================================
# PERSONA DRIFT DETECTION
# =============================================================================
"""
Drift detection for Inspire 8.0 personas.

This module implements formal drift detection to identify gradual or unintended
changes in persona tone, doctrine, or behavioral posture over time through
month-over-month comparisons of persona outputs.

DRIFT CATEGORIES:

1. DOCTRINAL DRIFT:
   - Changes in theological framing or positions
   - Shifts in scriptural interpretation patterns
   - Deviation from Canon authority expressions

2. TONAL DRIFT:
   - Changes in communication style
   - Shifts in warmth, formality, or directness
   - Evolution of language patterns

3. BEHAVIORAL DRIFT:
   - Changes in boundary adherence
   - Shifts in scope or role definition
   - Evolution of interaction patterns

4. AUTHORITY DRIFT:
   - Changes in how authority is expressed
   - Shifts in confidence or certainty levels
   - Evolution of citation and reference patterns

TOLERANCE THRESHOLDS:
- Minimal: < 5% change (acceptable natural variation)
- Low: 5-10% change (monitor, no action)
- Moderate: 10-20% change (review recommended)
- High: 20-35% change (action required)
- Critical: > 35% change (immediate intervention)

BASELINE MANAGEMENT:
- Baselines are established from historical samples
- Rolling baselines allow gradual accepted evolution
- Locked baselines enforce strict consistency
"""

import hashlib
import json
import logging
import statistics
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

class DriftCategory(Enum):
    """Categories of persona drift."""
    DOCTRINAL = "doctrinal"      # Theological/doctrinal changes
    TONAL = "tonal"              # Communication style changes
    BEHAVIORAL = "behavioral"    # Boundary/scope changes
    AUTHORITY = "authority"      # Authority expression changes
    LANGUAGE = "language"        # Language pattern changes
    CONSISTENCY = "consistency"  # Internal consistency changes


class DriftSeverity(Enum):
    """Severity levels for detected drift."""
    MINIMAL = "minimal"      # < 5% - Natural variation
    LOW = "low"              # 5-10% - Monitor
    MODERATE = "moderate"    # 10-20% - Review recommended
    HIGH = "high"            # 20-35% - Action required
    CRITICAL = "critical"    # > 35% - Immediate intervention

    @property
    def requires_action(self) -> bool:
        """Whether this severity requires action."""
        return self in (DriftSeverity.HIGH, DriftSeverity.CRITICAL)

    @property
    def requires_review(self) -> bool:
        """Whether this severity requires review."""
        return self in (DriftSeverity.MODERATE, DriftSeverity.HIGH, DriftSeverity.CRITICAL)


class BaselineMode(Enum):
    """Baseline management modes."""
    ROLLING = "rolling"      # Baseline evolves with accepted changes
    LOCKED = "locked"        # Baseline fixed at establishment point
    ADAPTIVE = "adaptive"    # Baseline adjusts within tolerance bounds


class DriftAction(Enum):
    """Recommended actions for detected drift."""
    NONE = "none"                          # No action needed
    MONITOR = "monitor"                    # Continue monitoring
    REVIEW = "review"                      # Manual review recommended
    DEEP_AUDIT = "deep_audit"              # Trigger comprehensive audit
    ANCHOR_REVIEW = "anchor_review"        # Review activation anchors
    MEMORY_RESTRICTION = "memory_restriction"  # Restrict memory writeback
    PERSONA_SUSPENSION = "persona_suspension"  # Temporarily suspend persona


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class DriftMetrics:
    """
    Metrics for a specific drift dimension.

    Contains baseline, current, and delta values for
    tracking changes over time.
    """
    dimension: str = ""
    category: DriftCategory = DriftCategory.DOCTRINAL

    # Baseline values
    baseline_value: float = 0.0
    baseline_samples: int = 0
    baseline_period: str = ""  # e.g., "2026-01"
    baseline_stddev: float = 0.0

    # Current values
    current_value: float = 0.0
    current_samples: int = 0
    current_period: str = ""  # e.g., "2026-02"
    current_stddev: float = 0.0

    # Delta analysis
    absolute_delta: float = 0.0
    percent_delta: float = 0.0
    z_score: float = 0.0  # Standard deviations from baseline

    # Interpretation
    direction: str = ""  # "increase", "decrease", "stable"
    significant: bool = False

    def calculate_delta(self):
        """Calculate delta values from baseline and current."""
        self.absolute_delta = self.current_value - self.baseline_value

        if self.baseline_value != 0:
            self.percent_delta = (self.absolute_delta / self.baseline_value) * 100
        else:
            self.percent_delta = 100.0 if self.current_value != 0 else 0.0

        if self.baseline_stddev > 0:
            self.z_score = self.absolute_delta / self.baseline_stddev
        else:
            self.z_score = 0.0

        # Determine direction
        if abs(self.percent_delta) < 2.0:
            self.direction = "stable"
        elif self.absolute_delta > 0:
            self.direction = "increase"
        else:
            self.direction = "decrease"

        # Determine significance (> 2 standard deviations or > 10% change)
        self.significant = abs(self.z_score) > 2.0 or abs(self.percent_delta) > 10.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'dimension': self.dimension,
            'category': self.category.value,
            'baseline': {
                'value': self.baseline_value,
                'samples': self.baseline_samples,
                'period': self.baseline_period,
                'stddev': self.baseline_stddev,
            },
            'current': {
                'value': self.current_value,
                'samples': self.current_samples,
                'period': self.current_period,
                'stddev': self.current_stddev,
            },
            'delta': {
                'absolute': self.absolute_delta,
                'percent': self.percent_delta,
                'z_score': self.z_score,
                'direction': self.direction,
                'significant': self.significant,
            },
        }


@dataclass
class DriftFinding:
    """
    A specific drift finding with supporting evidence.

    Documents what changed, by how much, and provides
    examples from both baseline and current periods.
    """
    finding_id: str = ""
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Identification
    persona_id: str = ""
    category: DriftCategory = DriftCategory.DOCTRINAL
    severity: DriftSeverity = DriftSeverity.LOW

    # Description
    title: str = ""
    description: str = ""

    # Time window
    baseline_period: str = ""
    current_period: str = ""
    comparison_window_days: int = 30

    # Metrics
    metrics: DriftMetrics = field(default_factory=DriftMetrics)

    # Evidence
    baseline_examples: List[str] = field(default_factory=list)
    current_examples: List[str] = field(default_factory=list)

    # Recommended action
    recommended_action: DriftAction = DriftAction.NONE
    action_rationale: str = ""

    # Related findings
    related_findings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'finding_id': self.finding_id,
            'detected_at': self.detected_at,
            'persona_id': self.persona_id,
            'category': self.category.value,
            'severity': self.severity.value,
            'title': self.title,
            'description': self.description,
            'time_window': {
                'baseline_period': self.baseline_period,
                'current_period': self.current_period,
                'comparison_window_days': self.comparison_window_days,
            },
            'metrics': self.metrics.to_dict(),
            'evidence': {
                'baseline_examples': self.baseline_examples,
                'current_examples': self.current_examples,
            },
            'action': {
                'recommended': self.recommended_action.value,
                'rationale': self.action_rationale,
            },
            'related_findings': self.related_findings,
        }


@dataclass
class PersonaBaseline:
    """
    Baseline profile for a persona.

    Captures the expected characteristics of a persona
    at a point in time for comparison against future behavior.
    """
    baseline_id: str = ""
    persona_id: str = ""
    persona_name: str = ""

    # Baseline metadata
    established_at: str = ""
    period_start: str = ""
    period_end: str = ""
    sample_count: int = 0

    # Mode
    mode: BaselineMode = BaselineMode.ROLLING
    locked_at: str = ""  # If locked

    # Doctrinal metrics
    doctrinal_confidence: float = 0.0  # 0-1 confidence in doctrine
    scripture_citation_rate: float = 0.0  # Citations per response
    theological_precision: float = 0.0  # 0-1 precision score

    # Tonal metrics
    warmth_score: float = 0.0  # 0-1 warmth
    formality_score: float = 0.0  # 0-1 formality
    directness_score: float = 0.0  # 0-1 directness
    empathy_score: float = 0.0  # 0-1 empathy

    # Behavioral metrics
    boundary_adherence: float = 0.0  # 0-1 boundary respect
    scope_adherence: float = 0.0  # 0-1 staying in scope
    referral_rate: float = 0.0  # Rate of professional referrals

    # Authority metrics
    certainty_level: float = 0.0  # 0-1 certainty in statements
    hedging_frequency: float = 0.0  # Rate of hedging language
    authority_citation_rate: float = 0.0  # Canon/authority citations

    # Language metrics
    average_response_length: float = 0.0
    vocabulary_diversity: float = 0.0  # Unique words ratio
    question_rate: float = 0.0  # Questions per response

    # Standard deviations for each metric
    stddev_values: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'baseline_id': self.baseline_id,
            'persona_id': self.persona_id,
            'persona_name': self.persona_name,
            'metadata': {
                'established_at': self.established_at,
                'period_start': self.period_start,
                'period_end': self.period_end,
                'sample_count': self.sample_count,
                'mode': self.mode.value,
                'locked_at': self.locked_at,
            },
            'metrics': {
                'doctrinal': {
                    'confidence': self.doctrinal_confidence,
                    'scripture_citation_rate': self.scripture_citation_rate,
                    'theological_precision': self.theological_precision,
                },
                'tonal': {
                    'warmth': self.warmth_score,
                    'formality': self.formality_score,
                    'directness': self.directness_score,
                    'empathy': self.empathy_score,
                },
                'behavioral': {
                    'boundary_adherence': self.boundary_adherence,
                    'scope_adherence': self.scope_adherence,
                    'referral_rate': self.referral_rate,
                },
                'authority': {
                    'certainty_level': self.certainty_level,
                    'hedging_frequency': self.hedging_frequency,
                    'authority_citation_rate': self.authority_citation_rate,
                },
                'language': {
                    'average_response_length': self.average_response_length,
                    'vocabulary_diversity': self.vocabulary_diversity,
                    'question_rate': self.question_rate,
                },
            },
            'stddev_values': self.stddev_values,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PersonaBaseline':
        """Create from dictionary."""
        baseline = cls()
        baseline.baseline_id = data.get('baseline_id', '')
        baseline.persona_id = data.get('persona_id', '')
        baseline.persona_name = data.get('persona_name', '')

        meta = data.get('metadata', {})
        baseline.established_at = meta.get('established_at', '')
        baseline.period_start = meta.get('period_start', '')
        baseline.period_end = meta.get('period_end', '')
        baseline.sample_count = meta.get('sample_count', 0)
        baseline.mode = BaselineMode(meta.get('mode', 'rolling'))
        baseline.locked_at = meta.get('locked_at', '')

        metrics = data.get('metrics', {})
        doctrinal = metrics.get('doctrinal', {})
        baseline.doctrinal_confidence = doctrinal.get('confidence', 0.0)
        baseline.scripture_citation_rate = doctrinal.get('scripture_citation_rate', 0.0)
        baseline.theological_precision = doctrinal.get('theological_precision', 0.0)

        tonal = metrics.get('tonal', {})
        baseline.warmth_score = tonal.get('warmth', 0.0)
        baseline.formality_score = tonal.get('formality', 0.0)
        baseline.directness_score = tonal.get('directness', 0.0)
        baseline.empathy_score = tonal.get('empathy', 0.0)

        behavioral = metrics.get('behavioral', {})
        baseline.boundary_adherence = behavioral.get('boundary_adherence', 0.0)
        baseline.scope_adherence = behavioral.get('scope_adherence', 0.0)
        baseline.referral_rate = behavioral.get('referral_rate', 0.0)

        authority = metrics.get('authority', {})
        baseline.certainty_level = authority.get('certainty_level', 0.0)
        baseline.hedging_frequency = authority.get('hedging_frequency', 0.0)
        baseline.authority_citation_rate = authority.get('authority_citation_rate', 0.0)

        language = metrics.get('language', {})
        baseline.average_response_length = language.get('average_response_length', 0.0)
        baseline.vocabulary_diversity = language.get('vocabulary_diversity', 0.0)
        baseline.question_rate = language.get('question_rate', 0.0)

        baseline.stddev_values = data.get('stddev_values', {})

        return baseline


@dataclass
class DriftDetectionResult:
    """
    Complete result of a drift detection analysis.

    Aggregates all findings from comparing current behavior
    against established baselines.
    """
    # Identification
    detection_id: str = ""
    run_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Scope
    persona_id: str = ""
    persona_name: str = ""
    baseline_period: str = ""
    current_period: str = ""

    # Sample info
    baseline_sample_count: int = 0
    current_sample_count: int = 0

    # Overall assessment
    overall_drift_detected: bool = False
    overall_severity: DriftSeverity = DriftSeverity.MINIMAL
    drift_score: float = 0.0  # 0-100 overall drift score

    # Findings by category
    findings: List[DriftFinding] = field(default_factory=list)
    findings_by_category: Dict[str, int] = field(default_factory=dict)
    findings_by_severity: Dict[str, int] = field(default_factory=dict)

    # Metrics comparison
    metrics: List[DriftMetrics] = field(default_factory=list)
    significant_metrics: List[str] = field(default_factory=list)

    # Recommended actions
    recommended_actions: List[DriftAction] = field(default_factory=list)
    action_summary: str = ""

    # Status
    requires_intervention: bool = False
    intervention_reason: str = ""

    def add_finding(self, finding: DriftFinding):
        """Add a finding and update aggregations."""
        self.findings.append(finding)

        # Update category counts
        cat = finding.category.value
        self.findings_by_category[cat] = self.findings_by_category.get(cat, 0) + 1

        # Update severity counts
        sev = finding.severity.value
        self.findings_by_severity[sev] = self.findings_by_severity.get(sev, 0) + 1

        # Check if intervention needed
        if finding.severity.requires_action:
            self.requires_intervention = True
            if not self.intervention_reason:
                self.intervention_reason = finding.title

        # Update overall severity
        severity_order = [
            DriftSeverity.MINIMAL,
            DriftSeverity.LOW,
            DriftSeverity.MODERATE,
            DriftSeverity.HIGH,
            DriftSeverity.CRITICAL,
        ]
        if severity_order.index(finding.severity) > severity_order.index(self.overall_severity):
            self.overall_severity = finding.severity

        # Track recommended actions
        if finding.recommended_action not in self.recommended_actions:
            self.recommended_actions.append(finding.recommended_action)

    def calculate_drift_score(self):
        """Calculate overall drift score from metrics."""
        if not self.metrics:
            self.drift_score = 0.0
            return

        # Weight significant changes more heavily
        scores = []
        for metric in self.metrics:
            if metric.significant:
                scores.append(min(100.0, abs(metric.percent_delta) * 2))
            else:
                scores.append(min(50.0, abs(metric.percent_delta)))

        self.drift_score = statistics.mean(scores) if scores else 0.0
        self.overall_drift_detected = self.drift_score > 10.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'detection_id': self.detection_id,
            'run_at': self.run_at,
            'persona': {
                'id': self.persona_id,
                'name': self.persona_name,
            },
            'periods': {
                'baseline': self.baseline_period,
                'current': self.current_period,
            },
            'samples': {
                'baseline': self.baseline_sample_count,
                'current': self.current_sample_count,
            },
            'assessment': {
                'drift_detected': self.overall_drift_detected,
                'severity': self.overall_severity.value,
                'drift_score': self.drift_score,
            },
            'findings': [f.to_dict() for f in self.findings],
            'findings_summary': {
                'by_category': self.findings_by_category,
                'by_severity': self.findings_by_severity,
            },
            'metrics': [m.to_dict() for m in self.metrics],
            'significant_metrics': self.significant_metrics,
            'actions': {
                'recommended': [a.value for a in self.recommended_actions],
                'summary': self.action_summary,
            },
            'intervention': {
                'required': self.requires_intervention,
                'reason': self.intervention_reason,
            },
        }


# =============================================================================
# DRIFT DETECTION CONFIG
# =============================================================================

@dataclass
class DriftDetectionConfig:
    """Configuration for drift detection."""

    # Personas to monitor
    personas: List[str] = field(default_factory=lambda: [
        'inspire_foundation',
        'inspire_pastor',
        'inspire_teacher',
        'inspire_counselor',
        'inspire_scholar',
    ])

    # Sampling
    default_sample_size: int = 100
    minimum_sample_size: int = 20
    comparison_window_days: int = 30

    # Tolerance thresholds (percent change)
    threshold_minimal: float = 5.0
    threshold_low: float = 10.0
    threshold_moderate: float = 20.0
    threshold_high: float = 35.0
    # > high is critical

    # Z-score thresholds
    zscore_significant: float = 2.0
    zscore_critical: float = 3.0

    # Baseline settings
    baseline_mode: BaselineMode = BaselineMode.ROLLING
    baseline_update_threshold: float = 5.0  # Max change for rolling update

    # Category weights (for overall score)
    category_weights: Dict[str, float] = field(default_factory=lambda: {
        'doctrinal': 1.5,    # Highest weight - doctrine is critical
        'authority': 1.3,    # High weight - authority expression matters
        'behavioral': 1.2,   # Important for boundaries
        'tonal': 1.0,        # Standard weight
        'language': 0.8,     # Lower weight - some variation acceptable
        'consistency': 1.1,  # Moderate weight
    })

    # Paths
    baselines_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/audits/baselines'
    ))
    logs_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs'
    ))
    reports_dir: Path = field(default_factory=lambda: Path(
        'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/drift'
    ))

    def get_severity(self, percent_change: float) -> DriftSeverity:
        """Get severity level for a percent change."""
        pct = abs(percent_change)
        if pct < self.threshold_minimal:
            return DriftSeverity.MINIMAL
        elif pct < self.threshold_low:
            return DriftSeverity.LOW
        elif pct < self.threshold_moderate:
            return DriftSeverity.MODERATE
        elif pct < self.threshold_high:
            return DriftSeverity.HIGH
        else:
            return DriftSeverity.CRITICAL

    def get_action(self, severity: DriftSeverity, category: DriftCategory) -> DriftAction:
        """Get recommended action for severity and category."""
        if severity == DriftSeverity.MINIMAL:
            return DriftAction.NONE
        elif severity == DriftSeverity.LOW:
            return DriftAction.MONITOR
        elif severity == DriftSeverity.MODERATE:
            return DriftAction.REVIEW
        elif severity == DriftSeverity.HIGH:
            if category == DriftCategory.DOCTRINAL:
                return DriftAction.ANCHOR_REVIEW
            elif category == DriftCategory.BEHAVIORAL:
                return DriftAction.MEMORY_RESTRICTION
            else:
                return DriftAction.DEEP_AUDIT
        else:  # CRITICAL
            if category == DriftCategory.DOCTRINAL:
                return DriftAction.PERSONA_SUSPENSION
            else:
                return DriftAction.ANCHOR_REVIEW


# =============================================================================
# DRIFT ANALYZER
# =============================================================================

class DriftAnalyzer:
    """
    Analyzes persona outputs for drift indicators.

    Computes metrics from sample outputs for comparison
    against baselines.
    """

    def __init__(self, config: DriftDetectionConfig = None):
        self.config = config or DriftDetectionConfig()

        # Pattern definitions for analysis
        self.scripture_patterns = [
            r'\b(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+\d+',
            r'\b(?:Matthew|Mark|Luke|John|Acts|Romans)\s+\d+',
            r'\b(?:1|2)?\s*(?:Corinthians|Timothy|Peter|John)\s+\d+',
            r'\b(?:Psalm|Proverbs|Isaiah|Jeremiah)\s+\d+',
            r'\b(?:Galatians|Ephesians|Philippians|Colossians)\s+\d+',
            r'(?:scripture|bible|word of god)',
        ]

        self.hedging_patterns = [
            r'\b(?:perhaps|maybe|possibly|might|could be)\b',
            r'\b(?:some believe|many think|it\'s thought)\b',
            r'\b(?:in my opinion|i think|i believe)\b',
            r'\b(?:generally|typically|usually|often)\b',
        ]

        self.certainty_patterns = [
            r'\b(?:certainly|definitely|absolutely|clearly)\b',
            r'\b(?:the bible says|scripture teaches|god declares)\b',
            r'\b(?:without doubt|assuredly|truly)\b',
            r'\b(?:must|shall|will certainly)\b',
        ]

        self.empathy_patterns = [
            r'\b(?:i understand|that must be|how difficult)\b',
            r'\b(?:i\'m sorry|my heart|compassion)\b',
            r'\b(?:you\'re not alone|many struggle|it\'s okay)\b',
        ]

        self.referral_patterns = [
            r'\b(?:professional|counselor|therapist|doctor)\b',
            r'\b(?:seek help|speak to|consult with)\b',
            r'\b(?:medical|legal|financial) advice\b',
        ]

    def analyze_sample(self, content: str) -> Dict[str, float]:
        """
        Analyze a single sample for drift metrics.

        Returns dictionary of metric name -> value.
        """
        import re

        content_lower = content.lower()
        words = content_lower.split()
        word_count = len(words)

        if word_count == 0:
            return {}

        metrics = {}

        # Scripture citation rate
        scripture_matches = sum(
            len(re.findall(p, content, re.IGNORECASE))
            for p in self.scripture_patterns
        )
        metrics['scripture_citation_rate'] = scripture_matches / max(1, word_count / 100)

        # Hedging frequency
        hedging_matches = sum(
            len(re.findall(p, content_lower))
            for p in self.hedging_patterns
        )
        metrics['hedging_frequency'] = hedging_matches / max(1, word_count / 100)

        # Certainty level
        certainty_matches = sum(
            len(re.findall(p, content_lower))
            for p in self.certainty_patterns
        )
        metrics['certainty_level'] = min(1.0, certainty_matches / 5)

        # Empathy score
        empathy_matches = sum(
            len(re.findall(p, content_lower))
            for p in self.empathy_patterns
        )
        metrics['empathy_score'] = min(1.0, empathy_matches / 3)

        # Referral rate
        referral_matches = sum(
            len(re.findall(p, content_lower))
            for p in self.referral_patterns
        )
        metrics['referral_rate'] = referral_matches / max(1, word_count / 100)

        # Response length
        metrics['response_length'] = word_count

        # Vocabulary diversity
        unique_words = len(set(words))
        metrics['vocabulary_diversity'] = unique_words / max(1, word_count)

        # Question rate
        questions = content.count('?')
        metrics['question_rate'] = questions / max(1, word_count / 100)

        # Formality (approximation based on contractions and casual language)
        contractions = len(re.findall(r"\b\w+n't\b|\b\w+'s\b|\b\w+'re\b|\b\w+'ll\b", content_lower))
        casual_words = len(re.findall(r'\b(?:yeah|okay|ok|gonna|wanna|kinda)\b', content_lower))
        informal_count = contractions + casual_words
        metrics['formality_score'] = max(0, 1.0 - (informal_count / max(1, word_count / 20)))

        # Warmth (approximation based on positive/caring language)
        warmth_words = len(re.findall(
            r'\b(?:love|care|bless|peace|joy|hope|grace|kind|gentle)\b',
            content_lower
        ))
        metrics['warmth_score'] = min(1.0, warmth_words / 5)

        # Directness (shorter sentences, declarative statements)
        sentences = re.split(r'[.!?]+', content)
        avg_sentence_length = sum(len(s.split()) for s in sentences) / max(1, len(sentences))
        metrics['directness_score'] = max(0, 1.0 - (avg_sentence_length / 30))

        return metrics

    def aggregate_metrics(
        self,
        samples: List[str]
    ) -> Tuple[Dict[str, float], Dict[str, float]]:
        """
        Aggregate metrics from multiple samples.

        Returns (mean_values, stddev_values).
        """
        if not samples:
            return {}, {}

        # Collect all metrics
        all_metrics: Dict[str, List[float]] = {}

        for sample in samples:
            sample_metrics = self.analyze_sample(sample)
            for key, value in sample_metrics.items():
                if key not in all_metrics:
                    all_metrics[key] = []
                all_metrics[key].append(value)

        # Calculate means and stddevs
        means = {}
        stddevs = {}

        for key, values in all_metrics.items():
            means[key] = statistics.mean(values) if values else 0.0
            stddevs[key] = statistics.stdev(values) if len(values) > 1 else 0.0

        return means, stddevs


# =============================================================================
# DRIFT DETECTOR
# =============================================================================

class DriftDetector:
    """
    Main drift detection engine.

    Compares current persona behavior against established
    baselines to detect drift over time.
    """

    def __init__(self, config: DriftDetectionConfig = None):
        self.config = config or DriftDetectionConfig()
        self.analyzer = DriftAnalyzer(config)

        # Ensure directories exist
        self.config.baselines_dir.mkdir(parents=True, exist_ok=True)
        self.config.reports_dir.mkdir(parents=True, exist_ok=True)

        # Metric to category mapping
        self.metric_categories = {
            'scripture_citation_rate': DriftCategory.DOCTRINAL,
            'theological_precision': DriftCategory.DOCTRINAL,
            'doctrinal_confidence': DriftCategory.DOCTRINAL,
            'certainty_level': DriftCategory.AUTHORITY,
            'hedging_frequency': DriftCategory.AUTHORITY,
            'authority_citation_rate': DriftCategory.AUTHORITY,
            'warmth_score': DriftCategory.TONAL,
            'formality_score': DriftCategory.TONAL,
            'directness_score': DriftCategory.TONAL,
            'empathy_score': DriftCategory.TONAL,
            'boundary_adherence': DriftCategory.BEHAVIORAL,
            'scope_adherence': DriftCategory.BEHAVIORAL,
            'referral_rate': DriftCategory.BEHAVIORAL,
            'response_length': DriftCategory.LANGUAGE,
            'vocabulary_diversity': DriftCategory.LANGUAGE,
            'question_rate': DriftCategory.LANGUAGE,
        }

    def load_baseline(self, persona_id: str) -> Optional[PersonaBaseline]:
        """Load baseline for a persona."""
        baseline_file = self.config.baselines_dir / f"{persona_id}_baseline.json"

        if not baseline_file.exists():
            logger.warning(f"No baseline found for persona: {persona_id}")
            return None

        try:
            data = json.loads(baseline_file.read_text(encoding='utf-8'))
            return PersonaBaseline.from_dict(data)
        except Exception as e:
            logger.error(f"Error loading baseline for {persona_id}: {e}")
            return None

    def save_baseline(self, baseline: PersonaBaseline):
        """Save a baseline."""
        baseline_file = self.config.baselines_dir / f"{baseline.persona_id}_baseline.json"
        baseline_file.write_text(
            json.dumps(baseline.to_dict(), indent=2),
            encoding='utf-8'
        )
        logger.info(f"Saved baseline for {baseline.persona_id}")

    def establish_baseline(
        self,
        persona_id: str,
        samples: List[str],
        period_label: str = "",
        mode: BaselineMode = None
    ) -> PersonaBaseline:
        """
        Establish a new baseline from samples.

        Args:
            persona_id: Persona identifier
            samples: Sample outputs to establish baseline from
            period_label: Label for the baseline period (e.g., "2026-01")
            mode: Baseline mode (rolling, locked, adaptive)

        Returns:
            Established PersonaBaseline
        """
        import uuid

        if len(samples) < self.config.minimum_sample_size:
            logger.warning(
                f"Sample size ({len(samples)}) below minimum "
                f"({self.config.minimum_sample_size})"
            )

        # Analyze samples
        means, stddevs = self.analyzer.aggregate_metrics(samples)

        # Create baseline
        now = datetime.now()
        baseline = PersonaBaseline(
            baseline_id=str(uuid.uuid4()),
            persona_id=persona_id,
            established_at=now.isoformat(),
            period_start=period_label or now.strftime('%Y-%m'),
            period_end=period_label or now.strftime('%Y-%m'),
            sample_count=len(samples),
            mode=mode or self.config.baseline_mode,
        )

        # Set metric values
        baseline.scripture_citation_rate = means.get('scripture_citation_rate', 0.0)
        baseline.hedging_frequency = means.get('hedging_frequency', 0.0)
        baseline.certainty_level = means.get('certainty_level', 0.0)
        baseline.empathy_score = means.get('empathy_score', 0.0)
        baseline.referral_rate = means.get('referral_rate', 0.0)
        baseline.average_response_length = means.get('response_length', 0.0)
        baseline.vocabulary_diversity = means.get('vocabulary_diversity', 0.0)
        baseline.question_rate = means.get('question_rate', 0.0)
        baseline.formality_score = means.get('formality_score', 0.0)
        baseline.warmth_score = means.get('warmth_score', 0.0)
        baseline.directness_score = means.get('directness_score', 0.0)

        # Store standard deviations
        baseline.stddev_values = stddevs

        # Save baseline
        self.save_baseline(baseline)

        return baseline

    def detect_drift(
        self,
        persona_id: str,
        current_samples: List[str],
        baseline: PersonaBaseline = None,
        current_period: str = ""
    ) -> DriftDetectionResult:
        """
        Detect drift by comparing current samples against baseline.

        Args:
            persona_id: Persona identifier
            current_samples: Current period sample outputs
            baseline: Baseline to compare against (loaded if not provided)
            current_period: Label for current period

        Returns:
            DriftDetectionResult with findings
        """
        import uuid

        # Load baseline if not provided
        if baseline is None:
            baseline = self.load_baseline(persona_id)

        if baseline is None:
            logger.error(f"Cannot detect drift without baseline for {persona_id}")
            result = DriftDetectionResult(
                detection_id=str(uuid.uuid4()),
                persona_id=persona_id,
            )
            result.action_summary = "No baseline available - establish baseline first"
            return result

        # Analyze current samples
        current_means, current_stddevs = self.analyzer.aggregate_metrics(current_samples)

        # Create result
        now = datetime.now()
        result = DriftDetectionResult(
            detection_id=str(uuid.uuid4()),
            persona_id=persona_id,
            persona_name=baseline.persona_name,
            baseline_period=baseline.period_start,
            current_period=current_period or now.strftime('%Y-%m'),
            baseline_sample_count=baseline.sample_count,
            current_sample_count=len(current_samples),
        )

        # Compare each metric
        baseline_metrics = {
            'scripture_citation_rate': baseline.scripture_citation_rate,
            'hedging_frequency': baseline.hedging_frequency,
            'certainty_level': baseline.certainty_level,
            'empathy_score': baseline.empathy_score,
            'referral_rate': baseline.referral_rate,
            'response_length': baseline.average_response_length,
            'vocabulary_diversity': baseline.vocabulary_diversity,
            'question_rate': baseline.question_rate,
            'formality_score': baseline.formality_score,
            'warmth_score': baseline.warmth_score,
            'directness_score': baseline.directness_score,
        }

        for metric_name, baseline_value in baseline_metrics.items():
            current_value = current_means.get(metric_name, 0.0)
            baseline_stddev = baseline.stddev_values.get(metric_name, 0.0)
            current_stddev = current_stddevs.get(metric_name, 0.0)

            category = self.metric_categories.get(metric_name, DriftCategory.CONSISTENCY)

            # Create metrics comparison
            metrics = DriftMetrics(
                dimension=metric_name,
                category=category,
                baseline_value=baseline_value,
                baseline_samples=baseline.sample_count,
                baseline_period=baseline.period_start,
                baseline_stddev=baseline_stddev,
                current_value=current_value,
                current_samples=len(current_samples),
                current_period=result.current_period,
                current_stddev=current_stddev,
            )
            metrics.calculate_delta()
            result.metrics.append(metrics)

            if metrics.significant:
                result.significant_metrics.append(metric_name)

                # Create finding for significant drift
                severity = self.config.get_severity(metrics.percent_delta)
                action = self.config.get_action(severity, category)

                finding = DriftFinding(
                    finding_id=str(uuid.uuid4()),
                    persona_id=persona_id,
                    category=category,
                    severity=severity,
                    title=f"{category.value.title()} drift in {metric_name}",
                    description=(
                        f"{metric_name} changed by {metrics.percent_delta:.1f}% "
                        f"({metrics.direction}) from baseline. "
                        f"Baseline: {baseline_value:.3f}, Current: {current_value:.3f}"
                    ),
                    baseline_period=baseline.period_start,
                    current_period=result.current_period,
                    metrics=metrics,
                    recommended_action=action,
                    action_rationale=self._get_action_rationale(action, category, severity),
                )

                result.add_finding(finding)

        # Calculate overall drift score
        result.calculate_drift_score()

        # Generate action summary
        result.action_summary = self._generate_action_summary(result)

        return result

    def _get_action_rationale(
        self,
        action: DriftAction,
        category: DriftCategory,
        severity: DriftSeverity
    ) -> str:
        """Generate rationale for recommended action."""
        rationales = {
            DriftAction.NONE: "Change within acceptable tolerance",
            DriftAction.MONITOR: "Change detected but within monitoring threshold",
            DriftAction.REVIEW: "Change exceeds monitoring threshold, manual review recommended",
            DriftAction.DEEP_AUDIT: "Significant change requires comprehensive audit",
            DriftAction.ANCHOR_REVIEW: (
                "Change in core persona characteristics suggests "
                "activation anchor review"
            ),
            DriftAction.MEMORY_RESTRICTION: (
                "Behavioral drift may be memory-induced, "
                "restrict writeback until resolved"
            ),
            DriftAction.PERSONA_SUSPENSION: (
                "Critical drift in fundamental characteristics, "
                "suspend persona pending review"
            ),
        }
        return rationales.get(action, "")

    def _generate_action_summary(self, result: DriftDetectionResult) -> str:
        """Generate summary of recommended actions."""
        if not result.requires_intervention:
            if result.overall_drift_detected:
                return "Drift detected but within tolerance. Continue monitoring."
            return "No significant drift detected."

        actions = []
        for action in result.recommended_actions:
            if action == DriftAction.PERSONA_SUSPENSION:
                actions.append("URGENT: Consider persona suspension")
            elif action == DriftAction.ANCHOR_REVIEW:
                actions.append("Review activation anchors")
            elif action == DriftAction.MEMORY_RESTRICTION:
                actions.append("Restrict memory writeback")
            elif action == DriftAction.DEEP_AUDIT:
                actions.append("Perform comprehensive audit")
            elif action == DriftAction.REVIEW:
                actions.append("Manual review recommended")

        if actions:
            return f"Actions required: {'; '.join(actions)}"
        return "Review findings and take appropriate action"

    def run_monthly_comparison(
        self,
        persona_id: str,
        baseline_samples: List[str],
        current_samples: List[str],
        baseline_period: str,
        current_period: str
    ) -> DriftDetectionResult:
        """
        Run month-over-month comparison.

        Creates a temporary baseline from baseline_samples and
        compares against current_samples.

        Args:
            persona_id: Persona identifier
            baseline_samples: Samples from baseline period
            current_samples: Samples from current period
            baseline_period: Label for baseline period
            current_period: Label for current period

        Returns:
            DriftDetectionResult
        """
        # Establish temporary baseline
        baseline = PersonaBaseline(
            persona_id=persona_id,
            period_start=baseline_period,
            period_end=baseline_period,
            sample_count=len(baseline_samples),
            mode=BaselineMode.LOCKED,  # Don't update for comparison
        )

        # Analyze baseline samples
        baseline_means, baseline_stddevs = self.analyzer.aggregate_metrics(baseline_samples)

        # Set baseline metrics
        baseline.scripture_citation_rate = baseline_means.get('scripture_citation_rate', 0.0)
        baseline.hedging_frequency = baseline_means.get('hedging_frequency', 0.0)
        baseline.certainty_level = baseline_means.get('certainty_level', 0.0)
        baseline.empathy_score = baseline_means.get('empathy_score', 0.0)
        baseline.referral_rate = baseline_means.get('referral_rate', 0.0)
        baseline.average_response_length = baseline_means.get('response_length', 0.0)
        baseline.vocabulary_diversity = baseline_means.get('vocabulary_diversity', 0.0)
        baseline.question_rate = baseline_means.get('question_rate', 0.0)
        baseline.formality_score = baseline_means.get('formality_score', 0.0)
        baseline.warmth_score = baseline_means.get('warmth_score', 0.0)
        baseline.directness_score = baseline_means.get('directness_score', 0.0)
        baseline.stddev_values = baseline_stddevs

        # Run drift detection
        return self.detect_drift(
            persona_id=persona_id,
            current_samples=current_samples,
            baseline=baseline,
            current_period=current_period,
        )


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_global_detector: Optional[DriftDetector] = None
_detector_lock = threading.Lock()


def get_drift_detector() -> DriftDetector:
    """Get the global drift detector."""
    global _global_detector
    with _detector_lock:
        if _global_detector is None:
            _global_detector = DriftDetector()
        return _global_detector


def set_drift_detector(detector: DriftDetector):
    """Set the global drift detector."""
    global _global_detector
    with _detector_lock:
        _global_detector = detector


def reset_drift_detector():
    """Reset to default drift detector."""
    global _global_detector
    with _detector_lock:
        _global_detector = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def detect_persona_drift(
    persona_id: str,
    current_samples: List[str],
    current_period: str = ""
) -> DriftDetectionResult:
    """
    Detect drift for a persona against its baseline.

    Example:
        result = detect_persona_drift(
            persona_id="inspire_pastor",
            current_samples=["Sample output 1...", "Sample output 2..."],
            current_period="2026-02",
        )

        if result.requires_intervention:
            print(f"Intervention needed: {result.intervention_reason}")
    """
    detector = get_drift_detector()
    return detector.detect_drift(
        persona_id=persona_id,
        current_samples=current_samples,
        current_period=current_period,
    )


def establish_persona_baseline(
    persona_id: str,
    samples: List[str],
    period_label: str = ""
) -> PersonaBaseline:
    """
    Establish a baseline for a persona.

    Example:
        baseline = establish_persona_baseline(
            persona_id="inspire_pastor",
            samples=historical_outputs,
            period_label="2026-01",
        )
    """
    detector = get_drift_detector()
    return detector.establish_baseline(
        persona_id=persona_id,
        samples=samples,
        period_label=period_label,
    )


def run_drift_detection(
    persona_id: str = None,
    baseline_period: str = "",
    current_period: str = ""
) -> DriftDetectionResult:
    """
    Run drift detection (convenience wrapper).

    In production, this would load samples from the logging system.
    """
    detector = get_drift_detector()

    # For now, return empty result - actual implementation would
    # load samples from execution logs
    import uuid

    result = DriftDetectionResult(
        detection_id=str(uuid.uuid4()),
        persona_id=persona_id or "all",
        baseline_period=baseline_period,
        current_period=current_period,
    )
    result.action_summary = (
        "Drift detection requires logged execution samples. "
        "Use detect_persona_drift() with actual samples."
    )

    return result
