"""Offline evaluation runner - orchestrates AI judge for offline data."""

import asyncio
import logging
import json
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.offline_judge import OfflineJudgeJob, OfflineJudgeResult
from app.models.model_registry import ModelRegistry
from app.engine.runner import get_adapter
from app.engine.evaluator import Evaluator
from app.adapters.base import BaseModelAdapter

logger = logging.getLogger(__name__)

DEFAULT_SCORE_PROMPT = """请作为一名客观、严谨的AI裁判，对大模型的回答进行全方位打分。

[用户原始问题]
{prompt}

[参考标准答案]
{reference_answer}

[待评分的模型回答]
{model_output}

请根据回答的正确性、完整性、清晰度进行评分，总分10分。
你必须返回严格的JSON格式，包含以下字段：
- score: 综合得分 (0-10的数字)
- dimension_scores: 各维度得分的JSON对象，包含 correctness, completeness, clarity 三个键，值均为0-10。
- reason: 评分理由说明

只返回JSON格式，不要包含任何其他文字或Markdown块标记。"""

DEFAULT_ACCURACY_PROMPT = """请作为一名严格的AI裁判，判断大模型的回答是否正确。

[用户原始问题]
{prompt}

[参考标准答案]
{reference_answer}

[待判定模型回答]
{model_output}

请判断该回答在核心事实上是否与标准答案一致。如果一致/正确返回1，错误返回0。
你必须返回严格的JSON格式，包含以下字段：
- score: 1 或 0 (数字)
- reason: 判定理由说明

只返回JSON格式，不要包含任何其他文字或Markdown标记。"""

DEFAULT_CHOICE_ACCURACY_PROMPT = """请作为一名严格的AI裁判，对择项题进行判定打分。

[用户原始问题]
{prompt}

[参考标准答案]
{reference_answer}

[待判定模型回答]
{model_output}

请按单选/多选题规则判定是否正确：
- 单选：模型答案与标准答案完全一致记 1，否则 0。
- 多选：模型答案集合与标准答案集合完全一致记 1，否则 0。

你必须返回严格的JSON格式，包含以下字段：
- score: 1 或 0 (数字)
- reason: 判定理由说明

只返回JSON格式，不要包含任何其他文字或Markdown标记。"""


class OfflineJudgeRunner:
    """Orchestrates the offline judge process for an uploaded job."""

    def __init__(self, db: Session, job: OfflineJudgeJob):
        self.db = db
        self.job = job
        self.config = job.config_snapshot or {}
        self.evaluator = Evaluator()

    async def run(self):
        """Run the batch AI judging."""
        self.job.status = "running"
        self.db.commit()

        try:
            judge_model_id = self.config.get("judge_model_id")
            scoring_mode = self.config.get("scoring_mode", "score")
            custom_prompt_template = self.config.get("custom_prompt")

            if not custom_prompt_template:
                custom_prompt_template = self._get_default_prompt(scoring_mode)

            judge_model = self.db.query(ModelRegistry).filter(ModelRegistry.id == judge_model_id).first()
            if not judge_model:
                raise ValueError(f"Judge model {judge_model_id} not found")

            adapter = get_adapter(judge_model)

            # Get pending results
            results = self.db.query(OfflineJudgeResult).filter(
                OfflineJudgeResult.job_id == self.job.id, 
                OfflineJudgeResult.score == None
            ).all()

            semaphore = asyncio.Semaphore(10)  # Moderate concurrency for AI judging

            async def process_result(result: OfflineJudgeResult):
                async with semaphore:
                    try:
                        rule_scored = self._try_rule_score(result, scoring_mode)
                        if rule_scored:
                            self.job.success_count += 1
                            self.job.processed_cases += 1
                            self.db.commit()
                            return
                        # Build prompt
                        prompt_text = custom_prompt_template.replace("{prompt}", result.prompt or "") \
                            .replace("{reference_answer}", result.reference_answer or "无") \
                            .replace("{model_output}", result.model_output or "")

                        messages = [{"role": "user", "content": prompt_text}]
                        response = await adapter.chat_completion(messages, temperature=0.1, max_tokens=1000)

                        if response.error:
                            result.error = response.error
                            self.job.failure_count += 1
                        else:
                            content = response.content.strip()
                            if content.startswith("```json"):
                                content = content[7:-3]
                            elif content.startswith("```"):
                                content = content[3:-3]

                            data = json.loads(content.strip())
                            result.score = float(data.get("score", 0.0))
                            result.reason = data.get("reason", "")
                            result.dimension_scores = data.get("dimension_scores")
                            result.judge_model = judge_model.name
                            self.job.success_count += 1
                    except Exception as e:
                        logger.error(f"Failed to score offline result {result.id}: {e}")
                        result.error = str(e)
                        self.job.failure_count += 1

                    self.job.processed_cases += 1
                    self.db.commit()

            tasks = [process_result(r) for r in results]
            await asyncio.gather(*tasks)

            # Calculate aggregates
            self.db.refresh(self.job)
            all_results = self.db.query(OfflineJudgeResult).filter(
                OfflineJudgeResult.job_id == self.job.id, 
                OfflineJudgeResult.score.isnot(None)
            ).all()
            
            if all_results:
                scores = [r.score for r in all_results]
                
                # Dimension scores aggregation
                dim_scores = {}
                for r in all_results:
                    if r.dimension_scores:
                        for dim, val in r.dimension_scores.items():
                            if dim not in dim_scores:
                                dim_scores[dim] = []
                            dim_scores[dim].append(val)
                dim_avg = {dim: round(sum(vals) / len(vals), 4) for dim, vals in dim_scores.items()}

                if scoring_mode in ("accuracy", "choice_accuracy"):
                    correct_count = sum(1 for s in scores if s >= 0.5)
                    self.job.accuracy_rate = correct_count / len(scores)
                else:
                    self.job.average_score = sum(scores) / len(scores)
                
                self.job.summary = {
                    "avg_score": round(self.job.average_score or 0, 4),
                    "accuracy_rate": round(self.job.accuracy_rate or 0, 4),
                    "dimension_scores": dim_avg,
                    "total_cases": len(all_results),
                }

            self.job.status = "completed"
            self.job.completed_at = datetime.utcnow()
            self.db.commit()

        except Exception as e:
            logger.error(f"Offline Judge Job {self.job.id} failed: {e}")
            self.job.status = "failed"
            self.db.commit()
            raise

    async def retry_failed(self):
        """Retry only failed or un-scored offline judgments."""
        self.job.status = "running"
        self.db.commit()

        try:
            judge_model_id = self.config.get("judge_model_id")
            scoring_mode = self.config.get("scoring_mode", "score")
            custom_prompt_template = self.config.get("custom_prompt")

            if not custom_prompt_template:
                custom_prompt_template = self._get_default_prompt(scoring_mode)

            judge_model = self.db.query(ModelRegistry).filter(ModelRegistry.id == judge_model_id).first()
            if not judge_model:
                raise ValueError(f"Judge model {judge_model_id} not found")

            adapter = get_adapter(judge_model)

            # Get ONLY failed or pending results
            results = self.db.query(OfflineJudgeResult).filter(
                OfflineJudgeResult.job_id == self.job.id,
                (OfflineJudgeResult.score.is_(None)) | (OfflineJudgeResult.error.isnot(None))
            ).all()

            semaphore = asyncio.Semaphore(10)

            async def process_result(result: OfflineJudgeResult):
                async with semaphore:
                    try:
                        rule_scored = self._try_rule_score(result, scoring_mode)
                        if rule_scored:
                            self.db.commit()
                            return
                        # Build prompt
                        prompt_text = custom_prompt_template.replace("{prompt}", result.prompt or "") \
                            .replace("{reference_answer}", result.reference_answer or "无") \
                            .replace("{model_output}", result.model_output or "")

                        messages = [{"role": "user", "content": prompt_text}]
                        response = await adapter.chat_completion(messages, temperature=0.1, max_tokens=1000)

                        if response.error:
                            result.error = response.error
                        else:
                            content = response.content.strip()
                            if content.startswith("```json"):
                                content = content[7:-3]
                            elif content.startswith("```"):
                                content = content[3:-3]

                            data = json.loads(content.strip())
                            result.score = float(data.get("score", 0.0))
                            result.reason = data.get("reason", "")
                            result.dimension_scores = data.get("dimension_scores")
                            result.judge_model = judge_model.name
                            result.error = None
                    except Exception as e:
                        logger.error(f"Failed to score offline result {result.id}: {e}")
                        result.error = str(e)
                        
                    self.db.commit()

            tasks = [process_result(r) for r in results]
            if tasks:
                await asyncio.gather(*tasks)

            # Recalculate aggregates and fix success_count/failure_count
            self.db.refresh(self.job)
            all_results = self.db.query(OfflineJudgeResult).filter(
                OfflineJudgeResult.job_id == self.job.id
            ).all()
            
            success_results = [r for r in all_results if r.score is not None and r.error is None]
            fail_results = [r for r in all_results if r.error is not None]
            
            self.job.success_count = len(success_results)
            self.job.failure_count = len(fail_results)
            self.job.processed_cases = len(success_results) + len(fail_results)

            if success_results:
                scores = [r.score for r in success_results]
                
                # Dimension scores aggregation
                dim_scores = {}
                for r in success_results:
                    if r.dimension_scores:
                        for dim, val in r.dimension_scores.items():
                            if dim not in dim_scores:
                                dim_scores[dim] = []
                            dim_scores[dim].append(val)
                dim_avg = {dim: round(sum(vals) / len(vals), 4) for dim, vals in dim_scores.items()}

                if scoring_mode in ("accuracy", "choice_accuracy"):
                    correct_count = sum(1 for s in scores if s >= 0.5)
                    self.job.accuracy_rate = correct_count / len(scores)
                else:
                    self.job.average_score = sum(scores) / len(scores)

                self.job.summary = {
                    "avg_score": round(self.job.average_score or 0, 4),
                    "accuracy_rate": round(self.job.accuracy_rate or 0, 4),
                    "dimension_scores": dim_avg,
                    "total_cases": len(all_results),
                }

            self.job.status = "completed"
            self.job.completed_at = datetime.utcnow()
            self.db.commit()

        except Exception as e:
            logger.error(f"Offline Judge Job {self.job.id} retry failed: {e}")
            self.job.status = "failed"
            self.db.commit()
            raise

    def _try_rule_score(self, result: OfflineJudgeResult, scoring_mode: str) -> bool:
        if not self.config.get("enable_objective_auto_score", True):
            return False
        if scoring_mode not in ("accuracy", "choice_accuracy"):
            return False
        reference = self._parse_reference_text(result.reference_answer)
        if not reference:
            return False
        if scoring_mode == "choice_accuracy" and not self._is_choice_reference(reference):
            return False
        if scoring_mode == "accuracy" and not self._is_binary_reference(reference):
            return False
        metadata = {}
        ignore_case = self.config.get("ignore_case", True)
        if isinstance(reference, dict):
            qtype = reference.get("type", reference.get("question_type"))
            if qtype:
                metadata["type"] = qtype
            if reference.get("options") is not None:
                metadata["options"] = reference.get("options")
        scoring = self.evaluator.score(
            output=result.model_output or "",
            reference=reference,
            metadata=metadata,
            ignore_case=ignore_case,
        )
        if scoring.get("score") is None:
            return False
        result.score = float(scoring.get("score", 0.0))
        meta = scoring.get("metadata") or {}
        result.reason = meta.get("reason", "规则自动判分")
        result.dimension_scores = scoring.get("dimension_scores")
        result.judge_model = "RULE_AUTO"
        result.error = None
        return True

    def _parse_reference_text(self, reference_text: str) -> dict:
        if reference_text is None:
            return {}
        text = str(reference_text).strip()
        if not text:
            return {}
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return {"answer": parsed}
            return {"answer": parsed}
        except Exception:
            return {"answer": text}

    def _get_default_prompt(self, scoring_mode: str) -> str:
        if scoring_mode == "choice_accuracy":
            return DEFAULT_CHOICE_ACCURACY_PROMPT
        if scoring_mode == "accuracy":
            return DEFAULT_ACCURACY_PROMPT
        return DEFAULT_SCORE_PROMPT

    def _is_choice_reference(self, reference: dict) -> bool:
        if not isinstance(reference, dict):
            return False
        qtype = str(reference.get("type", reference.get("question_type", ""))).lower()
        if qtype in {"single_choice", "multiple_choice", "choice", "mcq", "select", "单选", "多选"}:
            return True
        answer = reference.get("answer")
        if isinstance(answer, list):
            return True
        if isinstance(answer, str):
            answer_text = answer.strip().upper()
            if "," in answer_text or "，" in answer_text:
                return True
            return bool(answer_text and answer_text.isalpha())
        return False

    def _is_binary_reference(self, reference: dict) -> bool:
        if not isinstance(reference, dict):
            return False
        qtype = str(reference.get("type", reference.get("question_type", ""))).lower()
        if qtype in {"binary", "boolean", "true_false", "yes_no", "判断题", "二元判定", "对错"}:
            return True
        answer = reference.get("answer")
        if isinstance(answer, bool):
            return True
        text = str(answer).strip().lower()
        return text in {"0", "1", "true", "false", "yes", "no", "是", "否", "对", "错"}
