import json
import secrets
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.clients.kakao_auth import (
    KakaoAuthError,
    exchange_code_for_token,
    fetch_kakao_profile,
    logout_kakao,
)
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import (
    KakaoCallbackLoginRequest,
    KakaoLogoutRequest,
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
    # 카카오/게스트 계정은 비밀번호 로그인을 막기 위해 아무도 모르는 값을 해시해 둔다.
    return get_password_hash(secrets.token_urlsafe(32))


def _retire_user_identity(user: User) -> None:
    suffix = uuid4().hex
    user.email = f"deleted_{user.id}_{suffix}@deleted.yeoro-noemail.com"
    user.nickname = f"deleted_user_{user.id}_{suffix[:12]}"
    user.kakao_id = None
    user.is_active = False


def _get_or_create_kakao_user(db: Session, *, kakao_id: str, nickname_hint: str) -> User:
    user = db.scalar(select(User).where(User.kakao_id == kakao_id))
    if user is not None:
        if user.is_active:
            return user

        _retire_user_identity(user)
        db.add(user)
        db.commit()

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
    """안드로이드 네이티브 카카오 SDK 경로 - 이미 발급받은 access_token을 검증한다."""
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
    """웹 브라우저 OAuth 경로 - authorization code를 access_token으로 교환한 뒤 검증한다."""
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
    """게스트 둘러보기 - 매 요청마다 새 익명 계정을 만들어 즉시 토큰을 발급한다."""
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


@router.post("/kakao/logout", status_code=status.HTTP_200_OK)
async def logout_kakao_user(
    payload: KakaoLogoutRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    if current_user.auth_provider != "kakao" or not current_user.kakao_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="카카오 연동 계정만 카카오 로그아웃을 요청할 수 있습니다.",
        )

    try:
        token_kakao_id, _ = await fetch_kakao_profile(payload.access_token)
        if token_kakao_id != current_user.kakao_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="카카오 access token이 현재 사용자와 일치하지 않습니다.",
            )
        kakao_id = await logout_kakao(payload.access_token)
    except KakaoAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    return {
        "message": "카카오 토큰이 만료되었습니다. 앱 로그아웃을 완료하려면 클라이언트의 서비스 토큰도 삭제하세요.",
        "kakao_id": kakao_id,
    }
