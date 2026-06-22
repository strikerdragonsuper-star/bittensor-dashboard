import { SUBNETS } from "../subnets";

const NETUID_KEY = "bittensor-dashboard.activeNetuid";
const TAB_KEY = "bittensor-dashboard.tab";

const VALID_NETUIDS = new Set(SUBNETS.map((s) => s.netuid));
const DEFAULT_NETUID = SUBNETS[0]?.netuid ?? 15;

export type AppTab = "subnets" | "rankings" | "wallet";

export function readStoredNetuid(): number {
  try {
    const raw = localStorage.getItem(NETUID_KEY);
    if (!raw) return DEFAULT_NETUID;
    const netuid = Number(raw);
    if (Number.isInteger(netuid) && VALID_NETUIDS.has(netuid)) return netuid;
  } catch {
    /* private browsing or blocked storage */
  }
  return DEFAULT_NETUID;
}

export function storeNetuid(netuid: number): void {
  try {
    localStorage.setItem(NETUID_KEY, String(netuid));
  } catch {
    /* ignore */
  }
}

export function readStoredTab(): AppTab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === "subnets" || raw === "wallet" || raw === "rankings") return raw;
  } catch {
    /* ignore */
  }
  return "subnets";
}

export function storeTab(tab: AppTab): void {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}
