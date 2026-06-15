"""Pydantic schemas for test suites and test cases."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
import json
import ast
from datetime import datetime


class TestSuiteCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    source: str = Field(..., max_length=100)
    version: str = Field("1.0", max_length=50)
    ability_dimensions: Optional[list[str]] = None


class TestSuiteUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    source: Optional[str] = Field(None, max_length=100)
    version: Optional[str] = Field(None, max_length=50)
    ability_dimensions: Optional[list[str]] = None


class TestSuiteResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    source: str
    version: str
    ability_dimensions: Optional[list[str]] = None
    category_distribution: Optional[dict] = None
    total_cases: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TestCaseCreate(BaseModel):
    suite_id: int
    prompt: str
    reference_answer: Optional[dict] = None
    metadata_: Optional[dict] = Field(None, alias="metadata")


class TestCaseResponse(BaseModel):
    id: int
    suite_id: int
    prompt: str
    reference_answer: Optional[dict[str, Any]] = None
    metadata_: Optional[dict[str, Any]] = Field(None, alias="metadata")
    hash: Optional[str] = None
    created_at: Optional[datetime] = None

    @field_validator('reference_answer', 'metadata_', mode='before')
    @classmethod
    def parse_json_fields(cls, v: Any) -> Optional[dict[str, Any]]:
        def parse_str(raw: str) -> Optional[dict[str, Any]]:
            text = raw.strip()
            if not text:
                return None
            current: Any = text
            for _ in range(3):
                if isinstance(current, dict):
                    return current
                if not isinstance(current, str):
                    return None
                payload = current.strip()
                if not payload:
                    return None
                try:
                    current = json.loads(payload)
                    continue
                except json.JSONDecodeError:
                    pass
                try:
                    current = ast.literal_eval(payload)
                    continue
                except Exception:
                    return None
            return current if isinstance(current, dict) else None

        if isinstance(v, str):
            return parse_str(v)
        if isinstance(v, dict):
            return v
        return None

    class Config:
        from_attributes = True
        populate_by_name = True
