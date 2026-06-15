"""Evaluation result - stores per-case evaluation outcomes."""

from sqlalchemy import (
    Column, BigInteger, Integer, String, Text, Float, JSON,
    DateTime, Enum as SAEnum, DECIMAL, ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class EvaluationResult(Base):
    __tablename__ = "evaluation_result"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("evaluation_job.id", ondelete="CASCADE"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("model_registry.id"), nullable=False, index=True)
    case_id = Column(BigInteger, ForeignKey("test_case.id"), nullable=False, index=True)
    prompt_template_id = Column(Integer, ForeignKey("prompt_template.id"), nullable=True, index=True, comment="使用的提示词模板ID(A/B测试)")

    # Model output
    raw_output = Column(Text, nullable=True, comment="模型原始输出")

    # Scoring
    auto_score = Column(Float, nullable=True, comment="AI裁判/规则给出的分数")
    auto_metadata = Column(JSON, nullable=True, comment="自动评分详细信息 (评分理由等)")
    judge_model = Column(String(255), nullable=True, comment="裁判模型名称")
    dimension_scores = Column(JSON, nullable=True, comment='各维度得分 {"correctness":4,"relevance":5}')
    human_score = Column(Float, nullable=True, comment="人工修改后的分数")
    final_score = Column(Float, nullable=True, comment="最终使用的分数")
    scored_by = Column(SAEnum("auto", "human"), default="auto", comment="评分方式")
    review_status = Column(SAEnum("pending", "reviewed"), default="pending", comment="审核状态")
    reviewer = Column(String(100), nullable=True, comment="审核人")
    review_comment = Column(Text, nullable=True, comment="审核评语")

    # Performance metrics
    latency_ms = Column(Integer, nullable=True, comment="总延迟 (毫秒)")
    ttft_ms = Column(Integer, nullable=True, comment="首Token延迟 (毫秒)")
    prompt_tokens = Column(Integer, nullable=True, comment="输入tokens数")
    completion_tokens = Column(Integer, nullable=True, comment="输出tokens数")
    total_tokens = Column(Integer, nullable=True, comment="总tokens数")
    tps = Column(Float, nullable=True, comment="tokens per second")
    throughput = Column(Float, nullable=True, comment="requests/sec (压力测试)")
    error = Column(Text, nullable=True, comment="错误信息")
    cost_usd = Column(DECIMAL(10, 6), nullable=True, comment="估算成本 (美元)")
    performance_metadata = Column(JSON, nullable=True, comment="其他性能数据 (显存/CPU等)")

    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    job = relationship("EvaluationJob", back_populates="results")
