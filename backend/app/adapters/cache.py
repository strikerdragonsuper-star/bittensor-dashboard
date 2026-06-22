from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

T = TypeVar("T")


class TTLCache:
    """Simple in-memory TTL cache for async loaders."""

    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str, loader: Callable[[], Awaitable[T]]) -> T:
        now = time.monotonic()
        cached = self._store.get(key)
        if cached and now - cached[0] < self._ttl:
            return cached[1]

        async with self._lock:
            cached = self._store.get(key)
            if cached and now - cached[0] < self._ttl:
                return cached[1]

            result = await loader()
            self._store[key] = (time.monotonic(), result)
            return result

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)
