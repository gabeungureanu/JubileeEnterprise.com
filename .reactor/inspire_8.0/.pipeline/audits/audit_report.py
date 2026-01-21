# =============================================================================
# AUDIT REPORT GENERATOR
# =============================================================================
"""
Audit report generation for the Inspire 8.0 pipeline.

This module generates structured audit reports in multiple formats
for review, documentation, and compliance purposes.

REPORT FORMATS:
- JSON: Machine-readable structured data
- MARKDOWN: Human-readable documentation
- HTML: Formatted for web viewing
- TEXT: Plain text for console output

REPORT CONTENTS:
- Executive summary
- Detailed findings by severity
- Affected personas
- Source interactions
- Recommendations
- Remediation tracking
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .doctrine_alignment import DoctrineAuditResult, DeviationType, DeviationSeverity

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class ReportFormat(Enum):
    """Available report formats."""
    JSON = "json"
    MARKDOWN = "markdown"
    HTML = "html"
    TEXT = "text"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class AuditReport:
    """
    Comprehensive audit report.

    Aggregates audit results into a formatted report
    suitable for review and documentation.
    """
    # Identification
    report_id: str = ""
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    report_title: str = "Inspire 8.0 Doctrine Alignment Audit Report"

    # Source audit
    source_audit_id: str = ""
    source_audit_timestamp: str = ""

    # Scope
    personas_covered: List[str] = field(default_factory=list)
    period_start: str = ""
    period_end: str = ""
    sample_size: int = 0

    # Executive summary
    overall_status: str = ""  # PASS, FAIL, REVIEW_REQUIRED
    summary_text: str = ""

    # Statistics
    total_deviations: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0

    # By category
    deviations_by_type: Dict[str, int] = field(default_factory=dict)
    deviations_by_persona: Dict[str, int] = field(default_factory=dict)

    # Detailed findings
    critical_findings: List[Dict[str, Any]] = field(default_factory=list)
    high_findings: List[Dict[str, Any]] = field(default_factory=list)
    medium_findings: List[Dict[str, Any]] = field(default_factory=list)
    low_findings: List[Dict[str, Any]] = field(default_factory=list)

    # Recommendations
    recommendations: List[str] = field(default_factory=list)
    required_actions: List[str] = field(default_factory=list)

    # Metadata
    report_version: str = "1.0.0"
    generator_version: str = "1.0.0"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'report_id': self.report_id,
            'generated_at': self.generated_at,
            'report_title': self.report_title,
            'source_audit': {
                'audit_id': self.source_audit_id,
                'timestamp': self.source_audit_timestamp,
            },
            'scope': {
                'personas_covered': self.personas_covered,
                'period_start': self.period_start,
                'period_end': self.period_end,
                'sample_size': self.sample_size,
            },
            'executive_summary': {
                'overall_status': self.overall_status,
                'summary': self.summary_text,
            },
            'statistics': {
                'total_deviations': self.total_deviations,
                'critical_count': self.critical_count,
                'high_count': self.high_count,
                'medium_count': self.medium_count,
                'low_count': self.low_count,
                'by_type': self.deviations_by_type,
                'by_persona': self.deviations_by_persona,
            },
            'findings': {
                'critical': self.critical_findings,
                'high': self.high_findings,
                'medium': self.medium_findings,
                'low': self.low_findings,
            },
            'recommendations': self.recommendations,
            'required_actions': self.required_actions,
            'metadata': {
                'report_version': self.report_version,
                'generator_version': self.generator_version,
            },
        }


# =============================================================================
# REPORT GENERATOR
# =============================================================================

class AuditReportGenerator:
    """
    Generates formatted audit reports from audit results.

    Supports multiple output formats for different use cases.
    """

    def __init__(self, output_dir: Path = None):
        self.output_dir = output_dir or Path(
            'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/audits/reports'
        )

    def generate(
        self,
        audit_result: DoctrineAuditResult,
        format: ReportFormat = ReportFormat.MARKDOWN
    ) -> str:
        """
        Generate a report from audit result.

        Args:
            audit_result: The audit result to report on
            format: Output format

        Returns:
            Formatted report string
        """
        # Build report structure
        report = self._build_report(audit_result)

        # Format output
        formatters = {
            ReportFormat.JSON: self._format_json,
            ReportFormat.MARKDOWN: self._format_markdown,
            ReportFormat.HTML: self._format_html,
            ReportFormat.TEXT: self._format_text,
        }

        formatter = formatters.get(format, self._format_text)
        return formatter(report)

    def _build_report(self, audit_result: DoctrineAuditResult) -> AuditReport:
        """Build report structure from audit result."""
        import uuid

        report = AuditReport(
            report_id=str(uuid.uuid4()),
            source_audit_id=audit_result.audit_id,
            source_audit_timestamp=audit_result.audit_timestamp,
            personas_covered=audit_result.personas_audited,
            period_start=audit_result.sample_period_start,
            period_end=audit_result.sample_period_end,
            sample_size=audit_result.sample_size,
            total_deviations=audit_result.total_deviations,
            critical_count=audit_result.critical_count,
            high_count=audit_result.high_count,
            medium_count=audit_result.medium_count,
            low_count=audit_result.low_count,
            deviations_by_type=audit_result.by_type,
            recommendations=audit_result.recommendations,
        )

        # Determine overall status
        if audit_result.critical_count > 0:
            report.overall_status = "FAIL"
            report.required_actions.append("Resolve all critical issues before deployment")
        elif audit_result.high_count > 0:
            report.overall_status = "FAIL"
            report.required_actions.append("Resolve high-severity issues before deployment")
        elif audit_result.requires_review:
            report.overall_status = "REVIEW_REQUIRED"
            report.required_actions.append("Manual review recommended before next iteration")
        else:
            report.overall_status = "PASS"

        # Generate summary
        report.summary_text = self._generate_summary(audit_result, report.overall_status)

        # Categorize findings
        for deviation in audit_result.deviations:
            finding = deviation.to_dict()

            if deviation.severity == DeviationSeverity.CRITICAL:
                report.critical_findings.append(finding)
            elif deviation.severity == DeviationSeverity.HIGH:
                report.high_findings.append(finding)
            elif deviation.severity == DeviationSeverity.MEDIUM:
                report.medium_findings.append(finding)
            else:
                report.low_findings.append(finding)

            # Track by persona
            if deviation.persona_id:
                if deviation.persona_id not in report.deviations_by_persona:
                    report.deviations_by_persona[deviation.persona_id] = 0
                report.deviations_by_persona[deviation.persona_id] += 1

        return report

    def _generate_summary(self, result: DoctrineAuditResult, status: str) -> str:
        """Generate executive summary text."""
        parts = []

        parts.append(f"Audit completed with status: {status}.")

        if result.sample_size > 0:
            parts.append(f"Analyzed {result.sample_size} interactions across {len(result.personas_audited)} personas.")

        if result.total_deviations == 0:
            parts.append("No doctrine alignment issues were detected.")
        else:
            parts.append(f"Found {result.total_deviations} total deviations:")
            if result.critical_count > 0:
                parts.append(f"  - {result.critical_count} CRITICAL issues requiring immediate attention")
            if result.high_count > 0:
                parts.append(f"  - {result.high_count} HIGH severity issues")
            if result.medium_count > 0:
                parts.append(f"  - {result.medium_count} MEDIUM severity issues")
            if result.low_count > 0:
                parts.append(f"  - {result.low_count} LOW severity issues")

        return " ".join(parts)

    def _format_json(self, report: AuditReport) -> str:
        """Format report as JSON."""
        return json.dumps(report.to_dict(), indent=2, default=str)

    def _format_markdown(self, report: AuditReport) -> str:
        """Format report as Markdown."""
        lines = []

        # Header
        lines.append(f"# {report.report_title}")
        lines.append("")
        lines.append(f"**Generated:** {report.generated_at}")
        lines.append(f"**Report ID:** {report.report_id}")
        lines.append(f"**Source Audit:** {report.source_audit_id}")
        lines.append("")

        # Executive Summary
        lines.append("## Executive Summary")
        lines.append("")
        status_emoji = {"PASS": "✅", "FAIL": "❌", "REVIEW_REQUIRED": "⚠️"}.get(report.overall_status, "❓")
        lines.append(f"**Status:** {status_emoji} {report.overall_status}")
        lines.append("")
        lines.append(report.summary_text)
        lines.append("")

        # Statistics
        lines.append("## Statistics")
        lines.append("")
        lines.append("| Severity | Count |")
        lines.append("|----------|-------|")
        lines.append(f"| 🔴 Critical | {report.critical_count} |")
        lines.append(f"| 🟠 High | {report.high_count} |")
        lines.append(f"| 🟡 Medium | {report.medium_count} |")
        lines.append(f"| 🟢 Low | {report.low_count} |")
        lines.append(f"| **Total** | **{report.total_deviations}** |")
        lines.append("")

        # By Type
        if report.deviations_by_type:
            lines.append("### By Type")
            lines.append("")
            for type_name, count in report.deviations_by_type.items():
                lines.append(f"- {type_name}: {count}")
            lines.append("")

        # By Persona
        if report.deviations_by_persona:
            lines.append("### By Persona")
            lines.append("")
            for persona, count in report.deviations_by_persona.items():
                lines.append(f"- {persona}: {count}")
            lines.append("")

        # Critical Findings
        if report.critical_findings:
            lines.append("## 🔴 Critical Findings")
            lines.append("")
            for finding in report.critical_findings:
                lines.append(f"### {finding.get('deviation_type', 'Unknown')}")
                lines.append(f"- **Persona:** {finding.get('persona_id', 'N/A')}")
                lines.append(f"- **Violated Doctrine:** {finding.get('violated_doctrine', 'N/A')}")
                lines.append(f"- **Explanation:** {finding.get('explanation', 'N/A')}")
                if finding.get('problematic_segment'):
                    lines.append(f"- **Segment:** `{finding.get('problematic_segment')[:100]}...`")
                lines.append(f"- **Remediation:** {finding.get('remediation_hint', 'N/A')}")
                lines.append("")

        # High Findings
        if report.high_findings:
            lines.append("## 🟠 High Severity Findings")
            lines.append("")
            for finding in report.high_findings:
                lines.append(f"### {finding.get('deviation_type', 'Unknown')}")
                lines.append(f"- **Persona:** {finding.get('persona_id', 'N/A')}")
                lines.append(f"- **Violated Doctrine:** {finding.get('violated_doctrine', 'N/A')}")
                lines.append(f"- **Explanation:** {finding.get('explanation', 'N/A')}")
                lines.append(f"- **Remediation:** {finding.get('remediation_hint', 'N/A')}")
                lines.append("")

        # Medium Findings (summarized)
        if report.medium_findings:
            lines.append("## 🟡 Medium Severity Findings")
            lines.append("")
            lines.append(f"*{len(report.medium_findings)} medium-severity issues found. See detailed report for specifics.*")
            lines.append("")

        # Low Findings (summarized)
        if report.low_findings:
            lines.append("## 🟢 Low Severity Findings")
            lines.append("")
            lines.append(f"*{len(report.low_findings)} low-severity issues for awareness.*")
            lines.append("")

        # Recommendations
        if report.recommendations:
            lines.append("## Recommendations")
            lines.append("")
            for rec in report.recommendations:
                lines.append(f"- {rec}")
            lines.append("")

        # Required Actions
        if report.required_actions:
            lines.append("## Required Actions")
            lines.append("")
            for action in report.required_actions:
                lines.append(f"- [ ] {action}")
            lines.append("")

        # Footer
        lines.append("---")
        lines.append(f"*Generated by Inspire 8.0 Audit System v{report.generator_version}*")

        return "\n".join(lines)

    def _format_html(self, report: AuditReport) -> str:
        """Format report as HTML."""
        # Convert markdown to basic HTML
        md = self._format_markdown(report)

        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{report.report_title}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #1a1a2e; border-bottom: 2px solid #4a4e69; padding-bottom: 10px; }}
        h2 {{ color: #4a4e69; margin-top: 30px; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #4a4e69; color: white; }}
        tr:nth-child(even) {{ background-color: #f9f9f9; }}
        .status-pass {{ color: green; }}
        .status-fail {{ color: red; }}
        .status-review {{ color: orange; }}
        .critical {{ background-color: #ffebee; }}
        .high {{ background-color: #fff3e0; }}
        .medium {{ background-color: #fffde7; }}
        .low {{ background-color: #e8f5e9; }}
        pre {{ background: #f5f5f5; padding: 10px; overflow-x: auto; }}
    </style>
</head>
<body>
    <h1>{report.report_title}</h1>
    <p><strong>Generated:</strong> {report.generated_at}</p>
    <p><strong>Status:</strong> <span class="status-{report.overall_status.lower()}">{report.overall_status}</span></p>

    <h2>Executive Summary</h2>
    <p>{report.summary_text}</p>

    <h2>Statistics</h2>
    <table>
        <tr><th>Severity</th><th>Count</th></tr>
        <tr class="critical"><td>Critical</td><td>{report.critical_count}</td></tr>
        <tr class="high"><td>High</td><td>{report.high_count}</td></tr>
        <tr class="medium"><td>Medium</td><td>{report.medium_count}</td></tr>
        <tr class="low"><td>Low</td><td>{report.low_count}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>{report.total_deviations}</strong></td></tr>
    </table>

    <h2>Recommendations</h2>
    <ul>
        {''.join(f'<li>{r}</li>' for r in report.recommendations)}
    </ul>

    <hr>
    <p><em>Generated by Inspire 8.0 Audit System v{report.generator_version}</em></p>
</body>
</html>"""
        return html

    def _format_text(self, report: AuditReport) -> str:
        """Format report as plain text."""
        lines = []

        lines.append("=" * 70)
        lines.append(report.report_title.upper())
        lines.append("=" * 70)
        lines.append("")
        lines.append(f"Generated: {report.generated_at}")
        lines.append(f"Report ID: {report.report_id}")
        lines.append(f"Status: {report.overall_status}")
        lines.append("")
        lines.append("-" * 70)
        lines.append("EXECUTIVE SUMMARY")
        lines.append("-" * 70)
        lines.append(report.summary_text)
        lines.append("")
        lines.append("-" * 70)
        lines.append("STATISTICS")
        lines.append("-" * 70)
        lines.append(f"Critical: {report.critical_count}")
        lines.append(f"High:     {report.high_count}")
        lines.append(f"Medium:   {report.medium_count}")
        lines.append(f"Low:      {report.low_count}")
        lines.append(f"Total:    {report.total_deviations}")
        lines.append("")

        if report.recommendations:
            lines.append("-" * 70)
            lines.append("RECOMMENDATIONS")
            lines.append("-" * 70)
            for rec in report.recommendations:
                lines.append(f"  - {rec}")
            lines.append("")

        if report.required_actions:
            lines.append("-" * 70)
            lines.append("REQUIRED ACTIONS")
            lines.append("-" * 70)
            for action in report.required_actions:
                lines.append(f"  [ ] {action}")
            lines.append("")

        lines.append("=" * 70)
        lines.append("END OF REPORT")
        lines.append("=" * 70)

        return "\n".join(lines)

    def save(
        self,
        report_content: str,
        format: ReportFormat,
        filename: str = None
    ) -> Path:
        """
        Save report to file.

        Args:
            report_content: The formatted report content
            format: Report format
            filename: Optional filename (auto-generated if not provided)

        Returns:
            Path to saved file
        """
        self.output_dir.mkdir(parents=True, exist_ok=True)

        extensions = {
            ReportFormat.JSON: ".json",
            ReportFormat.MARKDOWN: ".md",
            ReportFormat.HTML: ".html",
            ReportFormat.TEXT: ".txt",
        }

        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"audit_report_{timestamp}{extensions.get(format, '.txt')}"

        filepath = self.output_dir / filename
        filepath.write_text(report_content, encoding='utf-8')

        logger.info(f"Report saved: {filepath}")
        return filepath


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def generate_audit_report(
    audit_result: DoctrineAuditResult,
    format: ReportFormat = ReportFormat.MARKDOWN
) -> str:
    """
    Generate a formatted audit report.

    Example:
        result = run_doctrine_audit()
        report = generate_audit_report(result, ReportFormat.MARKDOWN)
        print(report)
    """
    generator = AuditReportGenerator()
    return generator.generate(audit_result, format)


def save_audit_report(
    audit_result: DoctrineAuditResult,
    format: ReportFormat = ReportFormat.MARKDOWN,
    filename: str = None
) -> Path:
    """
    Generate and save an audit report.

    Example:
        result = run_doctrine_audit()
        filepath = save_audit_report(result, ReportFormat.HTML)
        print(f"Report saved to: {filepath}")
    """
    generator = AuditReportGenerator()
    content = generator.generate(audit_result, format)
    return generator.save(content, format, filename)
