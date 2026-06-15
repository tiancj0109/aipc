"""Leaderboard API routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.leaderboard import Leaderboard
from app.models.model_registry import ModelRegistry

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


@router.get("")
def get_leaderboard(
    ability_dimension: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """获取排行榜，支持按能力维度筛选。"""
    query = db.query(Leaderboard)
    if ability_dimension:
        query = query.filter(Leaderboard.ability_dimension == ability_dimension)

    entries = query.order_by(Leaderboard.score.desc()).limit(limit).all()

    result = []
    for entry in entries:
        model = db.query(ModelRegistry).filter(ModelRegistry.id == entry.model_id).first()
        result.append({
            "id": entry.id,
            "model_id": entry.model_id,
            "model_name": model.name if model else "Unknown",
            "model_provider": model.provider if model else "",
            "ability_dimension": entry.ability_dimension,
            "score": entry.score,
            "job_id": entry.job_id,
            "updated_at": entry.updated_at,
        })
    return result


@router.get("/dimensions")
def get_dimensions(db: Session = Depends(get_db)):
    """获取所有可用的能力维度。"""
    dimensions = db.query(Leaderboard.ability_dimension).distinct().all()
    return [d[0] for d in dimensions]
