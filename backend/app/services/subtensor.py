from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, TypeVar

import httpx
from fastapi import HTTPException

from app.config import settings
from app.models import NeuronRecord, SubnetOverview, SubnetRankingEntry
from app.services.miner_filter import is_miner_neuron
from app.subnet_info import SUBNETS

logger = logging.getLogger(__name__)

T = TypeVar("T")
RAO = 1_000_000_000


def _rao_to_tao(value: str | int | float | None) -> float:
    if value is None:
        return 0.0
    try:
        return float(value) / RAO
    except (TypeError, ValueError):
        return 0.0


def _float(value: str | int | float | None) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class TaostatsService:
    """Fetch metagraph and account data from the Taostats API."""

    def __init__(self) -> None:
        self._call_times: deque[float] = deque()
        self._gate = asyncio.Lock()
        self._cache_lock = asyncio.Lock()
        self._cache: dict[str, tuple[float, Any]] = {}
        self._inflight: dict[str, asyncio.Task[Any]] = {}
        self._miner_daily_warm_task: asyncio.Task[None] | None = None

    async def _cached(
        self,
        key: str,
        loader: Callable[[], Awaitable[T]],
        *,
        refresh: bool = False,
        ttl: int | None = None,
    ) -> T:
        ttl_seconds = ttl if ttl is not None else settings.cache_ttl_seconds
        now = time.monotonic()
        if not refresh:
            cached = self._cache.get(key)
            if cached and now - cached[0] < ttl_seconds:
                return cached[1]

        async def load() -> T:
            if refresh:
                async with self._cache_lock:
                    self._cache.pop(key, None)
            else:
                async with self._cache_lock:
                    cached = self._cache.get(key)
                    if cached and time.monotonic() - cached[0] < ttl_seconds:
                        return cached[1]

            result = await loader()

            async with self._cache_lock:
                self._cache[key] = (time.monotonic(), result)
            return result

        shared_key = f"{key}:refresh" if refresh else key
        return await self._shared(shared_key, load)

    def _invalidate_netuid(self, netuid: int) -> None:
        prefixes = (
            f"dashboard:{netuid}",
            f"metagraph:{netuid}",
            f"subnet:{netuid}",
            f"tag_stats:{netuid}",
        )
        for key in list(self._cache):
            if key in prefixes or key.startswith(f"registrations:day:{netuid}:"):
                self._cache.pop(key, None)

    async def _shared(self, key: str, factory: Callable[[], Awaitable[T]]) -> T:
        """Coalesce concurrent identical in-flight requests."""
        existing = self._inflight.get(key)
        if existing is not None and not existing.done():
            return await asyncio.shield(existing)

        task = asyncio.create_task(factory())
        self._inflight[key] = task
        try:
            return await task
        finally:
            if self._inflight.get(key) is task:
                del self._inflight[key]

    def _throttle_wait_seconds(self) -> float:
        now = time.monotonic()
        while self._call_times and now - self._call_times[0] >= 60:
            self._call_times.popleft()

        max_per_min = settings.taostats_max_requests_per_minute
        if len(self._call_times) >= max_per_min:
            return 60 - (now - self._call_times[0]) + 0.5
        if self._call_times:
            gap = settings.taostats_min_request_interval - (now - self._call_times[-1])
            if gap > 0:
                return gap
        return 0.0

    def _headers(self) -> dict[str, str]:
        if not settings.taostats_api_key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "TAOSTATS_API_KEY is not configured. "
                    "Get a free key at https://taostats.io/pro and set it in backend/.env"
                ),
            )
        return {"Authorization": settings.taostats_api_key}

    async def _get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        _retry: int = 0,
    ) -> dict[str, Any]:
        async with self._gate:
            retry = _retry
            while True:
                while True:
                    wait = self._throttle_wait_seconds()
                    if wait <= 0:
                        break
                    logger.info("Taostats rate limit: waiting %.1fs", wait)
                    await asyncio.sleep(wait)

                self._call_times.append(time.monotonic())
                url = f"{settings.taostats_base_url}{path}"
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.get(url, headers=self._headers(), params=params)
                if response.status_code == 401:
                    raise HTTPException(status_code=401, detail="Invalid Taostats API key")
                if response.status_code == 429 and retry < 5:
                    await asyncio.sleep(20)
                    retry += 1
                    continue
                if response.status_code == 429:
                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "Taostats rate limit reached (free tier: 5 requests/min). "
                            "Try again shortly."
                        ),
                    )
                if response.status_code >= 400:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Taostats API error ({response.status_code}): {response.text[:200]}",
                    )
                return response.json()

    async def fetch_metagraph(self, netuid: int, *, refresh: bool = False) -> list[dict[str, Any]]:
        return await self._cached(
            f"metagraph:{netuid}",
            lambda: self._fetch_metagraph(netuid),
            refresh=refresh,
        )

    async def _fetch_metagraph(self, netuid: int) -> list[dict[str, Any]]:
        payload = await self._get(
            "/api/metagraph/latest/v1",
            {
                "netuid": netuid,
                "limit": 1024,
                "order": "emission_desc",
                "network": settings.network,
            },
        )
        return payload.get("data", [])

    async def fetch_subnet(self, netuid: int, *, refresh: bool = False) -> dict[str, Any]:
        return await self._cached(
            f"subnet:{netuid}",
            lambda: self._fetch_subnet(netuid),
            refresh=refresh,
        )

    async def _fetch_subnet(self, netuid: int) -> dict[str, Any]:
        payload = await self._get(
            "/api/subnet/latest/v1",
            {"netuid": netuid, "limit": 1, "network": settings.network},
        )
        rows = payload.get("data", [])
        return rows[0] if rows else {}

    @staticmethod
    def _count_immune_registrations(rows: list[dict[str, Any]]) -> int:
        return sum(1 for row in rows if row.get("is_immunity_period"))

    async def fetch_registration_day_counts(
        self, netuid: int, *, refresh: bool = False
    ) -> tuple[int, int]:
        """Count new neuron registrations today and yesterday (UTC calendar days)."""
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        key = f"registrations:day:{netuid}:{today_start.date()}"
        return await self._cached(
            key,
            lambda: self._fetch_registration_day_counts(netuid),
            refresh=refresh,
            ttl=settings.registration_cache_ttl_seconds,
        )

    async def get_registration_counts(
        self,
        netuid: int,
        *,
        fetch_if_missing: bool = True,
        refresh: bool = False,
    ) -> tuple[int | None, int | None]:
        """Return cached registration counts without fetching when cache is cold."""
        if refresh:
            today, yesterday = await self.fetch_registration_day_counts(netuid, refresh=True)
            return today, yesterday

        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        key = f"registrations:day:{netuid}:{today_start.date()}"
        cached = self._cache.get(key)
        if cached and time.monotonic() - cached[0] < settings.registration_cache_ttl_seconds:
            return cached[1]

        if not fetch_if_missing:
            return None, None

        today, yesterday = await self.fetch_registration_day_counts(netuid)
        return today, yesterday

    async def _fetch_registration_day_counts(self, netuid: int) -> tuple[int, int]:
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        yesterday_start = today_start - timedelta(days=1)

        async def count_in_range(ts_start: int, ts_end: int) -> int:
            payload = await self._get(
                "/api/subnet/neuron/registration/v1",
                {
                    "netuid": netuid,
                    "network": settings.network,
                    "timestamp_start": ts_start,
                    "timestamp_end": ts_end,
                    "limit": 1,
                },
            )
            pagination = payload.get("pagination", {})
            total = pagination.get("total_items")
            if total is not None:
                return int(total)
            return len(payload.get("data", []))

        today_count = await count_in_range(
            int(today_start.timestamp()),
            int(now.timestamp()),
        )
        yesterday_count = await count_in_range(
            int(yesterday_start.timestamp()),
            int(today_start.timestamp()),
        )
        return today_count, yesterday_count

    async def get_subnet_tag_stats(
        self,
        netuid: int,
        *,
        refresh: bool = False,
        cache_only: bool = False,
    ) -> tuple[float | None, float | None]:
        key = f"tag_stats:{netuid}"
        now = time.monotonic()
        if not refresh:
            cached = self._cache.get(key)
            if cached and now - cached[0] < settings.cache_ttl_seconds:
                return cached[1]
            if cache_only:
                return None, None

        burn, fee = await self._load_subnet_tag_stats(netuid, refresh=refresh)
        self._cache[key] = (time.monotonic(), (burn, fee))
        return burn, fee

    async def _load_subnet_tag_stats(
        self, netuid: int, *, refresh: bool = False
    ) -> tuple[float, float]:
        subnet = await self.fetch_subnet(netuid, refresh=refresh)
        return (
            _float(subnet.get("incentive_burn")),
            _rao_to_tao(subnet.get("neuron_registration_cost")),
        )

    def _parse_neuron(self, row: dict[str, Any]) -> NeuronRecord:
        hotkey = row.get("hotkey", {})
        coldkey = row.get("coldkey", {})
        axon = row.get("axon")
        validator_permit = bool(row.get("validator_permit"))
        vtrust = _float(row.get("validator_trust"))

        daily_income_tao = _rao_to_tao(row.get("daily_mining_alpha_as_tao"))

        return NeuronRecord(
            uid=int(row.get("uid", 0)),
            hotkey=hotkey.get("ss58", "") if isinstance(hotkey, dict) else str(hotkey),
            coldkey=coldkey.get("ss58", "") if isinstance(coldkey, dict) else str(coldkey),
            stake=_rao_to_tao(row.get("total_alpha_stake") or row.get("alpha_stake")),
            trust=_float(row.get("trust")),
            consensus=_float(row.get("consensus")),
            incentive=_float(row.get("incentive")),
            dividends=_float(row.get("dividends")),
            emission=_rao_to_tao(row.get("emission")),
            daily_income=daily_income_tao,
            validator_trust=vtrust,
            is_validator=validator_permit and vtrust > 0,
            is_owner=bool(row.get("is_owner_hotkey")),
            is_serving=bool(axon),
            rank=int(row["rank"]) if row.get("rank") is not None else None,
            active=bool(row.get("active", True)),
        )

    async def get_neurons(
        self, netuid: int, *, refresh: bool = False
    ) -> tuple[list[NeuronRecord], int]:
        rows = await self.fetch_metagraph(netuid, refresh=refresh)
        neurons = [self._parse_neuron(row) for row in rows]
        neurons.sort(key=lambda n: n.emission, reverse=True)
        for rank, neuron in enumerate(neurons, start=1):
            neuron.rank = rank
        block = int(rows[0].get("block_number", 0)) if rows else 0
        return neurons, block

    async def get_overview(
        self,
        netuid: int,
        *,
        refresh: bool = False,
        include_registrations: bool = True,
    ) -> SubnetOverview:
        info = SUBNETS[netuid]
        subnet = await self.fetch_subnet(netuid, refresh=refresh)
        rows = await self.fetch_metagraph(netuid, refresh=refresh)
        neurons = [self._parse_neuron(row) for row in rows]
        block = int(rows[0].get("block_number", 0)) if rows else 0

        validators = [n for n in neurons if n.is_validator]
        miners = [n for n in neurons if is_miner_neuron(n)]
        immune_today: int | None = None
        immune_yesterday: int | None = None
        if include_registrations:
            immune_today, immune_yesterday = await self.fetch_registration_day_counts(
                netuid, refresh=refresh
            )

        return SubnetOverview(
            netuid=netuid,
            name=info["name"],
            description=info["description"],
            dashboard_url=info["dashboard_url"],
            block=block,
            total_neurons=len(miners),
            validator_count=len(validators),
            miner_count=len(miners),
            total_stake=sum(n.stake for n in miners),
            total_emission=sum(n.emission for n in miners),
            total_daily_income=sum(n.daily_income for n in miners),
            avg_incentive=sum(n.incentive for n in miners) / max(len(miners), 1),
            incentive_burn=_float(subnet.get("incentive_burn")),
            registration_fee=_rao_to_tao(subnet.get("neuron_registration_cost")),
            immune_registration_count=self._count_immune_registrations(rows),
            immune_today_count=immune_today,
            immune_yesterday_count=immune_yesterday,
            updated_at=datetime.now(timezone.utc),
        )

    async def get_dashboard(
        self, netuid: int, *, refresh: bool = False
    ) -> tuple[SubnetOverview, list[NeuronRecord], int]:
        """Overview + miner list from a single metagraph fetch."""
        if refresh:
            self._invalidate_netuid(netuid)
        return await self._cached(
            f"dashboard:{netuid}",
            lambda: self._load_dashboard(netuid),
            refresh=refresh,
        )

    async def _load_dashboard(
        self, netuid: int
    ) -> tuple[SubnetOverview, list[NeuronRecord], int]:
        info = SUBNETS[netuid]
        subnet = await self.fetch_subnet(netuid)
        rows = await self.fetch_metagraph(netuid)
        neurons = [self._parse_neuron(row) for row in rows]
        block = int(rows[0].get("block_number", 0)) if rows else 0

        validators = [n for n in neurons if n.is_validator]
        miners = [n for n in neurons if is_miner_neuron(n)]

        overview = SubnetOverview(
            netuid=netuid,
            name=info["name"],
            description=info["description"],
            dashboard_url=info["dashboard_url"],
            block=block,
            total_neurons=len(miners),
            validator_count=len(validators),
            miner_count=len(miners),
            total_stake=sum(n.stake for n in miners),
            total_emission=sum(n.emission for n in miners),
            total_daily_income=sum(n.daily_income for n in miners),
            avg_incentive=sum(n.incentive for n in miners) / max(len(miners), 1),
            incentive_burn=_float(subnet.get("incentive_burn")),
            registration_fee=_rao_to_tao(subnet.get("neuron_registration_cost")),
            immune_registration_count=self._count_immune_registrations(rows),
            immune_today_count=None,
            immune_yesterday_count=None,
            updated_at=datetime.now(timezone.utc),
        )

        miners.sort(key=lambda n: n.daily_income, reverse=True)
        for rank, neuron in enumerate(miners, start=1):
            neuron.rank = rank
        return overview, miners, block

    async def get_balance(self, address: str, *, refresh: bool = False) -> float:
        return await self._cached(
            f"balance:{address}",
            lambda: self._fetch_balance(address),
            refresh=refresh,
        )

    async def _fetch_balance(self, address: str) -> float:
        payload = await self._get(
            "/api/account/latest/v1",
            {"address": address, "network": settings.network, "limit": 1},
        )
        rows = payload.get("data", [])
        if not rows:
            return 0.0
        return _rao_to_tao(rows[0].get("balance_free"))

    @staticmethod
    def _resolve_subnet_name(netuid: int, pool_names: dict[int, str]) -> str:
        if netuid in SUBNETS:
            return SUBNETS[netuid]["name"]

        pool_name = (pool_names.get(netuid) or "").strip()
        if pool_name and pool_name.lower() not in {"unknown", "pending..."}:
            return pool_name
        return ""

    async def _fetch_subnet_pool_name_map(
        self, *, refresh: bool = False, cache_only: bool = False
    ) -> dict[int, str]:
        async def loader() -> dict[int, str]:
            payload = await self._get(
                "/api/dtao/pool/latest/v1",
                {"network": settings.network, "limit": 256},
            )
            names: dict[int, str] = {}
            for row in payload.get("data", []):
                netuid = int(row.get("netuid", -1))
                name = (row.get("name") or "").strip()
                if netuid >= 0 and name:
                    names[netuid] = name
            return names

        key = "subnet_pool_names:all"
        now = time.monotonic()
        if not refresh:
            cached = self._cache.get(key)
            if cached and now - cached[0] < settings.rankings_cache_ttl_seconds:
                return cached[1]
            if cache_only:
                return {}

        return await self._cached(
            key,
            loader,
            refresh=refresh,
            ttl=settings.rankings_cache_ttl_seconds,
        )

    def _cached_miner_daily_total(self, netuid: int) -> float:
        key = f"miner_daily_total:{netuid}"
        cached = self._cache.get(key)
        if cached and time.monotonic() - cached[0] < settings.rankings_cache_ttl_seconds:
            return float(cached[1])
        return 0.0

    def _clear_miner_daily_caches(self) -> None:
        for key in list(self._cache):
            if key.startswith("miner_daily_total:"):
                self._cache.pop(key, None)

    def is_miner_daily_warming(self) -> bool:
        return (
            self._miner_daily_warm_task is not None
            and not self._miner_daily_warm_task.done()
        )

    def _has_complete_miner_daily_cache(self) -> bool:
        cached_subnets = self._cache.get("all_subnets:latest")
        if not cached_subnets:
            return False
        rows = cached_subnets[1]
        netuids = [int(row.get("netuid", -1)) for row in rows if int(row.get("netuid", -1)) > 0]
        if not netuids:
            return False
        ttl = settings.rankings_cache_ttl_seconds
        now = time.monotonic()
        for netuid in netuids:
            cached = self._cache.get(f"miner_daily_total:{netuid}")
            if not cached or now - cached[0] >= ttl:
                return False
        return True

    def schedule_miner_daily_warm(self, *, refresh: bool = False) -> bool:
        if self._has_complete_miner_daily_cache() and not refresh:
            return False
        self.ensure_miner_daily_warming(refresh=refresh)
        return True

    def ensure_miner_daily_warming(self, *, refresh: bool = False) -> None:
        if self._miner_daily_warm_task and not self._miner_daily_warm_task.done():
            return
        self._miner_daily_warm_task = asyncio.create_task(
            self._warm_miner_daily_cache(refresh=refresh)
        )

    async def _warm_miner_daily_cache(self, *, refresh: bool = False) -> None:
        try:
            rows = await self._fetch_all_subnet_rows(refresh=False)
            netuids = [
                int(row.get("netuid", -1))
                for row in rows
                if int(row.get("netuid", -1)) > 0
            ]
            for netuid in netuids:
                await self._sum_miner_daily_total(netuid, refresh=refresh)
            await self._fetch_subnet_pool_name_map(refresh=refresh)
            self._cache.pop("subnet_rankings:miner_daily", None)
            logger.info("Miner daily cache warm complete for %d subnets", len(netuids))
        except Exception:
            logger.exception("Miner daily cache warm failed")

    async def _sum_miner_daily_total(self, netuid: int, *, refresh: bool = False) -> float:
        async def loader() -> float:
            rows = await self.fetch_metagraph(netuid, refresh=refresh)
            total = 0.0
            for row in rows:
                neuron = self._parse_neuron(row)
                if is_miner_neuron(neuron):
                    total += neuron.daily_income
            return total

        return await self._cached(
            f"miner_daily_total:{netuid}",
            loader,
            refresh=refresh,
            ttl=settings.rankings_cache_ttl_seconds,
        )

    async def _fetch_all_subnet_rows(self, *, refresh: bool = False) -> list[dict[str, Any]]:
        async def loader() -> list[dict[str, Any]]:
            payload = await self._get(
                "/api/subnet/latest/v1",
                {"network": settings.network, "limit": 256},
            )
            return payload.get("data", [])

        return await self._cached(
            "all_subnets:latest",
            loader,
            refresh=refresh,
            ttl=settings.rankings_cache_ttl_seconds,
        )

    async def _build_rankings(self, *, refresh: bool = False) -> list[SubnetRankingEntry]:
        rows = await self._fetch_all_subnet_rows(refresh=refresh)
        pool_names = await self._fetch_subnet_pool_name_map(
            refresh=refresh,
            cache_only=not refresh,
        )
        entries: list[SubnetRankingEntry] = []

        for row in rows:
            netuid = int(row.get("netuid", -1))
            if netuid <= 0:
                continue

            burn = _float(row.get("incentive_burn"))

            entries.append(
                SubnetRankingEntry(
                    rank=0,
                    netuid=netuid,
                    name=self._resolve_subnet_name(netuid, pool_names),
                    incentive_burn=burn,
                    miner_daily_total=self._cached_miner_daily_total(netuid),
                    registration_fee=_rao_to_tao(row.get("neuron_registration_cost")),
                    tracked=netuid in SUBNETS,
                )
            )

        entries.sort(
            key=lambda entry: (entry.miner_daily_total, entry.incentive_burn),
            reverse=True,
        )
        for index, entry in enumerate(entries, start=1):
            entry.rank = index
        return entries

    async def get_subnet_rankings(
        self, *, refresh: bool = False
    ) -> list[SubnetRankingEntry]:
        if refresh:
            self._cache.pop("subnet_rankings:miner_daily", None)
            self._clear_miner_daily_caches()

        return await self._cached(
            "subnet_rankings:miner_daily",
            lambda: self._build_rankings(refresh=refresh),
            refresh=refresh,
            ttl=settings.rankings_cache_ttl_seconds,
        )


chain_service = TaostatsService()
