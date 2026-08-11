import json

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.auth import _retire_user_identity, serialize_user_profile
from app.clients.kakao_auth import KakaoAuthError, fetch_kakao_profile, unlink_kakao
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


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    kakao_access_token: str | None = Header(None, alias="X-Kakao-Access-Token"),
) -> dict[str, str]:
    """회원 탈퇴 처리: 카카오 연동 해제 및 서비스 계정 비활성화"""
    if current_user.auth_provider == "kakao":
        if not kakao_access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="카카오 계정 탈퇴를 위해 X-Kakao-Access-Token 헤더가 필요합니다.",
            )

        try:
            kakao_id, _ = await fetch_kakao_profile(kakao_access_token)
        except KakaoAuthError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

        if kakao_id != current_user.kakao_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="카카오 access token이 현재 사용자와 일치하지 않습니다.",
            )

        try:
            await unlink_kakao(kakao_access_token)
        except KakaoAuthError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc

    _retire_user_identity(current_user)
    db.add(current_user)
    db.commit()

    return {"message": "성공적으로 회원 탈퇴 및 계정이 비활성화되었습니다."}
