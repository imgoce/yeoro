from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db
from app.models.place import Place
from app.models.travel_log import TravelLog
from app.models.user import User
from app.schemas.travel_log import (
    TravelLogCreateRequest,
    TravelLogItemResponse,
    TravelLogTimelineResponse,
    TravelLogUpdateRequest,
)

router = APIRouter(prefix="/travel-logs", tags=["travel-logs"])


def serialize_travel_log(log: TravelLog) -> TravelLogItemResponse:
    place = log.place
    return TravelLogItemResponse(
        id=log.id,
        title=log.title,
        description=log.description,
        visited_at=log.visited_at,
        mood=log.mood,
        stay_minutes=log.stay_minutes,
        place_id=place.id if place else None,
        place_name=place.name if place else None,
        place_category=place.category if place else None,
        place_address=place.address if place else None,
        latitude=place.latitude if place else None,
        longitude=place.longitude if place else None,
    )


@router.get("", response_model=TravelLogTimelineResponse)
def list_travel_logs(
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TravelLogTimelineResponse:
    statement = select(TravelLog).where(TravelLog.user_id == current_user.id)
    if start_at:
        statement = statement.where(TravelLog.visited_at >= start_at)
    if end_at:
        statement = statement.where(TravelLog.visited_at <= end_at)

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    logs = (
        db.execute(
            statement
            .options(joinedload(TravelLog.place))
            .order_by(TravelLog.visited_at.desc(), TravelLog.id.desc())
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return TravelLogTimelineResponse(total=total, items=[serialize_travel_log(log) for log in logs])


@router.post("", response_model=TravelLogItemResponse, status_code=status.HTTP_201_CREATED)
def create_travel_log(
    payload: TravelLogCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TravelLogItemResponse:
    place = None
    if payload.place_id is not None:
        place = db.get(Place, payload.place_id)
        if place is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="연결할 여행지가 없습니다.")

    log = TravelLog(
        user_id=current_user.id,
        place_id=payload.place_id,
        title=payload.title,
        description=payload.description,
        visited_at=payload.visited_at,
        mood=payload.mood,
        stay_minutes=payload.stay_minutes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    if place is not None:
        log.place = place
    return serialize_travel_log(log)


@router.put("/{travel_log_id}", response_model=TravelLogItemResponse)
def update_travel_log(
    travel_log_id: int,
    payload: TravelLogUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TravelLogItemResponse:
    log = db.scalar(
        select(TravelLog)
        .options(joinedload(TravelLog.place))
        .where(TravelLog.id == travel_log_id, TravelLog.user_id == current_user.id)
    )
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행 로그를 찾을 수 없습니다.")

    if payload.place_id is not None:
        place = db.get(Place, payload.place_id)
        if place is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="연결할 여행지가 없습니다.")
        log.place_id = payload.place_id
        log.place = place

    for field_name in ("title", "description", "visited_at", "mood", "stay_minutes"):
        value = getattr(payload, field_name)
        if value is not None:
            setattr(log, field_name, value)

    db.add(log)
    db.commit()
    db.refresh(log)
    return serialize_travel_log(log)


@router.delete("/{travel_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_travel_log(
    travel_log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    log = db.scalar(select(TravelLog).where(TravelLog.id == travel_log_id, TravelLog.user_id == current_user.id))
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행 로그를 찾을 수 없습니다.")
    db.delete(log)
    db.commit()
