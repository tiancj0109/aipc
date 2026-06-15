"""Pydantic schemas for evaluation jobs."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class JobCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    name: str = Field(..., max_length=255)
    model_ids: list[int] = Field(..., description="待测模型ID列表")
    suite_id: int = Field(..., description="测试集ID")
    prompt_template_ids: list[int] = Field(default=[], description="Prompt模板ID列表")

    # Scoring config
    enable_ai_judge: bool = Field(False, description="是否启用AI裁判")
    judge_model_ids: Optional[list[int]] = Field(None, description="裁判模型ID列表")
    multi_judge_strategy: str = Field("average", description="多裁判策略: average/majority")
    require_human_review: bool = Field(False, description="是否需要人工复核")
    enable_objective_auto_score: bool = Field(True, description="是否启用客观题自动判分")
    ignore_case: bool = Field(True, description="客观题自动判分是否忽略大小写")
    enable_warmup: bool = Field(True, description="是否开启模型预热")
    warmup_judge_models: bool = Field(True, description="是否开启裁判模型预热")

    # Performance config
    collect_performance: bool = Field(True, description="是否收集性能数据")
    enable_ttft: bool = Field(True, description="是否启用TTFT测量")
    enable_stress_test: bool = Field(False, description="是否启用压力测试")
    concurrency: int = Field(1, ge=1, le=100, description="并发数")
    timeout: int = Field(120, ge=1, le=600, description="请求超时时间(秒)")


    # Experiment params
    enable_temperature: bool = Field(True, description="是否向模型下发temperature参数")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: int = Field(2048, ge=1, le=128000)
    random_seed: Optional[int] = None
    created_by: Optional[str] = None


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: int
    name: str
    status: str
    config_snapshot: Optional[dict] = None
    total_cases: int = 0
    processed_cases: int = 0
    success_count: int = 0
    failure_count: int = 0
    duration_seconds: int = 0
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class JobProgress(BaseModel):
    job_id: int
    status: str
    total_cases: int
    processed_cases: int
    success_count: int
    failure_count: int
    progress_pct: float = 0.0
