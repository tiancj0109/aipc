"""Base model adapter - abstract interface for all LLM adapters."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
import time


@dataclass
class AdapterResponse:
    """Standardized response from any model adapter."""
    content: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0
    ttft_ms: int = 0  # Time to first token
    tps: float = 0.0  # Tokens per second
    error: Optional[str] = None
    raw_response: Optional[dict] = None


class BaseModelAdapter(ABC):
    """Abstract base class for model adapters.

    All adapters must implement the `chat_completion` method with a unified interface.
    """

    def __init__(self, api_endpoint: str, api_key: str, default_params: dict = None):
        self.api_endpoint = api_endpoint
        self.api_key = api_key
        self.default_params = default_params or {}

    @abstractmethod
    async def chat_completion(
        self,
        messages: list[dict],
        temperature: Optional[float] = None,
        max_tokens: int = 2048,
        **kwargs,
    ) -> AdapterResponse:
        """Send a chat completion request.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.

        Returns:
            AdapterResponse with content, token counts, and timing info.
        """
        pass

    async def health_check(self) -> bool:
        """Check if the model endpoint is reachable."""
        try:
            resp = await self.chat_completion(
                [{"role": "user", "content": "Hi"}],
                max_tokens=5,
            )
            return resp.error is None
        except Exception:
            return False
