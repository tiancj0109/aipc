"""Offline Judge API routes."""

import csv
import io
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.offline_judge import OfflineJudgeJob, OfflineJudgeResult
from app.models.model_registry import ModelRegistry
from app.schemas.offline_judge import OfflineJobResponse, OfflineJobProgress, OfflineJudgeResultResponse

router = APIRouter(prefix="/offline-jobs", tags=["Offline Judge Jobs"])
logger = logging.getLogger(__name__)

@router.get("", response_model=list[OfflineJobResponse])
def list_offline_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(OfflineJudgeJob)
    if status:
        query = query.filter(OfflineJudgeJob.status == status)
    return query.order_by(OfflineJudgeJob.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{job_id}", response_model=OfflineJobResponse)
def get_offline_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    return job


@router.get("/{job_id}/progress", response_model=OfflineJobProgress)
def get_offline_job_progress(job_id: int, db: Session = Depends(get_db)):
    job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    pct = (job.processed_cases / job.total_cases * 100) if job.total_cases > 0 else 0
    return OfflineJobProgress(
        job_id=job.id,
        status=job.status,
        total_cases=job.total_cases,
        processed_cases=job.processed_cases,
        success_count=job.success_count,
        failure_count=job.failure_count,
        progress_pct=round(pct, 2),
    )


@router.get("/{job_id}/results", response_model=list[OfflineJudgeResultResponse])
def get_offline_job_results(
    job_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    results = db.query(OfflineJudgeResult).filter(OfflineJudgeResult.job_id == job_id).offset(skip).limit(limit).all()
    return results


@router.post("", response_model=OfflineJobResponse, status_code=201)
async def create_offline_job(
    name: str = Form(...),
    judge_model_id: int = Form(...),
    scoring_mode: str = Form(...),
    enable_objective_auto_score: bool = Form(True),
    ignore_case: bool = Form(True),
    custom_prompt: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    allowed_modes = {"score", "accuracy", "choice_accuracy"}
    if scoring_mode not in allowed_modes:
        raise HTTPException(status_code=400, detail="scoring_mode 不合法，支持: score / accuracy / choice_accuracy")

    # Validate model
    model = db.query(ModelRegistry).filter(ModelRegistry.id == judge_model_id, ModelRegistry.status == 1).first()
    if not model:
        raise HTTPException(status_code=400, detail=f"模型 ID {judge_model_id} 不存在或已禁用")

    # Read and validate CSV
    content = await file.read()
    try:
        try:
            decoded_content = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            # Fallback for Excel-created CSVs in Chinese environments
            decoded_content = content.decode("gbk")
        csv_reader = csv.DictReader(io.StringIO(decoded_content))
    except Exception as e:
        logger.error(f"Error parsing CSV: {e}")
        raise HTTPException(status_code=400, detail="无法解析 CSV 文件，请确保其为 UTF-8 或 GBK 编码。")

    rows = []
    def _parse_options(raw_options: str):
        if raw_options is None or str(raw_options).strip() == "":
            return None
        text = str(raw_options).strip()
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                return parsed
            return [str(parsed)]
        except Exception:
            return [v.strip() for v in text.replace("，", ",").split(",") if v.strip()]

    def _build_reference_answer(row: dict) -> str:
        raw_ref = row.get("reference_answer")
        if raw_ref is None or str(raw_ref).strip() == "":
            raw_ref = row.get("answer", row.get("correct_answer", row.get("label", "")))
        raw_correct_answers = row.get("correct_answers")
        question_type = row.get("question_type", row.get("type", ""))
        options = _parse_options(row.get("options"))

        ref_obj = {}
        if isinstance(raw_ref, str) and raw_ref.strip():
            ref_text = raw_ref.strip()
            try:
                parsed_ref = json.loads(ref_text)
                if isinstance(parsed_ref, dict):
                    ref_obj = parsed_ref
                elif isinstance(parsed_ref, list):
                    ref_obj = {"answer": parsed_ref}
                else:
                    ref_obj = {"answer": parsed_ref}
            except Exception:
                ref_obj = {"answer": ref_text}
        elif raw_ref not in (None, ""):
            ref_obj = {"answer": raw_ref}

        if raw_correct_answers not in (None, ""):
            if isinstance(raw_correct_answers, str):
                try:
                    parsed_answers = json.loads(raw_correct_answers)
                    ref_obj["answer"] = parsed_answers
                except Exception:
                    ref_obj["answer"] = [v.strip() for v in raw_correct_answers.replace("，", ",").split(",") if v.strip()]
            else:
                ref_obj["answer"] = raw_correct_answers

        if question_type:
            ref_obj["type"] = str(question_type).strip()
        if options is not None:
            ref_obj["options"] = options

        if not ref_obj:
            return ""

        if "type" in ref_obj or "options" in ref_obj or isinstance(ref_obj.get("answer"), list):
            return json.dumps(ref_obj, ensure_ascii=False)
        answer_only = ref_obj.get("answer")
        return "" if answer_only is None else str(answer_only)

    for row in csv_reader:
        prompt = row.get("prompt", "")
        reference_answer = _build_reference_answer(row)
        model_output = row.get("model_output", "")
        
        if not prompt or not model_output:
            continue # Skip invalid rows
            
        rows.append({
            "prompt": prompt,
            "reference_answer": reference_answer,
            "model_output": model_output
        })

    if not rows:
        raise HTTPException(status_code=400, detail="CSV 文件为空或缺少必要列 (prompt, model_output)。")

    # Create job
    config = {
        "judge_model_id": judge_model_id,
        "judge_model_name": model.name,
        "scoring_mode": scoring_mode,
        "enable_objective_auto_score": enable_objective_auto_score,
        "ignore_case": ignore_case,
        "custom_prompt": custom_prompt,
    }

    job = OfflineJudgeJob(
        name=name,
        status="pending",
        config_snapshot=config,
        total_cases=len(rows),
        processed_cases=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Insert initial result rows
    for row in rows:
        result = OfflineJudgeResult(
            job_id=job.id,
            prompt=row["prompt"],
            reference_answer=row["reference_answer"],
            model_output=row["model_output"],
        )
        db.add(result)
    db.commit()

    # Trigger Async Task
    from app.engine.tasks import run_offline_judge
    run_offline_judge.delay(job.id)

    return job


@router.post("/{job_id}/retry_failed")
def retry_failed_offline_job(job_id: int, db: Session = Depends(get_db)):
    """重试离线任务中失败或未计算的记录。"""
    job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    if job.status not in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail="只有已结束的任务可以重试")
    
    # 查找是否有需要重试的（没分数的，或者报错的）
    failed_count = db.query(OfflineJudgeResult).filter(
        OfflineJudgeResult.job_id == job_id,
        (OfflineJudgeResult.score.is_(None)) | (OfflineJudgeResult.error.isnot(None))
    ).count()

    if failed_count == 0:
        raise HTTPException(status_code=400, detail="该任务没有失败或遗漏的记录，无需重试")

    job.status = "running"
    job.completed_at = None
    db.commit()

    from app.engine.tasks import retry_offline_judge
    retry_offline_judge.delay(job.id)

    return {"message": "正在后台重试失败的判卷请求"}


@router.delete("/{job_id}")
def delete_offline_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(OfflineJudgeJob).filter(OfflineJudgeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    db.delete(job)
    db.commit()
    return {"message": "任务已删除"}
