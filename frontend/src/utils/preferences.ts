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

const CLIQUE_HOTKEYS_KEY = "bittensor-dashboard.cliqueHotkeys";

export function readStoredCliqueHotkeys(): string[] {
  try {
    const raw = localStorage.getItem(CLIQUE_HOTKEYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function storeCliqueHotkeys(hotkeys: string[]): void {
  try {
    localStorage.setItem(CLIQUE_HOTKEYS_KEY, JSON.stringify(hotkeys));
  } catch {
    /* ignore */
  }
}

export function addCliqueHotkey(hotkey: string): string[] {
  const trimmed = hotkey.trim();
  if (!trimmed) return readStoredCliqueHotkeys();
  const existing = readStoredCliqueHotkeys();
  if (existing.includes(trimmed)) return existing;
  const next = [...existing, trimmed];
  storeCliqueHotkeys(next);
  return next;
}

export function removeCliqueHotkey(hotkey: string): string[] {
  const next = readStoredCliqueHotkeys().filter((value) => value !== hotkey);
  storeCliqueHotkeys(next);
  return next;
}
