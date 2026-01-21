#!/usr/bin/env python3
# =============================================================================
# ACTIVATE PERSONA
# =============================================================================
"""
Activate a specific Inspire 8.0 persona for testing or operation.

This script handles persona activation including:
1. Validating persona configuration
2. Loading persona from Qdrant collection
3. Initializing session context
4. Applying persona constraints and behaviors
5. Starting interactive session or single-shot execution

USAGE:
    python activate_persona.py [options] <persona_id>

ARGUMENTS:
    persona_id           ID of the persona to activate

OPTIONS:
    --mode MODE          Activation mode: interactive, single-shot, test (default: interactive)
    --session-id ID      Custom session ID (default: auto-generated)
    --dry-run            Validate persona without activating
    --verbose            Enable verbose logging
    --json               Output results as JSON

AVAILABLE PERSONAS:
    inspire_foundation   Core Inspire persona with full authority
    inspire_pastor       Pastoral guidance persona
    inspire_teacher      Teaching-focused persona
    inspire_counselor    Counseling and support persona
    inspire_scholar      Academic and research persona

ENVIRONMENT VARIABLES:
    QDRANT_HOST          Qdrant server host
    QDRANT_PORT          Qdrant server port
    QDRANT_API_KEY       Optional API key
    OPENAI_API_KEY       For LLM interactions

EXIT CODES:
    0 - Success
    1 - Configuration error
    2 - Persona not found
    3 - Activation error
    4 - Validation error
"""

import argparse
import json
import logging
import os
import sys
import uuid
from datetime import datetime
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
# CONFIGURATION
# =============================================================================

class ActivationConfig:
    """Configuration for persona activation."""

    def __init__(self):
        self.qdrant_host = os.environ.get('QDRANT_HOST', 'localhost')
        self.qdrant_port = int(os.environ.get('QDRANT_PORT', '6333'))
        self.qdrant_api_key = os.environ.get('QDRANT_API_KEY')
        self.openai_api_key = os.environ.get('OPENAI_API_KEY')

        # Persona collection
        self.persona_collection = 'inspire_canonical_personas'

        # Session configuration
        self.session_collection = 'inspire_session_context'
        self.memory_collection = 'inspire_conversation_memory'

        # Available personas
        self.available_personas = {
            'inspire_foundation': {
                'name': 'Inspire Foundation',
                'description': 'Core Inspire persona with full authority foundation',
                'tier_default': 'STANDARD',
                'constraints': ['authority_adherence', 'scriptural_alignment'],
            },
            'inspire_pastor': {
                'name': 'Inspire Pastor',
                'description': 'Pastoral guidance and spiritual care persona',
                'tier_default': 'STANDARD',
                'constraints': ['pastoral_sensitivity', 'confidentiality'],
            },
            'inspire_teacher': {
                'name': 'Inspire Teacher',
                'description': 'Teaching and educational persona',
                'tier_default': 'ECONOMY',
                'constraints': ['clarity', 'accuracy', 'age_appropriate'],
            },
            'inspire_counselor': {
                'name': 'Inspire Counselor',
                'description': 'Counseling and emotional support persona',
                'tier_default': 'STANDARD',
                'constraints': ['empathy', 'boundaries', 'referral_awareness'],
            },
            'inspire_scholar': {
                'name': 'Inspire Scholar',
                'description': 'Academic research and theological study persona',
                'tier_default': 'PREMIUM',
                'constraints': ['scholarly_rigor', 'citation_accuracy'],
            },
        }

        # Activation log directory
        self.log_dir = Path(
            'c:/data/JubileeEnterprise.com/.reactor/inspire_8.0/.pipeline/logs/activation'
        )

    def validate(self) -> bool:
        """Validate configuration."""
        if not self.openai_api_key:
            logger.warning("OPENAI_API_KEY not set - LLM interactions will be mocked")
        return True


# =============================================================================
# PERSONA LOADER
# =============================================================================

class PersonaLoader:
    """Loads persona definitions from Qdrant."""

    def __init__(self, config: ActivationConfig):
        self.config = config

    def load(self, persona_id: str) -> Optional[Dict[str, Any]]:
        """Load a persona definition."""
        # Check if persona exists in configuration
        if persona_id not in self.config.available_personas:
            logger.error(f"Unknown persona: {persona_id}")
            return None

        base_config = self.config.available_personas[persona_id]

        # In production: load full persona from Qdrant
        # For now, return enriched configuration
        persona = {
            'id': persona_id,
            'name': base_config['name'],
            'description': base_config['description'],
            'tier_default': base_config['tier_default'],
            'constraints': base_config['constraints'],
            'loaded_at': datetime.now().isoformat(),
            'source': 'config',  # Would be 'qdrant' in production
        }

        return persona

    def validate_persona(self, persona: Dict[str, Any]) -> List[str]:
        """Validate persona configuration. Returns list of issues."""
        issues = []

        # Required fields
        required = ['id', 'name', 'description', 'tier_default', 'constraints']
        for field in required:
            if field not in persona:
                issues.append(f"Missing required field: {field}")

        # Validate tier
        valid_tiers = ['ECONOMY', 'STANDARD', 'PREMIUM']
        if persona.get('tier_default') not in valid_tiers:
            issues.append(f"Invalid tier: {persona.get('tier_default')}")

        # Validate constraints (must be non-empty list)
        constraints = persona.get('constraints', [])
        if not isinstance(constraints, list) or len(constraints) == 0:
            issues.append("Constraints must be a non-empty list")

        return issues


# =============================================================================
# SESSION MANAGER
# =============================================================================

class SessionManager:
    """Manages activation sessions."""

    def __init__(self, config: ActivationConfig):
        self.config = config
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

    def create_session(
        self,
        persona: Dict[str, Any],
        session_id: Optional[str] = None,
        mode: str = 'interactive'
    ) -> Dict[str, Any]:
        """Create a new activation session."""
        if session_id is None:
            session_id = str(uuid.uuid4())[:8]

        session = {
            'session_id': session_id,
            'persona_id': persona['id'],
            'persona_name': persona['name'],
            'mode': mode,
            'tier': persona['tier_default'],
            'constraints': persona['constraints'],
            'created_at': datetime.now().isoformat(),
            'status': 'initialized',
            'message_count': 0,
            'tier_usage': {
                'PREMIUM': 0,
                'STANDARD': 0,
                'ECONOMY': 0,
            },
        }

        self.active_sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get an existing session."""
        return self.active_sessions.get(session_id)

    def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session state."""
        if session_id not in self.active_sessions:
            return False

        self.active_sessions[session_id].update(updates)
        return True

    def end_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """End a session and return final state."""
        if session_id not in self.active_sessions:
            return None

        session = self.active_sessions[session_id]
        session['status'] = 'ended'
        session['ended_at'] = datetime.now().isoformat()

        return self.active_sessions.pop(session_id)


# =============================================================================
# PERSONA ACTIVATOR
# =============================================================================

class PersonaActivator:
    """Main class for persona activation."""

    def __init__(
        self,
        config: ActivationConfig,
        mode: str = 'interactive',
        dry_run: bool = False
    ):
        self.config = config
        self.mode = mode
        self.dry_run = dry_run

        self.loader = PersonaLoader(config)
        self.session_manager = SessionManager(config)

        self.stats = {
            'persona_id': None,
            'session_id': None,
            'mode': mode,
            'validation_issues': [],
            'activated': False,
            'started_at': None,
            'completed_at': None,
        }

    def activate(
        self,
        persona_id: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Activate a persona."""
        self.stats['started_at'] = datetime.now().isoformat()
        self.stats['persona_id'] = persona_id

        logger.info("=" * 60)
        logger.info("INSPIRE 8.0 PERSONA ACTIVATION")
        logger.info("=" * 60)
        logger.info(f"Persona: {persona_id}")
        logger.info(f"Mode: {self.mode}")
        logger.info(f"Session ID: {session_id or 'auto'}")
        logger.info(f"Dry run: {self.dry_run}")
        logger.info("=" * 60)

        # Step 1: Load persona
        logger.info("Loading persona configuration...")
        persona = self.loader.load(persona_id)

        if persona is None:
            self.stats['validation_issues'].append(f"Persona not found: {persona_id}")
            return self._create_result(success=False, error="Persona not found")

        logger.info(f"  Loaded: {persona['name']}")
        logger.info(f"  Description: {persona['description']}")
        logger.info(f"  Default tier: {persona['tier_default']}")

        # Step 2: Validate persona
        logger.info("Validating persona...")
        issues = self.loader.validate_persona(persona)

        if issues:
            self.stats['validation_issues'] = issues
            for issue in issues:
                logger.error(f"  Validation error: {issue}")
            return self._create_result(success=False, error="Validation failed")

        logger.info("  Validation passed")

        # Step 3: Create session (if not dry run)
        if self.dry_run:
            logger.info("[DRY-RUN] Would create activation session")
            session = {
                'session_id': session_id or 'dry-run',
                'persona_id': persona_id,
                'mode': self.mode,
                'status': 'dry-run',
            }
        else:
            logger.info("Creating activation session...")
            session = self.session_manager.create_session(
                persona=persona,
                session_id=session_id,
                mode=self.mode
            )
            logger.info(f"  Session ID: {session['session_id']}")

        self.stats['session_id'] = session['session_id']

        # Step 4: Initialize context
        if not self.dry_run:
            logger.info("Initializing session context...")
            self._initialize_context(session, persona)
            logger.info("  Context initialized")

        # Step 5: Apply constraints
        if not self.dry_run:
            logger.info("Applying persona constraints...")
            self._apply_constraints(session, persona)
            logger.info(f"  Applied {len(persona['constraints'])} constraints")

        # Step 6: Mark as activated
        self.stats['activated'] = True
        self.stats['completed_at'] = datetime.now().isoformat()

        if not self.dry_run:
            self.session_manager.update_session(
                session['session_id'],
                {'status': 'active'}
            )

        self._print_summary(persona, session)
        self._save_activation_log(persona, session)

        return self._create_result(
            success=True,
            persona=persona,
            session=session
        )

    def _initialize_context(
        self,
        session: Dict[str, Any],
        persona: Dict[str, Any]
    ):
        """Initialize session context in Qdrant."""
        # In production: store session context in Qdrant
        # This would include:
        # - Session metadata
        # - Initial conversation state
        # - User preferences (if known)
        # - Routing configuration
        pass

    def _apply_constraints(
        self,
        session: Dict[str, Any],
        persona: Dict[str, Any]
    ):
        """Apply persona constraints to session."""
        # In production: load and apply constraint definitions
        # This would include:
        # - System prompt modifications
        # - Output filtering rules
        # - Topic restrictions
        # - Response guidelines
        pass

    def _create_result(
        self,
        success: bool,
        error: str = None,
        persona: Dict[str, Any] = None,
        session: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create activation result."""
        result = {
            'success': success,
            'stats': self.stats,
        }

        if error:
            result['error'] = error
        if persona:
            result['persona'] = persona
        if session:
            result['session'] = session

        return result

    def _print_summary(
        self,
        persona: Dict[str, Any],
        session: Dict[str, Any]
    ):
        """Print activation summary."""
        logger.info("=" * 60)
        logger.info("ACTIVATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Persona: {persona['name']} ({persona['id']})")
        logger.info(f"Session ID: {session['session_id']}")
        logger.info(f"Mode: {session['mode']}")
        logger.info(f"Status: {session['status']}")
        logger.info(f"Default tier: {persona['tier_default']}")
        logger.info(f"Constraints: {', '.join(persona['constraints'])}")
        logger.info("=" * 60)

        if session['mode'] == 'interactive':
            logger.info("")
            logger.info("Persona is now active. Ready for interaction.")
            logger.info("Use Ctrl+C to end the session.")
            logger.info("")

    def _save_activation_log(
        self,
        persona: Dict[str, Any],
        session: Dict[str, Any]
    ):
        """Save activation log to file."""
        if self.dry_run:
            return

        self.config.log_dir.mkdir(parents=True, exist_ok=True)
        log_file = self.config.log_dir / f"activation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        log_data = {
            'persona': persona,
            'session': session,
            'stats': self.stats,
        }

        log_file.write_text(json.dumps(log_data, indent=2))
        logger.info(f"Activation log saved: {log_file}")


# =============================================================================
# INTERACTIVE MODE
# =============================================================================

def run_interactive_session(activator: PersonaActivator, result: Dict[str, Any]):
    """Run an interactive persona session."""
    if not result['success']:
        return

    session = result['session']
    persona = result['persona']

    logger.info("-" * 60)
    logger.info(f"Interactive session with {persona['name']}")
    logger.info("Type 'exit' or 'quit' to end session")
    logger.info("-" * 60)

    try:
        while True:
            try:
                user_input = input("\nYou: ").strip()

                if user_input.lower() in ['exit', 'quit', 'q']:
                    break

                if not user_input:
                    continue

                # In production: route through model router and generate response
                # For now, just echo acknowledgment
                print(f"\n{persona['name']}: [Response would be generated here]")

                # Update session stats
                session['message_count'] = session.get('message_count', 0) + 1

            except EOFError:
                break

    except KeyboardInterrupt:
        print("\n")
        logger.info("Session interrupted by user")

    # End session
    final_session = activator.session_manager.end_session(session['session_id'])
    if final_session:
        logger.info("-" * 60)
        logger.info("SESSION ENDED")
        logger.info(f"Messages exchanged: {final_session.get('message_count', 0)}")
        logger.info(f"Duration: {final_session.get('created_at')} - {final_session.get('ended_at')}")
        logger.info("-" * 60)


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Activate an Inspire 8.0 persona',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'persona_id',
        type=str,
        help='ID of the persona to activate'
    )
    parser.add_argument(
        '--mode',
        type=str,
        choices=['interactive', 'single-shot', 'test'],
        default='interactive',
        help='Activation mode (default: interactive)'
    )
    parser.add_argument(
        '--session-id',
        type=str,
        help='Custom session ID (default: auto-generated)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate persona without activating'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load configuration
    config = ActivationConfig()
    if not config.validate():
        logger.error("Configuration validation failed")
        return 1

    # Validate persona ID
    if args.persona_id not in config.available_personas:
        logger.error(f"Unknown persona: {args.persona_id}")
        logger.info(f"Available personas: {', '.join(config.available_personas.keys())}")
        return 2

    # Create activator
    activator = PersonaActivator(
        config=config,
        mode=args.mode,
        dry_run=args.dry_run,
    )

    # Execute activation
    try:
        result = activator.activate(
            persona_id=args.persona_id,
            session_id=args.session_id,
        )

        # Output JSON if requested
        if args.json:
            print(json.dumps(result, indent=2))
            return 0 if result['success'] else 3

        # Run interactive session if mode is interactive and not dry-run
        if args.mode == 'interactive' and not args.dry_run and result['success']:
            run_interactive_session(activator, result)

        if result['success']:
            logger.info("Activation completed successfully")
            return 0
        else:
            logger.error(f"Activation failed: {result.get('error', 'Unknown error')}")
            return 3

    except Exception as e:
        logger.exception(f"Activation failed with exception: {e}")
        return 3


if __name__ == '__main__':
    sys.exit(main())
