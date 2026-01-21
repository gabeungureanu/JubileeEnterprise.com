#!/usr/bin/env python3
# =============================================================================
# RUN DOCTRINE ALIGNMENT AUDIT
# =============================================================================
"""
Run doctrine alignment audit for Inspire 8.0 personas.

This script performs comprehensive doctrine alignment auditing including:
1. Sampling persona-generated outputs
2. Evaluating against Canon specification
3. Checking doctrinal, behavioral, and tonal compliance
4. Generating structured audit reports
5. Enforcing governance gates

USAGE:
    python run_doctrine_audit.py [options] [persona_id]

ARGUMENTS:
    persona_id           Optional: specific persona to audit (default: all)

OPTIONS:
    --sample-size N      Number of interactions to sample (default: 100)
    --period-days N      Days of history to sample (default: 7)
    --format FORMAT      Report format: text, json, markdown, html (default: markdown)
    --output FILE        Output file for report (default: auto-generated)
    --check-gate GATE    Check governance gate after audit
    --strict             Fail on any high-severity issues
    --verbose            Enable verbose logging

GOVERNANCE GATES:
    --check-gate persona_evolution   Check before persona changes
    --check-gate memory_update       Check before memory ingestion
    --check-gate deployment          Check before production deployment
    --check-gate activation          Check before persona activation

EXIT CODES:
    0 - Success (audit passed)
    1 - Configuration error
    2 - Audit completed with blocking issues
    3 - Audit completed with high-severity issues
    4 - Audit completed with issues (--strict mode)
    5 - Governance gate blocked
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from audits.doctrine_alignment import (
    DoctrineAlignmentAudit,
    DoctrineAuditConfig,
    DoctrineAuditResult,
)
from audits.governance import (
    GovernanceEnforcer,
    GateType,
    check_governance_gate,
)
from audits.audit_report import (
    AuditReportGenerator,
    ReportFormat,
    generate_audit_report,
    save_audit_report,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Run doctrine alignment audit for Inspire 8.0',
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
        help='Number of interactions to sample (default: 100)'
    )
    parser.add_argument(
        '--period-days',
        type=int,
        default=7,
        help='Days of history to sample (default: 7)'
    )
    parser.add_argument(
        '--format',
        type=str,
        choices=['text', 'json', 'markdown', 'html'],
        default='markdown',
        help='Report format (default: markdown)'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output file for report (default: auto-generated)'
    )
    parser.add_argument(
        '--check-gate',
        type=str,
        choices=['persona_evolution', 'memory_update', 'deployment', 'activation'],
        help='Check governance gate after audit'
    )
    parser.add_argument(
        '--strict',
        action='store_true',
        help='Fail on any high-severity issues'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    return parser.parse_args()


def map_format(format_str: str) -> ReportFormat:
    """Map string format to ReportFormat enum."""
    mapping = {
        'text': ReportFormat.TEXT,
        'json': ReportFormat.JSON,
        'markdown': ReportFormat.MARKDOWN,
        'html': ReportFormat.HTML,
    }
    return mapping.get(format_str, ReportFormat.MARKDOWN)


def map_gate_type(gate_str: str) -> GateType:
    """Map string gate type to GateType enum."""
    mapping = {
        'persona_evolution': GateType.PERSONA_EVOLUTION,
        'memory_update': GateType.MEMORY_UPDATE,
        'deployment': GateType.DEPLOYMENT,
        'activation': GateType.ACTIVATION,
    }
    return mapping.get(gate_str, GateType.ACTIVATION)


def main():
    """Main entry point."""
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("=" * 60)
    logger.info("INSPIRE 8.0 DOCTRINE ALIGNMENT AUDIT")
    logger.info("=" * 60)

    # Create audit configuration
    config = DoctrineAuditConfig()

    # Validate persona if specified
    if args.persona_id and args.persona_id not in config.personas:
        logger.error(f"Unknown persona: {args.persona_id}")
        logger.info(f"Available personas: {', '.join(config.personas)}")
        return 1

    # Create and run audit
    audit = DoctrineAlignmentAudit(config)

    try:
        logger.info(f"Running audit...")
        logger.info(f"  Persona: {args.persona_id or 'all'}")
        logger.info(f"  Sample size: {args.sample_size}")
        logger.info(f"  Period: {args.period_days} days")

        result = audit.run_audit(
            persona_id=args.persona_id,
            sample_size=args.sample_size,
            period_days=args.period_days,
        )

    except Exception as e:
        logger.exception(f"Audit failed with exception: {e}")
        return 1

    # Generate report
    report_format = map_format(args.format)
    report_content = generate_audit_report(result, report_format)

    # Output report
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report_content, encoding='utf-8')
        logger.info(f"Report saved to: {output_path}")
    else:
        # Save to default location
        generator = AuditReportGenerator()
        output_path = generator.save(report_content, report_format)
        logger.info(f"Report saved to: {output_path}")

    # Print summary to console
    print("\n" + "=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)
    print(f"Status: {'PASS' if result.passed else 'FAIL'}")
    print(f"Total deviations: {result.total_deviations}")
    print(f"  Critical: {result.critical_count}")
    print(f"  High: {result.high_count}")
    print(f"  Medium: {result.medium_count}")
    print(f"  Low: {result.low_count}")
    print("=" * 60)

    # Check governance gate if requested
    if args.check_gate:
        gate_type = map_gate_type(args.check_gate)
        logger.info(f"Checking governance gate: {args.check_gate}")

        decision = check_governance_gate(
            gate_type=gate_type,
            persona_id=args.persona_id or "",
            operation=f"Post-audit gate check for {args.check_gate}",
        )

        print(f"\nGovernance Gate: {args.check_gate}")
        print(f"  Status: {decision.status.value}")
        print(f"  Allowed: {decision.allowed}")

        if decision.blocking_reasons:
            print("  Blocking reasons:")
            for reason in decision.blocking_reasons:
                print(f"    - {reason}")

        if decision.required_actions:
            print("  Required actions:")
            for action in decision.required_actions:
                print(f"    - {action}")

        if not decision.allowed:
            logger.error(f"Governance gate {args.check_gate} BLOCKED")
            return 5

    # Determine exit code
    if result.blocking_issues:
        logger.warning("Audit completed with BLOCKING issues")
        return 2

    if result.critical_count > 0:
        logger.warning("Audit completed with CRITICAL issues")
        return 2

    if args.strict and result.high_count > 0:
        logger.warning("Audit completed with HIGH-severity issues (--strict mode)")
        return 3

    if args.strict and result.medium_count > 0:
        logger.warning("Audit completed with MEDIUM-severity issues (--strict mode)")
        return 4

    logger.info("Audit completed successfully")
    return 0


if __name__ == '__main__':
    sys.exit(main())
