from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException

from app.adapters.cache import TTLCache
from app.config import settings
from app.models_extras import (
    CliqueMinerScore,
    CliqueRunSummary,
    CliqueRunsResponse,
)

DASHBOARD_URL = "https://wandb.ai/toptensor-ai/CliqueAI/table"
_cache = TTLCache(settings.cache_ttl_seconds)


class CliqueAdapter:
    netuid = 83

    def _api(self):
        if not settings.wandb_api_key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "WANDB_API_KEY is not configured. "
                    "Get a key at https://wandb.ai/authorize and set it in backend/.env"
                ),
            )
        try:
            import wandb
        except ImportError as exc:
            raise HTTPException(
                status_code=503,
                detail="Install wandb: pip install wandb",
            ) from exc

        wandb.login(key=settings.wandb_api_key, relogin=False)
        return wandb.Api()

    def _fetch_runs_sync(self, limit: int) -> CliqueRunsResponse:
        api = self._api()
        path = f"{settings.wandb_entity}/{settings.wandb_project}"
        runs = api.runs(path, order="-created_at", per_page=limit)

        summaries: list[CliqueRunSummary] = []
        for run in runs:
            top_miners: list[CliqueMinerScore] = []
            problem_type = None
            difficulty = None

            try:
                history = run.history(samples=1, pandas=False)
                if history:
                    row = history[-1]
                    problem_type = row.get("type") or row.get("label")
                    difficulty = float(row["difficulty"]) if row.get("difficulty") is not None else None

                    uids = row.get("miner_uids") or []
                    hotkeys = row.get("miner_hotkeys") or []
                    rewards = row.get("miner_rewards") or []
                    optimalities = row.get("miner_optimality") or []
                    diversities = row.get("miner_diversity") or []

                    miners = []
                    for i, uid in enumerate(uids):
                        reward = float(rewards[i]) if i < len(rewards) else 0.0
                        miners.append(
                            CliqueMinerScore(
                                uid=int(uid),
                                hotkey=str(hotkeys[i]) if i < len(hotkeys) else "",
                                reward=reward,
                                optimality=float(optimalities[i]) if i < len(opticalities) else 0.0,
                                diversity=float(diversities[i]) if i < len(diversities) else 0.0,
                            )
                        )
                    miners.sort(key=lambda m: m.reward, reverse=True)
                    top_miners = miners[:10]
            except Exception:
                pass

            summaries.append(
                CliqueRunSummary(
                    run_id=run.id,
                    run_name=run.name,
                    created_at=str(run.created_at) if run.created_at else None,
                    problem_type=problem_type,
                    difficulty=difficulty,
                    miner_count=len(top_miners),
                    top_miners=top_miners,
                )
            )

        return CliqueRunsResponse(
            runs=summaries,
            dashboard_url=DASHBOARD_URL,
            updated_at=datetime.now(timezone.utc),
        )

    async def fetch_recent_runs(self, limit: int = 10) -> CliqueRunsResponse:
        return await _cache.get(
            f"clique:runs:{limit}",
            lambda: asyncio.to_thread(self._fetch_runs_sync, limit),
        )

    def _find_hotkey_score_sync(
        self, hotkey: str, *, run_limit: int = 12
    ) -> tuple[CliqueMinerScore, str | None, str | None] | None:
        api = self._api()
        path = f"{settings.wandb_entity}/{settings.wandb_project}"
        runs = api.runs(path, order="-created_at", per_page=run_limit)

        for run in runs:
            try:
                history = run.history(samples=1, pandas=False)
                if not history:
                    continue
                row = history[-1]
                uids = row.get("miner_uids") or []
                hotkeys = row.get("miner_hotkeys") or []
                rewards = row.get("miner_rewards") or []
                optimalities = row.get("miner_optimality") or []
                diversities = row.get("miner_diversity") or []

                for i, uid in enumerate(uids):
                    if i >= len(hotkeys) or str(hotkeys[i]) != hotkey:
                        continue
                    return (
                        CliqueMinerScore(
                            uid=int(uid),
                            hotkey=hotkey,
                            reward=float(rewards[i]) if i < len(rewards) else 0.0,
                            optimality=float(optimalities[i]) if i < len(optimalities) else 0.0,
                            diversity=float(diversities[i]) if i < len(diversities) else 0.0,
                        ),
                        run.name,
                        run.id,
                    )
            except Exception:
                continue
        return None

    async def find_hotkey_score(
        self, hotkey: str, *, refresh: bool = False
    ) -> tuple[CliqueMinerScore, str | None, str | None] | None:
        cache_key = f"clique:hotkey:{hotkey}"
        if refresh:
            _cache.invalidate(cache_key)

        return await _cache.get(
            cache_key,
            lambda: asyncio.to_thread(self._find_hotkey_score_sync, hotkey),
        )


clique_adapter = CliqueAdapter()
