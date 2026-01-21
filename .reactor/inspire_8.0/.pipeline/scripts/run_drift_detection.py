#!/usr/bin/env python3
# =============================================================================
# RUN DRIFT DETECTION
# =============================================================================
"""
Run drift detection for Inspire 8.0 personas.

This script performs month-over-month comparisons of persona outputs to
detect gradual or unintended changes in tone, doctrine, or behavior.

USAGE:
    python run_drift_detection.py [options] [persona_id]

ARGUMENTS:
    persona_id           Optional: specific persona to analyze (default: all)

OPTIONS:
    --baseline-period    Baseline period label (e.g., "2026-01")
    --current-period     Current period label (e.g., "2026-02")
    --sample-size N      Number of samples to analyze (default: 100)
    --format FORMAT      Report format: text, json, markdown, html (default: markdown)
    --output FILE        Output file for report (default: auto-generated)
    --establish-baseline Establish new baseline from current data
    --compare-only       Compare against existing baseline without updating
    --threshold-moderate Set moderate drift threshold (default: 20%)
    --threshold-high     Set high drift threshold (default: 35%)
    --verbose            Enable verbose logging

MODES:
    Detection Mode (default):
        Compares current samples against established baseline and
        reports any detected drift.

    Baseline Mode (--establish-baseline):
        Creates a new baseline from current samples. Use this when
        first setting up drift detection or after approved changes.

    Compare Mode (--compare-only):
        Compares two periods without modifying baselines.

EXIT CODES:
    0 - Success (no significant drift)
    1 - Configuration error
    2 - Critical drift detected (intervention required)
    3 - High-severity drift detected
    4 - Moderate drift detected (review recommended)
    5 - No baseline available
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from audits.drift_detection import (
    DriftDetector,
    DriftDetectionConfig,
    DriftSeverity,
    BaselineMode,
    get_drift_detector,
)
from audits.drift_report import (
    DriftReportGenerator,
    DriftReportFormat,
    generate_drift_report,
    save_drift_report,
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
        description='Run drift detection for Inspire 8.0 personas',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        'persona_id',
        type=str,
        nargs='?',
        help='Specific persona to analyze (default: all)'
    )
    parser.add_argument(
        '--baseline-period',
        type=str,
        help='Baseline period label (e.g., "2026-01")'
    )
    parser.add_argument(
        '--current-period',
        type=str,
        help='Current period label (e.g., "2026-02")'
    )
    parser.add_argument(
        '--sample-size',
        type=int,
        default=100,
        help='Number of samples to analyze (default: 100)'
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
        '--establish-baseline',
        action='store_true',
        help='Establish new baseline from current data'
    )
    parser.add_argument(
        '--compare-only',
        action='store_true',
        help='Compare against existing baseline without updating'
    )
    parser.add_argument(
        '--threshold-moderate',
        type=float,
        default=20.0,
        help='Moderate drift threshold percentage (default: 20)'
    )
    parser.add_argument(
        '--threshold-high',
        type=float,
        default=35.0,
        help='High drift threshold percentage (default: 35)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    return parser.parse_args()


def map_format(format_str: str) -> DriftReportFormat:
    """Map string format to DriftReportFormat enum."""
    mapping = {
        'text': DriftReportFormat.TEXT,
        'json': DriftReportFormat.JSON,
        'markdown': DriftReportFormat.MARKDOWN,
        'html': DriftReportFormat.HTML,
    }
    return mapping.get(format_str, DriftReportFormat.MARKDOWN)


def load_sample_outputs(persona_id: str, period: str, sample_size: int) -> list:
    """
    Load sample outputs for a persona from the logging system.

    In production, this would query the execution logs.
    For demonstration, generates synthetic samples.
    """
    # In production, this would load from:
    # - Execution logs (logging/execution_logger.py outputs)
    # - Interaction history database
    # - Session transcripts

    logger.info(f"Loading samples for {persona_id}, period {period}")

    # Generate demonstration samples
    # In real implementation, load from logs
    samples = []

    base_texts = {
        'inspire_foundation': [
            "The Scripture teaches us that God's love is unconditional and eternal. "
            "As we read in John 3:16, 'For God so loved the world...'",
            "Grace is central to our understanding of salvation. We are saved by grace "
            "through faith, not by our own works (Ephesians 2:8-9).",
            "The Trinity represents the fullness of God - Father, Son, and Holy Spirit - "
            "working in perfect unity for our redemption.",
        ],
        'inspire_pastor': [
            "I understand this is a difficult time for you. Let me assure you that "
            "God walks with us through every valley (Psalm 23).",
            "My heart goes out to you. Please know that our church community is here "
            "to support you. Have you considered speaking with a counselor?",
            "Prayer is powerful, and I want you to know I'm praying for your situation. "
            "Would you like to meet this week to talk more?",
        ],
        'inspire_teacher': [
            "Let's examine this passage in its historical context. The author was writing "
            "to a community facing persecution, which explains the urgency of the message.",
            "The Greek word used here is 'agape', which specifically refers to unconditional, "
            "self-sacrificing love - distinct from 'phileo' or 'eros'.",
            "Cross-referencing with the Old Testament, we see this prophecy fulfilled in "
            "the life of Christ. Compare Isaiah 53 with the Gospel accounts.",
        ],
        'inspire_counselor': [
            "I hear your pain, and I want you to know your feelings are valid. "
            "It's okay to grieve. How are you taking care of yourself right now?",
            "That sounds incredibly challenging. Have you been able to talk to anyone "
            "else about this? Sometimes sharing our burdens helps us carry them.",
            "I'm concerned about what you've shared. If you're having thoughts of harming "
            "yourself, please reach out to a professional counselor or crisis line.",
        ],
        'inspire_scholar': [
            "The scholarly consensus on this passage has evolved significantly since the "
            "discovery of the Dead Sea Scrolls. Current textual criticism suggests...",
            "Examining the manuscript tradition, we find several variant readings. "
            "The Alexandrian text-type preserves what many scholars consider the earlier form.",
            "From a systematic theology perspective, this doctrine intersects with our "
            "understanding of divine sovereignty and human responsibility.",
        ],
    }

    base = base_texts.get(persona_id, base_texts['inspire_foundation'])

    # Generate varied samples
    import random
    for i in range(sample_size):
        # Select random base and add variation
        text = random.choice(base)
        samples.append(text)

    return samples


def main():
    """Main entry point."""
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("=" * 60)
    logger.info("INSPIRE 8.0 DRIFT DETECTION")
    logger.info("=" * 60)

    # Create configuration
    config = DriftDetectionConfig()
    config.threshold_moderate = args.threshold_moderate
    config.threshold_high = args.threshold_high

    # Validate persona if specified
    if args.persona_id and args.persona_id not in config.personas:
        logger.error(f"Unknown persona: {args.persona_id}")
        logger.info(f"Available personas: {', '.join(config.personas)}")
        return 1

    # Determine personas to process
    personas = [args.persona_id] if args.persona_id else config.personas

    # Determine periods
    now = datetime.now()
    current_period = args.current_period or now.strftime('%Y-%m')

    if args.baseline_period:
        baseline_period = args.baseline_period
    else:
        # Default to previous month
        if now.month == 1:
            baseline_period = f"{now.year - 1}-12"
        else:
            baseline_period = f"{now.year}-{now.month - 1:02d}"

    # Create detector
    detector = DriftDetector(config)

    # Process each persona
    all_results = []

    for persona_id in personas:
        logger.info(f"\nProcessing persona: {persona_id}")
        logger.info(f"  Baseline period: {baseline_period}")
        logger.info(f"  Current period: {current_period}")
        logger.info(f"  Sample size: {args.sample_size}")

        try:
            if args.establish_baseline:
                # Establish new baseline mode
                logger.info("Mode: Establishing baseline")
                samples = load_sample_outputs(
                    persona_id, current_period, args.sample_size
                )

                baseline = detector.establish_baseline(
                    persona_id=persona_id,
                    samples=samples,
                    period_label=current_period,
                    mode=BaselineMode.ROLLING,
                )

                logger.info(f"Baseline established for {persona_id}")
                logger.info(f"  Baseline ID: {baseline.baseline_id}")
                logger.info(f"  Sample count: {baseline.sample_count}")

            else:
                # Detection mode
                logger.info("Mode: Drift detection")

                # Load current samples
                current_samples = load_sample_outputs(
                    persona_id, current_period, args.sample_size
                )

                if args.compare_only:
                    # Load baseline samples for direct comparison
                    baseline_samples = load_sample_outputs(
                        persona_id, baseline_period, args.sample_size
                    )

                    result = detector.run_monthly_comparison(
                        persona_id=persona_id,
                        baseline_samples=baseline_samples,
                        current_samples=current_samples,
                        baseline_period=baseline_period,
                        current_period=current_period,
                    )
                else:
                    # Compare against stored baseline
                    result = detector.detect_drift(
                        persona_id=persona_id,
                        current_samples=current_samples,
                        current_period=current_period,
                    )

                all_results.append(result)

                # Log summary
                logger.info(f"  Drift detected: {result.overall_drift_detected}")
                logger.info(f"  Severity: {result.overall_severity.value}")
                logger.info(f"  Drift score: {result.drift_score:.1f}")
                logger.info(f"  Findings: {len(result.findings)}")

        except Exception as e:
            logger.exception(f"Error processing {persona_id}: {e}")
            return 1

    # Generate reports
    if all_results:
        report_format = map_format(args.format)
        generator = DriftReportGenerator()

        for result in all_results:
            report_content = generator.generate(result, report_format)

            if args.output and len(all_results) == 1:
                # Single persona with specified output
                output_path = Path(args.output)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(report_content, encoding='utf-8')
                logger.info(f"Report saved to: {output_path}")
            else:
                # Auto-generate filename
                output_path = generator.save(
                    report_content, report_format, result.persona_id
                )
                logger.info(f"Report saved to: {output_path}")

        # Print summary to console
        print("\n" + "=" * 60)
        print("DRIFT DETECTION SUMMARY")
        print("=" * 60)

        for result in all_results:
            status = "DRIFT" if result.overall_drift_detected else "STABLE"
            intervention = " [INTERVENTION REQUIRED]" if result.requires_intervention else ""
            print(f"\n{result.persona_id}:")
            print(f"  Status: {status}{intervention}")
            print(f"  Severity: {result.overall_severity.value.upper()}")
            print(f"  Drift Score: {result.drift_score:.1f}/100")
            print(f"  Findings: {len(result.findings)}")

            if result.findings_by_severity:
                print("  By severity:", end="")
                for sev, count in sorted(result.findings_by_severity.items()):
                    print(f" {sev}={count}", end="")
                print()

        print("\n" + "=" * 60)

        # Determine exit code based on highest severity
        max_severity = DriftSeverity.MINIMAL
        for result in all_results:
            severity_order = [
                DriftSeverity.MINIMAL,
                DriftSeverity.LOW,
                DriftSeverity.MODERATE,
                DriftSeverity.HIGH,
                DriftSeverity.CRITICAL,
            ]
            if severity_order.index(result.overall_severity) > severity_order.index(max_severity):
                max_severity = result.overall_severity

        if max_severity == DriftSeverity.CRITICAL:
            logger.warning("CRITICAL drift detected - intervention required")
            return 2
        elif max_severity == DriftSeverity.HIGH:
            logger.warning("HIGH-severity drift detected")
            return 3
        elif max_severity == DriftSeverity.MODERATE:
            logger.info("MODERATE drift detected - review recommended")
            return 4

    logger.info("Drift detection completed successfully")
    return 0


if __name__ == '__main__':
    sys.exit(main())
