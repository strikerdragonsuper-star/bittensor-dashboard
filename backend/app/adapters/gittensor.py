from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException

from app.config import settings
from app.models_extras import GittensorAllocationRow, GittensorScoreResponse


class GittensorAdapter:
    netuid = 74

    def _repo_path(self) -> Path:
        path = Path(settings.gittensor_repo_path)
        if not path.is_dir():
            raise HTTPException(
                status_code=503,
                detail=(
                    f"GITTENSOR_REPO_PATH not found: {path}. "
                    "Set it to your local gittensor clone."
                ),
            )
        return path

    async def fetch_miner_score(self, github_pat: str | None = None) -> GittensorScoreResponse:
        pat = github_pat or settings.gittensor_miner_pat
        if not pat:
            raise HTTPException(
                status_code=400,
                detail="Provide github_pat in the request body or set GITTENSOR_MINER_PAT in .env",
            )

        repo = self._repo_path()
        env = {**os.environ, "GITTENSOR_MINER_PAT": pat}

        def run_cli() -> dict:
            commands = [
                [sys.executable, "-m", "gittensor.cli.main", "miner", "score", "--json"],
                ["gitt", "miner", "score", "--json"],
            ]
            last_error = ""
            for cmd in commands:
                try:
                    result = subprocess_run(cmd, repo, env)
                    return json.loads(result)
                except FileNotFoundError:
                    last_error = f"Command not found: {cmd[0]}"
                except json.JSONDecodeError as exc:
                    raise RuntimeError(f"Invalid JSON from gitt: {exc}") from exc
                except RuntimeError as exc:
                    last_error = str(exc)
            raise RuntimeError(last_error or "Could not run gitt miner score")

        try:
            payload = await asyncio.to_thread(run_cli)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Gittensor scoring failed: {exc}") from exc

        evaluation = payload.get("miner_evaluation") or {}
        rewards = payload.get("rewards") or {}
        allocation = [
            GittensorAllocationRow(
                repository_full_name=row.get("repository_full_name", ""),
                emission_share=float(row.get("emission_share") or 0),
                total_reward=float(row.get("total_reward") or 0),
                pr_score=float(row.get("pr_score") or 0),
            )
            for row in payload.get("allocation_breakdown") or []
        ]

        return GittensorScoreResponse(
            success=bool(payload.get("success")),
            total_score=float(evaluation.get("total_score") or 0),
            blended_reward=float(rewards.get("blended_final") or 0),
            github_id=str(evaluation.get("github_id")) if evaluation.get("github_id") else None,
            hotkey=evaluation.get("hotkey"),
            is_eligible=bool(evaluation.get("is_eligible")),
            merged_prs=int(evaluation.get("total_merged_prs") or 0),
            allocation=allocation,
            failed_reason=evaluation.get("failed_reason"),
            updated_at=datetime.now(timezone.utc),
        )


def subprocess_run(cmd: list[str], repo: Path, env: dict[str, str]) -> str:
    import subprocess

    result = subprocess.run(
        cmd,
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0:
        stderr = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(stderr[:500] or f"Exit code {result.returncode}")
    return result.stdout


gittensor_adapter = GittensorAdapter()
