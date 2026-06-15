"""Model management API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.model_registry import ModelRegistry
from app.schemas.model import ModelCreate, ModelUpdate, ModelResponse
from app.utils.crypto import encrypt_api_key
from app.utils.provider import normalize_provider

router = APIRouter(prefix="/models", tags=["Model Registry"])


@router.get("", response_model=list[ModelResponse])
def list_models(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    provider: Optional[str] = None,
    status: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """获取模型列表，支持分页、搜索和过滤。"""
    query = db.query(ModelRegistry)
    if search:
        query = query.filter(ModelRegistry.name.contains(search))
    if provider:
        query = query.filter(ModelRegistry.provider == normalize_provider(provider))
    if status is not None:
        query = query.filter(ModelRegistry.status == status)
    return query.order_by(ModelRegistry.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/count")
def count_models(db: Session = Depends(get_db)):
    """获取模型总数。"""
    return {"count": db.query(ModelRegistry).count()}


@router.get("/{model_id}", response_model=ModelResponse)
def get_model(model_id: int, db: Session = Depends(get_db)):
    """获取单个模型详情。"""
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")
    return model


@router.post("", response_model=ModelResponse, status_code=201)
def create_model(data: ModelCreate, db: Session = Depends(get_db)):
    """添加新模型。"""
    model = ModelRegistry(
        name=data.name,
        provider=normalize_provider(data.provider),
        version=data.version,
        api_endpoint=data.api_endpoint,
        api_key_encrypted=encrypt_api_key(data.api_key) if data.api_key else None,
        capabilities=data.capabilities,
        default_params=data.default_params,
        pricing=data.pricing,
        status=data.status,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.put("/{model_id}", response_model=ModelResponse)
def update_model(model_id: int, data: ModelUpdate, db: Session = Depends(get_db)):
    """修改模型信息。"""
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")

    update_data = data.model_dump(exclude_unset=True)
    if "provider" in update_data:
        update_data["provider"] = normalize_provider(update_data["provider"])
    if "api_key" in update_data:
        key = update_data.pop("api_key")
        if key:
            model.api_key_encrypted = encrypt_api_key(key)

    for field, value in update_data.items():
        setattr(model, field, value)

    db.commit()
    db.refresh(model)
    return model


@router.delete("/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db)):
    """删除模型。"""
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")
    db.delete(model)
    db.commit()
    return {"message": "模型已删除"}


@router.patch("/{model_id}/toggle")
def toggle_model(model_id: int, db: Session = Depends(get_db)):
    """启用/禁用模型。"""
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")
    model.status = 0 if model.status == 1 else 1
    db.commit()
    return {"id": model.id, "status": model.status}
