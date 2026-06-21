from __future__ import annotations

from datetime import datetime, timezone

from app.models_extras import TrishoolPlatformInfo


class TrishoolAdapter:
    """Trishool platform API requires a whitelisted validator wallet signature.

    Phase 2 exposes platform metadata and links to the hosted dashboard.
    On-chain weights remain available via the metagraph tab.
    """

    netuid = 23
    dashboard_url = "https://trishool.ai/dashboard"

    async def fetch_platform_info(self) -> TrishoolPlatformInfo:
        return TrishoolPlatformInfo(
            available=False,
            dashboard_url=self.dashboard_url,
            message=(
                "Platform weights require a whitelisted validator hotkey. "
                "Use the official Trishool dashboard or on-chain incentive from the metagraph."
            ),
            weights=None,
        )


trishool_adapter = TrishoolAdapter()
