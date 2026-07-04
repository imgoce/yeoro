from collections.abc import AsyncIterator

from app.clients import TourismApiClient, KakaoMapApiClient
from app.core.config import settings


async def get_tourism_api_client() -> AsyncIterator[TourismApiClient]:
    client = TourismApiClient(
        base_url=settings.tourism_api_base_url,
        service_key=settings.tourism_api_key,
        timeout_seconds=settings.tourism_api_timeout_seconds,
    )
    try:
        yield client
    finally:
        await client.close()

async def get_kakao_map_api_client() -> AsyncIterator[KakaoMapApiClient]:
    client = KakaoMapApiClient(
        base_url=settings.kakao_map_api_base_url,
        rest_api_key=settings.kakao_map_rest_api_key,
        timeout_seconds=settings.kakao_map_timeout_seconds,
    )
    try:
        yield client
    finally:
        await client.close()