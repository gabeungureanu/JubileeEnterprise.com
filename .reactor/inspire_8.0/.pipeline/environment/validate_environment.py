#!/usr/bin/env python3
# =============================================================================
# VALIDATE ENVIRONMENT
# =============================================================================
"""
Environment validation for Inspire 8.0 pipeline execution.

This script validates that the execution environment is properly configured
and enforces the requirement that all pipeline scripts run within the
canonical virtual environment.

VALIDATION CHECKS:
1. Virtual environment is active and correct
2. Required Python packages are installed
3. Required environment variables are set
4. Configuration files exist
5. Directory structure is valid

USAGE:
    python validate_environment.py [options]

OPTIONS:
    --strict        Fail on any warning (not just errors)
    --json          Output results as JSON
    --quiet         Only output errors
    --fix           Attempt to fix minor issues

EXIT CODES:
    0 - Environment is valid
    1 - Environment has errors
    2 - Environment has warnings (--strict mode)

Author: Jubilee Enterprise
Version: 1.0.0
"""

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

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

class ValidationLevel(Enum):
    """Validation result severity."""
    PASS = "pass"
    WARNING = "warning"
    ERROR = "error"
    SKIPPED = "skipped"


@dataclass
class ValidationResult:
    """Result of a single validation check."""
    check_name: str
    level: ValidationLevel
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    fix_available: bool = False
    fix_command: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'check_name': self.check_name,
            'level': self.level.value,
            'message': self.message,
            'details': self.details,
            'fix_available': self.fix_available,
            'fix_command': self.fix_command,
        }


@dataclass
class ValidationReport:
    """Complete validation report."""
    is_valid: bool
    has_warnings: bool
    results: List[ValidationResult]
    environment: Dict[str, Any]
    validated_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'is_valid': self.is_valid,
            'has_warnings': self.has_warnings,
            'results': [r.to_dict() for r in self.results],
            'environment': self.environment,
            'validated_at': self.validated_at.isoformat(),
            'summary': {
                'passed': len([r for r in self.results if r.level == ValidationLevel.PASS]),
                'warnings': len([r for r in self.results if r.level == ValidationLevel.WARNING]),
                'errors': len([r for r in self.results if r.level == ValidationLevel.ERROR]),
                'skipped': len([r for r in self.results if r.level == ValidationLevel.SKIPPED]),
            }
        }


# =============================================================================
# REQUIRED CONFIGURATION
# =============================================================================

REQUIRED_PACKAGES = [
    ('qdrant_client', 'qdrant-client'),
    ('psycopg2', 'psycopg2-binary'),
    ('openai', 'openai'),
    ('tiktoken', 'tiktoken'),
    ('yaml', 'PyYAML'),
    ('pydantic', 'pydantic'),
    ('requests', 'requests'),
    ('dotenv', 'python-dotenv'),
    ('httpx', 'httpx'),
    ('aiohttp', 'aiohttp'),
]

REQUIRED_ENV_VARS = [
    ('OPENAI_API_KEY', True, 'Required for embeddings and LLM execution'),
]

RECOMMENDED_ENV_VARS = [
    ('QDRANT_HOST', False, 'Defaults to localhost'),
    ('QDRANT_PORT', False, 'Defaults to 6333'),
    ('CODEX_DB_HOST', False, 'Required for PostgreSQL connectivity'),
    ('CODEX_DB_USER', False, 'Required for PostgreSQL connectivity'),
    ('CODEX_DB_PASSWORD', False, 'Required for PostgreSQL connectivity'),
    ('INSPIRECODEX_API_KEY', False, 'Required for API access'),
]

REQUIRED_DIRECTORIES = [
    'qdrant',
    'scripts',
    'governance',
    'execution',
    'retrieval',
    'backup',
    'design',
]


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def validate_virtual_environment() -> ValidationResult:
    """Validate that we're running in the correct virtual environment."""
    venv = os.getenv('VIRTUAL_ENV', '')

    if not venv:
        return ValidationResult(
            check_name="Virtual Environment",
            level=ValidationLevel.ERROR,
            message="Not running in a virtual environment",
            details={'VIRTUAL_ENV': 'Not set'},
            fix_available=True,
            fix_command="source /path/to/.pipeline/activate_inspire.sh",
        )

    if 'inspire_venv' not in venv:
        return ValidationResult(
            check_name="Virtual Environment",
            level=ValidationLevel.WARNING,
            message="Running in a virtual environment, but not the Inspire 8.0 environment",
            details={'VIRTUAL_ENV': venv},
            fix_available=True,
            fix_command="source /path/to/.pipeline/activate_inspire.sh",
        )

    return ValidationResult(
        check_name="Virtual Environment",
        level=ValidationLevel.PASS,
        message="Running in Inspire 8.0 virtual environment",
        details={'VIRTUAL_ENV': venv},
    )


def validate_python_version() -> ValidationResult:
    """Validate Python version."""
    version = sys.version_info
    version_str = f"{version.major}.{version.minor}.{version.micro}"

    if version.major < 3 or (version.major == 3 and version.minor < 9):
        return ValidationResult(
            check_name="Python Version",
            level=ValidationLevel.ERROR,
            message=f"Python {version_str} is too old. Requires Python 3.9+",
            details={'version': version_str, 'required': '>=3.9'},
        )

    if version.major == 3 and version.minor < 11:
        return ValidationResult(
            check_name="Python Version",
            level=ValidationLevel.WARNING,
            message=f"Python {version_str} works but 3.11+ is recommended",
            details={'version': version_str, 'recommended': '>=3.11'},
        )

    return ValidationResult(
        check_name="Python Version",
        level=ValidationLevel.PASS,
        message=f"Python {version_str}",
        details={'version': version_str},
    )


def validate_packages() -> List[ValidationResult]:
    """Validate required Python packages are installed."""
    results = []

    for import_name, package_name in REQUIRED_PACKAGES:
        try:
            module = __import__(import_name)
            version = getattr(module, '__version__', 'unknown')
            results.append(ValidationResult(
                check_name=f"Package: {package_name}",
                level=ValidationLevel.PASS,
                message=f"Installed (v{version})",
                details={'package': package_name, 'version': version},
            ))
        except ImportError:
            results.append(ValidationResult(
                check_name=f"Package: {package_name}",
                level=ValidationLevel.ERROR,
                message=f"Not installed",
                details={'package': package_name},
                fix_available=True,
                fix_command=f"pip install {package_name}",
            ))

    return results


def validate_environment_variables() -> List[ValidationResult]:
    """Validate environment variables are set."""
    results = []

    # Required variables
    for var_name, required, description in REQUIRED_ENV_VARS:
        value = os.getenv(var_name, '')
        if value:
            # Mask sensitive values
            masked = f"{value[:4]}...{value[-4:]}" if len(value) > 10 else "***"
            results.append(ValidationResult(
                check_name=f"Env: {var_name}",
                level=ValidationLevel.PASS,
                message=f"Set ({masked})",
                details={'variable': var_name, 'set': True},
            ))
        else:
            results.append(ValidationResult(
                check_name=f"Env: {var_name}",
                level=ValidationLevel.ERROR if required else ValidationLevel.WARNING,
                message=f"Not set - {description}",
                details={'variable': var_name, 'set': False, 'description': description},
            ))

    # Recommended variables
    for var_name, required, description in RECOMMENDED_ENV_VARS:
        value = os.getenv(var_name, '')
        if value:
            results.append(ValidationResult(
                check_name=f"Env: {var_name}",
                level=ValidationLevel.PASS,
                message="Set",
                details={'variable': var_name, 'set': True},
            ))
        else:
            results.append(ValidationResult(
                check_name=f"Env: {var_name}",
                level=ValidationLevel.WARNING,
                message=f"Not set - {description}",
                details={'variable': var_name, 'set': False, 'description': description},
            ))

    return results


def validate_directory_structure(pipeline_dir: Path) -> List[ValidationResult]:
    """Validate pipeline directory structure."""
    results = []

    for dir_name in REQUIRED_DIRECTORIES:
        dir_path = pipeline_dir / dir_name
        if dir_path.exists() and dir_path.is_dir():
            results.append(ValidationResult(
                check_name=f"Directory: {dir_name}",
                level=ValidationLevel.PASS,
                message="Exists",
                details={'path': str(dir_path)},
            ))
        else:
            results.append(ValidationResult(
                check_name=f"Directory: {dir_name}",
                level=ValidationLevel.ERROR,
                message="Missing",
                details={'path': str(dir_path)},
                fix_available=True,
                fix_command=f"mkdir -p {dir_path}",
            ))

    return results


def validate_configuration_files(pipeline_dir: Path) -> List[ValidationResult]:
    """Validate configuration files exist."""
    results = []

    config_files = [
        ('environment/requirements.txt', True),
        ('environment/.env.template', True),
        ('.env', False),  # Optional but recommended
    ]

    for file_path, required in config_files:
        full_path = pipeline_dir / file_path
        if full_path.exists():
            results.append(ValidationResult(
                check_name=f"Config: {file_path}",
                level=ValidationLevel.PASS,
                message="Exists",
                details={'path': str(full_path)},
            ))
        else:
            results.append(ValidationResult(
                check_name=f"Config: {file_path}",
                level=ValidationLevel.ERROR if required else ValidationLevel.WARNING,
                message="Missing" + (" (recommended)" if not required else ""),
                details={'path': str(full_path)},
            ))

    return results


def validate_inspire_env_var() -> ValidationResult:
    """Validate INSPIRE_PIPELINE_DIR is set correctly."""
    pipeline_dir = os.getenv('INSPIRE_PIPELINE_DIR', '')

    if not pipeline_dir:
        return ValidationResult(
            check_name="INSPIRE_PIPELINE_DIR",
            level=ValidationLevel.WARNING,
            message="Not set - should be set by activate_inspire.sh",
            details={'variable': 'INSPIRE_PIPELINE_DIR', 'set': False},
        )

    if Path(pipeline_dir).exists():
        return ValidationResult(
            check_name="INSPIRE_PIPELINE_DIR",
            level=ValidationLevel.PASS,
            message=f"Set to valid directory",
            details={'path': pipeline_dir},
        )

    return ValidationResult(
        check_name="INSPIRE_PIPELINE_DIR",
        level=ValidationLevel.ERROR,
        message=f"Set but directory does not exist",
        details={'path': pipeline_dir},
    )


# =============================================================================
# MAIN VALIDATION
# =============================================================================

def run_validation(strict: bool = False) -> ValidationReport:
    """Run complete environment validation."""
    results: List[ValidationResult] = []

    # Get pipeline directory
    script_dir = Path(__file__).parent
    pipeline_dir = script_dir.parent

    # 1. Virtual environment
    results.append(validate_virtual_environment())

    # 2. Python version
    results.append(validate_python_version())

    # 3. INSPIRE_PIPELINE_DIR
    results.append(validate_inspire_env_var())

    # 4. Required packages
    results.extend(validate_packages())

    # 5. Environment variables
    results.extend(validate_environment_variables())

    # 6. Directory structure
    results.extend(validate_directory_structure(pipeline_dir))

    # 7. Configuration files
    results.extend(validate_configuration_files(pipeline_dir))

    # Determine overall status
    has_errors = any(r.level == ValidationLevel.ERROR for r in results)
    has_warnings = any(r.level == ValidationLevel.WARNING for r in results)

    is_valid = not has_errors

    # Environment info
    env_info = {
        'python_version': sys.version.split()[0],
        'platform': sys.platform,
        'virtual_env': os.getenv('VIRTUAL_ENV', ''),
        'pipeline_dir': str(pipeline_dir),
        'cwd': os.getcwd(),
    }

    return ValidationReport(
        is_valid=is_valid,
        has_warnings=has_warnings,
        results=results,
        environment=env_info,
        validated_at=datetime.now(),
    )


def print_report(report: ValidationReport, json_output: bool = False, quiet: bool = False):
    """Print validation report."""
    if json_output:
        print(json.dumps(report.to_dict(), indent=2))
        return

    # Header
    print("")
    print("=" * 60)
    print("  INSPIRE 8.0 ENVIRONMENT VALIDATION")
    print("=" * 60)
    print("")

    # Status icons
    icons = {
        ValidationLevel.PASS: "\033[92m[PASS]\033[0m",      # Green
        ValidationLevel.WARNING: "\033[93m[WARN]\033[0m",   # Yellow
        ValidationLevel.ERROR: "\033[91m[FAIL]\033[0m",     # Red
        ValidationLevel.SKIPPED: "\033[90m[SKIP]\033[0m",   # Gray
    }

    # Print results
    for result in report.results:
        if quiet and result.level == ValidationLevel.PASS:
            continue

        icon = icons.get(result.level, "[???]")
        print(f"  {icon} {result.check_name}")
        print(f"         {result.message}")

        if result.fix_available and result.level in [ValidationLevel.ERROR, ValidationLevel.WARNING]:
            print(f"         Fix: {result.fix_command}")

        if not quiet:
            print("")

    # Summary
    summary = report.to_dict()['summary']
    print("-" * 60)
    print(f"  Summary: {summary['passed']} passed, {summary['warnings']} warnings, {summary['errors']} errors")
    print("")

    # Overall status
    print("=" * 60)
    if report.is_valid:
        if report.has_warnings:
            print("  \033[93mENVIRONMENT VALID (with warnings)\033[0m")
        else:
            print("  \033[92mENVIRONMENT VALID\033[0m")
    else:
        print("  \033[91mENVIRONMENT INVALID\033[0m")
        print("")
        print("  Please fix the errors above before running pipeline scripts.")
    print("=" * 60)
    print("")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Validate Inspire 8.0 execution environment',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--strict',
        action='store_true',
        help='Fail on any warning (not just errors)'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Only output errors'
    )

    args = parser.parse_args()

    # Run validation
    report = run_validation(strict=args.strict)

    # Print report
    print_report(report, json_output=args.json, quiet=args.quiet)

    # Determine exit code
    if not report.is_valid:
        return 1
    elif args.strict and report.has_warnings:
        return 2
    else:
        return 0


if __name__ == '__main__':
    sys.exit(main())
