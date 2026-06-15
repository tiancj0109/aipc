"""Celery task definitions for async evaluation."""

import asyncio
import logging
from celery import Celery
from celery.signals import worker_ready
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "aipc",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    worker_hijack_root_logger=False,
)

from app.utils.logging_handler import setup_redis_logging

logger = logging.getLogger(__name__)

# Initialize Redis logging for worker
setup_redis_logging(settings.REDIS_URL, source="worker")


@worker_ready.connect(sender=celery_app)
def on_worker_ready(**kwargs):
    logger.info("Worker ready: log stream connected")


@celery_app.task(bind=True, name="aipc.run_evaluation_job", max_retries=3)
def run_evaluation_job(self, job_id: int):
    """Celery task to run an evaluation job asynchronously."""
    from app.database import SessionLocal
    from app.models.evaluation_job import EvaluationJob
    from app.engine.runner import EvaluationRunner

    db = SessionLocal()
    logger.info(f"Worker start: run_evaluation_job {job_id} [VERIFIED_1912]")
    try:
        job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return {"error": f"Job {job_id} not found"}

        if job.status == "cancelled":
            logger.info(f"Job {job_id} already cancelled")
            return {"status": "cancelled"}

        runner = EvaluationRunner(db, job)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(runner.run())
        finally:
            loop.close()

        # Generate aggregated report after completion
        _generate_report(db, job)

        return {"status": "completed", "job_id": job_id}

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
        if job and job.status == "running":
            job.status = "failed"
            db.commit()
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task(bind=True, name="aipc.retry_evaluation_job", max_retries=3)
def retry_evaluation_job(self, job_id: int):
    """Celery task to retry failed evaluation job permutations asynchronously."""
    from app.database import SessionLocal
    from app.models.evaluation_job import EvaluationJob
    from app.engine.runner import EvaluationRunner

    db = SessionLocal()
    logger.info(f"Worker start: retry_evaluation_job {job_id}")
    try:
        job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return {"error": f"Job {job_id} not found"}

        if job.status == "cancelled":
            logger.info(f"Job {job_id} already cancelled")
            return {"status": "cancelled"}

        runner = EvaluationRunner(db, job)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(runner.retry_failed())
        finally:
            loop.close()

        # Generate aggregated report after completion
        _generate_report(db, job)

        return {"status": "completed", "job_id": job_id}

    except Exception as e:
        logger.error(f"Job {job_id} retry failed: {e}")
        job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
        if job and job.status == "running":
            job.status = "failed"
            db.commit()
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


def _generate_report(db, job):
    """Generate aggregated reports after job completion, grouped by model and prompt template."""
    from sqlalchemy import func as sql_func
    from app.models.evaluation_result import EvaluationResult
    from app.models.aggregated_report import AggregatedReport
    from app.models.leaderboard import Leaderboard
    from app.models.test_case import TestCase

    def _normalize_qtype(value):
        text = str(value or "").strip().lower()
        if text in {"single_choice", "single", "singlechoice", "单选", "单选题"}:
            return "single_choice"
        if text in {"multiple_choice", "multiple", "multi_choice", "mcq", "多选", "多选题"}:
            return "multiple_choice"
        if text in {"binary", "boolean", "true_false", "yes_no", "判断题", "二元判定", "对错", "是非题"}:
            return "binary"
        if text in {"subjective", "open", "主观题", "主观"}:
            return "subjective"
        return ""

    def _detect_qtype(case_obj):
        meta = case_obj.metadata_ if isinstance(case_obj.metadata_, dict) else {}
        ref = case_obj.reference_answer if isinstance(case_obj.reference_answer, dict) else {}
        qtype = _normalize_qtype(meta.get("type") or meta.get("question_type") or ref.get("type") or ref.get("question_type"))
        if qtype:
            return qtype
        answer = ref.get("answer")
        if isinstance(answer, bool):
            return "binary"
        if isinstance(answer, list):
            return "multiple_choice"
        answer_text = str(answer or "").strip()
        if answer_text:
            normalized = answer_text.lower()
            if normalized in {"0", "1", "true", "false", "yes", "no", "是", "否", "对", "错"}:
                return "binary"
            if any(sep in answer_text for sep in [",", "，", ";", "；", "/", "、"]):
                return "multiple_choice"
            if len(answer_text) == 1 and answer_text.isalpha():
                return "single_choice"
        return "subjective"

    # Find all unique combinations of model_id and prompt_template_id in this job
    combinations = db.query(
        EvaluationResult.model_id, 
        EvaluationResult.prompt_template_id
    ).filter(
        EvaluationResult.job_id == job.id
    ).distinct().all()
    combo_count = len(combinations) if combinations else 1
    config = job.config_snapshot or {}
    warmup_costs = config.get("warmup_costs", {}) if isinstance(config.get("warmup_costs", {}), dict) else {}
    model_warmup_costs = warmup_costs.get("model", {}) if isinstance(warmup_costs.get("model", {}), dict) else {}
    judge_warmup_costs = warmup_costs.get("judge", {}) if isinstance(warmup_costs.get("judge", {}), dict) else {}
    judge_warmup_total = float(sum(float(v) for v in judge_warmup_costs.values())) if judge_warmup_costs else 0.0
    judge_share_per_combo = judge_warmup_total / combo_count if combo_count > 0 else 0.0

    for model_id, prompt_id in combinations:
        filters = [
            EvaluationResult.job_id == job.id,
            EvaluationResult.model_id == model_id,
        ]
        if prompt_id is not None:
            filters.append(EvaluationResult.prompt_template_id == prompt_id)
        else:
            filters.append(EvaluationResult.prompt_template_id.is_(None))

        results = db.query(EvaluationResult).filter(*filters).all()

        if not results:
            continue

        case_ids = list({r.case_id for r in results if r.case_id is not None})
        cases = db.query(TestCase).filter(TestCase.id.in_(case_ids)).all() if case_ids else []
        case_map = {c.id: c for c in cases}

        # Effect summary
        scores = [r.final_score for r in results if r.final_score is not None]

        # Dimension scores aggregation
        dim_scores = {}
        for r in results:
            if r.dimension_scores:
                for dim, val in r.dimension_scores.items():
                    if dim not in dim_scores:
                        dim_scores[dim] = []
                    dim_scores[dim].append(val)

        dim_avg = {dim: sum(vals) / len(vals) for dim, vals in dim_scores.items()}

        objective_groups = {
            "single_choice": {"total_cases": 0, "scored_cases": 0, "correct_cases": 0},
            "multiple_choice": {"total_cases": 0, "scored_cases": 0, "correct_cases": 0},
            "binary": {"total_cases": 0, "scored_cases": 0, "correct_cases": 0},
        }
        subjective_total = 0
        subjective_scored = 0
        subjective_sum = 0.0

        for result in results:
            case_obj = case_map.get(result.case_id)
            qtype = _detect_qtype(case_obj) if case_obj else "subjective"
            effective_score = result.final_score if result.final_score is not None else result.auto_score
            if qtype in objective_groups:
                group = objective_groups[qtype]
                group["total_cases"] += 1
                if effective_score is not None:
                    group["scored_cases"] += 1
                    if float(effective_score) >= 0.5:
                        group["correct_cases"] += 1
            else:
                subjective_total += 1
                if effective_score is not None:
                    subjective_scored += 1
                    subjective_sum += float(effective_score)

        objective_overall_total = sum(v["total_cases"] for v in objective_groups.values())
        objective_overall_scored = sum(v["scored_cases"] for v in objective_groups.values())
        objective_overall_correct = sum(v["correct_cases"] for v in objective_groups.values())

        objective_breakdown = {}
        for key, val in objective_groups.items():
            objective_breakdown[key] = {
                "total_cases": val["total_cases"],
                "scored_cases": val["scored_cases"],
                "correct_cases": val["correct_cases"],
                "accuracy": round(val["correct_cases"] / val["scored_cases"], 4) if val["scored_cases"] > 0 else None,
            }
        objective_breakdown["overall"] = {
            "total_cases": objective_overall_total,
            "scored_cases": objective_overall_scored,
            "correct_cases": objective_overall_correct,
            "accuracy": round(objective_overall_correct / objective_overall_scored, 4) if objective_overall_scored > 0 else None,
        }

        subjective_summary = {
            "total_cases": subjective_total,
            "scored_cases": subjective_scored,
            "avg_score": round(subjective_sum / subjective_scored, 4) if subjective_scored > 0 else None,
        }

        objective_accuracy = objective_breakdown["overall"]["accuracy"]
        subjective_avg = subjective_summary["avg_score"]
        if objective_accuracy is not None and subjective_avg is not None:
            avg_score = ((float(objective_accuracy) * 10.0) + float(subjective_avg)) / 2.0
        elif objective_accuracy is not None:
            avg_score = float(objective_accuracy) * 10.0
        elif subjective_avg is not None:
            avg_score = float(subjective_avg)
        else:
            effective_scores = [
                (r.final_score if r.final_score is not None else r.auto_score)
                for r in results
                if (r.final_score is not None or r.auto_score is not None)
            ]
            avg_score = (sum(float(s) for s in effective_scores) / len(effective_scores)) if effective_scores else 0.0

        summary = {
            "avg_score": round(avg_score, 4),
            "total_cases": len(results),
            "scored_cases": objective_overall_scored + subjective_scored,
            "dimension_scores": dim_avg,
            "objective_breakdown": objective_breakdown,
            "subjective_summary": subjective_summary,
        }

        # Performance summary
        latencies = sorted([r.latency_ms for r in results if r.latency_ms])
        ttfts = [r.ttft_ms for r in results if r.ttft_ms]
        costs = [float(r.cost_usd) for r in results if r.cost_usd]
        tps_list = [r.tps for r in results if r.tps]
        errors = [r for r in results if r.error]
        
        # Token metrics
        prompt_tokens = [r.prompt_tokens for r in results if r.prompt_tokens]
        completion_tokens = [r.completion_tokens for r in results if r.completion_tokens]
        total_tokens = [r.total_tokens for r in results if r.total_tokens]
        model_prompt_key = f"{model_id}:{prompt_id if prompt_id is not None else 'none'}"
        model_warmup_cost = float(model_warmup_costs.get(model_prompt_key, 0.0))
        inference_cost = float(sum(costs))
        total_cost = inference_cost + model_warmup_cost + judge_share_per_combo

        perf_summary = {
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else 0,
            "min_latency_ms": latencies[0] if latencies else 0,
            "max_latency_ms": latencies[-1] if latencies else 0,
            "p95_latency_ms": latencies[int(len(latencies) * 0.95)] if latencies else 0,
            "avg_ttft_ms": round(sum(ttfts) / len(ttfts), 2) if ttfts else 0,
            "avg_tps": round(sum(tps_list) / len(tps_list), 2) if tps_list else 0,
            "inference_cost_usd": round(inference_cost, 6),
            "warmup_cost_usd": round(model_warmup_cost + judge_share_per_combo, 6),
            "total_cost_usd": round(total_cost, 6),
            "error_rate": round(len(errors) / len(results), 4) if results else 0,
            "avg_prompt_tokens": round(sum(prompt_tokens) / len(prompt_tokens), 1) if prompt_tokens else 0,
            "avg_completion_tokens": round(sum(completion_tokens) / len(completion_tokens), 1) if completion_tokens else 0,
            "avg_total_tokens": round(sum(total_tokens) / len(total_tokens), 1) if total_tokens else 0,
            "total_tokens": sum(total_tokens) if total_tokens else 0,
        }

        # Save or update aggregated report
        report_filters = [
            AggregatedReport.job_id == job.id,
            AggregatedReport.model_id == model_id,
        ]
        if prompt_id is not None:
            report_filters.append(AggregatedReport.prompt_template_id == prompt_id)
        else:
            report_filters.append(AggregatedReport.prompt_template_id.is_(None))

        report = db.query(AggregatedReport).filter(*report_filters).first()

        if report:
            report.summary = summary
            report.performance_summary = perf_summary
        else:
            report = AggregatedReport(
                job_id=job.id,
                model_id=model_id,
                prompt_template_id=prompt_id,
                summary=summary,
                performance_summary=perf_summary,
            )
            db.add(report)

        # Update leaderboard (only for results with NO custom prompt, or first prompt as baseline)
        # To keep it simple, we only update leaderboard if prompt_id is None or matches the first one
        # Actually, let's just update it for all, the latest one will stick.
        for dim, score in dim_avg.items():
            lb = db.query(Leaderboard).filter(
                Leaderboard.model_id == model_id,
                Leaderboard.ability_dimension == dim,
            ).first()
            if lb:
                lb.score = score
                lb.job_id = job.id
            else:
                lb = Leaderboard(
                    model_id=model_id,
                    ability_dimension=dim,
                    score=score,
                    job_id=job.id,
                )
                db.add(lb)

    db.commit()


@celery_app.task(bind=True, name="aipc.run_batch_ai_score", max_retries=3)
def run_batch_ai_score(
    self,
    job_id: int,
    result_ids: list[int],
    judge_model_ids: list[int],
    require_human_review: bool = False,
    enable_objective_auto_score: bool = True,
    ignore_case: bool | None = None,
):
    """Celery task to run AI scoring on existing results."""
    from app.database import SessionLocal
    from app.models.evaluation_result import EvaluationResult
    from app.models.evaluation_job import EvaluationJob
    from app.models.test_case import TestCase
    from app.models.model_registry import ModelRegistry
    from app.engine.evaluator import Evaluator
    from app.engine.runner import get_adapter
    from sqlalchemy.orm.attributes import flag_modified

    db = SessionLocal()
    logger.info(f"Worker start: run_batch_ai_score {job_id} [VERIFIED_1912]")
    try:
        job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
        if not job:
            return {"error": "Job not found"}

        results = db.query(EvaluationResult).filter(EvaluationResult.id.in_(result_ids)).all()
        if not results:
            return {"status": "completed", "count": 0}

        config = job.config_snapshot or {}
        effective_ignore_case = config.get("ignore_case", True) if ignore_case is None else bool(ignore_case)
        config["batch_scoring"] = {
            "total": len(results),
            "current": 0,
            "status": "running",
            "enable_objective_auto_score": enable_objective_auto_score,
            "ignore_case": effective_ignore_case,
        }
        job.config_snapshot = config
        flag_modified(job, "config_snapshot")
        db.commit()

        # Load judge adapters
        judge_adapters = []
        for j_id in judge_model_ids:
            j_model = db.query(ModelRegistry).filter(ModelRegistry.id == j_id).first()
            if j_model:
                adapter = get_adapter(j_model)
                adapter.model_name = j_model.name
                judge_adapters.append(adapter)
        
        if not judge_adapters:
            return {"error": "No valid judge models found"}

        evaluator = Evaluator()

        async def process_scores():
            for i, r in enumerate(results):
                current_count = i + 1
                try:
                    if not r.raw_output:
                        logger.info(f"⏭️  Result {r.id} has no raw_output, skipping AI score.")
                    else:
                        case = db.query(TestCase).filter(TestCase.id == r.case_id).first()
                        if case:
                            scoring_result = None
                            judge_names = []
                            if enable_objective_auto_score:
                                rule_result = evaluator.score(
                                    output=r.raw_output,
                                    reference=case.reference_answer,
                                    metadata=case.metadata_ or {},
                                    ignore_case=effective_ignore_case,
                                )
                                if rule_result.get("score") is not None:
                                    scoring_result = rule_result
                                    judge_names = ["RULE_AUTO"]
                            if scoring_result is None:
                                q_type = case.metadata_.get("type", case.metadata_.get("question_type", "")) if isinstance(case.metadata_, dict) else ""
                                scoring_result = await evaluator.evaluate_with_ai(
                                    output=r.raw_output,
                                    reference=case.reference_answer,
                                    prompt=case.prompt,
                                    judge_adapters=judge_adapters,
                                    question_type=str(q_type) if q_type else "主观题",
                                )
                                judge_names = [a.model_name for a in judge_adapters]
                            auto_meta = scoring_result.get("metadata", {})
                            auto_meta["source"] = "rule_auto" if judge_names == ["RULE_AUTO"] else "ai_judge"
                            auto_meta["judges"] = judge_names

                            auto_score = scoring_result.get("score")
                            r.auto_score = auto_score
                            r.auto_metadata = auto_meta
                            r.dimension_scores = scoring_result.get("dimension_scores")
                            r.judge_model = ",".join(judge_names)
                            
                            if r.human_score is None:
                                r.final_score = None if require_human_review else auto_score
                                r.scored_by = "auto" if (auto_score is not None and not require_human_review) else None
                                if auto_score is not None:
                                    r.review_status = "pending" if require_human_review else "reviewed"
                            
                            logger.info(f"✅ Result {r.id} AI score updated: {auto_score}")
                except Exception as e:
                    logger.error(f"❌ Failed to AI score result {r.id}: {e}")
                
                # Update progress in config_snapshot for EVERY iteration
                cf = job.config_snapshot or {}
                if "batch_scoring" in cf:
                    cf["batch_scoring"]["current"] = current_count
                    job.config_snapshot = cf
                    flag_modified(job, "config_snapshot")
                
                db.commit()

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(process_scores())
        finally:
            loop.close()

        cf = job.config_snapshot or {}
        if "batch_scoring" in cf:
            cf["batch_scoring"]["status"] = "completed"
            job.config_snapshot = cf
            flag_modified(job, "config_snapshot")
            db.commit()

        # Update the aggregated reports with new scores
        _generate_report(db, job)

        return {"status": "completed", "count": len(results)}

    except Exception as e:
        logger.error(f"Batch AI score failed: {e}")
        db.rollback()
        # In case job was detached from session by rollback, refetch
        job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
        if job:
            cf = job.config_snapshot or {}
            if "batch_scoring" in cf:
                cf["batch_scoring"]["status"] = "failed"
                job.config_snapshot = cf
                flag_modified(job, "config_snapshot")
                db.commit()
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task(bind=True, name="aipc.run_offline_judge", max_retries=3)
def run_offline_judge(self, job_id: int):
    """Celery task to run an offline judge job asynchronously."""
    from app.database import SessionLocal
    from app.models.offline_judge import OfflineJudgeJob
    from app.engine.offline_runner import OfflineJudgeRunner

    db = SessionLocal()
    logger.info(f"Worker start: run_offline_judge {job_id} [VERIFIED_1912]")
    try:
        job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
        if not job:
            logger.error(f"Offline Job {job_id} not found")
            return {"error": f"Job {job_id} not found"}

        if job.status == "cancelled":
            return {"status": "cancelled"}

        runner = OfflineJudgeRunner(db, job)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(runner.run())
        finally:
            loop.close()

        return {"status": "completed", "job_id": job_id}

    except Exception as e:
        logger.error(f"Offline Job {job_id} failed: {e}")
        job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
        if job and job.status == "running":
            job.status = "failed"
            db.commit()
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()

@celery_app.task(bind=True, name="aipc.retry_offline_judge", max_retries=3)
def retry_offline_judge(self, job_id: int):
    """Celery task to retry failed offline judge judgments asynchronously."""
    from app.database import SessionLocal
    from app.models.offline_judge import OfflineJudgeJob
    from app.engine.offline_runner import OfflineJudgeRunner

    db = SessionLocal()
    logger.info(f"Worker start: retry_offline_judge {job_id}")
    try:
        job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
        if not job:
            logger.error(f"Offline Job {job_id} not found")
            return {"error": f"Job {job_id} not found"}

        if job.status == "cancelled":
            return {"status": "cancelled"}

        runner = OfflineJudgeRunner(db, job)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(runner.retry_failed())
        finally:
            loop.close()

        return {"status": "completed", "job_id": job_id}

    except Exception as e:
        logger.error(f"Offline Job {job_id} retry failed: {e}")
        job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
        if job and job.status == "running":
            job.status = "failed"
            db.commit()
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()
