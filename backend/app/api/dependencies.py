from collections.abc import AsyncIterator

from fastapi import Depends
from redis.asyncio import Redis

# [수정] 모든 Client들을 app.clients 패키지로부터 일관되게 임포트합니다.
from app.clients import (
    TourismApiClient,
    KakaoMapApiClient,
    WeatherApiClient,
    KakaoAuthApiClient,  # 이제 패키지에서 바로 가져올 수 있습니다.
)
from app.core.config import settings
from app.core.cache import RedisCache

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
        ka_origin=settings.kakao_ka_origin,
    )
    try:
        yield client
    finally:
        await client.close()

async def get_weather_api_client() -> AsyncIterator[WeatherApiClient]:
    client = WeatherApiClient(
        base_url=settings.weather_api_base_url,
        service_key=settings.weather_api_key,
        timeout_seconds=settings.weather_api_timeout_seconds,
    )
    try:
        yield client
    finally:
        await client.close()

async def get_redis_client() -> AsyncIterator[Redis]:
    client = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def get_redis_cache(
    redis_client: Redis = Depends(get_redis_client),
) -> AsyncIterator[RedisCache]:
    yield RedisCache(
        redis_client,
        default_ttl_seconds=settings.redis_default_ttl_seconds,
    )


async def get_kakao_auth_api_client() -> AsyncIterator[KakaoAuthApiClient]:
    client = KakaoAuthApiClient(
        auth_base_url=settings.kakao_auth_base_url,
        api_base_url=settings.kakao_api_base_url,
        rest_api_key=settings.kakao_rest_api_key,
        client_secret=settings.kakao_client_secret,
        redirect_uri=settings.kakao_redirect_uri,
        timeout_seconds=settings.kakao_timeout_seconds,
    )
    try:
        yield client
    finally:
        await client.close()    