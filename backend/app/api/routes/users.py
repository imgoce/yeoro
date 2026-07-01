import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.auth import serialize_user_profile
from app.models.user import User
from app.schemas.user import UserProfileEnvelope, UserProfileUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileEnvelope)
def get_my_profile(current_user: User = Depends(get_current_user)) -> UserProfileEnvelope:
    return UserProfileEnvelope(user=serialize_user_profile(current_user))


@router.put("/me", response_model=UserProfileEnvelope)
def update_my_profile(
    payload: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileEnvelope:
    update_data = payload.model_dump(exclude_unset=True)
    if "nickname" in update_data and update_data["nickname"] is not None:
        duplicate_user = db.scalar(
            select(User).where(User.nickname == update_data["nickname"], User.id != current_user.id)
        )
        if duplicate_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 닉네임입니다.")
        current_user.nickname = update_data["nickname"]
    if "preferred_transport" in update_data:
        current_user.preferred_transport = update_data["preferred_transport"]
    if "preferred_themes" in update_data and update_data["preferred_themes"] is not None:
        current_user.preferred_themes = json.dumps(update_data["preferred_themes"], ensure_ascii=False)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return UserProfileEnvelope(user=serialize_user_profile(current_user))