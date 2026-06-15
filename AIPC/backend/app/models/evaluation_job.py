"""Evaluation job - represents an evaluation task/experiment."""

from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class EvaluationJob(Base):
    __tablename__ = "evaluation_job"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True, comment="任务名称")
    status = Column(
        SAEnum("pending", "running", "completed", "failed", "cancelled", "paused"),
        default="pending",
        nullable=False,
        comment="任务状态",
    )
    config_snapshot = Column(JSON, nullable=True, comment="完整配置快照")
    total_cases = Column(Integer, default=0, comment="总用例数")
    processed_cases = Column(Integer, default=0, comment="已处理用例数")
    success_count = Column(Integer, default=0, comment="成功数")
    failure_count = Column(Integer, default=0, comment="失败数")
    created_by = Column(String(100), nullable=True, comment="创建人")
    duration_seconds = Column(Integer, default=0, comment="累计已运行时间(秒)")
    last_started_at = Column(DateTime, nullable=True, comment="最后启动/恢复时间")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True, comment="完成时间")

    # Relationships
    results = relationship("EvaluationResult", back_populates="job", cascade="all, delete-orphan")
    reports = relationship("AggregatedReport", back_populates="job", cascade="all, delete-orphan")
