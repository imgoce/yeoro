from collections.abc import AsyncIterator

from app.clients import TourismApiClient
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