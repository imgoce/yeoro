from __future__ import annotations

from typing import Any

import httpx


class KakaoAuthApiError(Exception):
    pass


class KakaoAuthApiClient:
    def __init__(
        self,
        *,
        auth_base_url: str = "https://kauth.kakao.com",
        api_base_url: str = "https://kapi.kakao.com",
        rest_api_key: str,
        client_secret: str | None = None,
        redirect_uri: str,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._auth_client = httpx.AsyncClient(
            base_url=auth_base_url.rstrip("/"),
            timeout=timeout_seconds,
            headers={
                "Accept": "application/json",
            },
        )

        self._api_client = httpx.AsyncClient(
            base_url=api_base_url.rstrip("/"),
            timeout=timeout_seconds,
            headers={
                "Accept": "application/json",
            },
        )

        self._rest_api_key = rest_api_key
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri

    async def close(self) -> None:
        await self._auth_client.aclose()
        await self._api_client.aclose()

    def get_login_url(
        self,
        *,
        state: str | None = None,
    ) -> str:
        url = (
            f"https://kauth.kakao.com/oauth/authorize"
            f"?response_type=code"
            f"&client_id={self._rest_api_key}"
            f"&redirect_uri={self._redirect_uri}"
        )

        if state:
            url += f"&state={state}"

        return url

    async def get_access_token(
        self,
        *,
        code: str,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {
            "grant_type": "authorization_code",
            "client_id": self._rest_api_key,
            "redirect_uri": self._redirect_uri,
            "code": code,
        }

        if self._client_secret:
            data["client_secret"] = self._client_secret

        try:
            response = await self._auth_client.post(
                "/oauth/token",
                data=data,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise KakaoAuthApiError("카카오 Access Token 발급에 실패했습니다.") from exc


    async def refresh_access_token(
        self,
        *,
        refresh_token: str,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {
            "grant_type": "refresh_token",
            "client_id": self._rest_api_key,
            "refresh_token": refresh_token,
        }

        if self._client_secret:
            data["client_secret"] = self._client_secret

        try:
            response = await self._auth_client.post(
                "/oauth/token",
                data=data,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise KakaoAuthApiError("카카오 Access Token 갱신에 실패했습니다.") from exc


    async def get_user_info(
        self,
        *,
        access_token: str,
    ) -> dict[str, Any]:
        try:
            response = await self._api_client.get(
                "/v2/user/me",
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise KakaoAuthApiError("카카오 사용자 조회에 실패했습니다.") from exc


    async def logout(
        self,
        *,
        access_token: str,
    ) -> dict[str, Any]:
        try:
            response = await self._api_client.post(
                "/v1/user/logout",
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise KakaoAuthApiError("카카오 로그아웃에 실패했습니다.") from exc


    async def unlink(
        self,
        *,
        access_token: str,
    ) -> dict[str, Any]:
        try:
            response = await self._api_client.post(
                "/v1/user/unlink",
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise KakaoAuthApiError("카카오 연결 끊기에 실패했습니다.") from exc

    