from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.adapters.clique import clique_adapter
from app.adapters.oro import oro_adapter
from app.adapters.trishool import trishool_adapter
from app.config import settings
from app.models import (
    HealthResponse,
    PortfolioEntry,
    PortfolioResponse,
    SubnetDashboardResponse,
    SubnetNeuronsResponse,
    SubnetOverview,
    SubnetRankingsResponse,
    SubnetSummary,
    WalletBalance,
)
from app.models_extras import (
    CliqueHotkeyStatusResponse,
    CliqueRunsResponse,
    OroLeaderboardResponse,
    TrishoolPlatformInfo,
)
from app.services.miner_filter import is_miner_neuron
from app.services.subtensor import chain_service
from app.subnet_info import SUBNETS

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        network=settings.network,
        subnets=settings.target_subnets,
        taostats_configured=bool(settings.taostats_api_key),
        wandb_configured=bool(settings.wandb_api_key),
    )


@router.get("/subnets", response_model=list[SubnetSummary])
async def list_subnets(refresh: bool = Query(default=False)) -> list[SubnetSummary]:
    """Return subnet metadata. Burn/fee come from cache unless refresh=1."""
    summaries: list[SubnetSummary] = []
    for netuid, info in SUBNETS.items():
        incentive_burn: float | None = None
        registration_fee: float | None = None
        try:
            incentive_burn, registration_fee = await chain_service.get_subnet_tag_stats(
                netuid,
                refresh=refresh,
                cache_only=not refresh,
            )
        except HTTPException:
            pass

        summaries.append(
            SubnetSummary(
                netuid=netuid,
                name=info["name"],
                description=info["description"],
                dashboard_url=info["dashboard_url"],
                incentive_burn=incentive_burn,
                registration_fee=registration_fee,
            )
        )
    return summaries


@router.get("/subnets/rankings", response_model=SubnetRankingsResponse)
async def subnet_rankings(
    refresh: bool = Query(default=False),
) -> SubnetRankingsResponse:
    """All subnets ranked by total miner daily income (highest first)."""
    rankings = await chain_service.get_subnet_rankings(refresh=refresh)
    warming = chain_service.schedule_miner_daily_warm(refresh=refresh)
    return SubnetRankingsResponse(
        rankings=rankings,
        updated_at=datetime.now(timezone.utc),
        miner_daily_warming=warming or chain_service.is_miner_daily_warming(),
    )


@router.get("/subnets/{netuid}/overview", response_model=SubnetOverview)
async def subnet_overview(
    netuid: int,
    refresh: bool = Query(default=False),
    include_registrations: bool = Query(default=True),
) -> SubnetOverview:
    if netuid not in SUBNETS:
        raise HTTPException(status_code=404, detail=f"Subnet {netuid} is not tracked")
    return await chain_service.get_overview(
        netuid,
        refresh=refresh,
        include_registrations=include_registrations,
    )


@router.get("/subnets/{netuid}/dashboard", response_model=SubnetDashboardResponse)
async def subnet_dashboard(
    netuid: int,
    refresh: bool = Query(default=False),
) -> SubnetDashboardResponse:
    if netuid not in SUBNETS:
        raise HTTPException(status_code=404, detail=f"Subnet {netuid} is not tracked")

    overview, miners, block = await chain_service.get_dashboard(netuid, refresh=refresh)
    return SubnetDashboardResponse(
        overview=overview,
        neurons=miners,
        block=block,
        updated_at=overview.updated_at,
    )


@router.get("/subnets/{netuid}/tag-stats", response_model=SubnetSummary)
async def subnet_tag_stats(
    netuid: int,
    refresh: bool = Query(default=False),
) -> SubnetSummary:
    """Tag stats: burn, fee, and immune registration counts."""
    if netuid not in SUBNETS:
        raise HTTPException(status_code=404, detail=f"Subnet {netuid} is not tracked")

    info = SUBNETS[netuid]
    incentive_burn: float | None = None
    registration_fee: float | None = None
    immune_today: int | None = None
    immune_yesterday: int | None = None
    try:
        incentive_burn, registration_fee = await chain_service.get_subnet_tag_stats(
            netuid,
            refresh=refresh,
            cache_only=not refresh,
        )
        immune_today, immune_yesterday = await chain_service.get_registration_counts(
            netuid,
            fetch_if_missing=True,
            refresh=refresh,
        )
    except HTTPException:
        pass

    return SubnetSummary(
        netuid=netuid,
        name=info["name"],
        description=info["description"],
        dashboard_url=info["dashboard_url"],
        incentive_burn=incentive_burn,
        registration_fee=registration_fee,
        immune_today_count=immune_today,
        immune_yesterday_count=immune_yesterday,
    )


@router.get("/subnets/{netuid}/neurons", response_model=SubnetNeuronsResponse)
async def subnet_neurons(
    netuid: int,
    role: str = Query(default="miner", pattern="^(validator|miner)$"),
    refresh: bool = Query(default=False),
) -> SubnetNeuronsResponse:
    if netuid not in SUBNETS:
        raise HTTPException(status_code=404, detail=f"Subnet {netuid} is not tracked")

    neurons, block = await chain_service.get_neurons(netuid, refresh=refresh)
    if role == "validator":
        neurons = [n for n in neurons if n.is_validator]
    else:
        neurons = [n for n in neurons if is_miner_neuron(n)]

    neurons.sort(key=lambda n: n.daily_income if role == "miner" else n.emission, reverse=True)
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
async def wallet_balance(
    address: str,
    refresh: bool = Query(default=False),
) -> WalletBalance:
    try:
        free_tao = await chain_service.get_balance(address, refresh=refresh)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not fetch balance: {exc}") from exc

    return WalletBalance(
        address=address,
        free_tao=free_tao,
        network=settings.network,
        updated_at=datetime.now(timezone.utc),
    )


@router.get("/wallets/{address}/portfolio", response_model=PortfolioResponse)
async def wallet_portfolio(
    address: str,
    refresh: bool = Query(default=False),
) -> PortfolioResponse:
    """Find registered neurons and stake across tracked subnets for a coldkey or hotkey."""
    try:
        free_tao = await chain_service.get_balance(address, refresh=refresh)
    except Exception:
        free_tao = 0.0

    entries: list[PortfolioEntry] = []
    for netuid in settings.target_subnets:
        neurons, _ = await chain_service.get_neurons(netuid, refresh=refresh)
        info = SUBNETS[netuid]
        matched = [
            n
            for n in neurons
            if n.hotkey == address or n.coldkey == address
        ]
        if not matched:
            continue
        for neuron in matched:
            if neuron.is_validator or not is_miner_neuron(neuron):
                continue
            entries.append(
                PortfolioEntry(
                    netuid=netuid,
                    name=info["name"],
                    uid=neuron.uid,
                    hotkey=neuron.hotkey,
                    stake=neuron.stake,
                    emission=neuron.emission,
                    daily_income=neuron.daily_income,
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


@router.get("/subnets/83/clique/runs", response_model=CliqueRunsResponse)
async def clique_runs(
    limit: int = Query(default=10, ge=1, le=30),
) -> CliqueRunsResponse:
    return await clique_adapter.fetch_recent_runs(limit=limit)


@router.get("/subnets/83/clique/hotkeys/{hotkey}/status", response_model=CliqueHotkeyStatusResponse)
async def clique_hotkey_status(
    hotkey: str,
    refresh: bool = Query(default=False),
) -> CliqueHotkeyStatusResponse:
    """On-chain metagraph status plus latest CliqueAI W&B round score for a hotkey."""
    neurons, _ = await chain_service.get_neurons(83, refresh=refresh)
    _, registration_fee = await chain_service.get_subnet_tag_stats(
        83,
        refresh=refresh,
        cache_only=not refresh,
    )

    neuron = next((n for n in neurons if n.hotkey == hotkey), None)

    miner_rank: int | None = None
    if neuron and is_miner_neuron(neuron):
        miners = [n for n in neurons if is_miner_neuron(n)]
        miners.sort(key=lambda n: n.daily_income, reverse=True)
        miner_rank = next((i + 1 for i, m in enumerate(miners) if m.uid == neuron.uid), None)

    latest_reward: float | None = None
    latest_optimality: float | None = None
    latest_diversity: float | None = None
    latest_run_name: str | None = None
    latest_run_id: str | None = None
    try:
        wandb_score = await clique_adapter.find_hotkey_score(hotkey, refresh=refresh)
        if wandb_score:
            score, latest_run_name, latest_run_id = wandb_score
            latest_reward = score.reward
            latest_optimality = score.optimality
            latest_diversity = score.diversity
    except HTTPException:
        pass

    return CliqueHotkeyStatusResponse(
        hotkey=hotkey,
        registered=neuron is not None,
        uid=neuron.uid if neuron else None,
        miner_rank=miner_rank,
        coldkey=neuron.coldkey if neuron else None,
        active=neuron.active if neuron else False,
        is_serving=neuron.is_serving if neuron else False,
        stake=neuron.stake if neuron else 0.0,
        daily_income=neuron.daily_income if neuron else 0.0,
        incentive=neuron.incentive if neuron else 0.0,
        emission=neuron.emission if neuron else 0.0,
        registration_fee=registration_fee,
        latest_reward=latest_reward,
        latest_optimality=latest_optimality,
        latest_diversity=latest_diversity,
        latest_run_name=latest_run_name,
        latest_run_id=latest_run_id,
        updated_at=datetime.now(timezone.utc),
    )
