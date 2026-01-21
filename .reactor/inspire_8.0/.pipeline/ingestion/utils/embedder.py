# =============================================================================
# EMBEDDING SERVICE
# =============================================================================
"""
Provides embedding generation using OpenAI's API.

Features:
- Batch processing with rate limiting
- Automatic retry with exponential backoff
- Progress callbacks
- Error handling and logging
"""

import os
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
from dataclasses import dataclass

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    openai = None


@dataclass
class EmbeddingResult:
    """Result of an embedding operation."""
    embeddings: List[List[float]]
    tokens_used: int
    errors: List[str]


class EmbeddingService:
    """
    Service for generating text embeddings using OpenAI.

    Implements rate limiting, batching, and retry logic.
    """

    def __init__(
        self,
        api_key: str = None,
        model: str = "text-embedding-3-large",
        dimensions: int = 1536,
        batch_size: int = 100,
        requests_per_minute: int = 3000,
        tokens_per_minute: int = 1000000,
        max_retries: int = 3,
    ):
        """
        Initialize the embedding service.

        Args:
            api_key: OpenAI API key (default: from OPENAI_API_KEY env)
            model: Embedding model to use
            dimensions: Vector dimensions
            batch_size: Number of texts per batch
            requests_per_minute: Rate limit for requests
            tokens_per_minute: Rate limit for tokens
            max_retries: Maximum retry attempts
        """
        if not OPENAI_AVAILABLE:
            raise ImportError(
                "openai is not installed. Install with: pip install openai"
            )

        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        self.model = model
        self.dimensions = dimensions
        self.batch_size = batch_size
        self.requests_per_minute = requests_per_minute
        self.tokens_per_minute = tokens_per_minute
        self.max_retries = max_retries

        # Initialize client
        self.client = openai.OpenAI(api_key=self.api_key)

        # Rate limiting state
        self._request_times: List[float] = []
        self._token_usage: List[Tuple[float, int]] = []

        # Stats
        self.total_requests = 0
        self.total_tokens = 0
        self.total_errors = 0

    def embed_single(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector or None on error
        """
        result = self.embed_batch([text])
        if result.embeddings:
            return result.embeddings[0]
        return None

    def embed_batch(
        self,
        texts: List[str],
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> EmbeddingResult:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of texts to embed
            progress_callback: Optional callback(current, total)

        Returns:
            EmbeddingResult with embeddings and stats
        """
        all_embeddings = []
        all_errors = []
        total_tokens = 0

        # Process in batches
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]

            # Wait for rate limits if needed
            self._wait_for_rate_limits()

            # Generate embeddings with retry
            embeddings, tokens, errors = self._embed_with_retry(batch)

            all_embeddings.extend(embeddings)
            total_tokens += tokens
            all_errors.extend(errors)

            # Update rate limiting state
            self._request_times.append(time.time())
            self._token_usage.append((time.time(), tokens))

            # Progress callback
            if progress_callback:
                progress_callback(min(i + self.batch_size, len(texts)), len(texts))

            # Small delay between batches
            if i + self.batch_size < len(texts):
                time.sleep(0.1)

        self.total_tokens += total_tokens
        self.total_requests += (len(texts) + self.batch_size - 1) // self.batch_size

        return EmbeddingResult(
            embeddings=all_embeddings,
            tokens_used=total_tokens,
            errors=all_errors
        )

    def _embed_with_retry(
        self,
        texts: List[str]
    ) -> Tuple[List[List[float]], int, List[str]]:
        """Embed texts with retry logic."""
        delay = 1.0
        errors = []

        for attempt in range(self.max_retries):
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=texts,
                    dimensions=self.dimensions
                )

                embeddings = [item.embedding for item in response.data]
                tokens = response.usage.total_tokens

                return embeddings, tokens, []

            except openai.RateLimitError as e:
                # Rate limit - wait and retry
                errors.append(f"Rate limit (attempt {attempt + 1}): {e}")
                time.sleep(delay)
                delay *= 2

            except openai.APIError as e:
                # API error - retry with backoff
                errors.append(f"API error (attempt {attempt + 1}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(delay)
                    delay *= 2

            except Exception as e:
                # Unexpected error
                errors.append(f"Unexpected error: {e}")
                self.total_errors += 1
                break

        # All retries failed - return empty embeddings
        self.total_errors += len(texts)
        return [[] for _ in texts], 0, errors

    def _wait_for_rate_limits(self):
        """Wait if rate limits would be exceeded."""
        now = time.time()

        # Clean old entries (older than 1 minute)
        self._request_times = [t for t in self._request_times if now - t < 60]
        self._token_usage = [(t, tok) for t, tok in self._token_usage if now - t < 60]

        # Check request rate
        if len(self._request_times) >= self.requests_per_minute:
            sleep_time = 60 - (now - self._request_times[0])
            if sleep_time > 0:
                time.sleep(sleep_time)

        # Check token rate
        recent_tokens = sum(tok for _, tok in self._token_usage)
        if recent_tokens >= self.tokens_per_minute:
            oldest_time = min(t for t, _ in self._token_usage)
            sleep_time = 60 - (now - oldest_time)
            if sleep_time > 0:
                time.sleep(sleep_time)

    def get_stats(self) -> Dict[str, Any]:
        """Get embedding service statistics."""
        return {
            "total_requests": self.total_requests,
            "total_tokens": self.total_tokens,
            "total_errors": self.total_errors,
            "model": self.model,
            "dimensions": self.dimensions,
        }
