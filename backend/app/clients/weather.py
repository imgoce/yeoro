from __future__ import annotations

from typing import Any

import httpx


class WeatherApiError(Exception):
    pass


class WeatherApiClient:
    def __init__(
        self,
        *,
        base_url: str,
        service_key: str,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._service_key = service_key
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_seconds,
            headers={"Accept": "application/json"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get_village_forecast(
        self,
        *,
        base_date: str,
        base_time: str,
        nx: int,
        ny: int,
        page_no: int = 1,
        num_of_rows: int = 100,
    ) -> dict[str, Any]:
        params = {
            "serviceKey": self._service_key,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": nx,
            "ny": ny,
        }
        return await self._get("/getVilageFcst", params=params)

    async def get_ultra_short_nowcast(
        self,
        *,
        base_date: str,
        base_time: str,
        nx: int,
        ny: int,
        page_no: int = 1,
        num_of_rows: int = 100,
    ) -> dict[str, Any]:
        params = {
            "serviceKey": self._service_key,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": nx,
            "ny": ny,
        }
        return await self._get("/getUltraSrtNcst", params=params)

    async def _get(self, path: str, *, params: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._client.get(path, params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise WeatherApiError("기상청 API 호출에 실패했습니다.") from exc

        payload = response.json()
        result_code = (
            payload.get("response", {})
            .get("header", {})
            .get("resultCode")
        )
        if result_code and result_code != "00":
            result_message = (
                payload.get("response", {})
                .get("header", {})
                .get("resultMsg", "알 수 없는 오류")
            )
            raise WeatherApiError(f"기상청 API 오류: {result_message}")
        return payload