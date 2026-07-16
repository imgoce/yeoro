from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError


class RedisCache:
    def __init__(
        self,
        redis: Redis,
        *,
        default_ttl_seconds: int = 300,
    ) -> None:
        self._redis = redis
        self._default_ttl_seconds = default_ttl_seconds

    async def get_json(self, key: str) -> Any | None:
        value = await self._redis.get(key)
        if value is None:
            return None
        return json.loads(value)

    async def set_json(
        self,
        key: str,
        value: Any,
        *,
        ttl_seconds: int | None = None,
    ) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl_seconds
        await self._redis.set(key, json.dumps(value, ensure_ascii=False), ex=ttl)

    async def delete(self, key: str) -> None:
        try:
            await self._redis.delete(key)
        except RedisError:
            pass

    async def get_or_set_json(
        self,
        key: str,
        loader: Callable[[], Awaitable[Any]],
        *,
        ttl_seconds: int | None = None,
    ) -> Any:
        try:
            cached = await self.get_json(key)
            if cached is not None:
                return cached
        except (RedisError, json.JSONDecodeError):
            pass
        
        value = await loader()
        try:
            await self.set_json(key, value, ttl_seconds=ttl_seconds)
        except RedisError:
            pass
        
        return value