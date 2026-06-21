from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.adapters.cache import TTLCache
from app.config import settings
from app.models_extras import (
    OroLeaderboardResponse,
    OroQualifier,
    OroRaceSummary,
    OroTopAgent,
)

_cache = TTLCache(settings.cache_ttl_seconds)


class OroAdapter:
    netuid = 15

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{settings.oro_base_url.rstrip('/')}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    async def fetch_leaderboard(self, race_limit: int = 5) -> OroLeaderboardResponse:
        async def loader():
            top_raw = await self._get("/v1/public/top")
            history_raw = await self._get(
                "/v1/public/races/history",
                {"limit": race_limit, "offset": 0},
            )

            top_agent = OroTopAgent(
                top_miner_hotkey=top_raw.get("top_miner_hotkey"),
                top_score=float(top_raw.get("top_score") or 0),
                top_agent_version_id=top_raw.get("top_agent_version_id"),
                computed_at=top_raw.get("computed_at"),
            )

            recent_races = [
                OroRaceSummary(
                    race_id=str(r.get("race_id", "")),
                    race_number=r.get("race_number"),
                    status=str(r.get("status", "")),
                    winner_agent_name=r.get("winner_agent_name"),
                    winner_score=float(r["winner_score"]) if r.get("winner_score") is not None else None,
                    qualifier_count=r.get("qualifier_count"),
                    race_completed_at=r.get("race_completed_at"),
                )
                for r in history_raw.get("races", [])
            ]

            latest_race_id: str | None = None
            qualifiers: list[OroQualifier] = []
            complete_race = next(
                (r for r in recent_races if r.status == "RACE_COMPLETE" and r.race_id),
                None,
            )
            if complete_race:
                latest_race_id = complete_race.race_id
                detail = await self._get(f"/v1/public/races/{latest_race_id}")
                raw_qualifiers = detail.get("qualifiers", [])
                ranked = sorted(
                    [
                        q
                        for q in raw_qualifiers
                        if q.get("race_score") is not None and not q.get("is_discarded")
                    ],
                    key=lambda q: float(q.get("race_score") or 0),
                    reverse=True,
                )
                for idx, q in enumerate(ranked[:20], start=1):
                    qualifiers.append(
                        OroQualifier(
                            rank=idx,
                            agent_name=q.get("agent_name"),
                            miner_hotkey=q.get("miner_hotkey"),
                            qualifying_score=float(q["qualifying_score"])
                            if q.get("qualifying_score") is not None
                            else None,
                            race_score=float(q["race_score"]) if q.get("race_score") is not None else None,
                            race_rank=q.get("race_rank"),
                        )
                    )

            return OroLeaderboardResponse(
                top_agent=top_agent,
                recent_races=recent_races,
                latest_race_qualifiers=qualifiers,
                latest_race_id=latest_race_id,
                updated_at=datetime.now(timezone.utc),
            )

        return await _cache.get(f"oro:leaderboard:{race_limit}", loader)


oro_adapter = OroAdapter()
