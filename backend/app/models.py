from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class NeuronRecord(BaseModel):
    uid: int
    hotkey: str
    coldkey: str
    stake: float
    trust: float
    consensus: float
    incentive: float
    dividends: float
    emission: float
    daily_income: float
    validator_trust: float
    is_validator: bool
    is_owner: bool = False
    is_serving: bool
    rank: int | None = None
    active: bool = True


class SubnetOverview(BaseModel):
    netuid: int
    name: str
    description: str
    dashboard_url: str
    block: int
    total_neurons: int
    validator_count: int
    miner_count: int
    total_stake: float
    total_emission: float
    total_daily_income: float
    avg_incentive: float
    incentive_burn: float = 0.0
    registration_fee: float = 0.0
    immune_registration_count: int = 0
    immune_today_count: int | None = None
    immune_yesterday_count: int | None = None
    updated_at: datetime


class SubnetNeuronsResponse(BaseModel):
    netuid: int
    name: str
    block: int
    neurons: list[NeuronRecord]
    updated_at: datetime


class SubnetDashboardResponse(BaseModel):
    overview: SubnetOverview
    neurons: list[NeuronRecord]
    block: int
    updated_at: datetime


class WalletBalance(BaseModel):
    address: str
    free_tao: float
    network: str
    updated_at: datetime


class SubnetSummary(BaseModel):
    netuid: int
    name: str
    description: str
    dashboard_url: str
    incentive_burn: float | None = None
    registration_fee: float | None = None
    immune_registration_count: int | None = None
    immune_today_count: int | None = None
    immune_yesterday_count: int | None = None


class HealthResponse(BaseModel):
    status: str
    network: str
    subnets: list[int]
    taostats_configured: bool
    wandb_configured: bool


class PortfolioEntry(BaseModel):
    netuid: int
    name: str
    uid: int | None = None
    hotkey: str | None = None
    stake: float = 0.0
    emission: float = 0.0
    daily_income: float = 0.0
    incentive: float = 0.0
    role: str = Field(description="validator, miner, or none")


class PortfolioResponse(BaseModel):
    address: str
    network: str
    free_tao: float
    entries: list[PortfolioEntry]
    updated_at: datetime


class SubnetRankingEntry(BaseModel):
    rank: int
    netuid: int
    name: str
    incentive_burn: float
    miner_daily_total: float = 0.0
    registration_fee: float = 0.0
    tracked: bool = False


class SubnetRankingsResponse(BaseModel):
    rankings: list[SubnetRankingEntry]
    updated_at: datetime
    miner_daily_warming: bool = False
