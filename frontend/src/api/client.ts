import type {
  PortfolioResponse,
  SubnetDashboardResponse,
  SubnetOverview,
  SubnetRankingsResponse,
  SubnetSummary,
  WalletBalance,
} from "../types";
import type {
  CliqueRuns,
  OroLeaderboard,
  TrishoolPlatformInfo,
} from "../types/extras";

type FetchOptions = {
  refresh?: boolean;
};

function withQuery(path: string, options?: FetchOptions): string {
  if (!options?.refresh) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}refresh=1`;
}

async function fetchJson<T>(path: string, init?: RequestInit, timeoutMs = 60_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
    });
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
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out — is the backend running?");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: () => fetchJson<{ status: string; taostats_configured: boolean }>("/api/health"),
  listSubnets: (options?: FetchOptions) =>
    fetchJson<SubnetSummary[]>(withQuery("/api/subnets", options)),
  getSubnetRankings: (options?: FetchOptions) =>
    fetchJson<SubnetRankingsResponse>(
      withQuery("/api/subnets/rankings", options),
      undefined,
      options?.refresh ? 1_800_000 : 120_000,
    ),
  getDashboard: (netuid: number, options?: FetchOptions) =>
    fetchJson<SubnetDashboardResponse>(
      withQuery(`/api/subnets/${netuid}/dashboard`, options),
    ),
  getTagStats: (netuid: number, options?: FetchOptions) =>
    fetchJson<SubnetSummary>(withQuery(`/api/subnets/${netuid}/tag-stats`, options)),
  getOverview: (netuid: number, options?: FetchOptions) =>
    fetchJson<SubnetOverview>(withQuery(`/api/subnets/${netuid}/overview`, options)),
  getBalance: (address: string, options?: FetchOptions) =>
    fetchJson<WalletBalance>(
      withQuery(`/api/wallets/${encodeURIComponent(address)}/balance`, options),
    ),
  getPortfolio: (address: string, options?: FetchOptions) =>
    fetchJson<PortfolioResponse>(
      withQuery(`/api/wallets/${encodeURIComponent(address)}/portfolio`, options),
    ),

  getOroLeaderboard: () => fetchJson<OroLeaderboard>("/api/subnets/15/oro/leaderboard"),
  getTrishoolInfo: () => fetchJson<TrishoolPlatformInfo>("/api/subnets/23/trishool/info"),
  getCliqueRuns: () => fetchJson<CliqueRuns>("/api/subnets/83/clique/runs?limit=8"),
};
