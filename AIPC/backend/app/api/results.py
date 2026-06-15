"""Results and reporting API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from typing import Optional
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models.evaluation_job import EvaluationJob
from app.models.evaluation_result import EvaluationResult
from app.models.aggregated_report import AggregatedReport
from app.models.model_registry import ModelRegistry
from app.models.test_case import TestCase
from app.schemas.result import (
    ResultResponse, HumanReviewUpdate, BatchReviewUpdate, AggregatedReportResponse, BatchAIScoreRequest
)
from app.engine.tasks import run_batch_ai_score

router = APIRouter(prefix="", tags=["Evaluation Results"])


@router.get("/jobs/{job_id}/results", response_model=list[AggregatedReportResponse])
def get_aggregated_results(job_id: int, db: Session = Depends(get_db)):
    """获取任务聚合报告，包含模型和Prompt模板名称。"""
    from app.models.prompt_template import PromptTemplate
    
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    reports = db.query(AggregatedReport).filter(AggregatedReport.job_id == job_id).all()
    result = []
    
    # Cache model and prompt names to avoid excess queries
    model_names = {m.id: m.name for m in db.query(ModelRegistry).all()}
    prompt_names = {p.id: p.name for p in db.query(PromptTemplate).all()}
    
    for r in reports:
        result.append(AggregatedReportResponse(
            job_id=r.job_id,
            model_id=r.model_id,
            model_name=model_names.get(r.model_id, "Unknown"),
            prompt_template_id=r.prompt_template_id,
            prompt_name=prompt_names.get(r.prompt_template_id, "默认/测试集Prompt") if r.prompt_template_id else "默认/测试集Prompt",
            summary=r.summary,
            performance_summary=r.performance_summary,
            chart_data=r.chart_data,
        ))
    return result


@router.get("/jobs/{job_id}/results/detail", response_model=list[ResultResponse])
def get_detailed_results(
    job_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=10000),
    model_id: Optional[int] = None,
    review_status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(EvaluationResult, TestCase.prompt, TestCase.reference_answer, TestCase.metadata_).join(
        TestCase, EvaluationResult.case_id == TestCase.id
    ).filter(EvaluationResult.job_id == job_id)
    
    if model_id:
        query = query.filter(EvaluationResult.model_id == model_id)
    if review_status:
        query = query.filter(EvaluationResult.review_status == review_status)
    
    records = query.order_by(EvaluationResult.id).offset(skip).limit(limit).all()
    
    results = []
    for r, prompt, ref_ans, metadata_ in records:
        # Create a dict from the SQLAlchemy model to easily add prompt/reference
        res_dict = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        qtype = None
        if isinstance(metadata_, dict):
            qtype = metadata_.get("type") or metadata_.get("question_type")
        res_dict["question_type"] = qtype
        res_dict["prompt"] = prompt
        res_dict["reference_answer"] = ref_ans
        results.append(ResultResponse(**res_dict))
        
    return results


@router.get("/jobs/{job_id}/results/detail/count")
def count_detailed_results(
    job_id: int,
    model_id: Optional[int] = None,
    review_status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取详细结果总数。"""
    query = db.query(EvaluationResult).filter(EvaluationResult.job_id == job_id)
    if model_id:
        query = query.filter(EvaluationResult.model_id == model_id)
    if review_status:
        query = query.filter(EvaluationResult.review_status == review_status)
    return {"count": query.count()}


@router.patch("/results/{result_id}")
def human_review_result(result_id: int, data: HumanReviewUpdate, db: Session = Depends(get_db)):
    """人工修改分数。"""
    result = db.query(EvaluationResult).filter(EvaluationResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="结果不存在")

    result.human_score = data.human_score
    result.final_score = data.human_score
    result.scored_by = "human"
    result.review_status = "reviewed"
    result.reviewer = data.reviewer
    result.review_comment = data.review_comment
    db.commit()
    return {"message": "分数已更新"}


@router.post("/results/batch-review")
def batch_review(data: BatchReviewUpdate, db: Session = Depends(get_db)):
    """批量审核结果。"""
    results = db.query(EvaluationResult).filter(EvaluationResult.id.in_(data.result_ids)).all()
    if not results:
        raise HTTPException(status_code=404, detail="未找到任何结果")

    updated = 0
    for r in results:
        if data.action == "approve":
            r.review_status = "reviewed"
            r.reviewer = data.reviewer
            if r.final_score is None:
                r.final_score = r.auto_score
        elif data.action == "adjust" and data.score_offset is not None:
            base = r.auto_score or 0
            r.human_score = max(0, min(10, base + data.score_offset))
            r.final_score = r.human_score
            r.scored_by = "human"
            r.review_status = "reviewed"
            r.reviewer = data.reviewer
        updated += 1

    db.commit()
    return {"message": f"已审核 {updated} 条结果"}


@router.post("/jobs/{job_id}/results/recompute")
def recompute_aggregated_results(job_id: int, db: Session = Depends(get_db)):
    """手动重算聚合报告。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    from app.engine.tasks import _generate_report
    _generate_report(db, job)
    return {"message": "报告已重新生成"}


@router.post("/results/batch-ai-score")
def batch_ai_score(job_id: int, data: BatchAIScoreRequest, db: Session = Depends(get_db)):
    """触发AI裁判对齐批量重新打分。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    if not data.result_ids:
        return {"message": "未选择任何结果"}
    
    if not data.judge_model_ids:
        raise HTTPException(status_code=400, detail="必须提供至少一个裁判模型ID")

    # Initialize batch_scoring status in DB synchronously to ensure instant frontend update
    cf = job.config_snapshot or {}
    cf["batch_scoring"] = {
        "status": "running",
        "total": len(data.result_ids),
        "current": 0
    }
    job.config_snapshot = cf
    flag_modified(job, "config_snapshot")
    db.commit()

    # Dispatch to Celery task
    run_batch_ai_score.delay(
        job_id,
        data.result_ids,
        data.judge_model_ids,
        data.require_human_review,
        data.enable_objective_auto_score,
        data.ignore_case,
    )

    return {"message": "AI裁判打分已在后台流转，进入进度监控"}


@router.get("/jobs/{job_id}/performance")
def get_performance_report(job_id: int, db: Session = Depends(get_db)):
    """获取性能报告。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    config = job.config_snapshot or {}
    model_ids = config.get("model_ids", [])
    warmup_costs = config.get("warmup_costs", {}) if isinstance(config.get("warmup_costs", {}), dict) else {}
    model_warmup_costs = warmup_costs.get("model", {}) if isinstance(warmup_costs.get("model", {}), dict) else {}
    judge_warmup_costs = warmup_costs.get("judge", {}) if isinstance(warmup_costs.get("judge", {}), dict) else {}
    judge_warmup_total = float(sum(float(v) for v in judge_warmup_costs.values())) if judge_warmup_costs else 0.0
    judge_share_per_model = judge_warmup_total / len(model_ids) if model_ids else 0.0
    performance_data = {}

    for mid in model_ids:
        model = db.query(ModelRegistry).filter(ModelRegistry.id == mid).first()
        model_name = model.name if model else f"Model-{mid}"

        results = db.query(EvaluationResult).filter(
            EvaluationResult.job_id == job_id,
            EvaluationResult.model_id == mid,
            EvaluationResult.latency_ms.isnot(None),
        ).all()

        if not results:
            continue

        latencies = [r.latency_ms for r in results if r.latency_ms]
        ttfts = [r.ttft_ms for r in results if r.ttft_ms]
        costs = [float(r.cost_usd) for r in results if r.cost_usd]
        tps_list = [r.tps for r in results if r.tps]
        errors = [r for r in results if r.error]
        model_warmup_total = sum(
            float(v) for k, v in model_warmup_costs.items()
            if str(k).split(":")[0] == str(mid)
        )
        total_cost = sum(costs) + model_warmup_total + judge_share_per_model

        latencies.sort()
        performance_data[model_name] = {
            "avg_latency_ms": sum(latencies) / len(latencies) if latencies else 0,
            "p95_latency_ms": latencies[int(len(latencies) * 0.95)] if latencies else 0,
            "avg_ttft_ms": sum(ttfts) / len(ttfts) if ttfts else 0,
            "inference_cost_usd": sum(costs),
            "warmup_cost_usd": model_warmup_total + judge_share_per_model,
            "total_cost_usd": total_cost,
            "avg_tps": sum(tps_list) / len(tps_list) if tps_list else 0,
            "error_rate": len(errors) / len(results) if results else 0,
            "total_requests": len(results),
            "failed_requests": len(errors),
        }

    return {"job_id": job_id, "performance": performance_data}
