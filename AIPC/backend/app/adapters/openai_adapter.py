import time
import json
import httpx
import logging
from typing import Optional
from app.adapters.base import BaseModelAdapter, AdapterResponse

logger = logging.getLogger(__name__)


class OpenAIAdapter(BaseModelAdapter):
    """Adapter for OpenAI and OpenAI-compatible APIs (e.g., vLLM, LiteLLM)."""

    @staticmethod
    def _should_retry_with_fixed_temperature(error_text: str) -> bool:
        lower_text = (error_text or "").lower()
        has_temperature = "temperature" in lower_text or "温度" in lower_text
        requires_one = any(
            marker in lower_text
            for marker in (
                "only 1 is allowed",
                "must be 1",
                "fixed temperature",
                "only supports 1",
                "仅支持1",
                "只能为1",
            )
        )
        return has_temperature and requires_one

    @staticmethod
    def _parse_stream_line(line: str) -> tuple[dict | None, bool]:
        stripped = (line or "").strip()
        if not stripped:
            return None, False
        if stripped.startswith(":") or stripped.startswith("event:"):
            return None, False
        payload = stripped
        if stripped.startswith("data:"):
            payload = stripped[5:].lstrip()
        if payload == "[DONE]":
            return None, True
        try:
            data = json.loads(payload)
        except Exception:
            return None, False
        if not isinstance(data, dict):
            return None, False
        choices = data.get("choices") or []
        if choices and isinstance(choices[0], dict):
            finish_reason = choices[0].get("finish_reason")
            if isinstance(finish_reason, str) and finish_reason.lower() == "stop":
                return data, True
        return data, False

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
            "Authorization": f"Bearer {self.api_key}",
        }

        model = self.default_params.get("model", "gpt-4")
        body = {
            "model": kwargs.get("model", model),
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        if temperature is not None:
            body["temperature"] = temperature

        if stream:
            body["stream_options"] = {"include_usage": True}

        if seed := kwargs.get("seed"):
            body["seed"] = seed

        start = time.perf_counter()
        ttft_ms = 0
        full_content = []
        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0
        last_data = {}

        timeout_val = kwargs.get("timeout", 120)
        try:
            async with httpx.AsyncClient(timeout=timeout_val) as client:
                for attempt in range(2):
                    if stream:
                        async with client.stream(
                            "POST",
                            f"{self.api_endpoint}/chat/completions",
                            headers=headers,
                            json=body,
                        ) as response:
                            if response.status_code != 200:
                                text = await response.aread()
                                error_text = text.decode("utf-8", errors="ignore")
                                if (
                                    attempt == 0
                                    and body.get("temperature") != 1
                                    and self._should_retry_with_fixed_temperature(error_text)
                                ):
                                    body["temperature"] = 1
                                    logger.warning("OpenAI model requires fixed temperature=1, retrying once.")
                                    continue
                                return AdapterResponse(
                                    error=f"HTTP {response.status_code}: {error_text}",
                                    latency_ms=int((time.perf_counter() - start) * 1000),
                                )

                            async for line in response.aiter_lines():
                                data, should_stop = self._parse_stream_line(line)
                                if data:
                                    last_data = data
                                    choices = data.get("choices") or []
                                    if choices and isinstance(choices[0], dict):
                                        delta = choices[0].get("delta", {}) or {}
                                        if not ttft_ms and isinstance(delta.get("content"), str):
                                            ttft_ms = int((time.perf_counter() - start) * 1000)
                                            logger.info(f"🚀 OpenAI TTFT captured: {ttft_ms}ms")
                                        if isinstance(delta.get("content"), str) and delta.get("content"):
                                            full_content.append(delta["content"])
                                    if "usage" in data and data["usage"]:
                                        usage = data["usage"]
                                        prompt_tokens = usage.get("prompt_tokens", prompt_tokens)
                                        completion_tokens = usage.get("completion_tokens", completion_tokens)
                                        total_tokens = usage.get("total_tokens", total_tokens)
                                        logger.info(f"📊 Captured usage in stream: {usage}")
                                if should_stop:
                                    break
                            break
                    else:
                        resp = await client.post(
                            f"{self.api_endpoint}/chat/completions",
                            headers=headers,
                            json=body,
                        )
                        if resp.status_code != 200:
                            if (
                                attempt == 0
                                and body.get("temperature") != 1
                                and self._should_retry_with_fixed_temperature(resp.text)
                            ):
                                body["temperature"] = 1
                                logger.warning("OpenAI model requires fixed temperature=1, retrying once.")
                                continue
                            return AdapterResponse(
                                error=f"HTTP {resp.status_code}: {resp.text}",
                                latency_ms=int((time.perf_counter() - start) * 1000),
                            )
                        last_data = resp.json()
                        full_content = [last_data["choices"][0]["message"]["content"]]
                        usage = last_data.get("usage", {})
                        prompt_tokens = usage.get("prompt_tokens", 0)
                        completion_tokens = usage.get("completion_tokens", 0)
                        total_tokens = usage.get("total_tokens", 0)
                        break

                elapsed = int((time.perf_counter() - start) * 1000)
                content = "".join(full_content)
                
                # Fallback for usage if missing in stream
                if not total_tokens and last_data.get("usage"):
                    usage = last_data["usage"]
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    total_tokens = usage.get("total_tokens", 0)

                return AdapterResponse(
                    content=content,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    latency_ms=elapsed,
                    ttft_ms=ttft_ms,
                    tps=completion_tokens / (elapsed / 1000) if elapsed > 0 else 0,
                    raw_response=last_data,
                )
        except Exception as e:
            elapsed = int((time.perf_counter() - start) * 1000)
            return AdapterResponse(error=str(e), latency_ms=elapsed)
