"""Prompt template management API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.prompt_template import PromptTemplate
from app.schemas.prompt_template import PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse

router = APIRouter(prefix="/prompt-templates", tags=["Prompt Templates"])


@router.get("", response_model=list[PromptTemplateResponse])
def list_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    ability_dimension: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取prompt模板列表。"""
    query = db.query(PromptTemplate)
    if ability_dimension:
        query = query.filter(PromptTemplate.ability_dimension == ability_dimension)
    return query.order_by(PromptTemplate.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{template_id}", response_model=PromptTemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    """获取模板详情。"""
    template = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template


@router.post("", response_model=PromptTemplateResponse, status_code=201)
def create_template(data: PromptTemplateCreate, db: Session = Depends(get_db)):
    """创建prompt模板。"""
    template = PromptTemplate(**data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.put("/{template_id}", response_model=PromptTemplateResponse)
def update_template(template_id: int, data: PromptTemplateUpdate, db: Session = Depends(get_db)):
    """更新prompt模板。"""
    template = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """删除prompt模板。"""
    template = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    db.delete(template)
    db.commit()
    return {"message": "模板已删除"}
