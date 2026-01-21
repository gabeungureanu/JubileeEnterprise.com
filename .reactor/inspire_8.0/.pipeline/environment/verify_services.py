#!/usr/bin/env python3
# =============================================================================
# VERIFY SERVICES
# =============================================================================
"""
Service connectivity verification for Inspire 8.0 pipeline.

This script verifies that all required services are reachable and properly
configured before running pipeline operations.

VERIFIED SERVICES:
1. Qdrant - Vector database on localhost:6333
2. PostgreSQL - Codex database via environment credentials
3. InspireCodex API - https://www.inspirecodex.com

USAGE:
    python verify_services.py [options]

OPTIONS:
    --verbose       Enable verbose output
    --json          Output results as JSON
    --quick         Skip detailed tests, only check connectivity

EXIT CODES:
    0 - All services verified successfully
    1 - One or more services failed verification
    2 - Configuration error

Author: Jubilee Enterprise
Version: 1.0.0
"""

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

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

class ServiceStatus(Enum):
    """Service verification status."""
    UNKNOWN = "unknown"
    CHECKING = "checking"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNREACHABLE = "unreachable"
    ERROR = "error"
    SKIPPED = "skipped"


@dataclass
class ServiceCheck:
    """Result of a service check."""
    service_name: str
    status: ServiceStatus
    endpoint: str
    response_time_ms: float = 0.0
    version: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    error_message: str = ""
    checked_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'service_name': self.service_name,
            'status': self.status.value,
            'endpoint': self.endpoint,
            'response_time_ms': round(self.response_time_ms, 2),
            'version': self.version,
            'details': self.details,
            'error_message': self.error_message,
            'checked_at': self.checked_at.isoformat(),
        }


@dataclass
class VerificationReport:
    """Complete verification report."""
    overall_status: ServiceStatus
    services: List[ServiceCheck]
    environment: Dict[str, Any]
    started_at: datetime
    completed_at: datetime
    total_duration_ms: float

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'overall_status': self.overall_status.value,
            'services': [s.to_dict() for s in self.services],
            'environment': self.environment,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat(),
            'total_duration_ms': round(self.total_duration_ms, 2),
        }


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class ServiceConfig:
    """Service configuration from environment."""
    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_api_key: str = ""

    # PostgreSQL (Codex)
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_database: str = "codex"
    postgres_user: str = ""
    postgres_password: str = ""

    # InspireCodex API
    inspirecodex_url: str = "https://www.inspirecodex.com"
    inspirecodex_api_key: str = ""

    # OpenAI
    openai_api_key: str = ""

    @classmethod
    def from_environment(cls) -> 'ServiceConfig':
        """Load configuration from environment variables."""
        return cls(
            # Qdrant
            qdrant_host=os.getenv('QDRANT_HOST', 'localhost'),
            qdrant_port=int(os.getenv('QDRANT_PORT', '6333')),
            qdrant_api_key=os.getenv('QDRANT_API_KEY', ''),

            # PostgreSQL
            postgres_host=os.getenv('POSTGRES_HOST', os.getenv('CODEX_DB_HOST', 'localhost')),
            postgres_port=int(os.getenv('POSTGRES_PORT', os.getenv('CODEX_DB_PORT', '5432'))),
            postgres_database=os.getenv('POSTGRES_DATABASE', os.getenv('CODEX_DB_NAME', 'codex')),
            postgres_user=os.getenv('POSTGRES_USER', os.getenv('CODEX_DB_USER', '')),
            postgres_password=os.getenv('POSTGRES_PASSWORD', os.getenv('CODEX_DB_PASSWORD', '')),

            # InspireCodex API
            inspirecodex_url=os.getenv('INSPIRECODEX_URL', 'https://www.inspirecodex.com'),
            inspirecodex_api_key=os.getenv('INSPIRECODEX_API_KEY', ''),

            # OpenAI
            openai_api_key=os.getenv('OPENAI_API_KEY', ''),
        )


# =============================================================================
# SERVICE VERIFIERS
# =============================================================================

def verify_qdrant(config: ServiceConfig, verbose: bool = False) -> ServiceCheck:
    """Verify Qdrant service connectivity."""
    endpoint = f"http://{config.qdrant_host}:{config.qdrant_port}"

    try:
        import requests

        start_time = time.time()

        # Check Qdrant health endpoint
        response = requests.get(
            f"{endpoint}/",
            timeout=5,
            headers={'api-key': config.qdrant_api_key} if config.qdrant_api_key else {}
        )

        response_time = (time.time() - start_time) * 1000

        if response.status_code == 200:
            # Get collections info
            collections_response = requests.get(
                f"{endpoint}/collections",
                timeout=5,
                headers={'api-key': config.qdrant_api_key} if config.qdrant_api_key else {}
            )

            details = {}
            if collections_response.status_code == 200:
                collections_data = collections_response.json()
                details['collections_count'] = len(collections_data.get('result', {}).get('collections', []))
                if verbose:
                    details['collections'] = [
                        c['name'] for c in collections_data.get('result', {}).get('collections', [])
                    ]

            return ServiceCheck(
                service_name="Qdrant",
                status=ServiceStatus.HEALTHY,
                endpoint=endpoint,
                response_time_ms=response_time,
                version=response.headers.get('x-qdrant-version', 'unknown'),
                details=details,
            )
        else:
            return ServiceCheck(
                service_name="Qdrant",
                status=ServiceStatus.ERROR,
                endpoint=endpoint,
                response_time_ms=response_time,
                error_message=f"HTTP {response.status_code}: {response.text[:100]}",
            )

    except requests.exceptions.ConnectionError:
        return ServiceCheck(
            service_name="Qdrant",
            status=ServiceStatus.UNREACHABLE,
            endpoint=endpoint,
            error_message=f"Cannot connect to {endpoint}",
        )
    except Exception as e:
        return ServiceCheck(
            service_name="Qdrant",
            status=ServiceStatus.ERROR,
            endpoint=endpoint,
            error_message=str(e),
        )


def verify_postgres(config: ServiceConfig, verbose: bool = False) -> ServiceCheck:
    """Verify PostgreSQL (Codex) connectivity."""
    endpoint = f"postgresql://{config.postgres_host}:{config.postgres_port}/{config.postgres_database}"

    # Check if credentials are configured
    if not config.postgres_user:
        return ServiceCheck(
            service_name="PostgreSQL (Codex)",
            status=ServiceStatus.SKIPPED,
            endpoint=endpoint,
            error_message="POSTGRES_USER not configured in environment",
        )

    try:
        import psycopg2

        start_time = time.time()

        # Connect to database
        conn = psycopg2.connect(
            host=config.postgres_host,
            port=config.postgres_port,
            database=config.postgres_database,
            user=config.postgres_user,
            password=config.postgres_password,
            connect_timeout=5,
        )

        response_time = (time.time() - start_time) * 1000

        # Get version and database info
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]

        details = {}
        if verbose:
            # Get table count
            cursor.execute("""
                SELECT count(*) FROM information_schema.tables
                WHERE table_schema = 'public'
            """)
            details['table_count'] = cursor.fetchone()[0]

            # Get database size
            cursor.execute(f"SELECT pg_size_pretty(pg_database_size('{config.postgres_database}'))")
            details['database_size'] = cursor.fetchone()[0]

        cursor.close()
        conn.close()

        return ServiceCheck(
            service_name="PostgreSQL (Codex)",
            status=ServiceStatus.HEALTHY,
            endpoint=endpoint,
            response_time_ms=response_time,
            version=version.split(',')[0] if version else 'unknown',
            details=details,
        )

    except ImportError:
        return ServiceCheck(
            service_name="PostgreSQL (Codex)",
            status=ServiceStatus.ERROR,
            endpoint=endpoint,
            error_message="psycopg2 not installed",
        )
    except Exception as e:
        return ServiceCheck(
            service_name="PostgreSQL (Codex)",
            status=ServiceStatus.ERROR,
            endpoint=endpoint,
            error_message=str(e),
        )


def verify_inspirecodex_api(config: ServiceConfig, verbose: bool = False) -> ServiceCheck:
    """Verify InspireCodex API connectivity."""
    endpoint = config.inspirecodex_url

    try:
        import requests

        start_time = time.time()

        # Check API health/status endpoint
        health_url = f"{endpoint}/api/health"
        headers = {}
        if config.inspirecodex_api_key:
            headers['Authorization'] = f"Bearer {config.inspirecodex_api_key}"

        try:
            response = requests.get(health_url, timeout=10, headers=headers)
            response_time = (time.time() - start_time) * 1000

            if response.status_code == 200:
                details = {}
                try:
                    data = response.json()
                    details = data if verbose else {}
                except:
                    pass

                return ServiceCheck(
                    service_name="InspireCodex API",
                    status=ServiceStatus.HEALTHY,
                    endpoint=endpoint,
                    response_time_ms=response_time,
                    details=details,
                )
            elif response.status_code == 404:
                # Health endpoint may not exist, try root
                root_response = requests.get(endpoint, timeout=10)
                if root_response.status_code in [200, 301, 302]:
                    return ServiceCheck(
                        service_name="InspireCodex API",
                        status=ServiceStatus.HEALTHY,
                        endpoint=endpoint,
                        response_time_ms=response_time,
                        details={'note': 'Health endpoint not available, root accessible'},
                    )
            else:
                return ServiceCheck(
                    service_name="InspireCodex API",
                    status=ServiceStatus.DEGRADED,
                    endpoint=endpoint,
                    response_time_ms=response_time,
                    error_message=f"HTTP {response.status_code}",
                )

        except requests.exceptions.SSLError:
            return ServiceCheck(
                service_name="InspireCodex API",
                status=ServiceStatus.ERROR,
                endpoint=endpoint,
                error_message="SSL certificate verification failed",
            )

    except requests.exceptions.ConnectionError:
        return ServiceCheck(
            service_name="InspireCodex API",
            status=ServiceStatus.UNREACHABLE,
            endpoint=endpoint,
            error_message=f"Cannot connect to {endpoint}",
        )
    except Exception as e:
        return ServiceCheck(
            service_name="InspireCodex API",
            status=ServiceStatus.ERROR,
            endpoint=endpoint,
            error_message=str(e),
        )


def verify_openai(config: ServiceConfig, verbose: bool = False) -> ServiceCheck:
    """Verify OpenAI API connectivity."""
    endpoint = "https://api.openai.com/v1"

    if not config.openai_api_key:
        return ServiceCheck(
            service_name="OpenAI API",
            status=ServiceStatus.SKIPPED,
            endpoint=endpoint,
            error_message="OPENAI_API_KEY not configured in environment",
        )

    try:
        import openai

        start_time = time.time()

        client = openai.OpenAI(api_key=config.openai_api_key)

        # List models to verify connectivity
        models = client.models.list()
        response_time = (time.time() - start_time) * 1000

        details = {}
        if verbose:
            model_names = [m.id for m in models.data if 'gpt' in m.id.lower() or 'embed' in m.id.lower()]
            details['available_models'] = model_names[:10]

        return ServiceCheck(
            service_name="OpenAI API",
            status=ServiceStatus.HEALTHY,
            endpoint=endpoint,
            response_time_ms=response_time,
            details=details,
        )

    except Exception as e:
        return ServiceCheck(
            service_name="OpenAI API",
            status=ServiceStatus.ERROR,
            endpoint=endpoint,
            error_message=str(e),
        )


# =============================================================================
# ENVIRONMENT VERIFICATION
# =============================================================================

def verify_environment() -> Dict[str, Any]:
    """Verify execution environment."""
    env_info = {
        'python_version': sys.version,
        'platform': sys.platform,
        'cwd': os.getcwd(),
        'virtual_env': os.getenv('VIRTUAL_ENV', 'Not in virtual environment'),
        'inspire_pipeline_dir': os.getenv('INSPIRE_PIPELINE_DIR', 'Not set'),
        'inspire_env': os.getenv('INSPIRE_ENV', 'Not set'),
    }

    # Check if running in correct environment
    if os.getenv('VIRTUAL_ENV') and 'inspire_venv' in os.getenv('VIRTUAL_ENV', ''):
        env_info['environment_valid'] = True
    else:
        env_info['environment_valid'] = False
        env_info['warning'] = "Not running in Inspire 8.0 virtual environment"

    return env_info


def verify_python_packages() -> Dict[str, Any]:
    """Verify required Python packages are installed."""
    required_packages = {
        'qdrant_client': 'qdrant-client',
        'psycopg2': 'psycopg2-binary',
        'openai': 'openai',
        'tiktoken': 'tiktoken',
        'yaml': 'PyYAML',
        'pydantic': 'pydantic',
        'requests': 'requests',
        'dotenv': 'python-dotenv',
    }

    results = {}
    for import_name, package_name in required_packages.items():
        try:
            module = __import__(import_name)
            version = getattr(module, '__version__', 'unknown')
            results[package_name] = {'installed': True, 'version': version}
        except ImportError:
            results[package_name] = {'installed': False, 'version': None}

    return results


# =============================================================================
# MAIN VERIFICATION
# =============================================================================

def run_verification(verbose: bool = False, quick: bool = False) -> VerificationReport:
    """Run complete service verification."""
    started_at = datetime.now()
    start_time = time.time()

    # Load configuration
    config = ServiceConfig.from_environment()

    # Verify services
    services = []

    # 1. Qdrant
    logger.info("Checking Qdrant...")
    services.append(verify_qdrant(config, verbose))

    # 2. PostgreSQL
    logger.info("Checking PostgreSQL (Codex)...")
    services.append(verify_postgres(config, verbose))

    # 3. InspireCodex API
    if not quick:
        logger.info("Checking InspireCodex API...")
        services.append(verify_inspirecodex_api(config, verbose))

    # 4. OpenAI API
    if not quick:
        logger.info("Checking OpenAI API...")
        services.append(verify_openai(config, verbose))

    # Determine overall status
    statuses = [s.status for s in services]
    if all(s in [ServiceStatus.HEALTHY, ServiceStatus.SKIPPED] for s in statuses):
        overall_status = ServiceStatus.HEALTHY
    elif any(s == ServiceStatus.ERROR for s in statuses):
        overall_status = ServiceStatus.ERROR
    elif any(s == ServiceStatus.UNREACHABLE for s in statuses):
        overall_status = ServiceStatus.UNREACHABLE
    elif any(s == ServiceStatus.DEGRADED for s in statuses):
        overall_status = ServiceStatus.DEGRADED
    else:
        overall_status = ServiceStatus.UNKNOWN

    completed_at = datetime.now()
    total_duration = (time.time() - start_time) * 1000

    # Get environment info
    env_info = verify_environment()
    if verbose:
        env_info['packages'] = verify_python_packages()

    return VerificationReport(
        overall_status=overall_status,
        services=services,
        environment=env_info,
        started_at=started_at,
        completed_at=completed_at,
        total_duration_ms=total_duration,
    )


# =============================================================================
# CLI
# =============================================================================

def print_report(report: VerificationReport, json_output: bool = False):
    """Print verification report."""
    if json_output:
        print(json.dumps(report.to_dict(), indent=2))
        return

    # Header
    print("")
    print("=" * 60)
    print("  INSPIRE 8.0 SERVICE VERIFICATION")
    print("=" * 60)
    print(f"  Started:  {report.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Duration: {report.total_duration_ms:.1f} ms")
    print("=" * 60)
    print("")

    # Service results
    status_icons = {
        ServiceStatus.HEALTHY: "\033[92m[OK]\033[0m",      # Green
        ServiceStatus.DEGRADED: "\033[93m[WARN]\033[0m",   # Yellow
        ServiceStatus.ERROR: "\033[91m[FAIL]\033[0m",      # Red
        ServiceStatus.UNREACHABLE: "\033[91m[FAIL]\033[0m",
        ServiceStatus.SKIPPED: "\033[90m[SKIP]\033[0m",    # Gray
        ServiceStatus.UNKNOWN: "\033[90m[???]\033[0m",
    }

    for service in report.services:
        icon = status_icons.get(service.status, "[???]")
        print(f"  {icon} {service.service_name}")
        print(f"       Endpoint: {service.endpoint}")

        if service.response_time_ms > 0:
            print(f"       Response: {service.response_time_ms:.1f} ms")

        if service.version:
            print(f"       Version:  {service.version}")

        if service.error_message:
            print(f"       Error:    {service.error_message}")

        if service.details:
            for key, value in service.details.items():
                if isinstance(value, list):
                    print(f"       {key}: {len(value)} items")
                else:
                    print(f"       {key}: {value}")

        print("")

    # Environment
    print("-" * 60)
    print("  ENVIRONMENT")
    print("-" * 60)

    env = report.environment
    if not env.get('environment_valid', False):
        print(f"  \033[93m[WARNING]\033[0m {env.get('warning', 'Not in Inspire environment')}")

    print(f"  Python:      {env.get('python_version', '').split()[0]}")
    print(f"  Platform:    {env.get('platform', 'unknown')}")
    print(f"  Virtual Env: {env.get('virtual_env', 'None')}")
    print("")

    # Summary
    print("=" * 60)
    overall_icon = status_icons.get(report.overall_status, "[???]")
    print(f"  OVERALL STATUS: {overall_icon} {report.overall_status.value.upper()}")
    print("=" * 60)
    print("")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Verify Inspire 8.0 service connectivity',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )
    parser.add_argument(
        '--quick', '-q',
        action='store_true',
        help='Skip detailed tests, only check core services'
    )

    args = parser.parse_args()

    # Run verification
    report = run_verification(verbose=args.verbose, quick=args.quick)

    # Print results
    print_report(report, json_output=args.json)

    # Exit with appropriate code
    if report.overall_status == ServiceStatus.HEALTHY:
        return 0
    else:
        return 1


if __name__ == '__main__':
    sys.exit(main())
