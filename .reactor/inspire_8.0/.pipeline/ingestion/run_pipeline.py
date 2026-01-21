#!/usr/bin/env python3
# =============================================================================
# QDRANT INGESTION PIPELINE RUNNER
# =============================================================================
"""
Orchestrates all Qdrant ingestion scripts for the Inspire 8.0 system.

This is the MAIN ENTRY POINT for data ingestion into Qdrant.
It coordinates execution of all ingestion scripts in the proper order
and aggregates results into a unified report.

Execution Order:
    1. Scripture (foundation layer)
    2. Ministry Docs (doctrine, governance, kingdom)
    3. Persona Anchors (identity layer)

Usage:
    python run_pipeline.py [--dry-run] [--force] [--only SCRIPT]

Options:
    --dry-run       Simulate all ingestion without writing to Qdrant
    --force         Re-ingest even if points already exist
    --only SCRIPT   Only run a specific script (scripture, ministry, personas)
    --skip SCRIPT   Skip specific scripts (comma-separated)
    --report        Generate aggregate report after run
    --verbose       Enable verbose output

Examples:
    python run_pipeline.py                    # Full ingestion
    python run_pipeline.py --dry-run          # Test run without writes
    python run_pipeline.py --only scripture   # Only ingest scripture
    python run_pipeline.py --skip personas    # Skip persona anchors
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add utils to path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from utils.logger import generate_run_id


# =============================================================================
# CONFIGURATION
# =============================================================================

WORKSPACE_ROOT = Path(__file__).parent.parent.parent.parent.parent
REPORT_DIR = SCRIPT_DIR / "reports"
LOG_DIR = SCRIPT_DIR / "logs"

# Ingestion scripts in execution order
INGESTION_SCRIPTS = [
    {
        "name": "scripture",
        "script": "ingest_scripture.py",
        "description": "Ingest JSV Bible scripture (Tier 1 - Atomic)",
        "collections": ["scripture"],
        "priority": 1,
    },
    {
        "name": "ministry",
        "script": "ingest_ministry_docs.py",
        "description": "Ingest ministry documents (Tier 2 - Contextual)",
        "collections": ["doctrine", "governance", "kingdom_builder", "jubilee_ministry"],
        "priority": 2,
    },
    {
        "name": "personas",
        "script": "ingest_persona_anchors.py",
        "description": "Ingest persona anchor documents (Tier 2 - Complete sections)",
        "collections": [
            "gabriel", "michael", "uriel", "raphael", "selah", "ezra",
            "lydia", "enoch", "seraph", "malachi", "anna", "nathaniel", "elias"
        ],
        "priority": 3,
    },
]


# =============================================================================
# PIPELINE RUNNER
# =============================================================================

class PipelineRunner:
    """Orchestrates the execution of all ingestion scripts."""

    def __init__(
        self,
        dry_run: bool = False,
        force: bool = False,
        only: Optional[str] = None,
        skip: Optional[List[str]] = None,
        verbose: bool = False
    ):
        self.dry_run = dry_run
        self.force = force
        self.only = only
        self.skip = skip or []
        self.verbose = verbose

        self.run_id = generate_run_id("pipeline")
        self.started_at = None
        self.completed_at = None

        self.results: List[Dict[str, Any]] = []

    def run(self) -> bool:
        """Execute the full ingestion pipeline."""
        self.started_at = datetime.now()

        self._print_header()
        self._print_config()

        # Determine which scripts to run
        scripts_to_run = self._get_scripts_to_run()

        if not scripts_to_run:
            print("\n  No scripts to run.")
            return True

        print(f"\n  Scripts to execute: {len(scripts_to_run)}")
        for script in scripts_to_run:
            print(f"    - {script['name']}: {script['description']}")

        print("\n" + "=" * 70)

        # Execute each script
        all_success = True
        for script in scripts_to_run:
            success = self._run_script(script)
            if not success:
                all_success = False
                # Continue with other scripts even if one fails

        self.completed_at = datetime.now()

        # Generate aggregate report
        self._generate_aggregate_report()

        # Print summary
        self._print_summary()

        return all_success

    def _get_scripts_to_run(self) -> List[Dict[str, Any]]:
        """Determine which scripts should be executed."""
        scripts = []

        for script in sorted(INGESTION_SCRIPTS, key=lambda x: x['priority']):
            # Check --only filter
            if self.only and script['name'] != self.only:
                continue

            # Check --skip filter
            if script['name'] in self.skip:
                continue

            scripts.append(script)

        return scripts

    def _run_script(self, script: Dict[str, Any]) -> bool:
        """Execute a single ingestion script."""
        script_name = script['name']
        script_file = script['script']
        script_path = SCRIPT_DIR / script_file

        print(f"\n  Running: {script_name}")
        print(f"  Script: {script_file}")
        print("-" * 70)

        if not script_path.exists():
            print(f"  ERROR: Script not found: {script_path}")
            self.results.append({
                "script": script_name,
                "status": "error",
                "error": f"Script not found: {script_path}",
                "duration_seconds": 0
            })
            return False

        # Build command
        cmd = [sys.executable, str(script_path)]

        if self.dry_run:
            cmd.append("--dry-run")

        if self.force:
            cmd.append("--force")

        # Execute script
        start_time = datetime.now()
        try:
            if self.verbose:
                # Stream output
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    cwd=str(SCRIPT_DIR)
                )

                for line in iter(process.stdout.readline, ''):
                    print(f"    {line.rstrip()}")

                process.wait()
                return_code = process.returncode
            else:
                # Capture output
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    cwd=str(SCRIPT_DIR)
                )
                return_code = result.returncode

                if return_code != 0:
                    print(f"  Output:\n{result.stdout}")
                    if result.stderr:
                        print(f"  Errors:\n{result.stderr}")

            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            if return_code == 0:
                print(f"  Status: SUCCESS")
                print(f"  Duration: {duration:.2f}s")
                self.results.append({
                    "script": script_name,
                    "status": "success",
                    "duration_seconds": duration,
                    "collections": script['collections']
                })
                return True
            else:
                print(f"  Status: FAILED (exit code {return_code})")
                self.results.append({
                    "script": script_name,
                    "status": "failed",
                    "exit_code": return_code,
                    "duration_seconds": duration
                })
                return False

        except Exception as e:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            print(f"  Status: ERROR")
            print(f"  Error: {e}")

            self.results.append({
                "script": script_name,
                "status": "error",
                "error": str(e),
                "duration_seconds": duration
            })
            return False

    def _generate_aggregate_report(self):
        """Generate an aggregate report for the pipeline run."""
        REPORT_DIR.mkdir(parents=True, exist_ok=True)

        total_duration = (self.completed_at - self.started_at).total_seconds()

        report = {
            "run_id": self.run_id,
            "pipeline": "inspire_8.0_ingestion",
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_seconds": total_duration,
            "dry_run": self.dry_run,
            "force": self.force,
            "scripts_executed": len(self.results),
            "scripts_succeeded": sum(1 for r in self.results if r['status'] == 'success'),
            "scripts_failed": sum(1 for r in self.results if r['status'] in ['failed', 'error']),
            "results": self.results
        }

        # Write report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = REPORT_DIR / f"pipeline_{timestamp}.json"

        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)

        print(f"\n  Aggregate report: {report_file}")

    def _print_header(self):
        """Print pipeline header."""
        print("")
        print("=" * 70)
        print("  INSPIRE 8.0 QDRANT INGESTION PIPELINE")
        print("=" * 70)
        print(f"  Run ID: {self.run_id}")
        print(f"  Started: {self.started_at.strftime('%Y-%m-%d %H:%M:%S')}")

    def _print_config(self):
        """Print pipeline configuration."""
        print("")
        print("  Configuration:")
        print(f"    Dry Run: {self.dry_run}")
        print(f"    Force: {self.force}")
        print(f"    Only: {self.only or 'ALL'}")
        print(f"    Skip: {', '.join(self.skip) if self.skip else 'NONE'}")
        print(f"    Verbose: {self.verbose}")

    def _print_summary(self):
        """Print pipeline summary."""
        total_duration = (self.completed_at - self.started_at).total_seconds()

        print("")
        print("=" * 70)
        print("  PIPELINE SUMMARY")
        print("=" * 70)
        print(f"  Run ID: {self.run_id}")
        print(f"  Duration: {total_duration:.2f}s")
        print("")
        print(f"  Scripts executed: {len(self.results)}")
        print(f"  Succeeded: {sum(1 for r in self.results if r['status'] == 'success')}")
        print(f"  Failed: {sum(1 for r in self.results if r['status'] in ['failed', 'error'])}")
        print("")

        for result in self.results:
            status_icon = "[OK]" if result['status'] == 'success' else "[FAIL]"
            print(f"    {status_icon} {result['script']}: {result['status']} ({result['duration_seconds']:.2f}s)")

        print("")
        print("=" * 70)

        if all(r['status'] == 'success' for r in self.results):
            print("  PIPELINE COMPLETED SUCCESSFULLY")
        else:
            print("  PIPELINE COMPLETED WITH ERRORS")

        print("=" * 70)
        print("")


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Run the Inspire 8.0 Qdrant ingestion pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_pipeline.py                    # Full ingestion
  python run_pipeline.py --dry-run          # Test run
  python run_pipeline.py --only scripture   # Only scripture
  python run_pipeline.py --skip personas    # Skip personas
        """
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate without writing to Qdrant"
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-ingest even if points already exist"
    )

    parser.add_argument(
        "--only",
        type=str,
        choices=["scripture", "ministry", "personas"],
        help="Only run a specific script"
    )

    parser.add_argument(
        "--skip",
        type=str,
        help="Skip specific scripts (comma-separated)"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )

    args = parser.parse_args()

    # Parse skip list
    skip_list = []
    if args.skip:
        skip_list = [s.strip() for s in args.skip.split(",")]

    # Run pipeline
    runner = PipelineRunner(
        dry_run=args.dry_run,
        force=args.force,
        only=args.only,
        skip=skip_list,
        verbose=args.verbose
    )

    success = runner.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
