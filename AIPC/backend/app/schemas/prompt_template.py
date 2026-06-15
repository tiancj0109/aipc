"""Pydantic schemas for prompt templates."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PromptTemplateCreate(BaseModel):
    name: str = Field(..., max_length=255)
    content: str = Field(..., description="模板内容, 包含占位符如{question}")
    ability_dimension: Optional[str] = Field(None, max_length=100)
    version: str = Field("1.0", max_length=50)
    default_params: Optional[dict] = None


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = None
    ability_dimension: Optional[str] = Field(None, max_length=100)
    version: Optional[str] = Field(None, max_length=50)
    default_params: Optional[dict] = None


class PromptTemplateResponse(BaseModel):
    id: int
    name: str
    content: str
    ability_dimension: Optional[str] = None
    version: str
    default_params: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
