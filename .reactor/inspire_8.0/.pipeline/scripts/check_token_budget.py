#!/usr/bin/env python3
# =============================================================================
# CHECK TOKEN BUDGET
# =============================================================================
"""
Check and manage token budgets for Inspire 8.0 execution pipeline.

This script provides tools for validating token requests, viewing budget
status, and managing production-hardening controls.

USAGE:
    python check_token_budget.py [options] [command]

COMMANDS:
    status               Show current budget status
    validate             Validate a token request
    limits               Show model token limits
    usage                Show token usage summary

OPTIONS:
    --model MODEL        Model ID (gpt-4o-mini, gpt-4o-turbo, gpt-4o)
    --tokens N           Number of tokens to request
    --session SESSION    Session ID
    --persona PERSONA    Persona ID
    --category CATEGORY  Task category
    --justification TEXT Justification for premium models
    --format FORMAT      Output format: text, json (default: text)
    --verbose            Enable verbose logging

EXIT CODES:
    0 - Success / Request approved
    1 - Configuration error
    2 - Request rejected (budget exceeded)
    3 - Request requires justification
    4 - Request capped to limit
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from execution.token_budget import (
    TokenBudgetEnforcer,
    TokenBudgetConfig,
    ModelTier,
    BudgetAction,
    UsageCategory,
    get_budget_enforcer,
    validate_token_request,
    get_current_budget_status,
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
        description='Check and manage token budgets',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        'command',
        type=str,
        nargs='?',
        default='status',
        choices=['status', 'validate', 'limits', 'usage'],
        help='Command to execute (default: status)'
    )
    parser.add_argument(
        '--model',
        type=str,
        default='gpt-4o-mini',
        help='Model ID (default: gpt-4o-mini)'
    )
    parser.add_argument(
        '--tokens',
        type=int,
        default=500,
        help='Number of tokens to request (default: 500)'
    )
    parser.add_argument(
        '--session',
        type=str,
        default='test_session',
        help='Session ID (default: test_session)'
    )
    parser.add_argument(
        '--persona',
        type=str,
        default='inspire_foundation',
        help='Persona ID (default: inspire_foundation)'
    )
    parser.add_argument(
        '--category',
        type=str,
        default='routine',
        choices=['routine', 'teaching', 'pastoral', 'counseling',
                 'doctrinal', 'strategic', 'scholarly'],
        help='Task category (default: routine)'
    )
    parser.add_argument(
        '--justification',
        type=str,
        default='',
        help='Justification for premium models'
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


def map_category(category_str: str) -> UsageCategory:
    """Map string to UsageCategory enum."""
    mapping = {
        'routine': UsageCategory.ROUTINE,
        'teaching': UsageCategory.TEACHING,
        'pastoral': UsageCategory.PASTORAL,
        'counseling': UsageCategory.COUNSELING,
        'doctrinal': UsageCategory.DOCTRINAL,
        'strategic': UsageCategory.STRATEGIC,
        'scholarly': UsageCategory.SCHOLARLY,
    }
    return mapping.get(category_str, UsageCategory.ROUTINE)


def show_status(args, enforcer: TokenBudgetEnforcer):
    """Show current budget status."""
    status = enforcer.get_budget_status()

    if args.format == 'json':
        print(json.dumps(status.to_dict(), indent=2))
        return 0

    print("\n" + "=" * 60)
    print("TOKEN BUDGET STATUS")
    print("=" * 60)

    print(f"\nDate: {status.period_start}")
    print(f"Type: {status.period_type}")

    print("\n" + "-" * 60)
    print("USAGE BY MODEL")
    print("-" * 60)

    if status.model_usage:
        print(f"\n{'Model':<20} {'Tokens Used':>15} {'Cost':>12}")
        print("-" * 47)
        for model_id, tokens in status.model_usage.items():
            cost = status.model_cost.get(model_id, 0.0)
            print(f"{model_id:<20} {tokens:>15,} ${cost:>11.4f}")
    else:
        print("\nNo usage recorded today.")

    print("\n" + "-" * 60)
    print("BUDGET SUMMARY")
    print("-" * 60)

    print(f"\n{'Total Tokens Used:':<25} {status.total_tokens_used:>15,}")
    print(f"{'Total Budget:':<25} {status.total_budget:>15,}")
    print(f"{'Remaining:':<25} {status.budget_remaining:>15,}")
    print(f"{'Used:':<25} {status.budget_used_percent:>14.1f}%")

    if status.approaching_limit:
        print("\n[!] WARNING: Approaching daily budget limit")
    if status.over_budget:
        print("\n[!] ALERT: Daily budget exceeded")

    print("\n" + "=" * 60)
    return 0


def show_limits(args, enforcer: TokenBudgetEnforcer):
    """Show model token limits."""
    config = enforcer.config

    if args.format == 'json':
        limits_data = {
            model_id: budget.to_dict()
            for model_id, budget in config.model_budgets.items()
        }
        print(json.dumps(limits_data, indent=2))
        return 0

    print("\n" + "=" * 60)
    print("MODEL TOKEN LIMITS")
    print("=" * 60)

    for model_id, budget in config.model_budgets.items():
        tier_badge = {
            ModelTier.ECONOMY: "[ECONOMY]",
            ModelTier.STANDARD: "[STANDARD]",
            ModelTier.PREMIUM: "[PREMIUM]",
        }.get(budget.tier, "")

        print(f"\n{budget.model_name} ({model_id}) {tier_badge}")
        print("-" * 50)
        print(f"  Default Max Tokens:   {budget.default_max_tokens:>10,}")
        print(f"  Hard Limit:           {budget.hard_limit_tokens:>10,}")
        print(f"  Min Tokens:           {budget.min_tokens:>10,}")
        print(f"  Max Input Tokens:     {budget.max_input_tokens:>10,}")
        print(f"  Context Window:       {budget.context_window:>10,}")
        print(f"  Daily Budget:         {budget.daily_budget_tokens:>10,}")
        print(f"  Session Budget:       {budget.session_budget_tokens:>10,}")
        print(f"  Cost Multiplier:      {budget.cost_multiplier:>10.1f}x")
        print(f"  Requires Justification: {'Yes' if budget.requires_justification else 'No'}")

        if budget.allowed_categories and len(budget.allowed_categories) < 7:
            print(f"  Allowed Categories:   {', '.join(budget.allowed_categories)}")

    print("\n" + "=" * 60)
    return 0


def validate_request(args, enforcer: TokenBudgetEnforcer):
    """Validate a token request."""
    category = map_category(args.category)

    decision = enforcer.validate_request(
        model_id=args.model,
        requested_tokens=args.tokens,
        session_id=args.session,
        persona_id=args.persona,
        task_category=category,
        justification=args.justification,
    )

    if args.format == 'json':
        print(json.dumps(decision.to_dict(), indent=2))
    else:
        print("\n" + "=" * 60)
        print("TOKEN REQUEST VALIDATION")
        print("=" * 60)

        print(f"\nRequest ID: {decision.request_id}")
        print(f"Model:      {args.model}")
        print(f"Tokens:     {args.tokens}")
        print(f"Session:    {args.session}")
        print(f"Persona:    {args.persona}")
        print(f"Category:   {args.category}")

        print("\n" + "-" * 60)

        status_icon = {
            BudgetAction.APPROVED: "APPROVED",
            BudgetAction.CAPPED: "CAPPED",
            BudgetAction.REJECTED: "REJECTED",
            BudgetAction.DOWNGRADED: "DOWNGRADED",
            BudgetAction.REQUIRES_JUSTIFICATION: "NEEDS JUSTIFICATION",
        }.get(decision.action, "UNKNOWN")

        print(f"\nResult: {status_icon}")
        print(f"Action: {decision.action.value}")

        if decision.allowed:
            print(f"Approved Tokens: {decision.approved_tokens}")
            print(f"Estimated Cost: ${decision.estimated_cost:.6f}")
        else:
            print(f"Requested: {decision.requested_tokens}")
            print(f"Soft Limit: {decision.soft_limit}")
            print(f"Hard Limit: {decision.hard_limit}")

        if decision.reasons:
            print("\nReasons:")
            for reason in decision.reasons:
                print(f"  - {reason}")

        if decision.warnings:
            print("\nWarnings:")
            for warning in decision.warnings:
                print(f"  - {warning}")

        if decision.suggested_model:
            print(f"\nSuggested Alternative: {decision.suggested_model}")
            if decision.suggested_tokens:
                print(f"Suggested Tokens: {decision.suggested_tokens}")

        print("\n" + "=" * 60)

    # Return appropriate exit code
    if decision.allowed:
        if decision.action == BudgetAction.CAPPED:
            return 4
        return 0
    elif decision.action == BudgetAction.REQUIRES_JUSTIFICATION:
        return 3
    else:
        return 2


def show_usage(args, enforcer: TokenBudgetEnforcer):
    """Show token usage summary."""
    # Get usage from tracker
    tracker = enforcer.tracker

    if args.format == 'json':
        data = {
            'daily_usage': {
                model: tracker.get_daily_usage(model)
                for model in enforcer.config.model_budgets.keys()
            },
            'remaining': {
                model: tracker.get_remaining_daily_budget(model)
                for model in enforcer.config.model_budgets.keys()
            },
        }
        print(json.dumps(data, indent=2))
        return 0

    print("\n" + "=" * 60)
    print("TOKEN USAGE SUMMARY")
    print("=" * 60)

    print(f"\n{'Model':<20} {'Used':>12} {'Remaining':>12} {'Limit':>12}")
    print("-" * 60)

    for model_id, budget in enforcer.config.model_budgets.items():
        used = tracker.get_daily_usage(model_id)
        remaining = tracker.get_remaining_daily_budget(model_id)
        limit = budget.daily_budget_tokens

        pct = (used / limit * 100) if limit > 0 else 0
        bar_len = int(pct / 5)  # 20 char bar
        bar = "" * bar_len + "" * (20 - bar_len)

        print(f"{model_id:<20} {used:>12,} {remaining:>12,} {limit:>12,}")
        print(f"{'':20} [{bar}] {pct:.1f}%")

    print("\n" + "=" * 60)
    return 0


def main():
    """Main entry point."""
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Get enforcer
    enforcer = get_budget_enforcer()

    # Execute command
    if args.command == 'status':
        return show_status(args, enforcer)
    elif args.command == 'limits':
        return show_limits(args, enforcer)
    elif args.command == 'validate':
        return validate_request(args, enforcer)
    elif args.command == 'usage':
        return show_usage(args, enforcer)
    else:
        logger.error(f"Unknown command: {args.command}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
