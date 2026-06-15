import time
import json
import httpx
import logging
from typing import Optional
from app.adapters.base import BaseModelAdapter, AdapterResponse

logger = logging.getLogger(__name__)


class AnthropicAdapter(BaseModelAdapter):
    """Adapter for Anthropic Claude API."""

    async def chat_completion(
        self,
        messages: list[dict],
        temperature: Optional[float] = None,
        max_tokens: int = 2048,
        stream: bool = True,
        **kwargs,
    ) -> AdapterResponse:
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        # Convert OpenAI-style messages to Anthropic format
        system_msg = ""
        anthropic_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_msg = msg["content"]
            else:
                anthropic_messages.append(msg)

        model = self.default_params.get("model", "claude-3-sonnet-20240229")
        body = {
            "model": kwargs.get("model", model),
            "messages": anthropic_messages,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        if temperature is not None:
            body["temperature"] = temperature
        if system_msg:
            body["system"] = system_msg

        start = time.perf_counter()
        ttft_ms = 0
        full_content = []
        prompt_tokens = 0
        completion_tokens = 0
        last_data = {}

        timeout_val = kwargs.get("timeout", 120)
        try:
            async with httpx.AsyncClient(timeout=timeout_val) as client:
                if stream:
                    async with client.stream(
                        "POST",
                        f"{self.api_endpoint}/messages",
                        headers=headers,
                        json=body,
                    ) as response:
                        if response.status_code != 200:
                            text = await response.aread()
                            return AdapterResponse(
                                error=f"HTTP {response.status_code}: {text.decode('utf-8', errors='ignore')}",
                                latency_ms=int((time.perf_counter() - start) * 1000),
                            )

                        event_type = None
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if line.startswith("event: "):
                                event_type = line[7:]
                            elif line.startswith("data: "):
                                try:
                                    data = json.loads(line[6:])
                                    last_data = data
                                    
                                    if event_type == "message_start":
                                        usage = data.get("message", {}).get("usage", {})
                                        prompt_tokens = usage.get("input_tokens", prompt_tokens)
                                        logger.info(f"📊 Captured prompt usage: {prompt_tokens}")
                                    
                                    elif event_type == "content_block_delta":
                                        # Capture TTFT
                                        if not ttft_ms:
                                            ttft_ms = int((time.perf_counter() - start) * 1000)
                                            logger.info(f"🚀 Anthropic TTFT captured: {ttft_ms}ms")
                                        
                                        delta = data.get("delta", {})
                                        if delta.get("type") == "text_delta":
                                            full_content.append(delta.get("text", ""))
                                    
                                    elif event_type == "message_delta":
                                        usage = data.get("usage", {})
                                        completion_tokens = usage.get("output_tokens", completion_tokens)
                                        logger.info(f"📊 Captured completion usage: {completion_tokens}")
                                except Exception:
                                    continue
                else:
                    resp = await client.post(
                        f"{self.api_endpoint}/messages",
                        headers=headers,
                        json=body,
                    )
                    if resp.status_code != 200:
                        return AdapterResponse(
                            error=f"HTTP {resp.status_code}: {resp.text}",
                            latency_ms=int((time.perf_counter() - start) * 1000),
                        )
                    last_data = resp.json()
                    full_content = [c["text"] for c in last_data.get("content", []) if c.get("type") == "text"]
                    usage = last_data.get("usage", {})
                    prompt_tokens = usage.get("input_tokens", 0)
                    completion_tokens = usage.get("output_tokens", 0)

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
