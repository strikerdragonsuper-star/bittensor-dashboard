import type {
  PortfolioResponse,
  SubnetNeuronsResponse,
  SubnetOverview,
  SubnetSummary,
  WalletBalance,
} from "../types";
import type {
  CliqueRuns,
  OroLeaderboard,
  TrishoolPlatformInfo,
} from "../types/extras";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let detail = await response.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      detail = parsed.detail ?? detail;
    } catch {
      /* keep raw text */
    }
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => fetchJson<{ status: string; taostats_configured: boolean }>("/api/health"),
  listSubnets: () => fetchJson<SubnetSummary[]>("/api/subnets"),
  getOverview: (netuid: number) =>
    fetchJson<SubnetOverview>(`/api/subnets/${netuid}/overview`),
  getNeurons: (netuid: number, role: "validator" | "miner" = "miner") => {
    return fetchJson<SubnetNeuronsResponse>(`/api/subnets/${netuid}/neurons?role=${role}`);
  },
  getBalance: (address: string) =>
    fetchJson<WalletBalance>(`/api/wallets/${encodeURIComponent(address)}/balance`),
  getPortfolio: (address: string) =>
    fetchJson<PortfolioResponse>(`/api/wallets/${encodeURIComponent(address)}/portfolio`),

  getOroLeaderboard: () => fetchJson<OroLeaderboard>("/api/subnets/15/oro/leaderboard"),
  getTrishoolInfo: () => fetchJson<TrishoolPlatformInfo>("/api/subnets/23/trishool/info"),
  getCliqueRuns: () => fetchJson<CliqueRuns>("/api/subnets/83/clique/runs?limit=8"),
};
