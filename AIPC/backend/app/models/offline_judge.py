"""Offline Artificial Intelligence Judge models."""

from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, Float, Enum as SAEnum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class OfflineJobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OfflineJudgeJob(Base):
    __tablename__ = "offline_judge_job"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True, comment="任务名称")
    status = Column(
        SAEnum("pending", "running", "completed", "failed", "cancelled"),
        default="pending",
        nullable=False,
        comment="任务状态",
    )
    config_snapshot = Column(JSON, nullable=True, comment="评分模式、自定义prompt等配置快照")
    total_cases = Column(Integer, default=0, comment="总记录数")
    processed_cases = Column(Integer, default=0, comment="已处理记录数")
    success_count = Column(Integer, default=0, comment="成功数")
    failure_count = Column(Integer, default=0, comment="失败数")
    
    # Aggregated metrics
    accuracy_rate = Column(Float, nullable=True, comment="二元准确率 (0.0-1.0)")
    average_score = Column(Float, nullable=True, comment="平均分 (0-10)")
    summary = Column(JSON, nullable=True, comment="包含维度得分等聚合信息的汇总")
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True, comment="完成时间")

    # Relationships
    results = relationship("OfflineJudgeResult", back_populates="job", cascade="all, delete-orphan")


class OfflineJudgeResult(Base):
    __tablename__ = "offline_judge_result"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("offline_judge_job.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 用户上传的原始数据
    prompt = Column(Text, nullable=False, comment="测试问题/Prompt")
    reference_answer = Column(Text, nullable=True, comment="标准答案")
    model_output = Column(Text, nullable=False, comment="待测模型输出")
    
    # AI 裁判评分结果
    judge_model = Column(String(255), nullable=True, comment="执行评分的裁判模型名称")
    score = Column(Float, nullable=True, comment="最终得分 (0-10) 或准确率标记 (0/1)")
    reason = Column(Text, nullable=True, comment="AI裁判给出的理由")
    dimension_scores = Column(JSON, nullable=True, comment='各维度得分 (仅在打分模式下存在)')
    error = Column(Text, nullable=True, comment="调用裁判的错误信息")

    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    job = relationship("OfflineJudgeJob", back_populates="results")
