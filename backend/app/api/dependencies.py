from collections.abc import AsyncIterator

from fastapi import Depends
from redis.asyncio import Redis

from app.clients import TourismApiClient, KakaoMapApiClient, WeatherApiClient
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