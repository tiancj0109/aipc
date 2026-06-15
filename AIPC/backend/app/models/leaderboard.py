"""Leaderboard - cached model rankings by ability dimension."""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Leaderboard(Base):
    __tablename__ = "leaderboard"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(Integer, ForeignKey("model_registry.id"), nullable=False, index=True)
    ability_dimension = Column(String(100), nullable=False, index=True, comment="能力维度")
    score = Column(Float, nullable=False, comment="综合得分")
    job_id = Column(Integer, ForeignKey("evaluation_job.id"), nullable=True, comment="产生该得分的最近任务ID")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
