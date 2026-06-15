"""Evaluation job management API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.evaluation_job import EvaluationJob
from app.models.model_registry import ModelRegistry
from app.models.test_suite import TestSuite
from app.models.test_case import TestCase
from app.models.leaderboard import Leaderboard
from app.schemas.job import JobCreate, JobResponse, JobProgress

router = APIRouter(prefix="/jobs", tags=["Evaluation Jobs"])


@router.get("", response_model=list[JobResponse])
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取评测任务列表。"""
    query = db.query(EvaluationJob)
    if status:
        query = query.filter(EvaluationJob.status == status)
    return query.order_by(EvaluationJob.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/count")
def count_jobs(db: Session = Depends(get_db)):
    """获取任务统计。"""
    total = db.query(EvaluationJob).count()
    running = db.query(EvaluationJob).filter(EvaluationJob.status == "running").count()
    completed = db.query(EvaluationJob).filter(EvaluationJob.status == "completed").count()
    return {"total": total, "running": running, "completed": completed}


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    """获取任务详情。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    return job


@router.get("/{job_id}/progress", response_model=JobProgress)
def get_job_progress(job_id: int, db: Session = Depends(get_db)):
    """获取任务进度。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    pct = (job.processed_cases / job.total_cases * 100) if job.total_cases > 0 else 0
    return JobProgress(
        job_id=job.id,
        status=job.status,
        total_cases=job.total_cases,
        processed_cases=job.processed_cases,
        success_count=job.success_count,
        failure_count=job.failure_count,
        progress_pct=round(pct, 2),
    )


@router.post("", response_model=JobResponse, status_code=201)
def create_job(data: JobCreate, db: Session = Depends(get_db)):
    """创建评测任务。"""
    # Validate models exist
    for mid in data.model_ids:
        model = db.query(ModelRegistry).filter(ModelRegistry.id == mid, ModelRegistry.status == 1).first()
        if not model:
            raise HTTPException(status_code=400, detail=f"模型ID {mid} 不存在或已禁用")

    # Validate test suite
    suite = db.query(TestSuite).filter(TestSuite.id == data.suite_id).first()
    if not suite:
        raise HTTPException(status_code=400, detail="测试集不存在")

    total_cases = db.query(TestCase).filter(TestCase.suite_id == data.suite_id).count()
    if total_cases == 0:
        raise HTTPException(status_code=400, detail="测试集没有用例")

    # Build config snapshot
    config = data.model_dump()
    config["total_cases_per_model"] = total_cases
    config["suite_name"] = suite.name
    config["suite_version"] = suite.version

    prompt_multiplier = max(1, len(data.prompt_template_ids))

    job = EvaluationJob(
        name=data.name,
        status="pending",
        config_snapshot=config,
        total_cases=total_cases * len(data.model_ids) * prompt_multiplier,
        processed_cases=0,
        created_by=data.created_by,
        last_started_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Trigger async evaluation task
    from app.engine.tasks import run_evaluation_job
    run_evaluation_job.delay(job.id)

    return job


@router.post("/{job_id}/cancel")
def cancel_job(job_id: int, db: Session = Depends(get_db)):
    """取消任务。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    if job.status not in ("pending", "running", "paused"):
        raise HTTPException(status_code=400, detail=f"任务状态为 {job.status}，无法取消")
    if job.status == "running" and job.last_started_at:
        delta = (datetime.utcnow() - job.last_started_at).total_seconds()
        job.duration_seconds = int((job.duration_seconds or 0) + delta)
    
    job.status = "cancelled"
    job.completed_at = datetime.utcnow()
    db.commit()
    return {"message": "任务已取消"}


@router.post("/{job_id}/pause")
def pause_job(job_id: int, db: Session = Depends(get_db)):
    """暂停任务。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    if job.status != "running":
        raise HTTPException(status_code=400, detail="只有运行中的任务可以暂停")
    if job.last_started_at:
        delta = (datetime.utcnow() - job.last_started_at).total_seconds()
        job.duration_seconds = int((job.duration_seconds or 0) + delta)
    
    job.status = "paused"
    db.commit()
    return {"message": "任务已暂停"}


@router.post("/{job_id}/resume")
def resume_job(job_id: int, db: Session = Depends(get_db)):
    """继续任务。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    if job.status != "paused":
        raise HTTPException(status_code=400, detail="只有暂停的任务可以继续")
    job.status = "running"
    job.last_started_at = datetime.utcnow()
    db.commit()

    from app.engine.tasks import run_evaluation_job
    run_evaluation_job.delay(job.id)

    return {"message": "任务已继续"}


@router.post("/{job_id}/retry_failed")
def retry_failed_job(job_id: int, db: Session = Depends(get_db)):
    """重试任务中失败的记录。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    if job.status not in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail="只有已结束的任务可以重试失败项")
    if job.failure_count == 0:
        raise HTTPException(status_code=400, detail="该任务没有失败项，无需重试")

    job.status = "running"
    job.completed_at = None
    job.last_started_at = datetime.utcnow()
    db.commit()

    from app.engine.tasks import retry_evaluation_job
    retry_evaluation_job.delay(job.id)

    return {"message": "正在后台重试失败的评测请求"}

@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    """删除任务及其关联评测结果和报告。"""
    job = db.query(EvaluationJob).filter(EvaluationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 手动删除没有配置 cascade='all, delete-orphan' 的依赖表 (如 Leaderboard)
    db.query(Leaderboard).filter(Leaderboard.job_id == job_id).delete(synchronize_session=False)

    # 评测结果表(evaluation_result)和聚合报告表(aggregated_report)已经设置了 cascade="all, delete-orphan",
    # 可以直接依赖 SQLAlchemy cascade
    db.delete(job)
    db.commit()
    return {"message": "任务已删除"}
