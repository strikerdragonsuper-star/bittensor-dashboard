from __future__ import annotations

import asyncio
import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")


class TTLCache:
    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str, loader: Callable[[], Any]) -> Any:
        now = time.monotonic()
        cached = self._store.get(key)
        if cached and now - cached[0] < self._ttl:
            return cached[1]

        async with self._lock:
            cached = self._store.get(key)
            if cached and now - cached[0] < self._ttl:
                return cached[1]

            value = await loader() if asyncio.iscoroutinefunction(loader) else loader()
            self._store[key] = (time.monotonic(), value)
            return value
