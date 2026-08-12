from __future__ import annotations

import httpx


class KakaoAuthError(Exception):
    pass


async def exchange_code_for_token(
    *,
    code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str = "",
) -> str:
    """웹 브라우저 OAuth 콜백에서 받은 authorization code를 카카오 access token으로 교환한다."""
    data = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    if client_secret:
        data["client_secret"] = client_secret

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://kauth.kakao.com/oauth/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code != 200:
        raise KakaoAuthError(f"카카오 토큰 교환 실패: {response.text}")

    access_token = response.json().get("access_token")
    if not access_token:
        raise KakaoAuthError("카카오 응답에 access_token이 없습니다.")
    return access_token


async def fetch_kakao_profile(access_token: str) -> tuple[str, str]:
    """카카오 access token으로 사용자 고유 ID와 닉네임을 조회한다. 반환: (kakao_id, nickname)"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code != 200:
        raise KakaoAuthError(f"카카오 사용자 정보 조회 실패: {response.text}")

    payload = response.json()
    kakao_id = payload.get("id")
    if kakao_id is None:
        raise KakaoAuthError("카카오 응답에 사용자 ID가 없습니다.")

    nickname = (
        payload.get("kakao_account", {}).get("profile", {}).get("nickname")
        or "카카오 회원"
    )
    return str(kakao_id), nickname



async def logout_kakao(access_token: str) -> str:
    """카카오 access token을 받아 토큰을 만료(로그아웃)시킨다. 반환: 로그아웃된 kakao_id(str)"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://kapi.kakao.com/v1/user/logout",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if response.status_code != 200:
        raise KakaoAuthError(f"카카오 로그아웃 실패: {response.text}")

    payload = response.json()
    kakao_id = payload.get("id")
    if kakao_id is None:
        raise KakaoAuthError("카카오 응답에 사용자 ID가 없습니다.")

    return str(kakao_id)


async def unlink_kakao(access_token: str) -> str:
    """카카오 access token을 받아 카카오 계정 연동을 완전히 해제(회원탈퇴)한다. 반환: 해제된 kakao_id(str)"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://kapi.kakao.com/v1/user/unlink",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if response.status_code != 200:
        raise KakaoAuthError(f"카카오 연동 해제 실패: {response.text}")

    payload = response.json()
    kakao_id = payload.get("id")
    if kakao_id is None:
        raise KakaoAuthError("카카오 응답에 사용자 ID가 없습니다.")

    return str(kakao_id)