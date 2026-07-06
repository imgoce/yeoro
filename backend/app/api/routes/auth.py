import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserProfileResponse, UserRegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_user_profile(user: User) -> UserProfileResponse:
    preferred_themes = json.loads(user.preferred_themes) if user.preferred_themes else []
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        preferred_themes=preferred_themes,
        preferred_transport=user.preferred_transport,
        is_active=user.is_active,
    )


@router.post("/register", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)) -> UserProfileResponse:
    existing_user = db.scalar(
        select(User).where(or_(User.email == payload.email, User.nickname == payload.nickname))
    )
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 이메일 또는 닉네임입니다.")

    user = User(
        email=payload.email,
        nickname=payload.nickname,
        hashed_password=get_password_hash(payload.password),
        preferred_themes=json.dumps(payload.preferred_themes, ensure_ascii=False),
        preferred_transport=payload.preferred_transport,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user_profile(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)