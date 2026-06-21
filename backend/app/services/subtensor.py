from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import settings
from app.models import NeuronRecord, SubnetOverview
from app.subnet_info import SUBNETS

logger = logging.getLogger(__name__)

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
        self._lock = asyncio.Lock()
        self._cache: dict[str, tuple[float, Any]] = {}

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

    async def _cached(self, key: str, loader):
        now = time.monotonic()
        cached = self._cache.get(key)
        if cached and now - cached[0] < settings.cache_ttl_seconds:
            return cached[1]

        async with self._lock:
            cached = self._cache.get(key)
            if cached and now - cached[0] < settings.cache_ttl_seconds:
                return cached[1]

            value = await loader()
            self._cache[key] = (time.monotonic(), value)
            return value

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{settings.taostats_base_url}{path}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url, headers=self._headers(), params=params)
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Taostats API key")
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"Taostats API error ({response.status_code}): {response.text[:200]}",
                )
            return response.json()

    async def fetch_metagraph(self, netuid: int) -> list[dict[str, Any]]:
        async def loader():
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

        return await self._cached(f"metagraph:{netuid}", loader)

    def _parse_neuron(self, row: dict[str, Any]) -> NeuronRecord:
        hotkey = row.get("hotkey", {})
        coldkey = row.get("coldkey", {})
        axon = row.get("axon")
        validator_permit = bool(row.get("validator_permit"))
        vtrust = _float(row.get("validator_trust"))

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
            validator_trust=vtrust,
            is_validator=validator_permit and vtrust > 0,
            is_serving=bool(axon),
            rank=int(row["rank"]) if row.get("rank") is not None else None,
            active=bool(row.get("active", True)),
        )

    async def get_neurons(self, netuid: int) -> tuple[list[NeuronRecord], int]:
        rows = await self.fetch_metagraph(netuid)
        neurons = [self._parse_neuron(row) for row in rows]
        neurons.sort(key=lambda n: n.emission, reverse=True)
        for rank, neuron in enumerate(neurons, start=1):
            neuron.rank = rank
        block = int(rows[0].get("block_number", 0)) if rows else 0
        return neurons, block

    async def get_overview(self, netuid: int) -> SubnetOverview:
        info = SUBNETS[netuid]
        neurons, block = await self.get_neurons(netuid)

        validators = [n for n in neurons if n.is_validator]
        miners = [n for n in neurons if not n.is_validator and n.active]

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
            avg_incentive=sum(n.incentive for n in miners) / max(len(miners), 1),
            updated_at=datetime.now(timezone.utc),
        )

    async def get_balance(self, address: str) -> float:
        async def loader():
            payload = await self._get(
                "/api/account/latest/v1",
                {"address": address, "network": settings.network, "limit": 1},
            )
            rows = payload.get("data", [])
            if not rows:
                return 0.0
            return _rao_to_tao(rows[0].get("balance_free"))

        return await self._cached(f"balance:{address}", loader)


chain_service = TaostatsService()
