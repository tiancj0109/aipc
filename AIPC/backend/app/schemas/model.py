"""Pydantic schemas for model registry."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
import json
from datetime import datetime


class ModelCreate(BaseModel):
    name: str = Field(..., max_length=255, description="模型名称")
    provider: str = Field(..., max_length=100, description="提供商")
    version: Optional[str] = Field(None, max_length=100, description="模型版本")
    api_endpoint: str = Field(..., description="API地址")
    api_key: Optional[str] = Field(None, description="API密钥 (明文, 存储时加密)")
    capabilities: Optional[list[str]] = Field(None, description="能力列表")
    default_params: Optional[dict[str, Any]] = Field(None, description="默认参数")
    pricing: Optional[dict[str, Any]] = Field(None, description="计价规则")
    status: int = Field(1, description="1启用 0禁用")

    @field_validator('default_params', 'pricing', mode='before')
    @classmethod
    def parse_json_fields(cls, v: Any) -> Optional[dict[str, Any]]:
        if isinstance(v, str):
            if not v.strip():
                return None
            try:
                res = json.loads(v)
                if isinstance(res, dict):
                    return res
                return None
            except json.JSONDecodeError:
                raise ValueError("必须是有效的JSON字符串")
        if isinstance(v, dict):
            return v
        return None


class ModelUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    provider: Optional[str] = Field(None, max_length=100)
    version: Optional[str] = Field(None, max_length=100)
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    capabilities: Optional[list[str]] = None
    default_params: Optional[dict[str, Any]] = None
    pricing: Optional[dict[str, Any]] = None
    status: Optional[int] = None

    @field_validator('default_params', 'pricing', mode='before')
    @classmethod
    def parse_json_fields_update(cls, v: Any) -> Optional[dict[str, Any]]:
        if isinstance(v, str):
            if not v.strip():
                return None
            try:
                res = json.loads(v)
                if isinstance(res, dict):
                    return res
                return None
            except json.JSONDecodeError:
                raise ValueError("必须是有效的JSON字符串")
        if isinstance(v, dict):
            return v
        return None


class ModelResponse(BaseModel):
    id: int
    name: str
    provider: str
    version: Optional[str] = None
    api_endpoint: str
    capabilities: Optional[list[str]] = None
    default_params: Optional[dict] = None
    pricing: Optional[dict] = None
    status: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
