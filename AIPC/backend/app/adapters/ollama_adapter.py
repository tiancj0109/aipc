import time
import json
import httpx
import logging
from typing import Optional
from app.adapters.base import BaseModelAdapter, AdapterResponse

logger = logging.getLogger(__name__)


class OllamaAdapter(BaseModelAdapter):
    """Adapter for Ollama locally deployed models."""

    async def chat_completion(
        self,
        messages: list[dict],
        temperature: Optional[float] = None,
        max_tokens: int = 2048,
        stream: bool = True,
        **kwargs,
    ) -> AdapterResponse:
        model = self.default_params.get("model", "llama3")
        body = {
            "model": kwargs.get("model", model),
            "messages": messages,
            "stream": stream,
            "options": {
                "num_predict": max_tokens,
            },
        }
        if temperature is not None:
            body["options"]["temperature"] = temperature

        start = time.perf_counter()
        ttft_ms = 0
        full_content = []
        prompt_tokens = 0
        completion_tokens = 0
        last_data = {}

        timeout_val = kwargs.get("timeout", 300)
        try:
            async with httpx.AsyncClient(timeout=timeout_val) as client:
                if stream:
                    async with client.stream(
                        "POST",
                        f"{self.api_endpoint}/api/chat",
                        json=body,
                    ) as response:
                        if response.status_code != 200:
                            text = await response.aread()
                            return AdapterResponse(
                                error=f"HTTP {response.status_code}: {text.decode('utf-8', errors='ignore')}",
                                latency_ms=int((time.perf_counter() - start) * 1000),
                            )

                        async for line in response.aiter_lines():
                            if not line.strip():
                                continue
                            try:
                                data = json.loads(line)
                                last_data = data
                                
                                # Capture TTFT
                                if not ttft_ms and ("message" in data or "response" in data):
                                    ttft_ms = int((time.perf_counter() - start) * 1000)
                                    logger.info(f"🚀 Ollama TTFT captured: {ttft_ms}ms")
                                
                                if "message" in data and data["message"].get("content"):
                                    full_content.append(data["message"]["content"])
                                
                                if data.get("done"):
                                    prompt_tokens = data.get("prompt_eval_count", prompt_tokens)
                                    completion_tokens = data.get("eval_count", completion_tokens)
                                    logger.info(f"📊 Captured usage in stream: prompt={prompt_tokens}, completion={completion_tokens}")
                            except Exception:
                                continue
                else:
                    resp = await client.post(
                        f"{self.api_endpoint}/api/chat",
                        json=body,
                    )
                    if resp.status_code != 200:
                        return AdapterResponse(
                            error=f"HTTP {resp.status_code}: {resp.text}",
                            latency_ms=int((time.perf_counter() - start) * 1000),
                        )
                    last_data = resp.json()
                    full_content = [last_data.get("message", {}).get("content", "")]
                    prompt_tokens = last_data.get("prompt_eval_count", 0)
                    completion_tokens = last_data.get("eval_count", 0)

                elapsed = int((time.perf_counter() - start) * 1000)
                content = "".join(full_content)

                return AdapterResponse(
                    content=content,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    latency_ms=elapsed,
                    ttft_ms=ttft_ms,
                    tps=completion_tokens / (elapsed / 1000) if elapsed > 0 else 0,
                    raw_response=last_data,
                )
        except Exception as e:
            elapsed = int((time.perf_counter() - start) * 1000)
            return AdapterResponse(error=str(e), latency_ms=elapsed)
