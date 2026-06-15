"""Model registry - stores information about LLM models."""

from sqlalchemy import Column, Integer, String, Text, JSON, SmallInteger, DateTime
from sqlalchemy.sql import func
from app.database import Base


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True, comment="模型名称")
    provider = Column(String(100), nullable=False, comment="提供商 (openai/anthropic/ollama/local)")
    version = Column(String(100), nullable=True, comment="模型版本 (如 gpt-4-1106)")
    api_endpoint = Column(Text, nullable=False, comment="API地址")
    api_key_encrypted = Column(Text, nullable=True, comment="加密后的API密钥")
    capabilities = Column(JSON, nullable=True, comment='支持的能力 ["text","code","image"]')
    default_params = Column(JSON, nullable=True, comment="默认调用参数 (temperature, max_tokens等)")
    pricing = Column(JSON, nullable=True, comment='计价规则 {"input":0.5,"output":1.5} 美元/百万tokens')
    status = Column(SmallInteger, default=1, nullable=False, comment="1启用 0禁用")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
