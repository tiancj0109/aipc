"""Test suite - stores test set metadata."""

from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class TestSuite(Base):
    __tablename__ = "test_suite"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True, comment="测试集名称")
    description = Column(Text, nullable=True, comment="描述")
    source = Column(String(100), nullable=False, comment="来源 (MMLU/GSM8K/custom等)")
    version = Column(String(50), default="1.0", comment="版本号")
    ability_dimensions = Column(JSON, nullable=True, comment='能力维度 ["knowledge","reasoning"]')
    category_distribution = Column(JSON, nullable=True, comment="类别分布统计")
    total_cases = Column(Integer, default=0, comment="总测试用例数")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    cases = relationship("TestCase", back_populates="suite", cascade="all, delete-orphan")
