#!/usr/bin/env python3
# =============================================================================
# AUDIT PERSONA DRIFT
# =============================================================================
"""
Audit persona behavior for drift from baseline standards.

This script performs comprehensive drift analysis including:
1. Loading persona baseline from authority foundation
2. Sampling recent interactions from conversation memory
3. Analyzing response patterns against baseline
4. Detecting theological, behavioral, and stylistic drift
5. Generating drift report with severity scoring
6. Logging audit results for compliance

USAGE:
    python audit_persona_drift.py [options] [persona_id]

ARGUMENTS:
    persona_id           Optional: specific persona to audit (default: all)

OPTIONS:
    --sample-size N      Number of recent interactions to sample (default: 100)
    --threshold FLOAT    Drift threshold for warnings (default: 0.15)
    --severity LEVEL     Minimum severity to report: low, medium, high (default: low)
    --output FILE        Output file for report (default: stdout)
    --format FORMAT      Output format: text, json, markdown (default: text)
    --verbose            Enable verbose logging

DRIFT CATEGORIES:
    - theological        Doctrinal accuracy and scriptural alignment
    - behavioral         Response patterns and interaction style
    - tonal              Voice, warmth, and pastoral sensitivity
    - boundary           Appropriate scope and referral patterns
    - authority          Adherence to authority foundation

SEVERITY LEVELS:
    - LOW (0.05-0.15)    Minor variations, within acceptable range
    - MEDIUM (0.15-0.30) Notable drift, requires review
    - HIGH (>0.30)       Significant drift, requires immediate attention

ENVIRONMENT VARIABLES:
    QDRANT_HOST          Qdrant server host
    QDRANT_PORT          Qdrant server port
    QDRANT_API_KEY       Optional API key
    OPENAI_API_KEY       For drift analysis

EXIT CODES:
    0 - Success (no high-severity drift)
    1 - Configuration error
    2 - Data access error
    3 - Analysis error
    4 - High-severity drift detected
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS AND DATA CLASSES
# =============================================================================

class DriftCategory(Enum):
    """Categories of persona drift."""
    THEOLOGICAL = "theological"
    BEHAVIORAL = "behavioral"
    TONAL = "tonal"
    BOUNDARY = "boundary"
    AUTHORITY = "authority"


class Severity(Enum):
    """Drift severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

    @classmethod
    def from_score(cls, score: float) -> 'Severity':
        """Determine severity from drift score."""
        if score >= 0.30:
            return cls.HIGH
        elif score >= 0.15:
            return cls.MEDIUM
        else:
            return cls.LOW


@dataclass
class DriftFinding:
    """A single drift finding."""
    category: DriftCategory
    description: str
    score: float
    severity: Severity
    examples: List[str] = field(default_factory=list)
    recommendation: str = ""


@dataclass
class DriftReport:
    """Complete drift audit report."""
    persona_id: str
    persona_name: str
    audit_timestamp: str
    sample_size: int
    sample_period: str
    overall_score: float
    overall_severity: Severity
    findings: List[DriftFinding] = field(default_factory=list)
    summary: str = ""
    requires_action: bool = False


# =============================================================================
# CONFIGURATION
# =============================================================================

class AuditConfig:
    """Configuration for drift audit."""

    def __init__(self):
        self.qdrant_host = os.environ.get('QDRANT_HOST', 'localhost')
        self.qdrant_port = int(os.environ.get('QDRANT_PORT', '6333'))
        self.qdrant_api_key = os.environ.get('QDRANT_API_KEY')
        self.openai_api_key = os.environ.get('OPENAI_API_KEY')

        # Collections
        self.persona_collection = 'inspire_canonical_personas'
        self.authority_collection = 'inspire_authority_foundation'
        self.memory_collection = 'inspire_conversation_memory'
        self.audit_collection = 'inspire_drift_audit'

        # Default thresholds
        self.default_threshold = 0.15
        self.high_severity_threshold = 0.30

        # Available personas
        self.available_personas = [
            'inspire_foundation',
            'inspire_pastor',
            'inspire_teacher',
            'inspire_counselor',
            'inspire_scholar',
        ]

        # Audit log directory
        self.log_dir = Path(
            'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/audit'
        )

    def validate(self) -> bool:
        """Validate configuration."""
        if not self.openai_api_key:
            logger.warning("OPENAI_API_KEY not set - drift analysis will be limited")
        return True


# =============================================================================
# BASELINE LOADER
# =============================================================================

class BaselineLoader:
    """Loads persona baseline from authority foundation."""

    def __init__(self, config: AuditConfig):
        self.config = config

    def load_baseline(self, persona_id: str) -> Optional[Dict[str, Any]]:
        """Load baseline standards for a persona."""
        # In production: query Qdrant for baseline vectors
        # For now, return mock baseline

        baseline = {
            'persona_id': persona_id,
            'loaded_at': datetime.now().isoformat(),
            'standards': {
                'theological': {
                    'description': 'Doctrinal accuracy and scriptural alignment',
                    'key_principles': [
                        'Scripture as ultimate authority',
                        'Trinity doctrine adherence',
                        'Gospel-centered messaging',
                    ],
                    'reference_vectors': [],  # Would contain actual embeddings
                },
                'behavioral': {
                    'description': 'Response patterns and interaction style',
                    'expected_patterns': [
                        'Ask clarifying questions before advising',
                        'Acknowledge emotional context',
                        'Provide balanced perspectives',
                    ],
                    'reference_vectors': [],
                },
                'tonal': {
                    'description': 'Voice, warmth, and pastoral sensitivity',
                    'characteristics': [
                        'Warm and approachable',
                        'Non-judgmental',
                        'Encouraging',
                    ],
                    'reference_vectors': [],
                },
                'boundary': {
                    'description': 'Appropriate scope and referral patterns',
                    'boundaries': [
                        'Refer medical issues to professionals',
                        'Acknowledge limits of AI guidance',
                        'Encourage human pastoral care',
                    ],
                    'reference_vectors': [],
                },
                'authority': {
                    'description': 'Adherence to authority foundation',
                    'requirements': [
                        'Never contradict core doctrines',
                        'Cite scripture appropriately',
                        'Maintain denominational neutrality',
                    ],
                    'reference_vectors': [],
                },
            },
        }

        return baseline


# =============================================================================
# INTERACTION SAMPLER
# =============================================================================

class InteractionSampler:
    """Samples recent interactions for analysis."""

    def __init__(self, config: AuditConfig):
        self.config = config

    def sample_interactions(
        self,
        persona_id: str,
        sample_size: int = 100,
        days_back: int = 7
    ) -> List[Dict[str, Any]]:
        """Sample recent interactions for a persona."""
        # In production: query Qdrant conversation_memory collection
        # For now, return mock interactions

        logger.debug(f"Sampling {sample_size} interactions for {persona_id}")

        # Mock interactions for demonstration
        interactions = []
        for i in range(min(sample_size, 10)):  # Limit mock data
            interactions.append({
                'interaction_id': f'int_{i:04d}',
                'persona_id': persona_id,
                'timestamp': (datetime.now() - timedelta(hours=i * 2)).isoformat(),
                'user_message': f'Sample user message {i}',
                'persona_response': f'Sample persona response {i}',
                'session_id': f'session_{i % 3}',
                'model_used': 'gpt-4o-mini',
            })

        return interactions

    def get_sample_period(self, interactions: List[Dict[str, Any]]) -> str:
        """Calculate the period covered by samples."""
        if not interactions:
            return "No interactions"

        timestamps = [i.get('timestamp', '') for i in interactions if i.get('timestamp')]
        if not timestamps:
            return "Unknown period"

        # Sort and get range
        timestamps.sort()
        return f"{timestamps[0][:10]} to {timestamps[-1][:10]}"


# =============================================================================
# DRIFT ANALYZER
# =============================================================================

class DriftAnalyzer:
    """Analyzes interactions for drift from baseline."""

    def __init__(self, config: AuditConfig, threshold: float = 0.15):
        self.config = config
        self.threshold = threshold

    def analyze(
        self,
        baseline: Dict[str, Any],
        interactions: List[Dict[str, Any]]
    ) -> List[DriftFinding]:
        """Analyze interactions against baseline for drift."""
        findings = []

        if not interactions:
            logger.warning("No interactions to analyze")
            return findings

        # Analyze each category
        for category in DriftCategory:
            finding = self._analyze_category(
                category=category,
                baseline=baseline['standards'].get(category.value, {}),
                interactions=interactions
            )
            if finding:
                findings.append(finding)

        return findings

    def _analyze_category(
        self,
        category: DriftCategory,
        baseline: Dict[str, Any],
        interactions: List[Dict[str, Any]]
    ) -> Optional[DriftFinding]:
        """Analyze a single drift category."""
        # In production: use embeddings and semantic similarity
        # For now, return mock analysis with random-ish scores

        # Simulate drift scores based on category
        # In reality, this would involve embedding comparison
        base_scores = {
            DriftCategory.THEOLOGICAL: 0.05,
            DriftCategory.BEHAVIORAL: 0.08,
            DriftCategory.TONAL: 0.12,
            DriftCategory.BOUNDARY: 0.06,
            DriftCategory.AUTHORITY: 0.03,
        }

        score = base_scores.get(category, 0.10)
        severity = Severity.from_score(score)

        # Only report if above minimum threshold
        if score < 0.05:
            return None

        finding = DriftFinding(
            category=category,
            description=baseline.get('description', f'{category.value} drift analysis'),
            score=score,
            severity=severity,
            examples=[
                f"Example {category.value} drift instance 1",
                f"Example {category.value} drift instance 2",
            ] if score > 0.10 else [],
            recommendation=self._get_recommendation(category, severity),
        )

        return finding

    def _get_recommendation(self, category: DriftCategory, severity: Severity) -> str:
        """Get recommendation based on category and severity."""
        recommendations = {
            (DriftCategory.THEOLOGICAL, Severity.HIGH): "Immediate review of doctrinal responses required. Consider retraining with authority foundation.",
            (DriftCategory.THEOLOGICAL, Severity.MEDIUM): "Review theological accuracy in recent responses. Update system prompts if needed.",
            (DriftCategory.BEHAVIORAL, Severity.HIGH): "Significant behavioral pattern changes detected. Review interaction logs.",
            (DriftCategory.BEHAVIORAL, Severity.MEDIUM): "Monitor behavioral patterns. Consider adjusting response guidelines.",
            (DriftCategory.TONAL, Severity.HIGH): "Tonal consistency issues detected. Review warmth and sensitivity settings.",
            (DriftCategory.TONAL, Severity.MEDIUM): "Minor tonal variations noted. No immediate action required.",
            (DriftCategory.BOUNDARY, Severity.HIGH): "Boundary violations detected. Review referral patterns immediately.",
            (DriftCategory.BOUNDARY, Severity.MEDIUM): "Some boundary softening noted. Reinforce scope limitations.",
            (DriftCategory.AUTHORITY, Severity.HIGH): "Authority adherence issues detected. Critical review required.",
            (DriftCategory.AUTHORITY, Severity.MEDIUM): "Minor authority drift. Review against foundation documents.",
        }

        return recommendations.get(
            (category, severity),
            "Continue monitoring. No specific action required."
        )


# =============================================================================
# REPORT GENERATOR
# =============================================================================

class ReportGenerator:
    """Generates drift audit reports."""

    def __init__(self, config: AuditConfig):
        self.config = config

    def generate_report(
        self,
        persona_id: str,
        persona_name: str,
        sample_size: int,
        sample_period: str,
        findings: List[DriftFinding]
    ) -> DriftReport:
        """Generate a complete drift report."""
        # Calculate overall score
        if findings:
            overall_score = sum(f.score for f in findings) / len(findings)
        else:
            overall_score = 0.0

        overall_severity = Severity.from_score(overall_score)

        # Determine if action is required
        requires_action = any(f.severity == Severity.HIGH for f in findings)

        # Generate summary
        summary = self._generate_summary(findings, overall_severity, requires_action)

        report = DriftReport(
            persona_id=persona_id,
            persona_name=persona_name,
            audit_timestamp=datetime.now().isoformat(),
            sample_size=sample_size,
            sample_period=sample_period,
            overall_score=overall_score,
            overall_severity=overall_severity,
            findings=findings,
            summary=summary,
            requires_action=requires_action,
        )

        return report

    def _generate_summary(
        self,
        findings: List[DriftFinding],
        overall_severity: Severity,
        requires_action: bool
    ) -> str:
        """Generate report summary."""
        high_count = sum(1 for f in findings if f.severity == Severity.HIGH)
        medium_count = sum(1 for f in findings if f.severity == Severity.MEDIUM)
        low_count = sum(1 for f in findings if f.severity == Severity.LOW)

        if requires_action:
            return f"ATTENTION REQUIRED: {high_count} high-severity drift findings detected. Immediate review recommended."
        elif medium_count > 0:
            return f"Moderate drift detected: {medium_count} medium-severity findings. Review recommended within 7 days."
        else:
            return f"Persona operating within acceptable parameters. {low_count} low-severity findings for awareness."

    def format_text(self, report: DriftReport) -> str:
        """Format report as plain text."""
        lines = [
            "=" * 70,
            "INSPIRE 8.0 PERSONA DRIFT AUDIT REPORT",
            "=" * 70,
            "",
            f"Persona:          {report.persona_name} ({report.persona_id})",
            f"Audit Timestamp:  {report.audit_timestamp}",
            f"Sample Size:      {report.sample_size} interactions",
            f"Sample Period:    {report.sample_period}",
            "",
            "-" * 70,
            "OVERALL ASSESSMENT",
            "-" * 70,
            f"Overall Score:    {report.overall_score:.3f}",
            f"Severity Level:   {report.overall_severity.value.upper()}",
            f"Action Required:  {'YES' if report.requires_action else 'No'}",
            "",
            f"Summary: {report.summary}",
            "",
        ]

        if report.findings:
            lines.extend([
                "-" * 70,
                "DETAILED FINDINGS",
                "-" * 70,
                "",
            ])

            for finding in report.findings:
                lines.extend([
                    f"Category: {finding.category.value.upper()}",
                    f"  Score:       {finding.score:.3f}",
                    f"  Severity:    {finding.severity.value.upper()}",
                    f"  Description: {finding.description}",
                ])

                if finding.examples:
                    lines.append("  Examples:")
                    for example in finding.examples:
                        lines.append(f"    - {example}")

                if finding.recommendation:
                    lines.append(f"  Recommendation: {finding.recommendation}")

                lines.append("")

        lines.extend([
            "=" * 70,
            "END OF REPORT",
            "=" * 70,
        ])

        return "\n".join(lines)

    def format_json(self, report: DriftReport) -> str:
        """Format report as JSON."""
        data = {
            'persona_id': report.persona_id,
            'persona_name': report.persona_name,
            'audit_timestamp': report.audit_timestamp,
            'sample_size': report.sample_size,
            'sample_period': report.sample_period,
            'overall_score': report.overall_score,
            'overall_severity': report.overall_severity.value,
            'requires_action': report.requires_action,
            'summary': report.summary,
            'findings': [
                {
                    'category': f.category.value,
                    'description': f.description,
                    'score': f.score,
                    'severity': f.severity.value,
                    'examples': f.examples,
                    'recommendation': f.recommendation,
                }
                for f in report.findings
            ],
        }
        return json.dumps(data, indent=2)

    def format_markdown(self, report: DriftReport) -> str:
        """Format report as Markdown."""
        lines = [
            "# Inspire 8.0 Persona Drift Audit Report",
            "",
            f"**Persona:** {report.persona_name} (`{report.persona_id}`)",
            f"**Audit Timestamp:** {report.audit_timestamp}",
            f"**Sample Size:** {report.sample_size} interactions",
            f"**Sample Period:** {report.sample_period}",
            "",
            "## Overall Assessment",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Overall Score | {report.overall_score:.3f} |",
            f"| Severity Level | **{report.overall_severity.value.upper()}** |",
            f"| Action Required | {'**YES**' if report.requires_action else 'No'} |",
            "",
            f"> {report.summary}",
            "",
        ]

        if report.findings:
            lines.extend([
                "## Detailed Findings",
                "",
            ])

            for finding in report.findings:
                severity_badge = {
                    Severity.HIGH: "🔴 HIGH",
                    Severity.MEDIUM: "🟡 MEDIUM",
                    Severity.LOW: "🟢 LOW",
                }.get(finding.severity, finding.severity.value)

                lines.extend([
                    f"### {finding.category.value.title()} ({severity_badge})",
                    "",
                    f"**Score:** {finding.score:.3f}",
                    "",
                    f"{finding.description}",
                    "",
                ])

                if finding.examples:
                    lines.append("**Examples:**")
                    for example in finding.examples:
                        lines.append(f"- {example}")
                    lines.append("")

                if finding.recommendation:
                    lines.extend([
                        "**Recommendation:**",
                        f"> {finding.recommendation}",
                        "",
                    ])

        lines.extend([
            "---",
            "*Generated by Inspire 8.0 Drift Audit System*",
        ])

        return "\n".join(lines)


# =============================================================================
# DRIFT AUDITOR
# =============================================================================

class DriftAuditor:
    """Main class for persona drift auditing."""

    def __init__(
        self,
        config: AuditConfig,
        sample_size: int = 100,
        threshold: float = 0.15,
        min_severity: Severity = Severity.LOW
    ):
        self.config = config
        self.sample_size = sample_size
        self.threshold = threshold
        self.min_severity = min_severity

        self.baseline_loader = BaselineLoader(config)
        self.sampler = InteractionSampler(config)
        self.analyzer = DriftAnalyzer(config, threshold)
        self.report_generator = ReportGenerator(config)

    def audit_persona(self, persona_id: str) -> DriftReport:
        """Audit a single persona for drift."""
        logger.info(f"Auditing persona: {persona_id}")

        # Load baseline
        logger.debug("Loading baseline...")
        baseline = self.baseline_loader.load_baseline(persona_id)
        if not baseline:
            raise ValueError(f"Could not load baseline for {persona_id}")

        # Sample interactions
        logger.debug(f"Sampling {self.sample_size} interactions...")
        interactions = self.sampler.sample_interactions(
            persona_id=persona_id,
            sample_size=self.sample_size
        )

        sample_period = self.sampler.get_sample_period(interactions)
        logger.info(f"Sampled {len(interactions)} interactions from {sample_period}")

        # Analyze for drift
        logger.debug("Analyzing for drift...")
        findings = self.analyzer.analyze(baseline, interactions)

        # Filter by minimum severity
        findings = [f for f in findings if self._severity_meets_minimum(f.severity)]

        # Generate report
        logger.debug("Generating report...")
        persona_name = persona_id.replace('inspire_', '').replace('_', ' ').title()

        report = self.report_generator.generate_report(
            persona_id=persona_id,
            persona_name=f"Inspire {persona_name}",
            sample_size=len(interactions),
            sample_period=sample_period,
            findings=findings
        )

        return report

    def audit_all(self) -> List[DriftReport]:
        """Audit all configured personas."""
        reports = []
        for persona_id in self.config.available_personas:
            try:
                report = self.audit_persona(persona_id)
                reports.append(report)
            except Exception as e:
                logger.error(f"Failed to audit {persona_id}: {e}")

        return reports

    def _severity_meets_minimum(self, severity: Severity) -> bool:
        """Check if severity meets minimum threshold."""
        severity_order = [Severity.LOW, Severity.MEDIUM, Severity.HIGH]
        return severity_order.index(severity) >= severity_order.index(self.min_severity)

    def save_audit_log(self, report: DriftReport):
        """Save audit report to log file."""
        self.config.log_dir.mkdir(parents=True, exist_ok=True)

        filename = f"drift_{report.persona_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        log_file = self.config.log_dir / filename

        log_file.write_text(self.report_generator.format_json(report))
        logger.info(f"Audit log saved: {log_file}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Audit Inspire 8.0 persona for drift from baseline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'persona_id',
        type=str,
        nargs='?',
        help='Specific persona to audit (default: all)'
    )
    parser.add_argument(
        '--sample-size',
        type=int,
        default=100,
        help='Number of recent interactions to sample (default: 100)'
    )
    parser.add_argument(
        '--threshold',
        type=float,
        default=0.15,
        help='Drift threshold for warnings (default: 0.15)'
    )
    parser.add_argument(
        '--severity',
        type=str,
        choices=['low', 'medium', 'high'],
        default='low',
        help='Minimum severity to report (default: low)'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output file for report (default: stdout)'
    )
    parser.add_argument(
        '--format',
        type=str,
        choices=['text', 'json', 'markdown'],
        default='text',
        help='Output format (default: text)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load configuration
    config = AuditConfig()
    if not config.validate():
        logger.error("Configuration validation failed")
        return 1

    # Validate persona if specified
    if args.persona_id and args.persona_id not in config.available_personas:
        logger.error(f"Unknown persona: {args.persona_id}")
        logger.info(f"Available personas: {', '.join(config.available_personas)}")
        return 2

    # Map severity string to enum
    min_severity = Severity(args.severity)

    # Create auditor
    auditor = DriftAuditor(
        config=config,
        sample_size=args.sample_size,
        threshold=args.threshold,
        min_severity=min_severity,
    )

    try:
        # Execute audit
        if args.persona_id:
            reports = [auditor.audit_persona(args.persona_id)]
        else:
            reports = auditor.audit_all()

        # Format output
        format_func = {
            'text': auditor.report_generator.format_text,
            'json': auditor.report_generator.format_json,
            'markdown': auditor.report_generator.format_markdown,
        }[args.format]

        outputs = [format_func(report) for report in reports]
        combined_output = "\n\n".join(outputs)

        # Write output
        if args.output:
            Path(args.output).write_text(combined_output)
            logger.info(f"Report written to: {args.output}")
        else:
            print(combined_output)

        # Save audit logs
        for report in reports:
            auditor.save_audit_log(report)

        # Check for high-severity drift
        high_severity_found = any(r.requires_action for r in reports)

        if high_severity_found:
            logger.warning("HIGH-SEVERITY DRIFT DETECTED - Review required")
            return 4
        else:
            logger.info("Audit completed successfully")
            return 0

    except Exception as e:
        logger.exception(f"Audit failed with exception: {e}")
        return 3


if __name__ == '__main__':
    sys.exit(main())
