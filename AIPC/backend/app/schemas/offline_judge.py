"""Pydantic schemas for Offline Judge jobs."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class OfflineJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: int
    name: str
    status: str
    config_snapshot: Optional[dict] = None
    total_cases: int = 0
    processed_cases: int = 0
    success_count: int = 0
    failure_count: int = 0
    accuracy_rate: Optional[float] = None
    average_score: Optional[float] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class OfflineJudgeResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: int
    job_id: int
    prompt: str
    reference_answer: Optional[str] = None
    model_output: str
    judge_model: Optional[str] = None
    score: Optional[float] = None
    reason: Optional[str] = None
    dimension_scores: Optional[dict] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None


class OfflineJobProgress(BaseModel):
    job_id: int
    status: str
    total_cases: int
    processed_cases: int
    success_count: int
    failure_count: int
    progress_pct: float = 0.0
