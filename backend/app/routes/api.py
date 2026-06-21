from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.adapters.clique import clique_adapter
from app.adapters.gittensor import gittensor_adapter
from app.adapters.oro import oro_adapter
from app.adapters.trishool import trishool_adapter
from app.config import settings
from app.models import (
    HealthResponse,
    PortfolioEntry,
    PortfolioResponse,
    SubnetNeuronsResponse,
    SubnetOverview,
    SubnetSummary,
    WalletBalance,
)
from app.models_extras import (
    CliqueRunsResponse,
    GittensorScoreResponse,
    OroLeaderboardResponse,
    TrishoolPlatformInfo,
)
from app.schemas import GittensorScoreRequest
from app.services.subtensor import chain_service
from app.subnet_info import SUBNETS

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    gittensor_path = Path(settings.gittensor_repo_path)
    return HealthResponse(
        status="ok",
        network=settings.network,
        subnets=settings.target_subnets,
        taostats_configured=bool(settings.taostats_api_key),
        wandb_configured=bool(settings.wandb_api_key),
        gittensor_configured=gittensor_path.is_dir() and bool(settings.gittensor_miner_pat),
    )

@router.get("/subnets", response_model=list[SubnetSummary])
async def list_subnets() -> list[SubnetSummary]:
    return [
        SubnetSummary(
            netuid=netuid,
            name=info["name"],
            description=info["description"],
            dashboard_url=info["dashboard_url"],
        )
        for netuid, info in SUBNETS.items()
    ]


@router.get("/subnets/{netuid}/overview", response_model=SubnetOverview)
async def subnet_overview(netuid: int) -> SubnetOverview:
    if netuid not in SUBNETS:
        raise HTTPException(status_code=404, detail=f"Subnet {netuid} is not tracked")
    return await chain_service.get_overview(netuid)


@router.get("/subnets/{netuid}/neurons", response_model=SubnetNeuronsResponse)
async def subnet_neurons(
    netuid: int,
    role: str = Query(default="miner", pattern="^(validator|miner)$"),
) -> SubnetNeuronsResponse:
    if netuid not in SUBNETS:
        raise HTTPException(status_code=404, detail=f"Subnet {netuid} is not tracked")

    neurons, block = await chain_service.get_neurons(netuid)
    if role == "validator":
        neurons = [n for n in neurons if n.is_validator]
    else:
        neurons = [n for n in neurons if not n.is_validator and n.active]

    neurons.sort(key=lambda n: n.emission, reverse=True)
    for rank, neuron in enumerate(neurons, start=1):
        neuron.rank = rank

    info = SUBNETS[netuid]
    return SubnetNeuronsResponse(
        netuid=netuid,
        name=info["name"],
        block=block,
        neurons=neurons,
        updated_at=datetime.now(timezone.utc),
    )


@router.get("/wallets/{address}/balance", response_model=WalletBalance)
async def wallet_balance(address: str) -> WalletBalance:
    try:
        free_tao = await chain_service.get_balance(address)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not fetch balance: {exc}") from exc

    return WalletBalance(
        address=address,
        free_tao=free_tao,
        network=settings.network,
        updated_at=datetime.now(timezone.utc),
    )


@router.get("/wallets/{address}/portfolio", response_model=PortfolioResponse)
async def wallet_portfolio(address: str) -> PortfolioResponse:
    """Find registered neurons and stake across tracked subnets for a coldkey or hotkey."""
    try:
        free_tao = await chain_service.get_balance(address)
    except Exception:
        free_tao = 0.0

    entries: list[PortfolioEntry] = []
    for netuid in settings.target_subnets:
        neurons, _ = await chain_service.get_neurons(netuid)
        info = SUBNETS[netuid]
        matched = [
            n
            for n in neurons
            if n.hotkey == address or n.coldkey == address
        ]
        if not matched:
            continue
        for neuron in matched:
            if neuron.is_validator:
                continue
            entries.append(
                PortfolioEntry(
                    netuid=netuid,
                    name=info["name"],
                    uid=neuron.uid,
                    hotkey=neuron.hotkey,
                    stake=neuron.stake,
                    emission=neuron.emission,
                    incentive=neuron.incentive,
                    role="miner",
                )
            )

    return PortfolioResponse(
        address=address,
        network=settings.network,
        free_tao=free_tao,
        entries=entries,
        updated_at=datetime.now(timezone.utc),
    )


@router.get("/subnets/15/oro/leaderboard", response_model=OroLeaderboardResponse)
async def oro_leaderboard(
    limit: int = Query(default=5, ge=1, le=20),
) -> OroLeaderboardResponse:
    return await oro_adapter.fetch_leaderboard(race_limit=limit)


@router.get("/subnets/23/trishool/info", response_model=TrishoolPlatformInfo)
async def trishool_info() -> TrishoolPlatformInfo:
    return await trishool_adapter.fetch_platform_info()


@router.post("/subnets/74/gittensor/score", response_model=GittensorScoreResponse)
async def gittensor_score(body: GittensorScoreRequest) -> GittensorScoreResponse:
    return await gittensor_adapter.fetch_miner_score(github_pat=body.github_pat)


@router.get("/subnets/83/clique/runs", response_model=CliqueRunsResponse)
async def clique_runs(
    limit: int = Query(default=10, ge=1, le=30),
) -> CliqueRunsResponse:
    return await clique_adapter.fetch_recent_runs(limit=limit)
