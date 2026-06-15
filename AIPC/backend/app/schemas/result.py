"""Pydantic schemas for evaluation results."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class ResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: int
    job_id: int
    model_id: int
    case_id: int
    prompt_template_id: Optional[int] = None
    raw_output: Optional[str] = None
    prompt: Optional[str] = None
    question_type: Optional[str] = None
    reference_answer: Optional[dict] = None
    auto_score: Optional[float] = None
    auto_metadata: Optional[dict] = None
    judge_model: Optional[str] = None
    dimension_scores: Optional[dict] = None
    human_score: Optional[float] = None
    final_score: Optional[float] = None
    scored_by: Optional[str] = None
    review_status: Optional[str] = None
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None

    # Performance
    latency_ms: Optional[int] = None
    ttft_ms: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    tps: Optional[float] = None
    cost_usd: Optional[float] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None


class HumanReviewUpdate(BaseModel):
    human_score: float = Field(..., ge=0, le=10, description="人工分数")
    review_comment: Optional[str] = Field(None, description="审核评语")
    reviewer: str = Field(..., description="审核人")


class BatchReviewUpdate(BaseModel):
    result_ids: list[int] = Field(..., description="待审核结果ID列表")
    action: str = Field("approve", description="approve=直接通过 / adjust=批量调分")
    score_offset: Optional[float] = Field(None, description="分数偏移量 (action=adjust时)")
    reviewer: str = Field(..., description="审核人")


class AggregatedReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    job_id: int
    model_id: int
    model_name: Optional[str] = None
    prompt_template_id: Optional[int] = None
    prompt_name: Optional[str] = None
    summary: Optional[dict] = None
    performance_summary: Optional[dict] = None
    chart_data: Optional[dict] = None


class BatchAIScoreRequest(BaseModel):
    result_ids: list[int] = Field(..., description="待打分结果ID列表")
    judge_model_ids: list[int] = Field(..., description="裁判模型ID列表")
    require_human_review: bool = Field(False, description="是否需要人工审核")
    enable_objective_auto_score: bool = Field(True, description="是否启用客观题自动判分")
    ignore_case: Optional[bool] = Field(None, description="客观题判分是否忽略大小写；为空时沿用任务配置")
