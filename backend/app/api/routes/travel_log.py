from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.travel_log import TravelLog
from app.models.user import User
from app.schemas.travel_log import TravelLogCreate, TravelLogResponse

router = APIRouter(prefix="/users/me/travel-logs", tags=["travel-log"])


@router.get("", response_model=list[TravelLogResponse])
def list_travel_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TravelLog]:
    return list(
        db.scalars(
            select(TravelLog)
            .where(TravelLog.user_id == current_user.id)
            .order_by(TravelLog.created_at.desc())
            .limit(100)
        )
    )


@router.post("", response_model=TravelLogResponse, status_code=status.HTTP_201_CREATED)
def create_travel_log(
    payload: TravelLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TravelLog:
    log = TravelLog(
        user_id=current_user.id,
        place_name=payload.place_name,
        category=payload.category,
        address=payload.address,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_travel_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    log = db.get(TravelLog, log_id)
    if log is None or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="기록을 찾을 수 없습니다.")
    db.delete(log)
    db.commit()