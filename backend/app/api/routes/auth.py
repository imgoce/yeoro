import json
import secrets
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.clients.kakao_auth import KakaoAuthError, exchange_code_for_token, fetch_kakao_profile
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import (
    KakaoCallbackLoginRequest,
    KakaoTokenLoginRequest,
    LoginRequest,
    TokenResponse,
    UserProfileResponse,
    UserRegisterRequest,
)

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


def _generate_unique_nickname(db: Session, base: str) -> str:
    nickname = base
    suffix = 1
    while db.scalar(select(User).where(User.nickname == nickname)) is not None:
        nickname = f"{base}_{suffix}"
        suffix += 1
    return nickname


def _unusable_password_hash() -> str:
    # 카카오/게스트 계정은 비밀번호로 로그인할 수 없어야 하므로, 아무도 알 수 없는
    # 무작위 값을 해시해서 채워 넣는다 (verify_password가 항상 실패하게 됨).
    return get_password_hash(secrets.token_urlsafe(32))


def _get_or_create_kakao_user(db: Session, *, kakao_id: str, nickname_hint: str) -> User:
    user = db.scalar(select(User).where(User.kakao_id == kakao_id))
    if user is not None:
        return user

    user = User(
        email=f"kakao_{kakao_id}@kakao.yeoro-noemail.com",
        nickname=_generate_unique_nickname(db, nickname_hint),
        hashed_password=_unusable_password_hash(),
        kakao_id=kakao_id,
        auth_provider="kakao",
        preferred_themes=json.dumps([], ensure_ascii=False),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/kakao/token", response_model=TokenResponse)
async def login_with_kakao_token(payload: KakaoTokenLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """안드로이드 네이티브 카카오 SDK 경로 — 이미 발급받은 access_token을 검증한다."""
    try:
        kakao_id, nickname = await fetch_kakao_profile(payload.access_token)
    except KakaoAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    user = _get_or_create_kakao_user(db, kakao_id=kakao_id, nickname_hint=nickname)
    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)


@router.post("/kakao/callback", response_model=TokenResponse)
async def login_with_kakao_callback(
    payload: KakaoCallbackLoginRequest, db: Session = Depends(get_db)
) -> TokenResponse:
    """웹 브라우저 OAuth 리다이렉트 경로 — authorization code를 access_token으로 교환한 뒤 검증한다."""
    try:
        access_token = await exchange_code_for_token(
            code=payload.code,
            redirect_uri=payload.redirect_uri,
            client_id=settings.kakao_map_rest_api_key,
            client_secret=settings.kakao_client_secret,
        )
        kakao_id, nickname = await fetch_kakao_profile(access_token)
    except KakaoAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    user = _get_or_create_kakao_user(db, kakao_id=kakao_id, nickname_hint=nickname)
    jwt_token = create_access_token(str(user.id))
    return TokenResponse(access_token=jwt_token)


@router.post("/guest", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def login_as_guest(db: Session = Depends(get_db)) -> TokenResponse:
    """게스트 둘러보기 — 매 요청마다 새 익명 계정을 만들어 즉시 토큰을 발급한다.
    프론트엔드는 발급받은 토큰을 저장해두고 재방문 시 재사용해야 한다 (계정 중복 생성 방지)."""
    user = User(
        email=f"guest_{uuid4().hex}@guest.yeoro-noemail.com",
        nickname=_generate_unique_nickname(db, "게스트"),
        hashed_password=_unusable_password_hash(),
        auth_provider="guest",
        preferred_themes=json.dumps([], ensure_ascii=False),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)