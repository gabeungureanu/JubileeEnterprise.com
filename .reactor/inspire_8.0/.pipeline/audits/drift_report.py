# =============================================================================
# DRIFT DETECTION REPORT GENERATOR
# =============================================================================
"""
Report generation for drift detection results.

Generates structured reports documenting detected drift,
affected personas, nature of shifts, and supporting evidence.

REPORT FORMATS:
- JSON: Machine-readable structured data
- Markdown: Human-readable with tables and formatting
- HTML: Styled report for browser viewing
- Text: Plain text for console output

REPORT CONTENTS:
1. Executive Summary
2. Drift Overview
3. Findings by Category
4. Metrics Comparison
5. Evidence Examples
6. Recommended Actions
7. Historical Trend (if available)
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .drift_detection import (
    DriftDetectionResult,
    DriftFinding,
    DriftMetrics,
    DriftSeverity,
    DriftCategory,
    DriftAction,
)

logger = logging.getLogger(__name__)


# =============================================================================
# REPORT FORMAT
# =============================================================================

class DriftReportFormat(Enum):
    """Available report formats."""
    JSON = "json"
    MARKDOWN = "markdown"
    HTML = "html"
    TEXT = "text"


# =============================================================================
# DRIFT REPORT
# =============================================================================

@dataclass
class DriftReport:
    """
    Complete drift detection report.

    Aggregates detection results with formatting for
    operator review and action planning.
    """
    # Report metadata
    report_id: str = ""
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    report_format: DriftReportFormat = DriftReportFormat.MARKDOWN

    # Detection result
    result: DriftDetectionResult = field(default_factory=DriftDetectionResult)

    # Report content
    title: str = ""
    executive_summary: str = ""
    detailed_content: str = ""

    # Historical context
    previous_reports: List[str] = field(default_factory=list)
    trend_direction: str = ""  # improving, stable, worsening

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'report_id': self.report_id,
            'generated_at': self.generated_at,
            'format': self.report_format.value,
            'title': self.title,
            'executive_summary': self.executive_summary,
            'result': self.result.to_dict(),
            'historical': {
                'previous_reports': self.previous_reports,
                'trend_direction': self.trend_direction,
            },
        }


# =============================================================================
# REPORT GENERATOR
# =============================================================================

class DriftReportGenerator:
    """
    Generates drift detection reports in multiple formats.
    """

    def __init__(self, output_dir: Path = None):
        self.output_dir = output_dir or Path(
            'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/drift'
        )
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate(
        self,
        result: DriftDetectionResult,
        format: DriftReportFormat = DriftReportFormat.MARKDOWN
    ) -> str:
        """
        Generate a drift report in the specified format.

        Args:
            result: DriftDetectionResult to report on
            format: Output format

        Returns:
            Formatted report string
        """
        if format == DriftReportFormat.JSON:
            return self._format_json(result)
        elif format == DriftReportFormat.MARKDOWN:
            return self._format_markdown(result)
        elif format == DriftReportFormat.HTML:
            return self._format_html(result)
        else:
            return self._format_text(result)

    def save(
        self,
        content: str,
        format: DriftReportFormat,
        persona_id: str = ""
    ) -> Path:
        """
        Save report to file.

        Args:
            content: Report content
            format: Report format
            persona_id: Optional persona identifier for filename

        Returns:
            Path to saved file
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        persona_part = f"_{persona_id}" if persona_id else ""

        extensions = {
            DriftReportFormat.JSON: '.json',
            DriftReportFormat.MARKDOWN: '.md',
            DriftReportFormat.HTML: '.html',
            DriftReportFormat.TEXT: '.txt',
        }
        ext = extensions.get(format, '.txt')

        filename = f"drift_report{persona_part}_{timestamp}{ext}"
        filepath = self.output_dir / filename

        filepath.write_text(content, encoding='utf-8')
        logger.info(f"Drift report saved to: {filepath}")

        return filepath

    def _format_json(self, result: DriftDetectionResult) -> str:
        """Format as JSON."""
        return json.dumps(result.to_dict(), indent=2, default=str)

    def _format_markdown(self, result: DriftDetectionResult) -> str:
        """Format as Markdown."""
        lines = []

        # Header
        lines.append("# Persona Drift Detection Report")
        lines.append("")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**Detection ID:** `{result.detection_id}`")
        lines.append("")

        # Executive Summary
        lines.append("## Executive Summary")
        lines.append("")

        severity_emoji = {
            DriftSeverity.MINIMAL: "✅",
            DriftSeverity.LOW: "📊",
            DriftSeverity.MODERATE: "⚠️",
            DriftSeverity.HIGH: "🔶",
            DriftSeverity.CRITICAL: "🚨",
        }
        emoji = severity_emoji.get(result.overall_severity, "📋")

        lines.append(f"| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Persona | **{result.persona_id}** |")
        lines.append(f"| Baseline Period | {result.baseline_period} |")
        lines.append(f"| Current Period | {result.current_period} |")
        lines.append(f"| Drift Detected | {'**Yes**' if result.overall_drift_detected else 'No'} |")
        lines.append(f"| Overall Severity | {emoji} {result.overall_severity.value.upper()} |")
        lines.append(f"| Drift Score | **{result.drift_score:.1f}** / 100 |")
        lines.append(f"| Intervention Required | {'**Yes**' if result.requires_intervention else 'No'} |")
        lines.append("")

        if result.action_summary:
            lines.append(f"> {result.action_summary}")
            lines.append("")

        # Sample Information
        lines.append("## Sample Information")
        lines.append("")
        lines.append(f"- **Baseline Samples:** {result.baseline_sample_count}")
        lines.append(f"- **Current Samples:** {result.current_sample_count}")
        lines.append("")

        # Findings Summary
        if result.findings:
            lines.append("## Findings Summary")
            lines.append("")
            lines.append(f"**Total Findings:** {len(result.findings)}")
            lines.append("")

            if result.findings_by_severity:
                lines.append("### By Severity")
                lines.append("")
                for sev, count in sorted(result.findings_by_severity.items()):
                    sev_emoji = severity_emoji.get(DriftSeverity(sev), "📋")
                    lines.append(f"- {sev_emoji} **{sev.upper()}:** {count}")
                lines.append("")

            if result.findings_by_category:
                lines.append("### By Category")
                lines.append("")
                for cat, count in sorted(result.findings_by_category.items()):
                    lines.append(f"- **{cat.title()}:** {count}")
                lines.append("")

        # Detailed Findings
        if result.findings:
            lines.append("## Detailed Findings")
            lines.append("")

            for i, finding in enumerate(result.findings, 1):
                sev_emoji = severity_emoji.get(finding.severity, "📋")
                lines.append(f"### {i}. {sev_emoji} {finding.title}")
                lines.append("")
                lines.append(f"**Category:** {finding.category.value.title()}")
                lines.append(f"**Severity:** {finding.severity.value.upper()}")
                lines.append("")
                lines.append(f"{finding.description}")
                lines.append("")

                if finding.metrics:
                    lines.append("**Metrics:**")
                    lines.append("")
                    lines.append(f"| Measure | Baseline | Current | Change |")
                    lines.append("|---------|----------|---------|--------|")
                    m = finding.metrics
                    change_str = f"{m.percent_delta:+.1f}%"
                    if m.direction == "increase":
                        change_str = f"📈 {change_str}"
                    elif m.direction == "decrease":
                        change_str = f"📉 {change_str}"
                    lines.append(
                        f"| {m.dimension} | {m.baseline_value:.3f} | "
                        f"{m.current_value:.3f} | {change_str} |"
                    )
                    lines.append("")

                if finding.recommended_action != DriftAction.NONE:
                    action_emoji = {
                        DriftAction.MONITOR: "👀",
                        DriftAction.REVIEW: "📝",
                        DriftAction.DEEP_AUDIT: "🔍",
                        DriftAction.ANCHOR_REVIEW: "⚓",
                        DriftAction.MEMORY_RESTRICTION: "🚫",
                        DriftAction.PERSONA_SUSPENSION: "⏸️",
                    }
                    a_emoji = action_emoji.get(finding.recommended_action, "➡️")
                    lines.append(
                        f"**Recommended Action:** {a_emoji} "
                        f"{finding.recommended_action.value.replace('_', ' ').title()}"
                    )
                    if finding.action_rationale:
                        lines.append(f"  - {finding.action_rationale}")
                    lines.append("")

                lines.append("---")
                lines.append("")

        # Metrics Comparison
        if result.metrics:
            lines.append("## Metrics Comparison")
            lines.append("")
            lines.append("| Metric | Category | Baseline | Current | Change | Significant |")
            lines.append("|--------|----------|----------|---------|--------|-------------|")

            for m in result.metrics:
                sig = "⚠️ Yes" if m.significant else "No"
                change = f"{m.percent_delta:+.1f}%"
                lines.append(
                    f"| {m.dimension} | {m.category.value} | "
                    f"{m.baseline_value:.3f} | {m.current_value:.3f} | "
                    f"{change} | {sig} |"
                )
            lines.append("")

        # Significant Metrics
        if result.significant_metrics:
            lines.append("## Significant Changes")
            lines.append("")
            lines.append("The following metrics showed statistically significant changes:")
            lines.append("")
            for metric in result.significant_metrics:
                lines.append(f"- **{metric}**")
            lines.append("")

        # Recommended Actions
        if result.recommended_actions:
            lines.append("## Recommended Actions")
            lines.append("")
            for action in result.recommended_actions:
                if action != DriftAction.NONE:
                    lines.append(f"- [ ] {action.value.replace('_', ' ').title()}")
            lines.append("")

        # Footer
        lines.append("---")
        lines.append("")
        lines.append("*Report generated by Inspire 8.0 Drift Detection System*")

        return "\n".join(lines)

    def _format_html(self, result: DriftDetectionResult) -> str:
        """Format as HTML."""
        severity_colors = {
            DriftSeverity.MINIMAL: "#28a745",
            DriftSeverity.LOW: "#17a2b8",
            DriftSeverity.MODERATE: "#ffc107",
            DriftSeverity.HIGH: "#fd7e14",
            DriftSeverity.CRITICAL: "#dc3545",
        }

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Drift Detection Report - {result.persona_id}</title>
    <style>
        :root {{
            --primary: #2c3e50;
            --secondary: #34495e;
            --success: #28a745;
            --warning: #ffc107;
            --danger: #dc3545;
            --info: #17a2b8;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }}
        .header {{
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0 0 10px 0;
        }}
        .meta {{
            opacity: 0.9;
            font-size: 0.9em;
        }}
        .card {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .card h2 {{
            margin-top: 0;
            color: var(--primary);
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }}
        .summary-item {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }}
        .summary-item .label {{
            font-size: 0.85em;
            color: #666;
            text-transform: uppercase;
        }}
        .summary-item .value {{
            font-size: 1.5em;
            font-weight: bold;
            color: var(--primary);
        }}
        .severity-badge {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            color: white;
        }}
        .severity-minimal {{ background: {severity_colors[DriftSeverity.MINIMAL]}; }}
        .severity-low {{ background: {severity_colors[DriftSeverity.LOW]}; }}
        .severity-moderate {{ background: {severity_colors[DriftSeverity.MODERATE]}; color: #333; }}
        .severity-high {{ background: {severity_colors[DriftSeverity.HIGH]}; }}
        .severity-critical {{ background: {severity_colors[DriftSeverity.CRITICAL]}; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }}
        th {{
            background: #f8f9fa;
            font-weight: 600;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        .finding {{
            border-left: 4px solid;
            padding-left: 15px;
            margin: 15px 0;
        }}
        .finding-minimal {{ border-color: {severity_colors[DriftSeverity.MINIMAL]}; }}
        .finding-low {{ border-color: {severity_colors[DriftSeverity.LOW]}; }}
        .finding-moderate {{ border-color: {severity_colors[DriftSeverity.MODERATE]}; }}
        .finding-high {{ border-color: {severity_colors[DriftSeverity.HIGH]}; }}
        .finding-critical {{ border-color: {severity_colors[DriftSeverity.CRITICAL]}; }}
        .change-positive {{ color: var(--success); }}
        .change-negative {{ color: var(--danger); }}
        .action-box {{
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }}
        .action-box.critical {{
            background: #f8d7da;
            border-color: var(--danger);
        }}
        .footer {{
            text-align: center;
            color: #666;
            font-size: 0.85em;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Persona Drift Detection Report</h1>
        <div class="meta">
            <strong>Persona:</strong> {result.persona_id} |
            <strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |
            <strong>Detection ID:</strong> {result.detection_id}
        </div>
    </div>

    <div class="card">
        <h2>Executive Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="label">Drift Detected</div>
                <div class="value">{'Yes' if result.overall_drift_detected else 'No'}</div>
            </div>
            <div class="summary-item">
                <div class="label">Severity</div>
                <div class="value">
                    <span class="severity-badge severity-{result.overall_severity.value}">
                        {result.overall_severity.value.upper()}
                    </span>
                </div>
            </div>
            <div class="summary-item">
                <div class="label">Drift Score</div>
                <div class="value">{result.drift_score:.1f}</div>
            </div>
            <div class="summary-item">
                <div class="label">Findings</div>
                <div class="value">{len(result.findings)}</div>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-item">
                <div class="label">Baseline Period</div>
                <div class="value" style="font-size: 1.1em;">{result.baseline_period}</div>
            </div>
            <div class="summary-item">
                <div class="label">Current Period</div>
                <div class="value" style="font-size: 1.1em;">{result.current_period}</div>
            </div>
            <div class="summary-item">
                <div class="label">Baseline Samples</div>
                <div class="value">{result.baseline_sample_count}</div>
            </div>
            <div class="summary-item">
                <div class="label">Current Samples</div>
                <div class="value">{result.current_sample_count}</div>
            </div>
        </div>

        {f'<div class="action-box {"critical" if result.requires_intervention else ""}"><strong>Action Required:</strong> {result.action_summary}</div>' if result.action_summary else ''}
    </div>
'''

        # Findings
        if result.findings:
            html += '''
    <div class="card">
        <h2>Drift Findings</h2>
'''
            for finding in result.findings:
                html += f'''
        <div class="finding finding-{finding.severity.value}">
            <h3>{finding.title}</h3>
            <p><strong>Category:</strong> {finding.category.value.title()} |
               <strong>Severity:</strong>
               <span class="severity-badge severity-{finding.severity.value}">{finding.severity.value.upper()}</span>
            </p>
            <p>{finding.description}</p>
'''
                if finding.recommended_action != DriftAction.NONE:
                    html += f'''
            <p><strong>Recommended Action:</strong> {finding.recommended_action.value.replace('_', ' ').title()}</p>
'''
                html += '''
        </div>
'''
            html += '''
    </div>
'''

        # Metrics Table
        if result.metrics:
            html += '''
    <div class="card">
        <h2>Metrics Comparison</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Category</th>
                    <th>Baseline</th>
                    <th>Current</th>
                    <th>Change</th>
                    <th>Significant</th>
                </tr>
            </thead>
            <tbody>
'''
            for m in result.metrics:
                change_class = "change-positive" if m.percent_delta > 0 else "change-negative"
                sig_text = "Yes" if m.significant else "No"
                html += f'''
                <tr>
                    <td>{m.dimension}</td>
                    <td>{m.category.value}</td>
                    <td>{m.baseline_value:.3f}</td>
                    <td>{m.current_value:.3f}</td>
                    <td class="{change_class}">{m.percent_delta:+.1f}%</td>
                    <td>{sig_text}</td>
                </tr>
'''
            html += '''
            </tbody>
        </table>
    </div>
'''

        # Footer
        html += '''
    <div class="footer">
        <p>Report generated by Inspire 8.0 Drift Detection System</p>
    </div>
</body>
</html>
'''
        return html

    def _format_text(self, result: DriftDetectionResult) -> str:
        """Format as plain text."""
        lines = []

        # Header
        lines.append("=" * 60)
        lines.append("PERSONA DRIFT DETECTION REPORT")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Detection ID: {result.detection_id}")
        lines.append("")

        # Summary
        lines.append("-" * 60)
        lines.append("SUMMARY")
        lines.append("-" * 60)
        lines.append(f"Persona:              {result.persona_id}")
        lines.append(f"Baseline Period:      {result.baseline_period}")
        lines.append(f"Current Period:       {result.current_period}")
        lines.append(f"Drift Detected:       {'YES' if result.overall_drift_detected else 'NO'}")
        lines.append(f"Overall Severity:     {result.overall_severity.value.upper()}")
        lines.append(f"Drift Score:          {result.drift_score:.1f} / 100")
        lines.append(f"Intervention Required: {'YES' if result.requires_intervention else 'NO'}")
        lines.append("")

        if result.action_summary:
            lines.append(f"ACTION: {result.action_summary}")
            lines.append("")

        # Samples
        lines.append("-" * 60)
        lines.append("SAMPLE INFORMATION")
        lines.append("-" * 60)
        lines.append(f"Baseline Samples: {result.baseline_sample_count}")
        lines.append(f"Current Samples:  {result.current_sample_count}")
        lines.append("")

        # Findings
        if result.findings:
            lines.append("-" * 60)
            lines.append(f"FINDINGS ({len(result.findings)} total)")
            lines.append("-" * 60)
            lines.append("")

            for i, finding in enumerate(result.findings, 1):
                lines.append(f"{i}. [{finding.severity.value.upper()}] {finding.title}")
                lines.append(f"   Category: {finding.category.value}")
                lines.append(f"   {finding.description}")
                if finding.recommended_action != DriftAction.NONE:
                    lines.append(
                        f"   Action: {finding.recommended_action.value.replace('_', ' ')}"
                    )
                lines.append("")

        # Metrics
        if result.metrics:
            lines.append("-" * 60)
            lines.append("METRICS COMPARISON")
            lines.append("-" * 60)
            lines.append("")

            # Header
            lines.append(f"{'Metric':<25} {'Baseline':>10} {'Current':>10} {'Change':>10} {'Sig':>5}")
            lines.append("-" * 60)

            for m in result.metrics:
                sig = "*" if m.significant else ""
                lines.append(
                    f"{m.dimension:<25} {m.baseline_value:>10.3f} "
                    f"{m.current_value:>10.3f} {m.percent_delta:>+9.1f}% {sig:>5}"
                )
            lines.append("")

        # Significant Metrics
        if result.significant_metrics:
            lines.append("-" * 60)
            lines.append("SIGNIFICANT CHANGES")
            lines.append("-" * 60)
            for metric in result.significant_metrics:
                lines.append(f"  * {metric}")
            lines.append("")

        # Footer
        lines.append("=" * 60)
        lines.append("End of Report")
        lines.append("=" * 60)

        return "\n".join(lines)


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def generate_drift_report(
    result: DriftDetectionResult,
    format: DriftReportFormat = DriftReportFormat.MARKDOWN
) -> str:
    """
    Generate a drift detection report.

    Example:
        result = detect_persona_drift(persona_id, samples)
        report = generate_drift_report(result, DriftReportFormat.MARKDOWN)
        print(report)
    """
    generator = DriftReportGenerator()
    return generator.generate(result, format)


def save_drift_report(
    result: DriftDetectionResult,
    format: DriftReportFormat = DriftReportFormat.MARKDOWN,
    persona_id: str = ""
) -> Path:
    """
    Generate and save a drift detection report.

    Returns path to saved file.
    """
    generator = DriftReportGenerator()
    content = generator.generate(result, format)
    return generator.save(content, format, persona_id or result.persona_id)
