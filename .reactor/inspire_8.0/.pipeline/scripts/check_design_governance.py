#!/usr/bin/env python3
# =============================================================================
# CHECK DESIGN GOVERNANCE
# =============================================================================
"""
Check design governance compliance for Inspire 8.0 personas.

This script validates that design work follows approved specifications
and templates, enforcing design governance rules.

USAGE:
    python check_design_governance.py [options] [task_type]

ARGUMENTS:
    task_type            Design task type to check

OPTIONS:
    --persona PERSONA    Persona performing design work
    --component NAME     Component being designed
    --mockup REF         Mockup reference
    --list-specs         List available design specifications
    --list-tasks         List governed task types
    --validate           Run validation on design context
    --format FORMAT      Output format: text, json (default: text)
    --verbose            Enable verbose logging

TASK TYPES:
    page_design          Full page design
    component_design     Component creation
    layout_design        Layout work
    style_update         Style modifications
    responsive           Responsive design
    interaction          Interaction patterns
    icon_design          Icon work
    prototype            Prototyping

EXIT CODES:
    0 - Success (design work allowed)
    1 - Configuration error
    2 - Design work blocked (missing specs)
    3 - Compliance check failed
    4 - No specs available
"""

import argparse
import json
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from governance.design_governance import (
    DesignGovernanceEnforcer,
    DesignGovernanceConfig,
    DesignTaskType,
    DesignSpecType,
    DesignAction,
    ComplianceStatus,
    get_design_enforcer,
    check_design_gate,
    require_design_spec,
    DesignGovernanceError,
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
        description='Check design governance compliance',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        'task_type',
        type=str,
        nargs='?',
        help='Design task type to check'
    )
    parser.add_argument(
        '--persona',
        type=str,
        default='inspire_designer',
        help='Persona performing design work (default: inspire_designer)'
    )
    parser.add_argument(
        '--component',
        type=str,
        default='',
        help='Component being designed'
    )
    parser.add_argument(
        '--mockup',
        type=str,
        default='',
        help='Mockup reference'
    )
    parser.add_argument(
        '--list-specs',
        action='store_true',
        help='List available design specifications'
    )
    parser.add_argument(
        '--list-tasks',
        action='store_true',
        help='List governed task types'
    )
    parser.add_argument(
        '--validate',
        action='store_true',
        help='Run validation on design context'
    )
    parser.add_argument(
        '--format',
        type=str,
        choices=['text', 'json'],
        default='text',
        help='Output format (default: text)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    return parser.parse_args()


def map_task_type(task_str: str) -> DesignTaskType:
    """Map string to DesignTaskType enum."""
    mapping = {
        'page_design': DesignTaskType.PAGE_DESIGN,
        'component_design': DesignTaskType.COMPONENT_DESIGN,
        'layout_design': DesignTaskType.LAYOUT_DESIGN,
        'style_update': DesignTaskType.STYLE_UPDATE,
        'responsive': DesignTaskType.RESPONSIVE_DESIGN,
        'interaction': DesignTaskType.INTERACTION_DESIGN,
        'icon_design': DesignTaskType.ICON_DESIGN,
        'prototype': DesignTaskType.PROTOTYPE,
        'review': DesignTaskType.REVIEW,
        'documentation': DesignTaskType.DOCUMENTATION,
    }
    return mapping.get(task_str, DesignTaskType.COMPONENT_DESIGN)


def list_specifications(enforcer: DesignGovernanceEnforcer, format: str):
    """List available design specifications."""
    specs = enforcer.registry.list_specs()

    if format == 'json':
        spec_data = []
        for spec_id in specs:
            spec = enforcer.registry.get_spec(spec_id)
            if spec:
                spec_data.append({
                    'spec_id': spec.spec_id,
                    'name': spec.name,
                    'type': spec.spec_type.value,
                    'version': spec.version,
                    'status': spec.status,
                })
        print(json.dumps(spec_data, indent=2))
    else:
        print("\n" + "=" * 60)
        print("AVAILABLE DESIGN SPECIFICATIONS")
        print("=" * 60)

        if not specs:
            print("\nNo specifications found.")
            print("Add specs to: .reactor/inspire_8.0/.pipeline/design/specs/")
        else:
            print(f"\nFound {len(specs)} specification(s):\n")
            for spec_id in specs:
                spec = enforcer.registry.get_spec(spec_id)
                if spec:
                    print(f"  [{spec.spec_type.value:12}] {spec.name}")
                    print(f"                  ID: {spec.spec_id}")
                    print(f"                  Version: {spec.version}")
                    print()

        print("=" * 60)


def list_task_types(config: DesignGovernanceConfig, format: str):
    """List governed task types."""
    if format == 'json':
        data = {
            'governed_task_types': [t.value for t in config.governed_task_types],
            'required_specs': {
                k: [s.value for s in v]
                for k, v in config.required_specs.items()
            }
        }
        print(json.dumps(data, indent=2))
    else:
        print("\n" + "=" * 60)
        print("GOVERNED DESIGN TASK TYPES")
        print("=" * 60)

        for task_type in config.governed_task_types:
            required = config.required_specs.get(task_type.value, [])
            print(f"\n  {task_type.value}")
            print(f"    Required specs: {', '.join(s.value for s in required)}")

        print("\n" + "=" * 60)


def check_gate(args, enforcer: DesignGovernanceEnforcer):
    """Check design governance gate."""
    task_type = map_task_type(args.task_type)

    decision = enforcer.check_design_gate(
        persona_id=args.persona,
        task_type=task_type,
        component_name=args.component,
        mockup_reference=args.mockup,
    )

    if args.format == 'json':
        print(json.dumps(decision.to_dict(), indent=2))
        return 0 if decision.allowed else 2
    else:
        print("\n" + "=" * 60)
        print("DESIGN GOVERNANCE CHECK")
        print("=" * 60)

        print(f"\nPersona:    {args.persona}")
        print(f"Task Type:  {task_type.value}")
        if args.component:
            print(f"Component:  {args.component}")
        if args.mockup:
            print(f"Mockup:     {args.mockup}")

        print("\n" + "-" * 60)

        status = "ALLOWED" if decision.allowed else "BLOCKED"
        print(f"\nStatus: {status}")
        print(f"Action: {decision.action.value}")

        if decision.loaded_specs:
            print(f"\nLoaded Specs: {', '.join(decision.loaded_specs)}")

        if decision.missing_specs:
            print(f"\nMissing Specs: {', '.join(decision.missing_specs)}")

        if decision.blocking_reasons:
            print("\nBlocking Reasons:")
            for reason in decision.blocking_reasons:
                print(f"  - {reason}")

        if decision.warnings:
            print("\nWarnings:")
            for warning in decision.warnings:
                print(f"  - {warning}")

        if decision.required_actions:
            print("\nRequired Actions:")
            for action in decision.required_actions:
                print(f"  - {action}")

        print("\n" + "=" * 60)

        return 0 if decision.allowed else 2


def validate_context(args, enforcer: DesignGovernanceEnforcer):
    """Validate design context."""
    task_type = map_task_type(args.task_type)

    try:
        context = enforcer.create_design_context(
            persona_id=args.persona,
            task_type=task_type,
            component_name=args.component,
        )

        result = enforcer.validate_design_output(
            context_id=context.context_id,
            output_description="Validation check",
        )

        if args.format == 'json':
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print("\n" + "=" * 60)
            print("DESIGN CONTEXT VALIDATION")
            print("=" * 60)

            print(f"\nContext ID: {context.context_id}")
            print(f"Specs Loaded: {context.spec_count}")
            print(f"Context Complete: {context.complete}")

            if context.missing_specs:
                print(f"Missing Specs: {', '.join(context.missing_specs)}")

            print(f"\nCompliance Status: {result.status.value}")
            print(f"Compliance Score: {result.compliance_score:.1f}/100")
            print(f"Requirements Checked: {result.requirements_checked}")
            print(f"Requirements Passed: {result.requirements_passed}")

            if result.deviations:
                print(f"\nDeviations ({len(result.deviations)}):")
                for dev in result.deviations:
                    print(f"  [{dev.severity}] {dev.description}")

            print("\n" + "=" * 60)

        if result.requires_remediation:
            return 3
        return 0

    except DesignGovernanceError as e:
        logger.error(f"Design governance error: {e}")
        return 2


def main():
    """Main entry point."""
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Get enforcer
    enforcer = get_design_enforcer()
    config = enforcer.config

    # Handle list commands
    if args.list_specs:
        list_specifications(enforcer, args.format)
        return 0

    if args.list_tasks:
        list_task_types(config, args.format)
        return 0

    # Require task type for other commands
    if not args.task_type:
        logger.error("Task type required. Use --list-tasks to see options.")
        return 1

    # Validate task type
    valid_tasks = [
        'page_design', 'component_design', 'layout_design',
        'style_update', 'responsive', 'interaction',
        'icon_design', 'prototype', 'review', 'documentation',
    ]
    if args.task_type not in valid_tasks:
        logger.error(f"Invalid task type: {args.task_type}")
        logger.info(f"Valid types: {', '.join(valid_tasks)}")
        return 1

    # Run validation or gate check
    if args.validate:
        return validate_context(args, enforcer)
    else:
        return check_gate(args, enforcer)


if __name__ == '__main__':
    sys.exit(main())
