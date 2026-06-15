"""Aggregated report - cached summary for evaluation jobs."""

from sqlalchemy import Column, Integer, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class AggregatedReport(Base):
    __tablename__ = "aggregated_report"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("evaluation_job.id", ondelete="CASCADE"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("model_registry.id"), nullable=False, index=True)
    prompt_template_id = Column(Integer, ForeignKey("prompt_template.id"), nullable=True, index=True, comment="使用的提示词模板ID")
    summary = Column(JSON, nullable=True, comment="效果得分统计 (平均分/各维度分)")
    performance_summary = Column(JSON, nullable=True, comment="性能统计 (平均延迟/P95/TPS/吞吐量/总成本)")
    chart_data = Column(JSON, nullable=True, comment="预计算图表数据")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    job = relationship("EvaluationJob", back_populates="reports")
