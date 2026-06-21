from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.adapters.cache import TTLCache
from app.config import settings


class OroTopAgent(BaseModel):
    top_miner_hotkey: str | None = None
    top_score: float = 0.0
    top_agent_version_id: str | None = None
    computed_at: str | None = None


class OroRaceSummary(BaseModel):
    race_id: str
    race_number: int | None = None
    status: str
    winner_agent_name: str | None = None
    winner_score: float | None = None
    qualifier_count: int | None = None
    race_completed_at: str | None = None


class OroQualifier(BaseModel):
    rank: int
    agent_name: str | None = None
    miner_hotkey: str | None = None
    qualifying_score: float | None = None
    race_score: float | None = None
    race_rank: int | None = None


class OroLeaderboardResponse(BaseModel):
    top_agent: OroTopAgent
    recent_races: list[OroRaceSummary]
    latest_race_qualifiers: list[OroQualifier] = Field(default_factory=list)
    latest_race_id: str | None = None
    updated_at: datetime


class TrishoolPlatformInfo(BaseModel):
    available: bool
    dashboard_url: str
    message: str
    weights: dict[str, float] | None = None


class GittensorAllocationRow(BaseModel):
    repository_full_name: str
    emission_share: float = 0.0
    total_reward: float = 0.0
    pr_score: float = 0.0


class GittensorScoreResponse(BaseModel):
    success: bool
    total_score: float = 0.0
    blended_reward: float = 0.0
    github_id: str | None = None
    hotkey: str | None = None
    is_eligible: bool = False
    merged_prs: int = 0
    allocation: list[GittensorAllocationRow] = Field(default_factory=list)
    failed_reason: str | None = None
    updated_at: datetime


class CliqueMinerScore(BaseModel):
    uid: int
    hotkey: str
    reward: float
    optimality: float = 0.0
    diversity: float = 0.0


class CliqueRunSummary(BaseModel):
    run_id: str
    run_name: str | None = None
    created_at: str | None = None
    problem_type: str | None = None
    difficulty: float | None = None
    miner_count: int = 0
    top_miners: list[CliqueMinerScore] = Field(default_factory=list)


class CliqueRunsResponse(BaseModel):
    runs: list[CliqueRunSummary]
    dashboard_url: str
    updated_at: datetime
