"""Evaluation runner - orchestrates model calls and scoring."""

import asyncio
import logging
from typing import Optional
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.model_registry import ModelRegistry
from app.models.test_case import TestCase
from app.models.evaluation_result import EvaluationResult
from app.models.evaluation_job import EvaluationJob
from app.adapters.base import BaseModelAdapter, AdapterResponse
from app.adapters.openai_adapter import OpenAIAdapter
from app.adapters.anthropic_adapter import AnthropicAdapter
from app.adapters.ollama_adapter import OllamaAdapter
from app.utils.crypto import decrypt_api_key
from app.utils.provider import resolve_adapter_provider
from app.engine.evaluator import Evaluator, strip_reasoning

logger = logging.getLogger(__name__)


def get_adapter(model: ModelRegistry) -> BaseModelAdapter:
    """Factory to create the appropriate adapter for a model."""
    api_key = decrypt_api_key(model.api_key_encrypted) if model.api_key_encrypted else ""
    params = model.default_params or {}

    adapter_map = {
        "openai": OpenAIAdapter,
        "anthropic": AnthropicAdapter,
        "ollama": OllamaAdapter,
    }

    adapter_provider = resolve_adapter_provider(model.provider)
    adapter_cls = adapter_map.get(adapter_provider)
    if adapter_cls is None:
        adapter_cls = OpenAIAdapter
    return adapter_cls(
        api_endpoint=model.api_endpoint,
        api_key=api_key,
        default_params=params,
    )


def calculate_cost(model: ModelRegistry, prompt_tokens: int, completion_tokens: int) -> Decimal:
    """Calculate request cost based on model pricing."""
    pricing = model.pricing or {}
    input_price = Decimal(str(pricing.get("input", 0)))  # per million tokens
    output_price = Decimal(str(pricing.get("output", 0)))
    cost = (Decimal(prompt_tokens) * input_price + Decimal(completion_tokens) * output_price) / Decimal(1_000_000)
    return cost


class EvaluationRunner:
    """Orchestrates the evaluation process for a job."""

    def __init__(self, db: Session, job: EvaluationJob):
        self.db = db
        self.job = job
        self.config = job.config_snapshot or {}
        self.evaluator = Evaluator()
        self.judge_adapters = []
        self.judge_models = []
        self.enable_warmup = self.config.get("enable_warmup", True)
        self.warmup_judge_models = self.config.get("warmup_judge_models", True)
        self.enable_objective_auto_score = self.config.get("enable_objective_auto_score", True)
        self.ignore_case = self.config.get("ignore_case", True)
        self._judge_warmed_up = False
        
        # Initialize judge adapters if AI judge is enabled
        if self.config.get("enable_ai_judge"):
            judge_ids = self.config.get("judge_model_ids", [])
            for j_id in judge_ids:
                j_model = self.db.query(ModelRegistry).filter(ModelRegistry.id == j_id).first()
                if j_model:
                    adapter = get_adapter(j_model)
                    adapter.model_name = j_model.name # Attach name for reference
                    self.judge_adapters.append(adapter)
                    self.judge_models.append(j_model)

    async def run(self):
        """Run the entire evaluation job."""
        model_ids = self.config.get("model_ids", [])
        prompt_template_ids = self.config.get("prompt_template_ids", [])
        if not prompt_template_ids:
            old_id = self.config.get("prompt_template_id")
            prompt_template_ids = [old_id] if old_id else [None]
        suite_id = self.config.get("suite_id")
        enable_temperature = self.config.get("enable_temperature", True)
        temperature = self.config.get("temperature") if enable_temperature else None
        if enable_temperature and temperature is None:
            temperature = 0.0
        max_tokens = self.config.get("max_tokens", 2048)
        seed = self.config.get("random_seed")
        enable_ai_judge = self.config.get("enable_ai_judge", False)
        enable_ttft = self.config.get("enable_ttft", True)
        timeout = self.config.get("timeout", 120)
        logger.info(f"🚀 Job {self.job.id} starting. enable_ttft={enable_ttft}, timeout={timeout}")

        concurrency = self.config.get("concurrency", 1)

        # Update job status
        self.job.status = "running"
        self.db.commit()

        # Get test cases
        cases = self.db.query(TestCase).filter(TestCase.suite_id == suite_id).all()

        try:
            for model_id in model_ids:
                for prompt_id in prompt_template_ids:
                    # Check if job was cancelled/paused
                    self.db.refresh(self.job)
                    if self.job.status in ("cancelled", "paused"):
                        logger.info(f"Job {self.job.id} is {self.job.status}, stopping.")
                        return

                    model = self.db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
                    if not model:
                        logger.warning(f"Model {model_id} not found, skipping.")
                        continue

                    adapter = get_adapter(model)

                    # Process cases with concurrency control
                    semaphore = asyncio.Semaphore(concurrency)

                    async def process_case(case: TestCase, p_id: Optional[int]):
                        async with semaphore:
                            return await self._evaluate_single(
                                adapter, model, case,
                                prompt_template_id=p_id,
                                temperature=temperature,
                                max_tokens=max_tokens,
                                seed=seed,
                                enable_ai_judge=enable_ai_judge,
                                enable_ttft=enable_ttft,
                                timeout=timeout,
                            )

                    # Check for existing results (for resume support)
                    filters = [
                        EvaluationResult.job_id == self.job.id,
                        EvaluationResult.model_id == model_id,
                    ]
                    if prompt_id is not None:
                        filters.append(EvaluationResult.prompt_template_id == prompt_id)
                    else:
                        filters.append(EvaluationResult.prompt_template_id.is_(None))
                        
                    existing = self.db.query(EvaluationResult.case_id).filter(*filters).all()
                    existing_ids = {r[0] for r in existing}
                    remaining = [c for c in cases if c.id not in existing_ids]
                    if self.enable_warmup and remaining:
                        await self._warmup_judge_adapters(timeout=timeout)
                        await self._warmup_model_adapter(
                            adapter=adapter,
                            model=model,
                            model_name=model.name,
                            case=remaining[0],
                            prompt_template_id=prompt_id,
                            timeout=timeout,
                        )

                    # Process in concurrent batches to check status more often
                    batch_size = concurrency
                    for i in range(0, len(remaining), batch_size):
                        self.db.refresh(self.job)
                        if self.job.status in ("cancelled", "paused"):
                            logger.info(f"Job {self.job.id} is {self.job.status} during batch processing, stopping.")
                            return
                        
                        batch = remaining[i : i + batch_size]
                        tasks = [process_case(case, prompt_id) for case in batch]
                        await asyncio.gather(*tasks)

            # Complete job
            self.db.refresh(self.job)
            if self.job.status == "running":
                self.job.status = "completed"
                from datetime import datetime
                now = datetime.utcnow()
                self.job.completed_at = now
                if self.job.last_started_at:
                    delta = (now - self.job.last_started_at).total_seconds()
                    self.job.duration_seconds = int((self.job.duration_seconds or 0) + delta)
                self.db.commit()

        except Exception as e:
            logger.error(f"Job {self.job.id} failed: {e}")
            self.job.status = "failed"
            self.db.commit()
            raise

    async def retry_failed(self):
        """Retry only failed test cases."""
        model_ids = self.config.get("model_ids", [])
        prompt_template_ids = self.config.get("prompt_template_ids", [])
        if not prompt_template_ids:
            old_id = self.config.get("prompt_template_id")
            prompt_template_ids = [old_id] if old_id else [None]
        
        suite_id = self.config.get("suite_id")
        enable_temperature = self.config.get("enable_temperature", True)
        temperature = self.config.get("temperature") if enable_temperature else None
        if enable_temperature and temperature is None:
            temperature = 0.0
        max_tokens = self.config.get("max_tokens", 2048)
        seed = self.config.get("random_seed")
        enable_ai_judge = self.config.get("enable_ai_judge", False)
        enable_ttft = self.config.get("enable_ttft", True)
        timeout = self.config.get("timeout", 120)
        concurrency = self.config.get("concurrency", 1)

        self.job.status = "running"
        self.db.commit()

        cases_map = {c.id: c for c in self.db.query(TestCase).filter(TestCase.suite_id == suite_id).all()}

        try:
            for model_id in model_ids:
                for prompt_id in prompt_template_ids:
                    self.db.refresh(self.job)
                    if self.job.status in ("cancelled", "paused"):
                        return

                    model = self.db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
                    if not model:
                        continue

                    adapter = get_adapter(model)
                    semaphore = asyncio.Semaphore(concurrency)

                    async def retry_case(result: EvaluationResult, case: TestCase, p_id: Optional[int]):
                        async with semaphore:
                            # We delete the old result and evaluate again
                            self.db.delete(result)
                            self.db.commit()
                            # decrease failure_count temporarily so it can be added back correctly later
                            self.job.failure_count = max(0, self.job.failure_count - 1)
                            self.job.processed_cases = max(0, self.job.processed_cases - 1)
                            self.db.commit()

                            return await self._evaluate_single(
                                adapter, model, case,
                                prompt_template_id=p_id,
                                temperature=temperature,
                                max_tokens=max_tokens,
                                seed=seed,
                                enable_ai_judge=enable_ai_judge,
                                enable_ttft=enable_ttft,
                                timeout=timeout,
                            )

                    filters = [
                        EvaluationResult.job_id == self.job.id,
                        EvaluationResult.model_id == model_id,
                        EvaluationResult.error.isnot(None)
                    ]
                    if prompt_id is not None:
                        filters.append(EvaluationResult.prompt_template_id == prompt_id)
                    else:
                        filters.append(EvaluationResult.prompt_template_id.is_(None))

                    failed_results = self.db.query(EvaluationResult).filter(*filters).all()
                    
                    # Process in concurrent batches
                    batch_size = concurrency
                    for i in range(0, len(failed_results), batch_size):
                        self.db.refresh(self.job)
                        if self.job.status in ("cancelled", "paused"):
                            return
                        
                        batch = failed_results[i : i + batch_size]
                        tasks = [retry_case(r, cases_map[r.case_id], prompt_id) for r in batch if r.case_id in cases_map]
                        if tasks:
                            await asyncio.gather(*tasks)

            self.db.refresh(self.job)
            if self.job.status == "running":
                self.job.status = "completed"
                from datetime import datetime
                now = datetime.utcnow()
                self.job.completed_at = now
                if self.job.last_started_at:
                    delta = (now - self.job.last_started_at).total_seconds()
                    self.job.duration_seconds = int((self.job.duration_seconds or 0) + delta)
                self.db.commit()

        except Exception as e:
            logger.error(f"Job {self.job.id} retry failed: {e}")
            self.job.status = "failed"
            self.db.commit()
            raise

    async def _evaluate_single(
        self,
        adapter: BaseModelAdapter,
        model: ModelRegistry,
        case: TestCase,
        prompt_template_id: Optional[int] = None,
        temperature: Optional[float] = None,
        max_tokens: int = 2048,
        seed: Optional[int] = None,
        enable_ai_judge: bool = False,
        enable_ttft: bool = True,
        timeout: int = 120,
    ):

        """Evaluate a single test case against a model."""
        prompt = self._build_prompt(case, prompt_template_id)

        messages = [{"role": "user", "content": prompt}]

        # Call model
        kwargs = {}
        if seed is not None:
            kwargs["seed"] = seed

        request_kwargs = {
            "max_tokens": max_tokens,
            "stream": enable_ttft,
            "timeout": timeout,
            **kwargs,
        }
        if temperature is not None:
            request_kwargs["temperature"] = temperature
        response = await adapter.chat_completion(messages, **request_kwargs)


        # Score the result
        auto_score = None
        auto_metadata = None
        dimension_scores = None
        judge_model_names = []

        if response.error is None:
            # 清洗推理/思考内容，只保留最终答案用于评分
            clean_output = strip_reasoning(response.content)
            ref = case.reference_answer
            meta = case.metadata_ or {}
            rule_result = self.evaluator.score(
                output=clean_output,
                reference=ref,
                metadata=meta,
                ignore_case=self.ignore_case,
            )
            use_rule_result = self.enable_objective_auto_score and rule_result.get("score") is not None
            if use_rule_result:
                scoring_result = rule_result
                auto_metadata = scoring_result.get("metadata") or {}
                auto_metadata["source"] = "rule_auto"
                auto_metadata["judges"] = ["RULE_AUTO"]
                dimension_scores = scoring_result.get("dimension_scores")
                judge_model_names = ["RULE_AUTO"]
            elif enable_ai_judge and getattr(self, "judge_adapters", None):
                q_type = meta.get("type", meta.get("question_type", ""))
                scoring_result = await self.evaluator.evaluate_with_ai(
                    output=clean_output,
                    reference=ref,
                    prompt=prompt,
                    judge_adapters=self.judge_adapters,
                    question_type=str(q_type) if q_type else "主观题",
                )
                judge_model_names = [a.model_name for a in self.judge_adapters]
                if auto_metadata is None: 
                    auto_metadata = scoring_result.get("metadata", {})
                auto_metadata["source"] = "ai_judge"
                auto_metadata["judges"] = judge_model_names
            else:
                scoring_result = {"score": None, "metadata": {"reason": "客观题自动判分未开启，且未启用AI裁判"}}
            
            auto_score = scoring_result.get("score")
            if auto_metadata is None:
                auto_metadata = scoring_result.get("metadata")
            if dimension_scores is None:
                dimension_scores = scoring_result.get("dimension_scores")

        # Calculate cost
        cost = calculate_cost(model, response.prompt_tokens, response.completion_tokens)

        # Determine review status
        require_review = self.config.get("require_human_review", False)
        if auto_score is None:
            review_status = "pending"
        else:
            review_status = "pending" if require_review else "reviewed"
        final_score = None if require_review else auto_score
        scored_by = "auto" if (auto_score is not None and not require_review) else None

        # Save result
        result = EvaluationResult(
            job_id=self.job.id,
            model_id=model.id,
            case_id=case.id,
            prompt_template_id=prompt_template_id,
            raw_output=response.content if response.error is None else None,
            auto_score=auto_score,
            auto_metadata=auto_metadata,
            judge_model=",".join(judge_model_names) if judge_model_names else None,
            dimension_scores=dimension_scores,
            final_score=final_score,
            scored_by=scored_by,
            review_status=review_status,
            latency_ms=response.latency_ms,
            ttft_ms=response.ttft_ms,
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            total_tokens=response.total_tokens,
            tps=response.tps,
            error=response.error,
            cost_usd=cost,
        )
        logger.info(f"💾 Saving result to DB: job_id={result.job_id}, model={model.name}, ttft={result.ttft_ms}ms, stream_flag={enable_ttft}")
        self.db.add(result)

        # Update job progress
        self.job.processed_cases += 1
        if response.error:
            self.job.failure_count += 1
        else:
            self.job.success_count += 1

        self.db.commit()

    def _build_prompt(self, case: TestCase, prompt_template_id: Optional[int]) -> str:
        prompt = case.prompt
        if prompt_template_id:
            from app.models.prompt_template import PromptTemplate
            template = self.db.query(PromptTemplate).filter(PromptTemplate.id == prompt_template_id).first()
            if template:
                try:
                    prompt = template.content.format(question=case.prompt)
                except (KeyError, IndexError):
                    prompt = template.content.replace("{question}", case.prompt)
        return prompt

    async def _warmup_judge_adapters(self, timeout: int):
        if self._judge_warmed_up:
            return
        if not self.enable_warmup or not self.warmup_judge_models:
            return
        if not self.config.get("enable_ai_judge", False):
            return
        if not self.judge_adapters:
            return
        for i, (judge_model, judge_adapter) in enumerate(zip(self.judge_models, self.judge_adapters)):
            judge_name = getattr(judge_adapter, "model_name", f"judge_{i + 1}")
            try:
                warmup_kwargs = {
                    "max_tokens": 16,
                    "stream": False,
                    "timeout": min(timeout, 60),
                }
                if self.config.get("enable_temperature", True):
                    warmup_kwargs["temperature"] = 0.0
                response = await judge_adapter.chat_completion(
                    [{"role": "user", "content": "请只回复：OK"}],
                    **warmup_kwargs,
                )
                if response.error:
                    logger.warning(f"🔥 [WARMUP][JUDGE] {judge_name} failed: {response.error}")
                else:
                    cost = calculate_cost(judge_model, response.prompt_tokens, response.completion_tokens)
                    self._record_warmup_cost(
                        kind="judge",
                        model_id=judge_model.id,
                        prompt_template_id=None,
                        cost_usd=cost,
                    )
                    logger.info(f"🔥 [WARMUP][JUDGE] {judge_name} done")
            except Exception as e:
                logger.warning(f"🔥 [WARMUP][JUDGE] {judge_name} exception: {e}")
        self._judge_warmed_up = True

    async def _warmup_model_adapter(
        self,
        adapter: BaseModelAdapter,
        model: ModelRegistry,
        model_name: str,
        case: TestCase,
        prompt_template_id: Optional[int],
        timeout: int,
    ):
        prompt = self._build_prompt(case, prompt_template_id)
        try:
            warmup_kwargs = {
                "max_tokens": 32,
                "stream": False,
                "timeout": min(timeout, 60),
            }
            if self.config.get("enable_temperature", True):
                warmup_kwargs["temperature"] = 0.0
            response = await adapter.chat_completion(
                [{"role": "user", "content": prompt}],
                **warmup_kwargs,
            )
            if response.error:
                logger.warning(f"🔥 [WARMUP][MODEL] {model_name} failed: {response.error}")
            else:
                cost = calculate_cost(model, response.prompt_tokens, response.completion_tokens)
                self._record_warmup_cost(
                    kind="model",
                    model_id=model.id,
                    prompt_template_id=prompt_template_id,
                    cost_usd=cost,
                )
                logger.info(f"🔥 [WARMUP][MODEL] {model_name} done")
        except Exception as e:
            logger.warning(f"🔥 [WARMUP][MODEL] {model_name} exception: {e}")

    def _record_warmup_cost(
        self,
        kind: str,
        model_id: int,
        prompt_template_id: Optional[int],
        cost_usd: Decimal,
    ):
        snapshot = self.job.config_snapshot or {}
        warmup_costs = snapshot.get("warmup_costs")
        if not isinstance(warmup_costs, dict):
            warmup_costs = {}
        model_costs = warmup_costs.get("model")
        if not isinstance(model_costs, dict):
            model_costs = {}
        judge_costs = warmup_costs.get("judge")
        if not isinstance(judge_costs, dict):
            judge_costs = {}

        prompt_key = "none" if prompt_template_id is None else str(prompt_template_id)
        storage_key = f"{model_id}:{prompt_key}"
        amount = float(round(cost_usd, 8))

        if kind == "model":
            model_costs[storage_key] = round(float(model_costs.get(storage_key, 0.0)) + amount, 8)
        else:
            judge_costs[str(model_id)] = round(float(judge_costs.get(str(model_id), 0.0)) + amount, 8)

        warmup_total = round(sum(model_costs.values()) + sum(judge_costs.values()), 8)
        warmup_costs["model"] = model_costs
        warmup_costs["judge"] = judge_costs
        warmup_costs["total_cost_usd"] = warmup_total
        snapshot["warmup_costs"] = warmup_costs
        self.job.config_snapshot = snapshot
        flag_modified(self.job, "config_snapshot")
        self.db.commit()
