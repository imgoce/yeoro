from __future__ import annotations

from typing import Any

import httpx


class TourismApiError(Exception):
    pass


class TourismApiClient:
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

    async def get_area_based_list(
        self,
        *,
        area_code: int,
        sigungu_code: int | None = None,
        content_type_id: int | None = None,
        page_no: int = 1,
        num_of_rows: int = 20,
    ) -> dict[str, Any]:
        params = {
            "serviceKey": self._service_key,
            "MobileOS": "ETC",
            "MobileApp": "SejongTour",
            "_type": "json",
            "areaCode": area_code,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
        }
        if sigungu_code is not None:
            params["sigunguCode"] = sigungu_code
        if content_type_id is not None:
            params["contentTypeId"] = content_type_id
        return await self._get("/areaBasedList1", params=params)

    async def get_location_based_list(
        self,
        *,
        map_x: float,
        map_y: float,
        radius: int = 3000,
        content_type_id: int | None = None,
        page_no: int = 1,
        num_of_rows: int = 20,
    ) -> dict[str, Any]:
        params = {
            "serviceKey": self._service_key,
            "MobileOS": "ETC",
            "MobileApp": "SejongTour",
            "_type": "json",
            "mapX": map_x,
            "mapY": map_y,
            "radius": radius,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
        }
        if content_type_id is not None:
            params["contentTypeId"] = content_type_id
        return await self._get("/locationBasedList1", params=params)

    async def get_common_detail(
        self,
        *,
        content_id: int,
        content_type_id: int | None = None,
    ) -> dict[str, Any]:
        params = {
            "serviceKey": self._service_key,
            "MobileOS": "ETC",
            "MobileApp": "SejongTour",
            "_type": "json",
            "contentId": content_id,
            "defaultYN": "Y",
            "overviewYN": "Y",
            "addrinfoYN": "Y",
            "mapinfoYN": "Y",
        }
        if content_type_id is not None:
            params["contentTypeId"] = content_type_id
        return await self._get("/detailCommon1", params=params)

    async def _get(self, path: str, *, params: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._client.get(path, params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise TourismApiError("관광 API 호출에 실패했습니다.") from exc

        payload = response.json()
        result_code = (
            payload.get("response", {})
            .get("header", {})
            .get("resultCode")
        )
        if result_code and result_code != "0000":
            result_message = (
                payload.get("response", {})
                .get("header", {})
                .get("resultMsg", "알 수 없는 오류")
            )
            raise TourismApiError(f"관광 API 오류: {result_message}")
        return payload