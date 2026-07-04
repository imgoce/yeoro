from __future__ import annotations

from typing import Any

import httpx


class KakaoMapApiError(Exception):
    pass


class KakaoMapApiClient:
    def __init__(
        self,
        *,
        base_url: str,
        rest_api_key: str,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_seconds,
            headers={
                "Accept": "application/json",
                "Authorization": f"KakaoAK {rest_api_key}",
            },
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def search_keyword(
        self,
        *,
        query: str,
        x: float | None = None,
        y: float | None = None,
        radius: int | None = None,
        page: int = 1,
        size: int = 15,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "query": query,
            "page": page,
            "size": size,
        }
        if x is not None:
            params["x"] = x
        if y is not None:
            params["y"] = y
        if radius is not None:
            params["radius"] = radius
        return await self._get("/v2/local/search/keyword.json", params=params)

    async def search_category(
        self,
        *,
        category_group_code: str,
        x: float,
        y: float,
        radius: int = 3000,
        page: int = 1,
        size: int = 15,
    ) -> dict[str, Any]:
        params = {
            "category_group_code": category_group_code,
            "x": x,
            "y": y,
            "radius": radius,
            "page": page,
            "size": size,
        }
        return await self._get("/v2/local/search/category.json", params=params)

    async def coord_to_region_code(
        self,
        *,
        x: float,
        y: float,
    ) -> dict[str, Any]:
        return await self._get(
            "/v2/local/geo/coord2regioncode.json",
            params={"x": x, "y": y},
        )

    async def _get(self, path: str, *, params: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._client.get(path, params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise KakaoMapApiError("카카오맵 API 호출에 실패했습니다.") from exc
        return response.json()