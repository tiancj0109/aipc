"""Test case - individual test items within a test suite."""

from sqlalchemy import Column, BigInteger, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class TestCase(Base):
    __tablename__ = "test_case"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    suite_id = Column(Integer, ForeignKey("test_suite.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt = Column(Text, nullable=False, comment="输入提示")
    reference_answer = Column(JSON, nullable=True, comment="参考答案")
    metadata_ = Column("metadata", JSON, nullable=True, comment="元数据 (类别/难度/题型)")
    hash = Column(String(64), nullable=True, index=True, comment="内容哈希用于去重")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    suite = relationship("TestSuite", back_populates="cases")
