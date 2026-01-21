# =============================================================================
# ROUTED EXECUTOR
# =============================================================================
"""
Pre-execution routing integration for the Inspire 8.0 pipeline.

This module provides the integration layer that enforces model routing
as a MANDATORY pre-execution step. Every message must be routed before
execution to ensure:
1. Consistent behavior
2. Predictable costs
3. Intentional use of higher-capability models

CRITICAL: The execute() function is the ONLY approved entry point for
executing user messages. Direct model calls bypass routing and violate
the cost optimization policy.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from .router import (
    ModelRouter,
    RoutingDecision,
    RoutingConfig,
    get_model_router,
)
from .models import (
    ModelTier,
    get_model_for_tier,
)
from .classifier import (
    IntentCategory,
    ComplexityLevel,
    RiskLevel,
)

logger = logging.getLogger(__name__)


# =============================================================================
# EXECUTION RESULT
# =============================================================================

@dataclass
class ExecutionResult:
    """
    Result of a routed execution.

    This captures both the routing decision and the execution outcome.
    """
    # Routing information
    routing_decision: Optional[RoutingDecision] = None

    # Execution result
    success: bool = False
    response: str = ""
    error: Optional[str] = None

    # Execution metadata
    model_used: str = ""
    executed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    execution_time_ms: float = 0.0

    # Token usage (if available)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    # Cost tracking
    estimated_cost: float = 0.0
    cost_tier: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "routing": self.routing_decision.to_dict() if self.routing_decision else None,
            "execution": {
                "success": self.success,
                "response_length": len(self.response) if self.response else 0,
                "error": self.error,
                "model_used": self.model_used,
                "executed_at": self.executed_at,
                "execution_time_ms": self.execution_time_ms,
            },
            "tokens": {
                "prompt": self.prompt_tokens,
                "completion": self.completion_tokens,
                "total": self.total_tokens,
            },
            "cost": {
                "estimated": self.estimated_cost,
                "tier": self.cost_tier,
            },
        }


# =============================================================================
# EXECUTION HOOKS
# =============================================================================

@dataclass
class ExecutionHooks:
    """
    Hooks for customizing execution behavior.

    These allow integration with different LLM providers and
    custom pre/post processing.
    """
    # Pre-execution hook (called before LLM call)
    pre_execute: Optional[Callable[[str, RoutingDecision], str]] = None

    # Post-execution hook (called after LLM call)
    post_execute: Optional[Callable[[str, ExecutionResult], str]] = None

    # Model call implementation (required for actual execution)
    call_model: Optional[Callable[[str, str, Dict], str]] = None


# =============================================================================
# ROUTED EXECUTOR
# =============================================================================

class RoutedExecutor:
    """
    Executes user messages with mandatory pre-execution routing.

    This is the primary execution interface for the Inspire 8.0 pipeline.
    Every message is routed BEFORE execution to determine the appropriate
    model tier.

    USAGE:
        executor = RoutedExecutor()
        result = executor.execute(
            message="What is the meaning of John 3:16?",
            persona_name="jubilee",
            context=activation_context,
        )

    The executor enforces:
    1. Routing is MANDATORY (cannot be bypassed)
    2. Model selection is DETERMINISTIC
    3. All executions are logged for audit
    """

    def __init__(
        self,
        router: ModelRouter = None,
        hooks: ExecutionHooks = None,
    ):
        """
        Initialize the executor.

        Args:
            router: Model router (uses global if not provided)
            hooks: Execution hooks for customization
        """
        self.router = router or get_model_router()
        self.hooks = hooks or ExecutionHooks()

        # Statistics
        self._stats = {
            "total_executions": 0,
            "by_tier": {tier.value: 0 for tier in ModelTier},
            "total_tokens": 0,
            "total_cost": 0.0,
        }

    def execute(
        self,
        message: str,
        persona_name: str = None,
        context: Dict[str, Any] = None,
        system_prompt: str = None,
        **kwargs,
    ) -> ExecutionResult:
        """
        Execute a user message with mandatory routing.

        This is the ONLY approved method for executing user messages.
        It enforces routing as a pre-execution step.

        Args:
            message: The user's message
            persona_name: Optional persona name for routing context
            context: Optional additional context
            system_prompt: The system prompt to use
            **kwargs: Additional arguments passed to model call

        Returns:
            ExecutionResult with routing decision and response
        """
        start_time = datetime.now()
        result = ExecutionResult()

        # Build routing context
        routing_context = context or {}
        if persona_name:
            routing_context["persona_name"] = persona_name

        # STEP 1: MANDATORY ROUTING
        logger.info("Executing pre-execution routing...")
        routing_decision = self.router.route(message, routing_context)
        result.routing_decision = routing_decision
        result.model_used = routing_decision.model_id
        result.cost_tier = routing_decision.tier.value

        logger.info(
            f"Routed to {routing_decision.tier.value} tier: {routing_decision.model_id}"
        )

        # STEP 2: PRE-EXECUTE HOOK
        processed_message = message
        if self.hooks.pre_execute:
            processed_message = self.hooks.pre_execute(message, routing_decision)

        # STEP 3: EXECUTE
        try:
            if self.hooks.call_model:
                # Use provided model call implementation
                response = self.hooks.call_model(
                    processed_message,
                    routing_decision.model_id,
                    {
                        "system_prompt": system_prompt,
                        "persona_name": persona_name,
                        **kwargs,
                    }
                )
                result.response = response
                result.success = True
            else:
                # No model call implementation - return routing info only
                logger.warning(
                    "No call_model hook provided. Returning routing decision only."
                )
                result.response = f"[ROUTING ONLY] Would use model: {routing_decision.model_id}"
                result.success = True

        except Exception as e:
            result.success = False
            result.error = str(e)
            logger.error(f"Execution failed: {e}")

        # STEP 4: POST-EXECUTE HOOK
        if self.hooks.post_execute and result.success:
            result.response = self.hooks.post_execute(result.response, result)

        # STEP 5: CALCULATE TIMING
        end_time = datetime.now()
        result.execution_time_ms = (end_time - start_time).total_seconds() * 1000

        # STEP 6: UPDATE STATS
        self._update_stats(result)

        return result

    def route_only(
        self,
        message: str,
        context: Dict[str, Any] = None,
    ) -> RoutingDecision:
        """
        Route a message without executing.

        Useful for previewing routing decisions or batch classification.

        Args:
            message: The user's message
            context: Optional context

        Returns:
            RoutingDecision
        """
        return self.router.route(message, context)

    def _update_stats(self, result: ExecutionResult):
        """Update execution statistics."""
        self._stats["total_executions"] += 1
        self._stats["by_tier"][result.cost_tier] += 1
        self._stats["total_tokens"] += result.total_tokens

    def get_statistics(self) -> Dict[str, Any]:
        """Get execution statistics."""
        return self._stats.copy()

    def reset_statistics(self):
        """Reset execution statistics."""
        self._stats = {
            "total_executions": 0,
            "by_tier": {tier.value: 0 for tier in ModelTier},
            "total_tokens": 0,
            "total_cost": 0.0,
        }


# =============================================================================
# ROUTING GUARD
# =============================================================================

class RoutingGuard:
    """
    A guard that ensures all executions go through routing.

    This can be used to wrap existing code and enforce routing
    without major refactoring.

    USAGE:
        guard = RoutingGuard()

        @guard.require_routing
        def my_function(message: str, **kwargs):
            # This function can only be called if routing was done
            pass
    """

    def __init__(self, router: ModelRouter = None):
        """Initialize the guard."""
        self.router = router or get_model_router()
        self._routing_context = {}

    def route_and_execute(
        self,
        message: str,
        execute_fn: Callable,
        context: Dict[str, Any] = None,
        **kwargs,
    ) -> Any:
        """
        Route a message and execute a function with the routing decision.

        Args:
            message: The user's message
            execute_fn: Function to execute (receives routing_decision as first arg)
            context: Optional context
            **kwargs: Additional arguments passed to execute_fn

        Returns:
            Whatever execute_fn returns
        """
        # Route first
        decision = self.router.route(message, context)

        # Store in context for any nested calls
        self._routing_context = {
            "decision": decision,
            "message": message,
        }

        try:
            # Execute with routing decision
            return execute_fn(decision, message, **kwargs)
        finally:
            # Clear context
            self._routing_context = {}

    def get_current_routing(self) -> Optional[RoutingDecision]:
        """Get the current routing decision (if any)."""
        return self._routing_context.get("decision")

    def require_routing(self, fn: Callable) -> Callable:
        """
        Decorator that ensures routing has been done.

        Raises:
            RuntimeError: If called without prior routing
        """
        def wrapper(*args, **kwargs):
            if not self._routing_context:
                raise RuntimeError(
                    "This function requires prior routing. "
                    "Use route_and_execute() or ensure routing is done first."
                )
            return fn(*args, **kwargs)
        return wrapper


# =============================================================================
# GLOBAL EXECUTOR INSTANCE
# =============================================================================

_global_executor: Optional[RoutedExecutor] = None


def get_routed_executor() -> RoutedExecutor:
    """Get the global routed executor."""
    global _global_executor
    if _global_executor is None:
        _global_executor = RoutedExecutor()
    return _global_executor


def set_routed_executor(executor: RoutedExecutor):
    """Set the global routed executor."""
    global _global_executor
    _global_executor = executor


def reset_routed_executor():
    """Reset the global routed executor."""
    global _global_executor
    _global_executor = None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def execute_with_routing(
    message: str,
    persona_name: str = None,
    context: Dict[str, Any] = None,
    **kwargs,
) -> ExecutionResult:
    """
    Convenience function for routed execution.

    Args:
        message: The user's message
        persona_name: Optional persona name
        context: Optional context
        **kwargs: Additional arguments

    Returns:
        ExecutionResult
    """
    return get_routed_executor().execute(
        message=message,
        persona_name=persona_name,
        context=context,
        **kwargs,
    )
