"""Prompt template - reusable prompt templates for evaluation."""

from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PromptTemplate(Base):
    __tablename__ = "prompt_template"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True, comment="模板名称")
    content = Column(Text, nullable=False, comment="模板内容，包含占位符如{question}")
    ability_dimension = Column(String(100), nullable=True, comment="关联的能力维度")
    version = Column(String(50), default="1.0", comment="版本")
    default_params = Column(JSON, nullable=True, comment="默认参数")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
